/**
 * Theory School: the course map. Parts from reading music to harmony and form, units with
 * their lessons, and what's next.
 */
import { BookOpen, KeyboardMusic } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CourseMap } from '../components/CourseMap';
import { useProfile } from '../state/store';
import { PARTS, THEORY } from '../theory/course';
import '../theory/ui/theory.css';

export default function TheorySchool() {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <CourseMap
      eyebrow="Theory School"
      title="Why music works"
      sub="From the names of the notes to chords, keys and harmony. See each idea on the staff, hear it, then play it yourself on the keyboard."
      nav={THEORY}
      parts={PARTS}
      progress={profile.theory}
      lessonPath={id => `/theory/lesson/${id}`}
      accent="#7fb4ff"
      accent2="#f4c97a"
      art={<HeroStaff />}
      doneTitle="You speak music"
      doneBody="Every lesson done. Take it to your instrument: every track’s lessons link back to the theory behind them."
      meta={`${THEORY.units.length} units · ${THEORY.totalLessons} lessons · no piano skills needed`}
      lessonIcon={<BookOpen size={13} />}
      actions={
        <Link to="/studio/free" className="btn btn-lg">
          <KeyboardMusic size={18} /> Free play
        </Link>
      }
    />
  );
}

/** A staff with a rising arpeggio behind the hero (static). */
function HeroStaff() {
  const notes = useMemo(() => [0, 2, 4, 7, 9, 11, 14, 16].map((d, i) => ({ x: 60 + i * 62, y: 92 - d * 5 })), []);
  return (
    <svg className="th-hero-art" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="th-hero-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0">
          <stop offset="0" stopColor="#7fb4ff" />
          <stop offset="1" stopColor="#f4c97a" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1="0" x2="600" y1={42 + i * 14} y2={42 + i * 14} stroke="url(#th-hero-g)" strokeOpacity={0.35} strokeWidth={1} />
      ))}
      {notes.map((n, i) => (
        <ellipse key={i} cx={n.x} cy={n.y} rx={9} ry={6.5} transform={`rotate(-20 ${n.x} ${n.y})`} fill="url(#th-hero-g)" opacity={0.25 + i * 0.08} />
      ))}
    </svg>
  );
}
