/**
 * Theory School: the whole course, in order, grouped into parts. See types.ts for how
 * lessons work and src/theory/CLAUDE.md for adding one.
 */
import { courseNav } from '../../state/courseNav';
import type { Part, TheoryUnit } from './types';
import { cadencesUnit } from './units/cadences';
import { chromaticUnit } from './units/chromatic';
import { diatonicUnit } from './units/diatonic';
import { earUnit } from './units/ear';
import { formUnit } from './units/form';
import { intervalsUnit } from './units/intervals';
import { keysUnit } from './units/keys';
import { majorUnit } from './units/major';
import { melodyUnit } from './units/melody';
import { metreUnit } from './units/metre';
import { minorUnit } from './units/minor';
import { modesUnit } from './units/modes';
import { rhythmUnit } from './units/rhythm';
import { seventhsUnit } from './units/sevenths';
import { soundUnit } from './units/sound';
import { staffUnit } from './units/staff';
import { triadsUnit } from './units/triads';

export const COURSE: readonly TheoryUnit[] = [
  soundUnit,
  staffUnit,
  rhythmUnit,
  metreUnit,
  majorUnit,
  keysUnit,
  minorUnit,
  intervalsUnit,
  earUnit,
  // harmony needs intervals, not the ear-training unit
  { ...triadsUnit, requires: ['th-intervals'] },
  diatonicUnit,
  seventhsUnit,
  cadencesUnit,
  { ...melodyUnit, requires: ['th-cadences'] },
  modesUnit,
  chromaticUnit,
  formUnit,
];

export const THEORY = courseNav(COURSE);

/** The course map's sections (unit ids; a unit not in COURSE is skipped). */
export const PARTS: readonly Part[] = [
  { id: 'notation', title: 'Reading music', subtitle: 'What the dots and lines mean: pitch, the staff and its clefs, rhythm and metre.', units: ['th-sound', 'th-staff', 'th-rhythm', 'th-metre'] },
  { id: 'keys', title: 'Scales and keys', subtitle: 'Why a piece in G has an F♯: the major scale, key signatures, the circle of fifths and the minor keys.', units: ['th-major', 'th-keys', 'th-minor'] },
  { id: 'intervals', title: 'Intervals and the ear', subtitle: 'The distance between two notes, named exactly, and recognised by ear.', units: ['th-intervals', 'th-ear'] },
  { id: 'harmony', title: 'Harmony', subtitle: 'Chords from triads to sevenths, how they work in a key, and how progressions move and come to rest.', units: ['th-triads', 'th-diatonic', 'th-sevenths', 'th-cadences'] },
  { id: 'beyond', title: 'Beyond the basics', subtitle: 'Melody and phrasing, modes and the blues, chromatic harmony and modulation, and the shapes whole pieces take.', units: ['th-melody', 'th-modes', 'th-chromatic', 'th-form'] },
];
