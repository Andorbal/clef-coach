/**
 * Part one, subtractive synthesis: special moves (unit 6): ring modulation, hard sync,
 * the pitch envelope, glide and legato.
 */
import { explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'subtractive' as const,
  filterOn: true,
  filterCutoff: 8000,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.25,
};

export const specialUnit: SynthUnit = {
  id: 'sy-special',
  title: 'Special moves',
  subtitle: 'Ring mod, sync, pitch envelope, glide',
  description: 'The tricks behind bells, screaming leads, kick drums, lasers and sliding basslines.',
  engine: 'subtractive',
  lessons: [
    lesson(
      'sy6-1',
      'Ring modulation',
      'Multiply two oscillators into metal and bells.',
      'learn',
      {
        start: { ...BASE, osc1Wave: 'sine', osc2Wave: 'sine', osc1Level: 0.8, osc2Level: 0, osc2Semi: 0, ampDecay: 1.5, ampSustain: 0.2, ampRelease: 0.8 },
        controls: ['osc1Wave', 'osc2Wave', 'osc2Semi', 'osc2Fine', 'osc1Level', 'osc2Level', 'ringLevel', 'volume'],
        fresh: ['ringLevel'],
      },
      [
        explain(
          'Sum and difference',
          `A **ring modulator** multiplies one oscillator by another. Something odd happens: you no longer hear either pitch. You hear their **sum** and their **difference** instead. With two notes 300 and 200 Hz apart, you get 500 Hz and 100 Hz.

Those new pitches are rarely in tune with each other or with the key you pressed, so the result is clangy and metallic: bells, gongs, robot voices, sci-fi. It's on many synths as **Ring** or **RM**; in FL Studio's Sytrus it has its own matrix.`,
        ),
        explore('Make metal', 'Start with two sines.', [
          task('Turn the ring up full and both oscillator levels to 0', p => p.ringLevel > 0.9 && p.osc1Level < 0.05 && p.osc2Level < 0.05),
          task('Move oscillator 2 by +6 semitones: hear the metal change', p => p.ringLevel > 0.5 && p.osc2Semi === 6),
          task('Add a little fine tuning (+30 cents or more) for a stranger bell', p => p.ringLevel > 0.5 && p.osc2Fine >= 30),
          task('Try saw waves on both: a harsh robot', p => p.ringLevel > 0.5 && p.osc1Wave === 'saw' && p.osc2Wave === 'saw'),
        ]),
        match('Quiz: the bell', 'Ring-modulated sines, a strange interval apart.', { ringLevel: 1, osc1Level: 0, osc2Semi: 6 }),
      ],
    ),
    lesson(
      'sy6-2',
      'Hard sync',
      'Tune a synced oscillator to change its tone, not its pitch.',
      'learn',
      {
        start: { ...BASE, osc1Level: 0, osc2Level: 0.8 },
        controls: ['osc1Wave', 'osc2Wave', 'osc2Semi', 'osc2Sync', 'osc1Level', 'osc2Level', 'filterCutoff', 'volume'],
        fresh: ['osc2Sync'],
      },
      [
        explain(
          'Forced to restart',
          `With **hard sync** on, oscillator 2 is forced to restart its wave every time oscillator 1 starts a new cycle. Oscillator 1 sets the pitch you hear. Tuning oscillator 2 up no longer changes the note; instead it changes how many partial cycles fit in before the restart, so the **tone** changes, with a bright, tearing, vocal edge.

You can hear it even with oscillator 1 silent: it still sets the rhythm of the restarts.`,
        ),
        explore('Tear it up', 'Hold a note.', [
          task('Turn sync on, then raise oscillator 2 to +7 semitones', p => p.osc2Sync && p.osc2Semi === 7),
          task('Now +12: still the same note, very different tone', p => p.osc2Sync && p.osc2Semi === 12),
          task('Turn sync off at +7: now you hear a different note', p => !p.osc2Sync && p.osc2Semi === 7),
        ]),
        listen('Ear training: synced or not?', 'Sync gives a hard, ripping edge; without it you hear two notes or a different note.', 'Which?', [['sync', 'Synced'], ['free', 'Not synced']], [
          round('sync', { osc2Sync: true, osc2Semi: 9 }),
          round('free', { osc2Sync: false, osc2Semi: 9 }),
          round('sync', { osc2Sync: true, osc2Semi: 5 }),
          round('free', { osc2Sync: false, osc2Semi: 12 }),
        ]),
        match('Quiz: the sync tone', 'Synced, and tuned up. How far?', { osc2Sync: true, osc2Semi: 9 }),
      ],
    ),
    lesson(
      'sy6-3',
      'The pitch envelope',
      'Sweep the pitch at the start of each note: kicks, zaps and sync leads.',
      'learn',
      {
        start: { ...BASE, ampAttack: 0, ampDecay: 0.4, ampSustain: 0, ampRelease: 0.15 },
        controls: ['osc1Wave', 'osc1Octave', 'modAttack', 'modDecay', 'modPitch', 'ampDecay', 'volume'],
        fresh: ['modAttack', 'modDecay', 'modPitch'],
      },
      [
        explain(
          'A quick sweep',
          `Many synths have an extra, simple envelope for modulation: here, the **mod envelope**, with just attack and decay. Point it at **pitch** and each note starts higher (or lower) and slides to its true pitch.

- A big drop over a tenth of a second or so, on a sine: a **kick drum**. That's how the 808 does it.
- A big drop over a fifth of a second, on a square: a **laser**.
- A small, fast one: a "blip" that gives a bass or a pluck more punch.`,
        ),
        explore('Drums and lasers', 'Play short notes.', [
          task('Sine, octave −1, pitch +30 st or more, decay under 0.2 s: a kick drum', p => p.osc1Wave === 'sine' && p.osc1Octave === -1 && p.modPitch >= 30 && p.modDecay <= 0.2),
          task('Square, pitch +48 st, decay around 0.2 s: a laser', p => p.osc1Wave === 'square' && p.modPitch >= 40 && p.modDecay >= 0.12 && p.modDecay <= 0.35),
          task('Try a negative pitch amount: notes swoop up into place', p => p.modPitch <= -12),
        ]),
        match('Quiz: the kick', 'Deep, short, with a fast drop.', { osc1Wave: 'sine', osc1Octave: -1, modPitch: 32, modDecay: 0.12, ampDecay: 0.45 }, { phrase: 'short' }),
        match('Quiz: the laser', 'A zap.', { osc1Wave: 'square', modPitch: 48, modDecay: 0.18 }, { phrase: 'short' }),
      ],
    ),
    lesson(
      'sy6-4',
      'Sync sweeps',
      'Put the pitch envelope on a synced oscillator for the classic sync lead.',
      'learn',
      {
        start: { ...BASE, osc1Level: 0.2, osc2Level: 0.8, osc2Sync: true, modDecay: 0.4 },
        controls: ['osc2Semi', 'osc2Sync', 'osc1Level', 'osc2Level', 'modAttack', 'modDecay', 'modOsc2', 'filterCutoff', 'volume'],
        fresh: ['modOsc2'],
      },
      [
        explain(
          'Where sync comes alive',
          `Hard sync shines when oscillator 2's pitch **moves**. Send the mod envelope to oscillator 2 only (**Osc 2 pitch**), and each note starts with a sweep through those tearing sync tones: the screaming lead of 80s rock synths and modern EDM alike.`,
        ),
        explore('Sweep it', 'Play notes and listen to each attack.', [
          task('Raise Osc 2 pitch above +24 st and play', p => p.modOsc2 >= 24),
          task('Lengthen the mod decay past 0.6 s: a slower sweep', p => p.modOsc2 >= 12 && p.modDecay >= 0.6),
          task('Turn sync off and compare: just a pitch bend', p => !p.osc2Sync && p.modOsc2 >= 12),
        ]),
        match('Quiz: the sync lead', 'A synced sweep at the start of every note. How far does it sweep, and for how long?', { modOsc2: 30, modDecay: 1.2 }, { phrase: 'notes' }),
      ],
    ),
    lesson(
      'sy6-5',
      'Glide and legato',
      'Mono, legato and sliding between notes.',
      'learn',
      {
        start: { ...BASE, filterCutoff: 2500 },
        controls: ['osc1Wave', 'voiceMode', 'glide', 'filterCutoff', 'volume'],
        fresh: ['voiceMode', 'glide'],
      },
      [
        explain(
          'One note at a time',
          `- **Poly** lets you play chords: every key gets its own voice.
- **Mono** plays one note at a time, like a trumpet or a bass guitar. A new key cuts off the last one and restarts the envelopes.
- **Legato** is mono, but when you press a new key **before letting go** of the last, the note just changes pitch without restarting: smooth, connected lines.

**Glide** (portamento) slides the pitch from one note to the next instead of jumping. In legato mode it only slides between overlapping notes, so you choose which notes slide by how you play: exactly how a TB-303 bassline works.`,
        ),
        explore('Slide', 'The legato-line loop plays overlapping notes.', [
          task('Choose Legato and set glide to about 0.2 s', p => p.voiceMode === 'legato' && p.glide >= 0.12 && p.glide <= 0.35),
          task('Choose Poly with glide still up: every note slides in from the last', p => p.voiceMode === 'poly' && p.glide >= 0.1),
          task('Choose Mono and play two keys at once: only one sounds', p => p.voiceMode === 'mono'),
        ], { loop: 'lead' }),
        listen('Ear training: glide or not?', 'Do the notes slide or jump?', 'Which?', [['glide', 'Slides'], ['jump', 'Jumps']], [
          round('glide', { voiceMode: 'legato', glide: 0.3 }, 'legato'),
          round('jump', { voiceMode: 'legato', glide: 0 }, 'legato'),
          round('glide', { voiceMode: 'legato', glide: 0.2 }, 'legato'),
          round('jump', { voiceMode: 'poly', glide: 0 }, 'legato'),
        ]),
        match('Quiz: the slide', 'A legato line that slides. How long is each slide?', { voiceMode: 'legato', glide: 0.35 }, { phrase: 'legato', pass: 0.86 }),
      ],
    ),
    lesson(
      'sy6-6',
      'Checkpoint: special moves',
      'Match three special sounds.',
      'checkpoint',
      {
        start: { ...BASE, ampSustain: 1 },
        controls: ['osc1Wave', 'osc2Wave', 'osc1Octave', 'osc2Semi', 'osc2Sync', 'osc1Level', 'osc2Level', 'ringLevel', 'modAttack', 'modDecay', 'modPitch', 'modOsc2', 'ampDecay', 'ampSustain', 'voiceMode', 'glide', 'volume'],
      },
      [
        match('Match 1 of 3: the tom', 'A drum: a tone that drops a little and dies quickly.', { osc1Wave: 'sine', modPitch: 12, modDecay: 0.15, ampDecay: 0.5, ampSustain: 0 }, { phrase: 'short' }),
        match('Match 2 of 3: the robot', 'Two sines multiplied.', { osc1Wave: 'sine', osc2Wave: 'sine', ringLevel: 1, osc1Level: 0, osc2Semi: 5 }),
        match('Match 3 of 3: the screamer', 'Synced and swept.', { osc1Level: 0.2, osc2Level: 0.8, osc2Sync: true, modOsc2: 24, modDecay: 1.2 }, { phrase: 'notes' }),
      ],
    ),
  ],
};
