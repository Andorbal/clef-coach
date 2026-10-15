import { describe, expect, it } from 'vitest';
import {
  EPIANO_HIGHEST,
  EPIANO_LOWEST,
  epianoAudibleSeconds,
  epianoNoteLength,
  renderEPianoSamples,
} from './epiano';
import { detectPitch, computeSpectrum } from '../input/pitch';
import { peakAbs, rmsRange } from '../dsp/util';
import { audibleDuration } from '../sounds';

const SR = 48000;
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));

function allFinite(s: Float32Array): boolean {
  for (let i = 0; i < s.length; i++) if (!Number.isFinite(s[i])) return false;
  return true;
}

/** Spectral centroid of a 4096-sample segment (brightness measure). */
function centroid(s: Float32Array, from: number): number {
  const mags = computeSpectrum(s.subarray(from, from + 4096));
  let num = 0;
  let den = 0;
  for (let k = 1; k < mags.length; k++) {
    num += k * mags[k];
    den += mags[k];
  }
  return ((num / den) * SR) / 4096;
}

describe('electric piano renderer', () => {
  it('renders the whole range E1–G7 without NaN or clipping, with even loudness', () => {
    const early: number[] = [];
    for (let m = EPIANO_LOWEST; m <= EPIANO_HIGHEST; m++) {
      for (const v of [0.3, 0.9]) {
        const s = renderEPianoSamples(m, v, SR);
        expect(s.length).toBe(epianoNoteLength(m, SR));
        expect(allFinite(s), `midi ${m} v${v}`).toBe(true);
        expect(peakAbs(s), `midi ${m} v${v}`).toBeLessThanOrEqual(0.95 + 1e-6);
        expect(peakAbs(s)).toBeGreaterThan(0.1);
        early.push(rmsRange(s, 0, Math.round(0.3 * SR)));
      }
    }
    // the attack portion is loudness-normalised across the keyboard (velocity = timbre only)
    expect(db(Math.max(...early)) - db(Math.min(...early))).toBeLessThan(4.5);
  });

  it('is in tune across the range', () => {
    for (const m of [28, 33, 40, 45, 48, 55, 60, 64, 69, 72, 79, 84, 91, 96, 103]) {
      const s = renderEPianoSamples(m, 0.6, SR);
      const at = Math.round(0.25 * SR);
      const p = detectPitch(s.subarray(at, at + 4096), SR, { minFreq: 30, maxFreq: 4500 });
      expect(p, `midi ${m}`).not.toBeNull();
      expect(Math.abs(cents(p!.freq, hz(m))), `midi ${m}: ${p!.freq}`).toBeLessThan(15);
    }
  });

  it('decays sensibly: long tail, quiet end, low notes ring longer', () => {
    const drop: Record<number, number> = {};
    for (const m of [33, 48, 60, 72, 84, 96]) {
      const s = renderEPianoSamples(m, 0.7, SR);
      const e = rmsRange(s, 0, Math.round(0.3 * SR));
      expect(db(rmsRange(s, s.length - Math.round(0.2 * SR), s.length)) - db(e), `midi ${m} end`).toBeLessThan(-35);
      drop[m] = db(rmsRange(s, SR, Math.round(1.3 * SR))) - db(e);
    }
    expect(drop[33]).toBeGreaterThan(-10);
    expect(drop[33]).toBeGreaterThan(drop[60]);
    expect(drop[60]).toBeGreaterThan(drop[84]);
    expect(drop[84]).toBeGreaterThan(drop[96]);
  });

  it('declares how long each note stays audible', () => {
    for (const m of [28, 48, 60, 72, 96, 103]) {
      const s = renderEPianoSamples(m, 0.9, SR);
      const measured = audibleDuration([s], SR, 40);
      const declared = epianoAudibleSeconds(m);
      expect(declared).toBeLessThanOrEqual(s.length / SR);
      expect(Math.abs(measured - declared), `midi ${m}: ${measured} vs ${declared}`).toBeLessThan(0.25 * declared + 0.1);
    }
    expect(epianoAudibleSeconds(36)).toBeGreaterThan(epianoAudibleSeconds(84));
  });

  it('velocity brightens the tone (the pickup "bark")', () => {
    for (const m of [40, 48, 60, 72]) {
      const soft = renderEPianoSamples(m, 0.2, SR);
      const hard = renderEPianoSamples(m, 0.95, SR);
      expect(centroid(hard, 2400), `midi ${m}`).toBeGreaterThan(centroid(soft, 2400) * 1.2);
    }
  });

  it('renders deterministically into a caller-provided buffer', () => {
    const out = new Float32Array(epianoNoteLength(60, SR));
    const r = renderEPianoSamples(60, 0.7, SR, { out });
    expect(r).toBe(out);
    expect(peakAbs(out)).toBeGreaterThan(0.1);
    const again = renderEPianoSamples(60, 0.7, SR);
    expect(Array.from(again.subarray(1000, 1020))).toEqual(Array.from(out.subarray(1000, 1020)));
    // clamps out-of-range notes instead of failing
    expect(renderEPianoSamples(10, 0.5, SR).length).toBe(epianoNoteLength(EPIANO_LOWEST, SR));
    expect(allFinite(renderEPianoSamples(127, 0.5, SR))).toBe(true);
  });

  it('renders one note fast enough for the main thread', () => {
    for (let i = 0; i < 3; i++) renderEPianoSamples(60 + i, 0.7, SR); // JIT warm-up
    const t: number[] = [];
    for (const m of [48, 60, 67, 76]) {
      const t0 = performance.now();
      renderEPianoSamples(m, 0.7, SR);
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    expect(t[1]).toBeLessThan(30);
  });
});
