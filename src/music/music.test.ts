import { describe, expect, it } from 'vitest';
import { parsePitch, midiOf, pitchToString, spellMidi, diatonicIndex, fromDiatonic } from './pitch';
import { parseKey, scalePitches, keyName, tonicOf } from './keys';
import { parseVoice, songToScore } from './parse';
import { buildSteps } from './score';
import { scaleFingering, fingerPianoLine } from './fingering';
import { positionsFor, fingerGuitarLine, scaleBox, PENTATONIC_MINOR, transposePcs, cagedChord } from './guitar';
import { PPQ, beatTicks, beatsPerBar } from './rhythm';

describe('pitch', () => {
  it('parses and converts', () => {
    expect(midiOf(parsePitch('C4'))).toBe(60);
    expect(midiOf(parsePitch('A4'))).toBe(69);
    expect(midiOf(parsePitch('Bb3'))).toBe(58);
    expect(midiOf(parsePitch('F##4'))).toBe(67);
    expect(midiOf(parsePitch('E2'))).toBe(40);
    expect(pitchToString(parsePitch('c#5'))).toBe('C#5');
  });
  it('spells midi in key context', () => {
    expect(pitchToString(spellMidi(61))).toBe('C#4');
    expect(pitchToString(spellMidi(61, -2))).toBe('Db4');
    expect(pitchToString(spellMidi(59))).toBe('B3');
  });
  it('diatonic roundtrip', () => {
    const p = parsePitch('G2');
    expect(fromDiatonic(diatonicIndex(p))).toEqual(p);
  });
});

describe('keys', () => {
  it('parses key names', () => {
    expect(parseKey('G')).toEqual({ fifths: 1, mode: 'major' });
    expect(parseKey('Em')).toEqual({ fifths: 1, mode: 'minor' });
    expect(parseKey('Bb')).toEqual({ fifths: -2, mode: 'major' });
    expect(keyName({ fifths: 3, mode: 'minor' })).toBe('F#m');
    expect(tonicOf({ fifths: -3, mode: 'minor' })).toEqual({ step: 'C', alter: 0 });
  });
  it('builds scales', () => {
    expect(scalePitches({ step: 'D', alter: 0 }, 4, 'major').map(pitchToString).join(' '))
      .toBe('D4 E4 F#4 G4 A4 B4 C#5 D5');
    expect(scalePitches({ step: 'A', alter: 0 }, 3, 'harmonic-minor').map(pitchToString).join(' '))
      .toBe('A3 B3 C4 D4 E4 F4 G#4 A4');
    expect(scalePitches({ step: 'E', alter: -1 }, 4, 'major').map(pitchToString).join(' '))
      .toBe('Eb4 F4 G4 Ab4 Bb4 C5 D5 Eb5');
  });
});

describe('notation parser', () => {
  it('parses a melody with carry-over durations, fingers and ties', () => {
    const r = parseVoice('E4/q@3 E4 F4@4 G4@5 | G4/h~ G4/q r | [C4 E4 G4]/w@1,3,5 |', [4, 4]);
    expect(r.measures).toBe(3);
    expect(r.specs).toHaveLength(8);
    expect(r.specs[1].base).toBe('q');
    expect(r.specs[4].tieNext).toBe(true);
    expect(r.specs[6].pitches).toHaveLength(0);
    expect(r.specs[7].fingers).toEqual([1, 3, 5]);
  });
  it('rejects wrong measure lengths', () => {
    expect(() => parseVoice('C4/q D4 E4 |', [4, 4])).toThrow(/measure 1/);
  });
  it('supports pickups and triplets', () => {
    const s = songToScore({
      id: 't', title: 't', composer: 'x', instrument: 'piano', level: 1, key: 'C', time: [3, 4], tempo: 90, pickup: 'q',
      staves: [{ clef: 'treble', voices: ['G4/q | C5/e3 D5 E5 F5/q G5 | A5/h'] }],
    });
    expect(s.measures).toBe(3);
    const steps = buildSteps(s);
    expect(steps[0].tick).toBe(0);
    expect(steps[1].tick).toBe(PPQ);
    expect(steps[2].tick).toBe(PPQ + 16);
  });
  it('builds play steps merging hands', () => {
    const s = songToScore({
      id: 'g', title: 'g', composer: 'x', instrument: 'piano', level: 1, key: 'C', time: [4, 4], tempo: 90,
      staves: [
        { clef: 'treble', hand: 'R', voices: ['C5/h D5 |'] },
        { clef: 'bass', hand: 'L', voices: ['C3/w |'] },
      ],
    });
    const steps = buildSteps(s);
    expect(steps).toHaveLength(2);
    expect(steps[0].notes.map(n => n.midi)).toEqual([48, 72]);
    expect(steps[0].notes[0].hand).toBe('L');
  });
});

describe('fingering', () => {
  it('knows standard scale fingerings', () => {
    expect(scaleFingering('C', 'major', 'R', 2)).toEqual([1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]);
    expect(scaleFingering('C', 'major', 'L', 1)).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
    expect(scaleFingering('F', 'major', 'R', 1)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(scaleFingering('Bb', 'major', 'R', 1)).toEqual([4, 1, 2, 3, 1, 2, 3, 4]);
  });
  it('fingers a five-finger melody naturally', () => {
    const line = [60, 62, 64, 65, 67, 65, 64, 62, 60].map(m => ({ midis: [m] }));
    expect(fingerPianoLine(line, 'R').map(f => f[0])).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
    const lh = [48, 50, 52, 53, 55].map(m => ({ midis: [m] }));
    expect(fingerPianoLine(lh, 'L').map(f => f[0])).toEqual([5, 4, 3, 2, 1]);
  });
  it('passes the thumb under in a C scale', () => {
    const line = [60, 62, 64, 65, 67, 69, 71, 72].map(m => ({ midis: [m] }));
    const f = fingerPianoLine(line, 'R').map(x => x[0]);
    expect(f[0]).toBe(1);
    expect(f.filter(x => x === 1).length).toBeGreaterThanOrEqual(2);
  });
  it('respects fixed fingers', () => {
    const line = [{ midis: [64], fixed: [3] }, { midis: [65] }, { midis: [67] }];
    expect(fingerPianoLine(line, 'R').map(f => f[0])).toEqual([3, 4, 5]);
  });
});

describe('guitar', () => {
  it('finds positions', () => {
    expect(positionsFor(40, 12)).toEqual([{ string: 6, fret: 0 }]);
    expect(positionsFor(64, 12)).toEqual([
      { string: 3, fret: 9 }, { string: 2, fret: 5 }, { string: 1, fret: 0 },
    ]);
  });
  it('fingers first-position melody on top strings', () => {
    // E F G on string 1, B C D on string 2
    const res = fingerGuitarLine([64, 65, 67, 59, 60, 62].map(m => ({ midis: [m] })), { preferPosition: 1 });
    expect(res.map(r => [r[0].string, r[0].fret, r[0].finger])).toEqual([
      [1, 0, 0], [1, 1, 1], [1, 3, 3], [2, 0, 0], [2, 1, 1], [2, 3, 3],
    ]);
  });
  it('builds pentatonic box 1 in A', () => {
    const box = scaleBox(transposePcs(PENTATONIC_MINOR, 9), 0, 2, 1);
    expect(box.map(p => `${p.string}:${p.fret}`).join(' ')).toBe('6:5 6:8 5:5 5:7 4:5 4:7 3:5 3:7 2:5 2:8 1:5 1:8');
  });
  it('builds CAGED shapes', () => {
    expect(cagedChord(0, 'C').frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(cagedChord(7, 'G').frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(cagedChord(2, 'D').frets).toEqual([null, null, 0, 2, 3, 2]);
    expect(cagedChord(9, 'E', 'major', 1).frets).toEqual([5, 7, 7, 6, 5, 5]);
  });
});

describe('beats per bar (metronome and count-in)', () => {
  it('counts the beat the meter is felt in', () => {
    expect(beatsPerBar([4, 4])).toBe(4);
    expect(beatsPerBar([3, 4])).toBe(3);
    expect(beatsPerBar([2, 2])).toBe(2);
    expect(beatsPerBar([2, 4])).toBe(2);
    expect(beatsPerBar([6, 8])).toBe(2);
    expect(beatsPerBar([9, 8])).toBe(3);
    expect(beatsPerBar([12, 8])).toBe(4);
    expect(beatsPerBar([3, 8])).toBe(3); // eighth-note beats, like beatTicks
    expect(beatsPerBar([5, 4])).toBe(5);
    expect(beatsPerBar([7, 8])).toBe(7);
  });

  it('agrees with beatTicks: beats × beat length = one bar', () => {
    for (const t of [[4, 4], [3, 4], [2, 2], [6, 8], [9, 8], [12, 8], [3, 8], [5, 4], [7, 8]] as [number, number][]) {
      expect(beatsPerBar(t) * beatTicks(t)).toBe((t[0] * PPQ * 4) / t[1]);
    }
  });
});
