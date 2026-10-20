/**
 * Production School: the course map. Parts from hearing a mix to shaping sounds, space
 * and the finished master; units with their lessons; and the Mix Lab.
 */
import { SlidersHorizontal, SlidersVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CourseMap } from '../components/CourseMap';
import { PARTS, PRODUCTION } from '../production/course';
import { useProfile } from '../state/store';
import '../production/ui/production.css';

export default function ProductionSchool() {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <CourseMap
      eyebrow="Production School"
      title="Mix it yourself"
      sub="Recording and mixing, the hands-on part: levels, panning, EQ, compression, reverb and a loud, clean master, on real multitrack sessions. Every quiz is judged by ear."
      nav={PRODUCTION}
      parts={PARTS}
      progress={profile.production}
      lessonPath={id => `/production/lesson/${id}`}
      accent="#4dd0c8"
      accent2="#f4c97a"
      art={<HeroFaders />}
      doneTitle="You can mix"
      doneBody="Every lesson done. Take any session into the Mix Lab and make it your own."
      meta={`${PRODUCTION.units.length} units · ${PRODUCTION.totalLessons} lessons · headphones help`}
      lessonIcon={<SlidersHorizontal size={13} />}
      actions={
        <Link to="/production/lab" className="btn btn-lg">
          <SlidersVertical size={18} /> Mix Lab
        </Link>
      }
    />
  );
}

/** A row of faders behind the hero (static). */
function HeroFaders() {
  const levels = [0.62, 0.48, 0.3, 0.55, 0.42, 0.36, 0.22, 0.7];
  return (
    <svg className="pr-hero-art" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="pr-hero-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0">
          <stop offset="0" stopColor="#4dd0c8" />
          <stop offset="1" stopColor="#f4c97a" />
        </linearGradient>
      </defs>
      {levels.map((l, i) => {
        const x = 70 + i * 66;
        return (
          <g key={i} opacity={0.35 + i * 0.06}>
            <line x1={x} x2={x} y1={18} y2={122} stroke="url(#pr-hero-g)" strokeOpacity={0.35} strokeWidth={3} />
            <rect x={x - 12} y={122 - l * 104 - 7} width={24} height={14} rx={4} fill="url(#pr-hero-g)" />
            <rect x={x + 16} y={122 - l * 90} width={5} height={l * 90} rx={2} fill="url(#pr-hero-g)" opacity={0.5} />
          </g>
        );
      })}
    </svg>
  );
}
