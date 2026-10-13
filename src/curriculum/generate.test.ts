import { describe, expect, it } from 'vitest';
import { generateScore, makeRng, scaleScore, genRhythm } from './generate';
import { measureTicks } from '../music/rhythm';
import { midiOf, parsePitch, pitchToString } from '../music/pitch';
import { buildSteps } from '../music/score';
import type { MelodyGen } from './types';

function checkMeasures(score: ReturnType<typeof generateScore>) {
  const mt = measureTicks(score.time);
  for (const st of score.staves) for (const v of st.voices) {
    const per: number[] = [];
    for (const n of v.notes) per[n.measure] = (per[n.measure] ?? 0) + n.ticks;
    per.forEach((t, i) => expect(t, `measure ${i}`).toBe(mt));
  }
}

const C_POS = ['C4', 'D4', 'E4', 'F4', 'G4'];

describe('generator', () => {
  it('fills measures exactly for many rhythm sets', () => {
    const sets: Record<string, number>[] = [
      { q: 3, h: 1 },
      { q: 3, h: 1, w: 1, 'h.': 1 },
      { 'e e': 2, q: 2, 'q. e': 1, h: 1 },
      { 's s s s': 1, 'e e': 2, q: 1, 'e3 e3 e3': 1, rq: 0.3 },
    ];
    for (const time of [[4, 4], [3, 4], [2, 4]] as [number, number][]) {
      for (const rhythms of sets) {
        for (let seed = 1; seed < 30; seed++) {
          const s = generateScore({ clef: 'treble', key: 'C', time, measures: 4, pool: C_POS, rhythms, maxLeap: 2, fivePosition: true }, makeRng(seed));
          checkMeasures(s);
        }
      }
    }
  });
  it('6/8 rhythms', () => {
    const r = genRhythm(makeRng(3), [6, 8], 4, { 'q e': 2, 'e e e': 2, 'q.': 1 });
    r.forEach(m => expect(m.reduce((s, x) => s + x.ticks, 0)).toBe(measureTicks([6, 8])));
  });
  it('keeps notes in the pool, ends on the tonic, fingers five-finger position', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = generateScore({ clef: 'treble', key: 'C', time: [4, 4], measures: 4, pool: C_POS, rhythms: { q: 3, h: 1 }, maxLeap: 2, fivePosition: true }, makeRng(seed));
      const notes = s.staves[0].voices[0].notes.filter(n => !n.rest);
      for (const n of notes) {
        expect(C_POS).toContain(pitchToString(n.pitches[0]));
        expect(n.fingers?.[0]).toBe(C_POS.indexOf(pitchToString(n.pitches[0])) + 1);
      }
      expect(pitchToString(notes[notes.length - 1].pitches[0])).toBe('C4');
    }
  });
  it('respects max leap', () => {
    const pool = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    for (let seed = 1; seed < 40; seed++) {
      const s = generateScore({ clef: 'treble', key: 'C', time: [4, 4], measures: 4, pool, rhythms: { q: 1 }, maxLeap: 1, cadence: false }, makeRng(seed));
      const ms = s.staves[0].voices[0].notes.map(n => midiOf(n.pitches[0]));
      for (let i = 1; i < ms.length; i++) expect(Math.abs(ms[i] - ms[i - 1])).toBeLessThanOrEqual(2);
    }
  });
  it('generates every accompaniment pattern with valid measures', () => {
    const patterns = ['drone', 'roots', 'blocked', 'waltz', 'broken', 'alberti', 'parallel', 'contrary', 'counter', 'alternate'] as const;
    for (const pattern of patterns) {
      for (let seed = 1; seed < 15; seed++) {
        const time: [number, number] = pattern === 'waltz' ? [3, 4] : [4, 4];
        const gen: MelodyGen = {
          clef: 'treble', key: 'C', time, measures: 4, pool: C_POS, rhythms: { q: 2, h: 1 }, maxLeap: 2, fivePosition: true,
          accomp: { pattern, pool: ['C3', 'D3', 'E3', 'F3', 'G3'], fivePosition: true },
        };
        const s = generateScore(gen, makeRng(seed));
        expect(s.staves).toHaveLength(2);
        checkMeasures(s);
        const steps = buildSteps(s);
        expect(steps.length).toBeGreaterThan(3);
        for (const st of steps) for (const n of st.notes) {
          if (n.staff === 1) expect(n.midi).toBeLessThan(midiOf(parsePitch('C4')) + 1);
        }
      }
    }
  });
  it('builds scales with standard fingering', () => {
    const s = scaleScore({ tonic: 'G', kind: 'major', octaves: 1, hands: 'R', instrument: 'piano' });
    const notes = s.staves[0].voices[0].notes.filter(n => !n.tiePrev);
    expect(notes.map(n => pitchToString(n.pitches[0])).join(' ')).toBe('G4 A4 B4 C5 D5 E5 F#5 G5 F#5 E5 D5 C5 B4 A4 G4');
    expect(notes.map(n => n.fingers![0]).join('')).toBe('123123454321321');
    const both = scaleScore({ tonic: 'C', kind: 'major', octaves: 1, hands: 'both', motion: 'contrary', instrument: 'piano' });
    expect(both.staves).toHaveLength(2);
    const lh = both.staves[1].voices[0].notes.filter(n => !n.tiePrev).map(n => pitchToString(n.pitches[0]));
    expect(lh.slice(0, 3)).toEqual(['C4', 'B3', 'A3']);
    const g = scaleScore({ tonic: 'G', kind: 'major', octaves: 1, hands: 'R', instrument: 'guitar', octave: 2 });
    expect(g.staves[0].voices[0].notes[0].strings?.[0]).toBe(6);
  });
});
