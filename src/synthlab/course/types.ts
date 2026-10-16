/**
 * Synth School's course: units of lessons, each lesson a few steps.
 *
 * A lesson shows only the controls it lists (`controls`), so a learner meets a synth one
 * or two knobs at a time; `fresh` marks the ones this lesson introduces. Its steps:
 *
 * - **explain**: a short read, with the panel there to try things.
 * - **explore**: little tasks that tick themselves off as you do them ("turn the attack
 *   past a second, then play a note"). Experimenting, with a goal.
 * - **listen**: ear training: hear a sound, say what it is (fast or slow attack? which wave?).
 * - **match**: the quiz. A target sound plays; rebuild it with the controls you have. It
 *   doesn't need to be exact: it passes when it sounds close (dsp/match.ts).
 *
 * Patches in lessons are deltas on the lesson's `start`, which is itself a delta on the
 * init patch, so a lesson reads as "what's different".
 *
 * Lesson and unit ids are saved in profiles: never rename one.
 */
import type { EngineKind, ParamKey, Patch, PatchDelta } from '../dsp/params';
import type { PhraseId } from '../dsp/render';
import type { LoopId } from '../audio/loops';

export interface Task {
  text: string;
  /** Done when this holds… */
  check: (p: Patch) => boolean;
  /** …and a note is played while it holds (hearing the result is the point). */
  play?: boolean;
}

interface StepBase {
  title: string;
  /** Plain text; **bold**, *italic*, and lines starting "- " as a list. Blank lines split paragraphs. */
  body: string;
  /** Reset the patch to the lesson's start plus this before the step. */
  start?: PatchDelta;
  /** Show only these controls in this step (default: the lesson's). */
  controls?: ParamKey[];
}

export interface ExplainStep extends StepBase {
  type: 'explain';
  /** A picture alongside the text. */
  visual?: VisualId;
}

export interface ExploreStep extends StepBase {
  type: 'explore';
  tasks: Task[];
  /** Start this loop playing to make knob-turning easy. */
  loop?: LoopId;
}

export interface ListenRound {
  /** The sound (a delta on the lesson's start). */
  patch: PatchDelta;
  answer: string;
  phrase?: PhraseId;
}

export interface ListenStep extends StepBase {
  type: 'listen';
  question: string;
  options: { value: string; label: string }[];
  rounds: ListenRound[];
}

export interface MatchStep extends StepBase {
  type: 'match';
  /** The sound to rebuild (a delta on the lesson's start + this step's start). */
  target: PatchDelta;
  phrase?: PhraseId;
  /** Score needed to pass (default PASS_MARK). */
  pass?: number;
}

export type StepDef = ExplainStep | ExploreStep | ListenStep | MatchStep;

/** Pictures an explain step can show. */
export type VisualId = 'signal-flow' | 'waveforms' | 'harmonics' | 'adsr' | 'filter-types' | 'lfo' | 'fm' | 'additive' | 'wavetable';

export type LessonKind = 'learn' | 'quiz' | 'checkpoint' | 'project';

export interface SynthLesson {
  id: string;
  title: string;
  goal: string;
  kind: LessonKind;
  start: PatchDelta;
  controls: ParamKey[];
  fresh?: ParamKey[];
  steps: StepDef[];
}

export interface SynthUnit {
  id: string;
  title: string;
  subtitle: string;
  /** One line for the course map. */
  description: string;
  engine: EngineKind;
  /** Units that must be finished first (default: the one before). */
  requires?: string[];
  lessons: SynthLesson[];
}

/** Default quiz pass mark. */
export const PASS_MARK = 0.75;
