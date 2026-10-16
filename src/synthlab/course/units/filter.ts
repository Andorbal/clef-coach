/**
 * Part one, subtractive synthesis: the filter (unit 3).
 */
import { C, explain, explore, lesson, listen, match, round, task } from '../build';
import type { SynthUnit } from '../types';

const BASE = {
  engine: 'subtractive' as const,
  filterOn: true,
  filterType: 'lowpass' as const,
  filterSlope: '24' as const,
  filterCutoff: 18000,
  ampAttack: 0.004,
  ampDecay: 0.4,
  ampSustain: 1,
  ampRelease: 0.25,
};

export const filterUnit: SynthUnit = {
  id: 'sy-filter',
  title: 'The filter',
  subtitle: 'Cutoff, resonance, types, envelope',
  description: 'The heart of subtractive synthesis: carve the tone by taking frequencies away.',
  engine: 'subtractive',
  lessons: [
    lesson(
      'sy3-1',
      'Cutoff: bright and dark',
      'Use the most important knob on any synth.',
      'learn',
      { start: BASE, controls: ['osc1Wave', ...C.cutoff, 'volume'], fresh: C.cutoff },
      [
        explain(
          'Subtract to shape',
          `A saw wave is full of harmonics: bright, buzzy, a bit much on its own. **Subtractive synthesis** shapes it by taking some away, and the part that does it is the **filter**.

This one is a **low-pass** filter: it lets the low frequencies pass and cuts the high ones. The **cutoff** says where the cut starts. Turn it down and the sound gets darker and more muffled, like music through a wall; turn it up and it opens to full brightness.

Watch the picture in the filter module: the faint bars are the harmonics coming in, the bright bars are what gets through, and the curve is the filter.`,
        ),
        explore(
          'Sweep it',
          'Turn on the loop (or hold a note), then sweep the cutoff slowly from top to bottom and back. That sweep is in half the dance records ever made.',
          [
            task('Turn the cutoff below 400 Hz and play: muffled', p => p.filterCutoff < 400),
            task('Bring it back above 5 kHz and play: bright again', p => p.filterCutoff > 5000),
            task('Find a middle setting around 1 kHz: warm', p => p.filterCutoff > 700 && p.filterCutoff < 1500),
            task('Choose the sine wave and sweep the cutoff: almost nothing changes. A sine has no harmonics to remove!', p => p.osc1Wave === 'sine' && p.filterCutoff < 1000),
          ],
          { loop: 'pulse' },
        ),
        match('Quiz: the warm bass', 'A filtered, darker version of the saw. Where’s the cutoff?', { filterCutoff: 600 }),
        match('Quiz: a hollow tone', 'A different wave, filtered a little.', { osc1Wave: 'square', filterCutoff: 2000 }),
      ],
    ),
    lesson(
      'sy3-2',
      'Resonance',
      'Make the filter sing, whistle and squelch.',
      'learn',
      { start: { ...BASE, filterCutoff: 1200 }, controls: ['osc1Wave', ...C.cutoff, 'filterRes', 'volume'], fresh: ['filterRes'] },
      [
        explain(
          'A peak at the cutoff',
          `**Resonance** boosts the frequencies right at the cutoff, so the filter seems to ring at that pitch. A little adds bite and character. A lot makes a sharp, whistling peak, and sweeping the cutoff with high resonance gives the squelchy "wow" of acid house.

Look at the filter curve as you raise it: a bump grows at the cutoff.`,
        ),
        explore(
          'Squelch',
          'Start the bassline loop, raise the resonance, then sweep the cutoff while it plays.',
          [
            task('Raise the resonance above 70%', p => p.filterRes > 0.7),
            task('With high resonance, set the cutoff low (under 500 Hz): a rubbery bass', p => p.filterRes > 0.6 && p.filterCutoff < 500),
            task('With high resonance, set the cutoff around 2 kHz: a nasal whistle', p => p.filterRes > 0.6 && p.filterCutoff > 1500 && p.filterCutoff < 3000),
          ],
          { loop: 'bass' },
        ),
        listen('Ear training: resonant or smooth?', 'Is there a ringing peak in the sound?', 'Which filter?', [['res', 'Resonant'], ['smooth', 'Smooth']], [
          round('res', { filterRes: 0.8, filterCutoff: 900 }),
          round('smooth', { filterRes: 0, filterCutoff: 900 }),
          round('res', { filterRes: 0.75, filterCutoff: 1800 }),
          round('smooth', { filterRes: 0.05, filterCutoff: 1800 }),
        ]),
        match('Quiz: the singing filter', 'Cutoff and resonance together. Listen for the pitch of the whistle.', { filterCutoff: 800, filterRes: 0.7 }, { pass: 0.7 }),
      ],
    ),
    lesson(
      'sy3-3',
      'Filter types and slopes',
      'Low-pass, high-pass, band-pass and notch, gentle or steep.',
      'learn',
      { start: { ...BASE, filterCutoff: 1000 }, controls: ['osc1Wave', ...C.filter, 'volume'], fresh: ['filterType', 'filterSlope'] },
      [
        explain(
          'Four ways to cut',
          `- **Low-pass** (LP) keeps what's below the cutoff. Darker. The one you'll use most.
- **High-pass** (HP) keeps what's above. Thinner, like a small radio. Great for clearing mud out of pads.
- **Band-pass** (BP) keeps a band around the cutoff. Nasal, like a telephone or a wah pedal.
- **Notch** removes a band. Hollow and phasey.

The **slope** is how steeply the filter cuts beyond the cutoff: 12 dB per octave is gentle and open; 24 dB per octave is steep and thick, the sound of a Moog. Real synths often call these 2-pole and 4-pole.`,
          { visual: 'filter-types' },
        ),
        explore(
          'Try every type',
          'Keep a note or the loop going while you switch.',
          [
            task('Choose high-pass and set the cutoff above 1 kHz: thin', p => p.filterType === 'highpass' && p.filterCutoff > 1000),
            task('Choose band-pass around 1 kHz: a telephone voice', p => p.filterType === 'bandpass' && p.filterCutoff > 600 && p.filterCutoff < 2000),
            task('Choose notch and sweep the cutoff: a hollow sweep', p => p.filterType === 'notch'),
            task('Back to low-pass at 500 Hz: compare 12 dB and 24 dB slopes', p => p.filterType === 'lowpass' && p.filterSlope === '12' && p.filterCutoff < 800),
          ],
          { loop: 'chord' },
        ),
        listen('Ear training: which filter type?', 'Each has its own character.', 'Which type?', [['lowpass', 'Low-pass'], ['highpass', 'High-pass'], ['bandpass', 'Band-pass']], [
          round('highpass', { filterType: 'highpass', filterCutoff: 1500 }),
          round('lowpass', { filterType: 'lowpass', filterCutoff: 500 }),
          round('bandpass', { filterType: 'bandpass', filterCutoff: 1200, filterRes: 0.3 }),
          round('lowpass', { filterType: 'lowpass', filterCutoff: 900, filterRes: 0.3 }),
          round('highpass', { filterType: 'highpass', filterCutoff: 3000 }),
        ]),
        match('Quiz: the telephone', 'A voice down a phone line.', { filterType: 'bandpass', filterCutoff: 1200, filterRes: 0.4 }, { pass: 0.7 }),
        match('Quiz: thin and airy', 'All the weight taken out.', { filterType: 'highpass', filterSlope: '12', filterCutoff: 1600 }),
      ],
    ),
    lesson(
      'sy3-4',
      'The filter envelope',
      'Move the cutoff over each note: plucks, brass and wah.',
      'learn',
      {
        start: { ...BASE, filterCutoff: 400, fAttack: 0.002, fDecay: 0.5, fSustain: 0, fRelease: 0.3, ampSustain: 0.7, ampDecay: 0.6 },
        controls: ['osc1Wave', 'filterCutoff', 'filterRes', ...C.filterEnv, 'volume'],
        fresh: C.filterEnv,
      },
      [
        explain(
          'A second envelope',
          `You've met the envelope that shapes the volume. Most synths have a second one wired to the filter: the **filter envelope**. It has its own attack, decay, sustain and release, and the **env amount** knob on the filter says how far it moves the cutoff.

Set the cutoff low and the env amount up, and every note starts bright then closes down: the sound of a pluck, a plucked bass, a brass stab. Make the filter envelope's attack slow and notes open up gradually, like a wah.`,
          { visual: 'adsr' },
        ),
        explore('Plucks and swells', 'Use the arpeggio loop or play short notes.', [
          task('Raise the env amount above 40% and play: each note opens', p => p.filterEnv > 0.4),
          task('With the env amount up, make the filter decay short (under 0.2 s): a pluck', p => p.filterEnv > 0.3 && p.fDecay < 0.2 && p.fSustain < 0.2),
          task('Give the filter envelope a slow attack (over 0.4 s): a swelling wah', p => p.filterEnv > 0.3 && p.fAttack > 0.4),
          task('Try a negative env amount: notes start dark and open as they fade', p => p.filterEnv < -0.2),
        ], { loop: 'arp' }),
        match('Quiz: the pluck', 'Every note pings bright, then closes.', { filterCutoff: 250, filterEnv: 0.55, fDecay: 0.2, fSustain: 0 }, { phrase: 'notes' }),
        match('Quiz: the brass', 'The filter opens a moment after each note starts, then settles half open.', { filterCutoff: 450, filterEnv: 0.45, fAttack: 0.08, fDecay: 0.6, fSustain: 0.4 }, { phrase: 'notes' }),
      ],
    ),
    lesson(
      'sy3-5',
      'Key tracking and drive',
      'Keep high notes bright and add some grit.',
      'learn',
      { start: { ...BASE, filterCutoff: 700 }, controls: ['osc1Wave', 'filterCutoff', 'filterRes', 'filterKey', 'filterDrive', 'volume'], fresh: ['filterKey', 'filterDrive'] },
      [
        explain(
          'Two finishing touches',
          `**Key tracking** makes the cutoff follow the keyboard. Without it, the filter stays put while you play higher, so high notes lose their harmonics and sound dull compared with low ones. At 100%, the cutoff rises an octave for every octave you play, and every note keeps the same brightness.

**Drive** pushes the sound into the filter harder, like turning up an analogue circuit until it saturates: thicker and grittier.`,
        ),
        explore('Try both', 'Play low notes and high notes.', [
          task('With key track at 0, play a low note and a high one: the high one is duller', p => p.filterKey < 0.1),
          task('Set key track to 100% and play high: just as bright as the low notes', p => p.filterKey > 0.9),
          task('Add drive above 60% and play', p => p.filterDrive > 0.6),
        ]),
        match('Quiz: driven', 'A dirtier, thicker version of the filtered saw.', { filterCutoff: 1200, filterDrive: 0.8 }),
      ],
    ),
    lesson(
      'sy3-6',
      'Checkpoint: the filter',
      'Rebuild three classic filtered sounds.',
      'checkpoint',
      {
        start: { ...BASE, fDecay: 0.5, fSustain: 0, ampSustain: 1 },
        controls: ['osc1Wave', 'osc1Octave', ...C.filter, ...C.filterEnv, ...C.ampADSR, 'volume'],
      },
      [
        match('Match 1 of 3: acid bass', 'Resonant, squelchy, an octave down.', { osc1Octave: -1, filterCutoff: 300, filterRes: 0.75, filterEnv: 0.5, fDecay: 0.25, ampSustain: 0.8, ampRelease: 0.05 }, { phrase: 'notes', pass: 0.7 }),
        match('Match 2 of 3: soft pad', 'Dark and slow.', { filterCutoff: 900, ampAttack: 0.6, ampRelease: 1.2 }, { phrase: 'long' }),
        match('Match 3 of 3: hollow pluck', 'A different wave, a filter that snaps shut, notes that die away.', { osc1Wave: 'square', filterCutoff: 400, filterEnv: 0.5, fDecay: 0.3, ampDecay: 0.5, ampSustain: 0 }, { phrase: 'notes' }),
      ],
    ),
  ],
};
