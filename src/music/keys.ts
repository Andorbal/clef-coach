import { STEPS, type Pitch, type Step, diatonicIndex, fromDiatonic, midiOf } from './pitch';

export type Mode = 'major' | 'minor';

export interface KeySig {
  /** Number of sharps (positive) or flats (negative), -7..7 */
  fifths: number;
  mode: Mode;
}

export const SHARP_ORDER: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLAT_ORDER: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const MAJOR_TONICS: Record<number, [Step, number]> = {
  [-7]: ['C', -1], [-6]: ['G', -1], [-5]: ['D', -1], [-4]: ['A', -1], [-3]: ['E', -1],
  [-2]: ['B', -1], [-1]: ['F', 0], 0: ['C', 0], 1: ['G', 0], 2: ['D', 0], 3: ['A', 0],
  4: ['E', 0], 5: ['B', 0], 6: ['F', 1], 7: ['C', 1],
};
const MINOR_TONICS: Record<number, [Step, number]> = {
  [-7]: ['A', -1], [-6]: ['E', -1], [-5]: ['B', -1], [-4]: ['F', 0], [-3]: ['C', 0],
  [-2]: ['G', 0], [-1]: ['D', 0], 0: ['A', 0], 1: ['E', 0], 2: ['B', 0], 3: ['F', 1],
  4: ['C', 1], 5: ['G', 1], 6: ['D', 1], 7: ['A', 1],
};

export const C_MAJOR: KeySig = { fifths: 0, mode: 'major' };

export function tonicOf(key: KeySig): { step: Step; alter: number } {
  const [step, alter] = (key.mode === 'major' ? MAJOR_TONICS : MINOR_TONICS)[key.fifths];
  return { step, alter };
}

/** Alteration that the key signature applies to each letter. */
export function keyAlterations(fifths: number): Record<Step, number> {
  const alt: Record<Step, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) for (let i = 0; i < fifths; i++) alt[SHARP_ORDER[i]] = 1;
  if (fifths < 0) for (let i = 0; i < -fifths; i++) alt[FLAT_ORDER[i]] = -1;
  return alt;
}

export function keyName(key: KeySig): string {
  const { step, alter } = tonicOf(key);
  const acc = alter === 1 ? '#' : alter === -1 ? 'b' : '';
  return `${step}${acc}${key.mode === 'minor' ? 'm' : ''}`;
}

/** Display name like "G major" / "E minor" with real accidental glyphs. */
export function keyDisplayName(key: KeySig): string {
  const { step, alter } = tonicOf(key);
  const acc = alter === 1 ? '♯' : alter === -1 ? '♭' : '';
  return `${step}${acc} ${key.mode}`;
}

export function parseKey(name: string): KeySig {
  const m = /^([A-G])(#|b)?(m)?$/.exec(name.trim());
  if (!m) throw new Error(`Invalid key "${name}"`);
  const step = m[1] as Step;
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const mode: Mode = m[3] ? 'minor' : 'major';
  const table = mode === 'major' ? MAJOR_TONICS : MINOR_TONICS;
  for (let f = -7; f <= 7; f++) {
    const [s, a] = table[f];
    if (s === step && a === alter) return { fifths: f, mode };
  }
  throw new Error(`Unsupported key "${name}"`);
}

/** VexFlow key signature spec ("G", "Bb", "F#m", ...). */
export function vexKeySpec(key: KeySig): string {
  return keyName(key);
}

export type ScaleKind = 'major' | 'natural-minor' | 'harmonic-minor' | 'melodic-minor';

/**
 * Return the pitches of a scale starting at the tonic in the given octave,
 * spanning `octaves` octaves (inclusive of the top tonic).
 */
export function scalePitches(tonic: { step: Step; alter: number }, octave: number, kind: ScaleKind, octaves = 1): Pitch[] {
  const majorSemis = [0, 2, 4, 5, 7, 9, 11];
  const minorSemis = [0, 2, 3, 5, 7, 8, 10];
  const semis = kind === 'major' ? majorSemis
    : kind === 'natural-minor' ? minorSemis
    : kind === 'harmonic-minor' ? [0, 2, 3, 5, 7, 8, 11]
    : [0, 2, 3, 5, 7, 9, 11];
  const start: Pitch = { step: tonic.step, alter: tonic.alter, octave };
  const base = midiOf(start);
  const startD = diatonicIndex(start);
  const out: Pitch[] = [];
  for (let i = 0; i <= 7 * octaves; i++) {
    const deg = i % 7;
    const oct = Math.floor(i / 7);
    const target = base + semis[deg] + 12 * oct;
    const natural = fromDiatonic(startD + i);
    out.push({ ...natural, alter: target - midiOf(natural) });
  }
  return out;
}

/** Pitches of the key's scale (natural minor for minor keys) between two diatonic indexes. */
export function keyScaleRange(key: KeySig, lowD: number, highD: number): Pitch[] {
  const alt = keyAlterations(key.fifths);
  const out: Pitch[] = [];
  for (let d = lowD; d <= highD; d++) {
    const p = fromDiatonic(d);
    out.push({ ...p, alter: alt[p.step] });
  }
  return out;
}

/** Apply the key signature to a natural pitch. */
export function inKey(p: Pitch, key: KeySig): Pitch {
  return { ...p, alter: keyAlterations(key.fifths)[p.step] };
}

/** Scale degree (0-based) of a pitch within a key, or -1 if not diatonic. */
export function scaleDegree(p: Pitch, key: KeySig): number {
  const t = tonicOf(key);
  const deg = (STEPS.indexOf(p.step) - STEPS.indexOf(t.step) + 7) % 7;
  return deg;
}

export const ALL_MAJOR_KEYS: KeySig[] = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7].map(f => ({ fifths: f, mode: 'major' as Mode }));
