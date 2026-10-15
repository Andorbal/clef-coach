/**
 * General MIDI: the 128 standard instrument sounds, the drum kits and the percussion
 * key map. Band parts name their sound with a GM program number (1–128, as printed in
 * every GM list and as MIDI and MusicXML files store it), so a song plays with the
 * built-in sounds everywhere and with the matching instrument of any GM sound bank.
 *
 * Drum parts use the GM percussion keys (36 = bass drum, 38 = snare, 42 = closed hi-hat …).
 * In the note language they can be written with names instead of pitches —
 * `[kick hat]/e hat [snare hat] hat` — which read far better than `[C2 F#2]/e F#2 …`.
 */

export const GM_FAMILY_NAMES = [
  'Piano',
  'Chromatic percussion',
  'Organ',
  'Guitar',
  'Bass',
  'Strings',
  'Ensemble',
  'Brass',
  'Reed',
  'Pipe',
  'Synth lead',
  'Synth pad',
  'Synth effects',
  'Ethnic',
  'Percussive',
  'Sound effects',
] as const;

/** GM Level 1 program names; index = program − 1. */
export const GM_PROGRAM_NAMES: readonly string[] = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Nylon Guitar', 'Steel Guitar', 'Jazz Guitar', 'Clean Electric Guitar', 'Muted Electric Guitar', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Fingered Bass', 'Picked Bass', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Square Lead', 'Sawtooth Lead', 'Calliope Lead', 'Chiff Lead', 'Charang Lead', 'Voice Lead', 'Fifths Lead', 'Bass + Lead',
  'New Age Pad', 'Warm Pad', 'Polysynth Pad', 'Choir Pad', 'Bowed Pad', 'Metallic Pad', 'Halo Pad', 'Sweep Pad',
  'Rain', 'Soundtrack', 'Crystal', 'Atmosphere', 'Brightness', 'Goblins', 'Echoes', 'Sci-fi',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
];

/** Name of a GM program (1–128). */
export function gmProgramName(program: number): string {
  return GM_PROGRAM_NAMES[clampProgram(program) - 1];
}

/** Family of a GM program (1–128): "Piano", "Bass", "Strings" … */
export function gmFamily(program: number): (typeof GM_FAMILY_NAMES)[number] {
  return GM_FAMILY_NAMES[(clampProgram(program) - 1) >> 3];
}

export function clampProgram(program: number): number {
  return Number.isFinite(program) ? Math.min(128, Math.max(1, Math.round(program))) : 1;
}

/** GM drum kits (GS numbering): the program a drum part names picks one. */
export const GM_KITS: readonly { program: number; name: string }[] = [
  { program: 1, name: 'Standard kit' },
  { program: 9, name: 'Room kit' },
  { program: 17, name: 'Power kit' },
  { program: 25, name: 'Electronic kit' },
  { program: 26, name: 'Analog (808) kit' },
  { program: 33, name: 'Jazz kit' },
  { program: 41, name: 'Brush kit' },
  { program: 49, name: 'Orchestra kit' },
];

/** The kit a drum program means (nearest kit at or below it, as GS synths do). */
export function gmKitName(program: number): string {
  let name = GM_KITS[0].name;
  for (const k of GM_KITS) if (k.program <= program) name = k.name;
  return name;
}

// ---------------------------------------------------------------------------
// Percussion key map
// ---------------------------------------------------------------------------

/** [key, GM name, name in the note language] for the GM / GS percussion keys 27–87. */
const DRUM_TABLE: readonly [number, string, string][] = [
  [27, 'High Q', 'high-q'],
  [28, 'Slap', 'slap'],
  [29, 'Scratch Push', 'scratch-push'],
  [30, 'Scratch Pull', 'scratch-pull'],
  [31, 'Sticks', 'sticks'],
  [32, 'Square Click', 'square-click'],
  [33, 'Metronome Click', 'metro-click'],
  [34, 'Metronome Bell', 'metro-bell'],
  [35, 'Acoustic Bass Drum', 'kick2'],
  [36, 'Bass Drum 1', 'kick'],
  [37, 'Side Stick', 'rim'],
  [38, 'Acoustic Snare', 'snare'],
  [39, 'Hand Clap', 'clap'],
  [40, 'Electric Snare', 'snare2'],
  [41, 'Low Floor Tom', 'floor-lo'],
  [42, 'Closed Hi-Hat', 'hat'],
  [43, 'High Floor Tom', 'floor-hi'],
  [44, 'Pedal Hi-Hat', 'pedal-hat'],
  [45, 'Low Tom', 'tom-lo'],
  [46, 'Open Hi-Hat', 'open-hat'],
  [47, 'Low-Mid Tom', 'tom-lomid'],
  [48, 'Hi-Mid Tom', 'tom-himid'],
  [49, 'Crash Cymbal 1', 'crash'],
  [50, 'High Tom', 'tom-hi'],
  [51, 'Ride Cymbal 1', 'ride'],
  [52, 'Chinese Cymbal', 'china'],
  [53, 'Ride Bell', 'ride-bell'],
  [54, 'Tambourine', 'tambourine'],
  [55, 'Splash Cymbal', 'splash'],
  [56, 'Cowbell', 'cowbell'],
  [57, 'Crash Cymbal 2', 'crash2'],
  [58, 'Vibraslap', 'vibraslap'],
  [59, 'Ride Cymbal 2', 'ride2'],
  [60, 'Hi Bongo', 'bongo-hi'],
  [61, 'Low Bongo', 'bongo-lo'],
  [62, 'Mute Hi Conga', 'conga-mute'],
  [63, 'Open Hi Conga', 'conga-hi'],
  [64, 'Low Conga', 'conga-lo'],
  [65, 'High Timbale', 'timbale-hi'],
  [66, 'Low Timbale', 'timbale-lo'],
  [67, 'High Agogo', 'agogo-hi'],
  [68, 'Low Agogo', 'agogo-lo'],
  [69, 'Cabasa', 'cabasa'],
  [70, 'Maracas', 'maracas'],
  [71, 'Short Whistle', 'whistle-short'],
  [72, 'Long Whistle', 'whistle-long'],
  [73, 'Short Guiro', 'guiro-short'],
  [74, 'Long Guiro', 'guiro-long'],
  [75, 'Claves', 'claves'],
  [76, 'Hi Wood Block', 'block-hi'],
  [77, 'Low Wood Block', 'block-lo'],
  [78, 'Mute Cuica', 'cuica-mute'],
  [79, 'Open Cuica', 'cuica-open'],
  [80, 'Mute Triangle', 'triangle-mute'],
  [81, 'Open Triangle', 'triangle'],
  [82, 'Shaker', 'shaker'],
  [83, 'Jingle Bell', 'jingle-bell'],
  [84, 'Bell Tree', 'bell-tree'],
  [85, 'Castanets', 'castanets'],
  [86, 'Mute Surdo', 'surdo-mute'],
  [87, 'Open Surdo', 'surdo'],
];

/** Shorthands drummers and drum-machine users write. */
const DRUM_ALIASES: Record<string, number> = {
  bd: 36,
  sd: 38,
  hh: 42,
  oh: 46,
  ph: 44,
  cr: 49,
  rd: 51,
  sidestick: 37,
  'side-stick': 37,
  'closed-hat': 42,
  'hi-hat': 42,
  hihat: 42,
  openhat: 46,
  floor: 43,
  'floor-tom': 43,
  tom1: 50,
  tom2: 48,
  tom3: 47,
  tom4: 45,
  tom5: 43,
  tom6: 41,
  tamb: 54,
  bell: 53,
};

const BY_NAME = new Map<string, number>([...DRUM_TABLE.map(([k, , n]) => [n, k] as [string, number]), ...Object.entries(DRUM_ALIASES)]);
const BY_KEY = new Map<number, { gm: string; name: string }>(DRUM_TABLE.map(([k, gm, name]) => [k, { gm, name }]));

/** Every percussion key with its GM name and its name in the note language. */
export const DRUM_KEYS: readonly { key: number; gm: string; name: string }[] = DRUM_TABLE.map(([key, gm, name]) => ({ key, gm, name }));

/** Percussion key for a drum name ("kick", "open-hat", "hh"), or null. */
export function drumKeyOf(name: string): number | null {
  return BY_NAME.get(name.toLowerCase()) ?? null;
}

/** Note-language name of a percussion key (36 → "kick"), or null. */
export function drumNameOf(key: number): string | null {
  return BY_KEY.get(key)?.name ?? null;
}

/** GM name of a percussion key (38 → "Acoustic Snare"), or null. */
export function drumGmName(key: number): string | null {
  return BY_KEY.get(key)?.gm ?? null;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** A word that could be a drum name, standing alone or inside a chord, before any "/dur", "@", "%" or "~". */
const WORD_RE = /(^|[\s[])([A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])(?=[\s\]/~@%|]|$)/g;
const PITCH_RE = /(^|[\s[])([A-G](?:##|bb|x|#|b|n)?-?\d)(?=[\s\]/~@%|]|$)/g;
const STEP_SEMIS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Drum names → pitches, so a drum part goes through the ordinary note parser:
 * "[kick hat]/e hat" → "[C2 F#2]/e F#2". Words that aren't drum names are left alone
 * (and reported by the parser).
 */
export function drumWordsToPitches(text: string): string {
  return text.replace(WORD_RE, (all, pre: string, word: string) => {
    const key = BY_NAME.get(word.toLowerCase());
    return key === undefined ? all : pre + pitchName(key);
  });
}

/** Pitches → drum names for writing a drum part ("[C2 F#2]/e" → "[kick hat]/e"); other pitches stay. */
export function pitchesToDrumWords(text: string): string {
  return text.replace(PITCH_RE, (all, pre: string, p: string) => {
    const m = /^([A-G])(##|bb|x|#|b|n)?(-?\d)$/.exec(p);
    if (!m) return all;
    const alter = m[2] === '##' || m[2] === 'x' ? 2 : m[2] === '#' ? 1 : m[2] === 'b' ? -1 : m[2] === 'bb' ? -2 : 0;
    const midi = (Number(m[3]) + 1) * 12 + STEP_SEMIS[m[1]] + alter;
    const name = BY_KEY.get(midi)?.name;
    return name ? pre + name : all;
  });
}
