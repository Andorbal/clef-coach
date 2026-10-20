/**
 * Bowed strings (violin, viola, cello, double bass) – PURE render function.
 *
 * A plucked or struck note dies away by itself, so one buffer per note does. A bowed
 * note sounds for as long as the bow moves, so each note is rendered as an attack and
 * then a stretch of sustain that loops seamlessly: the engine plays the attack once and
 * loops the sustain until the note is released.
 *
 * Everything in the loop repeats exactly once per loop:
 *  • The string: a bowed string moves in a Helmholtz motion, whose sound is close to a
 *    band-limited sawtooth (PolyBLEP here). Its pitch carries the vibrato. The vibrato
 *    makes a whole number of cycles per loop, and the note is tuned by a fraction of a
 *    cent so that the oscillator makes a whole number of cycles too: the loop's end
 *    meets its start, sample for sample.
 *  • The bowing point: a comb (x − x[n−D]) takes out every βth harmonic, as bowing a
 *    string at 1/β of its length does.
 *  • Bow noise: read from a noise table one loop long, so it repeats with the loop.
 *  • The bow's pressure: a slow wobble in level, a whole number of cycles per loop.
 *  • The body: peaking filters for the instrument's air and wood resonances and the
 *    bridge's "hill" of brightness, a high-pass below the lowest body mode and a gentle
 *    high cut. Their memory is short (a few milliseconds), and the music is already
 *    periodic for 100 ms before the loop starts, so the filters are settled by then.
 *  • The attack: the bow catching the string. A scratchy burst, a quicker rise and a
 *    little accent for loud notes, a slower rise for soft ones, and the vibrato fading
 *    in after it, as a player's does.
 */
import { midiToFreq } from '../../music/pitch';
import { type BiquadCoeffs, applyBiquadCascade, biquadCoeffs, clamp, mulberry32 } from '../dsp/util';

export type BowedVoice = 'violin' | 'viola' | 'cello' | 'doublebass';

export const BOWED_VOICES: readonly BowedVoice[] = ['violin', 'viola', 'cello', 'doublebass'];

export const isBowedVoice = (v: string): v is BowedVoice => (BOWED_VOICES as readonly string[]).includes(v);

interface BowedSpec {
  /** Vibrato rate (Hz) and depth (cents either side). */
  vibRate: number;
  vibCents: number;
  /** Seconds before the vibrato starts, and how long it takes to reach full depth. */
  vibDelay: number;
  vibFade: number;
  /** Body: [frequency, Q, gain dB] peaks. */
  body: [number, number, number][];
  /** High-pass (Hz) below the lowest body mode, and the high cut (Hz). */
  highpass: number;
  lowpass: number;
  /** Bowing point: 1/β of the string length (the comb removes every βth harmonic). */
  beta: number;
  /** Bow noise level (relative to the string). */
  noise: number;
  /** Brightness: the string's low-pass as multiples of f0 for a soft and a loud note. */
  bright: [number, number];
  /** Attack rise time (s) for a loud and a soft note. */
  rise: [number, number];
  /** Release time constant (s): the string rings on a little after the bow leaves it. */
  release: number;
}

const SPECS: Record<BowedVoice, BowedSpec> = {
  violin: {
    vibRate: 5.6,
    vibCents: 16,
    vibDelay: 0.22,
    vibFade: 0.3,
    body: [
      [280, 5, 4.5],
      [470, 4, 6],
      [1050, 2.5, -3],
      [2600, 1.3, 6],
    ],
    highpass: 190,
    lowpass: 7500,
    beta: 7,
    noise: 0.035,
    bright: [9, 26],
    rise: [0.035, 0.13],
    release: 0.09,
  },
  viola: {
    vibRate: 5.4,
    vibCents: 15,
    vibDelay: 0.24,
    vibFade: 0.3,
    body: [
      [230, 5, 5],
      [390, 4, 5],
      [900, 2.5, -2.5],
      [2100, 1.3, 5],
    ],
    highpass: 120,
    lowpass: 6500,
    beta: 7,
    noise: 0.035,
    bright: [8, 22],
    rise: [0.04, 0.14],
    release: 0.1,
  },
  cello: {
    vibRate: 5.2,
    vibCents: 14,
    vibDelay: 0.25,
    vibFade: 0.32,
    body: [
      [105, 4, 4],
      [200, 4, 6],
      [420, 3, 3],
      [1400, 1.2, 5],
    ],
    highpass: 55,
    lowpass: 5500,
    beta: 8,
    noise: 0.03,
    bright: [9, 24],
    rise: [0.045, 0.16],
    release: 0.12,
  },
  doublebass: {
    vibRate: 4.8,
    vibCents: 12,
    vibDelay: 0.3,
    vibFade: 0.35,
    body: [
      [62, 3, 4],
      [115, 3.5, 6],
      [280, 2.5, 3],
      [900, 1.2, 4],
    ],
    highpass: 32,
    lowpass: 3800,
    beta: 9,
    noise: 0.028,
    bright: [10, 26],
    rise: [0.06, 0.2],
    release: 0.16,
  },
};

/** The sustain loop's length (s). */
const LOOP_SECONDS = 1;
/** The music is periodic this long before the loop starts, so the filters have settled. */
const SETTLE_SECONDS = 0.1;

/** Seconds of attack before the music becomes periodic. */
function attackSeconds(voice: BowedVoice): number {
  const s = SPECS[voice];
  return s.vibDelay + s.vibFade;
}

/** Where the loop starts and ends (samples): the buffer ends at the loop's end. */
export function bowedLoop(voice: BowedVoice, sampleRate: number): { start: number; end: number } {
  const periodic = Math.round(attackSeconds(voice) * sampleRate);
  const start = periodic + Math.round(SETTLE_SECONDS * sampleRate);
  return { start, end: start + Math.round(LOOP_SECONDS * sampleRate) };
}

export function bowedNoteLength(voice: BowedVoice, sampleRate: number): number {
  return bowedLoop(voice, sampleRate).end;
}

/** Release time constant: how long the string rings after the bow leaves it. */
export function bowedRelease(voice: BowedVoice): number {
  return SPECS[voice].release;
}

export const BOWED_TARGET_RMS = 0.15;

export interface BowedRenderOptions {
  seed?: number;
  /** Render into this (zero-filled) array, e.g. an AudioBuffer's channel data. */
  out?: Float32Array;
}

/** PolyBLEP residual for a sawtooth's jump (t: phase 0..1, dt: phase increment). */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/**
 * Render a bowed note: the attack, then one loop of sustain (see bowedLoop). `velocity`
 * (0..1) sets the bow's speed and weight: brightness, attack and bow noise.
 */
export function renderBowedSamples(voice: BowedVoice, midi: number, velocity: number, sampleRate: number, opts: BowedRenderOptions = {}): Float32Array {
  const spec = SPECS[voice];
  const sr = sampleRate;
  const { start: loopStart, end: n } = bowedLoop(voice, sr);
  const out = opts.out ?? new Float32Array(n);
  const len = Math.min(n, out.length);
  const vel = clamp(velocity, 0, 1);
  const L = n - loopStart;
  const periodic = loopStart - Math.round(SETTLE_SECONDS * sr);
  const rand = mulberry32(opts.seed ?? midi * 7919 + 17);

  // vibrato: a whole number of cycles per loop
  const vibCycles = Math.max(1, Math.round((spec.vibRate * L) / sr));
  const vibW = (2 * Math.PI * vibCycles) / L;
  const vibStart = Math.round(spec.vibDelay * sr);
  const depthAt = (i: number) => (i <= vibStart ? 0 : i >= periodic ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * (i - vibStart)) / (periodic - vibStart)));
  const ratioAt = (i: number) => Math.pow(2, (spec.vibCents * depthAt(i) * Math.sin(vibW * i)) / 1200);

  // tune the note so the oscillator makes a whole number of cycles per loop
  const f0 = midiToFreq(midi);
  let sum = 0;
  for (let i = 0; i < L; i++) sum += Math.pow(2, (spec.vibCents * Math.sin(vibW * i)) / 1200);
  const perLoop = (f0 * sum) / sr;
  const f = (f0 * Math.max(1, Math.round(perLoop))) / perLoop;

  // the bow's pressure wobbles slightly (whole cycles per loop)
  const w1 = (2 * Math.PI * 2) / L;
  const w2 = (2 * Math.PI * 3) / L;
  const ph1 = rand() * Math.PI * 2;
  const ph2 = rand() * Math.PI * 2;

  // attack: the rise (quicker when loud), a small accent, then steady
  const rise = Math.round((spec.rise[0] + (spec.rise[1] - spec.rise[0]) * (1 - vel)) * sr);
  const accent = 0.18 * vel * vel;
  const settle = Math.max(rise + 1, Math.round(0.22 * sr));
  const envAt = (i: number) => {
    if (i < rise) {
      const x = i / rise;
      return x * x * (3 - 2 * x) * (1 + accent);
    }
    if (i < settle) return 1 + accent * (0.5 + 0.5 * Math.cos((Math.PI * (i - rise)) / (settle - rise)));
    return 1;
  };

  // the string: a sawtooth through the bowing-point comb
  const comb = Math.max(2, Math.round(sr / f0 / spec.beta));
  const hist = new Float64Array(comb);
  let phase = rand();
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dt = (f * ratioAt(i)) / sr;
    phase += dt;
    if (phase >= 1) phase -= 1;
    const saw = 2 * phase - 1 - polyBlep(phase, dt);
    const k = i % comb;
    raw[i] = saw - 0.8 * hist[k];
    hist[k] = saw;
  }
  // brightness (bow speed and weight), then the body
  const bright = clamp(f0 * (spec.bright[0] + (spec.bright[1] - spec.bright[0]) * vel), 900, spec.lowpass);
  const stages: BiquadCoeffs[] = [
    biquadCoeffs('lowpass', bright, 0.6, 0, sr),
    biquadCoeffs('highpass', spec.highpass, 0.7, 0, sr),
    ...spec.body.map(([fr, q, g]) => biquadCoeffs('peaking', fr, q, g, sr)),
    biquadCoeffs('lowpass', spec.lowpass, 0.7, 0, sr),
  ];
  applyBiquadCascade(raw, stages);

  // bow noise: a table one loop long, band-passed to a hiss; a scratch at the start
  const noise = new Float64Array(L);
  for (let i = 0; i < L; i++) noise[i] = rand() * 2 - 1;
  const hiss = new Float64Array(n);
  for (let i = 0; i < n; i++) hiss[i] = noise[(((i - periodic) % L) + L) % L];
  applyBiquadCascade(hiss, [biquadCoeffs('bandpass', clamp(f0 * 6, 1800, 5000), 0.9, 0, sr), biquadCoeffs('highpass', 600, 0.7, 0, sr)]);
  const scratchLen = Math.round((0.05 + 0.04 * vel) * sr);
  const noiseLevel = spec.noise * (0.6 + 0.8 * vel);

  // level the string's sustain (the body changes it a lot from note to note)
  let ss = 0;
  for (let i = loopStart; i < n; i++) ss += raw[i] * raw[i];
  const gain = BOWED_TARGET_RMS / Math.max(1e-6, Math.sqrt(ss / L));
  let hs = 0;
  for (let i = loopStart; i < n; i++) hs += hiss[i] * hiss[i];
  const hissGain = (BOWED_TARGET_RMS * noiseLevel) / Math.max(1e-6, Math.sqrt(hs / L));

  for (let i = 0; i < len; i++) {
    const press = i >= periodic ? 1 + 0.03 * Math.sin(w1 * i + ph1) + 0.02 * Math.sin(w2 * i + ph2) : 1 + 0.03 * Math.sin(w1 * i + ph1) * depthAt(i) + 0.02 * Math.sin(w2 * i + ph2) * depthAt(i);
    const scratch = i < scratchLen ? 3 * (1 - i / scratchLen) * (0.4 + vel) : 0;
    out[i] = (raw[i] * gain * press + hiss[i] * hissGain * (1 + scratch)) * envAt(i);
  }
  return out;
}
