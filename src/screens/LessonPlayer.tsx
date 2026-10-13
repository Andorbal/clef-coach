import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { unlockAudio } from '../audio/context';
import { sfx } from '../audio/sfx';
import { synth } from '../audio/synth';
import { micInput } from '../audio/input/mic';
import { InputChip, applyInputMode } from '../components/InputControl';
import { Modal } from '../components/ui';
import { allLessons, findLesson, getTrack } from '../curriculum';
import { makeRng } from '../curriculum/generate';
import type { LessonDef } from '../curriculum/types';
import { Activity } from '../engine/Activity';
import { activityLabel } from '../engine/labels';
import type { ActivityResult, LessonCtx } from '../engine/context';
import { InsightVisual } from '../engine/InsightVisual';
import { testOutLessonIds } from '../engine/progress';
import { buildEndlessLesson, buildReviewLesson } from '../engine/review';
import type { OutcomeReport } from '../state/logic';
import { useApp, useDevice, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import { LessonResults } from './LessonResults';
import './lesson.css';

type Phase = 'intro' | 'run' | 'results';

export interface LessonSummary {
  accuracy: number;
  stars: number;
  passed: boolean;
  xp: number;
  ms: number;
  notes: number;
  avgMs?: number;
  report: OutcomeReport | null;
  testedOut: boolean;
}

export function starsFor(acc: number, pass: number): number {
  if (acc >= 0.95) return 3;
  if (acc >= 0.85) return 2;
  if (acc >= pass) return 1;
  return 0;
}

export default function LessonPlayer() {
  const { trackId = '', lessonId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const device = useDevice();
  const recordOutcome = useApp(s => s.recordOutcome);
  const testOut = useApp(s => s.testOut);
  const track = getTrack(trackId);
  const tp = profile?.tracks[trackId as TrackId];
  const endlessRound = Number(search.get('round') ?? 0);

  // Resolve the lesson (fixed for the lifetime of this screen)
  const [lesson] = useState<LessonDef | null>(() => {
    if (!track) return null;
    if (lessonId === 'review') return buildReviewLesson(track, tp);
    if (lessonId === 'endless') return buildEndlessLesson(track, tp, endlessRound);
    return findLesson(trackId, lessonId)?.lesson ?? null;
  });
  const ref = useMemo(() => (track && lesson ? findLesson(track.id, lesson.id) : undefined), [track, lesson]);
  const isTestOut = search.get('testout') === '1';

  // Dev-only: ?step=N jumps straight to an activity (used by the E2E content sweep)
  const devStep = import.meta.env.DEV && search.has('step') ? Number(search.get('step')) : null;
  const [phase, setPhase] = useState<Phase>(devStep == null && lesson?.intro?.length ? 'intro' : 'run');
  const [introIdx, setIntroIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(devStep ?? 0);
  const [between, setBetween] = useState<{ correct: number; total: number } | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const results = useRef<ActivityResult[]>([]);
  const startedAt = useRef(Date.now());
  const [runKey, setRunKey] = useState(0);

  const ctx: LessonCtx | null = useMemo(() => {
    if (!track || !profile || !lesson) return null;
    const all = allLessons(track);
    return {
      track,
      instrument: track.instrument,
      settings: profile.settings,
      device,
      items: tp?.items ?? {},
      rng: makeRng(Date.now() + runKey),
      isCheckpoint: lesson.kind === 'checkpoint',
      progress: ref ? ref.flatIndex / Math.max(1, all.length - 1) : 0.5,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, lesson, ref, runKey, profile?.settings, device]);

  // enable the saved input on entry (mic/MIDI), focus the mic on this instrument's range,
  // and render the instrument's sounds ahead of time so the first note never hitches
  useEffect(() => {
    if (device.inputMode !== 'touch') applyInputMode(device.inputMode).catch(() => undefined);
    const guitar = track?.instrument === 'guitar';
    micInput.setNoteRange(guitar ? 40 : 21, guitar ? 88 : 108);
    const lo = guitar ? 40 : 36;
    const hi = guitar ? 76 : 84;
    synth.preload(guitar ? 'guitar' : 'piano', Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishLesson = useCallback(() => {
    if (!track || !lesson) return;
    const graded = results.current.filter(r => !r.ungraded && r.total > 0);
    const total = graded.reduce((s, r) => s + r.total, 0);
    const correct = graded.reduce((s, r) => s + r.correct, 0);
    const accuracy = total ? correct / total : 1;
    const passMark = lesson.kind === 'checkpoint' ? 0.8 : 0.7;
    const stars = starsFor(accuracy, passMark);
    const passed = accuracy >= passMark;
    const ms = Date.now() - startedAt.current;
    const notes = results.current.reduce((s, r) => s + r.notes, 0);
    const resp = results.current.flatMap(r => r.responseMs);
    const avgMs = resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : undefined;
    const base = { learn: 10, practice: 10, song: 12, checkpoint: 20, challenge: 15 }[lesson.kind];
    const isGenerated = lessonId === 'review' || lessonId === 'endless';
    const xp = Math.round((isGenerated ? 8 : base) + accuracy * 10 + stars * 3);
    const report = recordOutcome({
      trackId: track.id,
      lessonId: lesson.id,
      lessonKind: lesson.kind,
      accuracy,
      stars,
      passed,
      ms,
      notes,
      xp,
      items: results.current.flatMap(r => r.items),
      avgResponseMs: avgMs,
      practiceOnly: isGenerated,
    });
    let testedOut = false;
    if (isTestOut && passed && ref) {
      testOut(track.id, testOutLessonIds(track, ref.unitIndex));
      testedOut = true;
    }
    if (ctx?.settings.sfx) {
      if (passed) sfx.complete();
      if (report?.levelUp) setTimeout(() => sfx.levelUp(), 900);
    }
    setSummary({ accuracy, stars, passed, xp, ms, notes, avgMs, report, testedOut });
    setPhase('results');
  }, [track, lesson, recordOutcome, isTestOut, ref, testOut, lessonId, ctx?.settings.sfx]);

  const doneSteps = useRef(new Set<string>());
  const onActivityDone = useCallback(
    (r: ActivityResult) => {
      // an activity can only complete once per run (guards against late taps during the banner)
      const key = `${runKey}:${stepIdx}`;
      if (doneSteps.current.has(key)) return;
      doneSteps.current.add(key);
      results.current[stepIdx] = r;
      const isLast = !lesson || stepIdx + 1 >= lesson.steps.length;
      if (r.ungraded || r.total === 0) {
        if (isLast) finishLesson();
        else setStepIdx(i => i + 1);
        return;
      }
      setBetween({ correct: r.correct, total: r.total });
      setTimeout(() => {
        setBetween(null);
        if (isLast) finishLesson();
        else setStepIdx(i => i + 1);
      }, 1300);
    },
    [stepIdx, lesson, finishLesson, runKey],
  );

  const retry = () => {
    results.current = [];
    startedAt.current = Date.now();
    setSummary(null);
    setStepIdx(0);
    setRunKey(k => k + 1);
    setPhase('run');
  };

  if (!track || !profile) {
    return (
      <div className="page">
        <p>Lesson not found.</p>
        <button className="btn" onClick={() => navigate('/')}>Home</button>
      </div>
    );
  }
  if (!lesson || !ctx) {
    return (
      <div className="lesson-shell">
        <div className="lesson-empty card card-pad">
          <h2 className="display">Nothing to review yet</h2>
          <p className="dim">Complete a few lessons first — Smart Review builds itself from the notes you find hardest.</p>
          <button className="btn btn-primary" onClick={() => navigate(`/track/${trackId}`)}>Back to the path</button>
        </div>
      </div>
    );
  }

  const step = lesson.steps[stepIdx];
  const quit = () => navigate(lessonId === 'review' || lessonId === 'endless' ? '/' : `/track/${track.id}`);

  return (
    <div className="lesson-shell" style={{ ['--track-accent' as string]: track.accent }}>
      {phase !== 'results' && (
        <header className="lesson-top">
          <button className="btn btn-icon btn-ghost" aria-label="Quit lesson" onClick={() => (phase === 'run' && stepIdx > 0 ? setConfirmQuit(true) : quit())}>
            <X size={22} />
          </button>
          <div className="lesson-segments" aria-label={`Step ${stepIdx + 1} of ${lesson.steps.length}`}>
            {lesson.steps.map((s, i) => (
              <div key={i} className={`seg ${i < stepIdx || (phase === 'run' && i === stepIdx && between) ? 'done' : ''} ${i === stepIdx && phase === 'run' ? 'now' : ''}`} title={activityLabel(s)}>
                <span />
              </div>
            ))}
          </div>
          <InputChip instrument={track.instrument} />
        </header>
      )}

      <main className="lesson-main">
        <AnimatePresence mode="wait">
          {phase === 'intro' && lesson.intro && (
            <motion.div key={`intro${introIdx}`} className="lesson-intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
              <div className="intro-card card">
                <span className="eyebrow">
                  {lesson.title} · {introIdx + 1}/{lesson.intro.length}
                </span>
                <h1 className="display intro-title">{lesson.intro[introIdx].title}</h1>
                <p className="intro-body">{lesson.intro[introIdx].body}</p>
                {lesson.intro[introIdx].visual && <InsightVisual visual={lesson.intro[introIdx].visual!} naming={profile.settings.naming} />}
                <div className="intro-actions">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={async () => {
                      await unlockAudio();
                      if (introIdx + 1 < lesson.intro!.length) setIntroIdx(introIdx + 1);
                      else setPhase('run');
                    }}
                  >
                    {introIdx + 1 < lesson.intro.length ? 'Next' : 'Start lesson'} <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {phase === 'run' && step && (
            <motion.div key={`${runKey}-${stepIdx}`} className="lesson-step" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              <Activity def={step} ctx={ctx} onDone={onActivityDone} />
            </motion.div>
          )}
          {phase === 'results' && summary && (
            <motion.div key="results" className="lesson-results-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <LessonResults
                track={track}
                lesson={lesson}
                lessonRefIndex={ref?.flatIndex}
                summary={summary}
                onRetry={retry}
                onBack={quit}
                onNext={next => navigate(next, { replace: true })}
                endlessRound={lessonId === 'endless' ? endlessRound : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {between && (
          <motion.div className={`between ${between.correct / between.total >= 0.85 ? 'great' : between.correct / between.total >= 0.6 ? 'ok' : 'meh'}`} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            <span className="between-icon">{between.correct / between.total >= 0.6 ? <Check size={20} /> : <ChevronRight size={20} />}</span>
            <strong>{between.correct === between.total ? 'Perfect!' : between.correct / between.total >= 0.85 ? 'Excellent' : between.correct / between.total >= 0.6 ? 'Good work' : 'Keep going'}</strong>
            <span className="tabular">
              {between.correct}/{between.total}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
