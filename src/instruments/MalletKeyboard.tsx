/**
 * MalletKeyboard — a marimba / xylophone / glockenspiel / vibraphone seen from the
 * player's side.
 *
 * Natural bars form the front row (nearest the player, bottom of the drawing) and the
 * accidentals the raised back row, each centred over the gap between two naturals
 * with the familiar holes at E–F and B–C. Bars are graduated: long in the bass,
 * short in the treble. Rosewood or metal finish, support cords at the nodal points.
 *
 * Marks carry mallet labels (L/R or 1–4) and are tinted by hand (left = lh colour,
 * right = rh colour) so a sticking is readable at a glance.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { isBlackKey, spellMidi, stepLabel } from '../music/pitch';
import type { NoteNaming } from '../music/pitch';
import { clamp, ColorDefs, isCoarsePointer, useElementWidth, useSvgId } from './common';
import type { MarkColor } from './common';
import type { KeyLabelMode, KeyMark } from './PianoKeyboard';
import './MalletKeyboard.css';

export interface MalletKeyboardProps {
  /** Lowest / highest written MIDI note on the instrument. */
  low: number;
  high: number;
  /** Metal bars (glockenspiel, vibraphone) instead of rosewood. */
  metal?: boolean;
  pressed?: ReadonlySet<number>;
  pressedColor?: (midi: number) => MarkColor | undefined;
  /** Targets / hints. `label` is drawn inside the mark (e.g. "L", "R", "3"). */
  marks?: KeyMark[];
  showLabels?: KeyLabelMode;
  naming?: NoteNaming;
  dimOutside?: [number, number];
  interactive?: boolean;
  onKeyDown?: (midi: number, velocity: number) => void;
  onKeyUp?: (midi: number) => void;
  focus?: number;
  /** Narrowest bar before the instrument scrolls (default 30 touch / 22 mouse). */
  minBarWidth?: number;
  height?: number;
  ariaLabel?: string;
  className?: string;
}

const WHITE_STEP = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6];
const pc12 = (m: number) => ((m % 12) + 12) % 12;
const absWhite = (m: number) => Math.floor(m / 12) * 7 + WHITE_STEP[pc12(m)];

interface BarGeo {
  midi: number;
  sharp: boolean;
  cx: number;
  w: number;
  /** bar length (vertical extent) */
  len: number;
  /** vertical centre of the bar */
  cy: number;
}

interface Layout {
  lo: number;
  hi: number;
  W: number;
  totalW: number;
  H: number;
  backTop: number;
  backBottom: number;
  frontTop: number;
  frontBottom: number;
  bars: BarGeo[];
  byMidi: Map<number, BarGeo>;
  scrollable: boolean;
  r: number;
  labelFs: number;
}

function computeLayout(low: number, high: number, containerW: number, minW: number, height?: number): Layout {
  let lo = Math.round(Math.min(low, high));
  let hi = Math.round(Math.max(low, high));
  if (isBlackKey(lo)) lo -= 1;
  if (isBlackKey(hi)) hi += 1;
  const a0 = absWhite(lo);
  const nNat = absWhite(hi) - a0 + 1;
  const W = containerW > 0 ? Math.max(minW, containerW / nNat) : minW;
  const totalW = W * nNat;
  const scrollable = containerW > 0 && totalW > containerW + 0.5;
  const H = height && height > 50 ? height : clamp(W * 5.4, 96, 210);
  const pad = 4;
  const rowGap = H * 0.04;
  const rowH = (H - pad * 2 - rowGap) / 2;
  const backTop = pad;
  const backBottom = pad + rowH;
  const frontTop = backBottom + rowGap;
  const frontBottom = H - pad;
  const bars: BarGeo[] = [];
  const span = Math.max(1, hi - lo);
  const lenAt = (m: number, max: number) => max * (1 - 0.34 * ((m - lo) / span));
  for (let m = lo; m <= hi; m++) {
    if (isBlackKey(m)) {
      const cx = (absWhite(m - 1) - a0 + 1) * W;
      const len = lenAt(m, rowH * 1.02);
      bars.push({ midi: m, sharp: true, cx, w: W * 0.86, len, cy: backTop + rowH * 0.56 });
    } else {
      const cx = (absWhite(m) - a0 + 0.5) * W;
      const len = lenAt(m, rowH * 1.05);
      bars.push({ midi: m, sharp: false, cx, w: W * 0.88, len, cy: frontTop + rowH * 0.46 });
    }
  }
  return {
    lo,
    hi,
    W,
    totalW,
    H,
    backTop,
    backBottom,
    frontTop,
    frontBottom,
    bars,
    byMidi: new Map(bars.map(b => [b.midi, b])),
    scrollable,
    r: clamp(W * 0.3, 6, 14),
    labelFs: clamp(W * 0.32, 7.5, 12.5),
  };
}

interface BarProps {
  g: BarGeo;
  id: string;
  metal: boolean;
  press: MarkColor | null;
  mark: KeyMark | null;
  dim: boolean;
  label: string | null;
  r: number;
  labelFs: number;
}

const Bar = memo(function Bar({ g, id, metal, press, mark, dim, label, r, labelFs }: BarProps) {
  const x = g.cx - g.w / 2;
  const y = g.cy - g.len / 2;
  const rx = Math.min(g.w * 0.22, 6);
  const node1 = y + g.len * 0.224;
  const node2 = y + g.len * 0.776;
  const markColor = mark ? (mark.color ?? 'gold') : null;
  const text = mark ? (mark.label ?? (mark.finger != null ? String(mark.finger) : '')) : '';
  const markY = g.cy - g.len * 0.06;
  return (
    <g className={`mk-bar${press ? ` is-down ins-c-${press}` : ''}${g.sharp ? ' is-sharp' : ''}${dim ? ' is-dim' : ''}`}>
      <rect x={x + 1.2} y={y + 2.2} width={g.w} height={g.len} rx={rx} className="mk-bar-shadow" />
      <rect x={x} y={y} width={g.w} height={g.len} rx={rx} fill={`url(#${id}-${metal ? 'metal' : 'wood'}${g.sharp ? '-dark' : ''})`} />
      {!metal && <rect x={x} y={y} width={g.w} height={g.len} rx={rx} fill="#000" filter={`url(#${id}-grain)`} opacity={0.5} />}
      <rect x={x} y={y} width={g.w} height={g.len} rx={rx} fill={`url(#${id}-bevel)`} />
      {/* support cord through the nodal points */}
      <circle cx={g.cx} cy={node1} r={Math.max(1.2, g.w * 0.05)} className="mk-pin" />
      <circle cx={g.cx} cy={node2} r={Math.max(1.2, g.w * 0.05)} className="mk-pin" />
      {markColor && !press && <rect x={x} y={y} width={g.w} height={g.len} rx={rx} fill={`url(#${id}-wash-${markColor})`} className="mk-tint" />}
      {press && <rect x={x - 1} y={y - 1} width={g.w + 2} height={g.len + 2} rx={rx + 1} className="mk-press" />}
      {dim && <rect x={x} y={y} width={g.w} height={g.len} rx={rx} className="mk-dim" />}
      {label && (
        <text x={g.cx} y={y + g.len - Math.max(6, g.w * 0.22)} className="mk-label" fontSize={labelFs}>
          {label}
        </text>
      )}
      {markColor && (
        <g className={`mk-mark ins-c-${markColor}${mark?.pulse ? ' ins-pulse' : ''}`}>
          <circle className="ins-halo" cx={g.cx} cy={markY} r={r * 2.2} fill={`url(#${id}-halo-${markColor})`} />
          <g className="ins-body">
            <circle cx={g.cx} cy={markY} r={r} className="mk-mark-body" />
            <ellipse cx={g.cx} cy={markY - r * 0.42} rx={r * 0.7} ry={r * 0.44} fill={`url(#${id}-shine)`} />
            {text && (
              <text x={g.cx} y={markY} dy="0.36em" className="mk-mark-text" fontSize={clamp(r * (text.length > 1 ? 0.9 : 1.1), 7, 15)}>
                {text}
              </text>
            )}
          </g>
        </g>
      )}
    </g>
  );
});

const Frame = memo(function Frame({ lay, id, metal }: { lay: Layout; id: string; metal: boolean }) {
  // rails under each row, following the bars' nodal lines (they converge toward the treble)
  const rail = (row: 'front' | 'back', which: 0 | 1) => {
    const bars = lay.bars.filter(b => b.sharp === (row === 'back'));
    if (!bars.length) return null;
    const pts = bars.map(b => `${b.cx},${b.cy - b.len / 2 + b.len * (which ? 0.776 : 0.224)}`);
    const first = bars[0];
    const last = bars[bars.length - 1];
    const start = `${Math.max(0, first.cx - lay.W)},${first.cy - first.len / 2 + first.len * (which ? 0.776 : 0.224)}`;
    const end = `${Math.min(lay.totalW, last.cx + lay.W)},${last.cy - last.len / 2 + last.len * (which ? 0.776 : 0.224)}`;
    return <polyline key={`${row}${which}`} points={[start, ...pts, end].join(' ')} className="mk-rail" />;
  };
  return (
    <g className="mk-frame">
      <rect x={0} y={0} width={lay.totalW} height={lay.H} fill={`url(#${id}-bed)`} />
      {/* resonator mouths peeking out under the front row */}
      {lay.bars
        .filter(b => !b.sharp)
        .map(b => (
          <ellipse key={b.midi} cx={b.cx} cy={b.cy + b.len / 2 + 2} rx={b.w * 0.36} ry={Math.max(2, lay.W * 0.09)} className={`mk-tube${metal ? ' is-metal' : ''}`} />
        ))}
      {rail('back', 0)}
      {rail('back', 1)}
      {rail('front', 0)}
      {rail('front', 1)}
    </g>
  );
});

const EMPTY: ReadonlySet<number> = new Set<number>();

export function MalletKeyboard({
  low,
  high,
  metal = false,
  pressed,
  pressedColor,
  marks,
  showLabels = 'c-only',
  naming = 'letter',
  dimOutside,
  interactive = true,
  onKeyDown,
  onKeyUp,
  focus,
  minBarWidth,
  height,
  ariaLabel = 'Mallet keyboard',
  className,
}: MalletKeyboardProps) {
  const id = useSvgId('mk');
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerW = useElementWidth(rootRef);
  const minW = minBarWidth ?? (isCoarsePointer() ? 30 : 22);
  const lay = useMemo(() => computeLayout(low, high, containerW, minW, height), [low, high, containerW, minW, height]);

  // ---- pointer interaction ----
  const [touched, setTouched] = useState<ReadonlySet<number>>(EMPTY);
  const pointers = useRef(new Map<number, number | null>());
  const callbacks = useRef({ onKeyDown, onKeyUp });
  useLayoutEffect(() => {
    callbacks.current = { onKeyDown, onKeyUp };
  });
  const sync = useCallback(() => {
    const s = new Set<number>();
    for (const m of pointers.current.values()) if (m != null) s.add(m);
    setTouched(s.size ? s : EMPTY);
  }, []);
  const rectRef = useRef<{ left: number; top: number } | null>(null);
  const hitTest = useCallback(
    (clientX: number, clientY: number): { midi: number; velocity: number } | null => {
      const rect = rectRef.current;
      if (!rect) return null;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || x > lay.totalW || y < 0 || y > lay.H) return null;
      const row = y < (lay.backBottom + lay.frontTop) / 2 ? 'back' : 'front';
      let best: BarGeo | null = null;
      for (const b of lay.bars) {
        if (b.sharp !== (row === 'back')) continue;
        if (Math.abs(x - b.cx) <= b.w / 2 + 1) {
          best = b;
          break;
        }
      }
      if (!best) return null;
      // striking near the centre of the bar is a fuller sound
      const off = Math.abs(y - best.cy) / (best.len / 2);
      return { midi: best.midi, velocity: clamp(0.85 - off * 0.35, 0.35, 0.9) };
    },
    [lay],
  );
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* best-effort */
    }
    const r = svgRef.current?.getBoundingClientRect();
    if (r) rectRef.current = { left: r.left, top: r.top };
    const hit = hitTest(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId);
    if (prev != null) callbacks.current.onKeyUp?.(prev);
    pointers.current.set(e.pointerId, hit?.midi ?? null);
    if (hit) callbacks.current.onKeyDown?.(hit.midi, hit.velocity);
    sync();
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    const hit = hitTest(e.clientX, e.clientY);
    const next = hit?.midi ?? null;
    if (next === prev) return;
    if (prev != null) callbacks.current.onKeyUp?.(prev);
    if (hit) callbacks.current.onKeyDown?.(hit.midi, hit.velocity);
    pointers.current.set(e.pointerId, next);
    sync();
  };
  const endPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    pointers.current.delete(e.pointerId);
    if (prev != null) callbacks.current.onKeyUp?.(prev);
    sync();
  };
  const releaseAll = useCallback(() => {
    const held = [...pointers.current.values()];
    pointers.current.clear();
    for (const m of held) if (m != null) callbacks.current.onKeyUp?.(m);
    sync();
  }, [sync]);
  useEffect(() => {
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  // ---- keep the focus note in view ----
  const didInitialScroll = useRef(false);
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || !lay.scrollable) return;
    const first = !didInitialScroll.current;
    if (focus == null && !first) return;
    const target = clamp(Math.round(focus ?? 72), lay.lo, lay.hi);
    const g = lay.byMidi.get(target) ?? lay.byMidi.get(target - 1);
    if (!g) return;
    const left = clamp(g.cx - sc.clientWidth / 2, 0, Math.max(0, lay.totalW - sc.clientWidth));
    didInitialScroll.current = true;
    if (first || typeof sc.scrollTo !== 'function') sc.scrollLeft = left;
    else sc.scrollTo({ left, behavior: 'smooth' });
  }, [focus, lay]);

  const markMap = useMemo(() => {
    const m = new Map<number, KeyMark>();
    for (const mk of marks ?? []) m.set(Math.round(mk.midi), mk);
    return m;
  }, [marks]);

  const labelOf = (m: number): string | null => {
    if (showLabels === 'none') return null;
    const sharp = isBlackKey(m);
    const p = spellMidi(m, 0);
    if (showLabels === 'c-only') return !sharp && p.step === 'C' ? stepLabel('C', 0, naming) + p.octave : null;
    if (sharp && showLabels !== 'all') return null;
    return stepLabel(p.step, p.alter, naming);
  };

  return (
    <div ref={rootRef} className={`mk${interactive ? ' is-interactive' : ''}${lay.scrollable ? ' is-scrollable' : ''}${className ? ' ' + className : ''}`}>
      <div ref={scrollerRef} className="mk-scroller">
        <svg
          ref={svgRef}
          className="mk-svg"
          width={lay.totalW}
          height={lay.H}
          viewBox={`0 0 ${lay.totalW} ${lay.H}`}
          role="group"
          aria-label={ariaLabel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
          onContextMenu={e => e.preventDefault()}
        >
          <defs>
            <ColorDefs id={id} />
            <linearGradient id={`${id}-bed`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#14100c" />
              <stop offset="1" stopColor="#0b0907" />
            </linearGradient>
            <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#6b2f1a" />
              <stop offset="0.25" stopColor="#a14d2a" />
              <stop offset="0.6" stopColor="#8e3f22" />
              <stop offset="1" stopColor="#5a2614" />
            </linearGradient>
            <linearGradient id={`${id}-wood-dark`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5a2615" />
              <stop offset="0.25" stopColor="#8b4123" />
              <stop offset="0.6" stopColor="#7a361d" />
              <stop offset="1" stopColor="#4a1f10" />
            </linearGradient>
            <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8e949c" />
              <stop offset="0.3" stopColor="#eef1f4" />
              <stop offset="0.55" stopColor="#c6ccd3" />
              <stop offset="1" stopColor="#7d838b" />
            </linearGradient>
            <linearGradient id={`${id}-metal-dark`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7c828a" />
              <stop offset="0.3" stopColor="#dde1e6" />
              <stop offset="0.55" stopColor="#b2b8c0" />
              <stop offset="1" stopColor="#6c727a" />
            </linearGradient>
            <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="0.08" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.9" stopColor="#000000" stopOpacity="0" />
              <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
            </linearGradient>
            <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9 0.012" numOctaves={3} seed={7} result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 -2.2 1.3" />
              <feComposite in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
          <Frame lay={lay} id={id} metal={metal} />
          {lay.bars.map(g => {
            const down = !!(pressed?.has(g.midi) || touched.has(g.midi));
            return (
              <Bar
                key={g.midi}
                g={g}
                id={id}
                metal={metal}
                press={down ? (pressedColor?.(g.midi) ?? 'gold') : null}
                mark={markMap.get(g.midi) ?? null}
                dim={!!dimOutside && (g.midi < Math.min(...dimOutside) || g.midi > Math.max(...dimOutside))}
                label={labelOf(g.midi)}
                r={lay.r}
                labelFs={lay.labelFs}
              />
            );
          })}
        </svg>
        {lay.scrollable && <div className="mk-pan" style={{ width: lay.totalW }} aria-hidden="true" />}
      </div>
    </div>
  );
}

export default MalletKeyboard;
