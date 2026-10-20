/**
 * The instrument registry: everything the app needs to know about each instrument
 * it teaches, in one place.
 *
 *   keyboard – piano
 *   fretted  – strings on a fingerboard: guitar, ukulele, bass guitar (any tuning, any
 *              number of strings), and the bowed violin, viola, cello and double bass,
 *              whose fingerboards have no frets (a "fret" there is a semitone above the
 *              open string: where the finger stops it)
 *   mallet   – marimba, xylophone, glockenspiel, vibraphone ("mallet percussion")
 *
 * Pitch conventions
 *  - Scores hold SOUNDING pitch for keyboard and fretted instruments. Guitar, bass
 *    guitar and double bass are written an octave higher than they sound (clefs
 *    treble8vb / bass8vb); the ukulele, violin, viola and cello sound as written.
 *  - Mallet scores hold WRITTEN pitch (which is the marimba's and vibraphone's sounding
 *    pitch). The xylophone sounds an octave higher and the glockenspiel two octaves
 *    higher than written; that transposition happens at the audio boundary – the synth
 *    voice plays `midi + offset` and microphone/MIDI input is shifted back by
 *    `-offset` – so lessons, songs and the on-screen bars all work in written pitch,
 *    exactly as a percussionist reads.
 */

export type InstrumentId = 'piano' | 'guitar' | 'ukulele' | 'bass' | 'mallets' | 'violin' | 'viola' | 'cello' | 'doublebass';
export type InstrumentFamily = 'keyboard' | 'fretted' | 'mallet';
export type MalletVariant = 'marimba' | 'xylophone' | 'glockenspiel' | 'vibraphone';
export type UkuleleTuning = 'high-g' | 'low-g' | 'baritone';
export type BassStrings = 4 | 5;

export const INSTRUMENT_IDS: InstrumentId[] = ['piano', 'guitar', 'ukulele', 'bass', 'mallets', 'violin', 'viola', 'cello', 'doublebass'];

/** The bowed string family: fretless, played with a bow (and plucked now and then). */
export const BOWED_IDS: InstrumentId[] = ['violin', 'viola', 'cello', 'doublebass'];

/** A fretted instrument tuning. Strings are numbered as players do: 1 = the string nearest the floor (highest course). */
export interface Tuning {
  id: string;
  label: string;
  /** Open-string MIDI notes, index 0 = string 1. */
  open: number[];
}

export const TUNINGS = {
  guitar: { id: 'guitar', label: 'Standard (E A D G B E)', open: [64, 59, 55, 50, 45, 40] },
  ukuleleHighG: { id: 'ukulele-high-g', label: 'Standard, high G (g C E A)', open: [69, 64, 60, 67] },
  ukuleleLowG: { id: 'ukulele-low-g', label: 'Low G (G C E A)', open: [69, 64, 60, 55] },
  ukuleleBaritone: { id: 'ukulele-baritone', label: 'Baritone (D G B E)', open: [64, 59, 55, 50] },
  bass4: { id: 'bass-4', label: '4-string (E A D G)', open: [43, 38, 33, 28] },
  bass5: { id: 'bass-5', label: '5-string (B E A D G)', open: [43, 38, 33, 28, 23] },
  violin: { id: 'violin', label: 'Fifths (G D A E)', open: [76, 69, 62, 55] },
  viola: { id: 'viola', label: 'Fifths (C G D A)', open: [69, 62, 55, 48] },
  cello: { id: 'cello', label: 'Fifths (C G D A)', open: [57, 50, 43, 36] },
  /** Sounding pitch, like the bass guitar's: written an octave higher. */
  doublebass: { id: 'doublebass', label: 'Fourths (E A D G)', open: [43, 38, 33, 28] },
} satisfies Record<string, Tuning>;

/** The app's synthesised voices: the instruments it teaches, and an electric piano for the band. */
export type SynthVoiceId = 'piano' | 'epiano' | 'guitar' | 'ukulele' | 'bass' | 'marimba' | 'xylophone' | 'glockenspiel' | 'vibraphone' | 'violin' | 'viola' | 'cello' | 'doublebass';

export interface FrettedLook {
  /** Relative string thickness per string (index 0 = string 1). */
  gauge: number[];
  /** Wound (bronze) strings, per string. */
  wound: boolean[];
  /** Frets with a single / double position marker. */
  inlays: number[];
  doubleInlays: number[];
  /** Last fret on a typical neck. */
  maxFret: number;
  /** Frets shown by default in lessons. */
  defaultWindow: [number, number];
  /** Fingerboard tint (top, middle, bottom). */
  wood: [string, string, string];
  /**
   * No frets (the violin family): a note sounds where the finger stops the string, so marks
   * sit on the semitone lines rather than between them.
   */
  fretless?: boolean;
  /** Fretless: the beginner's finger tapes, at these semitones, labelled with their finger. */
  tapes?: { fret: number; label: string }[];
  /** Wound strings are silvery (bowed strings) rather than bronze. */
  silverWound?: boolean;
}

/**
 * How a bowed instrument's left hand covers the fingerboard.
 *  'violin'       – violin and viola: four fingers over a fourth, tones and semitones
 *                   (1st finger a tone above the open string in first position)
 *  'one-per-fret' – cello: a semitone per finger (1st finger a tone above the open string)
 *  'simandl'      – double bass: index, middle and pinky over a whole tone
 */
export interface BowedDef {
  fingers: 'violin' | 'one-per-fret' | 'simandl';
  /** The index finger's semitone above the open string in the first position a beginner learns. */
  firstPosition: number;
}

export interface MalletVariantDef {
  id: MalletVariant;
  name: string;
  /** Written range on the instrument (MIDI). */
  low: number;
  high: number;
  /** Sounding pitch = written + offset (semitones). */
  offset: number;
  voice: SynthVoiceId;
  /** Bars are rosewood (marimba, xylophone) or metal (glockenspiel, vibraphone). */
  metal: boolean;
  blurb: string;
}

export const MALLET_VARIANTS: Record<MalletVariant, MalletVariantDef> = {
  marimba: { id: 'marimba', name: 'Marimba', low: 45, high: 96, offset: 0, voice: 'marimba', metal: false, blurb: 'Warm rosewood bars, sounds as written (A2–C7).' },
  xylophone: { id: 'xylophone', name: 'Xylophone', low: 53, high: 96, offset: 12, voice: 'xylophone', metal: false, blurb: 'Bright and dry. Sounds an octave higher than written.' },
  glockenspiel: { id: 'glockenspiel', name: 'Glockenspiel (bells)', low: 55, high: 84, offset: 24, voice: 'glockenspiel', metal: true, blurb: 'Steel bars that ring. Sounds two octaves higher than written.' },
  vibraphone: { id: 'vibraphone', name: 'Vibraphone', low: 53, high: 89, offset: 0, voice: 'vibraphone', metal: true, blurb: 'Aluminium bars with a sustain pedal. Sounds as written (F3–F6).' },
};

export interface InstrumentDef {
  id: InstrumentId;
  name: string;
  /** Short name for chips. */
  short: string;
  family: InstrumentFamily;
  /** One-line description used in pickers. */
  blurb: string;
  /** Default reading clef(s). */
  clefs: ('treble' | 'bass' | 'treble8vb' | 'bass8vb' | 'alto')[];
  /** Sounding range used for the microphone and visuals. */
  range: [number, number];
  voice: SynthVoiceId;
  /** Lucide icon name (resolved by the UI). */
  icon: 'Piano' | 'Guitar' | 'Music2' | 'Drum' | 'AudioLines';
  fretted?: FrettedLook;
  /** The violin family. */
  bowed?: BowedDef;
}

const GUITAR_LOOK: FrettedLook = {
  gauge: [1.0, 1.25, 1.6, 2.15, 2.7, 3.3],
  wound: [false, false, false, true, true, true],
  inlays: [3, 5, 7, 9, 15, 17, 19, 21],
  doubleInlays: [12, 24],
  maxFret: 19,
  defaultWindow: [0, 12],
  wood: ['#3a1f13', '#4a2a18', '#371d11'],
};

const UKULELE_LOOK: FrettedLook = {
  // nylon/fluorocarbon strings: all plain, fairly thick; the re-entrant 4th string is thin
  gauge: [1.75, 2.05, 2.45, 1.85],
  wound: [false, false, false, false],
  inlays: [5, 7, 10, 15],
  doubleInlays: [12],
  maxFret: 15,
  defaultWindow: [0, 10],
  wood: ['#4a2b14', '#5b351a', '#432612'],
};

const BASS_LOOK: FrettedLook = {
  gauge: [2.5, 3.1, 3.8, 4.5, 5.2],
  wound: [true, true, true, true, true],
  inlays: [3, 5, 7, 9, 15, 17, 19, 21],
  doubleInlays: [12, 24],
  maxFret: 20,
  defaultWindow: [0, 12],
  wood: ['#2a1710', '#382015', '#26140c'],
};

const EBONY: [string, string, string] = ['#17110d', '#1f1712', '#130d0a'];

/** Finger tapes of first position on a violin or viola: 1, high 2, 3 and 4. */
const VIOLIN_TAPES = [
  { fret: 2, label: '1' },
  { fret: 4, label: '2' },
  { fret: 5, label: '3' },
  { fret: 7, label: '4' },
];

const VIOLIN_LOOK: FrettedLook = {
  // E is a plain steel string; A, D and G are wound
  gauge: [1.0, 1.35, 1.7, 2.05],
  wound: [false, true, true, true],
  inlays: [],
  doubleInlays: [],
  maxFret: 19,
  defaultWindow: [0, 8],
  wood: EBONY,
  fretless: true,
  tapes: VIOLIN_TAPES,
  silverWound: true,
};

const VIOLA_LOOK: FrettedLook = { ...VIOLIN_LOOK, gauge: [1.25, 1.6, 1.95, 2.35], wound: [true, true, true, true] };

const CELLO_LOOK: FrettedLook = {
  gauge: [1.6, 2.0, 2.5, 3.0],
  wound: [true, true, true, true],
  inlays: [],
  doubleInlays: [],
  maxFret: 19,
  defaultWindow: [0, 7],
  wood: EBONY,
  fretless: true,
  // first position: a semitone per finger, the 1st finger a tone above the open string
  tapes: [
    { fret: 2, label: '1' },
    { fret: 3, label: '2' },
    { fret: 4, label: '3' },
    { fret: 5, label: '4' },
  ],
  silverWound: true,
};

const DOUBLEBASS_LOOK: FrettedLook = {
  gauge: [2.6, 3.3, 4.0, 4.7],
  wound: [true, true, true, true],
  inlays: [],
  doubleInlays: [],
  maxFret: 17,
  defaultWindow: [0, 7],
  wood: EBONY,
  fretless: true,
  // half position (1, 2 and 4 over a tone), then first position's 1st finger
  tapes: [
    { fret: 1, label: '½' },
    { fret: 2, label: 'I' },
    { fret: 4, label: '' },
    { fret: 5, label: 'III' },
  ],
  silverWound: true,
};

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  piano: { id: 'piano', name: 'Piano', short: 'Piano', family: 'keyboard', blurb: 'Keyboard or digital piano', clefs: ['treble', 'bass'], range: [21, 108], voice: 'piano', icon: 'Piano' },
  guitar: { id: 'guitar', name: 'Guitar', short: 'Guitar', family: 'fretted', blurb: 'Acoustic, classical or electric', clefs: ['treble8vb'], range: [40, 88], voice: 'guitar', icon: 'Guitar', fretted: GUITAR_LOOK },
  ukulele: { id: 'ukulele', name: 'Ukulele', short: 'Ukulele', family: 'fretted', blurb: 'Soprano, concert, tenor or baritone', clefs: ['treble'], range: [55, 84], voice: 'ukulele', icon: 'Music2', fretted: UKULELE_LOOK },
  bass: { id: 'bass', name: 'Bass guitar', short: 'Bass', family: 'fretted', blurb: 'Electric or acoustic bass, 4 or 5 strings', clefs: ['bass8vb'], range: [23, 67], voice: 'bass', icon: 'AudioLines', fretted: BASS_LOOK },
  mallets: { id: 'mallets', name: 'Mallet percussion', short: 'Mallets', family: 'mallet', blurb: 'Marimba, xylophone, glockenspiel or vibraphone', clefs: ['treble', 'bass'], range: [45, 108], voice: 'marimba', icon: 'Drum' },
  violin: { id: 'violin', name: 'Violin', short: 'Violin', family: 'fretted', blurb: 'Or fiddle: any size, acoustic or electric', clefs: ['treble'], range: [55, 100], voice: 'violin', icon: 'Music2', fretted: VIOLIN_LOOK, bowed: { fingers: 'violin', firstPosition: 2 } },
  viola: { id: 'viola', name: 'Viola', short: 'Viola', family: 'fretted', blurb: 'Reads the alto clef, a fifth below the violin', clefs: ['alto'], range: [48, 91], voice: 'viola', icon: 'Music2', fretted: VIOLA_LOOK, bowed: { fingers: 'violin', firstPosition: 2 } },
  cello: { id: 'cello', name: 'Cello', short: 'Cello', family: 'fretted', blurb: 'Bass clef first, then tenor and treble', clefs: ['bass'], range: [36, 81], voice: 'cello', icon: 'Music2', fretted: CELLO_LOOK, bowed: { fingers: 'one-per-fret', firstPosition: 2 } },
  doublebass: { id: 'doublebass', name: 'Double bass', short: 'D. bass', family: 'fretted', blurb: 'Upright or string bass, bowed or plucked', clefs: ['bass8vb'], range: [28, 62], voice: 'doublebass', icon: 'AudioLines', fretted: DOUBLEBASS_LOOK, bowed: { fingers: 'simandl', firstPosition: 1 } },
};

export function instrumentDef(id: InstrumentId): InstrumentDef {
  return INSTRUMENTS[id] ?? INSTRUMENTS.piano;
}

export function familyOf(id: InstrumentId): InstrumentFamily {
  return instrumentDef(id).family;
}

export const isFretted = (id: InstrumentId): boolean => familyOf(id) === 'fretted';
export const isMallet = (id: InstrumentId): boolean => familyOf(id) === 'mallet';
export const isKeyboard = (id: InstrumentId): boolean => familyOf(id) === 'keyboard';
/** The violin family: fretless, bowed, no chord shapes or strumming. */
export const isBowed = (id: InstrumentId): boolean => !!instrumentDef(id).bowed;
/** Fretted instruments that play chord shapes (guitar, ukulele, bass guitar), not the violin family. */
export const isPluckedFretted = (id: InstrumentId): boolean => isFretted(id) && !isBowed(id);

/** Player preferences that change how an instrument is set up (stored in the profile settings). */
export interface InstrumentPrefs {
  malletVariant?: MalletVariant;
  ukuleleTuning?: UkuleleTuning;
  bassStrings?: BassStrings;
}

export function tuningFor(id: InstrumentId, prefs: InstrumentPrefs = {}): Tuning {
  switch (id) {
    case 'ukulele':
      return prefs.ukuleleTuning === 'low-g' ? TUNINGS.ukuleleLowG : prefs.ukuleleTuning === 'baritone' ? TUNINGS.ukuleleBaritone : TUNINGS.ukuleleHighG;
    case 'bass':
      return prefs.bassStrings === 5 ? TUNINGS.bass5 : TUNINGS.bass4;
    case 'violin':
      return TUNINGS.violin;
    case 'viola':
      return TUNINGS.viola;
    case 'cello':
      return TUNINGS.cello;
    case 'doublebass':
      return TUNINGS.doublebass;
    default:
      return TUNINGS.guitar;
  }
}

export function malletVariant(prefs: InstrumentPrefs = {}): MalletVariantDef {
  return MALLET_VARIANTS[prefs.malletVariant ?? 'marimba'] ?? MALLET_VARIANTS.marimba;
}

/** The synth voice an instrument sounds with (mallets depend on the chosen variant). */
export function voiceFor(id: InstrumentId, prefs: InstrumentPrefs = {}): SynthVoiceId {
  if (id === 'mallets') return malletVariant(prefs).voice;
  return instrumentDef(id).voice;
}

/** Display name, resolving the mallet variant ("Xylophone" rather than "Mallet percussion"). */
export function instrumentName(id: InstrumentId, prefs: InstrumentPrefs = {}): string {
  if (id === 'mallets') return malletVariant(prefs).name;
  return instrumentDef(id).name;
}

/**
 * Sounding range the microphone should listen to, in MIDI notes. For transposing
 * mallets this is the range of the real sound (written + offset).
 */
export function micRangeFor(id: InstrumentId, prefs: InstrumentPrefs = {}): [number, number] {
  if (id === 'mallets') {
    const v = malletVariant(prefs);
    return [v.low + v.offset, Math.min(108, v.high + v.offset)];
  }
  if (id === 'piano') return [21, 108];
  const t = tuningFor(id, prefs);
  const look = instrumentDef(id).fretted!;
  return [Math.min(...t.open), Math.max(...t.open) + look.maxFret];
}

/** Semitones between what the microphone hears and the written pitch (xylophone: 12). */
export function inputOffsetFor(id: InstrumentId, prefs: InstrumentPrefs = {}): number {
  return id === 'mallets' ? malletVariant(prefs).offset : 0;
}

/** Notes a lesson should pre-render for this instrument (written pitch, as passed to the synth). */
export function preloadRangeFor(id: InstrumentId, prefs: InstrumentPrefs = {}): [number, number] {
  if (id === 'piano') return [36, 84];
  if (id === 'mallets') {
    const v = malletVariant(prefs);
    return [Math.max(v.low, 55), Math.min(v.high, 84)];
  }
  const t = tuningFor(id, prefs);
  return [Math.min(...t.open), Math.max(...t.open) + 12];
}

/** Infer an instrument from a track or song group id prefix ("ukulele-treble" → "ukulele"). */
export function instrumentFromId(id: string): InstrumentId | null {
  for (const i of INSTRUMENT_IDS) if (id === i || id.startsWith(`${i}-`)) return i;
  return null;
}
