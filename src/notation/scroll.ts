/**
 * Where the scrolling score sits as a playhead moves through it — pure, for NotationView.
 *
 * The playhead's x on the music (xForTick) is linear between the ticks of the notes, and
 * the view scrolls to hold the playhead at an anchor, so the whole motion is linear
 * between a few hundred points. Handed to the browser as keyframes, it runs by itself on
 * the compositor, instead of the page re-rendering on every frame.
 */
import { type RenderResult, xForTick } from './render';

export interface ScrollView {
  /** Scale of the music on screen. */
  scale: number;
  /** Screen x the playhead holds while the music scrolls under it. */
  anchor: number;
  /** Furthest the music scrolls (screen px). */
  maxOffset: number;
}

/** The scrolling view of a rendered score in a box `width` px wide. */
export function scrollView(r: Pick<RenderResult, 'headerWidth' | 'width'>, scale: number, width: number): ScrollView {
  const anchor = Math.max(r.headerWidth * scale + 70, width * 0.32);
  const contentW = (r.width - 600) * scale;
  return { scale, anchor, maxOffset: Math.max(0, contentW - width + 40) + 200 };
}

/** How far the music is scrolled (screen px) with the playhead at `x` on the music. */
export function scrollOffset(v: ScrollView, x: number): number {
  return Math.max(0, Math.min(x * v.scale - v.anchor, v.maxOffset));
}

export interface ScrollPoint {
  tick: number;
  /** The playhead on the music (unscaled). */
  x: number;
  /** The scroll (screen px). */
  offset: number;
}

/**
 * The motion from tick `from` to `to`, as points to interpolate linearly between: every
 * note's tick, the end of the music, and where the view starts and stops scrolling.
 */
export function scrollPath(r: Pick<RenderResult, 'tickXs' | 'headerWidth' | 'width' | 'measureXs'>, endTick: number, v: ScrollView, from: number, to: number): ScrollPoint[] {
  const at = (tick: number): ScrollPoint => {
    const x = xForTick(r as RenderResult, tick, endTick);
    return { tick, x, offset: scrollOffset(v, x) };
  };
  const ticks = [...new Set([from, ...r.tickXs.map(t => t[0]), endTick, to])].filter(t => t >= from && t <= to).sort((a, b) => a - b);
  const out: ScrollPoint[] = [];
  for (let i = 0; i < ticks.length; i++) {
    const p = at(ticks[i]);
    out.push(p);
    if (i + 1 === ticks.length) break;
    // the scroll is clamped at both ends: add the points where it starts and stops moving
    const q = at(ticks[i + 1]);
    const ra = p.x * v.scale - v.anchor;
    const rb = q.x * v.scale - v.anchor;
    for (const edge of [0, v.maxOffset]) {
      if ((ra - edge) * (rb - edge) < 0) out.push(at(p.tick + ((q.tick - p.tick) * (edge - ra)) / (rb - ra)));
    }
  }
  return out;
}
