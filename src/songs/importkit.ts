/**
 * Shared machinery for the song importers (src/songs/musicxml.ts, src/songs/midi.ts).
 *
 * Both importers reduce a foreign file to timed notes – start and end in ticks
 * (PPQ = 48) on one performance timeline – plus a bar layout. This module turns that
 * into text notation that always validates:
 *
 *   - quantise times onto a per-beat grid (plain or triplet subdivisions),
 *   - fill gaps with rests, split notes at bar lines and beats with ties, and write
 *     every piece as a single duration token (so formatVoice never has to split),
 *   - write the chord-symbol line with the same bar lines,
 *   - spell MIDI numbers in a key, guess an instrument from part names / programs.
 */
import type { InstrumentId } from '../music/instruments';
import { type KeySig, keyAlterations } from '../music/keys';
import { type SongDef, formatVoice } from '../music/parse';
import { type Pitch, type Step, STEPS, STEP_SEMIS, midiOf } from '../music/pitch';
import { type BaseDuration, type TimeSig, beatTicks, durationTicks, measureTicks } from '../music/rhythm';
import type { MeterChange, NoteSpec } from '../music/score';

/** One part (MusicXML) or track (MIDI) found in the file, so the UI can offer a choice. */
export interface ImportPart {
  id: string;
  name: string;
  staves: number;
}

export interface ImportResult {
  /** Ready for parseSongDoc(songToDoc(song)) / songToScore. */
  song: SongDef;
  /** Things that were simplified or dropped, in plain English. */
  warnings: string[];
  /** What was in the file. */
  parts: ImportPart[];
}

export class ImportError extends Error {}

/** Collects each warning once, in the order first seen. */
export class Warnings {
  readonly list: string[] = [];
  add(msg: string): void {
    if (!this.list.includes(msg)) this.list.push(msg);
  }
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// Bar layout
// ---------------------------------------------------------------------------

/** The bars of an imported song in performance order (repeats written out). */
export interface Layout {
  /** Start tick of each measure. */
  starts: number[];
  /** Length of each measure (a pickup bar or a final bar after a pickup may be short). */
  lens: number[];
  times: TimeSig[];
  keys: KeySig[];
  /** Tick each measure's beat grid counts from (earlier than the start for a pickup bar). */
  origins: number[];
}

export function makeLayout(measures: { len: number; time: TimeSig; key: KeySig }[]): Layout {
  const L: Layout = { starts: [], lens: [], times: [], keys: [], origins: [] };
  let t = 0;
  measures.forEach((m, i) => {
    const full = measureTicks(m.time);
    L.starts.push(t);
    L.lens.push(m.len);
    L.times.push(m.time);
    L.keys.push(m.key);
    // a pickup is the end of a full bar; any other short bar starts on the downbeat
    L.origins.push(i === 0 && m.len < full ? t - (full - m.len) : t);
    t += m.len;
  });
  return L;
}

export const layoutEnd = (L: Layout): number => (L.starts.length ? L.starts[L.starts.length - 1] + L.lens[L.lens.length - 1] : 0);

/** Index of the measure containing a tick (clamped to the layout). */
export function measureAt(L: Layout, tick: number): number {
  let lo = 0;
  let hi = L.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (L.starts[mid] <= tick + 1e-9) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

/**
 * Beat length used for quantising and for splitting long notes: the metronome beat
 * (a dotted quarter in 6/8, 9/8 and 12/8; a half in 2/2), as the rest of the app counts.
 */
export function beatLen(time: TimeSig): number {
  const b = beatTicks(time);
  return measureTicks(time) % b === 0 && b >= 6 ? b : 6;
}

interface BeatPos {
  measure: number;
  /** Beat key, unique in the layout. */
  key: string;
  start: number;
  len: number;
  offset: number;
}

export function beatAt(L: Layout, tick: number): BeatPos {
  const m = measureAt(L, tick);
  const bl = beatLen(L.times[m] ?? [4, 4]);
  const origin = L.origins[m] ?? 0;
  const idx = Math.floor((tick - origin + 1e-9) / bl);
  const start = origin + idx * bl;
  return { measure: m, key: `${m}:${idx}`, start, len: bl, offset: tick - start };
}

/** Is this measure shorter than its time signature (a pickup)? */
export const isPickupLayout = (L: Layout) => L.lens.length > 0 && L.lens[0] < measureTicks(L.times[0]);

/** Key and time signature changes between consecutive measures. */
export function layoutChanges(L: Layout): MeterChange[] {
  const out: MeterChange[] = [];
  for (let m = 1; m < L.starts.length; m++) {
    const c: MeterChange = { measure: m };
    const [a, b] = [L.times[m - 1], L.times[m]];
    if (a[0] !== b[0] || a[1] !== b[1]) c.time = b;
    const [ka, kb] = [L.keys[m - 1], L.keys[m]];
    if (ka.fifths !== kb.fifths || ka.mode !== kb.mode) c.key = kb;
    if (c.time || c.key) out.push(c);
  }
  return out;
}

/** Write note specs built against a layout as one voice of text notation. */
export function writeVoice(specs: NoteSpec[], L: Layout, mallets?: 2 | 4): string {
  return formatVoice(specs, L.times[0], { pickup: isPickupLayout(L) ? L.lens[0] : undefined, changes: layoutChanges(L), mallets });
}

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

export interface Dur {
  base: BaseDuration;
  dots: number;
  triplet: boolean;
  ticks: number;
}

const BASES: BaseDuration[] = ['w', 'h', 'q', 'e', 's', 't'];
const mk = (base: BaseDuration, dots: number, triplet: boolean): Dur => ({ base, dots, triplet, ticks: durationTicks(base, dots, triplet) });
/** Plain and dotted values, longest first (the pieces long notes are tied from). */
const PLAIN: Dur[] = BASES.flatMap(b => [mk(b, 1, false), mk(b, 0, false)]);
const TRIPLETS: Dur[] = BASES.map(b => mk(b, 0, true));
const ALL_PIECES: Dur[] = [...PLAIN, ...TRIPLETS].sort((a, b) => b.ticks - a.ticks);
/** Every value a single token can have (double dots only as a whole note value). */
const SINGLE = new Map<number, Dur>();
for (const d of [...PLAIN, ...BASES.map(b => mk(b, 2, false)), ...TRIPLETS]) if (Number.isInteger(d.ticks) && !SINGLE.has(d.ticks)) SINGLE.set(d.ticks, d);

export const durString = (d: Pick<Dur, 'base' | 'dots' | 'triplet'>) => d.base + '.'.repeat(d.dots) + (d.triplet ? '3' : '');

/** Pickup duration string ("q", "e", "q.") for a length, or null if it has no plain value. */
export function pickupToken(ticks: number): string | null {
  const d = SINGLE.get(ticks);
  return d && !d.triplet && ticks % 6 === 0 ? durString(d) : null;
}

const reachCache = new Map<Dur[], Uint8Array>();

/** Lengths that can be made from a set of values (dynamic programming, cached). */
function reachable(coins: Dur[], max: number): Uint8Array {
  let r = reachCache.get(coins);
  if (r && r.length > max) return r;
  const size = Math.max(max + 1, 2048);
  r = new Uint8Array(size);
  r[0] = 1;
  for (let v = 1; v < size; v++) for (const c of coins) if (c.ticks <= v && r[v - c.ticks]) {
    r[v] = 1;
    break;
  }
  reachCache.set(coins, r);
  return r;
}

/** Split a length into values from a set, longest first; null if impossible. */
function splitWith(len: number, coins: Dur[]): Dur[] | null {
  if (len === 0) return [];
  if (!Number.isInteger(len) || len < 0) return null;
  const r = reachable(coins, len);
  if (!r[len]) return null;
  const out: Dur[] = [];
  let rem = len;
  while (rem > 0) {
    const c = coins.find(x => x.ticks <= rem && r[rem - x.ticks]);
    if (!c) return null;
    out.push(c);
    rem -= c.ticks;
  }
  return out;
}

type BeatKinds = Set<string>; // keys of beats that hold triplet subdivisions

/** Beats holding triplet subdivisions, found from the boundaries that fall in them. */
function tripletBeats(L: Layout, boundaries: number[]): BeatKinds {
  const out: BeatKinds = new Set();
  for (const t of boundaries) {
    const b = beatAt(L, t);
    if (Math.abs(b.offset % 6) > 1e-6 && Math.abs((b.offset % 6) - 6) > 1e-6) out.add(b.key);
  }
  return out;
}

/**
 * Write the span [a, b) – which must lie inside one measure – as a list of note values.
 * A single value is used when it starts on a beat or stays inside its beat; otherwise
 * the span is split at the beat so the rhythm reads clearly.
 */
export function decompose(a: number, b: number, L: Layout, kinds: BeatKinds): Dur[] {
  const out: Dur[] = [];
  let guard = 0;
  while (b - a > 1e-6 && guard++ < 64) {
    const beat = beatAt(L, a);
    const len = Math.round(b - a);
    const beatEnd = beat.start + beat.len;
    const onBeat = Math.abs(beat.offset) < 1e-6;
    const single = SINGLE.get(len);
    if (single && (onBeat || b <= beatEnd + 1e-6) && fits(single, a, b, L, kinds)) {
      out.push(single);
      break;
    }
    if (!onBeat) {
      const end = Math.min(b, beatEnd);
      out.push(...within(Math.round(end - a), kinds.has(beat.key)));
      a = end;
      continue;
    }
    const whole = Math.floor((len + 1e-6) / beat.len) * beat.len;
    if (whole > 0) {
      out.push(...within(whole, false));
      a += whole;
      continue;
    }
    out.push(...within(len, kinds.has(beat.key)));
    break;
  }
  return out;
}

function fits(d: Dur, a: number, b: number, L: Layout, kinds: BeatKinds): boolean {
  const ba = beatAt(L, a);
  const bb = beatAt(L, b - 1e-6);
  const offB = b - bb.start;
  const on = (off: number, g: number) => Math.abs(off - Math.round(off / g) * g) < 1e-6;
  if (!d.triplet) return on(ba.offset, 6) && (on(offB, 6) || Math.abs(offB - bb.len) < 1e-6);
  return on(ba.offset, 4) && on(offB, 4) && (kinds.has(ba.key) || kinds.has(bb.key));
}

function within(len: number, triplet: boolean): Dur[] {
  const r = splitWith(len, triplet ? TRIPLETS : PLAIN) ?? splitWith(len, ALL_PIECES);
  if (!r) throw new ImportError(`Can't write a duration of ${len} ticks.`);
  return r;
}

// ---------------------------------------------------------------------------
// Quantising
// ---------------------------------------------------------------------------

export interface GridSpec {
  /** Finest plain subdivision in ticks (6 = 32nd, 12 = 16th, 24 = eighth). */
  binary: number;
  /** Finest triplet subdivision in ticks (16 = triplet eighth, 8 = triplet 16th), 0 = none. */
  triplet: number;
}

export interface Quantizer {
  snap(t: number): number;
  /** Grid step at a time (the smallest note value written there). */
  grid(t: number): number;
  /** Beats that were given a triplet grid. */
  tripletBeats: number;
  /** Beats with notes off the beat (for deciding whether triplets are real). */
  busyBeats: number;
}

/**
 * Choose a grid for every beat – plain or triplet subdivisions, whichever fits the
 * points falling in it better (plain wins unless triplets fit clearly better) – and
 * return a function snapping times to it. Points carry weights (onsets usually count
 * more than releases).
 */
export function makeQuantizer(L: Layout, points: { t: number; w: number }[], spec: GridSpec): Quantizer {
  const byBeat = new Map<string, { len: number; offs: { o: number; w: number }[] }>();
  for (const p of points) {
    const b = beatAt(L, p.t);
    let e = byBeat.get(b.key);
    if (!e) byBeat.set(b.key, (e = { len: b.len, offs: [] }));
    e.offs.push({ o: b.offset, w: p.w });
  }
  const gridFor = new Map<string, number>();
  // the requested plain grid, or the largest smaller one that divides the beat
  const binOf = (len: number) => {
    for (let g = Math.min(spec.binary, len); g >= 6; g--) if (len % g === 0 && g % 6 === 0) return g;
    return 6;
  };
  const triOf = (len: number) => {
    if (!spec.triplet) return 0;
    for (let g = spec.triplet; g >= 4; g /= 2) if (len % g === 0 && (len / g) % 3 === 0) return g;
    return 0;
  };
  const err = (offs: { o: number; w: number }[], g: number) => offs.reduce((s, { o, w }) => s + w * (o - Math.round(o / g) * g) ** 2, 0);
  let tripletBeats = 0;
  let busyBeats = 0;
  for (const [key, { len, offs }] of byBeat) {
    const bin = binOf(len);
    const tri = triOf(len);
    if (offs.some(x => x.o > 1e-6)) busyBeats++;
    if (tri) {
      const eb = err(offs, bin);
      const et = err(offs, tri);
      if (et < eb * 0.5 - 1e-9) {
        gridFor.set(key, tri);
        tripletBeats++;
        continue;
      }
    }
    gridFor.set(key, bin);
  }
  const gridAt = (t: number) => {
    const b = beatAt(L, Math.max(0, t));
    return { b, g: gridFor.get(b.key) ?? binOf(b.len) };
  };
  return {
    snap(t: number) {
      const { b, g } = gridAt(t);
      return b.start + Math.round(b.offset / g) * g;
    },
    grid: (t: number) => gridAt(t).g,
    tripletBeats,
    busyBeats,
  };
}

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

/** A note, chord or (with no pitches) rest on the performance timeline. */
export interface TimedNote<T = unknown> {
  start: number;
  end: number;
  pitches: Pitch[];
  fingers?: (number | undefined)[];
  strings?: (number | undefined)[];
  /** Tie into the next note of the voice. */
  tieNext?: boolean;
  /** Carried through to `attacks` (e.g. the note's lyrics). */
  tag?: T;
}

export interface BuiltVoice<T> {
  specs: NoteSpec[];
  /** Tags of the notes that start a sound (not rests or tie continuations), in order. */
  attacks: (T | undefined)[];
  /** Notes cut short because the next one started before they ended. */
  shortened: number;
  /** Notes dropped (no room left, or after the end). */
  dropped: number;
  /** Ties that couldn't be kept (the tied chord changes, or nothing to tie to). */
  brokenTies: number;
}

interface WorkNote<T> extends TimedNote<T> {
  tied: Set<number>;
}

/**
 * Lay timed notes (already quantised, one voice) out over the bars of a layout: rests
 * fill the gaps, simultaneous notes become chords, overlaps are cut, notes are split
 * at bar lines (tied) and every piece is a single duration value.
 */
export function buildVoice<T>(input: TimedNote<T>[], L: Layout): BuiltVoice<T> {
  const total = layoutEnd(L);
  const sorted = input
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.start - b.n.start || a.i - b.i)
    .map(({ n }) => n);
  let shortened = 0;
  let dropped = 0;
  let brokenTies = 0;
  // chords from simultaneous notes
  const notes: WorkNote<T>[] = [];
  for (const n of sorted) {
    const start = Math.max(0, n.start);
    const end = Math.min(total, n.end);
    if (end - start < 1e-6) {
      dropped++;
      continue;
    }
    const prev = notes[notes.length - 1];
    if (prev && Math.abs(prev.start - start) < 1e-6 && (prev.pitches.length > 0) === (n.pitches.length > 0)) {
      if (Math.abs(prev.end - end) > 1e-6) shortened++;
      n.pitches.forEach((p, k) => {
        if (prev.pitches.some(q => midiOf(q) === midiOf(p))) return;
        prev.pitches.push(p);
        if (n.fingers || prev.fingers) (prev.fingers ??= prev.pitches.slice(0, -1).map(() => undefined)).push(n.fingers?.[k]);
        if (n.strings || prev.strings) (prev.strings ??= prev.pitches.slice(0, -1).map(() => undefined)).push(n.strings?.[k]);
        if (n.tieNext) prev.tied.add(midiOf(p));
      });
      prev.tag ??= n.tag;
      continue;
    }
    if (prev && prev.pitches.length === 0 && n.pitches.length > 0 && start < prev.end) prev.end = start; // a rest gives way
    if (prev && start < prev.end - 1e-6) {
      if (n.pitches.length === 0) {
        // an explicit rest under a sounding note: ignore it
        continue;
      }
      prev.end = start;
      shortened++;
      if (prev.end - prev.start < 1e-6) {
        notes.pop();
        dropped++;
      }
    }
    notes.push({ ...n, start, end, pitches: [...n.pitches], fingers: n.fingers && [...n.fingers], strings: n.strings && [...n.strings], tied: new Set(n.tieNext ? n.pitches.map(midiOf) : []) });
  }
  // explicit rests carry nothing: gaps are filled below
  const sounding = notes.filter(n => n.pitches.length > 0);
  // ties: only into the very next note, and only if it holds nothing new
  sounding.forEach((n, i) => {
    const next = sounding[i + 1];
    const ok = !!next && Math.abs(next.start - n.end) < 1e-6 && next.pitches.every(p => n.tied.has(midiOf(p)));
    if (n.tied.size && !ok && next && Math.abs(next.start - n.end) < 1e-6 && next.pitches.some(p => n.tied.has(midiOf(p)))) brokenTies++;
    n.tieNext = ok;
  });
  // sort chord members low → high (fingers/strings follow)
  for (const n of sounding) {
    const order = n.pitches.map((_, k) => k).sort((a, b) => midiOf(n.pitches[a]) - midiOf(n.pitches[b]));
    n.pitches = order.map(k => n.pitches[k]);
    if (n.fingers) n.fingers = order.map(k => n.fingers![k]);
    if (n.strings) n.strings = order.map(k => n.strings![k]);
    if (n.fingers?.every(f => f === undefined)) n.fingers = undefined;
    if (n.strings?.every(s => s === undefined)) n.strings = undefined;
  }
  const kinds = tripletBeats(L, [...sounding.flatMap(n => [n.start, n.end]), ...L.starts]);
  const specs: NoteSpec[] = [];
  const attacks: (T | undefined)[] = [];
  const emit = (a: number, b: number, n: WorkNote<T> | null) => {
    // split at bar lines, then into single values
    const pieces: Dur[] = [];
    let t = a;
    while (b - t > 1e-6) {
      const m = measureAt(L, t);
      const barEnd = Math.min(b, L.starts[m] + L.lens[m]);
      pieces.push(...decompose(t, barEnd, L, kinds));
      t = barEnd;
    }
    pieces.forEach((d, k) => {
      const spec: NoteSpec = { pitches: n ? n.pitches : [], base: d.base, dots: d.dots };
      if (d.triplet) spec.triplet = true;
      if (n && k === 0 && n.fingers) spec.fingers = n.fingers;
      if (n && k === 0 && n.strings) spec.strings = n.strings;
      if (n && (k < pieces.length - 1 || n.tieNext)) spec.tieNext = true;
      specs.push(spec);
    });
  };
  let cursor = 0;
  sounding.forEach((n, i) => {
    if (n.start > cursor + 1e-6) emit(cursor, n.start, null);
    emit(n.start, n.end, n);
    if (!sounding[i - 1]?.tieNext) attacks.push(n.tag);
    cursor = n.end;
  });
  if (total > cursor + 1e-6) emit(cursor, total, null);
  return { specs, attacks, shortened, dropped, brokenTies };
}

// ---------------------------------------------------------------------------
// Chord symbols
// ---------------------------------------------------------------------------

/**
 * The song's "chords" line: each measure lists the chord sounding from its downbeat
 * (carried over from the last change) and every change inside it, with durations.
 * Returns undefined when there are no chords at all.
 */
export function writeChordLine(changes: { tick: number; symbol: string | null }[], L: Layout): string | undefined {
  if (!changes.some(c => c.symbol)) return undefined;
  const sorted = [...changes].sort((a, b) => a.tick - b.tick);
  const kinds = tripletBeats(L, sorted.map(c => c.tick));
  const bars: string[] = [];
  let current: string | null = null;
  let ci = 0;
  for (let m = 0; m < L.starts.length; m++) {
    const start = L.starts[m];
    const end = start + L.lens[m];
    while (ci < sorted.length && sorted[ci].tick <= start + 1e-6) current = sorted[ci++].symbol;
    const points: { tick: number; symbol: string | null }[] = [{ tick: start, symbol: current }];
    while (ci < sorted.length && sorted[ci].tick < end - 1e-6) {
      const c = sorted[ci++];
      if (Math.abs(c.tick - points[points.length - 1].tick) < 1e-6) points[points.length - 1].symbol = c.symbol;
      else points.push(c);
      current = c.symbol;
    }
    const toks: string[] = [];
    points.forEach((p, k) => {
      const to = points[k + 1]?.tick ?? end;
      for (const d of decompose(p.tick, to, L, kinds)) toks.push(`${p.symbol ?? 'r'}/${durString(d)}`);
    });
    bars.push(toks.join(' '));
  }
  return `${bars.join(' | ')} |`;
}

// ---------------------------------------------------------------------------
// Pitch spelling
// ---------------------------------------------------------------------------

const FIFTHS_POS: Record<Step, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/**
 * Spell a MIDI note in a key: notes of the key as its signature writes them, other
 * notes by their nearness to the key on the line of fifths (C major: C# Eb F# Ab Bb;
 * A minor: C# Eb F# G# Bb). Never uses double sharps or flats.
 */
export function spellInKey(midi: number, key: KeySig): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const alt = keyAlterations(key.fifths);
  const center = key.fifths + (key.mode === 'minor' ? 2.5 : 1.5);
  let best: { step: Step; alter: number; cost: number } | null = null;
  for (const step of STEPS) {
    const d = (((pc - STEP_SEMIS[step]) % 12) + 12) % 12;
    const alter = d > 6 ? d - 12 : d;
    if (Math.abs(alter) > 1) continue;
    let cost: number;
    if (alt[step] === alter) cost = -1;
    else {
      cost = Math.abs(FIFTHS_POS[step] + 7 * alter - center);
      // B#, E#, Cb and Fb only when the key itself uses them
      if ((alter === 1 && (step === 'B' || step === 'E')) || (alter === -1 && (step === 'C' || step === 'F'))) cost += 4;
    }
    if (!best || cost < best.cost) best = { step, alter, cost };
  }
  const { step, alter } = best!;
  return { step, alter, octave: Math.floor((midi - STEP_SEMIS[step] - alter) / 12) - 1 };
}

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

/**
 * Guess the app instrument from part / track names and a General MIDI program
 * (1-based). Returns null when nothing points anywhere.
 */
export function guessInstrument(names: string[], program?: number): InstrumentId | null {
  const text = names.join(' ').toLowerCase();
  if (/ukulele|\buke\b/.test(text)) return 'ukulele';
  if (/marimba|xylo|glock|vibraphone|\bvibes?\b|vibraharp|mallet|orchestra bells|\bbells\b/.test(text)) return 'mallets';
  if (/bass ?guitar|electric bass|e-?bass|fretless|acoustic bass|double ?bass|contrabass|upright bass|string bass|bajo|basse électrique|\bbass gtr\b/.test(text)) return 'bass';
  if (/guit|gtr|gitarr|chitarra|guitare/.test(text)) return 'guitar';
  if (/piano|klavier|keyboard|\bkeys\b|pianoforte|clavier|harpsichord|cembalo|organ|orgel|rhodes|celest|accordion/.test(text)) return 'piano';
  if (program !== undefined) {
    if (program >= 1 && program <= 8) return 'piano';
    if ([10, 12, 13, 14].includes(program)) return 'mallets';
    if (program >= 17 && program <= 24) return 'piano';
    if (program >= 25 && program <= 32) return 'guitar';
    if ((program >= 33 && program <= 40) || program === 44) return 'bass';
  }
  // "Bass" alone is a bass guitar in a band score but a singer in a choir
  if (/^\s*bass\s*\d*\s*$/.test(text) && program === undefined) return 'bass';
  return null;
}

export function median(xs: number[]): number {
  if (!xs.length) return 60;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Quarter-note BPM rounded and kept inside what the song format accepts. */
export function cleanTempo(bpm: number | undefined, fallback: number): number {
  const t = bpm && Number.isFinite(bpm) && bpm > 0 ? bpm : fallback;
  return Math.max(20, Math.min(400, Math.round(t * 100) / 100));
}
