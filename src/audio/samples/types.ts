/**
 * Sample banks: the common shape every sample format is read into.
 *
 * Clef Coach reads three kinds of sampled instrument:
 *
 *   sf2 – SoundFont 2 (the General MIDI banks of the Sound Blaster era and still the
 *         most widely shared format): one file holding 16-bit PCM and the presets.
 *   sf3 – SoundFont 3 (MuseScore's compressed SoundFont): an SF2 whose samples are
 *         Ogg Vorbis, often a tenth of the size.
 *   sfz – SFZ, the open text format most free sample libraries use today: a text file
 *         of regions pointing at WAV / FLAC / Ogg files, shared as a folder or a .zip.
 *
 * Parsers (./sf2.ts, ./sfz.ts) are pure and never decode audio: they turn a file into
 * presets made of regions, and say where each sample's data lives. The player
 * (./sampler.ts) decodes samples lazily, only those a song needs, within a memory budget.
 *
 * Units are chosen for the player, not the file: seconds, dB, cents, frames relative
 * to the start of the sample's own data, pan −1..1.
 */

/** Random access to a (possibly huge) file: an in-memory array, a Blob from IndexedDB… */
export interface ByteReader {
  readonly size: number;
  /** `length` bytes from `offset` (fewer at the end of the file). */
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** A ByteReader over bytes already in memory. */
export function memoryReader(bytes: Uint8Array): ByteReader {
  return {
    size: bytes.length,
    read: async (offset, length) => bytes.subarray(offset, Math.min(bytes.length, offset + length)),
  };
}

/** Where a sample's audio is and how to turn it into PCM. */
export type SampleSource =
  /** SF2: 16-bit little-endian mono PCM inside the file (and the optional 24-bit low bytes). */
  | { kind: 'pcm16'; byteOffset: number; frames: number; sm24Offset?: number }
  /** SF3: a compressed (Ogg Vorbis) stream inside the file; decode with decodeAudioData. */
  | { kind: 'encoded'; byteOffset: number; byteLength: number; format: 'ogg' | 'flac' | 'wav' | 'mp3' | 'unknown' }
  /** SFZ: a separate audio file in the bank (path relative to the bank root, '/' separated). */
  | { kind: 'file'; path: string };

export interface SampleInfo {
  name: string;
  /** Recorded sample rate (Hz); 0 when only known after decoding (SFZ files). */
  sampleRate: number;
  /** Length in frames when known from the header (0 = unknown until decoded). */
  frames: number;
  /** MIDI key the sample was recorded at (SF2 originalPitch; SFZ uses the region's). */
  originalPitch?: number;
  /** Pitch correction in cents recorded with the sample. */
  pitchCorrection?: number;
  /** Loop points in frames relative to the sample start, from the sample header or the file. */
  loopStart?: number;
  loopEnd?: number;
  source: SampleSource;
}

export type LoopMode =
  /** play the sample once, release fades it out */
  | 'none'
  /** loop forever between loopStart and loopEnd, even during the release */
  | 'continuous'
  /** loop while the key is held; on release play on to the end */
  | 'sustain'
  /** play to the end whatever the key does (drums) */
  | 'one-shot';

export interface Envelope {
  /** seconds */
  delay: number;
  attack: number;
  hold: number;
  decay: number;
  /** level 0..1 the decay falls to and holds while the key is down */
  sustain: number;
  release: number;
  /**
   * SF2 keynumToVolEnvHold / keynumToVolEnvDecay: timecents per key above 60 by which
   * the hold / decay time shrinks (higher notes decay faster). Applied by the player.
   */
  holdKeyTrack?: number;
  decayKeyTrack?: number;
}

export const DEFAULT_ENVELOPE: Envelope = { delay: 0, attack: 0.001, hold: 0, decay: 0, sustain: 1, release: 0.06 };

export interface SampleRegion {
  /** Index into ParsedBank.samples. */
  sample: number;
  /** Key and velocity ranges, inclusive (0..127). */
  loKey: number;
  hiKey: number;
  loVel: number;
  hiVel: number;
  /** Key at which the sample sounds at its recorded pitch. */
  rootKey: number;
  /** Extra tuning in cents (coarse × 100 + fine + the sample's own correction). */
  tune: number;
  /** Cents per key away from rootKey: 100 normally, 0 for a fixed pitch (drums, effects). */
  keyTrack: number;
  /** Frames to skip at the start / end of the sample data. */
  offset: number;
  /** Last frame to play (exclusive), relative to the sample start; undefined = the sample's end. */
  end?: number;
  loop: LoopMode;
  /** Loop points in frames relative to the sample start (fallback: the sample's own). */
  loopStart?: number;
  loopEnd?: number;
  /** SFZ without loop_mode: loop ('continuous') if the sample file itself has a loop. */
  loopFromSample?: boolean;
  /** Gain in dB (0 = as recorded; SF2 attenuation becomes a negative number here). */
  volume: number;
  /** −1 (left) .. 1 (right) */
  pan: number;
  /** How much velocity changes the level, 0..1 (1 = the usual curve, 0 = none). */
  velTrack: number;
  amp: Envelope;
  /** Low-pass filter, when the region has one below ~20 kHz: cutoff in Hz, resonance peak q in dB (Web Audio's low-pass Q). */
  filter?: { cutoff: number; q: number };
  /**
   * Choking (open / closed hi-hat): a voice of this region stops when a note starts
   * whose region's `chokeGroup` equals this region's `offBy`. An SF2 exclusiveClass C
   * is chokeGroup = offBy = C (the class cuts itself off); SFZ's group / off_by map
   * straight across. Undefined = never choked / chokes nothing.
   */
  chokeGroup?: number;
  offBy?: number;
  /** Played when the key is released instead of pressed (piano key-off noise). */
  trigger: 'attack' | 'release';
  /** Round robin: this region plays on every `seqLength`th note, the `seqPosition`th (1-based). */
  seqLength?: number;
  seqPosition?: number;
  /** Random layering: plays when a random 0..1 falls in [loRand, hiRand). */
  loRand?: number;
  hiRand?: number;
}

export interface SamplePreset {
  name: string;
  /** MIDI bank (128 = percussion in SoundFonts) and program 0..127. */
  bank: number;
  program: number;
  regions: SampleRegion[];
}

export type BankFormat = 'sf2' | 'sf3' | 'sfz';

export interface ParsedBank {
  format: BankFormat;
  name: string;
  info: { copyright?: string; comment?: string; author?: string; product?: string };
  presets: SamplePreset[];
  samples: SampleInfo[];
  /** Things that were read but simplified or skipped, in plain English. */
  warnings: string[];
}

export class BankFormatError extends Error {}
