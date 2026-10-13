import { useMemo } from 'react';
import type { Insight } from '../curriculum/types';
import { Fretboard, PianoKeyboard, type FretMark, type KeyMark } from '../instruments';
import { parseKey } from '../music/keys';
import { midiOf, parsePitch } from '../music/pitch';
import { parseVoice } from '../music/parse';
import { type Clef, type Score, buildVoice } from '../music/score';
import { NotationView } from '../notation/NotationView';
import type { NoteNaming } from '../music/pitch';
import { pianoRangeFor } from './InstrumentPanel';

let visualCounter = 0;

export function visualScore(clef: Clef, notes: string[], key = 'C', time?: [number, number]): Score {
  const text0 = notes.join(' ');
  const text = /\//.test(text0) ? text0 : text0.replace(/^(\[[^\]]*\]|\S+)/, '$1/w');
  const t = time ?? [4, 4];
  const r = parseVoice(text, t, 0, 'visual', true);
  const id = `vis${++visualCounter}`;
  const voice = buildVoice(r.specs, t, id);
  const measures = voice.notes.length ? Math.max(...voice.notes.map(n => n.measure)) + 1 : 1;
  return {
    id,
    title: '',
    key: parseKey(key),
    time: t,
    tempo: 80,
    measures,
    staves: [{ clef, voices: [voice] }],
    instrument: clef === 'treble8vb' ? 'guitar' : 'piano',
  };
}

export function InsightVisual({ visual, naming = 'letter', compact }: { visual: NonNullable<Insight['visual']>; naming?: NoteNaming; compact?: boolean }) {
  const staff = useMemo(() => {
    if (visual.kind === 'staff') return visualScore(visual.clef, visual.notes, visual.key, visual.time);
    if (visual.kind === 'staff+keys' || visual.kind === 'staff+frets') {
      const allChord = visual.notes.length === 1 && visual.notes[0].startsWith('[');
      return visualScore(visual.clef, allChord ? visual.notes : visual.notes, 'C');
    }
    return null;
  }, [visual]);

  const keyNotes = visual.kind === 'keys' ? visual.notes : visual.kind === 'staff+keys' ? visual.notes.flatMap(s => s.replace(/[[\]]/g, '').split(/\s+/)).map(s => s.split('/')[0]).filter(Boolean) : [];
  const keyMidis = keyNotes.map(s => midiOf(parsePitch(s)));
  const fingers = visual.kind === 'keys' || visual.kind === 'staff+keys' ? visual.fingers : undefined;
  const hand = visual.kind === 'keys' || visual.kind === 'staff+keys' ? visual.hand : undefined;
  const marks: KeyMark[] = keyMidis.map((m, i) => ({ midi: m, color: hand === 'L' ? 'lh' : hand === 'R' ? 'rh' : 'gold', finger: fingers?.[i] }));
  let range: [number, number] = pianoRangeFor(keyMidis, 14);
  if (visual.kind === 'keys' && visual.low && visual.high) range = [midiOf(parsePitch(visual.low)), midiOf(parsePitch(visual.high))];

  const fretPositions = visual.kind === 'frets' || visual.kind === 'staff+frets' ? visual.positions : [];
  const fretMarks: FretMark[] = fretPositions.map(p => {
    const q = p as { string: number; fret: number; finger?: number; label?: string; root?: boolean };
    return { string: q.string, fret: q.fret, color: 'gold', finger: q.finger || undefined, label: q.label, root: q.root };
  });
  const maxF = Math.max(5, ...fretPositions.map(p => p.fret + 1));
  const minF = visual.kind === 'frets' ? visual.minFret ?? 0 : 0;

  return (
    <div className={`insight-visual ${compact ? 'compact' : ''}`}>
      {staff && (
        <div className="paper insight-staff">
          <NotationView
            score={staff}
            layout="center"
            timeSignature={visual.kind === 'staff' && !!visual.time}
            barlines={visual.kind === 'staff' && !!visual.time}
            noteNames={visual.kind === 'staff' && visual.labels ? 'all' : 'none'}
            naming={naming}
            beatWidth={visual.kind === 'staff' && visual.time ? 46 : 26}
            fingering={false}
            maxScale={1.7}
          />
        </div>
      )}
      {keyMidis.length > 0 && (
        <div className="insight-keys">
          <PianoKeyboard low={range[0]} high={range[1]} marks={marks} interactive={false} showLabels="c-only" naming={naming} minWhiteKeyWidth={22} markMiddleC />
        </div>
      )}
      {fretMarks.length > 0 && (
        <div className="insight-frets">
          <Fretboard minFret={minF} maxFret={visual.kind === 'frets' ? visual.maxFret ?? maxF : maxF} marks={fretMarks} interactive={false} showNoteNames="marks" naming={naming} />
        </div>
      )}
    </div>
  );
}
