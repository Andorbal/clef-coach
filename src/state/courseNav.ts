/**
 * Where a learner is in a course of units and lessons (Theory School, Production School):
 * which units are open, what's next, how much is done. The same rules as Synth School's
 * (src/synthlab/course/progress.ts):
 *
 * - A unit opens when the units it requires are finished (its checkpoint passed, or every
 *   lesson); by default each unit requires the one before. A unit with a lesson passed
 *   stays open.
 * - Every lesson of an open unit can be played; the first one not yet passed is suggested.
 * - A locked unit can be tested out of: pass its checkpoint and its lessons count as done.
 */
import type { CourseProgress, LessonProgress } from './types';

export interface NavLesson {
  id: string;
  title: string;
  kind: string;
}

export interface NavUnit<L extends NavLesson = NavLesson> {
  id: string;
  title: string;
  /** Units that must be finished first (default: the one before). */
  requires?: string[];
  lessons: L[];
}

export interface NavRef<U extends NavUnit> {
  unit: U;
  unitIndex: number;
  lesson: U['lessons'][number];
  /** Position within the unit. */
  index: number;
  /** Position in the whole course. */
  flat: number;
}

export interface CourseNav<U extends NavUnit> {
  units: readonly U[];
  allLessons(): NavRef<U>[];
  findLesson(id: string): NavRef<U> | undefined;
  getUnit(id: string): U | undefined;
  unitComplete(unit: U, cp: CourseProgress | undefined): boolean;
  unitRequires(unit: U): U[];
  unitUnlocked(unit: U, cp: CourseProgress | undefined): boolean;
  /** Share of the unit's lessons passed (0..1). */
  unitCompletion(unit: U, cp: CourseProgress | undefined): number;
  courseCompletion(cp: CourseProgress | undefined): number;
  /** The lesson to suggest: the first not yet passed in an open unit. */
  nextLesson(cp: CourseProgress | undefined): NavRef<U> | null;
  /** The lesson after this one (for "Next lesson"). */
  lessonAfter(id: string): NavRef<U> | null;
  /** Lessons marked done when a locked unit's checkpoint is passed early. */
  testOutLessonIds(unit: U): string[];
  totalLessons: number;
}

export function lessonPassed(cp: CourseProgress | undefined, id: string): LessonProgress | undefined {
  const l = cp?.lessons[id];
  return l?.passed ? l : undefined;
}

export function courseNav<U extends NavUnit>(units: readonly U[]): CourseNav<U> {
  const flat: NavRef<U>[] = [];
  units.forEach((unit, unitIndex) => unit.lessons.forEach((lesson, index) => flat.push({ unit, unitIndex, lesson, index, flat: flat.length })));
  const byId = new Map(flat.map(r => [r.lesson.id, r]));
  const unitComplete = (unit: U, cp: CourseProgress | undefined) => {
    const last = unit.lessons[unit.lessons.length - 1];
    return !!lessonPassed(cp, last.id) || unit.lessons.every(l => lessonPassed(cp, l.id));
  };
  const unitRequires = (unit: U) => {
    const i = units.indexOf(unit);
    const ids = unit.requires ?? (i > 0 ? [units[i - 1].id] : []);
    return ids.map(id => units.find(u => u.id === id)).filter((u): u is U => !!u);
  };
  const unitUnlocked = (unit: U, cp: CourseProgress | undefined) => unit.lessons.some(l => lessonPassed(cp, l.id)) || unitRequires(unit).every(u => unitComplete(u, cp));
  return {
    units,
    allLessons: () => flat,
    findLesson: id => byId.get(id),
    getUnit: id => units.find(u => u.id === id),
    unitComplete,
    unitRequires,
    unitUnlocked,
    unitCompletion: (unit, cp) => unit.lessons.filter(l => lessonPassed(cp, l.id)).length / unit.lessons.length,
    courseCompletion: cp => (flat.length ? flat.filter(r => lessonPassed(cp, r.lesson.id)).length / flat.length : 0),
    nextLesson: cp => flat.find(r => !lessonPassed(cp, r.lesson.id) && unitUnlocked(r.unit, cp)) ?? null,
    lessonAfter: id => {
      const r = byId.get(id);
      return r && r.flat + 1 < flat.length ? flat[r.flat + 1] : null;
    },
    testOutLessonIds: unit => unit.lessons.map(l => l.id),
    totalLessons: flat.length,
  };
}
