/**
 * The coach: the card beside the workbench that runs a theory lesson's step.
 *
 * - Explain: text beside a figure; the keyboard is live for trying things.
 * - Explore: tasks that tick themselves off as you play.
 * - Quiz: a question and a few answers, by eye or by ear. A wrong answer can be tried
 *   again (it no longer counts); after two, the right one is shown with why.
 * - Build: play the answer. Each attempt that misses counts against the first try; after
 *   two (or "Show me"), the answer lights up on the keyboard.
 * - Drill: an activity from the instrument tracks, run in the workbench's place.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Eye, Lightbulb, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { makeRng } from '../../curriculum/generate';
import { useNumberKeys } from '../../engine/input';
import { parseKey } from '../../music/keys';
import { Prose } from '../../synthlab/ui/Prose';
import { attemptMissed, checkPlayed, heldCheck, parseNoteSpec } from '../course/checks';
import type { BuildRound, BuildStep, Check as CheckDef, ExplainStep, ExploreStep, Figure, QuizRound, QuizStep } from '../course/types';
import { hearFigure, type Bench } from './Workbench';

export interface StepResult {
  graded: boolean;
  correct: number;
  total: number;
}

export interface CoachProps<S> {
  step: S;
  bench: Bench;
  keyName?: string;
  /** Seed for generated rounds (a new one each run). */
  seed: number;
  sfxOn: boolean;
  onDone: (r: StepResult) => void;
  /** What the workbench shows: the figure, hidden or not, its keys lit or not, and the keys of an answer. */
  show: (s: { figure?: Figure; hidden?: boolean; answer?: string[]; keysOff?: boolean }) => void;
  /** Under the text, above the buttons (links to where it's used). */
  extra?: ReactNode;
}

function Head({ title, kind }: { title: string; kind: string }) {
  return (
    <div className="course-coach-head">
      <span className="eyebrow">{kind}</span>
      <h2 className="display course-coach-title">{title}</h2>
    </div>
  );
}

export function ExplainCoach({ step, onDone, show, extra }: CoachProps<ExplainStep>) {
  useEffect(() => show({ figure: step.figure }), [step]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind="Learn" />
      <Prose text={step.body} />
      {extra}
      <div className="course-coach-actions">
        <button className="btn btn-primary btn-lg" onClick={() => onDone({ graded: false, correct: 0, total: 0 })}>
          Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function ExploreCoach({ step, bench, keyName, onDone, show, sfxOn }: CoachProps<ExploreStep>) {
  const [done, setDone] = useState<boolean[]>(() => step.tasks.map(() => false));
  const doneRef = useRef(done);
  doneRef.current = done;
  const key = useMemo(() => (keyName ? parseKey(keyName) : undefined), [keyName]);
  useEffect(() => {
    show({ figure: step.figure });
    bench.reset();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () =>
      bench.onNote(b => {
        const state = { held: b.held, struck: b.struck };
        step.tasks.forEach((t, i) => {
          if (doneRef.current[i] || !checkPlayed(t.check, state, key)) return;
          setDone(d => {
            if (d[i]) return d;
            const next = [...d];
            next[i] = true;
            return next;
          });
          if (sfxOn) sfx.correct();
        });
      }),
    [bench.onNote, step, key, sfxOn],
  );
  const all = done.every(Boolean);
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind="Try it" />
      <Prose text={step.body} />
      <ol className="course-tasks">
        {step.tasks.map((t, i) => (
          <li key={i} className={done[i] ? 'done' : ''}>
            <span className="course-task-box">{done[i] ? <Check size={14} /> : i + 1}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ol>
      <div className="course-coach-actions">
        <button className={`btn btn-lg ${all ? 'btn-primary' : ''}`} onClick={() => onDone({ graded: false, correct: 0, total: 0 })}>
          {all ? 'Continue' : 'Skip for now'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function useRounds<R>(rounds: R[] | ((rng: ReturnType<typeof makeRng>) => R[]), seed: number): R[] {
  return useMemo(() => (typeof rounds === 'function' ? rounds(makeRng(seed)) : rounds), [rounds, seed]);
}

export function QuizCoach({ step, seed, onDone, show, sfxOn, keyName }: CoachProps<QuizStep>) {
  const list = useRounds<QuizRound>(step.rounds, seed);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [right, setRight] = useState(false);
  const correct = useRef(0);
  const round = list[i];
  const mode = step.mode ?? 'see';
  const revealed = right || wrong.length >= 2;
  const figure = round?.figure ?? step.figure;

  useEffect(() => {
    // lit keys would give the answer away, unless the keys are the question (no staff)
    show({ figure, hidden: mode === 'hear' && !revealed, keysOff: !revealed && figure?.staff !== false && !figure?.keys });
  }, [i, revealed]); // eslint-disable-line react-hooks/exhaustive-deps
  // ear training: the round plays as it starts
  useEffect(() => {
    if (mode !== 'see' && figure) {
      const t = setTimeout(() => void hearFigure({ ...figure, key: figure.key ?? keyName }), 350);
      return () => clearTimeout(t);
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (i + 1 >= list.length) onDone({ graded: true, correct: correct.current, total: list.length });
    else {
      setI(i + 1);
      setWrong([]);
      setRight(false);
    }
  };

  const answer = (opt: string) => {
    if (!round || revealed) return;
    if (opt === round.answer) {
      if (!wrong.length) correct.current++;
      setRight(true);
      if (sfxOn) sfx.correct();
      // nothing to read: straight on
      if (!wrong.length && !round.explain) setTimeout(next, 650);
    } else {
      if (wrong.includes(opt)) return;
      setWrong(w => [...w, opt]);
      if (sfxOn) sfx.wrong();
    }
  };
  useNumberKeys(true, n => {
    const o = round?.options[n - 1];
    if (o) answer(o);
  });

  if (!round) return null;
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind={mode === 'hear' ? 'Listen' : 'Quiz'} />
      {i === 0 && step.body && <Prose text={step.body} />}
      <span className="course-round">
        Question {i + 1} of {list.length}
      </span>
      <div className="course-question">{round.prompt ?? step.question}</div>
      <div className="course-options" role="group" aria-label="Answers">
        {round.options.map((o, k) => {
          const isRight = revealed && o === round.answer;
          const isWrong = wrong.includes(o);
          return (
            <button key={o} className={`course-option ${right && o === round.answer ? 'right' : ''} ${isWrong ? 'wrong' : ''} ${!right && isRight ? 'reveal' : ''}`} onClick={() => answer(o)} disabled={revealed && !isRight}>
              {o}
              <span className="sr-only"> ({k + 1})</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {revealed && (
          <motion.div className={`course-feedback ${right && !wrong.length ? 'good' : right ? 'info' : 'bad'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {right ? <Check size={18} /> : <X size={18} />}
            <span>
              {right ? (wrong.length ? 'Got there. ' : 'Right. ') : `It’s ${round.answer}. `}
              {round.explain}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {revealed && (round.explain || wrong.length > 0) && (
        <div className="course-coach-actions">
          <button className="btn btn-primary btn-lg" onClick={next} autoFocus>
            {i + 1 >= list.length ? 'Continue' : 'Next'} <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

/** How many notes a held check needs before letting go counts as an attempt. */
function heldNeeds(check: CheckDef): number {
  if (check.kind === 'chord') return 3;
  if (check.kind === 'interval') return 2;
  if (check.kind === 'notes') return new Set(check.notes.map(n => parseNoteSpec(n).pc)).size;
  return 1;
}

export function BuildCoach({ step, bench, keyName, seed, onDone, show, sfxOn }: CoachProps<BuildStep>) {
  const list = useRounds<BuildRound>(step.rounds, seed);
  const [i, setI] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const correct = useRef(0);
  const round = list[i];
  const key = useMemo(() => (keyName ? parseKey(keyName) : undefined), [keyName]);
  const maxHeld = useRef(0);
  const state = useRef({ i, solved, misses, hint });
  state.current = { i, solved, misses, hint };
  const showAnswer = hint || misses >= 2;

  const hear = step.mode === 'hear';
  useEffect(() => {
    show({ figure: round?.figure ?? step.figure, hidden: hear && !solved && !showAnswer, answer: showAnswer && !solved ? round?.answer : undefined });
  }, [i, showAnswer, solved]); // eslint-disable-line react-hooks/exhaustive-deps
  // play back what you hear: the round plays as it starts
  useEffect(() => {
    const f = round?.figure ?? step.figure;
    if (!hear || !f) return;
    const t = setTimeout(() => void hearFigure({ ...f, key: f.key ?? keyName }), 350);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    bench.reset();
    maxHeld.current = 0;
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (state.current.i + 1 >= list.length) onDone({ graded: true, correct: correct.current, total: list.length });
    else {
      setI(state.current.i + 1);
      setMisses(0);
      setHint(false);
      setSolved(false);
    }
  };

  useEffect(
    () =>
      bench.onNote(b => {
        if (!round || state.current.solved) return;
        maxHeld.current = Math.max(maxHeld.current, b.held.length);
        if (checkPlayed(round.check, { held: b.held, struck: b.struck }, key)) {
          if (!state.current.misses && !state.current.hint) correct.current++;
          setSolved(true);
          if (sfxOn) sfx.correct();
          setTimeout(next, round.explain ? 1600 : 1000);
          return;
        }
        if (attemptMissed(round.check, b.struck)) {
          setMisses(m => m + 1);
          if (sfxOn) sfx.wrong();
          // the next attempt starts from the note just played
          bench.reset();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bench.onNote, round, key, sfxOn],
  );
  useEffect(
    () =>
      bench.onRelease(() => {
        if (!round || state.current.solved || !heldCheck(round.check)) return;
        if (maxHeld.current >= heldNeeds(round.check)) {
          setMisses(m => m + 1);
          if (sfxOn) sfx.wrong();
        }
        maxHeld.current = 0;
      }),
    [bench.onRelease, round, sfxOn],
  );

  if (!round) return null;
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind={hear ? 'Play it back' : 'Play it'} />
      {i === 0 && step.body && <Prose text={step.body} />}
      <span className="course-round">
        {i + 1} of {list.length}
      </span>
      <div className="course-question">{round.prompt}</div>
      <p className="faint th-play-note">{heldCheck(round.check) ? 'Hold the notes down together.' : round.check.kind === 'note' ? 'Play it on the keyboard.' : 'Play the notes one after another.'}</p>
      <AnimatePresence mode="wait">
        {solved ? (
          <motion.div key="yes" className="course-feedback good" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Check size={18} />
            <span>Yes! {round.explain}</span>
          </motion.div>
        ) : showAnswer ? (
          <motion.div key="show" className="course-feedback info" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Lightbulb size={18} />
            <span>The green keys show the answer. {round.explain} Play it to go on.</span>
          </motion.div>
        ) : misses > 0 ? (
          <motion.div key="miss" className="course-feedback bad" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <X size={18} />
            <span>Not quite. Look at the staff to see what you played, and try again.</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!solved && !showAnswer && (
        <div className="course-coach-actions">
          <button className="btn" onClick={() => setHint(true)}>
            <Eye size={16} /> Show me
          </button>
        </div>
      )}
    </div>
  );
}
