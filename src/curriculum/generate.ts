/**
 * Procedural music generation for exercises. The goal is *musical* material at a
 * precisely controlled difficulty: notes from a given pool, rhythms from a given set
 * of cells, leaps up to a limit, phrases that end on stable notes, and (for the grand
 * staff) a left-hand part that follows the harmony.
 */
import { type InstrumentId, type InstrumentPrefs, instrumentDef, isBowed } from '../music/instruments';
import { autoFinger, positionWindow } from '../music/autofinger';
import { fingerPianoLine, scaleFingering } from '../music/fingering';
import { type KeySig, parseKey, scalePitches, tonicOf, keyAlterations, type ScaleKind } from '../music/keys';
import { type Pitch, diatonicIndex, fromDiatonic, midiOf, parsePitch, pitchClass } from '../music/pitch';
import { type BaseDuration, PPQ, type TimeSig, beatTicks, durationTicks, measureTicks, splitTicks } from '../music/rhythm';
import { type Clef, type Hand, type NoteEl, type NoteSpec, type Score, type StaffPart, buildVoice } from '../music/score';
import type { AccompPattern, MelodyGen, RhythmCell } from './types';

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function makeRng(seed = Date.now()): Rng {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function weighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return items[0][0];
  let r = rng() * total;
  for (const [x, w] of items) {
    r -= Math.max(0, w);
    if (r <= 0) return x;
  }
  return items[items.length - 1][0];
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------

export interface RhythmSlot {
  base: BaseDuration;
  dots: number;
  triplet: boolean;
  rest: boolean;
  ticks: number;
  /** start tick within the measure */
  at: number;
}

function parseDurToken(tok: string): Omit<RhythmSlot, 'at'> {
  let t = tok;
  let rest = false;
  if (t.startsWith('r')) {
    rest = true;
    t = t.slice(1);
  }
  const m = /^([whqest])(\.{0,2})(3)?$/.exec(t);
  if (!m) throw new Error(`Bad rhythm token ${tok}`);
  const base = m[1] as BaseDuration;
  const dots = m[2].length;
  const triplet = !!m[3];
  return { base, dots, triplet, rest, ticks: durationTicks(base, dots, triplet) };
}

export function cellTicks(cell: RhythmCell): number {
  return cell.split(/\s+/).reduce((s, t) => s + parseDurToken(t).ticks, 0);
}

/** Generate rhythm slots for each measure from weighted cells. */
export function genRhythm(rng: Rng, time: TimeSig, measures: number, cells: Record<RhythmCell, number>, finalLong = true): RhythmSlot[][] {
  const mt = measureTicks(time);
  const bt = beatTicks(time);
  const list = Object.entries(cells).map(([c, w]) => ({ cell: c, w, ticks: cellTicks(c), toks: c.split(/\s+/).map(parseDurToken) }));
  const out: RhythmSlot[][] = [];
  for (let m = 0; m < measures; m++) {
    const slots: RhythmSlot[] = [];
    let at = 0;
    const last = m === measures - 1;
    let guard = 0;
    while (at < mt && guard++ < 64) {
      const remain = mt - at;
      // final measure: end with a long note when possible
      if (last && finalLong && at > 0 && remain >= bt && remain >= mt / 2) {
        const parts = splitTicks(remain);
        if (parts.length === 1) {
          slots.push({ ...parts[0], triplet: false, rest: false, ticks: remain, at });
          at += remain;
          break;
        }
      }
      const options = list.filter(c => {
        if (c.ticks > remain) return false;
        // long cells start on strong positions; cells that are whole beats start on beats
        if (c.ticks >= 2 * bt && time[0] % 2 === 0 && at % (2 * bt) !== 0) return false;
        if (c.ticks % bt === 0 && at % bt !== 0) return false;
        if (c.ticks < bt && (at % bt) + c.ticks > bt) return false;
        // no rests to start the first measure / to end the piece
        if (m === 0 && at === 0 && c.toks[0].rest) return false;
        if (last && at + c.ticks === mt && c.toks[c.toks.length - 1].rest) return false;
        return true;
      });
      if (!options.length) {
        // fill with plain values
        for (const p of splitTicks(remain)) {
          slots.push({ ...p, triplet: false, rest: false, ticks: durationTicks(p.base, p.dots), at });
          at += durationTicks(p.base, p.dots);
        }
        break;
      }
      const c = weighted(rng, options.map(o => [o, o.w] as [typeof o, number]));
      for (const t of c.toks) {
        slots.push({ ...t, at });
        at += t.ticks;
      }
    }
    out.push(slots);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Harmony
// ---------------------------------------------------------------------------

/** Diatonic triad on a scale degree (0 = I) as pitch classes. */
function triadPcs(key: KeySig, degree: number): number[] {
  const t = tonicOf(key);
  const scale = scalePitches(t, 4, key.mode === 'major' ? 'major' : 'harmonic-minor', 2);
  return [0, 2, 4].map(o => pitchClass(midiOf(scale[degree + o])));
}

const PROGRESSIONS_MAJOR: number[][] = [
  [0, 3, 4, 0],
  [0, 4, 0, 0],
  [0, 5, 3, 4],
  [0, 3, 0, 4],
  [0, 0, 4, 0],
  [0, 3, 4, 4],
  [0, 5, 1, 4],
];

/** Pick a chord degree for each measure, ending with V–I. */
export function genProgression(rng: Rng, measures: number, simple: boolean): number[] {
  const out: number[] = [];
  const pool = simple ? [[0, 4, 0, 0], [0, 0, 4, 0], [0, 4, 4, 0], [0, 3, 4, 0]] : PROGRESSIONS_MAJOR;
  while (out.length < measures) out.push(...pick(rng, pool));
  const prog = out.slice(0, measures);
  if (measures >= 2) {
    prog[measures - 1] = 0;
    prog[measures - 2] = 4;
  }
  if (measures >= 1) prog[0] = 0;
  return prog;
}

// ---------------------------------------------------------------------------
// Melody
// ---------------------------------------------------------------------------

function nearestIndexWithPc(pool: Pitch[], fromIdx: number, pcs: number[], maxLeap: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  const fromD = diatonicIndex(pool[fromIdx]);
  pool.forEach((p, i) => {
    if (!pcs.includes(pitchClass(midiOf(p)))) return;
    const d = Math.abs(diatonicIndex(p) - fromD);
    if (d > maxLeap) return;
    if (d < bestD || (d === bestD && Math.random() < 0.5)) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

interface MelodyNote {
  pitches: Pitch[];
  slot: RhythmSlot;
  measure: number;
}

function genMelodyLine(rng: Rng, gen: MelodyGen, rhythm: RhythmSlot[][], key: KeySig, prog: number[] | null): MelodyNote[] {
  const pool = gen.pool.map(parsePitch).sort((a, b) => midiOf(a) - midiOf(b));
  const tonicPc = pitchClass(midiOf({ ...tonicOf(key), octave: 4 }));
  const tonicIdxs = pool.map((p, i) => (pitchClass(midiOf(p)) === tonicPc ? i : -1)).filter(i => i >= 0);
  const bt = beatTicks(gen.time);
  const leapiness = gen.leapiness ?? 0.25;
  // start: tonic nearest the middle, else first note (thumb) for 5-finger positions
  let idx = tonicIdxs.length ? tonicIdxs[Math.floor(tonicIdxs.length / 2)] : Math.floor(pool.length / 2);
  if (gen.fivePosition && tonicIdxs.length && rng() < 0.5) idx = tonicIdxs[0];
  const out: MelodyNote[] = [];
  let repeats = 0;
  let lastDir = 0;
  const totalSlots = rhythm.reduce((s, m) => s + m.filter(x => !x.rest).length, 0);
  let n = 0;
  rhythm.forEach((slots, mi) => {
    slots.forEach(slot => {
      if (slot.rest) {
        out.push({ pitches: [], slot, measure: mi });
        return;
      }
      const isLast = n === totalSlots - 1;
      const isPenult = n === totalSlots - 2;
      if (n > 0) {
        const cur = pool[idx];
        const curD = diatonicIndex(cur);
        const strong = slot.at % (2 * bt) === 0;
        let next: number | null = null;
        if (isLast && gen.cadence !== false && tonicIdxs.length) {
          // resolve to the nearest tonic
          next = tonicIdxs.reduce((b, i) => (Math.abs(i - idx) < Math.abs(b - idx) ? i : b), tonicIdxs[0]);
        } else if (isPenult && gen.cadence !== false && tonicIdxs.length) {
          // approach the tonic by step (2nd degree or leading tone) when available
          const t = tonicIdxs.reduce((b, i) => (Math.abs(i - idx) < Math.abs(b - idx) ? i : b), tonicIdxs[0]);
          const cands = [t + 1, t - 1].filter(i => i >= 0 && i < pool.length && Math.abs(diatonicIndex(pool[i]) - curD) <= gen.maxLeap);
          if (cands.length) next = pick(rng, cands);
        } else if (prog && gen.harmonic && strong) {
          next = nearestIndexWithPc(pool, idx, triadPcs(key, prog[mi]), Math.max(2, gen.maxLeap));
        }
        if (next === null) {
          const cands: [number, number][] = [];
          pool.forEach((p, i) => {
            const d = diatonicIndex(p) - curD;
            const ad = Math.abs(d);
            if (ad > gen.maxLeap) return;
            let w: number;
            if (ad === 0) w = repeats >= 1 ? 0.15 : 0.7;
            else if (ad === 1) w = 3;
            else if (ad === 2) w = 2.2 * leapiness + 0.2;
            else w = (1.6 * leapiness) / (ad - 1);
            // after a big leap, prefer stepping back
            if (Math.abs(lastDir) >= 3 && Math.sign(d) === Math.sign(lastDir)) w *= 0.25;
            // keep away from the extremes of the pool
            if (i === 0 || i === pool.length - 1) w *= 0.7;
            // chord tones on strong beats (soft)
            if (prog && strong && triadPcs(key, prog[mi]).includes(pitchClass(midiOf(p)))) w *= 1.8;
            cands.push([i, w]);
          });
          next = cands.length ? weighted(rng, cands) : idx;
        }
        const d = diatonicIndex(pool[next]) - curD;
        repeats = d === 0 ? repeats + 1 : 0;
        if (d !== 0) lastDir = d;
        idx = next;
      }
      let pitches = [pool[idx]];
      if (gen.dyads && rng() < gen.dyads.chance && !isLast) {
        const iv = pick(rng, gen.dyads.intervals); // diatonic interval number, e.g. 3 = a third
        const lowD = diatonicIndex(pool[idx]) - (iv - 1);
        const below = pool.find(p => diatonicIndex(p) === lowD);
        if (below) pitches = [below, pool[idx]];
      }
      out.push({ pitches, slot, measure: mi });
      n++;
    });
  });
  return out;
}

function melodyToSpecs(notes: MelodyNote[]): NoteSpec[] {
  return notes.map(n => ({ pitches: n.pitches, base: n.slot.base, dots: n.slot.dots, triplet: n.slot.triplet }));
}

// ---------------------------------------------------------------------------
// Accompaniment
// ---------------------------------------------------------------------------

function chordTonesInPool(pool: Pitch[], pcs: number[]): Pitch[] {
  return pool.filter(p => pcs.includes(pitchClass(midiOf(p))));
}

/** Pick a close-position triad (3 notes) from the pool for a chord, as low as possible. */
function closeTriad(pool: Pitch[], pcs: number[]): Pitch[] {
  const tones = chordTonesInPool(pool, pcs);
  for (let i = 0; i + 2 < tones.length; i++) {
    const tri = tones.slice(i, i + 3);
    const set = new Set(tri.map(p => pitchClass(midiOf(p))));
    if (set.size === 3 && midiOf(tri[2]) - midiOf(tri[0]) <= 9) return tri;
  }
  return tones.slice(0, Math.min(3, tones.length));
}

function rootOf(pool: Pitch[], pcs: number[], prefer: 'low' | 'mid' = 'low'): Pitch | undefined {
  const roots = pool.filter(p => pitchClass(midiOf(p)) === pcs[0]);
  if (!roots.length) return chordTonesInPool(pool, pcs)[0];
  return prefer === 'low' ? roots[0] : roots[Math.floor(roots.length / 2)];
}

function genAccomp(
  rng: Rng,
  pattern: AccompPattern,
  gen: MelodyGen,
  melody: MelodyNote[],
  prog: number[],
  key: KeySig,
): NoteSpec[] {
  const acc = gen.accomp!;
  const pool = acc.pool.map(parsePitch).sort((a, b) => midiOf(a) - midiOf(b));
  const time = gen.time;
  const mt = measureTicks(time);
  const bt = beatTicks(time);
  const out: NoteSpec[] = [];
  const restMeasure = () => {
    for (const p of splitTicks(mt)) out.push({ pitches: [], base: p.base, dots: p.dots });
  };
  const fill = (pitches: Pitch[], ticks: number) => {
    const parts = splitTicks(ticks);
    parts.forEach((p, i) => out.push({ pitches, base: p.base, dots: p.dots, tieNext: pitches.length > 0 && i < parts.length - 1 }));
  };

  if (pattern === 'parallel' || pattern === 'contrary') {
    const rhPool = gen.pool.map(parsePitch).sort((a, b) => midiOf(a) - midiOf(b));
    const rhAxis = diatonicIndex(rhPool[0]);
    const lhTop = diatonicIndex(pool[pool.length - 1]);
    const lhBottom = diatonicIndex(pool[0]);
    const alter = keyAlterations(key.fifths);
    for (const n of melody) {
      if (!n.pitches.length) {
        out.push({ pitches: [], base: n.slot.base, dots: n.slot.dots, triplet: n.slot.triplet });
        continue;
      }
      const top = n.pitches[n.pitches.length - 1];
      let d: number;
      if (pattern === 'parallel') {
        d = diatonicIndex(top) - 7 * Math.max(1, Math.round((diatonicIndex(rhPool[0]) - lhBottom) / 7));
      } else {
        d = lhTop - (diatonicIndex(top) - rhAxis);
      }
      d = Math.max(lhBottom, Math.min(lhTop, d));
      const p = fromDiatonic(d);
      const inPool = pool.find(q => diatonicIndex(q) === d);
      out.push({ pitches: [inPool ?? { ...p, alter: alter[p.step] }], base: n.slot.base, dots: n.slot.dots, triplet: n.slot.triplet });
    }
    return out;
  }

  if (pattern === 'alternate') {
    // LH answers the RH: in odd measures, generate a short LH melody; RH rests there (handled by caller)
    const lhGen: MelodyGen = { ...gen, pool: acc.pool, dyads: undefined, harmonic: false, cadence: false };
    const rhythm = genRhythm(rng, time, prog.length, acc.rhythms ?? gen.rhythms, true);
    const lhLine = genMelodyLine(rng, lhGen, rhythm, key, prog);
    for (let m = 0; m < prog.length; m++) {
      if (m % 2 === 0) restMeasure();
      else out.push(...melodyToSpecs(lhLine.filter(x => x.measure === m)));
    }
    return out;
  }

  if (pattern === 'counter') {
    // independent counter-melody: longer values, consonant with the RH on attacks
    const rhythm = genRhythm(rng, time, prog.length, acc.rhythms ?? { h: 3, q: 2, w: 1 }, true);
    let prev: Pitch | null = null;
    rhythm.forEach((slots, mi) => {
      const pcs = triadPcs(key, prog[mi]);
      slots.forEach(slot => {
        if (slot.rest) {
          out.push({ pitches: [], base: slot.base, dots: slot.dots, triplet: slot.triplet });
          return;
        }
        const tick = mi * mt + slot.at;
        const rh = melody.find(x => x.measure * mt + x.slot.at <= tick && tick < x.measure * mt + x.slot.at + x.slot.ticks && x.pitches.length);
        const rhMidi = rh ? midiOf(rh.pitches[0]) : null;
        const cands = pool.filter(p => {
          const strong = slot.at === 0;
          if (strong && !pcs.includes(pitchClass(midiOf(p)))) return false;
          if (rhMidi !== null) {
            const iv = ((rhMidi - midiOf(p)) % 12 + 12) % 12;
            if (![0, 3, 4, 7, 8, 9].includes(iv)) return false;
            if (midiOf(p) >= rhMidi) return false;
          }
          if (prev && Math.abs(diatonicIndex(p) - diatonicIndex(prev)) > 4) return false;
          return true;
        });
        const choice = cands.length
          ? weighted(rng, cands.map(p => [p, prev ? 3 / (1 + Math.abs(diatonicIndex(p) - diatonicIndex(prev!))) : 1] as [Pitch, number]))
          : rootOf(pool, pcs) ?? pool[0];
        prev = choice;
        out.push({ pitches: [choice], base: slot.base, dots: slot.dots, triplet: slot.triplet });
      });
    });
    return out;
  }

  prog.forEach(deg => {
    const pcs = triadPcs(key, deg);
    const root = rootOf(pool, pcs) ?? pool[0];
    const tri = closeTriad(pool, pcs);
    const fifthPc = pcs[2];
    const fifth = pool.find(p => pitchClass(midiOf(p)) === fifthPc && midiOf(p) > midiOf(root)) ?? root;
    const third = pool.find(p => pitchClass(midiOf(p)) === pcs[1] && midiOf(p) > midiOf(root)) ?? root;
    switch (pattern) {
      case 'drone':
        fill(acc.fivePosition || rng() < 0.6 ? [root] : [root, fifth], mt);
        break;
      case 'roots': {
        const half = mt / 2;
        if (time[0] === 3) {
          fill([root], mt);
        } else {
          fill([root], half);
          fill([rng() < 0.5 ? fifth : root], half);
        }
        break;
      }
      case 'blocked': {
        const chord = tri.length >= 2 ? tri : [root];
        if (time[0] === 3 || rng() < 0.5) fill(chord, mt);
        else {
          fill(chord, mt / 2);
          fill(chord, mt / 2);
        }
        break;
      }
      case 'waltz': {
        const upper = tri.filter(p => midiOf(p) > midiOf(root)).slice(0, 2);
        const chord = upper.length ? upper : [fifth];
        fill([root], bt);
        for (let b = 1; b < time[0]; b++) fill(chord, bt);
        break;
      }
      case 'broken': {
        const seq = [root, fifth, third, fifth];
        const n = Math.round(mt / bt);
        for (let b = 0; b < n; b++) fill([seq[b % 4]], bt);
        break;
      }
      case 'alberti': {
        const seq = [root, fifth, third, fifth];
        const n = Math.round(mt / (bt / 2));
        for (let i = 0; i < n; i++) out.push({ pitches: [seq[i % 4]], base: 'e' });
        break;
      }
      default:
        restMeasure();
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Public: generate a full exercise score
// ---------------------------------------------------------------------------

let genCounter = 0;

const CHORD_PATTERNS = new Set<AccompPattern>(['broken', 'alberti', 'waltz', 'blocked', 'roots', 'drone']);

/**
 * Left-hand fingering for accompaniment figures, bar by bar: the lowest note of the
 * bar's chord takes 5, the highest takes 1, inner notes take 3 (or 2 when they sit a
 * 4th or more above the bass) — e.g. Alberti C–G–E–G = 5-1-3-1, C–F–A = 5-2-1.
 */
function fingerAccompaniment(notes: NoteEl[]) {
  const byMeasure = new Map<number, NoteEl[]>();
  for (const n of notes) {
    const list = byMeasure.get(n.measure) ?? [];
    list.push(n);
    byMeasure.set(n.measure, list);
  }
  for (const list of byMeasure.values()) {
    const all = [...new Set(list.flatMap(n => n.pitches.map(midiOf)))].sort((a, b) => a - b);
    const lo = all[0];
    const hi = all[all.length - 1];
    const fingerOf = (m: number) => {
      if (all.length === 1) return 5;
      if (m === lo) return 5;
      if (m === hi) return hi - lo > 12 ? 1 : 1;
      return m - lo >= 5 && hi - m <= 4 ? 2 : 3;
    };
    for (const n of list) n.fingers = n.pitches.map(p => fingerOf(midiOf(p)));
  }
}

export function generateScore(gen: MelodyGen, rng: Rng = makeRng(), instrument: InstrumentId = 'piano', title = '', prefs: InstrumentPrefs = {}): Score {
  const key = parseKey(gen.key);
  const id = `gen${++genCounter}`;
  const rhythm = genRhythm(rng, gen.time, gen.measures, gen.rhythms, true);
  const needsProg = gen.harmonic || (gen.accomp && gen.accomp.pattern !== 'none');
  const prog = needsProg ? genProgression(rng, gen.measures, !gen.harmonic) : null;
  let melody = genMelodyLine(rng, gen, rhythm, key, prog);

  const pattern = gen.accomp?.pattern ?? 'none';
  if (pattern === 'alternate') {
    // RH rests in the LH measures
    const mt = measureTicks(gen.time);
    melody = melody.flatMap(n => {
      if (n.measure % 2 === 0) return [n];
      return n.slot.at === 0 ? splitTicks(mt).map(p => ({ pitches: [], slot: { ...n.slot, ...p, triplet: false, rest: true, ticks: durationTicks(p.base, p.dots) }, measure: n.measure })) : [];
    });
    // ensure the final RH measure resolves: if the last measure is LH, that's fine
  }

  const hand: Hand = gen.hand ?? (gen.clef === 'bass' ? 'L' : 'R');
  const rhSpecs = melodyToSpecs(melody);
  const staves: StaffPart[] = [];
  const twoStaves = !!gen.accomp && pattern !== 'none';
  const rhStaff: StaffPart = { clef: gen.clef, hand: instrument === 'piano' || (instrument === 'mallets' && twoStaves) ? hand : undefined, voices: [buildVoice(rhSpecs, gen.time, `${id}-a`)] };
  staves.push(rhStaff);
  if (gen.accomp && pattern !== 'none') {
    const lhSpecs = genAccomp(rng, pattern, gen, melody, prog!, key);
    staves.push({ clef: 'bass', hand: 'L', voices: [buildVoice(lhSpecs, gen.time, `${id}-b`)] });
  }

  const score: Score = {
    id,
    title,
    key,
    time: gen.time,
    tempo: 80,
    measures: gen.measures,
    staves,
    instrument,
    mallets: instrument === 'mallets' ? gen.mallets ?? (twoStaves ? 4 : 2) : undefined,
  };

  // Fingering
  if (instrument === 'piano') {
    staves.forEach((st, si) => {
      const h: Hand = st.hand ?? 'R';
      const five = si === 0 ? gen.fivePosition : gen.accomp?.fivePosition;
      const poolStrs = si === 0 ? gen.pool : gen.accomp?.pool ?? [];
      const pool = poolStrs.map(parsePitch).sort((a, b) => midiOf(a) - midiOf(b)).map(midiOf);
      const notes = st.voices[0].notes.filter(n => !n.rest && !n.tiePrev);
      if (five && pool.length <= 6) {
        // fixed hand position: lowest note = finger 1 (RH) / finger 5 (LH)
        const base = pool[0];
        const naturals = poolStrs.map(parsePitch).sort((a, b) => midiOf(a) - midiOf(b));
        const baseD = diatonicIndex(naturals[0]);
        for (const n of notes) {
          n.fingers = n.pitches.map(p => {
            const off = diatonicIndex(p) - baseD;
            return h === 'R' ? Math.min(5, off + 1) : Math.max(1, 5 - off);
          });
        }
        void base;
      } else if (si === 1 && CHORD_PATTERNS.has(pattern) && h === 'L') {
        // accompaniment figures: the hand frames each bar's chord (lowest = 5, highest = 1)
        fingerAccompaniment(notes);
      } else {
        const res = fingerPianoLine(notes.map(n => ({ midis: n.pitches.map(midiOf) })), h);
        notes.forEach((n, i) => (n.fingers = res[i]));
      }
      for (let i = 1; i < st.voices[0].notes.length; i++) {
        const n = st.voices[0].notes[i];
        if (n.tiePrev) n.fingers = st.voices[0].notes[i - 1].fingers;
      }
    });
  } else {
    autoFinger(score, { ...prefs, ...positionWindow(instrument, gen.guitarPosition) });
  }
  return score;
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

export function scaleScore(opts: {
  tonic: string;
  kind: ScaleKind;
  octaves: number;
  hands: 'R' | 'L' | 'both';
  octave?: number;
  motion?: 'parallel' | 'contrary';
  rhythm?: 'q' | 'e' | 's';
  instrument: InstrumentId;
  clef?: Clef;
  guitarPosition?: number;
  prefs?: InstrumentPrefs;
  /** Mallets: two or four mallets (default 2). */
  mallets?: 2 | 4;
}): Score {
  const m = /^([A-G])(#|b)?$/.exec(opts.tonic)!;
  const tonic = { step: m[1] as Pitch['step'], alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0 };
  const keyName = opts.tonic + (opts.kind === 'major' ? '' : 'm');
  let key: KeySig;
  try {
    key = parseKey(keyName);
  } catch {
    key = { fifths: 0, mode: 'major' };
  }
  const id = `scale${++genCounter}`;
  const time: TimeSig = [4, 4];
  const base: BaseDuration = opts.rhythm ?? 'q';
  const rhOct = opts.octave ?? ({ guitar: 3, bass: 2, viola: 3, cello: 2, doublebass: 1 } as Partial<Record<InstrumentId, number>>)[opts.instrument] ?? 4;
  const mkLine = (oct: number, dir: 'up' | 'down') => {
    const up = scalePitches(tonic, oct, opts.kind, opts.octaves);
    const line = dir === 'up' ? [...up, ...up.slice(0, -1).reverse()] : [...[...up].reverse(), ...up.slice(1)];
    // melodic minor descends as natural minor
    if (opts.kind === 'melodic-minor') {
      const nat = scalePitches(tonic, oct, 'natural-minor', opts.octaves);
      const half = up.length;
      if (dir === 'up') for (let i = half; i < line.length; i++) line[i] = [...nat].reverse()[i - half + 1];
    }
    return line;
  };
  const toSpecs = (line: Pitch[], fingers?: number[]): NoteSpec[] => {
    const unit = durationTicks(base);
    const mt = measureTicks(time);
    const specs: NoteSpec[] = line.map((p, i) => ({ pitches: [p], base, fingers: fingers ? [fingers[i]] : undefined }));
    // last note fills the measure
    const used = unit * (line.length - 1);
    let remain = mt - (used % mt);
    if (remain < PPQ) remain += mt;
    const parts = splitTicks(remain);
    const last = specs.pop()!;
    parts.forEach((p, i) => specs.push({ ...last, base: p.base, dots: p.dots, tieNext: i < parts.length - 1 }));
    return specs;
  };
  const tk = opts.tonic;
  const staves: StaffPart[] = [];
  if (opts.instrument !== 'piano') {
    // fretted instruments and mallets: one staff in the instrument's own clef
    const line = mkLine(rhOct, 'up');
    const clef: Clef = opts.clef ?? (instrumentDef(opts.instrument).clefs[0] as Clef);
    staves.push({ clef, voices: [buildVoice(toSpecs(line), time, `${id}-g`)] });
    const s: Score = { id, title: '', key, time, tempo: 80, measures: 0, staves, instrument: opts.instrument, mallets: opts.instrument === 'mallets' ? opts.mallets ?? 2 : undefined };
    s.measures = Math.max(...staves[0].voices[0].notes.map(n => n.measure)) + 1;
    const win = positionWindow(opts.instrument, opts.guitarPosition);
    return autoFinger(s, { ...opts.prefs, guitarPosition: win.guitarPosition, maxFret: win.maxFret + (isBowed(opts.instrument) ? 0 : 1) });
  }
  const upDown = (hand: Hand) => {
    const up = scaleFingering(tk, opts.kind, hand, opts.octaves);
    if (!up) return undefined;
    return [...up, ...up.slice(0, -1).reverse()];
  };
  if (opts.hands === 'R' || opts.hands === 'both') {
    const line = mkLine(rhOct, 'up');
    staves.push({ clef: 'treble', hand: 'R', voices: [buildVoice(toSpecs(line, upDown('R')), time, `${id}-r`)] });
  }
  if (opts.hands === 'L' || opts.hands === 'both') {
    const lhOct = opts.hands === 'both' ? (opts.motion === 'contrary' ? rhOct : rhOct - 1) : rhOct - 1;
    let line: Pitch[];
    let fingers = upDown('L');
    if (opts.motion === 'contrary' && opts.hands === 'both') {
      // LH starts on the same tonic and descends while the RH ascends
      const up = scalePitches(tonic, lhOct - opts.octaves, opts.kind, opts.octaves);
      line = [...[...up].reverse(), ...up.slice(1)];
      if (fingers) {
        const asc = scaleFingering(tk, opts.kind, 'L', opts.octaves)!;
        const desc = [...asc].reverse();
        fingers = [...desc, ...asc.slice(1)];
      }
    } else line = mkLine(lhOct, 'up');
    staves.push({ clef: 'bass', hand: 'L', voices: [buildVoice(toSpecs(line, fingers), time, `${id}-l`)] });
  }
  const s: Score = { id, title: '', key, time, tempo: 80, measures: 0, staves, instrument: 'piano' };
  s.measures = Math.max(...staves.flatMap(st => st.voices[0].notes.map(n => n.measure))) + 1;
  return autoFinger(s);
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/** A run of whole notes with no barlines — used for note-reading drills. */
export function flashScore(notes: Pitch[][], clef: Clef, keyName = 'C', instrument: InstrumentId = 'piano', hand?: Hand): Score {
  const id = `flash${++genCounter}`;
  const key = parseKey(keyName);
  const specs: NoteSpec[] = notes.map(p => ({ pitches: p, base: 'w' }));
  const voice = buildVoice(specs, [4, 4], `${id}-n`);
  return {
    id,
    title: '',
    key,
    time: [4, 4],
    tempo: 60,
    measures: notes.length,
    staves: [{ clef, hand, voices: [voice] }],
    instrument,
  };
}

/** Choose `count` items from a pool, weighted by SRS priority, avoiding immediate repeats. */
export function drawItems<T>(rng: Rng, pool: T[], count: number, weightOf: (x: T) => number = () => 1, sameAs: (a: T, b: T) => boolean = (a, b) => a === b): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const cands = pool.filter(x => !out.length || !sameAs(x, out[out.length - 1]) || pool.length === 1);
    out.push(weighted(rng, cands.map(x => [x, Math.max(0.05, weightOf(x))] as [T, number])));
  }
  return out;
}
