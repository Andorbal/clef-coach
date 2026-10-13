import type { SongDef } from '../../music/parse';
import type { InstrumentId } from '../../music/instruments';
import { PIANO_RH, PIANO_LH, PIANO_BOTH } from './pianoLibrary';
import { GUITAR_TREBLE, GUITAR_BASS } from './guitarLibrary';
import { MALLETS } from './malletLibrary';

/** Library shelves: one or more per instrument. */
export type SongGroup =
  | 'piano-rh'
  | 'piano-lh'
  | 'piano-both'
  | 'guitar-treble'
  | 'guitar-bass'
  | 'ukulele'
  | 'bass'
  | 'mallets-two'
  | 'mallets-four';

export interface SongGroupDef {
  id: SongGroup;
  instrument: InstrumentId;
  label: string;
  /** Track whose progress (and colours) the shelf uses. */
  track: string;
}

export const SONG_GROUPS: SongGroupDef[] = [
  { id: 'piano-rh', instrument: 'piano', label: 'Right hand', track: 'piano-treble' },
  { id: 'piano-lh', instrument: 'piano', label: 'Left hand', track: 'piano-bass' },
  { id: 'piano-both', instrument: 'piano', label: 'Both hands', track: 'piano-grand' },
  { id: 'guitar-treble', instrument: 'guitar', label: 'Guitar', track: 'guitar-treble' },
  { id: 'guitar-bass', instrument: 'guitar', label: 'Guitar bass clef', track: 'guitar-bass' },
  { id: 'ukulele', instrument: 'ukulele', label: 'Ukulele', track: 'ukulele-treble' },
  { id: 'bass', instrument: 'bass', label: 'Bass guitar', track: 'bass-lines' },
  { id: 'mallets-two', instrument: 'mallets', label: 'Two mallets', track: 'mallets-two' },
  { id: 'mallets-four', instrument: 'mallets', label: 'Four mallets', track: 'mallets-four' },
];

/**
 * Every built-in song. Libraries for each instrument live in their own file and are
 * appended here.
 */
export const ALL_SONGS: SongDef[] = [...PIANO_RH, ...PIANO_LH, ...PIANO_BOTH, ...GUITAR_TREBLE, ...GUITAR_BASS, ...MALLETS];

const byId = new Map(ALL_SONGS.map(s => [s.id, s]));

export function getSong(id: string): SongDef | undefined {
  return byId.get(id);
}

export function songGroup(s: SongDef): SongGroup {
  switch (s.instrument) {
    case 'guitar':
      return s.staves[0].clef === 'bass' ? 'guitar-bass' : 'guitar-treble';
    case 'ukulele':
      return 'ukulele';
    case 'bass':
      return 'bass';
    case 'mallets':
      return s.mallets === 4 || s.staves.length > 1 ? 'mallets-four' : 'mallets-two';
    default:
      if (s.staves.length > 1) return 'piano-both';
      return s.staves[0].clef === 'bass' ? 'piano-lh' : 'piano-rh';
  }
}

export function songGroupDef(g: SongGroup): SongGroupDef {
  return SONG_GROUPS.find(x => x.id === g) ?? SONG_GROUPS[0];
}

export function songsInGroup(g: SongGroup): SongDef[] {
  return ALL_SONGS.filter(s => songGroup(s) === g).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
}
