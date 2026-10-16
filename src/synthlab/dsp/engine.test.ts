import { describe, expect, it } from 'vitest';
import { getFFT } from '../../audio/dsp/fft';
import { SynthCore } from './core';
import { Adsr, envelopeLevel } from './env';
import { filterResponse } from './filter';
import { ALGORITHMS } from './fm';
import { INIT_PATCH, PARAMS, PARAM_KEYS, type Patch, fromNorm, makePatch, toNorm } from './params';
import { mono, phrase, renderPhrase } from './render';
import { getTable, tableHarmonics } from './tables';
import { waveHarmonics } from './waves';

const SR = 32000;

const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (x: Float32Array, from = 0, to = x.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
};

/** Magnitudes of the first `count` harmonics of a steady note (f0 known). */
function harmonicsOf(x: Float32Array, f0: number, count: number, from = SR * 0.3): number[] {
  const N = 8192;
  const fft = getFFT(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[from + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  fft.transform(re, im);
  const out = [0];
  for (let h = 1; h <= count; h++) {
    const bin = Math.round((h * f0 * N) / SR);
    // energy around the peak: immune to where the harmonic falls between bins
    let e = 0;
    for (let b = bin - 3; b <= bin + 3; b++) e += re[b] * re[b] + im[b] * im[b];
    out.push(Math.sqrt(e));
  }
  return out;
}

const note = (p: Partial<Patch>, id: Parameters<typeof phrase>[0] = 'note') => mono(renderPhrase(makePatch(p), phrase(id), SR));

describe('params', () => {
  it('has a default for every key and makes patches within range', () => {
    for (const k of PARAM_KEYS) expect(INIT_PATCH[k]).toBe(PARAMS[k].def);
    const p = makePatch({ filterCutoff: 99999, ampAttack: -1, osc1Wave: 'kazoo' as never });
    expect(p.filterCutoff).toBe(18000);
    expect(p.ampAttack).toBe(0);
    expect(p.osc1Wave).toBe('saw');
  });

  it('maps knob travel both ways', () => {
    for (const k of PARAM_KEYS) {
      const s = PARAMS[k];
      if (s.kind !== 'num') continue;
      for (const t of [0, 0.25, 0.5, 0.9, 1]) {
        const v = fromNorm(s, t);
        expect(v).toBeGreaterThanOrEqual(s.min);
        expect(v).toBeLessThanOrEqual(s.max);
        if (!s.step) expect(toNorm(s, v)).toBeCloseTo(t, 2);
      }
    }
  });
});

describe('envelopes', () => {
  it('reaches full at the attack time and settles by the decay time', () => {
    const rate = 1000;
    const e = new Adsr();
    e.set(0.2, 0.5, 0.4, 0.3, rate);
    e.gateOn();
    const levels: number[] = [];
    for (let i = 0; i < 1000; i++) levels.push(e.next());
    expect(levels[195]).toBeLessThan(1);
    expect(levels[205]).toBeGreaterThan(0.95);
    expect(levels[200 + 500]).toBeCloseTo(0.4, 1);
    // the drawing follows the same curve
    expect(envelopeLevel(0.2, 0.5, 0.4, 0.3, 2, 0.1)).toBeCloseTo(levels[99], 1);
    e.gateOff();
    for (let i = 0; i < 300; i++) e.next();
    expect(e.level).toBeLessThan(0.4 * 0.01);
  });
});

describe('the synth', () => {
  it('renders the same samples every time', () => {
    const p = { unison: 5, noiseLevel: 0.3, lfoShape: 'random' as const, lfoCutoff: 2, filterOn: true, filterCutoff: 800 };
    const a = note(p);
    const b = note(p);
    expect(a).toEqual(b);
  });

  it('plays a saw at a sensible level with every harmonic', () => {
    const x = note({});
    expect(peak(x)).toBeGreaterThan(0.1);
    expect(peak(x)).toBeLessThan(0.8);
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const h = harmonicsOf(x, f0, 8);
    // 1/n slope
    expect(h[2] / h[1]).toBeCloseTo(0.5, 1);
    expect(h[3] / h[1]).toBeCloseTo(1 / 3, 1);
  });

  it('makes squares hollow (odd harmonics) and sines pure', () => {
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const sq = harmonicsOf(note({ osc1Wave: 'square' }), f0, 6);
    expect(sq[2] / sq[1]).toBeLessThan(0.05);
    expect(sq[3] / sq[1]).toBeCloseTo(1 / 3, 1);
    const sn = harmonicsOf(note({ osc1Wave: 'sine' }), f0, 4);
    expect(sn[2] / sn[1]).toBeLessThan(0.01);
  });

  it('keeps the four waves at similar loudness', () => {
    const levels = (['sine', 'triangle', 'saw', 'square'] as const).map(w => rms(note({ osc1Wave: w }), SR * 0.2, SR * 0.9));
    const lo = Math.min(...levels);
    const hi = Math.max(...levels);
    expect(20 * Math.log10(hi / lo)).toBeLessThan(4);
  });

  it('filters: a low cutoff darkens, resonance peaks', () => {
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const open = harmonicsOf(note({}), f0, 12);
    const dark = harmonicsOf(note({ filterOn: true, filterCutoff: 400 }), f0, 12);
    expect(dark[10] / dark[1]).toBeLessThan((open[10] / open[1]) * 0.05);
    expect(filterResponse('lowpass', '24', 1000, 0.8, 1000)).toBeGreaterThan(2);
    expect(filterResponse('lowpass', '24', 1000, 0, 4000)).toBeLessThan(0.01);
    expect(filterResponse('highpass', '12', 1000, 0, 100)).toBeLessThan(0.02);
    expect(filterResponse('bandpass', '12', 1000, 0.5, 1000)).toBeCloseTo(1, 1);
  });

  it('stays bounded with every effect and full resonance', () => {
    const x = note({ filterOn: true, filterRes: 1, filterDrive: 1, unison: 7, osc2Level: 1, ringLevel: 1, subLevel: 1, noiseLevel: 1, drive: 1, chorusMix: 1, delayMix: 1, delayFeedback: 0.9, reverbMix: 1, reverbSize: 1, volume: 1 }, 'chord');
    expect(peak(x)).toBeLessThanOrEqual(1);
    expect(x.every(Number.isFinite)).toBe(true);
  });

  it('obeys the amp envelope', () => {
    const slow = note({ ampAttack: 0.8 });
    expect(rms(slow, 0, SR * 0.1)).toBeLessThan(rms(slow, SR * 0.8, SR * 0.95) * 0.3);
    const pluck = note({ ampSustain: 0, ampDecay: 0.2 });
    expect(rms(pluck, SR * 0.6, SR * 0.9)).toBeLessThan(0.001);
  });

  it('octave and semitone knobs move the pitch', () => {
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const up = harmonicsOf(note({ osc1Wave: 'sine', osc1Octave: 1 }), f0, 2);
    expect(up[2] / Math.max(1e-9, up[1])).toBeGreaterThan(50);
  });

  it('plays FM: a modulator adds harmonics, its envelope makes them fade', () => {
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const plain = harmonicsOf(note({ engine: 'fm' }), f0, 5);
    expect(plain[2] / plain[1]).toBeLessThan(0.01);
    const bright = harmonicsOf(note({ engine: 'fm', op2Level: 0.6, op2Ratio: 1 }), f0, 5);
    expect(bright[2] / bright[1]).toBeGreaterThan(0.2);
    for (let a = 0; a < ALGORITHMS.length; a++) {
      const x = note({ engine: 'fm', fmAlgo: a, op2Level: 0.5, op3Level: 0.5, op4Level: 0.5, fmFeedback: 1 });
      expect(x.every(Number.isFinite)).toBe(true);
      expect(peak(x)).toBeGreaterThan(0.05);
    }
  });

  it('plays additive harmonics as set', () => {
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const h = harmonicsOf(note({ engine: 'additive', h1: 1, h3: 0.5, h5: 0.25 }), f0, 6);
    expect(h[3] / h[1]).toBeCloseTo(0.5, 1);
    expect(h[5] / h[1]).toBeCloseTo(0.25, 1);
    expect(h[2] / h[1]).toBeLessThan(0.01);
    const closed = harmonicsOf(note({ engine: 'additive', h1: 1, h3: 0.5, h5: 0.25, addOpen: 2 }), f0, 6);
    expect(closed[3] / closed[1]).toBeLessThan(0.01);
  });

  it('builds wavetables that morph', () => {
    const t = getTable('basic');
    expect(t.data[0]).toHaveLength(16);
    const sineEnd = tableHarmonics('basic', 0, 8);
    expect(sineEnd[3]).toBeLessThan(0.01);
    const sawEnd = tableHarmonics('basic', 2 / 3, 8);
    expect(sawEnd[2]).toBeCloseTo(0.5, 1);
    const f0 = 440 * Math.pow(2, (48 - 69) / 12);
    const h = harmonicsOf(note({ engine: 'wavetable', osc1Table: 'basic', osc1Pos: 2 / 3 }), f0, 4);
    expect(h[2] / h[1]).toBeCloseTo(0.5, 1);
    expect(waveHarmonics('saw', 4)[2] / waveHarmonics('saw', 4)[1]).toBeCloseTo(0.5, 5);
  });

  it('glides in legato mode', () => {
    const p = makePatch({ voiceMode: 'legato', glide: 0.3, osc1Wave: 'sine' });
    const core = new SynthCore(SR);
    core.setPatch(p);
    const l = new Float32Array(SR);
    const r = new Float32Array(SR);
    core.noteOn(48);
    core.render(l, r, SR / 4);
    core.noteOn(60);
    core.render(l, r, SR / 2, SR / 4);
    expect(core.activeVoices()).toBe(1);
  });

  it('renders fast enough for a tablet', () => {
    const p = { unison: 3, osc2Level: 0.6, filterOn: true, filterCutoff: 1200, filterEnv: 0.4, lfoPitch: 10, chorusMix: 0.3, reverbMix: 0.2 };
    const t0 = performance.now();
    renderPhrase(makePatch(p), phrase('chord'), 48000, 2);
    const ms = performance.now() - t0;
    // two seconds of a three-voice, three-copy chord with effects
    expect(ms).toBeLessThan(400);
  });
});
