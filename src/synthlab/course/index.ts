/**
 * Synth School: the whole course, in order, grouped into parts by kind of synthesis.
 * See types.ts for how lessons work and src/synthlab/CLAUDE.md for adding one.
 */
import type { SynthUnit } from './types';
import { additiveUnit } from './units/additive';
import { filterUnit } from './units/filter';
import { fmUnit } from './units/fm';
import { lfoUnit } from './units/modulation';
import { designUnit, effectsUnit } from './units/production';
import { sourcesUnit } from './units/sources';
import { specialUnit } from './units/special';
import { wavetableUnit } from './units/wavetable';
import { ampUnit, oscillatorUnit } from './units/sound';

export const COURSE: readonly SynthUnit[] = [
  oscillatorUnit,
  ampUnit,
  filterUnit,
  sourcesUnit,
  lfoUnit,
  specialUnit,
  fmUnit,
  additiveUnit,
  wavetableUnit,
  effectsUnit,
  designUnit,
];

export interface Part {
  id: string;
  title: string;
  subtitle: string;
  units: string[];
}

/** The course map's sections (unit ids; a unit not in COURSE is skipped). */
export const PARTS: readonly Part[] = [
  {
    id: 'subtractive',
    title: 'Subtractive synthesis',
    subtitle: 'Start with a bright wave and take away what you don’t want. The foundation of nearly every synth you’ll meet.',
    units: ['sy-osc', 'sy-amp', 'sy-filter', 'sy-mix', 'sy-lfo', 'sy-special'],
  },
  { id: 'fm', title: 'FM synthesis', subtitle: 'Sine waves that wobble each other into bells, electric pianos and punchy basses.', units: ['sy-fm'] },
  { id: 'additive', title: 'Additive synthesis', subtitle: 'Build a sound from its harmonics, one sine at a time, and move them.', units: ['sy-add'] },
  { id: 'wavetable', title: 'Wavetable synthesis', subtitle: 'Morph through rows of waves: the sound of modern bass music and evolving pads.', units: ['sy-wt'] },
  { id: 'production', title: 'Effects and sound design', subtitle: 'Put sounds in a space, then build the classics from scratch.', units: ['sy-fx', 'sy-design'] },
];
