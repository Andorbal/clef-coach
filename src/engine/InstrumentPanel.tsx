import { useCallback, useEffect, useMemo, useState } from 'react';
import { inputManager } from '../audio/input/manager';
import { Fretboard, MalletKeyboard, PianoKeyboard, type FretMark, type KeyMark, type MarkColor } from '../instruments';
import { familyOf, instrumentDef, malletVariant, tuningFor } from '../music/instruments';
import { type LessonCtx, prefsOf } from './context';
import { useHeldNotes } from './input';

export interface FretTap {
  string: number;
  fret: number;
  midi: number;
}

interface Props {
  ctx: Pick<LessonCtx, 'instrument' | 'settings'>;
  /** MIDI range to show (piano / mallets). */
  range?: [number, number];
  marks?: KeyMark[];
  fretMarks?: FretMark[];
  fretRange?: [number, number];
  highlightFrets?: [number, number];
  focus?: number;
  dimOutside?: [number, number];
  pressedColor?: (midi: number) => MarkColor | undefined;
  /** Emit taps as note input (default true). */
  emitNotes?: boolean;
  onFretTap?: (t: FretTap) => void;
  fretNoteNames?: 'none' | 'marks' | 'all';
  pressedFrets?: { string: number; fret: number; color?: MarkColor }[];
  height?: number;
  interactive?: boolean;
}

/** Viewport height, kept current (used to cap the instrument height on short screens). */
function useViewportHeight() {
  const [h, setH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  useEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

/** The on-screen instrument shown at the bottom of every lesson. */
export function InstrumentPanel(p: Props) {
  const held = useHeldNotes();
  const vh = useViewportHeight();
  // never let the instrument take more than ~30% of a short screen
  const autoHeight = vh < 700 ? Math.max(92, Math.round(vh * 0.3)) : undefined;
  const height = p.height ?? autoHeight;
  const emit = p.emitNotes !== false;
  const family = familyOf(p.ctx.instrument);
  const prefs = prefsOf(p.ctx.settings);
  const tuning = useMemo(() => tuningFor(p.ctx.instrument, prefs).open, [p.ctx.instrument, prefs.ukuleleTuning, prefs.bassStrings]); // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = useCallback(
    (midi: number, velocity: number) => {
      if (emit) inputManager.emit({ type: 'on', midi, velocity, time: performance.now(), source: 'touch' });
    },
    [emit],
  );
  const onKeyUp = useCallback(
    (midi: number) => {
      if (emit) inputManager.emit({ type: 'off', midi, velocity: 0, time: performance.now(), source: 'touch' });
    },
    [emit],
  );
  const onTap = useCallback(
    (pos: { string: number; fret: number }, midi: number) => {
      p.onFretTap?.({ ...pos, midi });
      if (emit) inputManager.emit({ type: 'on', midi, velocity: 0.75, time: performance.now(), source: 'touch' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emit, p.onFretTap],
  );
  const onRelease = useCallback(
    (pos: { string: number; fret: number }) => {
      if (!emit) return;
      const midi = tuning[pos.string - 1] + pos.fret;
      inputManager.emit({ type: 'off', midi, velocity: 0, time: performance.now(), source: 'touch' });
    },
    [emit, tuning],
  );

  const range = useMemo<[number, number]>(() => p.range ?? [48, 84], [p.range]);

  if (family === 'fretted') {
    const look = instrumentDef(p.ctx.instrument).fretted!;
    const [minFret, maxFret] = p.fretRange ?? look.defaultWindow;
    return (
      <div className={`instrument-panel fretted ${p.ctx.instrument}`}>
        <Fretboard
          tuning={tuning}
          look={look}
          minFret={minFret}
          maxFret={Math.min(maxFret, look.maxFret + 2)}
          marks={p.fretMarks}
          pressed={p.pressedFrets}
          showNoteNames={p.fretNoteNames ?? 'marks'}
          naming={p.ctx.settings.naming}
          leftHanded={p.ctx.settings.leftHanded}
          highlightFrets={p.highlightFrets}
          interactive={p.interactive !== false}
          onTap={onTap}
          onRelease={onRelease}
          height={height}
          ariaLabel={`${instrumentDef(p.ctx.instrument).name} fretboard`}
        />
      </div>
    );
  }
  if (family === 'mallet') {
    const v = malletVariant(prefs);
    const lo = Math.max(v.low, Math.min(range[0], v.high - 24));
    const hi = Math.min(v.high, Math.max(range[1], lo + 24));
    return (
      <div className="instrument-panel mallets">
        <MalletKeyboard
          low={lo}
          high={hi}
          metal={v.metal}
          pressed={held}
          pressedColor={p.pressedColor}
          marks={p.marks}
          showLabels={p.ctx.settings.keyLabels === 'none' ? 'none' : p.ctx.settings.keyLabels === 'white' ? 'white' : 'c-only'}
          naming={p.ctx.settings.naming}
          dimOutside={p.dimOutside}
          focus={p.focus}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          interactive={p.interactive !== false}
          height={height}
          ariaLabel={v.name}
        />
      </div>
    );
  }
  return (
    <div className="instrument-panel piano">
      <PianoKeyboard
        low={range[0]}
        high={range[1]}
        pressed={held}
        pressedColor={p.pressedColor}
        marks={p.marks}
        showLabels={p.ctx.settings.keyLabels}
        naming={p.ctx.settings.naming}
        dimOutside={p.dimOutside}
        focus={p.focus}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        interactive={p.interactive !== false}
        height={height}
        markMiddleC
      />
    </div>
  );
}

/** A comfortable keyboard window around a set of notes (at least ~2 octaves, starting on C/F). */
export function pianoRangeFor(midis: number[], minSpan = 24): [number, number] {
  if (!midis.length) return [48, 84];
  let lo = Math.min(...midis);
  let hi = Math.max(...midis);
  // pad to C below / B-C above
  lo = lo - ((lo % 12) + 12) % 12; // down to C
  hi = hi + (12 - (((hi % 12) + 12) % 12)) % 12; // up to C
  if (hi - lo < minSpan) {
    const need = minSpan - (hi - lo);
    const down = Math.floor(need / 24) * 12 + (need % 24 >= 12 ? 12 : 0);
    lo -= Math.min(down, 24);
    hi = Math.max(hi, lo + minSpan);
    hi = hi + (12 - (((hi % 12) + 12) % 12)) % 12;
  }
  return [Math.max(21, lo), Math.min(108, hi)];
}
