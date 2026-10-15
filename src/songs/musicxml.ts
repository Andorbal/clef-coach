/**
 * MusicXML → Clef Coach song.
 *
 * Reads score-partwise (and score-timewise, converted on the fly) MusicXML – plain
 * text via importMusicXml, compressed .mxl via importMxl – and writes the chosen
 * part(s) as a SongDef in the app's text notation:
 *
 *   - staves and up to two voices per staff (extra voices merge into chords or drop),
 *   - notes, rests, chords, ties, dots and triplets; other tuplets are rounded,
 *   - spelling is kept; transposing parts become the pitch the app wants (sounding
 *     for keyboard and fretted instruments, written for mallets),
 *   - key / time changes, pickup bar, tempo, repeats, endings, D.C. / D.S. / Fine /
 *     Coda (written out in performance order, like the notation's own unroller),
 *   - fingering, string and fret, chord symbols and lyrics,
 *   - the parts not chosen become the song's band parts (percussion read as GM drum keys).
 *
 * Whatever is simplified or dropped is listed in `warnings`. Pure TypeScript: runs in
 * the browser and in Node.
 */
import type { BandPartDef } from '../music/band';
import { chordSymbolText, parseChordSymbol } from '../music/chords';
import { DRUM_KEYS, clampProgram, pitchesToDrumWords } from '../music/gm';
import { type InstrumentId, TUNINGS, familyOf, instrumentDef } from '../music/instruments';
import { type KeySig, type Mode, parseKey, keyName, tonicOf } from '../music/keys';
import type { SongDef, SongStaffDef } from '../music/parse';
import { type Pitch, type Step, STEPS, diatonicIndex, fromDiatonic, midiOf, spellMidi } from '../music/pitch';
import { type BaseDuration, type TimeSig, PPQ, durationTicks, measureTicks } from '../music/rhythm';
import type { Clef } from '../music/score';
import { newSongId } from './format';
import {
  type ImportPart,
  type ImportResult,
  type Layout,
  type TimedNote,
  ImportError,
  Warnings,
  appTuningFor,
  bandNote,
  buildVoice,
  cleanTempo,
  drumVoice,
  guessInstrument,
  makeLayout,
  inferModes,
  layoutEnd,
  limitBand,
  makeQuantizer,
  median,
  pickupToken,
  plural,
  programFromName,
  quoteList,
  retunedWarning,
  snapVoice,
  writeChordLine,
  writeVoice,
} from './importkit';
import { type XmlElement, child, childNumber, childText, decodeXmlBytes, kids, parseXml, path, textOf } from './xml';
import { isZip, listZip, readZipEntry } from './zip';

export type { ImportPart, ImportResult } from './importkit';
export { ImportError } from './importkit';

export interface MusicXmlOptions {
  /** Instrument to write the song for (guessed from the part when absent). */
  instrument?: InstrumentId;
  /** Parts to import (ids from `parts`); default: the first part, or a piano RH/LH pair. */
  partIds?: string[];
  /** Title to use when the file has none (e.g. the file name). */
  title?: string;
  /**
   * Write each part for its own instrument when it is known (Guitar Pro tracks):
   * `instrument` then only says which part to open by default.
   */
  keepPartInstrument?: boolean;
  /** Leave out the bars before the chosen parts start playing. */
  trimLeadingRests?: boolean;
  /** Keep the parts not imported as the song's band parts (default true). */
  band?: boolean;
}

// ---------------------------------------------------------------------------
// What we read from the file
// ---------------------------------------------------------------------------

export interface ClefInfo {
  sign: string;
  line: number;
  /** clef-octave-change: -1 for the guitar's treble-8vb clef. */
  octave: number;
}

export interface Transpose {
  chromatic: number;
  diatonic: number;
  octave: number;
}

/** One written note head. */
export interface XNote {
  written: Pitch;
  tieStart: boolean;
  finger?: number;
  string?: number;
  fret?: number;
}

/** A note, chord or rest in one voice of one staff. */
export interface XGroup {
  staff: number;
  voice: string;
  /** Ticks from the start of the measure. */
  start: number;
  end: number;
  notes: XNote[];
  lyrics: Map<number, string>;
  transpose: Transpose | null;
  clef: ClefInfo | undefined;
  /** Stem direction written in the file: 1 up, -1 down. */
  stem?: 1 | -1;
  /** Percussion struck here, as General MIDI drum keys (36 bass drum, 38 snare …). */
  drums?: number[];
}

export interface XHarmony {
  tick: number;
  /** A chord symbol given as text (Guitar Pro), used instead of root / kind when it reads. */
  symbol?: string;
  root: { step: Step; alter: number } | null;
  kind: string;
  kindText: string;
  bass?: { step: Step; alter: number };
  degrees: { value: number; alter: number; type: string }[];
}

export interface XMeasure {
  number: string;
  implicit: boolean;
  /** Length of the music in it, in ticks. */
  len: number;
  /** Time signature and key in force from its start. */
  time: TimeSig;
  key: KeySig;
  transpose: Transpose | null;
  groups: XGroup[];
  harmonies: XHarmony[];
  /** Clef of each staff as the measure begins, and the changes inside it (ticks from its start). */
  clefStart: Map<number, ClefInfo>;
  clefs: { staff: number; tick: number; clef: ClefInfo }[];
  tempo?: number;
  fwdRepeat: boolean;
  /** Times played for a backward repeat (0 = none). */
  bwdRepeat: number;
  endingStart?: number[];
  endingStop: boolean;
  endingNums?: number[];
  segno: boolean;
  codaSign: boolean;
  codaTarget: boolean;
  tocoda: boolean;
  dacapo: boolean;
  dalsegno: boolean;
  fine: boolean;
}

export interface XPart {
  id: string;
  name: string;
  names: string[];
  program?: number;
  braces: number[];
  staves: number;
  measures: XMeasure[];
  firstClefs: Map<number, ClefInfo>;
  tabStaves: Set<number>;
  /** Open strings from <staff-details> (MIDI, string 1 first). */
  tuning?: number[];
  /** Has a time signature (music without one is written bar by bar in whatever fits). */
  metered: boolean;
  /** Says its keys are minor (many files give only the signature, or "major" for everything). */
  modeGiven: boolean;
  /** A percussion part: all its notes are drums (in XGroup.drums). */
  drums?: boolean;
  counts: { grace: number; unpitched: number; microtones: number; oddTuplets: number };
}

const TYPE_DUR: Record<string, BaseDuration> = { whole: 'w', half: 'h', quarter: 'q', eighth: 'e', '16th': 's', '32nd': 't', '64th': 'x' };
const VALID_DEN = [1, 2, 4, 8, 16, 32];
/** Most beats a bar can have (long cadenza bars need many). */
const MAX_BEATS = 64;

const num = (s: string | undefined, fallback = 0) => {
  const n = Number(s);
  return s !== undefined && s.trim() !== '' && Number.isFinite(n) ? n : fallback;
};

const flatText = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Header and part list
// ---------------------------------------------------------------------------

export interface Header {
  title: string;
  composer: string;
  arranger?: string;
  lyricist?: string;
  rights?: string;
  software?: string;
}

function readHeader(root: XmlElement): Header {
  const work = flatText(textOf(path(root, 'work', 'work-title')));
  const movement = flatText(childText(root, 'movement-title'));
  const credits = new Map<string, string>();
  for (const c of kids(root, 'credit')) {
    const type = childText(c, 'credit-type');
    const words = flatText(kids(c, 'credit-words').map(textOf).join(' '));
    if (type && words && !credits.has(type)) credits.set(type, words);
  }
  const title = work && movement && work !== movement ? `${work}: ${movement}` : work || movement || credits.get('title') || '';
  const ident = child(root, 'identification');
  const creator = (type: string) => flatText(kids(ident, 'creator').filter(c => c.attrs.type === type).map(textOf).join(', '));
  let lyricist = creator('lyricist') || creator('poet') || credits.get('lyricist') || undefined;
  let arranger = creator('arranger') || credits.get('arranger') || undefined;
  // notation programs' "lyricist" box often holds the arrangement credit ("Arr. by …")
  const arr = lyricist && /^\s*arr(?:anged|\.|angement)?\s*(?:by|:)?\s*/i.exec(lyricist);
  if (lyricist && arr) {
    arranger ??= lyricist.slice(arr[0].length).trim() || undefined;
    lyricist = undefined;
  }
  return {
    title,
    composer: creator('composer') || credits.get('composer') || '',
    arranger,
    lyricist,
    rights: flatText(kids(ident, 'rights').map(textOf).join(' ')) || credits.get('rights') || undefined,
    software: flatText(kids(path(ident, 'encoding'), 'software').map(textOf).join(', ')) || undefined,
  };
}

interface PartInfo {
  name: string;
  names: string[];
  program?: number;
  braces: number[];
  /** Percussion instruments by id: the GM drum key each plays (from <midi-unpitched>) and its name. */
  kit: Map<string, { key?: number; name: string }>;
}

function readPartList(root: XmlElement): Map<string, PartInfo> {
  const out = new Map<string, PartInfo>();
  const open = new Map<string, number>(); // group number → id of an open brace group
  let groupId = 0;
  for (const el of kids(child(root, 'part-list'))) {
    if (el.name === 'part-group') {
      const n = el.attrs.number ?? '1';
      if (el.attrs.type === 'start' && childText(el, 'group-symbol') === 'brace') open.set(n, ++groupId);
      if (el.attrs.type === 'stop') open.delete(n);
    } else if (el.name === 'score-part') {
      const name = flatText(childText(el, 'part-name'));
      const names = [name, childText(el, 'part-abbreviation'), ...kids(el, 'score-instrument').map(i => childText(i, 'instrument-name'))].filter(Boolean);
      const program = kids(el, 'midi-instrument').map(m => childNumber(m, 'midi-program')).find(p => p !== undefined);
      const kit = new Map<string, { key?: number; name: string }>(kids(el, 'score-instrument').map(i => [i.attrs.id ?? '', { name: flatText(childText(i, 'instrument-name')) }]));
      for (const m of kids(el, 'midi-instrument')) {
        const u = childNumber(m, 'midi-unpitched');
        if (u === undefined) continue;
        const id = m.attrs.id ?? '';
        // <midi-unpitched> counts from 1, like <midi-program>
        kit.set(id, { name: kit.get(id)?.name ?? '', key: Math.round(u) - 1 });
      }
      out.set(el.attrs.id ?? '', { name: name || names[0] || '', names, program, braces: [...open.values()], kit });
    }
  }
  return out;
}

/** score-timewise (measures holding parts) → score-partwise (parts holding measures). */
function timewiseToPartwise(root: XmlElement): XmlElement {
  const parts = new Map<string, XmlElement>();
  for (const m of kids(root, 'measure')) {
    for (const p of kids(m, 'part')) {
      const id = p.attrs.id ?? '';
      let part = parts.get(id);
      if (!part) parts.set(id, (part = { name: 'part', attrs: { id }, children: [], text: '' }));
      part.children.push({ name: 'measure', attrs: m.attrs, children: p.children, text: '' });
    }
  }
  return { name: 'score-partwise', attrs: root.attrs, children: [...root.children.filter(c => c.name !== 'measure'), ...parts.values()], text: '' };
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

function readKey(el: XmlElement, w: Warnings): KeySig | null {
  const fifths = childNumber(el, 'fifths');
  if (fifths === undefined) {
    w.add('A non-standard key signature was replaced by C major.');
    return null;
  }
  const modeText = childText(el, 'mode').toLowerCase();
  if (modeText && modeText !== 'major' && modeText !== 'minor' && modeText !== 'none') {
    w.add(`The ${modeText} mode is shown with its key signature as a major key.`);
  }
  const mode: Mode = modeText === 'minor' ? 'minor' : 'major';
  return { fifths: Math.max(-7, Math.min(7, Math.round(fifths))), mode };
}

function readTime(el: XmlElement, w: Warnings): TimeSig | null {
  if (child(el, 'senza-misura')) {
    w.add('Unmetered music (senza misura) is written with a time signature that fits each bar.');
    return null;
  }
  const beats = kids(el, 'beats').map(b => textOf(b).split('+').reduce((s, x) => s + num(x), 0));
  const types = kids(el, 'beat-type').map(b => num(textOf(b)));
  if (!beats.length || !types.length) {
    const sym = el.attrs.symbol;
    return sym === 'cut' ? [2, 2] : sym === 'common' ? [4, 4] : null;
  }
  // composite signatures (3/8 + 2/4) are added up over the smallest unit
  const den = Math.max(...types);
  const n = beats.reduce((s, b, i) => s + (b * den) / (types[i] ?? den), 0);
  if (!Number.isInteger(n) || n < 1 || n > MAX_BEATS || !VALID_DEN.includes(den)) {
    w.add(`The time signature ${beats.join('+')}/${types.join('+')} isn't supported; 4/4 was used.`);
    return null;
  }
  if (beats.length > 1) w.add(`The composite time signature was written as ${n}/${den}.`);
  return [n, den];
}

function readClef(el: XmlElement): ClefInfo {
  return { sign: childText(el, 'sign').toUpperCase() || 'G', line: num(childText(el, 'line'), 0), octave: num(childText(el, 'clef-octave-change'), 0) };
}

function readTranspose(el: XmlElement): Transpose {
  const chromatic = num(childText(el, 'chromatic'), 0);
  const d = childText(el, 'diatonic');
  return { chromatic, diatonic: d ? num(d) : Math.round((chromatic * 7) / 12), octave: num(childText(el, 'octave-change'), 0) };
}

// ---------------------------------------------------------------------------
// Parts and measures
// ---------------------------------------------------------------------------

function parseEndingNumbers(s: string | undefined): number[] {
  const out: number[] = [];
  for (const m of (s ?? '').matchAll(/(\d+)\s*(?:-\s*(\d+))?/g)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let k = a; k <= b && k < a + 20; k++) out.push(k);
  }
  return out.length ? out : [1];
}

function readSound(s: XmlElement, m: XMeasure): void {
  const a = s.attrs;
  if (a.tempo && m.tempo === undefined && num(a.tempo) > 0) m.tempo = num(a.tempo);
  if (a.dacapo === 'yes') m.dacapo = true;
  if (a.dalsegno) m.dalsegno = true;
  if (a.segno) m.segno = true;
  if (a.coda) m.codaTarget = true;
  if (a.tocoda) m.tocoda = true;
  if (a.fine) m.fine = true;
}

function readDirection(d: XmlElement, m: XMeasure): void {
  const sound = child(d, 'sound');
  const soundJumps = !!sound && ['dacapo', 'dalsegno', 'segno', 'coda', 'tocoda', 'fine'].some(k => sound.attrs[k]);
  for (const dt of kids(d, 'direction-type')) {
    if (child(dt, 'segno')) m.segno = true;
    if (child(dt, 'coda')) m.codaSign = true;
    const met = child(dt, 'metronome');
    if (met && m.tempo === undefined) {
      const unit = TYPE_DUR[childText(met, 'beat-unit')];
      const per = Number(/\d+(?:\.\d+)?/.exec(childText(met, 'per-minute'))?.[0]);
      if (unit && per > 0) m.tempo = (per * durationTicks(unit, kids(met, 'beat-unit-dot').length)) / PPQ;
    }
    if (!soundJumps) {
      const words = flatText(kids(dt, 'words').map(textOf).join(' '));
      if (/\bD\.\s*C\.|\bda\s+capo\b/i.test(words)) m.dacapo = true;
      if (/\bD\.\s*S\.|\bdal\s+segno\b/i.test(words)) m.dalsegno = true;
      if (/^fine\.?$/i.test(words)) m.fine = true;
      if (/\bto\s+coda\b/i.test(words)) m.tocoda = true;
      if (/^coda$/i.test(words)) m.codaTarget = true;
    }
  }
  if (sound) readSound(sound, m);
}

function readBarline(b: XmlElement, m: XMeasure): void {
  const rep = child(b, 'repeat');
  if (rep?.attrs.direction === 'forward') m.fwdRepeat = true;
  if (rep?.attrs.direction === 'backward') m.bwdRepeat = Math.max(2, Math.round(num(rep.attrs.times, 2)));
  const end = child(b, 'ending');
  if (end?.attrs.type === 'start') m.endingStart = parseEndingNumbers(end.attrs.number);
  else if (end) m.endingStop = true;
  if (child(b, 'segno')) m.segno = true;
  if (child(b, 'coda')) m.codaSign = true;
}

function readHarmony(h: XmlElement, tick: number): XHarmony | null {
  const root = child(h, 'root');
  const kindEl = child(h, 'kind');
  const kind = textOf(kindEl);
  const stepOf = (el: XmlElement | undefined, s: string, a: string) => {
    const step = childText(el, s).toUpperCase() as Step;
    return STEPS.includes(step) ? { step, alter: Math.round(num(childText(el, a), 0)) } : undefined;
  };
  const r = stepOf(root, 'root-step', 'root-alter');
  if (!r && kind !== 'none') return null;
  return {
    tick,
    root: r ?? null,
    kind,
    kindText: kindEl?.attrs.text ?? '',
    bass: stepOf(child(h, 'bass'), 'bass-step', 'bass-alter'),
    degrees: kids(h, 'degree').map(d => ({ value: num(childText(d, 'degree-value')), alter: num(childText(d, 'degree-alter')), type: childText(d, 'degree-type') })),
  };
}

function readLyrics(note: XmlElement, labels: Map<string, number>, into: Map<number, string>): void {
  for (const l of kids(note, 'lyric')) {
    const label = l.attrs.number ?? l.attrs.name ?? '1';
    let verse = labels.get(label);
    if (verse === undefined) {
      verse = /^\d+$/.test(label) ? Number(label) : 1000 + labels.size;
      labels.set(label, verse);
    }
    const texts = kids(l, 'text').map(t => t.text.trim()).filter(Boolean);
    if (!texts.length || into.has(verse)) continue;
    const syllabic = kids(l, 'syllabic').map(textOf);
    const last = syllabic[syllabic.length - 1] ?? 'single';
    // elisions and inner spaces become ‿ so the syllable stays one token
    let s = texts.join('‿').replace(/\s+/g, '‿');
    if ((last === 'begin' || last === 'middle') && !s.endsWith('-')) s += '-';
    into.set(verse, s);
  }
}

function readTechnical(note: XmlElement, x: XNote): void {
  const tech = kids(note, 'notations').map(n => child(n, 'technical')).find(Boolean);
  if (!tech) return;
  const f = kids(tech, 'fingering').find(e => e.attrs.substitution !== 'yes' && e.attrs.alternate !== 'yes') ?? child(tech, 'fingering');
  const ft = textOf(f);
  const digit = /\d/.exec(ft)?.[0];
  if (digit !== undefined) x.finger = Number(digit);
  else if (/^[LR]$/i.test(ft)) x.finger = ft.toUpperCase() === 'L' ? 2 : 3;
  const s = childNumber(tech, 'string');
  if (s !== undefined && s >= 1) x.string = Math.round(s);
  const fr = childNumber(tech, 'fret');
  if (fr !== undefined && fr >= 0) x.fret = Math.round(fr);
}

/**
 * Common drum-set notation on a five-line staff: where a note sits says which drum it is
 * (bass drum in the bottom space, snare in the third, hi-hat above the staff…). GM drum
 * keys for [a normal notehead, an x notehead]; notes beyond either end count as the end.
 */
const DRUM_STAFF: [string, number, number][] = [
  ['D4', 44, 44], // below the staff: hi-hat pedal
  ['E4', 35, 44], // bottom line: a second bass drum
  ['F4', 36, 36], // bass drum
  ['G4', 41, 41], // low floor tom
  ['A4', 43, 43], // floor tom
  ['B4', 47, 47], // middle line: low-mid tom
  ['C5', 38, 37], // snare; with an x, side stick
  ['D5', 48, 48], // high-mid tom
  ['E5', 50, 50], // high tom
  ['F5', 51, 51], // top line: ride cymbal
  ['G5', 42, 42], // above the staff: hi-hat
  ['A5', 49, 49], // crash cymbal
];

/** Percussion instrument names → GM drum keys, for parts that name their instruments but give no key. */
const DRUM_NAMES: [RegExp, number][] = [
  [/open hi-?hat/, 46], [/pedal hi-?hat|hi-?hat pedal|hi-?hat foot/, 44], [/hi-?hat/, 42],
  [/side ?stick|cross ?stick|rim/, 37], [/snare/, 38], [/kick|bass ?drum|gran ?cassa/, 36],
  [/floor tom/, 43], [/high tom/, 50], [/low tom/, 45], [/tom/, 47],
  [/ride bell/, 53], [/ride/, 51], [/splash/, 55], [/china/, 52], [/crash|cymbal|piatti/, 49],
  [/tambourine/, 54], [/cowbell/, 56], [/clap/, 39], [/triangle/, 81], [/wood ?block|temple block/, 76],
  [/claves/, 75], [/shaker/, 82], [/maraca/, 70], [/cabasa/, 69], [/castanet/, 85], [/bongo/, 60],
  [/conga/, 63], [/timbale/, 65], [/agogo/, 67], [/guiro/, 73], [/bell tree/, 84], [/jingle|sleigh/, 83],
];

/**
 * The GM drum key of an unpitched note: its instrument's <midi-unpitched>, else what the
 * instrument's name says, else where the note sits on a drum-set staff (and its notehead).
 */
function drumKeyOfNote(note: XmlElement, unpitched: XmlElement, info: PartInfo | undefined): number {
  const kit = info?.kit ?? new Map<string, { key?: number; name: string }>();
  const id = child(note, 'instrument')?.attrs.id;
  // a part of one instrument (a snare drum, a triangle) doesn't say which on each note
  const inst = id !== undefined ? kit.get(id) : kit.size === 1 ? [...kit.values()][0] : undefined;
  if (inst?.key !== undefined && inst.key >= 0 && inst.key <= 127) return inst.key;
  const name = inst?.name.toLowerCase().trim();
  if (name) {
    const exact = DRUM_KEYS.find(d => d.gm.toLowerCase() === name || d.name === name);
    const known = exact?.key ?? DRUM_NAMES.find(([re]) => re.test(name))?.[1];
    if (known !== undefined) return known;
  }
  const step = childText(unpitched, 'display-step').toUpperCase() as Step;
  if (!STEPS.includes(step)) return 38;
  const at = diatonicIndex({ step, alter: 0, octave: num(childText(unpitched, 'display-octave'), 4) });
  const pos = (s: string) => diatonicIndex({ step: s[0] as Step, alter: 0, octave: Number(s[1]) });
  const row = DRUM_STAFF.find(([s]) => pos(s) >= at) ?? DRUM_STAFF[DRUM_STAFF.length - 1];
  const head = childText(note, 'notehead');
  if (head === 'circle-x' && row[0] === 'G5') return 46; // open hi-hat
  if (head === 'diamond' && row[0] === 'F5') return 53; // ride bell
  return /x|cross/.test(head) ? row[2] : row[1];
}

export function emptyMeasure(number: string, implicit: boolean, time: TimeSig, key: KeySig, transpose: Transpose | null): XMeasure {
  return {
    number, implicit, len: 0, time, key, transpose, groups: [], harmonies: [], clefStart: new Map(), clefs: [],
    fwdRepeat: false, bwdRepeat: 0, endingStop: false,
    segno: false, codaSign: false, codaTarget: false, tocoda: false, dacapo: false, dalsegno: false, fine: false,
  };
}

function readPart(el: XmlElement, info: PartInfo | undefined, w: Warnings): XPart {
  const part: XPart = {
    id: el.attrs.id ?? '',
    name: info?.name || el.attrs.id || 'Part',
    names: info?.names ?? [],
    program: info?.program,
    braces: info?.braces ?? [],
    staves: 1,
    measures: [],
    firstClefs: new Map(),
    tabStaves: new Set(),
    metered: false,
    modeGiven: false,
    counts: { grace: 0, unpitched: 0, microtones: 0, oddTuplets: 0 },
  };
  let divisions = 1;
  let time: TimeSig = [4, 4];
  let key: KeySig = { fifths: 0, mode: 'major' };
  const clefs = new Map<number, ClefInfo>();
  const transposes = new Map<number, Transpose>(); // 0 = every staff
  const lyricLabels = new Map<string, number>();
  const transposeFor = (staff: number) => transposes.get(staff) ?? transposes.get(0) ?? null;

  for (const mEl of kids(el, 'measure')) {
    const m = emptyMeasure(mEl.attrs.number ?? String(part.measures.length + 1), mEl.attrs.implicit === 'yes', time, key, transposeFor(1));
    m.clefStart = new Map(clefs);
    let pos = 0;
    let maxPos = 0;
    let lastStart = 0;
    let last: XGroup | null = null;
    let inCueChord = false;
    let started = false; // has the measure's music begun (for mid-measure attribute changes)
    const ticks = (d: number) => (d * PPQ) / divisions;
    for (const c of mEl.children) {
      switch (c.name) {
        case 'attributes': {
          const d = childNumber(c, 'divisions');
          if (d && d > 0) divisions = d;
          const k = child(c, 'key');
          const nk = k ? readKey(k, w) : null;
          // only "minor" is trusted: some programs write "major" for every key they export
          if (k && /^minor$/i.test(childText(k, 'mode'))) part.modeGiven = true;
          if (nk) {
            key = nk;
            if (!started) m.key = nk;
          }
          const t = child(c, 'time');
          const nt = t ? readTime(t, w) : null;
          if (nt) {
            part.metered = true;
            time = nt;
            if (!started) m.time = nt;
          }
          part.staves = Math.max(part.staves, childNumber(c, 'staves') ?? 1);
          for (const cl of kids(c, 'clef')) {
            const n = num(cl.attrs.number, 1);
            const ci = readClef(cl);
            if (!part.firstClefs.has(n)) part.firstClefs.set(n, ci);
            m.clefs.push({ staff: n, tick: pos, clef: ci });
            clefs.set(n, ci);
            if (ci.sign === 'TAB') part.tabStaves.add(n);
          }
          for (const tr of kids(c, 'transpose')) transposes.set(num(tr.attrs.number, 0), readTranspose(tr));
          if (!started) m.transpose = transposeFor(1);
          for (const sd of kids(c, 'staff-details')) {
            const tunings = kids(sd, 'staff-tuning');
            if (!tunings.length || part.tuning) continue;
            const open: number[] = [];
            for (const st of tunings) {
              const step = childText(st, 'tuning-step').toUpperCase() as Step;
              if (!STEPS.includes(step)) continue;
              const midi = midiOf({ step, alter: Math.round(num(childText(st, 'tuning-alter'))), octave: num(childText(st, 'tuning-octave'), 4) });
              open[num(st.attrs.line, open.length + 1) - 1] = midi;
            }
            // staff lines count from the lowest string; strings count from the highest
            part.tuning = open.filter(x => x !== undefined).reverse();
          }
          break;
        }
        case 'note': {
          const isChord = !!child(c, 'chord') && last !== null;
          if (child(c, 'grace')) {
            part.counts.grace++;
            break;
          }
          // the other notes of a cue chord go with it
          if (isChord && inCueChord) break;
          inCueChord = false;
          started = true;
          const dur = childNumber(c, 'duration');
          let len = dur !== undefined ? ticks(dur) : 0;
          const tm = child(c, 'time-modification');
          const actual = num(childText(tm, 'actual-notes'), 1);
          const normal = num(childText(tm, 'normal-notes'), 1);
          if (tm && Math.abs((actual / normal) * 2 - 3) > 1e-9 && actual !== normal) part.counts.oddTuplets++;
          if (dur === undefined) {
            // no <duration>: work it out from the note type
            const base = TYPE_DUR[childText(c, 'type')];
            len = base ? (durationTicks(base, kids(c, 'dot').length) * normal) / actual : 0;
          }
          const start = isChord ? lastStart : pos;
          if (!isChord) {
            lastStart = pos;
            pos += len;
            maxPos = Math.max(maxPos, pos);
          }
          if (child(c, 'cue')) {
            inCueChord = true;
            break;
          }
          const staff = num(childText(c, 'staff'), 1);
          const voice = childText(c, 'voice') || '1';
          let note: XNote | null = null;
          const p = child(c, 'pitch');
          const unpitched = child(c, 'unpitched');
          let drum: number | null = null;
          if (unpitched) {
            part.counts.unpitched++;
            // a hit tied on from the note before is still sounding: it isn't struck again
            const tiedOn = [...kids(c, 'tie'), ...kids(c, 'notations').flatMap(n => kids(n, 'tied'))].some(t => t.attrs.type === 'stop' || t.attrs.type === 'continue');
            if (!tiedOn) drum = drumKeyOfNote(c, unpitched, info);
          }
          if (p && !child(c, 'rest')) {
            const step = childText(p, 'step').toUpperCase() as Step;
            const alterRaw = num(childText(p, 'alter'), 0);
            if (alterRaw !== Math.round(alterRaw)) part.counts.microtones++;
            if (STEPS.includes(step)) {
              const ties = [...kids(c, 'tie'), ...kids(c, 'notations').flatMap(n => kids(n, 'tied'))];
              note = {
                written: { step, alter: Math.max(-2, Math.min(2, Math.round(alterRaw))), octave: num(childText(p, 'octave'), 4) },
                tieStart: ties.some(t => t.attrs.type === 'start' || t.attrs.type === 'continue'),
              };
              readTechnical(c, note);
            }
          }
          if (isChord && last) {
            if (note) last.notes.push(note);
            if (drum !== null) (last.drums ??= []).push(drum);
            readLyrics(c, lyricLabels, last.lyrics);
            break;
          }
          const g: XGroup = { staff, voice, start, end: start + len, notes: note ? [note] : [], lyrics: new Map(), transpose: transposeFor(staff), clef: clefs.get(staff) };
          if (drum !== null) g.drums = [drum];
          const stem = childText(c, 'stem');
          if (stem === 'up' || stem === 'down') g.stem = stem === 'up' ? 1 : -1;
          readLyrics(c, lyricLabels, g.lyrics);
          m.groups.push(g);
          last = g;
          break;
        }
        case 'backup':
          pos = Math.max(0, pos - ticks(childNumber(c, 'duration') ?? 0));
          break;
        case 'forward':
          pos += ticks(childNumber(c, 'duration') ?? 0);
          maxPos = Math.max(maxPos, pos);
          break;
        case 'harmony': {
          const h = readHarmony(c, pos + ticks(childNumber(c, 'offset') ?? 0));
          if (h) m.harmonies.push(h);
          break;
        }
        case 'direction':
          readDirection(c, m);
          break;
        case 'sound':
          readSound(c, m);
          break;
        case 'barline':
          readBarline(c, m);
          break;
      }
    }
    m.len = Math.round(maxPos * 1000) / 1000;
    part.measures.push(m);
  }
  // spread ending numbers over the measures each ending covers
  let cur: number[] | undefined;
  for (const m of part.measures) {
    if (m.endingStart) cur = m.endingStart;
    m.endingNums = cur;
    if (m.endingStop || (cur && m.bwdRepeat)) cur = undefined;
  }
  if (part.counts.unpitched && !hasNotes(part)) part.drums = true;
  return part;
}

const hasNotes = (p: XPart) => p.measures.some(m => m.groups.some(g => g.notes.length));
const noteCount = (p: XPart) => p.measures.reduce((s, m) => s + m.groups.reduce((t, g) => t + g.notes.length, 0), 0);

// ---------------------------------------------------------------------------
// Repeats and jumps → performance order
// ---------------------------------------------------------------------------

interface Pass {
  m: number;
  pass: number;
}

/** Play out repeats, endings, D.C. / D.S. al Fine / al Coda into a list of measures. */
function unroll(ms: XMeasure[], w: Warnings): Pass[] {
  const n = ms.length;
  // consecutive ending brackets form a group; note every number used in the group
  const groupNums: (number[] | null)[] = ms.map(() => null);
  const groupLast: boolean[] = ms.map(() => false);
  for (let i = 0; i < n; ) {
    if (!ms[i].endingNums) {
      i++;
      continue;
    }
    let j = i;
    const nums = new Set<number>();
    while (j < n && ms[j].endingNums) ms[j++].endingNums!.forEach(x => nums.add(x));
    for (let k = i; k < j; k++) groupNums[k] = [...nums];
    groupLast[j - 1] = true;
    i = j;
  }
  const segno = ms.findIndex(m => m.segno);
  const tocodaAt = ms.map((m, i) => (m.tocoda ? i : -1)).filter(i => i >= 0);
  let codaTarget = ms.findIndex(m => m.codaTarget);
  const signs = ms.map((m, i) => (m.codaSign ? i : -1)).filter(i => i >= 0);
  if (codaTarget < 0) {
    const after = signs.filter(i => !tocodaAt.includes(i) && (tocodaAt.length ? i > tocodaAt[0] : true));
    if (tocodaAt.length && after.length) codaTarget = after[0];
    else if (!tocodaAt.length && signs.length >= 2) {
      codaTarget = signs[signs.length - 1];
      tocodaAt.push(signs[0]);
    }
  }
  const out: Pass[] = [];
  const taken = new Map<number, number>();
  let i = 0;
  let pass = 1;
  let repeatStart = 0;
  let jumped = false;
  let tookCoda = false;
  let backJump = false;
  const limit = n * 8 + 64;
  while (i < n && out.length < limit) {
    const M = ms[i];
    if (M.fwdRepeat && !backJump && !jumped) {
      repeatStart = i;
      pass = 1;
    }
    backJump = false;
    if (M.endingNums) {
      const nums = groupNums[i]!;
      // after a D.C./D.S., or on a pass no bracket names, take the last ending
      const want = jumped || !nums.includes(pass) ? Math.max(...nums) : pass;
      if (!M.endingNums.includes(want)) {
        i++;
        continue;
      }
    }
    out.push({ m: i, pass });
    if (jumped && M.fine) break;
    if (jumped && tocodaAt.includes(i) && !tookCoda) {
      if (codaTarget > i) {
        tookCoda = true;
        i = codaTarget;
        continue;
      }
      w.add('A "To Coda" sign has no coda to jump to; the music continues straight on.');
    }
    if (M.bwdRepeat && !jumped) {
      const times = Math.max(M.bwdRepeat, M.endingNums ? Math.max(...groupNums[i]!) : 0);
      const done = taken.get(i) ?? 0;
      if (done < times - 1) {
        taken.set(i, done + 1);
        pass++;
        i = repeatStart;
        backJump = true;
        continue;
      }
      taken.delete(i);
      repeatStart = i + 1;
      pass = 1;
    } else if (M.endingNums && groupLast[i] && !jumped) {
      repeatStart = i + 1;
      pass = 1;
    }
    if (!jumped && M.dacapo) {
      jumped = true;
      i = 0;
      pass = 1;
      continue;
    }
    if (!jumped && M.dalsegno) {
      if (segno >= 0) {
        jumped = true;
        i = segno;
        pass = 1;
        continue;
      }
      w.add('A "D.S." has no segno sign to jump to; it was ignored.');
    }
    i++;
  }
  if (out.length >= limit) w.add('The repeat structure is too tangled to follow completely; it was cut short.');
  return out;
}

// ---------------------------------------------------------------------------
// Pitch: written → what the app stores
// ---------------------------------------------------------------------------

/** Transpose a spelled pitch by a MusicXML <transpose> interval, keeping the spelling logic. */
function transposePitch(p: Pitch, t: Transpose): Pitch {
  const chroma = t.chromatic + 12 * t.octave;
  const dia = t.diatonic + 7 * t.octave;
  if (!chroma && !dia) return p;
  const target = midiOf(p) + chroma;
  const nat = fromDiatonic(diatonicIndex(p) + dia);
  const alter = target - midiOf(nat);
  return Math.abs(alter) <= 2 ? { ...nat, alter } : spellMidi(target, p.alter < 0 ? -1 : 1);
}

const octaveShift = (p: Pitch, semis: number): Pitch => ({ ...p, octave: p.octave + semis / 12 });

/** The key a transposing part sounds in. */
function transposeKey(k: KeySig, t: Transpose | null): KeySig {
  if (!t || (((t.chromatic % 12) + 12) % 12 === 0 && t.diatonic % 7 === 0)) return k;
  const tonic = tonicOf(k);
  const p = transposePitch({ ...tonic, octave: 4 }, { ...t, octave: 0 });
  const name = (q: Pitch) => `${q.step}${q.alter === 1 ? '#' : q.alter === -1 ? 'b' : q.alter ? 'x' : ''}${k.mode === 'minor' ? 'm' : ''}`;
  for (const q of [p, spellMidi(midiOf(p), -1), spellMidi(midiOf(p), 1)]) {
    try {
      return parseKey(name(q));
    } catch {
      // not a key with at most 7 accidentals: try the enharmonic spelling
    }
  }
  return k;
}

interface PitchPlan {
  convert(n: XNote, g: XGroup): Pitch;
  /** Interval applied to keys and chord roots (null = none). */
  keyTranspose(m: XMeasure): Transpose | null;
}

function defaultTuning(instrument: InstrumentId): number[] {
  return instrument === 'bass' ? TUNINGS.bass4.open : instrument === 'ukulele' ? TUNINGS.ukuleleHighG.open : TUNINGS.guitar.open;
}

/**
 * Decide how written pitches become app pitches for one part.
 *   mallets  – written pitch.
 *   keyboard, ukulele – sounding pitch (written + <transpose>).
 *   guitar / bass in treble / bass clef – sounding pitch an octave below what the page
 *     shows (the app draws them with treble8vb / bass8vb). String + fret marks, when
 *     present, settle which octave the file means.
 */
function pitchPlan(part: XPart, instrument: InstrumentId, w: Warnings): PitchPlan {
  const semantic = (n: XNote, g: XGroup) => (g.transpose ? transposePitch(n.written, g.transpose) : n.written);
  if (instrument === 'mallets') return { convert: n => n.written, keyTranspose: () => null };
  const notes = part.measures.flatMap(m => m.groups.flatMap(g => g.notes.map(n => ({ n, g }))));
  if (familyOf(instrument) === 'fretted') {
    const tuning = part.tuning?.length ? part.tuning : defaultTuning(instrument);
    // evidence from string + fret: how far is the written note from the sounding one?
    const diffs = new Map<number, number>();
    for (const { n } of notes) {
      if (n.string === undefined || n.fret === undefined || tuning[n.string - 1] === undefined) continue;
      const d = midiOf(n.written) - (tuning[n.string - 1] + n.fret);
      diffs.set(d, (diffs.get(d) ?? 0) + 1);
    }
    const best = [...diffs].sort((a, b) => b[1] - a[1])[0];
    const total = [...diffs.values()].reduce((s, x) => s + x, 0);
    // most notes agree (a single note counts when it is all there is)
    if (best && best[0] % 12 === 0 && best[1] >= total * 0.6 && (best[1] >= 2 || best[1] === total)) {
      const shift = -best[0];
      return { convert: n => octaveShift(n.written, shift), keyTranspose: () => null };
    }
    const octaveClefInstrument = (g: XGroup) => (instrument === 'guitar' && (g.clef?.sign ?? 'G') === 'G') || (instrument === 'bass' && (g.clef?.sign ?? 'F') === 'F');
    const display = (n: XNote, g: XGroup) => {
      if (g.transpose && (g.transpose.octave || g.transpose.chromatic)) return transposePitch(n.written, g.transpose);
      // what the page shows, an octave down (an 8vb clef already shows it an octave up)
      return octaveShift(n.written, -12 - 12 * (g.clef?.octave ?? 0));
    };
    const [lo] = instrumentDef(instrument).range;
    const lowCount = (f: (n: XNote, g: XGroup) => Pitch) => notes.filter(({ n, g }) => octaveClefInstrument(g) && midiOf(f(n, g)) < lo).length;
    const useDisplay = lowCount(display) <= lowCount(semantic);
    if (!useDisplay) w.add(`The ${instrumentDef(instrument).name.toLowerCase()} part seems to be written at sounding pitch; it was kept as written.`);
    return {
      convert: (n, g) => (useDisplay && octaveClefInstrument(g) ? display(n, g) : semantic(n, g)),
      keyTranspose: m => (m.transpose && m.transpose.chromatic % 12 !== 0 ? m.transpose : null),
    };
  }
  return { convert: semantic, keyTranspose: m => m.transpose };
}

// ---------------------------------------------------------------------------
// Chord symbols
// ---------------------------------------------------------------------------

const KIND_SUFFIX: Record<string, string> = {
  major: '', minor: 'm', augmented: 'aug', diminished: 'dim', dominant: '7',
  'major-seventh': 'maj7', 'minor-seventh': 'm7', 'diminished-seventh': 'dim7', 'augmented-seventh': '7#5',
  'half-diminished': 'm7b5', 'major-minor': 'm(maj7)', 'major-sixth': '6', 'minor-sixth': 'm6',
  'dominant-ninth': '9', 'major-ninth': 'maj9', 'minor-ninth': 'm9', 'dominant-11th': '11', 'minor-11th': 'm11',
  'dominant-13th': '13', 'suspended-second': 'sus2', 'suspended-fourth': 'sus4', power: '5', pedal: '',
};
/** Kinds with no exact chord in the app, and the nearest one. */
const KIND_NEAREST: Record<string, string> = { 'major-11th': 'maj9', 'major-13th': 'maj9', 'minor-13th': 'm11' };

const accText = (a: number) => (a === 1 ? '#' : a === -1 ? 'b' : a === 2 ? '##' : a === -2 ? 'bb' : '');

function harmonySymbol(h: XHarmony, t: Transpose | null, w: Warnings): string | null {
  if (h.symbol !== undefined) {
    try {
      return chordSymbolText(parseChordSymbol(h.symbol.trim()));
    } catch {
      // not a symbol the app reads: its root and minor-ness, if it starts like a chord
      const m = /^([A-G](?:#|b)?)(m(?!aj))?/.exec(h.symbol.trim());
      if (!m) return null;
      w.add('Some chord symbols were simplified to the nearest chord Clef Coach knows.');
      return `${m[1]}${m[2] ?? ''}`;
    }
  }
  if (h.kind === 'none' || !h.root) return null;
  const move = (r: { step: Step; alter: number }) => {
    if (!t) return r;
    const p = transposePitch({ ...r, octave: 4 }, { ...t, octave: 0 });
    return { step: p.step, alter: p.alter };
  };
  const root = move(h.root);
  let suffix = KIND_SUFFIX[h.kind] ?? KIND_NEAREST[h.kind];
  let simplified = h.kind in KIND_NEAREST;
  if (suffix === undefined) {
    // unusual kinds (Neapolitan, Tristan, other…): the printed text if we can read it, else the triad
    suffix = h.kindText;
    try {
      parseChordSymbol(`C${suffix}`);
    } catch {
      suffix = /minor|dim/.test(h.kind) ? 'm' : '';
      simplified = true;
    }
  }
  for (const d of h.degrees) {
    const key = `${suffix}|${d.value}|${d.alter}|${d.type}`;
    const add: Record<string, string> = {
      '7|9|-1|add': '7b9', '7|9|-1|alter': '7b9', '7|9|1|add': '7#9', '7|9|1|alter': '7#9', '7|9|0|add': '9',
      '7|5|-1|alter': '7b5', '7|5|1|alter': '7#5', '|9|0|add': 'add9', 'm|9|0|add': 'm(add9)', '6|9|0|add': '6/9',
      'sus4|7|0|add': '7sus4', '7|4|0|add': '7sus4',
    };
    if (add[key]) suffix = add[key];
    else simplified = true;
  }
  if (simplified) w.add('Some chord symbols were simplified to the nearest chord Clef Coach knows.');
  const bass = h.bass ? move(h.bass) : undefined;
  const text = `${root.step}${accText(root.alter)}${suffix}${bass ? `/${bass.step}${accText(bass.alter)}` : ''}`;
  try {
    return chordSymbolText(parseChordSymbol(text));
  } catch {
    w.add('Some chord symbols were simplified to the nearest chord Clef Coach knows.');
    return `${root.step}${accText(root.alter)}${/minor/.test(h.kind) ? 'm' : ''}`;
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const PIANOISH = /piano|klavier|keyboard|pianoforte|\bkeys\b|clavier/i;
const RIGHT = /right|(^|\W)r\.?\s?h(\W|$)|treble|upper|rechte/i;
const LEFT = /left|(^|\W)l\.?\s?h(\W|$)|bass|lower|linke/i;

function looksLikePianoPair(a: XPart, b: XPart): boolean {
  if (a.staves !== 1 || b.staves !== 1) return false;
  if (RIGHT.test(a.name) && LEFT.test(b.name) && !RIGHT.test(b.name)) return true;
  const clefA = a.firstClefs.get(1)?.sign ?? 'G';
  const clefB = b.firstClefs.get(1)?.sign ?? 'G';
  const piano = PIANOISH.test(a.names.join(' ')) && PIANOISH.test(b.names.join(' '));
  const braced = a.braces.some(x => b.braces.includes(x));
  // unnamed parts (or ones played by a MIDI piano) joined by a brace are a grand staff too
  const pianoSound = (p: XPart) => p.program !== undefined && p.program >= 1 && p.program <= 8;
  const unnamed = !a.names.some(Boolean) && !b.names.some(Boolean);
  return clefA === 'G' && clefB === 'F' && (piano || (braced && (a.name === b.name || unnamed || (pianoSound(a) && pianoSound(b)) || PIANOISH.test(a.names.join(' ') + b.names.join(' ')))));
}

interface OutMeasure {
  time: TimeSig;
  key: KeySig;
  len: number;
  full: number;
  places: { src: number; pass: number; offset: number; len: number }[];
  partial: boolean;
}

interface LyricTag {
  lyrics: Map<number, string>;
  pass: number;
  src: number;
}

const fingerRange: Record<InstrumentId, [number, number]> = { piano: [1, 5], guitar: [0, 4], ukulele: [0, 4], bass: [0, 4], mallets: [1, 4] };

/** Convert MusicXML text into a song. Throws ImportError if the file can't be read at all. */
export function importMusicXml(xml: string, opts: MusicXmlOptions = {}): ImportResult {
  const w = new Warnings();
  let root: XmlElement;
  try {
    root = parseXml(xml);
  } catch (e) {
    throw new ImportError(`This file isn't valid XML: ${(e as Error).message}`);
  }
  if (root.name === 'score-timewise') root = timewiseToPartwise(root);
  else if (root.name === 'opus') throw new ImportError('This is a MusicXML opus (a list of scores); import one of the scores it names.');
  else if (root.name !== 'score-partwise') throw new ImportError(`This doesn't look like MusicXML (it starts with <${root.name}>).`);

  const header = readHeader(root);
  const infos = readPartList(root);
  const parts = kids(root, 'part').map(p => readPart(p, infos.get(p.attrs.id ?? ''), w));
  return buildSong({ header, parts, source: `Imported from MusicXML${header.software ? ` (${header.software})` : ''}` }, opts, w);
}

/** The instrument a part is for, from its names, its MIDI program or its strings. */
export function partInstrument(p: XPart): InstrumentId | null {
  const g = guessInstrument(p.names.length ? p.names : [p.name], p.program);
  if (g || !p.tuning?.length) return g;
  // tablature tells: four or five low strings are a bass, G C E A a ukulele
  if (Math.min(...p.tuning) < 36) return 'bass';
  if (p.tuning.length === 4 && Math.min(...p.tuning) >= 55) return 'ukulele';
  return 'guitar';
}

/**
 * Turn parts read from a score file into a song: choose the parts, write out repeats,
 * lay out the bars, place notes in voices and write the text notation. Shared by
 * MusicXML and Guitar Pro (converted to the same parts on reading).
 */
export function buildSong(read: { header: Header; parts: XPart[]; source: string; unit?: 'part' | 'track' }, opts: MusicXmlOptions, w: Warnings): ImportResult {
  const { header, parts } = read;
  const unit = read.unit ?? 'part';
  if (!parts.length || !parts.some(p => p.measures.length)) throw new ImportError('The score has no music in it.');
  const keepBand = opts.band !== false;
  // percussion plays in the band: it is never the part to learn
  const pool = keepBand ? parts.filter(p => !p.drums) : parts;
  if (!pool.length) throw new ImportError('This score only has percussion parts; Clef Coach needs pitched notes.');
  const partList: ImportPart[] = pool.map(p => ({ id: p.id, name: p.name, staves: p.staves - (p.tabStaves.size && p.tabStaves.size < p.staves ? p.tabStaves.size : 0) }));

  // ---- which parts
  let chosen: XPart[];
  if (opts.partIds?.length) {
    chosen = [...new Set(opts.partIds)].map(id => parts.find(p => p.id === id)).filter((p): p is XPart => !!p);
    const missing = opts.partIds.filter(id => !parts.some(p => p.id === id));
    if (missing.length) w.add(`Part${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not found in the file.`);
    const drums = chosen.filter(p => !pool.includes(p));
    if (drums.length) {
      chosen = chosen.filter(p => pool.includes(p));
      const what = `${quoteList(drums.map(p => p.name))} ${drums.length > 1 ? `are percussion ${unit}s` : `is a percussion ${unit}`}`;
      if (!chosen.length) throw new ImportError(`${what}; choose a ${unit} with pitched notes.`);
      w.add(`${what}, so ${drums.length > 1 ? 'they play' : 'it plays'} in the band.`);
    }
    if (!chosen.length) throw new ImportError(`None of the requested parts (${opts.partIds.join(', ')}) are in this file.`);
  } else {
    // the part with the most notes (or a right-hand / left-hand pair of piano parts), so a
    // small extra part (ornaments, a cue line) doesn't win just by coming first
    const playable = parts.filter(hasNotes);
    // a guitarist wants the guitar part of a band score, a bassist the bass part
    const forInstrument = opts.instrument && familyOf(opts.instrument) === 'fretted' ? playable.filter(p => partInstrument(p) === opts.instrument) : [];
    const list = forInstrument.length ? forInstrument : playable.length ? playable : pool;
    const candidates: XPart[][] = list.map(p => [p]);
    for (let i = 0; i + 1 < list.length; i++) if (looksLikePianoPair(list[i], list[i + 1])) candidates.push([list[i], list[i + 1]]);
    const size = (ps: XPart[]) => ps.reduce((s, p) => s + noteCount(p), 0);
    chosen = candidates.reduce((best, c) => (size(c) > size(best) * 1.0001 || (size(c) >= size(best) * 0.999 && c.length > best.length) ? c : best), candidates[0]);
    if (parts.length > chosen.length && !keepBand) {
      w.add(`Imported ${chosen.map(p => `"${p.name}"`).join(' and ')}; the file has ${plural(parts.length, 'part')} – choose others to import them instead.`);
    }
  }
  // the note about the band goes here, once the band is known
  const bandNoteAt = w.list.length;
  const pianoPair = chosen.length === 2 && looksLikePianoPair(chosen[0], chosen[1]);
  const master = chosen[0];
  const own = partInstrument(master);
  const instrument: InstrumentId = (opts.keepPartInstrument && own) || opts.instrument || own || 'piano';

  // ---- output staves and their voices
  interface OutStaff {
    part: XPart;
    staff: number;
    slots: string[];
  }
  const staves: OutStaff[] = [];
  for (const part of chosen) {
    let nums = Array.from({ length: part.staves }, (_, k) => k + 1);
    const nonTab = nums.filter(s => !part.tabStaves.has(s));
    if (nonTab.length && nonTab.length < nums.length) {
      // tablature repeats the notation staff: borrow its string numbers, then drop it
      borrowTabStrings(part);
      nums = nonTab;
    }
    const crossed = homeCrossStaffNotes(part);
    if (crossed) w.add(`${plural(crossed, 'cross-staff note')} ${crossed > 1 ? 'are' : 'is'} written on ${crossed > 1 ? 'their' : 'its'} own hand's staff (with ledger lines), so each hand practises its own notes.`);
    const withNotes = nums.filter(s => part.measures.some(m => m.groups.some(g => g.staff === s && g.notes.length)));
    for (const s of withNotes.length ? withNotes : nums.slice(0, 1)) staves.push({ part, staff: s, slots: chooseVoices(part, s, w) });
  }
  if (!staves.length) throw new ImportError('The chosen part has no staves.');

  // ---- performance order and bars
  const order = unroll(master.measures, w);
  const measureLen = (src: number) => {
    let len = 0;
    for (const p of chosen) len = Math.max(len, p.measures[src]?.len ?? 0);
    return len;
  };
  const out: OutMeasure[] = [];
  const cut: string[] = [];
  /** Nothing sounds in a placed source bar from this tick (relative to the bar) on. */
  const silentFrom = (pl: { src: number; offset: number }, from: number) =>
    chosen.every(p => (p.measures[pl.src]?.groups ?? []).every(g => !g.notes.length || pl.offset + g.end <= from + 1e-6));
  const irregular: string[] = [];
  if (!master.metered && master.measures.length > 1) w.add('The score has no time signature; each bar is written with a time signature that fits it.');
  for (const { m: src, pass } of order) {
    const sm = master.measures[src];
    let time = sm.time;
    let full = measureTicks(time);
    let len = Math.round(measureLen(src));
    if (len === 0) len = full;
    // a cadenza longer than its bar, or music with no time signature at all: the bar keeps
    // its length (and its number) under a time signature of its own
    const own = len !== full && (!master.metered || len > full + 6) ? fitTime(len, sm.time[1]) : null;
    if (own) {
      time = own;
      full = len;
      if (master.metered && !irregular.includes(sm.number)) irregular.push(sm.number);
    } else if (len > full) {
      // a few ticks over is the rounding of an odd tuplet: nothing is lost
      if (len > full + 6 && !cut.includes(sm.number)) cut.push(sm.number);
      len = full;
    }
    const lastOut = out[out.length - 1];
    // the pickup again after a repeat or D.C.: it sounds in the rests that end the bar before
    const replayedPickup = out.length > 0 && src === order[0].m && out[0].len < out[0].full && len < full;
    if (replayedPickup && lastOut && !lastOut.partial && lastOut.len === lastOut.full && lastOut.places.length === 1 && silentFrom(lastOut.places[0], lastOut.len - len)) {
      lastOut.places.push({ src, pass, offset: lastOut.len - len, len });
      continue;
    }
    if (len === full) {
      out.push({ time, key: sm.key, len: full, full, places: [{ src, pass, offset: 0, len }], partial: false });
    } else if (lastOut?.partial && lastOut.full === full && lastOut.len + len <= full) {
      // the second half of a bar split by a repeat sign
      lastOut.places.push({ src, pass, offset: lastOut.len, len });
      lastOut.len += len;
      lastOut.partial = lastOut.len < full;
    } else if (!out.length) {
      if (pickupToken(len)) out.push({ time, key: sm.key, len, full, places: [{ src, pass, offset: 0, len }], partial: false });
      else {
        w.add('The opening pickup has an unusual length; it was written as a full bar starting with rests.');
        out.push({ time, key: sm.key, len: full, full, places: [{ src, pass, offset: full - len, len }], partial: false });
      }
    } else {
      out.push({ time, key: sm.key, len, full, places: [{ src, pass, offset: 0, len }], partial: true });
    }
  }
  let hasPickup = out.length > 0 && out[0].len < out[0].full;
  const padded: string[] = [];
  const shortBars: string[] = [];
  // every staff of a bar ends together, and more than one line says so: the bar is meant
  // to be short, not missing notes
  const allEndTogether = (src: number, len: number) => {
    let lines = 0;
    const ok = chosen.every(p => {
      const ends = new Map<number, number>();
      const voices = new Set<string>();
      for (const g of p.measures[src]?.groups ?? []) {
        ends.set(g.staff, Math.max(ends.get(g.staff) ?? 0, g.end));
        voices.add(`${g.staff}/${g.voice}`);
      }
      lines += voices.size;
      return [...ends.values()].every(e => Math.abs(Math.round(e) - len) <= 1);
    });
    return ok && lines > 1;
  };
  out.forEach((m, k) => {
    // a short final bar may stay short after a pickup; any other short bar is filled with rests,
    // unless the whole bar is written short on purpose (then it gets a time signature of its own)
    if (m.len < m.full && k > 0 && !(k === out.length - 1 && hasPickup)) {
      const own = k < out.length - 1 && m.places.length === 1 && allEndTogether(m.places[0].src, m.len) ? fitTime(m.len, m.time[1]) : null;
      if (own) {
        m.time = own;
        m.full = m.len;
        const num = master.measures[m.places[0].src].number;
        if (!shortBars.includes(num)) shortBars.push(num);
        return;
      }
      for (const pl of m.places) {
        const sm = master.measures[pl.src];
        if (!sm.implicit && !padded.includes(sm.number)) padded.push(sm.number);
      }
      m.len = m.full;
    }
  });
  if (irregular.length) w.add(`${irregular.length > 1 ? 'Measures' : 'Measure'} ${listNums(irregular)} ${irregular.length > 1 ? 'are' : 'is'} longer than the time signature (a cadenza?); ${irregular.length > 1 ? 'each was' : 'it was'} given a time signature of its own.`);
  if (shortBars.length) w.add(`${shortBars.length > 1 ? 'Measures' : 'Measure'} ${listNums(shortBars)} ${shortBars.length > 1 ? 'are' : 'is'} shorter than the time signature; ${shortBars.length > 1 ? 'each was' : 'it was'} given a time signature of its own.`);
  if (cut.length) w.add(`${cut.length > 1 ? 'Measures' : 'Measure'} ${listNums(cut)} had more beats than the time signature allows; the extra notes were cut.`);
  if (padded.length) w.add(`${padded.length > 1 ? 'Measures' : 'Measure'} ${listNums(padded)} ${padded.length > 1 ? 'were' : 'was'} incomplete and filled with rests.`);
  if (opts.trimLeadingRests) {
    // a band's lead part waits out the intro: start where it starts playing
    let silent = 0;
    while (silent < out.length - 1 && out[silent].places.every(pl => silentFrom(pl, 0))) silent++;
    if (silent) {
      out.splice(0, silent);
      hasPickup = out[0].len < out[0].full;
      w.add(`${plural(silent, 'empty bar')} at the start ${silent > 1 ? 'were' : 'was'} left out.`);
    }
  }

  // ---- keys (as the app's pitches sound) and the layout
  const plans = new Map(chosen.map(p => [p, pitchPlan(p, instrument, w)]));
  const masterPlan = plans.get(master)!;
  const layout: Layout = makeLayout(out.map(m => {
    const src = master.measures[m.places[0].src];
    return { len: m.len, time: m.time, key: transposeKey(m.key, masterPlan.keyTranspose(src)) };
  }));

  // ---- timed notes per staff / voice
  const fretted = familyOf(instrument) === 'fretted';
  const tuning = fretted ? (master.tuning?.length ? master.tuning : defaultTuning(instrument)) : [];
  // the app plays in standard tuning: keep a string mark only where the note can be played on that string there
  const appTuning = fretted ? appTuningFor(instrument, master.tuning) : [];
  const retuned = fretted && !!master.tuning?.length && master.tuning.some((o, i) => appTuning[i] !== o);
  let movedStrings = 0;
  const [fLo, fHi] = fingerRange[instrument];
  const voicesNotes: TimedNote<LyricTag>[][][] = staves.map(st => st.slots.map(() => []));
  staves.forEach((st, si) => {
    const plan = plans.get(st.part)!;
    out.forEach((om, k) => {
      for (const pl of om.places) {
        const sm = st.part.measures[pl.src];
        if (!sm) continue;
        for (const g of sm.groups) {
          if (g.staff !== st.staff || !g.notes.length || g.start >= pl.len - 1e-6) continue;
          const vi = st.slots.indexOf(g.voice);
          if (vi < 0) continue;
          const start = layout.starts[k] + pl.offset + g.start;
          const end = layout.starts[k] + pl.offset + Math.min(g.end, pl.len);
          g.notes.forEach((n, ni) => {
            const pitch = plan.convert(n, g);
            let string = fretted ? n.string : undefined;
            if (fretted && string === undefined && n.fret !== undefined) {
              const s = tuning.findIndex(o => o + n.fret! === midiOf(pitch));
              if (s >= 0) string = s + 1;
            }
            if (string !== undefined && (string < 1 || string > Math.max(tuning.length, 1))) string = undefined;
            if (string !== undefined && retuned) {
              const fret = midiOf(pitch) - (appTuning[string - 1] ?? -99);
              if (fret < 0 || fret > 24) {
                string = undefined;
                movedStrings++;
              }
            }
            const finger = n.finger !== undefined && n.finger >= fLo && n.finger <= fHi ? n.finger : undefined;
            voicesNotes[si][vi].push({
              start,
              end,
              pitches: [pitch],
              fingers: finger !== undefined ? [finger] : undefined,
              strings: string !== undefined ? [string] : undefined,
              tieNext: n.tieStart,
              tag: ni === 0 ? { lyrics: g.lyrics, pass: pl.pass, src: pl.src } : undefined,
            });
          });
        }
      }
    });
  });

  if (retuned) {
    w.add(retunedWarning(`The ${instrumentDef(instrument).name.toLowerCase()} part`, master.tuning!, appTuning, movedStrings));
  }

  // major or minor, where the file doesn't say
  if (!master.modeGiven) inferModes(layout, voicesNotes.flat(2));

  // ---- chord symbols (from the chosen parts, else any part that has them)
  const harmonyPart = [...chosen, ...parts].find(p => p.measures.some(m => m.harmonies.length));
  const chordChanges: { tick: number; symbol: string | null }[] = [];
  if (harmonyPart) {
    const plan = plans.get(harmonyPart) ?? pitchPlan(harmonyPart, instrument, new Warnings());
    out.forEach((om, k) => {
      for (const pl of om.places) {
        const sm = harmonyPart.measures[pl.src];
        for (const h of sm?.harmonies ?? []) {
          if (h.tick >= pl.len - 1e-6) continue;
          chordChanges.push({ tick: layout.starts[k] + pl.offset + h.tick, symbol: harmonySymbol(h, plan.keyTranspose(sm), w) });
        }
      }
    });
  }

  // ---- quantise everything onto a grid the notation can write
  const all = voicesNotes.flat(2);
  const q = makeQuantizer(layout, [...all.flatMap(n => [{ t: n.start, w: 1 }, { t: n.end, w: 1 }]), ...chordChanges.map(c => ({ t: c.tick, w: 1 }))], { binary: 3, triplet: 8 });
  let moved = 0;
  const snap = (t: number) => {
    const s = q.snap(t);
    if (Math.abs(s - t) > 0.01) moved++;
    return s;
  };
  let spread = 0;
  for (const voice of voicesNotes.flat()) spread += snapVoice(voice, snap, 3, layoutEnd(layout));
  for (const c of chordChanges) c.tick = snap(c.tick);
  if (spread) w.add(`${plural(spread, 'note')} in very fast runs ${spread > 1 ? 'were' : 'was'} spaced out evenly so that every note is kept.`);
  const oddTuplets = chosen.reduce((s, p) => s + p.counts.oddTuplets, 0);
  if (oddTuplets) w.add(`${plural(oddTuplets, 'note')} in tuplets other than triplets ${oddTuplets > 1 ? 'were' : 'was'} rounded to the nearest rhythm Clef Coach can write.`);
  else if (moved) w.add('Some very short notes or unusual rhythms were rounded to the nearest value Clef Coach can write.');

  // ---- write the voices
  let shortened = 0;
  let dropped = 0;
  let brokenTies = 0;
  let lyricAttacks: (LyricTag | undefined)[] = [];
  const staffClefs = staves.map((st, si) => clefPlan(st, out, layout, instrument, voicesNotes[si].flat().map(n => midiOf(n.pitches[0])), snap, w));
  const staffDefs: SongStaffDef[] = staves.map((st, si) => {
    const voices = st.slots.map((_, vi) => {
      const built = buildVoice(voicesNotes[si][vi], layout);
      shortened += built.shortened;
      dropped += built.dropped;
      brokenTies += built.brokenTies;
      if (si === 0 && vi === 0) lyricAttacks = built.attacks;
      return writeVoice(built.specs, layout, undefined, vi === 0 ? staffClefs[si].changes : undefined);
    });
    return { clef: staffClefs[si].clef, voices, name: chosen.length > 1 && !pianoPair ? st.part.name : undefined };
  });
  if (shortened) w.add(`${plural(shortened, 'note')} overlapping the next note in the same voice ${shortened > 1 ? 'were' : 'was'} shortened.`);
  if (dropped) w.add(`${plural(dropped, 'note')} with no room left ${dropped > 1 ? 'were' : 'was'} dropped.`);
  if (brokenTies) w.add(`${plural(brokenTies, 'tie')} leading into another voice ${brokenTies > 1 ? 'were' : 'was'} left out (the note is played again).`);

  // ---- the parts not chosen play as the band
  const others = keepBand ? parts.filter(p => !chosen.includes(p)) : [];
  const band = limitBand(others.map(p => bandPart(p, out, layout)), w, unit);
  if (band.length) w.list.splice(bandNoteAt, 0, bandNote(chosen.map(p => `"${p.name}"`).join(' and '), band.map(p => p.name), unit));

  // hands: piano grand staff R over L; a single piano staff by its clef
  if ((instrument === 'piano' || instrument === 'mallets') && staffDefs.length === 2) {
    staffDefs[0].hand = 'R';
    staffDefs[1].hand = 'L';
  } else if (instrument === 'piano' && staffDefs.length === 1) {
    staffDefs[0].hand = staffDefs[0].clef === 'bass' ? 'L' : 'R';
  }

  // ---- part-level warnings
  const counts = chosen.reduce((s, p) => ({ grace: s.grace + p.counts.grace, unpitched: s.unpitched + p.counts.unpitched, microtones: s.microtones + p.counts.microtones }), { grace: 0, unpitched: 0, microtones: 0 });
  // percussion notes in a part that also has pitched notes don't make a drum part of their own
  for (const p of others) if (!p.drums) counts.unpitched += p.counts.unpitched;
  if (counts.grace) w.add(`${plural(counts.grace, 'grace note')} ${counts.grace > 1 ? 'were' : 'was'} left out.`);
  if (counts.unpitched) w.add(`${plural(counts.unpitched, 'percussion note')} without a pitch ${counts.unpitched > 1 ? 'were' : 'was'} left out.`);
  if (counts.microtones) w.add('Microtonal accidentals were rounded to the nearest semitone.');
  const tempos = order.map(o => master.measures[o.m].tempo ?? parts.map(p => p.measures[o.m]?.tempo).find(t => t !== undefined)).filter((t): t is number => t !== undefined);
  if (new Set(tempos.map(t => Math.round(t))).size > 1) w.add('Tempo changes were left out; the song uses the opening tempo.');

  // ---- lyrics
  const lyrics = buildLyrics(lyricAttacks, order);
  if (lyrics.warning) w.add(lyrics.warning);

  const title = header.title || opts.title?.trim() || 'Untitled';
  const song: SongDef = {
    id: newSongId(title),
    title,
    composer: header.composer,
    arranger: header.arranger,
    license: header.rights,
    source: read.source,
    blurb: header.lyricist ? `Words by ${header.lyricist}.` : undefined,
    instrument,
    level: 3,
    key: keyName(layout.keys[0]),
    time: layout.times[0],
    tempo: cleanTempo(tempos[0], 80),
    pickup: hasPickup ? pickupToken(layout.lens[0]) ?? undefined : undefined,
    staves: staffDefs,
    chords: writeChordLine(chordChanges, layout),
    lyrics: lyrics.lines.length ? lyrics.lines : undefined,
  };
  if (band.length) song.band = band;
  return { song, warnings: w.list, parts: partList };
}

/** Run through a part's notes as the performance places them: each group with its start on the song's timeline. */
function eachPlaced(part: XPart, out: OutMeasure[], layout: Layout, fn: (g: XGroup, start: number, end: number) => void): void {
  out.forEach((om, k) => {
    for (const pl of om.places) {
      for (const g of part.measures[pl.src]?.groups ?? []) {
        if (g.start >= pl.len - 1e-6) continue;
        const at = layout.starts[k] + pl.offset;
        fn(g, at + g.start, at + Math.min(g.end, pl.len));
      }
    }
  });
}

/**
 * A part not chosen, as a band part: through the same performance order, bars and pitch
 * conversion (sounding pitch) as the chosen part, but quantised on a grid of its own so
 * the chosen part is written exactly as it would be alone. A percussion part becomes a
 * drum part written with drum names. Returns the part and how many notes it has.
 */
function bandPart(part: XPart, out: OutMeasure[], layout: Layout): { part: BandPartDef; notes: number } {
  const quiet = new Warnings(); // warnings are about the part being learned
  const end = layoutEnd(layout);
  const grid = (points: number[]) => makeQuantizer(layout, points.map(t => ({ t, w: 1 })), { binary: 3, triplet: 8 });
  if (part.drums) {
    const hits: { start: number; key: number }[] = [];
    eachPlaced(part, out, layout, (g, start) => {
      for (const key of g.drums ?? []) hits.push({ start, key });
    });
    const q = grid(hits.map(h => h.start));
    const voice = buildVoice(drumVoice(hits.map(h => ({ start: q.snap(h.start), key: h.key })), layout), layout);
    return { part: { name: part.name, program: clampProgram(part.program ?? 1), drums: true, staves: [{ clef: 'bass', voices: [pitchesToDrumWords(writeVoice(voice.specs, layout))] }] }, notes: hits.length };
  }
  // the instrument only decides how written notes sound (an octave down for guitar and bass)
  const own = partInstrument(part);
  const instrument: InstrumentId = own && familyOf(own) === 'fretted' ? own : 'piano';
  let nums = Array.from({ length: part.staves }, (_, k) => k + 1);
  const nonTab = nums.filter(s => !part.tabStaves.has(s));
  if (nonTab.length && nonTab.length < nums.length) {
    borrowTabStrings(part);
    nums = nonTab;
  }
  homeCrossStaffNotes(part);
  const staves = nums.filter(s => part.measures.some(m => m.groups.some(g => g.staff === s && g.notes.length))).map(s => ({ part, staff: s, slots: chooseVoices(part, s, quiet) }));
  const plan = pitchPlan(part, instrument, quiet);
  const notes: TimedNote[][][] = staves.map(st => st.slots.map(() => []));
  eachPlaced(part, out, layout, (g, start, stop) => {
    const si = staves.findIndex(st => st.staff === g.staff);
    const vi = si < 0 ? -1 : staves[si].slots.indexOf(g.voice);
    if (vi < 0) return;
    for (const n of g.notes) notes[si][vi].push({ start, end: stop, pitches: [plan.convert(n, g)], tieNext: n.tieStart });
  });
  const all = notes.flat(2);
  const q = grid(all.flatMap(n => [n.start, n.end]));
  const snap = (t: number) => q.snap(t);
  for (const voice of notes.flat()) snapVoice(voice, snap, 3, end);
  const program = clampProgram(part.program ?? programFromName(part.names.length ? part.names : [part.name]));
  const staffDefs = staves.map((st, si) => {
    const clefs = clefPlan(st, out, layout, instrument, notes[si].flat().map(n => midiOf(n.pitches[0])), snap, quiet);
    const voices = st.slots.map((_, vi) => writeVoice(buildVoice(notes[si][vi], layout).specs, layout, undefined, vi === 0 ? clefs.changes : undefined));
    return { clef: clefs.clef, voices };
  });
  return { part: { name: part.name, program, staves: staffDefs }, notes: all.length };
}

/** A time signature that holds exactly this many ticks (n/4, n/8, n/16 or n/32, `prefer` first), if any does. */
function fitTime(len: number, prefer?: number): TimeSig | null {
  for (const den of [...(prefer && prefer >= 4 ? [prefer] : []), 4, 8, 16, 32]) {
    const unit = measureTicks([1, den]);
    if (len % unit === 0 && len / unit <= MAX_BEATS) return [len / unit, den];
  }
  return null;
}

/** "3, 5 and 8". */
function listNums(xs: string[]): string {
  const shown = xs.slice(0, 6);
  const more = xs.length > shown.length ? ` and ${xs.length - shown.length} more` : '';
  return shown.length > 1 && !more ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown.join(', ') + more;
}

/**
 * Put cross-staff notes back on their own voice's staff. A voice that dips onto the
 * other staff of a grand staff (a right-hand arpeggio drawn in the bass clef) is still
 * one line played by one hand: within a measure its notes and rests follow one another
 * without overlapping. A voice number used for two lines at once (some programs number
 * each staff's voices from 1) overlaps itself in time and is left alone.
 * Returns the number of notes moved.
 */
function homeCrossStaffNotes(part: XPart): number {
  if (part.staves < 2) return 0;
  const onStaff = (g: XGroup) => !part.tabStaves.has(g.staff);
  // a voice's own staff: where it spends most of its time
  const time = new Map<string, Map<number, number>>();
  for (const m of part.measures) for (const g of m.groups) {
    if (!onStaff(g)) continue;
    let t = time.get(g.voice);
    if (!t) time.set(g.voice, (t = new Map()));
    t.set(g.staff, (t.get(g.staff) ?? 0) + Math.max(g.end - g.start, 1));
  }
  const home = new Map([...time].map(([v, t]) => [v, [...t].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]]));
  let moved = 0;
  for (const m of part.measures) {
    const byVoice = new Map<string, XGroup[]>();
    for (const g of m.groups) if (onStaff(g)) byVoice.set(g.voice, [...(byVoice.get(g.voice) ?? []), g]);
    for (const [v, gs] of byVoice) {
      const h = home.get(v)!;
      const away = gs.filter(g => g.staff !== h);
      if (!away.length) continue;
      const here = gs.filter(g => g.staff === h);
      if (away.some(a => here.some(b => a.start < b.end - 1e-6 && b.start < a.end - 1e-6))) continue;
      for (const g of away) {
        g.staff = h;
        moved += g.notes.length;
      }
    }
  }
  return moved;
}

/**
 * Order two voices of a staff upper first (the app draws its first voice stems up):
 * by the stems the file gives them where they sound together, else by pitch.
 */
function upperFirst(part: XPart, staff: number, voices: string[]): string[] {
  if (voices.length < 2) return voices;
  const stats = new Map(voices.map(v => [v, { stem: 0, stems: 0, pitch: 0, notes: 0 }]));
  for (const m of part.measures) {
    const gs = m.groups.filter(g => g.staff === staff && g.notes.length && stats.has(g.voice));
    if (voices.some(v => !gs.some(g => g.voice === v))) continue;
    for (const g of gs) {
      const s = stats.get(g.voice)!;
      if (g.stem) {
        s.stem += g.stem;
        s.stems++;
      }
      for (const n of g.notes) {
        s.pitch += midiOf(n.written);
        s.notes++;
      }
    }
  }
  const lean = (v: string) => {
    const s = stats.get(v)!;
    return s.stems ? s.stem / s.stems : 0;
  };
  const height = (v: string) => {
    const s = stats.get(v)!;
    return s.notes ? s.pitch / s.notes : 0;
  };
  const [a, b] = voices;
  const byStem = lean(a) - lean(b);
  if (Math.abs(byStem) >= 0.5) return byStem > 0 ? [a, b] : [b, a];
  return height(b) > height(a) + 1e-6 ? [b, a] : [a, b];
}

/** Pick the (up to) two voices a staff keeps; merge the others into chords where they line up, drop the rest. */
function chooseVoices(part: XPart, staff: number, w: Warnings): string[] {
  const counts = new Map<string, number>();
  for (const m of part.measures) for (const g of m.groups) if (g.staff === staff && g.notes.length) counts.set(g.voice, (counts.get(g.voice) ?? 0) + g.notes.length);
  const byVoice = (a: string, b: string) => num(a, 99) - num(b, 99) || a.localeCompare(b);
  // the two busiest voices (lower voice numbers first on a tie), the upper one first
  const keep = upperFirst(part, staff, [...counts].sort((a, b) => b[1] - a[1] || byVoice(a[0], b[0])).slice(0, 2).map(([v]) => v).sort(byVoice));
  if (!keep.length) return ['1'];
  let merged = 0;
  let dropped = 0;
  const avg = (g: XGroup) => g.notes.reduce((s, n) => s + midiOf(n.written), 0) / g.notes.length;
  for (const m of part.measures) {
    for (const g of m.groups) {
      if (g.staff !== staff || !g.notes.length || keep.includes(g.voice)) continue;
      const kept = m.groups.filter(h => h.staff === staff && keep.includes(h.voice) && h.notes.length);
      const nearest = (a: XGroup, b: XGroup) => Math.abs(avg(a) - avg(g)) - Math.abs(avg(b) - avg(g));
      // 1. join the kept voice nearest in pitch that has a note with the same start and length
      const same = kept.filter(h => Math.abs(h.start - g.start) < 1e-6 && Math.abs(h.end - g.end) < 1e-6).sort(nearest)[0];
      // 2. or move into a kept voice that is silent all the while (nothing changes but the stems)
      const free = keep.filter(v => !kept.some(h => h.voice === v && h.start < g.end - 1e-6 && g.start < h.end - 1e-6));
      if (!same && free.length) {
        const others = kept.flatMap(h => h.notes.map(n => midiOf(n.written)));
        const above = !others.length || avg(g) >= others.reduce((s, x) => s + x, 0) / others.length;
        g.voice = free.length === 1 ? free[0] : above ? keep[0] : keep[keep.length - 1];
        continue;
      }
      // 3. or join a chord that starts with it (the note takes that chord's length)
      const target = same ?? kept.filter(h => Math.abs(h.start - g.start) < 1e-6).sort(nearest)[0];
      if (target) {
        joinGroup(target, g);
        merged += g.notes.length;
      } else dropped += g.notes.length;
      g.notes = [];
    }
  }
  if (merged || dropped) {
    const parts = [merged ? `${plural(merged, 'note')} merged into chords` : '', dropped ? `${plural(dropped, 'note')} dropped` : ''].filter(Boolean).join(' and ');
    w.add(`A staff has more than two voices; the extra voices were simplified (${parts}).`);
  }
  // a second voice that only ever doubles the first in rhythm (octaves, a hymn's alto) reads better as chords
  if (keep.length === 2) {
    for (const [into, from] of [keep, [keep[1], keep[0]]]) {
      const pairs: [XGroup, XGroup][] = [];
      const lined = part.measures.every(m =>
        m.groups.every(g => {
          if (g.staff !== staff || g.voice !== from || !g.notes.length) return true;
          const t = m.groups.find(h => h.staff === staff && h.voice === into && h.notes.length && Math.abs(h.start - g.start) < 1e-6 && Math.abs(h.end - g.end) < 1e-6);
          if (t) pairs.push([t, g]);
          return !!t;
        }),
      );
      if (lined) {
        for (const [t, g] of pairs) {
          joinGroup(t, g);
          g.notes = [];
        }
        return [into];
      }
    }
  }
  return keep;
}

/** Add another voice's notes (and any lyrics the target lacks) to a group, making a chord. */
function joinGroup(target: XGroup, g: XGroup): void {
  target.notes.push(...g.notes);
  for (const [v, s] of g.lyrics) if (!target.lyrics.has(v)) target.lyrics.set(v, s);
}

/** Copy string / fret numbers from a tablature staff onto the matching notes of the notation staff. */
function borrowTabStrings(part: XPart): void {
  for (const m of part.measures) {
    const tab = m.groups.filter(g => part.tabStaves.has(g.staff));
    for (const g of m.groups) {
      if (part.tabStaves.has(g.staff)) continue;
      for (const n of g.notes) {
        if (n.string !== undefined) continue;
        const t = tab.find(h => Math.abs(h.start - g.start) < 1e-6)?.notes.find(x => midiOf(x.written) === midiOf(n.written) && x.string !== undefined);
        if (t) {
          n.string = t.string;
          n.fret ??= t.fret;
        }
      }
    }
  }
}

/**
 * A staff's clefs along the performance: the opening clef and every change (at the
 * tick it takes effect, repeats written out). Tablature and percussion clefs are skipped.
 */
function clefPlan(
  st: { part: XPart; staff: number },
  out: OutMeasure[],
  layout: Layout,
  instrument: InstrumentId,
  midis: number[],
  snap: (t: number) => number,
  w: Warnings,
): { clef: Clef; changes: { tick: number; clef: Clef }[] } {
  let clef: Clef | null = null;
  const changes: { tick: number; clef: Clef }[] = [];
  out.forEach((om, k) => {
    for (const pl of om.places) {
      const sm = st.part.measures[pl.src];
      if (!sm) continue;
      const begin = layout.starts[k] + pl.offset;
      const events = [{ tick: 0, info: sm.clefStart.get(st.staff) }, ...sm.clefs.filter(c => c.staff === st.staff).map(c => ({ tick: c.tick, info: c.clef }))];
      for (const e of events) {
        if (!e.info || !['G', 'F', 'C'].includes(e.info.sign) || e.tick > pl.len + 1e-6) continue;
        const c = appClef(instrument, e.info, midis, w);
        if (clef === null) clef = c;
        else if (c !== (changes[changes.length - 1]?.clef ?? clef)) {
          const tick = snap(begin + e.tick);
          // two changes at one moment: the later one wins
          if (changes.length && changes[changes.length - 1].tick === tick) changes.pop();
          if (c !== (changes[changes.length - 1]?.clef ?? clef)) changes.push({ tick, clef: c });
        }
      }
    }
  });
  return { clef: clef ?? appClef(instrument, st.part.firstClefs.get(st.staff), midis, w), changes: changes.filter(c => c.tick > 0) };
}

function appClef(instrument: InstrumentId, clef: ClefInfo | undefined, midis: number[], w: Warnings): Clef {
  const sign = clef?.sign ?? '';
  if (instrument === 'guitar') return sign === 'F' ? 'bass' : 'treble8vb';
  if (instrument === 'bass') return 'bass8vb';
  if (instrument === 'ukulele') return 'treble';
  if (sign === 'G') return 'treble';
  if (sign === 'F') return 'bass';
  if (sign === 'C') w.add('A C clef (alto / tenor) was replaced by the treble or bass clef that suits the notes.');
  return median(midis) >= 60 ? 'treble' : 'bass';
}

/**
 * One lyric line per verse, aligned with the melody's attacks. When verses 2+ only
 * appear under repeats, the passes are sung in turn (verse 1, then verse 2 on the
 * second time through) as one line.
 */
function buildLyrics(attacks: (LyricTag | undefined)[], order: Pass[]): { lines: string[]; warning?: string } {
  const verses = [...new Set(attacks.flatMap(t => (t ? [...t.lyrics.keys()] : [])))].sort((a, b) => a - b);
  if (!verses.length) return { lines: [] };
  const plays = new Map<number, number>();
  for (const o of order) plays.set(o.m, (plays.get(o.m) ?? 0) + 1);
  const laterVersesOnlyInRepeats = verses.length > 1 && attacks.every(t => !t || [...t.lyrics.keys()].every(v => v === verses[0] || (plays.get(t.src) ?? 1) > 1));
  const trim = (sylls: string[]) => {
    while (sylls.length && sylls[sylls.length - 1] === '_') sylls.pop();
    return sylls.join(' ');
  };
  if (laterVersesOnlyInRepeats && order.some(o => o.pass > 1)) {
    const line = trim(attacks.map(t => (t ? t.lyrics.get(verses[t.pass - 1] ?? -1) ?? t.lyrics.get(verses[0]) ?? '_' : '_')));
    return { lines: line ? [line] : [] };
  }
  const lines = verses.map(v => trim(attacks.map(t => t?.lyrics.get(v) ?? '_'))).filter(Boolean);
  return { lines, warning: order.some(o => o.pass > 1) && lines.length > 1 ? 'Each lyric verse follows the whole song with its repeats written out.' : undefined };
}

// ---------------------------------------------------------------------------
// Compressed MusicXML (.mxl)
// ---------------------------------------------------------------------------

/** Find every element with this name, depth first. */
function findAll(el: XmlElement, name: string, out: XmlElement[] = []): XmlElement[] {
  if (el.name === name) out.push(el);
  for (const c of el.children) findAll(c, name, out);
  return out;
}

/**
 * Import a compressed MusicXML file (.mxl, a ZIP archive). The score is the root file
 * named in META-INF/container.xml. Uncompressed MusicXML bytes are accepted too.
 */
export async function importMxl(bytes: Uint8Array, opts: MusicXmlOptions = {}): Promise<ImportResult> {
  if (!isZip(bytes)) return importMusicXml(decodeXmlBytes(bytes), opts);
  let xml: string;
  try {
    const entries = listZip(bytes);
    let rootPath: string | undefined;
    const container = entries.find(e => e.name === 'META-INF/container.xml');
    if (container) {
      const doc = parseXml(decodeXmlBytes(await readZipEntry(bytes, container)));
      const rootfiles = findAll(doc, 'rootfile');
      const score = rootfiles.find(r => !r.attrs['media-type'] || /musicxml/.test(r.attrs['media-type'])) ?? rootfiles[0];
      rootPath = score?.attrs['full-path'];
    }
    const entry = entries.find(e => e.name === rootPath) ?? entries.find(e => /\.(musicxml|xml)$/i.test(e.name) && !e.name.startsWith('META-INF/'));
    if (!entry) throw new ImportError('No MusicXML score was found inside this .mxl file.');
    xml = decodeXmlBytes(await readZipEntry(bytes, entry));
  } catch (e) {
    // a damaged archive (or one this platform can't inflate) is still just a file we can't import
    throw e instanceof ImportError ? e : new ImportError(`This .mxl file can't be opened: ${(e as Error).message}`);
  }
  return importMusicXml(xml, opts);
}
