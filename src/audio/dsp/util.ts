/**
 * Small pure DSP helpers shared by the offline renderers (instruments, sfx,
 * metronome clicks) and the analysis code. Nothing in here touches the DOM or
 * Web Audio, so everything is unit-testable in Node.
 */

/** Float32Array backed by a plain ArrayBuffer (what Web Audio APIs accept). */
export type Samples = Float32Array<ArrayBuffer>;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(g: number): number {
  return 20 * Math.log10(Math.max(g, 1e-12));
}

/**
 * Piecewise-linear interpolation through sorted [x, y] points, clamped at the
 * ends. Used for "per register" instrument parameters.
 */
export function interp(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

/** Deterministic PRNG (mulberry32): same seed → same "random" render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Biquad (RBJ cookbook) – offline, in-place processing
// ---------------------------------------------------------------------------

export type BiquadType = 'lowpass' | 'highpass' | 'bandpass' | 'peaking' | 'lowshelf' | 'highshelf';

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export function biquadCoeffs(
  type: BiquadType,
  freq: number,
  q: number,
  gainDb: number,
  sampleRate: number,
): BiquadCoeffs {
  const f = clamp(freq, 1, sampleRate * 0.49);
  const w0 = (2 * Math.PI * f) / sampleRate;
  const cs = Math.cos(w0);
  const sn = Math.sin(w0);
  const alpha = sn / (2 * Math.max(q, 1e-4));
  const A = Math.pow(10, gainDb / 40);
  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  switch (type) {
    case 'lowpass':
      b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2;
      a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case 'highpass':
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2;
      a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case 'bandpass':
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case 'peaking':
      b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A;
      break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cs + s);
      b1 = 2 * A * (A - 1 - (A + 1) * cs);
      b2 = A * (A + 1 - (A - 1) * cs - s);
      a0 = A + 1 + (A - 1) * cs + s;
      a1 = -2 * (A - 1 + (A + 1) * cs);
      a2 = A + 1 + (A - 1) * cs - s;
      break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cs + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cs);
      b2 = A * (A + 1 + (A - 1) * cs - s);
      a0 = A + 1 - (A - 1) * cs + s;
      a1 = 2 * (A - 1 - (A + 1) * cs);
      a2 = A + 1 - (A - 1) * cs - s;
      break;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Run a biquad over buf[from, to) in place (transposed direct form II). */
export function applyBiquad(
  buf: Float32Array | Float64Array,
  c: BiquadCoeffs,
  from = 0,
  to = buf.length,
): void {
  const { b0, b1, b2, a1, a2 } = c;
  let z1 = 0;
  let z2 = 0;
  for (let i = from; i < to; i++) {
    const x = buf[i];
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    buf[i] = y;
  }
}

/** Convenience: build + apply in one call. */
export function filterInPlace(
  buf: Float32Array | Float64Array,
  type: BiquadType,
  freq: number,
  q: number,
  gainDb: number,
  sampleRate: number,
  from = 0,
  to = buf.length,
): void {
  applyBiquad(buf, biquadCoeffs(type, freq, q, gainDb, sampleRate), from, to);
}

// ---------------------------------------------------------------------------
// Oscillators / envelopes
// ---------------------------------------------------------------------------

/**
 * Add an exponentially-damped sinusoid amp·e^{-t/tau}·sin(2πft) starting at
 * sample `start`, using the two-multiply resonator recurrence
 *   y[n] = 2r·cos(ω)·y[n-1] − r²·y[n-2]
 * which is far cheaper than calling Math.sin per sample. Rendering stops once
 * the envelope falls below `floor` (absolute amplitude).
 */
export function addDampedSine(
  out: Float32Array | Float64Array,
  start: number,
  freq: number,
  amp: number,
  tau: number,
  sampleRate: number,
  floor = 1e-5,
): void {
  if (amp === 0 || !(freq > 0) || freq >= sampleRate / 2) return;
  const w = (2 * Math.PI * freq) / sampleRate;
  const r = Math.exp(-1 / (Math.max(tau, 1e-5) * sampleRate));
  const k1 = 2 * r * Math.cos(w);
  const k2 = r * r;
  const a = Math.abs(amp);
  const nStop = a > floor ? Math.ceil(Math.log(floor / a) / Math.log(r)) : 0;
  const s0 = Math.max(0, Math.floor(start));
  const end = Math.min(out.length, s0 + nStop);
  if (end <= s0) return;
  let y2 = 0; // y[-1] relative: sample 0 is 0
  let y1 = amp * r * Math.sin(w); // sample 1
  // sample s0 is exactly 0 so we start writing at s0 + 1
  for (let i = s0 + 1; i < end; i++) {
    out[i] += y1;
    const y = k1 * y1 - k2 * y2;
    y2 = y1;
    y1 = y;
  }
}

/**
 * Damped sinusoid with a smooth attack: amp·(e^{-t/τ} − e^{-t/τa})·sin(ωt).
 * Rendered as the difference of two resonators (cheap and click-free).
 */
export function addSoftDampedSine(
  out: Float32Array | Float64Array,
  start: number,
  freq: number,
  amp: number,
  tau: number,
  attackTau: number,
  sampleRate: number,
  floor = 1e-5,
): void {
  addDampedSine(out, start, freq, amp, tau, sampleRate, floor);
  addDampedSine(out, start, freq, -amp, Math.min(attackTau, tau * 0.5), sampleRate, floor);
}

/**
 * Raised-cosine fade-in over n samples starting at `start` (in place).
 * cos(πi/n) is generated by a rotation recurrence – no Math.cos per sample.
 */
export function fadeIn(buf: Float32Array | Float64Array, n: number, start = 0): void {
  const len = Math.min(n, buf.length - start);
  if (len <= 0) return;
  const d = Math.PI / len;
  const cd = Math.cos(d);
  const sd = Math.sin(d);
  let c = 1; // cos(π·i/len)
  let s = 0;
  for (let i = 0; i < len; i++) {
    buf[start + i] *= 0.5 - 0.5 * c;
    const nc = c * cd - s * sd;
    s = s * cd + c * sd;
    c = nc;
  }
}

/** Raised-cosine fade-out over the last n samples (in place). */
export function fadeOut(buf: Float32Array | Float64Array, n: number): void {
  const len = Math.min(n, buf.length);
  if (len <= 0) return;
  const st = buf.length - len;
  const d = Math.PI / len;
  const cd = Math.cos(d);
  const sd = Math.sin(d);
  let c = cd; // cos(π·(i+1)/len)
  let s = sd;
  for (let i = 0; i < len; i++) {
    buf[st + i] *= 0.5 + 0.5 * c;
    const nc = c * cd - s * sd;
    s = s * cd + c * sd;
    c = nc;
  }
}

export function peakAbs(buf: ArrayLike<number>, from = 0, to = buf.length): number {
  let p = 0;
  for (let i = from; i < to; i++) {
    const a = Math.abs(buf[i]);
    if (a > p) p = a;
  }
  return p;
}

export function rmsRange(buf: ArrayLike<number>, from = 0, to = buf.length): number {
  const a = Math.max(0, from);
  const b = Math.min(buf.length, to);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / (b - a));
}

export function scaleInPlace(buf: Float32Array | Float64Array, g: number): void {
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
}

/** Equal-power pan gains for pan in [-1, 1]. */
export function panGains(pan: number): [number, number] {
  const th = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(th), Math.sin(th)];
}

/** Run several biquads in series over buf[from, to) in ONE pass (in place). */
export function applyBiquadCascade(
  buf: Float32Array | Float64Array,
  stages: readonly BiquadCoeffs[],
  from = 0,
  to = buf.length,
): void {
  const n = stages.length;
  if (n === 0) return;
  const b0 = new Float64Array(n);
  const b1 = new Float64Array(n);
  const b2 = new Float64Array(n);
  const a1 = new Float64Array(n);
  const a2 = new Float64Array(n);
  const z1 = new Float64Array(n);
  const z2 = new Float64Array(n);
  stages.forEach((c, i) => {
    b0[i] = c.b0;
    b1[i] = c.b1;
    b2[i] = c.b2;
    a1[i] = c.a1;
    a2[i] = c.a2;
  });
  for (let i = from; i < to; i++) {
    let x = buf[i];
    for (let s = 0; s < n; s++) {
      const y = b0[s] * x + z1[s];
      z1[s] = b1[s] * x - a1[s] * y + z2[s];
      z2[s] = b2[s] * x - a2[s] * y;
      x = y;
    }
    buf[i] = x;
  }
}

/**
 * A bank of exponentially-damped sinusoids, rendered together.
 *
 * Each resonator uses the recurrence y[n] = 2r·cos(ω)·y[n−1] − r²·y[n−2].
 * Rendering processes resonators four at a time in cache-sized blocks: the
 * four independent recurrences give the CPU instruction-level parallelism and
 * the output block stays in L1, which is 3–4× faster than one-at-a-time
 * loops. This is what keeps a piano note render in the low milliseconds.
 */
export class ResonatorBank {
  private readonly k1: number[] = [];
  private readonly k2: number[] = [];
  private readonly y1: number[] = [];
  private readonly ends: number[] = [];

  get size(): number {
    return this.k1.length;
  }

  /**
   * Add amp·e^{−t/τ}·sin(2πft) starting at sample 0. Rendering of this
   * resonator stops once its envelope is below `floor`.
   */
  add(freq: number, amp: number, tau: number, sampleRate: number, floor = 1e-5): void {
    if (amp === 0 || !(freq > 0) || freq >= sampleRate / 2) return;
    const w = (2 * Math.PI * freq) / sampleRate;
    const r = Math.exp(-1 / (Math.max(tau, 1e-5) * sampleRate));
    const a = Math.abs(amp);
    if (a <= floor) return;
    this.k1.push(2 * r * Math.cos(w));
    this.k2.push(r * r);
    this.y1.push(amp * r * Math.sin(w));
    this.ends.push(Math.ceil(Math.log(floor / a) / Math.log(r)) + 2);
  }

  /** Add every resonator into `out`. */
  renderInto(out: Float32Array): void {
    const n = this.k1.length;
    const len = out.length;
    if (n === 0 || len < 2) return;
    // Group resonators with similar lifetimes so whole groups can stop early.
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => this.ends[b] - this.ends[a]);
    const groups = Math.ceil(n / 4);
    const K1 = new Float64Array(groups * 4);
    const K2 = new Float64Array(groups * 4);
    const Y1 = new Float64Array(groups * 4);
    const Y2 = new Float64Array(groups * 4);
    const gEnd = new Int32Array(groups);
    for (let s = 0; s < n; s++) {
      const i = order[s];
      K1[s] = this.k1[i];
      K2[s] = this.k2[i];
      Y1[s] = this.y1[i];
      const g = s >> 2;
      gEnd[g] = Math.max(gEnd[g], Math.min(len, this.ends[i]));
    }
    const BLOCK = 256;
    for (let b0 = 1; b0 < len; b0 += BLOCK) {
      const b1 = Math.min(len, b0 + BLOCK);
      for (let g = 0; g < groups; g++) {
        const end = gEnd[g];
        if (end <= b0) continue;
        const e = end < b1 ? end : b1;
        const j = g * 4;
        let a1 = Y1[j], a2 = Y2[j];
        let c1 = Y1[j + 1], c2 = Y2[j + 1];
        let d1 = Y1[j + 2], d2 = Y2[j + 2];
        let f1 = Y1[j + 3], f2 = Y2[j + 3];
        const ka = K1[j], la = K2[j];
        const kc = K1[j + 1], lc = K2[j + 1];
        const kd = K1[j + 2], ld = K2[j + 2];
        const kf = K1[j + 3], lf = K2[j + 3];
        for (let i = b0; i < e; i++) {
          out[i] += a1 + c1 + d1 + f1;
          const na = ka * a1 - la * a2;
          a2 = a1;
          a1 = na;
          const nc = kc * c1 - lc * c2;
          c2 = c1;
          c1 = nc;
          const nd = kd * d1 - ld * d2;
          d2 = d1;
          d1 = nd;
          const nf = kf * f1 - lf * f2;
          f2 = f1;
          f1 = nf;
        }
        Y1[j] = a1; Y2[j] = a2;
        Y1[j + 1] = c1; Y2[j + 1] = c2;
        Y1[j + 2] = d1; Y2[j + 2] = d2;
        Y1[j + 3] = f1; Y2[j + 3] = f2;
      }
    }
  }
}
