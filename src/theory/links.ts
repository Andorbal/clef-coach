/**
 * Links between Theory School and the instrument tracks, both ways: the theory behind an
 * instrument lesson ("why is there an F♯ in G major?"), and the instrument lessons that
 * put a theory lesson to use.
 *
 * Nobody keeps a table of lesson ids by hand. Each instrument lesson's topics are worked
 * out from its activities (a minor key, dotted rhythms, an interval quiz, 6/8…), and the
 * first lesson of each track to use a topic is where that track introduces it. Theory
 * lessons say which topics they teach (`topics`). Where the two meet, there's a link, so
 * a new track or lesson links itself.
 */
import { getSong } from '../content/songs';
import { TRACKS, getTrack } from '../curriculum';
import type { ActivityDef, LessonDef, TrackDef } from '../curriculum/types';
import { parseKey } from '../music/keys';
import { parsePitch } from '../music/pitch';
import { clefBase, type Clef } from '../music/score';
import type { TimeSig } from '../music/rhythm';
import { THEORY } from './course';
import type { TheoryLesson } from './course/types';

/** Topics a lesson uses. */
export function lessonTopics(lesson: LessonDef): Set<string> {
  const out = new Set<string>();
  for (const a of lesson.steps) activityTopics(a, out);
  return out;
}

const clefTopic = (clef: Clef) => `staff:${clefBase(clef)}`;

function keyTopics(key: string, out: Set<string>) {
  try {
    const k = parseKey(key);
    if (k.mode === 'minor') out.add('key:minor');
    if (k.fifths > 0) out.add('key:sharps');
    if (k.fifths < 0) out.add('key:flats');
  } catch {
    /* not a key */
  }
}

function timeTopics(time: TimeSig | undefined, out: Set<string>) {
  if (!time) return;
  const [n, d] = time;
  if (d === 8 && n % 3 === 0) out.add('time:compound');
  else if (n === 3) out.add('time:3/4');
  else if (n === 2 || n === 4) out.add('time:simple');
  else out.add('time:odd');
}

/** Rhythm topics from a voice in the text notation ("C4/q D4/e. E4/s r/q F4/e3"). */
function rhythmTopics(text: string, out: Set<string>) {
  out.add('rhythm:basic');
  for (const tok of text.split(/\s+/)) {
    if (/^r(\/|$)/.test(tok)) out.add('rhythm:rests');
    if (tok.includes('~')) out.add('rhythm:ties');
    const m = /\/([whqestx])(\.*)(3?)/.exec(tok);
    if (!m) continue;
    if (m[1] === 'e') out.add('rhythm:eighths');
    if (m[1] === 's') out.add('rhythm:sixteenths');
    if (m[2]) out.add('rhythm:dotted');
    if (m[3]) out.add('rhythm:triplets');
  }
}

function cellTopics(cells: Record<string, number>, out: Set<string>) {
  for (const c of Object.keys(cells)) {
    if (/r/.test(c)) out.add('rhythm:rests');
    if (/(^|\s)e(\s|$)/.test(c) || /e e/.test(c)) out.add('rhythm:eighths');
    if (/\./.test(c)) out.add('rhythm:dotted');
    if (/(^|\s)s/.test(c) || / s/.test(c)) out.add('rhythm:sixteenths');
    if (/3/.test(c)) out.add('rhythm:triplets');
    if (c === 'e q e' || c === 's e s') out.add('rhythm:syncopation');
  }
}

function pitchTopics(notes: string[], out: Set<string>) {
  for (const s of notes) {
    try {
      if (parsePitch(s).alter !== 0) out.add('accidentals');
    } catch {
      /* a chord or rest */
    }
  }
}

function activityTopics(a: ActivityDef, out: Set<string>) {
  switch (a.type) {
    case 'meet':
    case 'name':
    case 'play': {
      out.add(clefTopic(a.clef));
      pitchTopics(a.type === 'meet' ? a.notes : a.pool, out);
      if ('key' in a && a.key) keyTopics(a.key, out);
      break;
    }
    case 'read':
      out.add(clefTopic(a.gen.clef));
      keyTopics(a.gen.key, out);
      timeTopics(a.gen.time, out);
      cellTopics(a.gen.rhythms, out);
      pitchTopics(a.gen.pool, out);
      if (a.gen.dyads) out.add('intervals');
      if (a.gen.accomp) out.add('staff:grand');
      if (a.gen.chromatic) out.add('accidentals');
      break;
    case 'piece': {
      const song = a.song ? getSong(a.song) : undefined;
      const key = song?.key ?? a.inline?.key;
      const time = song?.time ?? a.inline?.time;
      if (key) keyTopics(key, out);
      timeTopics(time, out);
      const staves = song?.staves ?? a.inline?.staves ?? [];
      for (const st of staves) {
        out.add(clefTopic(st.clef));
        st.voices.forEach(v => rhythmTopics(v, out));
      }
      if (staves.length > 1) out.add('staff:grand');
      break;
    }
    case 'scale':
      out.add(a.kind === 'major' ? 'scale:major' : a.kind === 'natural-minor' ? 'scale:minor' : `scale:${a.kind}`);
      if (a.kind !== 'major') out.add('key:minor');
      keyTopics(a.tonic + (a.kind === 'major' ? '' : 'm'), out);
      break;
    case 'interval':
      for (const n of a.intervals) out.add(`interval:${n}`);
      out.add('intervals');
      break;
    case 'keysig':
      out.add('keysig');
      break;
    case 'rhythm':
      timeTopics(a.time, out);
      cellTopics(a.cells, out);
      out.add('rhythm:basic');
      break;
    case 'chord-play':
    case 'chord-quiz': {
      out.add('chords');
      const list = a.type === 'chord-quiz' ? a.chords : a.chords ?? [];
      if (list.some(c => /7/.test(c))) out.add('chord:seventh');
      if (list.some(c => /^[A-G][#b]?m(?!aj)/.test(c))) out.add('chord:minor');
      break;
    }
    case 'fret-shape':
      if (a.shape.kind === 'pentatonic') out.add('scale:pentatonic');
      if (a.shape.kind === 'caged') out.add('chords');
      break;
    default:
      break;
  }
}

export interface PracticeRef {
  track: TrackDef;
  lesson: LessonDef;
  /** The topic that links them. */
  topic: string;
}

let introCache: Map<string, Map<string, string>> | null = null;

/** For each track, the first lesson that uses each topic (topic → lesson id). */
function introductions(): Map<string, Map<string, string>> {
  if (introCache) return introCache;
  const out = new Map<string, Map<string, string>>();
  for (const t of TRACKS) {
    const m = new Map<string, string>();
    for (const u of t.units) for (const l of u.lessons) for (const topic of lessonTopics(l)) if (!m.has(topic)) m.set(topic, l.id);
    out.set(t.id, m);
  }
  return (introCache = out);
}

/** The theory lesson that teaches each topic (the first that lists it). */
let teacherCache: Map<string, TheoryLesson> | null = null;
function teachers(): Map<string, TheoryLesson> {
  if (teacherCache) return teacherCache;
  const m = new Map<string, TheoryLesson>();
  for (const r of THEORY.allLessons()) for (const t of r.lesson.topics ?? []) if (!m.has(t)) m.set(t, r.lesson);
  return (teacherCache = m);
}

/** Theory lessons behind an instrument lesson: the topics this lesson brings into its track. */
export function theoryFor(trackId: string, lessonId: string): TheoryLesson[] {
  const intro = introductions().get(trackId);
  if (!intro) return [];
  const out: TheoryLesson[] = [];
  for (const [topic, id] of intro) {
    if (id !== lessonId) continue;
    const t = teachers().get(topic);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Instrument lessons that put a theory lesson to use: where each track introduces one of its topics. */
export function practiceFor(theoryLessonId: string): PracticeRef[] {
  const lesson = THEORY.findLesson(theoryLessonId)?.lesson;
  if (!lesson?.topics?.length) return [];
  const out: PracticeRef[] = [];
  for (const [trackId, intro] of introductions()) {
    const track = getTrack(trackId)!;
    for (const topic of lesson.topics) {
      // a topic another theory lesson teaches first belongs to that lesson
      if (teachers().get(topic) !== lesson) continue;
      const id = intro.get(topic);
      if (!id || out.some(r => r.track.id === trackId && r.lesson.id === id)) continue;
      const l = track.units.flatMap(u => u.lessons).find(x => x.id === id);
      if (l) out.push({ track, lesson: l, topic });
    }
  }
  return out;
}

/** Every topic some instrument lesson uses (for the course test: no theory topic should be a typo). */
export function knownTopics(): Set<string> {
  const s = new Set<string>();
  for (const m of introductions().values()) for (const k of m.keys()) s.add(k);
  return s;
}
