/**
 * Fretboard — a fretted neck seen as in tablature (string 1 on top). Works for any
 * tuning and number of strings: guitar, ukulele (re-entrant or not) and 4/5-string bass.
 *
 * Fret spacing is real: the distance from the nut to fret n is proportional to
 * 1 − 2^(−n/12), rescaled so the requested window fills the width. The wood,
 * metal and strings live in a static, memoised SVG; marks, names and touch
 * feedback live in a light overlay SVG so interaction never repaints the wood.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { stepLabel } from '../music/pitch';
import type { NoteNaming } from '../music/pitch';
import { STANDARD_TUNING, midiAt, noteNameAt } from '../music/guitar';
import { INSTRUMENTS, type FrettedLook } from '../music/instruments';
import { clamp, ColorDefs, isCoarsePointer, useElementWidth, useSvgId } from './common';
import type { MarkColor } from './common';
import './Fretboard.css';

export interface FretMark {
  /** 1 = highest course (high E on a guitar) … N */
  string: number;
  fret: number;
  color?: MarkColor;
  label?: string;
  finger?: number;
  pulse?: boolean;
  /** Distinct root marker (rounded square with a halo ring). */
  root?: boolean;
  /** Faint outline for "pattern" context. */
  ghost?: boolean;
}

export interface FretPressed {
  string: number;
  fret: number;
  color?: MarkColor;
}

export type FretNoteNames = 'none' | 'marks' | 'all';

export interface FretboardProps {
  /** Open-string MIDI notes, string 1 first. Default: standard guitar. */
  tuning?: readonly number[];
  /** Strings, inlays and wood. Default: guitar (or derived from the tuning's string count). */
  look?: FrettedLook;
  /** Default 0. When > 0 the window starts at this fret and a position number replaces the nut. */
  minFret?: number;
  /** Default 12. */
  maxFret?: number;
  marks?: FretMark[];
  /** Currently touched / detected positions. */
  pressed?: FretPressed[];
  showNoteNames?: FretNoteNames;
  naming?: NoteNaming;
  preferFlats?: boolean;
  /** Mirror horizontally (nut on the right). Text stays readable. */
  leftHanded?: boolean;
  /** Shaded "hand position" window, inclusive fret numbers. */
  highlightFrets?: [number, number];
  /** Default true. */
  showFretNumbers?: boolean;
  /** Default true. */
  interactive?: boolean;
  onTap?: (pos: { string: number; fret: number }, midi: number) => void;
  onRelease?: (pos: { string: number; fret: number }) => void;
  /** Explicit total height in px; string spacing scales with it. Default derives from width. */
  height?: number;
  /**
   * Narrowest allowed fret cell before the neck scrolls. Default 34px on touch (a full 0–12 neck
   * still fits an iPad mini in portrait), 30px with a mouse.
   */
  minCellWidth?: number;
  ariaLabel?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const MAX_WINDOW_FRET = 24;

/** The look for a tuning when none is given: guitar, ukulele (4 nylon strings) or bass (5 heavy strings). */
function defaultLook(tuning: readonly number[]): FrettedLook {
  if (tuning.length === 6) return INSTRUMENTS.guitar.fretted!;
  if (tuning.length === 5 || Math.min(...tuning) < 40) return INSTRUMENTS.bass.fretted!;
  return INSTRUMENTS.ukulele.fretted!;
}

const distFromNut = (n: number) => 1 - Math.pow(2, -n / 12);

interface FbLayout {
  /** Number of strings. */
  n: number;
  minFret: number;
  maxFret: number;
  start: number;
  hasNut: boolean;
  s: number;
  y0: number;
  boardH: number;
  totalW: number;
  totalH: number;
  openW: number;
  nutW: number;
  leftW: number;
  leadIn: number;
  tailW: number;
  boardL: number;
  boardEnd: number;
  /** x of each fret wire, indexed by absolute fret number (NaN outside the window). */
  wx: number[];
  r: number;
  fw: number;
  gauge: number[];
  numbersY: number;
  numbersH: number;
  scrollable: boolean;
}

function computeLayout(
  minFretIn: number,
  maxFretIn: number,
  containerW: number,
  minCell: number,
  showNumbers: boolean,
  height: number | undefined,
  n: number,
  gauges: number[],
): FbLayout {
  const minFret = clamp(Math.round(minFretIn), 0, MAX_WINDOW_FRET - 1);
  const maxFret = clamp(Math.round(Math.max(maxFretIn, minFret + 1)), 1, MAX_WINDOW_FRET);
  const hasNut = minFret === 0;
  const start = hasNut ? 0 : minFret - 1;
  const numbersH = showNumbers ? 26 : 0;
  const y0 = 12;
  const cw = containerW > 0 ? containerW : 720;

  // fewer strings sit a little further apart (a ukulele neck is narrow but its strings are wide-spaced)
  const spread = n <= 4 ? 1.25 : n === 5 ? 1.1 : 1;
  let s = height && height > 60 ? (height - y0 - 10 - numbersH) / n : clamp((cw / 24) * spread, 32, 46 * spread);
  s = clamp(s, 18, n <= 4 ? 70 : 90);
  const boardH = n * s;

  const openW = hasNut ? clamp(s * 1.4, 44, 64) : 0;
  const nutW = hasNut ? clamp(s * 0.24, 6, 10) : 0;
  const leadIn = hasNut ? 0 : 14;
  const leftW = hasNut ? openW + nutW : clamp(s * 1.2, 40, 56);
  const tailW = 14;

  const span = distFromNut(maxFret) - distFromNut(start);
  const narrowest = distFromNut(maxFret) - distFromNut(maxFret - 1);
  let scale = Math.max(40, cw - leftW - tailW) / span;
  if (narrowest * scale < minCell) scale = minCell / narrowest;
  const boardW = span * scale;
  const totalW = leftW + boardW + tailW;

  const wx: number[] = new Array(maxFret + 1).fill(NaN);
  for (let n = start; n <= maxFret; n++) wx[n] = leftW + (distFromNut(n) - distFromNut(start)) * scale;

  const k = clamp(s / 38, 0.75, 1.3);
  return {
    n,
    minFret,
    maxFret,
    start,
    hasNut,
    s,
    y0,
    boardH,
    totalW,
    totalH: y0 + boardH + 10 + numbersH,
    openW,
    nutW,
    leftW,
    leadIn,
    tailW,
    boardL: hasNut ? openW : leftW - leadIn,
    boardEnd: wx[maxFret],
    wx,
    r: Math.min(s * 0.4, narrowest * scale * 0.4, 17),
    fw: clamp(s * 0.085, 2.6, 4.4),
    gauge: gauges.map(g => g * k),
    numbersY: y0 + boardH + 10 + 15,
    numbersH,
    scrollable: containerW > 0 && totalW > containerW + 0.5,
  };
}

const stringY = (lay: FbLayout, str: number) => lay.y0 + lay.s * (str - 0.5);

/** Centre of the space for a fret (fret 0 = the open-string zone). */
function cellCenter(lay: FbLayout, fret: number): number {
  if (fret === 0) return lay.openW / 2;
  return (lay.wx[fret - 1] + lay.wx[fret]) / 2;
}

/** Where a fingertip goes: centred in the cell, nudged just behind the fret wire. */
function fingerX(lay: FbLayout, fret: number): number {
  if (fret === 0) return lay.openW / 2;
  const a = lay.wx[fret - 1];
  const b = lay.wx[fret];
  return a + (b - a) * 0.52;
}

function inWindow(lay: FbLayout, fret: number): boolean {
  if (fret === 0) return lay.hasNut;
  return fret >= Math.max(1, lay.minFret) && fret <= lay.maxFret;
}

// ---------------------------------------------------------------------------
// Static layer: wood, inlays, frets, nut, strings, fret numbers
// ---------------------------------------------------------------------------

interface StaticProps {
  lay: FbLayout;
  id: string;
  leftHanded: boolean;
  showFretNumbers: boolean;
  look: FrettedLook;
}

const FretboardStatic = memo(function FretboardStatic({ lay, id, leftHanded, showFretNumbers, look }: StaticProps) {
  const SINGLE_INLAYS = new Set(look.inlays);
  const DOUBLE_INLAYS = new Set(look.doubleInlays);
  const { y0, boardH, totalW, s, fw, wx, hasNut, boardL } = lay;
  const mx = (x: number) => (leftHanded ? totalW - x : x);
  const boardW = totalW - boardL;
  const midY = y0 + boardH / 2;

  // Fade the board/strings into the edges of the window.
  const pct = (x: number) => `${clamp((x / totalW) * 100, 0, 100)}%`;
  const fadeStart = hasNut ? boardL : boardL;
  const fadeFull = hasNut ? boardL : lay.leftW;
  const tailFrom = lay.boardEnd + 2;

  const inlays: ReactElement[] = [];
  for (let f = Math.max(1, lay.minFret); f <= lay.maxFret; f++) {
    const cx = cellCenter(lay, f);
    const cell = wx[f] - wx[f - 1];
    const r = Math.min(s * 0.235, cell * 0.2, 10);
    const ys = DOUBLE_INLAYS.has(f) ? [y0 + boardH / 3, y0 + (boardH * 2) / 3] : SINGLE_INLAYS.has(f) ? [midY] : [];
    ys.forEach((cy, i) =>
      inlays.push(
        <g key={`${f}-${i}`}>
          <circle cx={cx} cy={cy} r={r + 0.9} fill="#120904" opacity={0.55} />
          <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-pearl)`} />
          <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-abalone)`} opacity={0.75} />
          <ellipse cx={cx - r * 0.25} cy={cy - r * 0.35} rx={r * 0.5} ry={r * 0.3} fill="#ffffff" opacity={0.45} />
        </g>,
      ),
    );
  }

  const frets: ReactElement[] = [];
  const firstWire = hasNut ? 1 : lay.start;
  for (let n = firstWire; n <= lay.maxFret; n++) {
    const x = wx[n];
    frets.push(
      <g key={n}>
        <rect x={x + fw / 2 - 0.5} y={y0} width={fw * 1.6} height={boardH} fill={`url(#${id}-fret-shadow)`} />
        <rect x={x - fw / 2 - 1} y={y0} width={1.2} height={boardH} fill="#000000" opacity={0.28} />
        <rect x={x - fw / 2} y={y0 - 0.6} width={fw} height={boardH + 1.2} rx={fw / 2} fill={`url(#${id}-fret)`} />
      </g>,
    );
  }

  const strings: ReactElement[] = [];
  const shadows: ReactElement[] = [];
  for (let str = 1; str <= lay.n; str++) {
    const y = stringY(lay, str);
    const t = lay.gauge[str - 1];
    const wound = look.wound[str - 1];
    shadows.push(
      <g key={str}>
        <rect x={boardL} y={y + t * 0.6 + s * 0.06} width={boardW} height={t * 2.4} rx={t} fill="#000000" opacity={0.16} />
        <rect x={boardL} y={y + t * 0.5 + s * 0.03} width={boardW} height={t * 1.1} rx={t / 2} fill="#000000" opacity={0.32} />
      </g>,
    );
    strings.push(
      <g key={str}>
        <rect x={0} y={y - t / 2} width={totalW} height={t} fill={`url(#${id}-${wound ? 'wound' : 'plain'})`} />
        {wound && <rect x={0} y={y - t / 2} width={totalW} height={t} fill={`url(#${id}-winding)`} />}
      </g>,
    );
  }

  const numbers: ReactElement[] = [];
  if (showFretNumbers) {
    for (let f = Math.max(1, lay.minFret); f <= lay.maxFret; f++) {
      const marker = SINGLE_INLAYS.has(f) || DOUBLE_INLAYS.has(f);
      numbers.push(
        <text key={f} x={mx(cellCenter(lay, f))} y={lay.numbersY} className={`fb-num${marker ? ' is-marker' : ''}`}>
          {f}
        </text>,
      );
    }
  }

  return (
    <svg className="fb-svg fb-static" width={totalW} height={lay.totalH} viewBox={`0 0 ${totalW} ${lay.totalH}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f100a" />
          <stop offset="0.06" stopColor={look.wood[0]} />
          <stop offset="0.5" stopColor={look.wood[1]} />
          <stop offset="0.94" stopColor={look.wood[2]} />
          <stop offset="1" stopColor="#1a0d07" />
        </linearGradient>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.16" numOctaves={4} seed={11} result="n1" />
          <feColorMatrix
            in="n1"
            type="matrix"
            values="0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0 0.01  -2.6 0 0 0 1.55"
            result="dark"
          />
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.5" numOctaves={2} seed={4} result="n2" />
          <feColorMatrix
            in="n2"
            type="matrix"
            values="0 0 0 0 0.55  0 0 0 0 0.3  0 0 0 0 0.17  0 2.6 0 0 -1.62"
            result="light"
          />
          <feMerge result="m">
            <feMergeNode in="dark" />
            <feMergeNode in="light" />
          </feMerge>
          <feComposite in="m" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id={`${id}-drop`} x="-5%" y="-20%" width="110%" height="150%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9b0" stopOpacity="0.1" />
          <stop offset="0.3" stopColor="#ffd9b0" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${id}-fret`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b6067" />
          <stop offset="0.3" stopColor="#d9dee3" />
          <stop offset="0.48" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#a9b0b7" />
          <stop offset="1" stopColor="#42464c" />
        </linearGradient>
        <linearGradient id={`${id}-fret-shadow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-bone`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c3b28f" />
          <stop offset="0.3" stopColor="#efe5cf" />
          <stop offset="0.55" stopColor="#fbf6ea" />
          <stop offset="1" stopColor="#cbbb9a" />
        </linearGradient>
        <radialGradient id={`${id}-pearl`} cx="0.42" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="0.55" stopColor="#ebe6dc" />
          <stop offset="1" stopColor="#b9b2a5" />
        </radialGradient>
        <linearGradient id={`${id}-abalone`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fd8ff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#f3b6ee" stopOpacity="0.35" />
          <stop offset="0.65" stopColor="#a8f5cf" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffd98f" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${id}-plain`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d838b" />
          <stop offset="0.3" stopColor="#f7f9fb" />
          <stop offset="0.55" stopColor="#c3c8ce" />
          <stop offset="1" stopColor="#555a61" />
        </linearGradient>
        <linearGradient id={`${id}-wound`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a5638" />
          <stop offset="0.3" stopColor="#f1dcb3" />
          <stop offset="0.55" stopColor="#b8996a" />
          <stop offset="1" stopColor="#3f3020" />
        </linearGradient>
        <pattern id={`${id}-winding`} width="2.1" height="8" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
          <rect x="0" y="0" width="0.8" height="8" fill="#20160b" opacity="0.38" />
        </pattern>
        <linearGradient id={`${id}-fade-board`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={totalW} y2="0">
          <stop offset={pct(fadeStart)} stopColor="#fff" stopOpacity={hasNut ? 1 : 0} />
          <stop offset={pct(fadeFull)} stopColor="#fff" stopOpacity="1" />
          <stop offset={pct(tailFrom)} stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-fade-strings`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={totalW} y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset={pct(hasNut ? lay.openW * 0.5 : lay.leftW)} stopColor="#fff" stopOpacity="1" />
          <stop offset={pct(tailFrom)} stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask-board`} maskUnits="userSpaceOnUse" x="0" y="0" width={totalW} height={lay.totalH}>
          <rect x="0" y="0" width={totalW} height={lay.totalH} fill={`url(#${id}-fade-board)`} />
        </mask>
        <mask id={`${id}-mask-strings`} maskUnits="userSpaceOnUse" x="0" y="0" width={totalW} height={lay.totalH}>
          <rect x="0" y="0" width={totalW} height={lay.totalH} fill={`url(#${id}-fade-strings)`} />
        </mask>
      </defs>

      <g transform={leftHanded ? `translate(${totalW} 0) scale(-1 1)` : undefined}>
        {/* soft shadow lifting the neck off the card */}
        <g mask={`url(#${id}-mask-board)`}>
          <rect x={boardL + 6} y={y0 + 8} width={boardW - 12} height={boardH} rx={4} fill="#000" opacity={0.65} filter={`url(#${id}-drop)`} />
          <rect x={boardL} y={y0} width={boardW} height={boardH} fill={`url(#${id}-wood)`} />
          <rect x={boardL} y={y0} width={boardW} height={boardH} fill="#000" filter={`url(#${id}-grain)`} />
          <rect x={boardL} y={y0} width={boardW} height={boardH} fill={`url(#${id}-sheen)`} />
          <rect x={boardL} y={y0} width={boardW} height={1} fill="#ffcf9e" opacity={0.18} />
          <rect x={boardL} y={y0 + boardH - 1} width={boardW} height={1} fill="#000" opacity={0.5} />
          {inlays}
          {frets}
          {shadows}
        </g>
        {hasNut && (
          <g>
            <rect x={lay.openW + lay.nutW} y={y0} width={6} height={boardH} fill={`url(#${id}-fret-shadow)`} />
            <rect x={lay.openW} y={y0 - 1.5} width={lay.nutW} height={boardH + 3} rx={1.5} fill={`url(#${id}-bone)`} />
            {Array.from({ length: lay.n }, (_, i) => i + 1).map(str => (
              <rect
                key={str}
                x={lay.openW}
                y={stringY(lay, str) - lay.gauge[str - 1] / 2 - 0.4}
                width={lay.nutW}
                height={lay.gauge[str - 1] + 0.8}
                fill="#5b4a2c"
                opacity={0.35}
              />
            ))}
          </g>
        )}
        <g mask={`url(#${id}-mask-strings)`}>{strings}</g>
      </g>

      {numbers}
      {!hasNut && (
        <g className="fb-pos">
          <text x={mx((lay.leftW - lay.leadIn) / 2)} y={midY} dy="0.1em" className="fb-pos-num">
            {lay.minFret}
          </text>
          <text x={mx((lay.leftW - lay.leadIn) / 2)} y={midY + 15} className="fb-pos-fr">
            fr
          </text>
        </g>
      )}
    </svg>
  );
});

// ---------------------------------------------------------------------------
// Dynamic layer
// ---------------------------------------------------------------------------

interface MarkProps {
  id: string;
  x: number;
  y: number;
  r: number;
  color: MarkColor;
  text: string;
  badge: string;
  pulse: boolean;
  root: boolean;
  ghost: boolean;
  open: boolean;
}

const Mark = memo(function Mark({ id, x, y, r, color, text, badge, pulse, root, ghost, open }: MarkProps) {
  const fs = clamp(r * (text.length > 1 ? 0.88 : 1.08), 8, 16);
  const cls = `fb-mark ins-c-${color}${pulse ? ' ins-pulse' : ''}${ghost ? ' is-ghost' : ''}${open ? ' is-open' : ''}${root ? ' is-root' : ''}`;
  const sq = r * 0.92;
  return (
    <g className={cls}>
      {!ghost && <circle className="ins-halo" cx={x} cy={y} r={r * 2.3} fill={`url(#${id}-halo-${color})`} />}
      <g className="ins-body">
        {root ? (
          <>
            <rect className="fb-root-ring" x={x - sq - 3.5} y={y - sq - 3.5} width={(sq + 3.5) * 2} height={(sq + 3.5) * 2} rx={sq * 0.5} />
            <rect className="fb-mark-body" x={x - sq} y={y - sq} width={sq * 2} height={sq * 2} rx={sq * 0.34} />
            {!ghost && (
              <rect x={x - sq + 2} y={y - sq + 1.5} width={sq * 2 - 4} height={sq * 0.95} rx={sq * 0.3} fill={`url(#${id}-shine)`} className="fb-shine" />
            )}
          </>
        ) : (
          <>
            <circle className="fb-mark-body" cx={x} cy={y} r={r} />
            {!ghost && !open && (
              <ellipse cx={x} cy={y - r * 0.42} rx={r * 0.72} ry={r * 0.46} fill={`url(#${id}-shine)`} className="fb-shine" />
            )}
          </>
        )}
        {text && (
          <text x={x} y={y} dy="0.36em" className="fb-mark-text" fontSize={fs}>
            {text}
          </text>
        )}
      </g>
      {badge && (
        <g className="fb-badge">
          <circle cx={x + r * 0.78} cy={y - r * 0.78} r={Math.max(6.5, r * 0.46)} />
          <text x={x + r * 0.78} y={y - r * 0.78} dy="0.36em" fontSize={Math.max(8, r * 0.58)}>
            {badge}
          </text>
        </g>
      )}
    </g>
  );
});

interface PressFxProps {
  id: string;
  x: number;
  y: number;
  r: number;
  color: MarkColor;
  vibX: number;
  vibW: number;
  t: number;
  marked: boolean;
  /** The pressed position carries a root mark: echo its rounded-square shape. */
  rootShape: boolean;
  /** Note name shown inside the fingertip dot of an unmarked press. */
  text: string;
}

/** Under the marks: the sounding string shimmers and the wood glows. */
const PressUnder = memo(function PressUnder({ id, x, y, r, color, vibX, vibW, t }: PressFxProps) {
  return (
    <g className={`fb-press ins-c-${color}`}>
      <rect className="fb-vib" x={vibX} y={y - t * 0.6} width={vibW} height={t * 1.2} rx={t * 0.6} />
      <circle className="fb-press-glow" cx={x} cy={y} r={r * 2.6} fill={`url(#${id}-halo-${color})`} />
    </g>
  );
});

/** Over the marks: fingertip dot (if unmarked), contact ring and ripples. */
const PressOver = memo(function PressOver({ x, y, r, color, marked, rootShape, text }: PressFxProps) {
  const h = r * 0.92 + 5.5;
  return (
    <g className={`fb-press ins-c-${color}`}>
      {!marked && <circle className="fb-press-dot" cx={x} cy={y} r={r * (text ? 0.95 : 0.82)} />}
      {!marked && text && (
        <text x={x} y={y} dy="0.36em" className="fb-mark-text" fontSize={clamp(r * (text.length > 1 ? 0.85 : 1.02), 8, 15)}>
          {text}
        </text>
      )}
      <circle className="fb-ripple" cx={x} cy={y} r={r} />
      <circle className="fb-ripple is-late" cx={x} cy={y} r={r} />
      {rootShape ? (
        <rect className="fb-press-ring" x={x - h} y={y - h} width={h * 2} height={h * 2} rx={h * 0.45} />
      ) : (
        <circle className="fb-press-ring" cx={x} cy={y} r={r + 3} />
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const posKey = (str: number, fret: number) => str * 100 + fret;

export function Fretboard({
  tuning = STANDARD_TUNING,
  look: lookProp,
  minFret = 0,
  maxFret = 12,
  marks,
  pressed,
  showNoteNames = 'none',
  naming = 'letter',
  preferFlats = false,
  leftHanded = false,
  highlightFrets,
  showFretNumbers = true,
  interactive = true,
  onTap,
  onRelease,
  height,
  minCellWidth,
  ariaLabel = 'Fretboard',
  className,
}: FretboardProps) {
  const id = useSvgId('fb');
  const look = lookProp ?? defaultLook(tuning);
  const nStrings = tuning.length;
  const gaugeKey = look.gauge.join(',');
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerW = useElementWidth(rootRef);
  const minCell = minCellWidth ?? (isCoarsePointer() ? 34 : 30);

  const lay = useMemo(
    () => computeLayout(minFret, maxFret, containerW, minCell, showFretNumbers, height, nStrings, Array.from({ length: nStrings }, (_, i) => look.gauge[i] ?? 2)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minFret, maxFret, containerW, minCell, showFretNumbers, height, nStrings, gaugeKey],
  );
  const mx = useCallback((x: number) => (leftHanded ? lay.totalW - x : x), [leftHanded, lay.totalW]);

  // ---- Pointer interaction ------------------------------------------------
  const [touched, setTouched] = useState<ReadonlyMap<number, { string: number; fret: number }>>(new Map());
  const pointers = useRef(new Map<number, { string: number; fret: number } | null>());
  const callbacks = useRef({ onTap, onRelease });
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  useLayoutEffect(() => {
    callbacks.current = { onTap, onRelease };
  });

  const syncTouched = useCallback(() => {
    const m = new Map<number, { string: number; fret: number }>();
    for (const p of pointers.current.values()) if (p) m.set(posKey(p.string, p.fret), p);
    setTouched(m);
  }, []);

  // The surface's page rect, read once per gesture (no forced layout on every pointermove).
  const rectRef = useRef<{ left: number; top: number } | null>(null);
  const readRect = () => {
    const el = surfaceRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    rectRef.current = { left: r.left, top: r.top };
  };

  const hitTest = useCallback(
    (clientX: number, clientY: number): { string: number; fret: number } | null => {
      const rect = rectRef.current;
      if (!rect) return null;
      let x = clientX - rect.left;
      const y = clientY - rect.top;
      if (leftHanded) x = lay.totalW - x;
      const { y0, boardH, s } = lay;
      if (y < y0 - s * 0.4 || y > y0 + boardH + s * 0.4) return null;
      const str = clamp(Math.floor((y - y0) / s) + 1, 1, lay.n);
      if (x < 0 || x > lay.totalW) return null;
      if (lay.hasNut && x < lay.wx[0]) return { string: str, fret: 0 };
      if (!lay.hasNut && x < lay.wx[lay.start]) return null;
      for (let f = Math.max(1, lay.minFret); f <= lay.maxFret; f++) {
        if (x < lay.wx[f]) return { string: str, fret: f };
      }
      return { string: str, fret: lay.maxFret };
    },
    [lay, leftHanded],
  );

  const press = (pos: { string: number; fret: number }) => {
    callbacks.current.onTap?.(pos, midiAt(pos.string, pos.fret, tuningRef.current));
  };
  const release = (pos: { string: number; fret: number }) => {
    callbacks.current.onRelease?.(pos);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* best-effort */
    }
    readRect();
    const hit = hitTest(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId);
    if (prev) release(prev);
    pointers.current.set(e.pointerId, hit);
    if (hit) press(hit);
    syncTouched();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    const hit = hitTest(e.clientX, e.clientY);
    if (prev && hit && prev.string === hit.string && prev.fret === hit.fret) return;
    if (!prev && !hit) return;
    if (prev) release(prev);
    if (hit) press(hit);
    pointers.current.set(e.pointerId, hit);
    syncTouched();
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    pointers.current.delete(e.pointerId);
    if (prev) release(prev);
    syncTouched();
  };

  const releaseAll = useCallback(() => {
    if (!pointers.current.size) return;
    const held = [...pointers.current.values()];
    pointers.current.clear();
    for (const p of held) if (p) callbacks.current.onRelease?.(p);
    syncTouched();
  }, [syncTouched]);

  useEffect(() => {
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  // ---- Keep marks in view when the neck scrolls ----------------------------
  const validMarks = useMemo(
    () => (marks ?? []).filter(m => m.string >= 1 && m.string <= lay.n && inWindow(lay, m.fret)),
    [marks, lay],
  );
  const viewSig = useMemo(
    () =>
      validMarks
        .filter(m => !m.ghost)
        .map(m => `${m.string}:${m.fret}`)
        .join(',') + `|${highlightFrets?.join('-') ?? ''}`,
    [validMarks, highlightFrets],
  );
  const didInitialScroll = useRef(false);
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || !lay.scrollable) return;
    const xs: number[] = [];
    for (const m of validMarks) if (!m.ghost) xs.push(mx(fingerX(lay, m.fret)));
    if (highlightFrets) {
      const [a, b] = [Math.min(...highlightFrets), Math.max(...highlightFrets)];
      if (inWindow(lay, a)) xs.push(mx(a === 0 ? 0 : lay.wx[a - 1]));
      if (inWindow(lay, b)) xs.push(mx(lay.wx[b]));
    }
    const vw = sc.clientWidth;
    const maxLeft = Math.max(0, lay.totalW - vw);
    let left: number;
    if (!xs.length) left = leftHanded ? maxLeft : 0;
    else {
      const lo = Math.min(...xs) - lay.r * 2;
      const hi = Math.max(...xs) + lay.r * 2;
      left = hi - lo <= vw ? (lo + hi) / 2 - vw / 2 : leftHanded ? hi - vw : lo;
    }
    left = clamp(left, 0, maxLeft);
    const first = !didInitialScroll.current;
    didInitialScroll.current = true;
    if (first || typeof sc.scrollTo !== 'function') sc.scrollLeft = left;
    else sc.scrollTo({ left, behavior: 'smooth' });
  }, [viewSig, lay, leftHanded]);

  // ---- More-neck indicators (scrollable boards) ----------------------------
  const [more, setMore] = useState({ left: false, right: false });
  const updateMore = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc || !lay.scrollable) {
      setMore(m => (m.left || m.right ? { left: false, right: false } : m));
      return;
    }
    const left = sc.scrollLeft > 4;
    const right = sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4;
    setMore(m => (m.left === left && m.right === right ? m : { left, right }));
  }, [lay.scrollable]);
  useEffect(() => {
    updateMore();
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.addEventListener('scroll', updateMore, { passive: true });
    return () => sc.removeEventListener('scroll', updateMore);
  }, [updateMore, lay.totalW]);
  const page = (dir: 1 | -1) => {
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.scrollBy({ left: dir * sc.clientWidth * 0.7, behavior: 'smooth' });
  };

  // ---- Overlay content -------------------------------------------------------
  const nameAt = useCallback(
    (str: number, fret: number) => {
      const p = noteNameAt(str, fret, preferFlats, tuning);
      return stepLabel(p.step, p.alter, naming);
    },
    [preferFlats, naming, tuning],
  );

  const markedKeys = useMemo(() => new Set(validMarks.filter(m => !m.ghost).map(m => posKey(m.string, m.fret))), [validMarks]);
  const rootKeys = useMemo(
    () => new Set(validMarks.filter(m => !m.ghost && m.root).map(m => posKey(m.string, m.fret))),
    [validMarks],
  );

  // Pressed positions: external (detected) + touches on this board.
  const pressedMap = new Map<number, FretPressed>();
  for (const p of pressed ?? []) if (p.string >= 1 && p.string <= lay.n && inWindow(lay, p.fret)) pressedMap.set(posKey(p.string, p.fret), p);
  for (const [k, p] of touched) if (!pressedMap.has(k)) pressedMap.set(k, p);
  const pressedKeys = new Set(pressedMap.keys());

  const allNames: ReactElement[] = [];
  if (showNoteNames === 'all') {
    const fs = clamp(lay.s * 0.3, 9, 12);
    for (let str = 1; str <= lay.n; str++) {
      for (let f = lay.hasNut ? 0 : Math.max(1, lay.minFret); f <= lay.maxFret; f++) {
        if (markedKeys.has(posKey(str, f)) || pressedKeys.has(posKey(str, f))) continue;
        const name = nameAt(str, f);
        const x = mx(fingerX(lay, f));
        const y = stringY(lay, str);
        const w = Math.max(fs * 1.5, name.length * fs * 0.62 + 7);
        allNames.push(
          <g key={posKey(str, f)} className="fb-name">
            <rect x={x - w / 2} y={y - fs * 0.78} width={w} height={fs * 1.56} rx={fs * 0.78} />
            <text x={x} y={y} dy="0.35em" fontSize={fs}>
              {name}
            </text>
          </g>,
        );
      }
    }
  }

  let highlight: ReactElement | null = null;
  if (highlightFrets) {
    const a = clamp(Math.min(...highlightFrets), lay.hasNut ? 0 : lay.minFret, lay.maxFret);
    const b = clamp(Math.max(...highlightFrets), a, lay.maxFret);
    const x1 = a === 0 ? 2 : lay.wx[a - 1] - 1;
    const x2 = lay.wx[b] + 1;
    const top = lay.y0 - 6;
    const h = lay.boardH + 12;
    const left = Math.min(mx(x1), mx(x2));
    const right = Math.max(mx(x1), mx(x2));
    const fretL = lay.hasNut ? lay.wx[0] : lay.boardL;
    const boardLeft = Math.min(mx(fretL), mx(lay.totalW));
    const boardRight = Math.max(mx(fretL), mx(lay.totalW));
    highlight = (
      <g className="fb-window">
        {left > boardLeft && <rect className="fb-window-dim" x={boardLeft} y={lay.y0} width={left - boardLeft} height={lay.boardH} />}
        {right < boardRight && <rect className="fb-window-dim" x={right} y={lay.y0} width={boardRight - right} height={lay.boardH} />}
        <rect className="fb-window-fill" x={left} y={top} width={right - left} height={h} rx={10} />
        <rect className="fb-window-edge" x={left} y={top} width={right - left} height={h} rx={10} />
      </g>
    );
  }

  const markEls = [...validMarks]
    .sort((m1, m2) => Number(!!m2.ghost) - Number(!!m1.ghost))
    .map(m => {
      const showName = showNoteNames !== 'none';
      const name = showName ? nameAt(m.string, m.fret) : '';
      const finger = m.finger != null && m.finger > 0 ? String(m.finger) : '';
      let text = m.label ?? (showName ? name : finger);
      let badge = '';
      if ((m.label != null || showName) && finger) badge = finger;
      const open = m.fret === 0 && !finger && m.label == null && !m.root;
      if (m.ghost && !m.label) text = showName ? name : '';
      if (m.ghost) badge = '';
      return (
        <Mark
          key={`${posKey(m.string, m.fret)}${m.ghost ? 'g' : ''}`}
          id={id}
          x={mx(fingerX(lay, m.fret))}
          y={stringY(lay, m.string)}
          r={m.ghost ? lay.r * 0.82 : lay.r}
          color={m.color ?? 'gold'}
          text={text}
          badge={badge}
          pulse={!!m.pulse}
          root={!!m.root}
          ghost={!!m.ghost}
          open={open}
        />
      );
    });

  const fxProps: (PressFxProps & { k: number })[] = [...pressedMap.entries()].map(([k, p]) => {
    const from = p.fret === 0 ? lay.wx[0] : lay.wx[p.fret];
    const to = lay.boardEnd + lay.tailW * 0.6;
    return {
      k,
      id,
      x: mx(fingerX(lay, p.fret)),
      y: stringY(lay, p.string),
      r: lay.r,
      color: p.color ?? 'gold',
      vibX: leftHanded ? lay.totalW - to : from,
      vibW: Math.max(0, to - from),
      t: lay.gauge[p.string - 1] + 1,
      marked: markedKeys.has(k),
      rootShape: rootKeys.has(k),
      text: showNoteNames !== 'none' && !markedKeys.has(k) ? nameAt(p.string, p.fret) : '',
    };
  });

  return (
    <div
      ref={rootRef}
      className={`fb${interactive ? ' is-interactive' : ''}${lay.scrollable ? ' is-scrollable' : ''}${leftHanded ? ' is-lefty' : ''}${className ? ' ' + className : ''}`}
    >
      <div ref={scrollerRef} className="fb-scroller">
        <div className="fb-content" style={{ width: lay.totalW, height: lay.totalH }}>
          <div
            ref={surfaceRef}
            className="fb-surface"
            role="group"
            aria-label={ariaLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onLostPointerCapture={endPointer}
            onContextMenu={e => e.preventDefault()}
          >
            <FretboardStatic lay={lay} id={id} leftHanded={leftHanded} showFretNumbers={showFretNumbers} look={look} />
            <svg className="fb-svg fb-dyn" width={lay.totalW} height={lay.totalH} viewBox={`0 0 ${lay.totalW} ${lay.totalH}`} aria-hidden="true">
              <defs>
                <ColorDefs id={id} />
              </defs>
              {highlight}
              {fxProps.map(({ k, ...fp }) => (
                <PressUnder key={k} {...fp} />
              ))}
              {allNames}
              {markEls}
              {fxProps.map(({ k, ...fp }) => (
                <PressOver key={k} {...fp} />
              ))}
            </svg>
          </div>
          {lay.scrollable && (
            <div className="fb-pan" style={{ height: Math.max(lay.numbersH, 16) + 6 }} aria-hidden="true" />
          )}
        </div>
      </div>
      {more.left && (
        <button type="button" className="fb-more left" style={{ height: lay.y0 + lay.boardH + 8 }} onClick={() => page(-1)} aria-label="Show lower frets">
          <span aria-hidden>‹</span>
        </button>
      )}
      {more.right && (
        <button type="button" className="fb-more right" style={{ height: lay.y0 + lay.boardH + 8 }} onClick={() => page(1)} aria-label="Show higher frets">
          <span aria-hidden>›</span>
        </button>
      )}
    </div>
  );
}

export default Fretboard;
