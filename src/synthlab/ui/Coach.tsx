/**
 * The coach: the card beside the synth that runs a lesson step.
 *
 * - Explain: text and a picture; the panel is live for trying things.
 * - Explore: tasks that tick themselves off when the patch and a played note say so.
 * - Listen: hear a sound, pick what it is.
 * - Match: the quiz. Play the target, play yours, press Check: the judge (dsp/matcher)
 *   scores pitch, tone, shape and movement. Hints get more specific each time: first which
 *   aspect is off, then which control to move and which way (found by trying each), then
 *   roughly where. "Show answer" puts ghost markers on the knobs.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Ear, Eye, Lightbulb, Play, RotateCcw, Square as Stop, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext, unlockAudio } from '../../audio/context';
import { sfx } from '../../audio/sfx';
import type { MatchResult } from '../dsp/match';
import { Matcher } from '../dsp/matcher';
import { PARAMS, type ParamKey, type Patch, makePatch } from '../dsp/params';
import { phrase, renderPhrase } from '../dsp/render';
import { PASS_MARK, type ExplainStep, type ExploreStep, type ListenStep, type MatchStep } from '../course/types';
import { CONTROLS, moduleOf } from './controls';
import { formatValue, optionLabel } from './format';
import { Illustration } from './Illustrations';
import { Prose } from './Prose';
import type { Lab } from './useLab';

export interface StepResult {
  graded: boolean;
  /** 0..1 */
  score: number;
  passed: boolean;
}

interface CoachProps<S> {
  step: S;
  lab: Lab;
  /** The patch the step started from (lesson start + step start). */
  base: Patch;
  visible: readonly ParamKey[];
  onDone: (r: StepResult) => void;
}

function Head({ title, kind }: { title: string; kind: string }) {
  return (
    <div className="sl-coach-head">
      <span className="eyebrow">{kind}</span>
      <h2 className="display sl-coach-title">{title}</h2>
    </div>
  );
}

export function ExplainCoach({ step, onDone }: CoachProps<ExplainStep>) {
  return (
    <div className="sl-coach-body">
      <Head title={step.title} kind="Learn" />
      {step.visual && <Illustration id={step.visual} />}
      <Prose text={step.body} />
      <div className="sl-coach-actions">
        <button className="btn btn-primary btn-lg" onClick={() => onDone({ graded: false, score: 1, passed: true })}>
          Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function ExploreCoach({ step, lab, onDone }: CoachProps<ExploreStep>) {
  const [done, setDone] = useState<boolean[]>(() => step.tasks.map(() => false));
  const doneRef = useRef(done);
  doneRef.current = done;
  const patchRef = useRef(lab.patch);
  patchRef.current = lab.patch;

  const tick = (i: number) => {
    setDone(d => {
      if (d[i]) return d;
      const next = [...d];
      next[i] = true;
      return next;
    });
    sfx.correct();
  };

  // tasks that need a note: done when one sounds while their condition holds
  useEffect(
    () =>
      lab.onNote(e => {
        if (!e.on) return;
        step.tasks.forEach((t, i) => {
          if (!doneRef.current[i] && t.play && t.check(patchRef.current)) tick(i);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lab.onNote, step],
  );
  // tasks that only need a setting
  useEffect(() => {
    step.tasks.forEach((t, i) => {
      if (!done[i] && !t.play && t.check(lab.patch)) tick(i);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.patch]);

  const all = done.every(Boolean);
  return (
    <div className="sl-coach-body">
      <Head title={step.title} kind="Try it" />
      <Prose text={step.body} />
      <ol className="sl-tasks">
        {step.tasks.map((t, i) => (
          <li key={i} className={done[i] ? 'done' : ''}>
            <span className="sl-task-box">{done[i] ? <Check size={14} /> : i + 1}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ol>
      {step.loop && !lab.loop && (
        <button className="chip-btn sl-coach-loop" onClick={() => lab.playLoop(step.loop!)}>
          <Play size={14} /> Play a loop while you turn the knobs
        </button>
      )}
      <div className="sl-coach-actions">
        <button className={`btn btn-lg ${all ? 'btn-primary' : ''}`} onClick={() => onDone({ graded: false, score: 1, passed: true })}>
          {all ? 'Continue' : 'Skip ahead'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/** Plays rendered clips (the target, yours, a listening round) through the lab synth. */
function useClip(lab: Lab) {
  const [playing, setPlaying] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const play = async (id: string, patch: Patch, ph: ReturnType<typeof phrase>, length?: number) => {
    await unlockAudio();
    await lab.synth.start();
    lab.silence();
    const ctx = getAudioContext();
    const r = renderPhrase(patch, ph, ctx.sampleRate, length ?? ph.length);
    const dur = lab.synth.playClip(r);
    setPlaying(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlaying(p => (p === id ? null : p)), dur * 1000);
  };
  const stop = () => {
    lab.synth.stopClip();
    setPlaying(null);
  };
  return { playing, play, stop };
}

export function ListenCoach({ step, lab, base, onDone }: CoachProps<ListenStep>) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const clip = useClip(lab);
  const round = step.rounds[i];
  const patch = useMemo(() => makePatch(round.patch, base), [round, base]);
  const ph = phrase(round.phrase ?? 'note');
  const playRound = () => clip.play(`r${i}`, patch, ph);
  const choose = (v: string) => {
    if (answer) return;
    setAnswer(v);
    if (v === round.answer) {
      setCorrect(c => c + 1);
      sfx.correct();
    } else sfx.wrong();
  };
  const next = () => {
    if (i + 1 < step.rounds.length) {
      setI(i + 1);
      setAnswer(null);
    } else {
      const score = correct / step.rounds.length;
      onDone({ graded: true, score, passed: score >= 0.6 });
    }
  };
  const label = (v: string) => step.options.find(o => o.value === v)?.label ?? v;
  return (
    <div className="sl-coach-body">
      <Head title={step.title} kind={`Listen · ${i + 1} of ${step.rounds.length}`} />
      <Prose text={step.body} />
      <button className={`sl-listen-play ${clip.playing ? 'playing' : ''}`} onClick={playRound}>
        <span className="sl-listen-icon">
          <Ear size={26} />
        </span>
        <span>
          <strong>{clip.playing ? 'Playing…' : answer ? 'Hear it again' : 'Play the sound'}</strong>
          <span className="faint">{step.question}</span>
        </span>
      </button>
      <div className="sl-listen-options">
        {step.options.map(o => (
          <button
            key={o.value}
            className={`btn sl-listen-option ${answer && o.value === round.answer ? 'right' : ''} ${answer === o.value && o.value !== round.answer ? 'wrong' : ''}`}
            onClick={() => choose(o.value)}
            disabled={!!answer && o.value !== answer && o.value !== round.answer}
          >
            {o.label}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {answer && (
          <motion.div className={`sl-feedback ${answer === round.answer ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {answer === round.answer ? <Check size={18} /> : <X size={18} />}
            <span>{answer === round.answer ? 'Yes!' : `It was ${label(round.answer).toLowerCase()}.`}</span>
            <button className="btn btn-primary" onClick={next}>
              {i + 1 < step.rounds.length ? 'Next' : 'Done'} <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ASPECT_HELP: Record<'pitch' | 'tone' | 'shape' | 'movement', [string, string]> = {
  pitch: ['Pitch', 'the note it plays'],
  tone: ['Tone', 'its colour: bright or dark, pure or buzzy'],
  shape: ['Shape', 'how it starts, holds and ends'],
  movement: ['Movement', 'wobble: how fast, how much'],
};

const ASPECT_HINT: Record<keyof typeof ASPECT_HELP, string> = {
  pitch: 'Listen to the **pitch**: is the target higher or lower than yours? Octaves and semitones live in the oscillator.',
  tone: 'Listen to the **tone**: is the target brighter or darker, purer or buzzier than yours?',
  shape: 'Listen to the **shape**: how does each note start, how long does it last, how does it end?',
  movement: 'Listen for **movement**: what wobbles, how fast, and how far?',
};

function directionWords(k: ParamKey, dir: 'up' | 'down' | 'change' | 'on' | 'off'): string {
  const spec = PARAMS[k];
  const name = CONTROLS[k].label.toLowerCase();
  if (dir === 'on') return `turning **${name}** on`;
  if (dir === 'off') return `turning **${name}** off`;
  if (dir === 'change') return `a different **${name}**`;
  if (spec.kind === 'num') {
    if (spec.unit === 's') return `a ${dir === 'up' ? 'longer' : 'shorter'} **${name}**`;
    if (k === 'filterCutoff') return `${dir === 'up' ? 'raising' : 'lowering'} the **cutoff** (${dir === 'up' ? 'brighter' : 'darker'})`;
    if (spec.unit === 'Hz' || spec.unit === 'st' || spec.unit === 'oct' || spec.unit === 'x') return `${dir === 'up' ? 'raising' : 'lowering'} the **${name}**`;
    return `${dir === 'up' ? 'more' : 'less'} **${name}**`;
  }
  return `changing the **${name}**`;
}

export function MatchCoach({
  step,
  lab,
  base,
  visible,
  onDone,
  onGhost,
  onHighlight,
}: CoachProps<MatchStep> & { onGhost: (p: Patch | null) => void; onHighlight: (k: ParamKey | null) => void }) {
  const target = useMemo(() => makePatch(step.target, base), [step, base]);
  const ph = useMemo(() => phrase(step.phrase ?? 'note'), [step.phrase]);
  const pass = step.pass ?? PASS_MARK;
  const [matcher, setMatcher] = useState<Matcher | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [prev, setPrev] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [checks, setChecks] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [passed, setPassed] = useState(false);
  const clip = useClip(lab);
  const checkedPatch = useRef<Patch | null>(null);

  // build the judge after the step has appeared (it renders the target once)
  useEffect(() => {
    const t = setTimeout(() => setMatcher(new Matcher(target, ph)), 30);
    return () => clearTimeout(t);
  }, [target, ph]);
  useEffect(() => () => {
    onGhost(null);
    onHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = checkedPatch.current !== null && checkedPatch.current !== lab.patch;

  const check = async () => {
    if (!matcher) return;
    setThinking(true);
    await new Promise(r => setTimeout(r, 10));
    const r = matcher.score(lab.patch);
    checkedPatch.current = lab.patch;
    setPrev(result?.overall ?? null);
    setResult(r);
    setChecks(c => c + 1);
    setBest(b => Math.max(b, r.overall));
    setThinking(false);
    if (r.overall >= pass) {
      if (!passed) sfx.complete();
      setPassed(true);
      setHintText(null);
      onHighlight(null);
    }
  };

  // keep the newest feedback in view (the coach card scrolls on small screens)
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedback.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [checks, hintText]);

  const hint = async () => {
    if (!matcher) return;
    setThinking(true);
    const level = hints + 1;
    setHints(level);
    const r = result ?? matcher.score(lab.patch);
    if (!result) setResult(r);
    if (level === 1) {
      const aspects = (['pitch', 'tone', 'shape', 'movement'] as const).filter(a => r[a] !== null);
      const worst = aspects.reduce((a, b) => ((r[a] ?? 1) <= (r[b] ?? 1) ? a : b));
      setHintText(ASPECT_HINT[worst]);
    } else {
      const found = await matcher.hints(lab.patch, visible);
      const h = found[0];
      if (!h) setHintText('You’re very close: small tweaks only. Compare the two sounds carefully.');
      else {
        const mod = moduleOf(h.key, lab.patch.engine);
        const where = mod ? ` (in the ${mod.title.toLowerCase()})` : '';
        if (level === 2) setHintText(`Try ${directionWords(h.key, h.direction)}${where}.`);
        else {
          const spec = PARAMS[h.key];
          const v = spec.kind === 'enum' ? optionLabel(String(h.value)) : formatValue(h.key, h.value as never);
          setHintText(`The target’s **${CONTROLS[h.key].label.toLowerCase()}** is about **${v}**${where}.`);
        }
        onHighlight(h.key);
      }
    }
    setThinking(false);
  };

  const reveal = () => {
    setRevealed(true);
    onGhost(target);
    setHintText('The dashed markers show where the target sits. Set your controls to match them, then check again.');
  };

  const finish = () => {
    // hints and a revealed answer cost a little
    const penalty = Math.min(0.3, hints * 0.05);
    const raw = Math.min(1, best / pass);
    const score = Math.max(0, revealed ? Math.min(0.6, raw - penalty) : raw - penalty);
    onDone({ graded: true, score, passed: passed && !revealed });
  };

  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
  const verdict = !result ? null : result.overall >= pass ? 'That’s it!' : result.overall >= pass - 0.08 ? 'Very close' : result.overall >= 0.55 ? 'Getting there' : 'Not yet';
  const trend = result && prev !== null && !passed ? (result.overall > prev + 0.02 ? 'Closer than last time.' : result.overall < prev - 0.02 ? 'Further away than last time.' : 'About the same as last time.') : null;

  return (
    <div className="sl-coach-body">
      <Head title={step.title} kind="Match the sound" />
      <Prose text={step.body} />
      <div className="sl-ab">
        <button className={`sl-ab-btn target ${clip.playing === 'target' ? 'playing' : ''}`} onClick={() => (clip.playing === 'target' ? clip.stop() : clip.play('target', target, ph, matcher?.length))}>
          {clip.playing === 'target' ? <Stop size={18} /> : <Play size={18} />}
          <span>
            <strong>Target</strong>
            <small className="faint">the sound to make</small>
          </span>
        </button>
        <button className={`sl-ab-btn mine ${clip.playing === 'mine' ? 'playing' : ''}`} onClick={() => (clip.playing === 'mine' ? clip.stop() : clip.play('mine', lab.patch, ph, matcher?.length))}>
          {clip.playing === 'mine' ? <Stop size={18} /> : <Play size={18} />}
          <span>
            <strong>Yours</strong>
            <small className="faint">the same notes</small>
          </span>
        </button>
      </div>
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
            {(['pitch', 'tone', 'shape', 'movement'] as const).map(a =>
              result[a] === null ? null : (
                <div key={a} className={`sl-aspect ${result[a]! >= 0.85 ? 'good' : result[a]! >= 0.6 ? 'ok' : 'low'}`} title={ASPECT_HELP[a][1]}>
                  <span>{ASPECT_HELP[a][0]}</span>
                  <span className="sl-aspect-bar">
                    <span style={{ transform: `scaleX(${result[a]})` }} />
                  </span>
                </div>
              ),
            )}
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
      <div ref={feedback} className="sl-feedback-anchor" />
      <div className="sl-coach-actions">
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
            <button className="btn btn-primary btn-lg" onClick={check} disabled={!matcher || thinking}>
              <Check size={18} /> {thinking ? 'Listening…' : 'Check'}
            </button>
            <button className="btn" onClick={hint} disabled={!matcher || thinking || hints >= 3}>
              <Lightbulb size={16} /> {hints === 0 ? 'Hint' : hints >= 3 ? 'No more hints' : 'Another hint'}
            </button>
            {checks >= 2 && !revealed && (
              <button className="btn btn-ghost" onClick={reveal}>
                <Eye size={16} /> Show answer
              </button>
            )}
            {revealed && (
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
