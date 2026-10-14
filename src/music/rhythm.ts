/** Ticks per quarter note. Divisible by 2, 3, 4, 8, 16 so triplets and 32nds are exact. */
export const PPQ = 48;

export type BaseDuration = 'w' | 'h' | 'q' | 'e' | 's' | 't' | 'x';

export const BASE_TICKS: Record<BaseDuration, number> = {
  w: PPQ * 4,
  h: PPQ * 2,
  q: PPQ,
  e: PPQ / 2,
  s: PPQ / 4,
  t: PPQ / 8,
  x: PPQ / 16,
};

export const VEX_DURATION: Record<BaseDuration, string> = {
  w: 'w', h: 'h', q: 'q', e: '8', s: '16', t: '32', x: '64',
};

export const DURATION_NAMES: Record<BaseDuration, string> = {
  w: 'whole', h: 'half', q: 'quarter', e: 'eighth', s: 'sixteenth', t: 'thirty-second', x: 'sixty-fourth',
};

export function durationTicks(base: BaseDuration, dots = 0, triplet = false): number {
  let t = BASE_TICKS[base];
  let add = t / 2;
  for (let i = 0; i < dots; i++) {
    t += add;
    add /= 2;
  }
  return triplet ? (t * 2) / 3 : t;
}

export type TimeSig = [number, number];

export function measureTicks(time: TimeSig): number {
  return (time[0] * PPQ * 4) / time[1];
}

/** Ticks per metronome beat (dotted quarter in 6/8, 9/8, 12/8). */
export function beatTicks(time: TimeSig): number {
  if (time[1] === 8 && time[0] % 3 === 0 && time[0] > 3) return PPQ * 1.5;
  return (PPQ * 4) / time[1];
}

/**
 * Metronome beats per bar, matching {@link beatTicks}: 4 in 4/4, 3 in 3/4 and
 * 3/8, 2 in 2/2 and 6/8, 4 in 12/8. This is also what a count-in counts.
 */
export function beatsPerBar(time: TimeSig): number {
  return Math.max(1, Math.round(measureTicks(time) / beatTicks(time)));
}

export function ticksToSeconds(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm);
}

/**
 * Break a tick length into a list of plain (possibly dotted) durations, largest first.
 * Used to write rests that fill a gap.
 */
export function splitTicks(ticks: number): { base: BaseDuration; dots: number }[] {
  const out: { base: BaseDuration; dots: number }[] = [];
  const order: BaseDuration[] = ['w', 'h', 'q', 'e', 's', 't', 'x'];
  let remain = ticks;
  while (remain > 0) {
    let placed = false;
    for (const b of order) {
      for (const dots of [1, 0]) {
        const t = durationTicks(b, dots);
        if (t <= remain && Number.isInteger(t)) {
          out.push({ base: b, dots });
          remain -= t;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) break;
  }
  return out;
}
