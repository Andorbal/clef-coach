import { describe, expect, it } from 'vitest';
import { ALL_SONGS } from '../content/songs';
import { BAND_STYLES, type BandStyle } from '../music/band';
import { songToScore } from '../music/parse';
import { parseSongDoc, songToDoc } from '../songs/format';
import { arrange, songBandTracks } from './arranger';
import { tracksToBandParts } from './writeBand';

const STYLES = BAND_STYLES.map(s => s.id).filter((s): s is Exclude<BandStyle, 'auto'> => s !== 'auto');

describe('writing a band into the song', () => {
  it('writes every style for a range of songs as band parts that load bar for bar and play the same notes', () => {
    const problems: string[] = [];
    for (const def of ALL_SONGS.filter((_, i) => i % 7 === 0)) {
      const score = songToScore(def);
      for (const style of STYLES) {
        const band = arrange(def, score, { player: def.instrument, style, seed: 1 });
        const parts = tracksToBandParts(band.tracks, score);
        let reread;
        try {
          const { song, warnings } = parseSongDoc(songToDoc({ ...def, band: parts }), { id: def.id });
          if (warnings.some(w => /band part/.test(w))) problems.push(`${def.id} ${style}: ${warnings.join(' ')}`);
          reread = songBandTracks(song).tracks;
        } catch (e) {
          problems.push(`${def.id} ${style}: ${(e as Error).message.slice(0, 200)}`);
          continue;
        }
        band.tracks.forEach((t, i) => {
          const onsets = (notes: { tick: number; midi: number }[]) => [...new Set(notes.map(n => `${n.tick}:${n.midi}`))].sort().join(' ');
          if (onsets(t.notes) !== onsets(reread[i].notes)) problems.push(`${def.id} ${style} ${t.role}: notes differ`);
        });
      }
    }
    expect(problems.slice(0, 8)).toEqual([]);
  });

  it('names the drums and keeps each part’s sound and mix', () => {
    const def = ALL_SONGS.find(s => s.id === 'prh-jingle-bells')!;
    const score = songToScore(def);
    const parts = tracksToBandParts(arrange(def, score, { player: 'piano', style: 'pop' }).tracks, score);
    const drums = parts.find(p => p.drums)!;
    expect(drums.staves[0].voices[0]).toMatch(/kick/);
    expect(drums.staves[0].voices[0]).toMatch(/snare/);
    expect(parts.find(p => p.role === 'bass')).toMatchObject({ program: 34, staves: [{ clef: 'bass8vb' }] });
  });
});
