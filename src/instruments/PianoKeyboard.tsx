/**
 * PianoKeyboard — an accurate, touch-first SVG piano.
 *
 * Geometry follows a real keyboard: white keys 23.5mm × 150mm, black keys
 * 13.7mm wide and ~63% of the white key length. Black keys are placed the way
 * real keys are cut: the C–E group divides three white keys into five equal
 * slots and the F–B group divides four white keys into seven, so C♯/D♯ lean
 * outwards and F♯/A♯ lean away from a centred G♯.
 *
 * Rendering is split into memoised layers so a change of the `pressed` set only
 * re-renders the handful of keys whose state actually changed.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { isBlackKey, spellMidi, stepLabel } from '../music/pitch';
import type { NoteNaming } from '../music/pitch';
import { clamp, ColorDefs, isCoarsePointer, roundedBottomRect, useElementWidth, useSvgId } from './common';
import type { MarkColor } from './common';
import './PianoKeyboard.css';

export type { MarkColor } from './common';

export interface KeyMark {
  midi: number;
  color?: MarkColor;
  /** Finger number 1–5, drawn inside the mark. */
  finger?: number;
  /** Short text drawn inside the mark (or under it when a finger is also given). */
  label?: string;
  /** Gentle breathing glow. */
  pulse?: boolean;
}

export type KeyLabelMode = 'none' | 'c-only' | 'white' | 'all';

export interface PianoKeyboardProps {
  /** Lowest MIDI note to show (snapped down to a white key). */
  low: number;
  /** Highest MIDI note to show (snapped up to a white key). */
  high: number;
  /** Notes physically held right now (MIDI / mic / touch). */
  pressed?: ReadonlySet<number>;
  /** Colour for a pressed key (e.g. good / bad feedback). Default gold. */
  pressedColor?: (midi: number) => MarkColor | undefined;
  /** Targets / hints with optional finger numbers. */
  marks?: KeyMark[];
  showLabels?: KeyLabelMode;
  naming?: NoteNaming;
  /** De-emphasise keys outside this inclusive MIDI range. */
  dimOutside?: [number, number];
  /** Default true. */
  interactive?: boolean;
  onKeyDown?: (midi: number, velocity: number) => void;
  onKeyUp?: (midi: number) => void;
  /** When the keyboard is wider than its container, keep this note centred. */
  focus?: number;
  /** Default 34px on touch devices, 24px with a mouse. */
  minWhiteKeyWidth?: number;
  /** Explicit total height in px (key slip + keys). */
  height?: number;
  /** Draw a tiny gold dot on middle C. */
  markMiddleC?: boolean;
  ariaLabel?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const WHITE_STEP = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6];
/** Black-key centres in white-key widths from the C that starts the octave. */
const BLACK_CENTER: Record<number, number> = {
  1: 1.5 * (3 / 5),
  3: 3.5 * (3 / 5),
  6: 3 + 1.5 * (4 / 7),
  8: 3 + 3.5 * (4 / 7),
  10: 3 + 5.5 * (4 / 7),
};
const WHITE_ASPECT = 150 / 23.5;
const BLACK_WIDTH = 13.7 / 23.5;
const BLACK_LENGTH = 0.635;
const MAX_HEIGHT = 220;
const MIDDLE_C = 60;

const pc12 = (m: number) => ((m % 12) + 12) % 12;
const absWhite = (m: number) => Math.floor(m / 12) * 7 + WHITE_STEP[pc12(m)];

interface KeyGeo {
  midi: number;
  black: boolean;
  x: number;
  w: number;
}

interface Layout {
  lo: number;
  hi: number;
  W: number;
  BW: number;
  L: number;
  BL: number;
  strip: number;
  lip: number;
  lipDown: number;
  gap: number;
  rad: number;
  totalW: number;
  H: number;
  /** Wider than the container: the key slip becomes a pan handle. */
  scrollable: boolean;
  labelFs: number;
  rW: number;
  rB: number;
  whites: KeyGeo[];
  blacks: KeyGeo[];
  byMidi: Map<number, KeyGeo>;
}

function snapRange(low: number, high: number): [number, number] {
  let lo = Math.round(Math.min(low, high));
  let hi = Math.round(Math.max(low, high));
  if (isBlackKey(lo)) lo -= 1;
  if (isBlackKey(hi)) hi += 1;
  return [lo, hi];
}

function computeLayout(low: number, high: number, containerW: number, minW: number, height?: number): Layout {
  const [lo, hi] = snapRange(low, high);
  const a0 = absWhite(lo);
  const nWhite = absWhite(hi) - a0 + 1;
  const W = containerW > 0 ? Math.max(minW, containerW / nWhite) : minW;
  const totalW = W * nWhite;
  const scrollable = containerW > 0 && totalW > containerW + 0.5;

  let strip: number;
  let L: number;
  if (height && height > 40) {
    strip = clamp(height * 0.065, 7, 14);
    L = height - strip;
  } else {
    const natural = W * WHITE_ASPECT;
    strip = clamp(natural * 0.065, 7, 14);
    L = clamp(natural, 56, MAX_HEIGHT - strip);
  }
  if (scrollable) strip = Math.max(strip, 16);
  const BW = W * BLACK_WIDTH;
  const BL = L * BLACK_LENGTH;

  const whites: KeyGeo[] = [];
  const blacks: KeyGeo[] = [];
  const byMidi = new Map<number, KeyGeo>();
  for (let m = lo; m <= hi; m++) {
    let g: KeyGeo;
    if (isBlackKey(m)) {
      const pc = pc12(m);
      const cx = (absWhite(m - pc) - a0 + BLACK_CENTER[pc]) * W;
      g = { midi: m, black: true, x: cx - BW / 2, w: BW };
      blacks.push(g);
    } else {
      g = { midi: m, black: false, x: (absWhite(m) - a0) * W, w: W };
      whites.push(g);
    }
    byMidi.set(m, g);
  }

  return {
    lo,
    hi,
    W,
    BW,
    L,
    BL,
    strip,
    lip: clamp(L * 0.036, 3, 8),
    lipDown: clamp(L * 0.012, 1.2, 3),
    gap: clamp(W * 0.04, 0.8, 1.6),
    rad: clamp(W * 0.09, 1.5, 4.5),
    totalW,
    H: strip + L,
    scrollable,
    labelFs: clamp(W * 0.33, 7.5, 13),
    rW: clamp(W * 0.31, 5.5, 15),
    rB: clamp(BW * 0.4, 4.5, 12),
    whites,
    blacks,
    byMidi,
  };
}

// ---------------------------------------------------------------------------
// Static layers
// ---------------------------------------------------------------------------

const KeyboardDefs = memo(function KeyboardDefs({ id }: { id: string }) {
  return (
    <defs>
      <ColorDefs id={id} />
      {/* Ivory: warm, faintly shaded under the key slip, brightest mid-key. */}
      <linearGradient id={`${id}-ivory`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9d1c1" />
        <stop offset="0.07" stopColor="#f1ece1" />
        <stop offset="0.45" stopColor="#fbf9f3" />
        <stop offset="0.85" stopColor="#f8f4ec" />
        <stop offset="1" stopColor="#efe9dd" />
      </linearGradient>
      <linearGradient id={`${id}-ivory-down`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bdb4a3" />
        <stop offset="0.12" stopColor="#e2dccf" />
        <stop offset="0.6" stopColor="#efebe2" />
        <stop offset="1" stopColor="#e6e0d3" />
      </linearGradient>
      {/* Bevel: a lit left edge and a softly shaded right edge on every white key. */}
      <linearGradient id={`${id}-ivory-edge`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="0.07" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.86" stopColor="#5a4a30" stopOpacity="0" />
        <stop offset="1" stopColor="#5a4a30" stopOpacity="0.16" />
      </linearGradient>
      {/* A depressed key sits below its neighbours: they shade its sides. */}
      <linearGradient id={`${id}-down-sides`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2a1d0c" stopOpacity="0.28" />
        <stop offset="0.16" stopColor="#2a1d0c" stopOpacity="0" />
        <stop offset="0.84" stopColor="#2a1d0c" stopOpacity="0" />
        <stop offset="1" stopColor="#2a1d0c" stopOpacity="0.28" />
      </linearGradient>
      <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e7e0d1" />
        <stop offset="0.35" stopColor="#d3cab6" />
        <stop offset="1" stopColor="#b3a88f" />
      </linearGradient>
      {/* Ebony */}
      <linearGradient id={`${id}-eb-body`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#060607" />
        <stop offset="0.07" stopColor="#34343c" />
        <stop offset="0.16" stopColor="#0d0d10" />
        <stop offset="0.84" stopColor="#0b0b0e" />
        <stop offset="0.93" stopColor="#202026" />
        <stop offset="1" stopColor="#040405" />
      </linearGradient>
      <linearGradient id={`${id}-eb-top`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#09090b" />
        <stop offset="0.55" stopColor="#17171c" />
        <stop offset="0.92" stopColor="#25252d" />
        <stop offset="1" stopColor="#2e2e37" />
      </linearGradient>
      <linearGradient id={`${id}-eb-front`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4a55" />
        <stop offset="0.25" stopColor="#24242b" />
        <stop offset="1" stopColor="#060607" />
      </linearGradient>
      <linearGradient id={`${id}-eb-shine`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.07" />
        <stop offset="0.92" stopColor="#ffffff" stopOpacity="0.2" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
      </linearGradient>
      <linearGradient id={`${id}-bk-shadow`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1b1206" stopOpacity="0.42" />
        <stop offset="0.8" stopColor="#1b1206" stopOpacity="0.22" />
        <stop offset="1" stopColor="#1b1206" stopOpacity="0" />
      </linearGradient>
      {/* Key slip: dark polished wood with a red felt strip and a gold hairline. */}
      <linearGradient id={`${id}-slip`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2d2019" />
        <stop offset="0.2" stopColor="#1c130e" />
        <stop offset="1" stopColor="#0e0907" />
      </linearGradient>
      <linearGradient id={`${id}-felt`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a3283a" />
        <stop offset="1" stopColor="#5e1220" />
      </linearGradient>
      <linearGradient id={`${id}-slip-shadow`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0b0603" stopOpacity="0.5" />
        <stop offset="0.35" stopColor="#0b0603" stopOpacity="0.16" />
        <stop offset="1" stopColor="#0b0603" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
});

const BlackShadows = memo(function BlackShadows({ lay, id }: { lay: Layout; id: string }) {
  const { BW, BL, strip } = lay;
  const dx = BW * 0.14;
  return (
    <g className="pk-noptr" fill={`url(#${id}-bk-shadow)`}>
      {lay.blacks.map(g => (
        <path key={g.midi} d={roundedBottomRect(g.x + dx * 0.4, strip, BW + dx, BL + lay.L * 0.035, BW * 0.3)} />
      ))}
    </g>
  );
});

const KeySlip = memo(function KeySlip({ lay, id }: { lay: Layout; id: string }) {
  const { strip, totalW, L } = lay;
  return (
    <g className="pk-noptr">
      <rect x={0} y={strip} width={totalW} height={Math.min(L * 0.08, 18)} fill={`url(#${id}-slip-shadow)`} />
      <rect x={0} y={0} width={totalW} height={strip} fill={`url(#${id}-slip)`} />
      <rect x={0} y={0} width={totalW} height={0.8} fill="#ffffff" opacity={0.07} />
      <rect x={0} y={strip - 2.6} width={totalW} height={2.6} fill={`url(#${id}-felt)`} />
      <rect x={0} y={strip - 3} width={totalW} height={0.6} fill="#e3b866" opacity={0.75} />
      {lay.scrollable && <SlipGrips lay={lay} />}
    </g>
  );
});

/** Subtle knurled grips (one per octave) hint that the key slip can be dragged. */
function SlipGrips({ lay }: { lay: Layout }) {
  const out: ReactElement[] = [];
  const y = (lay.strip - 3) / 2;
  for (const g of lay.whites) {
    if (pc12(g.midi) !== 5) continue; // centred on the F|G boundary, mid-octave
    const cx = g.x + lay.W;
    for (let i = -2; i <= 2; i++) {
      out.push(<rect key={`${g.midi}:${i}`} x={cx + i * 3 - 0.5} y={y - 2.5} width={1} height={5} rx={0.5} fill="#ffffff" opacity={0.09} />);
    }
  }
  return <>{out}</>;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

interface KeyProps {
  g: KeyGeo;
  lay: Layout;
  id: string;
  press: MarkColor | null;
  markColor: MarkColor | null;
  markText: string;
  markSub: string;
  markPulse: boolean;
  dim: boolean;
  label: string | null;
  label2: string | null;
  emph: boolean;
  midDot: boolean;
}

/**
 * Press visual state for one key. The colour wash is only mounted while the key
 * is down or fading out after release (idle keys carry no extra paint layers),
 * and it fades out in the colour it was pressed with.
 */
function usePressWash(press: MarkColor | null): { color: MarkColor; mounted: boolean } {
  const [last, setLast] = useState<MarkColor>(press ?? 'gold');
  const [prev, setPrev] = useState<MarkColor | null>(press);
  const [fading, setFading] = useState(false);
  if (press !== prev) {
    setPrev(press);
    if (press) {
      if (press !== last) setLast(press);
      if (fading) setFading(false);
    } else if (prev) {
      setFading(true);
    }
  }
  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => setFading(false), 420);
    return () => window.clearTimeout(t);
  }, [fading]);
  return { color: press ?? last, mounted: !!press || fading };
}

function MarkDot(props: {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: MarkColor;
  text: string;
  sub: string;
  pulse: boolean;
  onBlack: boolean;
}) {
  const { id, cx, cy, r, color, text, sub, pulse, onBlack } = props;
  const fs = clamp(r * (text.length > 1 ? 0.95 : 1.12), 6.5, 15);
  const pill = text.length > 2;
  const w = pill ? r * 2 + (text.length - 2) * fs * 0.6 : r * 2;
  return (
    <g className={`pk-mark ins-c-${color}${pulse ? ' ins-pulse' : ''}${onBlack ? ' on-black' : ''}`}>
      <ellipse className="ins-halo" cx={cx} cy={cy} rx={w / 2 + r * 1.25} ry={r * 2.25} fill={`url(#${id}-halo-${color})`} />
      <g className="ins-body">
        {!onBlack && <rect x={cx - w / 2} y={cy - r + 1} width={w} height={r * 2} rx={r} className="pk-mark-shadow" />}
        <rect x={cx - w / 2} y={cy - r} width={w} height={r * 2} rx={r} className="pk-mark-body" />
        <rect
          x={cx - w / 2 + r * 0.3}
          y={cy - r + r * 0.14}
          width={w - r * 0.6}
          height={r * 0.9}
          rx={r * 0.45}
          fill={`url(#${id}-shine)`}
          className="pk-mark-shine"
        />
        {text && (
          <text x={cx} y={cy} dy="0.36em" className="pk-mark-text" fontSize={fs}>
            {text}
          </text>
        )}
      </g>
      {sub && (
        <text x={cx} y={cy - r - 3} className="pk-mark-sub" fontSize={clamp(r * 0.8, 7, 11)}>
          {sub}
        </text>
      )}
    </g>
  );
}

const WhiteKey = memo(function WhiteKey(p: KeyProps) {
  const { g, lay, id, press } = p;
  const wash = usePressWash(press);
  const { W, L, gap, rad, labelFs, rW } = lay;
  const kx = gap / 2;
  const kw = W - gap;
  const lip = press ? lay.lipDown : lay.lip;
  const body = roundedBottomRect(kx, -4, kw, L + 4, rad);
  const lipTop = L - lip;
  const cx = W / 2;
  const labelY = L - lay.lip - Math.max(4.5, W * 0.17);
  const hasLabel = !!p.label;
  const dotCy = hasLabel ? labelY - labelFs - rW - 1 : L - lay.lip - rW - Math.max(4, W * 0.2);

  return (
    <g
      className={`pk-key pk-white${press ? ' is-down' : ''}${press === 'bad' ? ' is-bad' : ''}`}
      transform={`translate(${g.x} ${lay.strip})`}
    >
      <g className="pk-travel">
        <path d={body} fill={`url(#${id}-ivory${press ? '-down' : ''})`} />
        <path d={body} fill={`url(#${id}-ivory-edge)`} />
        {press && <path d={body} fill={`url(#${id}-down-sides)`} />}
        <path d={roundedBottomRect(kx, lipTop, kw, lip, rad)} fill={`url(#${id}-lip)`} />
        <rect x={kx + 0.6} y={lipTop - 0.5} width={kw - 1.2} height={0.9} fill="#fffdf8" />
        {p.markColor && !press && <path d={body} fill={`url(#${id}-wash-${p.markColor})`} className="pk-tint" />}
        {wash.mounted && (
          <path d={body} fill={`url(#${id}-wash-${wash.color})`} className="pk-wash" style={{ opacity: press ? 1 : 0 }} />
        )}
        {press && (
          <g className={`ins-c-${press}`}>
            <path d={roundedBottomRect(kx + 0.9, -4, kw - 1.8, L + 3.1, rad)} className="pk-press-edge" />
            <path d={roundedBottomRect(kx, lipTop, kw, lip, rad)} className="pk-lip-glow" />
          </g>
        )}
        {p.dim && <path d={body} className="pk-dim" />}
      </g>
      {p.midDot && (
        <circle cx={cx} cy={L - lay.lip - Math.max(2.4, W * 0.075)} r={Math.max(1.4, W * 0.05)} className="pk-midc-dot" />
      )}
      {hasLabel && (
        <text
          x={cx}
          y={labelY}
          className={`pk-label${p.emph ? ' is-emph' : ''}${p.dim ? ' is-dim' : ''}`}
          fontSize={p.emph ? labelFs * 1.06 : labelFs}
        >
          {p.label}
        </text>
      )}
      {p.markColor && (
        <MarkDot
          id={id}
          cx={cx}
          cy={dotCy}
          r={rW}
          color={p.markColor}
          text={p.markText}
          sub={p.markSub}
          pulse={p.markPulse}
          onBlack={false}
        />
      )}
    </g>
  );
});

const BlackKey = memo(function BlackKey(p: KeyProps) {
  const { g, lay, id, press } = p;
  const wash = usePressWash(press);
  const { BW, BL, rB, labelFs } = lay;
  const inset = BW * 0.1;
  const front = press ? BL * 0.035 : BL * 0.085;
  const topH = BL - front;
  const r = Math.min(BW * 0.14, 3);
  const top = `M${inset},-4H${BW - inset}V${topH - r}Q${BW - inset},${topH} ${BW - inset - r},${topH}H${inset + r}Q${inset},${topH} ${inset},${topH - r}Z`;
  const cx = BW / 2;
  const fs = labelFs * 0.86;
  const hasLabel = !!p.label;
  const labelY = topH - Math.max(3.5, BW * 0.2);
  const labelBlock = hasLabel ? fs * (p.label2 ? 2.15 : 1.1) : 0;
  const dotCy = topH - labelBlock - rB - Math.max(3, BW * 0.18);

  return (
    <g
      className={`pk-key pk-black${press ? ' is-down' : ''}${press === 'bad' ? ' is-bad' : ''}`}
      transform={`translate(${g.x} ${lay.strip})`}
    >
      <g className="pk-travel">
        <path d={roundedBottomRect(0, -4, BW, BL + 4, r * 1.2)} fill={`url(#${id}-eb-body)`} />
        <path d={roundedBottomRect(inset * 0.5, topH - 1, BW - inset, front + 0.5, r)} fill={`url(#${id}-eb-front)`} />
        <path d={top} fill={`url(#${id}-eb-top)`} />
        <rect
          x={inset + (BW - 2 * inset) * 0.16}
          y={BL * 0.06}
          width={(BW - 2 * inset) * 0.2}
          height={topH - BL * 0.1}
          rx={(BW - 2 * inset) * 0.1}
          fill={`url(#${id}-eb-shine)`}
        />
        <rect x={inset + 0.8} y={topH - 0.9} width={BW - 2 * inset - 1.6} height={0.8} fill="#ffffff" opacity={press ? 0.1 : 0.28} />
        {p.markColor && !press && <path d={top} fill={`url(#${id}-wash-${p.markColor})`} className="pk-tint on-black" />}
        {wash.mounted && (
          <path d={top} fill={`url(#${id}-wash-${wash.color})`} className="pk-wash on-black" style={{ opacity: press ? 1 : 0 }} />
        )}
        {press && <path d={top} className={`pk-press-edge on-black ins-c-${press}`} />}
        {p.dim && <path d={roundedBottomRect(0, -4, BW, BL + 4, r * 1.2)} className="pk-dim on-black" />}
      </g>
      {hasLabel && (
        <text x={cx} y={labelY - (p.label2 ? fs * 1.05 : 0)} className="pk-label on-black" fontSize={fs}>
          {p.label}
        </text>
      )}
      {hasLabel && p.label2 && (
        <text x={cx} y={labelY} className="pk-label on-black is-alt" fontSize={fs}>
          {p.label2}
        </text>
      )}
      {p.markColor && (
        <MarkDot
          id={id}
          cx={cx}
          cy={dotCy}
          r={rB}
          color={p.markColor}
          text={p.markText}
          sub={p.markSub}
          pulse={p.markPulse}
          onBlack
        />
      )}
    </g>
  );
});

/** Light that blooms from a struck key and the "LED" glow it throws on the felt. */
const PressFx = memo(function PressFx({ g, lay, id, color }: { g: KeyGeo; lay: Layout; id: string; color: MarkColor }) {
  const keyLen = g.black ? lay.BL : lay.L;
  const cx = g.x + g.w / 2;
  return (
    <g className={`pk-fx ins-c-${color}`}>
      <ellipse
        className="pk-bloom"
        cx={cx}
        cy={lay.strip + keyLen * 0.7}
        rx={g.w * 1.25}
        ry={keyLen * 0.5}
        fill={`url(#${id}-halo-${color})`}
      />
      <ellipse className="pk-felt-glow" cx={cx} cy={lay.strip - 1.5} rx={g.w * 1.1} ry={Math.max(lay.strip, 9)} fill={`url(#${id}-halo-${color})`} />
      <rect className="pk-felt-led" x={g.x + 1.5} y={lay.strip - 2.6} width={Math.max(1, g.w - 3)} height={2.6} rx={1.3} />
    </g>
  );
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

interface LabelInfo {
  label: string | null;
  label2: string | null;
  emph: boolean;
}

function labelFor(midi: number, mode: KeyLabelMode, naming: NoteNaming, roomForTwo: boolean): LabelInfo {
  const none: LabelInfo = { label: null, label2: null, emph: false };
  if (mode === 'none') return none;
  const black = isBlackKey(midi);
  const p = spellMidi(midi, 0);
  const isC = !black && p.step === 'C';
  if (mode === 'c-only') {
    if (!isC) return none;
    return { label: stepLabel('C', 0, naming) + p.octave, label2: null, emph: midi === MIDDLE_C };
  }
  if (black) {
    if (mode !== 'all') return none;
    const flat = spellMidi(midi, -1);
    return {
      label: stepLabel(p.step, p.alter, naming),
      label2: roomForTwo ? stepLabel(flat.step, flat.alter, naming) : null,
      emph: false,
    };
  }
  return {
    label: stepLabel(p.step, p.alter, naming) + (isC ? String(p.octave) : ''),
    label2: null,
    emph: midi === MIDDLE_C,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EMPTY_SET: ReadonlySet<number> = new Set<number>();

interface Hit {
  midi: number;
  velocity: number;
}

export function PianoKeyboard({
  low,
  high,
  pressed,
  pressedColor,
  marks,
  showLabels = 'none',
  naming = 'letter',
  dimOutside,
  interactive = true,
  onKeyDown,
  onKeyUp,
  focus,
  minWhiteKeyWidth,
  height,
  markMiddleC = false,
  ariaLabel = 'Piano keyboard',
  className,
}: PianoKeyboardProps) {
  const id = useSvgId('pk');
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerW = useElementWidth(rootRef);
  const minW = minWhiteKeyWidth ?? (isCoarsePointer() ? 34 : 24);

  const lay = useMemo(() => computeLayout(low, high, containerW, minW, height), [low, high, containerW, minW, height]);
  const scrollable = lay.scrollable;

  // ---- Pointer interaction (multi-touch + glissando) ----------------------
  const [touched, setTouched] = useState<ReadonlySet<number>>(EMPTY_SET);
  const counts = useRef(new Map<number, number>());
  const pointers = useRef(new Map<number, number | null>());
  const callbacks = useRef({ onKeyDown, onKeyUp });
  useLayoutEffect(() => {
    callbacks.current = { onKeyDown, onKeyUp };
  });

  const syncTouched = useCallback(() => {
    setTouched(counts.current.size ? new Set(counts.current.keys()) : EMPTY_SET);
  }, []);

  const pressKey = useCallback((midi: number, velocity: number) => {
    const n = counts.current.get(midi) ?? 0;
    counts.current.set(midi, n + 1);
    if (n === 0) callbacks.current.onKeyDown?.(midi, velocity);
  }, []);

  const releaseKey = useCallback((midi: number) => {
    const n = counts.current.get(midi) ?? 0;
    if (n <= 1) {
      counts.current.delete(midi);
      if (n === 1) callbacks.current.onKeyUp?.(midi);
    } else {
      counts.current.set(midi, n - 1);
    }
  }, []);

  const releaseAll = useCallback(() => {
    if (!pointers.current.size && !counts.current.size) return;
    pointers.current.clear();
    const held = [...counts.current.keys()];
    counts.current.clear();
    for (const m of held) callbacks.current.onKeyUp?.(m);
    syncTouched();
  }, [syncTouched]);

  useEffect(() => {
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  useEffect(() => {
    if (!interactive) releaseAll();
  }, [interactive, releaseAll]);

  // The svg's page rect, read once per gesture (avoids a forced layout on every pointermove).
  const rectRef = useRef<{ left: number; top: number } | null>(null);
  const readRect = () => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    rectRef.current = { left: r.left, top: r.top };
    return rectRef.current;
  };

  const hitTest = useCallback(
    (clientX: number, clientY: number): Hit | null => {
      const rect = rectRef.current;
      if (!rect) return null;
      const x = clientX - rect.left;
      const y = clientY - rect.top - lay.strip;
      if (y < 0 || y > lay.L + 2 || x < 0 || x >= lay.totalW) return null;
      if (y <= lay.BL) {
        for (const g of lay.blacks) {
          if (x >= g.x && x <= g.x + g.w) {
            return { midi: g.midi, velocity: 0.35 + 0.65 * clamp(y / lay.BL, 0, 1) };
          }
        }
      }
      const idx = clamp(Math.floor(x / lay.W), 0, lay.whites.length - 1);
      return { midi: lay.whites[idx].midi, velocity: 0.35 + 0.65 * clamp(y / lay.L, 0, 1) };
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
      /* capture is best-effort */
    }
    readRect();
    const hit = hitTest(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId);
    if (prev != null) releaseKey(prev);
    pointers.current.set(e.pointerId, hit ? hit.midi : null);
    if (hit) pressKey(hit.midi, hit.velocity);
    syncTouched();
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    const hit = hitTest(e.clientX, e.clientY);
    const next = hit ? hit.midi : null;
    if (next === prev) return;
    if (prev !== null) releaseKey(prev);
    if (hit) pressKey(hit.midi, hit.velocity);
    pointers.current.set(e.pointerId, next);
    syncTouched();
  };

  const endPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    pointers.current.delete(e.pointerId);
    if (prev !== null) releaseKey(prev);
    syncTouched();
  };

  // ---- Scrolling: keep `focus` (or middle C) centred when we overflow ------
  const didInitialScroll = useRef(false);
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || !scrollable) return;
    const first = !didInitialScroll.current;
    if (focus == null && !first) return;
    let target = focus ?? MIDDLE_C;
    target = clamp(Math.round(target), lay.lo, lay.hi);
    const g = lay.byMidi.get(target);
    if (!g) return;
    const cx = g.x + g.w / 2;
    const left = clamp(cx - sc.clientWidth / 2, 0, Math.max(0, lay.totalW - sc.clientWidth));
    didInitialScroll.current = true;
    if (first || typeof sc.scrollTo !== 'function') sc.scrollLeft = left;
    else sc.scrollTo({ left, behavior: 'smooth' });
  }, [focus, scrollable, lay]);

  // ---- Per-key state ------------------------------------------------------
  const markMap = useMemo(() => {
    const m = new Map<number, KeyMark>();
    for (const mk of marks ?? []) m.set(Math.round(mk.midi), mk);
    return m;
  }, [marks]);

  const labels = useMemo(() => {
    const map = new Map<number, LabelInfo>();
    const roomForTwo = lay.BW >= 17;
    for (let m = lay.lo; m <= lay.hi; m++) map.set(m, labelFor(m, showLabels, naming, roomForTwo));
    return map;
  }, [lay, showLabels, naming]);

  const isDown = (m: number) => !!(pressed?.has(m) || touched.has(m));
  const colorOf = (m: number): MarkColor => pressedColor?.(m) ?? 'gold';

  const keyProps = (g: KeyGeo): KeyProps => {
    const mk = markMap.get(g.midi);
    const lab = labels.get(g.midi);
    const down = isDown(g.midi);
    const fingerText = mk?.finger != null ? String(mk.finger) : '';
    return {
      g,
      lay,
      id,
      press: down ? colorOf(g.midi) : null,
      markColor: mk ? (mk.color ?? 'gold') : null,
      markText: fingerText || mk?.label || '',
      markSub: fingerText && mk?.label ? mk.label : '',
      markPulse: !!mk?.pulse,
      dim: !!dimOutside && (g.midi < Math.min(...dimOutside) || g.midi > Math.max(...dimOutside)),
      label: lab?.label ?? null,
      label2: lab?.label2 ?? null,
      emph: !!lab?.emph,
      midDot: markMiddleC && g.midi === MIDDLE_C,
    };
  };

  const fx: { g: KeyGeo; color: MarkColor }[] = [];
  for (let m = lay.lo; m <= lay.hi; m++) {
    if (isDown(m)) fx.push({ g: lay.byMidi.get(m)!, color: colorOf(m) });
  }

  return (
    <div
      ref={rootRef}
      className={`pk${interactive ? ' is-interactive' : ''}${scrollable ? ' is-scrollable' : ''}${className ? ' ' + className : ''}`}
    >
      <div ref={scrollerRef} className="pk-scroller">
        <div className="pk-content" style={{ width: lay.totalW, height: lay.H }}>
          <svg
            ref={svgRef}
            className="pk-svg"
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
            <KeyboardDefs id={id} />
            <rect x={0} y={lay.strip} width={lay.totalW} height={lay.L} fill="#120d09" />
            {lay.whites.map(g => (
              <WhiteKey key={g.midi} {...keyProps(g)} />
            ))}
            <BlackShadows lay={lay} id={id} />
            {lay.blacks.map(g => (
              <BlackKey key={g.midi} {...keyProps(g)} />
            ))}
            <KeySlip lay={lay} id={id} />
            <g className="pk-noptr">
              {fx.map(f => (
                <PressFx key={f.g.midi} g={f.g} lay={lay} id={id} color={f.color} />
              ))}
            </g>
          </svg>
          {scrollable && <div className="pk-pan" style={{ height: lay.strip }} aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}

export default PianoKeyboard;
