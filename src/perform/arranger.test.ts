import { describe, expect, it } from 'vitest';
import { ALL_SONGS } from '../content/songs';
import { BAND_STYLES, type BandStyle } from '../music/band';
import { drumNameOf } from '../music/gm';
import { songToScore } from '../music/parse';
import { measureStartTick, scoreTotalTicks } from '../music/score';
import { parseSongDoc } from '../songs/format';
import { arrange, buildBand, closeVoicing, defaultSource, resolveStyle, sliceTracks, songBandTracks } from './arranger';
import { chordAt, songChordSpans, spanFromSymbol } from './harmony';

const song = (over: Record<string, unknown> = {}) =>
  parseSongDoc({
    title: 'Test',
    instrument: 'piano',
    key: 'C',
    time: [4, 4],
    tempo: 100,
    staves: [{ clef: 'treble', voices: ['E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/q. D4/e D4/h | E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/q. C4/e C4/h |'] }],
    chords: 'C | G7 | C | C/h G7/h | C | G7 | C | G7/h C/h |',
    ...over,
  });

const STYLES = BAND_STYLES.map(s => s.id).filter((s): s is Exclude<BandStyle, 'auto'> => s !== 'auto');

describe('choosing a style', () => {
  it('picks one from the meter and tempo', () => {
    expect(resolveStyle('auto', { time: [3, 4], tempo: 100 })).toBe('waltz');
    expect(resolveStyle(undefined, { time: [6, 8], tempo: 80 })).toBe('compound');
    expect(resolveStyle('auto', { time: [4, 4], tempo: 60 })).toBe('gentle');
    expect(resolveStyle('auto', { time: [4, 4], tempo: 76 })).toBe('ballad');
    expect(resolveStyle('auto', { time: [4, 4], tempo: 110 })).toBe('pop');
    expect(resolveStyle('auto', { time: [2, 4], tempo: 112 })).toBe('march');
    expect(resolveStyle('swing', { time: [4, 4], tempo: 110 })).toBe('swing');
  });
});

describe('the arranger', () => {
  it('writes drums, bass, chords (and a pad where the style has one) that follow the harmony', () => {
    const { song: s, score } = song();
    const band = arrange(s, score, { player: 'piano', style: 'pop' });
    expect(band.tracks.map(t => t.role)).toEqual(['drums', 'bass', 'chords']);
    const { spans } = songChordSpans(s, score);
    const bass = band.tracks.find(t => t.role === 'bass')!;
    // every chord change starts with the chord's bass note
    for (const sp of spans) {
      const n = bass.notes.find(x => x.tick === sp.tick);
      expect(n, `bass at ${sp.tick}`).toBeDefined();
      expect(((n!.midi % 12) + 12) % 12).toBe(sp.bass);
    }
    // the chords are chord tones
    const comp = band.tracks.find(t => t.role === 'chords')!;
    for (const n of comp.notes) expect(chordAt(spans, n.tick)!.pcs).toContain(n.midi % 12);
    // a pop beat has kick, snare and hi-hat
    const drums = band.tracks.find(t => t.role === 'drums')!;
    const names = new Set(drums.notes.map(n => drumNameOf(n.midi)));
    for (const d of ['kick', 'snare', 'hat']) expect(names.has(d)).toBe(true);
  });

  it('plays every library song in every style without stepping outside the song or the instruments', () => {
    const problems: string[] = [];
    const songs = ALL_SONGS.filter((_, i) => i % 3 === 0);
    const range: Record<string, [number, number]> = { bass: [28, 53], chords: [38, 84], pad: [55, 80] };
    for (const def of songs) {
      const score = songToScore(def);
      const end = scoreTotalTicks(score);
      for (const style of STYLES) {
        const band = arrange(def, score, { player: def.instrument, style, seed: 3 });
        for (const t of band.tracks) {
          const label = `${def.id} ${style} ${t.role}`;
          if (!t.notes.length) problems.push(`${label}: no notes`);
          t.notes.forEach((n, i) => {
            const bad =
              (i > 0 && n.tick < t.notes[i - 1].tick) ||
              n.tick < 0 ||
              n.tick >= end ||
              !(n.ticks > 0) ||
              !(n.velocity > 0 && n.velocity <= 1) ||
              Math.abs(n.offset ?? 0) >= 0.1 ||
              (t.role === 'drums' && drumNameOf(n.midi) === null) ||
              (range[t.role] && (n.midi < range[t.role][0] || n.midi > range[t.role][1]));
            if (bad) problems.push(`${label}: ${JSON.stringify(n)}`);
          });
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('leaves the pickup to the soloist and ends with one big chord', () => {
    const { song: s, score } = song({
      pickup: 'q',
      staves: [{ clef: 'treble', voices: ['G4/q | C5/w | B4/w | C5/h. G4/q | C5/h. |'] }],
      chords: 'r/q | C | G7 | C | C/h. |',
    });
    const band = arrange(s, score, { player: 'piano', style: 'pop' });
    const firstBar = measureStartTick(score, 1);
    const lastBar = measureStartTick(score, score.measures - 1);
    for (const t of band.tracks) {
      expect(Math.min(...t.notes.map(n => n.tick))).toBeGreaterThanOrEqual(firstBar);
      const final = t.notes.filter(n => n.tick >= lastBar);
      expect(final.every(n => n.tick === lastBar), t.role).toBe(true);
    }
    const drums = band.tracks.find(t => t.role === 'drums')!;
    expect(drums.notes.filter(n => n.tick >= lastBar).map(n => drumNameOf(n.midi)).sort()).toEqual(['crash', 'kick']);
  });

  it('leaves the bass to a bass player and the chords to someone strumming them', () => {
    const { song: s, score } = song();
    expect(arrange(s, score, { player: 'bass', style: 'pop' }).tracks.some(t => t.role === 'bass')).toBe(false);
    expect(arrange(s, score, { player: 'guitar', style: 'pop', strumming: true }).tracks.some(t => t.role === 'chords')).toBe(false);
    // a pianist gets a guitar comping, a guitarist a piano
    expect(arrange(s, score, { player: 'piano', style: 'pop' }).tracks.find(t => t.role === 'chords')?.program).toBe(26);
    expect(arrange(s, score, { player: 'guitar', style: 'pop' }).tracks.find(t => t.role === 'chords')?.program).toBe(1);
  });

  it('has no drums in the gentle style, swings in swing, and rests under N.C.', () => {
    const { song: s, score } = song({ chords: 'C | N.C. | C | C/h G7/h | C | G7 | C | G7/h C/h |' });
    expect(arrange(s, score, { player: 'piano', style: 'gentle' }).tracks.some(t => t.role === 'drums')).toBe(false);
    expect(arrange(s, score, { player: 'piano', style: 'swing' }).swing).toBe(true);
    const band = arrange(s, score, { player: 'piano', style: 'pop' });
    for (const role of ['bass', 'chords']) {
      const t = band.tracks.find(x => x.role === role)!;
      expect(t.notes.some(n => n.tick >= 192 && n.tick < 384), role).toBe(false);
    }
  });

  it('grooves in unusual meters from their beat groups', () => {
    for (const [time, bar] of [
      [[5, 4], 'C4/h. D4/h |'],
      [[7, 8], 'C4/q D4/q E4/q. |'],
    ] as const) {
      const { song: s, score } = song({ time, staves: [{ clef: 'treble', voices: [`${bar} ${bar} ${bar} ${bar}`] }], chords: undefined });
      const band = arrange(s, score, { player: 'piano', style: 'pop' });
      const drums = band.tracks.find(t => t.role === 'drums')!;
      expect(drums.notes.some(n => drumNameOf(n.midi) === 'snare'), time.join('/')).toBe(true);
      expect(band.inferredChords).toBe(true);
    }
  });

  it('is the same band every time for a seed', () => {
    const { song: s, score } = song();
    expect(arrange(s, score, { player: 'piano', style: 'swing', seed: 5 })).toEqual(arrange(s, score, { player: 'piano', style: 'swing', seed: 5 }));
  });
});

describe('voicings', () => {
  it('voice-leads: the next chord moves as little as possible', () => {
    const c = closeVoicing(spanFromSymbol('C', 0, 1)!, 3, null, 55, 72);
    const f = closeVoicing(spanFromSymbol('F', 0, 1)!, 3, c, 55, 72);
    expect(c.map(m => m % 12).sort()).toEqual([0, 4, 7]);
    expect(f.map(m => m % 12).sort()).toEqual([0, 5, 9]);
    // C E G → C F A keeps the C
    expect(f.reduce((a, m, i) => a + Math.abs(m - c[i]), 0)).toBeLessThanOrEqual(3);
    const g7 = closeVoicing(spanFromSymbol('G7', 0, 1)!, 3, null, 55, 72);
    expect(g7.map(m => m % 12)).not.toContain(2); // a three-note seventh chord drops the fifth
  });
});

describe('the song’s own band', () => {
  const BAND = [
    { name: 'Bass', program: 34, voices: ['C2/w | G1 | C2 | C2/h G1 | C2/w | G1 | C2 | G1/h C2 |'] },
    { name: 'Kit', drums: true, voices: Array(1).fill('[kick hat]/q [snare hat] [kick hat] [snare hat] | '.repeat(8)) },
  ];

  it('plays the written parts, and the arranger only adds what is missing', () => {
    const { song: s, score } = song({ band: BAND });
    expect(defaultSource(s)).toBe('song');
    const own = buildBand(s, score, { player: 'piano', source: 'song' });
    expect(own.tracks.map(t => [t.id, t.role, t.source])).toEqual([
      ['song:0', 'bass', 'song'],
      ['song:1', 'drums', 'song'],
    ]);
    const both = buildBand(s, score, { player: 'piano', source: 'both', style: 'ballad' });
    expect(both.tracks.map(t => t.role)).toEqual(['bass', 'drums', 'chords', 'pad']);
    expect(both.tracks.filter(t => t.source === 'auto').map(t => t.role)).toEqual(['chords', 'pad']);
    const auto = buildBand(s, score, { player: 'piano', source: 'auto', style: 'pop' });
    expect(auto.tracks.every(t => t.source === 'auto')).toBe(true);
  });

  it('reads the written notes with their tied lengths', () => {
    const { song: s } = song({ band: BAND });
    const { tracks } = songBandTracks(s);
    expect(tracks[0].notes[0]).toMatchObject({ tick: 0, ticks: 192, midi: 36 });
    expect(tracks[1].notes.slice(0, 2).map(n => n.midi)).toEqual([36, 42]);
  });

  it('cuts tracks to a passage', () => {
    const { song: s } = song({ band: BAND });
    const { tracks } = songBandTracks(s);
    const cut = sliceTracks(tracks, 192, 384);
    expect(cut[0].notes).toEqual([{ ...tracks[0].notes[1], tick: 0 }]);
    expect(cut[1].notes.every(n => n.tick >= 0 && n.tick < 192)).toBe(true);
  });
});
