/**
 * The LFO (low-frequency oscillator): a wave too slow to hear as a note, used to move
 * another control back and forth. Every voice has its own, started from the beginning of
 * its cycle when the note starts (a "retriggered" LFO), so each note wobbles the same way
 * and a sound can be compared with another exactly.
 */
import type { LfoShape } from './params';

/** The LFO's value (−1..1) at a phase; `held` is the sample-and-hold value for 'random'. */
export function lfoValue(shape: LfoShape, phase: number, held = 0): number {
  const p = phase - Math.floor(phase);
  switch (shape) {
    case 'sine':
      return Math.sin(2 * Math.PI * p);
    case 'triangle': {
      const q = p + 0.25;
      return 1 - 4 * Math.abs(q - Math.floor(q) - 0.5);
    }
    case 'saw':
      // a falling ramp: jumps up, slides down (the shape of a repeated pluck)
      return 1 - 2 * p;
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'random':
      return held;
  }
}

export class Lfo {
  phase = 0;
  held = 0;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0 || 1;
  }

  reset(seed: number): void {
    this.phase = 0;
    this.seed = seed >>> 0 || 1;
    this.held = this.rand();
  }

  private rand(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 4294967296) * 2 - 1;
  }

  /** Advance by `dt` cycles and return the value. */
  step(shape: LfoShape, dt: number): number {
    this.phase += dt;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      if (shape === 'random') this.held = this.rand();
    }
    return lfoValue(shape, this.phase, this.held);
  }
}
