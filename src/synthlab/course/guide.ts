/**
 * The field guide: where the course's ideas live on the kinds of synth a learner meets next,
 * in any DAW or plugin collection. The point of Synth School is to open one of these and
 * feel at home, so each entry says which part of the course it uses and what to look for.
 *
 * Entries describe kinds of synth, not products: Clef Coach isn't tied to any DAW or
 * vendor, and layouts differ from synth to synth, so entries name what to look for rather
 * than where every pixel is.
 */
export interface GuideEntry {
  name: string;
  kind: string;
  /** Which units of the course apply (unit ids). */
  units: string[];
  body: string;
  /** What to look for, as [course name, their name]. */
  map: [string, string][];
}

export const FIELD_GUIDE: readonly GuideEntry[] = [
  {
    name: 'Three-oscillator synth',
    kind: 'Subtractive',
    units: ['sy-osc', 'sy-amp', 'sy-filter', 'sy-mix'],
    body: 'Three oscillators, a filter and an envelope or two: the simplest synth in most DAWs, and the perfect first one. On some, the envelope and filter sit on a separate tab or page rather than on the front panel.',
    map: [
      ['Wave', 'the shape buttons or wave menu on each oscillator'],
      ['Semitones / Octave', 'Semi / Oct, Coarse, or feet (16′, 8′, 4′)'],
      ['Fine', 'Fine, Detune or Cents'],
      ['Osc 2 / Osc 3 level', 'the mixer, or each oscillator’s volume'],
      ['Amp envelope', 'Amp Env, VCA Env or Env 1'],
      ['Cutoff / Resonance', 'Cutoff / Res, sometimes on that separate page'],
    ],
  },
  {
    name: '303-style bass synth',
    kind: 'Subtractive (acid)',
    units: ['sy-filter', 'sy-special'],
    body: 'A copy of Roland’s TB-303 acid bass: one oscillator, a resonant low-pass, a decaying filter envelope, and slides between notes.',
    map: [
      ['Cutoff / Resonance', 'Cutoff / Reso'],
      ['Filter env amount', 'Env Mod'],
      ['Filter decay', 'Decay'],
      ['Legato + glide', 'Slide'],
    ],
  },
  {
    name: 'Virtual analogue',
    kind: 'Subtractive',
    units: ['sy-osc', 'sy-amp', 'sy-filter', 'sy-mix', 'sy-lfo', 'sy-fx'],
    body: 'A software copy of a classic analogue synth: two or three oscillators and noise, a multimode filter, envelopes, an LFO and built-in effects. Every control is something from Part 1.',
    map: [
      ['Oscillators, sub, noise', 'the oscillator section'],
      ['Filter + filter envelope', 'the filter section and its envelope'],
      ['LFO', 'the LFO and where it is routed (Dest, Target)'],
      ['Unison / Detune', 'Unison or Voices, Detune, Spread'],
      ['Chorus, delay, reverb', 'the effects section'],
    ],
  },
  {
    name: 'Big subtractive synth',
    kind: 'Subtractive',
    units: ['sy-mix', 'sy-filter', 'sy-lfo', 'sy-special', 'sy-fx'],
    body: 'Several oscillators, two filters, and an envelope and LFO for nearly everything. A bigger panel, but every section is one you know.',
    map: [
      ['Mixer', 'the oscillator levels'],
      ['Mod envelope', 'the pitch or modulation envelopes'],
      ['LFO → anything', 'a mod matrix: source, destination, amount'],
      ['Effects', 'the FX section'],
    ],
  },
  {
    name: 'Classic FM synth',
    kind: 'FM',
    units: ['sy-fm'],
    body: 'Four or six operators and a set of fixed algorithms, as on the Yamaha DX7 and the many FM synths since: electric pianos, bells and basses. Look for each modulator’s ratio, and the amount and time of its modulation: that’s the FM unit in a nutshell.',
    map: [
      ['Algorithm', 'Algorithm or Algo'],
      ['Operator ratio', 'Ratio, or Coarse / Fine'],
      ['Operator level', 'Output Level or Level'],
      ['Operator envelope', 'each operator’s envelope (sometimes rates and levels, not ADSR)'],
      ['Feedback', 'Feedback'],
    ],
  },
  {
    name: 'Matrix FM synth',
    kind: 'FM + subtractive',
    units: ['sy-fm', 'sy-filter', 'sy-special', 'sy-fx'],
    body: 'Operators wired by a matrix rather than fixed algorithms: any operator can modulate any other (FM), and often ring-modulate it too (RM). Each operator has its own envelope, and filters and effects follow.',
    map: [
      ['Algorithm', 'the FM matrix (row: modulator, column: target)'],
      ['Ring mod', 'the RM matrix, or a ring mode per operator'],
      ['Operator ratio / level', 'each operator’s pitch and volume'],
      ['Filter', 'cutoff, resonance, envelope'],
    ],
  },
  {
    name: 'Additive synth',
    kind: 'Additive',
    units: ['sy-add', 'sy-filter', 'sy-lfo', 'sy-mix'],
    body: 'Draw the harmonics yourself, then shape them over time. Many dress the engine in subtractive controls whose filters and envelopes move harmonics directly, which is why they can do things no analogue filter can.',
    map: [
      ['Drawbars', 'the harmonic or partial editor'],
      ['Harmonic filter', 'its filters (they work on harmonics)'],
      ['Harmonic envelope', 'envelopes on the filter and timbre'],
      ['Stretch', 'Stretch, Inharmonicity or partial shift'],
    ],
  },
  {
    name: 'Wavetable synth',
    kind: 'Wavetable',
    units: ['sy-wt', 'sy-lfo', 'sy-mix', 'sy-fx'],
    body: 'The synths behind modern bass music. Two wavetable oscillators, a sub and noise, filters, envelopes and LFOs you drag onto any knob: everything in Part 4, with Part 1 underneath.',
    map: [
      ['Wavetable position', 'WT Pos, Position or Frame'],
      ['Mod envelope / LFO → position', 'drag an envelope or LFO onto the position knob'],
      ['Unison / Detune', 'Unison, Detune, Blend'],
    ],
  },
  {
    name: 'Preset player',
    kind: 'Presets + macros',
    units: ['sy-filter', 'sy-amp', 'sy-fx'],
    body: 'Thousands of presets with a handful of macro knobs. Now you know what those macros usually are: cutoff, resonance, attack, release, the LFO, reverb and delay.',
    map: [['Macro knobs', 'often cutoff, resonance, attack, release, FX']],
  },
];
