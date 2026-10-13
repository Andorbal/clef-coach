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
 *   - fingering, string and fret, chord symbols and lyrics.
 *
 * Whatever is simplified or dropped is listed in `warnings`. Pure TypeScript: runs in
 * the browser and in Node.
 */
import { chordSymbolText, parseChordSymbol } from '../music/chords';
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
  buildVoice,
  cleanTempo,
  guessInstrument,
  makeLayout,
  makeQuantizer,
  median,
  pickupToken,
  plural,
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
}

// ---------------------------------------------------------------------------
// What we read from the file
// ---------------------------------------------------------------------------

interface ClefInfo {
  sign: string;
  line: number;
  /** clef-octave-change: -1 for the guitar's treble-8vb clef. */
  octave: number;
}

interface Transpose {
  chromatic: number;
  diatonic: number;
  octave: number;
}

/** One written note head. */
interface XNote {
  written: Pitch;
  tieStart: boolean;
  finger?: number;
  string?: number;
  fret?: number;
}

/** A note, chord or rest in one voice of one staff. */
interface XGroup {
  staff: number;
  voice: string;
  /** Ticks from the start of the measure. */
  start: number;
  end: number;
  notes: XNote[];
  lyrics: Map<number, string>;
  transpose: Transpose | null;
  clef: ClefInfo | undefined;
}

interface XHarmony {
  tick: number;
  root: { step: Step; alter: number } | null;
  kind: string;
  kindText: string;
  bass?: { step: Step; alter: number };
  degrees: { value: number; alter: number; type: string }[];
}

interface XMeasure {
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

interface XPart {
  id: string;
  name: string;
  names: string[];
  program?: number;
  braces: number[];
  staves: number;
  measures: XMeasure[];
  firstClefs: Map<number, ClefInfo>;
  clefChanges: Set<number>;
  tabStaves: Set<number>;
  /** Open strings from <staff-details> (MIDI, string 1 first). */
  tuning?: number[];
  counts: { grace: number; unpitched: number; microtones: number; oddTuplets: number };
}

const TYPE_DUR: Record<string, BaseDuration> = { whole: 'w', half: 'h', quarter: 'q', eighth: 'e', '16th': 's', '32nd': 't' };
const VALID_DEN = [1, 2, 4, 8, 16, 32];

const num = (s: string | undefined, fallback = 0) => {
  const n = Number(s);
  return s !== undefined && s.trim() !== '' && Number.isFinite(n) ? n : fallback;
};

const flatText = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Header and part list
// ---------------------------------------------------------------------------

interface Header {
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
  return {
    title,
    composer: creator('composer') || credits.get('composer') || '',
    arranger: creator('arranger') || credits.get('arranger') || undefined,
    lyricist: creator('lyricist') || creator('poet') || credits.get('lyricist') || undefined,
    rights: flatText(kids(ident, 'rights').map(textOf).join(' ')) || credits.get('rights') || undefined,
    software: flatText(kids(path(ident, 'encoding'), 'software').map(textOf).join(', ')) || undefined,
  };
}

interface PartInfo {
  name: string;
  names: string[];
  program?: number;
  braces: number[];
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
      out.set(el.attrs.id ?? '', { name: name || names[0] || '', names, program, braces: [...open.values()] });
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
    w.add('Unmetered music (senza misura) was written in 4/4.');
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
  if (!Number.isInteger(n) || n < 1 || n > 32 || !VALID_DEN.includes(den)) {
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

const sameClef = (a: ClefInfo, b: ClefInfo) => a.sign === b.sign && a.octave === b.octave && (a.line === b.line || !a.line || !b.line);

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

function emptyMeasure(number: string, implicit: boolean, time: TimeSig, key: KeySig, transpose: Transpose | null): XMeasure {
  return {
    number, implicit, len: 0, time, key, transpose, groups: [], harmonies: [],
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
    clefChanges: new Set(),
    tabStaves: new Set(),
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
          if (nk) {
            key = nk;
            if (!started) m.key = nk;
          }
          const t = child(c, 'time');
          const nt = t ? readTime(t, w) : null;
          if (nt) {
            time = nt;
            if (!started) m.time = nt;
          }
          part.staves = Math.max(part.staves, childNumber(c, 'staves') ?? 1);
          for (const cl of kids(c, 'clef')) {
            const n = num(cl.attrs.number, 1);
            const ci = readClef(cl);
            const first = part.firstClefs.get(n);
            if (!first) part.firstClefs.set(n, ci);
            else if (!sameClef(first, ci)) part.clefChanges.add(n);
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
          if (child(c, 'unpitched')) part.counts.unpitched++;
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
            readLyrics(c, lyricLabels, last.lyrics);
            break;
          }
          const g: XGroup = { staff, voice, start, end: start + len, notes: note ? [note] : [], lyrics: new Map(), transpose: transposeFor(staff), clef: clefs.get(staff) };
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
  return part;
}

const hasNotes = (p: XPart) => p.measures.some(m => m.groups.some(g => g.notes.length));

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
    if (best && best[0] % 12 === 0 && best[1] >= Math.max(2, total * 0.6)) {
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
  return clefA === 'G' && clefB === 'F' && (piano || (braced && (piano || a.name === b.name || PIANOISH.test(a.names.join(' ') + b.names.join(' ')))));
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
  if (!parts.length || !parts.some(p => p.measures.length)) throw new ImportError('The score has no music in it.');
  const partList: ImportPart[] = parts.map(p => ({ id: p.id, name: p.name, staves: p.staves - (p.tabStaves.size && p.tabStaves.size < p.staves ? p.tabStaves.size : 0) }));

  // ---- which parts
  let chosen: XPart[];
  if (opts.partIds?.length) {
    chosen = [...new Set(opts.partIds)].map(id => parts.find(p => p.id === id)).filter((p): p is XPart => !!p);
    const missing = opts.partIds.filter(id => !parts.some(p => p.id === id));
    if (missing.length) w.add(`Part${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not found in the file.`);
    if (!chosen.length) throw new ImportError(`None of the requested parts (${opts.partIds.join(', ')}) are in this file.`);
  } else {
    const playable = parts.filter(hasNotes);
    const list = playable.length ? playable : parts;
    chosen = list[1] && looksLikePianoPair(list[0], list[1]) ? [list[0], list[1]] : [list[0]];
    if (parts.length > chosen.length) {
      w.add(`Imported ${chosen.map(p => `"${p.name}"`).join(' and ')}; the file has ${plural(parts.length, 'part')} – choose others to import them instead.`);
    }
  }
  const pianoPair = chosen.length === 2 && looksLikePianoPair(chosen[0], chosen[1]);
  const master = chosen[0];
  const instrument: InstrumentId = opts.instrument ?? guessInstrument(master.names.length ? master.names : [master.name], master.program) ?? 'piano';

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
  for (const { m: src, pass } of order) {
    const sm = master.measures[src];
    const full = measureTicks(sm.time);
    let len = Math.round(measureLen(src));
    if (len === 0) len = full;
    if (len > full) {
      if (!cut.includes(sm.number)) cut.push(sm.number);
      len = full;
    }
    const lastOut = out[out.length - 1];
    if (len === full) {
      out.push({ time: sm.time, key: sm.key, len: full, full, places: [{ src, pass, offset: 0, len }], partial: false });
    } else if (lastOut?.partial && lastOut.full === full && lastOut.len + len <= full) {
      // the second half of a bar split by a repeat sign
      lastOut.places.push({ src, pass, offset: lastOut.len, len });
      lastOut.len += len;
      lastOut.partial = lastOut.len < full;
    } else if (!out.length) {
      if (pickupToken(len)) out.push({ time: sm.time, key: sm.key, len, full, places: [{ src, pass, offset: 0, len }], partial: false });
      else {
        w.add('The opening pickup has an unusual length; it was written as a full bar starting with rests.');
        out.push({ time: sm.time, key: sm.key, len: full, full, places: [{ src, pass, offset: full - len, len }], partial: false });
      }
    } else {
      out.push({ time: sm.time, key: sm.key, len, full, places: [{ src, pass, offset: 0, len }], partial: true });
    }
  }
  const hasPickup = out.length > 0 && out[0].len < out[0].full;
  const padded: string[] = [];
  out.forEach((m, k) => {
    // a short final bar may stay short after a pickup; any other short bar is filled with rests
    if (m.len < m.full && k > 0 && !(k === out.length - 1 && hasPickup)) {
      for (const pl of m.places) {
        const sm = master.measures[pl.src];
        if (!sm.implicit && !padded.includes(sm.number)) padded.push(sm.number);
      }
      m.len = m.full;
    }
  });
  if (cut.length) w.add(`${cut.length > 1 ? 'Measures' : 'Measure'} ${listNums(cut)} had more beats than the time signature allows; the extra notes were cut.`);
  if (padded.length) w.add(`${padded.length > 1 ? 'Measures' : 'Measure'} ${listNums(padded)} ${padded.length > 1 ? 'were' : 'was'} incomplete and filled with rests.`);

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
  const q = makeQuantizer(layout, [...all.flatMap(n => [{ t: n.start, w: 1 }, { t: n.end, w: 1 }]), ...chordChanges.map(c => ({ t: c.tick, w: 1 }))], { binary: 6, triplet: 8 });
  let moved = 0;
  const snap = (t: number) => {
    const s = q.snap(t);
    if (Math.abs(s - t) > 0.01) moved++;
    return s;
  };
  for (const n of all) {
    n.start = snap(n.start);
    n.end = snap(n.end);
  }
  for (const c of chordChanges) c.tick = snap(c.tick);
  const oddTuplets = chosen.reduce((s, p) => s + p.counts.oddTuplets, 0);
  if (oddTuplets) w.add(`${plural(oddTuplets, 'note')} in tuplets other than triplets ${oddTuplets > 1 ? 'were' : 'was'} rounded to the nearest rhythm Clef Coach can write.`);
  else if (moved) w.add('Some very short notes or unusual rhythms were rounded to the nearest value Clef Coach can write.');

  // ---- write the voices
  let shortened = 0;
  let dropped = 0;
  let brokenTies = 0;
  let lyricAttacks: (LyricTag | undefined)[] = [];
  const staffDefs: SongStaffDef[] = staves.map((st, si) => {
    const voices = st.slots.map((_, vi) => {
      const built = buildVoice(voicesNotes[si][vi], layout);
      shortened += built.shortened;
      dropped += built.dropped;
      brokenTies += built.brokenTies;
      if (si === 0 && vi === 0) lyricAttacks = built.attacks;
      return writeVoice(built.specs, layout);
    });
    const midis = voicesNotes[si].flat().map(n => midiOf(n.pitches[0]));
    const clef = appClef(instrument, st.part.firstClefs.get(st.staff), midis, w);
    if (st.part.clefChanges.has(st.staff)) w.add(`A staff changes clef during the piece; Clef Coach keeps its first clef (${clef.replace('8vb', ' 8vb')}).`);
    return { clef, voices, name: chosen.length > 1 && !pianoPair ? st.part.name : undefined };
  });
  if (shortened) w.add(`${plural(shortened, 'note')} overlapping the next note in the same voice ${shortened > 1 ? 'were' : 'was'} shortened.`);
  if (dropped) w.add(`${plural(dropped, 'note')} with no room left ${dropped > 1 ? 'were' : 'was'} dropped.`);
  if (brokenTies) w.add(`${plural(brokenTies, 'tie')} between chords that change ${brokenTies > 1 ? 'were' : 'was'} left out (the note is played again).`);

  // hands: piano grand staff R over L; a single piano staff by its clef
  if ((instrument === 'piano' || instrument === 'mallets') && staffDefs.length === 2) {
    staffDefs[0].hand = 'R';
    staffDefs[1].hand = 'L';
  } else if (instrument === 'piano' && staffDefs.length === 1) {
    staffDefs[0].hand = staffDefs[0].clef === 'bass' ? 'L' : 'R';
  }

  // ---- part-level warnings
  const counts = chosen.reduce((s, p) => ({ grace: s.grace + p.counts.grace, unpitched: s.unpitched + p.counts.unpitched, microtones: s.microtones + p.counts.microtones }), { grace: 0, unpitched: 0, microtones: 0 });
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
    source: `Imported from MusicXML${header.software ? ` (${header.software})` : ''}`,
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
  return { song, warnings: w.list, parts: partList };
}

/** "3, 5 and 8". */
function listNums(xs: string[]): string {
  const shown = xs.slice(0, 6);
  const more = xs.length > shown.length ? ` and ${xs.length - shown.length} more` : '';
  return shown.length > 1 && !more ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown.join(', ') + more;
}

/** Pick the (up to) two voices a staff keeps; merge the others into chords where they line up, drop the rest. */
function chooseVoices(part: XPart, staff: number, w: Warnings): string[] {
  const counts = new Map<string, number>();
  for (const m of part.measures) for (const g of m.groups) if (g.staff === staff && g.notes.length) counts.set(g.voice, (counts.get(g.voice) ?? 0) + g.notes.length);
  const byVoice = (a: string, b: string) => num(a, 99) - num(b, 99) || a.localeCompare(b);
  // the two busiest voices (lower voice numbers first on a tie)
  const keep = [...counts].sort((a, b) => b[1] - a[1] || byVoice(a[0], b[0])).slice(0, 2).map(([v]) => v).sort(byVoice);
  if (!keep.length) return ['1'];
  let merged = 0;
  let dropped = 0;
  const avg = (g: XGroup) => g.notes.reduce((s, n) => s + midiOf(n.written), 0) / g.notes.length;
  for (const m of part.measures) {
    for (const g of m.groups) {
      if (g.staff !== staff || !g.notes.length || keep.includes(g.voice)) continue;
      // join the kept voice nearest in pitch that has a note with the same start and length
      const target = m.groups
        .filter(h => h.staff === staff && keep.includes(h.voice) && h.notes.length && Math.abs(h.start - g.start) < 1e-6 && Math.abs(h.end - g.end) < 1e-6)
        .sort((a, b) => Math.abs(avg(a) - avg(g)) - Math.abs(avg(b) - avg(g)))[0];
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
    const pairs: [XGroup, XGroup][] = [];
    const lined = part.measures.every(m =>
      m.groups.every(g => {
        if (g.staff !== staff || g.voice !== keep[1] || !g.notes.length) return true;
        const t = m.groups.find(h => h.staff === staff && h.voice === keep[0] && h.notes.length && Math.abs(h.start - g.start) < 1e-6 && Math.abs(h.end - g.end) < 1e-6);
        if (t) pairs.push([t, g]);
        return !!t;
      }),
    );
    if (lined) {
      for (const [t, g] of pairs) {
        joinGroup(t, g);
        g.notes = [];
      }
      return [keep[0]];
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
