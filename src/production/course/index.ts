/**
 * Production School's course: the units in order, the parts they're grouped into on the
 * map, and the course's navigation (unlocking, what's next). See src/production/CLAUDE.md
 * for writing lessons.
 *
 * Unit and lesson ids are saved in profiles: never rename one.
 */
import type { CoursePart } from '../../components/CourseMap';
import { courseNav } from '../../state/courseNav';
import type { ProductionUnit } from './types';
import { MIX_UNIT } from './units/mix';
import { BALANCE_UNIT } from './units/balance';
import { PAN_UNIT } from './units/pan';
import { GAIN_UNIT } from './units/gain';
import { EQ_UNIT } from './units/eq';
import { COMP_UNIT } from './units/comp';
import { SPACE_UNIT } from './units/space';
import { BUS_UNIT } from './units/bus';
import { MASTER_UNIT } from './units/master';
import { PROJECTS_UNIT } from './units/projects';

export const COURSE: readonly ProductionUnit[] = [MIX_UNIT, BALANCE_UNIT, PAN_UNIT, GAIN_UNIT, EQ_UNIT, COMP_UNIT, SPACE_UNIT, BUS_UNIT, MASTER_UNIT, PROJECTS_UNIT];

export const PRODUCTION = courseNav(COURSE);

export const PARTS: readonly CoursePart[] = [
  { id: 'hearing', title: 'Hearing a mix', subtitle: 'What’s in a song, levels and balance, and the stereo picture.', units: ['pr-mix', 'pr-balance', 'pr-pan'] },
  { id: 'shaping', title: 'Shaping the sound', subtitle: 'Recording clean takes at the right level, then EQ and compression to make each part fit.', units: ['pr-gain', 'pr-eq', 'pr-comp'] },
  { id: 'finish', title: 'Space and the finish', subtitle: 'Reverb and delay, the mix bus, mastering for loudness, and whole mixes from rough to finished.', units: ['pr-space', 'pr-bus', 'pr-master', 'pr-projects'] },
];
