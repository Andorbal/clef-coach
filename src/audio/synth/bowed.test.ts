import { describe, expect, it } from 'vitest';
import { BOWED_VOICES, bowedLoop, bowedNoteLength, renderBowedSamples } from './bowed';
import { detectPitch } from '../input/pitch';
import { peakAbs, rmsRange } from '../dsp/util';

const SR = 48000;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

/** Each instrument's open strings and a high note. */
const NOTES: Record<string, number[]> = {
  violin: [55, 62, 69, 76, 88],
  viola: [48, 55, 62, 69, 81],
  cello: [36, 43, 50, 57, 69],
  doublebass: [28, 33, 38, 43, 55],
};

describe('bowed string renderer', () => {
  for (const voice of BOWED_VOICES) {
    it(`${voice}: loops seamlessly, at an even level, in tune`, () => {
      const { start, end } = bowedLoop(voice, SR);
      expect(end).toBe(bowedNoteLength(voice, SR));
      for (const midi of NOTES[voice]) {
        for (const v of [0.3, 0.9]) {
          const s = renderBowedSamples(voice, midi, v, SR);
          expect(s.length).toBe(end);
          for (let i = 0; i < s.length; i += 97) expect(Number.isFinite(s[i])).toBe(true);
          expect(peakAbs(s), `${voice} ${midi} peak`).toBeLessThan(0.95);
          // the sustain repeats exactly: what comes before the loop's end is what comes before its start
          let diff = 0;
          for (let j = 1; j <= 2000; j++) diff = Math.max(diff, Math.abs(s[end - j] - s[start - j]));
          expect(diff, `${voice} ${midi} v${v} seam`).toBeLessThan(2e-3);
          // the sustain sits at a steady level whatever the note
          const rms = rmsRange(s, start, end);
          expect(rms, `${voice} ${midi} level`).toBeGreaterThan(0.1);
          expect(rms, `${voice} ${midi} level`).toBeLessThan(0.22);
        }
        // in tune (the vibrato averages out over a window)
        const s = renderBowedSamples(voice, midi, 0.6, SR);
        const p = detectPitch(s.subarray(start, start + 8192), SR, { minFreq: 25 });
        expect(p, `${voice} ${midi} pitch`).toBeTruthy();
        expect(Math.abs(cents(p!.freq, hz(midi))), `${voice} ${midi} tuning`).toBeLessThan(20);
      }
    });
  }

  it('starts softly and quickly settles; a soft note rises more slowly', () => {
    const loud = renderBowedSamples('violin', 69, 0.9, SR);
    const soft = renderBowedSamples('violin', 69, 0.3, SR);
    const early = (s: Float32Array) => rmsRange(s, 0, Math.round(0.03 * SR));
    expect(early(loud)).toBeGreaterThan(early(soft));
  });
});
