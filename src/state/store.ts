import { create } from 'zustand';
import {
  type LessonOutcome,
  type OutcomeReport,
  addTrack,
  applyOutcome,
  emptyData,
  makeExport,
  mergeData,
  newProfile,
  removeTrack,
  testOut,
} from './logic';
import { type SongRun, recordSongRun as recordSongRunLogic, newSongProgress } from './songs';
import type { SongDef } from '../music/parse';
import { getSong } from '../content/songs';
import { cleanTags } from './tags';
import {
  DEFAULT_DEVICE,
  type DeviceSettings,
  type PersistedData,
  type Profile,
  type ProfileSettings,
  type TrackId,
} from './types';

const DATA_KEY = 'clefcoach.data.v1';
const DEVICE_KEY = 'clefcoach.device.v1';
export const APP_VERSION = '1.0.0';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

let persistRequested = false;
/** Store a value; false when it couldn't be saved (storage full or blocked). */
function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Could not save progress', e);
    return false;
  }
  if (!persistRequested && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    persistRequested = true;
    navigator.storage.persist().catch(() => undefined);
  }
  return true;
}

interface AppState {
  data: PersistedData;
  device: DeviceSettings;
  /** Convenience selectors */
  profile: () => Profile | null;
  createProfile: (name: string, hue?: number) => Profile;
  switchProfile: (id: string) => void;
  renameProfile: (id: string, name: string, hue?: number) => void;
  deleteProfile: (id: string) => void;
  addTrack: (t: TrackId) => void;
  removeTrack: (t: TrackId) => void;
  setActiveTrack: (t: TrackId) => void;
  reorderTracks: (order: TrackId[]) => void;
  updateSettings: (s: Partial<ProfileSettings>) => void;
  updateDevice: (s: Partial<DeviceSettings>) => void;
  recordOutcome: (o: LessonOutcome) => OutcomeReport | null;
  testOut: (t: TrackId, lessonIds: string[]) => void;
  exportJson: (profileIds?: string[]) => string;
  importData: (d: PersistedData, mode: 'merge' | 'replace') => void;
  resetAll: () => void;
  /** Add or replace a song in the device's library. False (and nothing saved) when storage is full. */
  saveSong: (song: SongDef) => boolean;
  /** Add or replace several songs at once (all or nothing). False when storage is full. */
  saveSongs: (songs: SongDef[]) => boolean;
  deleteSong: (id: string) => void;
  /** Set a song's tags (an imported song keeps them in itself, a library song on the side). */
  setSongTags: (id: string, tags: string[]) => void;
  /** Start learning a song (adds it to "Learning now"). */
  startSong: (id: string) => void;
  archiveSong: (id: string, archived: boolean) => void;
  setSongGoal: (id: string, goal: { date: string; tempoPct: number } | null) => void;
  recordSongRun: (id: string, run: SongRun, twoParts: boolean, totalMeasures: number) => void;
}

function initialData(): PersistedData {
  const d = load<PersistedData>(DATA_KEY, emptyData());
  if (d?.app !== 'clef-coach' || typeof d.profiles !== 'object') return emptyData();
  return d;
}

export const useApp = create<AppState>((set, get) => {
  const commit = (data: PersistedData) => {
    save(DATA_KEY, data);
    set({ data });
  };
  /** Commit only if it can be stored (so a full storage doesn't lose what was there). */
  const commitIfSaved = (data: PersistedData): boolean => {
    if (!save(DATA_KEY, data)) return false;
    set({ data });
    return true;
  };
  const mutateProfile = (fn: (p: Profile) => Profile) => {
    const { data } = get();
    const id = data.activeProfileId;
    if (!id || !data.profiles[id]) return;
    commit({ ...data, profiles: { ...data.profiles, [id]: fn(data.profiles[id]) } });
  };

  return {
    data: initialData(),
    device: { ...DEFAULT_DEVICE, ...load<Partial<DeviceSettings>>(DEVICE_KEY, {}) },
    profile: () => {
      const { data } = get();
      return data.activeProfileId ? data.profiles[data.activeProfileId] ?? null : null;
    },
    createProfile: (name, hue) => {
      const p = newProfile(name, hue);
      const { data } = get();
      commit({ ...data, profiles: { ...data.profiles, [p.id]: p }, activeProfileId: p.id });
      return p;
    },
    switchProfile: id => {
      const { data } = get();
      if (data.profiles[id]) commit({ ...data, activeProfileId: id });
    },
    renameProfile: (id, name, hue) => {
      const { data } = get();
      const p = data.profiles[id];
      if (!p) return;
      commit({ ...data, profiles: { ...data.profiles, [id]: { ...p, name: name.trim() || p.name, hue: hue ?? p.hue } } });
    },
    deleteProfile: id => {
      const { data } = get();
      const profiles = { ...data.profiles };
      delete profiles[id];
      const activeProfileId = data.activeProfileId === id ? Object.keys(profiles)[0] ?? null : data.activeProfileId;
      commit({ ...data, profiles, activeProfileId });
    },
    addTrack: t => mutateProfile(p => addTrack(p, t)),
    removeTrack: t => mutateProfile(p => removeTrack(p, t)),
    setActiveTrack: t => mutateProfile(p => ({ ...p, activeTrackId: t })),
    reorderTracks: order => mutateProfile(p => ({ ...p, trackOrder: order })),
    updateSettings: s => mutateProfile(p => ({ ...p, settings: { ...p.settings, ...s } })),
    updateDevice: s => {
      const device = { ...get().device, ...s };
      save(DEVICE_KEY, device);
      set({ device });
    },
    recordOutcome: o => {
      const p = get().profile();
      if (!p) return null;
      const report = applyOutcome(p, o);
      mutateProfile(() => report.profile);
      return report;
    },
    testOut: (t, ids) => mutateProfile(p => testOut(p, t, ids)),
    exportJson: ids => JSON.stringify(makeExport(get().data, APP_VERSION, ids), null, 1),
    importData: (d, mode) => {
      commit(mode === 'replace' ? d : mergeData(get().data, d));
    },
    resetAll: () => {
      commit(emptyData());
    },
    saveSong: song => {
      const { data } = get();
      return commitIfSaved({ ...data, songs: { ...data.songs, [song.id]: song } });
    },
    saveSongs: list => {
      const { data } = get();
      return commitIfSaved({ ...data, songs: { ...data.songs, ...Object.fromEntries(list.map(s => [s.id, s])) } });
    },
    setSongTags: (id, tags) => {
      const { data } = get();
      const clean = cleanTags(tags);
      const own = data.songs?.[id];
      if (own) {
        commit({ ...data, songs: { ...data.songs, [id]: { ...own, tags: clean.length ? clean : undefined } } });
        return;
      }
      const songTags = { ...data.songTags };
      // back to the library's own tags: nothing to keep
      const lib = getSong(id)?.tags ?? [];
      if (clean.length === lib.length && clean.every((t, i) => t === lib[i])) delete songTags[id];
      else songTags[id] = clean;
      commit({ ...data, songTags });
    },
    deleteSong: id => {
      const { data } = get();
      const songs = { ...data.songs };
      delete songs[id];
      // forget practice records of the deleted song in every profile
      const profiles = Object.fromEntries(
        Object.entries(data.profiles).map(([pid, p]) => {
          if (!p.songs?.[id]) return [pid, p];
          const ps = { ...p.songs };
          delete ps[id];
          return [pid, { ...p, songs: ps }];
        }),
      );
      commit({ ...data, songs, profiles });
    },
    startSong: id =>
      mutateProfile(p => (p.songs?.[id] && !p.songs[id].archived ? p : { ...p, songs: { ...p.songs, [id]: { ...(p.songs?.[id] ?? newSongProgress()), archived: false } } })),
    archiveSong: (id, archived) => mutateProfile(p => (p.songs?.[id] ? { ...p, songs: { ...p.songs, [id]: { ...p.songs[id], archived } } } : p)),
    setSongGoal: (id, goal) =>
      mutateProfile(p => {
        const sp = p.songs?.[id] ?? newSongProgress();
        return { ...p, songs: { ...p.songs, [id]: { ...sp, goal: goal ?? undefined } } };
      }),
    recordSongRun: (id, run, twoParts, total) => mutateProfile(p => recordSongRunLogic(p, id, run, twoParts, total)),
  };
});

/** Hook: the active profile (re-renders on change). */
export function useProfile(): Profile | null {
  return useApp(s => (s.data.activeProfileId ? s.data.profiles[s.data.activeProfileId] ?? null : null));
}

export function useDevice(): DeviceSettings {
  return useApp(s => s.device);
}
