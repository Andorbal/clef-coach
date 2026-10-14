import { describe, expect, it } from 'vitest';
import { chordViewScore } from './chordNotation';
import { chordViews, tryChord } from './chordViews';
import { midiOf, pitchToString } from './pitch';
import type { Score } from './score';

const written = (s: Score) =>
  s.staves.map(st => ({
    clef: st.clef,
    notes: st.voices[0].notes.map(n => (n.rest ? 'r' : n.pitches.map(pitchToString).join(' '))),
  }));

const viewsOf = (sym: string, inst: Parameters<typeof chordViews>[1], hand?: 'R' | 'L') => chordViews(tryChord(sym)!, inst, {}, { hand });

describe('chord chart pictures written on the staff', () => {
  it('writes a guitar shape in treble 8vb, exactly the notes of the shape', () => {
    const open = viewsOf('C', 'guitar')[0];
    const s = chordViewScore(open, 'guitar')!;
    expect(written(s)).toEqual([{ clef: 'treble8vb', notes: ['C3 E3 G3 C4 E4'] }]);
    expect(s.tuning).toBeDefined();
  });

  it('spells chord tones the way the chord is built', () => {
    const dim7 = viewsOf('Cdim7', 'piano')[0];
    const notes = written(chordViewScore(dim7, 'piano')!).flatMap(st => st.notes).join(' ');
    expect(notes).toContain('Bbb');
    expect(notes).toContain('Gb');
    expect(notes).not.toMatch(/A\d/);
  });

  it('puts a piano voicing on the staff its hand reads, or the grand staff for both hands', () => {
    expect(written(chordViewScore(viewsOf('C', 'piano', 'R')[0], 'piano')!)[0].clef).toBe('treble');
    expect(written(chordViewScore(viewsOf('C', 'piano', 'L')[0], 'piano')!)[0].clef).toBe('bass');
    const slash = viewsOf('C/G', 'piano').find(v => v.kind === 'keys' && new Set(v.notes.map(n => n.hand)).size > 1);
    expect(slash).toBeDefined();
    const st = written(chordViewScore(slash!, 'piano')!);
    expect(st.map(x => x.clef)).toEqual(['treble', 'bass']);
    expect(st[1].notes[0]).toMatch(/^G\d$/);
  });

  it('writes an arpeggio as its notes in playing order', () => {
    const arp = viewsOf('C', 'bass').find(v => v.arpeggio)!;
    const s = chordViewScore(arp, 'bass')!;
    const [staff] = written(s);
    expect(staff.clef).toBe('bass8vb');
    expect(s.staves[0].voices[0].notes.map(n => midiOf(n.pitches[0]))).toEqual(arp.midis);
  });

  it('writes every voicing of every chord quality on every instrument', () => {
    for (const sym of ['C', 'Cm', 'Cdim', 'Caug', 'Csus4', 'C7', 'Cmaj7', 'Cm7b5', 'Cdim7', 'C6', 'Cadd9', 'C9', 'C13', 'C5', 'F#m7', 'Bbmaj7', 'G/B', 'Ebm6']) {
      for (const inst of ['piano', 'guitar', 'ukulele', 'bass', 'mallets'] as const) {
        for (const v of viewsOf(sym, inst)) expect(chordViewScore(v, inst, {}, { fingers: true }), `${sym} on ${inst}: ${v.label}`).not.toBeNull();
      }
    }
  });
});
