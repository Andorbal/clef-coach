/**
 * A chord chart picture written on the staff: exactly the notes of that voicing, spelled
 * as tones of the chord (C dim7's B𝄫), in the clef the instrument reads — guitar in
 * treble 8vb and bass guitar in bass 8vb (they sound an octave below the written notes),
 * ukulele in treble, mallets in written pitch, piano on one staff or the grand staff when
 * the voicing needs both hands. Arpeggios are written as the notes in playing order.
 */
import type { ChordView } from './chordViews';
import { type InstrumentId, type InstrumentPrefs, isFretted, tuningFor } from './instruments';
import { type SongStaffDef, songToScore } from './parse';
import { type Pitch, pitchToString } from './pitch';
import type { Clef, Score } from './score';

interface Written {
  pitch: Pitch;
  midi: number;
  /** finger (fretting 0–4, piano 1–5) or mallet 1–4 */
  finger?: number;
  string?: number;
  hand?: 'R' | 'L';
}

function writtenNotes(view: ChordView): Written[] {
  if (view.kind === 'fretted') return view.notes.map(n => ({ pitch: n.pitch, midi: n.midi, finger: n.finger ?? undefined, string: n.string }));
  return view.notes.map(n => ({ pitch: n.pitch, midi: n.midi, finger: n.finger ?? n.mallet, hand: n.hand }));
}

/** The notes in the order they are played (the strum or arpeggio order of the picture). */
function inPlayingOrder(view: ChordView, notes: Written[]): Written[] {
  const left = [...notes];
  const out: Written[] = [];
  for (const m of view.midis) {
    const i = left.findIndex(n => n.midi === m);
    if (i >= 0) out.push(...left.splice(i, 1));
  }
  return [...out, ...left];
}

function token(notes: Written[], dur: string, fingers: boolean): string {
  const head = notes.length === 1 ? pitchToString(notes[0].pitch) : `[${notes.map(n => pitchToString(n.pitch)).join(' ')}]`;
  const f = fingers && notes.some(n => n.finger !== undefined) ? `@${notes.map(n => (n.finger === undefined ? '-' : String(n.finger))).join(',')}` : '';
  const s = notes.some(n => n.string !== undefined) ? `%${notes.map(n => (n.string === undefined ? '-' : String(n.string))).join(',')}` : '';
  return `${head}/${dur}${f}${s}`;
}

function fretClef(instrument: InstrumentId): Clef {
  if (instrument === 'guitar') return 'treble8vb';
  if (instrument === 'bass') return 'bass8vb';
  return 'treble';
}

/** One staff when the notes sit comfortably in one clef, else the grand staff (split by hand, or at middle C). */
function keyStaves(notes: Written[], byHand: boolean): { clef: Clef; hand?: 'R' | 'L'; notes: Written[] }[] {
  const lo = Math.min(...notes.map(n => n.midi));
  const hi = Math.max(...notes.map(n => n.midi));
  const hands = new Set(notes.map(n => n.hand));
  if (!(byHand && hands.size > 1)) {
    if (lo >= 55) return [{ clef: 'treble', notes }];
    if (hi <= 65) return [{ clef: 'bass', notes }];
  }
  const right = byHand && hands.size > 1 ? notes.filter(n => n.hand !== 'L') : notes.filter(n => n.midi >= 60);
  const leftHand = byHand && hands.size > 1 ? notes.filter(n => n.hand === 'L') : notes.filter(n => n.midi < 60);
  return [
    { clef: 'treble', hand: 'R', notes: right },
    { clef: 'bass', hand: 'L', notes: leftHand },
  ];
}

/**
 * The score of one chord picture (one bar, no time signature needed), or null if it
 * can't be written. `fingers` adds the picture's fingering (or sticking) to the notes.
 */
export function chordViewScore(view: ChordView, instrument: InstrumentId, prefs: InstrumentPrefs = {}, opts: { fingers?: boolean } = {}): Score | null {
  // a pitch played on two strings is written once
  const notes = writtenNotes(view).filter((n, i, all) => all.findIndex(o => o.midi === n.midi) === i);
  if (!notes.length) return null;
  const fingers = !!opts.fingers;
  const arpeggio = view.arpeggio && notes.length > 1;

  const music = (part: Written[]): string => {
    if (!part.length) return 'r/w |'; // the hand that has nothing to play on the grand staff
    if (arpeggio) return `${part.map(n => token([n], 'q', fingers)).join(' ')} |`;
    return `${token([...part].sort((a, b) => a.midi - b.midi), 'w', fingers)} |`;
  };

  let staves: SongStaffDef[];
  if (view.kind === 'fretted') {
    staves = [{ clef: fretClef(instrument), voices: [music(arpeggio ? inPlayingOrder(view, notes) : notes)] }];
  } else {
    const ordered = arpeggio ? inPlayingOrder(view, notes) : notes;
    staves = keyStaves(ordered, instrument === 'piano').map(st => ({
      clef: st.clef,
      hand: st.hand,
      // an arpeggio across the grand staff keeps its rhythm on both staves
      voices: [arpeggio ? `${ordered.map(n => (st.notes.includes(n) ? token([n], 'q', fingers) : 'r/q')).join(' ')} |` : music(st.notes)],
    }));
  }

  try {
    const score = songToScore({
      id: 'chord-view',
      title: '',
      composer: '',
      instrument,
      level: 1,
      key: 'C',
      time: arpeggio ? [notes.length, 4] : [4, 4],
      tempo: 80,
      staves,
      mallets: view.kind === 'keys' ? view.mallets : undefined,
    });
    if (isFretted(instrument)) score.tuning = tuningFor(instrument, prefs).open;
    return score;
  } catch {
    return null;
  }
}
