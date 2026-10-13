import { motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { TrackBadge } from '../components/TrackBadge';
import { ProgressRing } from '../components/ui';
import { TRACKS, totalLessons } from '../curriculum';
import { summarizeTrack } from '../engine/progress';
import { useApp, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import { InstrumentIcon } from '../components/InstrumentIcon';
import { INSTRUMENT_IDS, type InstrumentId, instrumentDef, instrumentFromId } from '../music/instruments';
import './learn.css';

const GROUP_SUBS: Record<InstrumentId, string> = {
  piano: 'Read both clefs and play with both hands.',
  guitar: 'Standard notation, bass clef, the whole fretboard and chords.',
  ukulele: 'Melodies in treble clef, chord shapes and strumming.',
  bass: 'Bass clef bass lines, grooves and the whole neck.',
  mallets: 'Marimba, xylophone, glockenspiel or vibes: sticking, then four-mallet chords.',
};

export default function Learn() {
  const profile = useProfile();
  const add = useApp(s => s.addTrack);
  const remove = useApp(s => s.removeTrack);
  if (!profile) return null;
  const mine = new Set(profile.trackOrder.map(t => instrumentFromId(t)));
  // instruments you play first, then the rest
  const order = [...INSTRUMENT_IDS].sort((a, b) => Number(mine.has(b)) - Number(mine.has(a)));
  const groups: { instrument: InstrumentId; title: string; sub: string; ids: TrackId[] }[] = order
    .map(i => ({ instrument: i, title: instrumentDef(i).name, sub: GROUP_SUBS[i], ids: TRACKS.filter(t => t.instrument === i).map(t => t.id) }))
    .filter(g => g.ids.length);
  return (
    <div className="page learn">
      <MobileSettingsButton />
      <PageHeader eyebrow="Learn" title="Choose your tracks" sub="Keep as many tracks going as you like — each remembers its own progress. Mix and match instruments, clefs and skills." />
      {groups.map((g, gi) => (
        <section key={g.title} className="learn-group">
          <div className="learn-group-head">
            <h2 className="display learn-group-title">
              <InstrumentIcon instrument={g.instrument} size={22} /> {g.title}
            </h2>
            <span className="dim">{g.sub}</span>
          </div>
          <div className="learn-grid">
            {g.ids.map((id, i) => {
              const t = TRACKS.find(x => x.id === id);
              if (!t) return null;
              const mine = profile.trackOrder.includes(id);
              const s = summarizeTrack(t, profile.tracks[id]);
              const lessons = totalLessons(t);
              return (
                <motion.div
                  key={id}
                  className={`learn-card card ${mine ? 'mine' : ''}`}
                  style={{ ['--accent' as string]: t.accent }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.15 + i * 0.06 }}
                >
                  <div className="learn-card-top">
                    <TrackBadge track={t} size={58} />
                    {mine && (
                      <ProgressRing value={s.completion} size={50} stroke={4} color={t.accent}>
                        <span className="ring-pct small">{Math.round(s.completion * 100)}%</span>
                      </ProgressRing>
                    )}
                  </div>
                  <div className="eyebrow">{t.subtitle}</div>
                  <h3 className="display learn-card-title">{t.title}</h3>
                  <p className="dim learn-card-desc">{t.description}</p>
                  <div className="learn-card-meta faint">
                    {t.units.length} units · {lessons} lessons
                  </div>
                  <div className="learn-card-actions">
                    {mine ? (
                      <>
                        <Link to={`/track/${id}`} className="btn btn-primary">
                          {s.passed ? 'Continue' : 'Open'}
                        </Link>
                        <button className="btn btn-ghost btn-sm" onClick={() => remove(id)} title="Hide from my tracks (progress is kept)">
                          <Minus size={14} /> Hide
                        </button>
                      </>
                    ) : (
                      <button className="btn" onClick={() => add(id)} disabled={!t.units.length}>
                        {s.passed ? <Check size={16} /> : <Plus size={16} />} {s.passed ? 'Show again' : 'Add track'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
