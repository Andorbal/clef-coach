import { describe, expect, it } from 'vitest';
import { renderPianoSamples, pianoNoteLength, PIANO_HIGHEST, PIANO_LOWEST } from './piano';
import { renderGuitarSamples, guitarNoteLength, GUITAR_HIGHEST, GUITAR_LOWEST } from './guitar';
import { detectPitch, computeSpectrum } from '../input/pitch';
import { peakAbs, rmsRange } from '../dsp/util';

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
  const seg = s.subarray(from, from + 4096);
  const mags = computeSpectrum(seg);
  let num = 0;
  let den = 0;
  for (let k = 1; k < mags.length; k++) {
    num += k * mags[k];
    den += mags[k];
  }
  return ((num / den) * SR) / 4096;
}

describe('piano renderer', () => {
  it('renders the full 88-key range A0–C8 without NaN or clipping, with even loudness', () => {
    const early: number[] = [];
    for (let m = PIANO_LOWEST; m <= PIANO_HIGHEST; m++) {
      for (const v of [0.3, 0.9]) {
        const s = renderPianoSamples(m, v, SR);
        expect(s.length).toBe(pianoNoteLength(m, SR));
        expect(allFinite(s), `midi ${m} v${v}`).toBe(true);
        expect(peakAbs(s), `midi ${m} v${v}`).toBeLessThanOrEqual(0.95 + 1e-6);
        expect(peakAbs(s)).toBeGreaterThan(0.1);
        early.push(rmsRange(s, 0, Math.round(0.3 * SR)));
      }
    }
    // loudness of the attack portion stays within ~4 dB across the keyboard
    expect(db(Math.max(...early)) - db(Math.min(...early))).toBeLessThan(4.5);
  });

  it('decays sensibly: ringing tail, quiet end, low notes ring longer', () => {
    const tailDrop: Record<number, number> = {};
    for (const m of [33, 48, 60, 72, 84, 96]) {
      const s = renderPianoSamples(m, 0.7, SR);
      const e = rmsRange(s, 0, Math.round(0.3 * SR));
      const at1s = rmsRange(s, SR, Math.round(1.3 * SR));
      const end = rmsRange(s, s.length - Math.round(0.2 * SR), s.length);
      expect(db(end) - db(e), `midi ${m} end`).toBeLessThan(-40);
      tailDrop[m] = db(at1s) - db(e);
    }
    // two-stage decay: still audible after 1 s in the bass/mid, dropping faster up high
    expect(tailDrop[33]).toBeGreaterThan(-15);
    expect(tailDrop[60]).toBeGreaterThan(-26);
    expect(tailDrop[33]).toBeGreaterThan(tailDrop[60]);
    expect(tailDrop[60]).toBeGreaterThan(tailDrop[96]);
  });

  it('is in tune (stretch-compensated) across the playable range', () => {
    for (const m of [36, 43, 48, 55, 60, 64, 69, 72, 79, 84, 91, 96]) {
      const s = renderPianoSamples(m, 0.6, SR);
      const p = detectPitch(s.subarray(Math.round(0.25 * SR), Math.round(0.25 * SR) + 4096), SR, { minFreq: 50 });
      expect(p, `midi ${m}`).not.toBeNull();
      expect(Math.abs(cents(p!.freq, hz(m))), `midi ${m}: ${p!.freq}`).toBeLessThan(12);
    }
  });

  it('velocity controls brightness', () => {
    for (const m of [48, 60, 72]) {
      const soft = renderPianoSamples(m, 0.2, SR);
      const hard = renderPianoSamples(m, 0.95, SR);
      expect(centroid(hard, 2400)).toBeGreaterThan(centroid(soft, 2400) * 1.15);
    }
  });

  it('renders into a caller-provided buffer (AudioBuffer channel data)', () => {
    const out = new Float32Array(pianoNoteLength(60, SR));
    const r = renderPianoSamples(60, 0.7, SR, { out });
    expect(r).toBe(out);
    expect(peakAbs(out)).toBeGreaterThan(0.1);
    // deterministic
    expect(Array.from(renderPianoSamples(60, 0.7, SR).subarray(1000, 1010))).toEqual(Array.from(out.subarray(1000, 1010)));
  });

  it('renders one note fast enough for the main thread', () => {
    for (let i = 0; i < 3; i++) renderPianoSamples(60 + i, 0.7, SR); // JIT warm-up
    const t: number[] = [];
    for (const m of [48, 60, 67, 76]) {
      const t0 = performance.now();
      renderPianoSamples(m, 0.7, SR);
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    // median well under ~15 ms on device; generous bound for slow CI machines
    expect(t[1]).toBeLessThan(30);
  });
});

describe('guitar renderer', () => {
  it('renders E2–E6 without NaN or clipping, with even loudness', () => {
    const early: number[] = [];
    for (let m = GUITAR_LOWEST; m <= GUITAR_HIGHEST; m++) {
      for (const v of [0.3, 0.9]) {
        const s = renderGuitarSamples(m, v, SR);
        expect(s.length).toBe(guitarNoteLength(m, SR));
        expect(allFinite(s), `midi ${m}`).toBe(true);
        expect(peakAbs(s)).toBeLessThanOrEqual(0.95 + 1e-6);
        early.push(rmsRange(s, 0, Math.round(0.3 * SR)));
      }
    }
    expect(db(Math.max(...early)) - db(Math.min(...early))).toBeLessThan(3);
  });

  it('is accurately tuned (Karplus–Strong fractional delay)', () => {
    for (const sr of [44100, 48000]) {
      for (const m of [40, 45, 50, 55, 59, 64, 69, 76, 84, 88]) {
        const s = renderGuitarSamples(m, 0.7, sr);
        const p = detectPitch(s.subarray(Math.round(0.3 * sr), Math.round(0.3 * sr) + 4096), sr);
        expect(p, `midi ${m}`).not.toBeNull();
        expect(Math.abs(cents(p!.freq, hz(m))), `midi ${m} @${sr}`).toBeLessThan(3);
      }
    }
  });

  it('low strings ring longer than high strings; tail decays to silence', () => {
    const drop = (m: number) => {
      const s = renderGuitarSamples(m, 0.7, SR);
      const e = rmsRange(s, 0, Math.round(0.3 * SR));
      expect(db(rmsRange(s, s.length - Math.round(0.2 * SR), s.length)) - db(e)).toBeLessThan(-40);
      return db(rmsRange(s, SR, Math.round(1.3 * SR))) - db(e);
    };
    const e2 = drop(40);
    const e4 = drop(64);
    const e6 = drop(88);
    expect(e2).toBeGreaterThan(e4);
    expect(e4).toBeGreaterThan(e6);
    expect(e2).toBeGreaterThan(-12);
  });

  it('velocity controls pluck brightness', () => {
    const soft = renderGuitarSamples(52, 0.15, SR);
    const hard = renderGuitarSamples(52, 0.95, SR);
    expect(centroid(hard, 1200)).toBeGreaterThan(centroid(soft, 1200) * 1.15);
  });

  it('renders quickly', () => {
    renderGuitarSamples(45, 0.7, SR);
    const t0 = performance.now();
    renderGuitarSamples(40, 0.7, SR);
    expect(performance.now() - t0).toBeLessThan(30);
  });
});
