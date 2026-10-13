/**
 * Compact text notation used to author songs and fixed exercises (and the note
 * language of the Clef Coach song file format, see src/songs/format.ts).
 *
 *   token    := head [ "/" dur ] [ "@" fingers ] [ "%" strings ] [ "~" ]
 *   head     := pitch | "r" | "[" pitch { " " pitch } "]"
 *   pitch    := letter [accidental] octave     e.g. C4  F#4  Bb3  Ebb5  Fx4  Cn5
 *   dur      := ("w"|"h"|"q"|"e"|"s"|"t") { "." } [ "3" ]   ("3" = triplet)
 *   fingers  := item { "," item }  item := digit | "L" | "R" | "-"
 *               piano fingers 1-5, fretting fingers 0-4 (0 = open),
 *               mallets 1-4 or L / R ("-" skips a chord member)
 *   strings  := digit { "," digit }   (string numbers, 1 = highest course)
 *   "~"      := tie into the next note
 *
 * Bar lines and structure
 *   "|"      bar line (measure lengths are validated)
 *   "||"     double bar (section end)
 *   "|:"     start repeat          ":|"  end repeat          ":|:"  both
 *   "|1"     first ending begins   ":|2" / "|2"  second ending begins
 *            Repeats and endings are written out ("unrolled") when the music is
 *            loaded, so the player practises exactly what is performed.
 *   "[K:G]"  key change from this measure on   (any key name: Bb, F#m, …)
 *   "[T:3/4]" time signature change from this measure on
 *
 * Duration carries over from the previous note when omitted.
 * Pitches are SOUNDING pitches for piano and fretted instruments (guitar and bass
 * guitar are displayed an octave higher automatically: clefs treble8vb / bass8vb)
 * and WRITTEN pitches for mallet percussion.
 *
 * Example:  E4/q@3 E4 F4@4 G4@5 | G4 F4 E4 D4 | C4/h. r/q |
 */
import type { InstrumentId } from './instruments';
import { type KeySig, keyName, parseKey } from './keys';
import { parsePitch, type Pitch, pitchToString } from './pitch';
import { type BaseDuration, type TimeSig, durationTicks, measureTicks, splitTicks } from './rhythm';
import { type Clef, type Hand, type Instrument, type MeterChange, type NoteSpec, type Score, buildVoice } from './score';

const TOKEN_RE = /\[[^\]]*\][^\s|]*|:?\|\|?:?[12]?|[^\s|]+/g;
const NOTE_RE = /^(\[[^\]]*\]|r|[A-Ga-g](?:##|bb|x|#|b|n)?-?\d)(?:\/([whqest])(\.{0,2})(3)?)?(?:@([\dLRlr,\-]+))?(?:%([\d,\-]+))?(~)?$/;
const BAR_RE = /^(:?)\|(\|?)(:?)([12]?)$/;
const META_RE = /^\[(K|T):\s*([^\]]+)\]$/;

export interface ParseResult {
  specs: NoteSpec[];
  /** Number of complete measures (including pickup) */
  measures: number;
  /** Key / time changes found in this voice (0-based measures, after unrolling). */
  changes: MeterChange[];
}

export class NotationError extends Error {}

function parseList(s: string | undefined): (number | undefined)[] | undefined {
  if (!s) return undefined;
  return s.split(',').map(x => {
    const t = x.trim().toUpperCase();
    if (t === '-' || t === '') return undefined;
    if (t === 'L') return 2;
    if (t === 'R') return 3;
    return parseInt(t, 10);
  });
}

function parseTime(s: string): TimeSig {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim());
  if (!m) throw new NotationError(`Invalid time signature "${s}" (use e.g. 3/4)`);
  const t: TimeSig = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (t[0] < 1 || t[0] > 32 || ![1, 2, 4, 8, 16, 32].includes(t[1])) throw new NotationError(`Unsupported time signature "${s}"`);
  return t;
}

interface RawMeasure {
  tokens: string[];
  startRepeat: boolean;
  endRepeat: boolean;
  volta: 0 | 1 | 2;
}

/**
 * Split a voice into measures and play out its repeats and first/second endings.
 * Returns the tokens in performance order, separated by plain "|" bar lines.
 */
export function unrollRepeats(text: string): string[] {
  const raw = text.match(TOKEN_RE) ?? [];
  if (!raw.some(t => BAR_RE.test(t) && t !== '|' && t !== '||')) return raw.map(t => (t === '||' ? '|' : t));
  const measures: RawMeasure[] = [];
  let cur: RawMeasure = { tokens: [], startRepeat: false, endRepeat: false, volta: 0 };
  let volta: 0 | 1 | 2 = 0;
  for (const t of raw) {
    const b = BAR_RE.exec(t);
    if (!b) {
      cur.tokens.push(t);
      continue;
    }
    const [, endRep, dbl, startRep, num] = b;
    cur.endRepeat = !!endRep;
    if (cur.tokens.length || cur.startRepeat) measures.push(cur);
    if (endRep && volta === 1) volta = 0;
    if (dbl || startRep) volta = 0;
    if (num) volta = Number(num) as 1 | 2;
    cur = { tokens: [], startRepeat: !!startRep, endRepeat: false, volta };
  }
  if (cur.tokens.length) measures.push(cur);
  const out: string[] = [];
  const emit = (m: RawMeasure) => {
    out.push(...m.tokens, '|');
  };
  let repeatStart = 0;
  let i = 0;
  let pass = 1;
  let guard = 0;
  while (i < measures.length && guard++ < 10000) {
    const m = measures[i];
    if (m.startRepeat && pass === 1) repeatStart = i;
    if (m.volta === 1 && pass === 2) {
      // skip the first ending on the second time through
      i++;
      continue;
    }
    if (m.volta === 2 && pass === 1) {
      // reached the second ending without an end-repeat on the first: treat as plain
      emit(m);
      i++;
      continue;
    }
    emit(m);
    if (m.endRepeat && pass === 1) {
      pass = 2;
      i = repeatStart;
      continue;
    }
    if (m.endRepeat && pass === 2) pass = 1;
    if (pass === 2 && m.volta === 2) pass = 1;
    i++;
  }
  return out;
}

export function parseVoice(text: string, time: TimeSig, pickupTicks = 0, label = 'voice', lenient = false): ParseResult {
  const tokens = unrollRepeats(text);
  const specs: NoteSpec[] = [];
  const changes: MeterChange[] = [];
  let curTime = time;
  let mt = measureTicks(time);
  let base: BaseDuration = 'q';
  let dots = 0;
  let triplet = false;
  let inMeasure = 0;
  let measureIndex = 0;
  let measures = 0;
  const beatsOf = (ticks: number) => {
    const b = ticks / (mt / curTime[0]);
    return Number.isInteger(b) ? String(b) : b.toFixed(2).replace(/0+$/, '');
  };

  const closeMeasure = (final: boolean) => {
    const expected = measureIndex === 0 && pickupTicks ? pickupTicks : mt;
    if (inMeasure !== expected && !lenient) {
      const isLastShort = final && inMeasure < expected && inMeasure > 0;
      if (!(isLastShort && pickupTicks)) {
        throw new NotationError(`${label}: measure ${measureIndex + 1} has ${beatsOf(inMeasure)} beats, expected ${beatsOf(expected)}`);
      }
    }
    measureIndex++;
    measures++;
    inMeasure = 0;
  };

  tokens.forEach((tok, ti) => {
    if (tok === '|') {
      // the final barline closes the (possibly short, after a pickup) last measure
      if (inMeasure === 0 && ti > 0 && tokens[ti - 1] === '|') return; // empty measure from "| |"
      closeMeasure(ti === tokens.length - 1);
      return;
    }
    const meta = META_RE.exec(tok);
    if (meta) {
      if (inMeasure !== 0) throw new NotationError(`${label}: "${tok}" must come at the start of a measure (measure ${measureIndex + 1})`);
      let ch = changes.find(c => c.measure === measureIndex);
      if (!ch) {
        ch = { measure: measureIndex };
        changes.push(ch);
      }
      if (meta[1] === 'T') {
        curTime = parseTime(meta[2]);
        mt = measureTicks(curTime);
        ch.time = curTime;
      } else {
        try {
          ch.key = parseKey(meta[2].trim());
        } catch {
          throw new NotationError(`${label}: unknown key "${meta[2]}" in measure ${measureIndex + 1}`);
        }
      }
      return;
    }
    const m = NOTE_RE.exec(tok);
    if (!m) throw new NotationError(`${label}: cannot parse token "${tok}" in measure ${measureIndex + 1}`);
    const [, head, durLetter, dotStr, trip, fing, strs, tie] = m;
    if (durLetter) {
      base = durLetter as BaseDuration;
      dots = dotStr?.length ?? 0;
      triplet = !!trip;
    }
    let pitches: Pitch[] = [];
    try {
      if (head === 'r') pitches = [];
      else if (head.startsWith('[')) {
        pitches = head.slice(1, -1).trim().split(/\s+/).map(parsePitch);
      } else pitches = [parsePitch(head)];
    } catch {
      throw new NotationError(`${label}: invalid pitch in "${tok}" (measure ${measureIndex + 1})`);
    }
    const fingers = parseList(fing);
    const strings = parseList(strs);
    if (fingers && fingers.length !== pitches.length) {
      throw new NotationError(`${label}: fingering count mismatch in "${tok}"`);
    }
    if (strings && strings.length !== pitches.length) {
      throw new NotationError(`${label}: string count mismatch in "${tok}"`);
    }
    specs.push({ pitches, base, dots, triplet, fingers, strings, tieNext: !!tie });
    inMeasure += durationTicks(base, dots, triplet);
  });
  if (inMeasure > 0) closeMeasure(true);
  // drop a change in the very first measure into the header (the caller's time/key)
  return { specs, measures, changes: changes.filter(c => c.measure > 0 || c.time || c.key) };
}

// ---------------------------------------------------------------------------
// Writing the notation (inverse of parseVoice) – used by the importers
// ---------------------------------------------------------------------------

const DUR_ORDER: BaseDuration[] = ['w', 'h', 'q', 'e', 's', 't'];

/** Exact duration token for a tick length, or null if it needs ties (e.g. 5 eighths). */
export function durationToken(ticks: number): string | null {
  for (const b of DUR_ORDER) {
    for (const d of [0, 1, 2]) {
      if (durationTicks(b, d) === ticks) return b + '.'.repeat(d);
      if (durationTicks(b, d, true) === ticks && d === 0) return `${b}3`;
    }
  }
  return null;
}

function listToken(xs: (number | undefined)[] | undefined, mallets: boolean): string {
  if (!xs || xs.every(x => x === undefined)) return '';
  return xs.map(x => (x === undefined ? '-' : mallets && x === 2 ? 'L' : mallets && x === 3 ? 'R' : String(x))).join(',');
}

/** One note/rest/chord token. `dur` is omitted when it equals `prevDur`. */
export function formatToken(spec: NoteSpec, prevDur: string | null, opts: { mallets?: 2 | 4 } = {}): { token: string; dur: string } {
  const head = spec.pitches.length === 0 ? 'r' : spec.pitches.length === 1 ? pitchToString(spec.pitches[0]) : `[${spec.pitches.map(pitchToString).join(' ')}]`;
  const dur = spec.base + '.'.repeat(spec.dots ?? 0) + (spec.triplet ? '3' : '');
  let tok = head + (dur === prevDur ? '' : `/${dur}`);
  const f = listToken(spec.fingers, opts.mallets === 2);
  if (f) tok += `@${f}`;
  const s = listToken(spec.strings, false);
  if (s) tok += `%${s}`;
  if (spec.tieNext && spec.pitches.length) tok += '~';
  return { token: tok, dur };
}

/**
 * Write note specs back as text notation with bar lines (and key/time change marks).
 * Notes that cross a bar line are split and tied. Durations carry over.
 */
export function formatVoice(specs: NoteSpec[], time: TimeSig, opts: { pickup?: number; changes?: MeterChange[]; mallets?: 2 | 4 } = {}): string {
  const out: string[] = [];
  let measure = 0;
  let t = time;
  const lenOf = (m: number) => (m === 0 && opts.pickup ? opts.pickup : measureTicks(t));
  const applyChanges = (m: number) => {
    for (const c of opts.changes ?? []) {
      if (c.measure !== m || m === 0) continue;
      if (c.key) out.push(`[K:${keyName(c.key)}]`);
      if (c.time) {
        t = c.time;
        out.push(`[T:${t[0]}/${t[1]}]`);
      }
    }
  };
  let room = lenOf(0);
  let prevDur: string | null = null;
  for (const spec of specs) {
    let remaining = durationTicks(spec.base, spec.dots ?? 0, spec.triplet);
    let first = true;
    while (remaining > 0) {
      const take = Math.min(remaining, room);
      const whole = take === remaining && first;
      const parts: { base: BaseDuration; dots: number; triplet?: boolean }[] = whole
        ? [{ base: spec.base, dots: spec.dots ?? 0, triplet: spec.triplet }]
        : splitTicks(take).map(p => ({ ...p }));
      parts.forEach((p, i) => {
        const last = i === parts.length - 1 && take === remaining;
        const piece: NoteSpec = {
          ...spec,
          base: p.base,
          dots: p.dots,
          triplet: p.triplet,
          fingers: first && i === 0 ? spec.fingers : undefined,
          strings: first && i === 0 ? spec.strings : undefined,
          tieNext: spec.pitches.length ? (last ? spec.tieNext : true) : false,
        };
        const { token, dur } = formatToken(piece, prevDur, { mallets: opts.mallets });
        out.push(token);
        prevDur = dur;
      });
      remaining -= take;
      room -= take;
      first = false;
      if (room <= 0) {
        out.push('|');
        measure++;
        applyChanges(measure);
        room = lenOf(measure);
      }
    }
  }
  if (out.length && out[out.length - 1] !== '|') out.push('|');
  return out.join(' ').replace(/ \|$/, ' |');
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

export interface SongStaffDef {
  clef: Clef;
  hand?: Hand;
  /** One or two voices in the text notation. */
  voices: string[];
  /** Optional part name ("Melody", "Bass line"). */
  name?: string;
}

export interface SongSection {
  name: string;
  /** 1-based measure numbers, inclusive (after repeats are written out). */
  from: number;
  to: number;
}

export interface SongDef {
  id: string;
  title: string;
  composer: string;
  /** e.g. "1824" or "c. 1700" or "Traditional" */
  year?: string;
  arranger?: string;
  /** Where the music came from (book, URL, "transcribed from a scan"). */
  source?: string;
  license?: string;
  instrument: Instrument;
  /** 1 (first weeks) .. 10 (advanced) */
  level: number;
  key: string;
  time: TimeSig;
  /** Quarter-note BPM */
  tempo: number;
  /** Pickup length as a duration string, e.g. "q", "e", "h", "q." */
  pickup?: string;
  /** One-line note shown in the song card. */
  blurb?: string;
  staves: SongStaffDef[];
  tags?: string[];
  /** Mallets: two or four mallets. */
  mallets?: 2 | 4;
  /** Chord symbols in time, e.g. "C/h G7/h | C/w |" (same durations and bar lines as the notes). */
  chords?: string;
  /** Named phrases / sections for practice. Auto-detected when absent. */
  sections?: SongSection[];
  /** Lyrics, one string per verse: syllables separated by spaces, "-" joins syllables of a word. */
  lyrics?: string[];
}

function pickupToTicks(p?: string): number {
  if (!p) return 0;
  const m = /^([whqest])(\.{0,2})$/.exec(p);
  if (!m) throw new NotationError(`Invalid pickup "${p}"`);
  return durationTicks(m[1] as BaseDuration, m[2].length);
}

function mergeChanges(all: MeterChange[][]): MeterChange[] {
  const byMeasure = new Map<number, MeterChange>();
  for (const list of all) {
    for (const c of list) {
      const cur = byMeasure.get(c.measure) ?? { measure: c.measure };
      if (c.time) cur.time = c.time;
      if (c.key) cur.key = c.key;
      byMeasure.set(c.measure, cur);
    }
  }
  return [...byMeasure.values()].sort((a, b) => a.measure - b.measure);
}

export function songToScore(song: SongDef): Score {
  const pickup = pickupToTicks(song.pickup);
  let measures = 0;
  const parsed = song.staves.map((st, si) =>
    st.voices.map((text, vi) => parseVoice(text, song.time, pickup, `${song.id} staff ${si + 1} voice ${vi + 1}`)),
  );
  const allChanges = mergeChanges(parsed.flat().map(r => r.changes));
  let key: KeySig = parseKey(song.key);
  let time = song.time;
  // a change written at the very start just sets the opening key/time
  const opening = allChanges.find(c => c.measure === 0);
  if (opening?.key) key = opening.key;
  if (opening?.time) time = opening.time;
  const changes = allChanges.filter(c => c.measure > 0);
  const staves = song.staves.map((st, si) => ({
    clef: st.clef,
    hand: st.hand,
    voices: parsed[si].map((r, vi) => {
      measures = Math.max(measures, r.measures);
      return buildVoice(r.specs, time, `${song.id}-s${si}v${vi}`, pickup, changes);
    }),
  }));
  return {
    id: song.id,
    title: song.title,
    composer: song.composer,
    key,
    time,
    tempo: song.tempo,
    pickup: pickup || undefined,
    measures,
    staves,
    instrument: song.instrument,
    mallets: song.mallets,
    changes: changes.length ? changes : undefined,
  };
}

/** Convenience for fixed exercises written in the text notation. */
export function scoreFromText(opts: {
  id: string;
  title?: string;
  key?: string;
  time?: TimeSig;
  tempo?: number;
  instrument: InstrumentId;
  staves: SongStaffDef[];
}): Score {
  return songToScore({
    id: opts.id,
    title: opts.title ?? '',
    composer: '',
    instrument: opts.instrument,
    level: 1,
    key: opts.key ?? 'C',
    time: opts.time ?? [4, 4],
    tempo: opts.tempo ?? 80,
    staves: opts.staves,
  });
}
