import { describe, expect, it } from 'vitest';
import { buildSteps } from '../music/score';
import { measureTicks } from '../music/rhythm';
import { chordPlayScore, chordShape } from './chordScore';
import { getSong } from '../content/songs';

const midis = (shape: ReturnType<typeof chordShape>) => shape!.notes.map(n => n.midi);

describe('chord shapes', () => {
  it('voices the standard shapes with fingers and strings', () => {
    const c = chordShape('C', 'guitar')!;
    expect(c.notes.map(n => n.name)).toEqual(['C3', 'E3', 'G3', 'C4', 'E4']);
    expect(c.notes.map(n => n.string)).toEqual([5, 4, 3, 2, 1]);
    expect(c.notes.map(n => n.finger)).toEqual([3, 2, 0, 1, 0]);
    // high-G ukulele C: 0003, strummed from the G string
    const u = chordShape('C', 'ukulele')!;
    expect(u.notes.map(n => n.name)).toEqual(['G4', 'C4', 'E4', 'C5']);
    expect(u.notes.map(n => n.finger)).toEqual([0, 0, 0, 3]);
  });

  it('follows the tuning', () => {
    expect(midis(chordShape('C', 'ukulele', { ukuleleTuning: 'low-g' }))[0]).toBe(55);
    // baritone ukulele uses the guitar's top four strings
    expect(chordShape('G', 'ukulele', { ukuleleTuning: 'baritone' })!.notes.map(n => n.name)).toEqual(['D3', 'G3', 'B3', 'G4']);
  });

  it('spells chord tones from the root', () => {
    expect(chordShape('Bb', 'piano')!.notes.map(n => n.name)).toEqual(['Bb3', 'D4', 'F4']);
    expect(chordShape('F#m', 'piano')!.notes.map(n => n.name)).toEqual(['F#4', 'A4', 'C#5']);
    const m = chordShape('C', 'mallets')!;
    expect(m.notes.map(n => n.finger)).toEqual([1, 2, 3, 4]);
  });
});

describe('chord-play scores', () => {
  const barsOk = (score: ReturnType<typeof chordPlayScore>) => {
    const s = score!.score;
    for (const st of s.staves)
      for (const v of st.voices) {
        const per: number[] = [];
        for (const n of v.notes) per[n.measure] = (per[n.measure] ?? 0) + n.ticks;
        per.forEach((t, i) => {
          if (!s.pickup || (i > 0 && i < per.length - 1)) expect(t).toBe(measureTicks(s.time));
        });
        // every staff has the same bars
        const first: number[] = [];
        for (const n of s.staves[0].voices[0].notes) first[n.measure] = (first[n.measure] ?? 0) + n.ticks;
        expect(per).toEqual(first);
      }
    expect(buildSteps(s).length).toBeGreaterThan(0);
  };

  it('picks each string, then strums', () => {
    const r = chordPlayScore({ type: 'chord-play', chords: ['C'], pattern: 'pick', mode: 'wait' }, 'guitar')!;
    barsOk(r);
    const steps = buildSteps(r.score);
    expect(steps.map(s => s.notes.length)).toEqual([1, 1, 1, 1, 1, 5]);
    expect(steps[0].notes[0].string).toBe(5);
    expect(steps[0].notes[0].finger).toBe(3);
  });

  it('cycles chord changes in a strumming rhythm', () => {
    const r = chordPlayScore({ type: 'chord-play', chords: ['C', 'Am', 'F', 'G7'], pattern: 'strum', rhythm: 'h h', mode: 'tempo' }, 'ukulele')!;
    barsOk(r);
    expect(r.score.measures).toBe(8);
    expect(buildSteps(r.score).length).toBe(16);
  });

  it('strums along with a song, the tune on its own staff', () => {
    const song = getSong('uke-ode-to-joy')!;
    const r = chordPlayScore({ type: 'chord-play', song: song.id, mode: 'tempo' }, 'ukulele')!;
    barsOk(r);
    expect(r.chordStaff).toBe(1);
    expect(r.score.staves).toHaveLength(2);
    const chordNotes = r.score.staves[1].voices[0].notes.filter(n => !n.rest);
    expect(chordNotes.length).toBe(r.score.measures * 4);
    // works on any instrument, in its own tuning
    barsOk(chordPlayScore({ type: 'chord-play', song: song.id, mode: 'tempo' }, 'ukulele', { ukuleleTuning: 'baritone' }));
  });

  it('handles pickups and compound time', () => {
    for (const id of ['uke-silent-night', 'uke-row-your-boat', 'uke-amazing-grace']) {
      const r = chordPlayScore({ type: 'chord-play', song: id, mode: 'tempo' }, 'ukulele');
      expect(r, id).toBeTruthy();
      barsOk(r);
    }
  });
});
