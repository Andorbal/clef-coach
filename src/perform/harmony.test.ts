import { describe, expect, it } from 'vitest';
import { ALL_SONGS } from '../content/songs';
import { songToScore } from '../music/parse';
import { parseSongDoc } from '../songs/format';
import { chordAt, chordSpansFromLine, inferChords, mergeSpans, songChordSpans, spanFromSymbol } from './harmony';

describe('chord spans', () => {
  it('reads chord symbols, slash basses and the fifth a chord has', () => {
    expect(spanFromSymbol('G7', 0, 96)).toMatchObject({ root: 7, pcs: [7, 11, 2, 5], bass: 7, fifth: 7 });
    expect(spanFromSymbol('C/E', 0, 96)).toMatchObject({ root: 0, bass: 4 });
    expect(spanFromSymbol('Bdim', 0, 96)?.fifth).toBe(6);
    expect(spanFromSymbol('nonsense', 0, 96)).toBeNull();
  });

  it('turns the chord line into spans, joining repeats of the same chord and keeping N.C.', () => {
    const { song, score } = parseSongDoc({ title: 'T', instrument: 'piano', key: 'C', time: [4, 4], staves: [{ clef: 'treble', voices: ['C4/w | C4 | C4 | C4 |'] }], chords: 'C | C | N.C. | G7/h C/h |' });
    const spans = chordSpansFromLine(song, score)!;
    expect(spans.map(s => [s.symbol, s.tick, s.ticks])).toEqual([['C', 0, 384], [null, 384, 192], ['G7', 576, 96], ['C', 672, 96]]);
    expect(chordAt(spans, 400)?.root).toBe(-1);
    expect(chordAt(spans, 600)?.symbol).toBe('G7');
    expect(chordAt(spans, 10_000)).toBeNull();
  });

  it('merges neighbouring spans of one chord', () => {
    const a = spanFromSymbol('C', 0, 96)!;
    const b = spanFromSymbol('C', 96, 96)!;
    expect(mergeSpans([b, a])).toHaveLength(1);
  });
});

describe('chord inference', () => {
  it('hears I–V–I under a melody', () => {
    const { score } = parseSongDoc({ title: 'T', instrument: 'piano', key: 'C', time: [4, 4], staves: [{ clef: 'treble', voices: ['E4/q D4 C4 D4 | E4 E4 E4/h | D4/q D4 D4/h | E4/q G4 G4/h | C4/w |'] }] });
    const spans = inferChords(score);
    expect(spans[0].symbol).toBe('C');
    expect(chordAt(spans, 2 * 192 + 10)?.root).toBe(7); // D D D: the dominant
    expect(spans[spans.length - 1].symbol).toBe('C');
  });

  it('follows a bass line: the bass note is the root', () => {
    const { score } = parseSongDoc({ title: 'T', instrument: 'bass', key: 'D', time: [4, 4], staves: [{ clef: 'bass8vb', voices: ['D2/h A1 | B1 F#1 | G1 D2 | G1 A1 |'] }] });
    expect(inferChords(score).map(s => s.symbol)).toEqual(['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A']);
  });

  it('only picks a chord with a note outside the key when that note is played', () => {
    const { score } = parseSongDoc({ title: 'T', instrument: 'piano', key: 'C', time: [4, 4], staves: [{ clef: 'treble', voices: ['E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/q. D4/e D4/h |'] }] });
    expect(inferChords(score).every(s => !/E7|D7|A7|B7/.test(s.symbol ?? ''))).toBe(true);
  });

  it('agrees with the hand-written chords of the library songs most of the time', () => {
    let sum = 0;
    let n = 0;
    for (const s of ALL_SONGS.filter(x => x.chords)) {
      const score = songToScore(s);
      const own = chordSpansFromLine(s, score)!;
      const inferred = inferChords(score);
      let agree = 0;
      let total = 0;
      const end = own[own.length - 1].tick + own[own.length - 1].ticks;
      for (let t = 0; t < end; t += 12) {
        const a = chordAt(own, t);
        if (!a || a.root < 0) continue;
        total++;
        if (chordAt(inferred, t)?.root === a.root) agree++;
      }
      sum += agree / total;
      n++;
    }
    expect(n).toBeGreaterThan(20);
    expect(sum / n).toBeGreaterThan(0.8);
  });

  it('uses the chord line when there is one, else infers', () => {
    const base = { title: 'T', instrument: 'piano', key: 'C', time: [4, 4], staves: [{ clef: 'treble', voices: ['C4/w | G4 |'] }] };
    const withLine = parseSongDoc({ ...base, chords: 'F | F |' });
    expect(songChordSpans(withLine.song, withLine.score)).toMatchObject({ inferred: false, spans: [{ symbol: 'F' }] });
    const without = parseSongDoc(base);
    expect(songChordSpans(without.song, without.score).inferred).toBe(true);
  });
});
