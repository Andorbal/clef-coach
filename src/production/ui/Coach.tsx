/**
 * The coach: the card beside the console that runs a lesson step.
 *
 * - Explain: a short read; "hear it" buttons put another mix on the loop (dry, then with
 *   reverb), and "Your console" brings the learner's own back.
 * - Explore: tasks that tick themselves off as the console and its meters get there.
 * - Listen: hear one mix, or A and B, and say what's different. Answer once, then see.
 * - Mix: the quiz. Target and Yours switch the console between the mix to make and the
 *   learner's while the loop plays; Check renders and measures the learner's mix in the
 *   studio worker (dsp/judge). Hints name what's furthest off and light its strip; after
 *   two checks, "Show answer" puts markers where the target's controls sit.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Ear, Eye, Lightbulb, Play, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { makeRng } from '../../curriculum/generate';
import { sfx } from '../../audio/sfx';
import { Prose } from '../../synthlab/ui/Prose';
import { type Aspect, type JudgeResult, PASS_MARK } from '../dsp/judge';
import { type Mix, makeMix } from '../dsp/params';
import { holds } from '../course/build';
import type { ExplainStep, ExploreStep, ListenRound, ListenStep, MixStep } from '../course/types';
import type { ConsoleApi } from './useConsole';
import { Visual } from './Visuals';

export interface StepResult {
  graded: boolean;
  /** 0..1 */
  score: number;
  passed: boolean;
}

export interface CoachProps<S> {
  step: S;
  api: ConsoleApi;
  /** The full mix the step starts from. */
  base: Mix;
  seed: number;
  sfxOn: boolean;
  onDone: (r: StepResult) => void;
}

function Head({ title, kind }: { title: string; kind: string }) {
  return (
    <div className="course-coach-head">
      <span className="eyebrow">{kind}</span>
      <h2 className="display course-coach-title">{title}</h2>
    </div>
  );
}

/** Start the loop if it isn't playing (hearing is the point of every step). */
const ensurePlaying = (api: ConsoleApi) => {
  if (!api.playing && api.ready) void api.play();
};

export function ExplainCoach({ step, api, base, onDone }: CoachProps<ExplainStep>) {
  const full = (m: Mix) => makeMix(api.channels, base, m);
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind="Learn" />
      {step.visual && <Visual id={step.visual} />}
      <Prose text={step.body} />
      {step.hear && (
        <div className="pr-hear">
          {step.hear.map(h => (
            <button
              key={h.label}
              className={`btn ${api.audition === h.label ? 'on' : ''}`}
              disabled={!api.ready}
              onClick={() => {
                api.hearMix(h.label, full(h.mix));
                ensurePlaying(api);
              }}
            >
              <Ear size={16} /> {h.label}
            </button>
          ))}
          <button className={`btn btn-ghost ${api.audition === null ? 'on' : ''}`} disabled={!api.ready} onClick={() => api.hearMix(null)}>
            <SlidersHorizontal size={16} /> Your console
          </button>
        </div>
      )}
      <div className="course-coach-actions">
        <button className="btn btn-primary btn-lg" onClick={() => onDone({ graded: false, score: 1, passed: true })}>
          Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function ExploreCoach({ step, api, onDone, sfxOn }: CoachProps<ExploreStep>) {
  const [done, setDone] = useState<boolean[]>(() => step.tasks.map(() => false));
  const doneRef = useRef(done);
  // the console's settings and the meters, checked as they change
  useEffect(() => {
    const check = () => {
      const meters = api.meterState();
      const next = step.tasks.map((t, i) => doneRef.current[i] || holds(t.check, api.getMix(), { playing: api.playing, meters }));
      if (next.some((v, i) => v !== doneRef.current[i])) {
        if (sfxOn) sfx.correct();
        doneRef.current = next;
        setDone(next);
      }
    };
    check();
    if (!api.playing) return;
    const t = setInterval(check, 250);
    return () => clearInterval(t);
  }, [api, step, sfxOn]);
  const all = done.every(Boolean);
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind="Try it" />
      <Prose text={step.body} />
      <ol className="course-tasks">
        {step.tasks.map((t, i) => (
          <li key={i} className={done[i] ? 'done' : ''}>
            <span className="course-task-box">{done[i] ? <Check size={14} /> : i + 1}</span>
            <Prose text={t.text} />
          </li>
        ))}
      </ol>
      <div className="course-coach-actions">
        <button className={`btn ${all ? 'btn-primary' : ''} btn-lg`} onClick={() => onDone({ graded: false, score: 1, passed: true })}>
          {all ? 'Continue' : 'Skip for now'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function useRounds(rounds: ListenStep['rounds'], seed: number): ListenRound[] {
  return useMemo(() => (typeof rounds === 'function' ? rounds(makeRng(seed)) : rounds), [rounds, seed]);
}

export function ListenCoach({ step, api, base, seed, onDone, sfxOn }: CoachProps<ListenStep>) {
  const list = useRounds(step.rounds, seed);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const correct = useRef(0);
  const round = list[i];
  const labels = round && round.mixes.length > 1 ? round.mixes.map((_, k) => String.fromCharCode(65 + k)) : ['Play'];
  const hear = (k: number) => {
    api.hearMix(labels[k], makeMix(api.channels, base, round.mixes[k]));
    // each round starts its clips from the top, so A and B are heard on the same bars
    if (!api.playing || api.audition === null) void api.play(0);
  };
  // the first clip plays as a round starts
  useEffect(() => {
    if (!round || !api.ready) return;
    const t = setTimeout(() => {
      api.hearMix(labels[0], makeMix(api.channels, base, round.mixes[0]));
      void api.play(0);
    }, 300);
    return () => clearTimeout(t);
  }, [i, api.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // the learner's own console comes back at the end
  useEffect(() => () => api.hearMix(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (v: string) => {
    if (picked) return;
    setPicked(v);
    if (v === round.answer) {
      correct.current++;
      if (sfxOn) sfx.correct();
    } else if (sfxOn) sfx.wrong();
  };
  const next = () => {
    if (i + 1 >= list.length) {
      const score = correct.current / list.length;
      onDone({ graded: true, score, passed: score >= 0.7 });
    } else {
      setI(i + 1);
      setPicked(null);
    }
  };
  if (!round) return null;
  const right = picked === round.answer;
  const answerLabel = step.options.find(o => o.value === round.answer)?.label ?? round.answer;
  return (
    <div className="course-coach-body">
      <Head title={step.title} kind="Listen" />
      {i === 0 && step.body && <Prose text={step.body} />}
      <span className="course-round">
        Round {i + 1} of {list.length}
      </span>
      <div className="pr-hear">
        {labels.map((l, k) => (
          <button key={l} className={`btn ${api.audition === l ? 'on' : ''}`} onClick={() => hear(k)} disabled={!api.ready}>
            <Play size={16} /> {l === 'Play' ? 'Play it' : l}
          </button>
        ))}
      </div>
      <div className="course-question">{step.question}</div>
      <div className="course-options" role="group" aria-label="Answers">
        {step.options.map(o => (
          <button key={o.value} className={`course-option ${picked && o.value === round.answer ? (right ? 'right' : 'reveal') : ''} ${picked === o.value && !right ? 'wrong' : ''}`} onClick={() => answer(o.value)} disabled={!!picked && o.value !== round.answer && o.value !== picked}>
            {o.label}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {picked && (
          <motion.div className={`course-feedback ${right ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {right ? <Check size={18} /> : <X size={18} />}
            <span>
              {right ? 'Right. ' : `It was ${answerLabel}. `}
              {round.explain ?? (right ? '' : 'Listen to them again now you know.')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {picked && (
        <div className="course-coach-actions">
          <button className="btn btn-primary btn-lg" onClick={next} autoFocus>
            {i + 1 >= list.length ? 'Continue' : 'Next'} <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

const ASPECT_LABEL: Record<Aspect | 'goal', string> = { balance: 'Balance', pan: 'Panning', tone: 'Tone', dynamics: 'Dynamics', space: 'Space', master: 'Master', goal: 'Goals' };

export function MixCoach({
  step,
  api,
  base,
  onDone,
  sfxOn,
  judgeKey,
  onGhost,
  onHighlight,
  setTransport,
}: CoachProps<MixStep> & { judgeKey: string; onGhost: (m: Mix | null) => void; onHighlight: (id: string | null) => void; setTransport: (n: ReactNode) => void }) {
  const target = useMemo(() => (step.target ? makeMix(api.channels, base, step.target) : null), [step, base, api.channels]);
  const pass = step.pass ?? PASS_MARK;
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [prev, setPrev] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [checks, setChecks] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [passed, setPassed] = useState(false);
  const [failed, setFailed] = useState(false);
  const checked = useRef<Mix | null>(null);

  useEffect(() => {
    let live = true;
    setReady(false);
    api.studio
      .prepareJudge({ key: judgeKey, req: { session: api.session, channels: api.uses }, start: base, target: target ?? undefined, spec: { goals: step.goals, aspects: step.aspects, channels: step.channels } })
      .then(() => live && setReady(true))
      .catch(e => {
        console.error(e);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      onGhost(null);
      onHighlight(null);
      api.hearMix(null);
    };
  }, [judgeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Target and Yours, in the transport bar
  useEffect(() => {
    if (!target) return setTransport(null);
    setTransport(
      <div className="pr-ab" role="group" aria-label="Hear">
        <button
          className={api.audition === 'Target' ? 'on' : ''}
          aria-pressed={api.audition === 'Target'}
          onClick={() => {
            api.hearMix('Target', target);
            ensurePlaying(api);
          }}
        >
          Target
        </button>
        <button className={api.audition === null ? 'on' : ''} aria-pressed={api.audition === null} onClick={() => api.hearMix(null)}>
          Yours
        </button>
      </div>,
    );
  }, [api, target, setTransport]);
  useEffect(() => () => setTransport(null), [setTransport]);

  const changed = checked.current !== null && checked.current !== api.mix;

  const check = async () => {
    if (!ready) return;
    setThinking(true);
    const mine = api.getMix();
    try {
      const r = await api.studio.score(judgeKey, mine);
      checked.current = mine;
      setPrev(result?.overall ?? null);
      setResult(r);
      setChecks(c => c + 1);
      setBest(b => Math.max(b, r.overall));
      if (r.overall >= pass) {
        if (!passed && sfxOn) sfx.complete();
        setPassed(true);
        setHintText(null);
        onHighlight(null);
      }
    } finally {
      setThinking(false);
    }
  };

  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedback.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [checks, hintText]);

  const hint = async () => {
    setHints(h => h + 1);
    let r = result;
    if (!r || checked.current !== api.getMix()) {
      setThinking(true);
      r = await api.studio.score(judgeKey, api.getMix()).finally(() => setThinking(false));
      checked.current = api.getMix();
      setResult(r);
    }
    const w = r.worst;
    if (!w || w.score >= pass) setHintText('You’re very close: small moves only. Switch between Target and Yours and listen.');
    else {
      setHintText(w.hint);
      onHighlight(w.where);
    }
  };

  const reveal = () => {
    setRevealed(true);
    onGhost(target ?? (step.answer ? makeMix(api.channels, base, step.answer) : null));
    setHintText(target || step.answer ? 'The dashed markers show where the controls could sit. Match them, then check again.' : 'Look at what the goals ask for, and the meters as the loop plays.');
  };

  const finish = () => {
    const penalty = Math.min(0.3, hints * 0.05);
    const raw = Math.min(1, best / pass);
    const score = Math.max(0, revealed ? Math.min(0.6, raw - penalty) : raw - penalty);
    onDone({ graded: true, score, passed: passed && !revealed });
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const verdict = !result ? null : result.overall >= pass ? 'That’s it!' : result.overall >= pass - 0.1 ? 'Very close' : result.overall >= 0.4 ? 'Getting there' : 'Not yet';
  const trend = result && prev !== null && !passed ? (result.overall > prev + 0.03 ? 'Closer than last time.' : result.overall < prev - 0.03 ? 'Further away than last time.' : 'About the same as last time.') : null;

  return (
    <div className="course-coach-body">
      <Head title={step.title} kind={target ? 'Match the mix' : 'Mix it'} />
      <Prose text={step.body} />
      {step.goals && step.goals.length > 0 && !target && (
        <div className="course-feedback info">
          <SlidersHorizontal size={16} />
          <span>Press Check when the meters say you’re there.</span>
        </div>
      )}
      {failed && <div className="course-feedback bad">The judge couldn’t start. Leave the lesson and try again.</div>}
      {result && (
        <motion.div className={`sl-score ${result.overall >= pass ? 'pass' : ''}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} key={checks}>
          <div className="sl-score-top">
            <strong className="display">{verdict}</strong>
            <span className="sl-score-pct tabular">{pct(result.overall)}</span>
          </div>
          <div className="sl-meter" aria-hidden>
            <span style={{ transform: `scaleX(${Math.min(1, result.overall)})` }} />
            <i style={{ left: `${pass * 100}%` }} />
          </div>
          <div className="sl-aspects">
            {(Object.keys(result.aspects) as (Aspect | 'goal')[]).map(a => (
              <div key={a} className={`sl-aspect ${result.aspects[a]! >= 0.85 ? 'good' : result.aspects[a]! >= 0.6 ? 'ok' : 'low'}`}>
                <span>{ASPECT_LABEL[a]}</span>
                <span className="sl-aspect-bar">
                  <span style={{ transform: `scaleX(${result.aspects[a]})` }} />
                </span>
              </div>
            ))}
          </div>
          {trend && <p className="faint sl-trend">{trend}</p>}
        </motion.div>
      )}
      {hintText && (
        <div className="sl-hint">
          <Lightbulb size={16} />
          <Prose text={hintText} />
        </div>
      )}
      <div ref={feedback} />
      <div className="course-coach-actions">
        {passed ? (
          <>
            <button className="btn btn-primary btn-lg" onClick={finish}>
              Continue <ArrowRight size={18} />
            </button>
            {changed && (
              <button className="btn" onClick={check} disabled={thinking}>
                <RotateCcw size={16} /> Check again
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-lg" onClick={check} disabled={!ready || thinking}>
              <Check size={18} /> {!ready ? 'Getting ready…' : thinking ? 'Listening…' : 'Check'}
            </button>
            <button className="btn" onClick={hint} disabled={!ready || thinking}>
              <Lightbulb size={16} /> {hints === 0 ? 'Hint' : 'Another hint'}
            </button>
            {checks >= 2 && !revealed && (
              <button className="btn btn-ghost" onClick={reveal}>
                <Eye size={16} /> Show answer
              </button>
            )}
            {(revealed || checks >= 4) && (
              <button className="btn btn-ghost" onClick={finish}>
                Move on <ArrowRight size={16} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
