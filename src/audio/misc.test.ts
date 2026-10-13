import { describe, expect, it } from 'vitest';
import { keyboardOctaveDelta, keyboardToMidi } from './input/keyboard';
import { parseMidiMessage } from './input/midi';
import { audibleDuration, renderClickSamples, renderSfx, SFX_NAMES, SFX_PITCHES } from './sounds';
import { generateImpulseResponse } from './dsp/reverb';
import { peakAbs, rmsRange } from './dsp/util';
import { computeSpectrum, detectPitch } from './input/pitch';

describe('keyboardToMidi', () => {
  it('maps the DAW layout from C4', () => {
    const expected: [string, number][] = [
      ['KeyA', 60], ['KeyW', 61], ['KeyS', 62], ['KeyE', 63], ['KeyD', 64], ['KeyF', 65],
      ['KeyT', 66], ['KeyG', 67], ['KeyY', 68], ['KeyH', 69], ['KeyU', 70], ['KeyJ', 71],
      ['KeyK', 72], ['KeyO', 73], ['KeyL', 74], ['KeyP', 75], ['Semicolon', 76],
    ];
    for (const [code, midi] of expected) expect(keyboardToMidi(code, 0), code).toBe(midi);
  });
  it('applies octave shifts and rejects other keys', () => {
    expect(keyboardToMidi('KeyA', -1)).toBe(48);
    expect(keyboardToMidi('KeyA', 2)).toBe(84);
    expect(keyboardToMidi('KeyZ', 0)).toBeNull();
    expect(keyboardToMidi('Space', 0)).toBeNull();
    expect(keyboardToMidi('constructor', 0)).toBeNull();
    expect(keyboardToMidi('KeyA', 6)).toBeNull(); // > 127
    expect(keyboardOctaveDelta('KeyZ')).toBe(-1);
    expect(keyboardOctaveDelta('KeyX')).toBe(1);
    expect(keyboardOctaveDelta('KeyA')).toBe(0);
  });
});

describe('parseMidiMessage', () => {
  it('parses note on/off, velocity-0 note-on and sustain', () => {
    expect(parseMidiMessage([0x90, 60, 127])).toEqual({ kind: 'on', channel: 0, note: 60, velocity: 1 });
    expect(parseMidiMessage([0x93, 64, 0])).toEqual({ kind: 'off', channel: 3, note: 64, velocity: 0 });
    expect(parseMidiMessage([0x80, 62, 64])).toMatchObject({ kind: 'off', note: 62 });
    expect(parseMidiMessage([0xb0, 64, 127])).toEqual({ kind: 'sustain', channel: 0, down: true });
    expect(parseMidiMessage([0xb0, 64, 10])).toEqual({ kind: 'sustain', channel: 0, down: false });
    expect(parseMidiMessage([0xb0, 123, 0])).toEqual({ kind: 'allOff', channel: 0 });
    expect(parseMidiMessage([0xb0, 7, 100])).toEqual({ kind: 'other' });
    expect(parseMidiMessage([0xf8])).toEqual({ kind: 'other' }); // clock
    expect(parseMidiMessage([0x90, 60])).toEqual({ kind: 'other' }); // truncated
    expect(parseMidiMessage([])).toEqual({ kind: 'other' });
  });
});

describe('sound design renders', () => {
  it('every sfx is finite, non-clipping, stereo and reasonably short', () => {
    for (const sr of [44100, 48000]) {
      for (const name of SFX_NAMES) {
        const s = renderSfx(name, sr);
        expect(s.left.length).toBe(s.right.length);
        expect(s.left.length / sr).toBeLessThan(3.2);
        for (const ch of [s.left, s.right]) {
          for (let i = 0; i < ch.length; i++) if (!Number.isFinite(ch[i])) throw new Error(`${name} NaN`);
          expect(peakAbs(ch), name).toBeLessThanOrEqual(0.6);
        }
        expect(Math.max(peakAbs(s.left), peakAbs(s.right)), name).toBeGreaterThan(0.05);
        // starts and ends quietly (no clicks)
        expect(Math.abs(s.left[0]), name).toBeLessThan(0.02);
        expect(Math.abs(s.left[s.left.length - 1]), name).toBeLessThan(0.01);
      }
    }
  });

  it('tap is much quieter than the feedback sounds', () => {
    const tap = renderSfx('tap', 48000);
    const correct = renderSfx('correct', 48000);
    expect(peakAbs(tap.left)).toBeLessThan(peakAbs(correct.left) * 0.5);
  });

  it('the "correct" ping is audible for much less than its buffer (the mic ignores related notes only that long)', () => {
    const sr = 48000;
    const s = renderSfx('correct', sr);
    const d = audibleDuration([s.left, s.right], sr);
    expect(d).toBeGreaterThan(0.15);
    expect(d).toBeLessThan(s.left.length / sr);
    expect(audibleDuration([new Float32Array(100)], sr)).toBe(0);
  });

  it('the "correct" ping sounds the pitches SFX_PITCHES declares (A5 → E6)', () => {
    const sr = 48000;
    const s = renderSfx('correct', sr);
    const mags = computeSpectrum(s.left.subarray(9000, 9000 + 4096), { fftSize: 8192 });
    let best = 1;
    for (let k = 2; k < mags.length; k++) if (mags[k] > mags[best]) best = k;
    const peakMidi = 69 + 12 * Math.log2((best * sr) / 8192 / 440);
    expect(SFX_PITCHES.correct!.some((m) => Math.abs(m - peakMidi) < 0.3)).toBe(true);
    // YIN hears the two overlapping bells as their common fundamental (A4) –
    // exactly why the mic's self-sound guard also blocks related pitches.
    const p = detectPitch(s.left.subarray(9000, 9000 + 2048), sr, { maxFreq: 3000 });
    const m = Math.round(69 + 12 * Math.log2(p!.freq / 440));
    expect(SFX_PITCHES.correct!.some((a) => [-24, -19, -12, 0, 12, 19, 24].includes(m - a))).toBe(true);
  });

  it('metronome clicks are short, accented higher/louder', () => {
    const a = renderClickSamples(true, 48000);
    const n = renderClickSamples(false, 48000);
    expect(a.length / 48000).toBeLessThan(0.1);
    expect(peakAbs(a)).toBeGreaterThan(peakAbs(n));
    const pa = detectPitch(a.subarray(0, 1024), 48000, { maxFreq: 3000, maxDip: 0.5 });
    const pn = detectPitch(n.subarray(0, 1024), 48000, { maxFreq: 3000, maxDip: 0.5 });
    expect(pa && pn && pa.freq > pn.freq).toBe(true);
    // decays to near silence within 40 ms
    expect(rmsRange(a, Math.round(0.04 * 48000), a.length)).toBeLessThan(rmsRange(a, 0, 480) * 0.1);
  });

  it('reverb impulse response decays smoothly over ~1.6 s', () => {
    const ir = generateImpulseResponse(48000, 1.6);
    expect(ir.left.length).toBe(Math.round(1.6 * 48000));
    const early = rmsRange(ir.left, 1000, 5000);
    const mid = rmsRange(ir.left, 0.8 * 48000, 0.9 * 48000);
    const late = rmsRange(ir.left, 1.45 * 48000, 1.55 * 48000);
    expect(mid).toBeLessThan(early * 0.1);
    expect(late).toBeLessThan(mid * 0.2);
    // decorrelated stereo
    let dot = 0;
    for (let i = 0; i < ir.left.length; i++) dot += ir.left[i] * ir.right[i];
    const norm = Math.sqrt(rmsRange(ir.left) ** 2 * rmsRange(ir.right) ** 2) * ir.left.length;
    expect(Math.abs(dot / norm)).toBeLessThan(0.2);
  });
});
