import { motion } from 'framer-motion';
import { AudioWaveform, BookOpen, Check, FlaskConical, KeyboardMusic, Minus, Plus } from 'lucide-react';
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
import { COURSE } from '../synthlab/course';
import { courseCompletion, nextLesson as nextSynthLesson } from '../synthlab/course/progress';
import { THEORY } from '../theory/course';
import './learn.css';

const GROUP_SUBS: Record<InstrumentId, string> = {
  piano: 'Read both clefs and play with both hands.',
  guitar: 'Standard notation, bass clef, the whole fretboard and chords.',
  ukulele: 'Melodies in treble clef, chord shapes and strumming.',
  bass: 'Bass clef bass lines, grooves and the whole neck.',
  mallets: 'Marimba, xylophone, glockenspiel or vibes: sticking, then four-mallet chords.',
  violin: 'The treble clef on a fretless fingerboard: finger patterns, keys and shifting.',
  viola: 'The alto clef, from the open C string to third position.',
  cello: 'The bass clef, extensions and shifting, then the tenor clef.',
  doublebass: 'Bass lines in the bass clef, Simandl fingering, bowed and plucked.',
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
      <TheoryGroup delay={groups.length * 0.15} />
      <SynthGroup delay={groups.length * 0.15 + 0.1} />
    </div>
  );
}

/** Theory School: for every instrument, taught on a staff and a keyboard. */
function TheoryGroup({ delay }: { delay: number }) {
  const profile = useProfile();
  const tp = profile?.theory;
  const done = THEORY.courseCompletion(tp);
  const next = THEORY.nextLesson(tp);
  return (
    <section className="learn-group">
      <div className="learn-group-head">
        <h2 className="display learn-group-title">
          <BookOpen size={22} /> Music theory
        </h2>
        <span className="dim">Why music works: notes, rhythm, keys, intervals, chords and harmony, for any instrument.</span>
      </div>
      <div className="learn-grid">
        <motion.div className={`learn-card card ${tp ? 'mine' : ''}`} style={{ ['--accent' as string]: '#7fb4ff' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
          <div className="learn-card-top">
            <span className="synth-learn-badge blue">
              <BookOpen size={28} />
            </span>
            {tp && (
              <ProgressRing value={done} size={50} stroke={4} color="#7fb4ff">
                <span className="ring-pct small">{Math.round(done * 100)}%</span>
              </ProgressRing>
            )}
          </div>
          <div className="eyebrow">From zero to harmony</div>
          <h3 className="display learn-card-title">Theory School</h3>
          <p className="dim learn-card-desc">See each idea on the staff, hear it, then play it on the keyboard. No piano skills needed. Lessons in your tracks link to the theory behind them.</p>
          <div className="learn-card-meta faint">
            {THEORY.units.length} units · {THEORY.totalLessons} lessons
          </div>
          <div className="learn-card-actions">
            <Link to={next && tp ? `/theory/lesson/${next.lesson.id}` : '/theory'} className="btn btn-primary">
              {tp ? 'Continue' : 'Start'}
            </Link>
            <Link to="/theory" className="btn btn-ghost btn-sm">
              Course map
            </Link>
          </div>
        </motion.div>
        <motion.div className="learn-card card" style={{ ['--accent' as string]: '#7fb4ff' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.06 }}>
          <div className="learn-card-top">
            <span className="synth-learn-badge blue">
              <KeyboardMusic size={28} />
            </span>
          </div>
          <div className="eyebrow">Try anything</div>
          <h3 className="display learn-card-title">Free play</h3>
          <p className="dim learn-card-desc">Play on any instrument and see your notes on the staff, with chords and intervals named as you go.</p>
          <div className="learn-card-actions">
            <Link to="/studio/free" className="btn">
              Open free play
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** Synth School sits beside the instruments: a course of its own, any instrument or none. */
function SynthGroup({ delay }: { delay: number }) {
  const profile = useProfile();
  const sp = profile?.synth;
  const done = courseCompletion(sp);
  const next = nextSynthLesson(sp);
  const lessons = COURSE.reduce((n, u) => n + u.lessons.length, 0);
  return (
    <section className="learn-group">
      <div className="learn-group-head">
        <h2 className="display learn-group-title">
          <AudioWaveform size={22} /> Synthesizers
        </h2>
        <span className="dim">Sound design from the first oscillator to FM, additive and wavetable synths.</span>
      </div>
      <div className="learn-grid">
        <motion.div className={`learn-card card synth-learn-card ${sp ? 'mine' : ''}`} style={{ ['--accent' as string]: '#ff7eb6' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
          <div className="learn-card-top">
            <span className="synth-learn-badge">
              <AudioWaveform size={30} />
            </span>
            {sp && (
              <ProgressRing value={done} size={50} stroke={4} color="#ff7eb6">
                <span className="ring-pct small">{Math.round(done * 100)}%</span>
              </ProgressRing>
            )}
          </div>
          <div className="eyebrow">Any synth, any DAW</div>
          <h3 className="display learn-card-title">Synth School</h3>
          <p className="dim learn-card-desc">Meet one knob at a time, hear what it does, then rebuild sounds by ear. Ends with FL Studio’s synths feeling familiar.</p>
          <div className="learn-card-meta faint">
            {COURSE.length} units · {lessons} lessons
          </div>
          <div className="learn-card-actions">
            <Link to={next && sp ? `/synth/lesson/${next.lesson.id}` : '/synth'} className="btn btn-primary">
              {sp ? 'Continue' : 'Start'}
            </Link>
            <Link to="/synth" className="btn btn-ghost btn-sm">
              Course map
            </Link>
          </div>
        </motion.div>
        <motion.div className="learn-card card" style={{ ['--accent' as string]: '#3cc8c8' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.06 }}>
          <div className="learn-card-top">
            <span className="synth-learn-badge teal">
              <FlaskConical size={28} />
            </span>
          </div>
          <div className="eyebrow">Play freely</div>
          <h3 className="display learn-card-title">Synth Lab</h3>
          <p className="dim learn-card-desc">The whole synth, every module showing, with a library of classic presets to take apart.</p>
          <div className="learn-card-actions">
            <Link to="/synth/lab" className="btn">
              Open the lab
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
