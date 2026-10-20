/**
 * Small constructors that keep the course files readable, conditions for explore tasks,
 * and generators for ear-training rounds that come out different each time.
 */
import type { Rng } from '../../curriculum/generate';
import type { Aspect, Goal } from '../dsp/judge';
import type { Mix } from '../dsp/params';
import type { ChannelUse } from '../dsp/stems';
import type {
  Cond,
  ControlId,
  ExplainStep,
  ExploreStep,
  Hear,
  LessonKind,
  ListenRound,
  ListenStep,
  MixStep,
  ProductionLesson,
  ProductionUnit,
  StepDef,
  Task,
  VisualId,
} from './types';

export function lesson(
  id: string,
  title: string,
  kind: LessonKind,
  goal: string,
  o: { session: string; channels?: (string | ChannelUse)[]; start?: Mix; controls: ControlId[]; fresh?: ControlId[] },
  steps: StepDef[],
): ProductionLesson {
  return { id, title, kind, goal, ...o, steps };
}

export function unit(id: string, title: string, subtitle: string, description: string, lessons: ProductionLesson[], o: { requires?: string[] } = {}): ProductionUnit {
  return { id, title, subtitle, description, lessons, ...o };
}

type StepOpts = { start?: Mix; controls?: ControlId[] };

export const explain = (title: string, body: string, o: StepOpts & { visual?: VisualId; hear?: Hear[] } = {}): ExplainStep => ({ type: 'explain', title, body, ...o });

export const hear = (label: string, mix: Mix = {}): Hear => ({ label, mix });

export const explore = (title: string, body: string, tasks: Task[], o: StepOpts = {}): ExploreStep => ({ type: 'explore', title, body, tasks, ...o });

export const task = (text: string, check: Cond): Task => ({ text, check });

export function listen(
  title: string,
  body: string,
  question: string,
  options: (string | { value: string; label: string })[],
  rounds: ListenStep['rounds'],
  o: StepOpts = {},
): ListenStep {
  return { type: 'listen', title, body, question, options: options.map(x => (typeof x === 'string' ? { value: x, label: x } : x)), rounds, ...o };
}

export const round = (mixes: Mix[], answer: string, explain?: string): ListenRound => ({ mixes, answer, explain });

export const mix = (title: string, body: string, o: StepOpts & { target?: Mix; goals?: Goal[]; aspects?: Aspect[]; channels?: string[]; pass?: number; answer?: Mix }): MixStep => ({ type: 'mix', title, body, ...o });

/** Conditions for explore tasks. */
export const C = {
  above: (key: string, v: number): Cond => ({ key, above: v }),
  below: (key: string, v: number): Cond => ({ key, below: v }),
  between: (key: string, lo: number, hi: number): Cond => ({ key, between: [lo, hi] }),
  on: (key: string): Cond => ({ key, above: 0.5 }),
  off: (key: string): Cond => ({ key, below: 0.5 }),
  all: (...c: Cond[]): Cond => ({ all: c }),
  any: (...c: Cond[]): Cond => ({ any: c }),
  playing: { playing: true } as Cond,
  peakBelow: (db: number): Cond => ({ meter: 'masterPeak', below: db }),
  peakAbove: (db: number): Cond => ({ meter: 'masterPeak', above: db }),
  loudness: (lo: number, hi: number): Cond => ({ meter: 'loudness', above: lo, below: hi }),
  clipped: { meter: 'clip', above: 0 } as Cond,
  input: (channel: string, lo: number, hi: number): Cond => ({ meter: 'input', channel, above: lo, below: hi }),
  reducing: (channel: string, db: number): Cond => ({ meter: 'reduction', channel, above: db }),
};

/** What the meters said lately (the explore checks read it). */
export interface MeterState {
  masterPeak: number;
  loudness: number;
  clipped: boolean;
  input: Record<string, number>;
  reduction: Record<string, number>;
}

/** Does the console meet a condition? */
export function holds(c: Cond, mix: Mix, s: { playing: boolean; meters: MeterState | null }): boolean {
  if ('all' in c) return c.all.every(x => holds(x, mix, s));
  if ('any' in c) return c.any.some(x => holds(x, mix, s));
  if ('playing' in c) return s.playing;
  if ('meter' in c) {
    const m = s.meters;
    if (!s.playing || !m) return false;
    const v = 'channel' in c ? (c.meter === 'input' ? m.input[c.channel] ?? -Infinity : m.reduction[c.channel] ?? 0) : c.meter === 'masterPeak' ? m.masterPeak : c.meter === 'loudness' ? m.loudness : m.clipped ? 1 : 0;
    return (c.above === undefined || v > c.above) && (c.below === undefined || v < c.below);
  }
  const v = mix[c.key];
  if (v === undefined) return false;
  if ('above' in c) return v > c.above;
  if ('below' in c) return v < c.below;
  return v >= c.between[0] && v <= c.between[1];
}

/** The mix keys a condition reads (for the course test). */
export function condKeys(c: Cond): string[] {
  if ('all' in c) return c.all.flatMap(condKeys);
  if ('any' in c) return c.any.flatMap(condKeys);
  if ('key' in c) return [c.key];
  return [];
}

// ---------------------------------------------------------------------------
// Round generators
// ---------------------------------------------------------------------------

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A or B: which of two mixes has `quality`? Each round puts the change on A or B at random.
 * `make(rng)` gives the plain mix and the changed one.
 */
export function abRounds(count: number, make: (rng: Rng, i: number) => { plain: Mix; changed: Mix; explain?: string }) {
  return (rng: Rng): ListenRound[] =>
    Array.from({ length: count }, (_, i) => {
      const { plain, changed, explain } = make(rng, i);
      const onA = rng() < 0.5;
      return { mixes: onA ? [changed, plain] : [plain, changed], answer: onA ? 'A' : 'B', explain };
    });
}

/** One mix per round, named from a list of (answer, mix) choices, drawn without repeating where possible. */
export function namedRounds(count: number, choices: readonly { answer: string; mix: Mix; explain?: string }[]) {
  return (rng: Rng): ListenRound[] => {
    const out: ListenRound[] = [];
    let bag: typeof choices[number][] = [];
    for (let i = 0; i < count; i++) {
      if (!bag.length) bag = shuffle(rng, choices);
      const c = bag.pop()!;
      out.push({ mixes: [c.mix], answer: c.answer, explain: c.explain });
    }
    return out;
  };
}
