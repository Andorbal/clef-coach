/**
 * Synth School: the course map. Parts by kind of synthesis, units with their lessons,
 * what's next, and the field guide to the kinds of synth the learner will meet next.
 */
import { motion } from 'framer-motion';
import { ArrowRight, AudioWaveform, Check, ChevronRight, Compass, FlaskConical, Lock, Play, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { Modal, ProgressRing } from '../components/ui';
import { useProfile } from '../state/store';
import { COURSE, PARTS } from '../synthlab/course';
import { FIELD_GUIDE } from '../synthlab/course/guide';
import { courseCompletion, getUnit, nextLesson, unitComplete, unitCompletion, unitRequires, unitUnlocked } from '../synthlab/course/progress';
import type { SynthUnit } from '../synthlab/course/types';
import './synth.css';

export default function SynthSchool() {
  const profile = useProfile();
  const navigate = useNavigate();
  const sp = profile?.synth;
  const next = useMemo(() => nextLesson(sp), [sp]);
  const done = courseCompletion(sp);
  const [guideOpen, setGuideOpen] = useState(false);
  const lessons = COURSE.reduce((n, u) => n + u.lessons.length, 0);
  if (!profile) return null;
  return (
    <div className="page synth-school">
      <MobileSettingsButton />
      <PageHeader eyebrow="Synth School" title="Learn to speak synth" sub="From your first oscillator to FM bells and wavetable growls, one knob at a time. Every lesson ends with a sound to rebuild by ear." />
      <motion.section className="synth-hero card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <HeroWave />
        <div className="synth-hero-body">
          <ProgressRing value={done} size={74} stroke={6}>
            <span className="ring-pct">{Math.round(done * 100)}%</span>
          </ProgressRing>
          <div className="grow">
            {next ? (
              <>
                <span className="eyebrow">
                  {done > 0 ? 'Up next' : 'Start here'} · {next.unit.title}
                </span>
                <h2 className="display synth-hero-title">{next.lesson.title}</h2>
                <p className="dim">{next.lesson.goal}</p>
              </>
            ) : (
              <>
                <span className="eyebrow">Course complete</span>
                <h2 className="display synth-hero-title">You speak synth</h2>
                <p className="dim">Every lesson done. The lab is yours: take apart the presets, then open a synth in your DAW.</p>
              </>
            )}
          </div>
        </div>
        <div className="synth-hero-actions">
          {next && (
            <button className="btn btn-primary btn-lg" onClick={() => navigate(`/synth/lesson/${next.lesson.id}`)}>
              <Play size={18} /> {done > 0 ? 'Continue' : 'Start the course'}
            </button>
          )}
          <Link to="/synth/lab" className="btn btn-lg">
            <FlaskConical size={18} /> Synth Lab
          </Link>
          <button className="btn btn-lg btn-ghost" onClick={() => setGuideOpen(true)}>
            <Compass size={18} /> Field guide
          </button>
        </div>
        <div className="synth-hero-meta faint">
          {COURSE.length} units · {lessons} lessons · subtractive, FM, additive and wavetable
        </div>
      </motion.section>

      {PARTS.map((part, pi) => (
        <section key={part.id} className="synth-part">
          <div className="synth-part-head">
            <span className="synth-part-num">Part {pi + 1}</span>
            <h2 className="display">{part.title}</h2>
            <p className="dim">{part.subtitle}</p>
          </div>
          <div className="synth-units">
            {part.units.map((id, ui) => {
              const unit = getUnit(id);
              return unit ? <UnitCard key={id} unit={unit} index={COURSE.indexOf(unit)} delay={ui * 0.05} /> : null;
            })}
          </div>
        </section>
      ))}

      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="Take it to any synth" wide>
        <FieldGuide />
      </Modal>
    </div>
  );
}

function UnitCard({ unit, index, delay }: { unit: SynthUnit; index: number; delay: number }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const sp = profile?.synth;
  const open = unitUnlocked(unit, sp);
  const complete = unitComplete(unit, sp);
  const pct = unitCompletion(unit, sp);
  const next = nextLesson(sp);
  const checkpoint = unit.lessons[unit.lessons.length - 1];
  const needs = unitRequires(unit).filter(u => !unitComplete(u, sp));
  return (
    <motion.article className={`synth-unit card ${open ? '' : 'locked'} ${complete ? 'complete' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} data-unit={unit.id}>
      <header className="synth-unit-head">
        <span className="synth-unit-num">{complete ? <Check size={16} /> : open ? index + 1 : <Lock size={14} />}</span>
        <div className="grow">
          <span className="eyebrow">{unit.subtitle}</span>
          <h3 className="display synth-unit-title">{unit.title}</h3>
        </div>
      </header>
      <p className="dim synth-unit-desc">{unit.description}</p>
      <div className="synth-unit-bar">
        <span style={{ transform: `scaleX(${pct})` }} />
      </div>
      <ol className="synth-lessons">
        {unit.lessons.map(l => {
          const lp = sp?.lessons[l.id];
          const isNext = next?.lesson.id === l.id;
          return (
            <li key={l.id}>
              <button
                className={`synth-lesson ${lp?.passed ? 'passed' : ''} ${isNext ? 'next' : ''} ${l.kind}`}
                onClick={() => navigate(`/synth/lesson/${l.id}`)}
                disabled={!open}
              >
                <span className="synth-lesson-icon">{lp?.passed ? <Check size={14} /> : isNext ? <Play size={12} /> : l.kind === 'checkpoint' ? <Star size={12} /> : <AudioWaveform size={13} />}</span>
                <span className="synth-lesson-title">{l.title}</span>
                {lp?.passed && lp.stars > 0 && (
                  <span className="synth-lesson-stars" aria-label={`${lp.stars} stars`}>
                    {'★'.repeat(lp.stars)}
                  </span>
                )}
                <ChevronRight size={15} className="faint" />
              </button>
            </li>
          );
        })}
      </ol>
      {!open && (
        <div className="synth-unit-locked">
          <span className="faint">Finish {needs.map(u => u.title).join(' and ')} first, or</span>
          <button className="btn btn-sm" onClick={() => navigate(`/synth/lesson/${checkpoint.id}?testout=1`)}>
            Test out <ArrowRight size={14} />
          </button>
        </div>
      )}
    </motion.article>
  );
}

/** A soft morphing wave behind the hero: the course in a picture (static, no animation). */
function HeroWave() {
  const paths = useMemo(() => {
    const out: string[] = [];
    for (let k = 0; k < 5; k++) {
      let d = '';
      for (let i = 0; i <= 200; i++) {
        const x = i / 200;
        // from a sine to a bright saw, frame by frame
        let y = 0;
        const harmonics = 1 + k * 3;
        for (let h = 1; h <= harmonics; h++) y += Math.sin(2 * Math.PI * h * x * 3) / h;
        d += `${i ? 'L' : 'M'}${(x * 600).toFixed(1)},${(70 - y * 18 - k * 6).toFixed(1)}`;
      }
      out.push(d);
    }
    return out;
  }, []);
  return (
    <svg className="synth-hero-wave" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="synth-hero-g" x1="0" x2="1">
          <stop offset="0" stopColor="#3cc8c8" />
          <stop offset="0.5" stopColor="#f4c97a" />
          <stop offset="1" stopColor="#ff7eb6" />
        </linearGradient>
      </defs>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="url(#synth-hero-g)" strokeWidth={i === 4 ? 2 : 1.2} opacity={0.15 + i * 0.12} />
      ))}
    </svg>
  );
}

function FieldGuide() {
  return (
    <div className="synth-guide">
      <p className="dim">
        Everything in Synth School has a home on real synths. Here’s where to find it on the kinds you’ll meet in any DAW or plugin collection. Every synth lays its panel out a little differently, so these are the names to look for.
      </p>
      <div className="synth-guide-list">
        {FIELD_GUIDE.map(g => (
          <article key={g.name} className="synth-guide-item card">
            <header>
              <strong className="display">{g.name}</strong>
              <span className="pill">{g.kind}</span>
            </header>
            <p className="dim">{g.body}</p>
            <dl>
              {g.map.map(([ours, theirs]) => (
                <div key={ours}>
                  <dt>{ours}</dt>
                  <dd>{theirs}</dd>
                </div>
              ))}
            </dl>
            <div className="synth-guide-units">
              {g.units.map(id => {
                const u = COURSE.find(x => x.id === id);
                return u ? (
                  <span key={id} className="pill">
                    {u.title}
                  </span>
                ) : null;
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
