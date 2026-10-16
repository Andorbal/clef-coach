/**
 * Small constructors that keep the course files readable: a lesson is a title, a start
 * patch, the controls on show and a list of steps.
 */
import type { ParamKey, Patch, PatchDelta } from '../dsp/params';
import type { PhraseId } from '../dsp/render';
import type { LoopId } from '../audio/loops';
import type { ExplainStep, ExploreStep, LessonKind, ListenRound, ListenStep, MatchStep, SynthLesson, Task, VisualId } from './types';

export function lesson(id: string, title: string, goal: string, kind: LessonKind, o: { start: PatchDelta; controls: ParamKey[]; fresh?: ParamKey[] }, steps: SynthLesson['steps']): SynthLesson {
  return { id, title, goal, kind, start: o.start, controls: [...new Set(o.controls)], fresh: o.fresh, steps };
}

type StepOpts = { start?: PatchDelta; controls?: ParamKey[] };

export const explain = (title: string, body: string, o: StepOpts & { visual?: VisualId } = {}): ExplainStep => ({ type: 'explain', title, body, ...o });

export const explore = (title: string, body: string, tasks: Task[], o: StepOpts & { loop?: LoopId } = {}): ExploreStep => ({ type: 'explore', title, body, tasks, ...o });

/** A task that ticks when the patch matches and a note is played. */
export const task = (text: string, check: (p: Patch) => boolean, play = true): Task => ({ text, check, play });

/** Just play something. */
export const playTask = (text = 'Play a few notes (tap the keys, or use A S D F… on a keyboard)'): Task => ({ text, check: () => true, play: true });

export const listen = (title: string, body: string, question: string, options: [string, string][], rounds: ListenRound[], o: StepOpts = {}): ListenStep => ({
  type: 'listen',
  title,
  body,
  question,
  options: options.map(([value, label]) => ({ value, label })),
  rounds,
  ...o,
});

export const round = (answer: string, patch: PatchDelta, phrase?: PhraseId): ListenRound => ({ answer, patch, phrase });

export const match = (title: string, body: string, target: PatchDelta, o: StepOpts & { phrase?: PhraseId; pass?: number } = {}): MatchStep => ({ type: 'match', title, body, target, ...o });

/** Groups of controls, in the order lessons usually introduce them. */
export const C = {
  wave: ['osc1Wave'] as ParamKey[],
  pitch: ['osc1Octave', 'osc1Semi'] as ParamKey[],
  volume: ['volume'] as ParamKey[],
  ampAR: ['ampAttack', 'ampRelease'] as ParamKey[],
  ampADSR: ['ampAttack', 'ampDecay', 'ampSustain', 'ampRelease'] as ParamKey[],
  cutoff: ['filterCutoff'] as ParamKey[],
  filter: ['filterType', 'filterSlope', 'filterCutoff', 'filterRes'] as ParamKey[],
  filterEnv: ['filterEnv', 'fAttack', 'fDecay', 'fSustain', 'fRelease'] as ParamKey[],
  osc2: ['osc2Wave', 'osc2Octave', 'osc2Semi', 'osc2Fine'] as ParamKey[],
  levels: ['osc1Level', 'osc2Level'] as ParamKey[],
  lfoBasic: ['lfoShape', 'lfoRate'] as ParamKey[],
  modEnv: ['modAttack', 'modDecay', 'modPitch'] as ParamKey[],
  unison: ['unison', 'unisonDetune', 'unisonWidth'] as ParamKey[],
  voice: ['voiceMode', 'glide'] as ParamKey[],
  op: (n: 1 | 2 | 3 | 4, ...which: ('Ratio' | 'Level' | 'Attack' | 'Decay' | 'Sustain' | 'Release')[]): ParamKey[] =>
    (which.length ? which : (['Ratio', 'Level', 'Attack', 'Decay', 'Sustain', 'Release'] as const)).map(w => `op${n}${w}` as ParamKey),
  harmonics: (n: number): ParamKey[] => Array.from({ length: n }, (_, i) => `h${i + 1}` as ParamKey),
  fx: ['drive', 'chorusMix', 'chorusRate', 'chorusDepth', 'delayMix', 'delayDiv', 'delayFeedback', 'reverbMix', 'reverbSize'] as ParamKey[],
};

/** Every control of the subtractive panel (for the projects). */
export const ALL_SUBTRACTIVE: ParamKey[] = [
  'osc1Wave', 'osc1Octave', 'osc1Semi', 'osc1Fine', 'osc1Pw',
  'osc2Wave', 'osc2Octave', 'osc2Semi', 'osc2Fine', 'osc2Pw', 'osc2Sync',
  'osc1Level', 'osc2Level', 'subLevel', 'subWave', 'noiseLevel', 'ringLevel',
  'filterType', 'filterSlope', 'filterCutoff', 'filterRes', 'filterEnv', 'filterKey', 'filterDrive',
  'fAttack', 'fDecay', 'fSustain', 'fRelease',
  'ampAttack', 'ampDecay', 'ampSustain', 'ampRelease', 'volume',
  'lfoShape', 'lfoRate', 'lfoSync', 'lfoDiv', 'lfoFade', 'lfoPitch', 'lfoCutoff', 'lfoAmp', 'lfoPw',
  'modAttack', 'modDecay', 'modPitch', 'modOsc2',
  'voiceMode', 'glide', 'unison', 'unisonDetune', 'unisonWidth',
  'drive', 'chorusMix', 'chorusRate', 'chorusDepth', 'delayMix', 'delayDiv', 'delayFeedback', 'reverbMix', 'reverbSize',
];
