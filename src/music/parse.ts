/**
 * Compact text notation used to author songs and fixed exercises.
 *
 *   token    := head [ "/" dur ] [ "@" fingers ] [ "%" strings ] [ "~" ]
 *   head     := pitch | "r" | "[" pitch { " " pitch } "]"
 *   pitch    := letter [accidental] octave     e.g. C4  F#4  Bb3  Ebb5  Fx4  Cn5
 *   dur      := ("w"|"h"|"q"|"e"|"s"|"t") { "." } [ "3" ]   ("3" = triplet)
 *   fingers  := digit { "," digit }   (use "-" to skip a chord member)
 *   strings  := digit { "," digit }   (guitar string numbers 1-6)
 *   "~"      := tie into the next note
 *   "|"      := barline (measure lengths are validated)
 *
 * Duration carries over from the previous note when omitted.
 * Pitches are SOUNDING pitches (guitar music is displayed an octave higher
 * automatically when the clef is treble8vb).
 *
 * Example:  E4/q@3 E4 F4@4 G4@5 | G4 F4 E4 D4 | C4/h. r/q |
 */
import { parseKey } from './keys';
import { parsePitch, type Pitch } from './pitch';
import { type BaseDuration, type TimeSig, durationTicks, measureTicks } from './rhythm';
import { type Clef, type Hand, type Instrument, type NoteSpec, type Score, buildVoice } from './score';

const TOKEN_RE = /\[[^\]]*\][^\s|]*|\||[^\s|]+/g;
const NOTE_RE = /^(\[[^\]]*\]|r|[A-Ga-g](?:##|bb|x|#|b|n)?-?\d)(?:\/([whqest])(\.{0,2})(3)?)?(?:@([\d,\-]+))?(?:%([\d,\-]+))?(~)?$/;

export interface ParseResult {
  specs: NoteSpec[];
  /** Number of complete measures (including pickup) */
  measures: number;
}

export class NotationError extends Error {}

function parseList(s: string | undefined): (number | undefined)[] | undefined {
  if (!s) return undefined;
  return s.split(',').map(x => (x === '-' || x === '' ? undefined : parseInt(x, 10)));
}

export function parseVoice(text: string, time: TimeSig, pickupTicks = 0, label = 'voice'): ParseResult {
  const tokens = text.match(TOKEN_RE) ?? [];
  const specs: NoteSpec[] = [];
  const mt = measureTicks(time);
  let base: BaseDuration = 'q';
  let dots = 0;
  let triplet = false;
  let inMeasure = 0;
  let measureIndex = 0;
  let measures = 0;

  const closeMeasure = (final: boolean) => {
    const expected = measureIndex === 0 && pickupTicks ? pickupTicks : mt;
    if (inMeasure !== expected) {
      const isLastShort = final && inMeasure < expected && inMeasure > 0;
      if (!(isLastShort && pickupTicks)) {
        throw new NotationError(
          `${label}: measure ${measureIndex + 1} has ${inMeasure / (mt / time[0])} beats, expected ${expected / (mt / time[0])}`,
        );
      }
    }
    measureIndex++;
    measures++;
    inMeasure = 0;
  };

  for (const tok of tokens) {
    if (tok === '|') {
      closeMeasure(false);
      continue;
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
    if (head === 'r') pitches = [];
    else if (head.startsWith('[')) {
      pitches = head.slice(1, -1).trim().split(/\s+/).map(parsePitch);
    } else pitches = [parsePitch(head)];
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
  }
  if (inMeasure > 0) closeMeasure(true);
  return { specs, measures };
}

export interface SongStaffDef {
  clef: Clef;
  hand?: Hand;
  /** One or two voices in the text notation. */
  voices: string[];
}

export interface SongDef {
  id: string;
  title: string;
  composer: string;
  /** e.g. "1824" or "c. 1700" or "Traditional" */
  year?: string;
  instrument: Instrument;
  /** 1 (first weeks) .. 10 (advanced) */
  level: number;
  key: string;
  time: TimeSig;
  tempo: number;
  /** Pickup length as a duration string, e.g. "q", "e", "h", "q." */
  pickup?: string;
  /** One-line note shown in the song card. */
  blurb?: string;
  staves: SongStaffDef[];
  tags?: string[];
}

function pickupToTicks(p?: string): number {
  if (!p) return 0;
  const m = /^([whqest])(\.{0,2})$/.exec(p);
  if (!m) throw new NotationError(`Invalid pickup "${p}"`);
  return durationTicks(m[1] as BaseDuration, m[2].length);
}

export function songToScore(song: SongDef): Score {
  const pickup = pickupToTicks(song.pickup);
  let measures = 0;
  const staves = song.staves.map((st, si) => ({
    clef: st.clef,
    hand: st.hand,
    voices: st.voices.map((text, vi) => {
      const r = parseVoice(text, song.time, pickup, `${song.id} staff ${si + 1} voice ${vi + 1}`);
      measures = Math.max(measures, r.measures);
      return buildVoice(r.specs, song.time, `${song.id}-s${si}v${vi}`, pickup);
    }),
  }));
  return {
    id: song.id,
    title: song.title,
    composer: song.composer,
    key: parseKey(song.key),
    time: song.time,
    tempo: song.tempo,
    pickup: pickup || undefined,
    measures,
    staves,
    instrument: song.instrument,
  };
}

/** Convenience for fixed exercises written in the text notation. */
export function scoreFromText(opts: {
  id: string;
  title?: string;
  key?: string;
  time?: TimeSig;
  tempo?: number;
  instrument: Instrument;
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
