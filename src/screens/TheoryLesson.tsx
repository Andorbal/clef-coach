/**
 * A Theory School lesson: the coach card (left, or on top on a phone) runs the steps, the
 * staff shows the lesson's notes or whatever is played, named, and the keyboard sits at the
 * bottom. A drill step borrows an instrument track's activity instead. Results count
 * towards XP, the streak and achievements like any other lesson.
 */
import { motion } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { applyInstrument } from '../audio/instrument';
import { sfx } from '../audio/sfx';
import { synth } from '../audio/synth';
import { CourseResults, type CourseSummary, starsFor } from '../components/CourseResults';
import { InputChip, applyInputMode } from '../components/InputControl';
import { Modal } from '../components/ui';
import { usePracticeFocus } from '../components/usePracticeFocus';
import { getTrack } from '../curriculum';
import { makeRng } from '../curriculum/generate';
import { Activity } from '../engine/Activity';
import type { ActivityResult, LessonCtx } from '../engine/context';
import { useApp, useDevice, useProfile } from '../state/store';
import { THEORY } from '../theory/course';
import { CHECKPOINT_PASS, PASS_MARK, type Figure, type StepDef } from '../theory/course/types';
import { PracticeLinks } from '../theory/ui/Links';
import { BuildCoach, ExplainCoach, ExploreCoach, QuizCoach, type StepResult } from '../theory/ui/Coach';
import { TheoryKeys, TheoryPaper, useBench } from '../theory/ui/Workbench';
import '../components/course.css';
import '../theory/ui/theory.css';
import './lesson.css';

const KIND_LABEL: Record<StepDef['type'], string> = { explain: 'Learn', explore: 'Try it', quiz: 'Quiz', build: 'Play it', drill: 'Practice' };

export default function TheoryLesson() {
  const { lessonId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const device = useDevice();
  const record = useApp(s => s.recordCourseOutcome);
  const testOut = useApp(s => s.courseTestOut);
  usePracticeFocus();
  const ref = useMemo(() => THEORY.findLesson(lessonId), [lessonId]);
  const lesson = ref?.lesson;
  const devStep = import.meta.env.DEV && search.has('step') ? Number(search.get('step')) : 0;
  const [stepIdx, setStepIdx] = useState(devStep);
  const [runKey, setRunKey] = useState(0);
  const [seed, setSeed] = useState(() => Date.now());
  const [summary, setSummary] = useState<CourseSummary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [work, setWork] = useState<{ figure?: Figure; hidden?: boolean; answer?: string[]; keysOff?: boolean }>({});
  const results = useRef<StepResult[]>([]);
  const startedAt = useRef(Date.now());
  const notes = useRef(0);
  const bench = useBench();
  const isTestOut = search.get('testout') === '1';

  // the piano's sound and range for the microphone; the saved input (MIDI, mic) on entry
  useEffect(() => {
    applyInstrument('piano', {});
    if (device.inputMode !== 'touch') applyInputMode(device.inputMode).catch(() => undefined);
    synth.preload('piano', Array.from({ length: 37 }, (_, i) => 48 + i)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => bench.onNote(() => void notes.current++), [bench.onNote]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = lesson?.steps[stepIdx];
  const finish = useCallback(() => {
    if (!lesson || !ref) return;
    const graded = results.current.filter(r => r?.graded && r.total > 0);
    const total = graded.reduce((s, r) => s + r.total, 0);
    const correct = graded.reduce((s, r) => s + r.correct, 0);
    const score = total ? correct / total : 1;
    const pass = lesson.kind === 'checkpoint' ? CHECKPOINT_PASS : PASS_MARK;
    const passed = score >= pass;
    const stars = starsFor(score, pass);
    const ms = Date.now() - startedAt.current;
    const base = { learn: 12, practice: 12, ear: 14, checkpoint: 20 }[lesson.kind];
    const xp = Math.round(base + score * 10 + stars * 3);
    const report = record('theory', { lessonId: lesson.id, lessonKind: lesson.kind, score, stars, passed, ms, notes: notes.current, xp });
    let testedOut = false;
    if (isTestOut && passed && lesson.kind === 'checkpoint') {
      testOut('theory', THEORY.testOutLessonIds(ref.unit));
      testedOut = true;
    }
    if (profile?.settings.sfx !== false) {
      if (passed) sfx.complete();
      if (report?.levelUp) setTimeout(() => sfx.levelUp(), 900);
    }
    synth.stopAll();
    setSummary({ score, stars, passed, xp, ms, notes: notes.current, report, testedOut });
  }, [lesson, ref, record, isTestOut, testOut, profile?.settings.sfx]);

  const onStepDone = useCallback(
    (r: StepResult) => {
      results.current[stepIdx] = r;
      if (!lesson) return;
      if (stepIdx + 1 >= lesson.steps.length) finish();
      else {
        setWork({});
        setStepIdx(stepIdx + 1);
      }
    },
    [stepIdx, lesson, finish],
  );

  const retry = () => {
    results.current = [];
    startedAt.current = Date.now();
    notes.current = 0;
    setSummary(null);
    setStepIdx(0);
    setWork({});
    setSeed(Date.now());
    setRunKey(k => k + 1);
  };

  const ctx: LessonCtx | null = useMemo(() => {
    if (!profile) return null;
    return { track: getTrack('piano-treble')!, instrument: 'piano', settings: profile.settings, device, items: {}, rng: makeRng(seed + stepIdx), isCheckpoint: lesson?.kind === 'checkpoint', progress: 0.5 };
  }, [profile, device, seed, stepIdx, lesson?.kind]);

  if (!ref || !lesson || !profile || !ctx) {
    return (
      <div className="page">
        <p>Lesson not found.</p>
        <button className="btn" onClick={() => navigate('/theory')}>
          Theory School
        </button>
      </div>
    );
  }

  const locked = !THEORY.unitUnlocked(ref.unit, profile.theory) && !isTestOut;
  const quit = () => navigate('/theory');
  const show = (s: { figure?: Figure; hidden?: boolean; answer?: string[]; keysOff?: boolean }) => setWork(s);
  const coachProps = { bench, keyName: lesson.key, seed: seed + stepIdx * 7919, sfxOn: profile.settings.sfx !== false, onDone: onStepDone, show };
  const links = stepIdx === 0 ? <PracticeLinks lessonId={lesson.id} compact /> : undefined;
  const next = summary?.passed ? THEORY.lessonAfter(lesson.id) : null;

  return (
    <div className="lesson-shell course-shell th-shell" style={{ ['--accent' as string]: 'var(--theory)' }}>
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
          <InputChip instrument="piano" />
        </header>
      )}
      {summary ? (
        <main className="lesson-main">
          <div className="lesson-results-wrap">
            <CourseResults
              summary={summary}
              lessonTitle={lesson.title}
              goal={lesson.goal}
              passPct={Math.round((lesson.kind === 'checkpoint' ? CHECKPOINT_PASS : PASS_MARK) * 100)}
              headlines={['Brilliant', 'Great thinking', 'Lesson complete']}
              onRetry={retry}
              onBack={quit}
              backLabel="Theory School"
              next={next ? { id: next.lesson.id, title: next.lesson.title } : null}
              onNext={id => navigate(`/theory/lesson/${id}`, { replace: true })}
            >
              {summary.passed && <PracticeLinks lessonId={lesson.id} />}
            </CourseResults>
          </div>
        </main>
      ) : (
        <main className="course-main">
          <div className="course-body">
            <motion.aside key={`${runKey}-${stepIdx}`} className="course-coach card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} data-step={step?.type}>
              {locked && stepIdx === 0 && (
                <div className="course-feedback info th-locked">
                  <BookOpen size={16} /> <span>This unit isn’t open yet; you can still play it.</span>
                </div>
              )}
              {step?.type === 'explain' && <ExplainCoach step={step} {...coachProps} extra={links} />}
              {step?.type === 'explore' && <ExploreCoach step={step} {...coachProps} />}
              {step?.type === 'quiz' && <QuizCoach step={step} {...coachProps} />}
              {step?.type === 'build' && <BuildCoach step={step} {...coachProps} />}
              {step?.type === 'drill' && <DrillCard title={step.title} body={step.body} />}
            </motion.aside>
            <div className="course-work">
              {step?.type === 'drill' ? (
                <div className="th-drill" key={`${runKey}-${stepIdx}`}>
                  <Activity def={step.activity} ctx={ctx} onDone={(r: ActivityResult) => onStepDone({ graded: !r.ungraded && r.total > 0, correct: r.correct, total: r.total })} />
                </div>
              ) : (
                <TheoryPaper bench={bench} figure={work.figure} hidden={work.hidden} keyName={lesson.key} naming={profile.settings.naming} />
              )}
            </div>
          </div>
          {step?.type !== 'drill' && (
            <div className="course-dock">
              <TheoryKeys settings={profile.settings} range={lesson.range} figure={work.hidden || work.keysOff ? undefined : work.figure} answer={work.answer} keyName={lesson.key} />
            </div>
          )}
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

function DrillCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="course-coach-body">
      <div className="course-coach-head">
        <span className="eyebrow">Practice</span>
        <h2 className="display course-coach-title">{title}</h2>
      </div>
      <p className="dim">{body}</p>
    </div>
  );
}
