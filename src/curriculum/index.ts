import type { TrackId } from '../state/types';
import type { LessonDef, TrackDef, UnitDef } from './types';
import { pianoTreble } from './tracks/pianoTreble';
import { pianoBass } from './tracks/pianoBass';
import { pianoGrand } from './tracks/pianoGrand';
import { guitarTreble } from './tracks/guitarTreble';
import { guitarBass } from './tracks/guitarBass';
import { guitarFretboard } from './tracks/guitarFretboard';
import { guitarChords } from './tracks/guitarChords';
import { ukuleleChords } from './tracks/ukuleleChords';
import { ukuleleTreble } from './tracks/ukuleleTreble';
import { bassLines } from './tracks/bassLines';
import { bassFretboard } from './tracks/bassFretboard';
import { malletsTwo } from './tracks/malletsTwo';
import { malletsFour } from './tracks/malletsFour';
import { violinTreble } from './tracks/violinTreble';
import { violaAlto } from './tracks/violaAlto';
import { celloBass } from './tracks/celloBass';
import { doubleBassLines } from './tracks/doubleBassLines';

export const TRACKS: TrackDef[] = [
  pianoTreble,
  pianoBass,
  pianoGrand,
  guitarTreble,
  guitarBass,
  guitarFretboard,
  guitarChords,
  ukuleleTreble,
  ukuleleChords,
  bassLines,
  bassFretboard,
  malletsTwo,
  malletsFour,
  violinTreble,
  violaAlto,
  celloBass,
  doubleBassLines,
];

const byId = new Map(TRACKS.map(t => [t.id, t]));

export function getTrack(id: TrackId | string): TrackDef | undefined {
  return byId.get(id as TrackId);
}

export interface LessonRef {
  track: TrackDef;
  unit: UnitDef;
  unitIndex: number;
  lesson: LessonDef;
  lessonIndex: number;
  /** index across the whole track */
  flatIndex: number;
}

export function allLessons(track: TrackDef): LessonRef[] {
  const out: LessonRef[] = [];
  track.units.forEach((unit, unitIndex) =>
    unit.lessons.forEach((lesson, lessonIndex) => out.push({ track, unit, unitIndex, lesson, lessonIndex, flatIndex: out.length })),
  );
  return out;
}

export function findLesson(trackId: string, lessonId: string): LessonRef | undefined {
  const t = getTrack(trackId);
  if (!t) return undefined;
  return allLessons(t).find(l => l.lesson.id === lessonId);
}

export function totalLessons(track: TrackDef): number {
  return track.units.reduce((s, u) => s + u.lessons.length, 0);
}
