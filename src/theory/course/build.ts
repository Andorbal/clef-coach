/**
 * Small constructors that keep the course files readable, and generators for rounds that
 * come out fresh each time (intervals, chords, scales, keys, numerals), so a lesson can be
 * replayed without learning the answers by heart.
 *
 * Figures and answers are written in the text notation's pitch names ("F#4", "Bb3").
 */
import type { ActivityDef } from '../../curriculum/types';
import type { Rng } from '../../curriculum/generate';
import { parseKey } from '../../music/keys';
import { parsePitch, stepLabel } from '../../music/pitch';
import {
  DEGREE_NAMES,
  type ScaleId,
  SCALES,
  chordNotes,
  chordSymbolOf,
  diatonicChord,
  intervalName,
  parseInterval,
  pitchText,
  scaleNotes,
  signatureAccidentals,
  tonicPitch,
  transpose,
  withArticle,
} from '../theory';
import { chordQuality } from '../../music/chords';
import type { BuildRound, BuildStep, Check, DrillStep, ExplainStep, ExploreStep, Figure, LessonKind, QuizRound, QuizStep, Task, TheoryLesson, TheoryUnit } from './types';

// ---------------------------------------------------------------------------
// Lessons and steps
// ---------------------------------------------------------------------------

export function lesson(id: string, title: string, kind: LessonKind, goal: string, steps: TheoryLesson['steps'], o: { key?: string; range?: [string, string]; topics?: string[] } = {}): TheoryLesson {
  return { id, title, kind, goal, steps, ...o };
}

export function unit(id: string, title: string, subtitle: string, description: string, lessons: TheoryLesson[], o: { requires?: string[] } = {}): TheoryUnit {
  return { id, title, subtitle, description, lessons, ...o };
}

export const fig = (notes: string, o: Omit<Figure, 'notes'> = {}): Figure => ({ notes, ...o });

export const explain = (title: string, body: string, figure?: Figure): ExplainStep => ({ type: 'explain', title, body, figure });

export const explore = (title: string, body: string, tasks: Task[], figure?: Figure): ExploreStep => ({ type: 'explore', title, body, tasks, figure });

export const task = (text: string, check: Check): Task => ({ text, check });

export const quiz = (title: string, body: string, question: string, rounds: QuizStep['rounds'], o: { mode?: QuizStep['mode']; figure?: Figure } = {}): QuizStep => ({ type: 'quiz', title, body, question, rounds, ...o });

export const build = (title: string, body: string, rounds: BuildStep['rounds'], o: Figure | { mode?: BuildStep['mode']; figure?: Figure } = {}): BuildStep =>
  'notes' in o ? { type: 'build', title, body, rounds, figure: o } : { type: 'build', title, body, rounds, ...o };

export const drill = (title: string, body: string, activity: ActivityDef): DrillStep => ({ type: 'drill', title, body, activity });

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export const C = {
  note: (note: string): Check => ({ kind: 'note', note }),
  /** Hold these notes together. */
  chordOf: (...notes: string[]): Check => ({ kind: 'notes', notes }),
  /** Play these notes one after another. */
  melody: (...notes: string[]): Check => ({ kind: 'notes', notes, inOrder: true }),
  /** An interval (in semitones), together or one after the other. */
  interval: (semitones: number | number[], o: { from?: string; together?: boolean; up?: boolean; down?: boolean; compound?: boolean } = {}): Check => ({ kind: 'interval', semitones: Array.isArray(semitones) ? semitones : [semitones], ...o }),
  chord: (qualities: string | string[], o: { root?: string; inversion?: number } = {}): Check => ({ kind: 'chord', qualities: Array.isArray(qualities) ? qualities : [qualities], ...o }),
  scale: (tonic: string, scale: ScaleId, down = false): Check => ({ kind: 'scale', tonic, scale, down }),
  any: (count = 1): Check => ({ kind: 'any', count }),
};

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Up to `max` choices: the answer and others from the list, shuffled (or in the list's order when `ordered`). */
export function choices(rng: Rng, answer: string, all: readonly string[], max = 4, ordered = false): string[] {
  const others = shuffle(rng, [...new Set(all)].filter(x => x !== answer)).slice(0, Math.max(1, max - 1));
  const set = [answer, ...others];
  return ordered ? all.filter(x => set.includes(x)) : shuffle(rng, set);
}

/** Draw `count` items, never the same twice running (when there's a choice). */
export function draw<T>(rng: Rng, list: readonly T[], count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const cands = list.length > 1 && out.length ? list.filter(x => x !== out[out.length - 1]) : list;
    out.push(pick(rng, cands));
  }
  return out;
}

/** A root from the list whose chord of this quality is spelled without double sharps or flats. */
function rootFor(rng: Rng, roots: string[], q: string) {
  const simple = roots.filter(r => chordNotes(r, q).every(p => Math.abs(p.alter) <= 1));
  return parsePitch(pick(rng, simple.length ? simple : roots));
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const name = (p: string) => {
  const q = parsePitch(p);
  return stepLabel(q.step, q.alter);
};

/** The common name of an interval id ("M3" → "major 3rd"), with the first letter capitalised for an answer button. */
export const intervalLabel = (id: string) => {
  const n = intervalName(parseInterval(id));
  return n[0].toUpperCase() + n.slice(1);
};

/**
 * Name the interval: two notes from `from`, `intervals` above (or below) them. `by`:
 * just the number (a 3rd), or the full name (a major 3rd). Played one after another, or
 * together (`harmonic`).
 */
export function intervalRounds(o: { intervals: string[]; from: string[]; count: number; by?: 'number' | 'name'; harmonic?: boolean; down?: boolean; prompt?: string }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.intervals, o.count).map(id => {
      const a = parsePitch(pick(rng, o.from));
      const b = transpose(a, id, o.down);
      const [lo, hi] = o.down ? [b, a] : [a, b];
      const notes = o.harmonic ? `[${pitchText(lo)} ${pitchText(hi)}]` : o.down ? `${pitchText(a)} ${pitchText(b)}` : `${pitchText(a)} ${pitchText(b)}`;
      const iv = parseInterval(id);
      const answer = o.by === 'number' ? numberLabel(iv.number) : intervalLabel(id);
      const all = o.by === 'number' ? [...new Set(o.intervals.map(x => numberLabel(parseInterval(x).number)))] : o.intervals.map(intervalLabel);
      return {
        prompt: o.prompt,
        figure: fig(notes, { play: o.harmonic ? 'together' : 'as-written' }),
        options: choices(rng, answer, all, 4, true),
        answer,
        explain: `${name(pitchText(lo))} up to ${name(pitchText(hi))}: ${withArticle(intervalName(iv))}, ${iv.semitones} semitone${iv.semitones === 1 ? '' : 's'}.`,
      };
    });
}

export function numberLabel(n: number): string {
  const s = n === 1 ? 'Unison' : n === 8 ? 'Octave' : `${n}${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
  return s;
}

/** Play an interval above (or below) a given note. */
export function intervalBuildRounds(o: { intervals: string[]; from: string[]; count: number; down?: boolean }) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, o.intervals, o.count).map(id => {
      const a = parsePitch(pick(rng, o.from));
      const b = transpose(a, id, o.down);
      const iv = parseInterval(id);
      return {
        prompt: `Play ${withArticle(intervalName(iv))} ${o.down ? 'below' : 'above'} ${name(pitchText(a))}`,
        figure: fig(pitchText(a), { play: 'as-written' }),
        // from the given note, going up (or down) to the answer
        check: { kind: 'interval', semitones: [iv.semitones], from: pitchText(a).replace(/-?\d$/, ''), ...(o.down ? { down: true } : { up: true }), compound: iv.semitones > 12 },
        answer: o.down ? [pitchText(a), pitchText(b)] : [pitchText(a), pitchText(b)],
        explain: `${cap(withArticle(intervalName(iv)))} ${o.down ? 'below' : 'above'} ${name(pitchText(a))} is ${name(pitchText(b))}.`,
      } satisfies BuildRound;
    });
}

const QUALITY_LABEL: Record<string, string> = {
  maj: 'Major',
  min: 'Minor',
  dim: 'Diminished',
  aug: 'Augmented',
  '7': 'Dominant 7th',
  maj7: 'Major 7th',
  m7: 'Minor 7th',
  m7b5: 'Half-diminished 7th',
  dim7: 'Diminished 7th',
  sus2: 'Suspended 2nd',
  sus4: 'Suspended 4th',
  '5': 'Power chord',
  '6': 'Major 6th',
  m6: 'Minor 6th',
  '9': 'Dominant 9th',
  maj9: 'Major 9th',
  m9: 'Minor 9th',
};
export const qualityLabel = (q: string) => QUALITY_LABEL[q] ?? chordQuality(q)?.name ?? q;

const INVERSION_LABEL = ['Root position', 'First inversion', 'Second inversion', 'Third inversion'];

/** Name a chord's quality (major, minor…), or its inversion. Roots from `roots` (pitch names with octaves). */
export function chordRounds(o: { qualities: string[]; roots: string[]; count: number; ask?: 'quality' | 'inversion'; inversions?: number[]; harmonic?: boolean; prompt?: string }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.ask === 'inversion' ? (o.inversions ?? [0, 1, 2]).map(String) : o.qualities, o.count).map(x => {
      const q = o.ask === 'inversion' ? pick(rng, o.qualities) : x;
      const inv = o.ask === 'inversion' ? Number(x) : pick(rng, o.inversions ?? [0]);
      const root = rootFor(rng, o.roots, q);
      const notes = chordNotes(root, q, inv).map(pitchText);
      const answer = o.ask === 'inversion' ? INVERSION_LABEL[inv] : qualityLabel(q);
      const all = o.ask === 'inversion' ? (o.inversions ?? [0, 1, 2]).map(i => INVERSION_LABEL[i]) : o.qualities.map(qualityLabel);
      return {
        prompt: o.prompt,
        figure: fig(o.harmonic === false ? notes.join(' ') : `[${notes.join(' ')}]`, { play: o.harmonic === false ? 'as-written' : 'apart-then-together' }),
        options: choices(rng, answer, all, 4, true),
        answer,
        explain: `${chordSymbolOf(root, chordQuality(q)!)}: ${notes.map(name).join(' ')}${inv ? ` (${INVERSION_LABEL[inv].toLowerCase()})` : ''}.`,
      };
    });
}

/** Play a chord: "Play a D minor triad", "Play G7". */
export function chordBuildRounds(o: { qualities: string[]; roots: string[]; count: number; inversion?: number; seventh?: boolean }) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, o.qualities, o.count).map(q => {
      const root = rootFor(rng, o.roots, q);
      const notes = chordNotes(root, q, o.inversion ?? 0).map(pitchText);
      const what = ['maj', 'min', 'dim', 'aug'].includes(q) ? `${name(pitchText(root))} ${qualityLabel(q).toLowerCase()} triad` : `${chordSymbolOf(root, chordQuality(q)!)} chord`;
      return {
        prompt: `Play ${/^[AEIOU]/.test(what) ? 'an' : 'a'} ${what}${o.inversion ? ` in ${INVERSION_LABEL[o.inversion].toLowerCase()}` : ''}`,
        check: { kind: 'chord', qualities: [q], root: pitchText(root).replace(/-?\d$/, ''), ...(o.inversion !== undefined ? { inversion: o.inversion } : {}) },
        answer: notes,
        explain: `${chordSymbolOf(root, chordQuality(q)!)} is ${notes.map(name).join(' ')}.`,
      } satisfies BuildRound;
    });
}

/** Play a scale up from its tonic. */
export function scaleBuildRounds(o: { tonics: string[]; scale: ScaleId; count: number }) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, o.tonics, o.count).map(t => {
      const notes = scaleNotes(t, o.scale).map(pitchText);
      return {
        prompt: `Play the ${name(t)} ${SCALES[o.scale].name} scale, from ${name(t)} up to ${name(t)}`,
        figure: fig(t, { play: 'as-written' }),
        check: { kind: 'scale', tonic: t.replace(/-?\d$/, ''), scale: o.scale },
        answer: notes,
        explain: `${name(t)} ${SCALES[o.scale].name}: ${notes.map(name).join(' ')}.`,
      } satisfies BuildRound;
    });
}

/** Which scale is this? Played (or shown) from a tonic. */
export function scaleRounds(o: { scales: ScaleId[]; tonics: string[]; count: number; prompt?: string }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.scales, o.count).map(id => {
      const t = pick(rng, o.tonics);
      const notes = scaleNotes(t, id).map(pitchText);
      const label = (s: ScaleId) => SCALES[s].name[0].toUpperCase() + SCALES[s].name.slice(1);
      return {
        prompt: o.prompt,
        figure: fig(notes.map(n => `${n}/q`).join(' '), { play: 'as-written', tempo: 120 }),
        options: choices(rng, label(id), o.scales.map(label), 4, true),
        answer: label(id),
        explain: `${name(t)} ${SCALES[id].name}: ${notes.map(name).join(' ')}.`,
      };
    });
}

/** Keys and their signatures: "How many sharps has A major?", "Which key has two flats?". */
export function keySignatureRounds(o: { keys: string[]; count: number; ask: 'count' | 'key' | 'accidentals' }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.keys, o.count).map(k => {
      const key = parseKey(k);
      const n = Math.abs(key.fifths);
      const kind = key.fifths > 0 ? 'sharp' : 'flat';
      const keyLabel = (x: string) => `${name(x.replace('m', '') + '4')} ${parseKey(x).mode}`;
      const countLabel = (f: number) => (f === 0 ? 'None' : `${Math.abs(f)} ${f > 0 ? 'sharp' : 'flat'}${Math.abs(f) > 1 ? 's' : ''}`);
      if (o.ask === 'count') {
        const answer = countLabel(key.fifths);
        return { prompt: `How many sharps or flats has ${keyLabel(k)}?`, options: choices(rng, answer, o.keys.map(x => countLabel(parseKey(x).fifths)), 4), answer, explain: n ? `${keyLabel(k)}: ${signatureAccidentals(key.fifths).join(' ')}.` : `${keyLabel(k)} has no sharps or flats.` };
      }
      if (o.ask === 'accidentals') {
        const answer = n ? signatureAccidentals(key.fifths).join(' ') : 'None';
        const all = o.keys.map(x => (parseKey(x).fifths ? signatureAccidentals(parseKey(x).fifths).join(' ') : 'None'));
        return { prompt: `Which ${kind}s are in ${keyLabel(k)}?`, options: choices(rng, answer, [...new Set(all)], 4), answer };
      }
      const answer = keyLabel(k);
      return {
        prompt: n ? `Which ${key.mode} key has ${countLabel(key.fifths).toLowerCase()}?` : `Which ${key.mode} key has no sharps or flats?`,
        figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
        options: choices(rng, answer, o.keys.filter(x => parseKey(x).mode === key.mode).map(keyLabel), 4),
        answer,
      };
    });
}

/** Scale degrees: "In G major, which note is the dominant?" or "What degree is E in C major?". */
export function degreeRounds(o: { keys: string[]; degrees: number[]; count: number; ask: 'note' | 'name' }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.degrees, o.count).map(d => {
      const k = pick(rng, o.keys);
      const key = parseKey(k);
      const scale = scaleNotes(tonicPitch(key, 4), key.mode === 'major' ? 'major' : 'natural-minor').slice(0, 7);
      const note = scale[d - 1];
      const keyLabel = `${stepLabel(tonicPitch(key).step, tonicPitch(key).alter)} ${key.mode}`;
      const degName = (x: number) => `${x} · ${DEGREE_NAMES[x - 1]}`;
      if (o.ask === 'note') {
        const answer = stepLabel(note.step, note.alter);
        return {
          prompt: `In ${keyLabel}, which note is the ${DEGREE_NAMES[d - 1]} (degree ${d})?`,
          figure: { notes: scale.map(pitchText).join(' '), key: k, labels: 'degrees', keys: false, play: 'as-written' },
          options: choices(rng, answer, scale.map(p => stepLabel(p.step, p.alter)), 4),
          answer,
        };
      }
      const answer = degName(d);
      return {
        prompt: `In ${keyLabel}, which degree is ${stepLabel(note.step, note.alter)}?`,
        figure: { notes: pitchText(note), key: k, play: 'as-written' },
        options: choices(rng, answer, o.degrees.map(degName), 4, true),
        answer,
      };
    });
}

/** Roman numerals: a chord of the key on the staff (or heard), name its numeral. */
export function numeralRounds(o: { keys: string[]; degrees: number[]; count: number; seventh?: boolean; mode?: 'see' | 'hear'; prompt?: string; minorForm?: 'natural' | 'harmonic' }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.degrees, o.count).map(d => {
      const k = pick(rng, o.keys);
      const key = parseKey(k);
      const c = diatonicChord(key, d, { seventh: o.seventh, minorForm: o.minorForm });
      const all = o.degrees.map(x => diatonicChord(key, x, { seventh: o.seventh, minorForm: o.minorForm }).numeral);
      // the tonic chord first, so the ear has the key
      const tonic = diatonicChord(key, 1, { seventh: false }).notes.map(pitchText);
      const notes = c.notes.map(pitchText);
      return {
        prompt: o.prompt ?? `In ${stepLabel(tonicPitch(key).step, tonicPitch(key).alter)} ${key.mode}, which chord is this?`,
        figure: { notes: o.mode === 'hear' ? `[${tonic.join(' ')}]/h [${notes.join(' ')}]/h` : `[${notes.join(' ')}]`, key: k, play: o.mode === 'hear' ? 'as-written' : 'together' },
        options: choices(rng, c.numeral, all, 4, true),
        answer: c.numeral,
        explain: `${c.numeral} in ${stepLabel(tonicPitch(key).step, tonicPitch(key).alter)} ${key.mode} is ${chordSymbolOf(c.root, c.quality)}: ${notes.map(name).join(' ')}.`,
      };
    });
}

/** Play the chord on a degree of a key: "Play the IV chord in F major". */
export function numeralBuildRounds(o: { keys: string[]; degrees: number[]; count: number; seventh?: boolean; minorForm?: 'natural' | 'harmonic' }) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, o.degrees, o.count).map(d => {
      const k = pick(rng, o.keys);
      const key = parseKey(k);
      const c = diatonicChord(key, d, { seventh: o.seventh, minorForm: o.minorForm });
      return {
        prompt: `Play ${c.numeral} in ${stepLabel(tonicPitch(key).step, tonicPitch(key).alter)} ${key.mode}`,
        figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
        check: { kind: 'chord', qualities: [c.quality.id], root: pitchText(c.root).replace(/-?\d$/, '') },
        answer: c.notes.map(pitchText),
        explain: `${c.numeral} is ${chordSymbolOf(c.root, c.quality)}: ${c.notes.map(p => stepLabel(p.step, p.alter)).join(' ')}.`,
      } satisfies BuildRound;
    });
}

/** Written rounds from a table: [notes, answer, options, explain?]. */
export function rounds(list: [string, string, string[], string?][], o: Omit<Figure, 'notes'> = {}): QuizRound[] {
  return list.map(([notes, answer, options, explain]) => ({ figure: notes ? fig(notes, o) : undefined, answer, options, explain }));
}

/** One written round with a custom prompt. */
export function round(prompt: string, answer: string, options: string[], o: { figure?: Figure; explain?: string } = {}): QuizRound {
  return { prompt, answer, options, ...o };
}
