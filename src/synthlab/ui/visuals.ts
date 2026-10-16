/**
 * What the panel draws, worked out from the patch: a cycle of each oscillator and of the
 * mix, the spectrum the filter acts on, envelope and LFO shapes. Pure functions (no DOM),
 * redrawn only when a knob moves, so the displays cost nothing while music plays.
 *
 * Drawings show the ideal shapes, not the band-limited ones the synth plays: a saw looks
 * like a saw.
 */
import { getFFT } from '../../audio/dsp/fft';
import { envelopeLevel } from '../dsp/env';
import { filterResponse } from '../dsp/filter';
import { ALGORITHMS, FEEDBACK_MAX, clampAlgo, modIndex } from '../dsp/fm';
import { lfoValue } from '../dsp/lfo';
import { type Patch, HARMONIC_KEYS } from '../dsp/params';
import { getTable } from '../dsp/tables';
import { waveShape } from '../dsp/waves';

/** Samples per drawn cycle pair (two cycles of the note). */
export const DRAW_N = 512;

const ratioOf = (oct: number, semi: number, fine: number) => Math.pow(2, oct + semi / 12 + fine / 1200);

/** One oscillator over two cycles (subtractive or wavetable). */
export function oscCycle(p: Patch, which: 1 | 2): Float32Array {
  const out = new Float32Array(DRAW_N);
  const wt = p.engine === 'wavetable';
  for (let i = 0; i < DRAW_N; i++) {
    const ph = (2 * i) / DRAW_N;
    out[i] = wt ? tableValue(p, which, ph) : waveShape(which === 1 ? p.osc1Wave : p.osc2Wave, ph, which === 1 ? p.osc1Pw : p.osc2Pw);
  }
  return out;
}

function tableValue(p: Patch, which: 1 | 2, phase: number): number {
  const t = getTable(which === 1 ? p.osc1Table : p.osc2Table);
  const pos = which === 1 ? p.osc1Pos : p.osc2Pos;
  const frames = t.data[0];
  const fp = Math.min(1, Math.max(0, pos)) * (frames.length - 1);
  const f0 = Math.min(frames.length - 2, Math.floor(fp));
  const ft = fp - f0;
  const N = frames[0].length - 1;
  const x = (phase - Math.floor(phase)) * N;
  const i = Math.floor(x);
  const a = frames[f0][i] + (frames[f0][i + 1] - frames[f0][i]) * (x - i);
  const b = frames[f0 + 1][i] + (frames[f0 + 1][i + 1] - frames[f0 + 1][i]) * (x - i);
  return (a + (b - a) * ft) / 0.9;
}

/**
 * The raw sound before the filter, over two cycles of oscillator 1 (or of the note):
 * what the mixer sends on. Detuning is left out so the picture stands still.
 */
export function sourceCycle(p: Patch): Float32Array {
  const out = new Float32Array(DRAW_N);
  if (p.engine === 'fm') return fmCycle(p);
  if (p.engine === 'additive') return additiveCycle(p);
  const wt = p.engine === 'wavetable';
  const r1 = ratioOf(p.osc1Octave, p.osc1Semi, 0);
  const r2 = ratioOf(p.osc2Octave, p.osc2Semi, 0) / r1;
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 2147483648 - 1;
  };
  for (let i = 0; i < DRAW_N; i++) {
    const ph = (2 * i) / DRAW_N;
    const o1 = wt ? tableValue(p, 1, ph) : waveShape(p.osc1Wave, ph, p.osc1Pw);
    const ph2 = p.osc2Sync ? ph - Math.floor(ph) : ph;
    const o2 = wt ? tableValue(p, 2, ph2 * r2) : waveShape(p.osc2Wave, ph2 * r2, p.osc2Pw);
    let s = o1 * p.osc1Level + o2 * p.osc2Level + o1 * o2 * p.ringLevel;
    if (p.subLevel > 0) s += p.subLevel * (p.subWave === 'square' ? waveShape('square', ph / 2) : Math.sin(Math.PI * ph));
    if (p.noiseLevel > 0) s += p.noiseLevel * 0.6 * rnd();
    out[i] = s;
  }
  return normalise(out);
}

/** FM output over two cycles of the note, operators at full level (envelopes at their peak). */
export function fmCycle(p: Patch): Float32Array {
  const algo = ALGORITHMS[clampAlgo(p.fmAlgo)];
  const ratios = [p.op1Ratio, p.op2Ratio, p.op3Ratio, p.op4Ratio];
  const levels = [p.op1Level, p.op2Level, p.op3Level, p.op4Level];
  const outs = [0, 0, 0, 0];
  let fb1 = 0;
  let fb2 = 0;
  const out = new Float32Array(DRAW_N);
  // run twice through so feedback settles, keep the second pass
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < DRAW_N; i++) {
      const ph = (2 * i) / DRAW_N;
      for (let k = algo.used.length - 1; k >= 0; k--) {
        const o = algo.used[k] - 1;
        let mod = 0;
        for (const [from, to] of algo.links) if (to === o + 1) mod += outs[from - 1] * modIndex(levels[from - 1]);
        if (o === algo.feedback - 1) mod += p.fmFeedback * FEEDBACK_MAX * 0.5 * (fb1 + fb2);
        const v = Math.sin(2 * Math.PI * (ph * ratios[o] + mod));
        outs[o] = v;
        if (o === algo.feedback - 1) {
          fb2 = fb1;
          fb1 = v;
        }
      }
      let s = 0;
      for (const c of algo.carriers) s += outs[c - 1] * levels[c - 1];
      out[i] = s;
    }
  }
  return normalise(out);
}

export function additiveCycle(p: Patch): Float32Array {
  const out = new Float32Array(DRAW_N);
  const levels = additiveLevels(p);
  const stretch = 1 + 0.5 * p.addStretch;
  for (let h = 0; h < 16; h++) {
    if (!levels[h]) continue;
    const m = Math.pow(h + 1, stretch);
    for (let i = 0; i < DRAW_N; i++) out[i] += levels[h] * Math.sin((2 * Math.PI * m * 2 * i) / DRAW_N);
  }
  return normalise(out);
}

/** Harmonic levels after the harmonic filter (at its resting point). */
export function additiveLevels(p: Patch): number[] {
  return HARMONIC_KEYS.map((k, i) => p[k] * Math.min(1, Math.max(0, p.addOpen - (i + 1) + 1)));
}

function normalise(x: Float32Array): Float32Array {
  let peak = 1e-9;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak > 1e-6) for (let i = 0; i < x.length; i++) x[i] /= peak;
  return x;
}

/**
 * Harmonic magnitudes (0..1, peak 1) of two drawn cycles: index k is the k-th half-harmonic
 * (2 = the fundamental, 1 = a sub an octave down).
 */
export function halfHarmonics(cycle2: Float32Array, count = 64): Float32Array {
  const N = cycle2.length;
  const fft = getFFT(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = cycle2[i];
  fft.transform(re, im);
  const out = new Float32Array(count + 1);
  let peak = 1e-9;
  for (let k = 1; k <= count && k < N / 2; k++) {
    out[k] = Math.hypot(re[k], im[k]);
    peak = Math.max(peak, out[k]);
  }
  for (let k = 1; k <= count; k++) out[k] /= peak;
  return out;
}

/** The frequency the drawings assume for the note (C3), so the filter curve lines up with real harmonics. */
export const DRAW_ROOT_HZ = 130.81;

/** Filter response (dB) at `freq`, or 0 when the filter is off. */
export function filterDb(p: Patch, freq: number): number {
  if (!p.filterOn) return 0;
  const cutoff = p.filterCutoff * Math.pow(2, (p.filterKey * (48 - 60)) / 12);
  const g = filterResponse(p.filterType, p.filterSlope, Math.min(18000, Math.max(20, cutoff)), p.filterRes, freq);
  return 20 * Math.log10(Math.max(1e-6, g));
}

/** Points [x 0..1, level 0..1] of an ADSR drawn Serum-style: each stage gets room in proportion to its time (square-rooted). */
export function envelopePoints(a: number, d: number, s: number, r: number, steps = 24): { pts: [number, number][]; marks: number[] } {
  const w = (t: number) => 0.06 + 0.32 * Math.sqrt(Math.min(10, Math.max(0, t)) / 10);
  const wa = w(a);
  const wd = w(d);
  const ws = 0.22;
  const wr = w(r);
  const total = wa + wd + ws + wr;
  const pts: [number, number][] = [];
  const hold = a + d * 2.2;
  // attack and decay, sampled along each stage's own time
  for (let i = 0; i <= steps; i++) {
    const t = (a * i) / steps;
    pts.push([(wa * i) / steps / total, envelopeLevel(a, d, s, r, hold + 10, t)]);
  }
  for (let i = 1; i <= steps; i++) {
    const t = a + (d * 1.6 * i) / steps;
    pts.push([(wa + (wd * i) / steps) / total, envelopeLevel(a, d, s, r, hold + 10, t)]);
  }
  const sLevel = envelopeLevel(a, d, s, r, hold + 10, a + d * 1.6);
  pts.push([(wa + wd + ws) / total, sLevel]);
  for (let i = 1; i <= steps; i++) {
    const t = (r * 1.6 * i) / steps;
    pts.push([(wa + wd + ws + (wr * i) / steps) / total, sLevel * Math.exp((-t * 5) / Math.max(0.0005, r))]);
  }
  return { pts, marks: [wa / total, (wa + wd) / total, (wa + wd + ws) / total, 1] };
}

/** Two cycles of the LFO's shape (random: a fixed staircase). */
export function lfoPoints(p: Patch, n = 160): [number, number][] {
  const held = [0.6, -0.3, 0.9, -0.8, 0.1, -0.5];
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const ph = (2 * i) / n;
    const v = p.lfoShape === 'random' ? held[Math.min(held.length - 1, Math.floor(ph * 2))] : lfoValue(p.lfoShape, ph);
    pts.push([i / n, v]);
  }
  return pts;
}

/** An SVG path through points already in pixel space. */
export function pathOf(pts: ArrayLike<[number, number]> | [number, number][]): string {
  let d = '';
  const arr = pts as [number, number][];
  for (let i = 0; i < arr.length; i++) d += `${i ? 'L' : 'M'}${arr[i][0].toFixed(1)},${arr[i][1].toFixed(1)}`;
  return d;
}

/** A cycle buffer as an SVG path in a w×h box (values −1..1). */
export function wavePath(x: Float32Array, w: number, h: number, pad = 4): string {
  const pts: [number, number][] = [];
  const mid = h / 2;
  const amp = h / 2 - pad;
  for (let i = 0; i < x.length; i++) pts.push([(i / (x.length - 1)) * w, mid - x[i] * amp]);
  return pathOf(pts);
}
