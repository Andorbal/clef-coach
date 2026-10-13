import { type Step, STEPS, STEP_SEMIS, accidentalSymbol, pitchClass, spellMidi, stepLabel } from './pitch';

const TEMPLATES: [string, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['°', [0, 3, 6]],
  ['+', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['ø7', [0, 3, 6, 10]],
  ['°7', [0, 3, 6, 9]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['m(maj7)', [0, 3, 7, 11]],
  ['7sus4', [0, 5, 7, 10]],
  ['add9', [0, 2, 4, 7]],
];

const INTERVALS = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];

const pcName = (pc: number, flats: boolean) => {
  const p = spellMidi(60 + pc, flats ? -1 : 1);
  return stepLabel(p.step, p.alter);
};

/** Name what's being held: an interval for two notes, a chord symbol for three or more. */
export function describeNotes(midis: number[]): string | null {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const pcs = [...new Set(sorted.map(pitchClass))];
  if (pcs.length === 1) return sorted.length > 1 ? 'Octave' : null;
  if (pcs.length === 2 && sorted.length >= 2) {
    const iv = (sorted[sorted.length - 1] - sorted[0]) % 12;
    const compound = sorted[sorted.length - 1] - sorted[0] > 12;
    return `${compound ? 'Compound ' : ''}${INTERVALS[iv === 0 ? 0 : iv]}`;
  }
  const bassPc = pitchClass(sorted[0]);
  for (const root of [bassPc, ...pcs.filter(p => p !== bassPc)]) {
    const rel = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const [sym, tpl] of TEMPLATES) {
      if (tpl.length === rel.length && tpl.every((x, i) => x === rel[i])) {
        const flats = [1, 3, 5, 8, 10].includes(root) && !['', '7', 'maj7', '6', 'add9'].includes(sym);
        const rootName = pcName(root, flats || [3, 8, 10].includes(root));
        const bass = root !== bassPc ? `/${pcName(bassPc, [3, 8, 10].includes(bassPc))}` : '';
        return `${rootName}${sym}${bass}`;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Chord symbols: qualities, parsing and spelling
// ---------------------------------------------------------------------------


/** A chord tone: semitones above the root and its scale degree (3 = third, 7 = seventh …). */
export type ChordTone = [semis: number, degree: number];

export interface ChordQuality {
  id: string;
  /** Canonical suffix, e.g. "", "m", "7", "maj7", "m7b5". */
  suffix: string;
  name: string;
  /** Other ways people write it. */
  aliases: string[];
  tones: ChordTone[];
  /** Degrees that may be left out of a voicing (usually the 5th; the 9th's 5th, the 13th's 11th…). */
  optional: number[];
  /** Grouping for pickers. */
  family: 'triad' | 'seventh' | 'sixth' | 'extended' | 'suspended' | 'other';
}

const Q = (id: string, suffix: string, name: string, aliases: string[], tones: ChordTone[], family: ChordQuality['family'], optional: number[] = [5]): ChordQuality => ({ id, suffix, name, aliases, tones, optional, family });

export const CHORD_QUALITIES: ChordQuality[] = [
  Q('maj', '', 'major', ['M', 'maj', 'major'], [[0, 1], [4, 3], [7, 5]], 'triad', []),
  Q('min', 'm', 'minor', ['min', 'mi', '-', 'minor'], [[0, 1], [3, 3], [7, 5]], 'triad', []),
  Q('dim', 'dim', 'diminished', ['°', 'o', 'mb5', 'm(b5)'], [[0, 1], [3, 3], [6, 5]], 'triad', []),
  Q('aug', 'aug', 'augmented', ['+', '#5', '(#5)'], [[0, 1], [4, 3], [8, 5]], 'triad', []),
  Q('5', '5', 'power chord (5th)', ['(no3)'], [[0, 1], [7, 5]], 'other', []),
  Q('sus2', 'sus2', 'suspended 2nd', ['2'], [[0, 1], [2, 2], [7, 5]], 'suspended', []),
  Q('sus4', 'sus4', 'suspended 4th', ['sus', '4'], [[0, 1], [5, 4], [7, 5]], 'suspended', []),
  Q('6', '6', 'major sixth', ['M6', 'maj6', 'add6'], [[0, 1], [4, 3], [7, 5], [9, 6]], 'sixth'),
  Q('m6', 'm6', 'minor sixth', ['min6', '-6'], [[0, 1], [3, 3], [7, 5], [9, 6]], 'sixth'),
  Q('7', '7', 'dominant seventh', ['dom7', 'dom'], [[0, 1], [4, 3], [7, 5], [10, 7]], 'seventh'),
  Q('maj7', 'maj7', 'major seventh', ['M7', 'Δ', 'Δ7', 'ma7', 'j7', 'maj'], [[0, 1], [4, 3], [7, 5], [11, 7]], 'seventh'),
  Q('m7', 'm7', 'minor seventh', ['min7', '-7', 'mi7'], [[0, 1], [3, 3], [7, 5], [10, 7]], 'seventh'),
  Q('mMaj7', 'm(maj7)', 'minor-major seventh', ['mM7', 'm(M7)', 'mmaj7', '-maj7', 'm/maj7'], [[0, 1], [3, 3], [7, 5], [11, 7]], 'seventh'),
  Q('m7b5', 'm7b5', 'half-diminished', ['ø', 'ø7', 'm7(b5)', '-7b5', 'min7b5'], [[0, 1], [3, 3], [6, 5], [10, 7]], 'seventh', []),
  Q('dim7', 'dim7', 'diminished seventh', ['°7', 'o7'], [[0, 1], [3, 3], [6, 5], [9, 7]], 'seventh', []),
  Q('7sus4', '7sus4', 'seventh, suspended 4th', ['7sus', 'sus7'], [[0, 1], [5, 4], [7, 5], [10, 7]], 'suspended'),
  Q('aug7', '7#5', 'augmented seventh', ['+7', 'aug7', '7(#5)', '7+5'], [[0, 1], [4, 3], [8, 5], [10, 7]], 'seventh', []),
  Q('7b5', '7b5', 'seventh, flat 5th', ['7(b5)', '7-5'], [[0, 1], [4, 3], [6, 5], [10, 7]], 'seventh', []),
  Q('add9', 'add9', 'added ninth', ['add2', '(add9)'], [[0, 1], [4, 3], [7, 5], [14, 9]], 'extended'),
  Q('madd9', 'm(add9)', 'minor, added ninth', ['madd9', 'madd2', 'm(add2)', '-add9'], [[0, 1], [3, 3], [7, 5], [14, 9]], 'extended'),
  Q('6/9', '6/9', 'six-nine', ['69', '6add9'], [[0, 1], [4, 3], [7, 5], [9, 6], [14, 9]], 'extended'),
  Q('9', '9', 'dominant ninth', ['dom9'], [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9]], 'extended'),
  Q('maj9', 'maj9', 'major ninth', ['M9', 'Δ9', 'ma9'], [[0, 1], [4, 3], [7, 5], [11, 7], [14, 9]], 'extended'),
  Q('m9', 'm9', 'minor ninth', ['min9', '-9'], [[0, 1], [3, 3], [7, 5], [10, 7], [14, 9]], 'extended'),
  Q('7b9', '7b9', 'seventh, flat 9th', ['7(b9)', '7-9'], [[0, 1], [4, 3], [7, 5], [10, 7], [13, 9]], 'extended'),
  Q('7#9', '7#9', 'seventh, sharp 9th', ['7(#9)', '7+9'], [[0, 1], [4, 3], [7, 5], [10, 7], [15, 9]], 'extended'),
  Q('11', '11', 'dominant eleventh', ['dom11'], [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9], [17, 11]], 'extended', [3, 5, 9]),
  Q('m11', 'm11', 'minor eleventh', ['min11', '-11'], [[0, 1], [3, 3], [7, 5], [10, 7], [14, 9], [17, 11]], 'extended', [5, 9]),
  Q('13', '13', 'dominant thirteenth', ['dom13'], [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9], [21, 13]], 'extended', [5, 9]),
];

const QUALITY_BY_ID = new Map(CHORD_QUALITIES.map(q => [q.id, q]));
const QUALITY_BY_SUFFIX = new Map<string, ChordQuality>();
for (const q of CHORD_QUALITIES) {
  QUALITY_BY_SUFFIX.set(q.suffix, q);
  for (const a of q.aliases) if (!QUALITY_BY_SUFFIX.has(a)) QUALITY_BY_SUFFIX.set(a, q);
}

export function chordQuality(id: string): ChordQuality | undefined {
  return QUALITY_BY_ID.get(id);
}

export interface ChordRoot {
  step: Step;
  alter: number;
}

export interface ChordSymbol {
  root: ChordRoot;
  quality: ChordQuality;
  /** Slash bass note, e.g. the E of C/E. */
  bass?: ChordRoot;
}

export class ChordSymbolError extends Error {}

const ROOT_RE = /^([A-Ga-g])(##|bb|#|b|♯|♭|x)?/;

function parseRoot(s: string): { root: ChordRoot; rest: string } | null {
  const m = ROOT_RE.exec(s);
  if (!m) return null;
  const acc = m[2] ?? '';
  const alter = acc === '#' || acc === '♯' ? 1 : acc === 'b' || acc === '♭' ? -1 : acc === '##' || acc === 'x' ? 2 : acc === 'bb' ? -2 : 0;
  return { root: { step: m[1].toUpperCase() as Step, alter }, rest: s.slice(m[0].length) };
}

/** Parse "C", "F#m7", "Bbmaj7", "Dsus4", "G7/B", "Cø", "E♭°7" … */
export function parseChordSymbol(sym: string): ChordSymbol {
  const text = sym.trim().replace(/\s+/g, '');
  const r = parseRoot(text);
  if (!r) throw new ChordSymbolError(`"${sym}" doesn't start with a note name`);
  let rest = r.rest;
  let bass: ChordRoot | undefined;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    const b = parseRoot(rest.slice(slash + 1));
    // "6/9" is a quality, not a slash chord
    if (b && b.rest === '') {
      bass = b.root;
      rest = rest.slice(0, slash);
    }
  }
  const norm = rest.replace(/♭/g, 'b').replace(/♯/g, '#');
  const quality = QUALITY_BY_SUFFIX.get(norm) ?? QUALITY_BY_SUFFIX.get(norm.replace(/[()]/g, ''));
  if (!quality) throw new ChordSymbolError(`Unknown chord quality "${rest}" in "${sym}"`);
  return { root: r.root, quality, bass };
}

export function isChordSymbol(sym: string): boolean {
  try {
    parseChordSymbol(sym);
    return true;
  } catch {
    return false;
  }
}

export function rootPc(r: ChordRoot): number {
  return (((STEP_SEMIS[r.step] + r.alter) % 12) + 12) % 12;
}

/** Spell the tone `semis` above the root as the given scale degree (C dim7 → B𝄫, not A). */
export function spellChordTone(root: ChordRoot, [semis, degree]: ChordTone): ChordRoot {
  const step = STEPS[(STEPS.indexOf(root.step) + degree - 1) % 7];
  const target = STEP_SEMIS[root.step] + root.alter + semis;
  let alter = (target - STEP_SEMIS[step]) % 12;
  if (alter > 6) alter -= 12;
  if (alter < -6) alter += 12;
  return { step, alter };
}

export function rootLabel(r: ChordRoot): string {
  return r.step + accidentalSymbol(r.alter);
}

/** Display name: "F♯m7", "B♭maj7", "C/E". */
export function chordName(c: ChordSymbol): string {
  return rootLabel(c.root) + c.quality.suffix.replace(/b(?=\d)/g, '♭').replace(/#(?=\d)/g, '♯') + (c.bass ? `/${rootLabel(c.bass)}` : '');
}

/** ASCII symbol that parseChordSymbol reads back: "F#m7", "Bbmaj7", "C/E". */
export function chordSymbolText(c: ChordSymbol): string {
  const acc = (a: number) => (a === 1 ? '#' : a === -1 ? 'b' : a === 2 ? '##' : a === -2 ? 'bb' : '');
  return c.root.step + acc(c.root.alter) + c.quality.suffix + (c.bass ? `/${c.bass.step}${acc(c.bass.alter)}` : '');
}

/** Chord tones spelled from the root, e.g. Cm7 → C E♭ G B♭. */
export function chordToneNames(c: ChordSymbol): ChordRoot[] {
  return c.quality.tones.map(t => spellChordTone(c.root, t));
}

/** Interval labels for the tones: "R", "♭3", "5", "♭7", "9" … */
export function chordDegreeLabels(q: ChordQuality): string[] {
  const natural: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 };
  return q.tones.map(([semis, deg]) => {
    if (deg === 1) return 'R';
    const d = semis - natural[deg];
    const pre = d === -2 ? '𝄫' : d === -1 ? '♭' : d === 1 ? '♯' : '';
    return pre + deg;
  });
}

/** Pitch classes of the chord (root first). */
export function chordPcs(c: ChordSymbol): number[] {
  const r = rootPc(c.root);
  return c.quality.tones.map(([s]) => (r + s) % 12);
}
