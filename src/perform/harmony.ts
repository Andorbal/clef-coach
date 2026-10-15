/**
 * The harmony a band plays over: the song's chord symbols, or — for songs written
 * without them — chords worked out from the notes.
 *
 * Inference is a small dynamic programme over half-bars (whole bars in triple and
 * compound meters): each segment scores every major, minor, dominant-seventh and
 * diminished chord by how much of the sounding music (weighted by length, metric
 * position and the bass) are chord tones, plus a prior for chords that belong to the
 * key; changing chord costs a little, more so in the middle of a bar. That is enough
 * for folk tunes, hymns and the classics in the library to come out as a sensible
 * I–IV–V harmony.
 */
import { chordPcs, parseChordSymbol, rootPc } from '../music/chords';
import { type KeySig, tonicOf } from '../music/keys';
import { midiOf, STEP_SEMIS } from '../music/pitch';
import { beatTicks, measureTicks } from '../music/rhythm';
import type { SongDef } from '../music/parse';
import { type Score, keyAt, measureLengths, measureStartTick, timeAt } from '../music/score';
import { parseChordTimeline } from '../songs/format';

export interface ChordSpan {
  tick: number;
  ticks: number;
  /** Pitch class of the root; −1 for "no chord" (N.C.). */
  root: number;
  /** Pitch classes, root first. */
  pcs: number[];
  /** Pitch class the bass plays (a slash chord's bass, else the root). */
  bass: number;
  /** Interval of the fifth above the root the chord has (7, 6 for diminished, 8 for augmented). */
  fifth: number;
  symbol: string | null;
}

const NO_CHORD = (tick: number, ticks: number): ChordSpan => ({ tick, ticks, root: -1, pcs: [], bass: -1, fifth: 7, symbol: null });

/** A chord span from a symbol ("G7", "C/E"); null when the symbol can't be read. */
export function spanFromSymbol(symbol: string, tick: number, ticks: number): ChordSpan | null {
  try {
    const c = parseChordSymbol(symbol);
    const root = rootPc(c.root);
    const pcs = chordPcs(c);
    const fifthTone = c.quality.tones.find(([, deg]) => deg === 5);
    return { tick, ticks, root, pcs, bass: c.bass ? rootPc(c.bass) : root, fifth: fifthTone ? fifthTone[0] : 7, symbol };
  } catch {
    return null;
  }
}

/** The song's own chord line as spans (null when it has none). */
export function chordSpansFromLine(song: Pick<SongDef, 'chords'>, score: Score): ChordSpan[] | null {
  if (!song.chords) return null;
  let events;
  try {
    events = parseChordTimeline(song.chords, score).events;
  } catch {
    return null;
  }
  const out: ChordSpan[] = [];
  for (const e of events) {
    const span = e.symbol ? spanFromSymbol(e.symbol, e.tick, e.ticks) : NO_CHORD(e.tick, e.ticks);
    if (span) out.push(span);
  }
  return out.length ? mergeSpans(out) : null;
}

/** Join neighbouring spans of the same chord. */
export function mergeSpans(spans: ChordSpan[]): ChordSpan[] {
  const out: ChordSpan[] = [];
  for (const s of [...spans].sort((a, b) => a.tick - b.tick)) {
    const last = out[out.length - 1];
    if (last && last.symbol === s.symbol && last.tick + last.ticks === s.tick) last.ticks += s.ticks;
    else out.push({ ...s, pcs: [...s.pcs] });
  }
  return out;
}

/** The chord sounding at a tick (or null). */
export function chordAt(spans: readonly ChordSpan[], tick: number): ChordSpan | null {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = spans[mid];
    if (tick < s.tick) hi = mid - 1;
    else if (tick >= s.tick + s.ticks) lo = mid + 1;
    else return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

interface Candidate {
  root: number;
  kind: 'maj' | 'min' | '7' | 'dim';
  pcs: number[];
}

const KIND_INTERVALS: Record<Candidate['kind'], number[]> = { maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], dim: [0, 3, 6] };
const SUFFIX: Record<Candidate['kind'], string> = { maj: '', min: 'm', '7': '7', dim: 'dim' };
const NAMES_SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const CANDIDATES: Candidate[] = [];
for (let r = 0; r < 12; r++) {
  for (const kind of ['maj', 'min', '7', 'dim'] as const) CANDIDATES.push({ root: r, kind, pcs: KIND_INTERVALS[kind].map(i => (r + i) % 12) });
}

/**
 * How likely a chord is in a key, as a score bonus: the primary triads first, then the
 * other diatonic chords, secondary dominants and borrowed chords a little, anything
 * else hardly at all.
 */
function prior(c: Candidate, key: KeySig): number {
  const t = tonicOf(key);
  const tonic = (((STEP_SEMIS[t.step] + t.alter) % 12) + 12) % 12;
  const deg = (c.root - tonic + 12) % 12;
  const table: Record<string, number> =
    key.mode === 'major'
      ? { '0maj': 1, '5maj': 0.8, '7maj': 0.8, '77': 0.75, '9min': 0.5, '2min': 0.45, '4min': 0.25, '11dim': 0.1, '27': 0.25, '97': 0.2, '47': 0.15, '07': 0.1, '10maj': 0.1, '5min': 0.1, '2maj': 0.1 }
      : { '0min': 1, '5min': 0.75, '7maj': 0.6, '77': 0.75, '8maj': 0.5, '3maj': 0.45, '10maj': 0.4, '2dim': 0.2, '7min': 0.2, '5maj': 0.1, '07': 0.1, '11dim': 0.15 };
  return table[`${deg}${c.kind}`] ?? -0.4;
}

interface Weighted {
  pc: number;
  w: number;
  bass: boolean;
}

/**
 * Chords for music that has no chord symbols: one per half-bar at most (a bar in
 * triple and compound meters), changing only where the music says so. `extra` are
 * other parts (band parts) that sound with the music and help decide.
 */
export function inferChords(score: Score, extra: Score[] = []): ChordSpan[] {
  const lens = measureLengths(score.time, score.measures, score.pickup, score.changes);
  // segments: half-bars in duple meters, whole bars otherwise
  const segs: { start: number; end: number; measure: number; strong: boolean }[] = [];
  let at = 0;
  lens.forEach((len, m) => {
    const time = timeAt(score, m);
    const full = measureTicks(time);
    const beats = Math.round(full / beatTicks(time));
    const halves = beats % 2 === 0 && len === full && beats >= 2;
    if (halves) {
      segs.push({ start: at, end: at + len / 2, measure: m, strong: true });
      segs.push({ start: at + len / 2, end: at + len, measure: m, strong: false });
    } else segs.push({ start: at, end: at + len, measure: m, strong: true });
    at += len;
  });
  if (!segs.length) return [];
  // what sounds in each segment
  const sounding: Weighted[][] = segs.map(() => []);
  const addScore = (sc: Score, weight: number) => {
    for (const st of sc.staves)
      for (const v of st.voices)
        for (const n of v.notes) {
          if (n.rest || !n.pitches.length) continue;
          const lowest = Math.min(...n.pitches.map(midiOf));
          const start = n.tick;
          const end = n.tick + n.ticks;
          for (let s = segIndex(segs, start); s < segs.length && segs[s].start < end; s++) {
            const sg = segs[s];
            const overlap = Math.min(end, sg.end) - Math.max(start, sg.start);
            if (overlap <= 0) continue;
            const onBeat = start >= sg.start && (start - sg.start) % beatTicks(timeAt(score, sg.measure)) === 0;
            const metric = start === sg.start ? 1.6 : onBeat ? 1.2 : 0.75;
            const w = (overlap / (sg.end - sg.start)) * metric * weight * (n.tiePrev ? 0.6 : 1);
            for (const p of n.pitches) {
              const m = midiOf(p);
              sounding[s].push({ pc: ((m % 12) + 12) % 12, w, bass: m === lowest && m < 57 });
            }
          }
        }
  };
  addScore(score, 1);
  for (const sc of extra) addScore(sc, 0.8);

  // fit of every candidate in every segment
  const fit = segs.map((sg, s) => {
    const key = keyAt(score, sg.measure);
    const scale = keyScale(key);
    const notes = sounding[s];
    const heard = new Set(notes.map(n => n.pc));
    const total = notes.reduce((a, n) => a + n.w, 0);
    return CANDIDATES.map(c => {
      let f = 0;
      for (const n of notes) {
        const inChord = c.pcs.includes(n.pc);
        // the bass says most about the root; a tune's notes only whether they belong
        if (inChord) f += n.w * (n.bass ? (n.pc === c.root ? 2 : 1.1) : n.pc === c.root ? 1.05 : 1);
        else f -= n.w * (n.bass ? 1.2 : 0.7);
      }
      let norm = total > 0 ? f / total : 0;
      // a seventh chord must earn its seventh, and a chord with a note outside the key
      // (E7's G♯ in C major) is only there when that note is
      if (c.kind === '7' && !heard.has(c.pcs[3])) norm -= 0.3;
      if (c.pcs.some(pc => !scale.has(pc) && !heard.has(pc))) norm -= 0.8;
      return norm + prior(c, key) * (total > 0 ? 0.55 : 1.2);
    });
  });

  // dynamic programme: best chord sequence with a cost for changing
  const n = segs.length;
  const K = CANDIDATES.length;
  const score2 = new Float64Array(n * K);
  const back = new Int32Array(n * K);
  for (let k = 0; k < K; k++) score2[k] = fit[0][k] + (CANDIDATES[k].root === tonicPc(keyAt(score, segs[0].measure)) ? 0.3 : 0);
  for (let s = 1; s < n; s++) {
    const change = segs[s].strong ? 0.28 : 0.55;
    let bestPrev = 0;
    for (let k = 1; k < K; k++) if (score2[(s - 1) * K + k] > score2[(s - 1) * K + bestPrev]) bestPrev = k;
    for (let k = 0; k < K; k++) {
      const stay = score2[(s - 1) * K + k];
      const move = score2[(s - 1) * K + bestPrev] - change;
      const from = stay >= move ? k : bestPrev;
      score2[s * K + k] = Math.max(stay, move) + fit[s][k];
      back[s * K + k] = from;
    }
  }
  // end on the tonic when the music allows
  const lastKey = keyAt(score, segs[n - 1].measure);
  let best = 0;
  for (let k = 0; k < K; k++) {
    const bonus = (c: Candidate) => (c.root === tonicPc(lastKey) && c.kind === (lastKey.mode === 'minor' ? 'min' : 'maj') ? 0.35 : 0);
    if (score2[(n - 1) * K + k] + bonus(CANDIDATES[k]) > score2[(n - 1) * K + best] + bonus(CANDIDATES[best])) best = k;
  }
  const picks = new Array<number>(n);
  picks[n - 1] = best;
  for (let s = n - 1; s > 0; s--) picks[s - 1] = back[s * K + picks[s]];

  const spans: ChordSpan[] = [];
  segs.forEach((sg, s) => {
    const c = CANDIDATES[picks[s]];
    const flats = keyAt(score, sg.measure).fifths < 0;
    const symbol = (flats ? NAMES_FLAT : NAMES_SHARP)[c.root] + SUFFIX[c.kind];
    const span = spanFromSymbol(symbol, sg.start, sg.end - sg.start);
    if (span) spans.push(span);
  });
  return mergeSpans(spans);
}

/** Pitch classes that belong to a key (minor: natural, harmonic and melodic). */
function keyScale(key: KeySig): Set<number> {
  const t = tonicPc(key);
  const steps = key.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 9, 10, 11] : [0, 2, 4, 5, 7, 9, 11];
  return new Set(steps.map(x => (t + x) % 12));
}

function tonicPc(key: KeySig): number {
  const t = tonicOf(key);
  return (((STEP_SEMIS[t.step] + t.alter) % 12) + 12) % 12;
}

function segIndex(segs: { start: number; end: number }[], tick: number): number {
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].start <= tick) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The song's chords: its chord line when it has one, else inferred from the music (and its band parts). */
export function songChordSpans(song: Pick<SongDef, 'chords'>, score: Score, extra: Score[] = []): { spans: ChordSpan[]; inferred: boolean } {
  const own = chordSpansFromLine(song, score);
  if (own?.some(s => s.root >= 0)) return { spans: own, inferred: false };
  return { spans: inferChords(score, extra), inferred: true };
}

/** First tick of each measure (for patterns). */
export function measureStarts(score: Score): number[] {
  return Array.from({ length: score.measures + 1 }, (_, m) => measureStartTick(score, m));
}
