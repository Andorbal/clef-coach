/**
 * Magnitude spectrum, harmonic salience and chord verification.
 *
 * PURE + DOM-free. The microphone path feeds these with its own FFT of the
 * analyser's time-domain buffer, so the same code runs in unit tests.
 *
 * Chord verification is *informed*: the lesson always knows which notes it
 * expects, so instead of blind polyphonic transcription we only have to answer
 * "is each expected note really sounding, and is something clearly different
 * sounding instead?". See {@link verifyChord}.
 */
import { getFFT, nextPow2 } from '../dsp/fft';

export type WindowType = 'hann' | 'blackman' | 'none';

export interface SpectrumOptions {
  /**
   * Transform size (power of two). If larger than the analysed segment the
   * frame is zero-padded (finer bin spacing for peak picking). If smaller,
   * the most recent `fftSize` samples are used. Default: nextPow2(buf.length).
   */
  fftSize?: number;
  /** Number of most recent samples to analyse (default min(buf.length, fftSize)). */
  windowLength?: number;
  window?: WindowType;
  /** Optional output array (length fftSize/2) to avoid allocation. */
  out?: Float32Array;
}

const windowCache = new Map<string, { w: Float64Array; sum: number }>();

function getWindow(type: WindowType, n: number): { w: Float64Array; sum: number } {
  const key = `${type}:${n}`;
  let e = windowCache.get(key);
  if (!e) {
    const w = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const p = (2 * Math.PI * i) / (n - 1);
      const v =
        type === 'hann' ? 0.5 - 0.5 * Math.cos(p)
          : type === 'blackman' ? 0.42 - 0.5 * Math.cos(p) + 0.08 * Math.cos(2 * p)
            : 1;
      w[i] = v;
      sum += v;
    }
    e = { w, sum };
    windowCache.set(key, e);
  }
  return e;
}

interface SpecScratch {
  re: Float64Array;
  im: Float64Array;
  cosT: Float64Array;
  sinT: Float64Array;
}
const specScratch = new Map<number, SpecScratch>();

function getSpecScratch(fftSize: number): SpecScratch {
  let s = specScratch.get(fftSize);
  if (!s) {
    const half = fftSize >> 1;
    s = {
      re: new Float64Array(half),
      im: new Float64Array(half),
      cosT: new Float64Array(half),
      sinT: new Float64Array(half),
    };
    for (let k = 0; k < half; k++) {
      s.cosT[k] = Math.cos((2 * Math.PI * k) / fftSize);
      s.sinT[k] = Math.sin((2 * Math.PI * k) / fftSize);
    }
    specScratch.set(fftSize, s);
  }
  return s;
}

/**
 * Windowed magnitude spectrum (linear amplitude, length fftSize/2). Scaled so
 * that a sinusoid of amplitude A centred on a bin reads ≈ A.
 *
 * Uses the "two-for-one" real-input trick: even/odd samples are packed into
 * one complex FFT of half the size and the halves are recombined, which is
 * about twice as fast as a plain complex FFT of the real signal.
 */
export function computeSpectrum(buf: Float32Array, opts: SpectrumOptions = {}): Float32Array {
  const fftSize = Math.max(4, opts.fftSize ?? nextPow2(buf.length));
  const winLen = Math.min(opts.windowLength ?? Math.min(buf.length, fftSize), buf.length, fftSize);
  const half = fftSize >> 1;
  const out = opts.out && opts.out.length >= half ? opts.out : new Float32Array(half);
  const { re, im, cosT, sinT } = getSpecScratch(fftSize);
  const { w, sum } = getWindow(opts.window ?? 'hann', winLen);
  const off = buf.length - winLen;
  let mean = 0;
  for (let i = 0; i < winLen; i++) mean += buf[off + i];
  mean /= winLen;
  // z[n] = x[2n] + i·x[2n+1]  (zero padded beyond winLen)
  for (let n = 0; n < half; n++) {
    const i0 = 2 * n;
    const i1 = i0 + 1;
    re[n] = i0 < winLen ? (buf[off + i0] - mean) * w[i0] : 0;
    im[n] = i1 < winLen ? (buf[off + i1] - mean) * w[i1] : 0;
  }
  getFFT(half).transform(re, im, false);
  const scale = 2 / sum;
  // X[k] = E[k] + W^k·O[k], E = (Z[k] + Z*[M−k])/2, O = (Z[k] − Z*[M−k])/(2i)
  for (let k = 0; k < half; k++) {
    const k2 = k === 0 ? 0 : half - k;
    const zr = re[k];
    const zi = im[k];
    const cr = re[k2];
    const ci = -im[k2];
    const er = (zr + cr) * 0.5;
    const ei = (zi + ci) * 0.5;
    const or = (zi - ci) * 0.5;
    const oi = -(zr - cr) * 0.5;
    // W^k = cos − i·sin
    const c = cosT[k];
    const sn = sinT[k];
    const xr = er + or * c + oi * sn;
    const xi = ei + oi * c - or * sn;
    out[k] = Math.sqrt(xr * xr + xi * xi) * scale;
  }
  return out;
}

/**
 * Amplitude of the spectral peak at `freq` (±centsTol). Only genuine local
 * maxima count, and the peak's parabolically-interpolated frequency must lie
 * inside the tolerance – so the skirt of a strong neighbouring partial (very
 * common at low frequencies, where a semitone is less than one bin) is NOT
 * mistaken for a partial at `freq`. Bins flagged in `mask` are skipped.
 */
export function harmonicPeak(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  freq: number,
  centsTol = 40,
  mask?: Uint8Array | null,
): number {
  const binHz = sampleRate / fftSize;
  const r = Math.pow(2, centsTol / 1200);
  // Never narrower than ±0.25 bin (interpolation accuracy at very low f).
  const fLo = Math.min(freq / r, freq - 0.25 * binHz);
  const fHi = Math.max(freq * r, freq + 0.25 * binHz);
  const k0 = Math.max(1, Math.floor(fLo / binHz) - 1);
  const k1 = Math.min(magnitudes.length - 2, Math.ceil(fHi / binHz) + 1);
  let best = 0;
  for (let k = k0; k <= k1; k++) {
    const v = magnitudes[k];
    if (v <= best || (mask && mask[k])) continue;
    const a = magnitudes[k - 1];
    const c = magnitudes[k + 1];
    if (v < a || v < c) continue; // not a local maximum
    const den = a - 2 * v + c;
    const delta = den < 0 ? (0.5 * (a - c)) / den : 0;
    const f = (k + delta) * binHz;
    if (f < fLo || f > fHi) continue;
    best = v;
  }
  return best;
}

export interface SalienceOptions {
  /** Harmonics to sum (default 6, 8 for notes below ~150 Hz). */
  harmonics?: number;
  /** Search tolerance around each harmonic in cents (default 40). */
  centsTolerance?: number;
  /** Bins to ignore (used for "residual" salience). */
  mask?: Uint8Array | null;
  /**
   * Down-weight harmonics that cannot be resolved from the semitone
   * neighbours at this FFT resolution (default true). Needs `windowLength`
   * when the spectrum was zero-padded.
   */
  resolutionWeighting?: boolean;
  /** Length of the analysed (windowed) segment; default = fftSize. */
  windowLength?: number;
  /** Ignore harmonics above this frequency (default min(5000, 0.45·sr)). */
  maxFreq?: number;
}

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * How well a partial at `f` can be told apart from the same partial of the
 * semitone neighbours (0.15..1). A Hann window separates two components when
 * they are ≳2 analysis bins apart.
 */
function resolvability(f: number, windowBinHz: number): number {
  const semitoneHz = f * 0.0595;
  const ratio = semitoneHz / windowBinHz;
  return Math.min(1, Math.max(0.15, (ratio - 0.75) / 1.25));
}

/**
 * Harmonic-sum salience of a MIDI note: Σ_h w_h · peak(h·f0), where
 * w_h = h^-½ (× resolvability). Higher = more evidence the note is sounding.
 */
export function noteSalience(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  midi: number,
  opts: SalienceOptions = {},
): number {
  const f0 = midiFreq(midi);
  const hCount = opts.harmonics ?? (f0 < 150 ? 8 : 6);
  const tol = opts.centsTolerance ?? 40;
  const maxF = opts.maxFreq ?? Math.min(5000, sampleRate * 0.45);
  const weighting = opts.resolutionWeighting ?? true;
  const windowBinHz = sampleRate / (opts.windowLength ?? fftSize);
  let sum = 0;
  for (let h = 1; h <= hCount; h++) {
    const f = f0 * h;
    if (f > maxF) break;
    let wgt = 1 / Math.sqrt(h);
    if (weighting) wgt *= resolvability(f, windowBinHz);
    sum += wgt * harmonicPeak(magnitudes, sampleRate, fftSize, f, tol, opts.mask);
  }
  return sum;
}

export interface VerifyChordOptions {
  /** Length of the analysed segment if the spectrum was zero-padded. */
  windowLength?: number;
  /**
   * Per-bin noise magnitude. If omitted it is estimated from the spectrum
   * itself (a low percentile of the analysed band), which adapts to the room.
   */
  noiseFloor?: number;
  /** Absolute magnitude below which nothing counts as sounding (default 2e-4). */
  minMagnitude?: number;
  /** Expected note must beat its (non-expected) semitone neighbours by this factor (default 1.25). */
  neighbourRatio?: number;
  /** …and be at least this fraction of the strongest non-expected note (default 0.5). */
  otherRatio?: number;
  /** Fundamental/2nd-harmonic peak must exceed noise floor × this (default 4 ≈ 12 dB). */
  floorRatio?: number;
  /** …and salience ≥ this fraction of the strongest expected note (default 0.1). */
  relativeMin?: number;
  /** MIDI range searched for "other" notes (default around the expected notes). */
  range?: [number, number];
  centsTolerance?: number;
}

export interface VerifyChordResult {
  /** Per expected note: is it sounding? (same order as `expected`) */
  present: boolean[];
  /** 0..1 overall confidence that exactly the expected chord is sounding. */
  score: number;
  /** Raw harmonic saliences of the expected notes (diagnostics). */
  saliences: number[];
  /** Strongest non-expected note (residual salience), if any. */
  strongestOther: { midi: number; salience: number } | null;
}

function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort();
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Decide which of the `expected` notes are actually sounding.
 *
 * For each expected note e:
 *   1. its fundamental or 2nd harmonic (3rd for very low notes) must stand
 *      clearly above the noise floor;
 *   2. its harmonic salience must beat the semitone neighbours' *residual*
 *      salience (salience computed only from spectral peaks NOT explained by
 *      partials of the expected notes – so a C4 partial can't make F4 look
 *      present);
 *   3. it must be comparable to the strongest non-expected note's residual
 *      salience in the analysed range (rejects a clearly different chord);
 *   4. and not negligible compared with the strongest expected note.
 *
 * Approximate by design, but robust to silence, broadband noise, wrong chords
 * and semitone slips on synthetic and real harmonic tones.
 */
export function verifyChord(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  expected: readonly number[],
  opts: VerifyChordOptions = {},
): VerifyChordResult {
  const nExp = expected.length;
  const empty: VerifyChordResult = {
    present: expected.map(() => false),
    score: 0,
    saliences: expected.map(() => 0),
    strongestOther: null,
  };
  if (nExp === 0) return { ...empty, score: 1 };

  const binHz = sampleRate / fftSize;
  const windowLength = opts.windowLength ?? fftSize;
  const windowBinHz = sampleRate / windowLength;
  const tol = opts.centsTolerance ?? 40;
  const minMag = opts.minMagnitude ?? 2e-4;
  const neighbourRatio = opts.neighbourRatio ?? 1.25;
  const otherRatio = opts.otherRatio ?? 0.5;
  const floorRatio = opts.floorRatio ?? 4;
  const relativeMin = opts.relativeMin ?? 0.1;
  const maxF = Math.min(5000, sampleRate * 0.45);

  // --- Noise floor ---------------------------------------------------------
  const kLo = Math.max(1, Math.floor(50 / binHz));
  const kHi = Math.min(magnitudes.length - 1, Math.ceil(maxF / binHz));
  let floor = opts.noiseFloor ?? percentile(magnitudes.subarray(kLo, kHi), 0.35);
  floor = Math.max(floor, minMag * 0.05);

  // --- Masks of bins explained by expected notes' partials -----------------
  // maskAll: every expected partial (for the residual salience of other notes)
  // others[i]: partials of all expected notes EXCEPT expected[i] (for that
  // note's "own" evidence – e.g. G4's 2nd harmonic is C4's 3rd, so it can't
  // prove that G4 is sounding when C4 is expected too).
  const lobeHz = 1.8 * windowBinHz; // ≈ Hann main-lobe half-width
  const markPartials = (target: Uint8Array, midi: number): void => {
    const f0 = midiFreq(midi);
    for (let h = 1; h <= 12; h++) {
      const f = f0 * h;
      if (f > maxF) break;
      const halfW = Math.max(lobeHz, f * (Math.pow(2, tol / 1200) - 1));
      const a = Math.max(0, Math.floor((f - halfW) / binHz));
      const b = Math.min(target.length - 1, Math.ceil((f + halfW) / binHz));
      for (let k = a; k <= b; k++) target[k] = 1;
    }
  };
  const mask = new Uint8Array(magnitudes.length);
  for (const e of expected) markPartials(mask, e);
  const others = expected.map((e, i) => {
    const m = new Uint8Array(magnitudes.length);
    expected.forEach((o, j) => {
      if (j !== i && o !== e) markPartials(m, o);
    });
    return m;
  });

  const salOpts: SalienceOptions = { centsTolerance: tol, windowLength, maxFreq: maxF };
  const residualOpts: SalienceOptions = { ...salOpts, mask };
  const expSet = new Set(expected);
  const sal = expected.map((e) => noteSalience(magnitudes, sampleRate, fftSize, e, salOpts));
  const maxSal = Math.max(...sal);

  // --- Strongest non-expected note (residual salience) ---------------------
  const lo = opts.range?.[0] ?? Math.max(24, Math.min(...expected) - 13);
  const hi = opts.range?.[1] ?? Math.min(108, Math.max(...expected) + 24);
  const residual = new Map<number, number>();
  let strongestOther: { midi: number; salience: number } | null = null;
  for (let m = lo; m <= hi; m++) {
    if (expSet.has(m)) continue;
    if (midiFreq(m) > maxF) break;
    const r = noteSalience(magnitudes, sampleRate, fftSize, m, residualOpts);
    residual.set(m, r);
    if (!strongestOther || r > strongestOther.salience) strongestOther = { midi: m, salience: r };
  }
  const residualOf = (m: number): number =>
    residual.get(m) ?? noteSalience(magnitudes, sampleRate, fftSize, m, residualOpts);

  // --- Per-note decision ----------------------------------------------------
  const present: boolean[] = [];
  let scoreSum = 0;
  for (let i = 0; i < nExp; i++) {
    const e = expected[i];
    const s = sal[i];
    const f0 = midiFreq(e);
    // (1) evidence of the note's own low partials above the floor, ignoring
    //     partials that another expected note explains. If ALL of them are
    //     explained (octave doublings) the note can't be verified separately
    //     and this test is skipped.
    const evidHarm = f0 < 120 ? [1, 2, 3] : [1, 2];
    const own = others[i];
    let evidence = 0;
    let verifiable = false;
    for (const h of evidHarm) {
      const k = Math.round((f0 * h) / binHz);
      if (k >= own.length || own[k]) continue;
      verifiable = true;
      evidence = Math.max(evidence, harmonicPeak(magnitudes, sampleRate, fftSize, f0 * h, tol, own));
    }
    const evidenceRatio = !verifiable ? Infinity : evidence >= minMag ? evidence / (floor * floorRatio) : 0;
    // (2) semitone neighbours that are not themselves expected
    let nb = 0;
    for (const m of [e - 1, e + 1]) if (!expSet.has(m)) nb = Math.max(nb, residualOf(m));
    const nbRatio = nb > 0 ? s / (nb * neighbourRatio) : Infinity;
    // (3) strongest other note anywhere in range
    const other = strongestOther?.salience ?? 0;
    const otherR = other > 0 ? s / (other * otherRatio) : Infinity;
    // (4) own (unexplained) salience relative to the strongest expected note
    const ownSal = verifiable
      ? noteSalience(magnitudes, sampleRate, fftSize, e, { ...salOpts, mask: own })
      : s;
    const relR = maxSal > 0 ? ownSal / (maxSal * relativeMin) : 0;
    const ratio = Math.min(evidenceRatio, nbRatio, otherR, relR);
    present.push(ratio >= 1);
    scoreSum += Math.min(1, Math.max(0, ratio / 2));
  }
  return { present, score: scoreSum / nExp, saliences: sal, strongestOther };
}

export interface PitchSupportOptions {
  /** Per-bin noise magnitude (default: estimated from the spectrum). */
  noiseFloor?: number;
  /** Strongest magnitude in the analysed band (default: measured). */
  bandPeak?: number;
  /** Required peak height over the noise floor (default 4 ≈ 12 dB). */
  floorRatio?: number;
  /** …and over the strongest peak in the band, in dB (default −35). */
  relativeDb?: number;
  centsTolerance?: number;
}

function bandPeak(band: Float32Array): number {
  let top = 0;
  for (let k = 0; k < band.length; k++) if (band[k] > top) top = band[k];
  return top;
}

/**
 * Noise floor and strongest peak of a spectrum's analysed band, as
 * {@link hasPitchSupport} measures them – compute once per spectrum and pass
 * them in when checking several notes on the same frame.
 */
export function pitchSupportStats(magnitudes: Float32Array, sampleRate: number, fftSize: number): { noiseFloor: number; bandPeak: number } {
  const binHz = sampleRate / fftSize;
  const maxF = Math.min(5000, sampleRate * 0.45);
  const kLo = Math.max(1, Math.floor(50 / binHz));
  const kHi = Math.min(magnitudes.length - 1, Math.ceil(maxF / binHz));
  const band = magnitudes.subarray(kLo, kHi);
  return { noiseFloor: percentile(band, 0.35), bandPeak: bandPeak(band) };
}

/**
 * Is there real spectral evidence for `midi` – a genuine peak at its
 * fundamental, or (for weak-fundamental bass notes) a weak fundamental plus a
 * strong 2nd/3rd harmonic? Used to veto the "virtual pitches" YIN can briefly report while two
 * notes overlap in the analysis window (e.g. E4+A4 → A2, whose own
 * fundamental and octave are absent).
 */
export function hasPitchSupport(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  midi: number,
  opts: PitchSupportOptions = {},
): boolean {
  const binHz = sampleRate / fftSize;
  const maxF = Math.min(5000, sampleRate * 0.45);
  const kLo = Math.max(1, Math.floor(50 / binHz));
  const kHi = Math.min(magnitudes.length - 1, Math.ceil(maxF / binHz));
  const band = magnitudes.subarray(kLo, kHi);
  const floor = Math.max(opts.noiseFloor ?? percentile(band, 0.35), 1e-7);
  const top = opts.bandPeak ?? bandPeak(band);
  const need = Math.max(floor * (opts.floorRatio ?? 4), top * Math.pow(10, (opts.relativeDb ?? -35) / 20));
  const f0 = midiFreq(midi);
  const tol = opts.centsTolerance ?? 40;
  const peak = (h: number) => harmonicPeak(magnitudes, sampleRate, fftSize, f0 * h, tol);
  const p1 = peak(1);
  // Octave dominance: if the odd partials are negligible next to the even
  // ones, the sound is really the note an octave up (YIN reports the lower
  // period whenever a little of the old note is still in the window).
  const odd = p1 + peak(3) + peak(5);
  const even = peak(2) + peak(4) + peak(6);
  if (odd < 0.2 * even) return false;
  if (p1 >= need) return true;
  // Weak fundamental (bass strings): it must still be visible, and the 2nd or
  // 3rd harmonic must be strong. A fundamental that is entirely absent means
  // the energy belongs to a note an octave/twelfth higher (or to two
  // overlapping notes) and `midi` is a sub-harmonic artefact.
  if (p1 < need * 0.3) return false;
  return peak(2) >= need || peak(3) >= need;
}
