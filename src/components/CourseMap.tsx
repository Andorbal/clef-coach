/**
 * A course's map (Theory School, Production School): a hero with what's next, then parts
 * of units, each a card with its lessons. Locked units can be tested out of through their
 * checkpoint. The course brings its own picture, words and accent colour.
 */
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronRight, Lock, Play, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileSettingsButton, PageHeader } from './Shell';
import { ProgressRing } from './ui';
import type { CourseNav, NavLesson, NavUnit } from '../state/courseNav';
import type { CourseProgress } from '../state/types';
import './course.css';

export interface CoursePart {
  id: string;
  title: string;
  subtitle: string;
  units: string[];
}

export interface CourseMapProps<U extends NavUnit<NavLesson> & { subtitle: string; description: string }> {
  eyebrow: string;
  title: string;
  sub: string;
  nav: CourseNav<U>;
  parts: readonly CoursePart[];
  progress: CourseProgress | undefined;
  /** Route to a lesson (test-out adds ?testout=1). */
  lessonPath: (id: string) => string;
  accent: string;
  accent2?: string;
  /** The hero's picture (decorative). */
  art?: ReactNode;
  /** Words for the finished course. */
  doneTitle: string;
  doneBody: string;
  /** Extra buttons beside "Continue" (a lab, a guide). */
  actions?: ReactNode;
  meta: string;
  /** Icon for an ordinary lesson in the list. */
  lessonIcon: ReactNode;
  /** Below the parts (a glossary, a field guide). */
  children?: ReactNode;
}

export function CourseMap<U extends NavUnit<NavLesson> & { subtitle: string; description: string }>(p: CourseMapProps<U>) {
  const navigate = useNavigate();
  const next = p.nav.nextLesson(p.progress);
  const done = p.nav.courseCompletion(p.progress);
  return (
    <div className="page course-map" style={{ ['--accent' as string]: p.accent, ['--accent-2' as string]: p.accent2 ?? p.accent }}>
      <MobileSettingsButton />
      <PageHeader eyebrow={p.eyebrow} title={p.title} sub={p.sub} />
      <motion.section className="course-hero card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {p.art && <div className="course-hero-art">{p.art}</div>}
        <div className="course-hero-body">
          <ProgressRing value={done} size={74} stroke={6} color={p.accent}>
            <span className="ring-pct">{Math.round(done * 100)}%</span>
          </ProgressRing>
          <div className="grow">
            {next ? (
              <>
                <span className="eyebrow">
                  {done > 0 ? 'Up next' : 'Start here'} · {next.unit.title}
                </span>
                <h2 className="display course-hero-title">{next.lesson.title}</h2>
                <p className="dim">{(next.lesson as NavLesson & { goal?: string }).goal}</p>
              </>
            ) : (
              <>
                <span className="eyebrow">Course complete</span>
                <h2 className="display course-hero-title">{p.doneTitle}</h2>
                <p className="dim">{p.doneBody}</p>
              </>
            )}
          </div>
        </div>
        <div className="course-hero-actions">
          {next && (
            <button className="btn btn-primary btn-lg" onClick={() => navigate(p.lessonPath(next.lesson.id))}>
              <Play size={18} /> {done > 0 ? 'Continue' : 'Start the course'}
            </button>
          )}
          {p.actions}
        </div>
        <div className="course-hero-meta faint">{p.meta}</div>
      </motion.section>

      {p.parts.map((part, pi) => (
        <section key={part.id} className="course-part">
          <div className="course-part-head">
            <span className="course-part-num">Part {pi + 1}</span>
            <h2 className="display">{part.title}</h2>
            <p className="dim">{part.subtitle}</p>
          </div>
          <div className="course-units">
            {part.units.map((id, ui) => {
              const unit = p.nav.getUnit(id);
              return unit ? <UnitCard key={id} unit={unit} index={p.nav.units.indexOf(unit)} delay={ui * 0.05} {...p} /> : null;
            })}
          </div>
        </section>
      ))}
      {p.children}
    </div>
  );
}

function UnitCard<U extends NavUnit<NavLesson> & { subtitle: string; description: string }>({ unit, index, delay, ...p }: CourseMapProps<U> & { unit: U; index: number; delay: number }) {
  const navigate = useNavigate();
  const cp = p.progress;
  const open = p.nav.unitUnlocked(unit, cp);
  const complete = p.nav.unitComplete(unit, cp);
  const pct = p.nav.unitCompletion(unit, cp);
  const next = p.nav.nextLesson(cp);
  const checkpoint = unit.lessons[unit.lessons.length - 1];
  const needs = p.nav.unitRequires(unit).filter(u => !p.nav.unitComplete(u, cp));
  return (
    <motion.article className={`course-unit card ${open ? '' : 'locked'} ${complete ? 'complete' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} data-unit={unit.id}>
      <header className="course-unit-head">
        <span className="course-unit-num">{complete ? <Check size={16} /> : open ? index + 1 : <Lock size={14} />}</span>
        <div className="grow">
          <span className="eyebrow">{unit.subtitle}</span>
          <h3 className="display course-unit-title">{unit.title}</h3>
        </div>
      </header>
      <p className="dim course-unit-desc">{unit.description}</p>
      <div className="course-unit-bar">
        <span style={{ transform: `scaleX(${pct})` }} />
      </div>
      <ol className="course-lessons">
        {unit.lessons.map(l => {
          const lp = cp?.lessons[l.id];
          const isNext = next?.lesson.id === l.id;
          return (
            <li key={l.id}>
              <button className={`course-lesson ${lp?.passed ? 'passed' : ''} ${isNext ? 'next' : ''} ${l.kind}`} onClick={() => navigate(p.lessonPath(l.id))} disabled={!open}>
                <span className="course-lesson-icon">{lp?.passed ? <Check size={14} /> : isNext ? <Play size={12} /> : l.kind === 'checkpoint' ? <Star size={12} /> : p.lessonIcon}</span>
                <span className="course-lesson-title">{l.title}</span>
                {lp?.passed && lp.stars > 0 && (
                  <span className="course-lesson-stars" aria-label={`${lp.stars} stars`}>
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
        <div className="course-unit-locked">
          <span className="faint">Finish {needs.map(u => u.title).join(' and ')} first, or</span>
          <button className="btn btn-sm" onClick={() => navigate(`${p.lessonPath(checkpoint.id)}?testout=1`)}>
            Test out <ArrowRight size={14} />
          </button>
        </div>
      )}
    </motion.article>
  );
}
