import { describe, expect, it } from 'vitest';
import { parseVoice, formatVoice, unrollRepeats } from '../music/parse';
import { measureTicks } from '../music/rhythm';
import { SongFormatError, parseChordTimeline, parseSongDoc, parseTempo, songSections, songToJson } from './format';

const SILENT_NIGHT = {
  format: 'clef-coach-song',
  version: 1,
  title: 'Silent Night',
  composer: 'Franz Xaver Gruber',
  year: '1818',
  instrument: 'piano',
  key: 'Bb',
  time: [6, 8],
  tempo: 'q.=52',
  staves: [
    { clef: 'treble', voices: ['F4/q. G4/e F4/q | D4/h. | F4/q. G4/e F4/q | D4/h. |'] },
    { clef: 'bass', voices: ['[Bb2 F3]/h. | [Bb2 F3] | [Bb2 D3 F3] | [Bb2 D3 F3] |'] },
  ],
  chords: 'Bb/h. | Bb/h. | Bb/h. | Bb/h. |',
  lyrics: ['Si- lent night, ho- ly night, all is calm, all is bright'],
};

describe('song format', () => {
  it('reads a valid song', () => {
    const { song, score, warnings } = parseSongDoc(JSON.stringify(SILENT_NIGHT));
    expect(song.title).toBe('Silent Night');
    expect(song.staves[0].hand).toBe('R');
    expect(song.staves[1].hand).toBe('L');
    expect(score.measures).toBe(4);
    // dotted-quarter = 52 → quarter = 78
    expect(song.tempo).toBe(78);
    expect(warnings).toEqual([]);
  });

  it('accepts a fenced code block (as LLMs often answer)', () => {
    const { song } = parseSongDoc('```json\n' + JSON.stringify(SILENT_NIGHT) + '\n```');
    expect(song.key).toBe('Bb');
  });

  it('reports every problem at once', () => {
    try {
      parseSongDoc({ format: 'clef-coach-song', instrument: 'banjo', key: 'H', staves: [] });
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(SongFormatError);
      const issues = (e as SongFormatError).issues.join(' ');
      expect(issues).toMatch(/title/);
      expect(issues).toMatch(/instrument/);
      expect(issues).toMatch(/key/);
      expect(issues).toMatch(/staves/);
    }
  });

  it('points at the measure with the wrong number of beats', () => {
    const bad = { ...SILENT_NIGHT, staves: [{ clef: 'treble', voices: ['F4/q. G4/e F4/q | D4/q |'] }] };
    expect(() => parseSongDoc(bad)).toThrow(/measure 2 has 2 beats, expected 6/);
  });

  it('warns about unknown chords and uneven staves', () => {
    const doc = { ...SILENT_NIGHT, chords: 'Bb/h. | Xq7/h. | F7/h. | Bb/h. |', staves: [SILENT_NIGHT.staves[0], { clef: 'bass', voices: ['Bb2/h. |'] }] };
    const { warnings } = parseSongDoc(doc);
    expect(warnings.join(' ')).toMatch(/Xq7/);
    expect(warnings.join(' ')).toMatch(/staff 2 voice 1 has 1 measures/);
  });

  it('round-trips through JSON', () => {
    const { song } = parseSongDoc(SILENT_NIGHT);
    const again = parseSongDoc(songToJson(song));
    expect(again.song.staves).toEqual(song.staves);
    expect(again.song.tempo).toBe(song.tempo);
  });

  it('parses tempo forms', () => {
    expect(parseTempo(90)).toBe(90);
    expect(parseTempo('h=60')).toBe(120);
    expect(parseTempo('q.=40')).toBe(60);
  });

  it('builds a chord timeline', () => {
    const { score } = parseSongDoc(SILENT_NIGHT);
    const { events, unknown } = parseChordTimeline('Bb/h. | Bb | F7 Bb/C | Bb/h. |', score);
    expect(unknown).toEqual([]);
    expect(events.map(e => e.symbol)).toEqual(['Bb', 'Bb', 'F7', 'Bb/C', 'Bb']);
    // undurated chords share the measure
    expect(events[2].ticks).toBe(measureTicks([6, 8]) / 2);
  });

  it('makes automatic phrases', () => {
    expect(songSections({}, { measures: 16 })).toEqual([
      { name: 'Phrase 1', from: 1, to: 4 },
      { name: 'Phrase 2', from: 5, to: 8 },
      { name: 'Phrase 3', from: 9, to: 12 },
      { name: 'Phrase 4', from: 13, to: 16 },
    ]);
    // pickup bar joins the first phrase; no single-bar leftovers
    expect(songSections({}, { measures: 10, pickup: 24 }).map(s => [s.from, s.to])).toEqual([[1, 5], [6, 10]]);
    expect(songSections({}, { measures: 4 }).map(s => [s.from, s.to])).toEqual([[1, 2], [3, 4]]);
  });
});

describe('notation extensions', () => {
  it('unrolls repeats and endings', () => {
    const t = unrollRepeats('|: C4/w | D4 |1 E4 :|2 F4 | G4 |').join(' ');
    expect(t).toBe('C4/w | D4 | E4 | C4/w | D4 | F4 | G4 |');
    expect(unrollRepeats('C4/w :| D4 |').join(' ')).toBe('C4/w | C4/w | D4 |');
  });

  it('reads key and time changes', () => {
    const r = parseVoice('C4/w | [T:3/4] D4/h. | [K:G] F#4/h. |', [4, 4]);
    expect(r.measures).toBe(3);
    expect(r.changes).toEqual([{ measure: 1, time: [3, 4] }, { measure: 2, key: { fifths: 1, mode: 'major' } }]);
    expect(() => parseVoice('C4/w | [T:3/4] D4/w |', [4, 4])).toThrow(/measure 2 has 4 beats, expected 3/);
  });

  it('reads mallet sticking letters', () => {
    const r = parseVoice('C4/q@R D4@L [C4 E4]@L,R G4@4 |', [4, 4]);
    expect(r.specs.map(s => s.fingers)).toEqual([[3], [2], [2, 3], [4]]);
  });

  it('writes notation back, splitting notes across bar lines', () => {
    const r = parseVoice('C4/h. D4/h E4/q F4/h', [4, 4], 0, 'v', true);
    const text = formatVoice(r.specs, [4, 4]);
    expect(text).toBe('C4/h. D4/q~ | D4 E4 F4/h |');
    // and it reads back to the same music
    const back = parseVoice(text, [4, 4]);
    expect(back.measures).toBe(2);
    expect(formatVoice(parseVoice('[C4 E4]/e@1,3 D4@2 r/q G4/h%2 |', [4, 4]).specs, [4, 4])).toBe('[C4 E4]/e@1,3 D4@2 r/q G4/h%2 |');
  });
});
