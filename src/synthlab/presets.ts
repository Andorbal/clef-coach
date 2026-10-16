/**
 * Ready-made patches for the Synth Lab: a starting point for each engine, and a small
 * library of classic sounds to take apart. Each preset says how it's made in a line, so
 * loading one is a lesson in itself.
 *
 * Preset ids are saved (a profile's last preset); never rename one.
 */
import { type EngineKind, type Patch, type PatchDelta, makePatch } from './dsp/params';

/** What each engine starts from: one plain, useful sound with its main controls in reach. */
export const ENGINE_INIT: Record<EngineKind, PatchDelta> = {
  subtractive: { engine: 'subtractive', filterOn: true, filterCutoff: 4000, filterRes: 0.15 },
  fm: { engine: 'fm', op1Level: 0.8, op2Level: 0.35, op2Ratio: 1, op2Decay: 1.2, op2Sustain: 0.4 },
  additive: { engine: 'additive', h1: 1, h2: 0.5, h3: 0.33, h4: 0.25, h5: 0.2, h6: 0.17, h7: 0.14, h8: 0.12 },
  wavetable: { engine: 'wavetable', osc1Table: 'basic', osc1Pos: 0.5, osc1Level: 0.8 },
};

export function initPatch(engine: EngineKind): Patch {
  return makePatch(ENGINE_INIT[engine]);
}

export type PresetCategory = 'Bass' | 'Lead' | 'Pad' | 'Keys' | 'Pluck' | 'Bell' | 'Brass' | 'Drums' | 'FX';

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory;
  /** How it's made, in a sentence. */
  recipe: string;
  patch: PatchDelta;
}

const saw2 = { osc2Level: 0.7, osc2Fine: 9 };

export const PRESETS: readonly Preset[] = [
  {
    id: 'acid-bass',
    name: 'Acid bass',
    category: 'Bass',
    recipe: 'A saw through a resonant 24 dB low-pass, a short filter envelope and legato glide: the TB-303 squelch.',
    patch: { voiceMode: 'legato', glide: 0.08, osc1Octave: -1, filterOn: true, filterCutoff: 260, filterRes: 0.78, filterEnv: 0.55, fDecay: 0.22, fSustain: 0, ampDecay: 0.4, ampSustain: 0.75, ampRelease: 0.05, filterDrive: 0.4 },
  },
  {
    id: 'reese',
    name: 'Reese bass',
    category: 'Bass',
    recipe: 'Two saws detuned against each other, filtered dark and slowly swirling: the drum & bass growl.',
    patch: { voiceMode: 'mono', osc1Octave: -1, osc2Octave: -1, osc2Level: 0.8, osc2Fine: 18, filterOn: true, filterCutoff: 700, filterRes: 0.2, subLevel: 0.3, lfoCutoff: 0.6, lfoRate: 0.3, ampRelease: 0.12, drive: 0.25 },
  },
  {
    id: 'sub-bass',
    name: 'Sub bass',
    category: 'Bass',
    recipe: 'A plain sine an octave down with a quick, click-free attack: felt more than heard.',
    patch: { voiceMode: 'mono', osc1Wave: 'sine', osc1Octave: -1, ampAttack: 0.004, ampRelease: 0.08, glide: 0.04 },
  },
  {
    id: 'wobble',
    name: 'Wobble bass',
    category: 'Bass',
    recipe: 'A synced LFO sweeps a resonant low-pass in eighth notes over two detuned saws and a sub.',
    patch: { voiceMode: 'mono', osc1Octave: -1, osc2Octave: -1, osc2Level: 0.6, osc2Fine: 12, subLevel: 0.6, filterOn: true, filterCutoff: 240, filterRes: 0.55, lfoCutoff: 3, lfoSync: true, lfoDiv: '1/8', lfoShape: 'sine', drive: 0.35 },
  },
  {
    id: 'fm-bass',
    name: 'FM bass',
    category: 'Bass',
    recipe: 'A modulator one octave up whose envelope dies quickly: a punchy, rubbery attack over a clean low tone.',
    patch: { engine: 'fm', op1Level: 0.85, op2Level: 0.55, op2Ratio: 1, op2Decay: 0.25, op2Sustain: 0.1, ampDecay: 0.6, ampSustain: 0.6, ampRelease: 0.08, voiceMode: 'mono' },
  },
  {
    id: 'supersaw',
    name: 'Supersaw lead',
    category: 'Lead',
    recipe: 'Seven detuned saws per oscillator, spread wide, a touch of filter and reverb: the trance anthem.',
    patch: { unison: 7, unisonDetune: 35, unisonWidth: 0.9, ...saw2, filterOn: true, filterCutoff: 6000, ampRelease: 0.3, reverbMix: 0.25, reverbSize: 0.6, chorusMix: 0.2 },
  },
  {
    id: 'sync-lead',
    name: 'Sync lead',
    category: 'Lead',
    recipe: 'Oscillator 2 synced to oscillator 1, its pitch swept by the mod envelope: a tearing, vocal attack.',
    patch: { osc1Level: 0.3, osc2Level: 0.8, osc2Sync: true, osc2Semi: 7, modOsc2: 24, modDecay: 0.35, filterOn: true, filterCutoff: 7000, glide: 0.05, voiceMode: 'legato', lfoPitch: 15, lfoRate: 5.5, lfoFade: 0.3, delayMix: 0.2 },
  },
  {
    id: 'square-lead',
    name: 'Chip lead',
    category: 'Lead',
    recipe: 'A thin pulse wave with a quick vibrato: an 8-bit game console.',
    patch: { osc1Wave: 'square', osc1Pw: 0.25, voiceMode: 'mono', lfoPitch: 25, lfoRate: 6.5, lfoFade: 0.2, ampRelease: 0.05 },
  },
  {
    id: 'warm-pad',
    name: 'Warm pad',
    category: 'Pad',
    recipe: 'Detuned saws, a slow attack and release, a low-pass breathing with a slow LFO, chorus and reverb.',
    patch: { ...saw2, unison: 3, unisonDetune: 18, filterOn: true, filterCutoff: 1400, filterRes: 0.2, lfoCutoff: 0.5, lfoRate: 0.25, ampAttack: 0.9, ampRelease: 1.6, chorusMix: 0.5, reverbMix: 0.45, reverbSize: 0.8 },
  },
  {
    id: 'pwm-strings',
    name: 'PWM strings',
    category: 'Pad',
    recipe: 'Two square waves whose pulse width an LFO keeps moving: the lush string machines of the 70s.',
    patch: { osc1Wave: 'square', osc2Wave: 'square', osc2Level: 0.7, osc2Fine: 6, osc1Pw: 0.35, osc2Pw: 0.35, lfoPw: 0.7, lfoRate: 0.8, filterOn: true, filterCutoff: 3500, ampAttack: 0.35, ampRelease: 0.8, chorusMix: 0.6, reverbMix: 0.3 },
  },
  {
    id: 'vowel-pad',
    name: 'Talking pad',
    category: 'Pad',
    recipe: 'A wavetable of vowels, its position swept slowly by the LFO: the sound seems to say "oh-ah-ee".',
    patch: { engine: 'wavetable', osc1Table: 'vowel', osc1Pos: 0.4, lfoPos: 0.4, lfoRate: 0.2, unison: 3, unisonDetune: 12, ampAttack: 0.6, ampRelease: 1.2, reverbMix: 0.4 },
  },
  {
    id: 'organ',
    name: 'Drawbar organ',
    category: 'Keys',
    recipe: 'Additive drawbars at the fundamental, octave and fifth, with a quick tremolo: a tonewheel organ.',
    patch: { engine: 'additive', h1: 1, h2: 0.8, h3: 0.6, h4: 0.5, h6: 0.3, h8: 0.4, ampAttack: 0.005, ampRelease: 0.05, lfoAmp: 0.15, lfoRate: 6.5 },
  },
  {
    id: 'epiano',
    name: 'FM electric piano',
    category: 'Keys',
    recipe: 'Two operator pairs: a bright modulator envelope that fades fast gives the tine "ping", the second pair adds body.',
    patch: { engine: 'fm', fmAlgo: 3, op1Level: 0.8, op2Ratio: 14, op2Level: 0.25, op2Decay: 0.35, op2Sustain: 0, op3Level: 0.7, op3Ratio: 1, op4Ratio: 1, op4Level: 0.3, op4Decay: 1.2, op4Sustain: 0.2, op1Decay: 2.5, op1Sustain: 0.1, op3Decay: 3, op3Sustain: 0.2, ampRelease: 0.4, chorusMix: 0.3 },
  },
  {
    id: 'pluck',
    name: 'Synth pluck',
    category: 'Pluck',
    recipe: 'Sustain at zero and a filter envelope that snaps shut: every note pings and dies away.',
    patch: { ...saw2, filterOn: true, filterCutoff: 300, filterEnv: 0.55, fDecay: 0.18, fSustain: 0, ampDecay: 0.45, ampSustain: 0, ampRelease: 0.3, delayMix: 0.3, reverbMix: 0.25 },
  },
  {
    id: 'bell',
    name: 'FM bell',
    category: 'Bell',
    recipe: 'A modulator at an in-between ratio (3.5) makes inharmonic partials; long decays let them ring.',
    patch: { engine: 'fm', op1Level: 0.8, op2Ratio: 3.5, op2Level: 0.45, op2Decay: 2, op2Sustain: 0, ampDecay: 3, ampSustain: 0, ampRelease: 2, reverbMix: 0.35 },
  },
  {
    id: 'ring-bell',
    name: 'Ring-mod bell',
    category: 'Bell',
    recipe: 'Two sines a strange interval apart, ring-modulated: their sum and difference clang like metal.',
    patch: { osc1Wave: 'sine', osc2Wave: 'sine', osc1Level: 0.2, osc2Level: 0, ringLevel: 1, osc2Semi: 6, osc2Fine: 33, ampDecay: 2.2, ampSustain: 0, ampRelease: 1.5, reverbMix: 0.3 },
  },
  {
    id: 'glass',
    name: 'Glass harmonics',
    category: 'Bell',
    recipe: 'Additive partials stretched sharp of the harmonic series, with a slow fade: struck glass.',
    patch: { engine: 'additive', h1: 1, h2: 0.6, h3: 0.5, h5: 0.4, h7: 0.3, addStretch: 0.6, ampDecay: 2.5, ampSustain: 0, ampRelease: 2, reverbMix: 0.35 },
  },
  {
    id: 'brass',
    name: 'Synth brass',
    category: 'Brass',
    recipe: 'Saws through a filter whose envelope opens a moment after the note starts: the "blat" of brass.',
    patch: { ...saw2, filterOn: true, filterCutoff: 500, filterEnv: 0.45, fAttack: 0.06, fDecay: 0.5, fSustain: 0.5, ampAttack: 0.03, ampRelease: 0.2, lfoPitch: 6, lfoRate: 5, lfoFade: 0.4 },
  },
  {
    id: 'kick',
    name: 'Synth kick',
    category: 'Drums',
    recipe: 'A sine whose pitch drops over two octaves in about a tenth of a second: the 808 kick.',
    patch: { voiceMode: 'mono', osc1Wave: 'sine', osc1Octave: -1, modPitch: 32, modDecay: 0.14, ampAttack: 0, ampDecay: 0.45, ampSustain: 0, ampRelease: 0.1, drive: 0.2 },
  },
  {
    id: 'snare',
    name: 'Synth snare',
    category: 'Drums',
    recipe: 'Noise for the rattle and a short tone for the body, both dying in a fifth of a second.',
    patch: { osc1Wave: 'triangle', osc1Level: 0.5, noiseLevel: 0.9, filterOn: true, filterType: 'highpass', filterSlope: '12', filterCutoff: 900, modPitch: 12, modDecay: 0.03, ampAttack: 0, ampDecay: 0.18, ampSustain: 0, ampRelease: 0.12 },
  },
  {
    id: 'hat',
    name: 'Hi-hat',
    category: 'Drums',
    recipe: 'Only noise, high-passed, with a very short decay.',
    patch: { osc1Level: 0, noiseLevel: 1, filterOn: true, filterType: 'highpass', filterCutoff: 7000, ampAttack: 0, ampDecay: 0.06, ampSustain: 0, ampRelease: 0.05 },
  },
  {
    id: 'laser',
    name: 'Laser zap',
    category: 'FX',
    recipe: 'A square wave whose pitch dives fast from four octaves up: a sci-fi zap.',
    patch: { osc1Wave: 'square', modPitch: 48, modDecay: 0.18, ampDecay: 0.3, ampSustain: 0, ampRelease: 0.1, delayMix: 0.35, delayFeedback: 0.5 },
  },
  {
    id: 'wind',
    name: 'Wind',
    category: 'FX',
    recipe: 'Noise through a resonant band-pass, its centre drifting with a slow random LFO.',
    patch: { osc1Level: 0, noiseLevel: 1, filterOn: true, filterType: 'bandpass', filterCutoff: 800, filterRes: 0.7, lfoShape: 'triangle', lfoCutoff: 1.6, lfoRate: 0.15, ampAttack: 1.2, ampRelease: 2, reverbMix: 0.5, reverbSize: 0.9 },
  },
  {
    id: 'metal-wt',
    name: 'Digital growl',
    category: 'FX',
    recipe: 'The metallic wavetable swept by an envelope and a fast LFO: a modern, digital growl.',
    patch: { engine: 'wavetable', osc1Table: 'metal', osc1Pos: 0.2, modPos: 0.6, modDecay: 0.6, lfoPos: 0.2, lfoSync: true, lfoDiv: '1/16', osc1Octave: -1, voiceMode: 'mono', filterOn: true, filterCutoff: 3000, drive: 0.3 },
  },
];

export function presetPatch(p: Preset): Patch {
  return makePatch(p.patch);
}
