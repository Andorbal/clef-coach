/**
 * Song learning: practice records, the guided practice plan and goal pacing.
 * Pure functions (no React, no storage) so they're easy to test.
 *
 * The practice method is the one teachers use for any piece:
 *  1. learn it in short phrases,
 *  2. hands (or parts) separately first, slowly and without a metronome ("wait mode"),
 *  3. then hands together,
 *  4. then in time, building the tempo up in steps (60% → 80% → 100%),
 *  5. and "snowball" the phrases together: 1, 1–2, 1–3 … until the whole song flows.
 */
import type { SongDef, SongSection } from '../music/parse';
import type { Score } from '../music/score';
import { songSections } from '../songs/format';
import { dayKey, daysBetween } from './dates';
import type { PassageStat, Profile, SongProgress } from './types';

export type SongPart = 'all' | 'R' | 'L';

export interface SongRun {
  /** 1-based inclusive measure range played */
  from: number;
  to: number;
  mode: 'wait' | 'tempo';
  /** tempo as % of the song's own tempo (tempo mode) */
  tempoPct: number;
  part: SongPart;
  /** some notes were left to the app (a string or mallet filter) */
  partial?: boolean;
  accuracy: number;
  /** graded steps per measure, 1-based absolute measure numbers */
  measures?: Record<number, { total: number; clean: number }>;
  ms: number;
}

export const passageKey = (from: number, to: number) => `${from}-${to}`;

export function newSongProgress(now = Date.now()): SongProgress {
  return { startedAt: now, lastAt: now, ms: 0, sessions: 0, passages: {}, trouble: {}, bestTempoPct: 0 };
}

/** Plan stages a run completes. */
export function stagesFor(run: Pick<SongRun, 'mode' | 'tempoPct' | 'part' | 'partial' | 'accuracy'>, twoParts: boolean): string[] {
  if (run.partial) return [];
  if (run.mode === 'wait') {
    if (run.accuracy < 0.9) return [];
    if (run.part === 'all') return twoParts ? ['R', 'L', 'both'] : ['both'];
    return [run.part];
  }
  if (run.part !== 'all' || run.accuracy < 0.85) return [];
  const out = ['both'];
  if (run.tempoPct >= 58) out.push('t60');
  if (run.tempoPct >= 78) out.push('t80');
  if (run.tempoPct >= 98) out.push('t100');
  return out;
}

/** Record one practice run. Returns a new profile. */
export function recordSongRun(p0: Profile, songId: string, run: SongRun, twoParts: boolean, totalMeasures: number, now = Date.now()): Profile {
  const p: Profile = structuredClone(p0);
  const songs = (p.songs ??= {});
  const sp = songs[songId] ?? newSongProgress(now);
  songs[songId] = sp;
  if (now - sp.lastAt > 30 * 60_000 || sp.sessions === 0) sp.sessions += 1;
  sp.lastAt = now;
  sp.ms += Math.max(0, run.ms);
  sp.archived = false;
  const key = passageKey(run.from, run.to);
  const prev: PassageStat = sp.passages[key] ?? { runs: 0, best: 0, streak: 0, tempoPct: 0, lastAt: now, stages: [] };
  const stages = new Set([...prev.stages, ...stagesFor(run, twoParts)]);
  const inTimeOk = run.mode === 'tempo' && run.part === 'all' && !run.partial && run.accuracy >= 0.85;
  sp.passages[key] = {
    runs: prev.runs + 1,
    best: Math.max(prev.best, run.accuracy),
    streak: run.accuracy >= 0.9 ? prev.streak + 1 : 0,
    tempoPct: inTimeOk ? Math.max(prev.tempoPct, run.tempoPct) : prev.tempoPct,
    lastAt: now,
    stages: [...stages],
  };
  // a clean run of a longer passage counts for the sections inside it too
  if (stages.size > prev.stages.length) {
    for (const [k, st] of Object.entries(sp.passages)) {
      const [f, t] = k.split('-').map(Number);
      if (k === key || f < run.from || t > run.to) continue;
      const add = stagesFor(run, twoParts);
      st.stages = [...new Set([...st.stages, ...add])];
      if (inTimeOk) st.tempoPct = Math.max(st.tempoPct, run.tempoPct);
    }
  }
  if (inTimeOk && run.from === 1 && run.to >= totalMeasures) sp.bestTempoPct = Math.max(sp.bestTempoPct, run.tempoPct);
  // trouble spots: add mistakes, forgive clean playing
  for (const [m, st] of Object.entries(run.measures ?? {})) {
    const miss = st.total - st.clean;
    const cur = sp.trouble[Number(m)] ?? 0;
    const next = miss > 0 ? cur + miss : cur * 0.5;
    if (next < 0.3) delete sp.trouble[Number(m)];
    else sp.trouble[Number(m)] = Math.round(next * 10) / 10;
  }
  return p;
}

/** 0 new · 1 started · 2 notes learned (hands together, slowly) · 3 in time (80%) · 4 up to tempo */
export function passageLevel(st: PassageStat | undefined): number {
  if (!st || !st.runs) return 0;
  if (st.stages.includes('t100')) return 4;
  if (st.stages.includes('t80')) return 3;
  if (st.stages.includes('both')) return 2;
  return 1;
}

export const LEVEL_NAMES = ['New', 'Started', 'Notes learned', 'In time', 'Up to tempo'];

/** Does this song have two parts to practise separately (piano hands, mallet grand staff)? */
export function songHasTwoParts(song: Pick<SongDef, 'instrument' | 'staves'>): boolean {
  return (song.instrument === 'piano' || song.instrument === 'mallets') && song.staves.length > 1;
}

export interface PlanStep {
  from: number;
  to: number;
  part: SongPart;
  mode: 'wait' | 'tempo';
  tempoPct: number;
  stage: string;
  title: string;
  why: string;
  /** joining phrases together */
  chain?: boolean;
}

function stageList(twoParts: boolean): string[] {
  return twoParts ? ['R', 'L', 'both', 't60', 't80', 't100'] : ['both', 't60', 't80', 't100'];
}

function stepFor(sec: SongSection, stage: string, twoParts: boolean, chain = false): PlanStep {
  const name = chain ? `${sec.name}` : sec.name;
  const hands = (p: SongPart) => (p === 'R' ? 'right hand' : p === 'L' ? 'left hand' : twoParts ? 'hands together' : '');
  switch (stage) {
    case 'R':
    case 'L':
      return { from: sec.from, to: sec.to, part: stage, mode: 'wait', tempoPct: 100, stage, chain, title: `${name} · ${hands(stage)}`, why: `Learn the ${hands(stage)} on its own first — no clock, just the right notes and fingers. The app plays the other hand.` };
    case 'both':
      return { from: sec.from, to: sec.to, part: 'all', mode: 'wait', tempoPct: 100, stage, chain, title: `${name}${twoParts ? ' · hands together' : ''}`, why: twoParts ? 'Put the hands together slowly. The music waits for you on every note.' : 'Learn the notes at your own pace. The music waits for you on every note.' };
    default: {
      const pct = stage === 't60' ? 60 : stage === 't80' ? 80 : 100;
      return {
        from: sec.from,
        to: sec.to,
        part: 'all',
        mode: 'tempo',
        tempoPct: pct,
        stage,
        chain,
        title: `${name} · in time at ${pct}%`,
        why: pct < 100 ? `Now with the metronome, slowly (${pct}% speed). Keep going through mistakes — steady beats fast.` : 'Full speed. Three clean runs in a row and it’s yours.',
      };
    }
  }
}

/** Every step of the plan in order (sections, then snowballing chains). */
export function planSteps(song: Pick<SongDef, 'sections' | 'instrument' | 'staves'>, score: Pick<Score, 'measures' | 'pickup'>): PlanStep[] {
  const twoParts = songHasTwoParts(song);
  const secs = songSections(song, score);
  const out: PlanStep[] = [];
  secs.forEach((sec, i) => {
    for (const st of stageList(twoParts)) out.push(stepFor(sec, st, twoParts));
    if (i > 0) {
      const chain: SongSection = { name: i === secs.length - 1 ? 'Whole song' : `${secs[0].name}–${sec.name.replace(/^Phrase /, '')}`, from: secs[0].from, to: sec.to };
      for (const st of ['t80', 't100']) out.push(stepFor(chain, st, twoParts, true));
    }
  });
  if (secs.length === 1) out.push(stepFor({ name: 'Whole song', from: 1, to: score.measures }, 't100', twoParts, true));
  return out;
}

export function stepDone(step: PlanStep, sp: SongProgress | undefined): boolean {
  return !!sp?.passages[passageKey(step.from, step.to)]?.stages.includes(step.stage);
}

/** The next unfinished step of the guided plan (null when the song is learned). */
export function nextPlanStep(song: Pick<SongDef, 'sections' | 'instrument' | 'staves'>, score: Pick<Score, 'measures' | 'pickup'>, sp: SongProgress | undefined): PlanStep | null {
  return planSteps(song, score).find(s => !stepDone(s, sp)) ?? null;
}

export function planProgress(song: Pick<SongDef, 'sections' | 'instrument' | 'staves'>, score: Pick<Score, 'measures' | 'pickup'>, sp: SongProgress | undefined): { done: number; total: number } {
  const steps = planSteps(song, score);
  return { done: steps.filter(s => stepDone(s, sp)).length, total: steps.length };
}

/** The worst trouble spot as a short passage (two bars around it), if any. */
export function troubleSpot(sp: SongProgress | undefined, measures: number): { from: number; to: number; misses: number } | null {
  if (!sp) return null;
  const entries = Object.entries(sp.trouble).map(([m, v]) => [Number(m), v] as const).filter(([m, v]) => v >= 1 && m >= 1 && m <= measures);
  if (!entries.length) return null;
  // best two-bar window
  let best = { from: 1, to: Math.min(2, measures), misses: 0 };
  for (const [m] of entries) {
    for (const from of [m - 1, m]) {
      if (from < 1 || from + 1 > measures) continue;
      const misses = (sp.trouble[from] ?? 0) + (sp.trouble[from + 1] ?? 0);
      if (misses > best.misses) best = { from, to: from + 1, misses };
    }
  }
  return best.misses ? best : null;
}

export interface GoalPace {
  daysLeft: number;
  /** plan steps to finish per practice day to make it */
  perDay: number;
  status: 'done' | 'ahead' | 'on-track' | 'behind' | 'past';
  remaining: number;
}

/** How you're doing against a "learn it by" date. */
export function goalPace(song: Pick<SongDef, 'sections' | 'instrument' | 'staves'>, score: Pick<Score, 'measures' | 'pickup'>, sp: SongProgress | undefined, today = dayKey()): GoalPace | null {
  if (!sp?.goal) return null;
  const { done, total } = planProgress(song, score, sp);
  const remaining = total - done;
  const daysLeft = daysBetween(today, sp.goal.date);
  if (remaining === 0) return { daysLeft, perDay: 0, status: 'done', remaining };
  if (daysLeft < 0) return { daysLeft, perDay: remaining, status: 'past', remaining };
  const perDay = Math.ceil(remaining / Math.max(1, daysLeft));
  const started = dayKey(new Date(sp.startedAt));
  const span = Math.max(1, daysBetween(started, sp.goal.date));
  const elapsed = Math.max(0, daysBetween(started, today));
  const expected = (elapsed / span) * total;
  const status = done >= expected + total * 0.1 ? 'ahead' : done >= expected - total * 0.1 ? 'on-track' : 'behind';
  return { daysLeft, perDay, status, remaining };
}

/** Today's practice: the next plan steps (as many as the goal pace needs, at least two) plus a trouble spot. */
export function todaysPlan(song: Pick<SongDef, 'sections' | 'instrument' | 'staves'>, score: Pick<Score, 'measures' | 'pickup'>, sp: SongProgress | undefined): PlanStep[] {
  const pace = goalPace(song, score, sp);
  const n = Math.min(6, Math.max(2, pace?.perDay ?? 2));
  const steps = planSteps(song, score).filter(s => !stepDone(s, sp)).slice(0, n);
  const t = troubleSpot(sp, score.measures);
  if (t && !steps.some(s => s.from <= t.from && s.to >= t.to && s.mode === 'wait')) {
    steps.push({ from: t.from, to: t.to, part: 'all', mode: 'wait', tempoPct: 100, stage: 'fix', title: `Trouble spot · bars ${t.from}–${t.to}`, why: 'You missed notes here last time. Loop it slowly until it’s clean three times in a row.' });
  }
  return steps;
}

/** Merge two devices' records of the same song. */
export function mergeSongProgress(a: SongProgress | undefined, b: SongProgress | undefined): SongProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  const passages = { ...a.passages };
  for (const [k, s] of Object.entries(b.passages)) {
    const x = passages[k];
    passages[k] = x
      ? { runs: Math.max(x.runs, s.runs), best: Math.max(x.best, s.best), streak: x.lastAt >= s.lastAt ? x.streak : s.streak, tempoPct: Math.max(x.tempoPct, s.tempoPct), lastAt: Math.max(x.lastAt, s.lastAt), stages: [...new Set([...x.stages, ...s.stages])] }
      : s;
  }
  const newer = a.lastAt >= b.lastAt ? a : b;
  return {
    startedAt: Math.min(a.startedAt, b.startedAt),
    lastAt: Math.max(a.lastAt, b.lastAt),
    ms: Math.max(a.ms, b.ms),
    sessions: Math.max(a.sessions, b.sessions),
    passages,
    trouble: newer.trouble,
    bestTempoPct: Math.max(a.bestTempoPct, b.bestTempoPct),
    goal: newer.goal ?? a.goal ?? b.goal,
    archived: newer.archived,
  };
}
