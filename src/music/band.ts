/**
 * Band parts: the accompaniment a song can carry besides the part the player learns —
 * a bass line, drums, a strummed or piano comp, strings… Written by hand in the song
 * file (or kept from the other tracks of an imported MIDI, MusicXML or Guitar Pro
 * file), in the same note language as the music, bar for bar.
 *
 *   "band": [
 *     { "name": "Bass", "program": 34, "voices": ["C2/q G2 C2 G2 | F2 C3 F2 C3 |"] },
 *     { "name": "Drums", "drums": true, "voices": ["[kick hat]/e hat [snare hat] hat [kick hat] hat [snare hat] hat | …"] }
 *   ]
 *
 * Songs without band parts (or without some of them) are accompanied by the arranger
 * (src/perform/arranger.ts), from the song's chords.
 */
import { clampProgram, drumWordsToPitches, gmFamily } from './gm';
import { type SongDef, type SongStaffDef, songToScore } from './parse';
import { midiOf } from './pitch';
import type { Clef, Score } from './score';

/** What a part does in the band, so the arranger knows what's missing and the mixer where to put it. */
export type BandRole = 'drums' | 'percussion' | 'bass' | 'chords' | 'pad' | 'melody' | 'counter';

export const BAND_ROLES: readonly BandRole[] = ['drums', 'percussion', 'bass', 'chords', 'pad', 'melody', 'counter'];

export const ROLE_NAMES: Record<BandRole, string> = {
  drums: 'Drums',
  percussion: 'Percussion',
  bass: 'Bass',
  chords: 'Chords',
  pad: 'Pad',
  melody: 'Melody',
  counter: 'Counter-melody',
};

/** Feel of an automatic accompaniment. "auto" picks one from the meter and tempo. */
export type BandStyle = 'auto' | 'pop' | 'rock' | 'ballad' | 'waltz' | 'swing' | 'bossa' | 'country' | 'march' | 'compound' | 'gentle';

export const BAND_STYLES: readonly { id: BandStyle; name: string; blurb: string }[] = [
  { id: 'auto', name: 'Automatic', blurb: 'Chosen from the meter and tempo.' },
  { id: 'pop', name: 'Pop', blurb: 'Straight eighths, backbeat on 2 and 4.' },
  { id: 'rock', name: 'Rock', blurb: 'Driving eighths and a bigger kit.' },
  { id: 'ballad', name: 'Ballad', blurb: 'Soft and spacious: side-stick, strings.' },
  { id: 'waltz', name: 'Waltz', blurb: 'Oom-pah-pah in three.' },
  { id: 'swing', name: 'Swing', blurb: 'Ride cymbal, walking bass, jazz comping.' },
  { id: 'bossa', name: 'Bossa nova', blurb: 'Light Latin groove with a nylon guitar.' },
  { id: 'country', name: 'Country / folk', blurb: 'Boom-chick bass and strummed guitar.' },
  { id: 'march', name: 'March', blurb: 'Snare drum and oom-pah in two.' },
  { id: 'compound', name: '6/8 feel', blurb: 'Rolling triplet feel for 6/8 and 12/8.' },
  { id: 'gentle', name: 'Gentle (no drums)', blurb: 'Strings and a picked accompaniment.' },
];

export function isBandStyle(s: unknown): s is BandStyle {
  return typeof s === 'string' && BAND_STYLES.some(x => x.id === s);
}

export interface BandPartDef {
  /** Shown in the mixer ("Bass", "Drums", "Strings"). */
  name: string;
  /**
   * The sound, as a General MIDI program 1–128 (34 = fingered bass, 49 = strings …).
   * For a drum part, the drum kit (1 standard, 9 room, 17 power, 25 electronic, 33 jazz, 41 brush).
   */
  program: number;
  /** A drum part: its notes are GM percussion keys, usually written with drum names. */
  drums?: boolean;
  /** What the part does; worked out from the music when absent. */
  role?: BandRole;
  /** The music, like a song's staves (any number of voices: band parts aren't drawn). */
  staves: SongStaffDef[];
  /** Default level 0..1 (0.8) and pan −1..1 (by role); the mixer can change both. */
  volume?: number;
  pan?: number;
}

/** A band part as a score of its own, in song ticks (repeats written out like the song's). */
export function bandPartScore(song: SongDef, part: BandPartDef, index: number): Score {
  const staves = part.staves.map(st => ({ ...st, voices: part.drums ? st.voices.map(drumWordsToPitches) : st.voices }));
  return songToScore({ ...song, id: `${song.id}-band${index}`, staves, band: undefined, chords: undefined, lyrics: undefined });
}

/** Default clef for a band part's notes (only used if the part is ever drawn). */
export function bandClef(program: number, drums: boolean | undefined, lowest: number): Clef {
  if (drums) return 'bass';
  const fam = gmFamily(program);
  if (fam === 'Bass') return 'bass8vb';
  if (fam === 'Guitar') return 'treble8vb';
  return lowest < 55 ? 'bass' : 'treble';
}

/** The role a part plays, from its sound and its music (polyphony, register). */
export function inferRole(part: Pick<BandPartDef, 'program' | 'drums' | 'role'>, score: Score): BandRole {
  if (part.role) return part.role;
  if (part.drums) return 'drums';
  const fam = gmFamily(clampProgram(part.program));
  if (fam === 'Bass') return 'bass';
  let onsets = 0;
  let notes = 0;
  let sum = 0;
  for (const st of score.staves)
    for (const v of st.voices)
      for (const n of v.notes) {
        if (n.rest || n.tiePrev) continue;
        onsets++;
        notes += n.pitches.length;
        for (const p of n.pitches) sum += midiOf(p);
      }
  if (!onsets) return 'pad';
  const poly = notes / onsets;
  const mean = sum / notes;
  if (mean < 50 && poly < 1.3) return 'bass';
  if (fam === 'Percussive' || fam === 'Sound effects') return 'percussion';
  if (poly >= 2) return ['Strings', 'Ensemble', 'Synth pad', 'Organ'].includes(fam) ? 'pad' : 'chords';
  return 'melody';
}

/** Default pan for a role (from the audience: bass and drums centred, comp and pad spread). */
export function rolePan(role: BandRole, index = 0): number {
  switch (role) {
    case 'drums':
    case 'bass':
      return 0;
    case 'chords':
      return index % 2 ? 0.3 : -0.3;
    case 'pad':
      return index % 2 ? -0.2 : 0.2;
    case 'percussion':
      return 0.4;
    default:
      return index % 2 ? -0.35 : 0.35;
  }
}
