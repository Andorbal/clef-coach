/**
 * Part three: additive synthesis (unit 8). Building sounds from harmonics, as organ drawbars
 * and additive synths do.
 */
import { C, explain, explore, lesson, match, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'additive' as const,
  h1: 1,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.25,
};

/** A sawtooth's recipe: every harmonic at 1/n. */
const SAW = { h1: 1, h2: 0.5, h3: 0.33, h4: 0.25, h5: 0.2, h6: 0.17, h7: 0.14, h8: 0.12, h9: 0.11, h10: 0.1, h11: 0.09, h12: 0.08, h13: 0.08, h14: 0.07, h15: 0.07, h16: 0.06 };

export const additiveUnit: SynthUnit = {
  id: 'sy-add',
  title: 'Additive synthesis',
  subtitle: 'Harmonics, drawbars, moving spectra',
  description: 'Build a sound from sine waves, one harmonic at a time, then make the harmonics move.',
  engine: 'additive',
  requires: ['sy-filter'],
  lessons: [
    lesson(
      'sy8-1',
      'Harmonics, one by one',
      'Build tones out of pure sine waves.',
      'learn',
      { start: BASE, controls: [...C.harmonics(8), 'volume'], fresh: C.harmonics(8) },
      [
        explain(
          'Adding instead of subtracting',
          `Remember that every note is a stack of **harmonics**: sine waves at 1, 2, 3, 4… times its pitch? **Additive synthesis** builds the stack directly. Each bar below is one harmonic; drag it up to add that sine wave to the sound.

It's how a pipe organ's drawbars work, and the engine inside every additive synth. Drag your finger across the bars to draw a whole spectrum in one go.`,
          { visual: 'additive' },
        ),
        explore('Build a tone', 'Play a note after each change, and watch the wave take shape.', [
          task('Add the 2nd harmonic (an octave up) and play', p => p.h2 > 0.3),
          task('Add the 3rd harmonic (an octave and a fifth): an organ appears', p => p.h3 > 0.3),
          task('Turn the 1st harmonic off: the note seems to stay, an effect called the missing fundamental', p => p.h1 < 0.05 && (p.h2 > 0.2 || p.h3 > 0.2)),
          task('Raise all eight above half: bright and buzzy', p => [p.h1, p.h2, p.h3, p.h4, p.h5, p.h6, p.h7, p.h8].every(v => v > 0.5)),
        ]),
        match('Quiz: three harmonics', 'A fundamental with two quieter harmonics above. Which ones, how loud?', { h2: 0.5, h3: 0.3 }),
      ],
    ),
    lesson(
      'sy8-2',
      'Recipes: saw, square, organ',
      'Rebuild the classic waves from their harmonics.',
      'learn',
      { start: BASE, controls: [...C.harmonics(16), 'volume'], fresh: C.harmonics(16).slice(8) },
      [
        explain(
          'Every wave is a recipe',
          `- **Saw**: every harmonic, each quieter than the last (1, ½, ⅓, ¼…).
- **Square**: only the odd harmonics (1, 3, 5, 7…), at 1, ⅓, ⅕, ⅐.
- **Organ**: a few chosen harmonics, often the octaves (1, 2, 4, 8) and fifths (3, 6).

Sixteen harmonics are enough to hear the shapes clearly. Real additive synths use hundreds.`,
          { visual: 'harmonics' },
        ),
        explore('Draw the classics', 'Drag across the bars.', [
          task('Draw a falling slope across all sixteen: a saw', p => p.h1 > p.h4 && p.h4 > p.h10 && p.h10 > 0.02 && p.h2 > 0.2),
          task('Only odd harmonics (even ones at zero): a hollow square', p => p.h2 < 0.05 && p.h4 < 0.05 && p.h6 < 0.05 && p.h3 > 0.15 && p.h5 > 0.1),
        ]),
        match('Quiz: the square', 'Odd harmonics only, each quieter than the last.', { h3: 0.33, h5: 0.2, h7: 0.14, h9: 0.11 }),
        match('Quiz: the organ', 'Octaves and a fifth.', { h2: 0.8, h3: 0.6, h4: 0.5, h8: 0.3 }),
      ],
    ),
    lesson(
      'sy8-3',
      'Moving harmonics',
      'Open and close harmonics over each note.',
      'learn',
      {
        start: { ...BASE, ...SAW, addOpen: 16, addEnv: 0, fAttack: 0.002, fDecay: 0.4, fSustain: 0, fRelease: 0.3 },
        controls: ['addOpen', 'addEnv', 'fAttack', 'fDecay', 'fSustain', 'fRelease', 'volume'],
        fresh: ['addOpen', 'addEnv', 'fAttack', 'fDecay', 'fSustain', 'fRelease'],
      },
      [
        explain(
          'A filter that counts harmonics',
          `An additive synth can do something an analogue filter can't: decide exactly which harmonics play, and move them over time.

**Harmonics** here is a low-pass filter counted in harmonics: at 4, only the first four play. Because it counts harmonics rather than hertz, it follows the note: high and low notes stay equally bright.

**Env amount** lets the filter envelope open extra harmonics over each note, exactly like the subtractive filter envelope, but harmonic by harmonic. (Additive synths often give you this as a filter with an envelope.)`,
        ),
        explore('Move them', 'Play short notes.', [
          task('Set Harmonics to 3 and play: dark', p => p.addOpen <= 3.5),
          task('Raise the env amount past 10 and play: each note starts bright and closes', p => p.addOpen <= 5 && p.addEnv >= 10),
          task('Give the envelope a slow attack (over 0.4 s): harmonics open up gradually', p => p.addEnv >= 6 && p.fAttack > 0.4),
        ], { loop: 'arp' }),
        match('Quiz: the additive pluck', 'Dark, with a bright ping at the start of each note.', { addOpen: 2, addEnv: 12, fDecay: 0.3, fSustain: 0 }, { phrase: 'notes' }),
      ],
    ),
    lesson(
      'sy8-4',
      'Stretch: bells and glass',
      'Pull the harmonics out of tune for bells.',
      'learn',
      {
        start: { ...BASE, h1: 1, h2: 0.6, h3: 0.5, h4: 0.4, h5: 0.4, h6: 0.3, h7: 0.3, h8: 0.2, ampDecay: 2.2, ampSustain: 0, ampRelease: 1.5 },
        controls: [...C.harmonics(8), 'addStretch', 'volume'],
        fresh: ['addStretch'],
      },
      [
        explain(
          'Out of the series',
          `Harmonics sit at exact whole-number multiples, which is why a note sounds like a note. **Stretch** pushes the upper ones sharp. A little sounds like a piano's stiff strings; a lot breaks the series apart into the clangy, inharmonic partials of bells, glass and struck metal.`,
        ),
        explore('Stretch it', 'Play notes and let them ring.', [
          task('Set stretch to about 20%: slightly piano-like', p => p.addStretch >= 0.12 && p.addStretch <= 0.3),
          task('Push it past 70%: a bell', p => p.addStretch > 0.7),
        ]),
        match('Quiz: glass', 'Struck glass: how far stretched?', { addStretch: 0.6 }, { pass: 0.7 }),
      ],
    ),
    lesson(
      'sy8-5',
      'Checkpoint: additive',
      'Rebuild three additive sounds.',
      'checkpoint',
      {
        start: { ...BASE, addOpen: 16, fDecay: 0.4, fSustain: 0 },
        controls: [...C.harmonics(8), 'addOpen', 'addEnv', 'addStretch', 'fDecay', 'fSustain', 'ampDecay', 'ampSustain', 'volume'],
      },
      [
        match('Match 1 of 3: the flute', 'Mostly fundamental, a touch of the 2nd and 3rd.', { h2: 0.2, h3: 0.1 }),
        match('Match 2 of 3: the hollow organ', 'The fundamental and the 3rd and 5th harmonics.', { h3: 0.6, h5: 0.4 }),
        match('Match 3 of 3: the chime', 'A few harmonics, stretched, dying away.', { h2: 0.5, h3: 0.4, addStretch: 0.5, ampDecay: 2, ampSustain: 0 }),
      ],
    ),
  ],
};
