import { motion } from 'framer-motion';
import { ArrowRight, Brain, Dumbbell, Flame, Plus, Snowflake, Target } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MobileSettingsButton } from '../components/Shell';
import { TrackBadge } from '../components/TrackBadge';
import { ProgressRing, Stars } from '../components/ui';
import { TRACKS, getTrack } from '../curriculum';
import { summarizeTrack } from '../engine/progress';
import { buildReviewLesson } from '../engine/review';
import { ACHIEVEMENTS, levelFromXp } from '../state/achievements';
import { dayKey, lastNDays, parseDayKey } from '../state/dates';
import { effectiveStreak } from '../state/logic';
import { mastery } from '../state/srs';
import { useApp, useDevice, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import './home.css';
import { isIOS } from '../platform';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night practice';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const fade = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } });

export default function Home() {
  const profile = useProfile();
  const device = useDevice();
  const updateDevice = useApp(s => s.updateDevice);
  const navigate = useNavigate();
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const showInstall = isIOS() && !standalone && !device.installPromptDismissed;
  const today = dayKey();
  const tracks = useMemo(() => (profile?.trackOrder ?? []).map(id => getTrack(id)).filter(Boolean) as NonNullable<ReturnType<typeof getTrack>>[], [profile?.trackOrder]);
  if (!profile) return null;

  const active = getTrack(profile.activeTrackId ?? tracks[0]?.id ?? '') ?? tracks[0];
  const activeTp = active ? profile.tracks[active.id as TrackId] : undefined;
  const activeSum = active ? summarizeTrack(active, activeTp) : null;
  const todayXp = profile.days[today]?.xp ?? 0;
  const goal = profile.settings.dailyGoalXp;
  const streak = effectiveStreak(profile);
  const week = lastNDays(7);
  const lvl = levelFromXp(profile.xp);
  const review = active ? buildReviewLesson(active, activeTp) : null;
  const dueCount = activeTp ? Object.values(activeTp.items).filter(s => s.due <= Date.now()).length : 0;
  const recent = Object.entries(profile.achievements)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => ACHIEVEMENTS.find(a => a.id === id))
    .filter(Boolean);

  return (
    <div className="page home">
      <MobileSettingsButton />
      <motion.header className="home-hero" {...fade(0)}>
        <div className="eyebrow">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <h1 className="display home-title">
          {greeting()}, <span className="gold-text">{profile.name}</span>
        </h1>
        <div className="home-meta">
          <span className="pill level-pill">
            Level {lvl.level}
            <span className="level-bar">
              <span style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
            </span>
          </span>
          <span className="pill">{profile.xp.toLocaleString()} XP</span>
        </div>
      </motion.header>

      {showInstall && (
        <motion.div className="install-hint card" {...fade(1)}>
          <span>
            <strong>Install Clef Coach:</strong> tap <em>Share</em> → <em>Add to Home Screen</em>. It runs full-screen, works offline and keeps your progress safe.
          </span>
          <button className="btn btn-sm btn-ghost" onClick={() => updateDevice({ installPromptDismissed: true })}>
            Got it
          </button>
        </motion.div>
      )}

      <div className="home-grid">
        {active && activeSum && (
          <motion.section className="continue card" {...fade(1)} style={{ ['--accent' as string]: active.accent }}>
            <div className="continue-glow" />
            <div className="continue-top">
              <TrackBadge track={active} size={60} />
              <div className="grow">
                <div className="eyebrow">{active.subtitle}</div>
                <h2 className="display continue-track">{active.title}</h2>
              </div>
              <ProgressRing value={activeSum.completion} size={58} stroke={5} color={active.accent}>
                <span className="ring-pct">{Math.round(activeSum.completion * 100)}%</span>
              </ProgressRing>
            </div>
            {activeSum.current ? (
              <div className="continue-next">
                <span className="faint">
                  Unit {activeSum.current.unitIndex + 1} · {activeSum.current.unit.title}
                </span>
                <h3 className="display continue-lesson">{activeSum.current.lesson.title}</h3>
                <p className="dim">{activeSum.current.lesson.goal}</p>
              </div>
            ) : (
              <div className="continue-next">
                <h3 className="display continue-lesson">Track complete</h3>
                <p className="dim">You’ve finished every lesson. The Sight-reading Gym keeps the challenge going.</p>
              </div>
            )}
            <div className="continue-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate(activeSum.current ? `/lesson/${active.id}/${activeSum.current.lesson.id}` : `/lesson/${active.id}/endless`)}
              >
                {activeSum.passed === 0 ? 'Start' : 'Continue'} <ArrowRight size={18} />
              </button>
              <Link className="btn btn-lg btn-ghost" to={`/track/${active.id}`}>
                View path
              </Link>
            </div>
          </motion.section>
        )}

        <motion.section className="today card" {...fade(2)}>
          <div className="today-row">
            <ProgressRing value={todayXp / goal} size={92} stroke={8} color="var(--gold)">
              <div className="today-xp">
                <strong className="tabular">{todayXp}</strong>
                <span className="faint">/ {goal} XP</span>
              </div>
            </ProgressRing>
            <div className="today-text">
              <div className="eyebrow">Today</div>
              <strong className="today-head">{todayXp >= goal ? 'Goal reached' : todayXp > 0 ? 'Keep it going' : 'Daily goal'}</strong>
              <span className="dim">{todayXp >= goal ? 'Anything more is a bonus.' : `${goal - todayXp} XP to go — about ${Math.max(1, Math.ceil((goal - todayXp) / 22))} lesson${Math.ceil((goal - todayXp) / 22) > 1 ? 's' : ''}.`}</span>
            </div>
          </div>
          <div className="divider" />
          <div className="streak-row">
            <div className={`streak-flame ${streak > 0 ? 'lit' : ''}`}>
              <Flame size={26} />
              <strong className="tabular">{streak}</strong>
            </div>
            <div className="week">
              {week.map(d => {
                const done = (profile.days[d]?.xp ?? 0) > 0;
                const isToday = d === today;
                return (
                  <div key={d} className={`week-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}`}>
                    <span className="week-dot" />
                    <span className="week-label">{parseDayKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  </div>
                );
              })}
            </div>
            {profile.streak.freezes > 0 && (
              <span className="pill freeze" title="Streak freezes protect your streak if you miss a day">
                <Snowflake size={13} /> {profile.streak.freezes}
              </span>
            )}
          </div>
        </motion.section>
      </div>

      <motion.section className="home-section" {...fade(3)}>
        <div className="section-head">
          <h2 className="display section-title">Your tracks</h2>
          <Link to="/learn" className="btn btn-sm">
            <Plus size={15} /> Add track
          </Link>
        </div>
        <div className="track-row">
          {tracks.map(t => {
            const s = summarizeTrack(t, profile.tracks[t.id as TrackId]);
            return (
              <Link key={t.id} to={`/track/${t.id}`} className="track-card card" style={{ ['--accent' as string]: t.accent }}>
                <div className="track-card-top">
                  <TrackBadge track={t} size={46} />
                  <ProgressRing value={s.completion} size={44} stroke={4} color={t.accent}>
                    <span className="ring-pct small">{Math.round(s.completion * 100)}</span>
                  </ProgressRing>
                </div>
                <div className="track-card-title display">{t.title}</div>
                <div className="faint track-card-sub">{t.subtitle}</div>
                <div className="track-card-foot">
                  <Stars value={Math.round((s.stars / Math.max(1, s.maxStars)) * 3)} size={13} />
                  <span className="faint">
                    {s.passed}/{s.total}
                  </span>
                </div>
              </Link>
            );
          })}
          {tracks.length === 0 && (
            <Link to="/learn" className="track-card card add">
              <Plus size={28} />
              <span>Choose a track</span>
            </Link>
          )}
        </div>
      </motion.section>

      <motion.section className="home-section quick" {...fade(4)}>
        <button className="quick-card card" disabled={!review} onClick={() => active && navigate(`/lesson/${active.id}/review`)}>
          <span className="quick-icon violet">
            <Brain size={22} />
          </span>
          <span className="quick-text">
            <strong>Smart Review</strong>
            <span className="dim">{review ? (dueCount ? `${dueCount} items are due for review.` : 'Drill the notes you find hardest.') : 'Unlocks after your first lessons.'}</span>
          </span>
          <ArrowRight size={18} className="quick-arrow" />
        </button>
        <button className="quick-card card" onClick={() => navigate('/studio/gym')}>
          <span className="quick-icon teal">
            <Dumbbell size={22} />
          </span>
          <span className="quick-text">
            <strong>Sight-reading Gym</strong>
            <span className="dim">Endless fresh music at exactly your level.</span>
          </span>
          <ArrowRight size={18} className="quick-arrow" />
        </button>
        <button className="quick-card card" onClick={() => navigate('/progress')}>
          <span className="quick-icon gold">
            <Target size={22} />
          </span>
          <span className="quick-text">
            <strong>Note mastery</strong>
            <span className="dim">
              {active && activeTp
                ? `${Object.values(activeTp.items).filter(s => mastery(s) > 0.7).length} items mastered in ${active.title}.`
                : 'See exactly which notes you know.'}
            </span>
          </span>
          <ArrowRight size={18} className="quick-arrow" />
        </button>
      </motion.section>

      {recent.length > 0 && (
        <motion.section className="home-section" {...fade(5)}>
          <h2 className="display section-title">Recent milestones</h2>
          <div className="milestones">
            {recent.map(a => (
              <div key={a!.id} className="milestone card">
                <strong>{a!.title}</strong>
                <span className="faint">{a!.description}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}
      {tracks.length === 0 && TRACKS.length > 0 && null}
    </div>
  );
}
