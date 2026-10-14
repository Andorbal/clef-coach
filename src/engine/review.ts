/**
 * Adaptive practice sessions built from the learner's own statistics.
 *  review  – the notes/frets/chords you find hardest (spaced repetition)
 *  endless – fresh sight-reading at the level you've reached, getting gradually harder;
 *            on a chord track, changes between the chords you've learned, getting faster
 */
import type { ActivityDef, LessonDef, MelodyGen, TrackDef } from '../curriculum/types';
import { allLessons } from '../curriculum';
import { makeRng } from '../curriculum/generate';
import { midiOf, parsePitch } from '../music/pitch';
import type { Clef } from '../music/score';
import { reviewPriority } from '../state/srs';
import type { TrackProgress } from '../state/types';

function passedLessons(track: TrackDef, tp?: TrackProgress) {
  return allLessons(track).filter(l => tp?.lessons[l.lesson.id]?.passed);
}

/** The most advanced generated-reading settings the learner has unlocked. */
export function latestReadGen(track: TrackDef, tp?: TrackProgress): MelodyGen | null {
  const passed = passedLessons(track, tp);
  const pool = passed.length ? passed : allLessons(track).slice(0, 1);
  for (let i = pool.length - 1; i >= 0; i--) {
    const steps = pool[i].lesson.steps;
    for (let j = steps.length - 1; j >= 0; j--) {
      const s = steps[j];
      if (s.type === 'read') return s.gen;
    }
  }
  return null;
}

export function buildReviewLesson(track: TrackDef, tp?: TrackProgress): LessonDef | null {
  if (!tp) return null;
  const now = Date.now();
  const entries = Object.entries(tp.items);
  const steps: ActivityDef[] = [];
  const noteItems = entries
    .filter(([k]) => k.startsWith('note:'))
    .map(([k, s]) => ({ k, s, pr: reviewPriority(s, now) }))
    .sort((a, b) => b.pr - a.pr);
  if (noteItems.length >= 3) {
    // group by clef; take the clef with the most urgent items
    const clef = noteItems[0].k.split(':')[1] as Clef;
    const weak = noteItems.filter(x => x.k.split(':')[1] === clef).slice(0, 10).map(x => x.k.split(':')[2]);
    const sorted = [...new Set(weak)].sort((a, b) => midiOf(parsePitch(a)) - midiOf(parsePitch(b)));
    steps.push({ type: 'name', clef, pool: sorted, count: 12, title: 'Your trickiest notes' });
    steps.push({ type: 'play', clef, pool: sorted, count: 8, title: 'Find them' });
    const gen = latestReadGen(track, tp);
    if (gen && gen.clef === clef) {
      // read passages that use the weak notes plus their neighbours
      const lo = Math.min(...sorted.map(s => midiOf(parsePitch(s))));
      const hi = Math.max(...sorted.map(s => midiOf(parsePitch(s))));
      const pool = gen.pool.filter(s => {
        const m = midiOf(parsePitch(s));
        return m >= lo - 2 && m <= hi + 2;
      });
      steps.push({
        type: 'read',
        gen: { ...gen, pool: pool.length >= 3 ? pool : gen.pool, fivePosition: pool.length >= 3 ? false : gen.fivePosition, measures: 4 },
        mode: 'wait',
        fingering: 'first',
        reps: 1,
        title: 'Read them in context',
      });
    }
  }
  const fretItems = entries
    .filter(([k]) => k.startsWith('fret:'))
    .map(([k, s]) => ({ k, s, pr: reviewPriority(s, now) }))
    .sort((a, b) => b.pr - a.pr)
    .slice(0, 12);
  if (fretItems.length >= 3) {
    const strings = [...new Set(fretItems.map(x => Number(x.k.split(':')[1])))];
    const frets = fretItems.map(x => Number(x.k.split(':')[2]));
    steps.push({ type: 'fret-name', strings, frets: [Math.min(...frets), Math.max(...frets)], count: 12, naturalsOnly: false, title: 'Fretboard review' });
  }
  const keyItems = entries.filter(([k]) => k.startsWith('key:')).map(([k, s]) => ({ k, pr: reviewPriority(s, now) })).sort((a, b) => b.pr - a.pr);
  if (keyItems.length >= 2) {
    const clef: Clef = track.clef === 'grand' || track.clef === 'fretboard' || track.clef === 'chords' ? (track.instrument === 'bass' ? 'bass8vb' : track.instrument === 'guitar' ? 'treble8vb' : 'treble') : track.clef;
    steps.push({ type: 'keysig', clef, keys: keyItems.slice(0, 6).map(x => x.k.slice(4)), count: 6 });
  }
  const chordItems = entries
    .filter(([k]) => k.startsWith(`chord:${track.instrument}:`))
    .map(([k, s]) => ({ c: k.slice(`chord:${track.instrument}:`.length), pr: reviewPriority(s, now) }))
    .sort((a, b) => b.pr - a.pr);
  if (chordItems.length >= 2) {
    const weak = chordItems.slice(0, 6).map(x => x.c);
    steps.push({ type: 'chord-quiz', chords: weak, count: 8, title: 'Your trickiest chords' });
    steps.push({ type: 'chord-play', chords: weak.slice(0, 4), pattern: 'strum', mode: 'wait', repeat: 2, title: 'Change between them' });
  }
  if (!steps.length) return null;
  return { id: `${track.id}-review`, title: 'Smart Review', kind: 'practice', goal: 'Practise what you find hardest, right when you’re about to forget it', steps };
}

/** Endless sight-reading at (and a little beyond) the learner's level. */
/** Chords met in the lessons passed so far (or the first lesson's), in order. */
export function learnedChords(track: TrackDef, tp?: TrackProgress): string[] {
  const passed = passedLessons(track, tp);
  const pool = passed.length ? passed : allLessons(track).slice(0, 1);
  const out: string[] = [];
  for (const { lesson } of pool)
    for (const s of lesson.steps) {
      const list = s.type === 'chord-play' ? s.chords ?? [] : s.type === 'chord-quiz' ? s.chords : [];
      for (const c of list) if (!out.includes(c)) out.push(c);
    }
  return out;
}

export function buildEndlessLesson(track: TrackDef, tp: TrackProgress | undefined, round: number): LessonDef | null {
  if (track.clef === 'chords') {
    const known = learnedChords(track, tp);
    if (!known.length) return null;
    const rng = makeRng(round * 7919 + known.length);
    // the newest chords most often, mixed with older ones
    const pick: string[] = [];
    const want = Math.min(known.length, 2 + Math.min(2, Math.floor(round / 2)));
    while (pick.length < want) {
      const i = Math.min(known.length - 1, Math.floor(known.length * Math.sqrt(rng())));
      if (!pick.includes(known[i])) pick.push(known[i]);
    }
    const tempo = 60 + Math.min(50, round * 5);
    return {
      id: `${track.id}-endless`,
      title: `Chord Gym · Round ${round + 1}`,
      kind: 'challenge',
      goal: 'Changes between the chords you know, a little faster each round',
      steps: [
        { type: 'chord-play', chords: pick, pattern: 'strum', mode: 'wait', repeat: 2, title: 'Warm up' },
        { type: 'chord-play', chords: pick, pattern: 'strum', mode: 'tempo', tempo, rhythm: round > 3 ? 'q q q q' : 'h h', repeat: 2, title: `In time · ${tempo} bpm` },
        ...(known.length > 1 ? [{ type: 'chord-quiz', chords: known.slice(-8), count: 6 } as ActivityDef] : []),
      ],
    };
  }
  const gen = latestReadGen(track, tp);
  if (!gen) return null;
  const tempo = 66 + Math.min(60, round * 4);
  const harder: MelodyGen = { ...gen, measures: Math.min(8, 4 + Math.floor(round / 2)), leapiness: Math.min(0.8, (gen.leapiness ?? 0.3) + round * 0.03) };
  return {
    id: `${track.id}-endless`,
    title: `Sight-reading Gym · Round ${round + 1}`,
    kind: 'challenge',
    goal: 'Fresh music every time, at your level',
    steps: [
      { type: 'read', gen: harder, mode: 'wait', fingering: 'none', reps: 2, title: 'Read ahead' },
      { type: 'read', gen: harder, mode: 'tempo', tempo, fingering: 'none', reps: 1, title: `In time · ${tempo} bpm` },
    ],
  };
}
