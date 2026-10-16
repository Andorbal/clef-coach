/**
 * Wavetables: each is a row of single-cycle waves ("frames") that a wavetable oscillator
 * morphs through as its position moves, the way Serum, Vital and friends work.
 *
 * Every table is made here from a recipe rather than shipped as audio: a recipe draws a
 * frame (a function of phase) for a position 0..1. Each frame is then measured (FFT) and
 * rebuilt at several sizes of harmonic content, one per octave (mipmaps), so a high note
 * reads a frame without the harmonics that would fold back as aliasing. Frames are
 * 512 samples, which holds up to 255 harmonics; 128 is plenty for a 60 Hz note.
 *
 * Tables are built on first use (about a millisecond each).
 */
import { getFFT } from '../../audio/dsp/fft';
import type { TableId } from './params';

export const FRAME_SIZE = 512;
export const FRAMES = 16;
/** Harmonic limit of each mip level: 128, 64 … 1. */
const LEVELS = [128, 64, 32, 16, 8, 4, 2, 1];

export interface Wavetable {
  id: TableId;
  /** [level][frame] → FRAME_SIZE + 1 samples (the last repeats the first, for interpolation). */
  data: Float32Array[][];
}

type Recipe = (pos: number, phase: number) => number;

const TAU = 2 * Math.PI;
const frac = (x: number) => x - Math.floor(x);

/** Spectral recipe: harmonic amplitudes for a position (sine phase). */
type SpectralRecipe = (pos: number, n: number) => number;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sine → triangle → saw → square, the classic shapes in a row. */
const basic: SpectralRecipe = (pos, n) => {
  const shapes = [
    (k: number) => (k === 1 ? 1 : 0),
    (k: number) => (k % 2 ? (((k - 1) / 2) % 2 ? -1 : 1) * (8 / (Math.PI * Math.PI * k * k)) : 0),
    (k: number) => ((k % 2 ? 1 : -1) * 2) / (Math.PI * k),
    (k: number) => (k % 2 ? (4 / (Math.PI * k)) * 0.8 : 0),
  ];
  const x = pos * 3;
  const i = Math.min(2, Math.floor(x));
  return lerp(shapes[i](n), shapes[i + 1](n), x - i);
};

/** Harmonics added one by one over a sawtooth's slope. */
const harmonic: SpectralRecipe = (pos, n) => {
  const count = 1 + pos * 47;
  const g = Math.min(1, Math.max(0, count - n + 1));
  return (g * 1) / n;
};

/** Vowel formants (oo → oh → ah → eh → ee), measured on a 130 Hz voice. */
const VOWELS = [
  [300, 870, 2240],
  [500, 900, 2400],
  [750, 1180, 2600],
  [550, 1770, 2490],
  [280, 2250, 2900],
];
const vowel: SpectralRecipe = (pos, n) => {
  const x = pos * (VOWELS.length - 1);
  const i = Math.min(VOWELS.length - 2, Math.floor(x));
  const t = x - i;
  const f = n * 130;
  let a = 0;
  for (let k = 0; k < 3; k++) {
    const fc = lerp(VOWELS[i][k], VOWELS[i + 1][k], t);
    const bw = 80 + fc * 0.08;
    const gain = k === 0 ? 1 : k === 1 ? 0.6 : 0.3;
    a += gain * Math.exp(-0.5 * ((f - fc) / bw) ** 2);
  }
  // a little of the glottal saw underneath so low harmonics never vanish
  return a + 0.08 / n;
};

/** A pulse narrowing from square (50%) to a thin 4% pulse. */
const pwm: Recipe = (pos, ph) => {
  const w = lerp(0.5, 0.04, pos);
  return ph < w ? 1 : -1;
};

/** Phase modulation getting deeper: from a sine to a metallic, digital buzz. */
const metal: Recipe = (pos, ph) => Math.sin(TAU * ph + pos * 7 * Math.sin(TAU * 3 * ph) + pos * 2 * Math.sin(TAU * 7 * ph));

/** A hard-synced saw: the classic "sync sweep" from a plain saw to a ripping lead. */
const sync: Recipe = (pos, ph) => {
  const ratio = 1 + pos * 5;
  return 2 * frac(ph * ratio) - 1;
};

const RECIPES: Record<TableId, { time?: Recipe; spectral?: SpectralRecipe }> = {
  basic: { spectral: basic },
  pwm: { time: pwm },
  harmonic: { spectral: harmonic },
  vowel: { spectral: vowel },
  metal: { time: metal },
  sync: { time: sync },
};

/** A frame's harmonic spectrum (re, im per harmonic 0..128) from its recipe. */
function frameSpectrum(id: TableId, pos: number): { re: Float64Array; im: Float64Array } {
  const H = LEVELS[0];
  const re = new Float64Array(H + 1);
  const im = new Float64Array(H + 1);
  const r = RECIPES[id];
  if (r.spectral) {
    // sine series: x(φ) = Σ a_n sin(2πnφ)  →  im = −a_n·N/2 in an FFT's terms; kept as amplitudes here
    for (let n = 1; n <= H; n++) im[n] = -r.spectral(pos, n);
    return { re, im };
  }
  // draw the frame big, then measure it (the drawing's own aliasing lands above harmonic 128)
  const N = 4096;
  const fft = getFFT(N);
  const xr = new Float64Array(N);
  const xi = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) {
    xr[i] = r.time!(pos, i / N);
    mean += xr[i];
  }
  mean /= N;
  for (let i = 0; i < N; i++) xr[i] -= mean;
  fft.transform(xr, xi);
  for (let n = 1; n <= H; n++) {
    re[n] = (2 * xr[n]) / N;
    im[n] = (2 * xi[n]) / N;
  }
  return { re, im };
}

const cache = new Map<TableId, Wavetable>();

/** A table, built the first time it's asked for. */
export function getTable(id: TableId): Wavetable {
  const hit = cache.get(id);
  if (hit) return hit;
  const fft = getFFT(FRAME_SIZE);
  const spectra = Array.from({ length: FRAMES }, (_, f) => frameSpectrum(id, f / (FRAMES - 1)));
  // one gain per frame (from the full-bandwidth level) so mip levels match in loudness
  const data: Float32Array[][] = LEVELS.map(() => []);
  const gains: number[] = [];
  LEVELS.forEach((limit, li) => {
    spectra.forEach((s, fi) => {
      const xr = new Float64Array(FRAME_SIZE);
      const xi = new Float64Array(FRAME_SIZE);
      for (let n = 1; n <= limit; n++) {
        // amplitude form (a·cos + b·sin) → bins n and N−n of an inverse FFT
        xr[n] = s.re[n] / 2;
        xi[n] = s.im[n] / 2;
        xr[FRAME_SIZE - n] = s.re[n] / 2;
        xi[FRAME_SIZE - n] = -s.im[n] / 2;
      }
      fft.transform(xr, xi, true);
      if (li === 0) {
        let peak = 1e-9;
        for (let i = 0; i < FRAME_SIZE; i++) peak = Math.max(peak, Math.abs(xr[i]));
        gains[fi] = 0.9 / peak;
      }
      const out = new Float32Array(FRAME_SIZE + 1);
      for (let i = 0; i < FRAME_SIZE; i++) out[i] = xr[i] * gains[fi];
      out[FRAME_SIZE] = out[0];
      data[li][fi] = out;
    });
  });
  const table: Wavetable = { id, data };
  cache.set(id, table);
  return table;
}

/** The mip level to read for a note: the most harmonics that stay under `maxFreq`. */
export function tableLevel(freq: number, maxFreq: number): number {
  const allowed = maxFreq / Math.max(1, freq);
  for (let l = 0; l < LEVELS.length; l++) if (LEVELS[l] <= allowed) return l;
  return LEVELS.length - 1;
}

/** One sample of a table at a phase and a position (both 0..1). */
export function tableSample(t: Wavetable, level: number, pos: number, phase: number): number {
  const frames = t.data[level];
  const fp = Math.min(1, Math.max(0, pos)) * (FRAMES - 1);
  const f0 = Math.min(FRAMES - 2, fp | 0);
  const ft = fp - f0;
  const p = (phase - Math.floor(phase)) * FRAME_SIZE;
  const i = p | 0;
  const pf = p - i;
  const a = frames[f0];
  const b = frames[f0 + 1];
  const va = a[i] + (a[i + 1] - a[i]) * pf;
  const vb = b[i] + (b[i + 1] - b[i]) * pf;
  return va + (vb - va) * ft;
}

/** Harmonic magnitudes of a table position (for the spectrum drawing), 1-based. */
export function tableHarmonics(id: TableId, pos: number, count: number): number[] {
  const s = frameSpectrum(id, Math.min(1, Math.max(0, pos)));
  const out = new Array<number>(count + 1).fill(0);
  let peak = 1e-9;
  for (let n = 1; n <= count && n < s.re.length; n++) {
    out[n] = Math.hypot(s.re[n], s.im[n]);
    peak = Math.max(peak, out[n]);
  }
  return out.map(v => v / peak);
}
