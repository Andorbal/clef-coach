/**
 * Adaptive practice sessions built from the learner's own statistics.
 *  review  – the notes/frets you find hardest (spaced repetition)
 *  endless – fresh sight-reading at the level you've reached, getting gradually harder
 */
import type { ActivityDef, LessonDef, MelodyGen, TrackDef } from '../curriculum/types';
import { allLessons } from '../curriculum';
import { midiOf, parsePitch } from '../music/pitch';
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
    const clef = noteItems[0].k.split(':')[1] as 'treble' | 'bass' | 'treble8vb';
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
    const clef = track.clef === 'bass' ? 'bass' : track.clef === 'treble8vb' ? 'treble8vb' : 'treble';
    steps.push({ type: 'keysig', clef, keys: keyItems.slice(0, 6).map(x => x.k.slice(4)), count: 6 });
  }
  if (!steps.length) return null;
  return { id: `${track.id}-review`, title: 'Smart Review', kind: 'practice', goal: 'Practise what you find hardest, right when you’re about to forget it', steps };
}

/** Endless sight-reading at (and a little beyond) the learner's level. */
export function buildEndlessLesson(track: TrackDef, tp: TrackProgress | undefined, round: number): LessonDef | null {
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
