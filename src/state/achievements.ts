import type { CourseId, Profile, TrackId } from './types';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** lucide icon name used by the UI */
  icon: string;
  check: (p: Profile, ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  trackId?: TrackId;
  /** A Synth School lesson. */
  synth?: boolean;
  /** A Theory or Production School lesson. */
  course?: CourseId;
  accuracy?: number;
  lessonKind?: string;
  avgResponseMs?: number;
}

const passedCount = (p: Profile, t?: TrackId) =>
  Object.entries(p.tracks)
    .filter(([id]) => !t || id === t)
    .reduce((s, [, tp]) => s + Object.values(tp?.lessons ?? {}).filter(l => l.passed && !l.skipped).length, 0);

/** Synth School checkpoints (lesson ids, saved in profiles). */
const SYNTH_PART_ONE = ['sy1-4', 'sy2-4', 'sy3-6', 'sy4-5', 'sy5-5', 'sy6-6'];
const synthPassed = (p: Profile, ids: string[]) => ids.every(id => p.synth?.lessons[id]?.passed);
const synthCount = (p: Profile) => Object.values(p.synth?.lessons ?? {}).filter(l => l.passed && !l.skipped).length;
/** Theory and Production School: lessons passed (not tested out), and checkpoints passed (lesson ids, saved in profiles). */
const courseCount = (p: Profile, c: 'theory' | 'production') => Object.values(p[c]?.lessons ?? {}).filter(l => l.passed && !l.skipped).length;
const coursePassed = (p: Profile, c: 'theory' | 'production', ids: string[]) => ids.every(id => p[c]?.lessons[id]?.passed);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-lesson', title: 'Opening Bars', description: 'Finish your first lesson.', icon: 'Music', check: p => p.totals.lessons >= 1 },
  { id: 'perfect', title: 'Clean Take', description: 'Finish a lesson with 100% accuracy.', icon: 'Sparkles', check: (_, c) => !c.synth && (c.accuracy ?? 0) >= 0.999 },
  { id: 'perfect-10', title: 'Studio Quality', description: 'Ten flawless lessons.', icon: 'Gem', check: p => p.totals.perfect >= 10 },
  { id: 'streak-3', title: 'Warming Up', description: 'Practise three days in a row.', icon: 'Flame', check: p => p.streak.current >= 3 },
  { id: 'streak-7', title: 'Seven Nights', description: 'A full week of daily practice.', icon: 'Flame', check: p => p.streak.current >= 7 },
  { id: 'streak-30', title: 'Residency', description: '30 days in a row. Remarkable.', icon: 'Crown', check: p => p.streak.current >= 30 },
  { id: 'notes-500', title: '500 Notes', description: 'Play or name 500 notes.', icon: 'Music2', check: p => p.totals.notes >= 500 },
  { id: 'notes-5000', title: '5,000 Notes', description: 'That is a lot of reading.', icon: 'Music4', check: p => p.totals.notes >= 5000 },
  { id: 'notes-25000', title: 'Prolific', description: '25,000 notes played.', icon: 'Library', check: p => p.totals.notes >= 25000 },
  { id: 'hour', title: 'First Hour', description: 'One hour of focused practice.', icon: 'Clock', check: p => p.totals.ms >= 3600_000 },
  { id: 'ten-hours', title: 'Ten Hours', description: 'Ten hours at the instrument.', icon: 'Hourglass', check: p => p.totals.ms >= 36_000_000 },
  { id: 'two-tracks', title: 'Ambidextrous Mind', description: 'Make progress in two different tracks.', icon: 'Layers', check: p => Object.values(p.tracks).filter(t => t && Object.values(t.lessons).some(l => l.passed)).length >= 2 },
  { id: 'both-clefs', title: 'Grand Staff', description: 'Pass a lesson in both treble and bass clef tracks.', icon: 'Columns2', check: p => passedCount(p, 'piano-treble') + passedCount(p, 'guitar-treble') > 0 && passedCount(p, 'piano-bass') + passedCount(p, 'guitar-bass') > 0 },
  { id: 'hands-together', title: 'Hands Together', description: 'Pass a lesson in the Both Hands track.', icon: 'Hand', check: p => passedCount(p, 'piano-grand') >= 1 },
  { id: 'fretboard-10', title: 'Neck Navigator', description: 'Pass ten Fretboard lessons.', icon: 'Compass', check: p => passedCount(p, 'guitar-fretboard') >= 10 },
  { id: 'checkpoint', title: 'Gatekeeper', description: 'Pass a unit checkpoint.', icon: 'ShieldCheck', check: (_, c) => c.lessonKind === 'checkpoint' && (c.accuracy ?? 0) >= 0.8 },
  { id: 'speed', title: 'Sight Reader', description: 'Average under one second per note in a lesson.', icon: 'Zap', check: (_, c) => (c.avgResponseMs ?? 99999) < 1000 && (c.accuracy ?? 0) >= 0.9 },
  { id: 'lessons-50', title: 'Fifty Lessons', description: 'Fifty lessons completed.', icon: 'Award', check: p => p.totals.lessons >= 50 },
  { id: 'synth-first', title: 'First Patch', description: 'Pass your first Synth School lesson.', icon: 'AudioWaveform', check: p => synthCount(p) >= 1 },
  { id: 'synth-ears', title: 'Golden Ears', description: 'Finish a Synth School lesson with a score of 95% or more.', icon: 'Ear', check: (_, c) => !!c.synth && (c.accuracy ?? 0) >= 0.95 },
  { id: 'synth-subtractive', title: 'Subtractive Thinker', description: 'Pass every checkpoint of Synth School’s first part.', icon: 'Filter', check: p => synthPassed(p, SYNTH_PART_ONE) },
  { id: 'synth-engines', title: 'Four Engines', description: 'Pass the FM, additive and wavetable checkpoints.', icon: 'Cpu', check: p => synthPassed(p, ['sy7-5', 'sy8-5', 'sy9-4']) },
  { id: 'synth-graduate', title: 'Sound Designer', description: 'Pass the Synth School final exam.', icon: 'GraduationCap', check: p => synthPassed(p, ['sy11-7']) },
  { id: 'theory-first', title: 'Why, Not Just How', description: 'Pass your first Theory School lesson.', icon: 'BookOpen', check: p => courseCount(p, 'theory') >= 1 },
  { id: 'theory-reader', title: 'Fluent Reader', description: 'Pass every Theory School checkpoint on reading music.', icon: 'BookOpenCheck', check: p => coursePassed(p, 'theory', ['th1-c', 'th2-c', 'th3-c', 'th4-c']) },
  { id: 'theory-harmony', title: 'Harmonist', description: 'Pass the Theory School checkpoint on chords in a key.', icon: 'Layers', check: p => coursePassed(p, 'theory', ['th11-c']) },
  { id: 'theory-graduate', title: 'Theorist', description: 'Pass the Theory School final exam.', icon: 'GraduationCap', check: p => coursePassed(p, 'theory', ['th17-c']) },
];

export function newAchievements(p: Profile, ctx: AchievementContext): AchievementDef[] {
  return ACHIEVEMENTS.filter(a => !p.achievements[a.id] && a.check(p, ctx));
}

/** XP needed to reach a given player level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return Math.round(80 * Math.pow(level - 1, 1.6));
}

export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  return { level, into: xp - base, span: xpForLevel(level + 1) - base };
}
