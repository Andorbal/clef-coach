import { describe, expect, it } from 'vitest';
import { ALL_SONGS, getSong, songGroup } from './index';
import { songToScore } from '../../music/parse';
import { autoFinger } from '../../music/autofinger';
import { midiOf } from '../../music/pitch';
import { openMidi } from '../../music/guitar';
import { buildSteps } from '../../music/score';
import { TRACKS } from '../../curriculum';

const RANGES = {
  'piano-rh': [53, 96], // F3..C7
  'piano-lh': [21, 67], // A0..G4
  'piano-both': [21, 100],
  'guitar-treble': [40, 83], // E2..B5
  'guitar-bass': [40, 64], // E2..E4
} as const;

describe('song library', () => {
  it('has unique ids', () => {
    const ids = ALL_SONGS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const song of ALL_SONGS) {
    it(`${song.id} parses, fits its range and can be fingered`, () => {
      const score = autoFinger(songToScore(song));
      const [lo, hi] = RANGES[songGroup(song)];
      for (const st of score.staves) for (const v of st.voices) for (const n of v.notes) {
        for (const p of n.pitches) {
          const m = midiOf(p);
          expect(m, `${song.id}: ${p.step}${p.octave}`).toBeGreaterThanOrEqual(lo);
          expect(m, `${song.id}: ${p.step}${p.octave}`).toBeLessThanOrEqual(hi);
        }
        n.fingers?.forEach(f => {
          if (f === undefined) return;
          if (song.instrument === 'piano') expect(f >= 1 && f <= 5, `${song.id} finger ${f}`).toBe(true);
          else expect(f >= 0 && f <= 4, `${song.id} finger ${f}`).toBe(true);
        });
        if (song.instrument === 'guitar') {
          n.strings?.forEach((s, i) => {
            if (s === undefined) return;
            const fret = midiOf(n.pitches[i]) - openMidi(s);
            expect(fret, `${song.id}: string ${s}`).toBeGreaterThanOrEqual(0);
            expect(fret, `${song.id}: string ${s}`).toBeLessThanOrEqual(19);
          });
        }
      }
      expect(buildSteps(score).length).toBeGreaterThan(3);
      expect(song.blurb, `${song.id} blurb`).toBeTruthy();
    });
  }

  it('every song referenced by the curriculum exists', () => {
    const missing: string[] = [];
    for (const t of TRACKS) for (const u of t.units) for (const l of u.lessons) for (const a of l.steps) {
      if (a.type === 'piece' && a.song && !getSong(a.song)) missing.push(`${l.id}: ${a.song}`);
    }
    expect(missing).toEqual([]);
  });
});
