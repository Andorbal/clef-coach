import { describe, expect, it } from 'vitest';
import { Judge, PASS_MARK } from './judge';
import { type Mix, makeMix } from './params';
import { getSession } from './sessions';
import { renderStems } from './stems';

const SR = 24000;
const s = getSession('pop');
const channels = s.channels.map(c => c.id);
const stems = renderStems({ session: 'pop', sampleRate: SR });
const rough = makeMix(channels, s.rough);
const judge = (start: Mix, target: Mix) => new Judge({ stems, channels, sampleRate: SR, tempo: s.tempo, start, target });
const at = (base: Mix, d: Mix) => ({ ...base, ...d });

describe('the judge', () => {
  it('passes a mix against itself, fast enough to check on a tap', () => {
    const ref = makeMix(channels, s.rough, s.reference);
    const t0 = performance.now();
    const j = judge(rough, ref);
    const t1 = performance.now();
    const r = j.score(ref);
    console.log(`target ${Math.round(t1 - t0)} ms, score ${Math.round(performance.now() - t1)} ms`);
    expect(r.overall).toBeGreaterThan(0.97);
    expect(j.score(rough).overall).toBeLessThan(0.3);
  });

  it('judges balance by ear: everything up together is no change', () => {
    const target = at(rough, { 'bass:fader': -14 });
    const j = judge(rough, target);
    expect(j.score(rough).overall).toBeLessThan(PASS_MARK);
    expect(j.score(at(rough, { 'bass:fader': -13 })).overall).toBeGreaterThan(PASS_MARK);
    // the bass's trim does what its fader would
    expect(j.score(at(rough, { 'bass:gain': -8 })).overall).toBeGreaterThan(PASS_MARK);
    const allUp = Object.fromEntries(channels.map(c => [`${c}:fader`, (target[`${c}:fader`] ?? 0) + 4]));
    expect(j.score(at(rough, allUp)).overall).toBeGreaterThan(0.9);
    expect(j.score(rough).worst?.hint).toMatch(/Bass.*too loud|bass.*too loud/);
  });

  it('judges pan', () => {
    const j = judge(rough, at(rough, { 'guitar:pan': 0.6 }));
    expect(j.score(rough).overall).toBeLessThan(PASS_MARK);
    expect(j.score(at(rough, { 'guitar:pan': 0.5 })).overall).toBeGreaterThan(PASS_MARK);
    expect(j.score(at(rough, { 'guitar:pan': -0.6 })).overall).toBeLessThan(0.15);
  });

  it('judges tone: a high-pass is heard, and one close to it passes', () => {
    const j = judge(rough, at(rough, { 'keys:hpOn': 1, 'keys:hpFreq': 300 }));
    const r = j.score(rough);
    expect(r.overall).toBeLessThan(PASS_MARK);
    expect(r.worst?.hint).toMatch(/too much low/);
    expect(j.score(at(rough, { 'keys:hpOn': 1, 'keys:hpFreq': 260 })).overall).toBeGreaterThan(PASS_MARK);
    // a boost in the wrong place doesn't
    expect(j.score(at(rough, { 'keys:presGain': 9 })).overall).toBeLessThan(PASS_MARK);
  });

  it('judges dynamics: compression evens out an uneven part', () => {
    const uneven = renderStems({ session: 'pop', sampleRate: SR, channels: channels.map(c => (c === 'bass' ? { id: 'bass', fault: { uneven: 12 } } : c)) });
    const comp = { 'bass:compOn': 1, 'bass:threshold': -26, 'bass:ratio': 6, 'bass:attack': 5, 'bass:makeup': 6 };
    const j = new Judge({ stems: uneven, channels, sampleRate: SR, tempo: s.tempo, start: rough, target: at(rough, comp) });
    expect(j.score(rough).overall).toBeLessThan(PASS_MARK);
    expect(j.score(at(rough, { ...comp, 'bass:threshold': -24, 'bass:ratio': 5 })).overall).toBeGreaterThan(PASS_MARK);
  });

  it('judges space', () => {
    const target = at(rough, { 'lead:reverb': -8, 'fx:reverbSize': 0.7 });
    const j = judge(rough, target);
    expect(j.score(rough).overall).toBeLessThan(PASS_MARK);
    expect(j.score(at(target, { 'lead:reverb': -10 })).overall).toBeGreaterThan(PASS_MARK);
    expect(j.score(at(target, { 'fx:reverbSize': 0.3 })).overall).toBeLessThan(PASS_MARK);
  });

  it('checks goals: loudness and a peak ceiling', () => {
    const j = new Judge({ stems, channels, sampleRate: SR, tempo: s.tempo, start: rough, spec: { goals: [{ kind: 'loudness', target: -14 }, { kind: 'peak', max: -1 }] } });
    const loud = j.measure(rough).master;
    console.log(`rough mix: ${loud.loud.toFixed(1)} LUFS, peak ${loud.peak.toFixed(1)} dBFS`);
    expect(j.score(rough).overall).toBeLessThan(PASS_MARK);
    const lim = at(rough, { 'master:limitOn': 1, 'master:ceiling': -1, 'master:drive': -14 - loud.loud + 1 });
    const r = j.score(lim);
    console.log(`limited: ${j.measure(lim).master.loud.toFixed(1)} LUFS, ${j.measure(lim).master.peak.toFixed(2)} dBFS`);
    expect(j.measure(lim).master.peak).toBeLessThanOrEqual(-0.99);
    expect(r.aspects.goal).toBeDefined();
  });
});
