/**
 * A Production School lesson: the coach card (left, or on top on a phone) runs the steps;
 * the console beside it plays the session's loop. Results count towards XP, the streak and
 * achievements like any other lesson.
 */
import { motion } from 'framer-motion';
import { SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { sfx } from '../audio/sfx';
import { CourseResults, type CourseSummary, starsFor } from '../components/CourseResults';
import { Modal } from '../components/ui';
import { usePracticeFocus } from '../components/usePracticeFocus';
import { PRODUCTION } from '../production/course';
import { expandControls } from '../production/course/controls';
import { CHECKPOINT_PASS, LESSON_PASS, type ProductionLesson as Lesson, type StepDef } from '../production/course/types';
import { type Mix, makeMix } from '../production/dsp/params';
import { getSession } from '../production/dsp/sessions';
import { ExplainCoach, ExploreCoach, ListenCoach, MixCoach, type StepResult } from '../production/ui/Coach';
import { Console } from '../production/ui/Console';
import { useConsole } from '../production/ui/useConsole';
import { useApp, useProfile } from '../state/store';
import '../components/course.css';
import '../synthlab/ui/synthlab.css';
import '../production/ui/production.css';
import './lesson.css';
import './synth.css';

const KIND_LABEL: Record<StepDef['type'], string> = { explain: 'Learn', explore: 'Try it', listen: 'Listen', mix: 'Mix it' };

export default function ProductionLesson() {
  const { lessonId = '' } = useParams();
  const ref = useMemo(() => PRODUCTION.findLesson(lessonId), [lessonId]);
  const navigate = useNavigate();
  if (!ref) {
    return (
      <div className="page">
        <p>Lesson not found.</p>
        <button className="btn" onClick={() => navigate('/production')}>
          Production School
        </button>
      </div>
    );
  }
  return <LessonRun key={lessonId} lesson={ref.lesson} />;
}

function LessonRun({ lesson }: { lesson: Lesson }) {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const record = useApp(s => s.recordCourseOutcome);
  const testOut = useApp(s => s.courseTestOut);
  usePracticeFocus();
  const ref = PRODUCTION.findLesson(lesson.id)!;
  const session = getSession(lesson.session);
  const api = useConsole({ session: lesson.session, channels: lesson.channels, start: lesson.start ?? {} });
  const devStep = import.meta.env.DEV && search.has('step') ? Number(search.get('step')) : 0;
  const [stepIdx, setStepIdx] = useState(devStep);
  const [runKey, setRunKey] = useState(0);
  const [seed, setSeed] = useState(() => Date.now());
  const [summary, setSummary] = useState<CourseSummary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [ghost, setGhost] = useState<Mix | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [transport, setTransport] = useState<ReactNode>(null);
  const results = useRef<StepResult[]>([]);
  const startedAt = useRef(Date.now());
  const isTestOut = search.get('testout') === '1';
  const step = lesson.steps[stepIdx];

  const base = useMemo(() => makeMix(api.channels, session.rough, lesson.start, step?.start), [api.channels, session, lesson.start, step]);
  const visible = useMemo(() => expandControls(step?.controls ?? lesson.controls, api.channels), [step, lesson.controls, api.channels]);
  const fresh = useMemo(() => expandControls(lesson.fresh ?? [], api.channels), [lesson.fresh, api.channels]);

  // a quiz starts from a known place; so does a step with its own starting point
  useEffect(() => {
    if (!step) return;
    if (step.type === 'mix' || step.type === 'listen' || step.start) api.reset(base);
    setGhost(null);
    setHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, runKey]);

  const finish = useCallback(() => {
    const graded = results.current.filter(r => r?.graded);
    const score = graded.length ? graded.reduce((s, r) => s + r.score, 0) / graded.length : 1;
    const pass = lesson.kind === 'checkpoint' ? CHECKPOINT_PASS : LESSON_PASS;
    const passed = score >= pass;
    const stars = starsFor(score, pass);
    const ms = Date.now() - startedAt.current;
    const baseXp = { learn: 12, quiz: 15, checkpoint: 20, project: 25 }[lesson.kind];
    const xp = Math.round(baseXp + score * 10 + stars * 3);
    const report = record('production', { lessonId: lesson.id, lessonKind: lesson.kind, score, stars, passed, ms, notes: 0, xp });
    let testedOut = false;
    if (isTestOut && passed && lesson.kind === 'checkpoint') {
      testOut('production', PRODUCTION.testOutLessonIds(ref.unit));
      testedOut = true;
    }
    if (profile?.settings.sfx !== false) {
      if (passed) sfx.complete();
      if (report?.levelUp) setTimeout(() => sfx.levelUp(), 900);
    }
    api.stop();
    setSummary({ score, stars, passed, xp, ms, notes: 0, report, testedOut });
  }, [lesson, ref, record, isTestOut, testOut, profile?.settings.sfx, api]);

  const onStepDone = useCallback(
    (r: StepResult) => {
      results.current[stepIdx] = r;
      if (stepIdx + 1 >= lesson.steps.length) finish();
      else setStepIdx(stepIdx + 1);
    },
    [stepIdx, lesson, finish],
  );

  const retry = () => {
    results.current = [];
    startedAt.current = Date.now();
    setSummary(null);
    setStepIdx(0);
    setSeed(Date.now());
    setRunKey(k => k + 1);
    api.reset(makeMix(api.channels, session.rough, lesson.start));
  };

  if (!profile) return null;
  const locked = !PRODUCTION.unitUnlocked(ref.unit, profile.production) && !isTestOut;
  const quit = () => navigate('/production');
  const next = summary?.passed ? PRODUCTION.lessonAfter(lesson.id) : null;
  const coach = { api, base, seed: seed + stepIdx * 7919, sfxOn: profile.settings.sfx !== false, onDone: onStepDone };

  return (
    <div className="lesson-shell course-shell pr-shell" style={{ ['--accent' as string]: '#4dd0c8' }}>
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
          <span className="course-lesson-name faint">{lesson.title}</span>
        </header>
      )}
      {summary ? (
        <main className="lesson-main">
          <div className="lesson-results-wrap">
            <CourseResults
              summary={summary}
              lessonTitle={lesson.title}
              goal={lesson.goal}
              passPct={Math.round((lesson.kind === 'checkpoint' ? CHECKPOINT_PASS : LESSON_PASS) * 100)}
              headlines={['Great ears', 'Nicely mixed', 'Lesson complete']}
              onRetry={retry}
              onBack={quit}
              backLabel="Production School"
              next={next ? { id: next.lesson.id, title: next.lesson.title } : null}
              onNext={id => navigate(`/production/lesson/${id}`, { replace: true })}
            />
          </div>
        </main>
      ) : (
        <main className="course-main">
          <div className="course-body">
            <motion.aside key={`${runKey}-${stepIdx}`} className="course-coach card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} data-step={step?.type}>
              {locked && stepIdx === 0 && (
                <div className="course-feedback info">
                  <SlidersHorizontal size={16} /> <span>This unit isn’t open yet; you can still play it.</span>
                </div>
              )}
              {step?.type === 'explain' && <ExplainCoach step={step} {...coach} />}
              {step?.type === 'explore' && <ExploreCoach step={step} {...coach} />}
              {step?.type === 'listen' && <ListenCoach step={step} {...coach} />}
              {step?.type === 'mix' && <MixCoach step={step} {...coach} judgeKey={`${lesson.id}#${stepIdx}`} onGhost={setGhost} onHighlight={setHighlight} setTransport={setTransport} />}
            </motion.aside>
            <div className="course-work">
              {api.error ? <div className="course-feedback bad">{api.error}</div> : <Console api={api} visible={visible} fresh={fresh} ghost={ghost} highlight={highlight} transport={transport} blind={step?.type === 'listen'} />}
            </div>
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
