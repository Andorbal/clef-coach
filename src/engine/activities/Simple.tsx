import { ArrowRight, Hand, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { Metronome, ctxTimeToPerfNow } from '../../audio/metronome';
import { sfx } from '../../audio/sfx';
import type { ActivityDef } from '../../curriculum/types';
import { genRhythm, makeRng } from '../../curriculum/generate';
import { parsePitch } from '../../music/pitch';
import { PPQ, beatTicks, measureTicks } from '../../music/rhythm';
import { type NoteSpec, type Score, buildVoice, scoreTotalTicks } from '../../music/score';
import { NotationView, type NoteState } from '../../notation/NotationView';
import { type ActivityProps, emptyResult, prefsOf } from '../context';
import type { InstrumentId } from '../../music/instruments';
import type { Clef } from '../../music/score';
import { InsightVisual } from '../InsightVisual';
import { useNoteInput } from '../input';
import { ActivityHeader } from '../PlayAlong';

type TipDef = Extract<ActivityDef, { type: 'tip' }>;

export function TipActivity({ def, ctx, onDone }: ActivityProps<TipDef>) {
  const { insight } = def;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onDone(emptyResult(true));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);
  return (
    <div className="activity tip-activity">
      <div className="tip-card card">
        <span className="eyebrow">Insight</span>
        <h2 className="display tip-title">{insight.title}</h2>
        <p className="tip-body">{insight.body}</p>
        {insight.visual && <InsightVisual visual={insight.visual} naming={ctx.settings.naming} instrument={ctx.instrument} prefs={prefsOf(ctx.settings)} />}
        <button className="btn btn-primary btn-lg tip-continue" onClick={() => onDone(emptyResult(true))}>
          Got it <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rhythm tapping
// ---------------------------------------------------------------------------

type RhythmDef = Extract<ActivityDef, { type: 'rhythm' }>;

function rhythmScore(def: RhythmDef, clef: Clef, seed: number, instrument: InstrumentId): Score {
  const rng = makeRng(seed);
  const slots = genRhythm(rng, def.time, def.measures, def.cells, true);
  const pitch = parsePitch(clef === 'bass' ? 'D3' : clef === 'treble8vb' ? 'B3' : clef === 'bass8vb' ? 'D2' : 'B4');
  const specs: NoteSpec[] = slots.flat().map(s => ({ pitches: s.rest ? [] : [pitch], base: s.base, dots: s.dots, triplet: s.triplet }));
  const id = `rh${seed}`;
  return {
    id,
    title: '',
    key: { fifths: 0, mode: 'major' },
    time: def.time,
    tempo: def.tempo,
    measures: def.measures,
    staves: [{ clef, voices: [buildVoice(specs, def.time, id)] }],
    instrument,
  };
}

export function RhythmTap({ def, ctx, onDone }: ActivityProps<RhythmDef>) {
  const tc = ctx.track.clef;
  const clef: Clef = tc === 'bass' || tc === 'treble8vb' || tc === 'bass8vb' ? tc : (tc === 'fretboard' || tc === 'chords') && ctx.instrument === 'bass' ? 'bass8vb' : (tc === 'fretboard' || tc === 'chords') && ctx.instrument === 'guitar' ? 'treble8vb' : 'treble';
  const reps = def.reps ?? 2;
  const [rep, setRep] = useState(0);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const score = useMemo(() => rhythmScore(def, clef, seed + rep, ctx.instrument), [def, clef, seed, rep, ctx.instrument]);
  const notes = useMemo(() => score.staves[0].voices[0].notes, [score]);
  const onsets = useMemo(() => notes.filter(n => !n.rest && !n.tiePrev), [notes]);
  const [phase, setPhase] = useState<'ready' | 'countin' | 'playing' | 'done'>('ready');
  const [countIn, setCountIn] = useState<number | null>(null);
  const [states, setStates] = useState<Record<string, NoteState>>({});
  const [tick, setTick] = useState<number | null>(null);
  const [pad, setPad] = useState<'good' | 'bad' | null>(null);
  const metro = useRef<Metronome | null>(null);
  const t0 = useRef(0);
  const raf = useRef(0);
  const hits = useRef<Set<string>>(new Set());
  const extras = useRef(0);
  const totals = useRef({ total: 0, correct: 0 });
  const secPerTick = 60 / def.tempo / PPQ;
  const tol = Math.max(110, Math.min(170, 60000 / def.tempo / 4));

  const end = useCallback(() => {
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
    setPhase('done');
    const correct = onsets.filter(n => hits.current.has(n.id)).length;
    const penalised = Math.max(0, correct - extras.current);
    totals.current.total += onsets.length;
    totals.current.correct += penalised;
    setTimeout(() => {
      if (rep + 1 < reps) {
        hits.current = new Set();
        extras.current = 0;
        setStates({});
        setTick(null);
        setRep(rep + 1);
        setPhase('ready');
      } else {
        onDone({ total: totals.current.total, correct: totals.current.correct, items: [{ key: `rhythm:${def.time.join('/')}`, correct: totals.current.correct >= totals.current.total * 0.85 }], notes: totals.current.total, responseMs: [] });
      }
    }, 900);
  }, [onsets, rep, reps, onDone, def.time]);

  const loop = useCallback(() => {
    const now = performance.now();
    const cur = (now - t0.current) / (secPerTick * 1000);
    setTick(Math.max(-PPQ, cur));
    const upd: Record<string, NoteState> = {};
    for (const n of onsets) {
      if (hits.current.has(n.id)) continue;
      if (now > t0.current + n.tick * secPerTick * 1000 + tol) upd[n.id] = 'missed';
    }
    if (Object.keys(upd).length) setStates(s => ({ ...upd, ...s }));
    if (cur > scoreTotalTicks(score) + PPQ * 0.25) {
      end();
      return;
    }
    raf.current = requestAnimationFrame(loop);
  }, [secPerTick, onsets, tol, score, end]);

  const start = useCallback(async () => {
    await unlockAudio();
    const beatsPerBar = def.time[1] === 8 && def.time[0] % 3 === 0 ? def.time[0] / 3 : def.time[0];
    const bpm = 60 / (beatTicks(def.time) * secPerTick);
    const m = new Metronome();
    metro.current = m;
    setPhase('countin');
    m.start({
      bpm,
      beatsPerBar,
      countIn: 1,
      onBeat: info => {
        if (info.isCountIn) setCountIn(beatsPerBar - info.beat);
        else {
          setCountIn(null);
          setPhase(p => (p === 'countin' ? 'playing' : p));
        }
      },
    });
    t0.current = ctxTimeToPerfNow(m.startTime);
    raf.current = requestAnimationFrame(loop);
  }, [def.time, secPerTick, loop]);

  useEffect(() => () => {
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
  }, []);

  const tap = useCallback(
    (time: number) => {
      if (phase !== 'playing' && phase !== 'countin') return;
      const t = time - ctx.device.latencyMs;
      let best: (typeof onsets)[number] | null = null;
      let bestErr = Infinity;
      for (const n of onsets) {
        if (hits.current.has(n.id)) continue;
        const err = Math.abs(t - (t0.current + n.tick * secPerTick * 1000));
        if (err < tol && err < bestErr) {
          best = n;
          bestErr = err;
        }
      }
      if (best) {
        hits.current.add(best.id);
        setStates(s => ({ ...s, [best!.id]: 'good' }));
        setPad('good');
      } else {
        extras.current++;
        setPad('bad');
        if (ctx.settings.sfx) sfx.wrong();
      }
      setTimeout(() => setPad(null), 140);
    },
    [phase, onsets, secPerTick, tol, ctx.device.latencyMs, ctx.settings.sfx],
  );

  useNoteInput(e => {
    if (e.type === 'on') tap(e.time);
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (phase === 'ready') start();
        else tap(performance.now());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start, tap]);

  void measureTicks;
  return (
    <div className="activity rhythm-activity">
      <ActivityHeader
        title={def.title ?? 'Tap the rhythm'}
        prompt={def.prompt ?? 'Tap the pad (or any key, or the space bar) exactly when each note should sound. Count the beats in your head.'}
        badge={`${rep + 1} / ${reps}`}
      />
      <div className="stage-paper paper">
        <NotationView score={score} states={states} playheadTick={phase === 'playing' || phase === 'countin' ? tick ?? 0 : null} beatWidth={70} />
        {countIn !== null && <div className="count-in">{countIn}</div>}
        {phase === 'ready' && (
          <div className="paper-overlay">
            <button className="btn btn-primary btn-lg" onClick={start}>
              <Play size={18} /> Start — {def.tempo} bpm
            </button>
          </div>
        )}
      </div>
      <button
        className={`tap-pad ${pad ? `is-${pad}` : ''}`}
        onPointerDown={e => {
          e.preventDefault();
          if (phase === 'ready') start();
          else tap(performance.now());
        }}
      >
        <Hand size={28} />
        <span>{phase === 'ready' ? 'Start' : 'Tap'}</span>
      </button>
    </div>
  );
}

export function scoreLength(score: Score) {
  return scoreTotalTicks(score);
}
