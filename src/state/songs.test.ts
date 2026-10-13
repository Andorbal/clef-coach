import { describe, expect, it } from 'vitest';
import { scoreFromText } from '../music/parse';
import { sliceScore } from '../music/score';
import { newProfile } from './logic';
import { goalPace, nextPlanStep, passageLevel, planProgress, planSteps, recordSongRun, stagesFor, todaysPlan, troubleSpot } from './songs';
import type { SongProgress } from './types';

const twoHands = { instrument: 'piano' as const, staves: [{ clef: 'treble' as const, voices: [] }, { clef: 'bass' as const, voices: [] }] };
const oneLine = { instrument: 'ukulele' as const, staves: [{ clef: 'treble' as const, voices: [] }] };
const eight = { measures: 8 };

describe('song practice plan', () => {
  it('goes hands separately → together → in time, then snowballs', () => {
    const steps = planSteps(twoHands, eight);
    expect(steps.slice(0, 6).map(s => s.stage)).toEqual(['R', 'L', 'both', 't60', 't80', 't100']);
    expect(steps.slice(0, 6).every(s => s.from === 1 && s.to === 4)).toBe(true);
    // after phrase 2, the whole song in time
    const chain = steps.filter(s => s.chain);
    expect(chain.map(s => [s.from, s.to, s.stage])).toEqual([
      [1, 8, 't80'],
      [1, 8, 't100'],
    ]);
  });

  it('skips the hands for one-part music', () => {
    expect(planSteps(oneLine, eight).slice(0, 4).map(s => s.stage)).toEqual(['both', 't60', 't80', 't100']);
  });

  it('a clean run moves the plan on, and counts for the phrases inside it', () => {
    let p = newProfile('A');
    expect(nextPlanStep(twoHands, eight, p.songs?.x)?.stage).toBe('R');
    p = recordSongRun(p, 'x', { from: 1, to: 4, mode: 'wait', tempoPct: 100, part: 'R', accuracy: 0.95, ms: 1000 }, true, 8);
    expect(nextPlanStep(twoHands, eight, p.songs!.x)?.stage).toBe('L');
    // hands together in wait mode also completes the hands-separately stages
    p = recordSongRun(p, 'x', { from: 1, to: 8, mode: 'wait', tempoPct: 100, part: 'all', accuracy: 1, ms: 1000 }, true, 8);
    expect(p.songs!.x.passages['1-4'].stages).toEqual(expect.arrayContaining(['R', 'L', 'both']));
    expect(nextPlanStep(twoHands, eight, p.songs!.x)).toMatchObject({ from: 1, to: 4, stage: 't60' });
    // a sloppy run doesn't
    p = recordSongRun(p, 'x', { from: 1, to: 4, mode: 'tempo', tempoPct: 60, part: 'all', accuracy: 0.6, ms: 1000 }, true, 8);
    expect(nextPlanStep(twoHands, eight, p.songs!.x)?.stage).toBe('t60');
    // full speed covers the slower stages
    p = recordSongRun(p, 'x', { from: 1, to: 4, mode: 'tempo', tempoPct: 100, part: 'all', accuracy: 0.92, ms: 1000 }, true, 8);
    expect(passageLevel(p.songs!.x.passages['1-4'])).toBe(4);
    expect(nextPlanStep(twoHands, eight, p.songs!.x)).toMatchObject({ from: 5, to: 8, stage: 'R' });
    expect(planProgress(twoHands, eight, p.songs!.x).done).toBe(6);
  });

  it('only counts full-part runs for the in-time stages', () => {
    expect(stagesFor({ mode: 'tempo', tempoPct: 100, part: 'R', accuracy: 1 }, true)).toEqual([]);
    expect(stagesFor({ mode: 'tempo', tempoPct: 100, part: 'all', partial: true, accuracy: 1 }, false)).toEqual([]);
    expect(stagesFor({ mode: 'tempo', tempoPct: 80, part: 'all', accuracy: 0.9 }, false)).toEqual(['both', 't60', 't80']);
  });

  it('tracks trouble spots and forgives clean playing', () => {
    let p = newProfile('A');
    p = recordSongRun(p, 's', { from: 1, to: 8, mode: 'wait', tempoPct: 100, part: 'all', accuracy: 0.7, measures: { 5: { total: 4, clean: 1 }, 6: { total: 4, clean: 3 }, 2: { total: 4, clean: 4 } }, ms: 1 }, false, 8);
    expect(troubleSpot(p.songs!.s, 8)).toEqual({ from: 5, to: 6, misses: 4 });
    expect(todaysPlan(oneLine, eight, p.songs!.s).some(s => s.stage === 'fix' && s.from === 5)).toBe(true);
    for (let i = 0; i < 4; i++) p = recordSongRun(p, 's', { from: 5, to: 6, mode: 'wait', tempoPct: 100, part: 'all', accuracy: 1, measures: { 5: { total: 4, clean: 4 }, 6: { total: 4, clean: 4 } }, ms: 1 }, false, 8);
    expect(troubleSpot(p.songs!.s, 8)).toBeNull();
  });

  it('paces a goal date', () => {
    const sp: SongProgress = { startedAt: new Date(2026, 9, 1).getTime(), lastAt: 0, ms: 0, sessions: 1, passages: {}, trouble: {}, bestTempoPct: 0, goal: { date: '2026-12-24', tempoPct: 100 } };
    const pace = goalPace(oneLine, eight, sp, '2026-10-13')!;
    expect(pace.daysLeft).toBe(72);
    expect(pace.remaining).toBe(planSteps(oneLine, eight).length);
    expect(pace.perDay).toBe(1);
    expect(pace.status).toBe('behind');
    expect(goalPace(oneLine, eight, { ...sp, goal: { date: '2026-10-01', tempoPct: 100 } }, '2026-10-13')!.status).toBe('past');
  });
});

describe('sliceScore', () => {
  const score = scoreFromText({
    id: 't',
    instrument: 'piano',
    staves: [{ clef: 'treble', voices: ['C4/w | D4/h E4~ | E4/h F4 | [T:3/4] G4/h. | A4/h. |'] }],
  });

  it('cuts a passage out with its own ticks, bars and meter', () => {
    const s = sliceScore(score, 2, 4);
    expect(s.measures).toBe(3);
    const notes = s.staves[0].voices[0].notes;
    expect(notes[0].tick).toBe(0);
    expect(notes[0].measure).toBe(0);
    // the tie from bar 2 into bar 3 starts a new note here
    expect(notes[0].tiePrev).toBe(false);
    expect(s.time).toEqual([4, 4]);
    expect(s.changes).toEqual([{ measure: 1, time: [3, 4] }]);
    expect(sliceScore(score, 3, 4).time).toEqual([3, 4]);
  });

  it('returns the score itself for the whole range', () => {
    expect(sliceScore(score, 0, 4)).toBe(score);
  });
});
