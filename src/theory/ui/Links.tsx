/**
 * The links between Theory School and the instrument tracks (see links.ts), with a tick
 * on the lessons already passed.
 */
import { BookOpen, Check, Music } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../state/store';
import type { TrackId } from '../../state/types';
import { practiceFor, theoryFor } from '../links';
import '../../components/course.css';

/** In a theory lesson: where your instruments use this. The player's own tracks first. */
export function PracticeLinks({ lessonId, compact }: { lessonId: string; compact?: boolean }) {
  const profile = useProfile();
  const refs = useMemo(() => {
    const mine = profile?.trackOrder ?? [];
    const all = practiceFor(lessonId);
    const own = all.filter(r => mine.includes(r.track.id)).sort((a, b) => mine.indexOf(a.track.id) - mine.indexOf(b.track.id));
    // with tracks of your own, only those; otherwise a few to show where it leads
    return (own.length ? own : all).slice(0, compact ? 2 : 4);
  }, [lessonId, profile?.trackOrder, compact]);
  if (!profile || !refs.length) return null;
  return (
    <div className={`course-links ${compact ? 'compact' : ''}`}>
      <span className="course-links-title">{compact ? 'Where you’ll use it' : 'Put it to use'}</span>
      {refs.map(r => {
        const passed = !!profile.tracks[r.track.id as TrackId]?.lessons[r.lesson.id]?.passed;
        return (
          <Link key={`${r.track.id}/${r.lesson.id}`} className="course-link" to={compact ? `/track/${r.track.id}` : `/lesson/${r.track.id}/${r.lesson.id}`}>
            <Music size={16} className="faint" />
            <span className="grow">
              {r.lesson.title}
              <small>
                {r.track.subtitle} · {r.track.title}
              </small>
            </span>
            <span className={`course-link-check ${passed ? 'done' : ''}`} aria-label={passed ? 'Passed' : 'Not yet'}>
              {passed && <Check size={13} />}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** In an instrument lesson (or its sheet on the track map): the theory behind it. */
export function TheoryLinks({ trackId, lessonId, title = 'The theory behind it' }: { trackId: string; lessonId: string; title?: string }) {
  const profile = useProfile();
  const lessons = useMemo(() => theoryFor(trackId, lessonId).slice(0, 3), [trackId, lessonId]);
  if (!profile || !lessons.length) return null;
  return (
    <div className="course-links theory-links">
      <span className="course-links-title">{title}</span>
      {lessons.map(l => {
        const passed = !!profile.theory?.lessons[l.id]?.passed;
        return (
          <Link key={l.id} className="course-link" to={`/theory/lesson/${l.id}`}>
            <BookOpen size={16} className="faint" />
            <span className="grow">
              {l.title}
              <small>Theory School · {l.goal}</small>
            </span>
            <span className={`course-link-check ${passed ? 'done' : ''}`} aria-label={passed ? 'Passed' : 'Not yet'}>
              {passed && <Check size={13} />}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
