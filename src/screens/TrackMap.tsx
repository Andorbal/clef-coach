import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Brain, Check, Dumbbell, Flag, Grid2x2, Lock, Music, Play, Sparkles, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TrackBadge } from '../components/TrackBadge';
import { Modal, ProgressRing, Stars } from '../components/ui';
import { getTrack } from '../curriculum';
import type { LessonDef, LessonKind } from '../curriculum/types';
import { activityLabel } from '../engine/labels';
import { summarizeTrack, type LessonStatus } from '../engine/progress';
import { useApp, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import './trackmap.css';

const KIND_ICON: Record<LessonKind, typeof BookOpen> = {
  learn: BookOpen,
  practice: Dumbbell,
  song: Music,
  checkpoint: Flag,
  challenge: Zap,
};

const KIND_LABEL: Record<LessonKind, string> = {
  learn: 'New skill',
  practice: 'Practice',
  song: 'Repertoire',
  checkpoint: 'Checkpoint',
  challenge: 'Challenge',
};

/** Horizontal offset of a node along the winding path. */
const wave = (i: number) => Math.sin(i * 0.95) * 76;

export default function TrackMap() {
  const { trackId = '' } = useParams();
  const track = getTrack(trackId);
  const profile = useProfile();
  const addTrack = useApp(s => s.addTrack);
  const setActive = useApp(s => s.setActiveTrack);
  const navigate = useNavigate();
  const tp = profile?.tracks[trackId as TrackId];
  const summary = useMemo(() => (track ? summarizeTrack(track, tp) : null), [track, tp]);
  const [selected, setSelected] = useState<{ lesson: LessonDef; status: LessonStatus; stars: number; unitIndex: number } | null>(null);
  const [testOutUnit, setTestOutUnit] = useState<number | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (track && profile && !profile.trackOrder.includes(track.id)) addTrack(track.id);
    else if (track && profile && profile.activeTrackId !== track.id) setActive(track.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  useEffect(() => {
    // bring the current lesson into view once the learner is past the first few
    if ((summary?.current?.flatIndex ?? 0) < 3) return;
    const t = setTimeout(() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  if (!track || !summary || !profile) {
    return (
      <div className="page">
        <p>Track not found.</p>
        <Link to="/learn" className="btn">
          Back
        </Link>
      </div>
    );
  }

  const hasItems = tp && Object.keys(tp.items).length > 3;
  let flat = 0;

  return (
    <div className="page trackmap" style={{ ['--accent' as string]: track.accent }}>
      <div className="trackmap-hero">
        <button className="btn btn-icon btn-ghost back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <TrackBadge track={track} size={72} />
        <div className="grow">
          <div className="eyebrow">{track.subtitle}</div>
          <h1 className="display trackmap-title">{track.title}</h1>
          <p className="dim trackmap-desc">{track.description}</p>
        </div>
        <ProgressRing value={summary.completion} size={84} stroke={7} color={track.accent}>
          <div className="trackmap-ring">
            <strong>{summary.passed}</strong>
            <span className="faint">of {summary.total}</span>
          </div>
        </ProgressRing>
      </div>

      <div className="trackmap-actions">
        <button className="btn" disabled={!hasItems} onClick={() => navigate(`/lesson/${track.id}/review`)}>
          <Brain size={16} /> Smart Review
        </button>
        <button className="btn" onClick={() => navigate(`/lesson/${track.id}/endless`)}>
          <Sparkles size={16} /> {track.clef === 'chords' ? 'Chord Gym' : 'Sight-reading Gym'}
        </button>
        {track.clef === 'chords' && (
          <button className="btn" onClick={() => navigate(`/chords?instruments=${track.instrument}`)}>
            <Grid2x2 size={16} /> Chord chart
          </button>
        )}
        <span className="pill">
          <Stars value={1} size={12} /> {summary.stars} / {summary.maxStars}
        </span>
      </div>

      <div className="units">
        {track.units.map((unit, ui) => {
          const lessons = summary.lessons.filter(l => l.unitIndex === ui);
          const done = lessons.filter(l => l.status === 'passed').length;
          const locked = lessons.every(l => l.status === 'locked');
          const startFlat = flat;
          flat += lessons.length;
          return (
            <section key={unit.id} className={`unit ${locked ? 'locked' : ''}`}>
              <header className="unit-head card">
                <div className="unit-num display">{ui + 1}</div>
                <div className="grow">
                  <h2 className="display unit-title">{unit.title}</h2>
                  <p className="dim unit-summary">{unit.summary}</p>
                  {unit.skills && (
                    <div className="unit-skills">
                      {unit.skills.map(s => (
                        <span key={s} className="pill">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="unit-side">
                  <span className="faint tabular">
                    {done}/{lessons.length}
                  </span>
                  {locked && (
                    <button className="btn btn-sm" onClick={() => setTestOutUnit(ui)}>
                      <Zap size={14} /> Test out
                    </button>
                  )}
                </div>
              </header>
              <div className="path" style={{ height: lessons.length * 104 + 20 }}>
                <svg className="path-line" width="100%" height={lessons.length * 104 + 20} preserveAspectRatio="none" viewBox={`-200 0 400 ${lessons.length * 104 + 20}`}>
                  <path
                    d={lessons
                      .map((_, i) => {
                        const x = wave(startFlat + i);
                        const y = 52 + i * 104;
                        if (i === 0) return `M ${x} ${y}`;
                        const px = wave(startFlat + i - 1);
                        const py = 52 + (i - 1) * 104;
                        return `C ${px} ${py + 52}, ${x} ${y - 52}, ${x} ${y}`;
                      })
                      .join(' ')}
                  />
                </svg>
                {lessons.map((l, i) => {
                  const Icon = l.status === 'locked' ? Lock : l.status === 'passed' && l.lesson.kind !== 'checkpoint' ? Check : KIND_ICON[l.lesson.kind];
                  const isCurrent = l.status === 'current';
                  return (
                    <motion.div
                      key={l.lesson.id}
                      className={`node-wrap ${wave(startFlat + i) > 0 ? 'label-left' : ''}`}
                      style={{ top: i * 104, left: `calc(50% + ${wave(startFlat + i)}px)` }}
                      initial={{ opacity: 0, scale: 0.6 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    >
                      <button
                        ref={isCurrent ? currentRef : undefined}
                        className={`node ${l.status} kind-${l.lesson.kind}`}
                        onClick={() => setSelected({ lesson: l.lesson, status: l.status, stars: l.stars, unitIndex: ui })}
                        aria-label={`${l.lesson.title} (${l.status})`}
                      >
                        <Icon size={l.lesson.kind === 'checkpoint' ? 28 : 26} />
                        {isCurrent && <span className="node-ping" />}
                      </button>
                      <div className="node-label">
                        <span className="node-title">{l.lesson.title}</span>
                        {l.status === 'passed' && !tp?.lessons[l.lesson.id]?.skipped && <Stars value={l.stars} size={11} />}
                        {isCurrent && <span className="node-start">Up next</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {summary.finished && (
          <div className="track-done card">
            <Sparkles size={28} className="gold-text" />
            <h2 className="display">Track complete</h2>
            <p className="dim">{track.clef === 'chords' ? 'Remarkable work. Keep your changes quick and clean in the Chord Gym — it never runs out.' : 'Remarkable work. Keep your reading razor-sharp in the Sight-reading Gym — it never runs out.'}</p>
            <button className="btn btn-primary" onClick={() => navigate(`/lesson/${track.id}/endless`)}>
              Enter the Gym
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <Modal open onClose={() => setSelected(null)} title={selected.lesson.title}>
            <div className="lesson-sheet">
              <div className="row">
                <span className={`pill kind-pill kind-${selected.lesson.kind}`}>{KIND_LABEL[selected.lesson.kind]}</span>
                {selected.status === 'passed' && <Stars value={selected.stars} size={16} />}
              </div>
              <p className="dim">{selected.lesson.goal}</p>
              <ol className="step-list">
                {selected.lesson.steps.map((s, i) => (
                  <li key={i}>
                    <span className="step-num">{i + 1}</span>
                    <span>{s.title ?? activityLabel(s)}</span>
                  </li>
                ))}
              </ol>
              {selected.status === 'locked' ? (
                <div className="locked-note">
                  <Lock size={16} />
                  <span>
                    Finish the lessons before this one to unlock it
                    {selected.lesson.kind === 'checkpoint' ? ' — or test out now.' : ' — or test out of this unit with its checkpoint.'}
                  </span>
                </div>
              ) : null}
              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {selected.status === 'locked' ? (
                  <button className="btn btn-primary" onClick={() => setTestOutUnit(selected.unitIndex)}>
                    <Zap size={16} /> Test out of unit {selected.unitIndex + 1}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={() => navigate(`/lesson/${track.id}/${selected.lesson.id}`)}>
                    <Play size={18} /> {selected.status === 'passed' ? 'Practise again' : 'Start'}
                  </button>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <Modal open={testOutUnit !== null} onClose={() => setTestOutUnit(null)} title="Test out">
        {testOutUnit !== null && (
          <>
            <p className="dim">
              Already comfortable with <strong>{track.units[testOutUnit].title}</strong>? Pass its checkpoint with 80% or more and every lesson up to and including this unit unlocks.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setTestOutUnit(null)}>
                Not yet
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const u = track.units[testOutUnit];
                  const cp = u.lessons[u.lessons.length - 1];
                  navigate(`/lesson/${track.id}/${cp.id}?testout=1`);
                }}
              >
                <Zap size={16} /> Take the checkpoint
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
