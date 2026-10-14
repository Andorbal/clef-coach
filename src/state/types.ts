import type { BassStrings, MalletVariant, UkuleleTuning } from '../music/instruments';
import type { NoteNaming } from '../music/pitch';
import type { SongDef } from '../music/parse';

export type TrackId =
  | 'piano-treble'
  | 'piano-bass'
  | 'piano-grand'
  | 'guitar-treble'
  | 'guitar-bass'
  | 'guitar-fretboard'
  | 'guitar-chords'
  | 'ukulele-treble'
  | 'ukulele-chords'
  | 'bass-lines'
  | 'bass-fretboard'
  | 'mallets-two'
  | 'mallets-four';

export const TRACK_IDS: TrackId[] = [
  'piano-treble',
  'piano-bass',
  'piano-grand',
  'guitar-treble',
  'guitar-bass',
  'guitar-fretboard',
  'guitar-chords',
  'ukulele-treble',
  'ukulele-chords',
  'bass-lines',
  'bass-fretboard',
  'mallets-two',
  'mallets-four',
];

export interface ItemStat {
  /** attempts */
  n: number;
  /** first-try correct */
  ok: number;
  /** exponential moving average of response time (ms) */
  ms: number;
  /** Leitner box 0..6 (higher = better known) */
  box: number;
  /** next review due (epoch ms) */
  due: number;
  /** last seen (epoch ms) */
  last: number;
}

export interface LessonProgress {
  stars: number; // 0..3
  best: number; // best accuracy 0..1
  plays: number;
  passed: boolean;
  /** passed by testing out (checkpoint) rather than playing */
  skipped?: boolean;
  lastAt: number;
}

export interface SessionLog {
  at: number;
  lessonId: string;
  accuracy: number;
  ms: number;
  xp: number;
  notes: number;
}

export interface TrackProgress {
  startedAt: number;
  lastPlayedAt: number;
  lessons: Record<string, LessonProgress>;
  items: Record<string, ItemStat>;
  log: SessionLog[];
}

export interface DayLog {
  xp: number;
  ms: number;
  lessons: number;
  notes: number;
}

export type Visibility = 'auto' | 'always' | 'never';

export interface ProfileSettings {
  naming: NoteNaming;
  noteNames: Visibility;
  fingering: Visibility;
  sfx: boolean;
  /** Metronome click during tempo exercises */
  metronome: boolean;
  /** Mirror guitar fretboard for left-handed players */
  leftHanded: boolean;
  dailyGoalXp: number;
  /** Show on-screen instrument labels */
  keyLabels: 'none' | 'c-only' | 'white';
  /** Which mallet instrument you play (changes range, sound and microphone octave). */
  malletVariant?: MalletVariant;
  /** Ukulele tuning: re-entrant high G (standard), low G or baritone. */
  ukuleleTuning?: UkuleleTuning;
  /** 4- or 5-string bass. */
  bassStrings?: BassStrings;
}

/** Results for one practice passage (a section, or any measure range) of a song. */
export interface PassageStat {
  runs: number;
  /** best accuracy 0..1 */
  best: number;
  /** consecutive runs at ≥ 90% */
  streak: number;
  /** fastest tempo (% of the song's tempo) played in time at ≥ 85% */
  tempoPct: number;
  lastAt: number;
  /** practice-plan stages completed: "R", "L", "both", "t60", "t80", "t100" */
  stages: string[];
}

/** A profile's practice record for one song. */
export interface SongProgress {
  startedAt: number;
  lastAt: number;
  ms: number;
  sessions: number;
  /** keyed "from-to" (1-based measures) */
  passages: Record<string, PassageStat>;
  /** mistakes per measure (1-based), slowly forgotten as you play it cleanly */
  trouble: Record<number, number>;
  /** best whole-song in-time tempo (% of the song's tempo) */
  bestTempoPct: number;
  /** "learn it by" target */
  goal?: { date: string; tempoPct: number };
  /** hidden from "Learning now" */
  archived?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  /** avatar hue 0..360 */
  hue: number;
  createdAt: number;
  tracks: Partial<Record<TrackId, TrackProgress>>;
  /** order of tracks on the home screen (also = "my tracks") */
  trackOrder: TrackId[];
  activeTrackId: TrackId | null;
  xp: number;
  streak: { current: number; best: number; lastDay: string | null; freezes: number };
  days: Record<string, DayLog>;
  achievements: Record<string, number>;
  settings: ProfileSettings;
  totals: { notes: number; ms: number; lessons: number; perfect: number };
  /** Songs being learned (by song id). */
  songs?: Record<string, SongProgress>;
}

export interface PersistedData {
  app: 'clef-coach';
  version: 1;
  profiles: Record<string, Profile>;
  activeProfileId: string | null;
  /** Songs imported on this device (shared by every profile), in the Clef Coach song format. */
  songs?: Record<string, SongDef>;
  /** Tags given to library songs (by song id); an imported song keeps its tags in the song itself. */
  songTags?: Record<string, string[]>;
}

export type InputMode = 'touch' | 'midi' | 'mic';

/** Device-specific settings: never exported (MIDI device ids etc. don't transfer). */
export interface DeviceSettings {
  inputMode: InputMode;
  midiDeviceId: string | 'all';
  micSensitivity: number;
  volume: number;
  sfxVolume: number;
  /** Extra latency compensation for tempo exercises (ms) */
  latencyMs: number;
  installPromptDismissed: boolean;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  naming: 'letter',
  noteNames: 'auto',
  fingering: 'auto',
  sfx: true,
  metronome: true,
  leftHanded: false,
  dailyGoalXp: 50,
  keyLabels: 'c-only',
  malletVariant: 'marimba',
  ukuleleTuning: 'high-g',
  bassStrings: 4,
};

export const DEFAULT_DEVICE: DeviceSettings = {
  inputMode: 'touch',
  midiDeviceId: 'all',
  micSensitivity: 0.6,
  volume: 0.8,
  sfxVolume: 0.6,
  latencyMs: 0,
  installPromptDismissed: false,
};
