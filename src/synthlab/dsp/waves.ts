/**
 * Oscillator building blocks: band-limited classic waves, a sine table and a seeded noise
 * source. Everything here is a plain function of phase so the voices, the drawings in
 * the UI and the tests all agree on what a "saw" is.
 *
 * Phase runs 0..1 per cycle and every wave starts at zero going up, like a sine, so
 * oscillators started together line up and a drawn cycle looks the way the books draw it.
 *
 * The saw and square use PolyBLEP: the jump in the wave is smoothed over the two samples
 * around it, which removes most of the aliasing (the harsh, unmusical whine of a naive
 * saw played high) for the price of a couple of multiplications.
 */
import type { Wave } from './params';

/** PolyBLEP residual for a unit step at phase 0 (t = phase, dt = phase increment). */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

const SINE_SIZE = 4096;
const SINE = new Float64Array(SINE_SIZE + 1);
for (let i = 0; i <= SINE_SIZE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / SINE_SIZE);

/** sin(2π·phase) from a table (any phase, negative too). */
export function sine(phase: number): number {
  const p = (phase - Math.floor(phase)) * SINE_SIZE;
  const i = p | 0;
  const f = p - i;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * f;
}

/** Levels that keep the four waves at similar loudness (a square is twice a saw's power). */
const WAVE_GAIN: Record<Wave, number> = { sine: 1, triangle: 1, saw: 0.9, square: 0.68 };

/**
 * One sample of a band-limited wave. `pw` is the square's pulse width (0.5 = square).
 * The square and saw rise through zero at phase 0 like the others.
 */
export function waveSample(wave: Wave, phase: number, dt: number, pw: number): number {
  switch (wave) {
    case 'sine':
      return sine(phase);
    case 'triangle': {
      const p = phase + 0.25;
      const q = p - Math.floor(p);
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 'saw': {
      // rises from 0 to 1, drops to -1 at phase 0.5, rises back to 0
      let t = phase + 0.5;
      t -= Math.floor(t);
      return WAVE_GAIN.saw * (2 * t - 1 - polyBlep(t, dt));
    }
    case 'square': {
      let v = phase < pw ? 1 : -1;
      v += polyBlep(phase, dt);
      let t2 = phase - pw + 1;
      t2 -= Math.floor(t2);
      v -= polyBlep(t2, dt);
      return WAVE_GAIN.square * v;
    }
  }
}

/** The ideal (not band-limited) wave, for drawing. */
export function waveShape(wave: Wave, phase: number, pw = 0.5): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return Math.sin(2 * Math.PI * p);
    case 'triangle': {
      const q = (p + 0.25) % 1;
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 'saw':
      return WAVE_GAIN.saw * (2 * ((p + 0.5) % 1) - 1);
    case 'square':
      return WAVE_GAIN.square * (p < pw ? 1 : -1);
  }
}

/**
 * Harmonic amplitudes (1-based index, magnitude only) of a wave: what the spectrum
 * drawings and the filter lessons show. A saw has every harmonic at 1/n, a square only
 * the odd ones (for 50%), a triangle odd ones at 1/n².
 */
export function waveHarmonics(wave: Wave, count: number, pw = 0.5): number[] {
  const out = new Array<number>(count + 1).fill(0);
  for (let n = 1; n <= count; n++) {
    switch (wave) {
      case 'sine':
        out[n] = n === 1 ? 1 : 0;
        break;
      case 'triangle':
        out[n] = n % 2 ? 8 / (Math.PI * Math.PI * n * n) : 0;
        break;
      case 'saw':
        out[n] = (WAVE_GAIN.saw * 2) / (Math.PI * n);
        break;
      case 'square':
        out[n] = (WAVE_GAIN.square * 4 * Math.abs(Math.sin(Math.PI * n * pw))) / (Math.PI * n);
        break;
    }
  }
  return out;
}

/** xorshift32 white noise in −1..1 (a voice keeps its own state so renders repeat exactly). */
export function noise(state: Uint32Array): number {
  let x = state[0];
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state[0] = x;
  return (x >>> 0) / 2147483648 - 1;
}

/** Fast tanh-like soft clip (exact enough for saturation, ±1 beyond ±3). */
export function softClip(x: number): number {
  if (x <= -3) return -1;
  if (x >= 3) return 1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}
