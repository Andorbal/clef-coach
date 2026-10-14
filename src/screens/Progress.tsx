import { motion } from 'framer-motion';
import { Award, Clock, Flame, Lock, Music2, Star, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { TrackBadge } from '../components/TrackBadge';
import { Segmented } from '../components/ui';
import { getTrack } from '../curriculum';
import type { TrackDef } from '../curriculum/types';
import { summarizeTrack } from '../engine/progress';
import { midiAt } from '../music/guitar';
import { instrumentDef, isFretted, tuningFor } from '../music/instruments';
import { prefsOf } from '../engine/context';
import { type Pitch, isBlackKey, midiOf, parsePitch, pitchLabel, spellMidi, pitchToString } from '../music/pitch';
import { ACHIEVEMENTS, levelFromXp } from '../state/achievements';
import { dayKey, lastNDays, parseDayKey } from '../state/dates';
import { effectiveStreak } from '../state/logic';
import { mastery } from '../state/srs';
import { useProfile } from '../state/store';
import type { ItemStat, Profile, TrackId, TrackProgress } from '../state/types';
import './progress.css';

/** Sequential gold ramp on the dark surface: low = dim, high = bright. */
const RAMP = ['#24263a', '#4a3f2e', '#77602f', '#a9822f', '#d6a648', '#f4c97a'];
function rampColor(v: number): string {
  if (v <= 0) return RAMP[0];
  const i = Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)));
  return RAMP[i];
}

function fmtDuration(ms: number) {
  if (ms > 0 && ms < 60000) return '<1 min';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="viz-tip-wrap" data-tip={text} tabIndex={0}>
      {children}
    </span>
  );
}

function CalendarHeatmap({ profile }: { profile: Profile }) {
  const weeks = 18;
  const today = new Date();
  // Columns are weeks (Sunday → Saturday); the last column is the current week.
  const days = lastNDays((weeks - 1) * 7 + today.getDay() + 1, today);
  const max = Math.max(20, ...days.map(d => profile.days[d]?.xp ?? 0));
  const todayKey = dayKey();
  const cols = Array.from({ length: weeks }, (_, c) => days.slice(c * 7, c * 7 + 7));
  let lastMonth = -1;
  return (
    <div className="calendar-wrap">
      <div className="cal-months" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-hidden>
        {cols.map((col, c) => {
          const m = parseDayKey(col[0]).getMonth();
          const show = m !== lastMonth && c < weeks - 1;
          lastMonth = m;
          return <span key={c}>{show ? parseDayKey(col[0]).toLocaleDateString(undefined, { month: 'short' }) : ''}</span>;
        })}
      </div>
      <div className="calendar" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const d = days[i];
          if (!d) return <span key={i} className="cal-cell future" />;
          const xp = profile.days[d]?.xp ?? 0;
          const label = `${parseDayKey(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${xp} XP`;
          return (
            <Tip key={i} text={label}>
              <span className={`cal-cell ${d === todayKey ? 'is-today' : ''}`} style={{ background: xp ? rampColor(0.15 + (0.85 * xp) / max) : undefined }} />
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

function XpBars({ profile }: { profile: Profile }) {
  const days = lastNDays(14);
  const vals = days.map(d => profile.days[d]?.xp ?? 0);
  const max = Math.max(profile.settings.dailyGoalXp, ...vals);
  const top = Math.ceil(max / 25) * 25;
  const H = 150;
  const goalY = H - (profile.settings.dailyGoalXp / top) * H;
  const best = vals.indexOf(Math.max(...vals));
  return (
    <div className="xp-bars">
      <svg viewBox={`0 0 ${days.length * 30} ${H + 24}`} preserveAspectRatio="none" className="xp-svg" role="img" aria-label="XP per day, last 14 days">
        <line x1={0} x2={days.length * 30} y1={H} y2={H} className="axis" />
        <line x1={0} x2={days.length * 30} y1={goalY} y2={goalY} className="goal-line" />
        {vals.map((v, i) => {
          const h = (v / top) * H;
          const x = i * 30 + 6;
          const w = 18;
          const r = Math.min(4, h / 2);
          return (
            <g key={days[i]}>
              <title>{`${parseDayKey(days[i]).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}: ${v} XP`}</title>
              <rect x={i * 30} y={0} width={30} height={H} fill="transparent" />
              {h > 0 && <path d={`M ${x} ${H} V ${H - h + r} Q ${x} ${H - h} ${x + r} ${H - h} H ${x + w - r} Q ${x + w} ${H - h} ${x + w} ${H - h + r} V ${H} Z`} className={`bar ${v >= profile.settings.dailyGoalXp ? 'met' : ''}`} />}
              <text x={x + w / 2} y={H + 16} className="tick" textAnchor="middle">
                {parseDayKey(days[i]).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </text>
              {i === best && v > 0 && (
                <text x={x + w / 2} y={H - h - 6} className="value" textAnchor="middle">
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="faint xp-legend">
        <span className="goal-key" /> daily goal ({profile.settings.dailyGoalXp} XP)
      </div>
    </div>
  );
}

function KeyboardHeatmap({ tp, clefs, low, high }: { tp?: TrackProgress; clefs: string[]; low: number; high: number }) {
  // best stat across the clefs for each midi
  const stats = new Map<number, { s: ItemStat; p: Pitch }>();
  if (tp) {
    for (const [k, s] of Object.entries(tp.items)) {
      const [kind, clef, name] = k.split(':');
      if (kind !== 'note' || !clefs.includes(clef)) continue;
      const p = parsePitch(name);
      const m = midiOf(p);
      const prev = stats.get(m);
      if (!prev || mastery(s) > mastery(prev.s)) stats.set(m, { s, p });
    }
  }
  const whites: number[] = [];
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) whites.push(m);
  const W = 22;
  const width = whites.length * W;
  return (
    <div className="kb-heat-wrap">
      <svg className="kb-heat" viewBox={`0 0 ${width} 96`} role="img" aria-label="Note mastery on the keyboard">
        {whites.map((m, i) => {
          const st = stats.get(m);
          const v = st ? mastery(st.s) : 0;
          const label = st ? `${pitchToString(st.p)}: ${Math.round(v * 100)}% mastery · ${Math.round((st.s.ok / st.s.n) * 100)}% accurate · ${(st.s.ms / 1000).toFixed(1)}s` : `${pitchToString(spellMidi(m))}: not practised yet`;
          return (
            <g key={m}>
              <title>{label}</title>
              <rect x={i * W + 1} y={0} width={W - 2} height={94} rx={4} fill={st ? rampColor(v) : '#1a1c2b'} className="kb-white" />
              {m % 12 === 0 && (
                <text x={i * W + W / 2} y={86} textAnchor="middle" className="kb-label">
                  C{m / 12 - 1}
                </text>
              )}
            </g>
          );
        })}
        {whites.map((m, i) => {
          const b = m + 1;
          if (!isBlackKey(b) || b > high) return null;
          const st = stats.get(b);
          const v = st ? mastery(st.s) : 0;
          return (
            <g key={`b${b}`}>
              <title>{st ? `${pitchToString(st.p)}: ${Math.round(v * 100)}% mastery` : `${pitchToString(spellMidi(b))}: not practised yet`}</title>
              <rect x={(i + 1) * W - 7} y={0} width={14} height={56} rx={3} fill={st ? rampColor(v) : '#0d0e16'} stroke="#06070d" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FretHeatmap({ tp, mode, tuning }: { tp?: TrackProgress; mode: 'fret' | 'note'; tuning: readonly number[] }) {
  const frets = 12;
  const n = tuning.length;
  const strings = Array.from({ length: n }, (_, i) => i + 1);
  const at = (s: number, f: number) => midiAt(s, f, tuning);
  const W = 34;
  const H = 18;
  const noteStats = new Map<number, ItemStat>();
  if (tp && mode === 'note') {
    for (const [k, s] of Object.entries(tp.items)) {
      const [kind, , name] = k.split(':');
      if (kind !== 'note') continue;
      noteStats.set(midiOf(parsePitch(name)), s);
    }
  }
  return (
    <svg className="fret-heat" viewBox={`0 0 ${(frets + 1) * W + 20} ${n * H + 22}`} role="img" aria-label="Fretboard mastery">
      {strings.map(s =>
        Array.from({ length: frets + 1 }, (_, f) => {
          const st = mode === 'fret' ? tp?.items[`fret:${s}:${f}`] : noteStats.get(at(s, f));
          const v = st ? mastery(st) : 0;
          const name = pitchLabel(spellMidi(at(s, f)));
          return (
            <g key={`${s}-${f}`}>
              <title>{`String ${s}, ${f === 0 ? 'open' : `fret ${f}`} (${name}): ${st ? `${Math.round(v * 100)}% mastery` : 'not practised yet'}`}</title>
              <rect x={20 + f * W + 1} y={(s - 1) * H + 1} width={W - 2} height={H - 2} rx={3} fill={st ? rampColor(v) : '#1a1c2b'} />
            </g>
          );
        }),
      )}
      {[0, 3, 5, 7, 9, 12].map(f => (
        <text key={f} x={20 + f * W + W / 2} y={n * H + 15} textAnchor="middle" className="kb-label">
          {f}
        </text>
      ))}
      {tuning.map((m, i) => (
        <text key={i} x={8} y={i * H + 13} textAnchor="middle" className="kb-label">
          {spellMidi(m).step}
        </text>
      ))}
    </svg>
  );
}

function TrackMastery({ track, tp }: { track: TrackDef; tp?: TrackProgress }) {
  const profile = useProfile();
  const tuning = tuningFor(track.instrument, profile ? prefsOf(profile.settings) : {}).open;
  const s = summarizeTrack(track, tp);
  const items = tp ? Object.entries(tp.items) : [];
  const weakest = items
    .filter(([k, st]) => st.n >= 2 && (k.startsWith('note:') || k.startsWith('fret:')))
    .map(([k, st]) => ({ k, st, m: mastery(st) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, 6);
  const mastered = items.filter(([, st]) => mastery(st) >= 0.7).length;
  const keyboardLike = !isFretted(track.instrument);
  const heatLo = Math.min(...track.heatmap.map(h => midiOf(parsePitch(h.low))));
  const heatHi = Math.max(...track.heatmap.map(h => midiOf(parsePitch(h.high))));
  const low = track.id === 'piano-bass' ? 24 : track.id === 'piano-grand' ? 36 : track.id === 'piano-treble' ? 53 : heatLo - (heatLo % 12);
  const high = track.id === 'piano-bass' ? 64 : track.instrument === 'piano' ? 84 : heatHi + ((12 - (heatHi % 12)) % 12);
  const prettyKey = (k: string) => {
    const [kind, a, b] = k.split(':');
    if (kind === 'fret') return `String ${a}, ${b === '0' ? 'open' : `fret ${b}`}`;
    return `${pitchToString(parsePitch(b))} · ${a === 'treble8vb' || a === 'bass8vb' ? instrumentDef(track.instrument).short.toLowerCase() : a}`;
  };
  return (
    <div className="mastery card">
      <div className="mastery-head">
        <TrackBadge track={track} size={44} />
        <div className="grow">
          <strong className="display mastery-title">{track.title}</strong>
          <span className="faint">{track.subtitle}</span>
        </div>
        <div className="mastery-stats">
          <span>
            <strong className="tabular">{s.passed}</strong> <span className="faint">{s.passed === 1 ? 'lesson' : 'lessons'}</span>
          </span>
          <span>
            <strong className="tabular">{mastered}</strong> <span className="faint">mastered</span>
          </span>
        </div>
      </div>
      {keyboardLike ? (
        <KeyboardHeatmap tp={tp} clefs={track.heatmap.map(h => h.clef)} low={low} high={high} />
      ) : (
        <FretHeatmap tp={tp} mode={track.clef === 'fretboard' ? 'fret' : 'note'} tuning={tuning} />
      )}
      <div className="ramp-legend">
        <span className="faint">Not yet</span>
        {RAMP.map(c => (
          <span key={c} className="ramp-swatch" style={{ background: c }} />
        ))}
        <span className="faint">Mastered</span>
      </div>
      {weakest.length > 0 && (
        <div className="weakest">
          <span className="eyebrow">Needs attention</span>
          <table className="weak-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Accuracy</th>
                <th>Avg. time</th>
                <th>Mastery</th>
              </tr>
            </thead>
            <tbody>
              {weakest.map(w => (
                <tr key={w.k}>
                  <td>{prettyKey(w.k)}</td>
                  <td className="tabular">{Math.round((w.st.ok / w.st.n) * 100)}%</td>
                  <td className="tabular">{w.st.ms ? `${(w.st.ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td>
                    <span className="mini-meter">
                      <span style={{ width: `${Math.max(4, w.m * 100)}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Progress() {
  const profile = useProfile();
  const [tab, setTab] = useState<'overview' | 'awards'>('overview');
  const tracks = useMemo(() => (profile?.trackOrder ?? []).map(getTrack).filter(Boolean) as TrackDef[], [profile?.trackOrder]);
  if (!profile) return null;
  const lvl = levelFromXp(profile.xp);
  const unlocked = ACHIEVEMENTS.filter(a => profile.achievements[a.id]).length;
  return (
    <div className="page progress">
      <MobileSettingsButton />
      <PageHeader
        eyebrow="Progress"
        title="How you’re growing"
        right={<Segmented value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'awards', label: `Milestones ${unlocked}/${ACHIEVEMENTS.length}` }]} />}
      />
      {tab === 'overview' ? (
        <>
          <div className="stat-grid">
            {[
              { icon: Star, label: 'Level', value: String(lvl.level), sub: `${profile.xp.toLocaleString()} XP` },
              { icon: Flame, label: 'Streak', value: `${effectiveStreak(profile)}`, sub: `best ${profile.streak.best}` },
              { icon: Clock, label: 'Practice time', value: fmtDuration(profile.totals.ms), sub: plural(profile.totals.lessons, 'session') },
              { icon: Music2, label: 'Notes played', value: profile.totals.notes.toLocaleString(), sub: `${plural(profile.totals.perfect, 'flawless lesson')}` },
            ].map((t, i) => (
              <motion.div key={t.label} className="stat-tile card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <span className="stat-label">
                  <t.icon size={15} /> {t.label}
                </span>
                <span className="stat-value">{t.value}</span>
                <span className="faint stat-sub">{t.sub}</span>
              </motion.div>
            ))}
          </div>
          <div className="viz-grid">
            <section className="card viz-card">
              <h2 className="viz-title">XP per day · last 14 days</h2>
              <XpBars profile={profile} />
            </section>
            <section className="card viz-card">
              <h2 className="viz-title">Practice calendar</h2>
              <CalendarHeatmap profile={profile} />
              <div className="ramp-legend">
                <span className="faint">Less</span>
                {RAMP.slice(1).map(c => (
                  <span key={c} className="ramp-swatch" style={{ background: c }} />
                ))}
                <span className="faint">More</span>
              </div>
            </section>
          </div>
          <h2 className="display section-title" style={{ marginTop: 26 }}>
            Note mastery
          </h2>
          <p className="dim" style={{ marginBottom: 12 }}>
            Mastery blends accuracy, speed and how well you’ve retained a note over time. Hover or long-press any key for details.
          </p>
          <div className="mastery-list">
            {tracks.map(t => (
              <TrackMastery key={t.id} track={t} tp={profile.tracks[t.id as TrackId]} />
            ))}
          </div>
        </>
      ) : (
        <div className="awards">
          {ACHIEVEMENTS.map(a => {
            const at = profile.achievements[a.id];
            return (
              <div key={a.id} className={`award card ${at ? 'on' : ''}`}>
                <span className="award-icon">{at ? <Trophy size={22} /> : <Lock size={18} />}</span>
                <div>
                  <strong>{a.title}</strong>
                  <span className="faint">{a.description}</span>
                  {at && <span className="award-date">{new Date(at).toLocaleDateString()}</span>}
                </div>
              </div>
            );
          })}
          <div className="faint award-note">
            <Award size={14} /> Milestones mark real progress — they’re never the point.
          </div>
        </div>
      )}
    </div>
  );
}
