/**
 * Theory School's course: units of lessons, each lesson a few steps, all on a staff and a
 * keyboard. The keyboard is there to try things, not to learn the piano: the lessons ask
 * for notes, never for technique, and a MIDI keyboard, the microphone or the on-screen
 * keys all work.
 *
 * A lesson's steps:
 *
 * - **explain**: a short read beside a figure (notes on the staff, lit keys, "hear it").
 *   The keyboard stays live: whatever is played appears on the staff, named.
 * - **explore**: little tasks that tick themselves off as you play ("play any perfect 5th",
 *   "hold a minor triad"). Experimenting, with a goal.
 * - **quiz**: questions with a few answers to choose from, by eye (the staff), by ear, or
 *   both. Rounds can be written out or generated afresh each time.
 * - **build**: play the answer ("play a major 3rd above E", "play the dominant of G").
 * - **drill**: one of the instrument tracks' activities (naming notes, key signatures,
 *   tapping a rhythm), on the piano.
 *
 * Lesson and unit ids are saved in profiles: never rename one.
 */
import type { ActivityDef } from '../../curriculum/types';
import type { Rng } from '../../curriculum/generate';
import type { TimeSig } from '../../music/rhythm';
import type { Clef } from '../../music/score';
import type { ScaleId } from '../theory';

/** Notes on the staff (and keys on the keyboard) beside a step. */
export interface Figure {
  /**
   * Music in the text notation (src/music/parse.ts): "C4 E4 G4" one after another,
   * "[C4 E4 G4]" together, "C4/q D4/e E4/e | F4/h" with rhythm and bars.
   */
  notes: string;
  /** Default: the treble clef, or the grand staff when the notes need it. */
  clef?: Clef | 'grand';
  key?: string;
  /** Show this time signature (and bar lines). */
  time?: TimeSig;
  /**
   * Labels under the notes: their names, scale degrees (in `key`), the steps between
   * neighbours (W / H), the intervals from the first note, or given text (one per note or
   * chord, "" for none).
   */
  labels?: 'names' | 'degrees' | 'steps' | 'intervals' | string[];
  /** Keys lit on the keyboard (default: the figure's notes; false: none). */
  keys?: string[] | false;
  /** How "Hear it" plays the notes: as written, all together, or one after another then together. */
  play?: 'as-written' | 'together' | 'apart-then-together' | 'none';
  /** Beats per minute for "Hear it" (default 92). */
  tempo?: number;
  /** Keep the notes off the staff (before the staff is taught): the keyboard and the sound only. */
  staff?: false;
}

/**
 * What a task or a "play it" round listens for. Note names without an octave ("E", "F#")
 * match in any octave; with one ("E4"), only there.
 */
export type Check =
  /** Play this note. */
  | { kind: 'note'; note: string }
  /** Hold these notes together (`any` octave), or play them in this order (`inOrder`). */
  | { kind: 'notes'; notes: string[]; inOrder?: boolean }
  /** An interval of so many semitones: held together or one after the other, optionally from a note, up or down from it. */
  | { kind: 'interval'; semitones: number[]; from?: string; together?: boolean; up?: boolean; down?: boolean; compound?: boolean }
  /** Hold a chord of one of these qualities (chord quality ids, e.g. "maj", "min", "7"), on a root, in an inversion. */
  | { kind: 'chord'; qualities: string[]; root?: string; inversion?: number }
  /** Play a scale up from its tonic, one note after another. */
  | { kind: 'scale'; tonic: string; scale: ScaleId; down?: boolean }
  /** Play anything (just to hear it). */
  | { kind: 'any'; count?: number };

export interface Task {
  text: string;
  check: Check;
}

export interface QuizRound {
  /** Overrides the step's question for this round. */
  prompt?: string;
  figure?: Figure;
  options: string[];
  answer: string;
  /** Shown after the answer (why it's right). */
  explain?: string;
}

export interface BuildRound {
  prompt: string;
  /** Notes to show (the starting note, a key signature…). */
  figure?: Figure;
  check: Check;
  /** The notes of a right answer: shown after two misses, and proof (in the tests) that the round can be answered. */
  answer: string[];
  explain?: string;
}

interface StepBase {
  title: string;
  /** Plain text; **bold**, *italic*, and lines starting "- " as a list. Blank lines split paragraphs. */
  body: string;
  /** Notes on the staff and keyboard beside the text. */
  figure?: Figure;
}

export interface ExplainStep extends StepBase {
  type: 'explain';
}

export interface ExploreStep extends StepBase {
  type: 'explore';
  tasks: Task[];
}

export interface QuizStep extends StepBase {
  type: 'quiz';
  question: string;
  /** See the notes, only hear them (ear training), or both. */
  mode?: 'see' | 'hear' | 'both';
  /** Written rounds, or a generator (called with a fresh seed each run). */
  rounds: QuizRound[] | ((rng: Rng) => QuizRound[]);
}

export interface BuildStep extends StepBase {
  type: 'build';
  rounds: BuildRound[] | ((rng: Rng) => BuildRound[]);
  /** 'hear': the round's figure is played, not shown (play back what you hear). */
  mode?: 'see' | 'hear';
}

export interface DrillStep extends StepBase {
  type: 'drill';
  activity: ActivityDef;
}

export type StepDef = ExplainStep | ExploreStep | QuizStep | BuildStep | DrillStep;

export type LessonKind = 'learn' | 'practice' | 'ear' | 'checkpoint';

export interface TheoryLesson {
  id: string;
  title: string;
  goal: string;
  kind: LessonKind;
  /** The key the lesson thinks in: notes played are spelled and named in it. */
  key?: string;
  /** The keyboard's range (default C3–C6, narrowed on small screens). */
  range?: [string, string];
  /** Topics this lesson teaches (see links.ts): instrument lessons that use them link here. */
  topics?: string[];
  steps: StepDef[];
}

export interface TheoryUnit {
  id: string;
  title: string;
  subtitle: string;
  /** One line for the course map. */
  description: string;
  /** Units that must be finished first (default: the one before). */
  requires?: string[];
  lessons: TheoryLesson[];
}

export interface Part {
  id: string;
  title: string;
  subtitle: string;
  units: string[];
}

/** Pass marks. */
export const PASS_MARK = 0.7;
export const CHECKPOINT_PASS = 0.8;
