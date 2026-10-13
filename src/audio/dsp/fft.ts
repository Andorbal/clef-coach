/**
 * Minimal, allocation-free radix-2 complex FFT.
 *
 * Pure TypeScript (no DOM / Web Audio) so it can be used by the offline
 * renderers, the pitch detector and the unit tests alike. Instances are cached
 * per size via {@link getFFT}; twiddle factors and the bit-reversal table are
 * computed once.
 */
export class FFT {
  readonly size: number;
  private readonly rev: Uint32Array;
  private readonly cosT: Float64Array;
  private readonly sinT: Float64Array;

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
    const half = size >> 1;
    this.cosT = new Float64Array(half);
    this.sinT = new Float64Array(half);
    for (let i = 0; i < half; i++) {
      const a = (-2 * Math.PI * i) / size;
      this.cosT[i] = Math.cos(a);
      this.sinT[i] = Math.sin(a);
    }
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
    const cosT = this.cosT;
    const sinT = this.sinT;
    const sgn = inverse ? -1 : 1;
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0, k = 0; j < halfLen; j++, k += step) {
          const wr = cosT[k];
          const wi = sgn * sinT[k];
          const a = i + j;
          const b = a + halfLen;
          const br = re[b];
          const bi = im[b];
          const xr = br * wr - bi * wi;
          const xi = br * wi + bi * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
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
