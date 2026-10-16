/**
 * Part two: FM synthesis (unit 7). The DX7's way of making sound, still at the heart of
 * Sytrus, Toxic Biohazard and DX10.
 */
import { C, explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'fm' as const,
  fmAlgo: 0,
  op1Ratio: 1,
  op1Level: 0.8,
  op2Ratio: 1,
  op2Level: 0,
  ampAttack: 0.003,
  ampDecay: 0.5,
  ampSustain: 1,
  ampRelease: 0.3,
};

/** FM is touchy: a few percent on a modulator is a real change of tone, so its quizzes pass a little lower. */
const FM_PASS = 0.6;

export const fmUnit: SynthUnit = {
  id: 'sy-fm',
  title: 'FM synthesis',
  subtitle: 'Operators, ratios, algorithms',
  description: 'Sine waves that bend each other into bells, electric pianos and punchy basses.',
  engine: 'fm',
  requires: ['sy-filter'],
  lessons: [
    lesson(
      'sy7-1',
      'Carrier and modulator',
      'Hear one sine wave turn another bright.',
      'learn',
      { start: BASE, controls: ['op1Level', 'op2Level', 'volume'], fresh: ['op1Level', 'op2Level'] },
      [
        explain(
          'A completely different idea',
          `Subtractive synthesis starts bright and takes away. **FM** (frequency modulation) starts with plain sine waves and makes them richer by wobbling one with another.

FM synths call their oscillators **operators**. An operator you hear is a **carrier**. An operator that wobbles another one is a **modulator**. When a modulator wobbles a carrier hundreds of times a second, you don't hear a wobble: you hear new harmonics appear around the note.

Here, **operator 2** modulates **operator 1**. Operator 2's **level** is how hard it wobbles, and that's how bright the sound is. This is the sound of the Yamaha DX7, and of FL Studio's Sytrus, Toxic Biohazard and DX10.`,
          { visual: 'fm' },
        ),
        explore('Turn up the modulator', 'Hold a note and raise operator 2 slowly.', [
          task('Raise operator 2’s level to about 30% and play: warmer, richer', p => p.op2Level >= 0.2 && p.op2Level <= 0.4),
          task('Raise it past 70%: bright and buzzy', p => p.op2Level >= 0.7),
          task('All the way: harsh, almost noisy', p => p.op2Level >= 0.98),
          task('Now set operator 1’s level to 0: silence. Modulators are never heard on their own', p => p.op1Level < 0.02),
        ]),
        listen('Ear training: how bright?', 'More modulation, more harmonics.', 'How hard is the modulator working?', [['none', 'Not at all (a sine)'], ['some', 'A little'], ['lots', 'A lot']], [
          round('lots', { op2Level: 0.8 }),
          round('none', { op2Level: 0 }),
          round('some', { op2Level: 0.3 }),
          round('lots', { op2Level: 0.7 }),
          round('some', { op2Level: 0.25 }),
        ]),
        match('Quiz: how much modulation?', 'Find the modulator level.', { op2Level: 0.45 }, { pass: FM_PASS }),
      ],
    ),
    lesson(
      'sy7-2',
      'Ratios: harmonic and bell-like',
      'Choose which harmonics FM creates.',
      'learn',
      { start: { ...BASE, op2Level: 0.4 }, controls: ['op1Level', 'op2Ratio', 'op2Level', 'volume'], fresh: ['op2Ratio'] },
      [
        explain(
          'Ratio sets the recipe',
          `Each operator plays at a **ratio** of the note you press: 1 is the note itself, 2 an octave up, 3 an octave and a fifth.

The ratio between modulator and carrier decides **which** harmonics appear:

- **1:1** gives every harmonic, like a saw.
- **2:1** gives only the odd ones, like a square or a clarinet.
- Higher whole numbers give brighter, thinner, more nasal tones.
- **In-between ratios** (1.41, 3.5…) give partials that aren't harmonics at all: **bells**, chimes and metal.

The ratio knob clicks into whole and half numbers as you turn it; hold Shift (or use the arrow keys) for the in-between ones.`,
        ),
        explore('Change the recipe', 'Play after each change.', [
          task('Set operator 2’s ratio to 2: hollow, clarinet-like', p => p.op2Ratio === 2),
          task('Ratio 3, then 4: brighter and thinner', p => p.op2Ratio >= 3 && p.op2Ratio <= 4),
          task('Ratio 3.5: suddenly a bell', p => Math.abs(p.op2Ratio - 3.5) < 0.05),
          task('Ratio 1.41: a clangy, metallic tone', p => Math.abs(p.op2Ratio - 1.41) < 0.05),
        ]),
        listen('Ear training: harmonic or bell?', 'Does it sound like a note, or like struck metal?', 'Which?', [['harmonic', 'Harmonic'], ['bell', 'Bell-like']], [
          round('bell', { op2Ratio: 3.5, ampDecay: 2, ampSustain: 0 }),
          round('harmonic', { op2Ratio: 2 }),
          round('bell', { op2Ratio: 1.41, op2Level: 0.5 }),
          round('harmonic', { op2Ratio: 3 }),
        ]),
        match('Quiz: the clarinet', 'Hollow, odd harmonics.', { op2Ratio: 2, op2Level: 0.4 }, { pass: FM_PASS }),
        match('Quiz: the bell', 'A struck bell. Which ratio?', { op2Ratio: 3.5, op2Level: 0.45 }, { start: { ampDecay: 2.5, ampSustain: 0, ampRelease: 1.5 }, pass: FM_PASS }),
      ],
    ),
    lesson(
      'sy7-3',
      'Brightness over time',
      'Give the modulator its own envelope: the secret of FM keys and basses.',
      'learn',
      { start: { ...BASE, op2Level: 0.6, op2Decay: 1, op2Sustain: 1 }, controls: ['op2Ratio', 'op2Level', ...C.op(2, 'Attack', 'Decay', 'Sustain', 'Release'), 'volume'], fresh: C.op(2, 'Attack', 'Decay', 'Sustain', 'Release') },
      [
        explain(
          'A brightness envelope',
          `In FM, every operator has its own envelope. On a carrier it shapes the volume, as you'd expect. On a **modulator** it shapes the **brightness**: as the modulator's envelope falls, the harmonics fade away and the tone mellows.

That's what makes FM electric pianos "ping", FM basses punch, and plucked FM sounds feel alive. A modulator envelope with a fast decay and low sustain is the most useful thing in FM.`,
        ),
        explore('Shape the brightness', 'Play notes and listen to how the tone changes during each one.', [
          task('Set operator 2’s sustain to 0 and decay to 0.3 s: bright, then mellow', p => p.op2Sustain < 0.05 && p.op2Decay >= 0.15 && p.op2Decay <= 0.45),
          task('Give operator 2 a slow attack (over 0.5 s): a tone that brightens', p => p.op2Attack > 0.5),
          task('Ratio 1, level 70%, decay 0.2, sustain 10%: a punchy FM bass', p => p.op2Ratio === 1 && p.op2Level >= 0.6 && p.op2Decay <= 0.3 && p.op2Sustain <= 0.15),
        ]),
        match('Quiz: the FM bass', 'Punchy and rubbery: bright for an instant, then round.', { op2Level: 0.65, op2Decay: 0.25, op2Sustain: 0.1 }, { phrase: 'notes', pass: FM_PASS }),
        match('Quiz: the swell', 'The tone opens up slowly.', { op2Attack: 0.8, op2Level: 0.5 }, { phrase: 'long', pass: FM_PASS }),
      ],
    ),
    lesson(
      'sy7-4',
      'Algorithms and feedback',
      'Wire four operators in stacks and side by side.',
      'learn',
      {
        start: { ...BASE, op2Level: 0, op3Level: 0, op4Level: 0, op2Ratio: 2, op3Ratio: 3, op4Ratio: 4 },
        controls: ['fmAlgo', 'fmFeedback', ...C.op(1, 'Ratio', 'Level'), ...C.op(2, 'Ratio', 'Level'), ...C.op(3, 'Ratio', 'Level'), ...C.op(4, 'Ratio', 'Level'), 'volume'],
        fresh: ['fmAlgo', 'fmFeedback', ...C.op(3, 'Ratio', 'Level'), ...C.op(4, 'Ratio', 'Level')],
      },
      [
        explain(
          'Who modulates whom',
          `With more operators, you choose how they're wired: the **algorithm**. In the drawing, operators at the bottom (on the line) are carriers; arrows show who modulates whom.

- A **stack** (4 → 3 → 2 → 1): a modulator modulating a modulator. Very complex, metallic tones.
- **Pairs side by side** (2 → 1 + 4 → 3): two simple FM sounds layered, like the DX7's famous electric piano.
- **All carriers** (1 + 2 + 3 + 4): no modulation at all, just four sines added up. That's additive synthesis, an organ.

**Feedback** lets the top operator modulate itself: a little turns its sine into something like a saw.

Sytrus in FL Studio replaces fixed algorithms with a matrix where any operator can modulate any other: the same idea, more freedom.`,
        ),
        explore('Rewire it', 'Change the algorithm and listen.', [
          task('Choose 1 + 2 + 3 + 4 and raise operators 2 and 3: an organ', p => p.fmAlgo === 7 && p.op2Level > 0.3 && p.op3Level > 0.3),
          task('Choose 3 → 2 → 1 and raise operators 2 and 3: a stack', p => p.fmAlgo === 1 && p.op2Level > 0.3 && p.op3Level > 0.3),
          task('Raise the feedback above 60% with a modulator up', p => p.fmFeedback > 0.6),
        ]),
        match('Quiz: the FM organ', 'Three sines added up, no modulation: the fundamental, an octave up and an octave and a fifth up.', { fmAlgo: 7, op2Ratio: 2, op2Level: 0.5, op3Ratio: 3, op3Level: 0.4 }, { pass: FM_PASS }),
        match('Quiz: feedback', 'A buzzy edge from feedback on the modulator.', { op2Level: 0.35, fmFeedback: 0.8 }, { pass: FM_PASS }),
      ],
    ),
    lesson(
      'sy7-5',
      'Checkpoint: FM',
      'Rebuild three classic FM sounds.',
      'checkpoint',
      {
        start: { ...BASE, ampDecay: 1.5, ampSustain: 1, op2Decay: 1, op2Sustain: 1 },
        controls: ['op1Level', ...C.op(2), 'ampDecay', 'ampSustain', 'volume'],
      },
      [
        match('Match 1 of 3: the bell', 'Inharmonic and ringing away.', { op2Ratio: 3.5, op2Level: 0.45, ampDecay: 2.5, ampSustain: 0 }, { pass: FM_PASS }),
        match('Match 2 of 3: the bass', 'A punchy pluck that mellows.', { op2Ratio: 1, op2Level: 0.6, op2Decay: 0.2, op2Sustain: 0.1 }, { phrase: 'notes', pass: FM_PASS }),
        match('Match 3 of 3: the clarinet', 'Hollow and steady.', { op2Ratio: 2, op2Level: 0.35 }, { pass: FM_PASS }),
      ],
    ),
  ],
};
