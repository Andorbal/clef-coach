/**
 * The arranger: a band for any song, written from its chords.
 *
 * Each style is a handful of one-bar patterns per meter, written as step strings (one
 * character per step; a 4/4 bar has sixteen sixteenth-note steps, 3/4 twelve, 6/8
 * twelve…), so they read like a drum machine's grid:
 *
 *   drums   'X' accent  'x' hit  'g' ghost  '.' rest            one row per drum
 *   bass    'R' root (or the slash bass)  '5' fifth  '3' third  '7' seventh  '8' octave
 *           'a' approach note into the next chord  'w' walking note  '-' hold  '.' rest
 *   comp    'X'/'x' chord  'd'/'u' strummed down/up  '0'…'4' broken-chord note  '-' hold  '.' rest
 *
 * Patterns follow the harmony: a chord that changes where the pattern has no note
 * gets one, a held note stops at a chord change, the bass walks and approaches the next
 * root, chords are voice-led (each moves as little as it can), guitar chords use real
 * guitar shapes. Phrases end with a fill and the next begins with a crash; the last bar
 * rings out. Unusual meters (5/4, 7/8 …) get a groove built from their beat groups.
 *
 * Everything is deterministic for a given seed: the same song always gets the same band.
 */
import { mulberry32 } from '../audio/dsp/util';
import { type BandRole, type BandStyle, ROLE_NAMES, bandPartScore, inferRole, rolePan } from '../music/band';
import { parseChordSymbol } from '../music/chords';
import { frettedVoicings } from '../music/chordbook';
import { drumKeyOf, gmProgramName } from '../music/gm';
import { type InstrumentId, TUNINGS, familyOf } from '../music/instruments';
import type { SongDef } from '../music/parse';
import { type TimeSig, PPQ, beatTicks, measureTicks } from '../music/rhythm';
import { type Score, buildSteps, measureLengths, timeAt } from '../music/score';
import { songSections } from '../songs/format';
import { type ChordSpan, chordAt, songChordSpans } from './harmony';
import type { Arrangement, PerfNote, PerfTrack, ResolvedStyle } from './types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

type MeterKey = '4/4' | '3/4' | '2/4' | '6/8' | '9/8' | '12/8';
type DrumBar = Record<string, string>;

interface CompDef {
  program: number;
  /** Strummed guitar shapes, a power chord, or a voice-led keyboard chord. */
  voicing: 'guitar' | 'power' | 'keys';
  patterns: Partial<Record<MeterKey, string[]>>;
}

interface StyleDef {
  /** GM drum kit, or null for no drums. */
  kit: number | null;
  drums: Partial<Record<MeterKey, DrumBar[]>>;
  bassProgram: number;
  bass: Partial<Record<MeterKey, string[]>>;
  /** Comping on a keyboard (when the player isn't on one) and on a guitar (when they are). */
  keys: CompDef;
  guitar: CompDef;
  /** GM program of a sustained pad, or null. */
  pad: number | null;
  swing?: boolean;
  fill: 'none' | 'light' | 'snare' | 'toms' | 'roll';
  crash: boolean;
  /** Base velocity of the drums (brushes and side-stick ballads are quiet). */
  drumLevel: number;
}

const ARP_44 = ['0.2.1.2.3.2.1.2.'];
const ARP_34 = ['0.1.2.3.2.1.'];
const ARP_68 = ['0.1.2.3.2.1.'];
const ARP_128 = ['0.1.2.3.2.1.0.1.2.3.2.1.'];
const ARP_98 = ['0.1.2.3.2.1.0.1.2.'];
const PICK_44 = ['0.2.1.3.0.2.1.3.'];
const PICK_34 = ['0.2.1.3.2.1.'];

const STYLES: Record<ResolvedStyle, StyleDef> = {
  pop: {
    kit: 1,
    drums: {
      '4/4': [
        { hat: 'X.x.X.x.X.x.X.x.', kick: 'x.......x.x.....', snare: '....X.......X...' },
        { hat: 'X.x.X.x.X.x.X.x.', kick: 'x.....x...x.....', snare: '....X.......X..g' },
      ],
      '2/4': [{ hat: 'X.x.X.x.', kick: 'x.....x.', snare: '....X...' }],
      '12/8': [{ hat: 'x.x.x.x.x.x.x.x.x.x.x.x.', kick: 'x.........x.x...........', snare: '......X...........X.....' }],
    },
    bassProgram: 34,
    bass: { '4/4': ['R-----R-R---5-a-', 'R-----R-8---5---'], '2/4': ['R-----R-'], '12/8': ['R-----------5-----a-----'] },
    keys: { program: 1, voicing: 'keys', patterns: { '4/4': ['X-..x-..X-..x-..'], '2/4': ['X-..x-..'], '12/8': ARP_128 } },
    guitar: { program: 26, voicing: 'guitar', patterns: { '4/4': ['d---d-u-.-u-d-u-'], '2/4': ['d---d-u-'], '12/8': ['d-----d-u-u-d-----d-u-u-'] } },
    pad: null,
    fill: 'snare',
    crash: true,
    drumLevel: 0.85,
  },
  rock: {
    kit: 17,
    drums: {
      '4/4': [
        { hat: 'X.x.X.x.X.x.X.x.', kick: 'x.....x.x.....x.', snare: '....X.......X...' },
        { hat: 'X.x.X.x.X.x.X.x.', kick: 'x.x...x.x.......', snare: '....X.......X...' },
      ],
      '2/4': [{ hat: 'X.x.X.x.', kick: 'x.....x.', snare: '....X...' }],
    },
    bassProgram: 35,
    bass: { '4/4': ['R-R-R-R-R-R-R-a-'], '2/4': ['R-R-R-a-'] },
    keys: { program: 1, voicing: 'keys', patterns: { '4/4': ['X---x---X---x---'], '2/4': ['X---x---'] } },
    guitar: { program: 30, voicing: 'power', patterns: { '4/4': ['d-d-d-d-d-d-d-d-'], '2/4': ['d-d-d-d-'] } },
    pad: null,
    fill: 'toms',
    crash: true,
    drumLevel: 0.95,
  },
  ballad: {
    kit: 9,
    drums: {
      '4/4': [
        { hat: 'x.g.x.g.x.g.x.g.', kick: 'x.........x.....', rim: '........x.......' },
        { hat: 'x.g.x.g.x.g.x.g.', kick: 'x.....x...x.....', rim: '........x.......' },
      ],
      '12/8': [{ hat: 'x.g.g.x.g.g.x.g.g.x.g.g.', kick: 'x.........x.............', rim: '............x...........' }],
    },
    bassProgram: 34,
    bass: { '4/4': ['R-------5-------', 'R---------------'], '12/8': ['R-----------5-----------'] },
    keys: { program: 1, voicing: 'keys', patterns: { '4/4': ARP_44, '3/4': ARP_34, '6/8': ARP_68, '12/8': ARP_128 } },
    guitar: { program: 25, voicing: 'keys', patterns: { '4/4': PICK_44, '3/4': PICK_34, '6/8': ARP_68, '12/8': ARP_128 } },
    pad: 49,
    fill: 'light',
    crash: false,
    drumLevel: 0.7,
  },
  waltz: {
    kit: 41,
    drums: { '3/4': [{ kick: 'x...........', snare: '....x...x...' }] },
    bassProgram: 33,
    bass: { '3/4': ['R---........', '5---........'] },
    keys: { program: 1, voicing: 'keys', patterns: { '3/4': ['....x-..x-..'] } },
    guitar: { program: 25, voicing: 'guitar', patterns: { '3/4': ['....d-..d-..'] } },
    pad: 49,
    fill: 'light',
    crash: false,
    drumLevel: 0.6,
  },
  swing: {
    kit: 33,
    drums: {
      '4/4': [
        { ride: 'x...x.x.x...x.x.', 'pedal-hat': '....x.......x...', kick: 'g...g...g...g...' },
        { ride: 'x...x.x.x...x.x.', 'pedal-hat': '....x.......x...', kick: 'g...g...g...g...', snare: '..........g.....' },
      ],
      '3/4': [{ ride: 'x...x.x.x.x.', 'pedal-hat': '....x...x...', kick: 'g...........' }],
    },
    bassProgram: 33,
    bass: { '4/4': ['w---w---w---a---'], '3/4': ['R-------a---'], '2/4': ['w---a---'] },
    keys: { program: 1, voicing: 'keys', patterns: { '4/4': ['X-....x-........', '......x-......x-'], '3/4': ['....x-..x-..'] } },
    guitar: { program: 27, voicing: 'guitar', patterns: { '4/4': ['d-..d-..d-..d-..'], '3/4': ['d-..d-..d-..'] } },
    pad: null,
    swing: true,
    fill: 'light',
    crash: true,
    drumLevel: 0.8,
  },
  bossa: {
    kit: 1,
    drums: {
      '4/4': [
        { rim: 'x..x..x...x..x..', kick: 'x..x....x..x....', hat: 'g.g.g.g.g.g.g.g.' },
        { rim: '..x..x...x..x...', kick: 'x..x....x..x....', hat: 'g.g.g.g.g.g.g.g.' },
      ],
    },
    bassProgram: 33,
    bass: { '4/4': ['R-----5-R-----5-'] },
    keys: { program: 5, voicing: 'keys', patterns: { '4/4': ['x-.x-.x-..x-.x-.', '..x-.x-..x-.x-..'] } },
    guitar: { program: 25, voicing: 'guitar', patterns: { '4/4': ['x-.x-.x-..x-.x-.', '..x-.x-..x-.x-..'] } },
    pad: null,
    fill: 'none',
    crash: false,
    drumLevel: 0.6,
  },
  country: {
    kit: 1,
    drums: {
      '4/4': [{ hat: 'x.x.x.x.x.x.x.x.', kick: 'x.......x.......', snare: '....x.......x...' }],
      '2/4': [{ hat: 'x.x.x.x.', kick: 'x.......', snare: '....x...' }],
    },
    bassProgram: 34,
    bass: { '4/4': ['R-------5-------', 'R-------5-----a-'], '2/4': ['R-------', '5-------'] },
    keys: { program: 1, voicing: 'keys', patterns: { '4/4': ['....x-......x-..'], '2/4': ['....x-..'] } },
    guitar: { program: 26, voicing: 'guitar', patterns: { '4/4': ['d---d-u-d---d-u-'], '2/4': ['d---d-u-'] } },
    pad: null,
    fill: 'snare',
    crash: true,
    drumLevel: 0.75,
  },
  march: {
    kit: 1,
    drums: {
      '2/4': [{ kick: 'x...x...', snare: 'X.ggx.g.' }],
      '4/4': [{ kick: 'x...x...x...x...', snare: 'X.ggx.g.X.ggx.gg' }],
      '6/8': [{ kick: 'x.....x.....', snare: 'X.gx.gX.gx.g' }],
    },
    bassProgram: 59,
    bass: { '2/4': ['R---5---'], '4/4': ['R---5---R---5---'], '6/8': ['R-----5-----'] },
    keys: { program: 62, voicing: 'keys', patterns: { '2/4': ['..x-..x-'], '4/4': ['..x-..x-..x-..x-'], '6/8': ['....x-....x-'] } },
    guitar: { program: 62, voicing: 'keys', patterns: { '2/4': ['..x-..x-'], '4/4': ['..x-..x-..x-..x-'], '6/8': ['....x-....x-'] } },
    pad: null,
    fill: 'roll',
    crash: true,
    drumLevel: 0.8,
  },
  compound: {
    kit: 9,
    drums: {
      '6/8': [
        { hat: 'x.x.x.x.x.x.', kick: 'x...........', snare: '......X.....' },
        { hat: 'x.x.x.x.x.x.', kick: 'x.......x...', snare: '......X.....' },
      ],
      '12/8': [{ hat: 'x.x.x.x.x.x.x.x.x.x.x.x.', kick: 'x...........x...x.......', snare: '......X...........X.....' }],
      '9/8': [{ hat: 'x.x.x.x.x.x.x.x.x.', kick: 'x.................', snare: '............X.....' }],
    },
    bassProgram: 34,
    bass: { '6/8': ['R-----5-----'], '12/8': ['R-----------5-----------'], '9/8': ['R-----5-----5-----'] },
    keys: { program: 1, voicing: 'keys', patterns: { '6/8': ARP_68, '12/8': ARP_128, '9/8': ARP_98 } },
    guitar: { program: 25, voicing: 'keys', patterns: { '6/8': ['0.2.1.3.2.1.'], '12/8': ARP_128, '9/8': ARP_98 } },
    pad: 49,
    fill: 'light',
    crash: false,
    drumLevel: 0.7,
  },
  gentle: {
    kit: null,
    drums: {},
    bassProgram: 33,
    bass: { '4/4': ['R---------------', 'R-------5-------'], '3/4': ['R-----------'], '6/8': ['R-----5-----'], '2/4': ['R-------'], '12/8': ['R-----------5-----------'] },
    keys: { program: 1, voicing: 'keys', patterns: { '4/4': ARP_44, '3/4': ARP_34, '6/8': ARP_68, '2/4': ['0.2.1.3.'], '12/8': ARP_128 } },
    guitar: { program: 25, voicing: 'keys', patterns: { '4/4': PICK_44, '3/4': PICK_34, '6/8': ARP_68, '2/4': ['0.2.1.3.'], '12/8': ARP_128 } },
    pad: 49,
    fill: 'none',
    crash: false,
    drumLevel: 0,
  },
};

/** Roles a style plays. */
export function styleRoles(style: ResolvedStyle): BandRole[] {
  const s = STYLES[style];
  return [...(s.kit !== null ? (['drums'] as const) : []), 'bass', 'chords', ...(s.pad !== null ? (['pad'] as const) : [])];
}

function meterKey(time: TimeSig): MeterKey | null {
  const [n, d] = time;
  if ((n === 4 && d === 4) || (n === 2 && d === 2) || (n === 4 && d === 2)) return '4/4';
  if (n === 3 && (d === 4 || d === 8 || d === 2)) return '3/4';
  if (n === 2 && (d === 4 || d === 8)) return '2/4';
  if (n === 6 && d === 8) return '6/8';
  if (n === 9 && d === 8) return '9/8';
  if (n === 12 && d === 8) return '12/8';
  return null;
}

/** The style "auto" means for this song: from its meter and tempo. */
export function resolveStyle(style: BandStyle | undefined, score: Pick<Score, 'time' | 'tempo'>): ResolvedStyle {
  if (style && style !== 'auto') return style;
  const [n, d] = score.time;
  const key = meterKey(score.time);
  if (key === '3/4') return 'waltz';
  if (key === '6/8' || key === '9/8' || key === '12/8') return 'compound';
  if (key === '2/4') return score.tempo >= 100 ? 'march' : 'country';
  if (n === 2 && d === 2) return 'country';
  if (key === '4/4') {
    if (score.tempo < 66) return 'gentle';
    if (score.tempo < 84) return 'ballad';
    return score.tempo > 150 ? 'rock' : 'pop';
  }
  return 'pop';
}

// ---------------------------------------------------------------------------
// Bars: a style's patterns for one bar, or a groove built from the beat groups
// ---------------------------------------------------------------------------

interface BarPatterns {
  drums: DrumBar | null;
  bass: string;
  comp: string;
}

/** Beat groups of a bar in steps, and the step length in ticks (eighths, or the beat). */
function beatGroups(time: TimeSig): { stepTicks: number; groups: number[] } {
  const [n, d] = time;
  const full = measureTicks(time);
  const twosThrees = (k: number): number[] => {
    if (k <= 3) return [k];
    if (k % 2 === 0) return Array(k / 2).fill(2);
    return [...Array((k - 3) / 2).fill(2), 3];
  };
  if (d === 8 && n % 3 === 0 && n > 3) return { stepTicks: full / n, groups: Array(n / 3).fill(3) };
  if (d >= 8) return { stepTicks: full / n, groups: twosThrees(n) };
  // quarter (or half) beats in eighth-note steps; odd counts of five or more lean 3 + 2
  const beats = n % 2 === 0 || n <= 3 ? Array(n).fill(1) : twosThrees(n);
  return { stepTicks: full / (n * 2), groups: beats.map(b => b * 2) };
}

function genericBar(style: ResolvedStyle, time: TimeSig): BarPatterns {
  const { groups } = beatGroups(time);
  const steps = groups.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  groups.reduce((at, g) => (starts.push(at), at + g), 0);
  const row = (fill: (i: number) => string) => Array.from({ length: steps }, (_, i) => fill(i)).join('');
  const s = STYLES[style];
  let drums: DrumBar | null = null;
  if (s.kit !== null) {
    const back = style === 'ballad' || style === 'bossa' ? 'rim' : 'snare';
    const cymbal = style === 'swing' ? 'ride' : 'hat';
    drums = {
      [cymbal]: row(i => (starts.includes(i) ? 'X' : 'x')),
      kick: row(i => (i === 0 || (style === 'rock' && starts.indexOf(i) === 1 && groups.length > 2) ? 'x' : '.')),
      [back]: row(i => (starts.indexOf(i) > 0 && (starts.indexOf(i) % 2 === 1 || starts.indexOf(i) === starts.length - 1) ? 'X' : '.')),
    };
  }
  const bass = row(i => (i === 0 ? 'R' : starts.indexOf(i) > 0 && style !== 'gentle' ? (starts.indexOf(i) % 2 ? '5' : 'R') : '-'));
  const arp = style === 'ballad' || style === 'gentle' || style === 'compound';
  const order = [0, 1, 2, 3, 2, 1];
  const comp = arp
    ? row(i => String(order[i % order.length]))
    : row(i => {
        const g = starts.indexOf(i);
        if (g < 0) return '-';
        return (style === 'waltz' || style === 'march') && g === 0 ? '.' : g === 0 ? 'X' : 'x';
      });
  return { drums, bass, comp };
}

// ---------------------------------------------------------------------------
// Voicings
// ---------------------------------------------------------------------------

/** Chord tones to voice: root, third, seventh, then fifth and the rest. */
function voicingTones(span: ChordSpan, size: number): number[] {
  const [root, third, fifth, ...rest] = span.pcs;
  const order = [root, third, ...rest.slice(0, 1), fifth, ...rest.slice(1)].filter(pc => pc !== undefined);
  const tones = order.slice(0, size);
  while (tones.length < size) tones.push(root); // triad in four voices: double the root
  return tones;
}

/** A close, voice-led chord in [lo, hi] (moves as little as possible from `prev`). */
export function closeVoicing(span: ChordSpan, size: number, prev: number[] | null, lo: number, hi: number): number[] {
  const tones = voicingTones(span, size);
  const distinct = [...new Set(tones)];
  const doubled = tones.length > distinct.length;
  const center = (lo + hi) / 2;
  let best: number[] = [];
  let bestCost = Infinity;
  for (let bottom = lo; bottom <= hi; bottom++) {
    const pc = ((bottom % 12) + 12) % 12;
    if (!distinct.includes(pc)) continue;
    // stack the other tones upward in close position
    const v = [bottom];
    const left = distinct.filter(t => t !== pc);
    let cur = bottom;
    while (left.length) {
      let nextIdx = 0;
      let nextPitch = Infinity;
      left.forEach((t, i) => {
        const p = cur + ((((t - cur) % 12) + 12) % 12 || 12);
        if (p < nextPitch) {
          nextPitch = p;
          nextIdx = i;
        }
      });
      v.push(nextPitch);
      cur = nextPitch;
      left.splice(nextIdx, 1);
    }
    if (doubled) v.push(v[0] + 12);
    const top = v[v.length - 1];
    let cost = top > hi ? (top - hi) * 3 : 0;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    if (prev && prev.length === v.length) cost += v.reduce((a, p, i) => a + Math.abs(p - prev[i]), 0);
    else cost += Math.abs(mean - center) * 1.5;
    cost += Math.abs(mean - center) * 0.25;
    if (cost < bestCost) {
      bestCost = cost;
      best = v;
    }
  }
  return best;
}

/** Broken-chord voicing: bass note, then the chord spread over the octave above. */
function openVoicing(span: ChordSpan, prevBass: number | null, lo: number, hi: number): number[] {
  const bass = place(span.bass, prevBass ?? (lo + hi) / 2, lo, hi);
  const root = bass + ((((span.root - bass) % 12) + 12) % 12);
  const third = span.pcs[1] !== undefined ? (((span.pcs[1] - span.root) % 12) + 12) % 12 : 4;
  const top = span.pcs[3] !== undefined ? (((span.pcs[3] - span.root) % 12) + 12) % 12 : span.fifth;
  return [bass, root + span.fifth < bass + 3 ? root + span.fifth + 12 : root + span.fifth, root + 12, root + 12 + third, root + 12 + top].sort((a, b) => a - b);
}

const guitarShapes = new Map<string, number[] | null>();

/** A real guitar chord shape for a strum (cached), or null for chords the chord book can't voice. */
function guitarShape(span: ChordSpan): number[] | null {
  const sym = span.symbol;
  if (!sym) return null;
  if (!guitarShapes.has(sym)) {
    let midis: number[] | null = null;
    try {
      midis = frettedVoicings(parseChordSymbol(sym), TUNINGS.guitar.open, { max: 1, maxFret: 10 })[0]?.midis ?? null;
    } catch {
      midis = null;
    }
    guitarShapes.set(sym, midis);
  }
  return guitarShapes.get(sym) ?? null;
}

/** The octave of a pitch class nearest `near`, within [lo, hi]. */
function place(pc: number, near: number, lo: number, hi: number): number {
  let best = -1;
  for (let m = lo; m <= hi; m++) {
    if (((m % 12) + 12) % 12 !== pc) continue;
    if (best < 0 || Math.abs(m - near) < Math.abs(best - near)) best = m;
  }
  return best < 0 ? lo + ((((pc - lo) % 12) + 12) % 12) : best;
}

// ---------------------------------------------------------------------------
// Arranging
// ---------------------------------------------------------------------------

export interface ArrangeOptions {
  /** Style, or "auto" (default: the song's own, else picked from meter and tempo). */
  style?: BandStyle;
  /** The instrument the player is on: the band leaves its role to them. */
  player: InstrumentId;
  /** The player strums the chords (Song Studio's "Chords"): no comping. */
  strumming?: boolean;
  /** Leave these roles out (e.g. ones the song's own band parts already play). */
  skip?: BandRole[];
  /** Other music sounding with the song (band parts), to work out chords from. */
  extra?: Score[];
  seed?: number;
}

interface Ctx {
  song: SongDef;
  score: Score;
  style: ResolvedStyle;
  def: StyleDef;
  spans: ChordSpan[];
  /** Start tick of each measure (+ the end). */
  starts: number[];
  lens: number[];
  /** Measures that end a phrase (fill) / start one (crash). */
  phraseEnd: Set<number>;
  phraseStart: Set<number>;
  /** Bar index within its phrase (for pattern variation). */
  inPhrase: number[];
  last: number;
  first: number;
  /** Keyboard or guitar comping, whichever the player isn't playing. */
  comp: CompDef;
}

/** One bar's patterns for a style (its own for the meter, else a generic groove). */
function barPatterns(c: Ctx, m: number): BarPatterns {
  const time = timeAt(c.score, m);
  const key = meterKey(time);
  const generic = genericBar(c.style, time);
  const pick = <T>(list: T[] | undefined): T | undefined => (list?.length ? list[c.inPhrase[m] % list.length] : undefined);
  const comp = c.comp;
  return {
    drums: c.def.kit === null ? null : (key && pick(c.def.drums[key])) || generic.drums,
    bass: (key && pick(c.def.bass[key])) || generic.bass,
    comp: (key && pick(comp.patterns[key])) || generic.comp,
  };
}

/** Walk a pattern: each note-starting step with its tick, its character and how long it lasts. */
function patternEvents(pattern: string, barStart: number, barLen: number, fullLen: number): { tick: number; ch: string; ticks: number }[] {
  const out: { tick: number; ch: string; ticks: number }[] = [];
  const step = fullLen / pattern.length;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '.' || ch === '-') continue;
    let k = i + 1;
    while (k < pattern.length && pattern[k] === '-') k++;
    const t = Math.round(i * step);
    if (t >= barLen) break;
    out.push({ tick: barStart + t, ch, ticks: Math.min(Math.round(k * step), barLen) - t });
  }
  return out;
}

const DRUM_VEL: Record<string, number> = { X: 1, x: 0.78, g: 0.38 };

function drumTrack(c: Ctx, rng: () => number): PerfNote[] {
  const notes: PerfNote[] = [];
  const level = c.def.drumLevel;
  const hit = (tick: number, name: string, v: number) => {
    const key = drumKeyOf(name);
    if (key !== null) notes.push({ tick, ticks: PPQ / 4, midi: key, velocity: Math.min(1, v * level) });
  };
  for (let m = c.first; m <= c.last; m++) {
    const start = c.starts[m];
    const len = c.lens[m];
    const time = timeAt(c.score, m);
    const full = measureTicks(time);
    const beat = beatTicks(time);
    if (m === c.last) {
      // the last bar: one big hit, and let it ring
      hit(start, 'kick', 0.95);
      hit(start, c.style === 'swing' ? 'ride' : 'crash', c.style === 'ballad' || c.style === 'waltz' ? 0.6 : 0.85);
      continue;
    }
    const bar = barPatterns(c, m).drums;
    if (!bar) continue;
    const fillFrom = c.phraseEnd.has(m) && c.def.fill !== 'none' ? fillStart(c, len, beat) : Infinity;
    for (const [name, row] of Object.entries(bar)) {
      for (const e of patternEvents(row, start, len, full)) {
        if (e.tick - start >= fillFrom && name !== 'kick') continue;
        hit(e.tick, name, DRUM_VEL[e.ch] ?? 0.78);
      }
    }
    if (c.phraseStart.has(m) && c.def.crash && m !== c.first) {
      hit(start, 'crash', 0.8);
      if (!Object.keys(bar).includes('kick') || !bar.kick.startsWith('x')) hit(start, 'kick', 0.85);
    }
    if (fillFrom < len) fill(c, start + fillFrom, start + len, beat, rng, hit);
  }
  return notes;
}

function fillStart(c: Ctx, len: number, beat: number): number {
  const beats = Math.round(len / beat);
  const n = c.def.fill === 'toms' && beats >= 4 ? 2 : 1;
  return len - n * beat;
}

function fill(c: Ctx, from: number, to: number, beat: number, rng: () => number, hit: (t: number, name: string, v: number) => void) {
  const compound = beat % 3 === 0 && beat !== PPQ;
  const step = compound ? beat / 3 : c.def.fill === 'light' ? beat / 2 : beat / 4;
  const steps = Math.round((to - from) / step);
  const variant = Math.floor(rng() * 3);
  for (let i = 0; i < steps; i++) {
    const t = from + i * step;
    const v = 0.55 + (0.4 * i) / Math.max(1, steps - 1);
    if (c.def.fill === 'light') {
      if (i % 2 === 0 || i === steps - 1) hit(t, 'snare', v * 0.8);
    } else if (c.def.fill === 'roll') {
      hit(t, 'snare', v);
      if (i === steps - 1 || step >= PPQ / 4) hit(t + step / 2, 'snare', v * 0.7);
    } else if (c.def.fill === 'toms' || variant === 2) {
      const toms = ['snare', 'tom-hi', 'tom-himid', 'tom-lomid', 'tom-lo', 'floor-hi', 'floor-lo'];
      hit(t, toms[Math.min(toms.length - 1, Math.floor((i * toms.length) / steps))], v);
    } else if (variant === 1) {
      hit(t, i % 4 === 3 ? 'kick' : 'snare', v);
    } else hit(t, 'snare', v);
  }
}

function bassTrack(c: Ctx, rng: () => number): PerfNote[] {
  const notes: PerfNote[] = [];
  const [lo, hi] = c.def.bassProgram === 59 ? [29, 53] : [28, 50];
  let prev = 40;
  for (let m = c.first; m <= c.last; m++) {
    const start = c.starts[m];
    const len = c.lens[m];
    const full = measureTicks(timeAt(c.score, m));
    const events = m === c.last ? [{ tick: start, ch: 'R', ticks: len }] : patternEvents(barPatterns(c, m).bass, start, len, full);
    // the bass moves with the harmony: a chord that starts between pattern notes gets its root
    for (const s of c.spans) {
      if (s.tick > start && s.tick < start + len && !events.some(e => e.tick === s.tick)) events.push({ tick: s.tick, ch: 'R', ticks: start + len - s.tick });
    }
    events.sort((a, b) => a.tick - b.tick);
    events.forEach((e, i) => {
      const chord = chordAt(c.spans, e.tick);
      if (!chord || chord.root < 0) return;
      let end = Math.min(e.tick + e.ticks, events[i + 1]?.tick ?? Infinity, chord.tick + chord.ticks);
      if (end <= e.tick) end = e.tick + PPQ / 4;
      const atChange = e.tick === chord.tick;
      const next = chordAt(c.spans, chord.tick + chord.ticks);
      let pitch: number;
      switch (atChange && e.ch !== 'a' ? 'R' : e.ch) {
        case '5':
          pitch = place((chord.root + chord.fifth) % 12, prev, lo, hi);
          break;
        case '3':
          pitch = place(chord.pcs[1] ?? chord.root, prev, lo, hi);
          break;
        case '7':
          pitch = chord.pcs[3] !== undefined ? place(chord.pcs[3], prev, lo, hi) : place(chord.root, prev + 12, lo, hi);
          break;
        case '8':
          pitch = prev + 12 <= hi && ((prev % 12) + 12) % 12 === chord.root ? prev + 12 : place(chord.root, prev, lo, hi);
          break;
        case 'a': {
          const target = next && next.root >= 0 ? place(next.bass, prev, lo, hi) : place(chord.root, prev, lo, hi);
          pitch = target === prev ? place((chord.root + chord.fifth) % 12, prev - 5, lo, hi) : target + (target > prev ? -1 : 1);
          break;
        }
        case 'w': {
          const toward = next && next.root >= 0 && e.tick + e.ticks >= chord.tick + chord.ticks - PPQ ? place(next.bass, prev, lo, hi) : place(chord.root, prev + 7, lo, hi);
          const choices = [...chord.pcs, ...[2, 9].map(x => (chord.root + x) % 12)].flatMap(pc => [-12, 0, 12].map(o => place(pc, prev, lo, hi) + o)).filter(p => p >= lo && p <= hi && p !== prev && Math.abs(p - prev) <= 7);
          pitch = choices.length ? choices.reduce((b, p) => (Math.abs(p - (prev + toward) / 2) + rng() * 0.8 < Math.abs(b - (prev + toward) / 2) ? p : b)) : place(chord.root, prev, lo, hi);
          break;
        }
        default:
          pitch = place(chord.bass, prev, lo, hi);
      }
      prev = pitch;
      const accent = e.tick === start ? 0.82 : 0.72;
      notes.push({ tick: e.tick, ticks: Math.max(PPQ / 8, end - e.tick - 2), midi: pitch, velocity: accent });
    });
  }
  return notes;
}

function compTrack(c: Ctx, comp: CompDef): PerfNote[] {
  const notes: PerfNote[] = [];
  let prevVoicing: number[] | null = null;
  let prevBass: number | null = null;
  const voicingCache = new Map<ChordSpan, number[]>();
  const voicingFor = (span: ChordSpan, arp: boolean): number[] => {
    const cached = voicingCache.get(span);
    if (cached) return cached;
    let v: number[] | null = null;
    if (arp) {
      v = openVoicing(span, prevBass, comp.program === 25 ? 40 : 43, 55);
      prevBass = v[0];
    } else if (comp.voicing === 'guitar') v = guitarShape(span);
    else if (comp.voicing === 'power') {
      const r = place(span.bass, prevBass ?? 45, 40, 52);
      v = [r, r + 7, r + 12];
      prevBass = r;
    }
    if (!v) {
      v = closeVoicing(span, comp.program === 62 ? 3 : 4, prevVoicing, comp.program === 62 ? 55 : 53, 72);
      prevVoicing = v;
    }
    voicingCache.set(span, v);
    return v;
  };
  for (let m = c.first; m <= c.last; m++) {
    const start = c.starts[m];
    const len = c.lens[m];
    const full = measureTicks(timeAt(c.score, m));
    const pattern = barPatterns(c, m).comp;
    const arp = /\d/.test(pattern);
    let events = m === c.last ? [{ tick: start, ch: 'X', ticks: len }] : patternEvents(pattern, start, len, full);
    if (!arp) {
      for (const s of c.spans) {
        if (s.tick > start && s.tick < start + len && !events.some(e => e.tick === s.tick)) events.push({ tick: s.tick, ch: 'x', ticks: start + len - s.tick });
      }
      events = events.sort((a, b) => a.tick - b.tick);
    }
    events.forEach((e, i) => {
      const chord = chordAt(c.spans, e.tick);
      if (!chord || chord.root < 0) return;
      const chordEnd = chord.tick + chord.ticks;
      const v = voicingFor(chord, arp && m !== c.last);
      if (/\d/.test(e.ch)) {
        const idx = Math.min(Number(e.ch), v.length - 1);
        // broken chords ring on, as with the sustain pedal down, until the chord changes
        const end = Math.min(chordEnd, e.tick + 2 * PPQ, start + len);
        notes.push({ tick: e.tick, ticks: Math.max(PPQ / 4, end - e.tick), midi: v[idx], velocity: e.tick === start ? 0.72 : 0.6 });
        return;
      }
      const end = Math.min(e.tick + e.ticks, events[i + 1]?.tick ?? Infinity, chordEnd);
      const ticks = Math.max(PPQ / 8, end - e.tick - 2);
      const vel = e.ch === 'X' ? 0.68 : e.ch === 'u' ? 0.45 : 0.56;
      const up = e.ch === 'u';
      const strum = e.ch === 'd' || e.ch === 'u' ? 0.011 : comp.voicing === 'guitar' ? 0.006 : 0;
      // an up-strum catches only the top strings
      const strings = up ? v.slice(Math.max(0, v.length - 4)) : v;
      const order = up ? [...strings].reverse() : strings;
      order.forEach((midi, k) => notes.push({ tick: e.tick, ticks, midi, velocity: vel * (k === 0 || up ? 1 : 0.92), offset: k * strum }));
    });
  }
  return notes;
}

function padTrack(c: Ctx): PerfNote[] {
  const notes: PerfNote[] = [];
  let prev: number[] | null = null;
  const from = c.starts[c.first];
  const to = c.starts[c.last + 1];
  for (const s of c.spans) {
    if (s.root < 0) continue;
    const a = Math.max(s.tick, from);
    const b = Math.min(s.tick + s.ticks, to);
    if (b <= a) continue;
    const v = closeVoicing(s, 3, prev, 55, 76);
    prev = v;
    for (const midi of v) notes.push({ tick: a, ticks: b - a - 1, midi, velocity: 0.45 });
  }
  return notes;
}

/** Small timing and level differences, as players have (seeded). */
function humanise(notes: PerfNote[], rng: () => number, timing: number, level: number): PerfNote[] {
  const gauss = () => (rng() + rng() + rng() - 1.5) / 1.5;
  return notes
    .map(n => ({ ...n, offset: (n.offset ?? 0) + gauss() * timing, velocity: Math.max(0.05, Math.min(1, n.velocity * (1 + gauss() * level))) }))
    .sort((a, b) => a.tick - b.tick || (a.offset ?? 0) - (b.offset ?? 0));
}

/** An automatic band for a song (only the roles that aren't skipped). */
export function arrange(song: SongDef, score: Score, opts: ArrangeOptions): Arrangement {
  const style = resolveStyle(opts.style ?? song.style, score);
  const def = STYLES[style];
  const { spans, inferred } = songChordSpans(song, score, opts.extra);
  const lens = measureLengths(score.time, score.measures, score.pickup, score.changes);
  const starts = [0];
  for (const l of lens) starts.push(starts[starts.length - 1] + l);
  const phrases = songSections(song, score);
  const phraseEnd = new Set(phrases.slice(0, -1).map(p => p.to - 1));
  const phraseStart = new Set(phrases.map(p => p.from - 1));
  const inPhrase = lens.map((_, m) => {
    const p = phrases.find(x => m >= x.from - 1 && m <= x.to - 1);
    return p ? m - (p.from - 1) : m;
  });
  // the band comes in on the first full bar: a pickup is the soloist's
  const first = score.pickup && score.measures > 1 ? 1 : 0;
  const family = familyOf(opts.player);
  const comp = family === 'keyboard' || family === 'mallet' ? def.guitar : def.keys;
  const c: Ctx = { song, score, style, def, spans, starts, lens, phraseEnd, phraseStart, inPhrase, last: score.measures - 1, first, comp };
  const skip = new Set<BandRole>(opts.skip ?? []);
  if (opts.player === 'bass') skip.add('bass');
  if (opts.strumming) skip.add('chords');
  const seed = opts.seed ?? 7;
  const tracks: PerfTrack[] = [];
  const add = (role: BandRole, program: number, drums: boolean, notes: PerfNote[], volume: number, name?: string) => {
    if (!notes.length) return;
    tracks.push({ id: `auto:${role}`, name: name ?? ROLE_NAMES[role], role, program, drums, source: 'auto', notes, volume, pan: rolePan(role, tracks.length) });
  };
  if (spans.length && score.measures > first) {
    if (def.kit !== null && !skip.has('drums')) add('drums', def.kit, true, humanise(drumTrack(c, mulberry32(seed)), mulberry32(seed + 1), 0.004, 0.06), 0.72);
    if (!skip.has('bass')) add('bass', def.bassProgram, false, humanise(bassTrack(c, mulberry32(seed + 2)), mulberry32(seed + 3), 0.005, 0.05), 0.8);
    if (!skip.has('chords')) add('chords', comp.program, false, humanise(compTrack(c, comp), mulberry32(seed + 4), 0.006, 0.05), 0.6, shortName(comp.program));
    if (def.pad !== null && !skip.has('pad')) add('pad', def.pad, false, padTrack(c), 0.6, shortName(def.pad));
  }
  return { style, swing: !!def.swing, tracks, inferredChords: inferred };
}

/** "Steel Guitar" → "Guitar", "String Ensemble 1" → "Strings": short names for the mixer. */
function shortName(program: number): string {
  const n = gmProgramName(program);
  if (/string ensemble|strings/i.test(n)) return 'Strings';
  if (/guitar/i.test(n)) return 'Guitar';
  if (/electric piano/i.test(n)) return 'Electric piano';
  if (/piano/i.test(n)) return 'Piano';
  if (/brass/i.test(n)) return 'Brass';
  if (/pad/i.test(n)) return 'Pad';
  return n;
}

// ---------------------------------------------------------------------------
// The song's own band parts, the player's part, and the whole band
// ---------------------------------------------------------------------------

/** Accent the beats a little: written parts carry no dynamics. */
function metricVelocity(tick: number, beat: number, base: number): number {
  if (tick % (beat * 2) === 0) return Math.min(1, base + 0.06);
  if (tick % beat === 0) return base;
  return base - 0.06;
}

/** A score's notes as performance notes (ties joined). */
export function scoreNotes(score: Score, base = 0.7): PerfNote[] {
  const beat = beatTicks(score.time);
  const out: PerfNote[] = [];
  for (const st of buildSteps(score)) for (const n of st.notes) out.push({ tick: st.tick, ticks: n.ticks, midi: n.midi, velocity: metricVelocity(st.tick - (score.pickup ?? 0), beat, base) });
  return out;
}

/** The song's own band parts as tracks. */
export function songBandTracks(song: SongDef): { tracks: PerfTrack[]; scores: Score[] } {
  const tracks: PerfTrack[] = [];
  const scores: Score[] = [];
  song.band?.forEach((part, i) => {
    let sc: Score;
    try {
      sc = bandPartScore(song, part, i);
    } catch {
      return;
    }
    scores.push(sc);
    const role = inferRole(part, sc);
    tracks.push({
      id: `song:${i}`,
      name: part.name,
      role,
      program: part.program,
      drums: !!part.drums,
      source: 'song',
      notes: scoreNotes(sc, part.drums ? 0.75 : 0.68),
      volume: part.volume ?? 0.8,
      pan: part.pan ?? rolePan(role, i),
    });
  });
  return { tracks, scores };
}

/** The player's part as a track (for "listen with the band"). */
export function partTrack(score: Score, program: number, name: string): PerfTrack {
  return { id: 'part', name, role: 'part', program, drums: false, source: 'part', notes: scoreNotes(score, 0.72), volume: 0.9, pan: 0 };
}

export type BandSource = 'song' | 'auto' | 'both';

export interface BandOptions extends ArrangeOptions {
  /** The song's own band parts, the arranger's, or both (the arranger fills the roles the song's parts don't play). */
  source?: BandSource;
}

/** Which band a song gets by default: its own parts when it has them. */
export function defaultSource(song: SongDef): BandSource {
  return song.band?.length ? 'song' : 'auto';
}

/** The whole band for a song. */
export function buildBand(song: SongDef, score: Score, opts: BandOptions): Arrangement {
  const source = opts.source ?? defaultSource(song);
  const own = source === 'auto' ? { tracks: [], scores: [] } : songBandTracks(song);
  if (source === 'song' && own.tracks.length) {
    const style = resolveStyle(opts.style ?? song.style, score);
    return { style, swing: style === 'swing', tracks: own.tracks, inferredChords: false };
  }
  const covered = own.tracks.map(t => t.role).filter((r): r is BandRole => r !== 'part');
  // a song part playing chords covers the pad too, and the other way round
  if (covered.includes('chords') || covered.includes('pad')) covered.push('chords', 'pad');
  const auto = arrange(song, score, { ...opts, skip: [...(opts.skip ?? []), ...covered], extra: own.scores });
  return { ...auto, tracks: [...own.tracks, ...auto.tracks] };
}

/** Tracks cut to measures [from, to] (0-based, inclusive) and moved to start at tick 0 — for practising a passage. */
export function sliceTracks(tracks: PerfTrack[], fromTick: number, toTick: number): PerfTrack[] {
  return tracks.map(t => ({
    ...t,
    notes: t.notes.filter(n => n.tick >= fromTick && n.tick < toTick).map(n => ({ ...n, tick: n.tick - fromTick, ticks: Math.min(n.ticks, toTick - n.tick) })),
  }));
}
