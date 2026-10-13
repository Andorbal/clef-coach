import { allLessons, type LessonRef } from '../curriculum';
import type { TrackDef } from '../curriculum/types';
import { mastery } from '../state/srs';
import type { TrackProgress } from '../state/types';

export type LessonStatus = 'locked' | 'available' | 'current' | 'passed';

export interface TrackSummary {
  lessons: (LessonRef & { status: LessonStatus; stars: number })[];
  passed: number;
  total: number;
  stars: number;
  maxStars: number;
  current: LessonRef | null;
  currentUnitIndex: number;
  /** 0..1 */
  completion: number;
  finished: boolean;
}

export function summarizeTrack(track: TrackDef, tp?: TrackProgress): TrackSummary {
  const refs = allLessons(track);
  let frontier = 0;
  refs.forEach((r, i) => {
    if (tp?.lessons[r.lesson.id]?.passed) frontier = Math.max(frontier, i + 1);
  });
  // first not-yet-passed lesson at or before the frontier is "current"
  let currentIdx = refs.findIndex((r, i) => i <= frontier && !tp?.lessons[r.lesson.id]?.passed);
  if (currentIdx < 0) currentIdx = Math.min(frontier, refs.length - 1);
  const lessons = refs.map((r, i) => {
    const lp = tp?.lessons[r.lesson.id];
    let status: LessonStatus;
    if (lp?.passed) status = 'passed';
    else if (i === currentIdx) status = 'current';
    else if (i <= frontier) status = 'available';
    else status = 'locked';
    return { ...r, status, stars: lp?.stars ?? 0 };
  });
  const passed = lessons.filter(l => l.status === 'passed').length;
  const stars = lessons.reduce((s, l) => s + l.stars, 0);
  const finished = passed === refs.length;
  const current = finished ? null : refs[currentIdx] ?? null;
  return {
    lessons,
    passed,
    total: refs.length,
    stars,
    maxStars: refs.length * 3,
    current,
    currentUnitIndex: current?.unitIndex ?? track.units.length - 1,
    completion: refs.length ? passed / refs.length : 0,
    finished,
  };
}

/** Lesson ids that a passed test-out of `unitIndex` should unlock (all units up to and including it). */
export function testOutLessonIds(track: TrackDef, unitIndex: number): string[] {
  return track.units.slice(0, unitIndex + 1).flatMap(u => u.lessons.map(l => l.id));
}

/** Average mastery of a list of item keys (0..1). */
export function averageMastery(tp: TrackProgress | undefined, keys: string[]): number {
  if (!tp || !keys.length) return 0;
  return keys.reduce((s, k) => s + mastery(tp.items[k]), 0) / keys.length;
}
