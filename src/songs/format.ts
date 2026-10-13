/**
 * The Clef Coach song file format ("ClefSong", version 1).
 *
 * A song is a small JSON document. The music itself is written in the compact,
 * human- and LLM-friendly text notation of src/music/parse.ts – one string per
 * voice – so a whole song stays readable and easy to fix by hand:
 *
 *   {
 *     "format": "clef-coach-song",
 *     "version": 1,
 *     "title": "Silent Night",
 *     "composer": "Franz Xaver Gruber",
 *     "instrument": "piano",
 *     "key": "Bb", "time": [6, 8], "tempo": "q.=52",
 *     "staves": [
 *       { "clef": "treble", "hand": "R", "voices": ["F4/q. G4/e F4/q D4/h. | …"] },
 *       { "clef": "bass",   "hand": "L", "voices": ["[Bb2 F3]/h. | …"] }
 *     ],
 *     "chords":   "Bb/h. | Bb/h. | F7/h. | …",
 *     "sections": [{ "name": "Silent night, holy night", "from": 1, "to": 4 }],
 *     "lyrics":   ["Si- lent night, ho- ly night, …"]
 *   }
 *
 * See docs/song-format.md for the full reference. MusicXML and MIDI files are
 * converted into this format on import (src/songs/musicxml.ts, src/songs/midi.ts).
 */
import { parseChordSymbol } from '../music/chords';
import { INSTRUMENT_IDS, type InstrumentId, familyOf, instrumentDef } from '../music/instruments';
import { parseKey } from '../music/keys';
import { NotationError, type SongDef, type SongSection, songToScore } from '../music/parse';
import { midiOf } from '../music/pitch';
import { type BaseDuration, type TimeSig, PPQ, durationTicks } from '../music/rhythm';
import { type Clef, type Score, measureStartTick } from '../music/score';

export const SONG_FORMAT = 'clef-coach-song';
export const SONG_FORMAT_VERSION = 1;

const CLEFS: Clef[] = ['treble', 'bass', 'treble8vb', 'bass8vb'];

/** The on-disk shape. Mirrors SongDef with a header and a friendlier tempo. */
export interface SongDoc {
  format: typeof SONG_FORMAT;
  version: number;
  id?: string;
  title: string;
  composer?: string;
  arranger?: string;
  year?: string;
  source?: string;
  license?: string;
  instrument: InstrumentId;
  level?: number;
  key: string;
  time: [number, number] | string;
  /** Quarter-note BPM, or "q.=52" / "h=60" for another beat unit. */
  tempo: number | string;
  pickup?: string;
  mallets?: 2 | 4;
  blurb?: string;
  tags?: string[];
  staves: { clef: Clef; hand?: 'R' | 'L'; name?: string; voices: string[] }[];
  chords?: string;
  sections?: SongSection[];
  lyrics?: string[];
}

export class SongFormatError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join('\n'));
    this.issues = issues;
  }
}

export interface ParsedSong {
  song: SongDef;
  score: Score;
  warnings: string[];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** "q.=52" → quarter-note BPM (78). Plain numbers are quarter-note BPM. */
export function parseTempo(t: unknown): number {
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (typeof t === 'string') {
    const m = /^\s*([whqest])(\.{0,2})\s*=\s*(\d+(?:\.\d+)?)\s*$/.exec(t);
    if (m) {
      const beat = durationTicks(m[1] as BaseDuration, m[2].length);
      return (Number(m[3]) * beat) / PPQ;
    }
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`tempo "${String(t)}" should be a number (quarter notes per minute) or like "q.=52"`);
}

function parseTimeField(t: unknown): TimeSig {
  if (Array.isArray(t) && t.length === 2 && t.every(x => Number.isInteger(x))) return [t[0], t[1]];
  if (typeof t === 'string') {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(t);
    if (m) return [Number(m[1]), Number(m[2])];
    if (t.trim() === 'C') return [4, 4];
  }
  throw new Error(`time "${JSON.stringify(t)}" should look like [3, 4] or "3/4"`);
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .slice(0, 40) || 'song'
  );
}

export function newSongId(title: string): string {
  return `user-${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Read and validate a song document (JSON text or an already-parsed object).
 * Throws SongFormatError with every problem found; returns warnings for things
 * that load but look suspicious (notes out of range, uneven staves…).
 */
export function parseSongDoc(input: string | unknown, opts: { id?: string } = {}): ParsedSong {
  let raw: unknown = input;
  if (typeof input === 'string') {
    const text = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      raw = JSON.parse(text);
    } catch (e) {
      throw new SongFormatError([`This isn't valid JSON: ${(e as Error).message}`]);
    }
  }
  if (!isObj(raw)) throw new SongFormatError(['A song file must be a JSON object.']);
  const issues: string[] = [];
  const warnings: string[] = [];
  if (raw.format !== undefined && raw.format !== SONG_FORMAT) issues.push(`"format" should be "${SONG_FORMAT}".`);
  if (typeof raw.version === 'number' && raw.version > SONG_FORMAT_VERSION) issues.push(`This song uses format version ${raw.version}; this app reads version ${SONG_FORMAT_VERSION}. Please update Clef Coach.`);
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '';
  if (!title) issues.push('"title" is missing.');
  const instrument = raw.instrument as InstrumentId;
  if (!INSTRUMENT_IDS.includes(instrument)) issues.push(`"instrument" must be one of: ${INSTRUMENT_IDS.join(', ')}.`);
  let key = 'C';
  if (typeof raw.key === 'string') {
    try {
      parseKey(raw.key);
      key = raw.key.trim();
    } catch {
      issues.push(`"key" "${raw.key}" isn't a key name (use e.g. "C", "Bb", "F#m").`);
    }
  } else issues.push('"key" is missing (e.g. "C", "Bb", "F#m").');
  let time: TimeSig = [4, 4];
  try {
    time = parseTimeField(raw.time);
  } catch (e) {
    issues.push(`"${(e as Error).message}`);
  }
  let tempo = 80;
  try {
    tempo = raw.tempo === undefined ? 80 : parseTempo(raw.tempo);
  } catch (e) {
    issues.push((e as Error).message);
  }
  if (tempo < 20 || tempo > 400) issues.push(`tempo ${tempo} is out of range (20–400).`);
  if (raw.pickup !== undefined && (typeof raw.pickup !== 'string' || !/^[whqest]\.{0,2}$/.test(raw.pickup))) issues.push('"pickup" should be a duration like "q", "e" or "q.".');
  const stavesRaw = Array.isArray(raw.staves) ? raw.staves : [];
  if (!stavesRaw.length) issues.push('"staves" must list at least one staff.');
  const staves: SongDef['staves'] = [];
  stavesRaw.forEach((st, i) => {
    if (!isObj(st)) {
      issues.push(`staff ${i + 1} must be an object.`);
      return;
    }
    const clef = st.clef as Clef;
    if (!CLEFS.includes(clef)) issues.push(`staff ${i + 1}: "clef" must be one of ${CLEFS.join(', ')}.`);
    const voices = Array.isArray(st.voices) ? st.voices.filter((v): v is string => typeof v === 'string') : typeof st.notes === 'string' ? [st.notes] : [];
    if (!voices.length) issues.push(`staff ${i + 1}: "voices" must contain at least one string of notes.`);
    if (voices.length > 2) warnings.push(`staff ${i + 1} has ${voices.length} voices; only two per staff are drawn clearly.`);
    const hand = st.hand === 'R' || st.hand === 'L' ? st.hand : undefined;
    staves.push({ clef, hand, voices, name: typeof st.name === 'string' ? st.name : undefined });
  });
  // piano: a two-staff part is right hand over left hand unless said otherwise
  if (instrument === 'piano' && staves.length === 2) {
    staves[0].hand ??= 'R';
    staves[1].hand ??= 'L';
  } else if (instrument === 'piano' && staves.length === 1) {
    staves[0].hand ??= staves[0].clef === 'bass' ? 'L' : 'R';
  }
  if (instrument === 'mallets' && staves.length === 2) {
    staves[0].hand ??= 'R';
    staves[1].hand ??= 'L';
  }
  const level = typeof raw.level === 'number' ? Math.max(1, Math.min(10, Math.round(raw.level))) : 3;
  const mallets = raw.mallets === 4 ? 4 : raw.mallets === 2 ? 2 : undefined;
  if (issues.length) throw new SongFormatError(issues);

  const song: SongDef = {
    id: opts.id ?? (typeof raw.id === 'string' && raw.id ? raw.id : newSongId(title)),
    title,
    composer: typeof raw.composer === 'string' ? raw.composer : '',
    arranger: typeof raw.arranger === 'string' ? raw.arranger : undefined,
    year: typeof raw.year === 'string' ? raw.year : typeof raw.year === 'number' ? String(raw.year) : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    license: typeof raw.license === 'string' ? raw.license : undefined,
    instrument,
    level,
    key,
    time,
    tempo: Math.round(tempo * 100) / 100,
    pickup: typeof raw.pickup === 'string' ? raw.pickup : undefined,
    blurb: typeof raw.blurb === 'string' ? raw.blurb : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : undefined,
    staves,
    mallets,
    chords: typeof raw.chords === 'string' && raw.chords.trim() ? raw.chords : undefined,
    sections: Array.isArray(raw.sections) ? raw.sections.filter(isObj).map(s => ({ name: String(s.name ?? ''), from: Number(s.from), to: Number(s.to) })) : undefined,
    lyrics: Array.isArray(raw.lyrics) ? raw.lyrics.filter((l): l is string => typeof l === 'string') : typeof raw.lyrics === 'string' ? [raw.lyrics] : undefined,
  };

  let score: Score;
  try {
    score = songToScore(song);
  } catch (e) {
    if (e instanceof NotationError) throw new SongFormatError([e.message.replace(`${song.id} `, '')]);
    throw new SongFormatError([(e as Error).message]);
  }
  warnings.push(...checkSong(song, score));
  return { song, score, warnings };
}

/** Soft checks: things that load but probably aren't what the author meant. */
function checkSong(song: SongDef, score: Score): string[] {
  const w: string[] = [];
  // uneven staves
  const counts = score.staves.flatMap((st, si) => st.voices.map((v, vi) => ({ si, vi, m: v.notes.length ? v.notes[v.notes.length - 1].measure + 1 : 0 })));
  const max = Math.max(...counts.map(c => c.m));
  for (const c of counts) if (c.m < max) w.push(`staff ${c.si + 1} voice ${c.vi + 1} has ${c.m} measures; the longest has ${max}.`);
  // range
  const fam = familyOf(song.instrument);
  const [lo, hi] = fam === 'mallet' ? [45, 96] : instrumentDef(song.instrument).range;
  let outOfRange = 0;
  for (const st of score.staves) for (const v of st.voices) for (const n of v.notes) for (const p of n.pitches) {
    const m = midiOf(p);
    if (m < lo || m > hi) outOfRange++;
  }
  if (outOfRange) w.push(`${outOfRange} note${outOfRange > 1 ? 's are' : ' is'} outside the usual range of the ${instrumentDef(song.instrument).name.toLowerCase()}.`);
  // chords
  if (song.chords) {
    try {
      const ch = parseChordTimeline(song.chords, score);
      if (ch.unknown.length) w.push(`Unknown chord symbol${ch.unknown.length > 1 ? 's' : ''}: ${[...new Set(ch.unknown)].join(', ')}.`);
    } catch (e) {
      w.push(`chords: ${(e as Error).message}`);
    }
  }
  // sections
  for (const s of song.sections ?? []) {
    if (!(s.from >= 1 && s.to >= s.from && s.to <= score.measures)) w.push(`section "${s.name}" (${s.from}–${s.to}) is outside measures 1–${score.measures}.`);
  }
  return w;
}

// ---------------------------------------------------------------------------
// Chord timeline
// ---------------------------------------------------------------------------

export interface ChordEvent {
  /** Absolute tick in the score. */
  tick: number;
  ticks: number;
  /** Chord symbol as written ("F#m7"); null = no chord. */
  symbol: string | null;
  measure: number;
}

const CHORD_DUR_RE = /\/([whqest])(\.{0,2})(3)?$/;

/** Read the "chords" line ("C/h G7/h | C/w |") into timed events. */
export function parseChordTimeline(text: string, score: Pick<Score, 'time' | 'pickup' | 'measures' | 'changes' | 'key'>): { events: ChordEvent[]; unknown: string[] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const events: ChordEvent[] = [];
  const unknown: string[] = [];
  let tick = 0;
  let measure = 0;
  let base: BaseDuration = 'w';
  let dots = 0;
  let triplet = false;
  let measureHasDur = false;
  let pending: string[] = [];
  const startOf = (m: number) => measureStartTick(score as Score, m);
  const flushMeasure = () => {
    // chords written without durations share their measure equally
    if (pending.length) {
      const len = startOf(measure + 1) - startOf(measure);
      const each = len / pending.length;
      pending.forEach((sym, i) => events.push({ tick: startOf(measure) + i * each, ticks: each, symbol: sym === '%' ? events[events.length - 1]?.symbol ?? null : sym, measure }));
      pending = [];
    }
  };
  for (const tok of tokens) {
    if (/^:?\|+:?[12]?$/.test(tok)) {
      flushMeasure();
      measure++;
      tick = startOf(measure);
      measureHasDur = false;
      continue;
    }
    const dm = CHORD_DUR_RE.exec(tok);
    const sym = dm ? tok.slice(0, dm.index) : tok;
    const isRest = sym === 'r' || sym === 'N.C.' || sym === 'NC' || sym === '-';
    if (!isRest && sym !== '%') {
      try {
        parseChordSymbol(sym);
      } catch {
        unknown.push(sym);
      }
    }
    if (dm) {
      base = dm[1] as BaseDuration;
      dots = dm[2].length;
      triplet = !!dm[3];
      measureHasDur = true;
    }
    if (!dm && !measureHasDur) {
      pending.push(isRest ? '' : sym);
      continue;
    }
    const ticks = durationTicks(base, dots, triplet);
    events.push({ tick, ticks, symbol: isRest ? null : sym === '%' ? events[events.length - 1]?.symbol ?? null : sym, measure });
    tick += ticks;
  }
  flushMeasure();
  return { events: events.map(e => (e.symbol === '' ? { ...e, symbol: null } : e)), unknown };
}

/** Distinct chord symbols in order of first appearance. */
export function songChordSymbols(song: SongDef, score: Score): string[] {
  if (!song.chords) return [];
  const { events } = parseChordTimeline(song.chords, score);
  const out: string[] = [];
  for (const e of events) if (e.symbol && !out.includes(e.symbol)) out.push(e.symbol);
  return out;
}

// ---------------------------------------------------------------------------
// Phrases
// ---------------------------------------------------------------------------

/**
 * The song's practice sections: the ones written in the file, or automatic
 * phrases of four bars (two for very short songs), with a pickup bar joined to
 * the first phrase. Measure numbers are 1-based and inclusive.
 */
export function songSections(song: Pick<SongDef, 'sections'>, score: Pick<Score, 'measures' | 'pickup'>): SongSection[] {
  const n = score.measures;
  const valid = (song.sections ?? []).filter(s => s.from >= 1 && s.to >= s.from && s.to <= n);
  if (valid.length) return valid;
  const out: SongSection[] = [];
  const extra = score.pickup ? 1 : 0; // the pickup bar belongs with the first phrase
  const size = n - extra <= 6 ? 2 : 4;
  let from = 1;
  for (let i = 0; from <= n; i++) {
    let to = Math.min(n, from + size - 1 + (i === 0 ? extra : 0));
    // don't leave a single bar dangling at the end
    if (n - to === 1) to = n;
    out.push({ name: `Phrase ${i + 1}`, from, to });
    from = to + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lyrics
// ---------------------------------------------------------------------------

/**
 * Align a verse of lyrics with the melody (first voice of the first staff).
 * Syllables are separated by spaces; a trailing "-" joins it to the next
 * syllable of the same word; "_" holds the previous syllable over a note.
 * Returns the syllable for each note element id.
 */
export function alignLyrics(verse: string, score: Score): Map<string, string> {
  const out = new Map<string, string>();
  const notes = score.staves[0]?.voices[0]?.notes.filter(n => !n.rest && !n.tiePrev) ?? [];
  const sylls = verse.split(/\s+/).filter(Boolean);
  notes.forEach((n, i) => {
    const s = sylls[i];
    if (s && s !== '_') out.set(n.id, s);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** A song as a ClefSong document (for export / sharing). */
export function songToDoc(song: SongDef): SongDoc {
  const doc: SongDoc = {
    format: SONG_FORMAT,
    version: SONG_FORMAT_VERSION,
    id: song.id,
    title: song.title,
    composer: song.composer || undefined,
    arranger: song.arranger,
    year: song.year,
    source: song.source,
    license: song.license,
    instrument: song.instrument,
    level: song.level,
    key: song.key,
    time: song.time,
    tempo: song.tempo,
    pickup: song.pickup,
    mallets: song.mallets,
    blurb: song.blurb,
    tags: song.tags,
    staves: song.staves.map(s => ({ clef: s.clef, hand: s.hand, name: s.name, voices: s.voices })),
    chords: song.chords,
    sections: song.sections,
    lyrics: song.lyrics,
  };
  return JSON.parse(JSON.stringify(doc)) as SongDoc;
}

export function songToJson(song: SongDef): string {
  return JSON.stringify(songToDoc(song), null, 2);
}
