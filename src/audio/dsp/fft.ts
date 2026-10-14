/**
 * Minimal, allocation-free complex FFT (radix-4, with one radix-2 pass when
 * the size is an odd power of two).
 *
 * Pure TypeScript (no DOM / Web Audio) so it can be used by the offline
 * renderers, the pitch detector and the unit tests alike. Instances are cached
 * per size via {@link getFFT}; twiddle factors and the bit-reversal table are
 * computed once.
 *
 * The microphone runs a few of these per analysis frame, ~55 times a second,
 * so this is the hottest loop in the app. Radix-4 butterflies need three
 * complex multiplications per four outputs instead of radix-2's four, and
 * walk the arrays half as many times; each stage's twiddles are stored
 * contiguously in the order the inner loop reads them.
 */
export class FFT {
  readonly size: number;
  private readonly rev: Uint32Array;
  /** Odd power of two: a radix-2 pass runs first. */
  private readonly radix2First: boolean;
  /** Quarter length (q) of each radix-4 stage, smallest first. */
  private readonly quarters: number[] = [];
  /** Offset of each stage's twiddles in {@link tw}. */
  private readonly offsets: number[] = [];
  /** Per stage and j: w^j, w^2j, w^3j (re, im interleaved) with w = e^(−2πi/4q). */
  private readonly tw: Float64Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of two (got ${size})`);
    }
    this.size = size;
    const bits = Math.round(Math.log2(size));
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0, x = i; b < bits; b++, x >>= 1) r = (r << 1) | (x & 1);
      this.rev[i] = r;
    }
    this.radix2First = bits % 2 === 1;
    let total = 0;
    for (let q = this.radix2First ? 2 : 1; q * 4 <= size; q *= 4) {
      this.quarters.push(q);
      this.offsets.push(total);
      total += 6 * q;
    }
    this.tw = new Float64Array(total);
    this.quarters.forEach((q, s) => {
      for (let j = 0, t = this.offsets[s]; j < q; j++, t += 6) {
        const a = (-2 * Math.PI * j) / (4 * q);
        this.tw[t] = Math.cos(a);
        this.tw[t + 1] = Math.sin(a);
        this.tw[t + 2] = Math.cos(2 * a);
        this.tw[t + 3] = Math.sin(2 * a);
        this.tw[t + 4] = Math.cos(3 * a);
        this.tw[t + 5] = Math.sin(3 * a);
      }
    });
  }

  /**
   * In-place transform of (re, im). Forward uses e^{-iωn}; `inverse` uses
   * e^{+iωn} and is NOT scaled by 1/N (callers scale as needed).
   */
  transform(re: Float64Array, im: Float64Array, inverse = false): void {
    const n = this.size;
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    if (this.radix2First) {
      for (let a = 0; a < n; a += 2) {
        const b = a + 1;
        const br = re[b];
        const bi = im[b];
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
      }
    }
    // Inverse: conjugate twiddles, and ±i swap places.
    const s = inverse ? -1 : 1;
    const tw = this.tw;
    for (let st = 0; st < this.quarters.length; st++) {
      const q = this.quarters[st];
      const len = 4 * q;
      if (q === 1) {
        // all twiddles are 1
        for (let p0 = 0; p0 < n; p0 += 4) {
          const p1 = p0 + 1;
          const p2 = p0 + 2;
          const p3 = p0 + 3;
          const t0r = re[p0] + re[p1];
          const t0i = im[p0] + im[p1];
          const t1r = re[p0] - re[p1];
          const t1i = im[p0] - im[p1];
          const t2r = re[p2] + re[p3];
          const t2i = im[p2] + im[p3];
          const t3r = re[p2] - re[p3];
          const t3i = im[p2] - im[p3];
          re[p0] = t0r + t2r;
          im[p0] = t0i + t2i;
          re[p2] = t0r - t2r;
          im[p2] = t0i - t2i;
          re[p1] = t1r + s * t3i;
          im[p1] = t1i - s * t3r;
          re[p3] = t1r - s * t3i;
          im[p3] = t1i + s * t3r;
        }
        continue;
      }
      const off = this.offsets[st];
      for (let i = 0; i < n; i += len) {
        for (let j = 0, t = off; j < q; j++, t += 6) {
          const w1r = tw[t];
          const w1i = s * tw[t + 1];
          const w2r = tw[t + 2];
          const w2i = s * tw[t + 3];
          const w3r = tw[t + 4];
          const w3i = s * tw[t + 5];
          const p0 = i + j;
          const p1 = p0 + q;
          const p2 = p1 + q;
          const p3 = p2 + q;
          // Bit-reversed order: the four quarters hold the DFTs of x[4m], x[4m+2], x[4m+1], x[4m+3].
          const ar = re[p0];
          const ai = im[p0];
          let xr = re[p1];
          let xi = im[p1];
          const br = xr * w2r - xi * w2i;
          const bi = xr * w2i + xi * w2r;
          xr = re[p2];
          xi = im[p2];
          const cr = xr * w1r - xi * w1i;
          const ci = xr * w1i + xi * w1r;
          xr = re[p3];
          xi = im[p3];
          const dr = xr * w3r - xi * w3i;
          const di = xr * w3i + xi * w3r;
          const t0r = ar + br;
          const t0i = ai + bi;
          const t1r = ar - br;
          const t1i = ai - bi;
          const t2r = cr + dr;
          const t2i = ci + di;
          const t3r = cr - dr;
          const t3i = ci - di;
          re[p0] = t0r + t2r;
          im[p0] = t0i + t2i;
          re[p2] = t0r - t2r;
          im[p2] = t0i - t2i;
          re[p1] = t1r + s * t3i;
          im[p1] = t1i - s * t3r;
          re[p3] = t1r - s * t3i;
          im[p3] = t1i + s * t3r;
        }
      }
    }
  }
}

const fftCache = new Map<number, FFT>();

/** Shared FFT instance for a power-of-two size. */
export function getFFT(size: number): FFT {
  let f = fftCache.get(size);
  if (!f) {
    f = new FFT(size);
    fftCache.set(size, f);
  }
  return f;
}

/** Smallest power of two >= n (n >= 1). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
