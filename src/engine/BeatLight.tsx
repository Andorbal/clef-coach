/**
 * A visual metronome for tempo mode: one dot per beat of the bar, the current
 * one flashing in time with the click (the downbeat in a stronger colour), and
 * a matching pulse on the playhead where the eyes already are. For when the
 * click is hard to hear over your instrument – or switched off.
 *
 * Beats arrive through a small bus rather than React state in the activity, so
 * each beat re-renders only the dots.
 */
import { useEffect, useRef, useState } from 'react';
import type { BeatInfo } from '../audio/metronome';

export function createBeatBus() {
  const subs = new Set<(b: BeatInfo) => void>();
  return {
    emit(b: BeatInfo): void {
      for (const cb of subs) cb(b);
    },
    subscribe(cb: (b: BeatInfo) => void): () => void {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
export type BeatBus = ReturnType<typeof createBeatBus>;

export function BeatLight({ bus, beats, active }: { bus: BeatBus; beats: number; active: boolean }) {
  const [cur, setCur] = useState<{ beat: number; n: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement | null>(null);

  useEffect(
    () =>
      bus.subscribe(b => {
        setCur(c => ({ beat: b.beat, n: (c?.n ?? 0) + 1 }));
        const paper = (paperRef.current ??= ref.current?.closest<HTMLElement>('.stage-paper') ?? null);
        if (paper) {
          // alternating names restart the CSS pulse on every beat
          paper.dataset.beat = paper.dataset.beat === 'a' ? 'b' : 'a';
          paper.dataset.downbeat = b.beat === 0 ? '1' : '0';
        }
      }),
    [bus],
  );

  useEffect(() => {
    if (active) return;
    setCur(null);
    const paper = paperRef.current;
    if (paper) {
      delete paper.dataset.beat;
      delete paper.dataset.downbeat;
    }
  }, [active]);

  if (!active) return null;
  const n = Math.min(12, Math.max(1, beats));
  return (
    <div ref={ref} className="beat-light" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const on = cur?.beat === i;
        // a new key per beat remounts the lit dot, restarting its flash
        return <span key={on ? `on${cur.n}` : i} className={`beat-dot${i === 0 ? ' down' : ''}${on ? ' on' : ''}`} />;
      })}
    </div>
  );
}
