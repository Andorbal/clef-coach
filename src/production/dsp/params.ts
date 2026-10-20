/**
 * The mixing console's settings: one flat map of numbers, so a lesson's starting point, a
 * quiz's target and a hint are all small deltas ("bass:fader": -9), easy to compare, store
 * and send to the audio thread one value at a time.
 *
 * Keys are `channel:param` for the channel strips (kick, snare, bass…), `master:param`
 * for the master bus and `fx:param` for the two effect returns (reverb, delay). Switches
 * are 0 or 1.
 *
 * Levels are in dB, as on every desk; pan runs −1 (hard left) to +1 (hard right).
 */
import { type NumSpec, clampParam } from '../../synthlab/dsp/params';

export type Mix = Record<string, number>;

const num = (min: number, max: number, def: number, scale: NumSpec['scale'], unit: NumSpec['unit'], extra: Partial<NumSpec> = {}): NumSpec => ({ kind: 'num', min, max, def, scale, unit, ...extra });

/** The bottom of a fader or send: below this it's off (−∞ dB). */
export const SILENT_DB = -60;

/** What every channel strip has, in signal order. */
export const CHANNEL_PARAMS = {
  /** Input trim (gain staging). */
  gain: num(-24, 24, 0, 'lin', '', { step: 0.5, bipolar: true }),
  /** High-pass filter: on, and its corner. */
  hpOn: num(0, 1, 0, 'lin', '', { step: 1 }),
  hpFreq: num(20, 800, 80, 'log', 'Hz'),
  /** Four-band EQ: low shelf, a bell, a second bell, high shelf. */
  eqOn: num(0, 1, 1, 'lin', '', { step: 1 }),
  lowFreq: num(40, 500, 120, 'log', 'Hz'),
  lowGain: num(-15, 15, 0, 'lin', '', { step: 0.5, bipolar: true }),
  midFreq: num(80, 2000, 400, 'log', 'Hz'),
  midGain: num(-15, 15, 0, 'lin', '', { step: 0.5, bipolar: true }),
  midQ: num(0.3, 8, 1.2, 'log', 'x'),
  presFreq: num(600, 10000, 3000, 'log', 'Hz'),
  presGain: num(-15, 15, 0, 'lin', '', { step: 0.5, bipolar: true }),
  presQ: num(0.3, 8, 1.2, 'log', 'x'),
  highFreq: num(2000, 16000, 8000, 'log', 'Hz'),
  highGain: num(-15, 15, 0, 'lin', '', { step: 0.5, bipolar: true }),
  /** Compressor. */
  compOn: num(0, 1, 0, 'lin', '', { step: 1 }),
  threshold: num(-50, 0, -12, 'lin', '', { step: 0.5 }),
  ratio: num(1, 20, 3, 'log', 'x', { detents: [1.5, 2, 3, 4, 6, 8, 10, 20] }),
  /** ms */
  attack: num(0.1, 100, 10, 'log', ''),
  /** ms */
  release: num(10, 1000, 120, 'log', ''),
  makeup: num(0, 24, 0, 'lin', '', { step: 0.5 }),
  /** Fader, pan, sends. */
  fader: num(SILENT_DB, 10, 0, 'pow', '', { step: 0.1 }),
  pan: num(-1, 1, 0, 'lin', '', { bipolar: true, step: 0.01 }),
  mute: num(0, 1, 0, 'lin', '', { step: 1 }),
  solo: num(0, 1, 0, 'lin', '', { step: 1 }),
  reverb: num(SILENT_DB, 0, SILENT_DB, 'pow', '', { step: 0.5 }),
  delay: num(SILENT_DB, 0, SILENT_DB, 'pow', '', { step: 0.5 }),
} satisfies Record<string, NumSpec>;

export type ChannelParam = keyof typeof CHANNEL_PARAMS;

/** The master bus: a bus compressor, then a limiter, then the fader. */
export const MASTER_PARAMS = {
  compOn: num(0, 1, 0, 'lin', '', { step: 1 }),
  threshold: num(-30, 0, -6, 'lin', '', { step: 0.5 }),
  ratio: num(1, 10, 2, 'log', 'x', { detents: [1.5, 2, 3, 4] }),
  attack: num(0.1, 100, 30, 'log', ''),
  release: num(10, 1000, 200, 'log', ''),
  makeup: num(0, 12, 0, 'lin', '', { step: 0.5 }),
  limitOn: num(0, 1, 0, 'lin', '', { step: 1 }),
  /** Gain into the limiter (how hard it's pushed). */
  drive: num(0, 18, 0, 'lin', '', { step: 0.5 }),
  ceiling: num(-12, 0, -1, 'lin', '', { step: 0.1 }),
  fader: num(SILENT_DB, 6, 0, 'pow', '', { step: 0.1 }),
  /** Monitoring only: hear the mix folded to mono (the judge ignores it, as it ignores solo). */
  mono: num(0, 1, 0, 'lin', '', { step: 1 }),
} satisfies Record<string, NumSpec>;

export type MasterParam = keyof typeof MASTER_PARAMS;

/** The effect returns. */
export const FX_PARAMS = {
  /** Reverb: room size (decay), pre-delay, brightness and return level. */
  reverbSize: num(0, 1, 0.5, 'lin', '%'),
  /** ms */
  reverbPredelay: num(0, 150, 20, 'lin', '', { step: 1 }),
  reverbTone: num(0, 1, 0.6, 'lin', '%'),
  reverbLevel: num(SILENT_DB, 6, 0, 'pow', '', { step: 0.1 }),
  /** Delay: time in beats, feedback, brightness, return level. */
  delayBeats: num(0.125, 1, 0.5, 'lin', 'x', { detents: [0.125, 0.1875, 0.25, 0.375, 0.5, 0.75, 1] }),
  delayFeedback: num(0, 0.9, 0.35, 'lin', '%'),
  delayTone: num(0, 1, 0.5, 'lin', '%'),
  delayLevel: num(SILENT_DB, 6, 0, 'pow', '', { step: 0.1 }),
} satisfies Record<string, NumSpec>;

export type FxParam = keyof typeof FX_PARAMS;

/** The spec behind a key ("bass:fader" → the fader's), or undefined for an unknown key. */
export function specOf(key: string): NumSpec | undefined {
  const [scope, param] = key.split(':');
  if (scope === 'master') return (MASTER_PARAMS as Record<string, NumSpec>)[param];
  if (scope === 'fx') return (FX_PARAMS as Record<string, NumSpec>)[param];
  return (CHANNEL_PARAMS as Record<string, NumSpec>)[param];
}

/** Every key of a console with these channels. */
export function mixKeys(channels: readonly string[]): string[] {
  return [...channels.flatMap(ch => Object.keys(CHANNEL_PARAMS).map(p => `${ch}:${p}`)), ...Object.keys(MASTER_PARAMS).map(p => `master:${p}`), ...Object.keys(FX_PARAMS).map(p => `fx:${p}`)];
}

/** A full console: defaults for these channels, then the deltas in order (later wins). */
export function makeMix(channels: readonly string[], ...deltas: (Mix | undefined)[]): Mix {
  const out: Mix = {};
  for (const k of mixKeys(channels)) out[k] = specOf(k)!.def;
  for (const d of deltas) if (d) for (const [k, v] of Object.entries(d)) if (k in out) out[k] = clampParam(specOf(k)!, v);
  return out;
}

/** A value for a key, clamped and snapped to its control. */
export function clampMix(key: string, v: number): number {
  const spec = specOf(key);
  return spec ? clampParam(spec, v) : v;
}

export const dbToGain = (db: number) => (db <= SILENT_DB ? 0 : Math.pow(10, db / 20));

/** Monitoring switches: they change what you hear, not the mix (solo, mono). */
export function withoutMonitoring(mix: Mix): Mix {
  const out: Mix = { ...mix };
  for (const k of Object.keys(out)) if (k.endsWith(':solo') || k === 'master:mono') out[k] = 0;
  return out;
}
export const gainToDb = (g: number) => (g <= 1e-9 ? -Infinity : 20 * Math.log10(g));

/** The channel a key belongs to ("bass:fader" → "bass"). */
export const channelOf = (key: string) => key.split(':')[0];
export const paramOf = (key: string) => key.split(':')[1];
