import { describe, expect, it } from 'vitest';
import { autoFinger } from './autofinger';
import { fingerGuitarLine, positionsFor, stringsLowToHigh } from './guitar';
import { INSTRUMENTS, TUNINGS, inputOffsetFor, micRangeFor, tuningFor, voiceFor } from './instruments';
import { scoreFromText } from './parse';
import { midiOfString } from './pitch';
import { malletLabel, stickLine } from './sticking';

const m = midiOfString;
const evs = (s: string, gap = 24) => s.split(' ').map(x => ({ midis: x.split('+').map(m), gap }));
const sticking = (s: string, mallets: 2 | 4 = 2, gap = 24) =>
  stickLine(evs(s, gap), { mallets })
    .map(x => x.map(y => (y ? malletLabel(y, mallets) : '-')).join(''))
    .join(' ');

describe('instrument registry', () => {
  it('resolves tunings from preferences', () => {
    expect(tuningFor('ukulele').open).toEqual([69, 64, 60, 67]); // A E C g (re-entrant)
    expect(tuningFor('ukulele', { ukuleleTuning: 'low-g' }).open).toEqual([69, 64, 60, 55]);
    expect(tuningFor('bass').open).toEqual([43, 38, 33, 28]);
    expect(tuningFor('bass', { bassStrings: 5 }).open).toEqual([43, 38, 33, 28, 23]);
    expect(tuningFor('guitar').open).toEqual(TUNINGS.guitar.open);
  });

  it('knows how mallet instruments transpose', () => {
    expect(inputOffsetFor('mallets', { malletVariant: 'xylophone' })).toBe(12);
    expect(inputOffsetFor('mallets', { malletVariant: 'glockenspiel' })).toBe(24);
    expect(inputOffsetFor('mallets', { malletVariant: 'marimba' })).toBe(0);
    expect(voiceFor('mallets', { malletVariant: 'vibraphone' })).toBe('vibraphone');
    // the microphone listens to the sounding range
    expect(micRangeFor('mallets', { malletVariant: 'xylophone' })).toEqual([65, 108]);
    expect(micRangeFor('bass')[0]).toBe(28);
  });

  it('every fretted instrument has a look for each string', () => {
    for (const def of Object.values(INSTRUMENTS)) {
      if (!def.fretted) continue;
      const t = tuningFor(def.id, { bassStrings: 5 });
      expect(def.fretted.gauge.length, def.id).toBeGreaterThanOrEqual(t.open.length);
      expect(def.fretted.wound.length, def.id).toBeGreaterThanOrEqual(t.open.length);
    }
  });
});

describe('fretted fingering on other tunings', () => {
  it('orders re-entrant strings by pitch', () => {
    expect(stringsLowToHigh(TUNINGS.ukuleleHighG.open)).toEqual([3, 2, 4, 1]);
    expect(stringsLowToHigh(TUNINGS.guitar.open)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('finds ukulele positions, including the high-G string', () => {
    expect(positionsFor(m('G4'), 12, 0, TUNINGS.ukuleleHighG.open)).toEqual([
      { string: 4, fret: 0 },
      { string: 3, fret: 7 },
      { string: 2, fret: 3 },
    ]);
  });

  it('fingers a ukulele C scale in first position', () => {
    const res = fingerGuitarLine(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map(n => ({ midis: [m(n)] })), { tuning: TUNINGS.ukuleleHighG.open });
    const frets = res.map(r => `${r[0].string}:${r[0].fret}:${r[0].finger}`);
    expect(frets).toEqual(['3:0:0', '3:2:2', '2:0:0', '2:1:1', '4:0:0', '1:0:0', '1:2:2', '1:3:3']);
  });

  it('uses Simandl 1-2-4 fingering on bass in low positions', () => {
    // F (1st fret E string) G (3rd fret E string): index and pinky
    const res = fingerGuitarLine([{ midis: [m('F1')] }, { midis: [m('F#1')] }, { midis: [m('G1')] }], { tuning: TUNINGS.bass4.open, fingerSystem: 'simandl' });
    expect(res.map(r => [r[0].string, r[0].fret, r[0].finger])).toEqual([
      [4, 1, 1],
      [4, 2, 2],
      [4, 3, 4],
    ]);
  });

  it('autoFinger sets the tuning on the score', () => {
    const s = autoFinger(scoreFromText({ id: 'b', instrument: 'bass', staves: [{ clef: 'bass8vb', voices: ['E1/q A1 D2 G2 |'] }] }));
    expect(s.tuning).toEqual(TUNINGS.bass4.open);
    expect(s.staves[0].voices[0].notes.map(n => n.strings?.[0])).toEqual([4, 3, 2, 1]);
  });
});

describe('mallet sticking', () => {
  it('alternates hands on a scale, leading with the right', () => {
    expect(sticking('C4 D4 E4 F4 G4 A4 B4 C5')).toBe('R L R L R L R L');
  });

  it('keeps the right hand on top for alternating leaps', () => {
    expect(sticking('C5 G4 C5 G4')).toBe('R L R L');
  });

  it('plays double stops with both hands, left below', () => {
    expect(sticking('C4+E4 D4+F4')).toBe('LR LR');
  });

  it('uses mallets 1-4 for four-note chords and inner mallets for single lines', () => {
    expect(sticking('C4+E4+G4+C5 F4+A4+C5+F5', 4, 96)).toBe('1234 1234');
    const line = sticking('C4 D4 E4 F4', 4).split(' ');
    expect(line.every(x => x === '2' || x === '3')).toBe(true);
  });

  it('autoFinger writes sticking into a mallet score', () => {
    const s = autoFinger(scoreFromText({ id: 'm', instrument: 'mallets', staves: [{ clef: 'treble', voices: ['C5/q D5 E5 F5 |'] }] }));
    expect(s.mallets).toBe(2);
    expect(s.staves[0].voices[0].notes.map(n => n.fingers?.[0])).toEqual([3, 2, 3, 2]);
  });
});
