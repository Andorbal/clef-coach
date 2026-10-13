import { animate, motion } from 'framer-motion';
import { ArrowRight, Award, Clock, Flame, Music2, RotateCcw, Sparkles, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProgressRing, Sparks, Stars } from '../components/ui';
import { allLessons } from '../curriculum';
import type { LessonDef, TrackDef } from '../curriculum/types';
import { summarizeTrack } from '../engine/progress';
import { levelFromXp } from '../state/achievements';
import { useProfile } from '../state/store';
import type { LessonSummary } from './LessonPlayer';

function CountUp({ to, duration = 1.2, prefix = '' }: { to: number; duration?: number; prefix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: x => setV(Math.round(x)) });
    return () => c.stop();
  }, [to, duration]);
  return (
    <span className="tabular">
      {prefix}
      {v}
    </span>
  );
}

function fmtTime(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function LessonResults({
  track,
  lesson,
  summary,
  onRetry,
  onBack,
  onNext,
  endlessRound,
}: {
  track: TrackDef;
  lesson: LessonDef;
  lessonRefIndex?: number;
  summary: LessonSummary;
  onRetry: () => void;
  onBack: () => void;
  onNext: (path: string) => void;
  endlessRound?: number;
}) {
  const profile = useProfile();
  const tp = profile?.tracks[track.id];
  const ts = summarizeTrack(track, tp);
  const next = ts.current;
  const report = summary.report;
  const lvl = levelFromXp(profile?.xp ?? 0);
  const pct = Math.round(summary.accuracy * 100);
  const headline = summary.testedOut
    ? 'Unit unlocked'
    : !summary.passed
      ? 'Almost there'
      : summary.stars === 3
        ? pct === 100
          ? 'Flawless'
          : 'Outstanding'
        : summary.stars === 2
          ? 'Great playing'
          : 'Lesson complete';
  const sub = summary.testedOut
    ? 'You tested out — every lesson up to here is now open.'
    : !summary.passed
      ? `You need ${lesson.kind === 'checkpoint' ? 80 : 70}% to pass. Slow down, use the hints, and try again — you’re close.`
      : lesson.goal;
  const isGenerated = lesson.id.endsWith('-review') || lesson.id.endsWith('-endless');
  const nextPath =
    endlessRound !== undefined
      ? `/lesson/${track.id}/endless?round=${endlessRound + 1}`
      : next && !isGenerated
        ? `/lesson/${track.id}/${next.lesson.id}`
        : null;
  void allLessons;

  return (
    <div className="results">
      <div className="results-hero">
        <Sparks active={summary.passed} />
        <motion.div className="results-ring" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <ProgressRing value={summary.accuracy} size={168} stroke={10} color={summary.passed ? 'var(--gold)' : 'var(--bad)'}>
            <div className="results-pct">
              <CountUp to={pct} />
              <small>%</small>
              <span className="faint">accuracy</span>
            </div>
          </ProgressRing>
        </motion.div>
        <Stars value={summary.stars} size={34} animate />
        <motion.h1 className="display results-title" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          {headline}
        </motion.h1>
        <p className="dim results-sub">{sub}</p>
      </div>

      <motion.div className="results-stats" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
        <div className="stat card">
          <Zap size={18} className="stat-icon gold" />
          <strong>
            <CountUp to={summary.xp} prefix="+" />
          </strong>
          <span className="faint">XP</span>
        </div>
        <div className="stat card">
          <Music2 size={18} className="stat-icon" />
          <strong className="tabular">{summary.notes}</strong>
          <span className="faint">notes</span>
        </div>
        <div className="stat card">
          <Clock size={18} className="stat-icon" />
          <strong className="tabular">{fmtTime(summary.ms)}</strong>
          <span className="faint">time</span>
        </div>
        {summary.avgMs !== undefined && (
          <div className="stat card">
            <Target size={18} className="stat-icon" />
            <strong className="tabular">{(summary.avgMs / 1000).toFixed(1)}s</strong>
            <span className="faint">per note</span>
          </div>
        )}
      </motion.div>

      <div className="results-feed">
        {report?.streakExtended && (
          <motion.div className="feed-item card" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
            <Flame className="feed-icon flame" />
            <div>
              <strong>{report.streak}-day streak</strong>
              <span className="faint">{report.streak === 1 ? 'A new streak begins. See you tomorrow.' : 'You showed up again. That’s how it’s done.'}</span>
            </div>
          </motion.div>
        )}
        {report?.goalReached && (
          <motion.div className="feed-item card" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
            <Target className="feed-icon gold" />
            <div>
              <strong>Daily goal reached</strong>
              <span className="faint">{profile?.settings.dailyGoalXp} XP today.</span>
            </div>
          </motion.div>
        )}
        {report?.levelUp && (
          <motion.div className="feed-item card levelup" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.9, type: 'spring' }}>
            <Sparkles className="feed-icon gold" />
            <div>
              <strong>Level {report.levelUp}</strong>
              <span className="faint">
                {lvl.into}/{lvl.span} XP to level {lvl.level + 1}
              </span>
            </div>
          </motion.div>
        )}
        {report?.achievements.map((a, i) => (
          <motion.div key={a.id} className="feed-item card achievement" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1 + i * 0.12 }}>
            <Award className="feed-icon gold" />
            <div>
              <strong>{a.title}</strong>
              <span className="faint">{a.description}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="results-actions">
        <button className="btn btn-lg" onClick={onRetry}>
          <RotateCcw size={18} /> {summary.passed ? 'Play again' : 'Try again'}
        </button>
        {summary.passed && nextPath ? (
          <button className="btn btn-primary btn-lg" onClick={() => onNext(nextPath)}>
            {endlessRound !== undefined ? 'Next round' : next ? `Next: ${next.lesson.title}` : 'Continue'} <ArrowRight size={18} />
          </button>
        ) : (
          <button className={`btn btn-lg ${summary.passed ? 'btn-primary' : ''}`} onClick={onBack}>
            {isGenerated ? 'Done' : 'Back to path'}
          </button>
        )}
      </div>
    </div>
  );
}
