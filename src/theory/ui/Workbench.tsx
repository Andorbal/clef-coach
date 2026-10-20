/**
 * The workbench every theory lesson shares: a staff that shows the lesson's figure or,
 * while you play, your own notes (named: "C major, first inversion"), and the keyboard.
 *
 * Notes come from inputManager, so a MIDI keyboard, the microphone, the on-screen keys and
 * the computer keyboard (A W S E D…) all work. The coaches listen to the same notes
 * through `useBench`.
 */
import { Ear, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { inputManager } from '../../audio/input/manager';
import { synth } from '../../audio/synth';
import type { KeyMark } from '../../instruments';
import { parseKey } from '../../music/keys';
import { midiOf, parsePitch } from '../../music/pitch';
import { NotationView } from '../../notation/NotationView';
import type { ProfileSettings } from '../../state/types';
import { InstrumentPanel } from '../../engine/InstrumentPanel';
import { useComputerPiano } from '../../engine/input';
import { analysePlayed, spellInKey } from '../theory';
import type { Figure } from '../course/types';
import { figureScore, liveFigure, playbackOf } from './figure';

export interface Bench {
  /** Held now, low to high. */
  held: number[];
  /** Struck since the last reset, oldest first. */
  struck: number[];
  /** Recent notes for the staff: each group struck together (within a moment). */
  trail: number[][];
  /** performance.now() of the last note on. */
  lastAt: number;
  /** Forget what was struck (a new task or round). */
  reset: () => void;
  /** Called after every note on (with the state already updated). */
  onNote: (fn: (b: Bench) => void) => () => void;
  /** Called when the last held key is let go. */
  onRelease: (fn: (b: Bench) => void) => () => void;
}

const GROUP_MS = 70;
const TRAIL = 8;

/** Follow what's played, from every input. */
export function useBench(): Bench {
  const [, setVersion] = useState(0);
  const held = useRef<Set<number>>(new Set());
  const struck = useRef<number[]>([]);
  const trail = useRef<number[][]>([]);
  const lastAt = useRef(0);
  const noteFns = useRef(new Set<(b: Bench) => void>());
  const releaseFns = useRef(new Set<(b: Bench) => void>());

  // the functions never change, so coaches can subscribe once
  const api = useMemo(() => {
    const a = {
      reset: () => {
        struck.current = [];
        setVersion(v => v + 1);
      },
      onNote: (fn: (b: Bench) => void) => {
        noteFns.current.add(fn);
        return () => void noteFns.current.delete(fn);
      },
      onRelease: (fn: (b: Bench) => void) => {
        releaseFns.current.add(fn);
        return () => void releaseFns.current.delete(fn);
      },
    };
    return a;
  }, []);
  const snapshot = useCallback(
    (): Bench => ({ held: [...held.current].sort((a, b) => a - b), struck: [...struck.current], trail: trail.current.map(g => [...g]), lastAt: lastAt.current, ...api }),
    [api],
  );

  useEffect(
    () =>
      inputManager.subscribe(e => {
        if (e.type === 'on') {
          held.current.add(e.midi);
          struck.current = [...struck.current, e.midi].slice(-64);
          const now = performance.now();
          const last = trail.current[trail.current.length - 1];
          if (last && now - lastAt.current < GROUP_MS) last.push(e.midi);
          else trail.current = [...trail.current, [e.midi]].slice(-TRAIL);
          lastAt.current = now;
          const b = snapshot();
          for (const fn of noteFns.current) fn(b);
        } else {
          held.current.delete(e.midi);
          if (!held.current.size) {
            const b = snapshot();
            for (const fn of releaseFns.current) fn(b);
          }
        }
        setVersion(v => v + 1);
      }),
    [snapshot],
  );
  return snapshot();
}

/** The keyboard's range: three octaves from C3, two on a narrow screen (around the notes in play). */
export function useKeyboardRange(range?: [string, string], focus: number[] = []): [number, number] {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return useMemo(() => {
    const lo = range ? midiOf(parsePitch(range[0])) : 48;
    const hi = range ? midiOf(parsePitch(range[1])) : 84;
    if (w >= 700 || hi - lo <= 24) return [lo, hi];
    // two octaves from the C at or below the lowest note in play
    const want = focus.length ? Math.min(...focus) : 60;
    const start = Math.max(lo, Math.min(hi - 24, want - (((want % 12) + 12) % 12)));
    return [start, start + 24];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, range?.[0], range?.[1], focus.join(',')]);
}

/** Play a figure ("Hear it"). */
export async function hearFigure(figure: Figure, tempo?: number): Promise<number> {
  await unlockAudio();
  const fs = figureScore(figure);
  const events = playbackOf(fs, figure.play);
  const sec = 60 / (tempo ?? figure.tempo ?? 92);
  synth.stopAll();
  const seq = synth.playSequence(
    events.map(e => ({ midi: e.midis, at: 0.05 + e.beat * sec, duration: e.beats * sec * 0.95, velocity: 0.7 })),
    'piano',
  );
  void seq;
  return Math.max(0, ...events.map(e => (e.beat + e.beats) * sec)) + 0.1;
}

const LIVE_MS = 2600;

/**
 * The paper: the figure, or what you're playing (for a few seconds after the last note),
 * with a line naming it. `hidden`: an ear-training round, the notes stay hidden until
 * answered.
 */
export function TheoryPaper({ bench, figure, keyName, hidden, naming, emptyText }: { bench: Bench; figure?: Figure; keyName?: string; hidden?: boolean; naming: ProfileSettings['naming']; emptyText?: string }) {
  const key = useMemo(() => (keyName ? parseKey(keyName) : undefined), [keyName]);
  const [, tick] = useState(0);
  const playingNow = bench.held.length > 0 || performance.now() - bench.lastAt < LIVE_MS;
  // come back to the figure once the playing stops
  useEffect(() => {
    if (!bench.lastAt || bench.held.length) return;
    const left = LIVE_MS - (performance.now() - bench.lastAt);
    if (left <= 0) return;
    const t = setTimeout(() => tick(x => x + 1), left + 30);
    return () => clearTimeout(t);
  }, [bench.lastAt, bench.held.length]);

  const live = playingNow && bench.trail.length > 0;
  const liveGroups = useMemo(() => {
    if (!live) return null;
    const groups = bench.held.length ? [bench.held] : bench.trail;
    return groups.map(g => {
      // spell a chord as a chord, single notes in the key
      const a = analysePlayed(g, key);
      return a ? a.pitches : g.map(m => spellInKey(m, key));
    });
  }, [live, bench.held, bench.trail, key]);

  const shown = live && liveGroups ? liveFigure(liveGroups, keyName) : figure && !hidden && figure.staff !== false ? { ...figure, key: figure.key ?? keyName } : null;
  const fs = useMemo(() => {
    if (!shown) return null;
    try {
      return figureScore(shown);
    } catch {
      return null;
    }
  }, [shown?.notes, shown?.key, shown?.clef, shown?.time, JSON.stringify(shown?.labels)]); // eslint-disable-line react-hooks/exhaustive-deps

  const analysis = useMemo(() => {
    if (!live) return null;
    const g = bench.held.length ? bench.held : bench.trail[bench.trail.length - 1];
    return g ? analysePlayed(g, key) : null;
  }, [live, bench.held, bench.trail, key]);

  const [playing, setPlaying] = useState(false);
  const hear = async () => {
    if (!figure) return;
    setPlaying(true);
    const secs = await hearFigure({ ...figure, key: figure.key ?? keyName });
    setTimeout(() => setPlaying(false), secs * 1000);
  };

  return (
    <div className={`th-paper-wrap ${live ? 'is-live' : ''}`}>
      <div className="paper th-paper">
        {fs ? (
          <NotationView
            score={fs.score}
            layout="center"
            timeSignature={!!shown?.time}
            barlines={!!shown?.time}
            noteNames={fs.names ? 'all' : 'none'}
            labels={fs.labels}
            naming={naming}
            beatWidth={shown?.time ? 44 : 22}
            maxScale={1.9}
          />
        ) : hidden && figure ? (
          <button className="th-listen" onClick={hear} aria-label="Listen">
            <span className={`th-listen-icon ${playing ? 'playing' : ''}`}>
              <Ear size={26} />
            </span>
            <span>
              <strong>Listen</strong>
              <span className="faint">Play it as often as you like</span>
            </span>
          </button>
        ) : figure && figure.staff === false && !hidden ? (
          <div className="th-paper-empty faint">{emptyText ?? 'The notes are lit on the keyboard below.'}</div>
        ) : (
          <div className="th-paper-empty faint">{emptyText ?? 'Play something: it appears here, named.'}</div>
        )}
        {figure && figure.play !== 'none' && !(hidden && !live) && (
          <button className={`btn btn-icon btn-ghost listen-btn th-hear ${playing ? 'playing' : ''}`} aria-label="Hear it" onClick={hear}>
            <Volume2 size={18} />
          </button>
        )}
        {live && <span className="th-live-tag">Your notes</span>}
      </div>
      <div className={`th-readout ${analysis ? 'on' : ''}`} aria-live="polite">
        {analysis ? (
          <>
            <strong>{analysis.title}</strong>
            {analysis.detail && <span className="faint">{analysis.detail}</span>}
          </>
        ) : (
          <span className="faint">{figure && !hidden ? 'Tap the speaker to hear it, or play it yourself.' : 'Hold notes to see them named.'}</span>
        )}
      </div>
    </div>
  );
}

/** The keyboard at the bottom: lit keys for the figure (gold) and for a hint or answer (green). */
export function TheoryKeys({ settings, range, figure, answer, keyName }: { settings: ProfileSettings; range?: [string, string]; figure?: Figure; answer?: string[]; keyName?: string }) {
  const figMidis = useMemo(() => {
    if (!figure || figure.keys === false) return [];
    if (figure.keys) return figure.keys.map(k => midiOf(parsePitch(k)));
    try {
      return figureScore(figure).midis;
    } catch {
      return [];
    }
  }, [figure]);
  const answerMidis = useMemo(() => (answer ?? []).map(n => midiOf(parsePitch(n))), [answer]);
  const [lo, hi] = useKeyboardRange(range, [...figMidis, ...answerMidis]);
  const marks: KeyMark[] = useMemo(() => {
    const out: KeyMark[] = figMidis.map(m => ({ midi: m, color: 'gold' as const }));
    for (const m of answerMidis) out.push({ midi: m, color: 'good', pulse: true });
    return out.filter(m => m.midi >= lo && m.midi <= hi);
  }, [figMidis, answerMidis, lo, hi]);
  void keyName;
  useComputerPiano(true, 4);
  const ctx = useMemo(() => ({ instrument: 'piano' as const, settings }), [settings]);
  return <InstrumentPanel ctx={ctx} range={[lo, hi]} marks={marks} interactive />;
}
