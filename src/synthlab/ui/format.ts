/**
 * How values read on the panel: "120 ms", "1.2 kHz", "+7 st", "64%". Short enough for a
 * label under a knob, precise enough to copy onto a real synth.
 */
import { ALGORITHMS, clampAlgo } from '../dsp/fm';
import { PARAMS, type ParamKey, type Patch } from '../dsp/params';

const OPTION_LABELS: Record<string, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  saw: 'Saw',
  square: 'Square',
  random: 'Random',
  lowpass: 'Low-pass',
  highpass: 'High-pass',
  bandpass: 'Band-pass',
  notch: 'Notch',
  '12': '12 dB',
  '24': '24 dB',
  poly: 'Poly',
  mono: 'Mono',
  legato: 'Legato',
  basic: 'Basic shapes',
  pwm: 'Pulse width',
  harmonic: 'Harmonics',
  vowel: 'Vowels',
  metal: 'Metallic',
  sync: 'Sync sweep',
  subtractive: 'Subtractive',
  fm: 'FM',
  additive: 'Additive',
  wavetable: 'Wavetable',
};

export function optionLabel(v: string): string {
  return OPTION_LABELS[v] ?? v;
}

function seconds(s: number): string {
  if (s <= 0) return '0 ms';
  if (s < 0.01) return `${(s * 1000).toFixed(1)} ms`;
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  return `${s < 10 ? s.toFixed(2) : s.toFixed(1)} s`;
}

function hertz(f: number): string {
  if (f >= 1000) return `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz`;
  if (f >= 100) return `${Math.round(f)} Hz`;
  return `${f.toFixed(f < 1 ? 2 : 1)} Hz`;
}

const signed = (x: number, digits = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(digits)}`;

/** A value as the panel shows it. */
export function formatValue<K extends ParamKey>(key: K, value: Patch[K]): string {
  const spec = PARAMS[key];
  if (spec.kind === 'bool') return value ? 'On' : 'Off';
  if (spec.kind === 'enum') return optionLabel(String(value));
  const v = value as number;
  if (key === 'fmAlgo') return ALGORITHMS[clampAlgo(v)].name;
  if (key === 'osc1Pw' || key === 'osc2Pw') return `${Math.round(v * 100)}%`;
  switch (spec.unit) {
    case 's':
      return seconds(v);
    case 'Hz':
      return hertz(v);
    case '%':
      return spec.bipolar ? `${signed(v * 100)}%` : `${Math.round(v * 100)}%`;
    case 'st':
      return `${signed(v, Number.isInteger(v) ? 0 : 1)} st`;
    case 'ct':
      return spec.bipolar ? `${signed(v)} ct` : `${Math.round(v)} ct`;
    case 'oct':
      return spec.bipolar ? signed(v) : `${v.toFixed(v < 10 ? 2 : 1)} oct`;
    case 'x':
      return `×${v.toFixed(2)}`;
    case 'harm':
      return spec.bipolar ? signed(v, 1) : v.toFixed(1);
    case 'voices':
      return v === 1 ? 'Off' : `${v} voices`;
    default:
      return String(Math.round(v * 100) / 100);
  }
}
