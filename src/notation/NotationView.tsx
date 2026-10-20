import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isFretted, isKeyboard } from '../music/instruments';
import { type NoteNaming, type Pitch, pitchLabel } from '../music/pitch';
import type { NoteEl, Score } from '../music/score';
import { scoreTotalTicks } from '../music/score';
import {
  type RenderResult,
  ledgerLinesFor,
  notationFontsReady,
  renderScore,
  xForTick,
  yForPitch,
} from './render';
import { scrollOffset, scrollPath, scrollView } from './scroll';
import './notation.css';

export type NoteState = 'active' | 'good' | 'bad' | 'done' | 'hint' | 'missed';

export interface GhostNote {
  key: string;
  staff: number;
  pitch: Pitch;
  /** id of the note it should appear next to (defaults to focus note) */
  nearId?: string;
  tone: 'bad' | 'good' | 'info';
}

export interface NotationViewProps {
  score: Score;
  states?: Record<string, NoteState>;
  /** Note element id to keep in view (scroll layout) */
  focusId?: string;
  /** Tempo-mode playhead position in ticks (overrides focus for scrolling) */
  playheadTick?: number | null;
  /**
   * Tempo mode, the smooth way: the playhead moves by itself, reaching tick t at
   * performance.now() = startMs + t × msPerTick. The browser animates the scrolling (on
   * the compositor), so nothing re-renders per frame. Overrides playheadTick.
   */
  motion?: PlayheadMotion | null;
  showPlayhead?: boolean;
  fingering?: boolean;
  strings?: boolean;
  /** Show note-name labels: all notes, only the focused one, or none. */
  noteNames?: 'all' | 'focus' | 'none';
  /** Text under particular notes (by note id) in place of their names: scale degrees, intervals, numerals. */
  labels?: Record<string, string>;
  naming?: NoteNaming;
  ghosts?: GhostNote[];
  layout?: 'scroll' | 'center';
  timeSignature?: boolean;
  barlines?: boolean;
  beatWidth?: number;
  maxScale?: number;
  className?: string;
  onRendered?: (r: RenderResult) => void;
  /** Reserve space for note-name labels even while none are shown (avoids re-layout when hints appear). */
  labelSpace?: boolean;
}

export interface PlayheadMotion {
  startMs: number;
  msPerTick: number;
}

let instanceCounter = 0;

function NotationViewImpl(props: NotationViewProps) {
  const {
    score,
    states,
    focusId,
    playheadTick: tickProp,
    motion,
    showPlayhead = true,
    fingering = false,
    strings = false,
    noteNames = 'none',
    naming = 'letter',
    ghosts,
    layout = 'scroll',
    timeSignature = true,
    barlines = true,
    beatWidth,
    maxScale = 2.1,
    className,
    onRendered,
    labelSpace,
    labels,
  } = props;

  // reserve room under the staff when note names may be shown (so labels are never clipped)
  const labelRoom = labelSpace || noteNames !== 'none' || labels ? 18 : 0;
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const headerHostRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const prefix = useMemo(() => `cc${++instanceCounter}-`, []);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  const elById = useMemo(() => {
    const m = new Map<string, NoteEl>();
    score.staves.forEach(st => st.voices.forEach(v => v.notes.forEach(n => m.set(n.id, n))));
    return m;
  }, [score]);

  // Observe container size
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setBox(b => (Math.abs(b.w - r.width) > 0.5 || Math.abs(b.h - r.height) > 0.5 ? { w: r.width, h: r.height } : b));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render with VexFlow when the score/options change
  useEffect(() => {
    let cancelled = false;
    notationFontsReady().then(() => {
      if (cancelled || !svgHostRef.current) return;
      try {
        const r = renderScore(svgHostRef.current, score, {
          fingering,
          strings,
          timeSignature,
          barlines,
          beatWidth,
          idPrefix: prefix,
          tailPad: layout === 'scroll' ? 600 : 0,
          extraBelow: labelRoom,
          leadIn: layout === 'scroll' ? 24 : 12,
        });
        // fixed header clone for scroll layout
        if (headerHostRef.current) {
          headerHostRef.current.innerHTML = '';
          if (layout === 'scroll') {
            const svg = svgHostRef.current.querySelector('svg');
            if (svg) {
              const clone = svg.cloneNode(true) as SVGSVGElement;
              // keep only the clef/key/time header groups (one per clef, key or time change)
              [...clone.children].forEach(ch => {
                if (!(ch.getAttribute('class') ?? '').split(/\s+/).includes('vf-header')) ch.remove();
              });
              clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
              clone.style.overflow = 'hidden';
              clone.setAttribute('viewBox', `0 0 ${r.headerWidth} ${r.height}`);
              clone.setAttribute('width', String(r.headerWidth));
              clone.setAttribute('height', String(r.height));
              clone.setAttribute('class', 'cc-score cc-score-header');
              clone.style.width = '';
              clone.style.height = '';
              headerHostRef.current.appendChild(clone);
            }
          }
        }
        setResult(r);
        onRenderedRef.current?.(r);
      } catch (e) {
        console.error('Notation render failed', e);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [score, fingering, strings, timeSignature, barlines, beatWidth, prefix, layout, labelRoom]);

  // Apply note states as classes on the SVG groups
  useEffect(() => {
    if (!result) return;
    result.notes.forEach(pos => {
      const g = pos.el;
      if (!g) return;
      const st = states?.[pos.id];
      g.setAttribute('class', `vf-stavenote${st ? ` st-${st}` : ''}`);
    });
  }, [result, states]);

  // Moving by itself: where the playhead is, a few times a second (for the clef header and
  // ghost notes; the motion itself is the browser's).
  const [motionTick, setMotionTick] = useState<number | null>(null);
  useEffect(() => {
    if (!motion) {
      setMotionTick(null);
      return;
    }
    const update = () => setMotionTick((performance.now() - motion.startMs) / motion.msPerTick);
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [motion]);
  const playheadTick = motion ? (motionTick ?? 0) : tickProp;

  // ---- scaling ----
  const scale = useMemo(() => {
    if (!result || !box.h) return 1;
    let s = box.h / result.height;
    if (layout === 'center' && box.w) s = Math.min(s, (box.w - 16) / result.width);
    // narrow screens: keep at least ~4 beats of music visible after the clef so the eye can read ahead
    if (layout === 'scroll' && box.w) s = Math.min(s, box.w / (result.headerWidth + 260));
    return Math.max(0.55, Math.min(maxScale, s));
  }, [result, box, layout, maxScale]);

  // ---- scroll position ----
  const totalTicks = useMemo(() => scoreTotalTicks(score), [score]);
  const focusX = useMemo(() => {
    if (!result) return 0;
    if (playheadTick !== undefined && playheadTick !== null) return xForTick(result, playheadTick, totalTicks);
    if (focusId) return result.notes.get(focusId)?.x ?? result.headerWidth;
    return result.headerWidth;
  }, [result, focusId, playheadTick, totalTicks]);

  const view = useMemo(() => (result && layout === 'scroll' ? scrollView(result, scale, box.w) : null), [result, layout, scale, box.w]);
  const offset = view ? scrollOffset(view, focusX) : 0;

  // the fixed header shows the clef, key and time of the music passing under it
  const headerIndex = useMemo(() => {
    if (!result || result.headers.length < 2) return 0;
    const edge = offset / scale + result.headerWidth;
    let i = 0;
    while (i + 1 < result.headers.length && result.headers[i + 1].x <= edge) i++;
    return i;
  }, [result, offset, scale]);
  useEffect(() => {
    headerHostRef.current?.querySelectorAll('[data-header]').forEach(g => {
      if (g.getAttribute('data-header') === String(headerIndex)) g.removeAttribute('display');
      else g.setAttribute('display', 'none');
    });
  }, [headerIndex, result]);
  // tick of the music in focus (for the clef a ghost note is drawn in)
  const focusTick = playheadTick ?? (focusId ? elById.get(focusId)?.tick : undefined) ?? 0;

  // Note names don't move with the playhead: build them only when they change, so a
  // tempo-mode frame (playhead and scroll only) stays cheap.
  const nameLabels = useMemo(() => {
    if (!result || (noteNames === 'none' && !labels)) return null;
    return [...result.notes.values()].map(pos => {
      const el = elById.get(pos.id);
      if (!el || el.rest || el.tiePrev) return null;
      const custom = labels?.[pos.id];
      if (custom === undefined && (noteNames === 'none' || (noteNames === 'focus' && pos.id !== focusId))) return null;
      const geom = result.staves[pos.staff];
      const lowest = Math.max(...el.pitches.map(p => yForPitch(geom, p, el.tick)));
      const fretted = isFretted(score.instrument);
      const fingerBelow = fingering && ((isKeyboard(score.instrument) && score.staves[pos.staff].hand === 'L') || fretted);
      const extra = fingerBelow ? 16 * (fretted && strings ? 1.4 : el.pitches.length) : 0;
      // a label of our own sits below a down-stem too (notes above the middle line point their stems down)
      const highest = Math.min(...el.pitches.map(p => yForPitch(geom, p, el.tick)));
      const stemDown = custom !== undefined && el.base !== 'w' && (lowest + highest) / 2 < (geom.top + geom.bottom) / 2;
      const y = Math.max(geom.bottom + 26, lowest + 24 + (stemDown ? 30 : 0)) + extra;
      const text = custom ?? el.pitches.map(p => pitchLabel(p, naming)).reverse().join(' ');
      const st = states?.[pos.id];
      return (
        <g key={pos.id} className={`note-name ${st ? `nn-${st}` : ''}`} transform={`translate(${pos.x}, ${y})`}>
          <rect x={-(text.length * 4.2 + 8)} y={-11} width={text.length * 8.4 + 16} height={18} rx={9} />
          <text textAnchor="middle" y={2.5}>
            {text}
          </text>
        </g>
      );
    });
  }, [result, noteNames, elById, focusId, score, fingering, strings, naming, states, labels]);

  const tempoMode = playheadTick !== undefined && playheadTick !== null;
  const centerPad = layout === 'center' && result ? Math.max(0, (box.w - result.width * scale) / 2) : 0;
  const verticalPad = result ? Math.max(0, (box.h - result.height * scale) / 2) : 0;

  const staffSpan = result
    ? { top: result.staves[0].top - 18, bottom: result.staves[result.staves.length - 1].bottom + 18 }
    : { top: 0, bottom: 0 };

  // Moving by itself: the music and the playhead follow keyframes (linear between the
  // notes, as xForTick is) on the audio's clock. Re-rendering every frame to move them
  // kept tablets warmer than the whole band's sound did.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!motion || !view || !result || typeof content?.animate !== 'function') return;
    const from = Math.min(0, result.tickXs[0]?.[0] ?? 0);
    const to = Math.max(from + 1, totalTicks);
    const path = scrollPath(result, totalTicks, view, from, to);
    const at = (tick: number) => (tick - from) / (to - from);
    const timing: KeyframeAnimationOptions = { duration: (to - from) * motion.msPerTick, easing: 'linear', fill: 'both' };
    const top = verticalPad + staffSpan.top * scale;
    const anims = [content.animate(path.map(p => ({ offset: at(p.tick), transform: `translate3d(${centerPad - p.offset}px, ${verticalPad}px, 0)` })), timing)];
    const head = playheadRef.current;
    if (head) anims.push(head.animate(path.map(p => ({ offset: at(p.tick), transform: `translate3d(${centerPad - p.offset + (p.x - 14) * scale}px, ${top}px, 0)` })), timing));
    // the same clock as performance.now(): tick `from` sounds at startMs + from × msPerTick
    for (const a of anims) a.startTime = motion.startMs + from * motion.msPerTick;
    return () => anims.forEach(a => a.cancel());
  }, [motion, view, result, totalTicks, centerPad, verticalPad, scale, staffSpan.top]);

  return (
    <div ref={wrapRef} className={`notation ${layout === 'center' ? 'notation-center' : 'notation-scroll'} ${className ?? ''}`}>
      <div
        ref={contentRef}
        className={`notation-content ${tempoMode ? 'no-ease' : ''}`}
        style={{
          transform: `translate3d(${centerPad - offset}px, ${verticalPad}px, 0)`,
          width: result ? result.width * scale : undefined,
          height: result ? result.height * scale : undefined,
        }}
      >
        <div
          ref={svgHostRef}
          className="notation-svg"
          style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
        {result && (
          <svg
            className="notation-overlay"
            width={result.width * scale}
            height={result.height * scale}
            viewBox={`0 0 ${result.width} ${result.height}`}
          >
            {nameLabels}
            {ghosts?.map(g => {
              const geom = result.staves[g.staff] ?? result.staves[0];
              const near = g.nearId ? result.notes.get(g.nearId)?.x : focusX;
              const x = (near ?? focusX) + 22;
              const tick = (g.nearId ? elById.get(g.nearId)?.tick : undefined) ?? focusTick;
              const y = yForPitch(geom, g.pitch, tick);
              const ledgers = ledgerLinesFor(geom, g.pitch, tick);
              return (
                <g key={g.key} className={`ghost ghost-${g.tone}`}>
                  {ledgers.map(ly => (
                    <line key={ly} x1={x - 11} x2={x + 11} y1={ly} y2={ly} />
                  ))}
                  {g.pitch.alter !== 0 && (
                    <text className="ghost-acc" x={x - 18} y={y} textAnchor="middle">
                      {g.pitch.alter > 0 ? '' : ''}
                    </text>
                  )}
                  <text className="ghost-head" x={x} y={y} textAnchor="middle">
                    {''}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {result && showPlayhead && layout === 'scroll' && (focusId || tempoMode) && (
        // Its own layer, moved only by transform: in tempo mode it holds still on
        // screen while the music scrolls under it, so nothing is repainted per frame.
        <div
          ref={playheadRef}
          className={`playhead ${tempoMode ? 'no-ease' : ''}`}
          style={{
            transform: `translate3d(${centerPad - offset + (focusX - 14) * scale}px, ${verticalPad + staffSpan.top * scale}px, 0)`,
            width: 28 * scale,
            height: (staffSpan.bottom - staffSpan.top) * scale,
            borderRadius: 14 * scale,
          }}
        />
      )}
      {layout === 'scroll' && (
        <div className="notation-header" style={{ top: verticalPad }}>
          <div
            ref={headerHostRef}
            className="notation-header-svg"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              width: result ? result.headerWidth : undefined,
              height: result ? result.height : undefined,
            }}
          />
          <div className="notation-header-fade" style={{ left: result ? result.headerWidth * scale : 0 }} />
        </div>
      )}
    </div>
  );
}

export const NotationView = memo(NotationViewImpl);
