import type { InstrumentId } from './instruments';
import type { KeySig } from './keys';
import { type Pitch, midiOf } from './pitch';
import { type BaseDuration, type TimeSig, durationTicks, measureTicks } from './rhythm';

/**
 * Clefs. The "8vb" clefs are for instruments written an octave above their sound
 * (guitar: treble8vb, bass guitar and double bass: bass8vb); scores always hold sounding
 * pitch. The C clefs put middle C on the staff's middle line (alto: the viola) or on its
 * fourth line (tenor: the cello's and bassoon's high register).
 */
export type Clef = 'treble' | 'bass' | 'treble8vb' | 'bass8vb' | 'alto' | 'tenor';
export type Hand = 'R' | 'L';
export type Instrument = InstrumentId;

/** The clef's shape, ignoring any octave transposition. */
export function clefBase(clef: Clef): 'treble' | 'bass' | 'alto' | 'tenor' {
  return clef === 'bass' || clef === 'bass8vb' ? 'bass' : clef === 'alto' || clef === 'tenor' ? clef : 'treble';
}

/** Lower (bass-like) clefs: the left hand's on a piano, and a lower octave for computer keys. */
export function isLowClef(clef: Clef): boolean {
  return clef === 'bass' || clef === 'bass8vb' || clef === 'tenor';
}

/** Octaves the written notation sits above the sound. */
export function clefOctave(clef: Clef): number {
  return clef === 'treble8vb' || clef === 'bass8vb' ? 1 : 0;
}

export interface NoteEl {
  id: string;
  rest: boolean;
  /** Sounding pitches (empty for rests). Sorted low → high. */
  pitches: Pitch[];
  base: BaseDuration;
  dots: number;
  triplet?: boolean;
  ticks: number;
  /** Absolute start tick within the score. */
  tick: number;
  /** 0-based measure index. */
  measure: number;
  /**
   * Piano: finger 1-5 per pitch. Fretted: left-hand finger 0-4 (0 = open) per pitch.
   * Mallets: mallet number 1-4 per pitch (1-2 left hand, 3-4 right hand; in two-mallet
   * playing 2 = L and 3 = R).
   */
  fingers?: (number | undefined)[];
  /** Fretted: string number per pitch (1 = highest course). */
  strings?: (number | undefined)[];
  /** Tie from this note into the next note of the same voice. */
  tieNext?: boolean;
  /** This note continues a tie from the previous note (no new attack). */
  tiePrev?: boolean;
  /**
   * Per pitch: tied on to the next note of the voice holding that pitch – the next
   * chord when only some of its notes are held, or a later one when an arpeggio's notes
   * are held into a chord. Only when the tie isn't the whole chord's (tieNext).
   */
  ties?: boolean[];
  /** Per pitch: continues a tie from the previous note (set from the previous note's `ties`). */
  held?: boolean[];
  /**
   * For display: the hand moves to a new position to play this note, 1 up (towards higher
   * notes) or -1 down. Worked out from the fingering (see markHandShifts), not stored.
   */
  shift?: 1 | -1;
}

/** Does this note tie its pitch at index `i` on (see NoteEl.ties)? */
export const tiesOn = (n: Pick<NoteEl, 'tieNext' | 'ties'>, i: number): boolean => !!n.tieNext || !!n.ties?.[i];

/** Is the pitch at index `i` held over from the previous note (no new attack)? */
export const isHeld = (n: Pick<NoteEl, 'tiePrev' | 'held'>, i: number): boolean => !!n.tiePrev || !!n.held?.[i];

export interface VoicePart {
  notes: NoteEl[];
}

export interface StaffPart {
  /** The opening clef. */
  clef: Clef;
  hand?: Hand;
  voices: VoicePart[];
  /** Clef changes later in the music, sorted by tick. */
  clefChanges?: ClefChange[];
}

/** A clef change on one staff, from an absolute tick on. */
export interface ClefChange {
  tick: number;
  clef: Clef;
}

/** Clef in force on a staff at a tick. */
export function clefAt(staff: Pick<StaffPart, 'clef' | 'clefChanges'>, tick: number): Clef {
  let c = staff.clef;
  for (const ch of staff.clefChanges ?? []) {
    if (ch.tick > tick) break;
    c = ch.clef;
  }
  return c;
}

export interface Score {
  id: string;
  title: string;
  composer?: string;
  key: KeySig;
  time: TimeSig;
  /** Quarter-note BPM */
  tempo: number;
  /** Length of a pickup (anacrusis) measure in ticks, if any. */
  pickup?: number;
  measures: number;
  staves: StaffPart[];
  instrument: Instrument;
  /** Fretted: open-string MIDI notes (string 1 first) the string numbers refer to. */
  tuning?: number[];
  /** Mallets: two- or four-mallet sticking (default 2). */
  mallets?: 2 | 4;
  /** Key / time signature changes after the first measure, sorted by measure. */
  changes?: MeterChange[];
}

/** A key and/or time signature change at the start of a (0-based) measure. */
export interface MeterChange {
  measure: number;
  time?: TimeSig;
  key?: KeySig;
}

/** Time signature in force in a measure. */
export function timeAt(score: Pick<Score, 'time' | 'changes'>, measure: number): TimeSig {
  let t = score.time;
  for (const c of score.changes ?? []) if (c.measure <= measure && c.time) t = c.time;
  return t;
}

/** Key signature in force in a measure. */
export function keyAt(score: Pick<Score, 'key' | 'changes'>, measure: number): KeySig {
  let k = score.key;
  for (const c of score.changes ?? []) if (c.measure <= measure && c.key) k = c.key;
  return k;
}

/** Length in ticks of each measure: the pickup (if any), then each measure's own time signature. */
export function measureLengths(time: TimeSig, measures: number, pickup = 0, changes?: MeterChange[]): number[] {
  const out: number[] = [];
  let t = time;
  for (let m = 0; m < measures; m++) {
    for (const c of changes ?? []) if (c.measure === m && c.time) t = c.time;
    out.push(m === 0 && pickup ? pickup : measureTicks(t));
  }
  return out;
}

export function scoreTotalTicks(score: Score): number {
  if (score.changes?.some(c => c.time)) return measureLengths(score.time, score.measures, score.pickup, score.changes).reduce((a, b) => a + b, 0);
  const mt = measureTicks(score.time);
  if (score.pickup) return score.pickup + mt * (score.measures - 1);
  return mt * score.measures;
}

/** Start tick of a measure (accounts for pickup and time changes). */
export function measureStartTick(score: Score, measure: number): number {
  if (score.changes?.some(c => c.time)) {
    return measureLengths(score.time, measure, score.pickup, score.changes).reduce((a, b) => a + b, 0);
  }
  const mt = measureTicks(score.time);
  if (!score.pickup) return measure * mt;
  if (measure === 0) return 0;
  return score.pickup + (measure - 1) * mt;
}

export interface StepNote {
  midi: number;
  pitch: Pitch;
  staff: number;
  voice: number;
  elId: string;
  finger?: number;
  string?: number;
  hand?: Hand;
  /** Total sounding length including ties. */
  ticks: number;
}

/** A moment in the score where one or more notes must be played together. */
export interface PlayStep {
  index: number;
  tick: number;
  measure: number;
  notes: StepNote[];
  /** Element ids that begin at this step (for highlighting). */
  elIds: string[];
  /** Ticks until the next step (or end of score). */
  span: number;
}

/** Flatten the score into the sequence of attacks the player must produce. */
export function buildSteps(score: Score): PlayStep[] {
  const byTick = new Map<number, { notes: StepNote[]; elIds: string[]; measure: number }>();
  score.staves.forEach((staff, si) => {
    staff.voices.forEach((voice, vi) => {
      const ns = voice.notes;
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        if (n.rest || n.tiePrev) continue;
        // total length through ties (a chord's notes may be tied on one by one)
        const lengthOf = (pi: number) => {
          let j = i;
          let k = pi;
          while (tiesOn(ns[j], k)) {
            const next = tieTarget(ns, j, k);
            if (!next) break;
            [j, k] = next;
          }
          return ns[j].tick + ns[j].ticks - n.tick;
        };
        if (n.pitches.every((_, pi) => isHeld(n, pi))) continue;
        let entry = byTick.get(n.tick);
        if (!entry) {
          entry = { notes: [], elIds: [], measure: n.measure };
          byTick.set(n.tick, entry);
        }
        entry.elIds.push(n.id);
        n.pitches.forEach((p, pi) => {
          if (isHeld(n, pi)) return;
          entry!.notes.push({
            midi: midiOf(p),
            pitch: p,
            staff: si,
            voice: vi,
            elId: n.id,
            finger: n.fingers?.[pi],
            string: n.strings?.[pi],
            hand: staff.hand,
            ticks: lengthOf(pi),
          });
        });
      }
    });
  });
  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  const end = scoreTotalTicks(score);
  return ticks.map((t, index) => {
    const e = byTick.get(t)!;
    // de-duplicate identical midi notes (unison between voices)
    const seen = new Set<number>();
    const notes = e.notes.filter(n => (seen.has(n.midi) ? false : (seen.add(n.midi), true)));
    notes.sort((a, b) => a.midi - b.midi);
    return {
      index,
      tick: t,
      measure: e.measure,
      notes,
      elIds: e.elIds,
      span: (ticks[index + 1] ?? end) - t,
    };
  });
}

/** Lowest and highest MIDI notes in a score. */
export function scoreRange(score: Score): [number, number] {
  let lo = 127;
  let hi = 0;
  for (const st of score.staves) for (const v of st.voices) for (const n of v.notes) {
    for (const p of n.pitches) {
      const m = midiOf(p);
      lo = Math.min(lo, m);
      hi = Math.max(hi, m);
    }
  }
  return lo > hi ? [60, 72] : [lo, hi];
}

// ---------------------------------------------------------------------------
// Programmatic builder (used by generators)
// ---------------------------------------------------------------------------

export interface NoteSpec {
  pitches: Pitch[];
  base: BaseDuration;
  dots?: number;
  triplet?: boolean;
  fingers?: (number | undefined)[];
  strings?: (number | undefined)[];
  tieNext?: boolean;
  /** Per pitch: tied into the next note (when only some notes of a chord are). */
  ties?: boolean[];
}

/** Assign ids, ticks and measure indexes to a flat list of note specs. */
export function buildVoice(specs: NoteSpec[], time: TimeSig, idPrefix: string, pickup = 0, changes?: MeterChange[]): VoicePart {
  const mt = measureTicks(time);
  // with time changes, measure boundaries come from each measure's own length
  const bounds: number[] | null = changes?.some(c => c.time) ? [] : null;
  if (bounds) {
    const total = specs.reduce((s, x) => s + durationTicks(x.base, x.dots ?? 0, x.triplet), 0);
    let acc = 0;
    const lens = measureLengths(time, 4096, pickup, changes);
    for (let m = 0; acc <= total && m < lens.length; m++) {
      bounds.push(acc);
      acc += lens[m];
    }
  }
  const measureOf = (tick: number): number => {
    if (bounds) {
      let m = 0;
      while (m + 1 < bounds.length && bounds[m + 1] <= tick) m++;
      return m;
    }
    return pickup ? (tick < pickup ? 0 : 1 + Math.floor((tick - pickup) / mt)) : Math.floor(tick / mt);
  };
  let tick = 0;
  const notes: NoteEl[] = specs.map((s, i) => {
    const ticks = durationTicks(s.base, s.dots ?? 0, s.triplet);
    const measure = measureOf(tick);
    // sort pitches low → high, keeping fingers/strings aligned
    const order = s.pitches.map((_, k) => k).sort((a, b) => midiOf(s.pitches[a]) - midiOf(s.pitches[b]));
    const el: NoteEl = {
      id: `${idPrefix}-${i}`,
      rest: s.pitches.length === 0,
      pitches: order.map(k => s.pitches[k]),
      base: s.base,
      dots: s.dots ?? 0,
      triplet: s.triplet,
      ticks,
      tick,
      measure,
      fingers: s.fingers ? order.map(k => s.fingers![k]) : undefined,
      strings: s.strings ? order.map(k => s.strings![k]) : undefined,
      tieNext: s.tieNext,
    };
    if (!s.tieNext && s.ties?.some(Boolean)) el.ties = order.map(k => !!s.ties![k]);
    tick += ticks;
    return el;
  });
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.rest) continue;
    if (n.tieNext && n.pitches.length > 1) {
      if (notes[i + 1]) notes[i + 1].tiePrev = true;
      continue;
    }
    n.pitches.forEach((_, k) => {
      const to = tiesOn(n, k) ? tieTarget(notes, i, k) : null;
      if (!to) return;
      const target = notes[to[0]];
      (target.held ??= target.pitches.map(() => false))[to[1]] = true;
    });
  }
  for (const n of notes) {
    if (n.held?.every(Boolean)) {
      n.tiePrev = true;
      n.held = undefined;
    }
  }
  return { notes };
}

/**
 * Where the tie on pitch `k` of note `i` lands: [note, pitch index] of the next note
 * in the voice holding that pitch, with no rest or gap on the way; null if none. A
 * whole chord's tie goes into the very next note.
 */
export function tieTarget(notes: NoteEl[], i: number, k: number): [number, number] | null {
  const n = notes[i];
  const midi = midiOf(n.pitches[k]);
  if (n.tieNext && n.pitches.length > 1) {
    const next = notes[i + 1];
    const j = next ? next.pitches.findIndex(q => midiOf(q) === midi) : -1;
    return j >= 0 ? [i + 1, j] : null;
  }
  for (let j = i + 1; j < notes.length; j++) {
    const m = notes[j];
    if (m.rest || m.tick !== notes[j - 1].tick + notes[j - 1].ticks) return null;
    const at = m.pitches.findIndex(q => midiOf(q) === midi);
    if (at >= 0) return [j, at];
  }
  return null;
}

export function rest(base: BaseDuration, dots = 0): NoteSpec {
  return { pitches: [], base, dots };
}

/**
 * A copy of measures [from, to] (0-based, inclusive) as a score of its own, with
 * ticks starting at 0 — for looping a phrase. Ties into or out of the passage
 * become plain notes; the key and time signature in force at `from` become the
 * opening ones; a pickup is kept only when the passage starts with it.
 */
export function sliceScore(score: Score, from: number, to: number): Score {
  const a = Math.max(0, Math.min(from, score.measures - 1));
  const b = Math.max(a, Math.min(to, score.measures - 1));
  if (a === 0 && b === score.measures - 1) return score;
  const start = measureStartTick(score, a);
  const end = measureStartTick(score, b + 1);
  const staves = score.staves.map(st => ({
    ...st,
    clef: clefAt(st, start),
    clefChanges: st.clefChanges?.filter(c => c.tick > start && c.tick < end).map(c => ({ ...c, tick: c.tick - start })),
    voices: st.voices.map(v => {
      const notes = v.notes
        .filter(n => n.measure >= a && n.measure <= b)
        .map(n => ({ ...n, tick: n.tick - start, measure: n.measure - a }));
      if (notes.length) {
        if (notes[0].tiePrev || notes[0].held) notes[0] = { ...notes[0], tiePrev: false, held: undefined };
        const last = notes.length - 1;
        if (notes[last].tieNext || notes[last].ties) notes[last] = { ...notes[last], tieNext: false, ties: undefined };
      }
      return { notes };
    }),
  }));
  const changes = (score.changes ?? []).filter(c => c.measure > a && c.measure <= b).map(c => ({ ...c, measure: c.measure - a }));
  return {
    ...score,
    id: `${score.id}-m${a + 1}-${b + 1}`,
    key: keyAt(score, a),
    time: timeAt(score, a),
    pickup: a === 0 ? score.pickup : undefined,
    measures: b - a + 1,
    staves,
    changes: changes.length ? changes : undefined,
  };
}
