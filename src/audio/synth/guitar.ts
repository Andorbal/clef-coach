/**
 * Synthesised acoustic guitar (nylon/steel hybrid) – PURE render function.
 *
 * Extended Karplus–Strong (Jaffe & Smith) with a few upgrades:
 *  • Excitation: one period of seeded noise blended with a triangular pluck
 *    shape, low-passed according to velocity (soft = darker), then a
 *    pick-position comb (1 − z^−βL) which notches the harmonics a plucked
 *    string lacks.
 *  • Loop loss filter: a one-pole low-pass designed per note from two target
 *    decay times (fundamental τ₁ and a high frequency τ₂). This is "decay
 *    stretching": low strings ring for several seconds, high frequencies die
 *    away quickly, and the whole thing stays stable.
 *  • Exact tuning: the integer delay plus the loss filter's phase delay plus a
 *    first-order all-pass fractional delay are solved exactly at f0, so notes
 *    are in tune to a fraction of a cent (verified with the YIN detector in
 *    the tests).
 *  • Two string polarisations (slightly detuned, different decays) for the
 *    lively two-stage decay of a real string.
 *  • Static body resonance: peaking filters for the air (~100 Hz) and top
 *    plate (~210 Hz) modes, presence lift and a gentle high-shelf cut –
 *    applied to the excitation ("commuted synthesis"), which is equivalent
 *    for linear systems and far cheaper than filtering the whole note.
 *  • A tiny pick-noise transient.
 */
import { midiToFreq } from '../../music/pitch';
import {
  applyBiquadCascade,
  biquadCoeffs,
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

export const GUITAR_LOWEST = 40; // E2
export const GUITAR_HIGHEST = 88; // E6

export interface GuitarRenderOptions {
  /** Override the buffer length in seconds. */
  duration?: number;
  seed?: number;
  /** Render into this (zero-filled) array, e.g. an AudioBuffer's channel data. */
  out?: Float32Array;
}

/** Number of samples renderGuitarSamples produces for a note at this rate. */
export function guitarNoteLength(midi: number, sampleRate: number): number {
  return Math.max(1, Math.round(guitarNoteDuration(clamp(Math.round(midi), 24, 108)) * sampleRate));
}

export function guitarNoteDuration(midi: number): number {
  return interp(
    [
      [28, 4.6],
      [40, 4.2],
      [52, 3.7],
      [64, 3.2],
      [76, 2.5],
      [88, 1.8],
      [100, 1.2],
    ],
    midi,
  );
}

/** Amplitude time constant of the fundamental (s). */
function fundamentalTau(midi: number): number {
  return interp(
    [
      [28, 1.7],
      [40, 1.45],
      [52, 1.1],
      [64, 0.85],
      [76, 0.66],
      [88, 0.45],
      [100, 0.3],
    ],
    midi,
  );
}

export const GUITAR_TARGET_RMS = 0.17;

interface StringLoop {
  m: number; // integer delay
  b0: number; // one-pole: y = b0·x + a·y1
  a: number;
  eta: number; // all-pass coefficient
}

/**
 * Design the loop for frequency f0 with decay τ1 at f0 and τ2 at fHigh.
 */
function designLoop(f0: number, sr: number, tau1: number, tau2: number, fHigh: number): StringLoop {
  // Loop gain at DC: per period, amplitude falls by e^{−1/(τ1·f0)}.
  const g = Math.exp(-1 / (tau1 * f0));
  // Extra attenuation per period at fHigh relative to DC.
  const r = Math.exp(-(1 / tau2 - 1 / tau1) / f0);
  const w2 = (2 * Math.PI * Math.min(fHigh, sr * 0.45)) / sr;
  let a = 0;
  if (r < 0.999999) {
    // (1−a)² / (1 − 2a·cos w + a²) = r²  →  a² + b·a + 1 = 0
    const c = Math.cos(w2);
    const b = (2 * r * r * c - 2) / (1 - r * r);
    const disc = b * b - 4;
    a = disc > 0 ? (-b - Math.sqrt(disc)) / 2 : 0;
    a = clamp(a, 0, 0.95);
  }
  const b0 = g * (1 - a);
  // Phase delays at f0 (in samples) of the loss filter, then solve the
  // all-pass for the remaining fractional delay.
  const w0 = (2 * Math.PI * f0) / sr;
  const lpDelay = Math.atan2(a * Math.sin(w0), 1 - a * Math.cos(w0)) / w0;
  const total = sr / f0 - lpDelay;
  const m = Math.max(2, Math.floor(total - 0.5));
  const d = total - m; // in [0.5, 1.5)
  const theta = ((1 - d) * w0) / 2;
  const eta = Math.sin(theta) / Math.sin(w0 - theta);
  return { m, b0, a, eta };
}

/**
 * Run the two polarisation loops together (interleaved for instruction-level
 * parallelism), writing gA·A + gB·B into `out`.
 */
function runStrings(
  out: Float32Array,
  A: StringLoop,
  gA: number,
  B: StringLoop,
  gB: number,
  exc: Float64Array,
): void {
  const sizeA = 1 << Math.ceil(Math.log2(A.m + 4));
  const sizeB = 1 << Math.ceil(Math.log2(B.m + 4));
  const maskA = sizeA - 1;
  const maskB = sizeB - 1;
  const dlA = new Float64Array(sizeA);
  const dlB = new Float64Array(sizeB);
  const mA = A.m, b0A = A.b0, aA = A.a, eA = A.eta;
  const mB = B.m, b0B = B.b0, aB = B.a, eB = B.eta;
  let wA = 0, lpA = 0, xA = 0, yA = 0;
  let wB = 0, lpB = 0, xB = 0, yB = 0;
  const excLen = exc.length;
  const len = out.length;
  for (let n = 0; n < len; n++) {
    const e = n < excLen ? exc[n] : 0;
    // string A: loss low-pass → fractional-delay all-pass → delay line
    lpA = b0A * dlA[(wA - mA) & maskA] + aA * lpA;
    const apA = eA * lpA + xA - eA * yA;
    xA = lpA;
    yA = apA;
    const sA = e + apA;
    dlA[wA] = sA;
    wA = (wA + 1) & maskA;
    // string B
    lpB = b0B * dlB[(wB - mB) & maskB] + aB * lpB;
    const apB = eB * lpB + xB - eB * yB;
    xB = lpB;
    yB = apB;
    const sB = e + apB;
    dlB[wB] = sB;
    wB = (wB + 1) & maskB;
    out[n] = sA * gA + sB * gB;
  }
}

/**
 * Render one guitar note as mono samples in [-1, 1].
 * @param midi typically 40 (E2) .. 88 (E6); other values still render.
 * @param velocity 0..1 – pluck brightness (level is applied at playback).
 */
export function renderGuitarSamples(
  midi: number,
  velocity: number,
  sampleRate: number,
  opts: GuitarRenderOptions = {},
): Float32Array {
  const m = clamp(Math.round(midi), 24, 108);
  const v = clamp(velocity, 0, 1);
  const sr = sampleRate;
  const f0 = midiToFreq(m);
  const len = opts.out ? opts.out.length : Math.max(1, Math.round((opts.duration ?? guitarNoteDuration(m)) * sr));
  const out: Float32Array = opts.out ?? new Float32Array(len);
  const rand = mulberry32(opts.seed ?? m * 104729 + 7);

  // ---- excitation ---------------------------------------------------------
  const period = sr / f0;
  const excLen = Math.max(4, Math.round(period));
  const exc = new Float64Array(excLen);
  const beta = 0.13 + 0.03 * rand(); // pluck position (fraction of the string)
  let noiseRms = 0;
  let triRms = 0;
  const noise = new Float64Array(excLen);
  const tri = new Float64Array(excLen);
  for (let i = 0; i < excLen; i++) {
    noise[i] = rand() * 2 - 1;
    const s = i / excLen;
    tri[i] = s < beta ? s / beta : (1 - s) / (1 - beta);
  }
  // zero-mean triangle
  let triMean = 0;
  for (let i = 0; i < excLen; i++) triMean += tri[i];
  triMean /= excLen;
  for (let i = 0; i < excLen; i++) {
    tri[i] -= triMean;
    triRms += tri[i] * tri[i];
  }
  // pick-position comb on the noise part
  const p = Math.max(1, Math.round(beta * excLen));
  for (let i = excLen - 1; i >= p; i--) noise[i] -= noise[i - p];
  for (let i = 0; i < excLen; i++) noiseRms += noise[i] * noise[i];
  noiseRms = Math.sqrt(noiseRms / excLen) || 1;
  triRms = Math.sqrt(triRms / excLen) || 1;
  const noiseMix = 0.3 + 0.35 * v;
  for (let i = 0; i < excLen; i++) {
    exc[i] = (noise[i] / noiseRms) * noiseMix + (tri[i] / triRms) * (1 - noiseMix);
  }
  // velocity → brightness (one-pole low-pass, run twice for a softer slope)
  const cutoff = Math.min(sr * 0.45, (700 + 6500 * Math.pow(v, 1.3)) * interp([[40, 0.8], [64, 1], [88, 1.5]], m));
  const k = Math.exp((-2 * Math.PI * cutoff) / sr);
  for (let pass = 0; pass < 2; pass++) {
    let y = 0;
    for (let i = 0; i < excLen; i++) {
      y = (1 - k) * exc[i] + k * y;
      exc[i] = y;
    }
  }
  let mean = 0;
  for (let i = 0; i < excLen; i++) mean += exc[i];
  mean /= excLen;
  for (let i = 0; i < excLen; i++) exc[i] -= mean;

  // ---- strings -----------------------------------------------------------------
  const tau1 = fundamentalTau(m);
  const fHigh = Math.max(2400, f0 * 2.5);
  const tau2 = Math.min(tau1 * 0.45, interp([[40, 0.24], [64, 0.19], [88, 0.12]], m) * (0.85 + 0.3 * v));
  const main = designLoop(f0, sr, tau1, tau2, fHigh);
  const second = designLoop(f0 * Math.pow(2, 1.1 / 1200), sr, tau1 * 1.4, tau2 * 1.25, fHigh);
  // Commuted synthesis: string loop and body are both linear & time-invariant,
  // so instead of filtering the whole 4 s output through the body resonances
  // we filter the short excitation (plus the body's ~0.1 s ring) and feed
  // THAT into the strings. Same sound, ~40× less filtering work.
  const driven = new Float64Array(excLen + Math.round(0.12 * sr));
  driven.set(exc);
  applyBiquadCascade(driven, [
    biquadCoeffs('highpass', 55, 0.6, 0, sr), // also removes any DC
    biquadCoeffs('peaking', 102, 2.2, 4.5, sr), // air (Helmholtz) mode
    biquadCoeffs('peaking', 215, 2.5, 3, sr), // top-plate mode
    biquadCoeffs('peaking', 420, 1.4, -1.5, sr), // tame boxiness
    biquadCoeffs('peaking', 2600, 1.0, 1.5, sr), // presence
    biquadCoeffs('highshelf', 6000, 0.7, -4, sr), // warmth
  ]);
  runStrings(out, main, 0.75, second, 0.3, driven);

  // ---- pick noise ------------------------------------------------------------
  const pickLen = Math.min(len, Math.round(0.0025 * sr));
  if (pickLen > 4) {
    const pick = new Float32Array(pickLen);
    for (let i = 0; i < pickLen; i++) pick[i] = (rand() * 2 - 1) * Math.exp((-4 * i) / pickLen);
    filterInPlace(pick, 'highpass', 1800, 0.7, 0, sr);
    const ref = rmsRange(out, 0, Math.min(len, Math.round(0.05 * sr))) || 0.1;
    const pr = rmsRange(pick) || 1e-6;
    const g = (ref * (0.12 + 0.25 * v)) / pr;
    for (let i = 0; i < pickLen; i++) out[i] += pick[i] * g;
  }

  fadeIn(out, Math.round(0.0006 * sr));
  fadeOut(out, Math.round(Math.min(0.3 * len, 1.0 * sr)));

  const early = rmsRange(out, 0, Math.min(len, Math.round(0.3 * sr)));
  if (early > 0) {
    let g = GUITAR_TARGET_RMS / early;
    const pk = peakAbs(out) * g;
    if (pk > 0.95) g *= 0.95 / pk;
    scaleInPlace(out, g);
  }
  return out;
}
