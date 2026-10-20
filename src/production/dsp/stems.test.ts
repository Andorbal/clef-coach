import { describe, expect, it } from 'vitest';
import { getSession, loopSeconds, SESSIONS } from './sessions';
import { renderStems, renderTrack, resolveTracks } from './stems';

const SR = 24000;
const peakDb = (x: Float32Array) => 20 * Math.log10(x.reduce((m, v) => Math.max(m, Math.abs(v)), 0));
const rmsDb = (x: Float32Array) => 10 * Math.log10(x.reduce((s, v) => s + v * v, 0) / x.length);

describe('stems', () => {
  for (const s of SESSIONS) {
    it(`renders every track of ${s.title} as a loop at its recorded level`, () => {
      const t0 = performance.now();
      const stems = renderStems({ session: s.id, sampleRate: SR });
      const ms = performance.now() - t0;
      console.log(`${s.title}: ${Math.round(ms)} ms at ${SR} Hz`);
      for (const ch of s.channels) {
        const x = stems[ch.id];
        expect(x.length, ch.id).toBe(Math.round(loopSeconds(s) * SR));
        expect(x.every(Number.isFinite), ch.id).toBe(true);
        expect(peakDb(x), ch.id).toBeCloseTo(ch.level ?? -8, 0);
        // something is playing most of the time, not one blip
        expect(rmsDb(x), ch.id).toBeGreaterThan((ch.level ?? -8) - 30);
      }
    });
  }

  it('bakes faults into a take', () => {
    const s = getSession('pop');
    const [clean, hot, quiet, boomy] = resolveTracks(s, ['guitar', { id: 'hot', from: 'guitar', fault: { clip: 12 } }, { id: 'quiet', from: 'guitar', fault: { gain: -12 } }, { id: 'boomy', from: 'guitar', fault: { boom: 10 } }]).map(t => renderTrack(s, t, SR));
    expect(peakDb(quiet)).toBeCloseTo(peakDb(clean) - 12, 0);
    // a clipped take is turned back down to the same loudness, its peaks flattened
    expect(rmsDb(hot)).toBeCloseTo(rmsDb(clean), 0);
    expect(peakDb(hot)).toBeLessThan(peakDb(clean) - 4);
    expect(boomy.length).toBe(clean.length);
  });
});
