/**
 * Part one, subtractive synthesis: more sources (unit 4): a second oscillator, detune,
 * the sub-oscillator, noise and unison.
 */
import { C, explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'subtractive' as const,
  filterOn: true,
  filterCutoff: 5000,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.25,
};

export const sourcesUnit: SynthUnit = {
  id: 'sy-mix',
  title: 'More oscillators',
  subtitle: 'Layering, detune, sub, noise, unison',
  description: 'Stack sources for thick, wide sounds: two oscillators, a sub, noise and the supersaw.',
  engine: 'subtractive',
  lessons: [
    lesson(
      'sy4-1',
      'Two oscillators',
      'Layer a second oscillator an octave down or a fifth up.',
      'learn',
      { start: BASE, controls: ['osc1Wave', 'osc2Wave', 'osc2Octave', 'osc2Semi', ...C.levels, 'filterCutoff', 'volume'], fresh: ['osc2Wave', 'osc2Octave', 'osc2Semi', ...C.levels] },
      [
        explain(
          'The mixer',
          `Most synths have two or three oscillators, and a **mixer** where you set how much of each you hear. Everything is mixed before it reaches the filter, so the filter shapes them together.

Two oscillators playing the same note just sound louder. The magic is in tuning them differently:

- **An octave apart** (−1 or +1): fuller, a solid bass or a bright organ.
- **A fifth apart** (+7 semitones): a "power chord" on every key you press, the trick behind many trance and house leads.

3x Osc in FL Studio is exactly this: three oscillators with their own shapes, tuning and levels.`,
          { visual: 'signal-flow' },
        ),
        explore('Layer it', 'Bring in oscillator 2 with the Osc 2 level in the mixer.', [
          task('Turn the Osc 2 level above 50% and play', p => p.osc2Level > 0.5),
          task('Set oscillator 2 an octave down (−1) and play: fuller', p => p.osc2Level > 0.3 && p.osc2Octave === -1),
          task('Set oscillator 2 to +7 semitones (octave 0): a fifth on every key', p => p.osc2Level > 0.3 && p.osc2Semi === 7 && p.osc2Octave === 0),
          task('Give oscillator 2 a square wave: two shapes blended', p => p.osc2Level > 0.3 && p.osc2Wave === 'square'),
        ]),
        match('Quiz: the deep layer', 'A second oscillator underneath the first.', { osc2Level: 0.7, osc2Octave: -1 }),
        match('Quiz: the power lead', 'Two oscillators, a fifth apart.', { osc2Level: 0.6, osc2Semi: 7 }),
      ],
    ),
    lesson(
      'sy4-2',
      'Detune: width and movement',
      'Detune two oscillators for the classic analogue shimmer.',
      'learn',
      { start: { ...BASE, osc2Level: 0.8 }, controls: ['osc1Wave', 'osc2Wave', 'osc2Octave', 'osc2Semi', 'osc2Fine', ...C.levels, 'filterCutoff', 'volume'], fresh: ['osc2Fine'] },
      [
        explain(
          'A little out of tune is a good thing',
          `Two oscillators on exactly the same pitch sound like one. Tune one a few **cents** (hundredths of a semitone) away and they drift in and out of step with each other. You hear it as a slow, swirling movement: the sound comes alive.

- 3 to 8 cents: gentle warmth.
- 10 to 20 cents: a wide, chorus-like shimmer.
- 30 cents and up: sour and out of tune, sometimes exactly what you want (the "Reese" bass).

The speed of the swirl depends on the note: low notes beat slowly, high notes quickly.`,
        ),
        explore('Detune', 'Hold a note or start a loop.', [
          task('Set oscillator 2 fine to about +8 cents and hold a note: the swirl', p => p.osc2Fine >= 5 && p.osc2Fine <= 12),
          task('Push it to 40 cents: sour', p => p.osc2Fine >= 35),
          task('Play a low note and a high one with 15 cents: the beating speeds up', p => p.osc2Fine >= 12 && p.osc2Fine <= 20),
        ], { loop: 'chord' }),
        listen('Ear training: detuned or in tune?', 'Listen for slow movement in the sound.', 'Which is it?', [['detuned', 'Detuned'], ['tuned', 'In tune']], [
          round('detuned', { osc2Fine: 15 }, 'long'),
          round('tuned', { osc2Fine: 0 }, 'long'),
          round('detuned', { osc2Fine: 10 }, 'long'),
          round('tuned', { osc2Fine: 0, osc2Octave: -1 }, 'long'),
        ]),
        match('Quiz: the shimmer', 'Two saws, slightly apart.', { osc2Fine: 14 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy4-3',
      'Sub and noise',
      'Add weight underneath and air on top.',
      'learn',
      {
        start: BASE,
        controls: ['osc1Wave', 'osc1Octave', 'osc1Level', 'subLevel', 'subWave', 'noiseLevel', 'filterCutoff', ...C.ampADSR, 'volume'],
        fresh: ['osc1Level', 'subLevel', 'subWave', 'noiseLevel'],
      },
      [
        explain(
          'Two extra sources',
          `- The **sub-oscillator** plays an octave below oscillator 1. It adds weight under a bass without changing its character much. A sine sub is clean and deep; a square sub is punchier, like a Roland Juno.
- **Noise** has no pitch at all: every frequency at once, like a waterfall. Mixed in a little, it adds breath and air. On its own, with a short envelope, it's a hi-hat or a snare.`,
        ),
        explore('Weight and air', 'Play low notes for the sub, anything for the noise.', [
          task('Add sub above 50% and play a low note', p => p.subLevel > 0.5),
          task('Try the square sub', p => p.subLevel > 0.3 && p.subWave === 'square'),
          task('Turn oscillator 1 off (level 0) and noise up full: wind', p => p.osc1Level < 0.05 && p.noiseLevel > 0.8),
          task('With only noise, make the decay short (under 0.1 s) and sustain 0: a hi-hat', p => p.osc1Level < 0.05 && p.noiseLevel > 0.5 && p.ampDecay < 0.1 && p.ampSustain < 0.05),
        ]),
        match('Quiz: the hi-hat', 'Only noise, and very short.', { osc1Level: 0, noiseLevel: 1, ampAttack: 0, ampDecay: 0.06, ampSustain: 0, ampRelease: 0.05 }, { phrase: 'notes' }),
        match('Quiz: the breathy flute', 'A pure tone with breath in it, and a gentle start.', { osc1Wave: 'sine', noiseLevel: 0.25, ampAttack: 0.08 }),
        match('Quiz: the heavy bass', 'An octave down, with a clean sub underneath.', { osc1Octave: -1, subLevel: 0.8 }),
      ],
    ),
    lesson(
      'sy4-4',
      'Unison: the supersaw',
      'Stack detuned copies for huge, wide sounds.',
      'learn',
      { start: { ...BASE, ampRelease: 0.4 }, controls: ['osc1Wave', ...C.unison, 'filterCutoff', 'volume'], fresh: C.unison },
      [
        explain(
          'Many voices in one',
          `**Unison** plays several copies of each oscillator for every note, each slightly detuned from the others, and spreads them across the stereo field. It's detuning taken to the extreme.

Seven detuned saws is the famous **supersaw** of trance and modern pop. Almost every synth has it, usually as **Unison** (how many copies), **Detune** (how far apart) and **Width** or **Blend** or **Spread**.

Use headphones to hear the width.`,
        ),
        explore('Make it huge', 'Chords show it off best.', [
          task('Set unison to 7 voices and play a chord', p => p.unison >= 7),
          task('Raise the detune past 40 cents', p => p.unison >= 3 && p.unisonDetune >= 40),
          task('Set the width to 100%', p => p.unison >= 3 && p.unisonWidth >= 0.95),
        ], { loop: 'chord' }),
        match('Quiz: the supersaw', 'Many detuned voices per note. How many, and how far apart?', { unison: 7, unisonDetune: 35 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy4-5',
      'Checkpoint: more oscillators',
      'Rebuild three layered sounds.',
      'checkpoint',
      {
        start: BASE,
        controls: ['osc1Wave', 'osc1Octave', ...C.osc2, ...C.levels, 'subLevel', 'noiseLevel', 'filterCutoff', 'filterRes', 'unison', 'unisonDetune', 'volume'],
      },
      [
        match('Match 1 of 3: the Reese', 'Two saws, both an octave down, heavily detuned and filtered dark.', { osc1Octave: -1, osc2Octave: -1, osc2Level: 0.8, osc2Fine: 25, filterCutoff: 700 }),
        match('Match 2 of 3: the organ', 'Squares, with a second oscillator an octave up.', { osc1Wave: 'square', osc2Wave: 'square', osc2Octave: 1, osc2Level: 0.6 }),
        match('Match 3 of 3: the breathy pad', 'Thick, with air on top.', { unison: 3, unisonDetune: 20, noiseLevel: 0.2, filterCutoff: 2500 }, { phrase: 'chord' }),
      ],
    ),
  ],
};
