import { describe, expect, it } from 'vitest';
import { songToScore } from '../music/parse';
import { voiceStems } from './render';

describe('stems with two voices on a staff', () => {
  const staff = (voices: string[]) =>
    songToScore({ id: 't', title: 'T', composer: '', instrument: 'piano', level: 1, key: 'C', time: [4, 4], tempo: 80, staves: [{ clef: 'bass', voices }] }).staves[0];
  const bar = (voices: string[], m = 0) => voiceStems(staff(voices).voices.map(v => v.notes.filter(n => n.measure === m)));

  it('lets a voice playing alone choose its own stems and leaves out a silent voice\'s rests', () => {
    expect(bar(['C3/e G3 C3 G3 C3 G3 C3 G3 |', 'r/w |'])).toEqual([undefined, null]);
    expect(bar(['r/w |', 'C3/w |'])).toEqual([null, undefined]);
    expect(bar(['r/w |', 'r/w |'])).toEqual([undefined, null]);
  });

  it('stems the upper voice up and the lower down', () => {
    expect(bar(['E3/h G3 |', 'C2/w |'])).toEqual([1, -1]);
    // the second voice above the first all bar long: it takes the stems up
    expect(bar(['C2/w |', 'G2/q C3 E3 G3 |'])).toEqual([-1, 1]);
  });
});
