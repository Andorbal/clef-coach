import { AnimatePresence, motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { inputManager } from '../../audio/input/manager';
import { sfx } from '../../audio/sfx';
import { synth } from '../../audio/synth';
import { flashScore } from '../../curriculum/generate';
import type { ActivityDef } from '../../curriculum/types';
import type { FretMark, KeyMark, MarkColor } from '../../instruments';
import { positionsFor } from '../../music/guitar';
import { midiOf, parsePitch, pitchLabel, pitchToString, stepLabel } from '../../music/pitch';
import { NotationView } from '../../notation/NotationView';
import type { ActivityProps } from '../context';
import { InstrumentPanel, pianoRangeFor } from '../InstrumentPanel';
import { useComputerPiano, useNoteInput } from '../input';
import { ActivityHeader } from '../PlayAlong';

type MeetDef = Extract<ActivityDef, { type: 'meet' }>;

/** "Meet a note": see it on the staff and on the instrument, then play it a few times. */
export function Meet({ def, ctx, onDone }: ActivityProps<MeetDef>) {
  const notes = useMemo(() => def.notes.map(parsePitch), [def.notes]);
  const reps = def.reps ?? 3;
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const mistakes = useRef(0);
  const items = useRef<{ key: string; correct: boolean }[]>([]);
  const note = notes[i];
  const midi = note ? midiOf(note) : 60;
  // tell the microphone which note to listen for (it can then pick it out while other strings still ring)
  const listening = !!note && count < reps;
  useEffect(() => {
    if (!listening) return;
    inputManager.setExpected([midi]);
    return () => inputManager.setExpected(null);
  }, [listening, midi]);
  const score = useMemo(() => flashScore([[note]], def.clef, 'C', ctx.instrument, def.hand), [note, def.clef, ctx.instrument, def.hand]);
  const range = useMemo(() => pianoRangeFor(notes.map(midiOf)), [notes]);
  const tipText = def.tips?.[i] ?? def.tips?.[0];
  const finger = def.fingers?.[i];
  const fret = def.frets?.[i] ?? (ctx.instrument === 'guitar' ? (() => {
    const p = positionsFor(midi, 15).sort((a, b) => a.fret - b.fret)[0];
    return p ? { ...p, finger: p.fret === 0 ? 0 : Math.min(4, p.fret) } : undefined;
  })() : undefined);

  useComputerPiano(ctx.instrument === 'piano', def.clef === 'bass' ? 3 : 4);
  useNoteInput(e => {
    if (e.type !== 'on' || !note || count >= reps) return;
    if (e.midi === midi) {
      setFlash('good');
      const c = count + 1;
      setCount(c);
      if (c >= reps) {
        items.current.push({ key: `note:${def.clef}:${pitchToString(note)}`, correct: mistakes.current === 0 });
        if (ctx.settings.sfx) sfx.correct();
        setTimeout(() => {
          if (i + 1 >= notes.length) {
            const correct = items.current.filter(x => x.correct).length;
            onDone({ total: items.current.length, correct, items: items.current, notes: notes.length * reps, responseMs: [] });
          } else {
            mistakes.current = 0;
            setCount(0);
            setI(i + 1);
          }
        }, 600);
      }
    } else {
      mistakes.current++;
      setFlash('bad');
    }
    setTimeout(() => setFlash(null), 300);
  });

  const handColor: MarkColor = def.hand === 'L' ? 'lh' : def.hand === 'R' ? 'rh' : 'gold';
  const keyMarks: KeyMark[] = [{ midi, color: handColor, finger, pulse: true, label: undefined }];
  const fretMarks: FretMark[] = fret ? [{ string: fret.string, fret: fret.fret, color: 'gold', finger: fret.finger || undefined, label: fret.fret === 0 ? stepLabel(note.step, note.alter, ctx.settings.naming) : undefined, pulse: true }] : [];

  return (
    <div className="activity meet" data-expected={midi}>
      <ActivityHeader
        title={def.title ?? `Meet ${pitchLabel(note, ctx.settings.naming)}`}
        prompt={def.prompt ?? (ctx.instrument === 'guitar' ? `Play it ${reps} times.` : `Play it ${reps} times${finger ? ` with finger ${finger}` : ''}.`)}
        badge={`${i + 1} / ${notes.length}`}
      />
      <div className="meet-body">
        <div className={`stage-paper paper meet-paper ${flash ? `flash-${flash}` : ''}`}>
          <NotationView
            score={score}
            layout="center"
            states={{ [score.staves[0].voices[0].notes[0].id]: count >= reps ? 'good' : 'active' }}
            timeSignature={false}
            barlines={false}
            beatWidth={12}
            noteNames="all"
            naming={ctx.settings.naming}
            maxScale={2.4}
          />
          <button
            className="btn btn-icon btn-ghost listen-btn"
            aria-label="Hear it"
            onClick={async () => {
              await unlockAudio();
              synth.play(midi, { duration: 1.4 });
            }}
          >
            <Volume2 size={18} />
          </button>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={i} className="meet-tip card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="meet-name display">{pitchLabel(note, ctx.settings.naming)}<sub>{note.octave}</sub></div>
            {tipText && <p className="dim">{tipText}</p>}
            {ctx.instrument === 'guitar' && fret && (
              <p className="meet-loc">
                String {fret.string} · {fret.fret === 0 ? 'open' : `fret ${fret.fret}`}
                {fret.finger ? ` · finger ${fret.finger}` : ''}
              </p>
            )}
            <div className="rep-dots" aria-label={`${count} of ${reps}`}>
              {Array.from({ length: reps }, (_, k) => (
                <span key={k} className={k < count ? 'on' : ''} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <InstrumentPanel ctx={ctx} range={range} marks={keyMarks} fretMarks={fretMarks} fretRange={[0, Math.max(5, (fret?.fret ?? 0) + 3)]} focus={midi} />
    </div>
  );
}
