/**
 * Sustained band voices: organ, strings, pads, brass, reeds, flutes, synth leads and
 * choir, built live from Web Audio oscillators.
 *
 * The rendered instruments (piano, guitar, mallets…) are struck or plucked: they decay
 * by themselves, so one buffer per note does. A held string chord or organ note has to
 * sound for as long as the music says, so these are small subtractive synths instead:
 * two or three detuned oscillators → a low-pass filter that follows the pitch (with a
 * little envelope for brass) → an amplitude envelope, plus a vibrato that comes in
 * after the attack, like a player's. Each note costs a handful of nodes, cheap enough
 * for a string section on a tablet.
 */
import { clamp } from '../dsp/util';

export type LivePatch = 'organ' | 'church-organ' | 'strings' | 'solo-strings' | 'pad' | 'brass' | 'reed' | 'flute' | 'lead' | 'choir';

export const LIVE_PATCHES: readonly LivePatch[] = ['organ', 'church-organ', 'strings', 'solo-strings', 'pad', 'brass', 'reed', 'flute', 'lead', 'choir'];

interface OscSpec {
  type: OscillatorType | 'organ' | 'church' | 'reed';
  /** cents */
  detune: number;
  gain: number;
  /** frequency multiple (0.5 = an octave down) */
  ratio?: number;
}

interface PatchSpec {
  oscs: OscSpec[];
  /** low-pass cutoff as a multiple of the note's frequency, clamped to [min, max] Hz */
  filter?: { mult: number; min: number; max: number; q: number; type?: BiquadFilterType; env?: { from: number; time: number } };
  /** extra band-pass formants (choir) */
  formants?: { freq: number; q: number; gain: number }[];
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  vibrato?: { rate: number; cents: number; delay: number };
  tremolo?: { rate: number; depth: number };
  /** soft notes start more slowly (bowed and blown instruments) */
  velAttack?: number;
  level: number;
}

const PATCHES: Record<LivePatch, PatchSpec> = {
  organ: {
    oscs: [
      { type: 'organ', detune: 0, gain: 1 },
      { type: 'sine', detune: 0, gain: 0.35, ratio: 0.5 },
    ],
    attack: 0.006,
    decay: 0.05,
    sustain: 1,
    release: 0.06,
    tremolo: { rate: 6.2, depth: 0.12 },
    vibrato: { rate: 6.2, cents: 4, delay: 0 },
    level: 0.32,
  },
  'church-organ': {
    oscs: [
      { type: 'church', detune: 0, gain: 1 },
      { type: 'sine', detune: 1.5, gain: 0.45, ratio: 0.5 },
      { type: 'church', detune: -2, gain: 0.3, ratio: 2 },
    ],
    filter: { mult: 10, min: 1500, max: 9000, q: 0.5 },
    attack: 0.05,
    decay: 0.1,
    sustain: 1,
    release: 0.35,
    level: 0.26,
  },
  strings: {
    oscs: [
      { type: 'sawtooth', detune: -9, gain: 0.5 },
      { type: 'sawtooth', detune: 0, gain: 0.5 },
      { type: 'sawtooth', detune: 8, gain: 0.5 },
    ],
    filter: { mult: 5, min: 700, max: 6500, q: 0.6 },
    attack: 0.22,
    decay: 0.4,
    sustain: 0.9,
    release: 0.45,
    vibrato: { rate: 5.4, cents: 9, delay: 0.35 },
    velAttack: 0.25,
    level: 0.42,
  },
  'solo-strings': {
    oscs: [
      { type: 'sawtooth', detune: 0, gain: 0.7 },
      { type: 'sawtooth', detune: 4, gain: 0.35 },
    ],
    filter: { mult: 6, min: 900, max: 7000, q: 1.2 },
    attack: 0.09,
    decay: 0.3,
    sustain: 0.85,
    release: 0.25,
    vibrato: { rate: 5.8, cents: 18, delay: 0.25 },
    velAttack: 0.12,
    level: 0.26,
  },
  pad: {
    oscs: [
      { type: 'sawtooth', detune: -6, gain: 0.45 },
      { type: 'sawtooth', detune: 6, gain: 0.45 },
      { type: 'triangle', detune: 0, gain: 0.6, ratio: 0.5 },
    ],
    filter: { mult: 2.5, min: 500, max: 3200, q: 0.7, env: { from: 1.3, time: 0.8 } },
    attack: 0.55,
    decay: 0.6,
    sustain: 0.85,
    release: 0.9,
    vibrato: { rate: 0.35, cents: 6, delay: 0 },
    level: 0.42,
  },
  brass: {
    oscs: [
      { type: 'sawtooth', detune: -4, gain: 0.55 },
      { type: 'sawtooth', detune: 4, gain: 0.55 },
    ],
    filter: { mult: 5, min: 600, max: 7000, q: 0.9, env: { from: 1.4, time: 0.09 } },
    attack: 0.035,
    decay: 0.25,
    sustain: 0.75,
    release: 0.14,
    vibrato: { rate: 5.2, cents: 7, delay: 0.3 },
    velAttack: 0.03,
    level: 0.24,
  },
  reed: {
    oscs: [
      { type: 'reed', detune: 0, gain: 0.8 },
      { type: 'sawtooth', detune: 3, gain: 0.25 },
    ],
    filter: { mult: 4, min: 700, max: 5000, q: 1.4 },
    attack: 0.04,
    decay: 0.2,
    sustain: 0.85,
    release: 0.1,
    vibrato: { rate: 5, cents: 10, delay: 0.3 },
    velAttack: 0.04,
    level: 0.28,
  },
  flute: {
    oscs: [
      { type: 'sine', detune: 0, gain: 0.9 },
      { type: 'triangle', detune: 2, gain: 0.35, ratio: 2 },
    ],
    filter: { mult: 6, min: 1500, max: 8000, q: 0.5 },
    attack: 0.07,
    decay: 0.2,
    sustain: 0.9,
    release: 0.12,
    vibrato: { rate: 5, cents: 12, delay: 0.25 },
    velAttack: 0.06,
    level: 0.36,
  },
  lead: {
    oscs: [
      { type: 'sawtooth', detune: -5, gain: 0.5 },
      { type: 'square', detune: 5, gain: 0.35 },
    ],
    filter: { mult: 7, min: 900, max: 8000, q: 1.5, env: { from: 1.5, time: 0.12 } },
    attack: 0.008,
    decay: 0.2,
    sustain: 0.8,
    release: 0.12,
    vibrato: { rate: 5.5, cents: 8, delay: 0.4 },
    level: 0.2,
  },
  choir: {
    oscs: [
      { type: 'sawtooth', detune: -7, gain: 0.5 },
      { type: 'sawtooth', detune: 7, gain: 0.5 },
    ],
    filter: { mult: 8, min: 1200, max: 5000, q: 0.5 },
    formants: [
      { freq: 750, q: 5, gain: 1 },
      { freq: 1150, q: 6, gain: 0.7 },
      { freq: 2600, q: 8, gain: 0.25 },
    ],
    attack: 0.3,
    decay: 0.4,
    sustain: 0.9,
    release: 0.5,
    vibrato: { rate: 5, cents: 10, delay: 0.3 },
    velAttack: 0.2,
    level: 0.5,
  },
};

/** Seconds a patch keeps sounding after its note ends. */
export function liveRelease(patch: LivePatch): number {
  return PATCHES[patch].release;
}

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/** Drawbar organ (8′ 4′ 2⅔′ 2′ …), a principal chorus, and a hollow clarinet-like reed. */
function periodicWave(ctx: BaseAudioContext, kind: 'organ' | 'church' | 'reed'): PeriodicWave {
  let cache = waves.get(ctx);
  if (!cache) waves.set(ctx, (cache = new Map()));
  const hit = cache.get(kind);
  if (hit) return hit;
  const n = 16;
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  const harmonics: number[] =
    kind === 'organ'
      ? [0, 1, 0.65, 0.42, 0.3, 0, 0.14, 0, 0.1]
      : kind === 'church'
        ? Array.from({ length: n + 1 }, (_, h) => (h === 0 ? 0 : 1 / Math.pow(h, 1.15)))
        : // odd harmonics strong, even ones weak: a clarinet's closed pipe
          Array.from({ length: n + 1 }, (_, h) => (h === 0 ? 0 : h % 2 ? 1 / h : 0.12 / h));
  harmonics.forEach((a, h) => {
    if (h <= n) imag[h] = a;
  });
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  cache.set(kind, wave);
  return wave;
}

export interface LiveNote {
  /** Context time the note has fully died away. */
  readonly end: number;
  /** Fade out now (or at `at`) and stop. */
  stop(at?: number): void;
}

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Play a note of a live patch for `duration` seconds from `when`, into `out`.
 * Velocity 0..1 sets level, attack and brightness.
 */
export function playLive(ctx: BaseAudioContext, patch: LivePatch, midi: number, velocity: number, when: number, duration: number, out: AudioNode): LiveNote {
  const p = PATCHES[patch];
  const vel = clamp(velocity, 0, 1);
  const f = freq(midi);
  const start = Math.max(when, ctx.currentTime);
  const attack = Math.min(p.attack + (p.velAttack ?? 0) * (1 - vel), Math.max(0.005, duration * 0.8));
  const releaseAt = start + Math.max(duration, attack);
  const end = releaseAt + p.release * 5;
  const peak = p.level * (0.25 + 0.75 * Math.pow(vel, 1.3));

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(peak, start + attack);
  amp.gain.setTargetAtTime(peak * p.sustain, start + attack, Math.max(0.01, p.decay / 3));
  amp.gain.setTargetAtTime(0, releaseAt, Math.max(0.01, p.release / 3));

  let head: AudioNode = amp;
  const nodes: AudioScheduledSourceNode[] = [];
  if (p.tremolo) {
    const trem = ctx.createGain();
    trem.gain.value = 1 - p.tremolo.depth / 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = p.tremolo.rate;
    const depth = ctx.createGain();
    depth.gain.value = p.tremolo.depth / 2;
    lfo.connect(depth).connect(trem.gain);
    lfo.start(start);
    lfo.stop(end);
    nodes.push(lfo);
    amp.connect(trem);
    head = trem;
  }
  head.connect(out);

  // filter (and formants) between the oscillators and the envelope
  let into: AudioNode = amp;
  if (p.formants) {
    const sum = ctx.createGain();
    for (const fm of p.formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fm.freq;
      bp.Q.value = fm.q;
      const g = ctx.createGain();
      g.gain.value = fm.gain;
      sum.connect(bp).connect(g).connect(amp);
    }
    into = sum;
  }
  if (p.filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = p.filter.type ?? 'lowpass';
    lp.Q.value = p.filter.q;
    const bright = 0.7 + 0.6 * vel;
    const cutoff = clamp(f * p.filter.mult * bright, p.filter.min, p.filter.max);
    if (p.filter.env) {
      lp.frequency.setValueAtTime(clamp(cutoff * p.filter.env.from * bright, p.filter.min, 16000), start);
      lp.frequency.setTargetAtTime(cutoff, start, p.filter.env.time);
    } else lp.frequency.value = cutoff;
    lp.connect(into);
    into = lp;
  }

  let vib: GainNode | null = null;
  if (p.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = p.vibrato.rate;
    vib = ctx.createGain();
    vib.gain.setValueAtTime(0, start);
    vib.gain.linearRampToValueAtTime(0, start + p.vibrato.delay);
    vib.gain.linearRampToValueAtTime(p.vibrato.cents, start + p.vibrato.delay + 0.4);
    lfo.connect(vib);
    lfo.start(start);
    lfo.stop(end);
    nodes.push(lfo);
  }
  const total = p.oscs.reduce((a, o) => a + o.gain, 0);
  for (const o of p.oscs) {
    const osc = ctx.createOscillator();
    if (o.type === 'organ' || o.type === 'church' || o.type === 'reed') osc.setPeriodicWave(periodicWave(ctx, o.type));
    else osc.type = o.type;
    osc.frequency.value = f * (o.ratio ?? 1);
    osc.detune.value = o.detune;
    if (vib) vib.connect(osc.detune);
    const g = ctx.createGain();
    g.gain.value = o.gain / total;
    osc.connect(g).connect(into);
    osc.start(start);
    osc.stop(end);
    nodes.push(osc);
  }
  let stopped = false;
  const last = nodes[nodes.length - 1];
  last.onended = () => {
    try {
      amp.disconnect();
      head.disconnect();
    } catch {
      /* already gone */
    }
  };
  return {
    end,
    stop(at = ctx.currentTime) {
      if (stopped) return;
      stopped = true;
      const t = Math.max(at, ctx.currentTime);
      const g = amp.gain;
      if (t <= start) {
        // not started yet: it never sounds
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        for (const n of nodes) {
          try {
            n.stop(t);
          } catch {
            /* already stopped */
          }
        }
        return;
      }
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t);
      else {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
      }
      g.setTargetAtTime(0, t, 0.02);
      for (const n of nodes) {
        try {
          n.stop(t + 0.15);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}
