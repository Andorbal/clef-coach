import { describe, expect, it } from 'vitest';
import { GM_PROGRAM_NAMES } from '../music/gm';
import { builtinFor, builtinLabel, kitFor } from './builtin';
import { DEFAULT_MIX, swingTick, trackMix } from './performer';
import { choiceFor } from './sinks';
import type { PerfTrack } from './types';

const track = (over: Partial<PerfTrack> = {}): PerfTrack => ({ id: 'auto:bass', name: 'Bass', role: 'bass', program: 34, drums: false, source: 'auto', notes: [], volume: 0.8, pan: 0, ...over });

describe('built-in sounds', () => {
  it('has a sound for every General MIDI program but the sound effects', () => {
    for (let p = 1; p <= 128; p++) {
      const s = builtinFor(p, false);
      if (p <= 120) expect(s.kind, `${p} ${GM_PROGRAM_NAMES[p - 1]}`).not.toBe('none');
      expect(builtinLabel(s)).toBeTruthy();
    }
    expect(builtinFor(1, false)).toEqual({ kind: 'rendered', voice: 'piano', offset: 0 });
    expect(builtinFor(5, false)).toMatchObject({ kind: 'rendered', voice: 'epiano' });
    expect(builtinFor(34, false)).toMatchObject({ kind: 'rendered', voice: 'bass' });
    expect(builtinFor(49, false)).toEqual({ kind: 'live', patch: 'strings' });
    expect(builtinFor(57, false)).toEqual({ kind: 'live', patch: 'brass' });
    expect(builtinFor(19, false)).toEqual({ kind: 'live', patch: 'organ' });
    expect(builtinFor(128, false)).toEqual({ kind: 'none' });
  });

  it('plays transposing mallets at sounding pitch', () => {
    // a band note is sounding pitch; the xylophone voice sounds an octave above what it's given
    expect(builtinFor(14, false)).toEqual({ kind: 'rendered', voice: 'xylophone', offset: 12 });
    expect(builtinFor(10, false)).toEqual({ kind: 'rendered', voice: 'glockenspiel', offset: 24 });
  });

  it('picks a drum kit from the GS kit numbers', () => {
    expect(kitFor(1)).toBe('standard');
    expect(kitFor(9)).toBe('room');
    expect(kitFor(17)).toBe('power');
    expect(kitFor(26)).toBe('electronic');
    expect(kitFor(33)).toBe('jazz');
    expect(kitFor(41)).toBe('brush');
    expect(builtinFor(41, true)).toEqual({ kind: 'drums', kit: 'brush' });
  });
});

describe('swing', () => {
  it('moves the off-beat eighth two-thirds of the way through the beat, and nothing else', () => {
    expect(swingTick(0)).toBe(0);
    expect(swingTick(24)).toBe(32);
    expect(swingTick(48)).toBe(48);
    expect(swingTick(72)).toBe(80);
    expect(swingTick(12)).toBe(16);
    // monotonic: notes never swap places
    for (let t = 1; t < 200; t++) expect(swingTick(t)).toBeGreaterThan(swingTick(t - 1));
    // before tick 0 (a pickup) too
    expect(swingTick(-24)).toBe(-16);
  });
});

describe('the mix', () => {
  it('falls back to each track’s own defaults', () => {
    const t = track();
    expect(trackMix(DEFAULT_MIX, t)).toEqual({ volume: 0.8, pan: 0, mute: false, solo: false, reverb: 0.2 });
    expect(trackMix({ ...DEFAULT_MIX, tracks: { 'auto:bass': { volume: 0.3, mute: true } } }, t)).toMatchObject({ volume: 0.3, mute: true, pan: 0 });
    expect(trackMix(DEFAULT_MIX, track({ drums: true })).reverb).toBe(0.35);
  });
});

describe('choosing a track’s sound', () => {
  it('uses the track’s own choice, else the device’s General MIDI bank, else built-in', () => {
    const t = track();
    expect(choiceFor(t, {}, {})).toEqual({ source: 'builtin' });
    expect(choiceFor(t, {}, { gmBank: 'b1', gmLayer: true })).toEqual({ source: 'gm', bankId: 'b1', layer: true });
    const own = { source: 'bank' as const, bankId: 'b2', bank: 0, program: 3 };
    expect(choiceFor(t, { 'auto:bass': own }, { gmBank: 'b1' })).toBe(own);
    expect(choiceFor(t, { 'auto:bass': { source: 'builtin' } }, { gmBank: 'b1' })).toEqual({ source: 'builtin' });
  });

  it('plays the player’s own part with their instrument’s sound', () => {
    const part = track({ id: 'part', role: 'part', source: 'part', sound: { kind: 'rendered', voice: 'piano', offset: 0 } });
    expect(choiceFor(part, {}, { gmBank: 'b1' })).toEqual({ source: 'builtin' });
    const piano = { source: 'bank' as const, bankId: 'grand', bank: 0, program: 0 };
    expect(choiceFor(part, {}, { instruments: { piano } })).toBe(piano);
  });
});
