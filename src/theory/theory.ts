/**
 * Music theory, as Theory School teaches it: intervals with their proper names and
 * spellings, scales and modes, keys and the circle of fifths, chords and their
 * inversions, chords in a key (Roman numerals), and naming whatever the learner plays.
 *
 * Everything works on spelled pitches (C♯ is not D♭), because theory is about names as
 * much as sounds: a major third above E is G♯, never A♭. MIDI numbers only come in when
 * something is played, and `spellInKey` / `analysePlayed` give them names that suit the
 * lesson's key.
 *
 * Pure functions, no DOM: unit-tested in theory.test.ts.
 */
import { CHORD_QUALITIES, type ChordQuality, chordQuality } from '../music/chords';
import { type KeySig, keyAlterations, tonicOf } from '../music/keys';
import { type Pitch, type Step, STEPS, STEP_SEMIS, accidentalSymbol, diatonicIndex, fromDiatonic, midiOf, parsePitch, pitchClass, spellMidi, stepLabel } from '../music/pitch';

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd' | 'AA' | 'dd';

export interface Interval {
  /** 1 = unison, 2 = second … 8 = octave, 9 = ninth … */
  number: number;
  quality: IntervalQuality;
  semitones: number;
}

/** Semitones of the major (or perfect) simple intervals 1..7. */
const BASE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const isPerfectNumber = (n: number) => [1, 4, 5].includes(((n - 1) % 7) + 1);

function baseSemitones(number: number): number {
  const simple = ((number - 1) % 7) + 1;
  return BASE_SEMIS[simple - 1] + 12 * Math.floor((number - 1) / 7);
}

/** The interval from `a` up to `b` (or from b up to a, if b is the lower note). */
export function intervalOf(a: Pitch, b: Pitch): Interval {
  let lo = a;
  let hi = b;
  if (diatonicIndex(b) < diatonicIndex(a) || (diatonicIndex(b) === diatonicIndex(a) && midiOf(b) < midiOf(a))) [lo, hi] = [b, a];
  const number = diatonicIndex(hi) - diatonicIndex(lo) + 1;
  const semitones = midiOf(hi) - midiOf(lo);
  const diff = semitones - baseSemitones(number);
  let quality: IntervalQuality;
  if (isPerfectNumber(number)) quality = diff === 0 ? 'P' : diff === 1 ? 'A' : diff === -1 ? 'd' : diff > 1 ? 'AA' : 'dd';
  else quality = diff === 0 ? 'M' : diff === -1 ? 'm' : diff === 1 ? 'A' : diff === -2 ? 'd' : diff > 1 ? 'AA' : 'dd';
  return { number, quality, semitones };
}

const QUALITY_NAMES: Record<IntervalQuality, string> = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished', AA: 'doubly augmented', dd: 'doubly diminished' };

/** "2nd", "3rd", "unison", "octave", "9th"… */
export function numberName(n: number): string {
  if (n === 1) return 'unison';
  if (n === 8) return 'octave';
  const suffix = n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** "perfect 5th", "major 3rd", "augmented 4th"; "octave" and "unison" stand alone when perfect. */
export function intervalName(iv: Pick<Interval, 'number' | 'quality'>): string {
  if ((iv.number === 1 || iv.number === 8) && iv.quality === 'P') return iv.number === 1 ? 'unison' : 'octave';
  return `${QUALITY_NAMES[iv.quality]} ${numberName(iv.number)}`;
}

/** "a 3rd", "an octave", "an augmented 4th", "a unison", "an 11th". */
export function withArticle(s: string): string {
  return `${/^(?:[aeio]|u(?!ni)|8|11|18)/i.test(s) ? 'an' : 'a'} ${s}`;
}

/** "P5", "M3", "m7", "A4", "d5". */
export function intervalShort(iv: Pick<Interval, 'number' | 'quality'>): string {
  return `${iv.quality}${iv.number}`;
}

/** Read "M3", "P5", "m7", "A4", "d5", "P8", "M9"… */
export function parseInterval(id: string): Interval {
  const m = /^(AA|dd|P|M|m|A|d)(\d+)$/.exec(id.trim());
  if (!m) throw new Error(`Unknown interval "${id}"`);
  const quality = m[1] as IntervalQuality;
  const number = Number(m[2]);
  const base = baseSemitones(number);
  const perfect = isPerfectNumber(number);
  const shift: Record<IntervalQuality, number> = perfect ? { P: 0, A: 1, AA: 2, d: -1, dd: -2, M: NaN, m: NaN } : { M: 0, m: -1, A: 1, AA: 2, d: -2, dd: -3, P: NaN };
  const s = shift[quality];
  if (!Number.isFinite(s) || number < 1) throw new Error(`Unknown interval "${id}"`);
  return { number, quality, semitones: base + s };
}

/** The note an interval above `p`, correctly spelled (a major 3rd above E is G♯). */
export function transpose(p: Pitch, interval: string | Interval, down = false): Pitch {
  const iv = typeof interval === 'string' ? parseInterval(interval) : interval;
  const d = diatonicIndex(p) + (down ? -(iv.number - 1) : iv.number - 1);
  const natural = fromDiatonic(d);
  const target = midiOf(p) + (down ? -iv.semitones : iv.semitones);
  return { ...natural, alter: target - midiOf(natural) };
}

/** The intervals within an octave, in order (the tritone as A4). */
export const SIMPLE_INTERVALS = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'] as const;

/** The common name for a number of semitones (0–12): "minor 3rd", "tritone"… */
export function semitoneName(semitones: number): string {
  const s = ((semitones % 12) + 12) % 12;
  if (semitones === 12) return 'octave';
  if (s === 6) return 'tritone';
  return intervalName(parseInterval(SIMPLE_INTERVALS[s]));
}

/** Turn an interval upside down: a major 3rd becomes a minor 6th, a perfect 4th a perfect 5th. */
export function invertInterval(iv: Interval): Interval {
  const simple = ((iv.number - 1) % 7) + 1;
  const number = simple === 1 ? 8 : simple === 8 ? 1 : 9 - simple;
  const inv: Record<IntervalQuality, IntervalQuality> = { P: 'P', M: 'm', m: 'M', A: 'd', d: 'A', AA: 'dd', dd: 'AA' };
  const quality = inv[iv.quality];
  return { number, quality, semitones: parseInterval(`${quality}${number}`).semitones };
}

/** Consonant (unisons, octaves, 5ths, 3rds and 6ths), dissonant (2nds, 7ths, the tritone), or the 4th (it depends). */
export function consonance(iv: Interval): 'perfect consonance' | 'imperfect consonance' | 'dissonance' | 'depends' {
  const simple = ((iv.number - 1) % 7) + 1;
  if (iv.quality === 'A' || iv.quality === 'd' || iv.quality === 'AA' || iv.quality === 'dd') return 'dissonance';
  if (simple === 1 || simple === 5 || iv.number % 7 === 1) return 'perfect consonance';
  if (simple === 3 || simple === 6) return 'imperfect consonance';
  if (simple === 4) return 'depends';
  return 'dissonance';
}

// ---------------------------------------------------------------------------
// Scales and modes
// ---------------------------------------------------------------------------

export type ScaleId =
  | 'major'
  | 'natural-minor'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues'
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'whole-tone'
  | 'chromatic';

export interface ScaleDef {
  name: string;
  /** Intervals above the tonic, ascending (the octave not included). */
  steps: string[];
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  major: { name: 'major', steps: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'] },
  'natural-minor': { name: 'natural minor', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'] },
  'harmonic-minor': { name: 'harmonic minor', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'] },
  'melodic-minor': { name: 'melodic minor', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'] },
  'major-pentatonic': { name: 'major pentatonic', steps: ['P1', 'M2', 'M3', 'P5', 'M6'] },
  'minor-pentatonic': { name: 'minor pentatonic', steps: ['P1', 'm3', 'P4', 'P5', 'm7'] },
  blues: { name: 'blues', steps: ['P1', 'm3', 'P4', 'A4', 'P5', 'm7'] },
  ionian: { name: 'Ionian', steps: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'] },
  dorian: { name: 'Dorian', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'] },
  phrygian: { name: 'Phrygian', steps: ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7'] },
  lydian: { name: 'Lydian', steps: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'] },
  mixolydian: { name: 'Mixolydian', steps: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'] },
  aeolian: { name: 'Aeolian', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'] },
  locrian: { name: 'Locrian', steps: ['P1', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'] },
  'whole-tone': { name: 'whole-tone', steps: ['P1', 'M2', 'M3', 'A4', 'A5', 'A6'] },
  chromatic: { name: 'chromatic', steps: ['P1', 'A1', 'M2', 'A2', 'M3', 'P4', 'A4', 'P5', 'A5', 'M6', 'A6', 'M7'] },
};

/** A scale from its tonic, ascending, with the top tonic (`octaves` octaves). */
export function scaleNotes(tonic: Pitch | string, id: ScaleId, octaves = 1): Pitch[] {
  const t = typeof tonic === 'string' ? parsePitch(tonic) : tonic;
  const out: Pitch[] = [];
  for (let o = 0; o < octaves; o++) for (const s of SCALES[id].steps) out.push(transpose(t, addOctaves(parseInterval(s), o)));
  out.push(transpose(t, `P${7 * octaves + 1}`));
  return out;
}

function addOctaves(iv: Interval, octaves: number): Interval {
  return { number: iv.number + 7 * octaves, quality: iv.quality, semitones: iv.semitones + 12 * octaves };
}

/** Semitone steps between neighbouring scale notes: "W W H W W W H" for a major scale (3 = a step and a half). */
export function stepPattern(notes: Pitch[]): string {
  const out: string[] = [];
  for (let i = 1; i < notes.length; i++) {
    const s = midiOf(notes[i]) - midiOf(notes[i - 1]);
    out.push(s === 1 ? 'H' : s === 2 ? 'W' : s === 3 ? 'W+H' : String(s));
  }
  return out.join(' ');
}

/** Scale-degree names. */
export const DEGREE_NAMES = ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading note'] as const;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Major keys round the circle of fifths, clockwise from C (sharps), then anticlockwise (flats). */
export const CIRCLE_SHARPS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const CIRCLE_FLATS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

/** The key's tonic as a pitch in a given octave. */
export function tonicPitch(key: KeySig, octave = 4): Pitch {
  const t = tonicOf(key);
  return { step: t.step, alter: t.alter, octave };
}

/** The relative key: same signature, the other mode. */
export function relativeKey(key: KeySig): KeySig {
  return { fifths: key.fifths, mode: key.mode === 'major' ? 'minor' : 'major' };
}

/** The sharps or flats of a key signature, in the order they are written ("F♯ C♯"). */
export function signatureAccidentals(fifths: number): string[] {
  const order: Step[] = fifths >= 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  return order.slice(0, Math.abs(fifths)).map(s => `${s}${fifths > 0 ? '♯' : '♭'}`);
}

/** Spell a played note the way a key would write it: in the key if it belongs, else with the key's kind of accidental. */
export function spellInKey(midi: number, key?: KeySig): Pitch {
  if (!key) return spellMidi(midi, [1, 3, 6, 8].includes(pitchClass(midi)) ? 1 : pitchClass(midi) === 10 ? -1 : 0);
  const alt = keyAlterations(key.fifths);
  for (const step of STEPS) {
    const pc = (((STEP_SEMIS[step] + alt[step]) % 12) + 12) % 12;
    if (pc === pitchClass(midi)) {
      const p: Pitch = { step, alter: alt[step], octave: 0 };
      p.octave = Math.floor((midi - STEP_SEMIS[step] - alt[step]) / 12) - 1;
      return p;
    }
  }
  // chromatic: the raised 7th of a minor key, or the key's direction
  if (key.mode === 'minor') {
    const lead = transpose(tonicPitch(key, 4), 'M7');
    if (pitchClass(midiOf(lead)) === pitchClass(midi)) return { ...lead, octave: Math.floor((midi - STEP_SEMIS[lead.step] - lead.alter) / 12) - 1 };
  }
  return spellMidi(midi, key.fifths < 0 ? -1 : 1);
}

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

/** The interval a chord tone makes with the root. */
function toneInterval(semis: number, degree: number): Interval {
  const base = baseSemitones(degree);
  const diff = semis - base;
  const perfect = isPerfectNumber(degree);
  const quality: IntervalQuality = perfect ? (diff === 0 ? 'P' : diff > 0 ? 'A' : 'd') : diff === 0 ? 'M' : diff === -1 ? 'm' : diff > 0 ? 'A' : 'd';
  return { number: degree, quality, semitones: semis };
}

/** A chord's notes from its root up, spelled (inversion 1 puts the root on top, 2 the 3rd too…). */
export function chordNotes(root: Pitch | string, qualityId: string, inversion = 0): Pitch[] {
  const r = typeof root === 'string' ? parsePitch(root) : root;
  const q = chordQuality(qualityId);
  if (!q) throw new Error(`Unknown chord quality "${qualityId}"`);
  const notes = q.tones.map(([s, d]) => transpose(r, toneInterval(s, d)));
  for (let i = 0; i < inversion; i++) {
    const low = notes.shift()!;
    let up = transpose(low, 'P8');
    while (midiOf(up) <= midiOf(notes[notes.length - 1])) up = transpose(up, 'P8');
    notes.push(up);
  }
  return notes;
}

/** Chord qualities Theory School names (triads, sevenths, sixths, suspensions, power chords). */
const NAMED = CHORD_QUALITIES.filter(q => ['triad', 'seventh', 'sixth', 'suspended'].includes(q.family) || q.id === '5' || ['add9', '9', 'maj9', 'm9'].includes(q.id));

export interface ChordIdentity {
  root: Pitch;
  quality: ChordQuality;
  /** 0 = root position, 1 = first inversion (3rd in the bass), 2 = second, 3 = third. */
  inversion: number;
  /** The notes, spelled from the root. */
  spelled: Pitch[];
}

/**
 * Name a chord from the notes played: the root and quality whose tones match the pitch
 * classes exactly, preferring the bass as the root (so C E G is C major, E G C its first
 * inversion), and spelling it in the key where that helps.
 */
export function identifyChord(midis: number[], key?: KeySig): ChordIdentity | null {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  const pcs = [...new Set(sorted.map(pitchClass))];
  if (pcs.length < 2 || (pcs.length === 2 && sorted.length < 2)) return null;
  const bass = pitchClass(sorted[0]);
  const candidates: { root: number; q: ChordQuality }[] = [];
  for (const root of [bass, ...pcs.filter(p => p !== bass)]) {
    const rel = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const q of NAMED) {
      const tpl = [...new Set(q.tones.map(([s]) => s % 12))].sort((a, b) => a - b);
      if (tpl.length === rel.length && tpl.every((x, i) => x === rel[i])) candidates.push({ root, q });
    }
  }
  if (!candidates.length) return null;
  // the bass as root wins; then triads and sevenths over suspensions. A sixth chord is
  // read as the seventh chord it inverts (E♭ G B♭ C is Cm7 over E♭, not E♭6), as harmony
  // books do
  const rank = (c: { root: number; q: ChordQuality }) => (c.q.family === 'sixth' ? 12 : 0) + (c.root === bass ? 0 : 10) + (c.q.family === 'triad' || c.q.family === 'seventh' ? 0 : c.q.id === '5' ? 1 : 3);
  candidates.sort((a, b) => rank(a) - rank(b));
  // two notes only name a chord when they are a power chord's root and 5th
  const best = candidates.find(c => pcs.length > 2 || c.q.id === '5');
  if (!best) return null;
  const lowestRoot = sorted.find(m => pitchClass(m) === best.root)!;
  const rootPitch = spellInKey(lowestRoot, key);
  // a root spelled with a double accidental in this key: respell it simply
  const root = Math.abs(rootPitch.alter) > 1 ? spellMidi(lowestRoot) : rootPitch;
  const spelled = chordNotes(root, best.q.id);
  const tones = best.q.tones.map(([s]) => (best.root + s) % 12);
  const inversion = Math.max(0, tones.indexOf(bass));
  return { root, quality: best.q, inversion, spelled };
}

/** "C major", "D minor 7th", "G dominant 7th"… */
export function chordLongName(root: Pitch, quality: ChordQuality): string {
  const names: Record<string, string> = { maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented', '7': 'dominant 7th', maj7: 'major 7th', m7: 'minor 7th', m7b5: 'half-diminished 7th', dim7: 'diminished 7th', '5': 'power chord' };
  return `${stepLabel(root.step, root.alter)} ${names[quality.id] ?? quality.name}`;
}

/** The chord symbol a lead sheet would print: "C", "Dm", "G7", "Bø7", "C/E". */
export function chordSymbolOf(root: Pitch, quality: ChordQuality, bass?: Pitch): string {
  const suffix = quality.id === 'dim' ? '°' : quality.id === 'm7b5' ? 'ø7' : quality.id === 'dim7' ? '°7' : quality.suffix;
  return `${stepLabel(root.step, root.alter)}${suffix}${bass && (bass.step !== root.step || bass.alter !== root.alter) ? `/${stepLabel(bass.step, bass.alter)}` : ''}`;
}

export const INVERSION_NAMES = ['root position', 'first inversion', 'second inversion', 'third inversion'];

// ---------------------------------------------------------------------------
// Chords in a key
// ---------------------------------------------------------------------------

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** The scale a key's chords are built from: the major scale, or harmonic minor (its raised 7th makes V major). */
function harmonyScale(key: KeySig, minorForm: 'natural' | 'harmonic'): Pitch[] {
  return scaleNotes(tonicPitch(key, 4), key.mode === 'major' ? 'major' : minorForm === 'harmonic' ? 'harmonic-minor' : 'natural-minor', 2);
}

export interface DiatonicChord {
  degree: number;
  root: Pitch;
  quality: ChordQuality;
  notes: Pitch[];
  numeral: string;
}

/** The chord on a scale degree (1–7), stacked in thirds from the key's scale: triad or 7th. */
export function diatonicChord(key: KeySig, degree: number, opts: { seventh?: boolean; minorForm?: 'natural' | 'harmonic' } = {}): DiatonicChord {
  const scale = harmonyScale(key, opts.minorForm ?? 'harmonic');
  const i = degree - 1;
  const notes = [scale[i], scale[i + 2], scale[i + 4], ...(opts.seventh ? [scale[i + 6]] : [])];
  const id = identifyChord(notes.map(midiOf))!;
  // identify by intervals from the root (the notes are in root position)
  const q = id.quality;
  return { degree, root: notes[0], quality: q, notes, numeral: romanNumeral(degree, q) };
}

/** "I", "ii", "vii°", "V7", "IVmaj7", "iiø7"… */
export function romanNumeral(degree: number, quality: ChordQuality): string {
  const minorish = ['min', 'dim', 'm7', 'm7b5', 'dim7', 'm6', 'mMaj7'].includes(quality.id);
  const base = minorish ? ROMAN[degree - 1].toLowerCase() : ROMAN[degree - 1];
  const suffix: Record<string, string> = { dim: '°', aug: '+', '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)' };
  return base + (suffix[quality.id] ?? '');
}

/** The Roman numeral of a played chord in a key, or null if its root isn't in the key's scale. */
export function numeralInKey(id: ChordIdentity, key: KeySig): string | null {
  const scale = harmonyScale(key, 'harmonic').slice(0, 7);
  const rootPc = pitchClass(midiOf(id.root));
  let i = scale.findIndex(p => pitchClass(midiOf(p)) === rootPc);
  // the natural 7th of a minor key (the ♭VII chord) is written with its own numeral
  if (i < 0 && key.mode === 'minor') {
    const nat = harmonyScale(key, 'natural').slice(0, 7);
    i = nat.findIndex(p => pitchClass(midiOf(p)) === rootPc);
    if (i >= 0) return `♭${romanNumeral(i + 1, id.quality)}`;
  }
  return i < 0 ? null : romanNumeral(i + 1, id.quality);
}

// ---------------------------------------------------------------------------
// What's being played
// ---------------------------------------------------------------------------

export interface Analysis {
  /** The main line: "C major", "perfect 5th", "E♭". */
  title: string;
  /** The details: "root position · I in C major", "7 semitones · C up to G". */
  detail?: string;
  /** The notes spelled to suit what they are. */
  pitches: Pitch[];
}

const label = (p: Pitch) => `${stepLabel(p.step, p.alter)}${p.octave}`;

/** Name what the learner holds: a note, an interval, a chord (with its inversion and numeral), or just the notes. */
export function analysePlayed(midis: number[], key?: KeySig): Analysis | null {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (sorted.length === 1) {
    const p = spellInKey(sorted[0], key);
    return { title: `${stepLabel(p.step, p.alter)}`, detail: label(p), pitches: [p] };
  }
  const chord = identifyChord(sorted, key);
  if (sorted.length === 2 && (!chord || chord.quality.id === '5')) {
    const [a, b] = sorted.map(m => spellInKey(m, key));
    let pb = b;
    // spell the upper note as the interval it most likely is (a 3rd, not a diminished 4th)
    const iv0 = intervalOf(a, b);
    if (iv0.quality === 'AA' || iv0.quality === 'dd' || (iv0.quality === 'd' && iv0.number !== 5) || (iv0.quality === 'A' && iv0.number !== 4)) {
      const common = SIMPLE_INTERVALS[(sorted[1] - sorted[0]) % 12];
      const octs = Math.floor((sorted[1] - sorted[0]) / 12);
      pb = transpose(a, addOctaves(parseInterval(common), octs));
    }
    const iv = intervalOf(a, pb);
    const name = (iv.number > 8 ? 'compound ' : '') + intervalName(iv);
    const semis = iv.semitones;
    return { title: name, detail: `${semis} semitone${semis === 1 ? '' : 's'} · ${label(a)} to ${label(pb)}`, pitches: [a, pb] };
  }
  if (chord) {
    const bassPc = pitchClass(sorted[0]);
    const pitches = sorted.map(m => {
      const t = chord.spelled.find(p => pitchClass(midiOf(p)) === pitchClass(m))!;
      return { ...t, octave: Math.floor((m - STEP_SEMIS[t.step] - t.alter) / 12) - 1 };
    });
    const bass = pitches.find(p => pitchClass(midiOf(p)) === bassPc);
    const numeral = key ? numeralInKey(chord, key) : null;
    const inv = chord.quality.tones.length <= 4 ? INVERSION_NAMES[chord.inversion] : chord.inversion ? `${stepLabel(bass!.step, bass!.alter)} in the bass` : 'root position';
    const keyName = key ? `${stepLabel(tonicOf(key).step, tonicOf(key).alter)} ${key.mode}` : '';
    return {
      title: chordLongName(chord.root, chord.quality),
      detail: [chordSymbolOf(chord.root, chord.quality, chord.inversion ? bass : undefined), inv, numeral ? `${numeral} in ${keyName}` : ''].filter(Boolean).join(' · '),
      pitches,
    };
  }
  const pitches = sorted.map(m => spellInKey(m, key));
  return { title: pitches.map(p => stepLabel(p.step, p.alter)).join(' '), detail: `${pitches.length} notes`, pitches };
}

/** A pitch as the text notation writes it ("F#4", "Bb3"). */
export function pitchText(p: Pitch): string {
  return `${p.step}${p.alter > 0 ? '#'.repeat(p.alter) : 'b'.repeat(-p.alter)}${p.octave}`;
}

/** A pitch for reading ("F♯4"). */
export function pitchDisplay(p: Pitch, octave = true): string {
  return `${p.step}${accidentalSymbol(p.alter)}${octave ? p.octave : ''}`;
}
