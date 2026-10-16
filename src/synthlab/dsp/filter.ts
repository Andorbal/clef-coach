/**
 * The filter: a state-variable filter (Andrew Simper's trapezoidal "SVF"), which gives
 * low-pass, high-pass, band-pass and notch from one circuit and stays well-behaved while
 * its cutoff is swept by envelopes and LFOs every few samples — a plain biquad
 * recalculated that often can click or blow up.
 *
 * One stage slopes 12 dB per octave. The 24 dB mode runs two stages in a row (the
 * second carries the resonance), the steeper, "fatter" filter of a Moog or a Juno.
 * Resonance raises a peak at the cutoff; near the top it whistles. Like a ladder
 * filter, the pass band gets a little quieter as resonance rises, which keeps the peak
 * musical rather than ear-splitting.
 */
import type { FilterSlope, FilterType } from './params';

/** Resonance 0..1 → Q (0.707, the flattest response, up to about 20). */
export function qFromRes(res: number): number {
  const r = Math.min(1, Math.max(0, res));
  return 0.707 * Math.pow(28, Math.pow(r, 1.4));
}

/** Coefficients of one SVF stage. */
export class SvfStage {
  ic1 = 0;
  ic2 = 0;
  a1 = 1;
  a2 = 0;
  a3 = 0;
  k = 1.414;

  set(g: number, q: number): void {
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  reset(): void {
    this.ic1 = 0;
    this.ic2 = 0;
  }

  /** Process a sample; returns the chosen output. */
  run(v0: number, type: number): number {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    switch (type) {
      case 0:
        return v2;
      case 1:
        return v0 - this.k * v1 - v2;
      case 2:
        // normalised band-pass: unity at the centre whatever the resonance
        return this.k * v1;
      default:
        return v0 - this.k * v1;
    }
  }
}

export const FILTER_INDEX: Record<FilterType, number> = { lowpass: 0, highpass: 1, bandpass: 2, notch: 3 };

/** A complete filter (one or two stages) for one channel. */
export class Filter {
  readonly s1 = new SvfStage();
  readonly s2 = new SvfStage();
  type = 0;
  two = true;
  /** Pass-band trim for resonance (see header). */
  trim = 1;

  /** Set cutoff (Hz) and resonance for a sample rate. Call at control rate. */
  set(type: FilterType, slope: FilterSlope, cutoff: number, res: number, sampleRate: number): void {
    this.type = FILTER_INDEX[type];
    this.two = slope === '24';
    const fc = Math.min(cutoff, sampleRate * 0.45);
    const g = Math.tan((Math.PI * fc) / sampleRate);
    const q = qFromRes(res);
    if (this.two) {
      this.s1.set(g, 0.541);
      this.s2.set(g, Math.min(24, 1.307 * (q / 0.707)));
    } else this.s1.set(g, q);
    this.trim = this.type <= 1 ? 1 / Math.sqrt(Math.max(1, q / 0.707)) : 1;
  }

  reset(): void {
    this.s1.reset();
    this.s2.reset();
  }

  run(x: number): number {
    const y = this.s1.run(x, this.type);
    return (this.two ? this.s2.run(y, this.type) : y) * this.trim;
  }
}

/**
 * Magnitude response (linear) of the filter at `freq`, from the analogue prototype the
 * SVF follows. For the filter drawing.
 */
export function filterResponse(type: FilterType, slope: FilterSlope, cutoff: number, res: number, freq: number): number {
  const w = freq / cutoff;
  const q = qFromRes(res);
  const stage = (qq: number, t: number) => {
    // H(s) for s = jw: lp 1, hp s², bp s/Q, notch s²+1, over s² + s/Q + 1
    const dr = 1 - w * w;
    const di = w / qq;
    const den = Math.hypot(dr, di);
    switch (t) {
      case 0:
        return 1 / den;
      case 1:
        return (w * w) / den;
      case 2:
        return w / qq / den;
      default:
        return Math.abs(1 - w * w) / den;
    }
  };
  const t = FILTER_INDEX[type];
  const trim = t <= 1 ? 1 / Math.sqrt(Math.max(1, q / 0.707)) : 1;
  if (slope === '24') return stage(0.541, t) * stage(Math.min(24, 1.307 * (q / 0.707)), t) * trim;
  return stage(q, t) * trim;
}
