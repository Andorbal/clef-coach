/**
 * Pitch primitives. A Pitch is a *spelled* note (letter + accidental + octave),
 * because notation cares whether a sound is F# or Gb. MIDI numbers are used for
 * comparing what was played against what was written.
 */

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export const STEPS: readonly Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const STEP_SEMIS: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export interface Pitch {
  step: Step;
  /** -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp */
  alter: number;
  /** Scientific pitch notation octave; middle C is C4. */
  octave: number;
}

const PITCH_RE = /^([A-Ga-g])(##|bb|x|#|b|n)?(-?\d)$/;

export function parsePitch(s: string): Pitch {
  const m = PITCH_RE.exec(s.trim());
  if (!m) throw new Error(`Invalid pitch "${s}"`);
  const step = m[1].toUpperCase() as Step;
  const acc = m[2] ?? '';
  const alter = acc === '#' ? 1 : acc === '##' || acc === 'x' ? 2 : acc === 'b' ? -1 : acc === 'bb' ? -2 : 0;
  return { step, alter, octave: parseInt(m[3], 10) };
}

export function isPitchString(s: string): boolean {
  return PITCH_RE.test(s.trim());
}

export function accidentalString(alter: number): string {
  switch (alter) {
    case 1: return '#';
    case 2: return '##';
    case -1: return 'b';
    case -2: return 'bb';
    default: return '';
  }
}

/** Pretty accidental using real musical symbols. */
export function accidentalSymbol(alter: number): string {
  switch (alter) {
    case 1: return '♯';
    case 2: return '𝄪';
    case -1: return '♭';
    case -2: return '𝄫';
    default: return '';
  }
}

export function pitchToString(p: Pitch): string {
  return `${p.step}${accidentalString(p.alter)}${p.octave}`;
}

export function midiOf(p: Pitch): number {
  return 12 * (p.octave + 1) + STEP_SEMIS[p.step] + p.alter;
}

export function midiOfString(s: string): number {
  return midiOf(parsePitch(s));
}

/** Position on the staff measured in diatonic steps (C0 = 0). */
export function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + STEPS.indexOf(p.step);
}

export function fromDiatonic(index: number, alter = 0): Pitch {
  const octave = Math.floor(index / 7);
  const step = STEPS[((index % 7) + 7) % 7];
  return { step, alter, octave };
}

export function samePitch(a: Pitch, b: Pitch): boolean {
  return a.step === b.step && a.alter === b.alter && a.octave === b.octave;
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Fractional MIDI number for a frequency (69.0 == A4). */
export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

const SHARP_NAMES: [Step, number][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];
const FLAT_NAMES: [Step, number][] = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
];

/**
 * Spell a MIDI number. `fifths` is the key signature context (negative =
 * flat keys) so that played notes are named the way the key would write them.
 */
export function spellMidi(midi: number, fifths = 0): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const [step, alter] = (fifths < 0 ? FLAT_NAMES : SHARP_NAMES)[pc];
  // octave is computed from the *spelled* note so that e.g. B#3 / Cb5 work
  const octave = Math.floor((midi - STEP_SEMIS[step] - alter) / 12) - 1;
  return { step, alter, octave };
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export type NoteNaming = 'letter' | 'solfege' | 'german';

const SOLFEGE: Record<Step, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

/** Human label for a step+alter, without octave. */
export function stepLabel(step: Step, alter: number, naming: NoteNaming = 'letter'): string {
  if (naming === 'solfege') return SOLFEGE[step] + accidentalSymbol(alter);
  if (naming === 'german') {
    if (step === 'B' && alter === 0) return 'H';
    if (step === 'B' && alter === -1) return 'B';
  }
  return step + accidentalSymbol(alter);
}

export function pitchLabel(p: Pitch, naming: NoteNaming = 'letter', withOctave = false): string {
  return stepLabel(p.step, p.alter, naming) + (withOctave ? String(p.octave) : '');
}

/** VexFlow key string, e.g. "c#/4". */
export function vexKey(p: Pitch): string {
  return `${p.step.toLowerCase()}${accidentalString(p.alter)}/${p.octave}`;
}

export function transposeOctaves(p: Pitch, octaves: number): Pitch {
  return { ...p, octave: p.octave + octaves };
}

/** Is this MIDI note a black key on the piano? */
export function isBlackKey(midi: number): boolean {
  const pc = pitchClass(midi);
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

/** Simple interval number (1 = unison, 2 = second, ... 8 = octave) between two pitches. */
export function intervalNumber(a: Pitch, b: Pitch): number {
  return Math.abs(diatonicIndex(b) - diatonicIndex(a)) + 1;
}

export const INTERVAL_NAMES: Record<number, string> = {
  1: 'Unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'Octave',
  9: '9th', 10: '10th',
};

/** Inclusive list of natural (white-key) pitches between two pitches. */
export function naturalRange(low: string | Pitch, high: string | Pitch): Pitch[] {
  const lo = typeof low === 'string' ? parsePitch(low) : low;
  const hi = typeof high === 'string' ? parsePitch(high) : high;
  const out: Pitch[] = [];
  for (let d = diatonicIndex(lo); d <= diatonicIndex(hi); d++) out.push(fromDiatonic(d));
  return out;
}

export function pitchesFrom(list: string): Pitch[] {
  return list.trim().split(/\s+/).filter(Boolean).map(parsePitch);
}
