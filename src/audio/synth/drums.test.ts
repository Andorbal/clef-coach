import { describe, expect, it } from 'vitest';
import {
  DRUM_KITS,
  DRUM_NOTES,
  DRUM_PEAK,
  drumAudibleSeconds,
  drumChokeGroup,
  drumGain,
  drumNoteLength,
  drumNoteName,
  drumPan,
  drumVelocityLevel,
  renderDrumSamples,
} from './drums';
import { computeSpectrum, detectPitch } from '../input/pitch';
import { peakAbs, rmsRange } from '../dsp/util';
import { audibleDuration } from '../sounds';

const SR = 48000;
const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));

function allFinite(s: Float32Array): boolean {
  for (let i = 0; i < s.length; i++) if (!Number.isFinite(s[i])) return false;
  return true;
}

/**
 * Magnitude spectrum of the first `n` samples under a half-Hann taper (1 at
 * the hit, 0 at the end): keeps the attack, which a symmetric window would
 * suppress, without truncation leakage.
 */
function hitSpectrum(s: Float32Array, n = 4096): Float32Array {
  const seg = new Float32Array(n);
  for (let i = 0; i < n && i < s.length; i++) seg[i] = s[i] * (0.5 + 0.5 * Math.cos((Math.PI * i) / n));
  return computeSpectrum(seg, { window: 'none' });
}

/** Spectral centroid (Hz): magnitude-weighted ("brightness") or power-weighted ("where the energy is"). */
function centroid(s: Float32Array, power = false, n = 4096): number {
  const m = hitSpectrum(s, n);
  let num = 0;
  let den = 0;
  for (let k = 1; k < m.length; k++) {
    const w = power ? m[k] * m[k] : m[k];
    num += k * w;
    den += w;
  }
  return ((num / den) * SR) / n;
}

describe('drum kits', () => {
  it('render every note of every kit: finite, declared length, ≤ 0.95, clearly audible', () => {
    for (const kit of DRUM_KITS) {
      for (const n of DRUM_NOTES) {
        const s = renderDrumSamples(n, 0.8, SR, { kit });
        const tag = `${kit} ${n} ${drumNoteName(n)}`;
        expect(s.length, tag).toBe(drumNoteLength(n, SR, kit));
        expect(allFinite(s), tag).toBe(true);
        const pk = peakAbs(s);
        expect(pk, tag).toBeLessThanOrEqual(0.95);
        // peak-normalised to a consistent level, then velocity
        expect(pk, tag).toBeCloseTo(DRUM_PEAK * drumVelocityLevel(0.8), 5);
        expect(rmsRange(s, 0, Math.min(s.length, Math.round(0.05 * SR))), tag).toBeGreaterThan(0.02);
        // the declared audible time covers what is actually heard (−40 dB) and fits the buffer
        const declared = drumAudibleSeconds(n, kit);
        expect(declared, tag).toBeGreaterThan(0);
        expect(declared, tag).toBeLessThanOrEqual(s.length / SR + 1e-9);
        expect(audibleDuration([s], SR, 40), tag).toBeLessThanOrEqual(declared * 1.3 + 0.03);
        // no truncation click: the buffer ends in silence
        expect(db(rmsRange(s, s.length - Math.round(0.01 * SR), s.length)) - db(pk), tag).toBeLessThan(-40);
      }
    }
  });

  it('covers the GM percussion map (35–81) plus Sticks and the GS/GM2 extras', () => {
    for (let n = 35; n <= 81; n++) expect(DRUM_NOTES).toContain(n);
    expect(DRUM_NOTES).toContain(31);
    for (const n of DRUM_NOTES) {
      expect(drumNoteName(n), `${n}`).toBeTruthy();
      expect(drumGain(n), `${n}`).toBeGreaterThan(0);
      expect(drumGain(n), `${n}`).toBeLessThanOrEqual(1);
      expect(Math.abs(drumPan(n)), `${n}`).toBeLessThanOrEqual(0.5);
    }
  });

  it('names notes with their GM names', () => {
    expect(drumNoteName(36)).toBe('Bass Drum 1');
    expect(drumNoteName(38)).toBe('Acoustic Snare');
    expect(drumNoteName(42)).toBe('Closed Hi-Hat');
    expect(drumNoteName(31)).toBe('Sticks');
    expect(drumNoteName(81)).toBe('Open Triangle');
    expect(drumNoteName(26)).toBeNull();
    expect(drumNoteName(88)).toBeNull();
    expect(drumNoteName(38.5)).toBeNull();
  });

  it('velocity changes both level and brightness', () => {
    const core = [35, 36, 38, 39, 40, 41, 42, 44, 45, 46, 48, 49, 50, 51, 53, 54, 55, 56, 57, 59];
    for (const kit of DRUM_KITS) {
      for (const n of core) {
        const soft = renderDrumSamples(n, 0.3, SR, { kit });
        const hard = renderDrumSamples(n, 1, SR, { kit });
        const tag = `${kit} ${n} ${drumNoteName(n)}`;
        expect(peakAbs(hard) / peakAbs(soft), tag).toBeGreaterThan(3);
        expect(centroid(hard) / centroid(soft), tag).toBeGreaterThan(1.08);
      }
    }
    expect(drumVelocityLevel(0)).toBeGreaterThan(0);
    expect(drumVelocityLevel(1)).toBe(1);
  });

  it('is deterministic per seed', () => {
    for (const n of [36, 38, 42, 49, 54, 70]) {
      const a = renderDrumSamples(n, 0.7, SR, { seed: 1234 });
      const b = renderDrumSamples(n, 0.7, SR, { seed: 1234 });
      expect(Array.from(a)).toEqual(Array.from(b));
    }
    // noise-based voices really use the seed
    const s1 = renderDrumSamples(38, 0.7, SR, { seed: 1 });
    const s2 = renderDrumSamples(38, 0.7, SR, { seed: 2 });
    expect(Array.from(s1.subarray(2000, 2100))).not.toEqual(Array.from(s2.subarray(2000, 2100)));
    // the default seed is fixed too
    expect(Array.from(renderDrumSamples(42, 0.6, SR, { kit: 'jazz' }))).toEqual(Array.from(renderDrumSamples(42, 0.6, SR, { kit: 'jazz' })));
  });

  it('renders into a caller-provided buffer (AudioBuffer channel data), even a dirty one', () => {
    const ref = renderDrumSamples(38, 0.7, SR, { kit: 'room' });
    const out = new Float32Array(drumNoteLength(38, SR, 'room')).fill(0.5);
    const r = renderDrumSamples(38, 0.7, SR, { kit: 'room', out });
    expect(r).toBe(out);
    expect(Array.from(out)).toEqual(Array.from(ref));
  });

  it('puts the kick energy low and the hi-hats high', () => {
    for (const kit of DRUM_KITS) {
      for (const n of [35, 36]) {
        expect(centroid(renderDrumSamples(n, 0.8, SR, { kit }), true, 8192), `${kit} ${n}`).toBeLessThan(150);
      }
      for (const n of [42, 44, 46]) {
        expect(centroid(renderDrumSamples(n, 0.8, SR, { kit }), true), `${kit} ${n}`).toBeGreaterThan(4000);
      }
    }
  });

  it('tunes the toms from low floor (41) up to high tom (50)', () => {
    const toms = [41, 43, 45, 47, 48, 50];
    for (const kit of DRUM_KITS) {
      const peaks = toms.map((n) => {
        const s = renderDrumSamples(n, 0.7, SR, { kit });
        const from = Math.round(0.05 * SR);
        const m = computeSpectrum(s.subarray(from, from + 16384));
        let best = 1;
        for (let k = 2; (k * SR) / 16384 < 400; k++) if (m[k] > m[best]) best = k;
        return (best * SR) / 16384;
      });
      for (let i = 1; i < peaks.length; i++) expect(peaks[i], `${kit}: ${peaks.join(', ')}`).toBeGreaterThan(peaks[i - 1]);
    }
    // and they are pitched: the floor tom settles near its tuning
    const s = renderDrumSamples(41, 0.7, SR);
    const p = detectPitch(s.subarray(Math.round(0.15 * SR), Math.round(0.15 * SR) + 8192), SR, { minFreq: 40, maxFreq: 400 });
    expect(p).not.toBeNull();
    expect(p!.freq).toBeGreaterThan(70);
    expect(p!.freq).toBeLessThan(95);
  });

  it('closes the hi-hat short and lets the open hat ring', () => {
    for (const kit of DRUM_KITS) {
      const closed = audibleDuration([renderDrumSamples(42, 0.8, SR, { kit })], SR, 40);
      const pedal = audibleDuration([renderDrumSamples(44, 0.8, SR, { kit })], SR, 40);
      const open = audibleDuration([renderDrumSamples(46, 0.8, SR, { kit })], SR, 40);
      expect(closed, kit).toBeLessThan(open * 0.35);
      expect(pedal, kit).toBeLessThanOrEqual(closed);
      expect(drumAudibleSeconds(42, kit)).toBeLessThan(drumAudibleSeconds(46, kit) * 0.5);
    }
  });

  it('shares choke groups the GM way', () => {
    const hat = drumChokeGroup(42);
    expect(hat).toBeGreaterThan(0);
    expect(drumChokeGroup(44)).toBe(hat);
    expect(drumChokeGroup(46)).toBe(hat);
    const pairs = [
      [71, 72], // whistle
      [73, 74], // guiro
      [78, 79], // cuica
      [80, 81], // triangle
    ];
    const groups = new Set([hat]);
    for (const [a, b] of pairs) {
      expect(drumChokeGroup(a)).toBeGreaterThan(0);
      expect(drumChokeGroup(b)).toBe(drumChokeGroup(a));
      groups.add(drumChokeGroup(a));
    }
    expect(groups.size).toBe(pairs.length + 1);
    for (const n of [35, 36, 38, 41, 49, 51, 54, 56]) expect(drumChokeGroup(n), `${n}`).toBe(0);
  });

  it('places the kit from the drummer’s seat and balances it', () => {
    expect(drumPan(36)).toBe(0);
    expect(drumPan(42)).toBeLessThan(0); // hi-hat left
    expect(drumPan(41)).toBeGreaterThan(0); // floor tom right
    expect(drumPan(51)).toBeGreaterThan(0); // ride right
    expect(drumPan(50)).toBeLessThan(drumPan(41)); // toms sweep left → right as they get lower
    // kick and snare similar, hats well below them
    expect(Math.abs(db(drumGain(36)) - db(drumGain(38)))).toBeLessThan(3);
    expect(db(drumGain(42))).toBeLessThan(db(drumGain(38)) - 6);
    expect(db(drumGain(51))).toBeLessThan(db(drumGain(38)) - 6);
    // kit-specific trims (an 808 kick carries far more energy than an acoustic one)
    expect(drumGain(36, 'electronic')).toBeLessThan(drumGain(36));
    expect(drumGain(60, 'electronic')).toBe(drumGain(60));
  });

  it('renders unknown notes as silence', () => {
    for (const n of [0, 26, 88, 127]) {
      const s = renderDrumSamples(n, 1, SR);
      expect(s.length).toBe(drumNoteLength(n, SR));
      expect(peakAbs(s)).toBe(0);
      expect(drumGain(n)).toBe(0);
      expect(drumAudibleSeconds(n)).toBe(0);
    }
  });

  it('renders typical hits quickly', () => {
    const typical = [36, 38, 42, 44, 46, 45, 39, 37];
    for (const n of typical) renderDrumSamples(n, 0.7, SR); // JIT warm-up
    const t: number[] = [];
    for (const n of typical) {
      const t0 = performance.now();
      renderDrumSamples(n, 0.7, SR);
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    // ~1–3 ms each on a laptop; generous bound for slow CI machines
    expect(t[t.length >> 1]).toBeLessThan(15);
    const c0 = performance.now();
    renderDrumSamples(57, 0.7, SR); // the longest cymbal
    expect(performance.now() - c0).toBeLessThan(60);
  });
});
