/**
 * Pure state transitions for profiles & progress (no React, no storage) — easy to test.
 */
import { type AchievementDef, levelFromXp, newAchievements } from './achievements';
import { dayKey, daysBetween } from './dates';
import { type ItemResult, updateItem } from './srs';
import { mergeSongProgress } from './songs';
import { parseSongDoc } from '../songs/format';
import type { SongDef } from '../music/parse';
import {
  DEFAULT_SETTINGS,
  type LessonProgress,
  type PersistedData,
  type Profile,
  type TrackId,
  type TrackProgress,
  TRACK_IDS,
} from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyData(): PersistedData {
  return { app: 'clef-coach', version: 1, profiles: {}, activeProfileId: null };
}

export function newProfile(name: string, hue = Math.floor(Math.random() * 360)): Profile {
  return {
    id: uid(),
    name: name.trim() || 'Player',
    hue,
    createdAt: Date.now(),
    tracks: {},
    trackOrder: [],
    activeTrackId: null,
    xp: 0,
    streak: { current: 0, best: 0, lastDay: null, freezes: 0 },
    days: {},
    achievements: {},
    settings: { ...DEFAULT_SETTINGS },
    totals: { notes: 0, ms: 0, lessons: 0, perfect: 0 },
  };
}

export function newTrackProgress(): TrackProgress {
  return { startedAt: Date.now(), lastPlayedAt: Date.now(), lessons: {}, items: {}, log: [] };
}

export function addTrack(p: Profile, t: TrackId): Profile {
  const tracks = { ...p.tracks };
  if (!tracks[t]) tracks[t] = newTrackProgress();
  const trackOrder = p.trackOrder.includes(t) ? p.trackOrder : [...p.trackOrder, t];
  return { ...p, tracks, trackOrder, activeTrackId: t };
}

/** Hide a track from "my tracks" (progress is kept so it can be re-added). */
export function removeTrack(p: Profile, t: TrackId): Profile {
  const trackOrder = p.trackOrder.filter(x => x !== t);
  return { ...p, trackOrder, activeTrackId: p.activeTrackId === t ? trackOrder[0] ?? null : p.activeTrackId };
}

/** The streak as it stands today (a missed day breaks it unless a freeze covers it). */
export function effectiveStreak(p: Profile, today = dayKey()): number {
  if (!p.streak.lastDay) return 0;
  const gap = daysBetween(p.streak.lastDay, today);
  if (gap <= 1) return p.streak.current;
  if (gap - 1 <= p.streak.freezes) return p.streak.current;
  return 0;
}

export interface LessonOutcome {
  trackId: TrackId;
  lessonId: string;
  lessonKind: string;
  accuracy: number;
  stars: number;
  passed: boolean;
  ms: number;
  notes: number;
  xp: number;
  items: ItemResult[];
  avgResponseMs?: number;
  /** don't touch lesson progress (e.g. free practice / review) */
  practiceOnly?: boolean;
}

export interface OutcomeReport {
  profile: Profile;
  achievements: AchievementDef[];
  levelUp: number | null;
  streakExtended: boolean;
  streak: number;
  goalReached: boolean;
}

export function applyOutcome(p0: Profile, o: LessonOutcome, now = Date.now()): OutcomeReport {
  const today = dayKey(new Date(now));
  const p: Profile = structuredClone(p0);
  const tp = p.tracks[o.trackId] ?? newTrackProgress();
  p.tracks[o.trackId] = tp;
  if (!p.trackOrder.includes(o.trackId)) p.trackOrder.push(o.trackId);
  tp.lastPlayedAt = now;

  if (!o.practiceOnly) {
    const prev: LessonProgress | undefined = tp.lessons[o.lessonId];
    tp.lessons[o.lessonId] = {
      stars: Math.max(prev?.stars ?? 0, o.stars),
      best: Math.max(prev?.best ?? 0, o.accuracy),
      plays: (prev?.plays ?? 0) + 1,
      passed: (prev?.passed && !prev.skipped) || o.passed,
      skipped: prev?.skipped && !o.passed ? true : undefined,
      lastAt: now,
    };
  }
  for (const r of o.items) tp.items[r.key] = updateItem(tp.items[r.key], r, now);
  tp.log.push({ at: now, lessonId: o.lessonId, accuracy: o.accuracy, ms: o.ms, xp: o.xp, notes: o.notes });
  if (tp.log.length > 400) tp.log.splice(0, tp.log.length - 400);

  const levelBefore = levelFromXp(p.xp).level;
  p.xp += o.xp;
  const levelAfter = levelFromXp(p.xp).level;

  const day = p.days[today] ?? { xp: 0, ms: 0, lessons: 0, notes: 0 };
  const goalBefore = day.xp >= p.settings.dailyGoalXp;
  day.xp += o.xp;
  day.ms += o.ms;
  day.lessons += 1;
  day.notes += o.notes;
  p.days[today] = day;
  const goalReached = !goalBefore && day.xp >= p.settings.dailyGoalXp;

  // streak
  let streakExtended = false;
  if (p.streak.lastDay !== today) {
    const cur = effectiveStreak(p, today);
    const gap = p.streak.lastDay ? daysBetween(p.streak.lastDay, today) : 1;
    if (cur > 0 && gap > 1) p.streak.freezes = Math.max(0, p.streak.freezes - (gap - 1));
    p.streak.current = cur + 1;
    p.streak.lastDay = today;
    p.streak.best = Math.max(p.streak.best, p.streak.current);
    streakExtended = true;
    // earn a streak freeze every 7 days (max 2)
    if (p.streak.current % 7 === 0) p.streak.freezes = Math.min(2, p.streak.freezes + 1);
  }

  p.totals.notes += o.notes;
  p.totals.ms += o.ms;
  p.totals.lessons += 1;
  if (o.accuracy >= 0.999 && o.notes >= 5) p.totals.perfect += 1;

  const unlocked = newAchievements(p, {
    trackId: o.trackId,
    accuracy: o.accuracy,
    lessonKind: o.lessonKind,
    avgResponseMs: o.avgResponseMs,
  });
  for (const a of unlocked) p.achievements[a.id] = now;

  return {
    profile: p,
    achievements: unlocked,
    levelUp: levelAfter > levelBefore ? levelAfter : null,
    streakExtended,
    streak: p.streak.current,
    goalReached,
  };
}

/** Mark lessons as passed via a checkpoint "test out". */
export function testOut(p0: Profile, trackId: TrackId, lessonIds: string[], now = Date.now()): Profile {
  const p = structuredClone(p0);
  const tp = p.tracks[trackId] ?? newTrackProgress();
  p.tracks[trackId] = tp;
  for (const id of lessonIds) {
    const prev = tp.lessons[id];
    if (prev?.passed) continue;
    tp.lessons[id] = { stars: prev?.stars ?? 0, best: prev?.best ?? 0, plays: prev?.plays ?? 0, passed: true, skipped: true, lastAt: now };
  }
  return p;
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

export interface ExportFile extends PersistedData {
  exportedAt: string;
  appVersion: string;
}

export function makeExport(data: PersistedData, appVersion: string, profileIds?: string[]): ExportFile {
  const profiles: Record<string, Profile> = {};
  for (const [id, p] of Object.entries(data.profiles)) {
    if (!profileIds || profileIds.includes(id)) profiles[id] = p;
  }
  return {
    app: 'clef-coach',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion,
    profiles,
    activeProfileId: data.activeProfileId && profiles[data.activeProfileId] ? data.activeProfileId : Object.keys(profiles)[0] ?? null,
    ...(data.songs && Object.keys(data.songs).length ? { songs: data.songs } : {}),
  };
}

export class ImportError extends Error {}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);

/** Validate + normalise an imported file. Throws ImportError with a friendly message. */
export function parseImport(text: string): PersistedData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't valid Clef Coach data (it couldn't be read as JSON).");
  }
  if (!isObj(raw) || raw.app !== 'clef-coach') throw new ImportError("That file doesn't look like a Clef Coach backup.");
  if (num(raw.version) > 1) throw new ImportError('This backup was made by a newer version of Clef Coach. Please update the app first.');
  if (!isObj(raw.profiles)) throw new ImportError('The backup contains no profiles.');
  const profiles: Record<string, Profile> = {};
  for (const [id, rp] of Object.entries(raw.profiles)) {
    if (!isObj(rp)) continue;
    const base = newProfile(str(rp.name, 'Player'), num(rp.hue, 200));
    const p: Profile = {
      ...base,
      id: str(rp.id, id) || id,
      createdAt: num(rp.createdAt, Date.now()),
      xp: Math.max(0, num(rp.xp)),
      trackOrder: Array.isArray(rp.trackOrder) ? (rp.trackOrder as unknown[]).filter((t): t is TrackId => TRACK_IDS.includes(t as TrackId)) : [],
      activeTrackId: TRACK_IDS.includes(rp.activeTrackId as TrackId) ? (rp.activeTrackId as TrackId) : null,
      streak: isObj(rp.streak)
        ? {
            current: num(rp.streak.current),
            best: num(rp.streak.best),
            lastDay: typeof rp.streak.lastDay === 'string' ? rp.streak.lastDay : null,
            freezes: num(rp.streak.freezes),
          }
        : base.streak,
      days: isObj(rp.days) ? (rp.days as Profile['days']) : {},
      achievements: isObj(rp.achievements) ? (rp.achievements as Profile['achievements']) : {},
      settings: { ...DEFAULT_SETTINGS, ...(isObj(rp.settings) ? (rp.settings as Partial<Profile['settings']>) : {}) },
      totals: isObj(rp.totals)
        ? { notes: num(rp.totals.notes), ms: num(rp.totals.ms), lessons: num(rp.totals.lessons), perfect: num(rp.totals.perfect) }
        : base.totals,
      tracks: {},
      songs: isObj(rp.songs) ? (rp.songs as Profile['songs']) : undefined,
    };
    if (isObj(rp.tracks)) {
      for (const [tid, rt] of Object.entries(rp.tracks)) {
        if (!TRACK_IDS.includes(tid as TrackId) || !isObj(rt)) continue;
        p.tracks[tid as TrackId] = {
          startedAt: num(rt.startedAt, Date.now()),
          lastPlayedAt: num(rt.lastPlayedAt, Date.now()),
          lessons: isObj(rt.lessons) ? (rt.lessons as TrackProgress['lessons']) : {},
          items: isObj(rt.items) ? (rt.items as TrackProgress['items']) : {},
          log: Array.isArray(rt.log) ? (rt.log as TrackProgress['log']).slice(-400) : [],
        };
      }
    }
    profiles[p.id] = p;
  }
  if (!Object.keys(profiles).length) throw new ImportError('The backup contains no profiles.');
  const active = typeof raw.activeProfileId === 'string' && profiles[raw.activeProfileId] ? raw.activeProfileId : Object.keys(profiles)[0];
  // imported songs: keep the ones that still read cleanly
  const songs: Record<string, SongDef> = {};
  if (isObj(raw.songs)) {
    for (const [id, doc] of Object.entries(raw.songs)) {
      try {
        songs[id] = parseSongDoc(doc, { id }).song;
      } catch {
        /* skip a damaged song rather than the whole backup */
      }
    }
  }
  return { app: 'clef-coach', version: 1, profiles, activeProfileId: active, ...(Object.keys(songs).length ? { songs } : {}) };
}

function mergeTrack(a: TrackProgress | undefined, b: TrackProgress | undefined): TrackProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  const lessons = { ...a.lessons };
  for (const [id, l] of Object.entries(b.lessons)) {
    const x = lessons[id];
    lessons[id] = x
      ? {
          stars: Math.max(x.stars, l.stars),
          best: Math.max(x.best, l.best),
          plays: Math.max(x.plays, l.plays),
          passed: x.passed || l.passed,
          // a real pass on either device beats a test-out
          skipped: (x.passed && !x.skipped) || (l.passed && !l.skipped) ? undefined : x.skipped || l.skipped ? true : undefined,
          lastAt: Math.max(x.lastAt, l.lastAt),
        }
      : l;
  }
  const items = { ...a.items };
  for (const [k, s] of Object.entries(b.items)) {
    if (!items[k] || items[k].last < s.last) items[k] = s;
  }
  const seen = new Set(a.log.map(e => `${e.at}|${e.lessonId}`));
  const log = [...a.log, ...b.log.filter(e => !seen.has(`${e.at}|${e.lessonId}`))].sort((x, y) => x.at - y.at).slice(-400);
  return {
    startedAt: Math.min(a.startedAt, b.startedAt),
    lastPlayedAt: Math.max(a.lastPlayedAt, b.lastPlayedAt),
    lessons,
    items,
    log,
  };
}

export function mergeProfiles(a: Profile, b: Profile): Profile {
  const tracks: Profile['tracks'] = {};
  for (const t of TRACK_IDS) {
    const m = mergeTrack(a.tracks[t], b.tracks[t]);
    if (m) tracks[t] = m;
  }
  const days = { ...a.days };
  for (const [k, d] of Object.entries(b.days)) {
    const x = days[k];
    days[k] = x ? { xp: Math.max(x.xp, d.xp), ms: Math.max(x.ms, d.ms), lessons: Math.max(x.lessons, d.lessons), notes: Math.max(x.notes, d.notes) } : d;
  }
  const achievements = { ...a.achievements };
  for (const [k, t] of Object.entries(b.achievements)) achievements[k] = achievements[k] ? Math.min(achievements[k], t) : t;
  const newer = (b.streak.lastDay ?? '') > (a.streak.lastDay ?? '') ? b : a;
  const songs: NonNullable<Profile['songs']> = { ...a.songs };
  for (const [id, sp] of Object.entries(b.songs ?? {})) songs[id] = mergeSongProgress(songs[id], sp)!;
  return {
    ...a,
    name: a.name,
    tracks,
    trackOrder: [...new Set([...a.trackOrder, ...b.trackOrder])],
    xp: Math.max(a.xp, b.xp),
    streak: { ...newer.streak, best: Math.max(a.streak.best, b.streak.best) },
    days,
    achievements,
    totals: {
      notes: Math.max(a.totals.notes, b.totals.notes),
      ms: Math.max(a.totals.ms, b.totals.ms),
      lessons: Math.max(a.totals.lessons, b.totals.lessons),
      perfect: Math.max(a.totals.perfect, b.totals.perfect),
    },
    songs: Object.keys(songs).length ? songs : undefined,
  };
}

/** Merge imported data into existing data (profiles with the same id are combined). */
export function mergeData(cur: PersistedData, inc: PersistedData): PersistedData {
  const profiles = { ...cur.profiles };
  for (const [id, p] of Object.entries(inc.profiles)) {
    profiles[id] = profiles[id] ? mergeProfiles(profiles[id], p) : p;
  }
  const songs = { ...cur.songs, ...inc.songs };
  return { ...cur, profiles, activeProfileId: cur.activeProfileId ?? inc.activeProfileId, ...(Object.keys(songs).length ? { songs } : {}) };
}
