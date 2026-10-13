/**
 * Standard MIDI File → Clef Coach song.
 *
 * MIDI stores when keys go down and up, not notation, so the importer rebuilds it:
 *
 *   - reads format 0 and 1 files (running status, tempo / time / key signature and
 *     track-name meta events; sysex skipped; note-on with velocity 0 = note-off),
 *   - quantises onsets and releases to a grid (16ths by default, with triplets where
 *     the notes clearly sit on triplet positions),
 *   - builds bars from the time signature (and its changes), finds a pickup when the
 *     music obviously starts on the last beat(s) of a bar,
 *   - spells pitches from the key signature (or an estimated key),
 *   - piano: two tracks become right / left hand, one track is split around middle C
 *     with smoothing so a melody doesn't jump between staves; other instruments get
 *     one staff in their clef,
 *   - up to two voices per staff; chords from notes that start and end together.
 *
 * Fingering, spelling intent, lyrics and chord symbols don't exist in MIDI.
 */
import { type InstrumentId, familyOf, instrumentDef } from '../music/instruments';
import { type KeySig, keyName } from '../music/keys';
import type { SongDef, SongStaffDef } from '../music/parse';
import { PPQ, type TimeSig, measureTicks } from '../music/rhythm';
import type { Clef } from '../music/score';
import { newSongId } from './format';
import {
  type GridSpec,
  type ImportPart,
  type ImportResult,
  type Layout,
  type TimedNote,
  ImportError,
  Warnings,
  buildVoice,
  cleanTempo,
  guessInstrument,
  makeLayout,
  makeQuantizer,
  measureAt,
  median,
  pickupToken,
  plural,
  spellInKey,
  writeVoice,
} from './importkit';

export type { ImportPart, ImportResult } from './importkit';
export { ImportError } from './importkit';

export interface MidiOptions {
  /** Instrument to write the song for (guessed from the tracks when absent). */
  instrument?: InstrumentId;
  /** Tracks to import (indexes into `parts`); default: one track, or a piano RH/LH pair. */
  tracks?: number[];
  /**
   * Finest rhythm: 's' sixteenths, 'e' eighths, 't3' sixteenths plus triplet eighths.
   * Default: sixteenths, with triplets when many notes sit on triplet positions.
   */
  quantize?: 's' | 'e' | 't3';
  /** Title to use when the file has none (e.g. the file name). */
  title?: string;
}

// ---------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------

export interface MidiNote {
  midi: number;
  velocity: number;
  channel: number;
  /** In file ticks. */
  start: number;
  end: number;
}

export interface MidiTrackData {
  name?: string;
  instrument?: string;
  /** First program change per channel (0-based, as in the file). */
  programs: Map<number, number>;
  notes: MidiNote[];
}

export interface MidiFileData {
  format: number;
  /** Ticks per quarter note. */
  ppq: number;
  tracks: MidiTrackData[];
  tempos: { tick: number; bpm: number }[];
  timeSigs: { tick: number; time: TimeSig }[];
  keySigs: { tick: number; key: KeySig }[];
  /** The file counted time in SMPTE frames (converted at the opening tempo). */
  smpte: boolean;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];

/** Parse a Standard MIDI File (also inside a RIFF "RMID" wrapper). Throws ImportError. */
export function parseMidi(input: Uint8Array): MidiFileData {
  let bytes = input;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'RMID') {
    for (let p = 12; p + 8 <= bytes.length; ) {
      const len = bytes[p + 4] | (bytes[p + 5] << 8) | (bytes[p + 6] << 16) | (bytes[p + 7] << 24);
      if (ascii(bytes, p, 4) === 'data') {
        bytes = bytes.subarray(p + 8, p + 8 + len);
        break;
      }
      p += 8 + len + (len & 1);
    }
  }
  if (bytes.length < 14 || ascii(bytes, 0, 4) !== 'MThd') throw new ImportError("This isn't a MIDI file (it doesn't start with MThd).");
  const hlen = u32be(bytes, 4);
  const format = u16be(bytes, 8);
  const division = u16be(bytes, 12);
  const smpte = (division & 0x8000) !== 0;
  const file: MidiFileData = { format, ppq: 480, tracks: [], tempos: [], timeSigs: [], keySigs: [], smpte };
  // SMPTE time: ticks per second, turned into ticks per quarter at 120 BPM (fixed below if a tempo exists)
  const ticksPerSecond = smpte ? (256 - (division >> 8)) * (division & 0xff) : 0;
  file.ppq = smpte ? ticksPerSecond / 2 : division || 480;
  const decoder = new TextDecoder('utf-8');
  for (let p = 8 + hlen; p + 8 <= bytes.length; ) {
    const id = ascii(bytes, p, 4);
    const len = u32be(bytes, p + 4);
    const data = bytes.subarray(p + 8, Math.min(bytes.length, p + 8 + len));
    p += 8 + len;
    if (id === 'MTrk') file.tracks.push(readTrack(data, file, decoder));
  }
  if (!file.tracks.length) throw new ImportError('This MIDI file has no tracks.');
  if (smpte && file.tempos.length) {
    // seconds per quarter at the opening tempo
    const scale = (ticksPerSecond * 60) / file.tempos[0].bpm / file.ppq;
    file.ppq *= scale;
  }
  return file;
}

function readTrack(d: Uint8Array, file: MidiFileData, decoder: TextDecoder): MidiTrackData {
  const track: MidiTrackData = { programs: new Map(), notes: [] };
  const open = new Map<number, { start: number; velocity: number }>();
  let p = 0;
  let tick = 0;
  let status = 0;
  const vlq = () => {
    let v = 0;
    for (let k = 0; k < 4 && p < d.length; k++) {
      const b = d[p++];
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };
  const close = (ch: number, key: number, at: number) => {
    const o = open.get(ch * 128 + key);
    if (!o) return;
    open.delete(ch * 128 + key);
    if (at > o.start) track.notes.push({ midi: key, velocity: o.velocity, channel: ch, start: o.start, end: at });
  };
  while (p < d.length) {
    tick += vlq();
    if (p >= d.length) break;
    const b = d[p];
    if (b === 0xff) {
      const type = d[p + 1];
      p += 2;
      const len = vlq();
      const data = d.subarray(p, p + len);
      p += len;
      status = 0;
      if (type === 0x2f) break;
      if (type === 0x03 && track.name === undefined) track.name = decoder.decode(data).replace(/\0/g, '').trim();
      else if (type === 0x04 && track.instrument === undefined) track.instrument = decoder.decode(data).replace(/\0/g, '').trim();
      else if (type === 0x51 && len >= 3) {
        const uspq = (data[0] << 16) | (data[1] << 8) | data[2];
        if (uspq > 0) file.tempos.push({ tick, bpm: 60_000_000 / uspq });
      } else if (type === 0x58 && len >= 2) file.timeSigs.push({ tick, time: [data[0], 2 ** data[1]] });
      else if (type === 0x59 && len >= 2) {
        const sf = data[0] > 127 ? data[0] - 256 : data[0];
        file.keySigs.push({ tick, key: { fifths: Math.max(-7, Math.min(7, sf)), mode: data[1] === 1 ? 'minor' : 'major' } });
      }
      continue;
    }
    if (b === 0xf0 || b === 0xf7) {
      p++;
      const len = vlq();
      p += len;
      status = 0;
      continue;
    }
    if (b & 0x80) {
      status = b;
      p++;
    } else if (!status) {
      p++; // stray data byte
      continue;
    }
    const type = status & 0xf0;
    const ch = status & 0x0f;
    if (type === 0x80 || type === 0x90) {
      const key = d[p++] & 0x7f;
      const vel = d[p++] & 0x7f;
      if (type === 0x90 && vel > 0) {
        close(ch, key, tick); // re-struck before release
        open.set(ch * 128 + key, { start: tick, velocity: vel });
      } else close(ch, key, tick);
    } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) p += 2;
    else if (type === 0xc0) {
      if (!track.programs.has(ch)) track.programs.set(ch, d[p] & 0x7f);
      p++;
    } else if (type === 0xd0) p++;
    else {
      // system common messages don't belong in files; skip their data
      p += status === 0xf2 ? 2 : status === 0xf1 || status === 0xf3 ? 1 : 0;
      status = 0;
    }
  }
  for (const k of [...open.keys()]) close(Math.floor(k / 128), k % 128, tick);
  track.notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  return track;
}

// ---------------------------------------------------------------------------
// Key estimation
// ---------------------------------------------------------------------------

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
/** Key signature of each major tonic pitch class (the spelling with fewer accidentals). */
const MAJOR_FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

/** Krumhansl–Schmuckler: correlate the pitch-class durations with each key's profile. */
export function estimateKey(notes: { midi: number; start: number; end: number }[]): KeySig {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[((n.midi % 12) + 12) % 12] += Math.max(1, n.end - n.start);
  const corr = (profile: number[], tonic: number) => {
    const xs = hist.map((_, i) => profile[(i - tonic + 12) % 12]);
    const mx = xs.reduce((a, b) => a + b) / 12;
    const my = hist.reduce((a, b) => a + b) / 12;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < 12; i++) {
      num += (xs[i] - mx) * (hist[i] - my);
      dx += (xs[i] - mx) ** 2;
      dy += (hist[i] - my) ** 2;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  };
  let best: KeySig = { fifths: 0, mode: 'major' };
  let bestR = -Infinity;
  for (let t = 0; t < 12; t++) {
    const rMaj = corr(MAJOR_PROFILE, t);
    if (rMaj > bestR + 1e-9) {
      bestR = rMaj;
      best = { fifths: MAJOR_FIFTHS[t], mode: 'major' };
    }
    const rMin = corr(MINOR_PROFILE, t);
    if (rMin > bestR + 1e-9) {
      bestR = rMin;
      // a minor key shares its signature with the major key a minor third up
      best = { fifths: MAJOR_FIFTHS[(t + 3) % 12], mode: 'minor' };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Staves and voices
// ---------------------------------------------------------------------------

/** A quantised note (ticks at PPQ 48). */
interface QNote {
  start: number;
  end: number;
  midi: number;
}

/**
 * Split piano notes into right and left hand. Notes struck together are divided where
 * it costs least: each hand prefers notes near where it has been playing recently,
 * leans towards middle C as the boundary and avoids stretches wider than a ninth.
 */
function splitHands(notes: QNote[]): [QNote[], QNote[]] {
  const rh: QNote[] = [];
  const lh: QNote[] = [];
  let rhAvg = 67;
  let lhAvg = 50;
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.midi - b.midi);
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].start === sorted[i].start) j++;
    const group = sorted.slice(i, j);
    i = j;
    let bestK = 0;
    let bestCost = Infinity;
    for (let k = 0; k <= group.length; k++) {
      const left = group.slice(0, k);
      const right = group.slice(k);
      let cost = 0;
      for (const n of left) cost += Math.abs(n.midi - lhAvg) + (n.midi >= 60 ? (n.midi - 59) * 0.5 : 0);
      for (const n of right) cost += Math.abs(n.midi - rhAvg) + (n.midi < 60 ? (60 - n.midi) * 0.5 : 0);
      for (const hand of [left, right]) {
        const span = hand.length ? hand[hand.length - 1].midi - hand[0].midi : 0;
        if (span > 14) cost += (span - 14) * 4;
      }
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        bestK = k;
      }
    }
    const left = group.slice(0, bestK);
    const right = group.slice(bestK);
    lh.push(...left);
    rh.push(...right);
    const mean = (xs: QNote[]) => xs.reduce((s, n) => s + n.midi, 0) / xs.length;
    if (left.length) lhAvg = lhAvg * 0.7 + mean(left) * 0.3;
    if (right.length) rhAvg = rhAvg * 0.7 + mean(right) * 0.3;
  }
  return [rh, lh];
}

interface Cluster {
  start: number;
  end: number;
  midis: number[];
}

/**
 * Share a staff's notes between at most two voices. Notes that start and end together
 * form chords; a note held while others move goes to the second voice. Slight overlaps
 * (legato playing) are trimmed; anything that still doesn't fit is cut short.
 */
function allocateVoices(notes: QNote[], grid: (t: number) => number): { voices: Cluster[][]; simplified: number } {
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.end - b.end || b.midi - a.midi);
  const byTime = new Map<string, Cluster>();
  for (const n of sorted) {
    const key = `${n.start}|${n.end}`;
    const c = byTime.get(key);
    if (c) {
      if (!c.midis.includes(n.midi)) c.midis.push(n.midi);
    } else byTime.set(key, { start: n.start, end: n.end, midis: [n.midi] });
  }
  const clusters = [...byTime.values()];
  clusters.sort((a, b) => a.start - b.start || Math.max(...b.midis) - Math.max(...a.midis));
  const voices: Cluster[][] = [[], []];
  const lastOf = (v: Cluster[]) => v[v.length - 1];
  const top = (c: Cluster) => Math.max(...c.midis);
  let simplified = 0;
  for (const c of clusters) {
    // legato overlaps: a note running up to one grid step into the next one just ends there
    for (const v of voices) {
      const l = lastOf(v);
      if (l && l.end > c.start && l.start < c.start && l.end - c.start <= grid(c.start)) l.end = c.start;
    }
    const free = voices.filter(v => !lastOf(v) || lastOf(v).end <= c.start);
    let target: Cluster[];
    if (free.length === 2) {
      // the second voice only competes while it is as current as the first
      if (!voices[1].length || !voices[0].length || lastOf(voices[1]).end < lastOf(voices[0]).end) target = voices[0];
      else {
        const d = (v: Cluster[]) => Math.abs(top(c) - top(lastOf(v)));
        target = d(voices[1]) < d(voices[0]) ? voices[1] : voices[0];
      }
    } else if (free.length === 1) target = free[0];
    else {
      simplified++;
      const same = voices.find(v => lastOf(v).start === c.start);
      if (same) {
        // struck together with a chord that ends at another time: join it
        for (const m of c.midis) if (!lastOf(same).midis.includes(m)) lastOf(same).midis.push(m);
        continue;
      }
      // cut short whichever voice is released first
      target = lastOf(voices[0]).end <= lastOf(voices[1]).end ? voices[0] : voices[1];
      lastOf(target).end = c.start;
    }
    target.push(c);
  }
  const used = voices.filter(v => v.length);
  const avg = (v: Cluster[]) => v.reduce((s, c) => s + c.midis.reduce((a, b) => a + b, 0) / c.midis.length, 0) / v.length;
  if (used.length === 2 && avg(used[1]) > avg(used[0])) used.reverse();
  return { voices: used.length ? used : [[]], simplified };
}

/** Close small gaps inside a voice (notes released a little early). */
function legato(v: Cluster[], grid: (t: number) => number): void {
  for (let i = 0; i + 1 < v.length; i++) {
    const gap = v[i + 1].start - v[i].end;
    if (gap > 0 && gap <= Math.max(grid(v[i].end), (v[i].end - v[i].start) / 5)) v[i].end = v[i + 1].start;
  }
}

function clefFor(instrument: InstrumentId, midis: number[], hand?: 'R' | 'L'): Clef {
  if (instrument === 'guitar') return 'treble8vb';
  if (instrument === 'bass') return 'bass8vb';
  if (instrument === 'ukulele') return 'treble';
  const low = midis.filter(m => m < 60).length;
  if (hand === 'R') return low > midis.length * 0.7 ? 'bass' : 'treble';
  if (hand === 'L') return midis.length - low > midis.length * 0.7 ? 'treble' : 'bass';
  return median(midis) >= 57 ? 'treble' : 'bass';
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const GM_FAMILIES = ['Piano', 'Chromatic percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth lead', 'Synth pad', 'Synth effects', 'Ethnic', 'Percussive', 'Sound effects'];
const VALID_DEN = [1, 2, 4, 8, 16, 32];
const GENERIC_NAME = /^(untitled|track\s*\d*|inst(rument)?\s*\d*|midi|sequence|seq-?\d*|new song|tempo track|conductor)?$/i;

interface LogicalTrack {
  name: string;
  program?: number;
  notes: MidiNote[];
}

/** Convert a Standard MIDI File into a song. Throws ImportError if it can't be read. */
export function importMidi(bytes: Uint8Array, opts: MidiOptions = {}): ImportResult {
  const w = new Warnings();
  const file = parseMidi(bytes);
  if (file.format === 2) w.add('This is a type 2 MIDI file (independent patterns); its tracks were read as if they play together.');
  if (file.smpte) w.add('This MIDI file counts time in frames; beats were worked out from the opening tempo.');

  // ---- tracks with notes (a type 0 file is split by channel); drums are left out
  const logical: LogicalTrack[] = [];
  let drumNotes = 0;
  file.tracks.forEach((t, ti) => {
    const pitched = t.notes.filter(n => n.channel !== 9);
    drumNotes += t.notes.length - pitched.length;
    const channels = [...new Set(pitched.map(n => n.channel))].sort((a, b) => a - b);
    const split = file.format === 0 && channels.length > 1 ? channels.map(ch => pitched.filter(n => n.channel === ch)) : [pitched];
    split.forEach(notes => {
      if (!notes.length) return;
      const ch = notes[0].channel;
      const prog = t.programs.get(ch);
      const family = prog !== undefined ? GM_FAMILIES[prog >> 3] : undefined;
      const base = t.name && !GENERIC_NAME.test(t.name) ? t.name : t.instrument || `Track ${ti + 1}`;
      const name = split.length > 1 ? `${base} (channel ${ch + 1})` : family && !t.name ? `${base} (${family})` : base;
      logical.push({ name, program: prog !== undefined ? prog + 1 : undefined, notes });
    });
  });
  if (drumNotes) w.add(`${plural(drumNotes, 'drum note')} (MIDI channel 10) ${drumNotes > 1 ? 'were' : 'was'} left out.`);
  if (!logical.length) throw new ImportError('This MIDI file has no notes to import.');
  const parts: ImportPart[] = logical.map((t, i) => ({ id: String(i), name: t.name, staves: 1 }));

  // ---- which tracks, which instrument
  const guessOf = (t: LogicalTrack) => guessInstrument([t.name], t.program);
  let chosen: number[];
  if (opts.tracks?.length) {
    chosen = [...new Set(opts.tracks)].filter(i => Number.isInteger(i) && i >= 0 && i < logical.length);
    if (chosen.length < opts.tracks.length) w.add(`Some requested tracks don't exist (the file has ${plural(logical.length, 'track')}).`);
    if (!chosen.length) throw new ImportError(`None of the requested tracks exist; the file has ${plural(logical.length, 'track')}.`);
  } else {
    const g0 = guessOf(logical[0]);
    const g1 = logical[1] ? guessOf(logical[1]) : null;
    const pianoish = (g: InstrumentId | null) => g === null || g === 'piano';
    const target = opts.instrument ?? g0;
    chosen = logical.length === 2 && pianoish(g0) && pianoish(g1) && (target === null || target === 'piano' || target === 'mallets') ? [0, 1] : [0];
    if (logical.length > chosen.length) w.add(`Imported ${chosen.map(i => `"${logical[i].name}"`).join(' and ')}; the file has ${plural(logical.length, 'track')} – choose others to import them instead.`);
  }
  const tracks = chosen.map(i => logical[i]);
  const instrument: InstrumentId = opts.instrument ?? guessOf(tracks[0]) ?? 'piano';

  // ---- time: file ticks → PPQ 48
  const scale = PPQ / file.ppq;
  const raw = tracks.map(t => t.notes.map(n => ({ start: n.start * scale, end: n.end * scale, midi: n.midi })));
  const allRaw = raw.flat();
  const lastEnd = allRaw.reduce((m, n) => Math.max(m, n.end), 0);

  // ---- bars from the time signatures
  const sigs = [...file.timeSigs].sort((a, b) => a.tick - b.tick).map(s => ({ tick: s.tick * scale, time: s.time }));
  const validSig = (t: TimeSig) => t[0] >= 1 && t[0] <= 32 && VALID_DEN.includes(t[1]);
  for (const s of sigs) {
    if (!validSig(s.time)) {
      w.add(`The time signature ${s.time[0]}/${s.time[1]} isn't supported; 4/4 was used.`);
      s.time = [4, 4];
    }
  }
  const bars: { start: number; len: number; time: TimeSig }[] = [];
  let time: TimeSig = sigs.find(s => s.tick <= 0)?.time ?? sigs[0]?.time ?? [4, 4];
  let si = 0;
  let moved = false;
  for (let t = 0; t < lastEnd - 1e-6 || !bars.length; ) {
    while (si < sigs.length && sigs[si].tick <= t + 1e-6) time = sigs[si++].time;
    const len = measureTicks(time);
    bars.push({ start: t, len, time });
    t += len;
    if (si < sigs.length && sigs[si].tick < t - 1e-6) moved = true; // change inside a bar: applied at the next bar line
  }
  if (moved) w.add('A time signature change that fell inside a bar was moved to the next bar line.');
  if (!file.timeSigs.length) w.add('The file has no time signature; 4/4 was assumed.');
  // a short opening bar written with its own time signature (e.g. 1/4 then 4/4) is a pickup
  let pickup = 0;
  if (bars.length > 1 && bars[0].len < measureTicks(bars[1].time) && pickupToken(bars[0].len)) {
    pickup = bars[0].len;
    bars[0].time = bars[1].time;
  }

  // ---- quantise
  const spec: GridSpec = opts.quantize === 'e' ? { binary: 24, triplet: 0 } : opts.quantize === 's' ? { binary: 12, triplet: 0 } : { binary: 12, triplet: 16 };
  let layout: Layout = makeLayout(bars.map(b => ({ len: b.len, time: b.time, key: { fifths: 0, mode: 'major' } })));
  const points = allRaw.flatMap(n => [{ t: n.start, w: 1 }, { t: n.end, w: 0.25 }]);
  let q = makeQuantizer(layout, points, spec);
  // triplets only when a fair share of the busy beats clearly sit on triplet positions
  if (!opts.quantize && q.tripletBeats < Math.max(1, q.busyBeats * 0.1)) q = makeQuantizer(layout, points, { ...spec, triplet: 0 });
  let graceNotes = 0;
  let notes: QNote[][] = raw.map(list => {
    const snapped = list.map(n => {
      const start = q.snap(n.start);
      let end = q.snap(n.end);
      if (end <= start) end = start + q.grid(start);
      return { start, end, midi: n.midi, short: n.end - n.start < q.grid(start) / 2 };
    });
    // grace notes and ornaments: very short notes that land on a real note's onset
    const longAt = new Set(snapped.filter(n => !n.short).map(n => n.start));
    return snapped.filter(n => {
      const drop = n.short && longAt.has(n.start);
      if (drop) graceNotes++;
      return !drop;
    }).map(({ start, end, midi }) => ({ start, end, midi }));
  });
  if (graceNotes) w.add(`${plural(graceNotes, 'very short note')} (grace notes or ornaments) ${graceNotes > 1 ? 'were' : 'was'} left out.`);

  // ---- leading empty bars, and a pickup when the music clearly starts late in bar 1
  const firstOnset = notes.flat().reduce((m, n) => Math.min(m, n.start), Infinity);
  let shift = 0;
  let emptyBars = 0;
  while (!pickup && bars.length > 1 && firstOnset >= bars[0].start + bars[0].len) {
    shift += bars[0].len;
    bars.shift();
    emptyBars++;
  }
  if (emptyBars) w.add(`${plural(emptyBars, 'empty bar')} at the start ${emptyBars > 1 ? 'were' : 'was'} removed.`);
  const s0 = firstOnset - shift;
  if (!pickup && s0 > bars[0].start - shift + 1e-6) {
    const off = s0 - (bars[0].start - shift);
    const len = bars[0].len - off;
    // starting on one of the time signature's counts (a quarter in 4/4, an eighth in 6/8)
    const unit = (4 * PPQ) / bars[0].time[1];
    const onBeat = Math.abs(off / unit - Math.round(off / unit)) < 1e-6;
    if (onBeat && pickupToken(len) && len <= bars[0].len / 2) {
      pickup = len;
      shift += off;
      bars[0] = { ...bars[0], start: bars[0].start + off, len };
    }
  }
  if (shift) notes = notes.map(list => list.map(n => ({ ...n, start: n.start - shift, end: n.end - shift })));

  // ---- keys
  const keySigs = [...file.keySigs].sort((a, b) => a.tick - b.tick).map(k => ({ tick: k.tick * scale - shift, key: k.key }));
  let opening: KeySig;
  if (keySigs.length) opening = keySigs.find(k => k.tick <= 0)?.key ?? keySigs[0].key;
  else {
    opening = estimateKey(notes.flat());
    w.add(`The file has no key signature; the key was estimated as ${keyName(opening).replace(/m$/, ' minor')}${opening.mode === 'major' ? ' major' : ''}.`);
  }
  let startAt = 0;
  layout = makeLayout(bars.map(b => {
    const len = b.len;
    const beat = Math.min(len, 48);
    let key = opening;
    for (const k of keySigs) if (k.tick <= startAt + beat / 2) key = k.key;
    startAt += len;
    return { len, time: b.time, key };
  }));
  const gridAt = (t: number) => q.grid(t + shift);

  // ---- staves
  const family = familyOf(instrument);
  let staffNotes: { notes: QNote[]; hand?: 'R' | 'L' }[];
  const melodyOnly = notes.length !== 2 && monophonic(notes.flat(), gridAt);
  if ((instrument === 'piano' || (instrument === 'mallets' && spread(notes.flat()) > 24)) && !melodyOnly) {
    let rh: QNote[];
    let lh: QNote[];
    if (notes.length === 2) {
      const avg = (xs: QNote[]) => xs.reduce((s, n) => s + n.midi, 0) / Math.max(1, xs.length);
      [rh, lh] = avg(notes[0]) >= avg(notes[1]) ? [notes[0], notes[1]] : [notes[1], notes[0]];
    } else [rh, lh] = splitHands(notes.flat());
    staffNotes = [{ notes: rh, hand: 'R' as const }, { notes: lh, hand: 'L' as const }].filter(s => s.notes.length);
    if (staffNotes.length === 1 && instrument === 'mallets') staffNotes[0].hand = undefined;
  } else if (instrument === 'piano') {
    // a single melodic line stays on one staff, in the hand its clef suggests
    staffNotes = [{ notes: notes.flat(), hand: median(notes.flat().map(n => n.midi)) >= 57 ? 'R' : 'L' }];
  } else {
    staffNotes = [{ notes: notes.flat() }];
    if (family === 'fretted' && notes.length > 1) w.add(`The chosen tracks were combined on one ${instrumentDef(instrument).name.toLowerCase()} staff.`);
  }

  // ---- voices
  let simplified = 0;
  let shortened = 0;
  const staves: SongStaffDef[] = staffNotes.map(st => {
    const alloc = allocateVoices(st.notes, gridAt);
    simplified += alloc.simplified;
    const voices = alloc.voices.map(v => {
      legato(v, gridAt);
      const timed: TimedNote[] = v.flatMap(c =>
        c.midis.map(m => ({ start: c.start, end: c.end, pitches: [spellInKey(m, layout.keys[measureAt(layout, c.start)])] })),
      );
      const built = buildVoice(timed, layout);
      shortened += built.shortened;
      return writeVoice(built.specs, layout);
    });
    const staff: SongStaffDef = { clef: clefFor(instrument, st.notes.map(n => n.midi), st.hand), voices };
    if (st.hand) staff.hand = st.hand;
    return staff;
  });
  if (simplified + shortened) w.add(`${plural(simplified + shortened, 'overlapping note')} didn't fit in two voices and ${simplified + shortened > 1 ? 'were' : 'was'} shortened or joined to a chord.`);

  // ---- tempo and title
  const tempos = [...file.tempos].sort((a, b) => a.tick - b.tick);
  if (new Set(tempos.map(t => Math.round(t.bpm))).size > 1) w.add('Tempo changes were left out; the song uses the opening tempo.');
  const t0 = file.tracks[0];
  // the first track's name is the title in a type 0 file or a conductor track, unless it just names an instrument
  const titleFromFile = (file.format === 0 || !t0.notes.length) && t0.name && !GENERIC_NAME.test(t0.name) && !guessInstrument([t0.name]) ? t0.name : '';
  const title = titleFromFile || opts.title?.trim() || 'Imported MIDI';
  w.add("MIDI files don't hold fingering, note spelling, lyrics or chord symbols, so none were imported; notes are spelled from the key signature.");

  const song: SongDef = {
    id: newSongId(title),
    title,
    composer: '',
    source: 'Imported from MIDI',
    instrument,
    level: 3,
    key: keyName(layout.keys[0]),
    time: layout.times[0],
    tempo: cleanTempo(tempos[0]?.bpm, 120),
    pickup: pickup ? pickupToken(pickup) ?? undefined : undefined,
    staves,
  };
  return { song, warnings: w.list, parts };
}

/** Does a line play one note at a time (overlaps of more than a grid step are rare)? */
function monophonic(notes: QNote[], grid: (t: number) => number): boolean {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  let overlaps = 0;
  let end = -Infinity;
  for (const n of sorted) {
    // something earlier is still sounding when this note starts (chords count too)
    if (end - n.start > grid(n.start)) overlaps++;
    end = Math.max(end, n.end);
  }
  return overlaps <= sorted.length * 0.05;
}

function spread(notes: QNote[]): number {
  if (!notes.length) return 0;
  const ms = notes.map(n => n.midi).sort((a, b) => a - b);
  // ignore a few outliers at either end
  const k = Math.floor(ms.length * 0.05);
  return ms[ms.length - 1 - k] - ms[k];
}
