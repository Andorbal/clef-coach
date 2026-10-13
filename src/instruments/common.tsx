/**
 * Shared bits for the instrument components (piano keyboard, fretboard):
 * mark colours, per-colour SVG gradients, sizing hooks and small math helpers.
 */
import { Fragment, useId, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import './instruments.css';

export type MarkColor = 'rh' | 'lh' | 'good' | 'bad' | 'gold' | 'hint';

export const MARK_COLORS: readonly MarkColor[] = ['rh', 'lh', 'good', 'bad', 'gold', 'hint'];

/** CSS colour (design token) used for each mark colour. */
export const MARK_VAR: Record<MarkColor, string> = {
  rh: 'var(--rh)',
  lh: 'var(--lh)',
  good: 'var(--good)',
  bad: 'var(--bad)',
  gold: 'var(--gold)',
  hint: 'var(--violet)',
};

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

let coarseCache: boolean | null = null;
/** True on touch-first devices (iPad, phones). Cached after the first call. */
export function isCoarsePointer(): boolean {
  if (coarseCache !== null) return coarseCache;
  coarseCache =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarseCache;
}

/** A per-instance prefix that is safe to use inside SVG `url(#...)` references. */
export function useSvgId(prefix: string): string {
  const raw = useId();
  return prefix + raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Observed content-box width of an element (0 until the first layout). */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Gradients shared by both instruments, one set per mark colour:
 *  - `${id}-halo-${c}`  radial glow (centre → transparent)
 *  - `${id}-wash-${c}`  vertical wash (faint at the top → strong at the bottom)
 *  - `${id}-shine`      white specular highlight for glossy dots
 */
export function ColorDefs({ id }: { id: string }) {
  return (
    <>
      {MARK_COLORS.map(c => {
        const col = MARK_VAR[c];
        return (
          <Fragment key={c}>
            <radialGradient id={`${id}-halo-${c}`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" style={{ stopColor: col, stopOpacity: 0.85 }} />
              <stop offset="0.38" style={{ stopColor: col, stopOpacity: 0.42 }} />
              <stop offset="0.7" style={{ stopColor: col, stopOpacity: 0.12 }} />
              <stop offset="1" style={{ stopColor: col, stopOpacity: 0 }} />
            </radialGradient>
            <linearGradient id={`${id}-wash-${c}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: col, stopOpacity: 0.02 }} />
              <stop offset="0.45" style={{ stopColor: col, stopOpacity: 0.2 }} />
              <stop offset="0.85" style={{ stopColor: col, stopOpacity: 0.5 }} />
              <stop offset="1" style={{ stopColor: col, stopOpacity: 0.66 }} />
            </linearGradient>
          </Fragment>
        );
      })}
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.18" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

/** Path for a rectangle with only the bottom corners rounded. */
export function roundedBottomRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${x},${y}H${x + w}V${y + h - rr}` +
    `Q${x + w},${y + h} ${x + w - rr},${y + h}` +
    `H${x + rr}Q${x},${y + h} ${x},${y + h - rr}Z`
  );
}
