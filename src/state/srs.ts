import type { ItemStat } from './types';

/** Leitner intervals per box (ms). */
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
export const BOX_INTERVALS = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
export const MAX_BOX = BOX_INTERVALS.length - 1;

export interface ItemResult {
  key: string;
  correct: boolean;
  /** response time in ms (time to the correct answer) */
  ms?: number;
}

/** Response time that counts as "fluent" for a reading item. */
export function fluentMs(key: string): number {
  if (key.startsWith('fret:')) return 2500;
  if (key.startsWith('interval:') || key.startsWith('key:')) return 3500;
  return 2200;
}

export function updateItem(prev: ItemStat | undefined, r: ItemResult, now = Date.now()): ItemStat {
  const s: ItemStat = prev ? { ...prev } : { n: 0, ok: 0, ms: 0, box: 0, due: now, last: now };
  s.n += 1;
  if (r.correct) s.ok += 1;
  if (r.ms !== undefined && r.ms > 0) {
    const ms = Math.min(r.ms, 15000);
    s.ms = s.ms ? s.ms * 0.7 + ms * 0.3 : ms;
  }
  if (r.correct) {
    const fast = r.ms === undefined || r.ms <= fluentMs(r.key);
    if (fast) s.box = Math.min(MAX_BOX, s.box + 1);
  } else {
    s.box = Math.max(0, s.box - 2);
  }
  s.due = now + BOX_INTERVALS[s.box];
  s.last = now;
  return s;
}

/** 0..1 mastery used for heatmaps. Combines retention box, accuracy and speed. */
export function mastery(s: ItemStat | undefined, now = Date.now()): number {
  if (!s || s.n === 0) return 0;
  const acc = (s.ok + 1) / (s.n + 2);
  const boxScore = s.box / MAX_BOX;
  const speed = s.ms ? Math.max(0, Math.min(1, (6000 - s.ms) / 4500)) : 0.5;
  // gentle decay when overdue
  const overdue = Math.max(0, now - s.due);
  const decay = Math.exp(-overdue / (30 * DAY));
  return Math.max(0, Math.min(1, (boxScore * 0.5 + acc * 0.3 + speed * 0.2) * (0.6 + 0.4 * decay)));
}

/** Priority for review (higher = more urgent). */
export function reviewPriority(s: ItemStat | undefined, now = Date.now()): number {
  if (!s) return 0.5;
  const overdue = (now - s.due) / DAY;
  const weak = 1 - (s.ok + 1) / (s.n + 2);
  const slow = s.ms ? Math.min(1, s.ms / 6000) : 0.3;
  return (overdue > 0 ? 1 + Math.min(3, overdue) : 0) + weak * 2 + slow + (MAX_BOX - s.box) * 0.2;
}
