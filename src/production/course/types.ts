/**
 * Production School's course: units of lessons, each lesson a few steps on a mixing
 * console with a session's tracks.
 *
 * A lesson names its session, the tracks it uses (a session's own, or extra takes with
 * recording faults baked in) and the controls it shows: a console met a section at a
 * time, the way Synth School shows a knob or two at a time. Its steps:
 *
 * - **explain**: a short read, with the loop to play and, often, buttons to hear the idea
 *   ("dry" and "with reverb") on the same tracks.
 * - **explore**: little tasks that tick themselves off as the console gets there.
 * - **listen**: ear training. Hear a mix, or two (A and B), and say what you hear.
 * - **mix**: the quiz. Make the mix sound like a target ("Target" and "Yours" switch the
 *   console back and forth while the loop plays), or meet goals (a loudness, a peak). The
 *   judge (dsp/judge.ts) listens to the result, not the settings.
 *
 * Mixes in lessons are deltas: a step's on the lesson's `start`, which is a delta on the
 * session's rough mix. Lesson and unit ids are saved in profiles: never rename one.
 */
import type { Rng } from '../../curriculum/generate';
import type { Aspect, Goal } from '../dsp/judge';
import type { Mix } from '../dsp/params';
import type { ChannelUse } from '../dsp/stems';

/**
 * A console section a lesson shows: `channel:section` (`bass:fader`, `*:eq` for every
 * channel), `master:section` or `fx:section`. Sections: channels `trim`, `hp`, `eq`,
 * `comp`, `fader`, `pan`, `mute`, `solo`, `reverb`, `delay`; master `comp`, `limiter`,
 * `fader`, `mono`; effects `reverb`, `delay`.
 */
export type ControlId = string;

/** A condition on the console, for explore tasks. */
export type Cond =
  | { key: string; above: number }
  | { key: string; below: number }
  | { key: string; between: [number, number] }
  | { all: Cond[] }
  | { any: Cond[] }
  /** The loop has been played (hearing it is the point). */
  | { playing: true }
  /** A meter reads this (dBFS for peaks, LUFS for loudness), while playing. */
  | { meter: 'masterPeak' | 'loudness' | 'clip'; above?: number; below?: number }
  | { meter: 'input' | 'reduction'; channel: string; above?: number; below?: number };

export interface Task {
  text: string;
  check: Cond;
}

interface StepBase {
  title: string;
  /** Plain text; **bold**, *italic*, and lines starting "- " as a list. Blank lines split paragraphs. */
  body: string;
  /** Reset the console to the lesson's start plus this before the step. */
  start?: Mix;
  /** Show only these controls in this step (default: the lesson's). */
  controls?: ControlId[];
}

/** A mix to hear: a delta on the step's starting point, with a name for its button. */
export interface Hear {
  label: string;
  mix: Mix;
}

export interface ExplainStep extends StepBase {
  type: 'explain';
  visual?: VisualId;
  /** Buttons to hear the idea (they set the console, which keeps playing). */
  hear?: Hear[];
}

export interface ExploreStep extends StepBase {
  type: 'explore';
  tasks: Task[];
}

export interface ListenRound {
  /** One mix to hear, or two to compare (A and B). Deltas on the step's start. */
  mixes: Mix[];
  answer: string;
  /** Said after the answer. */
  explain?: string;
}

export interface ListenStep extends StepBase {
  type: 'listen';
  question: string;
  options: { value: string; label: string }[];
  rounds: ListenRound[] | ((rng: Rng) => ListenRound[]);
}

export interface MixStep extends StepBase {
  type: 'mix';
  /** The mix to match (a delta on the lesson's start plus the step's start). */
  target?: Mix;
  /** Goals to meet (as well as, or instead of, a target). */
  goals?: Goal[];
  /** Aspects the judge counts (default: those the target changes). */
  aspects?: Aspect[];
  /** Channels the judge counts (default: all). */
  channels?: string[];
  /** Score needed to pass (default PASS_MARK). */
  pass?: number;
  /** For goals without a target: a mix that meets them (a delta, like a target). "Show answer" shows it, and the course test checks it passes. */
  answer?: Mix;
}

export type StepDef = ExplainStep | ExploreStep | ListenStep | MixStep;

/** Pictures an explain step can show. */
export type VisualId = 'signal-flow' | 'decibels' | 'stereo' | 'spectrum' | 'eq-curves' | 'compressor' | 'reverb' | 'gain-staging' | 'loudness';

export type LessonKind = 'learn' | 'quiz' | 'checkpoint' | 'project';

export interface ProductionLesson {
  id: string;
  title: string;
  goal: string;
  kind: LessonKind;
  session: string;
  /** The tracks (default: all of the session's). */
  channels?: (string | ChannelUse)[];
  /** A delta on the session's rough mix. */
  start?: Mix;
  controls: ControlId[];
  /** Controls this lesson introduces (marked "New"). */
  fresh?: ControlId[];
  steps: StepDef[];
}

export interface ProductionUnit {
  id: string;
  title: string;
  subtitle: string;
  /** One line for the course map. */
  description: string;
  /** Units that must be finished first (default: the one before). */
  requires?: string[];
  lessons: ProductionLesson[];
}

/** A lesson passes at this share of its graded score; a checkpoint at the second. */
export const LESSON_PASS = 0.7;
export const CHECKPOINT_PASS = 0.8;
