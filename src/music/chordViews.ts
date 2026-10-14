/**
 * Chord chart views: every way the chord book voices a chord, turned into what the
 * chart draws — a chord box for fretted instruments, marked keys or bars for piano and
 * mallets — with finger, interval and note-name labels and the notes to play back.
 */
import { type ChordSymbol, chordDegreeLabels, parseChordSymbol, rootLabel, rootPc, spellChordTone } from './chords';
import { type FrettedVoicing, bassShapes, chartString, frettedVoicings, malletVoicings, parseChart, pianoVoicings } from './chordbook';
import { type InstrumentId, type InstrumentPrefs, isFretted, malletVariant, tuningFor } from './instruments';
import { spellMidi, stepLabel } from './pitch';

export type LabelMode = 'fingers' | 'degrees' | 'notes';
export type PianoHand = 'R' | 'L';

export interface FretNote {
  /** 1 = highest course */
  string: number;
  fret: number;
  /** fretting finger 1–4, 0 open */
  finger: number | null;
  degree: string;
  name: string;
}

export interface FrettedView {
  kind: 'fretted';
  label: string;
  strings: number;
  notes: FretNote[];
  muted: number[];
  barres: { fret: number; fromString: number; toString: number; finger: number }[];
  baseFret: number;
  /** names of the strings, string 1 first */
  stringNames: string[];
  /** notes to play, in the order they are struck */
  midis: number[];
  /** played one note at a time rather than strummed */
  arpeggio: boolean;
}

export interface KeyNote {
  midi: number;
  hand: 'R' | 'L';
  /** piano finger 1–5 */
  finger?: number;
  /** mallet 1–4 */
  mallet?: number;
  degree: string;
  name: string;
}

export interface KeysView {
  kind: 'keys';
  label: string;
  notes: KeyNote[];
  midis: number[];
  arpeggio: boolean;
  /** mallet voicings: two or four mallets */
  mallets?: 2 | 4;
}

export type ChordView = FrettedView | KeysView;

const INTERVALS = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'];
const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** Interval label and spelled name of a pitch class within a chord. */
export function toneInfo(chord: ChordSymbol, pc: number): { degree: string; name: string } {
  const r = rootPc(chord.root);
  const labels = chordDegreeLabels(chord.quality);
  const i = chord.quality.tones.findIndex(([s]) => mod12(r + s) === pc);
  if (i >= 0) return { degree: labels[i], name: rootLabel(spellChordTone(chord.root, chord.quality.tones[i])) };
  if (chord.bass && rootPc(chord.bass) === pc) return { degree: INTERVALS[mod12(pc - r)], name: rootLabel(chord.bass) };
  const p = spellMidi(60 + pc, chord.root.alter < 0 ? -3 : 0);
  return { degree: INTERVALS[mod12(pc - r)], name: stepLabel(p.step, p.alter) };
}

function stringNamesOf(tuning: readonly number[]): string[] {
  return tuning.map(m => {
    const p = spellMidi(m);
    return stepLabel(p.step, p.alter);
  });
}

/**
 * A chord as lessons name it: a symbol, optionally with the chart of the shape to use —
 * "F:xx3211" is the small F, "F" the engine's first choice. The chart applies when the
 * player's tuning has that shape among its voicings.
 */
export function parseChordRef(ref: string): { symbol: string; chart?: string; fingers?: string } {
  const [symbol, chart, fingers] = ref.split(':');
  return { symbol, chart: chart || undefined, fingers: fingers || undefined };
}

/**
 * A voicing written as a chart ("320033", lowest string first) with optional fingers
 * ("210034"; 0 open). Used when a lesson asks for a shape the chord book didn't list.
 */
export function voicingFromChart(chord: ChordSymbol, tuning: readonly number[], chart: string, fingerChart?: string): FrettedVoicing | null {
  const frets = parseChart(chart);
  if (frets.length !== tuning.length || frets.some(f => f !== null && (Number.isNaN(f) || f < 0))) return null;
  const given = fingerChart ? parseChart(fingerChart) : null;
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const hi = fretted.length ? Math.max(...fretted) : 1;
  const fingers = frets.map((f, i) => (f === null ? null : f === 0 ? 0 : given?.[i] ?? Math.min(4, f - lo + 1)));
  const midis = frets.flatMap((f, i) => (f === null ? [] : [tuning[i] + f])).sort((a, b) => a - b);
  const r = rootPc(chord.root);
  const lowest = frets.reduce<{ i: number; m: number } | null>((best, f, i) => (f === null ? best : !best || tuning[i] + f < best.m ? { i, m: tuning[i] + f } : best), null);
  return {
    frets,
    fingers,
    barres: [],
    baseFret: hi <= 4 ? 1 : lo,
    midis,
    degrees: frets.map((f, i) => (f === null ? null : toneInfo(chord, mod12(tuning[i] + f)).degree)),
    bassIsRoot: !!lowest && mod12(lowest.m) === r,
    ease: 0.5,
    label: 'Chart',
  };
}

/** Fretted voicings, with the one matching `chart` (if any) first. */
export function frettedVoicingsFor(chord: ChordSymbol, tuning: readonly number[], instrument: 'guitar' | 'ukulele' | 'bass', max: number, chart?: string, fingers?: string): FrettedVoicing[] {
  const list = frettedVoicings(chord, tuning, { max: chart ? Math.max(max, 16) : max, instrument });
  if (!chart) return list;
  const i = list.findIndex(v => chartString(v.frets) === chart);
  if (i > 0) list.unshift(...list.splice(i, 1));
  if (i < 0) {
    const v = voicingFromChart(chord, tuning, chart, fingers);
    if (v) list.unshift(v);
  }
  return list.slice(0, Math.max(max, 1));
}

function frettedViews(chord: ChordSymbol, instrument: InstrumentId, prefs: InstrumentPrefs, chart?: string, fingers?: string): FrettedView[] {
  const tuning = tuningFor(instrument, prefs).open;
  const names = stringNamesOf(tuning);
  const n = tuning.length;
  const out: FrettedView[] = [];
  if (instrument === 'bass') {
    for (const s of bassShapes(chord, tuning)) {
      const notes = s.positions.map(p => ({ string: p.string, fret: p.fret, finger: p.finger, ...toneInfo(chord, mod12(tuning[p.string - 1] + p.fret)) }));
      const fretted = notes.filter(x => x.fret > 0).map(x => x.fret);
      const lo = fretted.length ? Math.min(...fretted) : 1;
      const hi = fretted.length ? Math.max(...fretted) : 1;
      out.push({
        kind: 'fretted',
        label: s.name,
        strings: n,
        notes,
        muted: [],
        barres: [],
        baseFret: hi <= 4 ? 1 : lo,
        stringNames: names,
        midis: s.positions.map(p => tuning[p.string - 1] + p.fret),
        arpeggio: true,
      });
    }
  }
  const voicings = frettedVoicingsFor(chord, tuning, instrument as 'guitar' | 'ukulele' | 'bass', instrument === 'bass' ? 4 : 8, chart, fingers);
  for (const v of voicings) {
    const notes: FretNote[] = [];
    const muted: number[] = [];
    v.frets.forEach((f, i) => {
      if (f === null) muted.push(i + 1);
      else notes.push({ string: i + 1, fret: f, finger: v.fingers[i], ...toneInfo(chord, mod12(tuning[i] + f)) });
    });
    // strum from the lowest-pitched string up (re-entrant ukulele: string 4 first)
    const strum = [...notes].sort((a, b) => b.string - a.string).map(x => tuning[x.string - 1] + x.fret);
    out.push({
      kind: 'fretted',
      label: instrument === 'bass' ? `Chord shape · ${v.label}` : v.label,
      strings: n,
      notes,
      muted,
      barres: v.barres.map(b => ({ fret: b.fret, fromString: b.fromString, toString: b.toString, finger: b.finger })),
      baseFret: v.baseFret,
      stringNames: names,
      midis: strum,
      arpeggio: false,
    });
  }
  return out;
}

function pianoViews(chord: ChordSymbol, hand: PianoHand): KeysView[] {
  return pianoVoicings(chord).map(v => {
    const both = v.lh.length < v.rh.length;
    const notes: KeyNote[] = [];
    const add = (midis: number[], fingers: number[], h: 'R' | 'L') => midis.forEach((m, i) => notes.push({ midi: m, hand: h, finger: fingers[i], ...toneInfo(chord, mod12(m)) }));
    if (both) {
      add(v.lh, v.lhFingers, 'L');
      add(v.rh, v.rhFingers, 'R');
    } else if (hand === 'L') add(v.lh, v.lhFingers, 'L');
    else add(v.rh, v.rhFingers, 'R');
    notes.sort((a, b) => a.midi - b.midi);
    return { kind: 'keys', label: v.name, notes, midis: notes.map(x => x.midi), arpeggio: false };
  });
}

function malletViews(chord: ChordSymbol, prefs: InstrumentPrefs): KeysView[] {
  const v = malletVariant(prefs);
  const low = Math.max(v.low, 48);
  const high = Math.min(v.high, 88);
  return malletVoicings(chord, { low, high }).map(mv => {
    const notes = mv.midis.map((m, i) => ({ midi: m, hand: (mv.mallets[i] <= 2 ? 'L' : 'R') as 'L' | 'R', mallet: mv.mallets[i], ...toneInfo(chord, mod12(m)) }));
    return { kind: 'keys', label: `${mv.name}${mv.count === 4 ? '' : ' · two mallets'}`, notes, midis: mv.midis, arpeggio: mv.name.startsWith('Arpeggio'), mallets: mv.count };
  });
}

/** Every voicing of a chord for an instrument, most useful first. */
export function chordViews(chord: ChordSymbol, instrument: InstrumentId, prefs: InstrumentPrefs, opts: { hand?: PianoHand; chart?: string; fingers?: string } = {}): ChordView[] {
  try {
    if (isFretted(instrument)) {
      const views = frettedViews(chord, instrument, prefs, opts.chart, opts.fingers);
      // a chosen chord shape comes before the bass guitar's arpeggio boxes
      if (opts.chart && instrument === 'bass') {
        const i = views.findIndex(v => !v.arpeggio);
        if (i > 0) views.unshift(...views.splice(i, 1));
      }
      return views;
    }
    if (instrument === 'mallets') return malletViews(chord, prefs);
    return pianoViews(chord, opts.hand ?? 'R');
  } catch {
    return [];
  }
}

/** Parse a chord symbol (or chord reference), or null. */
export function tryChord(sym: string): ChordSymbol | null {
  try {
    return parseChordSymbol(parseChordRef(sym).symbol);
  } catch {
    return null;
  }
}

/** Chord tones spelled from the root (with a slash bass first), e.g. "E · C E G". */
export function chordToneLine(chord: ChordSymbol): string {
  const tones = chord.quality.tones.map(t => rootLabel(spellChordTone(chord.root, t)));
  return (chord.bass ? `${rootLabel(chord.bass)} · ` : '') + tones.join(' ');
}
