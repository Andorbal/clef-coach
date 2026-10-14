/**
 * Synthesised mallet percussion – PURE render functions (no Web Audio).
 *
 * Modal synthesis: a struck bar rings in a handful of vibration modes, each an
 * exponentially decaying sinusoid (rendered with the ResonatorBank recurrence).
 * What makes each instrument sound like itself is the tuning of those modes:
 *
 *  • Marimba – rosewood bars with a deep arch cut underneath so the 2nd mode sits
 *    two octaves up (4·f) and the 3rd near 10·f. Tube resonators reinforce the
 *    fundamental, so it blooms and rings while the overtones die quickly: the
 *    warm, round "tock".
 *  • Xylophone – shallower arch tuning the 2nd mode to a twelfth (3·f): brighter,
 *    woodier and much shorter. (It sounds an octave above written; the engine
 *    passes the sounding pitch.)
 *  • Glockenspiel – un-tuned steel bars: the free-bar modes 1 : 2.76 : 5.40 : 8.93
 *    give the bell-like shimmer, and steel rings for seconds.
 *  • Vibraphone – aluminium bars tuned like a marimba (1 : 4 : 10) with very long
 *    decay and the motor's gentle tremolo.
 *
 * The mallet adds a short filtered-noise contact transient; harder strikes
 * (higher velocity) excite the upper modes more. Output is loudness-normalised
 * on the attack like the piano and guitar renderers.
 */
import { midiToFreq } from '../../music/pitch';
import { ResonatorBank, clamp, fadeIn, fadeOut, filterInPlace, interp, mulberry32, peakAbs, rmsRange, scaleInPlace } from '../dsp/util';

export type MalletVoice = 'marimba' | 'xylophone' | 'glockenspiel' | 'vibraphone';

export interface MalletRenderOptions {
  duration?: number;
  seed?: number;
  out?: Float32Array;
}

interface ModeSpec {
  ratio: number;
  /** amplitude at medium velocity */
  amp: number;
  /** extra amplitude per unit velocity above 0.5 (brightness) */
  bright: number;
  /** decay time as a fraction of the fundamental's */
  decay: number;
}

interface VoiceSpec {
  modes: ModeSpec[];
  /** fundamental decay τ (s) across the range: [midi, τ] */
  tau: [number, number][];
  /** buffer length (s) across the range */
  length: [number, number][];
  /** mallet contact noise: level, low-pass cutoff (Hz) */
  knock: number;
  knockCut: number;
  tremolo?: { rate: number; depth: number };
  targetRms: number;
}

const SPECS: Record<MalletVoice, VoiceSpec> = {
  marimba: {
    modes: [
      { ratio: 1, amp: 1, bright: 0, decay: 1 },
      { ratio: 3.99, amp: 0.22, bright: 0.35, decay: 0.16 },
      { ratio: 9.95, amp: 0.06, bright: 0.18, decay: 0.05 },
    ],
    tau: [[45, 1.25], [60, 0.85], [72, 0.55], [84, 0.32], [96, 0.18]],
    length: [[45, 2.6], [72, 1.6], [96, 0.8]],
    knock: 0.12,
    knockCut: 1800,
    targetRms: 0.18,
  },
  xylophone: {
    modes: [
      { ratio: 1, amp: 1, bright: 0, decay: 1 },
      { ratio: 3.0, amp: 0.38, bright: 0.45, decay: 0.42 },
      { ratio: 6.1, amp: 0.12, bright: 0.25, decay: 0.12 },
    ],
    tau: [[60, 0.42], [72, 0.3], [84, 0.2], [96, 0.13], [108, 0.08]],
    length: [[60, 1.2], [84, 0.8], [108, 0.5]],
    knock: 0.3,
    knockCut: 5200,
    targetRms: 0.17,
  },
  glockenspiel: {
    modes: [
      { ratio: 1, amp: 1, bright: 0, decay: 1 },
      { ratio: 2.756, amp: 0.42, bright: 0.4, decay: 0.45 },
      { ratio: 5.404, amp: 0.2, bright: 0.3, decay: 0.22 },
      { ratio: 8.933, amp: 0.08, bright: 0.2, decay: 0.12 },
    ],
    tau: [[79, 1.8], [91, 1.3], [103, 0.8], [110, 0.6]],
    length: [[79, 3.2], [96, 2.4], [110, 1.6]],
    knock: 0.22,
    knockCut: 7000,
    targetRms: 0.14,
  },
  vibraphone: {
    modes: [
      { ratio: 1, amp: 1, bright: 0, decay: 1 },
      { ratio: 3.98, amp: 0.2, bright: 0.3, decay: 0.3 },
      { ratio: 9.9, amp: 0.05, bright: 0.12, decay: 0.08 },
    ],
    tau: [[53, 3.2], [65, 2.6], [77, 2.0], [89, 1.5]],
    length: [[53, 4.2], [77, 3.4], [89, 2.8]],
    knock: 0.08,
    knockCut: 2600,
    tremolo: { rate: 5.2, depth: 0.22 },
    targetRms: 0.16,
  },
};

/** Buffer length in seconds for a (sounding) note. */
export function malletNoteDuration(voice: MalletVoice, midi: number): number {
  return interp(SPECS[voice].length, midi);
}

export function malletNoteLength(voice: MalletVoice, midi: number, sampleRate: number): number {
  return Math.max(1, Math.round(malletNoteDuration(voice, clamp(Math.round(midi), 24, 120)) * sampleRate));
}

/** How long the note stays clearly audible (for the microphone's self-hearing guard). */
export function malletAudibleSeconds(voice: MalletVoice, midi: number): number {
  return Math.min(malletNoteDuration(voice, midi), interp(SPECS[voice].tau, midi) * 2.2);
}

/**
 * Render one struck bar as mono samples in [-1, 1].
 * @param midi SOUNDING pitch
 * @param velocity 0..1 – mallet hardness / brightness (level is applied at playback)
 */
export function renderMalletSamples(voice: MalletVoice, midi: number, velocity: number, sampleRate: number, opts: MalletRenderOptions = {}): Float32Array {
  const spec = SPECS[voice];
  const m = clamp(Math.round(midi), 24, 120);
  const v = clamp(velocity, 0, 1);
  const sr = sampleRate;
  const f0 = midiToFreq(m);
  const len = opts.out ? opts.out.length : Math.max(1, Math.round((opts.duration ?? malletNoteDuration(voice, m)) * sr));
  const out: Float32Array = opts.out ?? new Float32Array(len);
  const rand = mulberry32(opts.seed ?? m * 7919 + 11);
  const tau = interp(spec.tau, m);

  // ---- modes ----
  const bank = new ResonatorBank();
  for (const mode of spec.modes) {
    const f = f0 * mode.ratio * (1 + (rand() - 0.5) * 0.002);
    if (f >= sr * 0.45) continue;
    const amp = mode.amp + mode.bright * Math.max(0, v - 0.5) * 2 - (mode.ratio > 1 ? (0.5 - Math.min(0.5, v)) * mode.amp : 0);
    if (amp <= 0) continue;
    bank.add(f, amp, tau * mode.decay, sr);
    // a faint detuned twin gives the slight beating of a real bar + resonator
    if (mode.ratio === 1) bank.add(f * 1.0011, amp * 0.12, tau * 0.8, sr);
  }
  bank.renderInto(out);

  // ---- mallet contact ----
  const knockLen = Math.min(len, Math.round(0.012 * sr));
  if (knockLen > 8 && spec.knock > 0) {
    const k = new Float32Array(knockLen);
    for (let i = 0; i < knockLen; i++) k[i] = (rand() * 2 - 1) * Math.exp((-6 * i) / knockLen);
    filterInPlace(k, 'lowpass', Math.min(sr * 0.45, spec.knockCut * (0.6 + 0.8 * v)), 0.7, 0, sr);
    filterInPlace(k, 'highpass', Math.max(80, f0 * 0.5), 0.7, 0, sr);
    const ref = rmsRange(out, 0, Math.min(len, Math.round(0.03 * sr))) || 0.1;
    const kr = rmsRange(k) || 1e-6;
    const g = (ref * spec.knock * (0.6 + 0.8 * v)) / kr;
    for (let i = 0; i < knockLen; i++) out[i] += k[i] * g;
  }

  // ---- vibraphone motor ----
  if (spec.tremolo) {
    const { rate, depth } = spec.tremolo;
    const w = (2 * Math.PI * rate) / sr;
    const ph = rand() * Math.PI * 2;
    for (let i = 0; i < len; i++) out[i] *= 1 - depth * 0.5 * (1 + Math.sin(w * i + ph));
  }

  fadeIn(out, Math.round(0.0004 * sr));
  fadeOut(out, Math.round(Math.min(0.25 * len, 0.6 * sr)));

  const early = rmsRange(out, 0, Math.min(len, Math.round(0.2 * sr)));
  if (early > 0) {
    let g = spec.targetRms / early;
    const pk = peakAbs(out) * g;
    if (pk > 0.95) g *= 0.95 / pk;
    scaleInPlace(out, g);
  }
  return out;
}
