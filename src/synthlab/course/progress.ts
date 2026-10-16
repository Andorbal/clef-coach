/**
 * Where a learner is in Synth School: which units are open, what's next, which controls
 * they've met (the Synth Lab can show only those).
 *
 * A unit opens when the units it requires are finished (its checkpoint passed), and every
 * lesson in an open unit can be played, with the next one suggested. A locked unit can be
 * tested out of: pass its checkpoint and its lessons count as done, as in the main course.
 */
import type { ParamKey } from '../dsp/params';
import type { LessonProgress, SynthProgress } from '../../state/types';
import { COURSE } from './index';
import type { SynthLesson, SynthUnit } from './types';

export interface LessonRef {
  unit: SynthUnit;
  unitIndex: number;
  lesson: SynthLesson;
  /** Position within the unit. */
  index: number;
  /** Position in the whole course. */
  flat: number;
}

let flatCache: LessonRef[] | null = null;

export function allLessons(): LessonRef[] {
  if (flatCache) return flatCache;
  const out: LessonRef[] = [];
  COURSE.forEach((unit, unitIndex) => unit.lessons.forEach((lesson, index) => out.push({ unit, unitIndex, lesson, index, flat: out.length })));
  return (flatCache = out);
}

export function findLesson(id: string): LessonRef | undefined {
  return allLessons().find(r => r.lesson.id === id);
}

export function getUnit(id: string): SynthUnit | undefined {
  return COURSE.find(u => u.id === id);
}

const passed = (sp: SynthProgress | undefined, id: string): LessonProgress | undefined => {
  const l = sp?.lessons[id];
  return l?.passed ? l : undefined;
};

/** The checkpoint (last lesson) passed, or every lesson passed. */
export function unitComplete(unit: SynthUnit, sp: SynthProgress | undefined): boolean {
  const last = unit.lessons[unit.lessons.length - 1];
  return !!passed(sp, last.id) || unit.lessons.every(l => passed(sp, l.id));
}

export function unitRequires(unit: SynthUnit): SynthUnit[] {
  const i = COURSE.indexOf(unit);
  const ids = unit.requires ?? (i > 0 ? [COURSE[i - 1].id] : []);
  return ids.map(id => COURSE.find(u => u.id === id)).filter((u): u is SynthUnit => !!u);
}

export function unitUnlocked(unit: SynthUnit, sp: SynthProgress | undefined): boolean {
  if (unit.lessons.some(l => passed(sp, l.id))) return true;
  return unitRequires(unit).every(u => unitComplete(u, sp));
}

/** Share of the unit's lessons passed (0..1). */
export function unitCompletion(unit: SynthUnit, sp: SynthProgress | undefined): number {
  return unit.lessons.filter(l => passed(sp, l.id)).length / unit.lessons.length;
}

export function courseCompletion(sp: SynthProgress | undefined): number {
  const all = allLessons();
  return all.filter(r => passed(sp, r.lesson.id)).length / all.length;
}

/** The lesson to suggest: the first one not yet passed in an open unit. */
export function nextLesson(sp: SynthProgress | undefined): LessonRef | null {
  return allLessons().find(r => !passed(sp, r.lesson.id) && unitUnlocked(r.unit, sp)) ?? null;
}

/** Every control met in a passed lesson. */
export function learnedControls(sp: SynthProgress | undefined): Set<ParamKey> {
  const out = new Set<ParamKey>();
  if (!sp) return out;
  for (const r of allLessons()) if (passed(sp, r.lesson.id)) for (const k of r.lesson.controls) out.add(k);
  return out;
}

/** Lessons marked done when a locked unit's checkpoint is passed early (the unit's own lessons). */
export function testOutLessonIds(unit: SynthUnit): string[] {
  return unit.lessons.map(l => l.id);
}

/** The lesson after this one in the course (for "Next lesson"). */
export function lessonAfter(id: string): LessonRef | null {
  const all = allLessons();
  const i = all.findIndex(r => r.lesson.id === id);
  return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
}
