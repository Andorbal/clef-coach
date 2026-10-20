/**
 * Figures as scores: a lesson's notes (in the text notation) or what the learner just
 * played, laid out on a treble, bass or grand staff, with the labels under the notes and
 * the events "Hear it" plays. Pure, so the course test can build every figure.
 */
import { type KeySig, parseKey, tonicOf } from '../../music/keys';
import { parseVoice } from '../../music/parse';
import { type Pitch, STEPS, accidentalSymbol, diatonicIndex, midiOf, pitchClass, stepLabel } from '../../music/pitch';
import { PPQ, type TimeSig, durationTicks } from '../../music/rhythm';
import { type Clef, type NoteSpec, type Score, type StaffPart, buildVoice } from '../../music/score';
import { intervalOf, intervalShort, pitchText, scaleNotes } from '../theory';
import type { Figure } from '../course/types';

export interface FigureScore {
  score: Score;
  /** Text under notes, by note id. */
  labels?: Record<string, string>;
  /** Show note names. */
  names: boolean;
  /** Every note's MIDI number (for lighting keys). */
  midis: number[];
  /** What "Hear it" plays: notes with their start and length in beats. */
  events: { midis: number[]; beat: number; beats: number }[];
}

let figureCounter = 0;

const UNBARRED: TimeSig = [4, 4];

/** Read a figure's notes: no durations at all means whole notes, one after another. */
function specsOf(text: string, time: TimeSig): NoteSpec[] {
  const t = /\//.test(text) ? text : text.replace(/^(\[[^\]]*\]|\S+)/, '$1/w');
  return parseVoice(t, time, 0, 'figure', true).specs;
}

function chooseClef(midis: number[], want?: Clef | 'grand'): Clef | 'grand' {
  if (want) return want;
  if (!midis.length) return 'treble';
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  if (lo >= 57) return 'treble';
  if (hi <= 64) return 'bass';
  return 'grand';
}

/** The degree of a note in a key ("1", "♭3", "♯4"), against the major (or natural minor) scale. */
export function degreeLabel(p: Pitch, key: KeySig): string {
  const t = tonicOf(key);
  const scale = scaleNotes({ step: t.step, alter: t.alter, octave: 4 }, key.mode === 'major' ? 'major' : 'natural-minor');
  const deg = (STEPS.indexOf(p.step) - STEPS.indexOf(t.step) + 7) % 7;
  const ref = scale[deg];
  const diff = (((pitchClass(midiOf(p)) - pitchClass(midiOf(ref))) % 12) + 18) % 12 - 6;
  return `${diff ? accidentalSymbol(diff) : ''}${deg + 1}`;
}

export function figureScore(f: Figure): FigureScore {
  const time = f.time ?? UNBARRED;
  const specs = specsOf(f.notes, time);
  const midis = specs.flatMap(s => s.pitches.map(midiOf));
  const clef = chooseClef(midis, f.clef);
  const id = `fig${++figureCounter}`;
  const key = parseKey(f.key ?? 'C');
  const staves: StaffPart[] = [];
  const voiceOf = (list: NoteSpec[], suffix: string) => buildVoice(list, time, `${id}${suffix}`);
  if (clef === 'grand') {
    const treble = specs.map(s => ({ ...s, pitches: s.pitches.filter(p => midiOf(p) >= 60) }));
    const bass = specs.map(s => ({ ...s, pitches: s.pitches.filter(p => midiOf(p) < 60) }));
    staves.push({ clef: 'treble', hand: 'R', voices: [voiceOf(treble, 't')] }, { clef: 'bass', hand: 'L', voices: [voiceOf(bass, 'b')] });
  } else {
    staves.push({ clef, voices: [voiceOf(specs, 'v')] });
  }
  const measures = Math.max(1, ...staves.flatMap(st => st.voices[0].notes.map(n => n.measure + 1)));
  const score: Score = { id, title: '', key, time, tempo: f.tempo ?? 92, measures, staves, instrument: 'piano' };

  // labels: one per sounding note or chord, on the staff that has it (the treble one if both do)
  const labels: Record<string, string> = {};
  const lead = staves[0].voices[0].notes;
  const lower = staves[1]?.voices[0].notes ?? [];
  const sounding = lead
    .map((n, i) => ({ el: !n.rest ? n : lower[i], pitches: [...(lower[i]?.pitches ?? []), ...n.pitches] }))
    .filter(x => x.el && !x.el.rest && !x.el.tiePrev && x.pitches.length);
  const custom = Array.isArray(f.labels) ? f.labels : null;
  sounding.forEach((x, i) => {
    let text: string | undefined;
    const low = x.pitches.reduce((a, b) => (midiOf(a) <= midiOf(b) ? a : b));
    if (custom) text = custom[i] || undefined;
    else if (f.labels === 'degrees') text = degreeLabel(low, key);
    else if (f.labels === 'steps' && i > 0) {
      const prev = sounding[i - 1].pitches[0];
      const s = Math.abs(midiOf(low) - midiOf(prev));
      text = s === 1 ? 'H' : s === 2 ? 'W' : s === 3 ? 'W+H' : undefined;
    } else if (f.labels === 'intervals' && i > 0) text = intervalShort(intervalOf(sounding[0].pitches[0], low));
    if (text) labels[x.el!.id] = text;
  });

  // playback: notes as written, in beats
  const events: FigureScore['events'] = [];
  let tick = 0;
  let tiedIn = false;
  for (const s of specs) {
    const ticks = durationTicks(s.base, s.dots ?? 0, s.triplet);
    if (s.pitches.length && !tiedIn) events.push({ midis: s.pitches.map(midiOf), beat: tick / PPQ, beats: ticks / PPQ });
    else if (tiedIn && events.length) events[events.length - 1].beats += ticks / PPQ;
    tiedIn = !!s.tieNext;
    tick += ticks;
  }
  return { score, labels: Object.keys(labels).length ? labels : undefined, names: f.labels === 'names', midis, events };
}

/** The learner's notes as a figure: the chord held, or the last few notes struck. */
export function liveFigure(groups: Pitch[][], key?: string): Figure {
  const text = groups.length === 1 ? (groups[0].length > 1 ? `[${groups[0].map(pitchText).join(' ')}]/w` : `${pitchText(groups[0][0])}/w`) : groups.map(g => (g.length > 1 ? `[${g.map(pitchText).join(' ')}]/q` : `${pitchText(g[0])}/q`)).join(' ');
  return { notes: text, key, labels: groups.length === 1 ? undefined : 'names' };
}

/** "Hear it" timing: one after another, all at once, or apart then together. */
export function playbackOf(fs: FigureScore, how: Figure['play'] = 'as-written'): { midis: number[]; beat: number; beats: number }[] {
  if (how === 'none') return [];
  const all = [...new Set(fs.events.flatMap(e => e.midis))].sort((a, b) => a - b);
  if (how === 'together') return [{ midis: all, beat: 0, beats: 3 }];
  if (how === 'apart-then-together') {
    const apart = all.map((m, i) => ({ midis: [m], beat: i, beats: 1 }));
    return [...apart, { midis: all, beat: all.length + 0.25, beats: 3 }];
  }
  // as written; unbarred whole notes play as half notes (whole notes drag)
  const unbarred = fs.events.every(e => e.beats === 4);
  return unbarred ? fs.events.map((e, i) => ({ ...e, beat: i * 1.5, beats: 1.5 })) : fs.events;
}

/** A note's name for reading ("C♯4"). */
export const noteLabel = (p: Pitch) => `${stepLabel(p.step, p.alter)}${p.octave}`;

/** Lowest-first. */
export const byPitch = (a: Pitch, b: Pitch) => midiOf(a) - midiOf(b) || diatonicIndex(a) - diatonicIndex(b);
