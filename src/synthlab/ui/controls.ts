/**
 * What every control means, and how the panel groups them into modules.
 *
 * The panel is laid out the way sound flows through a real synth: sources, mixer, filter,
 * amplifier, effects, with the modulators (envelopes, LFO) beside what they move. Each
 * control carries a plain description, something to try, and the names other synths use
 * for it, so what someone learns here reads straight across to the synth in their DAW.
 */
import type { EngineKind, ParamKey } from '../dsp/params';

export interface ControlInfo {
  label: string;
  /** What it does. */
  about: string;
  /** Something to try with it. */
  tip?: string;
  /** What other synths call it. */
  aka?: string[];
}

const op = (n: number): Record<string, ControlInfo> => ({
  [`op${n}Ratio`]: {
    label: 'Ratio',
    about: `Operator ${n}'s pitch as a multiple of the note. Whole numbers (1, 2, 3) keep the sound harmonic, like a string or a pipe; in-between ratios (1.41, 3.5) give the clangy, inharmonic partials of bells and metal.`,
    tip: 'On a modulator, step through 1, 2, 3, 4 and hear the tone change character; then try 3.5.',
    aka: ['Ratio', 'Freq coarse', 'Multiplier', 'Harmonic'],
  },
  [`op${n}Level`]: {
    label: 'Level',
    about: `How strong operator ${n} is. On a carrier (an operator you hear) it's volume. On a modulator it's the modulation index: how hard it wobbles its target, which is how bright the result sounds.`,
    tip: 'Raise a modulator slowly from zero: the sound goes from a pure sine to rich, then to harsh.',
    aka: ['Output level', 'Amount', 'Index', 'Mod depth'],
  },
  [`op${n}Attack`]: { label: 'Attack', about: `How long operator ${n} takes to reach full level after a note starts.`, aka: ['A', 'Rate 1'] },
  [`op${n}Decay`]: { label: 'Decay', about: `How long operator ${n} takes to fall from full to its sustain level. On a modulator this is the brightness fading: the "ping" of an electric piano.`, aka: ['D', 'Rate 2'] },
  [`op${n}Sustain`]: { label: 'Sustain', about: `The level operator ${n} holds while the key stays down.`, aka: ['S', 'Level 3'] },
  [`op${n}Release`]: { label: 'Release', about: `How long operator ${n} fades after the key is let go.`, aka: ['R', 'Rate 4'] },
});

const harmonic = (n: number): ControlInfo => ({
  label: String(n),
  about:
    n === 1
      ? 'The fundamental: the note itself, a pure sine. Every other harmonic sits at a whole-number multiple of its pitch.'
      : `Harmonic ${n}, a sine ${n} times the note's frequency${n === 2 ? ' (an octave up)' : n === 3 ? ' (an octave and a fifth up)' : n === 4 ? ' (two octaves up)' : ''}. Its level is how much of it is in the sound.`,
  aka: ['Partial', 'Drawbar', 'Overtone'],
});

const oscillator = (n: 1 | 2): Record<string, ControlInfo> => ({
  [`osc${n}Wave`]: {
    label: 'Wave',
    about:
      'The shape of the wave, and so the basic colour of the sound. Sine is pure and round, triangle soft and hollow, saw bright and buzzy (every harmonic), square hollow and woody (odd harmonics only).',
    tip: 'Hold a note and step through the four shapes: hear how the same pitch changes colour.',
    aka: ['Waveform', 'Shape', 'Wave select'],
  },
  [`osc${n}Table`]: {
    label: 'Table',
    about: 'The wavetable: a row of single-cycle waves this oscillator can glide through. Each table is a family of sounds.',
    aka: ['Wavetable', 'Table', 'Wave bank'],
  },
  [`osc${n}Pos`]: {
    label: 'Position',
    about: 'Where in the wavetable the oscillator reads. Moving it morphs the sound from one wave to the next: the move a wavetable synth is built for.',
    tip: 'Sweep it slowly while holding a note, then hand the job to an envelope or the LFO.',
    aka: ['WT Pos', 'Wavetable position', 'Index', 'Frame'],
  },
  [`osc${n}Octave`]: {
    label: 'Octave',
    about: 'Moves the oscillator by whole octaves. Older synths mark this in feet: 16′ is an octave below 8′, 4′ an octave above.',
    tip: 'Set one oscillator an octave below the other for a deep, solid sound.',
    aka: ['Oct', 'Range', 'Footage (32′ 16′ 8′ 4′)'],
  },
  [`osc${n}Semi`]: {
    label: 'Semitones',
    about: 'Moves the oscillator by semitones, the steps between neighbouring piano keys. +7 is a fifth up, +12 an octave.',
    tip: 'With two oscillators, +7 on one makes every key play a power chord.',
    aka: ['Semi', 'Coarse', 'Transpose', 'Pitch'],
  },
  [`osc${n}Fine`]: {
    label: 'Fine',
    about: 'Fine tuning, in cents (hundredths of a semitone). A few cents between two oscillators makes them beat against each other: the slow, wide shimmer of an analogue synth.',
    tip: 'Set 5 to 15 cents on one oscillator and listen to the sound start to swirl.',
    aka: ['Detune', 'Fine tune', 'Cents'],
  },
  [`osc${n}Level`]: {
    label: n === 1 ? 'Osc 1' : 'Osc 2',
    about: `How much of oscillator ${n} goes into the mix.`,
    aka: ['Level', 'Volume', 'Mix'],
  },
  [`osc${n}Pw`]: {
    label: 'Width',
    about: 'Pulse width: how much of each cycle a square wave spends up rather than down. At 50% it\'s a hollow square; narrower pulses sound thinner and nasal, like an oboe or a chiptune.',
    tip: 'Narrow it to 10%, then let the LFO move it (PWM) for a rich, moving tone.',
    aka: ['PW', 'Pulse width', 'Shape', 'Symmetry'],
  },
});

/** Every control's description (a test checks none is missing). */
export const CONTROLS = {
  engine: { label: 'Engine', about: 'Which kind of synthesis makes the raw sound.' },
  volume: {
    label: 'Volume',
    about: 'The overall output level of the synth. It sets how loud the sound is, not what it sounds like.',
    aka: ['Master', 'Output', 'Gain', 'Level'],
  },
  voiceMode: {
    label: 'Mode',
    about: 'Poly plays chords, a voice per key. Mono plays one note at a time, restarting the envelopes on every key (basses, leads). Legato is mono where overlapping notes only change pitch, without restarting: smooth runs and slides.',
    aka: ['Voice mode', 'Poly/Mono', 'Legato', 'Key mode'],
  },
  glide: {
    label: 'Glide',
    about: 'Slides the pitch from one note to the next instead of jumping. The value is roughly how long the slide takes.',
    tip: 'In Legato mode, set about 150 ms and play overlapping notes: every connection slides, like a 303 bassline.',
    aka: ['Portamento', 'Porta', 'Slide', 'Glide time'],
  },
  unison: {
    label: 'Unison',
    about: 'Stacks several copies of each oscillator per note, each slightly out of tune with the others. A few voices make a sound thick and wide; seven make the famous "supersaw".',
    aka: ['Voices', 'Unison voices', 'Stack'],
  },
  unisonDetune: {
    label: 'Detune',
    about: 'How far apart the unison copies are tuned. A little sounds rich and smooth, a lot sounds wide and out of tune.',
    aka: ['Spread', 'Uni detune', 'Detune amount'],
  },
  unisonWidth: {
    label: 'Width',
    about: 'Spreads the unison copies from left to right, for a wider stereo image.',
    aka: ['Stereo spread', 'Pan spread', 'Blend'],
  },
  ...oscillator(1),
  ...oscillator(2),
  osc2Sync: {
    label: 'Sync',
    about: 'Hard sync: oscillator 2 is forced to restart its cycle every time oscillator 1 does. Now tuning oscillator 2 up doesn\'t change the note, it changes the tone, in a tearing, vocal way.',
    tip: 'Turn sync on, then sweep oscillator 2\'s pitch up with the mod envelope: the classic sync lead.',
    aka: ['Hard sync', 'Osc sync'],
  },
  subLevel: {
    label: 'Sub',
    about: 'A sub-oscillator one octave below oscillator 1. It adds weight and depth under the sound without changing its character much.',
    tip: 'Add some sub to a bass and listen on headphones: the floor drops away.',
    aka: ['Sub osc', 'Sub level', 'Sub'],
  },
  subWave: { label: 'Sub wave', about: 'The sub-oscillator\'s shape: a pure sine (clean, deep) or a square (punchier, like a Juno or SH-101).', aka: ['Sub shape'] },
  noiseLevel: {
    label: 'Noise',
    about: 'White noise: every frequency at once, with no pitch. On its own it\'s wind, surf or a snare; mixed in a little, it adds breath and air.',
    tip: 'Set a short decay and only noise for a hi-hat; filter it with a band-pass for wind.',
    aka: ['Noise level', 'Noise'],
  },
  ringLevel: {
    label: 'Ring',
    about: 'Ring modulation multiplies oscillator 1 by oscillator 2. Instead of the two pitches you hear their sum and difference, which are rarely in tune with each other: bells, metal, robots.',
    tip: 'With two sines, set oscillator 2 to +7 or +5.5 semitones and bring in the ring. Then play up and down the keyboard.',
    aka: ['Ring mod', 'RM', 'Ring modulator'],
  },
  fmAlgo: {
    label: 'Algorithm',
    about: 'Which operators modulate which. Operators at the bottom of a stack are carriers (you hear them); the ones above modulate them.',
    aka: ['Algorithm', 'Routing', 'Matrix'],
  },
  fmFeedback: {
    label: 'Feedback',
    about: 'Lets the top operator modulate itself. A little turns its sine towards a sawtooth, a lot towards noise.',
    aka: ['FB', 'Feedback'],
  },
  ...op(1),
  ...op(2),
  ...op(3),
  ...op(4),
  h1: harmonic(1),
  h2: harmonic(2),
  h3: harmonic(3),
  h4: harmonic(4),
  h5: harmonic(5),
  h6: harmonic(6),
  h7: harmonic(7),
  h8: harmonic(8),
  h9: harmonic(9),
  h10: harmonic(10),
  h11: harmonic(11),
  h12: harmonic(12),
  h13: harmonic(13),
  h14: harmonic(14),
  h15: harmonic(15),
  h16: harmonic(16),
  addOpen: {
    label: 'Harmonics',
    about: 'How many harmonics are allowed through, counting from the bottom: a low-pass filter that works in harmonics rather than in hertz, so it follows the note up and down the keyboard.',
    aka: ['Partials', 'Additive filter', 'Brightness'],
  },
  addEnv: {
    label: 'Env amount',
    about: 'How many extra harmonics the filter envelope opens over each note. Moving harmonics over time is what additive synths are best at.',
    aka: ['Env', 'Envelope amount'],
  },
  addStretch: {
    label: 'Stretch',
    about: 'Pushes the upper harmonics sharp of the harmonic series. A little sounds like a piano\'s stiff strings; a lot sounds like bells and struck metal.',
    aka: ['Inharmonicity', 'Stretch', 'Pitch spread'],
  },
  filterOn: { label: 'Filter', about: 'Switches the filter in or out.', aka: ['Filter on', 'Bypass'] },
  filterType: {
    label: 'Type',
    about: 'Low-pass keeps the lows and removes the highs (darker). High-pass does the opposite (thinner). Band-pass keeps a band around the cutoff (nasal, like a telephone). Notch removes a band (hollow, phasey).',
    aka: ['Mode', 'LP / HP / BP / Notch', 'Filter type'],
  },
  filterSlope: {
    label: 'Slope',
    about: 'How steeply the filter cuts beyond the cutoff: 12 dB per octave is gentle and open, 24 dB per octave is steep, thick and very "synth".',
    aka: ['Poles (2-pole / 4-pole)', 'dB/oct'],
  },
  filterCutoff: {
    label: 'Cutoff',
    about: 'Where the filter starts to cut. On a low-pass, lower is darker and more muffled, higher is brighter. The most-used knob on any synth.',
    tip: 'Hold a saw chord and sweep the cutoff from bottom to top: that\'s the sound of a hundred dance records.',
    aka: ['Cutoff', 'Freq', 'Frequency', 'Fc', 'Cut', 'Mod X (FL Studio)'],
  },
  filterRes: {
    label: 'Resonance',
    about: 'Boosts the frequencies right at the cutoff, so the filter "sings". A little adds bite; a lot makes a squelchy, whistling peak, and sweeping it makes the classic acid squelch.',
    aka: ['Res', 'Q', 'Emphasis', 'Peak', 'Mod Y (FL Studio)'],
  },
  filterDrive: {
    label: 'Drive',
    about: 'Overdrives the signal going into the filter: thicker, grittier, a bit louder, like pushing an analogue circuit.',
    aka: ['Drive', 'Saturation', 'Overdrive'],
  },
  filterKey: {
    label: 'Key track',
    about: 'Makes the cutoff follow the keyboard, so high notes are as bright as low ones. At 100% the cutoff moves an octave for every octave you play.',
    aka: ['Keytrack', 'KBD', 'Key follow', 'Kybd'],
  },
  filterEnv: {
    label: 'Env amount',
    about: 'How far the filter envelope moves the cutoff. Positive opens it at the start of each note (a "pluck" or "wah"); negative closes it.',
    tip: 'Set the cutoff low, raise this, and give the filter envelope a short decay: instant pluck.',
    aka: ['Env amt', 'Env depth', 'Contour amount', 'Env mod'],
  },
  fAttack: { label: 'Attack', about: 'How long the filter envelope takes to open the filter after a note starts.', aka: ['A'] },
  fDecay: { label: 'Decay', about: 'How long the filter envelope takes to fall back to its sustain level. Short for plucks, long for slow, sweeping tones.', aka: ['D'] },
  fSustain: { label: 'Sustain', about: 'Where the filter envelope rests while the key is held.', aka: ['S'] },
  fRelease: { label: 'Release', about: 'How long the filter envelope takes to close after the key is let go.', aka: ['R'] },
  ampAttack: {
    label: 'Attack',
    about: 'How long the sound takes to reach full volume after you press a key. Short is a hit or a pluck; long is a swell, like a bowed string.',
    tip: 'Turn it past a second and hold a chord: the sound fades in like strings.',
    aka: ['A', 'Attack time'],
  },
  ampDecay: {
    label: 'Decay',
    about: 'How long the volume takes to fall from its peak to the sustain level. Only heard when sustain is below full.',
    aka: ['D', 'Decay time'],
  },
  ampSustain: {
    label: 'Sustain',
    about: 'The volume the sound holds at for as long as the key stays down. It\'s a level, not a time. At zero, every note dies away by itself like a plucked string.',
    aka: ['S', 'Sustain level'],
  },
  ampRelease: {
    label: 'Release',
    about: 'How long the sound takes to fade after you let go of the key. Short stops dead; long rings on like a piano with the pedal down.',
    aka: ['R', 'Release time'],
  },
  lfoShape: {
    label: 'Shape',
    about: 'How the LFO moves: smoothly (sine, triangle), in a ramp (saw), jumping between two values (square), or to a new random value each cycle (random, "sample and hold").',
    aka: ['Wave', 'LFO wave'],
  },
  lfoRate: {
    label: 'Rate',
    about: 'How fast the LFO swings, in cycles per second. Around 5 Hz sounds like a singer\'s vibrato; under 1 Hz is a slow sweep.',
    aka: ['Speed', 'Freq', 'LFO rate'],
  },
  lfoSync: {
    label: 'Sync',
    about: 'Locks the LFO to the tempo (120 BPM here), so it moves in note lengths: the way every wobble bass is made.',
    aka: ['Tempo sync', 'BPM', 'Sync'],
  },
  lfoDiv: { label: 'Note', about: 'The LFO\'s cycle as a note length when synced: 1/4 is once a beat, 1/8 twice a beat, T is a triplet, D dotted.', aka: ['Division', 'Rate (synced)'] },
  lfoFade: {
    label: 'Fade in',
    about: 'Brings the LFO in gradually after each note starts, like a violinist who adds vibrato once a note has settled.',
    aka: ['Delay', 'Fade', 'LFO delay', 'Rise'],
  },
  lfoPitch: {
    label: 'Pitch',
    about: 'How far the LFO bends the pitch, in cents. A little is vibrato; a lot is a siren.',
    tip: 'Rate around 5 Hz, depth 20 to 40 cents, fade in a quarter of a second: a singer\'s vibrato.',
    aka: ['Vibrato', 'LFO → Pitch', 'Pitch mod'],
  },
  lfoCutoff: {
    label: 'Cutoff',
    about: 'How far the LFO moves the filter cutoff, in octaves. Slow is a sweep; fast and synced is a wobble.',
    aka: ['LFO → Filter', 'Wah', 'Filter mod'],
  },
  lfoAmp: {
    label: 'Volume',
    about: 'How much the LFO dips the volume: tremolo, like a vintage amp or a vibraphone with its fan on.',
    aka: ['Tremolo', 'LFO → Amp', 'AM'],
  },
  lfoPw: {
    label: 'Width',
    about: 'How far the LFO moves the square wave\'s pulse width: pulse-width modulation (PWM), a rich, chorus-like movement.',
    aka: ['PWM', 'LFO → PW'],
  },
  lfoPos: { label: 'Position', about: 'How far the LFO moves the wavetable position back and forth.', aka: ['LFO → WT position'] },
  modAttack: { label: 'Attack', about: 'How long the mod envelope takes to rise.', aka: ['A'] },
  modDecay: {
    label: 'Decay',
    about: 'How long the mod envelope takes to fall back to zero. Very short with a pitch drop makes a kick drum; longer makes a laser or a riser.',
    aka: ['D'],
  },
  modPitch: {
    label: 'Pitch',
    about: 'How far the envelope bends the pitch of every oscillator at the start of the note, in semitones. Up then back down is a zap, a kick or a tom.',
    aka: ['Pitch env', 'Env → Pitch', 'Pitch EG'],
  },
  modOsc2: {
    label: 'Osc 2 pitch',
    about: 'Bends only oscillator 2\'s pitch. With sync on, this sweeps the tone rather than the note: the screaming sync lead.',
    aka: ['Env → Osc 2', 'Sync sweep'],
  },
  modPos: { label: 'Position', about: 'How far the envelope moves the wavetable position over each note.', aka: ['Env → WT position'] },
  drive: {
    label: 'Drive',
    about: 'Distortion after the synth: rounds off the peaks, adding harmonics, from warm to fuzzy to aggressive.',
    aka: ['Distortion', 'Saturation', 'Overdrive', 'Dist'],
  },
  chorusMix: {
    label: 'Mix',
    about: 'Chorus blends in copies of the sound that drift slightly in time and pitch: wider, lusher, more "80s".',
    aka: ['Chorus', 'Dry/wet', 'Amount'],
  },
  chorusRate: { label: 'Rate', about: 'How fast the chorus copies drift.', aka: ['Speed'] },
  chorusDepth: { label: 'Depth', about: 'How far the chorus copies drift: more is wobblier.', aka: ['Depth', 'Amount'] },
  delayMix: {
    label: 'Mix',
    about: 'Echoes of the sound, bouncing left and right in time with the tempo.',
    aka: ['Delay', 'Echo', 'Dry/wet', 'Wet'],
  },
  delayDiv: { label: 'Time', about: 'How far apart the echoes are, as a note length at 120 BPM. Dotted eighths (1/8D) are the classic rhythmic echo.', aka: ['Time', 'Sync'] },
  delayFeedback: { label: 'Feedback', about: 'How many echoes there are: each echo feeds the next. Higher means more repeats.', aka: ['FB', 'Repeats', 'Regen'] },
  reverbMix: {
    label: 'Mix',
    about: 'Reverb puts the sound in a space: a room, a hall, a cathedral.',
    aka: ['Reverb', 'Dry/wet', 'Wet'],
  },
  reverbSize: { label: 'Size', about: 'How big the space is, and so how long the reverb rings.', aka: ['Size', 'Decay', 'Room'] },
} as Record<ParamKey, ControlInfo>;

export type ModuleId =
  | 'osc1'
  | 'osc2'
  | 'wt1'
  | 'wt2'
  | 'mixer'
  | 'algo'
  | 'op1'
  | 'op2'
  | 'op3'
  | 'op4'
  | 'harmonics'
  | 'hfilter'
  | 'filter'
  | 'fenv'
  | 'amp'
  | 'lfo'
  | 'modenv'
  | 'voice'
  | 'drive'
  | 'chorus'
  | 'delay'
  | 'reverb';

export type Family = 'source' | 'mixer' | 'filter' | 'amp' | 'mod' | 'voice' | 'fx';

export interface ModuleDef {
  id: ModuleId;
  title: string;
  /** One line: what it's for. */
  role: string;
  family: Family;
  /** Accent colour (CSS). */
  color: string;
  keys: readonly ParamKey[];
  engines: readonly EngineKind[];
  /** A sentence or two for the module's info sheet. */
  about: string;
  /** For modulators: what they move. */
  moves?: string;
}

const ALL: EngineKind[] = ['subtractive', 'fm', 'additive', 'wavetable'];
const OSC_ENGINES: EngineKind[] = ['subtractive', 'wavetable'];

export const FAMILY_COLOR: Record<Family, string> = {
  source: '#f4c97a',
  mixer: '#f0a35e',
  filter: '#3cc8c8',
  amp: '#ff9b6a',
  mod: '#9b8cff',
  voice: '#69b8ff',
  fx: '#ff7eb6',
};

const LFO_COLOR = '#3fdc9a';

const opModule = (n: 1 | 2 | 3 | 4): ModuleDef => ({
  id: `op${n}` as ModuleId,
  title: `Operator ${n}`,
  role: 'A sine wave that is heard or that modulates another',
  family: 'source',
  color: FAMILY_COLOR.source,
  keys: [`op${n}Ratio`, `op${n}Level`, `op${n}Attack`, `op${n}Decay`, `op${n}Sustain`, `op${n}Release`] as ParamKey[],
  engines: ['fm'],
  about: 'An FM operator: a sine oscillator with its own envelope. Whether it is heard or modulates depends on the algorithm.',
});

/** Modules in panel order (sound flows left to right, top to bottom). */
export const MODULES: readonly ModuleDef[] = [
  {
    id: 'osc1',
    title: 'Oscillator 1',
    role: 'Makes the raw sound',
    family: 'source',
    color: FAMILY_COLOR.source,
    keys: ['osc1Wave', 'osc1Octave', 'osc1Semi', 'osc1Fine', 'osc1Pw'],
    engines: ['subtractive'],
    about: 'An oscillator repeats one wave shape over and over; how fast it repeats is the pitch, and the shape is the tone. Everything else on a subtractive synth shapes what the oscillators make.',
  },
  {
    id: 'osc2',
    title: 'Oscillator 2',
    role: 'A second voice to layer, detune or sync',
    family: 'source',
    color: FAMILY_COLOR.source,
    keys: ['osc2Wave', 'osc2Octave', 'osc2Semi', 'osc2Fine', 'osc2Pw', 'osc2Sync'],
    engines: ['subtractive'],
    about: 'A second oscillator doubles the possibilities: detune it for width, tune it to an interval for a chord on every key, or sync it to oscillator 1 for tearing leads.',
  },
  {
    id: 'wt1',
    title: 'Wavetable A',
    role: 'Morphs through a table of waves',
    family: 'source',
    color: FAMILY_COLOR.source,
    keys: ['osc1Table', 'osc1Pos', 'osc1Octave', 'osc1Semi', 'osc1Fine'],
    engines: ['wavetable'],
    about: 'A wavetable oscillator plays one wave from a row of them; its position picks which, and moving the position morphs the sound. Envelopes and LFOs can move it for you.',
  },
  {
    id: 'wt2',
    title: 'Wavetable B',
    role: 'A second table to layer',
    family: 'source',
    color: FAMILY_COLOR.source,
    keys: ['osc2Table', 'osc2Pos', 'osc2Octave', 'osc2Semi', 'osc2Fine'],
    engines: ['wavetable'],
    about: 'A second wavetable oscillator, mixed with the first.',
  },
  {
    id: 'algo',
    title: 'Algorithm',
    role: 'Who modulates whom',
    family: 'source',
    color: FAMILY_COLOR.mod,
    keys: ['fmAlgo', 'fmFeedback'],
    engines: ['fm'],
    about: 'In FM, operators either sound (carriers, at the bottom) or bend another operator\'s phase (modulators, above). The algorithm wires them up.',
  },
  opModule(1),
  opModule(2),
  opModule(3),
  opModule(4),
  {
    id: 'harmonics',
    title: 'Harmonics',
    role: 'Builds a sound from sine waves',
    family: 'source',
    color: FAMILY_COLOR.source,
    keys: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15', 'h16'],
    engines: ['additive'],
    about: 'Any steady sound can be built from sine waves at whole-number multiples of its pitch: its harmonics. Additive synthesis sets each one\'s level directly, like an organ\'s drawbars.',
  },
  {
    id: 'hfilter',
    title: 'Harmonic filter',
    role: 'Lets harmonics through, counting up',
    family: 'filter',
    color: FAMILY_COLOR.filter,
    keys: ['addOpen', 'addEnv', 'addStretch'],
    engines: ['additive'],
    about: 'Shapes which harmonics are heard, and moves them with the filter envelope. Stretch bends the series out of tune for bells.',
  },
  {
    id: 'mixer',
    title: 'Mixer',
    role: 'Balances the sources',
    family: 'mixer',
    color: FAMILY_COLOR.mixer,
    keys: ['osc1Level', 'osc2Level', 'subLevel', 'subWave', 'noiseLevel', 'ringLevel'],
    engines: OSC_ENGINES,
    about: 'Every source meets here before the filter: the two oscillators, the sub-oscillator, noise and the ring modulator.',
  },
  {
    id: 'filter',
    title: 'Filter',
    role: 'Shapes the tone by removing frequencies',
    family: 'filter',
    color: FAMILY_COLOR.filter,
    keys: ['filterOn', 'filterType', 'filterSlope', 'filterCutoff', 'filterRes', 'filterEnv', 'filterKey', 'filterDrive'],
    engines: ALL,
    about: 'Subtractive synthesis in one module: start with a bright wave and take away what you don\'t want. The cutoff says where, the type says what, resonance adds a peak.',
  },
  {
    id: 'fenv',
    title: 'Filter envelope',
    role: 'Moves the cutoff over each note',
    family: 'mod',
    color: FAMILY_COLOR.filter,
    keys: ['fAttack', 'fDecay', 'fSustain', 'fRelease'],
    engines: ALL,
    about: 'A second ADSR envelope, wired to the filter. Env amount (on the filter) says how far it moves the cutoff.',
    moves: 'Cutoff',
  },
  {
    id: 'amp',
    title: 'Amplifier',
    role: 'Shapes the volume over each note',
    family: 'amp',
    color: FAMILY_COLOR.amp,
    keys: ['ampAttack', 'ampDecay', 'ampSustain', 'ampRelease', 'volume'],
    engines: ALL,
    about: 'The amplifier\'s envelope (ADSR: attack, decay, sustain, release) is the shape of every note: how it starts, settles, holds and ends.',
    moves: 'Volume',
  },
  {
    id: 'lfo',
    title: 'LFO',
    role: 'Moves things back and forth',
    family: 'mod',
    color: LFO_COLOR,
    keys: ['lfoShape', 'lfoRate', 'lfoSync', 'lfoDiv', 'lfoFade', 'lfoPitch', 'lfoCutoff', 'lfoAmp', 'lfoPw', 'lfoPos'],
    engines: ALL,
    about: 'A low-frequency oscillator: a wave too slow to hear, used to wobble another control. On pitch it\'s vibrato, on the filter a wah or wobble, on volume tremolo.',
    moves: 'Pitch · Cutoff · Volume',
  },
  {
    id: 'modenv',
    title: 'Mod envelope',
    role: 'A quick sweep at the start of each note',
    family: 'mod',
    color: FAMILY_COLOR.mod,
    keys: ['modAttack', 'modDecay', 'modPitch', 'modOsc2', 'modPos'],
    engines: ALL,
    about: 'An attack–decay envelope for pitch (and more): drum hits, zaps, risers and sync sweeps.',
    moves: 'Pitch',
  },
  {
    id: 'voice',
    title: 'Voice',
    role: 'How notes are played',
    family: 'voice',
    color: FAMILY_COLOR.voice,
    keys: ['voiceMode', 'glide', 'unison', 'unisonDetune', 'unisonWidth'],
    engines: ALL,
    about: 'Poly, mono or legato, glide between notes, and unison stacking.',
  },
  { id: 'drive', title: 'Drive', role: 'Distortion', family: 'fx', color: FAMILY_COLOR.fx, keys: ['drive'], engines: ALL, about: 'Saturation after the synth.' },
  { id: 'chorus', title: 'Chorus', role: 'Width and shimmer', family: 'fx', color: FAMILY_COLOR.fx, keys: ['chorusMix', 'chorusRate', 'chorusDepth'], engines: ALL, about: 'Detuned, drifting copies for width.' },
  { id: 'delay', title: 'Delay', role: 'Echoes in time', family: 'fx', color: FAMILY_COLOR.fx, keys: ['delayMix', 'delayDiv', 'delayFeedback'], engines: ALL, about: 'Ping-pong echoes in time with the tempo.' },
  { id: 'reverb', title: 'Reverb', role: 'A space around the sound', family: 'fx', color: FAMILY_COLOR.fx, keys: ['reverbMix', 'reverbSize'], engines: ALL, about: 'Reflections of a room or a hall.' },
];

/** Keys that belong to an engine only (shown only there). */
const ENGINE_ONLY: Partial<Record<ParamKey, readonly EngineKind[]>> = {
  lfoPos: ['wavetable'],
  modPos: ['wavetable'],
  modOsc2: ['subtractive'],
  lfoPw: ['subtractive'],
  unison: OSC_ENGINES,
  unisonDetune: OSC_ENGINES,
  unisonWidth: OSC_ENGINES,
  ringLevel: ['subtractive'],
};

/** The modules of an engine, each with the keys it shows there. */
export function modulesFor(engine: EngineKind): ModuleDef[] {
  return MODULES.filter(m => m.engines.includes(engine)).map(m => ({ ...m, keys: m.keys.filter(k => !ENGINE_ONLY[k] || ENGINE_ONLY[k]!.includes(engine)) }));
}

/** The module a control sits in, for an engine. */
export function moduleOf(key: ParamKey, engine: EngineKind): ModuleDef | undefined {
  return modulesFor(engine).find(m => m.keys.includes(key));
}

/** Every key an engine's panel can show. */
export function engineKeys(engine: EngineKind): ParamKey[] {
  return modulesFor(engine).flatMap(m => m.keys);
}
