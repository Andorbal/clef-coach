/**
 * Text tab → Clef Coach song.
 *
 * Tab posted online as plain text ("ASCII tab") shows which string and fret each note
 * is played on, and usually the bar lines, but seldom the rhythm:
 *
 *   e|-------0-------|-------0-------|
 *   B|-----1---1-----|-----3---3-----|
 *   G|---2-------2---|---2-------2---|
 *   D|-2-------------|---------------|
 *   A|---------------|-0-------------|
 *   E|---------------|---------------|
 *
 * This reads each system of string lines; works out the instrument and tuning from the
 * number of strings, their names, a "Tuning:" line and a capo; keeps each note's
 * string; and takes the rhythm from a rhythm line (w h q e s t under or over the tab)
 * when there is one, else guesses it from how the notes are spaced in each bar. Chord
 * names written over a system become chord symbols, "x4" after a system plays it four
 * times, and |: :| repeats are played out.
 */
import { chordSymbolText, parseChordSymbol } from '../music/chords';
import { type InstrumentId, TUNINGS, familyOf, instrumentDef } from '../music/instruments';
import { keyName } from '../music/keys';
import type { SongDef } from '../music/parse';
import { type BaseDuration, type TimeSig, durationTicks, measureTicks } from '../music/rhythm';
import { newSongId } from './format';
import {
  type ImportPart,
  type ImportResult,
  type TimedNote,
  ImportError,
  Warnings,
  appTuningFor,
  buildVoice,
  cleanTempo,
  estimateKey,
  makeLayout,
  median,
  plural,
  retunedWarning,
  spellInKey,
  writeChordLine,
  writeVoice,
} from './importkit';

export interface TabOptions {
  instrument?: InstrumentId;
  /** The time signature to read the rhythm in; worked out from the tab when not given. */
  time?: TimeSig;
  title?: string;
  /** Text with tab for different instruments: the string count to import (as a string). */
  parts?: string[];
}

type Fretted = 'guitar' | 'bass' | 'ukulele';

// ---------------------------------------------------------------------------
// String lines and systems
// ---------------------------------------------------------------------------

/** One line of a system: a string's name, then its notes and bar lines. */
interface StringLine {
  label: string | null;
  body: string;
  /** Column where the body starts. */
  at: number;
  /** "|:" just after the string name. */
  startRepeat: boolean;
  /** "x4" after the line. */
  times?: number;
  row: number;
}

const BODY = /^[-0-9|:hpbrtsxXvVPHgSlL~^*.()[\]<>{}/\\'` ]+$/;
const REPEAT_TAIL = /(^|[|\s])\s*[([]?\s*(?:[x×]\s*(\d{1,2})|(\d{1,2})\s*[x×])\s*[)\]]?$/i;

function readStringLine(raw: string, row: number): StringLine | null {
  let line = raw.replace(/\t/g, '    ').replace(/\s+$/, '');
  let times: number | undefined;
  const rep = line.match(REPEAT_TAIL);
  if (rep && rep.index! > 0) {
    times = Number(rep[2] ?? rep[3]);
    line = line.slice(0, rep.index! + rep[1].length).replace(/\s+$/, '');
  }
  let label: string | null = null;
  let at: number;
  let startRepeat = false;
  let m: RegExpMatchArray | null;
  if ((m = line.match(/^\s*([A-Ga-g](?:#|b|♯|♭)?)\d?\s*(\|\|?:?|:|\)|\])/))) {
    label = m[1];
    at = m[0].length;
    startRepeat = m[2].length > 1 && m[2].endsWith(':');
  } else if ((m = line.match(/^\s*([A-Ga-g](?:#|b|♯|♭)?)\s*(?=[-–—])/))) {
    label = m[1];
    at = m[0].length;
  } else if ((m = line.match(/^\s*(\|\|?:?)/))) {
    at = m[0].length;
    startRepeat = m[1].endsWith(':');
  } else if ((m = line.match(/^\s*(?=[-–—])/))) at = m[0].length;
  else return null;
  let body = line.slice(at).replace(/[–—]/g, '-');
  // words after the last bar line are a comment ("<- let ring")
  const last = body.lastIndexOf('|');
  if (last >= 0 && /\s\S/.test(body.slice(last + 1))) body = body.slice(0, last + 1);
  if (body.length < 4 || !BODY.test(body)) return null;
  const dashes = body.split('-').length - 1;
  if (dashes < 3 || dashes < body.length * 0.25) return null;
  return { label, body, at, startRepeat, times, row };
}

/** Consecutive string lines, split into systems of one instrument's strings. */
function splitRun(run: StringLine[]): StringLine[][] {
  // a ruler line of dashes next to named strings isn't a string
  if (run.filter(l => l.label).length >= 3) run = run.filter(l => l.label);
  if (run.length <= 8) return [run];
  const labels = run.map(l => l.label);
  for (let p = 3; p <= 8; p++) {
    if (run.length % p === 0 && labels.every((l, i) => i < p || (l !== null && l === labels[i - p]))) return chunk(run, p);
  }
  for (const p of [6, 4, 5, 7]) if (run.length % p === 0) return chunk(run, p);
  return [run.slice(0, 6), ...splitRun(run.slice(6))];
}

const chunk = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function findSystems(rows: string[]): StringLine[][] {
  const out: StringLine[][] = [];
  let run: StringLine[] = [];
  const flush = () => {
    if (run.length) out.push(...splitRun(run).filter(s => s.length >= 3));
    run = [];
  };
  rows.forEach((r, i) => {
    const s = readStringLine(r, i);
    if (s) run.push(s);
    else flush();
  });
  flush();
  return out;
}

/** Does this text hold tab (at least one system of string lines)? */
export function looksLikeTab(text: string): boolean {
  return findSystems(text.split(/\r\n?|\n/)).length > 0;
}

// ---------------------------------------------------------------------------
// Tunings
// ---------------------------------------------------------------------------

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function pitchClass(name: string): number | null {
  const m = name.match(/^([A-Ga-g])(#|b|♯|♭)?$/);
  if (!m) return null;
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0;
  return (PC[m[1].toLowerCase()] + acc + 12) % 12;
}

/** The open string with this pitch class nearest to `near`. */
function nearest(pc: number, near: number): number {
  const d = (((pc - near) % 12) + 12) % 12;
  return d > 6 ? near + d - 12 : near + d;
}

/** Standard tuning for an instrument with this many strings (string 1 first). */
function baseTuning(instrument: Fretted, strings: number): number[] {
  if (instrument === 'ukulele') return TUNINGS.ukuleleHighG.open.slice(0, strings);
  if (instrument === 'bass') return strings <= 4 ? TUNINGS.bass4.open.slice(0, strings) : strings === 5 ? [...TUNINGS.bass5.open] : [48, ...TUNINGS.bass5.open].slice(0, strings);
  const seven = [...TUNINGS.guitar.open, 35, 30];
  return seven.slice(0, Math.max(strings, 1));
}

const GUITAR = [4, 11, 7, 2, 9, 4]; // E B G D A E, string 1 first
const UKE = [9, 4, 0, 7]; // A E C G
const BARITONE = [4, 11, 7, 2]; // E B G D
const BASS = [7, 2, 9, 4, 11]; // G D A E B

/** Named tunings: what they do to standard tuning (string 1 first). */
const NAMED_TUNINGS: [RegExp, (t: number[]) => number[]][] = [
  [/dadgad/i, () => [62, 57, 55, 50, 45, 38]],
  [/open\s*g\b/i, () => [62, 59, 55, 50, 43, 38]],
  [/open\s*d\b/i, () => [62, 57, 54, 50, 45, 38]],
  [/open\s*e\b/i, () => [64, 59, 56, 52, 47, 40]],
  [/open\s*c\b/i, () => [64, 60, 55, 48, 43, 36]],
  [/open\s*a\b/i, () => [64, 61, 57, 52, 45, 40]],
  [/drop\s*(?:c#|c♯|db|d♭)/i, t => dropLowest(shift(t, -1))],
  [/drop\s*c\b/i, t => dropLowest(shift(t, -2))],
  [/drop\s*b\b/i, t => dropLowest(shift(t, -3))],
  [/drop\s*d\b/i, t => dropLowest(t)],
  [/(?:half|1\/2|½)\s*-?\s*(?:a\s*)?step\s*down|\b(?:eb|e♭|d#|d♯)\s*(?:standard|tuning)|e\s*flat/i, t => shift(t, -1)],
  [/(?:whole|full|1)\s*-?\s*step\s*down|\bd\s*standard/i, t => shift(t, -2)],
  [/\b(?:c#|db)\s*standard/i, t => shift(t, -3)],
  [/\bc\s*standard/i, t => shift(t, -4)],
  [/\bb\s*standard/i, t => shift(t, -5)],
];
const shift = (t: number[], n: number) => t.map(x => x + n);
const dropLowest = (t: number[]) => t.map((x, i) => (i === t.length - 1 ? x - 2 : x));

/** A "Tuning:" line: a named tuning or the notes of the open strings (low to high). */
function parseTuningLine(text: string, base: number[]): number[] | null {
  for (const [re, f] of NAMED_TUNINGS) {
    if (!re.test(text)) continue;
    const t = f(base);
    return t.length === base.length ? t : null;
  }
  const notes = text.match(/(?:^|[^A-Za-z#♯♭])([A-Ga-g](?:#|b|♯|♭)?(?:\s*[A-Ga-g](?:#|b|♯|♭)?){3,7})(?![A-Za-z])/);
  if (!notes) return /standard/i.test(text) ? base : null;
  const names = notes[1].match(/[A-Ga-g](?:#|b|♯|♭)?/g)!;
  if (names.length !== base.length) return null;
  const pcs = names.map(n => pitchClass(n)!);
  // written low to high, as tunings are named; high to low if that fits standard better
  const low = [...pcs].reverse();
  const fit = (p: number[]) => p.filter((x, i) => x === ((base[i] % 12) + 12) % 12).length;
  const order = fit(pcs) > fit(low) ? pcs : low;
  return order.map((pc, i) => nearest(pc, base[i]));
}

// ---------------------------------------------------------------------------
// Notes, events and bars
// ---------------------------------------------------------------------------

interface TabNote {
  /** 1 = the highest string. */
  string: number;
  /** null: a dead (muted) note. */
  fret: number | null;
}

interface TabEvent {
  col: number;
  /** Last column its frets take. */
  end: number;
  notes: TabNote[];
  /** From a rhythm line, in ticks. */
  dur?: number;
}

interface Segment {
  /** Columns between its bar lines. */
  width: number;
  /** First column, in the system's body. */
  from: number;
  events: TabEvent[];
  startRepeat: boolean;
  endRepeat: boolean;
  chords: { col: number; symbol: string }[];
}

interface System {
  segments: Segment[];
  /** Times it is played ("x4"). */
  times: number;
}

interface Counts {
  dead: number;
  bends: number;
  harmonics: number;
}

/** The notes of one string line: frets, dead notes; bend targets are not new notes. */
function scanString(body: string, string: number, counts: Counts): (TabNote & { col: number; end: number })[] {
  const out: (TabNote & { col: number; end: number })[] = [];
  const digit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (digit(ch)) {
      let j = i + 1;
      if (digit(body[j]) && Number(body.slice(i, j + 1)) <= 24) j++;
      const fret = Number(body.slice(i, j));
      let k = i - 1;
      while (k >= 0 && body[k] === '(') k--;
      const before = body[k];
      if (before === 'b' || before === 'r' || before === '^') {
        // "7b9": bent up to the sound of fret 9, not a new note
        i = j;
        continue;
      }
      if (body[i - 1] === '<' || body[i - 1] === '[' || body[j] === '>') counts.harmonics++;
      if (body[j] === 'b' || body[j] === '^') counts.bends++;
      out.push({ string, fret, col: i, end: j - 1 });
      i = j;
    } else if (ch === 'x' || ch === 'X') {
      counts.dead++;
      out.push({ string, fret: null, col: i, end: i });
      i++;
    } else i++;
  }
  return out;
}

/** Notes struck together (frets in the same columns) become one event. */
function eventsOf(lines: string[], counts: Counts, offset: number): TabEvent[] {
  const all = lines.flatMap((b, s) => scanString(b, offset + s + 1, counts)).sort((a, b) => a.col - b.col || a.string - b.string);
  const events: TabEvent[] = [];
  for (const n of all) {
    const ev = events[events.length - 1];
    if (ev && n.col <= ev.end && !ev.notes.some(x => x.string === n.string)) {
      ev.notes.push({ string: n.string, fret: n.fret });
      ev.end = Math.max(ev.end, n.end);
    } else events.push({ col: n.col, end: n.end, notes: [{ string: n.string, fret: n.fret }] });
  }
  return events;
}

/** A line of chord names over a system: each with its column. */
function readChordLine(row: string): { col: number; symbol: string }[] | null {
  const toks = [...row.replace(/\t/g, '    ').matchAll(/\S+/g)];
  if (!toks.length) return null;
  const out: { col: number; symbol: string }[] = [];
  for (const t of toks) {
    const text = t[0].replace(/^\(|\)$/g, '');
    if (text === '|' || /^(n\.?c\.?|%)$/i.test(text)) continue;
    try {
      out.push({ col: t.index!, symbol: chordSymbolText(parseChordSymbol(text)) });
    } catch {
      return null;
    }
  }
  return out.length ? out : null;
}

/** A rhythm line (w h q e s t, dotted with "."): each value with its column. */
function readRhythmLine(row: string): { col: number; ticks: number }[] | null {
  const toks = [...row.replace(/\t/g, '    ').matchAll(/\S+/g)].filter(t => t[0] !== '|');
  if (toks.length < 2) return null;
  const out: { col: number; ticks: number }[] = [];
  for (const t of toks) {
    const m = t[0].match(/^([whqestWHQEST])(\.{0,2})(3?)$/);
    if (!m) return null;
    out.push({ col: t.index!, ticks: durationTicks(m[1].toLowerCase() as BaseDuration, m[2].length, !!m[3]) });
  }
  // a row of Es is more likely E chords
  if (toks.every(t => t[0] === 'E')) return null;
  return out;
}

const REPEAT_ROW = /^\s*[([]?\s*(?:repeat\s*|play\s*)?(?:[x×]\s*(\d{1,2})|(\d{1,2})\s*(?:[x×]|times))\s*[)\]]?\s*$/i;

function buildSystem(lines: StringLine[], rows: string[], counts: Counts, offset: number): System {
  const n = lines.length;
  const width = Math.max(...lines.map(l => l.body.length));
  const bodies = lines.map(l => l.body.padEnd(width, '-'));
  const isBar = (c: number) => bodies.filter(b => b[c] === '|').length >= Math.max(2, Math.ceil(n / 2));
  const isColon = (c: number) => bodies.filter(b => b[c] === ':').length >= Math.max(2, Math.ceil(n / 2));
  // bar lines: runs of columns ("||", ":|", "|:")
  const bars: [number, number][] = [];
  for (let c = 0; c < width; c++) {
    if (!isBar(c)) continue;
    const prev = bars[bars.length - 1];
    if (prev && prev[1] === c - 1) prev[1] = c;
    else bars.push([c, c]);
  }
  const segments: Segment[] = [];
  let from = 0;
  let startRepeat = lines.some(l => l.startRepeat);
  const cut = (to: number, endRepeat: boolean, nextStart: boolean) => {
    const seg = bodies.map(b => b.slice(from, to));
    const events = eventsOf(seg, counts, offset);
    if (events.length || to - from >= 3) segments.push({ width: to - from, from, events, startRepeat, endRepeat, chords: [] });
    startRepeat = nextStart;
  };
  for (const [a, b] of bars) {
    // ":|" ends a repeat, "|:" starts one
    cut(isColon(a - 1) ? a - 1 : a, isColon(a - 1), isColon(b + 1));
    from = isColon(b + 1) ? b + 2 : b + 1;
  }
  if (from < width) cut(width, false, false);

  // the rows around the system: chord names, a rhythm line, a repeat count
  const first = Math.min(...lines.map(l => l.row));
  const last = Math.max(...lines.map(l => l.row));
  const at = lines.find(l => l.row === first)!.at;
  const toBody = (col: number) => col - at;
  for (const r of [first - 1, first - 2, last + 1]) {
    const row = rows[r];
    if (row === undefined || !row.trim() || readStringLine(row, r)) continue;
    if (r === first - 2 && !rows[first - 1]?.trim()) continue;
    const chords = readChordLine(row);
    if (chords && r < first) {
      for (const c of chords) {
        const col = toBody(c.col);
        const seg = segments.find(s => col < s.from + s.width) ?? segments[segments.length - 1];
        seg?.chords.push({ col: Math.max(0, col - seg.from), symbol: c.symbol });
      }
      continue;
    }
    const rhythm = readRhythmLine(row);
    if (rhythm) {
      for (const seg of segments) {
        for (const ev of seg.events) {
          const col = seg.from + ev.col;
          const tok = rhythm.find(t => Math.abs(toBody(t.col) - col) <= 1);
          if (tok) ev.dur = tok.ticks;
        }
      }
    }
  }
  let times = Math.max(1, ...lines.map(l => l.times ?? 1));
  const below = rows[last + 1]?.match(REPEAT_ROW);
  if (below) times = Math.max(times, Number(below[1] ?? below[2]));
  return { segments, times };
}

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------

const GRIDS = [
  { g: 48, pen: 0 },
  { g: 24, pen: 0.05 },
  { g: 12, pen: 0.2 },
  { g: 16, pen: 0.3, triplet: true },
  { g: 6, pen: 0.5 },
  { g: 8, pen: 0.6, triplet: true },
];

interface Fit {
  ticks: number[];
  cost: number;
  /** Columns per tick. */
  scale: number;
}

/**
 * Times for the events of one bar from their columns: the spacing is read as
 * proportional to time, allowing for a little padding at either end, and snapped to
 * the simplest grid that keeps the notes apart.
 */
function fitBar(cols: number[], width: number, M: number, compound: boolean, pad: number): Fit | null {
  const n = cols.length;
  if (!n) return { ticks: [], cost: 0, scale: 0 };
  const last = cols[n - 1];
  const origins = new Map<number, number>();
  for (const [o, pen] of [
    [Math.min(cols[0], pad), 0],
    [0, 0.1],
    [cols[0], cols[0] > pad ? 0.4 : 0],
  ]) {
    if (!origins.has(o) || origins.get(o)! > pen) origins.set(o, pen);
  }
  let best: Fit | null = null;
  for (const [o, opPen] of origins) {
    // the bar line marks the end of the bar, give or take the padding before it (the
    // last note's dashes are often cut short, or run on)
    const natural = width - o;
    for (let span = Math.max(1, last - o + 1); span <= natural + pad + 2; span++) {
      const endPen = Math.min(0.3, 0.04 * Math.abs(span - natural));
      const raw = cols.map(c => ((c - o) / span) * M);
      for (const grid of GRIDS) {
        if (M % grid.g || (grid.triplet && compound)) continue;
        const snapped = raw.map(r => Math.round(r / grid.g) * grid.g);
        if (snapped.some((t, i) => i > 0 && t <= snapped[i - 1]) || snapped[n - 1] >= M) continue;
        const err = snapped.reduce((s, t, i) => s + Math.abs(t - raw[i]), 0);
        const cost = (err / M) * 4 + grid.pen + opPen + endPen;
        if (!best || cost < best.cost - 1e-9) best = { ticks: snapped, cost, scale: span / M };
      }
    }
  }
  return best;
}

/** Times from a rhythm line, if it covers the bar (a value missing here and there repeats the last). */
function rhythmTimes(events: TabEvent[]): { ticks: number[]; total: number } | null {
  if (!events.length || events.filter(e => e.dur).length < events.length * 0.75) return null;
  const ticks: number[] = [];
  let t = 0;
  let dur = events.find(e => e.dur)!.dur!;
  for (const e of events) {
    ticks.push(t);
    dur = e.dur ?? dur;
    t += dur;
  }
  return { ticks, total: t };
}

/** A bar of the song: events with times from its downbeat. */
interface OutBar {
  events: { tick: number; end: number; notes: TabNote[] }[];
  chords: { tick: number; symbol: string }[];
  startRepeat: boolean;
  endRepeat: number;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Convert text tab into a song. Throws ImportError if the text has no tab. */
export function importTextTab(text: string, opts: TabOptions = {}): ImportResult {
  const w = new Warnings();
  const rows = text.split(/\r\n?|\n/);
  const runs = findSystems(rows);
  if (!runs.length) {
    throw new ImportError(
      'No tab was found. Tab lines start with the string’s name and show frets on dashes, like “e|---0---3---|”. For tab in a picture or PDF, use “Scan sheet music”.',
    );
  }
  const counts: Counts = { dead: 0, bends: 0, harmonics: 0 };

  // ---- which instrument: the string count (and names) of each system
  const byStrings = new Map<number, StringLine[][]>();
  for (const r of runs) byStrings.set(r.length, [...(byStrings.get(r.length) ?? []), r]);
  const want = opts.instrument && familyOf(opts.instrument) === 'fretted' ? (opts.instrument as Fretted) : undefined;
  const setOf = (n: number) => stringSet(n, byStrings.get(n)![0].map(l => l.label), want);
  const partList: ImportPart[] = [...byStrings.keys()]
    .sort((a, b) => b - a)
    .map(n => ({ id: String(n), name: `${instrumentDef(setOf(n).instrument).name} (${n} strings)`, staves: 1 }));
  let strings = Number(opts.parts?.find(p => byStrings.has(Number(p))));
  if (!strings) {
    const ranked = [...byStrings].sort((a, b) => b[1].length - a[1].length);
    strings = (want && ranked.find(([n]) => setOf(n).instrument === want)?.[0]) || ranked[0][0];
    if (partList.length > 1) w.add(`Imported the ${partList.find(p => p.id === String(strings))!.name.toLowerCase()} tab; the text also has tab for ${plural(partList.length - 1, 'other instrument')} – choose ${partList.length > 2 ? 'one' : 'it'} to import it instead.`);
  }
  const { instrument, offset } = setOf(strings);
  if (offset) w.add(`The tab shows only strings ${offset + 1}–${offset + strings} of the ${instrumentDef(instrument).name.toLowerCase()}.`);
  const chosen = byStrings.get(strings)!;

  // ---- top line = highest string, unless the names say otherwise
  const base = baseTuning(instrument, offset + strings);
  const pcsOf = (t: number[]) => t.map(x => ((x % 12) + 12) % 12);
  const std = pcsOf(base).slice(offset);
  const flip = chosen.map(sys => {
    const pcs = sys.map(l => (l.label ? pitchClass(l.label) : null));
    if (pcs.filter(p => p !== null).length < 2) return false;
    const fwd = pcs.filter((p, i) => p === std[i]).length;
    const rev = pcs.filter((p, i) => p === std[strings - 1 - i]).length;
    return rev > fwd;
  });
  const systemsLines = chosen.map((sys, i) => (flip[i] ? [...sys].reverse() : sys));
  if (flip.some(Boolean)) w.add('The tab has the lowest string on top; it was read with string 1 as the highest string.');

  // ---- header: title, artist, tuning, capo, tempo, time signature
  const used = new Set<number>();
  for (const sys of runs) for (const l of sys) used.add(l.row);
  const head = readHeader(rows.filter((_, i) => !used.has(i)), rows.slice(0, runs[0][0].row).filter(r => r.trim()));
  let tuning = base;
  const labelled = systemsLines[0].map(l => (l.label ? pitchClass(l.label) : null));
  if (labelled.every(p => p !== null)) tuning = base.map((o, i) => (i < offset ? o : nearest(labelled[i - offset]!, o)));
  if (head.tuning) {
    // a "Tuning:" line wins over string names, except a plain "standard" over names that say otherwise
    const t = parseTuningLine(head.tuning, base);
    if (t && !(t === base && labelled.every(p => p !== null))) tuning = t;
  }
  const capo = head.capo ?? 0;
  const open = tuning.map(t => t + capo);

  // ---- systems → segments with events
  const systems = systemsLines.map(sys => buildSystem(sys, rows, counts, offset));

  // ---- the time signature: given, written in the text, or the one the spacing fits best
  const barred = systems.flatMap(s => (s.segments.length > 1 ? s.segments : [])).filter(s => s.events.length);
  const leads = barred.map(s => s.events[0].col);
  const pad = leads.length ? Math.min(3, mode(leads)) : 1;
  let time: TimeSig = opts.time ?? head.time ?? [4, 4];
  let timeGuessed = false;
  if (!opts.time && !head.time) {
    // with a rhythm line, the length of most bars says it
    const sums = systems.flatMap(s => s.segments.length > 1 ? s.segments : []).map(seg => rhythmTimes(seg.events)?.total).filter((t): t is number => t !== undefined);
    const barLen = sums.length ? mode(sums) : 0;
    if (barLen && barLen % 48 === 0 && barLen >= 96 && barLen <= 288) time = [barLen / 48, 4];
    else if (barLen && barLen % 24 === 0 && barLen >= 72 && barLen <= 288) time = [barLen / 24, 8];
    else if (barred.length) {
      const cost = (M: number) => barred.reduce((s, seg) => s + (seg.events.length > 1 ? fitBar(seg.events.map(e => e.col), seg.width, M, false, pad)?.cost ?? 5 : 0), 0);
      const c4 = cost(192);
      const c3 = cost(144);
      if (c3 + 0.05 * barred.length < c4) time = [3, 4];
      timeGuessed = true;
    }
  }
  const M = measureTicks(time);
  const compound = time[1] === 8 && time[0] % 3 === 0;

  // ---- bars, with times for every event
  const fits = barred.map(seg => fitBar(seg.events.map(e => e.col), seg.width, M, compound, pad)).filter((f): f is Fit => !!f && f.cost < 0.5 && f.scale > 0);
  const scale = fits.length ? median(fits.map(f => f.scale)) : 0;
  const typicalWidth = barred.length ? median(barred.map(s => s.width)) : 0;
  let guessed = false;
  let unbarred = false;
  const bars: OutBar[] = [];
  const sysBars: { first: number; last: number; times: number }[] = [];
  for (const sys of systems) {
    const first = bars.length;
    for (const seg of sys.segments) {
      const evs = seg.events;
      const cols = evs.map(e => e.col);
      const fromRhythm = rhythmTimes(evs);
      let ticks = fromRhythm && fromRhythm.total <= M ? fromRhythm.ticks : null;
      const tooLong = (sys.segments.length === 1 && (evs.length > 8 || (typicalWidth > 0 && seg.width > typicalWidth * 1.75))) || evs.length > M / 6;
      if (!ticks && !tooLong) {
        const f = fitBar(cols, seg.width, M, compound, pad);
        if (f) {
          ticks = f.ticks;
          if (evs.length > 1) guessed = true;
        }
      }
      if (ticks) {
        const chords = seg.chords.map(c => ({ tick: chordTick(c.col, evs, ticks!, seg.width, M), symbol: c.symbol }));
        bars.push({ events: evs.map((e, i) => ({ tick: ticks![i], end: ticks![i + 1] ?? M, notes: e.notes })), chords, startRepeat: seg.startRepeat, endRepeat: seg.endRepeat ? 2 : 0 });
        continue;
      }
      // no bar lines to go by: a column scale from the rest of the tab, else the usual gap as an eighth
      unbarred = true;
      guessed = true;
      const gaps = cols.slice(1).map((c, i) => c - cols[i]);
      const perTick = scale || (gaps.length ? median(gaps) : 2) / 24;
      // eighths if they keep the notes apart, else sixteenths
      const onGrid = (g: number) => cols.map(c => Math.round((c - cols[0]) / perTick / g) * g);
      let abs = onGrid(24);
      if (abs.some((t, i) => i > 0 && t <= abs[i - 1])) {
        abs = onGrid(12);
        for (let i = 1; i < abs.length; i++) if (abs[i] <= abs[i - 1]) abs[i] = abs[i - 1] + 12;
      }
      const lastLen = Math.max(24, Math.round((gaps.length ? median(gaps) : 4) / perTick / 12) * 12);
      const total = (abs[abs.length - 1] ?? 0) + lastLen;
      const nBars = Math.max(1, Math.ceil(total / M - 1e-9));
      const chordTicks = seg.chords.map(c => ({ tick: Math.max(0, Math.round((c.col - cols[0]) / perTick / 12) * 12), symbol: c.symbol }));
      for (let b = 0; b < nBars; b++) {
        const lo = b * M;
        const hi = lo + M;
        bars.push({
          events: evs.flatMap((e, i) => (abs[i] >= lo && abs[i] < hi ? [{ tick: abs[i] - lo, end: (abs[i + 1] ?? abs[i] + lastLen) - lo, notes: e.notes }] : [])),
          chords: chordTicks.filter(c => c.tick >= lo && c.tick < hi).map(c => ({ tick: c.tick - lo, symbol: c.symbol })),
          startRepeat: b === 0 && seg.startRepeat,
          endRepeat: b === nBars - 1 && seg.endRepeat ? 2 : 0,
        });
      }
    }
    sysBars.push({ first, last: bars.length - 1, times: sys.times });
  }
  // "x4": the whole system, four times
  for (const s of sysBars) {
    if (s.times < 2 || s.last < s.first) continue;
    const inner = bars.slice(s.first, s.last + 1);
    if (!inner.some(b => b.startRepeat)) bars[s.first].startRepeat = true;
    bars[s.last].endRepeat = Math.max(bars[s.last].endRepeat, Math.min(16, s.times));
  }

  // ---- play out the repeats, leave out empty bars at either end
  let played = playOut(bars);
  if (played.length > 2000) {
    played = played.slice(0, 2000);
    w.add('The tab is very long; it was cut short after 2000 bars.');
  }
  while (played.length && !played[0].events.length) played.shift();
  while (played.length && !played[played.length - 1].events.length) played.pop();
  if (!played.length) throw new ImportError('The tab has no notes in it.');

  // ---- notes
  const appOpen = appTuningFor(instrument, tuning);
  const retuned = tuning.some((o, i) => appOpen[i] !== o);
  let moved = 0;
  const raw: { start: number; end: number; notes: { midi: number; string: number }[] }[] = [];
  played.forEach((bar, k) => {
    for (const e of bar.events) {
      const notes = e.notes.filter(n => n.fret !== null && open[n.string - 1] !== undefined).map(n => ({ midi: open[n.string - 1] + n.fret!, string: n.string }));
      raw.push({ start: k * M + e.tick, end: k * M + e.end, notes });
    }
  });
  const key = estimateKey(raw.flatMap(r => r.notes.map(n => ({ midi: n.midi, start: r.start, end: r.end }))));
  const layout = makeLayout(played.map(() => ({ len: M, time, key })));
  const timed: TimedNote[] = raw.map(r => ({
    start: r.start,
    end: r.end,
    pitches: r.notes.map(n => spellInKey(n.midi, key)),
    strings: r.notes.map(n => {
      const fret = n.midi - (appOpen[n.string - 1] ?? -99);
      if (fret >= 0 && fret <= 24) return n.string;
      moved++;
      return undefined;
    }),
  }));
  const built = buildVoice(timed, layout);
  const voice = writeVoice(built.specs, layout);
  const chordChanges = played.flatMap((b, k) => b.chords.map(c => ({ tick: k * M + c.tick, symbol: c.symbol as string | null })));
  const chords = chordChanges.length ? writeChordLine(chordChanges, layout) : undefined;

  // ---- what the player should know
  if (guessed) {
    w.add(
      `Text tab doesn't show the rhythm, so it was guessed from how the notes are spaced${timeGuessed ? `, in ${time[0]}/${time[1]}` : ''}${unbarred ? ' (where the tab has no bar lines, the usual gap between notes was read as an eighth note)' : ''}. Check it against a recording, try another time signature, or use “Scan sheet music” to have Claude read the tab.`,
    );
  }
  if (retuned) {
    w.add(retunedWarning('The tab', tuning, appOpen, moved));
  }
  if (capo) w.add(`Capo ${capo}: the notes are written at the pitch they sound, as played without a capo.`);
  if (counts.dead) w.add(`${plural(counts.dead, 'dead (muted) note')} ${counts.dead > 1 ? 'were' : 'was'} left out.`);
  if (counts.bends) w.add('Bends are written as the fret you start on.');
  if (counts.harmonics) w.add('Harmonics are written at the fret where they are played.');
  if (built.shortened) w.add(`${plural(built.shortened, 'note')} ringing over the next ${built.shortened > 1 ? 'were' : 'was'} shortened.`);
  w.add(`Text tab has no key signature; the key was estimated as ${keyName(key).replace(/m$/, ' minor')}${key.mode === 'major' ? ' major' : ''}.`);
  if (!head.tempo) w.add('The tab gives no tempo; it was set to 100.');

  const title = head.title || opts.title?.trim() || 'Imported tab';
  const song: SongDef = {
    id: newSongId(title),
    title,
    composer: head.artist ?? '',
    source: `Imported from a text tab${head.tabber ? ` (tab by ${head.tabber})` : ''}`,
    instrument,
    level: 3,
    key: keyName(key),
    time,
    tempo: cleanTempo(head.tempo, 100),
    staves: [{ clef: instrument === 'guitar' ? 'treble8vb' : instrument === 'bass' ? 'bass8vb' : 'treble', voices: [voice] }],
    chords,
  };
  return { song, warnings: w.list, parts: partList.length > 1 ? partList : [] };
}

interface StringSet {
  instrument: Fretted;
  /** Strings above the tab's top line: tab for a riff often shows only the low strings. */
  offset: number;
}

/** The instrument a system's strings belong to, from how many there are and their names. */
function stringSet(strings: number, labels: (string | null)[], want?: Fretted): StringSet {
  const pcs = labels.map(l => (l ? pitchClass(l) : null));
  const named = pcs.every(p => p !== null);
  const is = (shape: number[]) => named && (pcs.join() === shape.join() || [...pcs].reverse().join() === shape.join());
  // where the names sit among a guitar's strings
  let onGuitar = -1;
  for (let k = 0; named && onGuitar < 0 && k + strings <= GUITAR.length; k++) if (is(GUITAR.slice(k, k + strings))) onGuitar = k;
  if (strings >= 6) return { instrument: 'guitar', offset: 0 };
  if (strings === 4 && is(UKE)) return { instrument: 'ukulele', offset: 0 };
  if (strings === 4 && is(BARITONE) && want === 'ukulele') return { instrument: 'ukulele', offset: 0 };
  // "G D A E" is a bass, or a guitar's low strings
  if (onGuitar >= 0 && (want === 'guitar' || !is(BASS.slice(0, strings)))) return { instrument: 'guitar', offset: onGuitar };
  if (!named && want === 'ukulele' && strings === 4) return { instrument: 'ukulele', offset: 0 };
  return { instrument: 'bass', offset: 0 };
}

/** The tick a chord name sits over: the note under it, else its share of the bar. */
function chordTick(col: number, events: TabEvent[], ticks: number[], width: number, M: number): number {
  const i = events.findIndex(e => e.end >= col - 1);
  if (i >= 0 && events[i].col <= col + 2) return ticks[i];
  return Math.min(M - 12, Math.max(0, Math.round(((col / Math.max(1, width)) * M) / 48) * 48));
}

/** Play out |: :| repeats (and "x4" counts) into the bars as heard. */
function playOut(bars: OutBar[]): OutBar[] {
  const out: OutBar[] = [];
  let from = 0;
  bars.forEach((b, i) => {
    if (b.startRepeat) from = i;
    out.push(b);
    if (b.endRepeat > 1) {
      for (let k = 1; k < b.endRepeat; k++) out.push(...bars.slice(from, i + 1));
      from = i + 1;
    }
  });
  return out;
}

function mode(xs: number[]): number {
  const c = new Map<number, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface Head {
  title?: string;
  artist?: string;
  tabber?: string;
  tuning?: string;
  capo?: number;
  tempo?: number;
  time?: TimeSig;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const SECTION = /^\s*[[(]?\s*(intro|verse|chorus|pre-?chorus|bridge|outro|solo|riff|interlude|instrumental|break|coda|ending|main|part|section|tab|fill)\b/i;

/** Title, artist, tuning, capo, tempo and time signature from the text around the tab. */
function readHeader(text: string[], before: string[]): Head {
  const h: Head = {};
  for (const raw of text) {
    const line = raw.trim();
    if (!line) continue;
    let m: RegExpMatchArray | null;
    if (!h.title && (m = line.match(/^(?:song\s*)?(?:title|song)\s*[:=]\s*(.+)$/i))) h.title = m[1].trim();
    else if (!h.artist && (m = line.match(/^(?:artist|band|composer|music|written\s*by|by)\s*[:=]\s*(.+)$/i))) h.artist = m[1].trim();
    else if (!h.tabber && (m = line.match(/^(?:tab(?:bed)?|transcribed|tabbed)\s*by\s*[:=]?\s*(.+)$/i))) h.tabber = m[1].trim();
    if (!h.tuning && (m = line.match(/\btuning\s*[:=-]?\s*(.+)$/i))) h.tuning = m[1].trim();
    else if (!h.tuning && /^(?:drop\s*[a-g]|open\s*[a-g]|dadgad|half\s*step\s*down|[a-g][#b]?\s*standard)\b/i.test(line)) h.tuning = line;
    if (h.capo === undefined && (m = line.match(/\bcapo\b\s*[:=-]?\s*(?:on\s*)?(?:(?:the\s*)?fret\s*)?(\d{1,2}|[ivx]{1,4})(?:st|nd|rd|th)?\b/i))) h.capo = /\d/.test(m[1]) ? Number(m[1]) : ROMAN[m[1].toLowerCase()];
    else if (h.capo === undefined && /\bno\s*capo\b/i.test(line)) h.capo = 0;
    if (!h.tempo && (m = line.match(/\b(?:tempo|bpm)\s*[:=-]?\s*(\d{2,3})\b|\b(\d{2,3})\s*bpm\b|[♩q]\s*=\s*(\d{2,3})\b/i))) h.tempo = Number(m[1] ?? m[2] ?? m[3]);
    if (!h.time && (m = line.match(/\b(?:time(?:\s*signature)?|meter)\s*[:=-]?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b|^\(?(\d{1,2})\/(\d{1,2})\)?$/i))) {
      const t: TimeSig = [Number(m[1] ?? m[3]), Number(m[2] ?? m[4])];
      if (t[0] >= 1 && t[0] <= 16 && [2, 4, 8, 16].includes(t[1])) h.time = t;
    }
  }
  if (h.capo !== undefined && (h.capo < 0 || h.capo > 12 || Number.isNaN(h.capo))) h.capo = undefined;
  if (!h.title) {
    // "Song by Artist", else the first line of the text when it isn't anything else
    for (const raw of before.slice(0, 4)) {
      const line = raw.trim();
      if (!line || line.length > 80 || SECTION.test(line) || /[:=]/.test(line) || /^[-=#*_~]{3,}$/.test(line) || readChordLine(line) || readRhythmLine(line) || /\b(capo|tuning|tempo|bpm|tab(?:bed)?\s*by)\b/i.test(line)) continue;
      const by = line.match(/^(.+?)\s+by\s+(.+)$/i);
      if (by) {
        h.title = by[1].replace(/^["“]|["”]$/g, '').trim();
        h.artist ??= by[2].trim();
      } else h.title = line.replace(/^["“]|["”]$/g, '').trim();
      break;
    }
  }
  return h;
}
