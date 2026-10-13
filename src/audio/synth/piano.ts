/**
 * Synthesised acoustic piano – PURE render function (no Web Audio), so it is
 * unit-testable and can run anywhere.
 *
 * Model (per note, rendered once and cached as an AudioBuffer by the engine):
 *  • Additive synthesis of 12–24 partials with piano-string inharmonicity
 *    f_n = n·f0·√(1 + B·n²); B rises toward the bass, which gives low notes
 *    their characteristic "stretched", slightly metallic growl.
 *  • Spectral envelope from the hammer: strike-position comb (hammer at ~1/8
 *    of the string), velocity-dependent roll-off (harder = brighter) and a
 *    soundboard radiation high-pass (weak fundamentals in the bass).
 *  • Two-stage decay: every partial is the sum of a "prompt" component (fast
 *    decay) and an "aftersound" component (slow decay). Higher partials decay
 *    faster. In the mid/upper register the components are slightly detuned
 *    from each other (and a third "string" is added on the lower partials),
 *    which reproduces the gentle beating/chorus of a piano's unison strings.
 *  • Each component is an exponentially damped sinusoid rendered with the
 *    two-multiply resonator recurrence – ~4 M multiply-adds for a mid note,
 *    i.e. a few milliseconds.
 *  • A short band-passed noise "hammer knock" plus a soft wooden thump.
 *  • Loudness is normalised on the attack portion so every key sounds equally
 *    loud; velocity → level is applied at playback (velocity here only changes
 *    timbre), so the engine can cache a few brightness buckets per key.
 */
import { midiToFreq } from '../../music/pitch';
import {
  ResonatorBank,
  clamp,
  fadeIn,
  fadeOut,
  filterInPlace,
  interp,
  mulberry32,
  peakAbs,
  rmsRange,
  scaleInPlace,
} from '../dsp/util';

export const PIANO_LOWEST = 21; // A0
export const PIANO_HIGHEST = 108; // C8

export interface PianoRenderOptions {
  /** Override the buffer length in seconds. */
  duration?: number;
  /**
   * Render into this (zero-filled) array instead of allocating – e.g. an
   * AudioBuffer's channel data. Its length defines the note length.
   */
  out?: Float32Array;
  /** Seed for the (deterministic) random detail. Default derived from midi. */
  seed?: number;
}

/** Buffer length per note: low notes ring longer. */
export function pianoNoteDuration(midi: number): number {
  return interp(
    [
      [21, 4.6],
      [48, 4.0],
      [60, 3.6],
      [72, 3.0],
      [84, 2.4],
      [96, 1.8],
      [108, 1.3],
    ],
    midi,
  );
}

/** Number of samples renderPianoSamples produces for a note at this rate. */
export function pianoNoteLength(midi: number, sampleRate: number): number {
  return Math.max(1, Math.round(pianoNoteDuration(clamp(Math.round(midi), PIANO_LOWEST, PIANO_HIGHEST)) * sampleRate));
}

/** Inharmonicity coefficient B (increasing toward the bass, slight rise at the top). */
export function pianoInharmonicity(midi: number): number {
  const bass = clamp((62 - midi) / 41, 0, 1);
  const treble = clamp((midi - 76) / 32, 0, 1);
  return 1.0e-4 + 3.2e-4 * Math.pow(bass, 1.4) + 1.5e-4 * treble;
}

/** Time constant (s) of the fundamental's aftersound. */
function slowTau(midi: number): number {
  return interp(
    [
      [21, 2.3],
      [36, 1.95],
      [48, 1.6],
      [60, 1.25],
      [72, 0.95],
      [84, 0.7],
      [96, 0.48],
      [108, 0.32],
    ],
    midi,
  );
}

/** Loudness compensation per register (treble is perceived louder at equal RMS). */
function registerGain(midi: number): number {
  return interp(
    [
      [21, 1.0],
      [48, 1.0],
      [72, 0.95],
      [90, 0.82],
      [108, 0.7],
    ],
    midi,
  );
}

/** Target RMS of the first 300 ms after normalisation. */
export const PIANO_TARGET_RMS = 0.16;

/**
 * Render one piano note as mono samples in [-1, 1] (a new Float32Array, or
 * `opts.out` filled in place).
 * @param midi 21 (A0) .. 108 (C8); values outside are clamped.
 * @param velocity 0..1 – affects brightness / hammer noise (not level).
 */
export function renderPianoSamples(
  midi: number,
  velocity: number,
  sampleRate: number,
  opts: PianoRenderOptions = {},
): Float32Array {
  const m = clamp(Math.round(midi), PIANO_LOWEST, PIANO_HIGHEST);
  const v = clamp(velocity, 0, 1);
  const sr = sampleRate;
  const B = pianoInharmonicity(m);
  // Stretch-tuning compensation: the ear (and a tuner) hears the pitch of the
  // strong, sharpened low partials, so lower f0 so that partial ~n_eff lands
  // on equal temperament. Without this, bass notes sound up to 25 cents sharp.
  const nEff = interp([[21, 8], [36, 6.5], [48, 5], [60, 4.2], [72, 3], [96, 2]], m);
  const f0 = midiToFreq(m) / Math.sqrt(1 + B * nEff * nEff);
  const len = opts.out ? opts.out.length : Math.max(1, Math.round((opts.duration ?? pianoNoteDuration(m)) * sr));
  const out: Float32Array = opts.out ?? new Float32Array(len);
  const bank = new ResonatorBank();
  const rand = mulberry32(opts.seed ?? m * 7919 + 13);

  // ---- tone ---------------------------------------------------------------
  const fLimit = Math.min(sr * 0.45, 13000);
  const maxPartials = m < 36 ? 22 : m < 48 ? 18 : m < 72 ? 14 : 12;
  // Unison strings: 1 string in the lowest bass, then pairs/triplets.
  const unison = m >= 34;
  const detuneScale = interp([[33, 0], [40, 0.7], [60, 1.0], [96, 1.3]], m);
  const strike = 0.122 + 0.01 * rand();
  // Velocity → brightness: spectral tilt exponent and a soft low-pass knee.
  const tilt = 1.55 - 0.75 * v;
  const knee = (900 + 5200 * Math.pow(v, 1.3)) * interp([[21, 0.8], [60, 1], [96, 1.6]], m);
  const tauSlow = slowTau(m);
  const promptRatio = interp([[21, 0.22], [60, 0.16], [96, 0.2]], m);
  const promptMix = interp([[21, 0.55], [60, 0.7], [96, 0.78]], m);
  // Render floor: stop each component ~85 dB below the note's peak level.
  const floor = 6e-5;

  for (let n = 1; n <= maxPartials; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > fLimit) break;
    let amp = Math.max(0.07, Math.abs(Math.sin(Math.PI * n * strike))) * Math.pow(n, -tilt);
    amp /= 1 + (fn / knee) * (fn / knee);
    amp *= (fn * fn) / (fn * fn + 95 * 95); // soundboard radiation (weak deep fundamentals)
    amp *= 1 + 0.15 * (rand() - 0.5);
    const decayScale = 1 + 0.075 * (n - 1) + fn / 4500;
    const tS = tauSlow / decayScale;
    const tF = tS * promptRatio * (0.85 + 0.3 * rand());
    if (unison) {
      const det = (0.6 + 1.3 * rand()) * detuneScale; // cents between strings
      const up = Math.pow(2, det / 2400);
      const dn = 1 / up;
      bank.add(fn * up, amp * promptMix, tF, sr, floor);
      bank.add(fn * dn, amp * (1 - promptMix), tS, sr, floor);
      if (n <= 6) {
        // third string: slightly further out, gives slow beating in the tail
        bank.add(fn * up * Math.pow(2, (0.4 * det) / 1200), amp * (1 - promptMix) * 0.4, tS * 0.85, sr, floor);
      }
    } else {
      bank.add(fn, amp * promptMix, tF, sr, floor);
      bank.add(fn, amp * (1 - promptMix), tS, sr, floor);
    }
  }
  bank.renderInto(out);

  // ---- hammer knock & wooden thump ----------------------------------------
  const toneRms = rmsRange(out, 0, Math.min(len, Math.round(0.1 * sr))) || 1e-3;
  const hTau = interp([[21, 0.011], [60, 0.0055], [108, 0.0024]], m);
  const hLen = Math.min(len, Math.ceil(hTau * 8 * sr));
  if (hLen > 8) {
    const knock = new Float32Array(hLen);
    const kAtk = Math.max(2, Math.round(0.0004 * sr));
    for (let i = 0; i < hLen; i++) {
      const env = Math.exp(-i / (hTau * sr)) * Math.min(1, i / kAtk);
      knock[i] = (rand() * 2 - 1) * env;
    }
    const bandHz = clamp(f0 * 2.2, 220, 3600) * (0.75 + 0.5 * v);
    filterInPlace(knock, 'bandpass', bandHz, 0.8, 0, sr);
    filterInPlace(knock, 'lowpass', 2200 + 7000 * v, 0.7, 0, sr);
    // RMS of the knock over its audible part (≈ τ/2 of energy) relative to
    // the tone: about −20 dB (soft) .. −11 dB (hard), more in the treble.
    const effRms = (rmsRange(knock) || 1e-6) * Math.sqrt(hLen / (0.5 * hTau * sr));
    const ratio = (0.1 + 0.18 * v) * (m > 84 ? 1.5 : 1);
    const g = (toneRms * ratio) / effRms;
    for (let i = 0; i < hLen; i++) out[i] += knock[i] * g;
  }
  const thump = toneRms * (0.05 + 0.1 * v);
  const knockBank = new ResonatorBank();
  knockBank.add(92 + 10 * rand(), thump, 0.028, sr, floor);
  knockBank.add(185 + 20 * rand(), thump * 0.6, 0.018, sr, floor);
  knockBank.renderInto(out);

  // ---- envelope edges --------------------------------------------------------
  // Hammer contact: ~1 ms (hard) .. ~4 ms (soft) raised-cosine attack.
  fadeIn(out, Math.round((0.0009 + 0.003 * (1 - v)) * sr));
  // Natural-sounding end: damper-like fade over the last ~30%.
  fadeOut(out, Math.round(Math.min(0.3 * len, 1.1 * sr)));

  // ---- loudness normalisation -------------------------------------------------
  const early = rmsRange(out, 0, Math.min(len, Math.round(0.3 * sr)));
  if (early > 0) {
    let g = (PIANO_TARGET_RMS * registerGain(m)) / early;
    const pk = peakAbs(out) * g;
    if (pk > 0.95) g *= 0.95 / pk;
    scaleInPlace(out, g);
  }
  return out;
}
