import { describe, expect, it } from 'vitest';
import {
  computeSpectrum,
  detectPitch,
  noteSalience,
  NoteTracker,
  rms,
  verifyChord,
} from './pitch';
import type { PitchFrame, TrackerEvent } from './pitch';
import { mulberry32 } from '../dsp/util';

// ---------------------------------------------------------------------------
// Synthetic signal helpers
// ---------------------------------------------------------------------------

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

interface ToneOpts {
  amps?: number[];
  noise?: number; // white-noise RMS
  inharm?: number; // stretch coefficient B
  seed?: number;
  gain?: number;
}

/** Harmonic tone: Σ a_h·sin(2π·h·f·√(1+B h²)·t + φ_h) (+ noise). */
function tone(freq: number, sr: number, n: number, o: ToneOpts = {}): Float32Array {
  const amps = o.amps ?? [1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8];
  const rand = mulberry32(o.seed ?? 1);
  const out = new Float32Array(n);
  const g = o.gain ?? 0.3;
  amps.forEach((a, i) => {
    const h = i + 1;
    const f = h * freq * Math.sqrt(1 + (o.inharm ?? 0) * h * h);
    if (f >= sr / 2) return;
    const ph = rand() * Math.PI * 2;
    const w = (2 * Math.PI * f) / sr;
    for (let k = 0; k < n; k++) out[k] += g * a * Math.sin(w * k + ph);
  });
  if (o.noise) addNoise(out, o.noise, (o.seed ?? 1) + 99);
  return out;
}

function chord(midis: number[], sr: number, n: number, o: ToneOpts = {}): Float32Array {
  const out = new Float32Array(n);
  midis.forEach((m, i) => {
    const t = tone(midiToFreq(m), sr, n, { ...o, noise: 0, seed: (o.seed ?? 1) + i * 17 });
    for (let k = 0; k < n; k++) out[k] += t[k];
  });
  if (o.noise) addNoise(out, o.noise, (o.seed ?? 1) + 7);
  return out;
}

function addNoise(buf: Float32Array, level: number, seed: number) {
  const r = mulberry32(seed);
  // roughly Gaussian (sum of uniforms), unit variance scaled to `level` RMS
  for (let k = 0; k < buf.length; k++) {
    const u = r() + r() + r() + r() - 2;
    buf[k] += u * level * Math.sqrt(3);
  }
}

function noise(n: number, level: number, seed = 5): Float32Array {
  const b = new Float32Array(n);
  addNoise(b, level, seed);
  return b;
}

// ---------------------------------------------------------------------------
// detectPitch
// ---------------------------------------------------------------------------

describe('detectPitch (YIN)', () => {
  const SRS = [44100, 48000];
  // E2..C7 plus A1, in steps that cover every register
  const MIDIS = [33, 36, 40, 43, 45, 47, 50, 52, 55, 57, 60, 62, 64, 67, 69, 71, 72, 76, 79, 81, 84, 88, 91, 93, 96];

  it('is within ±10 cents on 1/n harmonic tones from A1 to C7', () => {
    for (const sr of SRS) {
      for (const m of MIDIS) {
        const f = midiToFreq(m);
        const r = detectPitch(tone(f, sr, 4096, { seed: m }), sr);
        expect(r, `midi ${m} @${sr}`).not.toBeNull();
        expect(Math.abs(cents(r!.freq, f)), `midi ${m} @${sr} got ${r!.freq}`).toBeLessThan(10);
        expect(r!.clarity).toBeGreaterThan(0.85);
      }
    }
  });

  it('handles weak fundamentals / strong 2nd harmonic without octave errors', () => {
    const profiles = [
      [0.15, 1, 0.5, 0.35, 0.25, 0.2], // piano-bass-like
      [0.05, 1, 0.3, 0.5, 0.1, 0.2, 0.05, 0.1], // almost missing fundamental, strong evens
      [0.3, 1, 0.8, 0.4, 0.3], // guitar-like
      [0, 1, 0.6, 0.4, 0.3, 0.2], // missing fundamental
    ];
    for (const amps of profiles) {
      for (const m of [33, 40, 45, 52, 57, 64, 69, 76, 84]) {
        const sr = 48000;
        const f = midiToFreq(m);
        const r = detectPitch(tone(f, sr, 4096, { amps, seed: m, noise: 0.002 }), sr);
        expect(r, `midi ${m} amps ${amps}`).not.toBeNull();
        expect(Math.abs(cents(r!.freq, f)), `midi ${m} amps ${amps} got ${r!.freq}`).toBeLessThan(10);
      }
    }
  });

  it('copes with noise and slight inharmonicity', () => {
    for (const m of [40, 48, 57, 64, 72, 84, 96]) {
      const sr = 44100;
      const f = midiToFreq(m);
      const r = detectPitch(tone(f, sr, 4096, { seed: m, noise: 0.02, inharm: 0.0003 }), sr);
      expect(r, `midi ${m}`).not.toBeNull();
      expect(Math.abs(cents(r!.freq, f)), `midi ${m} got ${r!.freq}`).toBeLessThan(10);
    }
  });

  it('works with a 2048-sample window from E2 upward', () => {
    for (const m of [40, 45, 52, 60, 69, 81, 96]) {
      const sr = 48000;
      const f = midiToFreq(m);
      const r = detectPitch(tone(f, sr, 2048, { seed: m }), sr, { minFreq: 70 });
      expect(r, `midi ${m}`).not.toBeNull();
      expect(Math.abs(cents(r!.freq, f))).toBeLessThan(10);
    }
  });

  it('returns null for silence and white noise', () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
    for (let seed = 1; seed <= 8; seed++) {
      expect(detectPitch(noise(4096, 0.1, seed), 48000), `seed ${seed}`).toBeNull();
    }
  });

  it('is fast enough for 50–60 frames/s', () => {
    const buf = tone(220, 48000, 4096, { noise: 0.01 });
    for (let i = 0; i < 20; i++) detectPitch(buf, 48000); // warm-up
    const t0 = performance.now();
    const N = 200;
    for (let i = 0; i < N; i++) detectPitch(buf, 48000);
    const per = (performance.now() - t0) / N;
    expect(per).toBeLessThan(4); // ms per 4096-sample frame (typically ~0.3 ms)
  });

  it('rms is correct', () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1);
    const s = tone(440, 48000, 48000, { amps: [1], gain: 1 });
    expect(rms(s)).toBeCloseTo(Math.SQRT1_2, 2);
  });
});

// ---------------------------------------------------------------------------
// Spectrum / salience / verifyChord
// ---------------------------------------------------------------------------

describe('spectrum + salience', () => {
  it('computeSpectrum peaks at the right bin with ≈ unit scaling', () => {
    const sr = 48000;
    const fft = 4096;
    const k = 100;
    const f = (k * sr) / fft;
    const mags = computeSpectrum(tone(f, sr, fft, { amps: [1], gain: 0.5 }));
    let best = 0;
    for (let i = 1; i < mags.length; i++) if (mags[i] > mags[best]) best = i;
    expect(best).toBe(k);
    expect(mags[k]).toBeGreaterThan(0.45);
    expect(mags[k]).toBeLessThan(0.55);
  });

  it('noteSalience favours the played note over its neighbours', () => {
    const sr = 48000;
    for (const m of [48, 60, 67, 76]) {
      const mags = computeSpectrum(tone(midiToFreq(m), sr, 4096, { seed: m }), { fftSize: 8192 });
      const s = noteSalience(mags, sr, 8192, m, { windowLength: 4096 });
      expect(s).toBeGreaterThan(1.5 * noteSalience(mags, sr, 8192, m - 1, { windowLength: 4096 }));
      expect(s).toBeGreaterThan(1.5 * noteSalience(mags, sr, 8192, m + 1, { windowLength: 4096 }));
    }
  });
});

describe('verifyChord', () => {
  const sr = 48000;
  const W = 4096;
  const FFT = 8192;
  const spec = (buf: Float32Array) => computeSpectrum(buf, { fftSize: FFT, windowLength: W });
  const verify = (buf: Float32Array, expected: number[]) =>
    verifyChord(spec(buf), sr, FFT, expected, { windowLength: W });

  const C4 = 60, E4 = 64, G4 = 67, F4 = 65, A4 = 69, C3 = 48, G3 = 55;

  it('accepts a C major triad (C4-E4-G4)', () => {
    for (const seed of [1, 2, 3]) {
      const r = verify(chord([C4, E4, G4], sr, W, { seed, noise: 0.003 }), [C4, E4, G4]);
      expect(r.present, `seed ${seed}`).toEqual([true, true, true]);
      expect(r.score).toBeGreaterThan(0.7);
    }
  });

  it('accepts a low open voicing (C3-G3-E4)', () => {
    for (const seed of [1, 2, 3]) {
      const r = verify(chord([C3, G3, E4], sr, W, { seed, noise: 0.003 }), [C3, G3, E4]);
      expect(r.present, `seed ${seed}`).toEqual([true, true, true]);
    }
  });

  it('accepts other chords (A minor, G7, two-note intervals)', () => {
    const cases = [
      [57, 60, 64],
      [55, 59, 62, 65],
      [60, 67],
      [52, 59, 64],
      [62, 66, 69],
    ];
    for (const c of cases) {
      const r = verify(chord(c, sr, W, { seed: c[0], noise: 0.003 }), c);
      expect(r.present.every(Boolean), `chord ${c} → ${r.present}`).toBe(true);
    }
  });

  it('rejects a different chord (C4-F4-A4 when C-E-G expected)', () => {
    const r = verify(chord([C4, F4, A4], sr, W, { seed: 4, noise: 0.003 }), [C4, E4, G4]);
    expect(r.present[0]).toBe(true); // the C really is there
    expect(r.present[1]).toBe(false);
    expect(r.present[2]).toBe(false);
    expect(r.score).toBeLessThan(0.7);
  });

  it('rejects a semitone-shifted chord and incomplete chords', () => {
    const r1 = verify(chord([61, 65, 68], sr, W, { seed: 9, noise: 0.003 }), [C4, E4, G4]);
    expect(r1.present.every(Boolean)).toBe(false);
    expect(r1.present.filter(Boolean).length).toBe(0);
    const r2 = verify(chord([C4], sr, W, { seed: 9, noise: 0.003 }), [C4, E4, G4]);
    expect(r2.present).toEqual([true, false, false]);
  });

  it('rejects silence and noise', () => {
    expect(verify(new Float32Array(W), [C4, E4, G4]).present).toEqual([false, false, false]);
    for (let seed = 1; seed <= 5; seed++) {
      const r = verify(noise(W, 0.05, seed), [C4, E4, G4]);
      expect(r.present.some(Boolean), `seed ${seed}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// NoteTracker
// ---------------------------------------------------------------------------

/** Frame-sequence builder at ~55 fps. */
class Seq {
  frames: PitchFrame[] = [];
  t = 0;
  dt = 18;
  silence(ms: number, level = 0.0005) {
    for (let e = 0; e < ms; e += this.dt) {
      this.frames.push({ time: this.t, freq: null, clarity: 0, rms: level });
      this.t += this.dt;
    }
    return this;
  }
  /** A note of `ms` duration; level decays from `peak` by `decayDbPerS`. */
  note(midi: number, ms: number, peak = 0.1, opts: { decayDbPerS?: number; vibratoCents?: number; vibHz?: number; clarity?: number } = {}) {
    const start = this.t;
    for (let e = 0; e < ms; e += this.dt) {
      const sec = (this.t - start) / 1000;
      const lvl = peak * Math.pow(10, (-(opts.decayDbPerS ?? 6) * sec) / 20);
      const vib = (opts.vibratoCents ?? 0) * Math.sin(2 * Math.PI * (opts.vibHz ?? 5.5) * sec);
      const f = midiToFreq(midi + vib / 100);
      this.frames.push({ time: this.t, freq: f, clarity: opts.clarity ?? 0.95, rms: lvl });
      this.t += this.dt;
    }
    return this;
  }
  run(tr = new NoteTracker({ noiseFloor: 0.0005 })): TrackerEvent[] {
    const out: TrackerEvent[] = [];
    for (const f of this.frames) out.push(...tr.process(f));
    out.push(...tr.reset(this.t));
    return out;
  }
}

const summary = (ev: TrackerEvent[]) => ev.map((e) => `${e.type}${e.midi}`);

describe('NoteTracker', () => {
  it('emits on/off for separated notes', () => {
    const ev = new Seq().silence(200).note(64, 300).silence(200).note(65, 300).silence(200).run();
    expect(summary(ev)).toEqual(['on64', 'off64', 'on65', 'off65']);
    // timing: note-on back-dated to the onset (first note frame at t=216)
    expect(ev[0].time).toBeGreaterThanOrEqual(198);
    expect(ev[0].time).toBeLessThanOrEqual(240);
    expect(ev[0].velocity).toBeGreaterThan(0.3);
  });

  it('registers repeated same-pitch notes separated by a short gap', () => {
    const ev = new Seq()
      .silence(150)
      .note(64, 250).silence(54)
      .note(64, 250).silence(54)
      .note(65, 250).silence(54)
      .note(67, 250).silence(200)
      .run();
    expect(summary(ev)).toEqual(['on64', 'off64', 'on64', 'off64', 'on65', 'off65', 'on67', 'off67']);
  });

  it('detects legato re-attacks of the same pitch via the level onset', () => {
    // Second E4 is struck while the first still rings (level 0.02 → 0.12, +15 dB).
    const ev = new Seq().silence(150).note(64, 400, 0.04, { decayDbPerS: 10 }).note(64, 400, 0.12).silence(200).run();
    expect(summary(ev)).toEqual(['on64', 'off64', 'on64', 'off64']);
  });

  it('follows legato pitch changes', () => {
    const ev = new Seq().silence(100).note(60, 300).note(62, 300).note(64, 300).silence(200).run();
    expect(summary(ev)).toEqual(['on60', 'off60', 'on62', 'off62', 'on64', 'off64']);
  });

  it('does not retrigger on ±30-cent vibrato (even when slightly out of tune)', () => {
    const a = new Seq().silence(100).note(57, 1500, 0.1, { vibratoCents: 30, decayDbPerS: 3 }).silence(200).run();
    expect(summary(a)).toEqual(['on57', 'off57']);
    // note itself 15 cents sharp + 30 cent vibrato
    const s = new Seq().silence(100);
    const start = s.t;
    for (let e = 0; e < 1500; e += s.dt) {
      const sec = (s.t - start) / 1000;
      const c = 15 + 30 * Math.sin(2 * Math.PI * 6 * sec);
      s.frames.push({ time: s.t, freq: midiToFreq(57 + c / 100), clarity: 0.93, rms: 0.08 });
      s.t += s.dt;
    }
    expect(summary(s.silence(200).run())).toEqual(['on57', 'off57']);
  });

  it('ignores short glitches, octave blips and noise', () => {
    const s = new Seq().silence(100).note(60, 400);
    // insert a 2-frame octave blip in the middle of the note
    s.frames[12] = { ...s.frames[12], freq: midiToFreq(72) };
    s.frames[13] = { ...s.frames[13], freq: midiToFreq(72) };
    expect(summary(s.silence(200).run())).toEqual(['on60', 'off60']);
    // loud but unpitched frames never start a note
    const n = new Seq().silence(100);
    for (let i = 0; i < 30; i++) {
      n.frames.push({ time: n.t, freq: i % 2 ? 300 + i * 13 : null, clarity: 0.4, rms: 0.05 });
      n.t += n.dt;
    }
    expect(n.run()).toEqual([]);
  });

  it('honours allowNoteOn vetoes and requires a fresh attack afterwards', () => {
    const tr = new NoteTracker({ noiseFloor: 0.0005 });
    const s = new Seq().silence(100).note(60, 400, 0.1, { decayDbPerS: 2 }).note(60, 300, 0.1, { decayDbPerS: 2 });
    const out: TrackerEvent[] = [];
    s.frames.forEach((f, i) => {
      // the app "plays" C4 for the first 400 ms → vetoed; the tail must not start a note
      const vetoing = f.time < 500;
      out.push(...tr.process(f, { allowNoteOn: (m) => !(vetoing && m === 60) }));
      void i;
    });
    expect(summary(out)).toEqual([]);
    // a genuine re-strike (level jump) is accepted
    const s2 = new Seq();
    s2.t = s.t;
    s2.note(60, 300, 0.4).silence(200);
    for (const f of s2.frames) out.push(...tr.process(f));
    expect(summary(out)).toEqual(['on60', 'off60']);
  });

  it('sensitivity changes the level gate', () => {
    const quiet = () => new Seq().silence(100).note(60, 400, 0.0025).silence(200);
    expect(quiet().run(new NoteTracker({ noiseFloor: 0.0005, sensitivity: 0 }))).toEqual([]);
    expect(summary(quiet().run(new NoteTracker({ noiseFloor: 0.0005, sensitivity: 1 })))).toEqual(['on60', 'off60']);
  });
});
