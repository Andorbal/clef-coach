import type { ActivityDef, TrackDef } from '../curriculum/types';
import type { Rng } from '../curriculum/generate';
import type { ItemResult } from '../state/srs';
import type { DeviceSettings, ItemStat, ProfileSettings } from '../state/types';

export interface LessonCtx {
  track: TrackDef;
  instrument: 'piano' | 'guitar';
  settings: ProfileSettings;
  device: DeviceSettings;
  /** item stats for SRS-weighted selection */
  items: Record<string, ItemStat>;
  rng: Rng;
  isCheckpoint: boolean;
  /** 0..1 position of this lesson within its track (early lessons get more hints) */
  progress: number;
}

export interface ActivityResult {
  /** gradable units (cards, steps) */
  total: number;
  /** first-try correct units */
  correct: number;
  items: ItemResult[];
  /** notes played/named (for stats) */
  notes: number;
  /** response times of correct answers (ms) */
  responseMs: number[];
  /** non-graded activity (tips) */
  ungraded?: boolean;
}

export interface ActivityProps<T extends ActivityDef = ActivityDef> {
  def: T;
  ctx: LessonCtx;
  onDone: (r: ActivityResult) => void;
}

export function emptyResult(ungraded = false): ActivityResult {
  return { total: 0, correct: 0, items: [], notes: 0, responseMs: [], ungraded };
}

/** Visibility helper: profile setting 'auto' defers to the lesson's own choice. */
export function resolveVisibility(setting: 'auto' | 'always' | 'never', lessonWants: boolean): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return lessonWants;
}
