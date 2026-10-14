/**
 * Flashcard drills: name a note, play a note, name an interval, identify a key signature.
 * One card at a time (or a short "note rush" row). Answers come from buttons, computer
 * keys, or the instrument itself.
 */
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { synth } from '../../audio/synth';
import { unlockAudio } from '../../audio/context';
import { inputManager } from '../../audio/input/manager';
import { drawItems, flashScore } from '../../curriculum/generate';
import type { ActivityDef } from '../../curriculum/types';
import type { KeyMark, FretMark, MarkColor } from '../../instruments';
import { keyDisplayName, parseKey } from '../../music/keys';
import { positionsFor } from '../../music/guitar';
import { instrumentDef, isFretted } from '../../music/instruments';
import {
  INTERVAL_NAMES,
  type Pitch,
  type Step,
  STEPS,
  diatonicIndex,
  intervalNumber,
  midiOf,
  parsePitch,
  pitchClass,
  pitchToString,
  stepLabel,
  STEP_SEMIS,
} from '../../music/pitch';
import { NotationView, type NoteState } from '../../notation/NotationView';
import { reviewPriority } from '../../state/srs';
import type { ActivityProps } from '../context';
import { resolveVisibility , ctxTuning} from '../context';
import { InstrumentPanel, pianoRangeFor } from '../InstrumentPanel';
import { useComputerPiano, useLetterKeys, useNoteInput, useNumberKeys } from '../input';
import { ActivityHeader } from '../PlayAlong';

type FlashDef = Extract<ActivityDef, { type: 'name' | 'play' | 'interval' | 'keysig' }>;

interface Card {
  pitches: Pitch[];
  /** correct answer id */
  answer: string;
  itemKey: string;
  key?: string;
}

interface Choice {
  id: string;
  label: string;
  sub?: string;
}

const LETTER_CHOICES: Choice[] = STEPS.map(s => ({ id: s, label: s }));

function noteAnswerId(p: Pitch, accidentals: boolean): string {
  return accidentals ? `${p.step}${p.alter}` : p.step;
}

function accidentalChoices(): Choice[] {
  const out: Choice[] = [];
  for (const s of STEPS) {
    out.push({ id: `${s}0`, label: stepLabel(s, 0) });
  }
  return out;
}

export function Flashcards({ def, ctx, onDone }: ActivityProps<FlashDef>) {
  const accidentals = def.type === 'name' && def.answers === 'accidentals';
  const sequence = (def.type === 'name' || def.type === 'play') && !!def.sequence;
  const clef = def.clef;

  // ----- build the deck -----
  const cards: Card[] = useMemo(() => {
    const rng = ctx.rng;
    if (def.type === 'name' || def.type === 'play') {
      const pool = def.pool.map(parsePitch);
      const keyOf = (p: Pitch) => `note:${clef}:${pitchToString(p)}`;
      const drawn = drawItems(rng, pool, def.count, p => 1 + reviewPriority(ctx.items[keyOf(p)]), (a, b) => midiOf(a) === midiOf(b));
      return drawn.map(p => ({ pitches: [p], answer: def.type === 'name' ? noteAnswerId(p, accidentals) : String(midiOf(p)), itemKey: keyOf(p), key: def.key }));
    }
    if (def.type === 'interval') {
      const pool = def.pool.map(parsePitch).sort((a, b) => midiOf(a) - midiOf(b));
      const out: Card[] = [];
      for (let i = 0; i < def.count; i++) {
        const want = def.intervals[Math.floor(rng() * def.intervals.length)];
        const pairs: [Pitch, Pitch][] = [];
        for (const a of pool) for (const b of pool) if (diatonicIndex(b) - diatonicIndex(a) === want - 1) pairs.push([a, b]);
        if (!pairs.length) continue;
        let [a, b] = pairs[Math.floor(rng() * pairs.length)];
        if (!def.harmonic && rng() < 0.4) [a, b] = [b, a];
        out.push({ pitches: def.harmonic ? [a, b] : [a, b], answer: String(intervalNumber(a, b)), itemKey: `interval:${want}`, key: def.key });
      }
      return out;
    }
    // keysig
    const keys = def.keys;
    const drawn = drawItems(rng, keys, def.count, k => 1 + reviewPriority(ctx.items[`key:${k}`]));
    return drawn.map(k => ({ pitches: [], answer: k, itemKey: `key:${k}`, key: k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  const choices: Choice[] = useMemo(() => {
    if (def.type === 'name') return accidentals ? accidentalChoices() : LETTER_CHOICES;
    if (def.type === 'interval') return [...new Set([...def.intervals])].sort((a, b) => a - b).map(n => ({ id: String(n), label: INTERVAL_NAMES[n] ?? `${n}th` }));
    if (def.type === 'keysig') return def.keys.map(k => ({ id: k, label: keyDisplayName(parseKey(k)) }));
    return [];
  }, [def, accidentals]);

  // ----- run state -----
  const ROW = sequence ? Math.min(8, cards.length) : 1;
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; picked?: string } | null>(null);
  const [states, setStates] = useState<Record<number, NoteState>>({});
  const [tries, setTries] = useState(0);
  const resultsRef = useRef<{ correct: boolean; ms: number; key: string }[]>([]);
  const cardStart = useRef(performance.now());
  const locked = useRef(false);
  const [heldColor, setHeldColor] = useState<Record<number, MarkColor>>({});

  const rowStart = Math.floor(idx / ROW) * ROW;
  const rowCards = cards.slice(rowStart, rowStart + ROW);
  const card = cards[idx];
  // "play this note" cards: tell the microphone which note to listen for
  const expectedMidi = def.type === 'play' && card ? Number(card.answer) : null;
  useEffect(() => {
    if (expectedMidi === null || !Number.isFinite(expectedMidi)) return;
    inputManager.setExpected([expectedMidi]);
    return () => inputManager.setExpected(null);
  }, [expectedMidi]);

  const score = useMemo(() => {
    if (def.type === 'keysig') return flashScore([], clef, rowCards[0]?.key ?? 'C', ctx.instrument);
    const notes = def.type === 'interval' && !def.harmonic ? rowCards.flatMap(c => c.pitches.map(p => [p])) : rowCards.map(c => c.pitches);
    return flashScore(notes, clef, rowCards[0]?.key ?? 'C', ctx.instrument);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowStart, cards]);

  const elIds = useMemo(() => score.staves[0].voices[0].notes.map(n => n.id), [score]);

  const finish = useCallback(() => {
    const r = resultsRef.current;
    const correct = r.filter(x => x.correct).length;
    onDone({
      total: r.length,
      correct,
      items: r.map(x => ({ key: x.key, correct: x.correct, ms: x.ms })),
      notes: r.length,
      responseMs: r.filter(x => x.correct).map(x => x.ms),
    });
  }, [onDone]);

  const next = useCallback(() => {
    if (idx + 1 >= cards.length) {
      // stay locked: the activity is finished (it stays on screen during the feedback banner)
      finish();
      return;
    }
    locked.current = false;
    setFeedback(null);
    setTries(0);
    cardStart.current = performance.now();
    if ((idx + 1) % ROW === 0) setStates({});
    setIdx(idx + 1);
  }, [idx, cards.length, finish, ROW]);

  const answer = useCallback(
    (id: string) => {
      if (!card || locked.current) return;
      const ok = id === card.answer;
      const ms = performance.now() - cardStart.current;
      const local = idx - rowStart;
      const firstTry = tries === 0;
      if (ok) {
        locked.current = true;
        resultsRef.current.push({ correct: firstTry, ms, key: card.itemKey });
        if (ctx.settings.sfx) sfx.correct();
        setFeedback({ ok: true, picked: id });
        setStates(s => ({ ...s, ...stateFor(local, firstTry ? 'good' : 'bad') }));
        setTimeout(next, sequence ? 160 : firstTry ? 420 : 900);
      } else {
        if (ctx.settings.sfx) sfx.wrong();
        setTries(t => t + 1);
        setFeedback({ ok: false, picked: id });
        setStates(s => ({ ...s, ...stateFor(local, 'bad') }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, idx, rowStart, tries, next, sequence, ctx.settings.sfx],
  );

  const stateFor = (local: number, st: NoteState): Record<string, NoteState> => {
    if (def.type === 'interval' && !def.harmonic) return { [elIds[local * 2]]: st, [elIds[local * 2 + 1]]: st };
    return elIds[local] ? { [elIds[local]]: st } : {};
  };

  // instrument / keys input
  useLetterKeys(def.type === 'name', (letter, alter) => answer(accidentals ? `${letter}${alter}` : letter));
  useNumberKeys(def.type === 'interval' || def.type === 'keysig', n => {
    const c = choices[n - 1];
    if (c) answer(c.id);
  });
  useComputerPiano(!isFretted(ctx.instrument) && (def.type === 'play'), clef === 'bass' ? 3 : 4);
  useNoteInput(e => {
    if (e.type === 'off') {
      setHeldColor(h => {
        const c = { ...h };
        delete c[e.midi];
        return c;
      });
      return;
    }
    if (!card) return;
    if (def.type === 'play') {
      const ok = String(e.midi) === card.answer;
      setHeldColor(h => ({ ...h, [e.midi]: ok ? 'good' : 'bad' }));
      answer(String(e.midi));
    } else if (def.type === 'name') {
      // playing the note on the instrument also counts as naming it (any octave)
      const p = card.pitches[0];
      const ok = pitchClass(e.midi) === pitchClass(midiOf(p));
      setHeldColor(h => ({ ...h, [e.midi]: ok ? 'good' : 'bad' }));
      if (ok) answer(card.answer);
      else {
        const guess = STEPS.find(s => (STEP_SEMIS[s] % 12) === pitchClass(e.midi));
        answer(accidentals ? `${guess ?? 'X'}0` : guess ?? 'X');
      }
    }
  });

  useEffect(() => {
    cardStart.current = performance.now();
  }, []);

  // ----- hints -----
  const hintsOn = def.type === 'play' && (def.hints ? resultsRef.current.length < 2 || tries > 0 : tries > 0);
  const playHint = def.type === 'play' && card ? card.pitches[0] : null;
  const keyMarks: KeyMark[] = hintsOn && playHint ? [{ midi: midiOf(playHint), color: def.hand === 'L' ? 'lh' : 'rh', pulse: true }] : [];
  const fretMarks: FretMark[] =
    hintsOn && playHint && isFretted(ctx.instrument)
      ? positionsFor(midiOf(playHint), 12, 0, ctxTuning(ctx)).map(p => ({ ...p, color: 'gold' as MarkColor, pulse: true }))
      : [];

  const range = useMemo(() => {
    if (def.type !== 'play' && def.type !== 'name') return pianoRangeFor([60, 72]);
    return pianoRangeFor(def.pool.map(s => midiOf(parsePitch(s))));
  }, [def]);

  const showNames = resolveVisibility(ctx.settings.noteNames, false);
  const focusId = def.type === 'interval' && !def.harmonic ? elIds[(idx - rowStart) * 2] : elIds[idx - rowStart];
  const isNameLike = def.type === 'name' || def.type === 'interval' || def.type === 'keysig';
  const title = def.title ?? (def.type === 'name' ? (sequence ? 'Note rush' : 'Name the note') : def.type === 'play' ? 'Find it on the instrument' : def.type === 'interval' ? 'How far apart?' : 'Name the key');
  const prompt =
    def.prompt ??
    (def.type === 'name'
      ? 'Tap the letter — or play the note.'
      : def.type === 'play'
        ? isFretted(ctx.instrument)
          ? `Play the written note on your ${instrumentDef(ctx.instrument).short.toLowerCase()} (or tap the fretboard).`
          : 'Play the written note.'
        : def.type === 'interval'
          ? 'Count lines and spaces from the lower note, including both notes.'
          : 'Look at the sharps or flats after the clef.');

  return (
    <div className={`activity flashcards ${isNameLike ? 'has-answers' : ''}`} data-expected={card?.answer}>
      <ActivityHeader title={title} prompt={prompt} badge={`${Math.min(idx + 1, cards.length)} / ${cards.length}`} progress={idx / Math.max(1, cards.length)} />
      <motion.div
        className={`stage-paper paper flash-paper ${feedback && !feedback.ok ? 'shake' : ''}`}
        key={feedback && !feedback.ok ? `bad${tries}` : 'paper'}
      >
        <NotationView
          score={score}
          layout={sequence ? 'scroll' : 'center'}
          states={states}
          focusId={sequence ? focusId : undefined}
          showPlayhead={sequence}
          timeSignature={false}
          barlines={false}
          beatWidth={sequence ? 18 : 12}
          maxScale={sequence ? 1.9 : 2.3}
          noteNames={(feedback && !feedback.ok && tries > 1) || showNames ? 'focus' : 'none'}
          naming={ctx.settings.naming}
          labelSpace
        />
        {def.type !== 'keysig' && (
          <button
            className="btn btn-icon btn-ghost listen-btn"
            aria-label="Hear it"
            onClick={async () => {
              await unlockAudio();
              if (card) synth.play(card.pitches.map(midiOf), { duration: 1.2 });
            }}
          >
            <Volume2 size={18} />
          </button>
        )}
      </motion.div>
      {isNameLike && (
        <div className={`answer-grid ${choices.length > 7 ? 'many' : ''}`} role="group" aria-label="Answers">
          {choices.map((c, i) => {
            const isPicked = feedback?.picked === c.id;
            const reveal = feedback && !feedback.ok && tries >= 2 && c.id === card?.answer;
            return (
              <button
                key={c.id}
                className={`answer-btn ${isPicked ? (feedback!.ok ? 'is-good' : 'is-bad') : ''} ${reveal ? 'is-reveal' : ''}`}
                onClick={() => answer(c.id)}
              >
                <span className="answer-label">{c.label}</span>
                {def.type !== 'name' && <span className="answer-key">{i + 1}</span>}
              </button>
            );
          })}
        </div>
      )}
      {accidentals && (
        <AccidentalRow onPick={(step, alter) => answer(`${step}${alter}`)} feedback={feedback} answerId={card?.answer} tries={tries} />
      )}
      {(def.type === 'play' || def.type === 'name') && (
        <InstrumentPanel
          ctx={ctx}
          range={range}
          marks={keyMarks}
          fretMarks={fretMarks}
          focus={card ? midiOf(card.pitches[0]) : undefined}
          pressedColor={m => heldColor[m] ?? 'gold'}
          interactive={def.type === 'play' || ctx.device.inputMode === 'touch'}
        />
      )}
    </div>
  );
}

/** For accidental naming: a second row of ♯ and ♭ variants. */
function AccidentalRow({ onPick, feedback, answerId, tries }: { onPick: (s: Step, a: number) => void; feedback: { ok: boolean; picked?: string } | null; answerId?: string; tries: number }) {
  const items: { step: Step; alter: number }[] = [];
  for (const s of STEPS) {
    items.push({ step: s, alter: 1 });
    items.push({ step: s, alter: -1 });
  }
  const common = items.filter(x => !((x.step === 'E' || x.step === 'B') && x.alter === 1) && !((x.step === 'F' || x.step === 'C') && x.alter === -1));
  return (
    <div className="answer-grid accidentals" role="group" aria-label="Sharps and flats">
      {common.map(x => {
        const id = `${x.step}${x.alter}`;
        const isPicked = feedback?.picked === id;
        const reveal = feedback && !feedback.ok && tries >= 2 && id === answerId;
        return (
          <button key={id} className={`answer-btn small ${isPicked ? (feedback!.ok ? 'is-good' : 'is-bad') : ''} ${reveal ? 'is-reveal' : ''}`} onClick={() => onPick(x.step, x.alter)}>
            {stepLabel(x.step, x.alter)}
          </button>
        );
      })}
    </div>
  );
}
