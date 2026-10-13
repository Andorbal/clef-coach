import type { Clef, Hand, Instrument } from '../music/score';
import type { ScaleKind } from '../music/keys';
import type { TimeSig } from '../music/rhythm';
import type { TrackId } from '../state/types';
import type { ShapeName } from '../music/guitar';

/** A short explanatory card. Theory appears only where it helps you play. */
export interface Insight {
  title: string;
  body: string;
  /** Optional visual: a few notes on a staff, a highlighted keyboard range, etc. */
  visual?:
    | { kind: 'staff'; clef: Clef; notes: string[]; labels?: boolean; key?: string; time?: TimeSig }
    | { kind: 'keys'; notes: string[]; low?: string; high?: string; fingers?: number[]; hand?: Hand; sticking?: string[] }
    | { kind: 'frets'; positions: { string: number; fret: number; label?: string; finger?: number; root?: boolean }[]; minFret?: number; maxFret?: number }
    | { kind: 'staff+keys'; clef: Clef; notes: string[]; fingers?: number[]; hand?: Hand; sticking?: string[] }
    | { kind: 'staff+frets'; clef: Clef; notes: string[]; positions: { string: number; fret: number; finger?: number }[] };
}

/** Rhythm cells used by the melody generator. Each is a space-separated list of durations (r = rest). */
export type RhythmCell = string;

export type AccompPattern =
  | 'none'
  | 'alternate' // hands take turns measure by measure
  | 'drone' // LH whole-note root (or root+5th)
  | 'roots' // LH half-note roots / fifths following the harmony
  | 'blocked' // LH blocked triads
  | 'waltz' // root then chord-chord (3/4)
  | 'broken' // root-5th-3rd-5th quarters/eighths
  | 'alberti' // low-high-mid-high eighths
  | 'parallel' // LH doubles the RH melody an octave lower
  | 'contrary' // LH mirrors RH
  | 'counter'; // independent counter-melody

export interface MelodyGen {
  clef: Clef;
  key: string;
  time: TimeSig;
  measures: number;
  /** Allowed pitches for the melody (sounding). */
  pool: string[];
  /** Weighted rhythm cells, e.g. { 'q': 3, 'h': 1 } */
  rhythms: Record<RhythmCell, number>;
  /** Largest melodic leap in diatonic steps (1 = step, 2 = third, 4 = fifth, 7 = octave). */
  maxLeap: number;
  /** 0..1 chance of a leap (> step) */
  leapiness?: number;
  /** Fixed five-finger position fingering: pool[0] gets finger 1 (RH) or 5 (LH). */
  fivePosition?: boolean;
  hand?: Hand;
  /** Harmonic intervals: chance a melody note becomes a dyad */
  dyads?: { chance: number; intervals: number[] };
  /** End on the tonic */
  cadence?: boolean;
  /** Fretted: position for fingering (index-finger fret); default 1 */
  guitarPosition?: number;
  /** Mallets: two or four mallets (default 2, or 4 for a grand-staff part). */
  mallets?: 2 | 4;
  /** Second staff (grand staff) */
  accomp?: { pattern: AccompPattern; pool: string[]; fivePosition?: boolean; rhythms?: Record<RhythmCell, number> };
  /** Use chromatic accidentals (passing tones) with this probability */
  chromatic?: number;
  /** Use harmony-driven melody (chord tones on strong beats) */
  harmonic?: boolean;
}

export type FingeringMode = 'all' | 'first' | 'none';

export interface ActivityBase {
  /** Optional override title shown at the top of the activity */
  title?: string;
  /** One-line instruction */
  prompt?: string;
}

export type ActivityDef =
  | (ActivityBase & {
      type: 'meet';
      clef: Clef;
      notes: string[];
      /** Explanations, one per note (or a single shared one) */
      tips?: string[];
      hand?: Hand;
      fingers?: number[];
      /** guitar locations for each note */
      frets?: { string: number; fret: number; finger: number }[];
      reps?: number;
    })
  | (ActivityBase & {
      type: 'name';
      clef: Clef;
      pool: string[];
      count: number;
      key?: string;
      /** answer buttons: natural letters only, or with sharps/flats */
      answers?: 'naturals' | 'accidentals';
      /** show several notes in a row (note rush) */
      sequence?: boolean;
      timed?: number;
    })
  | (ActivityBase & {
      type: 'play';
      clef: Clef;
      pool: string[];
      count: number;
      key?: string;
      hand?: Hand;
      /** show finger / fret hints on the instrument */
      hints?: boolean;
      /** play the same pitch anywhere (guitar) */
      sequence?: boolean;
    })
  | (ActivityBase & {
      type: 'read';
      gen: MelodyGen;
      mode: 'wait' | 'tempo';
      tempo?: number;
      fingering?: FingeringMode;
      noteNames?: boolean;
      /** number of different passages to play */
      reps?: number;
    })
  | (ActivityBase & {
      type: 'piece';
      /** song id from the song library, or inline notation */
      song?: string;
      inline?: { key: string; time: TimeSig; staves: { clef: Clef; hand?: Hand; voices: string[] }[]; title?: string; pickup?: string };
      mode: 'wait' | 'tempo';
      tempo?: number;
      hands?: 'R' | 'L' | 'both';
      fingering?: FingeringMode;
      noteNames?: boolean;
    })
  | (ActivityBase & {
      type: 'scale';
      tonic: string; // e.g. "C", "F#", "Bb"
      kind: ScaleKind;
      octaves: number;
      hands: 'R' | 'L' | 'both';
      /** starting octave for the RH (LH is one or two octaves lower) */
      octave?: number;
      motion?: 'parallel' | 'contrary';
      mode: 'wait' | 'tempo';
      tempo?: number;
      rhythm?: 'q' | 'e' | 's';
      fingering?: FingeringMode;
      /** guitar: position for fingering */
      guitarPosition?: number;
      clef?: Clef;
      /** mallets: two or four mallets */
      mallets?: 2 | 4;
    })
  | (ActivityBase & {
      type: 'interval';
      clef: Clef;
      pool: string[];
      intervals: number[];
      count: number;
      harmonic?: boolean;
      key?: string;
    })
  | (ActivityBase & {
      type: 'keysig';
      clef: Clef;
      keys: string[];
      count: number;
    })
  | (ActivityBase & {
      type: 'rhythm';
      time: TimeSig;
      cells: Record<RhythmCell, number>;
      measures: number;
      tempo: number;
      reps?: number;
    })
  | (ActivityBase & {
      type: 'fret-find';
      /** pitch class names to find, e.g. ["A"] */
      notes: string[];
      strings: number[];
      frets: [number, number];
      /** how many rounds (one note name per round) */
      rounds?: number;
    })
  | (ActivityBase & {
      type: 'fret-name';
      strings: number[];
      frets: [number, number];
      count: number;
      naturalsOnly?: boolean;
    })
  | (ActivityBase & {
      type: 'fret-play';
      /** Name shown (no staff): play this note on a given string */
      strings: number[];
      frets: [number, number];
      count: number;
      naturalsOnly?: boolean;
    })
  | (ActivityBase & {
      type: 'fret-octave';
      /** show a note, find its octave partner using the octave shapes */
      strings: number[];
      frets: [number, number];
      count: number;
    })
  | (ActivityBase & {
      type: 'fret-shape';
      shape:
        | { kind: 'caged'; root: string; shape: ShapeName; quality?: 'major' | 'minor' }
        | { kind: 'pentatonic'; root: string; box: number; quality?: 'minor' | 'major' }
        | { kind: 'scale3nps'; root: string; startDegree: number; quality?: 'major' | 'minor' };
      /** play the shape's notes low→high (and back) */
      direction?: 'up' | 'updown';
      mode: 'wait' | 'tempo';
      tempo?: number;
    })
  | (ActivityBase & {
      type: 'tip';
      insight: Insight;
    });

export type ActivityType = ActivityDef['type'];

export type LessonKind = 'learn' | 'practice' | 'song' | 'checkpoint' | 'challenge';

export interface LessonDef {
  id: string;
  title: string;
  kind: LessonKind;
  /** What you'll learn (short). */
  goal: string;
  intro?: Insight[];
  steps: ActivityDef[];
}

export interface UnitDef {
  id: string;
  title: string;
  summary: string;
  /** Skills unlocked, shown as chips */
  skills?: string[];
  lessons: LessonDef[];
}

export interface TrackDef {
  id: TrackId;
  instrument: Instrument;
  title: string;
  subtitle: string;
  description: string;
  /** Primary clef shown in this track ('chords' = a chord-shapes track) */
  clef: Clef | 'grand' | 'fretboard' | 'chords';
  hand?: Hand;
  /** CSS colour for accents */
  accent: string;
  /** Short label for the badge (e.g. 𝄞, 𝄢) */
  glyph: string;
  /** Range of notes this track's mastery heatmap covers */
  heatmap: { clef: Clef; low: string; high: string }[];
  units: UnitDef[];
  /** Recommended prerequisites (soft) */
  recommends?: TrackId[];
}
