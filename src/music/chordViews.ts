/**
 * Chord chart views: every way the chord book voices a chord, turned into what the
 * chart draws — a chord box for fretted instruments, marked keys or bars for piano and
 * mallets — with finger, interval and note-name labels and the notes to play back.
 */
import { type ChordSymbol, chordDegreeLabels, parseChordSymbol, rootLabel, rootPc, spellChordTone } from './chords';
import { bassShapes, frettedVoicings, malletVoicings, pianoVoicings } from './chordbook';
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

function frettedViews(chord: ChordSymbol, instrument: InstrumentId, prefs: InstrumentPrefs): FrettedView[] {
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
  const voicings = frettedVoicings(chord, tuning, { max: instrument === 'bass' ? 4 : 8, instrument: instrument as 'guitar' | 'ukulele' | 'bass' });
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
export function chordViews(chord: ChordSymbol, instrument: InstrumentId, prefs: InstrumentPrefs, opts: { hand?: PianoHand } = {}): ChordView[] {
  try {
    if (isFretted(instrument)) return frettedViews(chord, instrument, prefs);
    if (instrument === 'mallets') return malletViews(chord, prefs);
    return pianoViews(chord, opts.hand ?? 'R');
  } catch {
    return [];
  }
}

/** Parse a chord symbol, or null. */
export function tryChord(sym: string): ChordSymbol | null {
  try {
    return parseChordSymbol(sym);
  } catch {
    return null;
  }
}

/** Chord tones spelled from the root (with a slash bass first), e.g. "E · C E G". */
export function chordToneLine(chord: ChordSymbol): string {
  const tones = chord.quality.tones.map(t => rootLabel(spellChordTone(chord.root, t)));
  return (chord.bass ? `${rootLabel(chord.bass)} · ` : '') + tones.join(' ');
}
