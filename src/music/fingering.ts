/**
 * Piano fingering.
 *
 * 1. Standard scale fingerings (the ones every teacher uses) for major and minor scales.
 * 2. A dynamic-programming fingering engine for arbitrary melodies, based on a
 *    simplified version of Parncutt et al.'s (1997) ergonomic cost model. It respects
 *    any fingers already written in the music and fills in the rest.
 */
import type { Hand } from './score';
import { type Step, isBlackKey } from './pitch';
import type { ScaleKind } from './keys';

// ---------------------------------------------------------------------------
// Scale fingerings
// ---------------------------------------------------------------------------

interface ScaleFingering {
  /** Fingers for scale degrees 1..7 in the middle of a multi-octave scale. */
  mid: number[];
  /** Finger on the very first tonic (defaults to mid[0]). */
  start?: number;
  /** Finger on the very last (top) tonic. */
  end: number;
}

type HandFingerings = { R: ScaleFingering; L: ScaleFingering };

const C_TYPE: HandFingerings = {
  R: { mid: [1, 2, 3, 1, 2, 3, 4], end: 5 },
  L: { mid: [1, 4, 3, 2, 1, 3, 2], start: 5, end: 1 },
};
const F_TYPE: HandFingerings = {
  R: { mid: [1, 2, 3, 4, 1, 2, 3], end: 4 },
  L: { mid: [1, 4, 3, 2, 1, 3, 2], start: 5, end: 1 },
};
const B_TYPE: HandFingerings = {
  R: { mid: [1, 2, 3, 1, 2, 3, 4], end: 5 },
  L: { mid: [1, 3, 2, 1, 4, 3, 2], start: 4, end: 1 },
};

/** Keyed by tonic e.g. "C", "F#", "Bb" */
const MAJOR_FINGERINGS: Record<string, HandFingerings> = {
  C: C_TYPE, G: C_TYPE, D: C_TYPE, A: C_TYPE, E: C_TYPE,
  B: B_TYPE, Cb: B_TYPE,
  F: F_TYPE,
  'F#': { R: { mid: [2, 3, 4, 1, 2, 3, 1], end: 2 }, L: { mid: [4, 3, 2, 1, 3, 2, 1], start: 4, end: 4 } },
  Gb: { R: { mid: [2, 3, 4, 1, 2, 3, 1], end: 2 }, L: { mid: [4, 3, 2, 1, 3, 2, 1], start: 4, end: 4 } },
  Db: { R: { mid: [2, 3, 1, 2, 3, 4, 1], end: 2 }, L: { mid: [3, 2, 1, 4, 3, 2, 1], start: 3, end: 3 } },
  'C#': { R: { mid: [2, 3, 1, 2, 3, 4, 1], end: 2 }, L: { mid: [3, 2, 1, 4, 3, 2, 1], start: 3, end: 3 } },
  Ab: { R: { mid: [3, 4, 1, 2, 3, 1, 2], end: 3 }, L: { mid: [3, 2, 1, 4, 3, 2, 1], start: 3, end: 3 } },
  Eb: { R: { mid: [3, 1, 2, 3, 4, 1, 2], end: 3 }, L: { mid: [3, 2, 1, 4, 3, 2, 1], start: 3, end: 3 } },
  Bb: { R: { mid: [4, 1, 2, 3, 1, 2, 3], end: 4 }, L: { mid: [3, 2, 1, 4, 3, 2, 1], start: 3, end: 3 } },
};

const MINOR_FINGERINGS: Record<string, HandFingerings> = {
  A: C_TYPE, E: C_TYPE, D: C_TYPE, G: C_TYPE, C: C_TYPE,
  B: B_TYPE,
  F: F_TYPE,
  'F#': { R: { mid: [3, 4, 1, 2, 3, 1, 2], end: 3 }, L: { mid: [4, 3, 2, 1, 3, 2, 1], start: 4, end: 4 } },
  'C#': { R: { mid: [3, 4, 1, 2, 3, 1, 2], end: 3 }, L: { mid: [3, 2, 1, 4, 3, 2, 1], start: 3, end: 3 } },
  'G#': { R: { mid: [3, 4, 1, 2, 3, 1, 2], end: 3 }, L: { mid: [3, 2, 1, 3, 2, 1, 4], start: 3, end: 3 } },
  Bb: { R: { mid: [4, 1, 2, 3, 1, 2, 3], end: 4 }, L: { mid: [2, 1, 3, 2, 1, 4, 3], start: 2, end: 2 } },
  Eb: { R: { mid: [3, 1, 2, 3, 4, 1, 2], end: 3 }, L: { mid: [2, 1, 4, 3, 2, 1, 3], start: 2, end: 2 } },
};

export function tonicKey(step: Step, alter: number): string {
  return step + (alter === 1 ? '#' : alter === -1 ? 'b' : '');
}

/**
 * Fingers for an ascending scale of `octaves` octaves (8*octaves - (octaves-1) notes).
 * Returns undefined when no standard fingering is known.
 */
export function scaleFingering(tonic: string, kind: ScaleKind, hand: Hand, octaves = 1): number[] | undefined {
  const table = kind === 'major' ? MAJOR_FINGERINGS : MINOR_FINGERINGS;
  const f = table[tonic]?.[hand];
  if (!f) return undefined;
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) out.push(...f.mid);
  out[0] = f.start ?? f.mid[0];
  out.push(f.end);
  return out;
}

/** Ascending-then-descending fingering for a scale (top note played once). */
export function scaleFingeringUpDown(tonic: string, kind: ScaleKind, hand: Hand, octaves = 1): number[] | undefined {
  const up = scaleFingering(tonic, kind, hand, octaves);
  if (!up) return undefined;
  return [...up, ...up.slice(0, -1).reverse()];
}

// ---------------------------------------------------------------------------
// Melody fingering (dynamic programming)
// ---------------------------------------------------------------------------

/** Parncutt span table for the right hand: [MinPrac, MinComf, MinRel, MaxRel, MaxComf, MaxPrac] in semitones. */
const SPANS: Record<string, [number, number, number, number, number, number]> = {
  '1-2': [-5, -3, 1, 5, 8, 10],
  '1-3': [-4, -2, 3, 7, 10, 12],
  '1-4': [-3, -1, 5, 9, 12, 14],
  '1-5': [-1, 1, 7, 10, 13, 15],
  '2-3': [1, 1, 1, 2, 3, 5],
  '2-4': [1, 1, 3, 4, 5, 7],
  '2-5': [2, 2, 5, 6, 8, 10],
  '3-4': [1, 1, 1, 2, 2, 4],
  '3-5': [1, 1, 3, 4, 5, 7],
  '4-5': [1, 1, 1, 2, 3, 5],
};

/**
 * Cost of moving from finger f1 on note n1 to finger f2 on note n2 (right-hand frame;
 * left hand is handled by mirroring the interval).
 */
function transitionCost(f1: number, n1: number, f2: number, n2: number, hand: Hand): number {
  let d = n2 - n1;
  if (hand === 'L') d = -d;
  if (f1 === f2) {
    if (d === 0) return 0; // repeated note, same finger: natural
    // same finger on a different key → hand must move
    return 4 + Math.abs(d) * 0.5;
  }
  let lo = f1;
  let hi = f2;
  let span = d;
  if (f1 > f2) {
    lo = f2;
    hi = f1;
    span = -d;
  }
  const t = SPANS[`${lo}-${hi}`];
  const [minPrac, minComf, minRel, maxRel, maxComf, maxPrac] = t;
  let cost = 0;
  if (span < minComf) cost += 2 * (minComf - span);
  if (span > maxComf) cost += 2 * (span - maxComf);
  if (span < minRel) cost += (lo === 1 ? 2 : 1) * (minRel - span);
  if (span > maxRel) cost += (lo === 1 ? 1 : 2) * (span - maxRel);
  if (span < minPrac || span > maxPrac) cost += 12;
  if (d === 0) cost += 1; // changing fingers on a repeated note is fine but not free
  // weak fingers
  if (f2 === 4) cost += 0.5;
  if (f2 === 5) cost += 0.3;
  // 3-4 consecutive is awkward
  if ((f1 === 3 && f2 === 4) || (f1 === 4 && f2 === 3)) cost += 0.6;
  // thumb on black keys
  const b1 = isBlackKey(n1);
  const b2 = isBlackKey(n2);
  if (f2 === 1 && b2) cost += 1.5;
  if (f2 === 5 && b2) cost += 0.6;
  // thumb passing (thumb-under or finger-over) involving a black key
  const crossing = span < 0 && lo === 1;
  if (crossing) {
    cost += 0.6;
    if (b1 !== b2 && ((f2 === 1 && b2) || (f1 === 1 && b1))) cost += 2;
  }
  return cost;
}

export interface FingerEvent {
  /** MIDI notes sounding together (single note for melodies). */
  midis: number[];
  /** Pre-assigned fingers to respect (aligned with midis). */
  fixed?: (number | undefined)[];
}

/** Standard chord fingering for up to 5 notes (ascending midis). */
function chordFingers(midis: number[], hand: Hand): number[] {
  const n = midis.length;
  if (n === 1) return [1];
  const span = midis[n - 1] - midis[0];
  if (hand === 'R') {
    if (n === 2) return span <= 2 ? [1, 2] : span <= 4 ? [1, 3] : span <= 7 ? [1, 4] : [1, 5];
    if (n === 3) {
      const top = midis[2] - midis[1];
      if (span <= 5) return [1, 2, 3];
      return top >= 5 ? [1, 2, 5] : [1, 3, 5];
    }
    if (n === 4) return span <= 9 ? [1, 2, 3, 5] : [1, 2, 4, 5];
    return [1, 2, 3, 4, 5].slice(0, n);
  }
  if (n === 2) return span <= 2 ? [2, 1] : span <= 4 ? [3, 1] : span <= 7 ? [4, 1] : [5, 1];
  if (n === 3) {
    const bottom = midis[1] - midis[0];
    if (span <= 5) return [3, 2, 1];
    return bottom >= 5 ? [5, 2, 1] : [5, 3, 1];
  }
  if (n === 4) return span <= 9 ? [5, 3, 2, 1] : [5, 4, 2, 1];
  return [5, 4, 3, 2, 1].slice(0, n);
}

/**
 * Compute fingers for a sequence of events played by one hand.
 * Returns one array of fingers per event (aligned with event.midis ascending).
 */
export function fingerPianoLine(events: FingerEvent[], hand: Hand): number[][] {
  const n = events.length;
  if (!n) return [];
  // For chords we fix the whole shape from the chord template unless provided;
  // the DP state is the finger on the "anchor" note (top for RH, bottom for LH)
  const anchorIdx = (ev: FingerEvent) => (hand === 'R' ? ev.midis.length - 1 : 0);
  const fingersFor = (ev: FingerEvent): number[][] => {
    if (ev.midis.length === 1) {
      const fx = ev.fixed?.[0];
      return fx ? [[fx]] : [[1], [2], [3], [4], [5]];
    }
    const tmpl = chordFingers(ev.midis, hand);
    if (ev.fixed?.some(f => f !== undefined)) {
      return [ev.midis.map((_, i) => ev.fixed![i] ?? tmpl[i])];
    }
    return [tmpl];
  };
  const options = events.map(fingersFor);
  const cost: number[][] = [];
  const back: number[][] = [];
  cost[0] = options[0].map(o => (o.length === 1 && o[0] === 1 && isBlackKey(events[0].midis[0]) ? 1.5 : 0));
  back[0] = options[0].map(() => -1);
  for (let i = 1; i < n; i++) {
    const prev = events[i - 1];
    const cur = events[i];
    cost[i] = [];
    back[i] = [];
    options[i].forEach((ob, j) => {
      let best = Infinity;
      let arg = 0;
      options[i - 1].forEach((oa, k) => {
        const fa = oa[anchorIdx(prev)];
        const fb = ob[anchorIdx(cur)];
        const c = cost[i - 1][k] + transitionCost(fa, prev.midis[anchorIdx(prev)], fb, cur.midis[anchorIdx(cur)], hand);
        if (c < best) {
          best = c;
          arg = k;
        }
      });
      cost[i][j] = best;
      back[i][j] = arg;
    });
  }
  let j = cost[n - 1].indexOf(Math.min(...cost[n - 1]));
  const out: number[][] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    out[i] = options[i][j];
    j = back[i][j];
  }
  return out;
}

/**
 * Fingers for a five-finger position: the hand rests on 5 adjacent white keys
 * starting at `thumbMidi` (RH) or ending at `thumbMidi` (LH).
 */
export function fiveFingerFinger(positionNotes: number[], midi: number, hand: Hand): number | undefined {
  const idx = positionNotes.indexOf(midi);
  if (idx < 0) return undefined;
  return hand === 'R' ? idx + 1 : 5 - idx;
}
