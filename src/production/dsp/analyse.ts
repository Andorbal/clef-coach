/**
 * What a mix sounds like, measured: for every channel, how loud it sits (K-weighted, the
 * way loudness meters hear), the shape of its spectrum in third octaves, how much its level
 * moves (dynamics), and where it sits (pan, reverb and delay sends); for the whole mix, its
 * loudness and peaks.
 *
 * The mix is rendered offline with the same Mixer the console plays, so what's measured
 * is exactly what's heard. A couple of seconds of the loop's end play first, so the
 * compressors have settled and the reverb is already ringing when the measured pass starts,
 * as it would be the second time round.
 */
import { biquadCoeffs } from '../../audio/dsp/util';
import { getFFT } from '../../audio/dsp/fft';
import { Biquad } from './blocks';
import { Mixer } from './mixer';
import { type Mix, SILENT_DB } from './params';

export interface ChannelFeatures {
  /** Loudness over the loop (LUFS-like, K-weighted, ungated); −∞ when silent. */
  loud: number;
  /** Spectrum shape: third-octave band levels (dB) relative to the loudest band. */
  bands: Float32Array;
  /** How much the level moves: the loudness-weighted spread (dB) of its 100 ms windows. */
  range: number;
  /** Peak over RMS (dB) of the playing parts: sharp transients make it high. */
  crest: number;
  /** Peak into the strip after the trim (dBFS). */
  input: number;
}

export interface MixFeatures {
  channels: Record<string, ChannelFeatures>;
  master: { loud: number; peak: number; clipped: boolean; range: number; crest: number };
  mix: Mix;
}

/** Third-octave band centres, 40 Hz to 16 kHz. */
export const BAND_FREQS: readonly number[] = Array.from({ length: 27 }, (_, i) => 40 * Math.pow(2, i / 3));

const FFT_SIZE = 4096;
const HANN = Float64Array.from({ length: FFT_SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE));

const db = (p: number) => (p > 1e-12 ? 10 * Math.log10(p) : -120);

/** Mean square after K-weighting (BS.1770's shelf and low cut). */
function kWeightedPower(x: Float32Array, sr: number): Float32Array {
  const y = x.slice();
  const shelf = new Biquad();
  shelf.set(biquadCoeffs('highshelf', 1500, Math.SQRT1_2, 4, sr));
  const hp = new Biquad();
  hp.set(biquadCoeffs('highpass', 38, 0.5, 0, sr));
  shelf.process(y, y.length);
  hp.process(y, y.length);
  for (let i = 0; i < y.length; i++) y[i] *= y[i];
  return y;
}

/** Levels (dB) of 100 ms windows. */
function windows(pow: Float32Array, sr: number): number[] {
  const w = Math.round(0.1 * sr);
  const out: number[] = [];
  for (let s = 0; s + w <= pow.length; s += w) {
    let sum = 0;
    for (let i = s; i < s + w; i++) sum += pow[i];
    out.push(db(sum / w));
  }
  return out;
}

/**
 * Dynamics of a signal: how much its level moves, and its crest factor.
 *
 * The movement is the spread of 100 ms window levels, each window weighted by its
 * loudness (as amplitude): the notes and hits count, the tails between them hardly do.
 * A gate and percentiles did the same job but jumped as windows crossed the gate (a
 * snare's attack moved 3 ms and its reading by 2 dB).
 */
function dynamics(x: Float32Array, sr: number): { range: number; crest: number } {
  const sq = new Float32Array(x.length);
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    sq[i] = x[i] * x[i];
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
  }
  const win = windows(sq, sr);
  const top = Math.max(...win);
  let sw = 0;
  let sl = 0;
  let sp = 0;
  for (const v of win) {
    if (v < top - 60) continue;
    const w = Math.pow(10, (v - top) / 20);
    sw += w;
    sl += w * v;
    sp += w * Math.pow(10, v / 10);
  }
  const mean = sw > 0 ? sl / sw : 0;
  let sv = 0;
  for (const v of win) {
    if (v < top - 60) continue;
    sv += Math.pow(10, (v - top) / 20) * (v - mean) ** 2;
  }
  // twice the standard deviation: about the spread from the quieter notes to the louder
  return { range: sw > 0 ? 2 * Math.sqrt(sv / sw) : 0, crest: peak > 0 && sp > 0 ? 20 * Math.log10(peak) - db(sp / sw) : 0 };
}

/** Third-octave spectrum shape (dB relative to its loudest band). */
export function bandShape(x: Float32Array, sr: number): Float32Array {
  const fft = getFFT(FFT_SIZE);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const power = new Float64Array(FFT_SIZE / 2);
  let frames = 0;
  for (let s = 0; s + FFT_SIZE <= x.length; s += FFT_SIZE) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = x[s + i] * HANN[i];
      im[i] = 0;
    }
    fft.transform(re, im);
    for (let k = 0; k < FFT_SIZE / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  const bands = new Float32Array(BAND_FREQS.length);
  const binHz = sr / FFT_SIZE;
  for (let b = 0; b < BAND_FREQS.length; b++) {
    const lo = BAND_FREQS[b] / Math.pow(2, 1 / 6);
    const hi = BAND_FREQS[b] * Math.pow(2, 1 / 6);
    let sum = 0;
    for (let k = Math.max(1, Math.floor(lo / binHz)); k <= Math.min(FFT_SIZE / 2 - 1, Math.ceil(hi / binHz)); k++) {
      const f = k * binHz;
      if (f >= lo && f < hi) sum += power[k];
    }
    bands[b] = db(sum / Math.max(1, frames));
  }
  const top = Math.max(...bands);
  for (let b = 0; b < bands.length; b++) bands[b] = Math.max(-60, bands[b] - top);
  return bands;
}

export interface RenderedMix {
  left: Float32Array;
  right: Float32Array;
  channels: Record<string, Float32Array>;
  input: Record<string, number>;
  sampleRate: number;
}

/** Seconds of the loop's end played first, so compressors and reverb are settled. */
const WARM = 2;

/** One pass of the loop through the console, with every channel's output captured. */
export function renderMix(stems: Record<string, Float32Array>, channels: readonly string[], mix: Mix, sr: number, tempo: number): RenderedMix {
  const m = new Mixer(sr, channels);
  m.tempo = tempo;
  m.setStems(stems);
  m.setMix(mix);
  const n = stems[channels[0]]?.length ?? 0;
  const warm = Math.min(n - 1, Math.round(WARM * sr));
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  m.play(n ? (n - warm) / n : 0);
  if (warm > 0) {
    const scratchL = new Float32Array(warm);
    const scratchR = new Float32Array(warm);
    m.render(scratchL, scratchR, warm);
  }
  m.meters();
  const cap = m.startCapture(n);
  m.render(left, right, n);
  const meters = m.meters();
  const input: Record<string, number> = {};
  for (const c of channels) input[c] = meters.channels[c]?.input ?? 0;
  return { left, right, channels: cap, input, sampleRate: sr };
}

/** Measure a rendered mix. */
export function analyseMix(r: RenderedMix, mix: Mix): MixFeatures {
  const sr = r.sampleRate;
  const channels: Record<string, ChannelFeatures> = {};
  for (const [id, x] of Object.entries(r.channels)) {
    const kp = kWeightedPower(x, sr);
    let sum = 0;
    for (let i = 0; i < kp.length; i++) sum += kp[i];
    const silent = sum < 1e-10;
    const d = silent ? { range: 0, crest: 0 } : dynamics(x, sr);
    channels[id] = {
      loud: silent ? -Infinity : -0.691 + db(sum / kp.length),
      bands: silent ? new Float32Array(BAND_FREQS.length).fill(-60) : bandShape(x, sr),
      range: d.range,
      crest: d.crest,
      input: r.input[id] > 0 ? 20 * Math.log10(r.input[id]) : -Infinity,
    };
  }
  const kl = kWeightedPower(r.left, sr);
  const kr = kWeightedPower(r.right, sr);
  let sum = 0;
  let peak = 0;
  const monoMix = new Float32Array(r.left.length);
  for (let i = 0; i < kl.length; i++) {
    sum += kl[i] + kr[i];
    peak = Math.max(peak, Math.abs(r.left[i]), Math.abs(r.right[i]));
    monoMix[i] = 0.5 * (r.left[i] + r.right[i]);
  }
  const d = dynamics(monoMix, sr);
  return {
    channels,
    master: { loud: sum > 1e-10 ? -0.691 + db(sum / kl.length) : -Infinity, peak: peak > 0 ? 20 * Math.log10(peak) : -Infinity, clipped: peak > 1, range: d.range, crest: d.crest },
    mix,
  };
}

/** A send's level as heard against its own channel (send + return, dB); −∞ when off. */
export function wetLevel(mix: Mix, ch: string, fx: 'reverb' | 'delay'): number {
  const send = mix[`${ch}:${fx}`] ?? SILENT_DB;
  const ret = mix[`fx:${fx}Level`] ?? 0;
  if (send <= SILENT_DB || ret <= SILENT_DB) return -Infinity;
  return send + ret;
}
