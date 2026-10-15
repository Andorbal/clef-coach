import { describe, expect, it } from 'vitest';
import { SongFormatError, parseSongDoc, songToDoc } from '../songs/format';
import { bandPartScore, inferRole } from './band';
import { buildSteps } from './score';
import { drumKeyOf, drumNameOf, drumWordsToPitches, gmFamily, gmKitName, gmProgramName, pitchesToDrumWords } from './gm';

const ODE = {
  format: 'clef-coach-song',
  version: 1,
  title: 'Ode to Joy',
  instrument: 'piano',
  key: 'C',
  time: [4, 4],
  tempo: 100,
  staves: [{ clef: 'treble', voices: ['E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/q. D4/e D4/h |'] }],
  chords: 'C | G | C | C/h G/h |',
};

const BAND = [
  { name: 'Bass', program: 34, voices: ['C2/h G2 | G2/h D2 | C2/h G2 | C2/h G2 |'] },
  { name: 'Drums', drums: true, voices: ['[kick hat]/e hat [snare hat] hat [kick hat] hat [snare hat] hat | [kick hat]/e hat [snare hat] hat [kick hat] hat [snare hat] hat | [kick crash]/q rim kick rim | kick/q rim [kick open-hat] snare |'] },
  { name: 'Strings', program: 49, role: 'pad', volume: 0.6, pan: -0.2, staves: [{ clef: 'treble', voices: ['[C4 E4 G4]/w | [B3 D4 G4]/w | [C4 E4 G4]/w | [C4 E4 G4]/h [B3 D4 G4]/h |'] }] },
];

describe('General MIDI tables', () => {
  it('names programs, families and kits (1-based, as printed in GM lists)', () => {
    expect(gmProgramName(1)).toBe('Acoustic Grand Piano');
    expect(gmProgramName(34)).toBe('Fingered Bass');
    expect(gmProgramName(128)).toBe('Gunshot');
    expect(gmFamily(49)).toBe('Ensemble');
    expect(gmFamily(33)).toBe('Bass');
    expect(gmKitName(1)).toBe('Standard kit');
    expect(gmKitName(42)).toBe('Brush kit');
  });

  it('maps drum names to percussion keys and back', () => {
    expect(drumKeyOf('kick')).toBe(36);
    expect(drumKeyOf('Snare')).toBe(38);
    expect(drumKeyOf('hh')).toBe(42);
    expect(drumKeyOf('open-hat')).toBe(46);
    expect(drumKeyOf('banjo')).toBeNull();
    expect(drumNameOf(49)).toBe('crash');
    expect(drumNameOf(20)).toBeNull();
  });

  it('turns drum words into pitches and pitches back into words', () => {
    const text = '[kick hat]/e hat [snare~ hat] hat@R | kick2/q. [K:G] r/e |';
    const pitched = drumWordsToPitches(text);
    expect(pitched).toBe('[C2 F#2]/e F#2 [D2~ F#2] F#2@R | B1/q. [K:G] r/e |');
    expect(pitchesToDrumWords(pitched)).toBe('[kick hat]/e hat [snare~ hat] hat@R | kick2/q. [K:G] r/e |');
    // words that aren't drums are left for the parser to report
    expect(drumWordsToPitches('[kick banjo]/q')).toBe('[C2 banjo]/q');
  });
});

describe('band parts in a song file', () => {
  it('reads band parts and builds their music bar by bar', () => {
    const { song, warnings } = parseSongDoc({ ...ODE, band: BAND, style: 'pop' });
    expect(warnings).toEqual([]);
    expect(song.style).toBe('pop');
    expect(song.band).toHaveLength(3);
    const [bass, drums, strings] = song.band!;
    expect(bass).toMatchObject({ name: 'Bass', program: 34 });
    expect(bass.staves[0].clef).toBe('bass8vb'); // filled in from the sound
    expect(drums.drums).toBe(true);
    expect(drums.program).toBe(1);
    expect(strings).toMatchObject({ role: 'pad', volume: 0.6, pan: -0.2 });
    const drumScore = bandPartScore(song, drums, 1);
    const first = buildSteps(drumScore)[0];
    expect(first.notes.map(n => n.midi)).toEqual([36, 42]);
    expect(drumScore.measures).toBe(4);
  });

  it('works out roles from the sound and the music', () => {
    const { song } = parseSongDoc({ ...ODE, band: BAND });
    const roles = song.band!.map((p, i) => inferRole(p, bandPartScore(song, p, i)));
    expect(roles).toEqual(['bass', 'drums', 'pad']);
  });

  it('writes band parts back out (one staff written short) and reads them again', () => {
    const { song } = parseSongDoc({ ...ODE, band: BAND });
    const doc = songToDoc(song);
    expect(doc.band?.[0]).toEqual({ name: 'Bass', program: 34, clef: 'bass8vb', voices: BAND[0].voices });
    expect(doc.band?.[1].drums).toBe(true);
    const again = parseSongDoc(doc);
    expect(again.song.band).toEqual(song.band);
  });

  it('points at the bar of a band part that does not add up', () => {
    const bad = { ...ODE, band: [{ name: 'Bass', program: 34, voices: ['C2/h G2 | G2/h | C2/w | C2/w |'] }] };
    try {
      parseSongDoc(bad);
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(SongFormatError);
      expect((e as SongFormatError).message).toMatch(/band part 1 \("Bass"\).*measure 2 has 2 beats, expected 4/);
    }
  });

  it('reports bad fields and unknown drum names', () => {
    expect(() => parseSongDoc({ ...ODE, band: [{ name: 'X', program: 200, voices: ['C4/w | C4 | C4 | C4 |'] }] })).toThrow(/program/);
    expect(() => parseSongDoc({ ...ODE, band: [{ name: 'Kit', drums: true, voices: ['[kick banjo]/w | kick | kick | kick |'] }] })).toThrow(/Kit/);
    expect(() => parseSongDoc({ ...ODE, band: [{ name: 'Empty', program: 1 }] })).toThrow(/no music/);
  });

  it('warns (but loads) when a band part is shorter than the song or has no program', () => {
    const { warnings } = parseSongDoc({ ...ODE, band: [{ name: 'Keys', voices: ['C4/w | C4 |'] }], style: 'disco' });
    expect(warnings.join(' ')).toMatch(/has 2 bars; the music has 4/);
    expect(warnings.join(' ')).toMatch(/no "program"/);
    expect(warnings.join(' ')).toMatch(/style/);
  });

  it('writes band parts out with the same repeats as the music', () => {
    const rep = {
      ...ODE,
      staves: [{ clef: 'treble', voices: ['|: E4/q E4 F4 G4 | G4 F4 E4 D4 :|'] }],
      chords: undefined,
      band: [{ name: 'Bass', program: 34, voices: ['|: C2/w | G2/w :|'] }],
    };
    const { song, score } = parseSongDoc(rep);
    expect(score.measures).toBe(4);
    expect(bandPartScore(song, song.band![0], 0).measures).toBe(4);
  });
});

describe('library songs with a band', () => {
  it('load through the song format and line up bar for bar', async () => {
    const { ALL_SONGS } = await import('../content/songs');
    const withBand = ALL_SONGS.filter(s => s.band?.length);
    expect(withBand.length).toBeGreaterThan(0);
    for (const s of withBand) {
      const { song, score, warnings } = parseSongDoc(songToDoc(s), { id: s.id });
      expect(warnings, s.id).toEqual([]);
      song.band!.forEach((p, i) => expect(bandPartScore(song, p, i).measures, `${s.id} ${p.name}`).toBe(score.measures));
    }
  });
});
