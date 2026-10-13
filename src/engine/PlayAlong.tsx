/**
 * PlayAlong — the heart of Clef Coach. Shows a score, listens to the player and
 * judges what they play, in two modes:
 *   wait  – the cursor waits on each note until the right key(s) are played
 *   tempo – a metronome counts in and the playhead moves in time; timing is scored
 * When practising one hand of a two-hand piece, the app plays the other hand.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Ear, Lightbulb, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inputManager } from '../audio/input/manager';
import type { NoteInputEvent } from '../audio/input/types';
import { Metronome, ctxTimeToPerfNow } from '../audio/metronome';
import { synth } from '../audio/synth';
import { getAudioContext, unlockAudio } from '../audio/context';
import type { FingeringMode } from '../curriculum/types';
import { type FretMark, type KeyMark, type MarkColor } from '../instruments';
import { type Pitch, pitchToString, spellMidi } from '../music/pitch';
import { PPQ, beatTicks } from '../music/rhythm';
import { type PlayStep, type Score, buildSteps, scoreRange, scoreTotalTicks } from '../music/score';
import { type GhostNote, NotationView, type NoteState } from '../notation/NotationView';
import type { ItemResult } from '../state/srs';
import { type ActivityResult, type LessonCtx, resolveVisibility } from './context';
import { applyFingeringMode } from './fingeringView';
import { InstrumentPanel, pianoRangeFor } from './InstrumentPanel';
import { useComputerPiano, useNoteInput } from './input';

export interface PlayAlongProps {
  ctx: LessonCtx;
  score: Score;
  mode: 'wait' | 'tempo';
  tempo?: number;
  fingering?: FingeringMode;
  noteNames?: boolean;
  /** Which hand(s) the learner plays on a two-staff piano score. */
  hands?: 'R' | 'L' | 'both';
  title?: string;
  prompt?: string;
  /** Guitar: fret window & context marks (e.g. a scale shape) */
  fretRange?: [number, number];
  contextMarks?: FretMark[];
  onDone: (r: ActivityResult) => void;
  /** label of the run, e.g. "Passage 2 of 3" */
  badge?: string;
}

type Phase = 'ready' | 'countin' | 'playing' | 'preview' | 'done';

interface StepRuntime {
  required: PlayStep['notes'];
  auto: PlayStep['notes'];
}

const staffClef = (score: Score, staff: number) => score.staves[staff]?.clef ?? 'treble';

export function PlayAlong(props: PlayAlongProps) {
  const { ctx, score: rawScore, mode, onDone } = props;
  const tempo = props.tempo ?? rawScore.tempo ?? 80;
  const instrument = ctx.instrument;

  // ----- derived score / steps -----
  const fingeringMode: FingeringMode = useMemo(() => {
    if (ctx.settings.fingering === 'always') return 'all';
    if (ctx.settings.fingering === 'never') return 'none';
    return props.fingering ?? 'all';
  }, [ctx.settings.fingering, props.fingering]);
  const score = useMemo(() => applyFingeringMode(rawScore, fingeringMode), [rawScore, fingeringMode]);
  const showNames = resolveVisibility(ctx.settings.noteNames, !!props.noteNames);
  const steps = useMemo(() => buildSteps(rawScore), [rawScore]);
  const runtime: StepRuntime[] = useMemo(() => {
    const hands = props.hands ?? 'both';
    return steps.map(s => {
      const required = s.notes.filter(n => hands === 'both' || !n.hand || n.hand === hands);
      const auto = s.notes.filter(n => !required.includes(n));
      return { required, auto };
    });
  }, [steps, props.hands]);
  const gradedSteps = useMemo(() => runtime.map((r, i) => (r.required.length ? i : -1)).filter(i => i >= 0), [runtime]);
  const totalTicks = useMemo(() => scoreTotalTicks(rawScore), [rawScore]);
  const secPerTick = 60 / tempo / PPQ;

  // ----- state -----
  const [phase, setPhase] = useState<Phase>(mode === 'wait' ? 'playing' : 'ready');
  const [stepIdx, setStepIdx] = useState(0);
  const [stepStates, setStepStates] = useState<Record<number, NoteState>>({});
  const [ghosts, setGhosts] = useState<GhostNote[]>([]);
  const [hint, setHint] = useState(false);
  const [playheadTick, setPlayheadTick] = useState<number | null>(null);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [heldColor, setHeldColor] = useState<Record<number, MarkColor>>({});
  const [, force] = useState(0);

  const hitRef = useRef<Set<number>>(new Set());
  const mistakesRef = useRef<Record<number, number>>({});
  const stepStartRef = useRef(performance.now());
  const itemsRef = useRef<ItemResult[]>([]);
  const responseRef = useRef<number[]>([]);
  const metroRef = useRef<Metronome | null>(null);
  const t0Ref = useRef(0);
  const rafRef = useRef(0);
  const tempoHitsRef = useRef<Record<number, Set<number>>>({});
  const doneRef = useRef(false);
  const seqRef = useRef<{ stop(): void } | null>(null);
  const ghostSeq = useRef(0);

  // skip leading steps that have nothing to play (other hand only) in wait mode
  const advanceFrom = useCallback(
    (from: number) => {
      let i = from;
      while (i < runtime.length && runtime[i].required.length === 0) {
        const auto = runtime[i].auto;
        if (auto.length) synth.play(auto.map(n => n.midi), { duration: Math.min(1.5, auto[0].ticks * secPerTick), velocity: 0.5 });
        i++;
      }
      return i;
    },
    [runtime, secPerTick],
  );

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('done');
    metroRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    inputManager.setExpected(null);
    const total = gradedSteps.length;
    let correct = 0;
    for (const i of gradedSteps) {
      if (mode === 'wait') {
        if (!mistakesRef.current[i]) correct++;
      } else if (stepStatesRef.current[i] === 'good') correct++;
    }
    const notes = gradedSteps.reduce((s, i) => s + runtime[i].required.length, 0);
    setTimeout(() => onDone({ total, correct, items: itemsRef.current, notes, responseMs: responseRef.current }), 650);
  }, [gradedSteps, mode, onDone, runtime]);

  /** Synchronous mirror of step results (state updates are async; scoring must not miss the last step). */
  const stepStatesRef = useRef<Record<number, NoteState>>({});
  const markSteps = useCallback((upd: Record<number, NoteState>) => {
    stepStatesRef.current = { ...stepStatesRef.current, ...upd };
    setStepStates(s => ({ ...s, ...upd }));
  }, []);
  const resetSteps = useCallback(() => {
    stepStatesRef.current = {};
    setStepStates({});
  }, []);

  // initialise wait mode
  useEffect(() => {
    if (mode !== 'wait') return;
    const first = advanceFrom(0);
    setStepIdx(first);
    stepStartRef.current = performance.now();
    if (first >= runtime.length) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tell the microphone what we expect (helps chord detection)
  useEffect(() => {
    if (mode === 'wait' && phase === 'playing' && runtime[stepIdx]) {
      inputManager.setExpected(runtime[stepIdx].required.map(n => n.midi));
    }
    return () => inputManager.setExpected(null);
  }, [mode, phase, stepIdx, runtime]);

  useEffect(
    () => () => {
      metroRef.current?.stop();
      seqRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const addGhost = useCallback(
    (midi: number, near: PlayStep | undefined, tone: GhostNote['tone']) => {
      if (!near) return;
      // show the wrong note on the staff the player was most likely reading
      const staff = near.notes.reduce((best, n) => (Math.abs(n.midi - midi) < Math.abs(best.midi - midi) ? n : best), near.notes[0])?.staff ?? 0;
      const pitch: Pitch = spellMidi(midi, rawScore.key.fifths);
      const key = `g${++ghostSeq.current}`;
      setGhosts(g => [...g.slice(-2), { key, staff, pitch, nearId: near.elIds[0], tone }]);
      setTimeout(() => setGhosts(g => g.filter(x => x.key !== key)), 1000);
    },
    [rawScore.key.fifths],
  );

  const recordStepItems = useCallback(
    (i: number, correct: boolean, ms?: number) => {
      for (const n of runtime[i].required) {
        itemsRef.current.push({ key: `note:${staffClef(rawScore, n.staff)}:${pitchToString(n.pitch)}`, correct, ms });
      }
    },
    [runtime, rawScore],
  );

  // ----- WAIT MODE input -----
  const onWaitInput = useCallback(
    (e: NoteInputEvent) => {
      const i = stepIdx;
      const rt = runtime[i];
      if (!rt) return;
      if (e.type === 'off') {
        setHeldColor(h => {
          const c = { ...h };
          delete c[e.midi];
          return c;
        });
        return;
      }
      const expected = rt.required.map(n => n.midi);
      if (expected.includes(e.midi)) {
        hitRef.current.add(e.midi);
        setHeldColor(h => ({ ...h, [e.midi]: 'good' }));
        if (expected.every(m => hitRef.current.has(m))) {
          const ms = performance.now() - stepStartRef.current;
          const clean = !mistakesRef.current[i];
          recordStepItems(i, clean, ms);
          if (clean) responseRef.current.push(ms / Math.max(1, expected.length));
          markSteps({ [i]: clean ? 'good' : 'bad' });
          hitRef.current = new Set();
          setHint(false);
          const next = advanceFrom(i + 1);
          if (next >= runtime.length) {
            setStepIdx(next);
            finish();
          } else {
            setStepIdx(next);
            stepStartRef.current = performance.now();
          }
        }
      } else {
        mistakesRef.current[i] = (mistakesRef.current[i] ?? 0) + 1;
        setHeldColor(h => ({ ...h, [e.midi]: 'bad' }));
        addGhost(e.midi, steps[i], 'bad');
        const threshold = fingeringMode === 'all' || ctx.progress < 0.2 ? 1 : 2;
        if (mistakesRef.current[i] >= threshold) setHint(true);
        force(x => x + 1);
      }
    },
    [stepIdx, runtime, recordStepItems, advanceFrom, finish, addGhost, steps, fingeringMode, ctx.progress],
  );

  // ----- TEMPO MODE -----
  const stepTimeMs = useCallback((i: number) => t0Ref.current + steps[i].tick * secPerTick * 1000, [steps, secPerTick]);
  const tolerance = useMemo(() => Math.max(110, Math.min(220, 60000 / tempo / 3.2)), [tempo]);
  const latency = ctx.device.latencyMs;

  const onTempoInput = useCallback(
    (e: NoteInputEvent) => {
      if (phase !== 'playing') return;
      if (e.type === 'off') {
        setHeldColor(h => {
          const c = { ...h };
          delete c[e.midi];
          return c;
        });
        return;
      }
      const t = e.time - latency;
      let best = -1;
      let bestErr = Infinity;
      for (const i of gradedSteps) {
        const err = t - stepTimeMs(i);
        if (Math.abs(err) > tolerance) continue;
        const rt = runtime[i];
        if (!rt.required.some(n => n.midi === e.midi)) continue;
        const hits = tempoHitsRef.current[i] ?? new Set();
        if (hits.has(e.midi)) continue;
        if (Math.abs(err) < Math.abs(bestErr)) {
          best = i;
          bestErr = err;
        }
      }
      if (best >= 0) {
        const hits = (tempoHitsRef.current[best] ??= new Set());
        hits.add(e.midi);
        setHeldColor(h => ({ ...h, [e.midi]: 'good' }));
        if (runtime[best].required.every(n => hits.has(n.midi))) {
          const clean = !mistakesRef.current[best];
          markSteps({ [best]: clean ? 'good' : 'bad' });
          recordStepItems(best, clean);
        }
      } else {
        // attribute the mistake to the nearest step in time
        let near = gradedSteps[0];
        for (const i of gradedSteps) if (Math.abs(t - stepTimeMs(i)) < Math.abs(t - stepTimeMs(near))) near = i;
        mistakesRef.current[near] = (mistakesRef.current[near] ?? 0) + 1;
        setHeldColor(h => ({ ...h, [e.midi]: 'bad' }));
        addGhost(e.midi, steps[near], 'bad');
      }
    },
    [phase, latency, gradedSteps, stepTimeMs, tolerance, runtime, recordStepItems, addGhost, steps],
  );

  useNoteInput(e => {
    if (phase === 'preview' || phase === 'done') return;
    if (mode === 'wait') onWaitInput(e);
    else onTempoInput(e);
  });
  useComputerPiano(instrument === 'piano' && phase !== 'done', rawScore.staves[0]?.clef === 'bass' ? 3 : 4);

  const tick = useCallback(() => {
    const now = performance.now();
    const cur = (now - t0Ref.current) / (secPerTick * 1000);
    setPlayheadTick(Math.max(-PPQ, cur));
    // misses
    const updates: Record<number, NoteState> = {};
    for (const i of gradedSteps) {
      if (stepStatesRef.current[i]) continue;
      if (now - latency > stepTimeMs(i) + tolerance) {
        updates[i] = 'missed';
        const hits = tempoHitsRef.current[i] ?? new Set();
        for (const n of runtime[i].required) {
          itemsRef.current.push({ key: `note:${staffClef(rawScore, n.staff)}:${pitchToString(n.pitch)}`, correct: hits.has(n.midi) });
        }
      }
    }
    if (Object.keys(updates).length) markSteps(updates);
    const lastStep = gradedSteps[gradedSteps.length - 1];
    const lastDue = lastStep === undefined ? 0 : stepTimeMs(lastStep) + tolerance + latency + 120;
    if (cur > totalTicks + PPQ * 0.5 && now > lastDue) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [secPerTick, gradedSteps, latency, stepTimeMs, tolerance, totalTicks, finish, runtime, rawScore]);

  const startTempo = useCallback(async () => {
    await unlockAudio();
    seqRef.current?.stop();
    doneRef.current = false;
    tempoHitsRef.current = {};
    mistakesRef.current = {};
    itemsRef.current = [];
    resetSteps();
    const beatsPerBar = rawScore.time[1] === 8 && rawScore.time[0] % 3 === 0 ? rawScore.time[0] / 3 : rawScore.time[0];
    const bpm = (60 / (beatTicks(rawScore.time) * secPerTick));
    const metro = new Metronome();
    metroRef.current = metro;
    setPhase('countin');
    metro.start({
      bpm,
      beatsPerBar,
      countIn: 1,
      muted: !ctx.settings.metronome,
      onBeat: info => {
        if (info.isCountIn) setCountIn(beatsPerBar - info.beat);
        else {
          setCountIn(null);
          setPhase(p => (p === 'countin' ? 'playing' : p));
        }
      },
    });
    // pickup: the first full bar starts after the count-in; a pickup overlaps the count-in's last beat(s)
    const pickupOffset = rawScore.pickup ? -rawScore.pickup * secPerTick : 0;
    t0Ref.current = ctxTimeToPerfNow(metro.startTime + pickupOffset);
    // other hand / accompaniment, scheduled on the audio clock
    const ctxNow = getAudioContext().currentTime;
    const autoEvents = runtime.flatMap((rt, i) =>
      rt.auto.length
        ? [{ midi: rt.auto.map(n => n.midi), at: metro.startTime + pickupOffset + steps[i].tick * secPerTick - ctxNow, duration: rt.auto[0].ticks * secPerTick * 0.95 }]
        : [],
    );
    if (autoEvents.length) seqRef.current = synth.playSequence(autoEvents, instrument === 'guitar' ? 'guitar' : 'piano');
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [rawScore, secPerTick, ctx.settings.metronome, runtime, steps, tick, instrument]);

  // preview ("listen")
  const preview = useCallback(async () => {
    await unlockAudio();
    if (phase === 'preview') {
      seqRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
      setPlayheadTick(null);
      setPhase(mode === 'wait' ? 'playing' : 'ready');
      return;
    }
    const prevPhase = phase;
    setPhase('preview');
    const lead = 0.25;
    const events = steps.map(s => ({ midi: s.notes.map(n => n.midi), at: lead + s.tick * secPerTick, duration: Math.max(0.15, s.notes[0].ticks * secPerTick * 0.95) }));
    seqRef.current = synth.playSequence(events, instrument === 'guitar' ? 'guitar' : 'piano');
    const start = performance.now() + lead * 1000;
    const loop = () => {
      const cur = (performance.now() - start) / (secPerTick * 1000);
      setPlayheadTick(Math.max(0, cur));
      if (cur > totalTicks) {
        setPlayheadTick(null);
        setPhase(prevPhase);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [phase, steps, secPerTick, instrument, totalTicks, mode]);

  // ----- view model -----
  const states = useMemo(() => {
    const s: Record<string, NoteState> = {};
    steps.forEach((st, i) => {
      const state = stepStates[i] ?? (mode === 'wait' && i === stepIdx && phase !== 'done' ? 'active' : undefined);
      if (state) st.elIds.forEach(id => (s[id] = state));
    });
    return s;
  }, [steps, stepStates, stepIdx, mode, phase]);

  const current = mode === 'wait' ? steps[stepIdx] : undefined;
  const currentRt = mode === 'wait' ? runtime[stepIdx] : undefined;
  const [lo, hi] = useMemo(() => scoreRange(rawScore), [rawScore]);
  const range = useMemo(() => pianoRangeFor([lo, hi]), [lo, hi]);

  const keyMarks: KeyMark[] = useMemo(() => {
    if (!hint || !currentRt) return [];
    return currentRt.required.map(n => ({ midi: n.midi, color: (n.hand === 'L' ? 'lh' : 'rh') as MarkColor, finger: n.finger, pulse: true }));
  }, [hint, currentRt]);

  const fretMarks: FretMark[] = useMemo(() => {
    const ctxMarks = props.contextMarks ?? [];
    if (!currentRt || instrument !== 'guitar') return ctxMarks;
    const cur = currentRt.required
      .filter(n => n.string !== undefined)
      .map(n => ({ string: n.string!, fret: n.midi - [64, 59, 55, 50, 45, 40][n.string! - 1], color: 'gold' as MarkColor, finger: n.finger, pulse: true }));
    return hint || props.contextMarks ? [...ctxMarks.filter(m => !cur.some(c => c.string === m.string && c.fret === m.fret)), ...(hint || props.contextMarks ? cur : [])] : ctxMarks;
  }, [currentRt, instrument, hint, props.contextMarks]);

  const fretRange = useMemo<[number, number]>(() => {
    if (props.fretRange) return props.fretRange;
    let maxF = 0;
    for (const s of steps) for (const n of s.notes) if (n.string) maxF = Math.max(maxF, n.midi - [64, 59, 55, 50, 45, 40][n.string - 1]);
    return maxF <= 5 ? [0, 7] : maxF <= 12 ? [0, 12] : [Math.max(0, maxF - 10), maxF + 2];
  }, [props.fretRange, steps]);

  const focusMidi = current ? Math.round(current.notes.reduce((s, n) => s + n.midi, 0) / Math.max(1, current.notes.length)) : undefined;
  const focusId = current?.elIds[0];
  const progress = gradedSteps.length ? gradedSteps.filter(i => stepStates[i]).length / gradedSteps.length : 0;

  const pressedColor = useCallback((m: number) => heldColor[m] ?? 'gold', [heldColor]);

  return (
    <div className="activity playalong" data-expected={currentRt?.required.map(n => n.midi).join(',')} data-phase={phase}>
      <ActivityHeader title={props.title} prompt={props.prompt ?? defaultPrompt(mode, props.hands)} badge={props.badge} progress={progress} />
      <div className="stage-paper paper">
        <NotationView
          score={score}
          states={states}
          focusId={phase === 'playing' && mode === 'wait' ? focusId : undefined}
          playheadTick={phase === 'preview' || (mode === 'tempo' && (phase === 'playing' || phase === 'countin')) ? playheadTick ?? 0 : null}
          fingering={fingeringMode !== 'none'}
          strings={instrument === 'guitar' && fingeringMode !== 'none'}
          noteNames={showNames ? 'all' : hint ? 'focus' : 'none'}
          naming={ctx.settings.naming}
          labelSpace
          ghosts={ghosts}
        />
        <AnimatePresence>
          {countIn !== null && (
            <motion.div key={countIn} className="count-in" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              {countIn}
            </motion.div>
          )}
        </AnimatePresence>
        {mode === 'tempo' && phase === 'ready' && (
          <div className="paper-overlay">
            <button className="btn btn-primary btn-lg" onClick={startTempo}>
              <Play size={18} /> Start — {Math.round(tempo)} bpm
            </button>
            <span className="faint">A one-bar count-in will play first.</span>
          </div>
        )}
      </div>
      <div className="stage-controls">
        <button className="btn btn-sm" onClick={preview} disabled={phase === 'countin' || (mode === 'tempo' && phase === 'playing')}>
          {phase === 'preview' ? <Square size={14} /> : <Ear size={15} />} {phase === 'preview' ? 'Stop' : 'Listen'}
        </button>
        {mode === 'wait' && (
          <button className="btn btn-sm" onClick={() => setHint(true)} disabled={hint || phase !== 'playing'}>
            <Lightbulb size={15} /> Hint
          </button>
        )}
        {mode === 'tempo' && (phase === 'playing' || phase === 'countin') && (
          <button
            className="btn btn-sm"
            onClick={() => {
              metroRef.current?.stop();
              seqRef.current?.stop();
              cancelAnimationFrame(rafRef.current);
              setPlayheadTick(null);
              setCountIn(null);
              setPhase('ready');
              resetSteps();
            }}
          >
            <RotateCcw size={15} /> Restart
          </button>
        )}
      </div>
      <InstrumentPanel
        ctx={ctx}
        range={range}
        marks={keyMarks}
        fretMarks={fretMarks}
        fretRange={fretRange}
        focus={focusMidi}
        pressedColor={pressedColor}
      />
    </div>
  );
}

function defaultPrompt(mode: 'wait' | 'tempo', hands?: 'R' | 'L' | 'both') {
  const who = hands === 'R' ? 'with your right hand — the app plays the left' : hands === 'L' ? 'with your left hand — the app plays the right' : '';
  if (mode === 'wait') return `Play each note when it lights up${who ? ` ${who}` : ''}. Take your time.`;
  return `Play in time with the metronome${who ? ` ${who}` : ''}.`;
}

export function ActivityHeader({ title, prompt, badge, progress }: { title?: string; prompt?: string; badge?: string; progress?: number }) {
  return (
    <div className="activity-header">
      <div className="activity-titles">
        {title && <h2 className="display activity-title">{title}</h2>}
        {prompt && <p className="activity-prompt">{prompt}</p>}
      </div>
      {badge && <span className="pill">{badge}</span>}
      {progress !== undefined && (
        <div className="activity-progress" aria-hidden>
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
