/**
 * Pure renderers for the UI sound effects and the metronome click.
 *
 * Design brief: musical, soft-edged and premium (think a high-end game or OS
 * sounds) – never cartoonish. Everything is built from a handful of
 * primitives: modal "bells" (sums of damped partials with a soft mallet
 * attack), warm detuned pads, filtered-noise air, and gliding sine thumps.
 * All renders are deterministic (seeded) and return stereo Float32Arrays.
 */
import {
  addSoftDampedSine,
  clamp,
  fadeOut,
  filterInPlace,
  mulberry32,
  panGains,
  peakAbs,
  scaleInPlace,
} from './dsp/util';

export type SfxName = 'correct' | 'wrong' | 'complete' | 'levelUp' | 'tap' | 'streak';

export const SFX_NAMES: readonly SfxName[] = ['correct', 'wrong', 'complete', 'levelUp', 'tap', 'streak'];

export interface StereoSamples {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
}

/**
 * Pitches (MIDI) each effect contains – used to tell the microphone detector
 * which notes the app itself is sounding. null = unpitched (click-like).
 */
export const SFX_PITCHES: Record<SfxName, readonly number[] | null> = {
  correct: [81, 88],
  wrong: [45, 46, 47, 48, 50, 51],
  complete: [60, 64, 67, 72, 76, 79, 84, 96],
  levelUp: [48, 60, 64, 67, 72, 76, 79, 81, 84, 86, 88, 91, 93, 96, 100, 103],
  tap: null,
  streak: [88, 92, 95, 100, 104, 107],
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Mode {
  ratio: number;
  amp: number;
  tau: number;
}

function stereo(seconds: number, sr: number): StereoSamples {
  const n = Math.max(1, Math.round(seconds * sr));
  return { left: new Float32Array(n), right: new Float32Array(n) };
}

/** A struck modal voice (bell / marimba / glass) with a soft mallet attack. */
function bell(
  out: StereoSamples,
  sr: number,
  at: number,
  freq: number,
  amp: number,
  modes: readonly Mode[],
  pan = 0,
  attack = 0.0015,
): void {
  const [gl, gr] = panGains(pan);
  const start = Math.round(at * sr);
  for (const m of modes) {
    const f = freq * m.ratio;
    if (f >= sr * 0.45) continue;
    addSoftDampedSine(out.left, start, f, amp * m.amp * gl, m.tau, attack, sr, 1e-6);
    addSoftDampedSine(out.right, start, f, amp * m.amp * gr, m.tau, attack, sr, 1e-6);
  }
}

const PAD_VOICES: readonly [number, number][] = [
  [-4, 0.3],
  [0, 0.5],
  [5.5, 0.25],
];

/** Warm sustained pad: detuned sine voices with slow attack and exponential release. */
function pad(
  out: StereoSamples,
  sr: number,
  at: number,
  freqs: readonly number[],
  amp: number,
  attack: number,
  tau: number,
  spread = 0.4,
): void {
  const start = Math.round(at * sr);
  const len = out.left.length;
  const dA = Math.exp(-1 / (attack * sr));
  const dT = Math.exp(-1 / (tau * sr));
  freqs.forEach((f, i) => {
    const pan = freqs.length > 1 ? -spread + (2 * spread * i) / (freqs.length - 1) : 0;
    const [gl, gr] = panGains(pan);
    // Three unequal, unevenly detuned voices: a gentle chorus that never
    // fully cancels (two equal detuned sines would beat down to silence).
    for (const [det, vg] of PAD_VOICES) {
      // sine by rotation, envelopes by multiplication – no per-sample Math.*
      const w = (2 * Math.PI * f * Math.pow(2, det / 1200)) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      const ph = (i * 1.7 + det) % (2 * Math.PI);
      let c = Math.cos(ph);
      let sn = Math.sin(ph);
      let ea = 1;
      let et = 1;
      const g = amp * vg;
      for (let k = start; k < len; k++) {
        const env = (1 - ea) * et;
        if (et < 1e-5) break;
        const v = sn * env * g;
        out.left[k] += v * gl;
        out.right[k] += v * gr;
        ea *= dA;
        et *= dT;
        const nc = c * cw - sn * sw;
        sn = sn * cw + c * sw;
        c = nc;
      }
    }
  });
}

/** Band-limited noise "air" with a rise/fall envelope. */
function air(
  out: StereoSamples,
  sr: number,
  at: number,
  dur: number,
  amp: number,
  lowHz: number,
  highHz: number,
  seed: number,
): void {
  const n = Math.round(dur * sr);
  const start = Math.round(at * sr);
  const rand = mulberry32(seed);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    // quick rise (30%), longer fall, squared for a smooth swell
    const x = k / n;
    const lin = x < 0.3 ? x / 0.3 : (1 - x) / 0.7;
    const env = lin * lin;
    l[k] = (rand() * 2 - 1) * env;
    r[k] = (rand() * 2 - 1) * env;
  }
  for (const ch of [l, r]) {
    filterInPlace(ch, 'highpass', lowHz, 0.7, 0, sr);
    filterInPlace(ch, 'lowpass', highHz, 0.7, 0, sr);
  }
  for (let k = 0; k < n && start + k < out.left.length; k++) {
    out.left[start + k] += l[k] * amp;
    out.right[start + k] += r[k] * amp;
  }
}

/** Soft gliding sine thump (for the gentle "not quite" sound). */
function thump(
  out: StereoSamples,
  sr: number,
  at: number,
  f0: number,
  f1: number,
  amp: number,
  tau: number,
): void {
  const start = Math.round(at * sr);
  const n = Math.min(out.left.length - start, Math.round(tau * 9 * sr));
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.06);
    ph += (2 * Math.PI * f) / sr;
    const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / tau);
    const s = (Math.sin(ph) + 0.22 * Math.sin(2 * ph)) * env * amp;
    out.left[start + k] += s;
    out.right[start + k] += s;
  }
}

function finish(out: StereoSamples, sr: number, peak: number, fadeSec = 0.08): StereoSamples {
  const fade = Math.round(fadeSec * sr);
  fadeOut(out.left, fade);
  fadeOut(out.right, fade);
  const p = Math.max(peakAbs(out.left), peakAbs(out.right));
  if (p > 0) {
    scaleInPlace(out.left, peak / p);
    scaleInPlace(out.right, peak / p);
  }
  return out;
}

// Timbres -------------------------------------------------------------------

/** Rosewood-marimba-meets-glass: fundamental, octave shimmer, marimba overtone. */
const MARIMBA: Mode[] = [
  { ratio: 1, amp: 1, tau: 0.38 },
  { ratio: 2, amp: 0.16, tau: 0.22 },
  { ratio: 3.93, amp: 0.1, tau: 0.06 },
  { ratio: 9.2, amp: 0.025, tau: 0.015 },
];

/** Warm glass bell for chimes. */
const CHIME: Mode[] = [
  { ratio: 1, amp: 1, tau: 1.1 },
  { ratio: 2, amp: 0.22, tau: 0.6 },
  { ratio: 3, amp: 0.07, tau: 0.35 },
  { ratio: 4.16, amp: 0.045, tau: 0.2 },
  { ratio: 5.43, amp: 0.02, tau: 0.1 },
];

/** Bright, slightly inharmonic sparkle. */
const SPARKLE: Mode[] = [
  { ratio: 1, amp: 1, tau: 0.32 },
  { ratio: 2.76, amp: 0.14, tau: 0.12 },
  { ratio: 5.4, amp: 0.04, tau: 0.05 },
];

// Effects ---------------------------------------------------------------------

function renderCorrect(sr: number): StereoSamples {
  const o = stereo(0.95, sr);
  bell(o, sr, 0, hz(81), 0.8, MARIMBA, -0.18, 0.0015); // A5
  bell(o, sr, 0.085, hz(88), 1.0, MARIMBA, 0.18, 0.0015); // E6
  air(o, sr, 0, 0.012, 0.03, 2500, 7000, 11); // mallet tick
  return finish(o, sr, 0.42);
}

function renderWrong(sr: number): StereoSamples {
  const o = stereo(0.5, sr);
  thump(o, sr, 0, hz(51), hz(50) * 0.97, 1, 0.075); // soft "dum"
  thump(o, sr, 0.11, hz(47), hz(46) * 0.97, 0.7, 0.085); // lower, softer "dum"
  air(o, sr, 0, 0.05, 0.08, 60, 450, 21); // felt-muted knock
  for (const ch of [o.left, o.right]) filterInPlace(ch, 'lowpass', 1100, 0.6, 0, sr);
  return finish(o, sr, 0.45, 0.06);
}

function renderComplete(sr: number): StereoSamples {
  const o = stereo(2.4, sr);
  const notes = [72, 76, 79, 84]; // C5 E5 G5 C6
  notes.forEach((m, i) => bell(o, sr, i * 0.11, hz(m), 0.75 + i * 0.08, CHIME, -0.45 + i * 0.3, 0.003));
  pad(o, sr, 0.12, [hz(60), hz(67), hz(76)], 0.1, 0.25, 0.9);
  bell(o, sr, 0.46, hz(96), 0.18, SPARKLE, 0.3, 0.002); // C7 glint
  air(o, sr, 0.3, 0.9, 0.012, 5000, 12000, 31);
  return finish(o, sr, 0.5, 0.3);
}

function renderLevelUp(sr: number): StereoSamples {
  const o = stereo(3.0, sr);
  const run = [79, 81, 84, 86, 88, 91, 93, 96]; // G5 A5 C6 D6 E6 G6 A6 C7 (pentatonic)
  run.forEach((m, i) => bell(o, sr, i * 0.045, hz(m), 0.35 + i * 0.04, MARIMBA, -0.7 + (1.4 * i) / (run.length - 1), 0.0012));
  const bloom = 0.42;
  [72, 76, 79, 84, 88].forEach((m, i) => bell(o, sr, bloom + i * 0.012, hz(m), 0.55, CHIME, -0.4 + i * 0.2, 0.004));
  pad(o, sr, bloom - 0.05, [hz(48), hz(60), hz(67), hz(76)], 0.14, 0.08, 1.3, 0.5);
  [96, 103, 100].forEach((m, i) => bell(o, sr, bloom + 0.08 + i * 0.08, hz(m), 0.16, SPARKLE, i % 2 ? 0.6 : -0.6, 0.0015));
  air(o, sr, bloom - 0.1, 1.2, 0.018, 6000, 14000, 41);
  return finish(o, sr, 0.55, 0.4);
}

function renderTap(sr: number): StereoSamples {
  const o = stereo(0.045, sr);
  bell(o, sr, 0, 2200, 1, [{ ratio: 1, amp: 1, tau: 0.005 }, { ratio: 2.3, amp: 0.3, tau: 0.003 }], 0, 0.0003);
  air(o, sr, 0, 0.004, 0.5, 1500, 7000, 51);
  return finish(o, sr, 0.14, 0.01);
}

function renderStreak(sr: number): StereoSamples {
  const o = stereo(1.1, sr);
  const notes = [88, 95, 92, 100, 107, 104]; // E6 B6 G#6 E7 B7 G#7
  notes.forEach((m, i) => bell(o, sr, i * 0.042, hz(m), 0.7 - i * 0.05, SPARKLE, i % 2 ? 0.55 : -0.55, 0.001));
  air(o, sr, 0.02, 0.5, 0.035, 7000, 15000, 61);
  return finish(o, sr, 0.38, 0.2);
}

/**
 * Seconds until a rendered sound has decayed `dbBelowPeak` dB under its peak –
 * how long it can actually be heard (and so confuse the microphone), as
 * opposed to the length of its buffer.
 */
export function audibleDuration(channels: readonly Float32Array[], sampleRate: number, dbBelowPeak = 40): number {
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak <= 0) return 0;
  const thr = peak * Math.pow(10, -dbBelowPeak / 20);
  let last = 0;
  for (const ch of channels) {
    for (let i = ch.length - 1; i > last; i--) {
      if (Math.abs(ch[i]) >= thr) {
        last = i;
        break;
      }
    }
  }
  return (last + 1) / sampleRate;
}

/** Render a UI sound effect (stereo, peak-normalised, deterministic). */
export function renderSfx(name: SfxName, sampleRate: number): StereoSamples {
  switch (name) {
    case 'correct':
      return renderCorrect(sampleRate);
    case 'wrong':
      return renderWrong(sampleRate);
    case 'complete':
      return renderComplete(sampleRate);
    case 'levelUp':
      return renderLevelUp(sampleRate);
    case 'tap':
      return renderTap(sampleRate);
    case 'streak':
      return renderStreak(sampleRate);
  }
}

/**
 * Metronome click: a short woodblock-like "tock". The accented downbeat is
 * higher and a little louder. Mono, ~70 ms.
 */
export function renderClickSamples(accent: boolean, sampleRate: number, sub = false): Float32Array<ArrayBuffer> {
  const sr = sampleRate;
  const n = Math.round(0.07 * sr);
  const out = new Float32Array(n);
  // accent (downbeat) > beat > subdivision: higher and louder to softer and lower
  const f = accent ? 1760 : sub ? 990 : 1245;
  addSoftDampedSine(out, 0, f, 1, 0.02, 0.0003, sr, 1e-6);
  addSoftDampedSine(out, 0, f * 2.36, 0.42, 0.008, 0.0002, sr, 1e-6);
  addSoftDampedSine(out, 0, f * 3.9, 0.12, 0.004, 0.0002, sr, 1e-6);
  // tiny noise transient for the "stick" contact
  const rand = mulberry32(accent ? 3 : 4);
  const tn = Math.round(0.0015 * sr);
  const tick = new Float32Array(tn);
  for (let i = 0; i < tn; i++) tick[i] = (rand() * 2 - 1) * (1 - i / tn);
  filterInPlace(tick, 'bandpass', 4200, 0.9, 0, sr);
  for (let i = 0; i < tn; i++) out[i] += tick[i] * 0.6;
  fadeOut(out, Math.round(0.02 * sr));
  const p = peakAbs(out);
  if (p > 0) scaleInPlace(out, clamp(accent ? 0.8 : sub ? 0.3 : 0.56, 0, 1) / p);
  return out;
}
