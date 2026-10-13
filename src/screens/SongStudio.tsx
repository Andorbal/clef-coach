/**
 * Song Studio — learn one song, phrase by phrase.
 *
 * Tools: a map of the song's phrases coloured by how well you know them, a guided
 * practice plan (hands separately → together → in time at 60/80/100% → snowball the
 * phrases), loop any passage, slow it down, a speed builder that nudges the tempo up
 * after each clean run, practise one hand / some strings / one mallet while the app
 * plays the rest, metronome and count-in, trouble-spot drills and a "learn it by"
 * goal with a daily plan.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Ear, Flag, Pause, Play, Repeat, Square, Target, TrendingUp, Trash2, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { unlockAudio } from '../audio/context';
import { applyInputMode } from '../components/InputControl';
import { useInstrumentAudio } from '../audio/instrument';
import { synth } from '../audio/synth';
import { InputChip } from '../components/InputControl';
import { InstrumentIcon } from '../components/InstrumentIcon';
import { Modal, Segmented, Toggle } from '../components/ui';
import { getSong, songGroup, songGroupDef } from '../content/songs';
import { TRACKS, getTrack } from '../curriculum';
import { makeRng } from '../curriculum/generate';
import type { FingeringMode } from '../curriculum/types';
import { type ActivityResult, type LessonCtx, prefsOf } from '../engine/context';
import { PlayAlong } from '../engine/PlayAlong';
import { autoFinger } from '../music/autofinger';
import { familyOf, instrumentName, voiceFor } from '../music/instruments';
import { keyDisplayName } from '../music/keys';
import { type SongDef, songToScore } from '../music/parse';
import { PPQ } from '../music/rhythm';
import { type Score, type StepNote, buildSteps, sliceScore } from '../music/score';
import { malletHand } from '../music/sticking';
import { NotationView } from '../notation/NotationView';
import { alignLyrics, songChordSymbols, songSections } from '../songs/format';
import { dayKey } from '../state/dates';
import {
  LEVEL_NAMES,
  type PlanStep,
  type SongPart,
  goalPace,
  passageKey,
  passageLevel,
  planProgress,
  songHasTwoParts,
  stepDone,
  todaysPlan,
  troubleSpot,
} from '../state/songs';
import { useApp, useDevice, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import { SongChords } from './SongChords';
import './lesson.css';
import './songstudio.css';

/** A song from the built-in library or the device's imported songs. */
export function useSongDef(id: string): SongDef | undefined {
  const imported = useApp(s => s.data.songs?.[id]);
  return imported ?? getSong(id);
}

interface Passage {
  from: number; // 1-based
  to: number;
  label: string;
}

interface RunConfig {
  passage: Passage;
  mode: 'wait' | 'tempo';
  tempoPct: number;
  part: SongPart;
  strings: number[] | null;
  staves: number[] | null;
  loop: boolean;
  speedBuilder: boolean;
  targetPct: number;
  countIn: number;
  metronome: boolean;
  accomp: number;
  fingering: FingeringMode;
  noteNames: boolean;
  /** the plan step being worked on (advances when it's done) */
  step?: PlanStep;
}

const fmtMinutes = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** The next Christmas Eve (or this year's, if still ahead) – a popular goal. */
function nextChristmas(): string {
  const now = new Date();
  const y = now.getMonth() === 11 && now.getDate() > 24 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-12-24`;
}

export default function SongStudio() {
  const { songId = '' } = useParams();
  const song = useSongDef(songId);
  const profile = useProfile();
  const device = useDevice();
  const navigate = useNavigate();
  const recordOutcome = useApp(s => s.recordOutcome);
  const recordRun = useApp(s => s.recordSongRun);
  const startSong = useApp(s => s.startSong);
  const setGoal = useApp(s => s.setSongGoal);
  const deleteSong = useApp(s => s.deleteSong);
  const isImported = useApp(s => !!s.data.songs?.[songId]);
  const prefs = profile ? prefsOf(profile.settings) : {};
  useInstrumentAudio(song?.instrument, prefs);

  const score = useMemo<Score | null>(() => {
    if (!song) return null;
    try {
      return autoFinger(songToScore(song), prefs);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, prefs.ukuleleTuning, prefs.bassStrings]);
  const sections = useMemo(() => (song && score ? songSections(song, score) : []), [song, score]);
  const sp = profile?.songs?.[songId];
  const twoParts = song ? songHasTwoParts(song) : false;
  const family = song ? familyOf(song.instrument) : 'keyboard';

  // ---- practice settings ----
  const [passage, setPassage] = useState<Passage | null>(null);
  const [mode, setMode] = useState<'wait' | 'tempo'>('wait');
  const [tempoPct, setTempoPct] = useState(70);
  const [part, setPart] = useState<SongPart>('all');
  const [strings, setStrings] = useState<number[] | null>(null);
  const [staves, setStaves] = useState<number[] | null>(null);
  const [loop, setLoop] = useState(true);
  const [speedBuilder, setSpeedBuilder] = useState(false);
  const [countIn, setCountIn] = useState(1);
  const [metronome, setMetronome] = useState(true);
  const [accomp, setAccomp] = useState(70);
  const [fingering, setFingering] = useState<FingeringMode>('all');
  const [noteNames, setNoteNames] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ---- run state ----
  const [run, setRun] = useState<RunConfig | null>(null);
  const [runNo, setRunNo] = useState(0);
  const [last, setLast] = useState<{ acc: number; clean: boolean; tempoPct: number } | null>(null);
  const [between, setBetween] = useState(false);
  const runStarted = useRef(Date.now());

  useEffect(() => {
    if (device.inputMode !== 'touch') applyInputMode(device.inputMode).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whole: Passage | null = score ? { from: 1, to: score.measures, label: 'Whole song' } : null;
  const current = passage ?? (sections[0] ? { from: sections[0].from, to: sections[0].to, label: sections[0].name } : whole);
  const pace = song && score ? goalPace(song, score, sp) : null;
  const plan = song && score ? todaysPlan(song, score, sp) : [];
  const progress = song && score ? planProgress(song, score, sp) : { done: 0, total: 1 };
  const trouble = score ? troubleSpot(sp, score.measures) : null;
  const chordSymbols = useMemo(() => (song && score ? songChordSymbols(song, score) : []), [song, score]);
  // lyrics of the selected passage, one line per verse
  const passageLyrics = useMemo(() => {
    if (!song?.lyrics?.length || !score || !current) return [];
    const notes = score.staves[0].voices[0].notes.filter(n => !n.rest && !n.tiePrev && n.measure + 1 >= current.from && n.measure + 1 <= current.to);
    return song.lyrics
      .map(verse => {
        const map = alignLyrics(verse, score);
        return notes
          .map(n => map.get(n.id) ?? '')
          .filter(Boolean)
          .join(' ')
          .replace(/- /g, '');
      })
      .filter(Boolean);
  }, [song, score, current?.from, current?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  // track whose colours, XP and item stats the song uses
  const group = song && getSong(song.id) ? songGroupDef(songGroup(song)) : null;
  const track = (group ? getTrack(group.track) : undefined) ?? TRACKS.find(t => t.instrument === song?.instrument) ?? TRACKS[0];

  const ctx: LessonCtx | null = useMemo(
    () => (profile && song ? { track, instrument: song.instrument, settings: profile.settings, device, items: profile.tracks[track.id as TrackId]?.items ?? {}, rng: makeRng(), isCheckpoint: false, progress: 0.5 } : null),
    [profile, song, track, device],
  );

  const runScore = useMemo(() => (run && score ? sliceScore(score, run.passage.from - 1, run.passage.to - 1) : null), [run, score]);
  const previewScore = useMemo(() => (current && score ? sliceScore(score, current.from - 1, current.to - 1) : null), [current, score]);

  // strings / staves used in the selected passage (for the part pickers)
  const usedStrings = useMemo(() => {
    if (!previewScore || family !== 'fretted') return [];
    const set = new Set<number>();
    for (const st of buildSteps(previewScore)) for (const n of st.notes) if (n.string) set.add(n.string);
    return [...set].sort((a, b) => a - b);
  }, [previewScore, family]);

  const filterFor = useCallback(
    (cfg: RunConfig) => {
      const malletOne = family === 'mallet' && !twoParts && cfg.part !== 'all';
      if (!cfg.strings && !cfg.staves && !malletOne) return undefined;
      return (n: StepNote) => {
        if (cfg.strings && n.string && !cfg.strings.includes(n.string)) return false;
        if (cfg.staves && !cfg.staves.includes(n.staff)) return false;
        if (malletOne && n.finger && malletHand(n.finger) !== cfg.part) return false;
        return true;
      };
    },
    [family, twoParts],
  );

  if (!song || !score || !ctx || !profile || !current || !whole) {
    return (
      <div className="page">
        <p>{song ? 'This song could not be read.' : 'Song not found.'}</p>
        <Link className="btn" to="/songs">
          Back to songs
        </Link>
      </div>
    );
  }

  const configFrom = (p: Passage, step?: PlanStep): RunConfig => ({
    passage: p,
    mode: step ? step.mode : mode,
    tempoPct: step ? (step.mode === 'tempo' ? step.tempoPct : 100) : mode === 'tempo' ? tempoPct : 100,
    part: step ? step.part : part,
    strings: step ? null : strings,
    staves: step ? null : staves,
    loop: step ? true : loop,
    speedBuilder: step ? false : speedBuilder && mode === 'tempo',
    targetPct: 100,
    countIn,
    metronome,
    accomp: accomp / 100,
    fingering: step ? (step.mode === 'wait' ? 'all' : 'first') : fingering,
    noteNames,
    step,
  });

  const begin = async (cfg: RunConfig) => {
    await unlockAudio();
    startSong(song.id);
    setLast(null);
    setBetween(false);
    setRun(cfg);
    setRunNo(n => n + 1);
    runStarted.current = Date.now();
  };

  const stop = () => {
    setRun(null);
    setBetween(false);
    synth.stopAll();
  };

  const onRunDone = (r: ActivityResult) => {
    if (!run) return;
    const acc = r.total ? r.correct / r.total : 1;
    const ms = Date.now() - runStarted.current;
    const measures: Record<number, { total: number; clean: number }> = {};
    for (const [m, st] of Object.entries(r.measureStats ?? {})) measures[run.passage.from + Number(m)] = st;
    const partial = !!(run.strings || run.staves || (family === 'mallet' && !twoParts && run.part !== 'all'));
    const part: SongPart = twoParts ? run.part : run.part === 'all' || !partial ? 'all' : run.part;
    recordRun(song.id, { from: run.passage.from, to: run.passage.to, mode: run.mode, tempoPct: run.tempoPct, part, partial, accuracy: acc, measures, ms }, twoParts, score.measures);
    recordOutcome({ trackId: track.id as TrackId, lessonId: `song:${song.id}`, lessonKind: 'song', accuracy: acc, stars: 0, passed: acc >= 0.7, ms, notes: r.notes, xp: Math.round(3 + acc * 7), items: r.items, practiceOnly: true });
    const clean = acc >= (run.mode === 'wait' ? 0.9 : 0.85);
    setLast({ acc, clean, tempoPct: run.tempoPct });
    if (!run.loop) {
      setRun(null);
      return;
    }
    // next run: maybe faster (speed builder), maybe the next plan step
    let next = run;
    if (run.speedBuilder && clean && run.tempoPct < run.targetPct) next = { ...run, tempoPct: Math.min(run.targetPct, run.tempoPct + 5) };
    if (run.step && clean) {
      // the plan moves on once a step is done
      const after = useApp.getState().profile()?.songs?.[song.id];
      const step = todaysPlan(song, score, after)[0];
      if (step && !(step.from === run.passage.from && step.to === run.passage.to && step.stage === run.step.stage)) {
        next = configFrom({ from: step.from, to: step.to, label: step.title }, step);
      } else if (!step) {
        setRun(null);
        return;
      }
    }
    setBetween(true);
    setTimeout(() => {
      setBetween(false);
      setRun(next);
      setRunNo(n => n + 1);
      runStarted.current = Date.now();
    }, 1400);
  };

  const listen = async (p: Passage) => {
    await unlockAudio();
    const s = sliceScore(score, p.from - 1, p.to - 1);
    const secPerTick = 60 / ((song.tempo * (mode === 'tempo' ? tempoPct : 100)) / 100) / PPQ;
    const events = buildSteps(s).map(st => ({ midi: st.notes.map(n => n.midi), at: 0.15 + st.tick * secPerTick, duration: Math.max(0.12, st.notes[0].ticks * secPerTick * 0.95) }));
    synth.playSequence(events, voiceFor(song.instrument, prefs));
  };

  const passageOf = (from: number, to: number, label: string): Passage => ({ from, to, label });
  const nextStep = plan[0];
  const level = (from: number, to: number) => passageLevel(sp?.passages[passageKey(from, to)]);

  // ------------------------------------------------------------------ playing
  if (run && runScore) {
    const filter = filterFor(run);
    const hands = twoParts && run.part !== 'all' ? run.part : 'both';
    const target = Math.round((song.tempo * run.tempoPct) / 100);
    return (
      <div className="lesson-shell song-shell studio-shell" style={{ ['--track-accent' as string]: track.accent }}>
        <header className="lesson-top">
          <button className="btn btn-icon btn-ghost" onClick={stop} aria-label="Stop">
            <ArrowLeft size={22} />
          </button>
          <div className="grow song-head">
            <strong className="display">{song.title}</strong>
            <span className="faint">
              {run.step ? run.step.title : `${run.passage.label} · bars ${run.passage.from}–${run.passage.to}`}
            </span>
          </div>
          <div className="run-chips">
            {run.mode === 'tempo' && (
              <span className="pill tabular">
                <TrendingUp size={13} /> {run.tempoPct}% · {target} bpm
              </span>
            )}
            {run.loop && (
              <span className="pill">
                <Repeat size={13} /> Loop
              </span>
            )}
            {last && (
              <span className={`pill ${last.clean ? 'pill-good' : ''}`}>
                Last: {Math.round(last.acc * 100)}%
              </span>
            )}
          </div>
          <button className="btn btn-sm" onClick={stop}>
            <Square size={14} /> Stop
          </button>
          <InputChip instrument={song.instrument} />
        </header>
        <main className="lesson-main">
          <div className="lesson-step">
            <AnimatePresence>
              {between && last && (
                <motion.div className={`run-toast ${last.clean ? 'good' : ''}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <strong className="display">{Math.round(last.acc * 100)}%</strong>
                  <span>{last.clean ? (run.speedBuilder && run.tempoPct > last.tempoPct ? `Clean! Speeding up to ${run.tempoPct}%` : 'Clean — again!') : 'Once more, slowly and steadily.'}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {!between && (
              <PlayAlong
                key={runNo}
                ctx={ctx}
                score={runScore}
                mode={run.mode}
                tempo={target}
                hands={twoParts ? hands : undefined}
                filter={filter}
                metronome={run.metronome}
                countInBars={run.countIn}
                autoStart={runNo > 1 && run.mode === 'tempo'}
                accompVolume={run.accomp}
                fingering={run.fingering}
                noteNames={run.noteNames}
                title={run.step?.title ?? run.passage.label}
                prompt={run.step?.why}
                onDone={onRunDone}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------------ overview
  const partOptions: { value: SongPart; label: string }[] = twoParts
    ? [
        { value: 'all', label: 'Both hands' },
        { value: 'R', label: 'Right hand' },
        { value: 'L', label: 'Left hand' },
      ]
    : family === 'mallet'
      ? [
          { value: 'all', label: 'Both mallets' },
          { value: 'R', label: 'Right only' },
          { value: 'L', label: 'Left only' },
        ]
      : [];
  const tempoBpm = Math.round((song.tempo * tempoPct) / 100);
  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);

  return (
    <div className="studio-page" style={{ ['--track-accent' as string]: track.accent, ['--accent' as string]: track.accent }}>
      <header className="studio-top">
        <button className="btn btn-icon btn-ghost" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="grow song-head">
          <strong className="display">{song.title}</strong>
          <span className="faint">
            {song.composer}
            {song.arranger ? ` · arr. ${song.arranger}` : ''}
            {song.year ? ` · ${song.year}` : ''}
          </span>
        </div>
        <InputChip instrument={song.instrument} />
      </header>

      <div className="studio-grid">
        {/* ---------- left column: plan, map, tools ---------- */}
        <div className="studio-col">
          <section className="card studio-hero">
            <div className="studio-hero-top">
              <span className="studio-instr">
                <InstrumentIcon instrument={song.instrument} size={20} /> {instrumentName(song.instrument, prefs)}
              </span>
              <span className="faint">
                {keyDisplayName(score.key)} · {score.time[0]}/{score.time[1]} · ♩ = {Math.round(song.tempo)} · {score.measures} bars
              </span>
            </div>
            <div className="studio-progress">
              <div className="studio-progress-bar">
                <div style={{ width: `${pct}%` }} />
              </div>
              <span className="tabular">{pct}% learned</span>
            </div>
            {sp && (
              <div className="studio-stats faint">
                <span>{fmtMinutes(sp.ms)} practised</span>
                <span>
                  {sp.sessions} session{sp.sessions === 1 ? '' : 's'}
                </span>
                {sp.bestTempoPct > 0 && <span>Whole song at {sp.bestTempoPct}%</span>}
              </div>
            )}
            {pace && (
              <div className={`goal-chip ${pace.status}`}>
                <CalendarDays size={14} />
                {pace.status === 'done'
                  ? 'Goal reached — well done!'
                  : pace.status === 'past'
                    ? 'The goal date has passed. Set a new one?'
                    : `${pace.daysLeft} day${pace.daysLeft === 1 ? '' : 's'} to go · ${pace.status === 'behind' ? 'a little behind' : pace.status === 'ahead' ? 'ahead of plan' : 'on track'} · about ${pace.perDay} step${pace.perDay === 1 ? '' : 's'} a day`}
              </div>
            )}
          </section>

          <section className="card studio-plan">
            <div className="studio-section-head">
              <h2 className="display">
                <Wand2 size={18} /> {nextStep ? 'Today’s practice' : 'You’ve learned it!'}
              </h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setGoalOpen(true)}>
                <Target size={14} /> {sp?.goal ? 'Goal' : 'Set a goal'}
              </button>
            </div>
            {nextStep ? (
              <>
                <ol className="plan-list">
                  {plan.map((st, i) => (
                    <li key={`${st.stage}-${st.from}-${st.to}`} className={i === 0 ? 'on' : ''}>
                      <span className="plan-num">{i + 1}</span>
                      <span className="grow">
                        <strong>{st.title}</strong>
                        {i === 0 && <span className="dim plan-why">{st.why}</span>}
                      </span>
                      <button className={`btn btn-sm ${i === 0 ? 'btn-primary' : ''}`} onClick={() => begin(configFrom(passageOf(st.from, st.to, st.title), st))}>
                        <Play size={14} /> {i === 0 ? 'Start' : 'Go'}
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="faint plan-note">The plan moves on by itself when a step is clean. Steps you finish in free practice count too.</p>
              </>
            ) : (
              <p className="dim">Every phrase is up to tempo. Keep it fresh: play it through once a day, or pick a new song!</p>
            )}
          </section>

          <section className="card studio-map-card">
            <div className="studio-section-head">
              <h2 className="display">Phrases</h2>
              <button className={`chip-btn ${current.from === 1 && current.to === score.measures ? 'on' : ''}`} onClick={() => setPassage(whole)}>
                Whole song
              </button>
            </div>
            <div className="song-map" role="list">
              {sections.map(sec => {
                const lv = level(sec.from, sec.to);
                const on = current.from === sec.from && current.to === sec.to;
                return (
                  <button key={`${sec.from}-${sec.to}`} role="listitem" className={`map-sec lv${lv} ${on ? 'on' : ''}`} onClick={() => setPassage(passageOf(sec.from, sec.to, sec.name))} style={{ flexGrow: sec.to - sec.from + 1 }}>
                    <span className="map-bars">
                      {Array.from({ length: sec.to - sec.from + 1 }, (_, k) => {
                        const m = sec.from + k;
                        const t = sp?.trouble[m] ?? 0;
                        return <span key={m} className={`map-bar ${t >= 2 ? 'hot' : t >= 1 ? 'warm' : ''}`} title={`Bar ${m}${t ? ` · ${t} recent mistake${t === 1 ? '' : 's'}` : ''}`} />;
                      })}
                    </span>
                    <span className="map-name">{sec.name}</span>
                    <span className="map-level">{LEVEL_NAMES[lv]}</span>
                  </button>
                );
              })}
            </div>
            <div className="range-row">
              <span className="faint">Custom:</span>
              <label>
                bars{' '}
                <input
                  type="number"
                  className="set-input num"
                  min={1}
                  max={score.measures}
                  value={current.from}
                  onChange={e => {
                    const f = Math.max(1, Math.min(score.measures, Number(e.target.value) || 1));
                    setPassage(passageOf(f, Math.max(f, current.to), `Bars ${f}–${Math.max(f, current.to)}`));
                  }}
                />
              </label>
              <label>
                to{' '}
                <input
                  type="number"
                  className="set-input num"
                  min={current.from}
                  max={score.measures}
                  value={current.to}
                  onChange={e => {
                    const t = Math.max(current.from, Math.min(score.measures, Number(e.target.value) || current.from));
                    setPassage(passageOf(current.from, t, `Bars ${current.from}–${t}`));
                  }}
                />
              </label>
              {trouble && (
                <button className="chip-btn" onClick={() => setPassage(passageOf(trouble.from, trouble.to, `Trouble spot (bars ${trouble.from}–${trouble.to})`))}>
                  <Flag size={14} /> Trouble spot: bars {trouble.from}–{trouble.to}
                </button>
              )}
            </div>
          </section>

          <section className="card studio-tools">
            <h2 className="display">Practice tools</h2>
            {partOptions.length > 0 && (
              <div className="set-row">
                <span>Play</span>
                <Segmented size="sm" value={part} onChange={setPart} options={partOptions} />
              </div>
            )}
            {family === 'fretted' && usedStrings.length > 1 && (
              <div className="set-row">
                <span>
                  Strings
                  <span className="faint toggle-sub">Practise only some strings; the app plays the rest.</span>
                </span>
                <div className="chip-row">
                  {usedStrings.map(sn => {
                    const on = !strings || strings.includes(sn);
                    return (
                      <button
                        key={sn}
                        className={`chip-btn ${on ? 'on' : ''}`}
                        onClick={() => {
                          const cur = strings ?? usedStrings;
                          const n = on ? cur.filter(x => x !== sn) : [...cur, sn];
                          setStrings(n.length === usedStrings.length || !n.length ? null : n);
                        }}
                      >
                        {sn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!twoParts && score.staves.length > 1 && (
              <div className="set-row">
                <span>Staves</span>
                <div className="chip-row">
                  {score.staves.map((st, i) => {
                    const on = !staves || staves.includes(i);
                    return (
                      <button
                        key={i}
                        className={`chip-btn ${on ? 'on' : ''}`}
                        onClick={() => {
                          const cur = staves ?? score.staves.map((_, k) => k);
                          const n = on ? cur.filter(x => x !== i) : [...cur, i];
                          setStaves(n.length === score.staves.length || !n.length ? null : n);
                        }}
                      >
                        {song.staves[i]?.name ?? `Staff ${i + 1}`} {st.clef.startsWith('bass') ? '𝄢' : '𝄞'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="set-row">
              <span>Mode</span>
              <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'wait', label: 'Wait for me' }, { value: 'tempo', label: 'In time' }]} />
            </div>
            {mode === 'tempo' && (
              <>
                <label className="slider-row">
                  <span>
                    Tempo{' '}
                    <strong className="tabular">
                      {tempoPct}% · {tempoBpm} bpm
                    </strong>
                  </span>
                  <input type="range" min={30} max={130} step={5} value={tempoPct} onChange={e => setTempoPct(Number(e.target.value))} />
                </label>
                <Toggle checked={speedBuilder} onChange={setSpeedBuilder} label="Speed builder" sub="+5% after every clean run, up to full speed." />
                <Toggle checked={metronome} onChange={setMetronome} label="Metronome" sub="Clicks after the count-in." />
                <div className="set-row">
                  <span>Count-in</span>
                  <Segmented size="sm" value={String(countIn) as '1' | '2'} onChange={v => setCountIn(Number(v))} options={[{ value: '1', label: '1 bar' }, { value: '2', label: '2 bars' }]} />
                </div>
              </>
            )}
            {(twoParts || strings || staves || part !== 'all') && (
              <label className="slider-row">
                <span>
                  Other part volume <strong className="tabular">{accomp}%</strong>
                </span>
                <input type="range" min={0} max={100} step={10} value={accomp} onChange={e => setAccomp(Number(e.target.value))} />
              </label>
            )}
            <Toggle checked={loop} onChange={setLoop} label="Loop" sub="Repeat the passage until you stop." />
            <div className="set-row">
              <span>{family === 'mallet' ? 'Sticking' : 'Fingering'}</span>
              <Segmented size="sm" value={fingering} onChange={setFingering} options={[{ value: 'all', label: 'All' }, { value: 'first', label: 'Key moments' }, { value: 'none', label: 'Off' }]} />
            </div>
            <Toggle checked={noteNames} onChange={setNoteNames} label="Note names" />
            <div className="studio-actions">
              <button className="btn" onClick={() => listen(current)}>
                <Ear size={16} /> Listen
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => begin(configFrom(current))}>
                <Play size={18} /> Practise {current.label.toLowerCase().startsWith('whole') ? 'the whole song' : current.label}
              </button>
            </div>
          </section>
        </div>

        {/* ---------- right column: music, chords, about ---------- */}
        <div className="studio-col">
          <section className="card studio-preview">
            <div className="studio-section-head">
              <h2 className="display">
                {current.label} <span className="faint">· bars {current.from}–{current.to}</span>
              </h2>
              <button className="btn btn-sm btn-ghost" onClick={() => listen(current)} aria-label="Listen to this passage">
                <Ear size={15} />
              </button>
            </div>
            {previewScore && (
              <div className="paper studio-paper">
                <NotationView score={previewScore} fingering={fingering !== 'none'} strings={family === 'fretted'} noteNames={noteNames ? 'all' : 'none'} naming={profile.settings.naming} showPlayhead={false} beatWidth={46} />
              </div>
            )}
            {passageLyrics.length > 0 && (
              <div className="studio-lyrics">
                {passageLyrics.map((l, i) => (
                  <p key={i}>
                    {passageLyrics.length > 1 && <span className="faint">{i + 1}. </span>}
                    {l}
                  </p>
                ))}
              </div>
            )}
          </section>
          {chordSymbols.length > 0 && <SongChords symbols={chordSymbols} instrument={song.instrument} />}
          {song.blurb || song.source || song.license ? (
            <section className="card studio-about">
              {song.blurb && <p className="dim">{song.blurb}</p>}
              <p className="faint">
                {song.source && <>Source: {song.source}. </>}
                {song.license && <>Licence: {song.license}.</>}
              </p>
            </section>
          ) : null}
          {isImported && (
            <div className="studio-danger">
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Remove this song
              </button>
            </div>
          )}
        </div>
      </div>

      <GoalModal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        goal={sp?.goal}
        onSave={g => {
          setGoal(song.id, g);
          setGoalOpen(false);
        }}
      />
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Remove this song?">
        <p className="dim">“{song.title}” and its practice history will be removed from this device.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              deleteSong(song.id);
              navigate('/songs', { replace: true });
            }}
          >
            Remove
          </button>
        </div>
      </Modal>
    </div>
  );
}

function GoalModal({ open, onClose, goal, onSave }: { open: boolean; onClose: () => void; goal?: { date: string; tempoPct: number }; onSave: (g: { date: string; tempoPct: number } | null) => void }) {
  const [date, setDate] = useState(goal?.date ?? nextChristmas());
  const [tempoPct, setTempoPct] = useState(goal?.tempoPct ?? 100);
  useEffect(() => {
    if (open) {
      setDate(goal?.date ?? nextChristmas());
      setTempoPct(goal?.tempoPct ?? 100);
    }
  }, [open, goal]);
  const valid = date > dayKey();
  return (
    <Modal open={open} onClose={onClose} title="Learn it by…">
      <p className="dim">Pick a date and Clef Coach will pace your practice: how many steps a day, and whether you’re on track.</p>
      <div className="set-row">
        <span>Date</span>
        <input type="date" className="set-input" value={date} min={dayKey()} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="chip-btn" onClick={() => setDate(nextChristmas())}>
          🎄 Christmas Eve
        </button>
        {[7, 14, 30].map(d => {
          const dt = new Date();
          dt.setDate(dt.getDate() + d);
          return (
            <button key={d} className="chip-btn" onClick={() => setDate(dayKey(dt))}>
              In {d === 7 ? 'a week' : d === 14 ? 'two weeks' : 'a month'}
            </button>
          );
        })}
      </div>
      <label className="slider-row">
        <span>
          Target tempo <strong className="tabular">{tempoPct}%</strong>
        </span>
        <input type="range" min={60} max={120} step={5} value={tempoPct} onChange={e => setTempoPct(Number(e.target.value))} />
      </label>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {goal ? (
          <button className="btn btn-ghost" onClick={() => onSave(null)}>
            <Pause size={14} /> Clear goal
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-primary" disabled={!valid} onClick={() => onSave({ date, tempoPct })}>
          Save goal
        </button>
      </div>
    </Modal>
  );
}

export { stepDone };
