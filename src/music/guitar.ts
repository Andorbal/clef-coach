/**
 * Guitar fretboard model: standard tuning, note locations, position fingering
 * and the common fretboard patterns (CAGED chords, pentatonic boxes, scale shapes).
 * Strings are numbered like guitarists do: 1 = high E ... 6 = low E.
 */
import { type Step, pitchClass, spellMidi, STEP_SEMIS } from './pitch';

/** Open-string MIDI notes, index 0 = string 1 (high E4) ... index 5 = string 6 (low E2). */
export const STANDARD_TUNING = [64, 59, 55, 50, 45, 40] as const;
export const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'] as const;
export const MAX_FRET = 22;
export const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

export interface FretPos {
  string: number; // 1..6
  fret: number; // 0..22
}

export interface FingeredPos extends FretPos {
  /** Left-hand finger: 0 = open string, 1 = index ... 4 = pinky */
  finger: number;
}

export function openMidi(string: number): number {
  return STANDARD_TUNING[string - 1];
}

export function midiAt(string: number, fret: number): number {
  return openMidi(string) + fret;
}

/** All places a MIDI note can be played, from low strings to high. */
export function positionsFor(midi: number, maxFret = 15, minFret = 0): FretPos[] {
  const out: FretPos[] = [];
  for (let s = 6; s >= 1; s--) {
    const fret = midi - openMidi(s);
    if (fret >= minFret && fret <= maxFret) out.push({ string: s, fret });
  }
  return out;
}

/** Every location of a pitch class within a fret window (e.g. "all the A's"). */
export function allLocationsOfPitchClass(pc: number, minFret = 0, maxFret = 12, strings = [1, 2, 3, 4, 5, 6]): FretPos[] {
  const out: FretPos[] = [];
  for (const s of strings) {
    for (let f = minFret; f <= maxFret; f++) {
      if (pitchClass(midiAt(s, f)) === pc) out.push({ string: s, fret: f });
    }
  }
  return out;
}

export function stepPitchClass(step: Step, alter = 0): number {
  return (STEP_SEMIS[step] + alter + 12) % 12;
}

/** Name of the note at a fret, spelled with sharps unless flats requested. */
export function noteNameAt(string: number, fret: number, preferFlats = false) {
  return spellMidi(midiAt(string, fret), preferFlats ? -1 : 1);
}

/** Lowest and highest MIDI pitches playable in standard tuning up to maxFret. */
export function guitarRange(maxFret = 19): [number, number] {
  return [STANDARD_TUNING[5], STANDARD_TUNING[0] + maxFret];
}

/**
 * Finger a melody (sequence of single notes or chords) on the guitar.
 * Uses dynamic programming to minimise hand shifts and stay near `preferPosition`.
 * Any fixed string assignments (from authored notation) are respected.
 */
export function fingerGuitarLine(
  events: { midis: number[]; strings?: (number | undefined)[] }[],
  opts: { preferPosition?: number; maxFret?: number; allowOpen?: boolean } = {},
): FingeredPos[][] {
  const maxFret = opts.maxFret ?? 15;
  const prefer = opts.preferPosition ?? 1;
  const allowOpen = opts.allowOpen ?? true;

  // Candidate voicings per event
  const candidates: FretPos[][][] = events.map(ev => {
    const perNote = ev.midis.map((m, i) => {
      const fixed = ev.strings?.[i];
      if (fixed) return [{ string: fixed, fret: m - openMidi(fixed) }];
      let c = positionsFor(m, maxFret);
      if (!allowOpen) c = c.filter(p => p.fret > 0 || positionsFor(m, maxFret).length === 1);
      return c.length ? c : [{ string: 6, fret: Math.max(0, m - openMidi(6)) }];
    });
    // cartesian product with distinct strings, limited
    let combos: FretPos[][] = [[]];
    for (const opts2 of perNote) {
      const next: FretPos[][] = [];
      for (const combo of combos) {
        for (const o of opts2) {
          if (combo.some(c => c.string === o.string)) continue;
          next.push([...combo, o]);
        }
      }
      combos = next.slice(0, 200);
    }
    return combos.length ? combos : [perNote.map(o => o[0])];
  });

  const handOf = (combo: FretPos[]) => {
    const fretted = combo.filter(c => c.fret > 0).map(c => c.fret);
    if (!fretted.length) return null;
    return { lo: Math.min(...fretted), hi: Math.max(...fretted) };
  };

  const localCost = (combo: FretPos[]) => {
    const h = handOf(combo);
    let cost = 0;
    if (h) {
      const span = h.hi - h.lo;
      if (span > 3) cost += (span - 3) * 4;
      // preference for the requested position
      const posLo = Math.max(1, prefer - 1);
      const posHi = prefer + 3;
      if (h.lo < posLo) cost += (posLo - h.lo) * 1.2;
      if (h.hi > posHi) cost += (h.hi - posHi) * 1.2;
      cost += h.lo * 0.03;
    } else if (prefer > 4) {
      cost += 0.6; // open strings are less idiomatic up the neck
    }
    return cost;
  };

  const transCost = (a: FretPos[], b: FretPos[]) => {
    const ha = handOf(a);
    const hb = handOf(b);
    if (!ha || !hb) return 0;
    const lo = Math.min(ha.lo, hb.lo);
    const hi = Math.max(ha.hi, hb.hi);
    const shift = hi - lo > 3 ? Math.min(Math.abs(hb.lo - ha.lo), Math.abs(hb.hi - ha.hi)) : 0;
    return shift * 1.5;
  };

  // Viterbi
  const n = events.length;
  if (!n) return [];
  const cost: number[][] = [];
  const back: number[][] = [];
  cost[0] = candidates[0].map(localCost);
  back[0] = candidates[0].map(() => -1);
  for (let i = 1; i < n; i++) {
    cost[i] = [];
    back[i] = [];
    candidates[i].forEach((cb, j) => {
      let best = Infinity;
      let arg = 0;
      candidates[i - 1].forEach((ca, k) => {
        const c = cost[i - 1][k] + transCost(ca, cb);
        if (c < best) {
          best = c;
          arg = k;
        }
      });
      cost[i][j] = best + localCost(cb);
      back[i][j] = arg;
    });
  }
  let j = cost[n - 1].indexOf(Math.min(...cost[n - 1]));
  const chosen: FretPos[][] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    chosen[i] = candidates[i][j];
    j = back[i][j];
  }

  // Assign fingers using a running hand position (index-finger fret).
  let handPos = Math.max(1, prefer);
  return chosen.map(combo => {
    const h = handOf(combo);
    if (h) {
      if (h.lo < handPos || h.hi > handPos + 3) {
        // shift: keep index finger at the lowest fretted note when possible
        handPos = h.hi - h.lo <= 3 ? (h.hi > handPos + 3 ? Math.max(h.lo, h.hi - 3) : h.lo) : h.lo;
      }
    }
    return combo.map(c => ({
      ...c,
      finger: c.fret === 0 ? 0 : Math.min(4, Math.max(1, c.fret - handPos + 1)),
    }));
  });
}

// ---------------------------------------------------------------------------
// Fretboard patterns
// ---------------------------------------------------------------------------

export type ShapeName = 'C' | 'A' | 'G' | 'E' | 'D';

/** CAGED chord shapes as fret offsets from the root fret on the root string (null = muted). */
const CAGED_MAJOR: Record<ShapeName, { rootString: number; frets: (number | null)[] }> = {
  // frets listed for strings 6,5,4,3,2,1
  E: { rootString: 6, frets: [0, 2, 2, 1, 0, 0] },
  A: { rootString: 5, frets: [null, 0, 2, 2, 2, 0] },
  C: { rootString: 5, frets: [null, 0, -1, -3, -2, -3] },
  G: { rootString: 6, frets: [0, -1, -3, -3, -3, 0] },
  D: { rootString: 4, frets: [null, null, 0, 2, 3, 2] },
};

const CAGED_MINOR: Record<ShapeName, { rootString: number; frets: (number | null)[] }> = {
  E: { rootString: 6, frets: [0, 2, 2, 0, 0, 0] },
  A: { rootString: 5, frets: [null, 0, 2, 2, 1, 0] },
  C: { rootString: 5, frets: [null, 0, -2, -3, -2, null] },
  G: { rootString: 6, frets: [0, -2, -3, -3, null, 0] },
  D: { rootString: 4, frets: [null, null, 0, 2, 3, 1] },
};

export interface ChordShape {
  name: string;
  shape: ShapeName;
  quality: 'major' | 'minor';
  /** One entry per string 6..1 (index 0 = string 6). null = not played. */
  frets: (number | null)[];
  rootFret: number;
  rootString: number;
}

/** Build a CAGED chord shape for a root pitch class, choosing the lowest playable root fret ≥ minFret. */
export function cagedChord(rootPc: number, shape: ShapeName, quality: 'major' | 'minor' = 'major', minFret = 0): ChordShape {
  const def = (quality === 'major' ? CAGED_MAJOR : CAGED_MINOR)[shape];
  const open = openMidi(def.rootString);
  let rootFret = ((rootPc - open) % 12 + 12) % 12;
  const minOffset = Math.min(...def.frets.filter((f): f is number => f !== null));
  while (rootFret + minOffset < minFret) rootFret += 12;
  const frets = def.frets.map(f => (f === null ? null : rootFret + f));
  const name = spellMidi(open + rootFret, 0);
  return {
    name: `${name.step}${name.alter === 1 ? '♯' : name.alter === -1 ? '♭' : ''}${quality === 'minor' ? 'm' : ''}`,
    shape,
    quality,
    frets,
    rootFret,
    rootString: def.rootString,
  };
}

export function chordShapePositions(c: ChordShape): FretPos[] {
  const out: FretPos[] = [];
  c.frets.forEach((f, i) => {
    if (f !== null) out.push({ string: 6 - i, fret: f });
  });
  return out;
}

/**
 * Scale "boxes": walk up the strings from string 6 taking `perString` consecutive
 * scale notes per string, starting at the given scale degree on string 6.
 * perString = 2 gives the five pentatonic boxes, 3 gives 3-notes-per-string major/minor shapes.
 */
export function scaleBox(
  scalePcs: number[],
  startDegree: number,
  perString: number,
  minStartFret = 0,
): FretPos[] {
  // find start fret on string 6 for the starting degree
  const pc0 = scalePcs[startDegree % scalePcs.length];
  let fret = ((pc0 - openMidi(6)) % 12 + 12) % 12;
  while (fret < minStartFret) fret += 12;
  const out: FretPos[] = [];
  let midi = openMidi(6) + fret;
  const pcs = new Set(scalePcs.map(p => ((p % 12) + 12) % 12));
  for (let s = 6; s >= 1; s--) {
    for (let k = 0; k < perString; k++) {
      if (!(s === 6 && k === 0)) {
        // advance to the next scale tone
        do midi++; while (!pcs.has(pitchClass(midi)));
      }
      out.push({ string: s, fret: midi - openMidi(s) });
    }
  }
  // Pentatonic boxes: when the B string pushes a note to a negative fret, it's invalid
  return out.filter(p => p.fret >= 0);
}

export const PENTATONIC_MINOR = [0, 3, 5, 7, 10];
export const PENTATONIC_MAJOR = [0, 2, 4, 7, 9];
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];

export function transposePcs(pcs: number[], root: number): number[] {
  return pcs.map(p => (p + root) % 12);
}
