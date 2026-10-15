import { describe, expect, it } from 'vitest';
import { isSoundFont, parseSf2, pcm16ToFloat } from './sf2';
import { BankFormatError, memoryReader } from './types';
import type { ByteReader, ParsedBank, SampleRegion } from './types';

// ---------------------------------------------------------------------------
// Tiny SoundFont writer
// ---------------------------------------------------------------------------

type Gen = [oper: number, amount: number];

// generator numbers (SF2.04 §8.1.2)
const GEN = {
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
  loopStartCoarse: 45,
  keynum: 46,
  attenuation: 48,
  loopEndCoarse: 50,
  coarseTune: 51,
  fineTune: 52,
  sampleModes: 54,
  scaleTuning: 56,
  exclusiveClass: 57,
  rootKey: 58,
};

/** A generator with a signed amount. */
const gen = (oper: number, value: number): Gen => [oper, value & 0xffff];
const keys = (lo: number, hi: number): Gen => [43, lo | (hi << 8)];
const vels = (lo: number, hi: number): Gen => [44, lo | (hi << 8)];
const instrument = (i: number): Gen => [41, i];
const sampleId = (i: number): Gen => [53, i];

interface TSample {
  name: string;
  /** 16-bit PCM frames (SF2)… */
  pcm?: number[];
  /** …or a compressed stream (SF3: sampleType bit 0x10); neither = a ROM sample. */
  stream?: Uint8Array;
  rate?: number;
  pitch?: number;
  correction?: number;
  /** Loop points relative to the sample start. */
  loop?: [number, number];
  /** sampleType: 1 mono, 2 right, 4 left (ROM / compressed bits are added automatically). */
  type?: number;
}

interface TBank {
  version?: [number, number];
  /** INFO sub-chunks besides ifil, e.g. { INAM: 'Bank' }. */
  info?: Record<string, string>;
  samples: TSample[];
  instruments: { name: string; zones: Gen[][] }[];
  presets: { name: string; bank?: number; program: number; zones: Gen[][] }[];
  /** Write an sm24 chunk (one low byte per smpl frame). */
  sm24?: boolean;
  /** Leave out the pad byte after odd-sized chunks, as SF3 writers do. */
  noPad?: boolean;
  /** Junk bytes after the sample headers (a damaged file). */
  shdrExtra?: number;
}

const ascii = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function chunk(id: string, data: Uint8Array, pad = true): Uint8Array {
  const out = new Uint8Array(8 + data.length + (pad ? data.length & 1 : 0));
  out.set(ascii(id));
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

const list = (type: string, parts: Uint8Array[], pad = true) => chunk('LIST', concat([ascii(type), ...parts]), pad);

/** Fixed-size records, each filled in by `write(view, offset, index)`. */
function records(size: number, count: number, write: (v: DataView, at: number, i: number) => void): Uint8Array {
  const out = new Uint8Array(size * count);
  const v = new DataView(out.buffer);
  for (let i = 0; i < count; i++) write(v, i * size, i);
  return out;
}

const name20 = (v: DataView, at: number, s: string) => ascii(s.slice(0, 19)).forEach((c, i) => v.setUint8(at + i, c));

/** Zero-terminated, padded to an even length as the spec asks. */
const zstr = (s: string) => {
  const b = new Uint8Array((s.length + 2) & ~1);
  b.set(ascii(s));
  return b;
};

/** The bag / generator lists for a set of zones (with terminal records). */
function zoneLists(owners: { zones: Gen[][] }[]): { bags: Uint8Array; gens: Uint8Array; firstBag: number[] } {
  const zones = owners.flatMap(o => o.zones);
  const firstBag: number[] = [];
  let b = 0;
  for (const o of owners) {
    firstBag.push(b);
    b += o.zones.length;
  }
  firstBag.push(b);
  const genStart: number[] = [];
  let g = 0;
  for (const z of zones) {
    genStart.push(g);
    g += z.length;
  }
  genStart.push(g);
  const flat = zones.flat();
  return {
    bags: records(4, zones.length + 1, (v, at, i) => v.setUint16(at, genStart[i], true)),
    gens: records(4, flat.length + 1, (v, at, i) => {
      if (i === flat.length) return;
      v.setUint16(at, flat[i][0], true);
      v.setUint16(at + 2, flat[i][1], true);
    }),
    firstBag,
  };
}

/** Write a SoundFont: PCM samples first (each followed by 46 silent frames), then streams. */
function sf2(bank: TBank): Uint8Array {
  const pad = !bank.noPad;
  let frames = 0;
  const pcmStart = bank.samples.map(s => {
    const start = frames;
    if (s.pcm) frames += s.pcm.length + 46;
    return start;
  });
  let bytes = frames * 2;
  const streamStart = bank.samples.map(s => {
    const start = bytes;
    if (s.stream) bytes += s.stream.length;
    return start;
  });
  const smpl = new Uint8Array(bytes);
  const sv = new DataView(smpl.buffer);
  bank.samples.forEach((s, i) => {
    s.pcm?.forEach((x, j) => sv.setInt16((pcmStart[i] + j) * 2, x, true));
    if (s.stream) smpl.set(s.stream, streamStart[i]);
  });

  const shdr = records(46, bank.samples.length + 1, (v, at, i) => {
    const s = bank.samples[i];
    if (!s) return name20(v, at, 'EOS');
    name20(v, at, s.name);
    // PCM: frame indices into smpl; streams: byte offsets with loops relative; ROM: anything
    const [start, end, base] = s.pcm
      ? [pcmStart[i], pcmStart[i] + s.pcm.length, pcmStart[i]]
      : s.stream
        ? [streamStart[i], streamStart[i] + s.stream.length, 0]
        : [0, 1000, 0];
    v.setUint32(at + 20, start, true);
    v.setUint32(at + 24, end, true);
    v.setUint32(at + 28, base + (s.loop?.[0] ?? 0), true);
    v.setUint32(at + 32, base + (s.loop?.[1] ?? 0), true);
    v.setUint32(at + 36, s.rate ?? 44100, true);
    v.setUint8(at + 40, s.pitch ?? 60);
    v.setInt8(at + 41, s.correction ?? 0);
    v.setUint16(at + 44, (s.type ?? 1) | (s.stream ? 0x10 : 0) | (!s.pcm && !s.stream ? 0x8000 : 0), true);
  });

  const p = zoneLists(bank.presets);
  const phdr = records(38, bank.presets.length + 1, (v, at, i) => {
    const pr = bank.presets[i];
    name20(v, at, pr ? pr.name : 'EOP');
    v.setUint16(at + 20, pr?.program ?? 0, true);
    v.setUint16(at + 22, pr?.bank ?? 0, true);
    v.setUint16(at + 24, p.firstBag[i], true);
  });
  const n = zoneLists(bank.instruments);
  const inst = records(22, bank.instruments.length + 1, (v, at, i) => {
    name20(v, at, bank.instruments[i]?.name ?? 'EOI');
    v.setUint16(at + 20, n.firstBag[i], true);
  });
  const mod = new Uint8Array(10); // just the terminal record

  const [major, minor] = bank.version ?? [2, 1];
  const ifil = records(4, 1, v => {
    v.setUint16(0, major, true);
    v.setUint16(2, minor, true);
  });
  const info = list('INFO', [
    chunk('ifil', ifil),
    ...Object.entries(bank.info ?? {}).map(([id, s]) => chunk(id, zstr(s))),
  ]);
  const sdta = list(
    'sdta',
    [chunk('smpl', smpl, pad), ...(bank.sm24 ? [chunk('sm24', records(1, frames, (v, at) => v.setUint8(at, 0x80)), pad)] : [])],
    pad,
  );
  const pdta = list('pdta', [
    chunk('phdr', phdr),
    chunk('pbag', p.bags),
    chunk('pmod', mod),
    chunk('pgen', p.gens),
    chunk('inst', inst),
    chunk('ibag', n.bags),
    chunk('imod', mod),
    chunk('igen', n.gens),
    chunk('shdr', concat([shdr, new Uint8Array(bank.shdrExtra ?? 0)])),
  ]);
  const body = concat([ascii('sfbk'), info, sdta, pdta]);
  return concat([ascii('RIFF'), records(4, 1, v => v.setUint32(0, body.length, true)), body]);
}

/** Where a chunk's data starts and its size. */
function findChunk(bytes: Uint8Array, id: string): { at: number; size: number } {
  for (let i = 0; i + 8 <= bytes.length; i++) {
    if (String.fromCharCode(...bytes.subarray(i, i + 4)) === id) {
      return { at: i + 8, size: new DataView(bytes.buffer, bytes.byteOffset).getUint32(i + 4, true) };
    }
  }
  throw new Error(`no ${id}`);
}

const parse = (bank: TBank) => parseSf2(memoryReader(sf2(bank)));
const ramp = (n: number) => Array.from({ length: n }, (_, i) => i * 100 - 5000);

/** One preset → one instrument → one zone over one sample. */
const single = (instZone: Gen[], presetZone: Gen[] = [], sample: Partial<TSample> = {}): TBank => ({
  samples: [{ name: 'S', pcm: ramp(100), ...sample }],
  instruments: [{ name: 'I', zones: [[...instZone, sampleId(0)]] }],
  presets: [{ name: 'P', program: 0, zones: [[...presetZone, instrument(0)]] }],
});

async function region(instZone: Gen[], presetZone: Gen[] = [], sample: Partial<TSample> = {}): Promise<SampleRegion> {
  const bank = await parse(single(instZone, presetZone, sample));
  expect(bank.presets[0].regions).toHaveLength(1);
  return bank.presets[0].regions[0];
}

// ---------------------------------------------------------------------------

describe('isSoundFont', () => {
  it('recognises the RIFF sfbk header only', () => {
    expect(isSoundFont(sf2(single([])))).toBe(true);
    expect(isSoundFont(concat([ascii('RIFF'), new Uint8Array(4), ascii('WAVE')]))).toBe(false);
    expect(isSoundFont(ascii('RIFF'))).toBe(false);
    expect(isSoundFont(new Uint8Array(0))).toBe(false);
  });
});

describe('pcm16ToFloat', () => {
  it('converts little-endian 16-bit PCM to −1..1', () => {
    const bytes = new Uint8Array([0, 0, 0xff, 0x7f, 0x00, 0x80, 0xff, 0xff, 0x12]); // odd byte is ignored
    const out = pcm16ToFloat(bytes);
    expect(out).toBeInstanceOf(Float32Array);
    expect([...out]).toEqual([0, 32767 / 32768, -1, -1 / 32768].map(Math.fround));
  });

  it('adds the sm24 low bytes for 24-bit samples', () => {
    const bytes = new Uint8Array([0x01, 0x00, 0xff, 0xff, 0x00, 0x80, 0x00, 0x40]);
    const out = pcm16ToFloat(bytes, new Uint8Array([0x80, 0xff, 0x00]));
    expect([...out]).toEqual([0x180 / 8388608, -1 / 8388608, -1, 0.5].map(Math.fround));
  });

  it('works on a view into a larger buffer', () => {
    const buf = new Uint8Array([9, 0x00, 0x40, 9]);
    expect([...pcm16ToFloat(buf.subarray(1, 3))]).toEqual([0.5]);
  });
});

describe('parseSf2: file and samples', () => {
  it('reads the name, credits and a plain preset', async () => {
    const bank = await parse({
      ...single([]),
      info: { INAM: 'Test Bank ', ICOP: '© Someone', ICMT: 'A comment', IENG: 'Engineer', IPRD: 'Product' },
    });
    expect(bank.format).toBe('sf2');
    expect(bank.name).toBe('Test Bank');
    expect(bank.info).toEqual({ copyright: '© Someone', comment: 'A comment', author: 'Engineer', product: 'Product' });
    expect(bank.warnings).toEqual([]);
    expect(bank.presets).toHaveLength(1);
    expect(bank.presets[0]).toMatchObject({ name: 'P', bank: 0, program: 0 });
    expect(bank.presets[0].regions[0]).toEqual({
      sample: 0,
      loKey: 0,
      hiKey: 127,
      loVel: 0,
      hiVel: 127,
      rootKey: 60,
      tune: 0,
      keyTrack: 100,
      offset: 0,
      loop: 'none',
      volume: 0,
      pan: 0,
      velTrack: 1,
      amp: { delay: 0, attack: 0.001, hold: 0, decay: 2 ** -10, sustain: 1, release: 2 ** -10 },
      trigger: 'attack',
    });
  });

  it("falls back to 'SoundFont' without a name", async () => {
    const bank = await parse(single([]));
    expect(bank.name).toBe('SoundFont');
    expect(bank.info).toEqual({});
  });

  it('describes samples and where their PCM lies', async () => {
    const bytes = sf2({
      samples: [
        { name: 'First', pcm: ramp(10) },
        { name: 'Second', pcm: ramp(200), rate: 22050, pitch: 69, correction: -7, loop: [50, 150] },
      ],
      instruments: [{ name: 'I', zones: [[sampleId(0)], [sampleId(1)]] }],
      presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
    });
    const smpl = findChunk(bytes, 'smpl');
    const bank = await parseSf2(memoryReader(bytes));
    expect(bank.samples).toEqual([
      {
        name: 'First',
        sampleRate: 44100,
        frames: 10,
        originalPitch: 60,
        pitchCorrection: 0,
        source: { kind: 'pcm16', byteOffset: smpl.at, frames: 10 },
      },
      {
        name: 'Second',
        sampleRate: 22050,
        frames: 200,
        originalPitch: 69,
        pitchCorrection: -7,
        loopStart: 50,
        loopEnd: 150,
        source: { kind: 'pcm16', byteOffset: smpl.at + (10 + 46) * 2, frames: 200 },
      },
    ]);
    // the source really points at the second sample's frames
    const second = bank.samples[1].source;
    if (second.kind !== 'pcm16') throw new Error('expected PCM');
    const pcm = pcm16ToFloat(bytes.subarray(second.byteOffset, second.byteOffset + second.frames * 2));
    expect(pcm[3]).toBeCloseTo((3 * 100 - 5000) / 32768, 6);
    expect(bank.presets[0].regions.map(r => [r.sample, r.rootKey, r.tune])).toEqual([[0, 60, 0], [1, 69, -7]]);
  });

  it('lists only the samples that are played, in file order', async () => {
    const bank = await parse({
      samples: [{ name: 'A', pcm: ramp(10) }, { name: 'Unused', pcm: ramp(10) }, { name: 'C', pcm: ramp(10) }],
      instruments: [{ name: 'I', zones: [[keys(60, 127), sampleId(2)], [keys(0, 59), sampleId(0)]] }],
      presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
    });
    expect(bank.samples.map(s => s.name)).toEqual(['A', 'C']);
    expect(bank.presets[0].regions.map(r => bank.samples[r.sample].name)).toEqual(['C', 'A']);
  });

  it('points at sm24 low bytes from version 2.04 on', async () => {
    const make = (version: [number, number]) => sf2({ ...single([]), version, sm24: true });
    const bytes = make([2, 4]);
    const sm24 = findChunk(bytes, 'sm24');
    const bank = await parseSf2(memoryReader(bytes));
    expect(bank.samples[0].source).toMatchObject({ kind: 'pcm16', sm24Offset: sm24.at });
    const old = await parseSf2(memoryReader(make([2, 1])));
    expect(old.samples[0].source).not.toHaveProperty('sm24Offset');
  });

  it('sorts presets by bank, then program', async () => {
    const bank = await parse({
      samples: [{ name: 'S', pcm: ramp(10) }],
      instruments: [{ name: 'I', zones: [[sampleId(0)]] }],
      presets: [
        { name: 'Drums', bank: 128, program: 0, zones: [[instrument(0)]] },
        { name: 'Strings', program: 48, zones: [[instrument(0)]] },
        { name: 'Piano', program: 0, zones: [[instrument(0)]] },
        { name: 'Bright', bank: 8, program: 0, zones: [[instrument(0)]] },
      ],
    });
    expect(bank.presets.map(p => [p.name, p.bank, p.program])).toEqual([
      ['Piano', 0, 0],
      ['Strings', 0, 48],
      ['Bright', 8, 0],
      ['Drums', 128, 0],
    ]);
  });

  it('reads only the headers, INFO and pdta, never the sample data', async () => {
    const bytes = sf2({
      ...single([]),
      samples: [{ name: 'Big', pcm: ramp(20000) }],
      version: [2, 4],
      sm24: true,
    });
    const smpl = findChunk(bytes, 'smpl');
    const sm24 = findChunk(bytes, 'sm24');
    const base = memoryReader(bytes);
    const reads: [number, number][] = [];
    const reader: ByteReader = {
      size: base.size,
      read: (offset, length) => {
        reads.push([offset, length]);
        return base.read(offset, length);
      },
    };
    const bank = await parseSf2(reader);
    expect(bank.presets[0].regions).toHaveLength(1);
    for (const data of [smpl, sm24]) {
      for (const [offset, length] of reads) expect(offset + length <= data.at || offset >= data.at + data.size).toBe(true);
    }
    expect(reads.reduce((n, [, length]) => n + length, 0)).toBeLessThan(2000);
  });
});

describe('parseSf2: zones and generators', () => {
  it('splits an instrument across the keyboard', async () => {
    const bank = await parse({
      samples: [{ name: 'Low', pcm: ramp(10), pitch: 48 }, { name: 'High', pcm: ramp(10), pitch: 72 }],
      instruments: [{ name: 'Split', zones: [[keys(0, 59), sampleId(0)], [keys(60, 127), sampleId(1)]] }],
      presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
    });
    expect(bank.presets[0].regions.map(r => [r.sample, r.loKey, r.hiKey, r.rootKey])).toEqual([
      [0, 0, 59, 48],
      [1, 60, 127, 72],
    ]);
  });

  it('applies global zones, overrides them locally and adds preset values', async () => {
    const bank = await parse({
      samples: [{ name: 'S', pcm: ramp(10), correction: 5 }],
      instruments: [
        {
          name: 'I',
          zones: [
            [gen(GEN.coarseTune, 2), gen(GEN.attenuation, 100), gen(GEN.pan, -250)], // global
            [keys(40, 80), gen(GEN.attenuation, 50), sampleId(0)],
            [keys(81, 127), sampleId(0)],
          ],
        },
      ],
      presets: [
        {
          name: 'P',
          program: 0,
          zones: [
            [keys(50, 90), gen(GEN.coarseTune, 1), gen(GEN.attenuation, 20)], // global
            [gen(GEN.fineTune, 10), gen(GEN.attenuation, 10), instrument(0)],
          ],
        },
      ],
    });
    const [a, b] = bank.presets[0].regions;
    // keys intersect; coarse 2 + 1 semitones, fine 10, the sample's own +5
    expect([a.loKey, a.hiKey, a.tune]).toEqual([50, 80, 315]);
    expect([b.loKey, b.hiKey, b.tune]).toEqual([81, 90, 315]);
    // instrument local 50 cB (over global 100) + preset local 10 (over global 20) → 60 cB × 0.4
    expect(a.volume).toBeCloseTo(-2.4);
    expect(b.volume).toBeCloseTo(-4.4);
    expect(a.pan).toBeCloseTo(-0.5);
  });

  it('ignores instrument-only generators at preset level', async () => {
    const r = await region([], [
      gen(GEN.sampleModes, 1),
      gen(GEN.rootKey, 30),
      gen(GEN.exclusiveClass, 4),
      gen(GEN.startOffset, 8),
      gen(GEN.endOffset, -8),
    ], { loop: [10, 90] });
    expect(r.loop).toBe('none');
    expect(r.rootKey).toBe(60);
    expect(r.chokeGroup).toBeUndefined();
    expect(r.offset).toBe(0);
    expect(r.end).toBeUndefined();
  });

  it('skips zones whose key or velocity ranges do not meet', async () => {
    const bank = await parse({
      samples: [{ name: 'S', pcm: ramp(10) }],
      instruments: [
        {
          name: 'I',
          zones: [
            [keys(0, 59), sampleId(0)],
            [keys(60, 127), sampleId(0)],
            [keys(0, 40), vels(100, 127), sampleId(0)],
          ],
        },
      ],
      presets: [{ name: 'P', program: 0, zones: [[keys(0, 40), vels(0, 80), instrument(0)]] }],
    });
    expect(bank.presets[0].regions.map(r => [r.loKey, r.hiKey, r.loVel, r.hiVel])).toEqual([[0, 40, 0, 80]]);
  });

  it('treats a lone zone without an instrument as no zone, not a global one', async () => {
    const bank = await parse({
      samples: [{ name: 'S', pcm: ramp(10) }],
      instruments: [{ name: 'I', zones: [[sampleId(0)]] }],
      presets: [
        { name: 'Empty', program: 1, zones: [[gen(GEN.coarseTune, 12)]] },
        { name: 'Full', program: 2, zones: [[gen(GEN.coarseTune, 12)], [instrument(0)], [gen(GEN.fineTune, 3)]] },
      ],
    });
    expect(bank.presets[0].regions).toEqual([]);
    expect(bank.presets[1].regions.map(r => r.tune)).toEqual([1200]);
  });

  it('pans the two halves of a stereo pair', async () => {
    const bank = await parse({
      samples: [
        { name: 'Piano L', pcm: ramp(10), type: 4 },
        { name: 'Piano R', pcm: ramp(10), type: 2 },
      ],
      instruments: [{ name: 'I', zones: [[gen(GEN.pan, -500), sampleId(0)], [gen(GEN.pan, 500), sampleId(1)]] }],
      presets: [{ name: 'P', program: 0, zones: [[gen(GEN.pan, 100), instrument(0)]] }],
    });
    expect(bank.presets[0].regions.map(r => [r.sample, r.pan])).toEqual([[0, -0.8], [1, 1]]);
  });

  it('maps loop modes and keeps loop points relative to the sample start', async () => {
    const bank = await parse({
      samples: [
        { name: 'Pad', pcm: ramp(30) },
        { name: 'Loop', pcm: ramp(1000), loop: [100, 900] },
      ],
      instruments: [
        {
          name: 'I',
          zones: [0, 1, 2, 3].map(mode => [keys(mode * 10, mode * 10 + 9), gen(GEN.sampleModes, mode), sampleId(1)]),
        },
      ],
      presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
    });
    expect(bank.samples[0]).toMatchObject({ name: 'Loop', loopStart: 100, loopEnd: 900 });
    expect(bank.presets[0].regions.map(r => [r.loop, r.loopStart, r.loopEnd])).toEqual([
      ['none', 100, 900],
      ['continuous', 100, 900],
      ['none', 100, 900],
      ['sustain', 100, 900],
    ]);
  });

  it('shifts loop points by the loop offset generators', async () => {
    const r = await region(
      [gen(GEN.sampleModes, 1), gen(GEN.loopStartOffset, 2), gen(GEN.loopEndOffset, -3), gen(GEN.loopEndCoarse, 1)],
      [],
      { loop: [10, 90] },
    );
    expect([r.loop, r.loopStart, r.loopEnd]).toEqual(['continuous', 12, 87 + 32768]);
  });

  it("doesn't loop a sample without loop points", async () => {
    const r = await region([gen(GEN.sampleModes, 1)]);
    expect(r.loop).toBe('none');
    expect(r.loopStart).toBeUndefined();
  });

  it('converts attenuation and the volume envelope', async () => {
    const r = await region(
      [
        gen(GEN.attenuation, 200),
        gen(GEN.attackVolEnv, 0),
        gen(GEN.holdVolEnv, 1200),
        gen(GEN.decayVolEnv, 2400),
        gen(GEN.sustainVolEnv, 200),
        gen(GEN.releaseVolEnv, -1200),
        gen(GEN.keyToHold, 10),
        gen(GEN.keyToDecay, -5),
      ],
      // preset values add: delay −12000 (default) + 10800 = −1200 tc, attack 0 + 1200 tc
      [gen(GEN.delayVolEnv, 10800), gen(GEN.attackVolEnv, 1200)],
    );
    expect(r.volume).toBeCloseTo(-8); // 20 dB × 0.4
    expect(r.amp.delay).toBeCloseTo(0.5);
    expect(r.amp.attack).toBeCloseTo(2);
    expect(r.amp.hold).toBeCloseTo(2);
    expect(r.amp.decay).toBeCloseTo(4);
    expect(r.amp.sustain).toBeCloseTo(0.1);
    expect(r.amp.release).toBeCloseTo(0.5);
    expect(r.amp.holdKeyTrack).toBe(10);
    expect(r.amp.decayKeyTrack).toBe(-5);
  });

  it('treats the shortest times as instant and clamps sustain', async () => {
    const r = await region([gen(GEN.delayVolEnv, -32768), gen(GEN.attackVolEnv, -20000), gen(GEN.sustainVolEnv, 2000)]);
    expect(r.amp).toMatchObject({ delay: 0, attack: 0.001, hold: 0 });
    expect(r.amp.sustain).toBeCloseTo(10 ** -7.2);
    expect(r.amp).not.toHaveProperty('holdKeyTrack');
  });

  it('converts the low-pass filter', async () => {
    const r = await region([gen(GEN.filterFc, 6000), gen(GEN.filterQ, 60)]);
    expect(r.filter?.cutoff).toBeCloseTo(8.176 * 32);
    expect(r.filter?.q).toBeCloseTo(6);
    expect((await region([])).filter).toBeUndefined();
    // preset values add: 13500 − 1200 = 12300 cents
    expect((await region([], [gen(GEN.filterFc, -1200)])).filter?.cutoff).toBeCloseTo(8.176 * 2 ** (12300 / 1200));
  });

  it('turns an exclusive class into a choke group', async () => {
    const r = await region([gen(GEN.exclusiveClass, 3)]);
    expect([r.chokeGroup, r.offBy]).toEqual([3, 3]);
    expect((await region([])).chokeGroup).toBeUndefined();
  });

  it('picks the root key from overridingRootKey, the sample, or middle C', async () => {
    expect((await region([gen(GEN.rootKey, 30)], [], { pitch: 72 })).rootKey).toBe(30);
    expect((await region([gen(GEN.rootKey, -1)], [], { pitch: 72 })).rootKey).toBe(72);
    expect((await region([], [], { pitch: 255 })).rootKey).toBe(60);
    expect((await parse(single([], [], { pitch: 255 }))).samples[0].originalPitch).toBeUndefined();
  });

  it('applies tuning and scale tuning', async () => {
    const r = await region([gen(GEN.coarseTune, -12), gen(GEN.fineTune, -30), gen(GEN.scaleTuning, 0)], [gen(GEN.scaleTuning, 50)]);
    expect([r.tune, r.keyTrack]).toEqual([-1230, 50]);
  });

  it('applies the address offsets, coarse ones in steps of 32768', async () => {
    const r = await region([gen(GEN.startOffset, 5), gen(GEN.startCoarse, 1), gen(GEN.endOffset, -10)]);
    expect(r.offset).toBe(32773);
    expect(r.end).toBe(90);
    expect((await region([gen(GEN.endCoarse, -1)])).end).toBe(0);
    expect((await region([gen(GEN.startOffset, 5)])).end).toBeUndefined();
  });

  it('ignores keynum / velocity overrides with one warning', async () => {
    const bank = await parse({
      samples: [{ name: 'S', pcm: ramp(10) }],
      instruments: [{ name: 'I', zones: [[gen(GEN.keynum, 60), sampleId(0)], [gen(GEN.keynum, 64), sampleId(0)]] }],
      presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
    });
    expect(bank.presets[0].regions).toHaveLength(2);
    expect(bank.warnings).toHaveLength(1);
    expect(bank.warnings[0]).toMatch(/fixed key or velocity/);
  });

  it('skips ROM samples with one warning', async () => {
    const bank = await parse({
      samples: [{ name: 'ROM Piano' }, { name: 'S', pcm: ramp(10) }, { name: 'ROM Bass' }],
      instruments: [{ name: 'I', zones: [[keys(0, 40), sampleId(0)], [keys(41, 80), sampleId(1)], [keys(81, 127), sampleId(2)]] }],
      presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
    });
    expect(bank.presets[0].regions.map(r => [r.loKey, bank.samples[r.sample].name])).toEqual([[41, 'S']]);
    expect(bank.samples).toHaveLength(1);
    expect(bank.warnings).toHaveLength(1);
    expect(bank.warnings[0]).toMatch(/ROM/);
  });

  it('skips samples that point outside the sample data', async () => {
    const bytes = sf2(single([]));
    // move the sample's end far past the smpl chunk
    const shdr = findChunk(bytes, 'shdr');
    new DataView(bytes.buffer).setUint32(shdr.at + 24, 1_000_000, true);
    const bank = await parseSf2(memoryReader(bytes));
    expect(bank.presets[0].regions).toEqual([]);
    expect(bank.warnings).toEqual(['1 sample points outside the sample data; the parts using them are skipped.']);
  });
});

describe('parseSf2: SF3', () => {
  const stream = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37) & 0xff);
  const sf3 = (noPad: boolean): TBank => ({
    version: [3, 1],
    noPad,
    samples: [
      { name: 'PCM', pcm: ramp(20) },
      { name: 'Ogg', stream: stream(101), pitch: 64, loop: [1000, 5000] },
    ],
    instruments: [{ name: 'I', zones: [[keys(0, 59), sampleId(0)], [keys(60, 127), gen(GEN.sampleModes, 1), gen(GEN.endOffset, -5), sampleId(1)]] }],
    presets: [{ name: 'P', program: 0, zones: [[instrument(0)]] }],
  });

  for (const noPad of [true, false]) {
    it(`points at compressed streams by byte offset${noPad ? ' (no pad byte after odd chunks)' : ''}`, async () => {
      const bytes = sf2(sf3(noPad));
      const smpl = findChunk(bytes, 'smpl');
      const bank: ParsedBank = await parseSf2(memoryReader(bytes));
      expect(bank.format).toBe('sf3');
      expect(bank.samples[1]).toEqual({
        name: 'Ogg',
        sampleRate: 44100,
        frames: 0,
        originalPitch: 64,
        pitchCorrection: 0,
        loopStart: 1000,
        loopEnd: 5000,
        source: { kind: 'encoded', byteOffset: smpl.at + (20 + 46) * 2, byteLength: 101, format: 'ogg' },
      });
      const source = bank.samples[1].source;
      if (source.kind !== 'encoded') throw new Error('expected a stream');
      expect(bytes.subarray(source.byteOffset, source.byteOffset + source.byteLength)).toEqual(stream(101));
      const r = bank.presets[0].regions[1];
      expect([r.rootKey, r.loop, r.loopStart, r.loopEnd, r.end]).toEqual([64, 'continuous', 1000, 5000, undefined]);
      expect(bank.samples[0].source).toMatchObject({ kind: 'pcm16', byteOffset: smpl.at, frames: 20 });
    });
  }

  it('calls a version-3 file sf3 even without compressed samples', async () => {
    expect((await parse({ ...single([]), version: [3, 1] })).format).toBe('sf3');
  });
});

describe('parseSf2: errors', () => {
  const rejects = async (bytes: Uint8Array, message: RegExp) => {
    const result = parseSf2(memoryReader(bytes));
    await expect(result).rejects.toThrow(BankFormatError);
    await expect(result).rejects.toThrow(message);
  };

  it('rejects files that are not SoundFonts', async () => {
    await rejects(ascii('MThd\0\0\0\x06\0\x01\0\x01'), /^This isn't a SoundFont file\.$/);
    await rejects(new Uint8Array(0), /isn't a SoundFont/);
    await rejects(concat([ascii('RIFF'), new Uint8Array(4), ascii('WAVEfmt ')]), /isn't a SoundFont file.*WAVE/);
  });

  it('rejects a file cut short in the preset data', async () => {
    const bytes = sf2(single([]));
    await rejects(bytes.subarray(0, bytes.length - 40), /^The SoundFont is damaged: the file is cut short\.$/);
  });

  it('rejects a file without preset data', async () => {
    const bytes = sf2(single([]));
    const list = findChunk(bytes, 'pdta').at - 16; // 'pdta' is the LIST's form type
    await rejects(bytes.subarray(0, list), /^The SoundFont is damaged: its preset list is missing/);
  });

  it('rejects wrongly sized pdta lists', async () => {
    await rejects(sf2({ ...single([]), shdrExtra: 2 }), /^The SoundFont is damaged: its “shdr” list has the wrong size\.$/);
  });

  it('rejects zones that point past the end of their lists', async () => {
    const bytes = sf2(single([]));
    const phdr = findChunk(bytes, 'phdr');
    new DataView(bytes.buffer).setUint16(phdr.at + 38 + 24, 9, true); // EOP's bag index
    await rejects(bytes, /^The SoundFont is damaged: a zone list runs past its end\.$/);
  });
});
