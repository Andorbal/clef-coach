import type { KeySig } from './keys';
import { type Pitch, midiOf } from './pitch';
import { type BaseDuration, type TimeSig, durationTicks, measureTicks } from './rhythm';

export type Clef = 'treble' | 'bass' | 'treble8vb';
export type Hand = 'R' | 'L';
export type Instrument = 'piano' | 'guitar';

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
  /** Piano: finger 1-5 per pitch. Guitar: left-hand finger 0-4 (0 = open) per pitch. */
  fingers?: (number | undefined)[];
  /** Guitar string (1 = high E ... 6 = low E) per pitch. */
  strings?: (number | undefined)[];
  /** Tie from this note into the next note of the same voice. */
  tieNext?: boolean;
  /** This note continues a tie from the previous note (no new attack). */
  tiePrev?: boolean;
}

export interface VoicePart {
  notes: NoteEl[];
}

export interface StaffPart {
  clef: Clef;
  hand?: Hand;
  voices: VoicePart[];
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
}

export function scoreTotalTicks(score: Score): number {
  const mt = measureTicks(score.time);
  if (score.pickup) return score.pickup + mt * (score.measures - 1);
  return mt * score.measures;
}

/** Start tick of a measure (accounts for pickup). */
export function measureStartTick(score: Score, measure: number): number {
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
        // total length through ties
        let total = n.ticks;
        let j = i;
        while (ns[j].tieNext && j + 1 < ns.length) {
          j++;
          total += ns[j].ticks;
        }
        let entry = byTick.get(n.tick);
        if (!entry) {
          entry = { notes: [], elIds: [], measure: n.measure };
          byTick.set(n.tick, entry);
        }
        entry.elIds.push(n.id);
        n.pitches.forEach((p, pi) => {
          entry!.notes.push({
            midi: midiOf(p),
            pitch: p,
            staff: si,
            voice: vi,
            elId: n.id,
            finger: n.fingers?.[pi],
            string: n.strings?.[pi],
            hand: staff.hand,
            ticks: total,
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
}

/** Assign ids, ticks and measure indexes to a flat list of note specs. */
export function buildVoice(specs: NoteSpec[], time: TimeSig, idPrefix: string, pickup = 0): VoicePart {
  const mt = measureTicks(time);
  let tick = 0;
  const notes: NoteEl[] = specs.map((s, i) => {
    const ticks = durationTicks(s.base, s.dots ?? 0, s.triplet);
    const measure = pickup ? (tick < pickup ? 0 : 1 + Math.floor((tick - pickup) / mt)) : Math.floor(tick / mt);
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
    tick += ticks;
    return el;
  });
  for (let i = 1; i < notes.length; i++) if (notes[i - 1].tieNext) notes[i].tiePrev = true;
  return { notes };
}

export function rest(base: BaseDuration, dots = 0): NoteSpec {
  return { pitches: [], base, dots };
}
