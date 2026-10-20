/**
 * Fretted-instrument model: tunings, note locations, position fingering and the common
 * fretboard patterns (CAGED chords, pentatonic boxes, scale shapes).
 *
 * Everything takes an optional tuning (open-string MIDI notes, string 1 first) and
 * defaults to standard guitar, so it works for guitar, ukulele (including re-entrant
 * high-G tuning) and 4/5-string bass alike. Strings are numbered like players do:
 * 1 = the highest course (high E on a guitar, A on a ukulele, G on a bass).
 */
import { type Step, pitchClass, spellMidi, STEP_SEMIS } from './pitch';

/** Open-string MIDI notes, index 0 = string 1 (high E4) ... index 5 = string 6 (low E2). */
export const STANDARD_TUNING = [64, 59, 55, 50, 45, 40] as const;
export const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'] as const;
export const MAX_FRET = 22;
export const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

/** Open-string MIDI notes, string 1 first. */
export type TuningNotes = readonly number[];

export interface FretPos {
  string: number; // 1..N
  fret: number; // 0..22
}

export interface FingeredPos extends FretPos {
  /** Left-hand finger: 0 = open string, 1 = index ... 4 = pinky */
  finger: number;
}

/**
 * How the fretting hand covers the neck:
 *  'one-per-fret' – four fingers over four frets (guitar, ukulele, bass up the neck, and
 *                   the cello, a semitone per finger)
 *  'simandl'      – bass in the low positions: index, middle and pinky over three
 *                   frets (the ring finger helps the pinky); the double bass's system
 *  'violin'       – violin and viola: four fingers over a fourth (six semitones), the
 *                   2nd and 3rd fingers moving between a "low" and a "high" place
 *  'cello'        – a semitone per finger, and the 4th finger's forward extension a
 *                   semitone further (five semitones without shifting)
 */
export type FingerSystem = 'one-per-fret' | 'simandl' | 'violin' | 'cello';

export function openMidi(string: number, tuning: TuningNotes = STANDARD_TUNING): number {
  return tuning[string - 1] ?? tuning[tuning.length - 1];
}

export function midiAt(string: number, fret: number, tuning: TuningNotes = STANDARD_TUNING): number {
  return openMidi(string, tuning) + fret;
}

export function stringCount(tuning: TuningNotes = STANDARD_TUNING): number {
  return tuning.length;
}

/** String numbers from the lowest-pitched course to the highest (guitar: 6..1; high-G ukulele: 3, 4, 2, 1). */
export function stringsLowToHigh(tuning: TuningNotes = STANDARD_TUNING): number[] {
  return tuning.map((m, i) => ({ m, s: i + 1 })).sort((a, b) => a.m - b.m || b.s - a.s).map(x => x.s);
}

/** All places a MIDI note can be played, from the last (lowest) string to string 1. */
export function positionsFor(midi: number, maxFret = 15, minFret = 0, tuning: TuningNotes = STANDARD_TUNING): FretPos[] {
  const out: FretPos[] = [];
  for (let s = tuning.length; s >= 1; s--) {
    const fret = midi - openMidi(s, tuning);
    if (fret >= minFret && fret <= maxFret) out.push({ string: s, fret });
  }
  return out;
}

/** Every location of a pitch class within a fret window (e.g. "all the A's"). */
export function allLocationsOfPitchClass(pc: number, minFret = 0, maxFret = 12, strings?: number[], tuning: TuningNotes = STANDARD_TUNING): FretPos[] {
  const out: FretPos[] = [];
  for (const s of strings ?? tuning.map((_, i) => i + 1)) {
    if (s < 1 || s > tuning.length) continue;
    for (let f = minFret; f <= maxFret; f++) {
      if (pitchClass(midiAt(s, f, tuning)) === pc) out.push({ string: s, fret: f });
    }
  }
  return out;
}

export function stepPitchClass(step: Step, alter = 0): number {
  return (STEP_SEMIS[step] + alter + 12) % 12;
}

/** Name of the note at a fret, spelled with sharps unless flats requested. */
export function noteNameAt(string: number, fret: number, preferFlats = false, tuning: TuningNotes = STANDARD_TUNING) {
  return spellMidi(midiAt(string, fret, tuning), preferFlats ? -1 : 1);
}

/** Lowest and highest MIDI pitches playable up to maxFret. */
export function guitarRange(maxFret = 19, tuning: TuningNotes = STANDARD_TUNING): [number, number] {
  return [Math.min(...tuning), Math.max(...tuning) + maxFret];
}

/** Frets the hand spans without shifting, and the finger used at each offset from the index finger. */
function handShape(system: FingerSystem): { span: number; finger: (offset: number) => number } {
  if (system === 'simandl') return { span: 3, finger: o => (o <= 0 ? 1 : o === 1 ? 2 : 4) };
  // 1 | low 2, high 2 | 3, high 3 | 4: first position on the A string is B, C/C♯, D/D♯, E
  if (system === 'violin') return { span: 6, finger: o => (o <= 0 ? 1 : o <= 2 ? 2 : o <= 4 ? 3 : 4) };
  if (system === 'cello') return { span: 5, finger: o => Math.min(4, Math.max(1, o + 1)) };
  return { span: 4, finger: o => Math.min(4, Math.max(1, o + 1)) };
}

/**
 * The finger that plays a fret with the index finger at `handPos` (0 for an open string).
 * Simandl fingering holds below `simandlUntil` (the bass guitar opens its hand from the
 * 7th position; the double bass keeps 1-2-4 up to thumb position).
 */
export function fingerFor(system: FingerSystem, handPos: number, fret: number, simandlUntil = 7): number {
  return fret === 0 ? 0 : handShape(system === 'simandl' && handPos >= simandlUntil ? 'one-per-fret' : system).finger(fret - handPos);
}

/**
 * Finger a melody (sequence of single notes or chords) on a fretted instrument.
 * Uses dynamic programming to minimise hand shifts and stay near `preferPosition`.
 * Any fixed string assignments (from authored notation) are respected.
 */
export function fingerGuitarLine(
  events: { midis: number[]; strings?: (number | undefined)[] }[],
  opts: {
    preferPosition?: number;
    maxFret?: number;
    allowOpen?: boolean;
    tuning?: TuningNotes;
    fingerSystem?: FingerSystem;
    /** Simandl up to this index-finger fret (default 7; a double bass keeps it to 12). */
    simandlUntil?: number;
    /** Bowed: notes played together must lie on neighbouring strings (a bow can't skip one). */
    bowed?: boolean;
  } = {},
): FingeredPos[][] {
  const tuning = opts.tuning ?? STANDARD_TUNING;
  const maxFret = opts.maxFret ?? 15;
  const prefer = opts.preferPosition ?? 1;
  const allowOpen = opts.allowOpen ?? true;
  const simandlUntil = opts.simandlUntil ?? 7;
  // Simandl fingering is for the low positions; up the neck the hand opens up again
  const systemAt = (pos: number): FingerSystem => (opts.fingerSystem === 'simandl' ? (pos < simandlUntil ? 'simandl' : 'one-per-fret') : opts.fingerSystem ?? 'one-per-fret');
  const reach = handShape(systemAt(prefer)).span - 1;
  const lowestString = stringsLowToHigh(tuning)[0];

  // Candidate voicings per event
  const candidates: FretPos[][][] = events.map(ev => {
    const perNote = ev.midis.map((m, i) => {
      const fixed = ev.strings?.[i];
      if (fixed && fixed <= tuning.length) return [{ string: fixed, fret: m - openMidi(fixed, tuning) }];
      let c = positionsFor(m, maxFret, 0, tuning);
      if (!allowOpen) c = c.filter(p => p.fret > 0 || positionsFor(m, maxFret, 0, tuning).length === 1);
      // out of the hand's reach: the places the note has higher up the neck, not a wild fret on the lowest string
      if (!c.length) c = positionsFor(m, MAX_FRET + 2, 0, tuning).sort((a, b) => a.fret - b.fret).slice(0, 2);
      return c.length ? c : [{ string: lowestString, fret: Math.max(0, m - openMidi(lowestString, tuning)) }];
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
    if (opts.bowed && perNote.length > 1) {
      const neighbours = combos.filter(c => {
        const ss = c.map(x => x.string).sort((a, b) => a - b);
        return ss[ss.length - 1] - ss[0] === ss.length - 1;
      });
      if (neighbours.length) combos = neighbours;
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
      if (span > reach) cost += (span - reach) * 4;
      // preference for the requested position
      const posLo = Math.max(1, prefer - 1);
      const posHi = prefer + reach;
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
    const shift = hi - lo > reach ? Math.min(Math.abs(hb.lo - ha.lo), Math.abs(hb.hi - ha.hi)) : 0;
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
  const hands = chosen.map(handOf);
  /**
   * Where to shift to: of the places the index finger can go and still reach this note
   * (or chord), the one that keeps the most of the notes after it in reach, so a passage
   * up the neck is one shift, not a shift on every note; then the smallest move.
   */
  const shiftTo = (idx: number, from: number): number => {
    const h = hands[idx]!;
    const top = handShape(systemAt(h.lo)).span - 1;
    const lo = Math.max(1, h.hi - top);
    if (lo > h.lo) return h.lo;
    let best = h.lo;
    let bestScore = -Infinity;
    for (let p = lo; p <= h.lo; p++) {
      const t = handShape(systemAt(p)).span - 1;
      let fit = 0;
      for (let k = idx; k < Math.min(hands.length, idx + 8); k++) {
        const f = hands[k];
        if (f && (f.lo < p || f.hi > p + t)) break;
        fit++;
      }
      const score = fit * 100 - Math.abs(p - from);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  };
  let handPos = Math.max(1, prefer);
  return chosen.map((combo, idx) => {
    const h = hands[idx];
    let shape = handShape(systemAt(handPos));
    if (h) {
      const top = shape.span - 1;
      // a one-fret stretch below the position (index finger reaches back) is not a shift
      const stretch = h.lo === handPos - 1 && h.hi <= handPos + top - 1 && h.lo >= 1;
      if (!stretch && (h.lo < handPos || h.hi > handPos + top)) {
        handPos = shiftTo(idx, handPos);
        shape = handShape(systemAt(handPos));
      }
    }
    return combo.map(c => ({
      ...c,
      finger: c.fret === 0 ? 0 : shape.finger(c.fret - handPos),
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
  tuning: TuningNotes = STANDARD_TUNING,
): FretPos[] {
  // find start fret on the lowest string for the starting degree
  const low = tuning.length;
  const pc0 = scalePcs[startDegree % scalePcs.length];
  let fret = ((pc0 - openMidi(low, tuning)) % 12 + 12) % 12;
  while (fret < minStartFret) fret += 12;
  const out: FretPos[] = [];
  let midi = openMidi(low, tuning) + fret;
  const pcs = new Set(scalePcs.map(p => ((p % 12) + 12) % 12));
  for (let s = low; s >= 1; s--) {
    for (let k = 0; k < perString; k++) {
      if (!(s === low && k === 0)) {
        // advance to the next scale tone
        do midi++; while (!pcs.has(pitchClass(midi)));
      }
      out.push({ string: s, fret: midi - openMidi(s, tuning) });
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
