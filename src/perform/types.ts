/**
 * What the band plays, independent of how it sounds: tracks of timed notes in song
 * ticks (PPQ 48, the score's own timeline). The arranger and the song's own band parts
 * produce these; the performer (./performer.ts) schedules them on the audio clock.
 */
import type { BandRole, BandStyle } from '../music/band';
import type { BuiltinSound } from './builtin';

export interface PerfNote {
  /** Start, in song ticks (straight time; swing is applied when played). */
  tick: number;
  ticks: number;
  /** Sounding MIDI note (a GM percussion key on a drum track). */
  midi: number;
  /** 0..1 */
  velocity: number;
  /** Extra seconds after the tick (strums, a human feel); may be negative. */
  offset?: number;
}

/** Where a track came from. */
export type TrackSource =
  /** a band part written in the song file (or kept from an imported file) */
  | 'song'
  /** written by the arranger */
  | 'auto'
  /** the player's own part, played by the app (for listening) */
  | 'part';

export interface PerfTrack {
  /** Stable key for the mixer: "song:0", "auto:bass", "part". */
  id: string;
  name: string;
  role: BandRole | 'part';
  /** General MIDI program 1–128 (for a drum track: the kit). */
  program: number;
  drums: boolean;
  source: TrackSource;
  /** Sorted by tick. */
  notes: PerfNote[];
  /** Default level 0..1 and pan −1..1. */
  volume: number;
  pan: number;
  /** Built-in sound to use instead of the program's (the player's own instrument voice). */
  sound?: BuiltinSound;
}

export type ResolvedStyle = Exclude<BandStyle, 'auto'>;

export interface Arrangement {
  style: ResolvedStyle;
  /** Eighth notes are swung (played long–short). */
  swing: boolean;
  tracks: PerfTrack[];
  /** The chords were worked out from the music (the song has no chord symbols). */
  inferredChords: boolean;
}
