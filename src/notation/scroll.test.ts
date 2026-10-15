import { describe, expect, it } from 'vitest';
import { xForTick } from './render';
import type { RenderResult } from './render';
import { scrollOffset, scrollPath, scrollView } from './scroll';

/** A long horizontal score: notes every eighth (24 ticks), unevenly spaced as engraving does. */
function fakeRender(notes: number): RenderResult {
  const tickXs: [number, number][] = [];
  let x = 140;
  for (let i = 0; i < notes; i++) {
    tickXs.push([i * 24, x]);
    x += i % 4 === 3 ? 58 : 31;
  }
  return { tickXs, headerWidth: 110, width: x + 600, measureXs: [110, x] } as unknown as RenderResult;
}

/** Linear interpolation of the path at `tick`. */
function along(path: { tick: number; x: number; offset: number }[], tick: number) {
  if (tick <= path[0].tick) return path[0];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (tick <= b.tick) {
      const f = (tick - a.tick) / (b.tick - a.tick || 1);
      return { x: a.x + f * (b.x - a.x), offset: a.offset + f * (b.offset - a.offset) };
    }
  }
  return path[path.length - 1];
}

describe('the scroll path for tempo mode', () => {
  it('is linear between its points: interpolating it gives the playhead and scroll at every tick', () => {
    const r = fakeRender(64);
    const end = 64 * 24;
    const v = scrollView(r, 1.4, 900);
    const path = scrollPath(r, end, v, -48, end);
    expect(path[0].tick).toBe(-48);
    expect(path[path.length - 1].tick).toBe(end);
    for (let i = 1; i < path.length; i++) expect(path[i].tick).toBeGreaterThan(path[i - 1].tick);
    for (let tick = -48; tick <= end; tick += 5) {
      const x = xForTick(r, tick, end);
      const p = along(path, tick);
      expect(p.x, `x at ${tick}`).toBeCloseTo(x, 6);
      expect(p.offset, `offset at ${tick}`).toBeCloseTo(scrollOffset(v, x), 6);
    }
  });

  it('holds still until the playhead reaches the anchor, then scrolls, and stops at the end', () => {
    const r = fakeRender(64);
    const v = scrollView(r, 1, 800);
    const path = scrollPath(r, 64 * 24, v, 0, 64 * 24);
    expect(path[0].offset).toBe(0);
    expect(path[path.length - 1].offset).toBeLessThanOrEqual(v.maxOffset);
    // a point exactly where scrolling starts
    expect(path.some(p => p.offset === 0 && Math.abs(p.x * v.scale - v.anchor) < 1e-6)).toBe(true);
  });

  it('copes with a score too short to scroll', () => {
    const r = fakeRender(3);
    const v = scrollView(r, 1, 1200);
    const path = scrollPath(r, 48, v, 0, 48);
    expect(path.every(p => p.offset === 0)).toBe(true);
  });
});
