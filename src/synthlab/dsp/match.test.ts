import { describe, expect, it } from 'vitest';
import { Matcher } from './matcher';
import { makePatch, type PatchDelta } from './params';
import { phrase, type PhraseId } from './render';

/** A quiz passes at 0.75 by default (course/types.ts PASS_MARK). */
const PASS = 0.75;

const score = (target: PatchDelta, mine: PatchDelta, ph: PhraseId = 'note') => new Matcher(makePatch(target), phrase(ph)).score(makePatch(mine));

const pluck: PatchDelta = { ampAttack: 0, ampDecay: 0.3, ampSustain: 0, ampRelease: 0.2 };
const lp: PatchDelta = { filterOn: true, filterCutoff: 800 };
const vib: PatchDelta = { lfoPitch: 30, lfoRate: 5 };
const wob: PatchDelta = { filterOn: true, filterCutoff: 400, filterRes: 0.4, lfoCutoff: 2, lfoSync: true, lfoDiv: '1/8' };

/** [what, target, mine, phrase] — a near miss an ear would accept. */
const close: [string, PatchDelta, PatchDelta, PhraseId?][] = [
  ['ten cents sharp', {}, { osc1Fine: 10 }],
  ['a slightly longer pluck', pluck, { ...pluck, ampDecay: 0.35 }, 'notes'],
  ['a slightly faster swell', { ampAttack: 0.8, ampRelease: 1 }, { ampAttack: 0.6, ampRelease: 1 }, 'long'],
  ['5 ms against 15 ms attack', { ampAttack: 0.005 }, { ampAttack: 0.015 }],
  ['a touch more release', { ampRelease: 0.5 }, { ampRelease: 0.6 }],
  ['decay with full sustain (inaudible)', { ampDecay: 0.4 }, { ampDecay: 3 }],
  ['cutoff 800 against 900', lp, { ...lp, filterCutoff: 900 }],
  ['resonance .7 against .6', { ...lp, filterRes: 0.7 }, { ...lp, filterRes: 0.6 }],
  ['filter envelope .5 against .4', { filterOn: true, filterCutoff: 300, filterEnv: 0.5, fDecay: 0.3 }, { filterOn: true, filterCutoff: 300, filterEnv: 0.4, fDecay: 0.3 }, 'notes'],
  ['vibrato a little faster', vib, { ...vib, lfoRate: 5.5 }, 'long'],
  ['vibrato a little deeper', vib, { ...vib, lfoPitch: 40 }, 'long'],
  ['tremolo a little shallower', { lfoAmp: 0.6, lfoRate: 6 }, { lfoAmp: 0.5, lfoRate: 6 }, 'long'],
  ['a little quieter', {}, { volume: 0.55 }],
  ['unison detune 20 against 25', { unison: 5 }, { unison: 5, unisonDetune: 25 }],
  ['third harmonic .5 against .4', { engine: 'additive', h3: 0.5 }, { engine: 'additive', h3: 0.4 }],
];

/** Clearly different sounds. */
const far: [string, PatchDelta, PatchDelta, PhraseId?][] = [
  ['saw against square', {}, { osc1Wave: 'square' }],
  ['saw against triangle', {}, { osc1Wave: 'triangle' }],
  ['sine against triangle', { osc1Wave: 'sine' }, { osc1Wave: 'triangle' }],
  ['an octave up', {}, { osc1Octave: 1 }],
  ['an octave down', {}, { osc1Octave: -1 }],
  ['a semitone up', {}, { osc1Semi: 1 }],
  ['a fifth up', {}, { osc1Semi: 7 }],
  ['pluck twice as long', pluck, { ...pluck, ampDecay: 0.6 }, 'notes'],
  ['pluck with sustain', pluck, { ...pluck, ampSustain: 0.2 }, 'notes'],
  ['slow swell against quick', { ampAttack: 0.8, ampRelease: 1 }, { ampAttack: 0.2, ampRelease: 1 }, 'long'],
  ['punchy against soft attack', { ampAttack: 0.005 }, { ampAttack: 0.06 }],
  ['short against long release', { ampRelease: 0.2 }, { ampRelease: 1 }],
  ['cutoff 800 against 2000', lp, { ...lp, filterCutoff: 2000 }],
  ['filtered against open', lp, {}],
  ['resonant against plain', { ...lp, filterCutoff: 1000, filterRes: 0.8 }, { ...lp, filterCutoff: 1000 }],
  ['low-pass against high-pass', { ...lp, filterCutoff: 1000 }, { ...lp, filterCutoff: 1000, filterType: 'highpass' }],
  ['band-pass against low-pass', { ...lp, filterCutoff: 1000, filterType: 'bandpass' }, { ...lp, filterCutoff: 1000 }],
  ['filter envelope against none', { filterOn: true, filterCutoff: 300, filterEnv: 0.5, fDecay: 0.3 }, { filterOn: true, filterCutoff: 300, fDecay: 0.3 }, 'notes'],
  ['filter envelope short against long', { filterOn: true, filterCutoff: 300, filterEnv: 0.5, fDecay: 0.3 }, { filterOn: true, filterCutoff: 300, filterEnv: 0.5, fDecay: 1 }, 'notes'],
  ['vibrato against none', vib, {}, 'long'],
  ['vibrato fast against slow', vib, { ...vib, lfoRate: 2 }, 'long'],
  ['vibrato gentle against wild', vib, { ...vib, lfoPitch: 100 }, 'long'],
  ['tremolo against none', { lfoAmp: 0.6, lfoRate: 6 }, {}, 'long'],
  ['wobble in eighths against quarters', wob, { ...wob, lfoDiv: '1/4' }, 'long'],
  ['wobble against none', wob, { ...wob, lfoCutoff: 0 }, 'long'],
  ['much quieter', {}, { volume: 0.3 }],
  ['noise against none', { noiseLevel: 0.5 }, {}],
  ['a second oscillator a fifth up', { osc2Level: 0.7, osc2Semi: 7 }, {}],
  ['ring modulation against none', { ringLevel: 0.8, osc2Semi: 7, osc1Wave: 'sine', osc2Wave: 'sine' }, { osc1Wave: 'sine', osc2Wave: 'sine' }],
  ['FM ratio 1 against 2', { engine: 'fm', op2Level: 0.5 }, { engine: 'fm', op2Level: 0.5, op2Ratio: 2 }],
  ['FM bright against mellow', { engine: 'fm', op2Level: 0.5 }, { engine: 'fm', op2Level: 0.2 }],
  ['a harmonic missing', { engine: 'additive', h3: 0.5 }, { engine: 'additive' }],
  ['wavetable far along', { engine: 'wavetable', osc1Pos: 0.3 }, { engine: 'wavetable', osc1Pos: 0.8 }],
  ['echoes against none', { delayMix: 0.5 }, {}, 'short'],
  ['reverb against none', { reverbMix: 0.5 }, {}, 'short'],
  ['a kick against a plain blip', { osc1Wave: 'sine', ampSustain: 0, ampDecay: 0.4, modPitch: 36, modDecay: 0.08 }, { osc1Wave: 'sine', ampSustain: 0, ampDecay: 0.4 }, 'short'],
];

describe('matching sounds', () => {
  it('gives an identical patch full marks', () => {
    const r = score({ filterOn: true, filterCutoff: 1200, unison: 3, lfoPitch: 10 }, { filterOn: true, filterCutoff: 1200, unison: 3, lfoPitch: 10 });
    expect(r.overall).toBeCloseTo(1, 3);
  });

  it.each(close)('accepts a near miss: %s', (_, t, m, ph) => {
    expect(score(t, m, ph).overall).toBeGreaterThanOrEqual(PASS);
  });

  it.each(far)('rejects a different sound: %s', (_, t, m, ph) => {
    expect(score(t, m, ph).overall).toBeLessThan(PASS);
  });

  it('says which aspect is off', () => {
    expect(score({}, { osc1Octave: 1 }).pitch!).toBeLessThan(0.2);
    const env = score(pluck, { ...pluck, ampDecay: 1 }, 'notes');
    expect(env.shape).toBeLessThan(0.3);
    expect(env.tone).toBeGreaterThan(0.9);
    const filt = score(lp, {});
    expect(filt.tone).toBeLessThan(0.3);
    expect(filt.shape).toBeGreaterThan(0.9);
    expect(score(vib, {}, 'long').movement!).toBeLessThan(0.3);
  });
});

describe('hints', () => {
  it('points at the control that matters, in the right direction', async () => {
    const m = new Matcher(makePatch({ ...lp, ampAttack: 0.5 }), phrase('note'));
    const mine = makePatch({ ...lp, filterCutoff: 4000, ampAttack: 0.5, ampDecay: 2 });
    const hints = await m.hints(mine, ['filterCutoff', 'ampAttack', 'ampDecay', 'ampSustain']);
    expect(hints[0].key).toBe('filterCutoff');
    expect(hints[0].direction).toBe('down');
    // decay can't be heard with sustain full: never a hint
    expect(hints.map(h => h.key)).not.toContain('ampDecay');
  });
});
