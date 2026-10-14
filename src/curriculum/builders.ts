/**
 * Small helpers that keep lesson definitions compact and readable.
 */
import type { Clef, Hand } from '../music/score';
import type { TimeSig } from '../music/rhythm';
import type { ScaleKind } from '../music/keys';
import type { ActivityDef, FingeringMode, Insight, LessonDef, LessonKind, MelodyGen, RhythmCell, UnitDef } from './types';

export const n = (s: string): string[] => s.trim().split(/\s+/);

// ---- Rhythm vocabularies (weighted) ----
export const RH = {
  /** quarters only */
  quarters: { q: 1 } as Record<RhythmCell, number>,
  /** quarters & halves */
  qh: { q: 4, h: 1.4 } as Record<RhythmCell, number>,
  /** quarters, halves, wholes */
  qhw: { q: 4, h: 1.6, w: 0.6 } as Record<RhythmCell, number>,
  /** 3/4 friendly */
  waltz: { q: 4, h: 1.2, 'h.': 0.8 } as Record<RhythmCell, number>,
  /** with rests */
  rests: { q: 4, h: 1.4, rq: 0.7, rh: 0.35, w: 0.3 } as Record<RhythmCell, number>,
  /** eighths introduced */
  eighths: { q: 4, 'e e': 2.2, h: 1.2 } as Record<RhythmCell, number>,
  eighthsRests: { q: 3, 'e e': 2.4, h: 1, rq: 0.5, 'e e e e': 0.6 } as Record<RhythmCell, number>,
  dotted: { q: 3, 'e e': 2, 'q. e': 1.6, h: 1 } as Record<RhythmCell, number>,
  dottedRests: { q: 3, 'e e': 2, 'q. e': 1.6, h: 0.8, rq: 0.5, 're e': 0.4 } as Record<RhythmCell, number>,
  sixteenths: { q: 2, 'e e': 2, 's s s s': 1.4, 'e s s': 1, 's s e': 1, 'q. e': 0.8 } as Record<RhythmCell, number>,
  triplets: { q: 2, 'e e': 2, 'e3 e3 e3': 1.8, h: 0.6 } as Record<RhythmCell, number>,
  syncopation: { q: 2, 'e e': 2, 'e q e': 1.5, 'q. e': 1, 's e s': 0.6 } as Record<RhythmCell, number>,
  compound: { 'q e': 3, 'e e e': 2.5, 'q.': 1.4, 'h.': 0.4 } as Record<RhythmCell, number>,
  compoundAdv: { 'q e': 2, 'e e e': 2.5, 'q.': 1, 's s e e': 0.8, 'e. s e': 1 } as Record<RhythmCell, number>,
  advanced: { q: 1, 'e e': 2, 's s s s': 1.2, 'e s s': 1, 's s e': 1, 'e3 e3 e3': 1, 'e q e': 1, 'q. e': 1, rq: 0.3 } as Record<RhythmCell, number>,
  slow: { h: 2, w: 1, q: 1 } as Record<RhythmCell, number>,
};

// ---- Lesson builders ----
export function lesson(id: string, title: string, kind: LessonKind, goal: string, steps: ActivityDef[], intro?: Insight[]): LessonDef {
  return { id, title, kind, goal, steps, intro };
}

export function unit(id: string, title: string, summary: string, lessons: LessonDef[], skills?: string[]): UnitDef {
  return { id, title, summary, lessons, skills };
}

export function tip(title: string, body: string, visual?: Insight['visual']): ActivityDef {
  return { type: 'tip', insight: { title, body, visual } };
}

export function insight(title: string, body: string, visual?: Insight['visual']): Insight {
  return { title, body, visual };
}

export function meet(clef: Clef, notes: string, opts: { tips?: string[]; hand?: Hand; fingers?: number[]; frets?: { string: number; fret: number; finger: number }[]; reps?: number } = {}): ActivityDef {
  return { type: 'meet', clef, notes: n(notes), ...opts };
}

export function name(clef: Clef, pool: string, count: number, opts: { key?: string; answers?: 'naturals' | 'accidentals'; sequence?: boolean; title?: string } = {}): ActivityDef {
  return { type: 'name', clef, pool: n(pool), count, ...opts };
}

export function play(clef: Clef, pool: string, count: number, opts: { key?: string; hand?: Hand; hints?: boolean; title?: string } = {}): ActivityDef {
  return { type: 'play', clef, pool: n(pool), count, ...opts };
}

export interface ReadOpts {
  key?: string;
  time?: TimeSig;
  measures?: number;
  rhythms?: Record<RhythmCell, number>;
  maxLeap?: number;
  leapiness?: number;
  five?: boolean;
  hand?: Hand;
  mode?: 'wait' | 'tempo';
  tempo?: number;
  fingering?: FingeringMode;
  noteNames?: boolean;
  reps?: number;
  harmonic?: boolean;
  dyads?: { chance: number; intervals: number[] };
  accomp?: MelodyGen['accomp'];
  guitarPosition?: number;
  title?: string;
  prompt?: string;
  cadence?: boolean;
}

export function read(clef: Clef, pool: string, o: ReadOpts = {}): ActivityDef {
  return {
    type: 'read',
    title: o.title,
    prompt: o.prompt,
    gen: {
      clef,
      key: o.key ?? 'C',
      time: o.time ?? [4, 4],
      measures: o.measures ?? 4,
      pool: n(pool),
      rhythms: o.rhythms ?? RH.qh,
      maxLeap: o.maxLeap ?? 2,
      leapiness: o.leapiness,
      fivePosition: o.five,
      hand: o.hand,
      harmonic: o.harmonic,
      dyads: o.dyads,
      accomp: o.accomp,
      guitarPosition: o.guitarPosition,
      cadence: o.cadence,
    },
    mode: o.mode ?? 'wait',
    tempo: o.tempo,
    fingering: o.fingering ?? 'all',
    noteNames: o.noteNames,
    reps: o.reps ?? 1,
  };
}

export function piece(song: string, o: { mode?: 'wait' | 'tempo'; tempo?: number; hands?: 'R' | 'L' | 'both'; fingering?: FingeringMode; noteNames?: boolean; title?: string } = {}): ActivityDef {
  return { type: 'piece', song, mode: o.mode ?? 'wait', tempo: o.tempo, hands: o.hands, fingering: o.fingering ?? 'all', noteNames: o.noteNames, title: o.title };
}

export function inlinePiece(
  title: string,
  key: string,
  time: TimeSig,
  staves: { clef: Clef; hand?: Hand; voices: string[] }[],
  o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; noteNames?: boolean; prompt?: string } = {},
): ActivityDef {
  return { type: 'piece', inline: { key, time, staves, title }, title, mode: o.mode ?? 'wait', tempo: o.tempo, fingering: o.fingering ?? 'all', noteNames: o.noteNames, prompt: o.prompt };
}

export function scale(tonic: string, kind: ScaleKind, hands: 'R' | 'L' | 'both', o: { octaves?: number; octave?: number; motion?: 'parallel' | 'contrary'; mode?: 'wait' | 'tempo'; tempo?: number; rhythm?: 'q' | 'e' | 's'; fingering?: FingeringMode; guitarPosition?: number; clef?: Clef; title?: string } = {}): ActivityDef {
  return {
    type: 'scale',
    tonic,
    kind,
    hands,
    octaves: o.octaves ?? 1,
    octave: o.octave,
    motion: o.motion,
    mode: o.mode ?? 'wait',
    tempo: o.tempo,
    rhythm: o.rhythm,
    fingering: o.fingering ?? 'all',
    guitarPosition: o.guitarPosition,
    clef: o.clef,
    title: o.title,
  };
}

export function interval(clef: Clef, pool: string, intervals: number[], count: number, o: { harmonic?: boolean; key?: string } = {}): ActivityDef {
  return { type: 'interval', clef, pool: n(pool), intervals, count, ...o };
}

export function keysig(clef: Clef, keys: string, count: number): ActivityDef {
  return { type: 'keysig', clef, keys: n(keys), count };
}

export function rhythm(time: TimeSig, cells: Record<RhythmCell, number>, o: { measures?: number; tempo?: number; reps?: number } = {}): ActivityDef {
  return { type: 'rhythm', time, cells, measures: o.measures ?? 2, tempo: o.tempo ?? 72, reps: o.reps ?? 2 };
}

// ---- Chords (built at run time for the player's instrument and tuning) ----
/** Chord diagrams in a tip: "Em Am" or with shapes, "F:xx3211". */
export function chordTip(title: string, body: string, chords: string): ActivityDef {
  return tip(title, body, { kind: 'chord', chords: n(chords) });
}

export function chordInsight(title: string, body: string, chords: string): Insight {
  return insight(title, body, { kind: 'chord', chords: n(chords) });
}

/** Each note of the chord on its own, then the whole chord. */
export function pickChord(chords: string, o: { repeat?: number; title?: string; prompt?: string } = {}): ActivityDef {
  return { type: 'chord-play', chords: n(chords), pattern: 'pick', mode: 'wait', repeat: o.repeat, title: o.title, prompt: o.prompt };
}

/** One chord per bar in a strumming rhythm ("w", "h h", "q q q q", "q e e q e e"), cycled `repeat` times. */
export function strum(chords: string, o: { rhythm?: string; repeat?: number; mode?: 'wait' | 'tempo'; tempo?: number; time?: TimeSig; title?: string; prompt?: string } = {}): ActivityDef {
  return { type: 'chord-play', chords: n(chords), pattern: 'strum', rhythm: o.rhythm, repeat: o.repeat, mode: o.mode ?? 'wait', tempo: o.tempo, time: o.time, title: o.title, prompt: o.prompt };
}

/** Strum a library song's chords while the app plays the tune. */
export function strumAlong(song: string, o: { mode?: 'wait' | 'tempo'; tempo?: number; shapes?: string; title?: string; prompt?: string } = {}): ActivityDef {
  return { type: 'chord-play', song, mode: o.mode ?? 'tempo', tempo: o.tempo, shapes: o.shapes ? n(o.shapes) : undefined, title: o.title, prompt: o.prompt };
}

export function chordQuiz(chords: string, count: number, o: { reverse?: boolean; title?: string; prompt?: string } = {}): ActivityDef {
  return { type: 'chord-quiz', chords: n(chords), count, reverse: o.reverse, title: o.title, prompt: o.prompt };
}

// ---- Common pitch pools ----
export const P = {
  // Piano RH
  rhC: 'C4 D4 E4 F4 G4',
  rhG: 'G4 A4 B4 C5 D5',
  rhD: 'D4 E4 F#4 G4 A4',
  rhF: 'F4 G4 A4 Bb4 C5',
  rhA: 'A4 B4 C5 D5 E5',
  rhC5: 'C5 D5 E5 F5 G5',
  rhOctave: 'C4 D4 E4 F4 G4 A4 B4 C5',
  rhStaff: 'E4 F4 G4 A4 B4 C5 D5 E5 F5',
  rhWide: 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5',
  rhHigh: 'F5 G5 A5 B5 C6',
  rhLow: 'G3 A3 B3 C4 D4',
  rhFull: 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6',
  // Piano LH
  lhMid: 'F3 G3 A3 B3 C4',
  lhC: 'C3 D3 E3 F3 G3',
  lhG: 'G2 A2 B2 C3 D3',
  lhF: 'F2 G2 A2 Bb2 C3',
  lhD: 'D3 E3 F#3 G3 A3',
  lhA: 'A2 B2 C3 D3 E3',
  lhOctave: 'C3 D3 E3 F3 G3 A3 B3 C4',
  lhStaff: 'G2 A2 B2 C3 D3 E3 F3 G3 A3',
  lhWide: 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4',
  lhLow: 'C2 D2 E2 F2 G2',
  lhHigh: 'B3 C4 D4 E4',
  lhFull: 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4',
};
