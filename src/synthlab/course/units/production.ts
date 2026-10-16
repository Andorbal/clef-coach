/**
 * Part five: effects (unit 10) and sound design projects (unit 11), where everything comes
 * together: classic sounds built from scratch on the full subtractive panel.
 */
import { ALL_SUBTRACTIVE, explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'subtractive' as const,
  filterOn: true,
  filterCutoff: 4000,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.25,
};

export const effectsUnit: SynthUnit = {
  id: 'sy-fx',
  title: 'Effects',
  subtitle: 'Drive, chorus, delay, reverb',
  description: 'Put a sound in a space: grit, width, echoes and rooms.',
  engine: 'subtractive',
  requires: ['sy-filter'],
  lessons: [
    lesson(
      'sy10-1',
      'Drive and chorus',
      'Add grit, then width.',
      'learn',
      { start: BASE, controls: ['osc1Wave', 'filterCutoff', 'drive', 'chorusMix', 'chorusRate', 'chorusDepth', 'volume'], fresh: ['drive', 'chorusMix', 'chorusRate', 'chorusDepth'] },
      [
        explain(
          'After the synth',
          `Nearly every synth ends with a few built-in effects, usually in this order:

- **Drive** (distortion, saturation) rounds off the peaks of the wave, adding harmonics: warmth when gentle, fuzz and aggression when pushed.
- **Chorus** mixes in copies of the sound that drift slightly in time and pitch. It sounds wider, lusher and more "80s": the sound of a Juno's strings and countless electric pianos.

Effects don't change the notes or the envelope; they colour and place the sound.`,
        ),
        explore('Colour it', 'Use a chord loop.', [
          task('Raise drive past 50%', p => p.drive > 0.5),
          task('Bring the drive back down and the chorus mix past 50%', p => p.drive < 0.2 && p.chorusMix > 0.5),
          task('Raise the chorus depth to 100%: seasick', p => p.chorusMix > 0.3 && p.chorusDepth > 0.95),
        ], { loop: 'chord' }),
        match('Quiz: the gritty lead', 'Distorted.', { drive: 0.7 }),
        match('Quiz: the lush chorus', 'Wide and shimmering.', { chorusMix: 0.8, chorusDepth: 0.8 }, { phrase: 'long' }),
      ],
    ),
    lesson(
      'sy10-2',
      'Delay',
      'Echoes in time with the music.',
      'learn',
      { start: { ...BASE, ampDecay: 0.3, ampSustain: 0, ampRelease: 0.2 }, controls: ['osc1Wave', 'filterCutoff', 'delayMix', 'delayDiv', 'delayFeedback', 'volume'], fresh: ['delayMix', 'delayDiv', 'delayFeedback'] },
      [
        explain(
          'Echo, echo',
          `A **delay** plays the sound back again a moment later, and again, quieter each time, here bouncing between left and right ("ping-pong").

- **Time**: how far apart the echoes are, as a note length so they fall in time with the music. The **dotted eighth** (1/8D) is the classic: echoes land between the beats and make simple parts sound busy and rhythmic.
- **Feedback**: how many echoes. Each one feeds the next.
- **Mix**: how loud the echoes are.`,
        ),
        explore('Echo', 'Play short notes, or the arpeggio loop.', [
          task('Raise the delay mix past 40%', p => p.delayMix > 0.4),
          task('Set the time to 1/8D (dotted eighths)', p => p.delayMix > 0.2 && p.delayDiv === '1/8D'),
          task('Raise the feedback past 70%: echoes go on and on', p => p.delayMix > 0.2 && p.delayFeedback > 0.7),
        ], { loop: 'arp' }),
        listen('Ear training: echo timing', 'Count the gap between echoes.', 'Which delay time?', [['1/4', 'Quarter notes (1/4)'], ['1/8', 'Eighth notes (1/8)'], ['1/16', 'Sixteenths (1/16)']], [
          round('1/4', { delayMix: 0.6, delayDiv: '1/4', delayFeedback: 0.5 }, 'short'),
          round('1/16', { delayMix: 0.6, delayDiv: '1/16', delayFeedback: 0.6 }, 'short'),
          round('1/8', { delayMix: 0.6, delayDiv: '1/8', delayFeedback: 0.5 }, 'short'),
        ]),
        match('Quiz: the echo', 'How far apart are the echoes, and how many?', { delayMix: 0.5, delayDiv: '1/4', delayFeedback: 0.5 }, { phrase: 'short' }),
      ],
    ),
    lesson(
      'sy10-3',
      'Reverb',
      'Put the sound in a room, a hall or a cathedral.',
      'learn',
      { start: { ...BASE, ampDecay: 0.3, ampSustain: 0, ampRelease: 0.2 }, controls: ['osc1Wave', 'filterCutoff', 'reverbMix', 'reverbSize', 'volume'], fresh: ['reverbMix', 'reverbSize'] },
      [
        explain(
          'A space around the sound',
          `**Reverb** imitates the thousands of reflections a sound makes in a room. **Size** is how big the space is, and so how long it rings; **mix** is how much of it you hear.

A little reverb makes a dry synth sound like it's in a real space. A lot pushes it far away and turns short sounds into washes, perfect for ambient pads and plucks.`,
        ),
        explore('Find the space', 'Short notes show it best.', [
          task('Raise the reverb mix past 40%', p => p.reverbMix > 0.4),
          task('Make the space huge (size above 90%)', p => p.reverbMix > 0.2 && p.reverbSize > 0.9),
          task('Small room: size under 30%', p => p.reverbMix > 0.2 && p.reverbSize < 0.3),
        ], { loop: 'stabs' }),
        match('Quiz: the hall', 'A big space.', { reverbMix: 0.5, reverbSize: 0.85 }, { phrase: 'short' }),
      ],
    ),
    lesson(
      'sy10-4',
      'Checkpoint: effects',
      'Match two effect chains.',
      'checkpoint',
      {
        start: { ...BASE, ampDecay: 0.3, ampSustain: 0, ampRelease: 0.2 },
        controls: ['osc1Wave', 'filterCutoff', 'drive', 'chorusMix', 'chorusDepth', 'delayMix', 'delayDiv', 'delayFeedback', 'reverbMix', 'reverbSize', 'volume'],
      },
      [
        match('Match 1 of 2: the ambient pluck', 'Echoes into a big space.', { delayMix: 0.4, delayDiv: '1/8D', delayFeedback: 0.5, reverbMix: 0.45, reverbSize: 0.8 }, { phrase: 'short' }),
        match('Match 2 of 2: the dirty stab', 'Distorted, in a small room.', { drive: 0.6, reverbMix: 0.3, reverbSize: 0.3 }, { phrase: 'short' }),
      ],
    ),
  ],
};

/** The projects start from a plain saw with every control on the panel. */
const BLANK = { engine: 'subtractive' as const, filterOn: true, filterCutoff: 18000 };
const PROJECT_PASS = 0.75;

const project = (id: string, title: string, goal: string, recipe: string, target: object, phrase: 'note' | 'notes' | 'long' | 'chord' | 'short' | 'riff' | 'legato' = 'note', pass = PROJECT_PASS) =>
  lesson(id, title, goal, 'project', { start: BLANK, controls: ALL_SUBTRACTIVE }, [
    explain('The recipe', recipe),
    match('Build it', 'Everything is on the panel now. Start with the biggest ingredients (wave, pitch, filter, envelope), check, then refine. Hints will point you to what matters most.', target, { phrase, pass }),
  ]);

export const designUnit: SynthUnit = {
  id: 'sy-design',
  title: 'Sound design',
  subtitle: 'Build the classics from scratch',
  description: 'Everything together: acid basses, supersaws, pads, plucks, brass and drums, with the whole panel.',
  engine: 'subtractive',
  requires: ['sy-special', 'sy-fx'],
  lessons: [
    project(
      'sy11-1',
      'Acid bass',
      'Build the TB-303 squelch from nothing.',
      `The sound of acid house, from Roland's TB-303 (FL Studio's Transistor Bass copies it).

- **Source**: one saw, an octave down.
- **Filter**: a 24 dB low-pass, cutoff low (around 300 Hz), resonance high (around 75%).
- **Filter envelope**: a big amount (around 55%), short decay (about 0.2 s), no sustain. This is the squelch.
- **Amp**: full sustain, very short release.
- **Voice**: mono or legato, with a short glide for the slides.`,
      { osc1Octave: -1, filterCutoff: 300, filterRes: 0.75, filterEnv: 0.55, fDecay: 0.2, fSustain: 0, ampRelease: 0.05, voiceMode: 'legato', glide: 0.06 },
      'riff',
    ),
    project(
      'sy11-2',
      'Supersaw lead',
      'Build a huge trance lead.',
      `The anthem lead of trance and modern pop.

- **Source**: saws on both oscillators, the second a few cents detuned.
- **Unison**: 7 voices, detune around 35 cents, wide.
- **Filter**: open, a little darker than fully bright (around 6 kHz).
- **Amp**: quick attack, a medium release (about 0.3 s).
- **Effects**: some reverb.`,
      { osc2Level: 0.7, osc2Fine: 9, unison: 7, unisonDetune: 35, unisonWidth: 0.9, filterCutoff: 6000, ampRelease: 0.3, reverbMix: 0.3 },
      'long',
    ),
    project(
      'sy11-3',
      'Warm pad',
      'Build a slow, breathing pad.',
      `A soft background that fills the space under everything else.

- **Source**: two detuned saws.
- **Filter**: low-pass around 1.4 kHz, a little resonance.
- **LFO**: very slowly moving the cutoff (around 0.25 Hz, half an octave).
- **Amp**: slow attack (almost a second), long release (one and a half seconds).
- **Effects**: chorus and plenty of reverb.`,
      { osc2Level: 0.7, osc2Fine: 9, filterCutoff: 1400, filterRes: 0.2, lfoCutoff: 0.5, lfoRate: 0.25, ampAttack: 0.9, ampRelease: 1.5, chorusMix: 0.5, reverbMix: 0.45, reverbSize: 0.8 },
      'chord',
      0.5,
    ),
    project(
      'sy11-4',
      'Pluck with echoes',
      'Build a bright pluck that bounces in time.',
      `The pluck of house and future bass.

- **Source**: two saws, the second slightly detuned.
- **Filter**: low-pass, cutoff low (around 300 Hz), a strong filter envelope (around 55%) with a short decay and no sustain.
- **Amp**: no sustain, a decay of about half a second.
- **Effects**: a dotted-eighth delay and some reverb.`,
      { osc2Level: 0.7, osc2Fine: 9, filterCutoff: 300, filterEnv: 0.55, fDecay: 0.18, fSustain: 0, ampDecay: 0.45, ampSustain: 0, ampRelease: 0.3, delayMix: 0.35, delayDiv: '1/8D', reverbMix: 0.25 },
      'notes',
    ),
    project(
      'sy11-5',
      'Brass stab',
      'Build the "blat" of synth brass.',
      `The bright, punchy brass of 80s synth-pop.

- **Source**: two saws, slightly detuned.
- **Filter**: low-pass around 500 Hz, the filter envelope opening it after a short attack (about 60 ms), decaying to half-open.
- **Amp**: a short attack (30 ms), short release.
- **LFO**: a little vibrato that fades in.`,
      { osc2Level: 0.7, osc2Fine: 9, filterCutoff: 500, filterEnv: 0.45, fAttack: 0.06, fDecay: 0.5, fSustain: 0.5, ampAttack: 0.03, ampRelease: 0.2, lfoPitch: 8, lfoRate: 5, lfoFade: 0.4 },
      'chord',
    ),
    project(
      'sy11-6',
      'Synth kick',
      'Build a kick drum with nothing but a sine.',
      `Drum machines make kicks with an oscillator and two envelopes.

- **Source**: a sine, an octave down.
- **Mod envelope**: pitch up about 30 semitones, a decay of about 0.15 s. This is the "thump".
- **Amp**: instant attack, no sustain, a decay of about 0.45 s.
- **Effects**: a touch of drive for punch.`,
      { osc1Wave: 'sine', osc1Octave: -1, modPitch: 30, modDecay: 0.15, ampAttack: 0, ampDecay: 0.45, ampSustain: 0, ampRelease: 0.1, drive: 0.2 },
      'short',
    ),
    lesson(
      'sy11-7',
      'Final exam: mystery sounds',
      'Three sounds, no recipes. Use your ears.',
      'checkpoint',
      { start: BLANK, controls: ALL_SUBTRACTIVE },
      [
        explain(
          'No recipes this time',
          `Three sounds you've met in this course, but no ingredients list. Listen first and ask the questions you've learned to ask:

- Which **wave**? What **pitch**?
- Is it **filtered**? Is there **resonance**? Does the filter **move**?
- How does each note **start, hold and end**?
- Does anything **wobble**? Any **effects**?

Use the hints if you get stuck. Good luck!`,
        ),
        match('Mystery 1 of 3', 'Listen closely.', { osc1Wave: 'square', osc1Pw: 0.3, filterCutoff: 1800, lfoPitch: 25, lfoRate: 6, ampRelease: 0.15 }, { phrase: 'long', pass: 0.62 }),
        match('Mystery 2 of 3', 'Listen closely.', { osc1Octave: -1, filterCutoff: 500, filterEnv: 0.4, fDecay: 0.3, fSustain: 0.1, ampDecay: 0.4, ampSustain: 0.5, subLevel: 0.5 }, { phrase: 'riff', pass: 0.6 }),
        match('Mystery 3 of 3', 'Listen closely.', { osc1Wave: 'triangle', ampAttack: 0.5, ampRelease: 1.2, reverbMix: 0.4, chorusMix: 0.4 }, { phrase: 'chord', pass: PROJECT_PASS }),
      ],
    ),
  ],
};
