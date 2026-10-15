/**
 * SoundFont reader: SF2 (.sf2) and MuseScore's SF3 (.sf3, the same structure with Ogg
 * Vorbis samples). It flattens the preset tree into SampleRegions and notes where each
 * sample's audio lies, without reading the audio itself, so even a 1 GB bank costs only
 * a few small reads: the RIFF chunk headers, the INFO list and the pdta ("hydra") list.
 *
 * Layout (SoundFont 2.04 spec):
 *
 *   RIFF 'sfbk'
 *     LIST 'INFO'  ifil (version), INAM (name), ICOP, ICMT, IENG, IPRD…
 *     LIST 'sdta'  smpl (16-bit mono PCM), sm24 (optional low bytes for 24-bit)
 *     LIST 'pdta'  phdr pbag pmod pgen   presets → zones → generators
 *                  inst ibag imod igen   instruments → zones → generators
 *                  shdr                  sample headers
 *
 * A preset zone picks an instrument and adjusts it; an instrument zone picks a sample and
 * says how to play it. Each (preset zone × instrument zone) pair whose key and velocity
 * ranges overlap becomes one SampleRegion.
 *
 * SF3 – see FluidSynth's doc/wiki/SoundFont3Format.md and MuseScore's sftools sfont.cpp
 * (SoundFont::writeSmpl, which writes them): ifil major is 3, and a sample whose
 * sampleType has bit 0x10 is compressed. Its shdr start / end are then BYTE offsets of
 * its own stream within smpl. The wiki calls end "the last byte", but sftools writes
 * start + length and FluidSynth reads up to end − 1, so end is exclusive. Its loop points
 * are already relative to the sample start, in decoded frames. Odd-sized chunks may lack
 * the RIFF pad byte.
 *
 * Modulators are ignored: the player applies the usual velocity curve itself (velTrack).
 */

import { BankFormatError } from './types';
import type { ByteReader, LoopMode, ParsedBank, SampleInfo, SamplePreset, SampleRegion } from './types';

/** One zone's generators: generator number → raw 16-bit amount. */
type Gens = Map<number, number>;

interface Zones {
  global?: Gens;
  local: Gens[];
}

/** A chunk found while walking a RIFF list: where its data starts and how long it is. */
interface Chunk {
  id: string;
  at: number;
  size: number;
  /** A top-level LIST's form type ('INFO', 'sdta', 'pdta'). */
  type?: string;
}

/** A pdta sub-list of fixed-size records; `count` includes the terminal record. */
interface Table {
  at: number;
  count: number;
}

interface SampleHeader {
  name: string;
  start: number;
  end: number;
  loopStart: number;
  loopEnd: number;
  rate: number;
  pitch: number;
  correction: number;
  type: number;
}

// Generator numbers (SF2.04 §8.1.2), only those that shape a region.
const G = {
  startOffset: 0,
  endOffset: 1,
  loopStartOffset: 2,
  loopEndOffset: 3,
  startCoarse: 4,
  filterFc: 8,
  filterQ: 9,
  endCoarse: 12,
  pan: 17,
  delayVolEnv: 33,
  attackVolEnv: 34,
  holdVolEnv: 35,
  decayVolEnv: 36,
  sustainVolEnv: 37,
  releaseVolEnv: 38,
  keyToHold: 39,
  keyToDecay: 40,
  instrument: 41,
  keyRange: 43,
  velRange: 44,
  loopStartCoarse: 45,
  keynum: 46,
  velocity: 47,
  attenuation: 48,
  loopEndCoarse: 50,
  coarseTune: 51,
  fineTune: 52,
  sampleID: 53,
  sampleModes: 54,
  scaleTuning: 56,
  exclusiveClass: 57,
  rootKey: 58,
} as const;

/** Instrument-level defaults that aren't 0 (SF2.04 §8.1.3); −12000 timecents ≈ 1 ms. */
const DEFAULTS: Partial<Record<number, number>> = {
  [G.filterFc]: 13500,
  [G.delayVolEnv]: -12000,
  [G.attackVolEnv]: -12000,
  [G.holdVolEnv]: -12000,
  [G.decayVolEnv]: -12000,
  [G.releaseVolEnv]: -12000,
  [G.keynum]: -1,
  [G.velocity]: -1,
  [G.scaleTuning]: 100,
  [G.rootKey]: -1,
};

/** Generators only meaningful in an instrument zone; a preset zone's are ignored (§8.5). */
const INSTRUMENT_ONLY = new Set<number>([
  G.startOffset, G.endOffset, G.loopStartOffset, G.loopEndOffset, G.startCoarse, G.endCoarse,
  G.loopStartCoarse, G.loopEndCoarse, G.keynum, G.velocity, G.sampleModes, G.exclusiveClass, G.rootKey,
]);

/** sampleModes: 0 no loop, 1 loop, 2 unused (= no loop), 3 loop until release then play out. */
const LOOP_MODES: readonly LoopMode[] = ['none', 'continuous', 'none', 'sustain'];

/**
 * initialAttenuation is in centibels, but the EMU hardware SoundFonts were voiced on
 * applied only 0.4 of it; FluidSynth and most players copy that, and banks are badly
 * balanced without it.
 */
const ATTENUATION_FACTOR = 0.4;

const SAMPLE_ROM = 0x8000;
const SAMPLE_COMPRESSED = 0x10;

/** INFO and pdta are read whole; pdta's u16 indices cap it at a few MB, so more is damage. */
const MAX_LIST = 32 * 1024 * 1024;

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const s16 = (raw: number) => (raw << 16) >> 16;
const fourCC = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

/** Four printable ASCII characters: a chunk id rather than a pad byte. */
function isFourCC(b: Uint8Array, at: number): boolean {
  if (at + 4 > b.length) return false;
  for (let i = at; i < at + 4; i++) if (b[i] < 0x20 || b[i] > 0x7e) return false;
  return true;
}

/** A zero-terminated latin1 string. */
function text(b: Uint8Array, at: number, length: number): string {
  let s = '';
  for (let i = at; i < at + length && i < b.length && b[i] !== 0; i++) s += String.fromCharCode(b[i]);
  return s.trim();
}

const damaged = (why: string) => new BankFormatError(`The SoundFont is damaged: ${why}.`);

/** Does this look like a SoundFont ("RIFF"…"sfbk")? */
export function isSoundFont(head: Uint8Array): boolean {
  return head.length >= 12 && fourCC(head, 0) === 'RIFF' && fourCC(head, 8) === 'sfbk';
}

/**
 * Walk the chunk headers between `start` and `end` of the file, reading only the headers
 * (12 bytes with a LIST form type, 8 without). RIFF pads odd-sized chunks with a byte but
 * SF3 writers leave it out, so after an odd chunk we take whichever position holds an id.
 */
async function walk(reader: ByteReader, start: number, end: number, withType: boolean): Promise<Chunk[]> {
  const headLength = withType ? 12 : 8;
  const out: Chunk[] = [];
  let at = start;
  let odd = false;
  while (at + 8 <= end) {
    let h = await reader.read(at, headLength + (odd ? 1 : 0));
    if (odd && !isFourCC(h, 0)) {
      at++;
      h = h.subarray(1);
    }
    if (h.length < 8 || at + 8 > end) break;
    const size = u32(h, 4);
    out.push({ id: fourCC(h, 0), at: at + 8, size, type: withType && h.length >= 12 ? fourCC(h, 8) : undefined });
    at += 8 + size;
    odd = (size & 1) === 1;
  }
  return out;
}

/** The sub-chunks of a list already in memory (same pad-byte rule as `walk`). */
function subChunks(b: Uint8Array, start: number): Chunk[] {
  const out: Chunk[] = [];
  let at = start;
  let odd = false;
  for (;;) {
    if (odd && !isFourCC(b, at)) at++;
    if (at + 8 > b.length) break;
    const id = fourCC(b, at);
    const size = u32(b, at + 4);
    if (at + 8 + size > b.length) throw damaged(`the “${id}” chunk runs past the end of its list`);
    out.push({ id, at: at + 8, size });
    at += 8 + size;
    odd = (size & 1) === 1;
  }
  return out;
}

/** Read an SF2 / SF3 file into presets and sample locations. Never reads the sample data itself. */
export async function parseSf2(reader: ByteReader): Promise<ParsedBank> {
  const head = await reader.read(0, 12);
  if (head.length < 12 || fourCC(head, 0) !== 'RIFF') throw new BankFormatError("This isn't a SoundFont file.");
  if (fourCC(head, 8) !== 'sfbk') {
    const kind = isFourCC(head, 8) ? `: “${fourCC(head, 8).trim()}”` : '';
    throw new BankFormatError(`This isn't a SoundFont file (it's a different kind of RIFF file${kind}).`);
  }

  // top level: read INFO and pdta whole, but only note where smpl / sm24 are
  const end = Math.min(reader.size, 8 + u32(head, 4));
  let info: Uint8Array | undefined;
  let pdta: Uint8Array | undefined;
  let smpl: Chunk | undefined;
  let sm24: Chunk | undefined;
  for (const c of await walk(reader, 12, end, true)) {
    if (c.id !== 'LIST' || c.size < 4) continue;
    if (c.type === 'sdta') {
      for (const s of await walk(reader, c.at + 4, Math.min(end, c.at + c.size), false)) {
        // a cut-short file keeps the samples that are still whole
        const sub = { ...s, size: Math.max(0, Math.min(s.size, reader.size - s.at)) };
        if (s.id === 'smpl') smpl ??= sub;
        else if (s.id === 'sm24') sm24 ??= sub;
      }
    } else if ((c.type === 'INFO' && !info) || (c.type === 'pdta' && !pdta)) {
      if (c.size > MAX_LIST) throw damaged(`its “${c.type}” list is implausibly large`);
      const bytes = await reader.read(c.at, c.size);
      if (bytes.length < c.size) throw damaged('the file is cut short');
      if (c.type === 'INFO') info = bytes;
      else pdta = bytes;
    }
  }
  if (!pdta) throw damaged('its preset list is missing (perhaps the file is cut short)');
  const hydra = pdta;

  const { major, minor, name, meta } = readInfo(info ?? new Uint8Array(4));

  // pdta: nine lists of fixed-size records, each ending with a terminal record
  const lists = new Map<string, Chunk>();
  for (const c of subChunks(hydra, 4)) if (!lists.has(c.id)) lists.set(c.id, c);
  const table = (id: string, size: number): Table => {
    const c = lists.get(id);
    if (!c) throw damaged(`its “${id}” list is missing`);
    if (c.size < size || c.size % size !== 0) throw damaged(`its “${id}” list has the wrong size`);
    return { at: c.at, count: c.size / size };
  };
  const phdr = table('phdr', 38);
  const pbag = table('pbag', 4);
  const pgen = table('pgen', 4);
  const inst = table('inst', 22);
  const ibag = table('ibag', 4);
  const igen = table('igen', 4);
  const shdr = table('shdr', 46);
  // modulators are ignored, but a wrongly sized list still means damage
  for (const id of ['pmod', 'imod']) if (lists.has(id)) table(id, 10);

  /** Zones [first, last) of a bag list; the first is global when it lacks the `terminal` generator. */
  const zonesOf = (bag: Table, gen: Table, first: number, last: number, terminal: number): Zones => {
    const zones: Zones = { local: [] };
    if (last > bag.count - 1) throw damaged('a zone list runs past its end');
    for (let k = first; k < last; k++) {
      const g0 = u16(hydra, bag.at + k * 4);
      const g1 = u16(hydra, bag.at + k * 4 + 4);
      if (g1 > gen.count) throw damaged('a generator list runs past its end');
      const gens: Gens = new Map();
      for (let j = g0; j < g1; j++) {
        const oper = u16(hydra, gen.at + j * 4);
        gens.set(oper, u16(hydra, gen.at + j * 4 + 2));
        if (oper === terminal) break; // generators after it are ignored (§7.5, §7.9)
      }
      if (gens.has(terminal)) zones.local.push(gens);
      else if (k === first && last - first > 1) zones.global = gens;
      // any other zone without an instrument / sample is meaningless and skipped
    }
    return zones;
  };

  // samples
  const headers: SampleHeader[] = [];
  for (let i = 0; i < shdr.count - 1; i++) {
    const at = shdr.at + i * 46;
    headers.push({
      name: text(hydra, at, 20),
      start: u32(hydra, at + 20),
      end: u32(hydra, at + 24),
      loopStart: u32(hydra, at + 28),
      loopEnd: u32(hydra, at + 32),
      rate: u32(hydra, at + 36),
      pitch: hydra[at + 40],
      correction: (hydra[at + 41] << 24) >> 24,
      type: u16(hydra, at + 44),
    });
  }
  const compressed = headers.some(h => (h.type & (SAMPLE_COMPRESSED | SAMPLE_ROM)) === SAMPLE_COMPRESSED);
  if (!smpl && headers.some(h => !(h.type & SAMPLE_ROM))) throw damaged('its sample data is missing');
  const use24 = major > 2 || (major === 2 && minor >= 4); // sm24 arrived in 2.04
  const samples = headers.map(h => sampleInfo(h, smpl!, use24 ? sm24 : undefined));

  // presets × instruments → regions
  const instruments = new Map<number, Zones>();
  const notes = new Set<'rom' | 'missing' | 'fixed'>();
  const bad = new Set<number>();
  const presets: SamplePreset[] = [];
  for (let p = 0; p < phdr.count - 1; p++) {
    const at = phdr.at + p * 38;
    const pz = zonesOf(pbag, pgen, u16(hydra, at + 24), u16(hydra, at + 38 + 24), G.instrument);
    const regions: SampleRegion[] = [];
    for (const pl of pz.local) {
      const i = pl.get(G.instrument)!;
      if (i >= inst.count - 1) {
        notes.add('missing');
        continue;
      }
      let iz = instruments.get(i);
      if (!iz) {
        const ia = inst.at + i * 22;
        iz = zonesOf(ibag, igen, u16(hydra, ia + 20), u16(hydra, ia + 22 + 20), G.sampleID);
        instruments.set(i, iz);
      }
      for (const il of iz.local) {
        const si = il.get(G.sampleID)!;
        const s = samples[si];
        if (s === undefined) notes.add('missing');
        else if (s === 'rom') notes.add('rom');
        else if (s === 'bad') bad.add(si);
        else {
          const r = toRegion(si, s, pl, pz.global, il, iz.global);
          if (!r) continue;
          if (r.fixed) notes.add('fixed');
          regions.push(r.region);
        }
      }
    }
    presets.push({ name: text(hydra, at, 20), bank: u16(hydra, at + 22), program: u16(hydra, at + 20), regions });
  }
  presets.sort((a, b) => a.bank - b.bank || a.program - b.program);

  // list only the samples some region plays (in file order), so unused ones cost nothing
  const used = [...new Set(presets.flatMap(p => p.regions.map(r => r.sample)))].sort((a, b) => a - b);
  const index = new Map(used.map((s, i) => [s, i]));
  for (const p of presets) for (const r of p.regions) r.sample = index.get(r.sample)!;

  const warnings: string[] = [];
  if (phdr.count < 2) warnings.push('The SoundFont has no presets.');
  if (notes.has('rom')) warnings.push("Some instruments use samples from a sound card's memory (ROM), which aren't in the file; those parts are skipped.");
  if (bad.size) {
    warnings.push(`${bad.size === 1 ? '1 sample points' : `${bad.size} samples point`} outside the sample data; the parts using them are skipped.`);
  }
  if (notes.has('missing')) warnings.push("Some zones refer to instruments or samples that don't exist; they're skipped.");
  if (notes.has('fixed')) warnings.push('Some zones force a fixed key or velocity (keynum / velocity generators); that is ignored.');

  return {
    format: major === 3 || compressed ? 'sf3' : 'sf2',
    name: name || 'SoundFont',
    info: meta,
    presets,
    samples: used.map(i => samples[i] as SampleInfo),
    warnings,
  };
}

/** The INFO list (bytes from its form type on): version, name and credits. */
function readInfo(b: Uint8Array): { major: number; minor: number; name: string; meta: ParsedBank['info'] } {
  let major = 2; // ifil is mandatory, but assume 2.01 without it
  let minor = 1;
  let name = '';
  const meta: ParsedBank['info'] = {};
  const fields: Partial<Record<string, keyof ParsedBank['info']>> = { ICOP: 'copyright', ICMT: 'comment', IENG: 'author', IPRD: 'product' };
  for (const c of subChunks(b, 4)) {
    const field = fields[c.id];
    if (c.id === 'ifil' && c.size >= 4) {
      major = u16(b, c.at);
      minor = u16(b, c.at + 2);
    } else if (c.id === 'INAM') {
      name = text(b, c.at, c.size);
    } else if (field && text(b, c.at, c.size)) {
      meta[field] = text(b, c.at, c.size);
    }
  }
  return { major, minor, name, meta };
}

/** Where a sample's audio is, or why it can't be played. */
function sampleInfo(h: SampleHeader, smpl: Chunk, sm24: Chunk | undefined): SampleInfo | 'rom' | 'bad' {
  if (h.type & SAMPLE_ROM) return 'rom';
  const info: SampleInfo = {
    name: h.name,
    sampleRate: h.rate,
    frames: 0,
    pitchCorrection: h.correction,
    source: { kind: 'pcm16', byteOffset: 0, frames: 0 },
  };
  if (h.pitch <= 127) info.originalPitch = h.pitch; // 255 = unpitched
  let loopStart: number;
  let loopEnd: number;
  if (h.type & SAMPLE_COMPRESSED) {
    // SF3: start / end are byte offsets within smpl, loops already relative (see top)
    if (h.end <= h.start || h.end > smpl.size) return 'bad';
    info.source = { kind: 'encoded', byteOffset: smpl.at + h.start, byteLength: h.end - h.start, format: 'ogg' };
    loopStart = h.loopStart;
    loopEnd = h.loopEnd;
  } else {
    // SF2: all four are frame indices into smpl, end exclusive
    if (h.end <= h.start || h.end * 2 > smpl.size) return 'bad';
    info.frames = h.end - h.start;
    info.source = { kind: 'pcm16', byteOffset: smpl.at + h.start * 2, frames: info.frames };
    if (sm24 && h.end <= sm24.size) info.source.sm24Offset = sm24.at + h.start;
    loopStart = h.loopStart - h.start;
    loopEnd = Math.min(h.loopEnd - h.start, info.frames);
  }
  // unlooped samples often carry 0 / 0 or junk here
  if (loopStart >= 0 && loopEnd > loopStart) {
    info.loopStart = loopStart;
    info.loopEnd = loopEnd;
  }
  return info;
}

/**
 * One region from a preset zone (`pz`, with its preset's global zone `pg`) and an
 * instrument zone (`iz`, with `ig`). Instrument values are absolute (local over global
 * over the spec default); preset values are offsets added to them, except key / velocity
 * ranges, which intersect, and the instrument-only generators. Undefined when the ranges
 * don't overlap. `fixed` = the zone uses keynum / velocity, which we don't honour.
 */
function toRegion(
  sample: number,
  s: SampleInfo,
  pz: Gens,
  pg: Gens | undefined,
  iz: Gens,
  ig: Gens | undefined,
): { region: SampleRegion; fixed: boolean } | undefined {
  const range = (g: number) => {
    const a = iz.get(g) ?? ig?.get(g) ?? 0x7f00; // lo byte, hi byte
    const b = pz.get(g) ?? pg?.get(g) ?? 0x7f00;
    return [Math.max(a & 0xff, b & 0xff), Math.min(a >> 8, b >> 8, 127)];
  };
  const [loKey, hiKey] = range(G.keyRange);
  const [loVel, hiVel] = range(G.velRange);
  if (loKey > hiKey || loVel > hiVel) return undefined;

  const inst = (g: number) => {
    const raw = iz.get(g) ?? ig?.get(g);
    return raw === undefined ? (DEFAULTS[g] ?? 0) : s16(raw);
  };
  const preset = (g: number) => {
    const raw = pz.get(g) ?? pg?.get(g);
    return raw === undefined || INSTRUMENT_ONLY.has(g) ? 0 : s16(raw);
  };
  const val = (g: number) => inst(g) + preset(g);

  // rootKey: overridingRootKey, else the sample's own pitch, else middle C
  const override = val(G.rootKey);
  const rootKey = override >= 0 && override <= 127 ? override : (s.originalPitch ?? 60);

  // address offsets are in frames; the coarse ones count in 32768s
  const offset = Math.max(0, val(G.startOffset) + 32768 * val(G.startCoarse));
  const endShift = val(G.endOffset) + 32768 * val(G.endCoarse);
  let loop = LOOP_MODES[val(G.sampleModes) & 3];
  let loopStart: number | undefined;
  let loopEnd: number | undefined;
  if (s.loopStart !== undefined && s.loopEnd !== undefined) {
    loopStart = s.loopStart + val(G.loopStartOffset) + 32768 * val(G.loopStartCoarse);
    loopEnd = s.loopEnd + val(G.loopEndOffset) + 32768 * val(G.loopEndCoarse);
    if (loopStart < 0 || loopEnd <= loopStart) loopStart = loopEnd = undefined;
  }
  if (loopStart === undefined) loop = 'none';

  // envelope times are timecents (seconds = 2^(tc / 1200)), clamped to the spec's ranges;
  // the −12000 default means "instant" for delay and hold
  const time = (g: number, max: number) => clamp(val(g), -12000, max);
  const seconds = (tc: number) => Math.pow(2, tc / 1200);
  const delay = time(G.delayVolEnv, 5000);
  const attack = time(G.attackVolEnv, 8000);
  const hold = time(G.holdVolEnv, 5000);
  // sustainVolEnv is attenuation in centibels: level = 10^(−cB / 200)
  const sustain = clamp(Math.pow(10, -clamp(val(G.sustainVolEnv), 0, 1440) / 200), 0, 1);
  const attenuation = clamp(val(G.attenuation), 0, 1440);

  const region: SampleRegion = {
    sample,
    loKey,
    hiKey,
    loVel,
    hiVel,
    rootKey,
    // pitchCorrection is the sample's own; coarse / fine are the zones'
    tune: val(G.coarseTune) * 100 + val(G.fineTune) + (s.pitchCorrection ?? 0),
    keyTrack: val(G.scaleTuning),
    offset,
    loop,
    volume: attenuation > 0 ? (-attenuation / 10) * ATTENUATION_FACTOR : 0,
    // pan is in 0.1 % steps, −500 (left) .. 500 (right)
    pan: clamp(val(G.pan) / 500, -1, 1),
    velTrack: 1,
    amp: {
      delay: delay <= -12000 ? 0 : seconds(delay),
      attack: attack <= -12000 ? 0.001 : seconds(attack),
      hold: hold <= -12000 ? 0 : seconds(hold),
      decay: seconds(time(G.decayVolEnv, 8000)),
      sustain,
      release: seconds(time(G.releaseVolEnv, 8000)),
    },
    trigger: 'attack',
  };
  // an end shift is relative to the sample's end, unknown for SF3 streams until decoded
  if (endShift !== 0 && s.source.kind === 'pcm16') region.end = clamp(s.frames + endShift, 0, s.frames);
  if (loopStart !== undefined) {
    region.loopStart = loopStart;
    region.loopEnd = loopEnd;
  }
  const holdKeyTrack = val(G.keyToHold);
  const decayKeyTrack = val(G.keyToDecay);
  if (holdKeyTrack) region.amp.holdKeyTrack = holdKeyTrack;
  if (decayKeyTrack) region.amp.decayKeyTrack = decayKeyTrack;
  // initialFilterFc is absolute cents above 8.176 Hz (MIDI key 0); 13500 (≈ 20 kHz) = off
  const fc = clamp(val(G.filterFc), 1500, 13500);
  if (fc < 13500) region.filter = { cutoff: 8.176 * Math.pow(2, fc / 1200), q: clamp(val(G.filterQ), 0, 960) / 10 };
  // an exclusive class cuts off its own earlier notes (open / closed hi-hat)
  const exclusive = val(G.exclusiveClass);
  if (exclusive > 0) region.chokeGroup = region.offBy = exclusive;
  return { region, fixed: val(G.keynum) >= 0 || val(G.velocity) >= 0 };
}

/** Convert 16-bit little-endian PCM (plus optional SF2 sm24 low bytes) to floats in −1..1. */
export function pcm16ToFloat(bytes: Uint8Array, sm24?: Uint8Array): Float32Array<ArrayBuffer> {
  const n = bytes.length >> 1;
  const out = new Float32Array(n);
  if (sm24) {
    for (let i = 0; i < n; i++) {
      // sign-extend the 16 high bits into place, then add the low byte: a 24-bit sample
      const hi = ((bytes[2 * i] | (bytes[2 * i + 1] << 8)) << 16) >> 8;
      out[i] = (hi | (i < sm24.length ? sm24[i] : 0)) / 8388608;
    }
  } else {
    for (let i = 0; i < n; i++) out[i] = s16(bytes[2 * i] | (bytes[2 * i + 1] << 8)) / 32768;
  }
  return out;
}
