/**
 * Part four: wavetable synthesis (unit 9). The way Serum and Vital make sound.
 */
import { explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'wavetable' as const,
  osc1Table: 'basic' as const,
  osc1Pos: 0,
  osc1Level: 0.8,
  filterOn: false,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.3,
};

export const wavetableUnit: SynthUnit = {
  id: 'sy-wt',
  title: 'Wavetable synthesis',
  subtitle: 'Tables, position, morphing',
  description: 'Morph through rows of waves: the sound of modern bass music and evolving pads.',
  engine: 'wavetable',
  requires: ['sy-filter'],
  lessons: [
    lesson(
      'sy9-1',
      'Wavetable position',
      'Pick a table and move through it.',
      'learn',
      { start: BASE, controls: ['osc1Table', 'osc1Pos', 'volume'], fresh: ['osc1Table', 'osc1Pos'] },
      [
        explain(
          'A row of waves',
          `A classic oscillator plays one wave shape. A **wavetable** oscillator holds a whole row of them, a **table**, and its **position** picks which one plays. Move the position and the sound morphs smoothly from one wave to the next.

This table, "Basic shapes", runs from a sine through a triangle and a saw to a square: everything from the first unit, in one knob. Other tables hold vowels, metallic tones, sync sweeps. This is how Serum and Vital work, and their wavetables are the sound of modern bass music.`,
          { visual: 'wavetable' },
        ),
        explore('Morph', 'Hold a note and sweep the position slowly.', [
          task('Sweep the position past 60%: from sine towards saw', p => p.osc1Pos > 0.6),
          task('Choose the Vowels table and sweep: "oo", "oh", "ah", "eh", "ee"', p => p.osc1Table === 'vowel'),
          task('Choose the Metallic table and go past 50%: harsh and digital', p => p.osc1Table === 'metal' && p.osc1Pos > 0.5),
          task('Choose Sync sweep and move through it', p => p.osc1Table === 'sync' && p.osc1Pos > 0.3),
        ]),
        listen('Ear training: which table?', 'Vowels talk, metal clangs, harmonics just get brighter.', 'Which table?', [['vowel', 'Vowels'], ['metal', 'Metallic'], ['harmonic', 'Harmonics']], [
          round('vowel', { osc1Table: 'vowel', osc1Pos: 0.5 }),
          round('metal', { osc1Table: 'metal', osc1Pos: 0.7 }),
          round('harmonic', { osc1Table: 'harmonic', osc1Pos: 0.4 }),
          round('vowel', { osc1Table: 'vowel', osc1Pos: 0.15 }),
        ]),
        match('Quiz: the vowel', 'Which table, and where in it?', { osc1Table: 'vowel', osc1Pos: 0.5 }),
      ],
    ),
    lesson(
      'sy9-2',
      'Moving the position',
      'Let an envelope and an LFO morph the table for you.',
      'learn',
      {
        start: { ...BASE, osc1Table: 'metal', osc1Pos: 0.1, modDecay: 0.5, lfoRate: 0.5 },
        controls: ['osc1Table', 'osc1Pos', 'modAttack', 'modDecay', 'modPos', 'lfoShape', 'lfoRate', 'lfoSync', 'lfoDiv', 'lfoPos', 'volume'],
        fresh: ['modPos', 'lfoPos'],
      },
      [
        explain(
          'Morphing on its own',
          `The real power of wavetables is moving through them **while a note plays**. Send an envelope to the position and every note morphs as it sounds: a growl that opens, a pluck that changes vowel. Send an LFO and the sound keeps morphing back and forth: talking pads, rhythmic growls if the LFO is synced.

In Serum and Vital you do this by dragging an envelope or an LFO onto the wavetable position knob.`,
        ),
        explore('Set it moving', 'Hold notes, or play the bassline loop.', [
          task('Mod envelope → position above 50%: every note morphs', p => p.modPos > 0.5),
          task('LFO → position above 30% with a slow rate: a slowly morphing sound', p => p.lfoPos > 0.3 && !p.lfoSync && p.lfoRate < 1.5),
          task('Sync the LFO to 1/16: a rhythmic, morphing growl', p => p.lfoPos > 0.2 && p.lfoSync && p.lfoDiv === '1/16'),
        ], { loop: 'bass' }),
        match('Quiz: the morphing pluck', 'Each note sweeps through the table and back.', { modPos: 0.7, modDecay: 0.6 }, { phrase: 'notes' }),
        match('Quiz: the talking pad', 'The Vowels table, moved by a slow LFO.', { osc1Table: 'vowel', osc1Pos: 0.4, lfoPos: 0.4, lfoRate: 0.8 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy9-3',
      'Two tables and unison',
      'Layer tables and thicken them like a modern bass.',
      'learn',
      {
        start: { ...BASE, osc1Pos: 0.6 },
        controls: ['osc1Table', 'osc1Pos', 'osc1Octave', 'osc2Table', 'osc2Pos', 'osc2Octave', 'osc1Level', 'osc2Level', 'subLevel', 'unison', 'unisonDetune', 'volume'],
        fresh: ['osc2Table', 'osc2Pos', 'osc2Octave', 'osc2Level', 'unison', 'unisonDetune'],
      },
      [
        explain(
          'Layers, the modern way',
          `Wavetable synths usually have two wavetable oscillators, a sub and noise, and unison on each oscillator: everything you met in Part 1, with tables instead of plain waves.

A typical modern bass: one table for the body, another for the bite, a sub underneath, unison for width.`,
        ),
        explore('Layer', 'Hold a note.', [
          task('Bring in wavetable B above 50%', p => p.osc2Level > 0.5),
          task('Put B on a different table', p => p.osc2Level > 0.3 && p.osc2Table !== p.osc1Table),
          task('Add unison: 5 voices or more', p => p.unison >= 5),
          task('Add a sub underneath', p => p.subLevel > 0.4),
        ]),
        match('Quiz: the layered lead', 'Two tables and some unison.', { osc2Level: 0.6, osc2Table: 'harmonic', osc2Pos: 0.7, unison: 5, unisonDetune: 25 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy9-4',
      'Checkpoint: wavetables',
      'Rebuild three wavetable sounds.',
      'checkpoint',
      {
        start: { ...BASE, modDecay: 0.5, lfoRate: 1 },
        controls: ['osc1Table', 'osc1Pos', 'osc1Octave', 'modDecay', 'modPos', 'lfoRate', 'lfoSync', 'lfoDiv', 'lfoPos', 'unison', 'unisonDetune', 'volume'],
      },
      [
        match('Match 1 of 3: the vowel', 'Which vowel?', { osc1Table: 'vowel', osc1Pos: 0.8 }),
        match('Match 2 of 3: the growl', 'Metallic, low, morphed by an envelope.', { osc1Table: 'metal', osc1Octave: -1, osc1Pos: 0.2, modPos: 0.6, modDecay: 0.8 }, { phrase: 'notes', pass: 0.7 }),
        match('Match 3 of 3: the sync sweep', 'A synced saw moving back and forth.', { osc1Table: 'sync', osc1Pos: 0.3, lfoPos: 0.4, lfoRate: 1.5 }, { phrase: 'long', pass: 0.55 }),
      ],
    ),
  ],
};
