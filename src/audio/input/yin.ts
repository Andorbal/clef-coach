/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
 *
 * PURE + DOM-free. The squared-difference function is computed in
 * O(N log N) with an FFT cross-correlation instead of the textbook O(N·W)
 * double loop, so a 4096-sample frame costs well under a millisecond and the
 * detector comfortably runs at 50–60 frames/s on an iPad.
 *
 *   d(τ)  = Σ_{j<W} (x[j] − x[j+τ])²  = e₁ + e₂(τ) − 2·c(τ)
 *   d'(τ) = d(τ)·τ / Σ_{k=1..τ} d(k)            (cumulative-mean normalised)
 *
 * The first τ where d' dips below the absolute threshold is selected (then
 * walked down to its local minimum), refined by parabolic interpolation on
 * the raw d(τ). An extra "sub-octave check" guards against the classic
 * octave-UP error on tones whose fundamental is weak but whose 2nd harmonic is
 * strong (common on piano bass and guitar).
 */
import { getFFT, nextPow2 } from '../dsp/fft';

export interface PitchResult {
  /** Fundamental frequency in Hz. */
  freq: number;
  /** 0..1 periodicity confidence (1 − d'(τ)). Clean tones give > 0.9. */
  clarity: number;
}

export interface DetectPitchOptions {
  /** Lowest detectable frequency in Hz (default 50 – below A1). */
  minFreq?: number;
  /** Highest detectable frequency in Hz (default 2500 – above C7). */
  maxFreq?: number;
  /** YIN absolute threshold on d' (default 0.15). */
  threshold?: number;
  /**
   * If no dip goes under `threshold`, the global minimum is still accepted
   * when below this value (default 0.35) – with correspondingly low clarity.
   */
  maxDip?: number;
  /** Frames quieter than this RMS are treated as silence (default 1e-4). */
  minRms?: number;
}

interface Scratch {
  m: number;
  re: Float64Array;
  im: Float64Array;
  pr: Float64Array;
  pi: Float64Array;
  x: Float64Array;
  cs: Float64Array;
  d: Float64Array;
  dp: Float64Array;
}

const scratchBySize = new Map<number, Scratch>();

function getScratch(m: number): Scratch {
  let s = scratchBySize.get(m);
  if (!s) {
    s = {
      m,
      re: new Float64Array(m),
      im: new Float64Array(m),
      pr: new Float64Array(m),
      pi: new Float64Array(m),
      x: new Float64Array(m),
      cs: new Float64Array(m + 1),
      d: new Float64Array(m),
      dp: new Float64Array(m),
    };
    scratchBySize.set(m, s);
  }
  return s;
}

/** Root-mean-square of a buffer (or a sub-range). */
export function rms(buf: ArrayLike<number>, from = 0, to = buf.length): number {
  const a = Math.max(0, from);
  const b = Math.min(buf.length, to);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / (b - a));
}

/**
 * Detect the fundamental frequency of a (roughly) monophonic frame.
 * Returns null for silence, noise or anything without a clear period.
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  opts: DetectPitchOptions = {},
): PitchResult | null {
  const minFreq = opts.minFreq ?? 50;
  const maxFreq = opts.maxFreq ?? 2500;
  const threshold = opts.threshold ?? 0.15;
  const maxDip = opts.maxDip ?? 0.35;
  const minRms = opts.minRms ?? 1e-4;

  const n = buf.length;
  if (n < 64) return null;
  // τ range restricted to the useful band. Leave ≥ half the frame as the
  // integration window so low notes still get several periods of support.
  const tauMax = Math.min(Math.ceil(sampleRate / minFreq) + 2, Math.floor(n / 2));
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  if (tauMax <= tauMin + 2) return null;
  const w = n - tauMax; // integration window length

  // Mean removal + silence gate.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += buf[i];
  mean /= n;
  const m = nextPow2(n);
  const s = getScratch(m);
  const { re, im, pr, pi, x, cs, d, dp } = s;
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const v = buf[i] - mean;
    x[i] = v;
    energy += v * v;
  }
  if (!(Math.sqrt(energy / n) >= minRms)) return null; // also catches NaN

  // --- Cross term c(τ) = Σ_{j<W} x[j]·x[j+τ] via one complex FFT ----------
  // Pack a = x[0..W) (zero padded) into the real part and b = x into the
  // imaginary part, split the spectra, multiply conj(A)·B, inverse FFT.
  for (let i = 0; i < m; i++) {
    re[i] = i < w ? x[i] : 0;
    im[i] = i < n ? x[i] : 0;
  }
  const fft = getFFT(m);
  fft.transform(re, im, false);
  for (let k = 0; k < m; k++) {
    const k2 = (m - k) & (m - 1);
    const zr = re[k];
    const zi = im[k];
    const cr = re[k2];
    const ci = -im[k2]; // conj(Z[M-k])
    const ar = (zr + cr) * 0.5;
    const ai = (zi + ci) * 0.5;
    const br = (zi - ci) * 0.5;
    const bi = -(zr - cr) * 0.5;
    // conj(A)·B
    pr[k] = ar * br + ai * bi;
    pi[k] = ar * bi - ai * br;
  }
  fft.transform(pr, pi, true);
  const invM = 1 / m;

  // --- Energy terms via prefix sums --------------------------------------
  cs[0] = 0;
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + x[i] * x[i];
  const e1 = cs[w];

  // --- Difference function + CMNDF ---------------------------------------
  d[0] = 0;
  dp[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    const e2 = cs[tau + w] - cs[tau];
    let v = e1 + e2 - 2 * pr[tau] * invM;
    if (v < 0) v = 0;
    d[tau] = v;
    running += v;
    dp[tau] = running > 0 ? (v * tau) / running : 1;
  }

  // --- Absolute threshold on the *interpolated* dip depth -----------------
  // Each local minimum of d' is evaluated at its parabolic vertex. For high
  // notes the true period falls between integer lags (e.g. 32.4 samples) and
  // strong upper harmonics make d' at the nearest integer lag much larger than
  // the real dip – without this, YIN would skip the true period and lock onto
  // 2τ (an octave too low).
  const dipDepth = (t: number): number => {
    const a = dp[t - 1];
    const b = dp[t];
    const c = dp[t + 1];
    const den = a - 2 * b + c;
    if (den <= 0) return b;
    const p = (0.5 * (a - c)) / den;
    if (p <= -1 || p >= 1) return b;
    return Math.max(0, b - 0.25 * (a - c) * p);
  };
  const isLocalMin = (t: number): boolean => dp[t] <= dp[t - 1] && dp[t] <= dp[t + 1];
  let tauEst = -1;
  let depth = 1;
  let fallbackTau = -1;
  let fallbackDepth = Infinity;
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (!isLocalMin(tau)) continue;
    const v = dipDepth(tau);
    if (v < threshold) {
      tauEst = tau;
      depth = v;
      break;
    }
    if (v < fallbackDepth) {
      fallbackDepth = v;
      fallbackTau = tau;
    }
  }
  if (tauEst < 0) {
    // No dip under the threshold: accept the deepest interior minimum only
    // if it is still reasonably deep (low clarity is reported).
    if (fallbackTau < 0 || fallbackDepth > maxDip || fallbackTau <= tauMin) return null;
    tauEst = fallbackTau;
    depth = fallbackDepth;
  }

  // --- Sub-octave check (weak fundamental, strong 2nd harmonic) -----------
  // If the dip at 2τ is far deeper than at τ, the true period is 2τ: the
  // signal only *nearly* repeats after τ because the odd harmonics differ.
  const t2 = tauEst * 2;
  if (t2 + 2 < tauMax && depth > 0.02) {
    let b2 = -1;
    for (let t = t2 - 2; t <= t2 + 2; t++) {
      if (t > tauMin && isLocalMin(t) && (b2 < 0 || dp[t] < dp[b2])) b2 = t;
    }
    if (b2 > 0) {
      const v2 = dipDepth(b2);
      if (v2 < depth * 0.35) {
        tauEst = b2;
        depth = v2;
      }
    }
  }

  // --- Parabolic interpolation on the raw difference function -------------
  let refined = tauEst;
  if (tauEst > 1 && tauEst < tauMax) {
    const a = d[tauEst - 1];
    const b = d[tauEst];
    const c = d[tauEst + 1];
    const den = a - 2 * b + c;
    if (den > 0) {
      const delta = (0.5 * (a - c)) / den;
      if (Math.abs(delta) < 1) refined = tauEst + delta;
    }
  }

  const freq = sampleRate / refined;
  if (!(freq >= minFreq * 0.97 && freq <= maxFreq * 1.03)) return null;
  const clarity = Math.min(1, Math.max(0, 1 - depth));
  return { freq, clarity };
}
