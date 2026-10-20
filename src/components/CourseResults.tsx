/**
 * The end of a course lesson (Theory School, Production School): the score, stars, XP,
 * streak and achievements, like any other lesson, and what to do next.
 */
import { motion } from 'framer-motion';
import { ArrowRight, Award, Clock, Flame, Music2, RotateCcw, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OutcomeReport } from '../state/logic';
import { ProgressRing, Sparks, Stars } from './ui';

export interface CourseSummary {
  /** 0..1 */
  score: number;
  stars: number;
  passed: boolean;
  xp: number;
  ms: number;
  notes: number;
  report: OutcomeReport | null;
  testedOut: boolean;
}

export function starsFor(score: number, pass: number): number {
  if (score >= 0.95) return 3;
  if (score >= 0.85) return 2;
  return score >= pass ? 1 : 0;
}

function fmtTime(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function CourseResults({
  summary,
  lessonTitle,
  goal,
  passPct,
  headlines,
  onRetry,
  onBack,
  backLabel,
  next,
  onNext,
  children,
}: {
  summary: CourseSummary;
  lessonTitle: string;
  goal: string;
  passPct: number;
  /** [three stars, two stars, one star] */
  headlines: [string, string, string];
  onRetry: () => void;
  onBack: () => void;
  backLabel: string;
  next: { id: string; title: string } | null;
  onNext: (id: string) => void;
  /** Extra content under the stats (links to related lessons). */
  children?: ReactNode;
}) {
  const pct = Math.round(summary.score * 100);
  const headline = summary.testedOut ? 'Unit unlocked' : !summary.passed ? 'Almost there' : summary.stars === 3 ? headlines[0] : summary.stars === 2 ? headlines[1] : headlines[2];
  const sub = summary.testedOut ? 'You tested out: every lesson in this unit counts as done.' : !summary.passed ? `You need ${passPct}% to pass. Read the explanations, try the notes on the keyboard, and have another go.` : goal;
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
                <span className="faint">You’re levelling up.</span>
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
      {children}
      <div className="results-actions">
        {next && (
          <button className="btn btn-primary btn-lg" onClick={() => onNext(next.id)}>
            Next: {next.title} <ArrowRight size={18} />
          </button>
        )}
        <button className="btn btn-lg" onClick={onRetry}>
          <RotateCcw size={18} /> Play again
        </button>
        <button className="btn btn-lg btn-ghost" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}
