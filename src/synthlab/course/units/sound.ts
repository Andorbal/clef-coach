/**
 * Part one, subtractive synthesis: the oscillator and the amplifier's envelope.
 * Units 1–2. Everything later builds on these two.
 */
import { C, explain, explore, lesson, listen, match, playTask, round, task } from '../build';
import type { SynthUnit } from '../types';

/** The opening patch: one sawtooth, no filter, a plain organ-like envelope. */
const BASE = { engine: 'subtractive' as const, filterOn: false, ampAttack: 0.004, ampDecay: 0.4, ampSustain: 1, ampRelease: 0.25 };

export const oscillatorUnit: SynthUnit = {
  id: 'sy-osc',
  title: 'First sounds',
  subtitle: 'The oscillator',
  description: 'Where every synth sound starts: a wave, its shape and its pitch.',
  engine: 'subtractive',
  lessons: [
    lesson(
      'sy1-1',
      'Meet the oscillator',
      'Hear the four classic waves and tell them apart.',
      'learn',
      { start: BASE, controls: ['osc1Wave', 'volume'], fresh: ['osc1Wave', 'volume'] },
      [
        explain(
          'A synth makes sound from scratch',
          `A piano has strings and a guitar has a body, but a synthesizer starts with nothing at all. It builds every sound from a few simple parts, and every part has a knob.

The first part is the **oscillator**. It repeats a wave shape over and over, hundreds of times a second. How fast it repeats is the note you hear; the shape of the wave is the colour of the sound.

Below is a synth with just two controls: the oscillator's **wave**, and the **volume**. Play some notes on the keys at the bottom (or with A S D F G H J K on a computer keyboard).`,
          { visual: 'signal-flow' },
        ),
        explore('Try the waves', 'Each wave shape has its own character. Play a note after each change and listen to how the same pitch changes colour.', [
          playTask(),
          task('Choose the sine wave and play a note', p => p.osc1Wave === 'sine'),
          task('Choose the saw wave and play a note', p => p.osc1Wave === 'saw'),
          task('Choose the square wave and play a note', p => p.osc1Wave === 'square'),
          task('Turn the volume below 40% and play: quieter, but the same sound', p => p.volume < 0.4),
        ]),
        explain(
          'Four waves, four characters',
          `- **Sine** is pure and round, a flute or a whistle. It's the only wave with no harmonics, which is why a sine sub-bass sounds so clean.
- **Triangle** is soft and hollow, a sine with a little edge.
- **Saw** (sawtooth) is bright and buzzy, the raw material of strings, brass, leads and basses. It has every harmonic.
- **Square** is hollow and woody, like a clarinet or an old video game. It has only the odd harmonics.

Nearly every synth you'll meet, including all of FL Studio's, has these four. Learn their sound and you'll know what you're starting from on any of them.`,
          { visual: 'waveforms' },
        ),
        listen('Ear training: which wave?', 'Listen to each sound and pick its wave. Replay as often as you like.', 'Which wave is this?', [['sine', 'Sine'], ['triangle', 'Triangle'], ['saw', 'Saw'], ['square', 'Square']], [
          round('saw', { osc1Wave: 'saw' }),
          round('sine', { osc1Wave: 'sine' }),
          round('square', { osc1Wave: 'square' }),
          round('triangle', { osc1Wave: 'triangle' }),
          round('saw', { osc1Wave: 'saw', osc1Octave: -1 }),
        ]),
      ],
    ),
    lesson(
      'sy1-2',
      'Pitch: octaves and semitones',
      'Move the oscillator up and down, and match a sound by ear.',
      'learn',
      { start: BASE, controls: ['osc1Wave', ...C.pitch, 'volume'], fresh: C.pitch },
      [
        explain(
          'Tuning the oscillator',
          `The key you press picks the note, but the oscillator can be moved away from it.

- **Octave** moves it by whole octaves: −1 is the same note an octave lower, deeper and heavier. Older synths write this in "feet", as organs do: 16′ is an octave below 8′.
- **Semitones** moves it by the steps between neighbouring keys. +7 is a fifth up, +12 a full octave.

On FL Studio's 3x Osc these are the **Coarse** knobs; most synths call them **Oct** and **Semi**.`,
        ),
        explore('Move it around', 'Play a note after each change.', [
          task('Set the octave to −1 and play: the same note, an octave down', p => p.osc1Octave === -1),
          task('Set the octave to +1 and play', p => p.osc1Octave === 1),
          task('Set semitones to +7 and play: a fifth above the key you press', p => p.osc1Semi === 7),
          task('Set the octave to −2 and play: deep bass territory', p => p.osc1Octave === -2),
        ]),
        match(
          'Quiz: match the bass',
          'Listen to the target, then use the controls to make your sound match it. Compare them as often as you like, then press Check. It doesn’t have to be perfect, just close.',
          { osc1Octave: -1 },
        ),
        match('Quiz: a brighter one', 'Different wave, different pitch. Which wave? How far up?', { osc1Wave: 'square', osc1Octave: 1 }),
      ],
    ),
    lesson(
      'sy1-3',
      'Harmonics and pulse width',
      'See the harmonics inside a wave, and reshape a square.',
      'learn',
      { start: { ...BASE, osc1Wave: 'square' }, controls: ['osc1Wave', 'osc1Pw', 'volume'], fresh: ['osc1Pw'] },
      [
        explain(
          'What makes a wave bright',
          `Every note you hear is really a stack of pitches: the note itself (the **fundamental**) and fainter **harmonics** at 2, 3, 4… times its frequency. The shape of the wave is just how those harmonics add up.

A sine has no harmonics. A saw has all of them, each one quieter than the last. A square has only the odd ones (1, 3, 5…), which gives it that hollow sound.

That's the whole secret of subtractive synthesis, which the next units are about: start with a wave full of harmonics, then take away the ones you don't want.`,
          { visual: 'harmonics' },
        ),
        explore('Squeeze the square', `The square wave has a **pulse width** control. At 50% it's a perfect square. Make it narrower and the wave turns into a thin pulse: brighter, more nasal, like an oboe or a chiptune melody.`, [
          task('Set the width to 20% or less and play', p => p.osc1Wave === 'square' && p.osc1Pw <= 0.2),
          task('Try 10%: thin and reedy', p => p.osc1Wave === 'square' && p.osc1Pw <= 0.1),
          task('Back to 50%: hollow again', p => p.osc1Wave === 'square' && Math.abs(p.osc1Pw - 0.5) < 0.03),
        ]),
        listen('Ear training: square or pulse?', 'A square (50%) sounds hollow; a narrow pulse sounds thin and nasal.', 'Which is it?', [['square', 'Square (50%)'], ['pulse', 'Narrow pulse']], [
          round('pulse', { osc1Pw: 0.12 }),
          round('square', { osc1Pw: 0.5 }),
          round('pulse', { osc1Pw: 0.18 }),
          round('square', { osc1Pw: 0.5, osc1Wave: 'square' }),
        ]),
        match('Quiz: the chiptune', 'Match the width of this pulse.', { osc1Pw: 0.2 }, { pass: 0.65 }),
      ],
    ),
    lesson(
      'sy1-4',
      'Checkpoint: first sounds',
      'Name the waves and match three sounds with wave, pitch and width.',
      'checkpoint',
      { start: BASE, controls: ['osc1Wave', ...C.pitch, 'osc1Pw', 'volume'] },
      [
        listen('Name the wave', 'A quick ear check.', 'Which wave is this?', [['sine', 'Sine'], ['triangle', 'Triangle'], ['saw', 'Saw'], ['square', 'Square']], [
          round('square', { osc1Wave: 'square' }),
          round('triangle', { osc1Wave: 'triangle' }),
          round('saw', { osc1Wave: 'saw' }),
          round('sine', { osc1Wave: 'sine' }),
        ]),
        match('Match 1 of 3', 'A soft, deep sound.', { osc1Wave: 'triangle', osc1Octave: -1 }),
        match('Match 2 of 3', 'Bright, and not on the key you press.', { osc1Semi: 7 }),
        match('Match 3 of 3', 'Thin and high.', { osc1Wave: 'square', osc1Pw: 0.2, osc1Octave: 1 }, { pass: 0.65 }),
      ],
    ),
  ],
};

export const ampUnit: SynthUnit = {
  id: 'sy-amp',
  title: 'Shaping notes',
  subtitle: 'The amp envelope (ADSR)',
  description: 'Attack, decay, sustain and release: how every note starts, holds and ends.',
  engine: 'subtractive',
  lessons: [
    lesson(
      'sy2-1',
      'Attack and release',
      'Fade notes in and out with the two simplest envelope controls.',
      'learn',
      { start: BASE, controls: ['osc1Wave', ...C.ampAR, 'volume'], fresh: C.ampAR },
      [
        explain(
          'Every note has a shape',
          `Play a piano key and the sound jumps in, then fades. Bow a violin and it swells in slowly. The **shape** of a note over time is as much a part of its sound as its tone.

On a synth that shape is drawn by an **envelope**. We'll start with just two of its controls:

- **Attack**: how long the sound takes to reach full volume after you press a key.
- **Release**: how long it takes to fade away after you let go.

Watch the picture in the amplifier module as you turn them: it's the shape of every note you play.`,
          { visual: 'adsr' },
        ),
        explore('Swells and tails', 'Hold notes down for a moment, then let go, and listen to the beginning and the end.', [
          task('Turn the attack past 1 second and hold a note: it swells in', p => p.ampAttack >= 1),
          task('Turn the attack back under 10 ms: notes start at once', p => p.ampAttack <= 0.01),
          task('Turn the release past 1.5 seconds and let go of a note: it rings on', p => p.ampRelease >= 1.5),
          task('Make the release short (under 50 ms): notes stop dead', p => p.ampRelease <= 0.05),
        ]),
        listen('Ear training: fast or slow attack?', 'Does the sound jump in, or fade in?', 'How does it start?', [['fast', 'Fast attack'], ['slow', 'Slow attack']], [
          round('slow', { ampAttack: 0.7 }, 'long'),
          round('fast', { ampAttack: 0.003 }, 'long'),
          round('slow', { ampAttack: 0.4 }, 'long'),
          round('fast', { ampAttack: 0.01 }, 'long'),
        ]),
        match('Quiz: the swell', 'This one fades in slowly and lingers after the key is released. Match its attack and release.', { ampAttack: 0.8, ampRelease: 1.2 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy2-2',
      'Decay and sustain',
      'Make notes that die away by themselves, like a pluck.',
      'learn',
      { start: BASE, controls: ['osc1Wave', ...C.ampADSR, 'volume'], fresh: ['ampDecay', 'ampSustain'] },
      [
        explain(
          'The middle of the note',
          `Two more controls complete the envelope, which is why it's called **ADSR**:

- **Decay**: after the attack reaches the top, how long the sound takes to fall…
- …to the **sustain** level, where it stays for as long as you hold the key.

Sustain is a **level**, not a time. At 100%, the note never falls, and decay does nothing at all. At 0%, the note dies away by itself even while you hold the key, just like a plucked string.`,
        ),
        explore('From organ to pluck', 'Hold each note down and listen to what happens while it’s held.', [
          task('Set sustain to 0 and hold a note: it fades by itself', p => p.ampSustain <= 0.02),
          task('With sustain at 0, make the decay short (under 0.2 s): a blip', p => p.ampSustain <= 0.02 && p.ampDecay <= 0.2),
          task('Make the decay long (over 1.5 s): it rings like a struck bell', p => p.ampSustain <= 0.02 && p.ampDecay >= 1.5),
          task('Set sustain to about half and decay around 0.5 s: the note settles', p => p.ampSustain >= 0.35 && p.ampSustain <= 0.65 && p.ampDecay >= 0.3 && p.ampDecay <= 0.9),
        ]),
        match('Quiz: the pluck', 'Every note dies away quickly by itself.', { ampAttack: 0, ampDecay: 0.3, ampSustain: 0, ampRelease: 0.3 }, { phrase: 'notes' }),
      ],
    ),
    lesson(
      'sy2-3',
      'Four classic shapes',
      'Recognise organ, pluck, pad and piano shapes, and build them.',
      'learn',
      { start: BASE, controls: ['osc1Wave', ...C.ampADSR, 'volume'] },
      [
        explain(
          'Shapes you’ll use again and again',
          `- **Organ**: instant attack, full sustain, short release. On while the key is down, off when it's not.
- **Pluck**: instant attack, short decay, no sustain. A guitar, a harp, a marimba.
- **Piano**: instant attack, long decay, no sustain, a medium release. It fades while held, and stops when let go.
- **Pad**: slow attack, full sustain, long release. Washes in and out.

Notice that the envelope alone, with the very same wave, makes four different instruments.`,
          { visual: 'adsr' },
        ),
        listen('Ear training: name the shape', 'Listen to how each note starts, holds and ends.', 'Which shape?', [['organ', 'Organ'], ['pluck', 'Pluck'], ['pad', 'Pad'], ['piano', 'Piano']], [
          round('pluck', { ampAttack: 0, ampDecay: 0.25, ampSustain: 0, ampRelease: 0.2 }, 'notes'),
          round('pad', { ampAttack: 0.8, ampSustain: 1, ampRelease: 1.5 }, 'long'),
          round('organ', { ampAttack: 0.003, ampSustain: 1, ampRelease: 0.04 }, 'notes'),
          round('piano', { ampAttack: 0, ampDecay: 1.5, ampSustain: 0, ampRelease: 0.4 }, 'long'),
        ]),
        match('Quiz: build the organ', 'Start from a pad and turn it into an organ.', { ampAttack: 0.003, ampSustain: 1, ampRelease: 0.04 }, { start: { ampAttack: 0.9, ampRelease: 1.6 }, phrase: 'notes' }),
        match('Quiz: build the piano', 'Fades while held, stops when released.', { ampAttack: 0, ampDecay: 1.4, ampSustain: 0, ampRelease: 0.35 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy2-4',
      'Checkpoint: shaping notes',
      'Match three sounds using the wave, the octave and the envelope.',
      'checkpoint',
      { start: BASE, controls: ['osc1Wave', 'osc1Octave', ...C.ampADSR, 'volume'] },
      [
        match('Match 1 of 3', 'A soft pad.', { osc1Wave: 'triangle', ampAttack: 0.6, ampRelease: 1.2 }, { phrase: 'long' }),
        match('Match 2 of 3', 'A short bass pluck.', { osc1Octave: -1, ampAttack: 0, ampDecay: 0.25, ampSustain: 0, ampRelease: 0.1 }, { phrase: 'notes' }),
        match('Match 3 of 3', 'A stab that settles and holds.', { osc1Wave: 'square', ampAttack: 0, ampDecay: 0.2, ampSustain: 0.4, ampRelease: 0.15 }, { phrase: 'notes' }),
      ],
    ),
  ],
};
