/**
 * How close is one sound to another? The quizzes ask a learner to rebuild a sound by ear,
 * and "close enough" has to mean what an ear would say, not that every knob sits on the
 * same number: two patches that sound alike should score alike even when their settings
 * differ (a long decay doesn't matter once sustain is full), and a near miss should pass.
 *
 * So both sounds are rendered (the same phrase, the same seed) and compared as sound, on
 * four things a listener notices, each scored 0..1:
 *
 * - **Pitch**: the note it plays (median offset, in cents). Skipped for unpitched targets.
 * - **Tone**: the colour of the sound — its spectrum in third-octave bands, frame by
 *   frame, each frame normalised so this is about timbre, not loudness.
 * - **Shape**: loudness over time — the contour of the note (decay, release) compared as
 *   loudness relative to the peak, so a quiet dip matters less than the body of the
 *   note; the attack time measured on its own (a 5 ms against a 60 ms attack barely
 *   moves an average but is the difference between a pluck and a bowed note); and the
 *   overall level.
 * - **Movement**: wobble from an LFO — depth and speed of the pitch, loudness and
 *   brightness modulation, compared without regard to phase so a vibrato a shade faster
 *   isn't marked as wrong on every frame. Only judged when either sound moves.
 *
 * The overall score is a weighted geometric mean, so one aspect far off pulls it down
 * hard. The aspect scores are shown to the learner too: "your shape is off" is a fair
 * hint that says where to look without saying which knob.
 */
import { getFFT } from '../../audio/dsp/fft';
import { detectPitch } from '../../audio/input/yin';

export const ANALYSIS_RATE = 32000;
/** Mean loudness difference (share of the peak) at which the contour score falls to 1/e. */
const CONTOUR_SCALE = 0.07;

const HOP_L = 256;
const WIN_L = 512;
const HOP_S = 512;
const WIN_S = 1024;
const HOP_P = 768;
const WIN_P = 2048;

const BAND_LO = 50;
const BANDS = 24; // third octaves from 50 Hz to ~12.7 kHz

export interface Features {
  /** Loudness per HOP_L frame, dB. */
  loud: Float32Array;
  /** Normalised band levels per HOP_S frame (dB relative to the frame). */
  bands: Float32Array[];
  /** Frame level per HOP_S frame, dB. */
  bandFrameDb: Float32Array;
  /** Spectral centroid per HOP_S frame, in semitones (log frequency). */
  centroid: Float32Array;
  /** Pitch per HOP_P frame as a MIDI number (NaN when there's no clear pitch). */
  pitch: Float32Array;
  /** How periodic each pitch frame is (YIN clarity, 0..1). */
  clarity: Float32Array;
  sampleRate: number;
  /** Seconds the phrase holds its (first) note: where "held" motion is measured. */
  held: [number, number];
}

const db = (power: number) => 10 * Math.log10(power + 1e-12);

let bandEdges: Int32Array | null = null;
function edges(): Int32Array {
  if (bandEdges) return bandEdges;
  const e = new Int32Array(BANDS + 1);
  for (let b = 0; b <= BANDS; b++) {
    const f = BAND_LO * Math.pow(2, b / 3);
    e[b] = Math.max(1, Math.round((f * WIN_S) / ANALYSIS_RATE));
  }
  return (bandEdges = e);
}

const HANN_S = Float64Array.from({ length: WIN_S }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN_S));

/** Measure a mono sound (at ANALYSIS_RATE). `held` = [start, end] seconds of the main note. */
export function analyse(x: Float32Array, held: [number, number] = [0, 1]): Features {
  const sr = ANALYSIS_RATE;
  // loudness
  const nL = Math.max(1, Math.floor((x.length - WIN_L) / HOP_L) + 1);
  const loud = new Float32Array(nL);
  for (let f = 0; f < nL; f++) {
    let s = 0;
    const o = f * HOP_L;
    for (let i = 0; i < WIN_L; i++) {
      const v = x[o + i] ?? 0;
      s += v * v;
    }
    loud[f] = db(s / WIN_L);
  }
  // spectrum
  const nS = Math.max(1, Math.floor((x.length - WIN_S) / HOP_S) + 1);
  const bands: Float32Array[] = [];
  const bandFrameDb = new Float32Array(nS);
  const centroid = new Float32Array(nS);
  const fft = getFFT(WIN_S);
  const re = new Float64Array(WIN_S);
  const im = new Float64Array(WIN_S);
  const e = edges();
  const half = WIN_S / 2;
  for (let f = 0; f < nS; f++) {
    const o = f * HOP_S;
    for (let i = 0; i < WIN_S; i++) {
      re[i] = (x[o + i] ?? 0) * HANN_S[i];
      im[i] = 0;
    }
    fft.transform(re, im);
    let total = 0;
    let num = 0;
    const pow = new Float64Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      let s = 0;
      const lo = e[b];
      const hi = Math.max(lo + 1, e[b + 1]);
      for (let k = lo; k < hi && k < half; k++) s += re[k] * re[k] + im[k] * im[k];
      pow[b] = s;
      total += s;
    }
    for (let k = 1; k < half; k++) num += (re[k] * re[k] + im[k] * im[k]) * Math.log2((k * sr) / WIN_S);
    let all = 0;
    for (let k = 1; k < half; k++) all += re[k] * re[k] + im[k] * im[k];
    centroid[f] = all > 1e-12 ? (num / all) * 12 : 0;
    const frameDb = db(total);
    bandFrameDb[f] = frameDb;
    const v = new Float32Array(BANDS);
    let max = -Infinity;
    for (let b = 0; b < BANDS; b++) {
      v[b] = db(pow[b]) - frameDb;
      max = Math.max(max, v[b]);
    }
    // bands far below the strongest one all count as "nothing there"
    for (let b = 0; b < BANDS; b++) v[b] = Math.max(v[b], max - 50);
    bands.push(v);
  }
  // pitch
  const nP = Math.max(1, Math.floor((x.length - WIN_P) / HOP_P) + 1);
  const pitch = new Float32Array(nP);
  const clarity = new Float32Array(nP);
  for (let f = 0; f < nP; f++) {
    const o = f * HOP_P;
    const frame = x.subarray(o, o + WIN_P);
    const r = frame.length === WIN_P ? detectPitch(frame, sr, { minFreq: 40, maxFreq: 2400, minRms: 3e-4 }) : null;
    pitch[f] = r && r.clarity > 0.6 ? 69 + 12 * Math.log2(r.freq / 440) : NaN;
    clarity[f] = r?.clarity ?? 0;
  }
  return { loud, bands, bandFrameDb, centroid, pitch, clarity, sampleRate: sr, held };
}

export interface MatchResult {
  /** 0..1, what passes or fails a quiz. */
  overall: number;
  pitch: number | null;
  tone: number;
  shape: number;
  movement: number | null;
  /** Diagnostics for hints and tests. */
  detail: {
    pitchCents: number | null;
    /** Tone distance (0 = same colour, 1 = nothing in common). */
    toneDist: number;
    /** Mean loudness difference over the sounding frames, as a share of the peak (0..1). */
    contour: number;
    levelDb: number;
    attackRatio: number;
    motion: { what: 'pitch' | 'loudness' | 'brightness'; target: Motion; mine: Motion }[];
  };
}

export interface Motion {
  depth: number;
  rate: number;
  /** How regular the wobble is (0..1): an LFO is regular, the beating of many detuned voices isn't. */
  regular: number;
}

function smooth(x: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - radius); k <= Math.min(x.length - 1, i + radius); k++) {
      s += x[k];
      n++;
    }
    out[i] = s / n;
  }
  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

/**
 * Time (s) from the onset to within 4 dB of the first peak. The first peak is where the
 * loudness stops rising (falls 3 dB below its running maximum), so a wobble later in the
 * note or a slow beating can't be mistaken for a slow attack.
 */
function attackTime(loud: Float32Array, peak: number): number {
  const fr = HOP_L / ANALYSIS_RATE;
  let onset = -1;
  for (let i = 0; i < loud.length; i++) {
    if (loud[i] > peak - 45) {
      onset = i;
      break;
    }
  }
  if (onset < 0) return 0;
  const end = Math.min(loud.length, onset + Math.round(2 / fr));
  let top = -Infinity;
  let last = onset;
  for (let i = onset; i < end; i++) {
    if (loud[i] > top) top = loud[i];
    else if (loud[i] < top - 3) break;
    last = i;
  }
  for (let i = onset; i <= last; i++) if (loud[i] >= top - 4) return (i - onset) * fr;
  return 0;
}

/** Depth (std dev) and rate (Hz) of the wobble in a series sampled every `dt` seconds. */
export function motionOf(series: number[], dt: number): Motion {
  const n = series.length;
  if (n < 8) return { depth: 0, rate: 0, regular: 0 };
  // remove the slow part (a quadratic fit: decays and swells aren't wobble)
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const y = series[i];
    sx += t;
    sx2 += t * t;
    sx3 += t * t * t;
    sx4 += t * t * t * t;
    sy += y;
    sxy += t * y;
    sx2y += t * t * y;
  }
  // solve the 3×3 normal equations
  const A = [
    [n, sx, sx2],
    [sx, sx2, sx3],
    [sx2, sx3, sx4],
  ];
  const B = [sy, sxy, sx2y];
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A) || 1e-12;
  const col = (c: number) => A.map((row, r) => row.map((v, k) => (k === c ? B[r] : v)));
  const c0 = det(col(0)) / D;
  const c1 = det(col(1)) / D;
  const c2 = det(col(2)) / D;
  const res = series.map((y, i) => {
    const t = i / (n - 1) - 0.5;
    return y - (c0 + c1 * t + c2 * t * t);
  });
  const depth = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / n);
  // rate: the strongest repeat in the autocorrelation (0.3–15 Hz)
  const r0 = res.reduce((s, v) => s + v * v, 0) || 1e-12;
  const minLag = Math.max(1, Math.floor(1 / (15 * dt)));
  const maxLag = Math.min(n - 4, Math.ceil(1 / (0.3 * dt)));
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += res[i] * res[i + lag];
    return (s / r0) * (n / (n - lag));
  };
  let best = 0;
  let bestLag = 0;
  let prev = ac(Math.max(0, minLag - 1));
  let falling = true;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const r = ac(lag);
    // the first peak after the autocorrelation has dipped
    if (falling && r > prev) falling = false;
    if (!falling && r > best) {
      best = r;
      bestLag = lag;
    }
    if (!falling && r < best - 0.2 && best > 0.3) break;
    prev = r;
  }
  if (!bestLag || best <= 0.25) return { depth, rate: 0, regular: Math.max(0, best) };
  // refine between lags (the series is coarse: a 5 Hz vibrato is only ~6 pitch frames long)
  const a = ac(bestLag - 1);
  const c = ac(bestLag + 1);
  const den = a - 2 * best + c;
  const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
  return { depth, rate: 1 / ((bestLag + shift) * dt), regular: Math.min(1, best) };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface CompareOptions {
  /**
   * Judge movement (an LFO is at work in either patch). Otherwise the slow beating of
   * detuned oscillators would be taken for an LFO.
   */
  movement?: boolean;
  /** Judge pitch (not for chords: a pitch tracker follows one note). */
  pitch?: boolean;
}

/** Compare `mine` with `target` (both from analyse(), same phrase and length). */
export function compare(target: Features, mine: Features, opts: CompareOptions = {}): MatchResult {
  const movement = opts.movement ?? true;
  // ---- shape ----
  const lt = smooth(target.loud, 4);
  const lm = smooth(mine.loud, 4);
  let peak = -Infinity;
  for (const v of lt) peak = Math.max(peak, v);
  let peakM = -Infinity;
  for (const v of lm) peakM = Math.max(peakM, v);
  // quieter than this under the peak counts as silence
  const rel = (v: number) => Math.max(-50, v - peak);
  const n = Math.min(lt.length, lm.length);
  // overall level difference: the loudest moments of each (a short hit and a long note alike)
  const levelDb = Math.max(-12, Math.min(12, peak - peakM));
  // compared as loudness (roughly sones: twice as loud every 10 dB) relative to the peak,
  // not in decibels: a dip from −20 to −30 dB is a small change to the ear, a difference
  // near the top of the note a big one
  let dsum = 0;
  let active = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.pow(10, rel(lt[i]) / 33);
    const b = Math.pow(10, rel(lm[i] + levelDb) / 33);
    if (Math.max(a, b) < 0.06) continue; // both near silent (−40 dB)
    active++;
    // up to 8% either way is the beating of detuned oscillators, not a different shape
    dsum += Math.max(0, Math.abs(a - b) - 0.08 * Math.max(a, b));
  }
  const contour = active > 0 ? dsum / active : 0;
  const atT = attackTime(target.loud, peak);
  const atM = attackTime(mine.loud, peakM);
  const attackRatio = Math.abs(Math.log2((atM + 0.012) / (atT + 0.012)));
  const levelPenalty = Math.max(0, Math.abs(levelDb) - 3) * 0.045;
  const shape = clamp01(Math.exp(-contour / CONTOUR_SCALE) * Math.exp(-attackRatio / 1.6) - levelPenalty);

  // ---- tone ----
  // Two views: the long-term average spectrum (steady colour; immune to the beating of
  // detuned oscillators and to an LFO's phase) and frame by frame (colour that changes
  // over the note: filter and FM envelopes). Band differences are combined as an RMS, so
  // a difference in a few bands (a resonant peak, hiss up top) isn't averaged away.
  const nS = Math.min(target.bands.length, mine.bands.length);
  let peakS = -Infinity;
  for (const v of target.bandFrameDb) peakS = Math.max(peakS, v);
  const ltasT = new Float64Array(BANDS);
  const ltasM = new Float64Array(BANDS);
  let tw = 0;
  let td = 0;
  let lw = 0;
  for (let f = 0; f < nS; f++) {
    const a = target.bandFrameDb[f];
    const b = mine.bandFrameDb[f] + levelDb;
    if (a < peakS - 40 || b < peakS - 40) continue; // one side silent: that's shape's business
    const va = avgFrames(target.bands, f, 3);
    const vb = avgFrames(mine.bands, f, 3);
    const frameW = Math.pow(10, (Math.max(a, b) - peakS) / 20);
    tw += frameW;
    td += frameW * bandDistance(va, vb);
    lw += frameW;
    for (let k = 0; k < BANDS; k++) {
      ltasT[k] += frameW * target.bands[f][k];
      ltasM[k] += frameW * mine.bands[f][k];
    }
  }
  if (lw > 0) {
    for (let k = 0; k < BANDS; k++) {
      ltasT[k] /= lw;
      ltasM[k] /= lw;
    }
  }
  const framewiseDb = tw > 0 ? td / tw : 0;
  const ltasDb = lw > 0 ? bandDistance(ltasT, ltasM) : 0;
  // frame by frame, small differences are beating and LFO phase: only big ones count
  const toneDist = 0.8 * ltasDb + 0.2 * Math.max(0, framewiseDb - 0.08);
  const tone = clamp01(Math.exp(-toneDist / 0.11));

  // ---- pitch ----
  const nP = Math.min(target.pitch.length, mine.pitch.length);
  const offsets: number[] = [];
  let voicedT = 0;
  let unvoicedM = 0;
  for (let f = 0; f < nP; f++) {
    const a = target.pitch[f];
    if (!Number.isFinite(a)) continue;
    voicedT++;
    const b = mine.pitch[f];
    if (!Number.isFinite(b)) unvoicedM++;
    else offsets.push((b - a) * 100);
  }
  let pitch: number | null = null;
  let pitchCents: number | null = null;
  if ((opts.pitch ?? true) && voicedT >= 3 && voicedT >= nP * 0.25 && pitchSteady(target)) {
    pitchCents = offsets.length ? median(offsets) : 1200;
    const unvoicedShare = unvoicedM / voicedT;
    // how the pitch moves (a glide, a pitch envelope) besides where it sits
    // (half the mean, half the 90th percentile: a glide is brief but large)
    // octave and twelfth jumps are the tracker changing its mind, not the sound
    const dev = offsets
      .map(o => Math.abs(o - pitchCents!))
      .filter(d => Math.abs(d - 1200) > 150 && Math.abs(d - 1902) > 150 && Math.abs(d - 2400) > 150)
      .map(d => Math.min(600, d))
      .sort((a, b) => a - b);
    const wander = dev.length ? 0.5 * (dev.reduce((s, d) => s + d, 0) / dev.length) + 0.5 * dev[Math.floor(dev.length * 0.9)] : 0;
    pitch = clamp01(Math.exp(-Math.abs(pitchCents) / 140) * Math.exp(-wander / 200) * (1 - 0.8 * Math.max(0, unvoicedShare - 0.25)));
  }

  // ---- movement ----
  const motion: MatchResult['detail']['motion'] = [];
  const [h0, h1] = target.held;
  const seg = (arr: Float32Array, hop: number) => {
    const dt = hop / ANALYSIS_RATE;
    const from = Math.ceil((h0 + 0.12) / dt);
    const to = Math.min(arr.length, Math.floor(h1 / dt));
    return { values: Array.from(arr.subarray(from, Math.max(from, to))), dt };
  };
  const pitchSeries = (f: Features) => {
    const s = seg(f.pitch, HOP_P);
    // fill gaps so the series stays evenly spaced
    let last = s.values.find(Number.isFinite) ?? 0;
    return { values: s.values.map(v => (Number.isFinite(v) ? (last = v) : last) * 100), dt: s.dt };
  };
  const tests: { what: 'pitch' | 'loudness' | 'brightness'; t: { values: number[]; dt: number }; m: { values: number[]; dt: number }; noticeable: number }[] = [
    { what: 'pitch', t: pitchSeries(target), m: pitchSeries(mine), noticeable: 6 },
    { what: 'loudness', t: seg(target.loud, HOP_L), m: seg(mine.loud, HOP_L), noticeable: 1 },
    { what: 'brightness', t: seg(target.centroid, HOP_S), m: seg(mine.centroid, HOP_S), noticeable: 1.5 },
  ];
  const moveScores: number[] = [];
  for (const x of movement ? tests : []) {
    if (x.t.values.length < 8) continue;
    const mt = motionOf(x.t.values, x.t.dt);
    const mm = motionOf(x.m.values, x.m.dt);
    const tMoves = mt.depth > x.noticeable;
    const mMoves = mm.depth > x.noticeable;
    if (!tMoves && !mMoves) continue;
    motion.push({ what: x.what, target: mt, mine: mm });
    const eps = x.noticeable * 0.5;
    const depthOff = Math.abs(Math.log2((mm.depth + eps) / (mt.depth + eps)));
    let s = Math.exp(-depthOff / 1.1);
    if (tMoves && mMoves && mt.rate > 0 && mm.rate > 0) s *= Math.exp(-Math.abs(Math.log2(mm.rate / mt.rate)) / 0.6);
    // wobble that's only just there (beating, a touch of chorus) matters less than a real LFO
    const regular = clamp01((Math.max(mt.regular, mm.regular) - 0.3) / 0.4);
    const salience = clamp01((Math.max(mt.depth, mm.depth) - x.noticeable) / (0.5 * x.noticeable)) * regular;
    moveScores.push(1 - salience * (1 - s));
  }
  const moveScore = moveScores.length ? Math.min(...moveScores) : null;

  // ---- overall ----
  const parts: [number, number][] = [
    [tone, 1.5],
    [shape, 1.1],
  ];
  if (pitch !== null) parts.push([pitch, 1]);
  if (moveScore !== null) parts.push([moveScore, 1.2]);
  const wTotal = parts.reduce((s, [, w]) => s + w, 0);
  const overall = Math.exp(parts.reduce((s, [v, w]) => s + w * Math.log(Math.max(1e-4, v)), 0) / wTotal);
  return { overall, pitch, tone, shape, movement: moveScore, detail: { pitchCents, toneDist, contour, levelDb, attackRatio, motion } };
}

/** A-weighting (dB) at each band's centre: the ear's sensitivity, most around 2–5 kHz. */
const A_WEIGHT = Float64Array.from({ length: BANDS }, (_, b) => {
  const f = BAND_LO * Math.pow(2, (b + 0.5) / 3);
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(ra) + 2;
});

/**
 * Difference of two band spectra (dB re frame) as heard: each band's level is weighted
 * by the ear's sensitivity and turned into loudness (intensity^0.23, as in Zwicker's
 * model), and the share of the loudness that differs is returned (0 = same, 1 = nothing
 * in common). In loudness terms a whisper of difference far below the main tone counts
 * for little, and a hiss or a missing harmonic where the ear is keen counts for a lot.
 */
function bandDistance(va: ArrayLike<number>, vb: ArrayLike<number>): number {
  let diff = 0;
  let total = 0;
  for (let k = 0; k < BANDS; k++) {
    const a = Math.pow(10, 0.023 * (va[k] + A_WEIGHT[k]));
    const b = Math.pow(10, 0.023 * (vb[k] + A_WEIGHT[k]));
    diff += Math.abs(a - b);
    total += Math.max(a, b);
  }
  return total > 0 ? diff / total : 0;
}

/**
 * Does the target hold a steady pitch over its first note? Bells, glass and other
 * inharmonic sounds don't (a tracker hops between partials), and judging their "pitch"
 * would only judge the tracker.
 */
function pitchSteady(f: Features): boolean {
  const dt = HOP_P / ANALYSIS_RATE;
  const from = Math.ceil((f.held[0] + 0.15) / dt);
  const to = Math.min(f.pitch.length, Math.floor(f.held[1] / dt));
  const vals = Array.from(f.pitch.subarray(from, Math.max(from, to))).filter(Number.isFinite).map(v => v * 100);
  if (vals.length < 3) return true;
  const med = median(vals);
  const mad = median(vals.map(v => Math.abs(v - med)));
  // inharmonic partials still repeat a little: their clarity stays low
  const clear = median(Array.from(f.clarity.subarray(from, Math.max(from, to))));
  return mad <= 60 && clear >= 0.85;
}

/** A frame's bands averaged with its neighbours (smooths fast wobble out of the tone). */
function avgFrames(bands: Float32Array[], f: number, radius: number): Float32Array {
  const out = new Float32Array(BANDS);
  let n = 0;
  for (let k = Math.max(0, f - radius); k <= Math.min(bands.length - 1, f + radius); k++) {
    for (let b = 0; b < BANDS; b++) out[b] += bands[k][b];
    n++;
  }
  for (let b = 0; b < BANDS; b++) out[b] /= n;
  return out;
}
