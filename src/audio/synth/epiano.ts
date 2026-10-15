/**
 * Synthesised Rhodes-style electric piano – PURE render function (no Web Audio).
 *
 * Model (per note, rendered once and cached like the piano):
 *  • The tine: a struck cantilever tuned to the note, rendered as a damped
 *    sinusoid with a two-stage decay (a quicker "prompt" part and the long
 *    sustain that the tuned tonebar feeds back) – ResonatorBank recurrences.
 *  • The pickup: the tine swings in front of an electromagnetic pickup whose
 *    response to displacement is strongly non-linear. A bell-shaped
 *    (Lorentzian) field 1/(1 + (x − c)²) with the tine set slightly off-centre
 *    (c ≈ 0.4 of the field width) does what the real one does: soft notes stay
 *    almost sinusoidal and warm, harder notes swing further into the curve and
 *    grow a strong 2nd/3rd harmonic "bark" – which mellows again as the tine's
 *    amplitude decays. No velocity-dependent filter tricks needed.
 *  • The tine's own inharmonic overtone: a short, bell-like "ping" several
 *    octaves up, louder at high velocity – the characteristic metallic attack.
 *  • A felt/neoprene hammer thump and a gentle output low-pass (pickup
 *    inductance + amp), then DC/rumble removal.
 *  • Loudness is normalised on the attack portion like the piano, so every key
 *    sounds equally loud; velocity here changes timbre only (the engine applies
 *    level at playback).
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

export const EPIANO_LOWEST = 28; // E1
export const EPIANO_HIGHEST = 103; // G7

export interface EPianoRenderOptions {
  /** Override the buffer length in seconds. */
  duration?: number;
  /** Render into this (zero-filled) array, e.g. an AudioBuffer's channel data. Its length defines the note length. */
  out?: Float32Array;
  /** Seed for the (deterministic) random detail. Default derived from midi. */
  seed?: number;
}

/** Buffer length per note (s): low notes ring longer. */
export function epianoNoteDuration(midi: number): number {
  return interp(
    [
      [28, 5.0],
      [40, 4.6],
      [52, 4.1],
      [64, 3.6],
      [76, 2.9],
      [88, 2.2],
      [103, 1.5],
    ],
    midi,
  );
}

/** Number of samples renderEPianoSamples produces for a note at this rate. */
export function epianoNoteLength(midi: number, sampleRate: number): number {
  return Math.max(1, Math.round(epianoNoteDuration(clamp(Math.round(midi), EPIANO_LOWEST, EPIANO_HIGHEST)) * sampleRate));
}

/** Roughly how long the note stays clearly audible (s) – for the microphone's self-hearing guard. */
export function epianoAudibleSeconds(midi: number): number {
  const m = clamp(Math.round(midi), EPIANO_LOWEST, EPIANO_HIGHEST);
  return Math.min(epianoNoteDuration(m), interp([[28, 4.75], [40, 4.35], [52, 3.85], [64, 3.3], [76, 2.65], [88, 1.95], [103, 1.3]], m));
}

/** Time constant (s) of the tine's sustain. */
function sustainTau(midi: number): number {
  return interp(
    [
      [28, 2.6],
      [40, 2.3],
      [52, 1.9],
      [64, 1.5],
      [76, 1.05],
      [88, 0.7],
      [103, 0.4],
    ],
    midi,
  );
}

/** Loudness compensation per register (treble is perceived louder at equal RMS). */
function registerGain(midi: number): number {
  return interp(
    [
      [28, 1.0],
      [60, 1.0],
      [84, 0.92],
      [103, 0.82],
    ],
    midi,
  );
}

/** Target RMS of the first 300 ms after normalisation (same as the piano). */
export const EPIANO_TARGET_RMS = 0.16;

/**
 * Render one electric-piano note as mono samples in [-1, 1] (a new
 * Float32Array, or `opts.out` filled in place).
 * @param midi 28 (E1) .. 103 (G7); values outside are clamped.
 * @param velocity 0..1 – tine excursion: brightness and "bark" (not level).
 */
export function renderEPianoSamples(
  midi: number,
  velocity: number,
  sampleRate: number,
  opts: EPianoRenderOptions = {},
): Float32Array {
  const m = clamp(Math.round(midi), EPIANO_LOWEST, EPIANO_HIGHEST);
  const v = clamp(Number.isFinite(velocity) ? velocity : 0, 0, 1);
  const sr = sampleRate;
  const f0 = midiToFreq(m);
  const len = opts.out ? opts.out.length : Math.max(1, Math.round((opts.duration ?? epianoNoteDuration(m)) * sr));
  const out: Float32Array = opts.out ?? new Float32Array(len);
  if (opts.out) out.fill(0);
  const rand = mulberry32(opts.seed ?? m * 6151 + 29);

  // ---- tine motion (in units of the pickup's field width) --------------------
  const tauS = sustainTau(m);
  const drive = (0.22 + 0.95 * Math.pow(v, 1.25)) * interp([[28, 1.05], [48, 1.0], [72, 0.85], [90, 0.6], [103, 0.45]], m);
  const promptMix = 0.4;
  const bank = new ResonatorBank();
  bank.add(f0, drive * promptMix, tauS * 0.22, sr, 1e-6);
  bank.add(f0, drive * (1 - promptMix), tauS, sr, 1e-6);
  bank.renderInto(out);

  // ---- pickup: Lorentzian field, tine voiced slightly off-centre ------------
  const c = interp([[28, 0.36], [64, 0.4], [103, 0.46]], m);
  const base = 1 / (1 + c * c);
  for (let i = 0; i < len; i++) {
    const d = out[i] - c;
    out[i] = 1 / (1 + d * d) - base;
  }

  // ---- the tine's bell-like overtone ------------------------------------------
  const early = rmsRange(out, 0, Math.min(len, Math.round(0.05 * sr))) || 1e-3;
  let ratio = interp([[28, 9.5], [52, 8], [72, 6.5], [90, 5], [103, 4.2]], m);
  if (f0 * ratio > Math.min(10000, sr * 0.4)) ratio = Math.max(2.1, Math.min(10000, sr * 0.4) / f0);
  const bellAmp = early * Math.SQRT2 * (0.04 + 0.26 * v * v) * interp([[28, 0.6], [60, 1.0], [96, 1.2]], m);
  const bellTau = interp([[28, 0.08], [60, 0.05], [103, 0.022]], m);
  const bell = new ResonatorBank();
  bell.add(f0 * ratio * (1 + 0.004 * (rand() - 0.5)), bellAmp, bellTau, sr, 1e-6);
  bell.add(f0 * ratio * 1.52 * (1 + 0.004 * (rand() - 0.5)), bellAmp * 0.3 * v, bellTau * 0.6, sr, 1e-6);
  // hammer thump: a soft low knock felt more than heard
  bell.add(125 + 20 * rand(), early * (0.05 + 0.08 * v), 0.022, sr, 1e-6);
  bell.renderInto(out);

  // ---- hammer contact noise ---------------------------------------------------
  const hLen = Math.min(len, Math.round(0.012 * sr));
  if (hLen > 8) {
    const knock = new Float32Array(hLen);
    const hTau = 0.0025;
    const dk = Math.exp(-1 / (hTau * sr));
    let e = 1;
    for (let i = 0; i < hLen; i++) {
      knock[i] = (rand() * 2 - 1) * e;
      e *= dk;
    }
    filterInPlace(knock, 'bandpass', 900 + 1600 * v, 0.8, 0, sr);
    const kr = rmsRange(knock) || 1e-6;
    const g = (early * (0.06 + 0.1 * v)) / kr;
    for (let i = 0; i < hLen; i++) out[i] += knock[i] * g;
  }

  // ---- output: pickup/amp roll-off, DC and rumble removal -------------------
  const lp = Math.min(sr * 0.45, interp([[28, 2600], [52, 4500], [76, 7000], [103, 10000]], m) * (0.75 + 0.5 * v));
  filterInPlace(out, 'lowpass', lp, 0.6, 0, sr);
  filterInPlace(out, 'highpass', Math.max(20, f0 * 0.5), 0.7, 0, sr);

  fadeIn(out, Math.round((0.0008 + 0.002 * (1 - v)) * sr));
  fadeOut(out, Math.round(Math.min(0.3 * len, 1.1 * sr)));

  // ---- loudness normalisation -------------------------------------------------
  const att = rmsRange(out, 0, Math.min(len, Math.round(0.3 * sr)));
  if (att > 0) {
    let g = (EPIANO_TARGET_RMS * registerGain(m)) / att;
    const pk = peakAbs(out) * g;
    if (pk > 0.95) g *= 0.95 / pk;
    scaleInPlace(out, g);
  }
  return out;
}
