/**
 * Part one, subtractive synthesis: modulation with the LFO (unit 5).
 */
import { explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'subtractive' as const,
  filterOn: true,
  filterCutoff: 5000,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.3,
  lfoRate: 5,
};

export const lfoUnit: SynthUnit = {
  id: 'sy-lfo',
  title: 'Modulation: the LFO',
  subtitle: 'Vibrato, wah, wobble, tremolo',
  description: 'Make sounds move: a slow wave that turns the knobs for you.',
  engine: 'subtractive',
  lessons: [
    lesson(
      'sy5-1',
      'Vibrato',
      'Use an LFO to wobble the pitch.',
      'learn',
      { start: BASE, controls: ['osc1Wave', 'lfoRate', 'lfoPitch', 'volume'], fresh: ['lfoRate', 'lfoPitch'] },
      [
        explain(
          'A wave too slow to hear',
          `An **LFO** (low-frequency oscillator) is an oscillator running so slowly, a few times a second, that you don't hear it as a note. Instead it's used to move another control up and down, over and over.

Two controls matter most:

- **Rate**: how fast it swings.
- **Depth** (or amount): how far it moves the control it's connected to.

Connect it to **pitch** and you get **vibrato**, the gentle wavering a singer or a violinist adds to a long note.`,
          { visual: 'lfo' },
        ),
        explore('Wobble the pitch', 'Hold a long note while you turn.', [
          task('Set LFO → pitch to about 30 cents and play', p => p.lfoPitch >= 20 && p.lfoPitch <= 50),
          task('Slow the rate below 1.5 Hz: a seasick wobble', p => p.lfoPitch >= 15 && p.lfoRate < 1.5),
          task('Speed it up past 7 Hz: a nervous vibrato', p => p.lfoPitch >= 15 && p.lfoRate > 7),
          task('Go wild: LFO → pitch past 600 cents: a siren', p => p.lfoPitch > 600),
        ]),
        match('Quiz: the singer', 'A natural vibrato. How fast? How deep?', { lfoPitch: 30, lfoRate: 5.5 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy5-2',
      'Wah and LFO shapes',
      'Move the filter with the LFO, and try every shape.',
      'learn',
      {
        start: { ...BASE, filterCutoff: 600, filterRes: 0.25, lfoRate: 2 },
        controls: ['osc1Wave', 'filterCutoff', 'filterRes', 'lfoShape', 'lfoRate', 'lfoPitch', 'lfoCutoff', 'volume'],
        fresh: ['lfoShape', 'lfoCutoff'],
      },
      [
        explain(
          'Moving the filter',
          `Point the LFO at the **filter cutoff** instead and the tone sweeps back and forth: slow is a gentle sweep, faster is a "wah-wah".

The LFO's **shape** changes how it moves:

- **Sine** and **triangle**: smooth, back and forth.
- **Saw**: a jump, then a steady slide, over and over.
- **Square**: flips between two settings, like a trill.
- **Random** ("sample and hold"): a new random value each cycle, the bubbling computer sound of old sci-fi films.`,
        ),
        explore('Make it wah', 'The single-note or bassline loop makes this easy.', [
          task('Set LFO → cutoff above 1.5 octaves and play', p => p.lfoCutoff > 1.5),
          task('Choose the square shape: the tone jumps between two', p => p.lfoCutoff > 0.8 && p.lfoShape === 'square'),
          task('Choose random and speed it up past 6 Hz: sci-fi burble', p => p.lfoCutoff > 0.8 && p.lfoShape === 'random' && p.lfoRate > 6),
          task('Choose saw and slow it to 1 Hz', p => p.lfoCutoff > 0.8 && p.lfoShape === 'saw' && p.lfoRate < 1.4),
        ], { loop: 'pulse' }),
        listen('Ear training: which LFO shape?', 'Smooth, jumping, or random?', 'Which shape?', [['triangle', 'Smooth (triangle)'], ['square', 'Jumping (square)'], ['random', 'Random']], [
          round('square', { lfoShape: 'square', lfoCutoff: 2, lfoRate: 3 }, 'long'),
          round('triangle', { lfoShape: 'triangle', lfoCutoff: 2, lfoRate: 2 }, 'long'),
          round('random', { lfoShape: 'random', lfoCutoff: 2, lfoRate: 7 }, 'long'),
          round('triangle', { lfoShape: 'triangle', lfoCutoff: 2.5, lfoRate: 1.5 }, 'long'),
        ]),
        match('Quiz: the wah', 'A smooth, steady wah. Which shape, how fast, how far?', { lfoShape: 'triangle', lfoCutoff: 2, lfoRate: 2.5 }, { phrase: 'long', pass: 0.62 }),
      ],
    ),
    lesson(
      'sy5-3',
      'Tempo sync and the wobble bass',
      'Lock the LFO to the beat.',
      'learn',
      {
        start: { ...BASE, osc1Octave: -1, filterCutoff: 300, filterRes: 0.5, lfoCutoff: 3, lfoRate: 5, voiceMode: 'mono' },
        controls: ['osc1Wave', 'filterCutoff', 'filterRes', 'lfoShape', 'lfoRate', 'lfoSync', 'lfoDiv', 'lfoCutoff', 'volume'],
        fresh: ['lfoSync', 'lfoDiv'],
      },
      [
        explain(
          'In time with the music',
          `An LFO set in hertz drifts against the beat. **Sync** locks it to the tempo instead, so it moves in note lengths: **1/4** is once per beat, **1/8** twice, **1/16** four times, **T** a triplet and **D** a dotted note.

Point a synced LFO at a resonant low-pass on a bass and you've made the **wobble bass** of dubstep and drum & bass. Change the note length as the music plays and the wobble changes rhythm. (The lab plays at 120 BPM.)`,
        ),
        explore('Wobble', 'Start the bassline loop.', [
          task('Turn sync on and choose 1/8', p => p.lfoSync && p.lfoDiv === '1/8'),
          task('Try triplets (1/8T)', p => p.lfoSync && p.lfoDiv === '1/8T'),
          task('Try 1/16: fast and aggressive', p => p.lfoSync && p.lfoDiv === '1/16'),
        ], { loop: 'bass' }),
        match('Quiz: the wobble', 'A wobble in time with the beat. Which note length?', { lfoSync: true, lfoDiv: '1/4' }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy5-4',
      'Tremolo, PWM and fade-in',
      'Wobble the volume and the pulse width; bring vibrato in slowly.',
      'learn',
      {
        start: { ...BASE, lfoRate: 6 },
        controls: ['osc1Wave', 'osc1Pw', 'lfoShape', 'lfoRate', 'lfoFade', 'lfoPitch', 'lfoAmp', 'lfoPw', 'volume'],
        fresh: ['lfoAmp', 'lfoPw', 'lfoFade'],
      },
      [
        explain(
          'Three more destinations',
          `- **LFO → volume** is **tremolo**: the pulsing of a vintage guitar amp or a vibraphone.
- **LFO → pulse width** (PWM) slowly reshapes a square wave, giving a rich, chorus-like movement: the lush strings of 70s synths.
- **Fade in** brings the LFO in gradually after each note starts, like a singer who adds vibrato once the note has settled.

On many synths, one LFO has a separate amount knob for each destination, just like here.`,
        ),
        explore('Try them', 'Hold long notes.', [
          task('Tremolo: LFO → volume above 50%', p => p.lfoAmp > 0.5),
          task('Choose the square wave, then LFO → width above 50%: PWM', p => p.osc1Wave === 'square' && p.lfoPw > 0.5),
          task('Vibrato (LFO → pitch 20–40 cents) with a fade-in over half a second', p => p.lfoPitch >= 15 && p.lfoFade >= 0.4),
        ]),
        match('Quiz: the tremolo', 'A pulsing volume.', { lfoAmp: 0.6, lfoRate: 6 }, { phrase: 'long' }),
        match('Quiz: the string machine', 'A square wave whose shape keeps moving.', { osc1Wave: 'square', lfoPw: 0.8, lfoRate: 1.2 }, { phrase: 'chord' }),
      ],
    ),
    lesson(
      'sy5-5',
      'Checkpoint: modulation',
      'Match three moving sounds.',
      'checkpoint',
      {
        start: { ...BASE, filterCutoff: 1500, filterRes: 0.2 },
        controls: ['osc1Wave', 'osc1Octave', 'filterCutoff', 'filterRes', 'lfoShape', 'lfoRate', 'lfoSync', 'lfoDiv', 'lfoPitch', 'lfoCutoff', 'lfoAmp', 'volume'],
      },
      [
        match('Match 1 of 3: the lead', 'A square lead with a quick vibrato.', { osc1Wave: 'square', lfoPitch: 40, lfoRate: 6.5 }, { phrase: 'long' }),
        match('Match 2 of 3: the wobble', 'Low, filtered, and wobbling twice a beat.', { osc1Octave: -1, filterCutoff: 350, filterRes: 0.5, lfoSync: true, lfoDiv: '1/8', lfoCutoff: 2.5 }, { phrase: 'long', pass: 0.55 }),
        match('Match 3 of 3: the organ', 'A pure tone with a throbbing volume.', { osc1Wave: 'sine', lfoAmp: 0.5, lfoRate: 7 }, { phrase: 'long' }),
      ],
    ),
  ],
};
