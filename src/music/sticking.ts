/**
 * Mallet sticking: which mallet strikes each note on a marimba, xylophone,
 * glockenspiel or vibraphone.
 *
 * Mallets are numbered the standard (Stevens) way, left to right as you face the
 * instrument: 1 and 2 in the left hand (1 = outer), 3 and 4 in the right hand
 * (4 = outer). Two-mallet playing uses one mallet per hand, stored as 2 (L) and 3 (R)
 * and shown as "L" / "R".
 *
 * Like the piano fingering engine this is a small dynamic program (Viterbi) over the
 * possible stickings, with an ergonomic cost model drawn from standard mallet method
 * books:
 *  - alternate hands whenever you can; lead with the right hand
 *  - avoid crossing one mallet over the other: small crossings in stepwise lines are
 *    normal, but a leap across the other hand is played with a double sticking
 *  - double stickings are cheap on slow notes and expensive on fast ones
 *  - in four-mallet playing, each hand holds an interval between a 2nd and an octave
 *    (a 3rd to a 6th is most comfortable); single lines use the inner mallets 2 and 3
 */
import { PPQ } from './rhythm';

export type MalletCount = 2 | 4;

export interface StickEvent {
  /** MIDI notes struck together (any order; results are aligned with the sorted order). */
  midis: number[];
  /** Ticks from this event's onset to the next one (speed of the passage). */
  gap?: number;
  /** Mallets already written in the music (aligned with sorted midis). */
  fixed?: (number | undefined)[];
}

export interface StickOptions {
  mallets?: MalletCount;
  /** Restrict to one hand (e.g. a grand-staff part for the left hand). */
  hand?: 'R' | 'L';
}

/** "L"/"R" for two mallets, "1"–"4" for four. */
export function malletLabel(mallet: number, mallets: MalletCount = 2): string {
  if (mallets === 2) return mallet <= 2 ? 'L' : 'R';
  return String(mallet);
}

/** Which hand holds a mallet. */
export function malletHand(mallet: number): 'L' | 'R' {
  return mallet <= 2 ? 'L' : 'R';
}

/** Parse a written sticking token: "L", "R" or "1"–"4". */
export function parseMallet(tok: string): number | undefined {
  const t = tok.trim().toUpperCase();
  if (t === 'L') return 2;
  if (t === 'R') return 3;
  const n = Number(t);
  return n >= 1 && n <= 4 ? n : undefined;
}

type Pos = [number, number, number, number]; // last pitch per mallet 1..4 (NaN = unknown)

interface Option {
  /** mallet per sorted note (undefined = not assignable) */
  mallets: (number | undefined)[];
}

function combos(k: number, pool: number[]): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < pool.length; i++) rec(i + 1, [...acc, pool[i]]);
  };
  rec(0, []);
  return out;
}

function optionsFor(sorted: number[], fixed: (number | undefined)[] | undefined, mallets: MalletCount, hand?: 'R' | 'L'): Option[] {
  const n = sorted.length;
  if (!n) return [{ mallets: [] }];
  let pool = mallets === 2 ? [2, 3] : [1, 2, 3, 4];
  if (hand && n <= 2) {
    const own = pool.filter(m => malletHand(m) === hand);
    if (own.length >= n) pool = own;
  }
  const k = Math.min(n, pool.length);
  let opts: Option[] = combos(k, pool).map(c => {
    // the extra (inner) notes of a too-big chord get no mallet
    if (n === k) return { mallets: c };
    const m: (number | undefined)[] = new Array(n).fill(undefined);
    m[0] = c[0];
    for (let i = 1; i < k; i++) m[n - k + i] = c[i];
    return { mallets: m };
  });
  if (fixed?.some(f => f !== undefined)) {
    const ok = opts.filter(o => o.mallets.every((m, i) => fixed[i] === undefined || fixed[i] === m));
    opts = ok.length ? ok : [{ mallets: sorted.map((_, i) => fixed[i] ?? opts[0].mallets[i]) }];
  }
  return opts;
}

/** Cost of striking with `opt` given where the mallets are. Returns [cost, new positions]. */
function strikeCost(opt: Option, sorted: number[], pos: Pos, prevUsed: number[], gap: number, mallets: MalletCount, first: boolean): [number, Pos] {
  const next: Pos = [...pos] as Pos;
  let cost = 0;
  const used: number[] = [];
  opt.mallets.forEach((m, i) => {
    if (m === undefined) return;
    used.push(m);
    next[m - 1] = sorted[i];
  });
  if (!used.length) return [0, next];
  const beats = gap / PPQ;
  // ---- re-using a mallet straight away (double sticking) ----
  const repeat = used.filter(m => prevUsed.includes(m)).length;
  if (repeat && used.length === 1 && prevUsed.length === 1) {
    cost += beats <= 0.26 ? 1.6 : beats <= 0.5 ? 0.9 : beats <= 1 ? 0.45 : 0.12;
  } else if (repeat) {
    cost += 0.1 * repeat;
  }
  // ---- crossings: a left mallet above a right one (or vice versa) ----
  const leftTop = Math.max(...[0, 1].map(i => next[i]).filter(x => !Number.isNaN(x)), -Infinity);
  const rightBottom = Math.min(...[2, 3].map(i => next[i]).filter(x => !Number.isNaN(x)), Infinity);
  if (Number.isFinite(leftTop) && Number.isFinite(rightBottom) && leftTop > rightBottom) {
    const d = leftTop - rightBottom;
    // the hand that just moved is the one crossing
    cost += d <= 4 ? 0.12 * d : 0.48 + 0.7 * (d - 4);
  } else if (Number.isFinite(leftTop) && leftTop === rightBottom && used.length === 1) {
    cost += 0.15;
  }
  // ---- within-hand intervals (four mallets) ----
  if (mallets === 4) {
    for (const [a, b] of [[0, 1], [2, 3]]) {
      const ua = used.includes(a + 1);
      const ub = used.includes(b + 1);
      if (!(ua || ub)) continue;
      const lo = next[a];
      const hi = next[b];
      if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
      const iv = hi - lo;
      if (iv < 1) cost += 6;
      else if (iv > 12) cost += 1.5 + (iv - 12) * 1.2;
      else if (iv <= 2 || iv >= 9) cost += 0.3;
      // outer mallet below/above its partner is impossible
      if (iv < 0) cost += 20;
    }
    // single lines: inner mallets
    if (used.length === 1 && (used[0] === 1 || used[0] === 4)) cost += 0.45;
  }
  // ---- movement ----
  for (const m of used) {
    const from = pos[m - 1];
    if (!Number.isNaN(from)) cost += Math.abs(next[m - 1] - from) * 0.03;
  }
  // ---- lead with the right hand ----
  if (first && used.length === 1 && malletHand(used[0]) === 'L') cost += 0.35;
  return [cost, next];
}

/**
 * Sticking for a sequence of events played by one player.
 * Returns one array per event, aligned with the event's midis sorted low → high.
 */
export function stickLine(events: StickEvent[], opts: StickOptions = {}): (number | undefined)[][] {
  const mallets = opts.mallets ?? 2;
  const n = events.length;
  if (!n) return [];
  const sortedEvents = events.map(e => [...e.midis].sort((a, b) => a - b));
  const options = events.map((e, i) => optionsFor(sortedEvents[i], e.fixed, mallets, opts.hand));
  const NaNPos: Pos = [NaN, NaN, NaN, NaN];
  // Viterbi with path-dependent mallet positions (each state keeps the positions of its best path)
  let layer = options[0].map(o => {
    const [c, p] = strikeCost(o, sortedEvents[0], NaNPos, [], PPQ, mallets, true);
    return { cost: c, pos: p, used: o.mallets.filter((m): m is number => m !== undefined) };
  });
  const back: number[][] = [options[0].map(() => -1)];
  for (let i = 1; i < n; i++) {
    const gap = events[i - 1].gap ?? PPQ;
    const restart = gap >= PPQ * 2; // after a long note or rest the lead hand starts again
    const nextLayer: typeof layer = [];
    const b: number[] = [];
    options[i].forEach(o => {
      let best = Infinity;
      let arg = 0;
      let bestPos: Pos = NaNPos;
      layer.forEach((prev, k) => {
        const [c, p] = strikeCost(o, sortedEvents[i], prev.pos, prev.used, gap, mallets, restart);
        const total = prev.cost + c;
        if (total < best) {
          best = total;
          arg = k;
          bestPos = p;
        }
      });
      nextLayer.push({ cost: best, pos: bestPos, used: o.mallets.filter((m): m is number => m !== undefined) });
      b.push(arg);
    });
    layer = nextLayer;
    back.push(b);
  }
  let j = layer.reduce((bi, s, k) => (s.cost < layer[bi].cost ? k : bi), 0);
  const out: (number | undefined)[][] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    out[i] = options[i][j].mallets;
    j = back[i][j];
  }
  return out;
}
