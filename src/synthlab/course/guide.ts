/**
 * The field guide: where the course's ideas live on the synths that ship with FL Studio
 * (and the free wavetable synth most producers try next). The point of Synth School is to
 * open one of these and feel at home, so each entry says which part of the course it uses
 * and what to look for.
 *
 * Plugin layouts change between versions; entries name what to look for rather than
 * where every pixel is.
 *
 * Products are named in plain words only, to say where to look: no logos, nothing that reads
 * as a partnership. The guide ends with a note that Clef Coach isn't affiliated with them.
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
    name: '3x Osc',
    kind: 'Subtractive',
    units: ['sy-osc', 'sy-amp', 'sy-filter', 'sy-mix'],
    body: 'Three oscillators and nothing else, which makes it the perfect first synth. Its envelope and filter live in the channel itself: open the channel settings and its instrument (INS) tab.',
    map: [
      ['Wave', 'the shape buttons on each oscillator'],
      ['Semitones / Octave', 'Coarse'],
      ['Fine', 'Fine'],
      ['Osc 2 / Osc 3 level', 'the mix volume of oscillators 2 and 3'],
      ['Amp envelope', 'INS tab, Volume target: the envelope'],
      ['Cutoff / Resonance', 'INS tab: Mod X / Mod Y'],
    ],
  },
  {
    name: 'Transistor Bass',
    kind: 'Subtractive (303)',
    units: ['sy-filter', 'sy-special'],
    body: 'A copy of the TB-303 acid bass: one oscillator, a resonant low-pass, a decaying filter envelope, and slides between notes.',
    map: [
      ['Cutoff / Resonance', 'Cutoff / Reso'],
      ['Filter env amount', 'Env Mod'],
      ['Filter decay', 'Decay'],
      ['Legato + glide', 'Slide'],
    ],
  },
  {
    name: 'PoiZone',
    kind: 'Subtractive',
    units: ['sy-osc', 'sy-amp', 'sy-filter', 'sy-mix', 'sy-lfo', 'sy-fx'],
    body: 'A compact virtual-analogue synth: two oscillators and noise, a multimode filter, envelopes, an LFO and built-in effects. Every control is something from Part 1.',
    map: [
      ['Oscillators, sub, noise', 'the oscillator section'],
      ['Filter + filter envelope', 'the filter section and its envelope'],
      ['LFO', 'the LFO and where it is routed'],
    ],
  },
  {
    name: 'Sawer',
    kind: 'Subtractive',
    units: ['sy-mix', 'sy-filter', 'sy-lfo', 'sy-fx'],
    body: 'A vintage-style analogue synth, at its best for thick, detuned saws: unison, a warm filter, LFOs and lush effects.',
    map: [
      ['Unison / Detune', 'its unison voices and detune'],
      ['Filter', 'cutoff, resonance and envelope amount'],
      ['Chorus', 'the effects section'],
    ],
  },
  {
    name: 'GMS',
    kind: 'Subtractive',
    units: ['sy-mix', 'sy-filter', 'sy-lfo', 'sy-special', 'sy-fx'],
    body: 'Groove Machine Synth: several oscillators, filters, and an envelope and LFO for nearly everything. A bigger panel, but every section is one you know.',
    map: [
      ['Mixer', 'the oscillator levels'],
      ['Mod envelope', 'the pitch envelope / modulation pages'],
      ['Effects', 'the FX section'],
    ],
  },
  {
    name: 'Sytrus',
    kind: 'FM + subtractive',
    units: ['sy-fm', 'sy-filter', 'sy-special'],
    body: 'Six operators wired by a matrix rather than fixed algorithms: any operator can modulate any other (FM) or ring-modulate it (RM). Each operator has its own envelope, and three filters follow.',
    map: [
      ['Algorithm', 'the FM matrix (row: modulator, column: target)'],
      ['Ring mod', 'the RM matrix'],
      ['Operator ratio / level', 'each operator’s pitch and volume'],
      ['Operator envelope', 'each operator’s articulation envelope'],
    ],
  },
  {
    name: 'Toxic Biohazard',
    kind: 'FM + subtractive',
    units: ['sy-fm', 'sy-filter', 'sy-fx'],
    body: 'FM operators followed by a filter and effects: the FM part of the course, with Part 1’s filter on top.',
    map: [
      ['Algorithm', 'its operator routing'],
      ['Filter', 'cutoff, resonance, envelope'],
    ],
  },
  {
    name: 'Fruity DX10',
    kind: 'FM',
    units: ['sy-fm'],
    body: 'A small FM synth for electric pianos, bells and basses. Look for the modulator’s ratio and the amount and time of its modulation: that’s the FM unit in a nutshell.',
    map: [
      ['Modulator ratio', 'its coarse / fine pitch'],
      ['Modulator level + decay', 'the modulation amount and time'],
    ],
  },
  {
    name: 'Harmor',
    kind: 'Additive (with subtractive controls)',
    units: ['sy-add', 'sy-filter', 'sy-lfo', 'sy-mix'],
    body: 'An additive engine dressed in subtractive controls: its filters, envelopes and unison move harmonics directly, which is why it can do things no analogue filter can (Prism, Blur, resynthesis of pictures and samples).',
    map: [
      ['Harmonic filter', 'its filters (they work on harmonics)'],
      ['Harmonic envelope', 'envelopes on the filter and timbre'],
      ['Stretch', 'its pitch-shifting of partials (Prism)'],
    ],
  },
  {
    name: 'Harmless',
    kind: 'Additive (subtractive-style)',
    units: ['sy-add', 'sy-filter', 'sy-amp'],
    body: 'Harmor’s little sibling: additive inside, but laid out like a classic subtractive synth, so Part 1 transfers directly.',
    map: [['Filter, envelopes, unison', 'the same names as here']],
  },
  {
    name: 'Morphine',
    kind: 'Additive',
    units: ['sy-add'],
    body: 'Draw the harmonics yourself and morph between drawings: the drawbars lesson, taken further.',
    map: [['Drawbars', 'its harmonic editor']],
  },
  {
    name: 'Flex',
    kind: 'Preset player',
    units: ['sy-filter', 'sy-amp', 'sy-fx'],
    body: 'Thousands of presets with a handful of macro knobs. Now you know what those macros usually are: cutoff, resonance, attack, release, the LFO, reverb and delay.',
    map: [['Macro knobs', 'often cutoff, resonance, attack, release, FX']],
  },
  {
    name: 'Vital (free) and Serum',
    kind: 'Wavetable',
    units: ['sy-wt', 'sy-lfo', 'sy-mix', 'sy-fx'],
    body: 'The wavetable synths most producers use. Two wavetable oscillators, a sub and noise, filters, envelopes and LFOs you drag onto any knob: everything in Part 4, with Part 1 underneath.',
    map: [
      ['Wavetable position', 'WT Pos'],
      ['Mod envelope / LFO → position', 'drag an envelope or LFO onto WT Pos'],
      ['Unison / Detune', 'Unison, Detune, Blend'],
    ],
  },
];
