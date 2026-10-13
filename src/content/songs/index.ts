import type { SongDef } from '../../music/parse';
import { PIANO_RH, PIANO_LH, PIANO_BOTH } from './pianoLibrary';
import { GUITAR_TREBLE, GUITAR_BASS } from './guitarLibrary';

export type SongGroup = 'piano-rh' | 'piano-lh' | 'piano-both' | 'guitar-treble' | 'guitar-bass';

export const ALL_SONGS: SongDef[] = [...PIANO_RH, ...PIANO_LH, ...PIANO_BOTH, ...GUITAR_TREBLE, ...GUITAR_BASS];

const byId = new Map(ALL_SONGS.map(s => [s.id, s]));

export function getSong(id: string): SongDef | undefined {
  return byId.get(id);
}

export function songGroup(s: SongDef): SongGroup {
  if (s.instrument === 'guitar') return s.staves[0].clef === 'bass' ? 'guitar-bass' : 'guitar-treble';
  if (s.staves.length > 1) return 'piano-both';
  return s.staves[0].clef === 'bass' ? 'piano-lh' : 'piano-rh';
}

export function songsInGroup(g: SongGroup): SongDef[] {
  return ALL_SONGS.filter(s => songGroup(s) === g).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
}
