/**
 * Chord practice scores, built at run time for the player's instrument and tuning (so a
 * low-G or baritone ukulele, or a five-string bass, gets its own shapes):
 *
 *   pick   each note of the chord on its own, low string to high, then the whole chord —
 *          the way teachers check that every string rings clearly
 *   strum  one chord per bar in a strumming rhythm, cycling through the chords — changes
 *   song   strum along with a library song: its chord line becomes the learner's part and
 *          the app plays the tune
 *
 * Every chord note carries its finger and string, so the fretboard shows the shape and the
 * auto-fingering leaves it alone.
 */
import { getSong } from '../content/songs';
import { bassShapes, malletVoicings, pianoVoicings } from '../music/chordbook';
import { frettedVoicingsFor, parseChordRef } from '../music/chordViews';
import { type ChordSymbol, parseChordSymbol, rootPc, spellChordTone } from '../music/chords';
import { type InstrumentId, type InstrumentPrefs, isFretted, malletVariant, tuningFor } from '../music/instruments';
import { type SongDef, songToScore } from '../music/parse';
import { STEP_SEMIS, type Step, spellMidi } from '../music/pitch';
import { type TimeSig, beatTicks, measureTicks, splitTicks } from '../music/rhythm';
import { type Clef, type Score, measureStartTick } from '../music/score';
import { parseChordTimeline } from '../songs/format';
import type { ActivityDef } from './types';

type ChordPlayDef = Extract<ActivityDef, { type: 'chord-play' }>;

export interface ShapeNote {
  midi: number;
  /** text-notation pitch, e.g. "Eb4" */
  name: string;
  finger?: number;
  string?: number;
  root?: boolean;
}

export interface ChordShape {
  symbol: string;
  /** in playing order: low string to high (fretted), low to high (keys) */
  notes: ShapeNote[];
}

const mod12 = (x: number) => ((x % 12) + 12) % 12;
const ACC: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

function named(step: Step, alter: number, midi: number): string {
  const octave = Math.round((midi - STEP_SEMIS[step] - alter) / 12) - 1;
  return `${step}${ACC[alter] ?? ''}${octave}`;
}

/** Spell a MIDI note as a tone of the chord (C dim7's B𝄫, not A). */
export function chordNoteName(chord: ChordSymbol, midi: number): string {
  const r = rootPc(chord.root);
  const tone = chord.quality.tones.find(([s]) => mod12(r + s) === mod12(midi));
  if (tone) {
    const t = spellChordTone(chord.root, tone);
    return named(t.step, t.alter, midi);
  }
  if (chord.bass && rootPc(chord.bass) === mod12(midi)) return named(chord.bass.step, chord.bass.alter, midi);
  const p = spellMidi(midi, chord.root.alter < 0 ? -3 : 0);
  return named(p.step, p.alter, midi);
}

/** The first (easiest) voicing of a chord on an instrument, as notes with fingers and strings. */
export function chordShape(ref: string, instrument: InstrumentId, prefs: InstrumentPrefs = {}): ChordShape | null {
  const { symbol, chart, fingers } = parseChordRef(ref);
  let chord: ChordSymbol;
  try {
    chord = parseChordSymbol(symbol);
  } catch {
    return null;
  }
  const note = (midi: number, extra: Partial<ShapeNote> = {}): ShapeNote => ({ midi, name: chordNoteName(chord, midi), root: mod12(midi) === rootPc(chord.root), ...extra });
  if (instrument === 'bass') {
    const tuning = tuningFor('bass', prefs).open;
    const shape = bassShapes(chord, tuning)[0];
    if (!shape) return null;
    return { symbol, notes: shape.positions.map(p => note(tuning[p.string - 1] + p.fret, { finger: p.finger, string: p.string })) };
  }
  if (isFretted(instrument)) {
    const tuning = tuningFor(instrument, prefs).open;
    const v = frettedVoicingsFor(chord, tuning, instrument as 'guitar' | 'ukulele', 1, chart, fingers)[0];
    if (!v) return null;
    const notes: ShapeNote[] = [];
    // low string first: the order of a down-strum
    for (let i = v.frets.length - 1; i >= 0; i--) {
      const f = v.frets[i];
      if (f === null) continue;
      notes.push(note(tuning[i] + f, { finger: v.fingers[i] ?? 0, string: i + 1 }));
    }
    return { symbol, notes };
  }
  if (instrument === 'mallets') {
    const mv = malletVariant(prefs);
    const v = malletVoicings(chord, { low: Math.max(mv.low, 48), high: Math.min(mv.high, 88) }).find(x => x.count === 4);
    if (!v) return null;
    return { symbol, notes: v.midis.map((m, i) => note(m, { finger: v.mallets[i] })) };
  }
  const voicings = pianoVoicings(chord);
  const v = voicings.find(x => x.lh.length === x.rh.length) ?? voicings[0];
  return { symbol, notes: v.rh.map((m, i) => note(m, { finger: v.rhFingers[i] })) };
}

/** One chord as a text-notation token: "[C3 E3 G3 C4 E4]/q@3,2,0,1,0%5,4,3,2,1". */
export function chordToken(shape: ChordShape, dur: string, only?: ShapeNote): string {
  const notes = only ? [only] : shape.notes;
  const fingers = notes.map(n => (n.finger === undefined ? '-' : String(n.finger)));
  const strings = notes.map(n => (n.string === undefined ? '-' : String(n.string)));
  const head = notes.length === 1 ? notes[0].name : `[${notes.map(n => n.name).join(' ')}]`;
  const f = fingers.some(x => x !== '-') ? `@${fingers.join(',')}` : '';
  const s = strings.some(x => x !== '-') ? `%${strings.join(',')}` : '';
  return `${head}/${dur}${f}${s}`;
}

const durText = (base: string, dots: number) => base + '.'.repeat(dots);

function restTokens(ticks: number): string[] {
  return splitTicks(ticks).map(d => `r/${durText(d.base, d.dots)}`);
}

/** The bar's strumming rhythm as durations: the rhythm given, or one strum per bar / per beat. */
function strumRhythm(time: TimeSig, rhythm: string | undefined, mode: 'wait' | 'tempo'): string[] {
  if (rhythm) return rhythm.split(/\s+/).filter(Boolean);
  const bar = measureTicks(time);
  if (mode === 'wait') return splitTicks(bar).map(d => durText(d.base, d.dots));
  const beat = beatTicks(time);
  const one = splitTicks(beat).map(d => durText(d.base, d.dots))[0];
  return Array.from({ length: Math.round(bar / beat) }, () => one);
}

export function clefFor(instrument: InstrumentId): Clef {
  if (instrument === 'guitar') return 'treble8vb';
  if (instrument === 'bass') return 'bass8vb';
  return 'treble';
}

function scoreOf(def: { title: string; time: TimeSig; tempo: number; staves: SongDef['staves']; pickup?: string; mallets?: 2 | 4 }, instrument: InstrumentId, prefs: InstrumentPrefs): Score {
  const score = songToScore({ id: `chords-${def.title.replace(/\W+/g, '-')}`, title: def.title, composer: '', instrument, level: 1, key: 'C', time: def.time, tempo: def.tempo, pickup: def.pickup, staves: def.staves, mallets: def.mallets });
  if (isFretted(instrument)) score.tuning = tuningFor(instrument, prefs).open;
  return score;
}

/** Build the score for a chord-play activity (the chord staff is the last staff). */
export interface ChordSegment {
  tick: number;
  ticks: number;
  shape: ChordShape;
}

/** Build the score for a chord-play activity (the chord staff is the last staff), and which chord sounds when. */
export function chordPlayScore(def: ChordPlayDef, instrument: InstrumentId, prefs: InstrumentPrefs = {}, songDef?: SongDef): { score: Score; chordStaff: number; song?: SongDef; segments: ChordSegment[] } | null {
  const clef = clefFor(instrument);
  const mallets = instrument === 'mallets' ? (4 as const) : undefined;
  if (def.song) {
    const song = songDef ?? getSong(def.song);
    if (!song?.chords) return null;
    const melody = songToScore(song);
    const { events } = parseChordTimeline(song.chords, melody);
    const shapes = new Map<string, ChordShape | null>();
    const shapeOf = (sym: string) => {
      const ref = def.shapes?.find(r => parseChordRef(r).symbol === sym) ?? sym;
      if (!shapes.has(sym)) shapes.set(sym, chordShape(ref, instrument, prefs));
      return shapes.get(sym) ?? null;
    };
    const segments: ChordSegment[] = [];
    const beat = beatTicks(melody.time);
    const beatDur = splitTicks(beat).map(d => durText(d.base, d.dots))[0];
    // bar lengths as the tune has them (a pickup, and a last bar shortened to match)
    const lengths: number[] = [];
    for (const n of melody.staves[0].voices[0].notes) lengths[n.measure] = (lengths[n.measure] ?? 0) + n.ticks;
    const bars: string[] = [];
    for (let m = 0; m < melody.measures; m++) {
      const start = measureStartTick(melody, m);
      const len = lengths[m] ?? measureStartTick(melody, m + 1) - start;
      const toks: string[] = [];
      // a pickup bar shorter than a beat (or not a whole number of beats) is a rest
      let t = 0;
      const lead = len % beat;
      if (lead) {
        toks.push(...restTokens(lead));
        t = lead;
      }
      for (; t < len; t += beat) {
        const at = start + t;
        const ev = events.find(e => at >= e.tick && at < e.tick + e.ticks);
        const shape = ev?.symbol ? shapeOf(ev.symbol) : null;
        toks.push(shape ? chordToken(shape, beatDur) : `r/${beatDur}`);
        if (shape) segments.push({ tick: at, ticks: beat, shape });
      }
      bars.push(toks.join(' '));
    }
    const melodyStaff = song.staves[0];
    const score = scoreOf(
      {
        title: song.title,
        time: song.time,
        tempo: def.tempo ?? song.tempo,
        pickup: song.pickup,
        mallets,
        staves: [
          { ...melodyStaff, hand: 'R' },
          { clef, hand: 'L', voices: [bars.join(' | ') + ' |'] },
        ],
      },
      instrument,
      prefs,
    );
    return { score, chordStaff: 1, song, segments };
  }

  const chords = (def.chords ?? []).map(s => chordShape(s, instrument, prefs)).filter((s): s is ChordShape => !!s);
  if (!chords.length) return null;
  const time: TimeSig = def.time ?? [4, 4];
  const bar = measureTicks(time);
  const bars: string[] = [];
  const segments: ChordSegment[] = [];
  // the score starts at tick 0 with no pickup: bar i starts at i × bar
  const mark = (shape: ChordShape) => segments.push({ tick: bars.length * bar, ticks: bar, shape });
  if (def.pattern === 'pick') {
    const beat = beatTicks(time);
    const beatDur = splitTicks(beat).map(d => durText(d.base, d.dots))[0];
    const perBar = Math.round(bar / beat);
    const whole = strumRhythm(time, undefined, 'wait');
    for (let r = 0; r < (def.repeat ?? 1); r++) {
      for (const c of chords) {
        // one note at a time …
        for (let i = 0; i < c.notes.length; i += perBar) {
          const toks = c.notes.slice(i, i + perBar).map(n => chordToken(c, beatDur, n));
          const used = toks.length * beat;
          if (used < bar) toks.push(...restTokens(bar - used));
          mark(c);
          bars.push(toks.join(' '));
        }
        // … then all together
        mark(c);
        bars.push(whole.map(d => chordToken(c, d)).join(' '));
      }
    }
  } else {
    const rhythm = strumRhythm(time, def.rhythm, def.mode);
    for (let r = 0; r < (def.repeat ?? 2); r++) {
      for (const c of chords) {
        mark(c);
        bars.push(rhythm.map(d => chordToken(c, d)).join(' '));
      }
    }
  }
  const score = scoreOf({ title: def.title ?? chords.map(c => c.symbol).join(' – '), time, tempo: def.tempo ?? 70, mallets, staves: [{ clef, voices: [bars.join(' | ') + ' |'] }] }, instrument, prefs);
  return { score, chordStaff: 0, segments };
}
