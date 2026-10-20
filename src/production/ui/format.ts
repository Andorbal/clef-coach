/**
 * How the console reads: "−6.0 dB", "1.2 kHz", "4:1", "L30", "1/8 dotted". Values are
 * shown the way a DAW's mixer shows them, so they can be copied onto a real one.
 *
 * The fader law is a desk's too: 0 dB sits about three quarters of the way up and most
 * of the travel is spent between −30 and +6 dB, where mixing happens.
 */
import { SILENT_DB } from '../dsp/params';

const FADER_LAW: readonly [number, number][] = [
  [SILENT_DB, 0],
  [-40, 0.1],
  [-30, 0.2],
  [-20, 0.36],
  [-10, 0.56],
  [-5, 0.67],
  [0, 0.78],
  [5, 0.89],
  [10, 1],
];

/** Fader position (0..1) for a level (dB, up to `max`). */
export function faderPos(db: number, max = 10): number {
  const law = FADER_LAW.filter(([d]) => d <= max);
  const top = law[law.length - 1][1];
  if (db <= SILENT_DB) return 0;
  for (let i = 1; i < law.length; i++) {
    const [d0, p0] = law[i - 1];
    const [d1, p1] = law[i];
    if (db <= d1) return (p0 + ((db - d0) / (d1 - d0)) * (p1 - p0)) / top;
  }
  return 1;
}

/** Level (dB) for a fader position. */
export function faderDb(pos: number, max = 10): number {
  const law = FADER_LAW.filter(([d]) => d <= max);
  const p = Math.max(0, Math.min(1, pos)) * law[law.length - 1][1];
  for (let i = 1; i < law.length; i++) {
    const [d0, p0] = law[i - 1];
    const [d1, p1] = law[i];
    if (p <= p1) return d0 + ((p - p0) / (p1 - p0)) * (d1 - d0);
  }
  return max;
}

/** Meter position (0..1) for a level in dBFS: −60 at the bottom, 0 at the top, a little room above for overs. */
export function meterPos(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 63));
}

const minus = (x: number, digits: number) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${Math.abs(x).toFixed(digits)}`;

export function formatDb(db: number, digits = 1): string {
  if (db <= SILENT_DB) return '−∞';
  return `${minus(Math.abs(db) < 0.05 ? 0 : db, digits)} dB`;
}

export function formatHz(f: number): string {
  if (f >= 1000) return `${(f / 1000).toFixed(f >= 10000 ? 1 : f >= 2000 ? 1 : 2)} kHz`;
  return `${Math.round(f)} Hz`;
}

export function formatPan(p: number): string {
  if (Math.abs(p) < 0.005) return 'C';
  return `${p < 0 ? 'L' : 'R'}${Math.round(Math.abs(p) * 100)}`;
}

const BEATS: Record<string, string> = { '0.125': '1/32', '0.1875': '1/32 dotted', '0.25': '1/16', '0.375': '1/16 dotted', '0.5': '1/8', '0.75': '1/8 dotted', '1': '1/4' };

/** Delay times are in beats; the common ones have names. */
export function formatBeats(b: number): string {
  return BEATS[String(Math.round(b * 10000) / 10000)] ?? `${b.toFixed(2)} beat`;
}

/** A setting as the console shows it. */
export function formatValue(key: string, v: number): string {
  const p = key.split(':')[1];
  switch (p) {
    case 'gain':
    case 'lowGain':
    case 'midGain':
    case 'presGain':
    case 'highGain':
    case 'makeup':
    case 'drive':
      return formatDb(v);
    case 'threshold':
    case 'ceiling':
      return `${minus(v, 1)} dB`;
    case 'fader':
    case 'reverb':
    case 'delay':
    case 'reverbLevel':
    case 'delayLevel':
      return formatDb(v);
    case 'hpFreq':
    case 'lowFreq':
    case 'midFreq':
    case 'presFreq':
    case 'highFreq':
      return formatHz(v);
    case 'midQ':
    case 'presQ':
      return `Q ${v.toFixed(1)}`;
    case 'ratio':
      return v >= 19.5 ? '∞:1' : `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)}:1`;
    case 'attack':
      return v < 1 ? `${v.toFixed(1)} ms` : `${Math.round(v)} ms`;
    case 'release':
    case 'reverbPredelay':
      return `${Math.round(v)} ms`;
    case 'pan':
      return formatPan(v);
    case 'reverbSize':
    case 'reverbTone':
    case 'delayTone':
    case 'delayFeedback':
      return `${Math.round(v * 100)}%`;
    case 'delayBeats':
      return formatBeats(v);
    default:
      return v >= 0.5 ? 'On' : 'Off';
  }
}

/** Names for settings, as most DAWs label them. */
export const LABELS: Record<string, string> = {
  gain: 'Trim',
  hpOn: 'High-pass',
  hpFreq: 'HP freq',
  eqOn: 'EQ',
  lowFreq: 'Low freq',
  lowGain: 'Low',
  midFreq: 'Mid freq',
  midGain: 'Mid',
  midQ: 'Mid Q',
  presFreq: 'Hi-mid freq',
  presGain: 'Hi-mid',
  presQ: 'Hi-mid Q',
  highFreq: 'High freq',
  highGain: 'High',
  compOn: 'Compressor',
  threshold: 'Threshold',
  ratio: 'Ratio',
  attack: 'Attack',
  release: 'Release',
  makeup: 'Makeup',
  fader: 'Fader',
  pan: 'Pan',
  mute: 'Mute',
  solo: 'Solo',
  reverb: 'Reverb send',
  delay: 'Delay send',
  limitOn: 'Limiter',
  drive: 'Gain',
  ceiling: 'Ceiling',
  mono: 'Mono',
  reverbSize: 'Size',
  reverbPredelay: 'Pre-delay',
  reverbTone: 'Tone',
  reverbLevel: 'Return',
  delayBeats: 'Time',
  delayFeedback: 'Feedback',
  delayTone: 'Tone',
  delayLevel: 'Return',
};

export const labelOf = (key: string) => LABELS[key.split(':')[1]] ?? key;
