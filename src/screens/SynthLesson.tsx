/**
 * A Synth School lesson: the coach card (left, or on top on a phone) runs the steps, the
 * synth panel shows only the controls the lesson has introduced, and the keyboard sits at
 * the bottom. Results at the end count towards XP, the streak and achievements like any
 * other lesson.
 */
import { motion } from 'framer-motion';
import { ArrowRight, Award, BookOpen, Clock, Flame, Music2, RotateCcw, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { sfx } from '../audio/sfx';
import { Modal, ProgressRing, Sparks, Stars } from '../components/ui';
import { usePracticeFocus } from '../components/usePracticeFocus';
import type { OutcomeReport } from '../state/logic';
import { useApp, useProfile } from '../state/store';
import { type ParamKey, type Patch, makePatch } from '../synthlab/dsp/params';
import { findLesson, lessonAfter, testOutLessonIds, unitUnlocked } from '../synthlab/course/progress';
import type { StepDef } from '../synthlab/course/types';
import { ExplainCoach, ExploreCoach, ListenCoach, MatchCoach, type StepResult } from '../synthlab/ui/Coach';
import { Keys } from '../synthlab/ui/Keys';
import { SynthPanel } from '../synthlab/ui/SynthPanel';
import { useLab } from '../synthlab/ui/useLab';
import '../synthlab/ui/synthlab.css';
import './lesson.css';
import './synth.css';

const KIND_LABEL: Record<StepDef['type'], string> = { explain: 'Learn', explore: 'Try it', listen: 'Listen', match: 'Match' };

function starsFor(score: number, pass: number): number {
  if (score >= 0.95) return 3;
  if (score >= 0.85) return 2;
  return score >= pass ? 1 : 0;
}

interface Summary {
  score: number;
  stars: number;
  passed: boolean;
  xp: number;
  ms: number;
  notes: number;
  report: OutcomeReport | null;
  testedOut: boolean;
}

export default function SynthLesson() {
  const { lessonId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const record = useApp(s => s.recordSynthOutcome);
  const testOut = useApp(s => s.synthTestOut);
  usePracticeFocus();
  const ref = useMemo(() => findLesson(lessonId), [lessonId]);
  const lesson = ref?.lesson;
  const lessonStart = useMemo(() => makePatch(lesson?.start ?? {}), [lesson]);
  const baseFor = useCallback((s: StepDef | undefined): Patch => makePatch(s?.start ?? {}, lessonStart), [lessonStart]);
  const devStep = import.meta.env.DEV && search.has('step') ? Number(search.get('step')) : 0;
  const [stepIdx, setStepIdx] = useState(devStep);
  const [runKey, setRunKey] = useState(0);
  const lab = useLab(useMemo(() => baseFor(lesson?.steps[devStep]), [baseFor, lesson, devStep]));
  const [ghost, setGhost] = useState<Patch | null>(null);
  const [highlight, setHighlight] = useState<ParamKey | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const results = useRef<StepResult[]>([]);
  const startedAt = useRef(Date.now());
  const notes = useRef(0);
  const isTestOut = search.get('testout') === '1';

  useEffect(() => lab.onNote(e => void (e.on && !e.loop && notes.current++)), [lab]);

  const step = lesson?.steps[stepIdx];
  const base = useMemo(() => baseFor(step), [baseFor, step]);

  // a step with its own start (and every quiz) begins from a clean patch
  useEffect(() => {
    if (!step) return;
    if (step.start || step.type === 'match') {
      lab.silence();
      lab.setPatch(base);
    }
    setGhost(null);
    setHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, runKey]);

  const visible = useMemo(() => new Set<ParamKey>(step?.controls ?? lesson?.controls ?? []), [step, lesson]);
  const fresh = useMemo(() => new Set<ParamKey>(lesson?.fresh ?? []), [lesson]);

  const finish = useCallback(() => {
    if (!lesson || !ref) return;
    const graded = results.current.filter(r => r?.graded);
    const score = graded.length ? graded.reduce((s, r) => s + r.score, 0) / graded.length : 1;
    const pass = lesson.kind === 'checkpoint' ? 0.8 : 0.7;
    const passed = score >= pass;
    const stars = starsFor(score, pass);
    const ms = Date.now() - startedAt.current;
    const base = { learn: 12, quiz: 12, checkpoint: 20, project: 18 }[lesson.kind];
    const xp = Math.round(base + score * 10 + stars * 3);
    const report = record({ lessonId: lesson.id, lessonKind: lesson.kind, score, stars, passed, ms, notes: notes.current, xp });
    let testedOut = false;
    if (isTestOut && passed && lesson.kind === 'checkpoint') {
      testOut(testOutLessonIds(ref.unit));
      testedOut = true;
    }
    if (profile?.settings.sfx !== false) {
      if (passed) sfx.complete();
      if (report?.levelUp) setTimeout(() => sfx.levelUp(), 900);
    }
    lab.silence();
    setSummary({ score, stars, passed, xp, ms, notes: notes.current, report, testedOut });
  }, [lesson, ref, record, isTestOut, testOut, profile?.settings.sfx, lab]);

  const onStepDone = (r: StepResult) => {
    results.current[stepIdx] = r;
    if (!lesson) return;
    if (stepIdx + 1 >= lesson.steps.length) finish();
    else setStepIdx(stepIdx + 1);
  };

  const retry = () => {
    results.current = [];
    startedAt.current = Date.now();
    notes.current = 0;
    setSummary(null);
    setStepIdx(0);
    setRunKey(k => k + 1);
    lab.silence();
    lab.setPatch(baseFor(lesson?.steps[0]));
  };

  if (!ref || !lesson || !profile) {
    return (
      <div className="page">
        <p>Lesson not found.</p>
        <button className="btn" onClick={() => navigate('/synth')}>
          Synth School
        </button>
      </div>
    );
  }

  const locked = !unitUnlocked(ref.unit, profile.synth) && !isTestOut;
  const quit = () => navigate('/synth');

  const coachProps = { lab, base, visible: [...visible], onDone: onStepDone };

  return (
    <div className="lesson-shell synth-shell">
      {!summary && (
        <header className="lesson-top">
          <button className="btn btn-icon btn-ghost" aria-label="Quit lesson" onClick={() => (stepIdx > 0 ? setConfirmQuit(true) : quit())}>
            <X size={22} />
          </button>
          <div className="lesson-segments" aria-label={`Step ${stepIdx + 1} of ${lesson.steps.length}`}>
            {lesson.steps.map((s, i) => (
              <div key={i} className={`seg ${i < stepIdx ? 'done' : ''} ${i === stepIdx ? 'now' : ''}`} title={KIND_LABEL[s.type]}>
                <span />
              </div>
            ))}
          </div>
          <span className="synth-lesson-name faint">{lesson.title}</span>
        </header>
      )}
      {summary ? (
        <main className="lesson-main">
          <div className="lesson-results-wrap">
            <SynthResults
              summary={summary}
              lessonTitle={lesson.title}
              goal={lesson.goal}
              kind={lesson.kind}
              onRetry={retry}
              onBack={quit}
              next={summary.passed ? lessonAfter(lesson.id) : null}
              onNext={id => navigate(`/synth/lesson/${id}`, { replace: true })}
            />
          </div>
        </main>
      ) : (
        <main className="synth-main">
          {locked && (
            <div className="synth-locked card">
              <BookOpen size={18} /> This unit isn’t open yet; you can still play it.
            </div>
          )}
          <div className="synth-lesson-body">
            <motion.aside key={`${runKey}-${stepIdx}`} className="sl-coach card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} data-step={step?.type}>
              {step?.type === 'explain' && <ExplainCoach step={step} {...coachProps} />}
              {step?.type === 'explore' && <ExploreCoach step={step} {...coachProps} />}
              {step?.type === 'listen' && <ListenCoach step={step} {...coachProps} />}
              {step?.type === 'match' && <MatchCoach step={step} {...coachProps} onGhost={setGhost} onHighlight={setHighlight} />}
            </motion.aside>
            <div className="synth-scroll">
              <SynthPanel lab={lab} visible={visible} fresh={fresh} ghost={ghost} hint={highlight} />
            </div>
          </div>
          <div className="synth-dock">
            <Keys lab={lab} compact />
          </div>
        </main>
      )}
      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Leave this lesson?">
        <p className="dim">Your progress in this lesson won’t be saved.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmQuit(false)}>
            Keep going
          </button>
          <button className="btn btn-danger" onClick={quit}>
            Leave
          </button>
        </div>
      </Modal>
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function SynthResults({
  summary,
  lessonTitle,
  goal,
  kind,
  onRetry,
  onBack,
  next,
  onNext,
}: {
  summary: Summary;
  lessonTitle: string;
  goal: string;
  kind: string;
  onRetry: () => void;
  onBack: () => void;
  next: ReturnType<typeof lessonAfter>;
  onNext: (id: string) => void;
}) {
  const pct = Math.round(summary.score * 100);
  const headline = summary.testedOut ? 'Unit unlocked' : !summary.passed ? 'Almost there' : summary.stars === 3 ? 'Golden ears' : summary.stars === 2 ? 'Great sound design' : 'Lesson complete';
  const sub = summary.testedOut
    ? 'You tested out: every lesson in this unit counts as done.'
    : !summary.passed
      ? `You need ${kind === 'checkpoint' ? 80 : 70}% to pass. Use the hints, compare the sounds often, and try again.`
      : goal;
  const report = summary.report;
  return (
    <div className="results">
      <div className="results-hero">
        <Sparks active={summary.passed} />
        <motion.div className="results-ring" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <ProgressRing value={summary.score} size={168} stroke={10} color={summary.passed ? 'var(--gold)' : 'var(--bad)'}>
            <div className="results-pct">
              <span className="tabular">{pct}</span>
              <small>%</small>
              <span className="faint">score</span>
            </div>
          </ProgressRing>
        </motion.div>
        <Stars value={summary.stars} size={34} animate />
        <motion.h1 className="display results-title" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          {headline}
        </motion.h1>
        <p className="dim results-sub">
          <strong>{lessonTitle}.</strong> {sub}
        </p>
      </div>
      <motion.div className="results-stats" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
        <div className="stat card">
          <Zap size={18} className="stat-icon gold" />
          <strong className="tabular">+{summary.xp}</strong>
          <span className="faint">XP</span>
        </div>
        <div className="stat card">
          <Music2 size={18} className="stat-icon" />
          <strong className="tabular">{summary.notes}</strong>
          <span className="faint">notes played</span>
        </div>
        <div className="stat card">
          <Clock size={18} className="stat-icon" />
          <strong className="tabular">{fmtTime(summary.ms)}</strong>
          <span className="faint">time</span>
        </div>
      </motion.div>
      {report && (report.streakExtended || report.achievements.length > 0 || report.levelUp) && (
        <div className="results-feed">
          {report.levelUp && (
            <motion.div className="feed-item card" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
              <Zap className="feed-icon" />
              <div>
                <strong>Level {report.levelUp}</strong>
                <span className="faint">Your ears are levelling up.</span>
              </div>
            </motion.div>
          )}
          {report.streakExtended && (
            <motion.div className="feed-item card" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
              <Flame className="feed-icon flame" />
              <div>
                <strong>{report.streak}-day streak</strong>
                <span className="faint">Practice every day keeps it going.</span>
              </div>
            </motion.div>
          )}
          {report.achievements.map((a, i) => (
            <motion.div key={a.id} className="feed-item card achievement" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.8 + i * 0.1 }}>
              <Award className="feed-icon" />
              <div>
                <strong>{a.title}</strong>
                <span className="faint">{a.description}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <div className="results-actions">
        {next && (
          <button className="btn btn-primary btn-lg" onClick={() => onNext(next.lesson.id)}>
            Next: {next.lesson.title} <ArrowRight size={18} />
          </button>
        )}
        <button className="btn btn-lg" onClick={onRetry}>
          <RotateCcw size={18} /> Play again
        </button>
        <button className="btn btn-lg btn-ghost" onClick={onBack}>
          Synth School
        </button>
      </div>
    </div>
  );
}
