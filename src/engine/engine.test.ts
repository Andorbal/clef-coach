import { describe, expect, it } from 'vitest';
import { pianoTreble } from '../curriculum/tracks/pianoTreble';
import { allLessons } from '../curriculum';
import { summarizeTrack, testOutLessonIds } from './progress';
import { buildEndlessLesson, buildReviewLesson } from './review';
import { applyFingeringMode, markHandShifts } from './fingeringView';
import { scoreFromText } from '../music/parse';
import type { Score } from '../music/score';
import { generateScore, makeRng } from '../curriculum/generate';
import { newTrackProgress } from '../state/logic';
import { updateItem } from '../state/srs';
import { describeNotes } from '../music/chords';

describe('unlocking', () => {
  it('starts with only the first lesson open', () => {
    const s = summarizeTrack(pianoTreble, undefined);
    expect(s.lessons[0].status).toBe('current');
    expect(s.lessons[1].status).toBe('locked');
    expect(s.current?.lesson.id).toBe('pt1-1');
  });
  it('opens the next lesson after a pass and supports test-out', () => {
    const tp = newTrackProgress();
    tp.lessons['pt1-1'] = { stars: 3, best: 1, plays: 1, passed: true, lastAt: 0 };
    let s = summarizeTrack(pianoTreble, tp);
    expect(s.lessons[1].status).toBe('current');
    for (const id of testOutLessonIds(pianoTreble, 2)) tp.lessons[id] = { stars: 0, best: 0, plays: 0, passed: true, skipped: true, lastAt: 0 };
    s = summarizeTrack(pianoTreble, tp);
    expect(s.current?.unitIndex).toBe(3);
  });
});

describe('practice builders', () => {
  it('builds a review lesson from weak items', () => {
    const tp = newTrackProgress();
    for (const n of ['C4', 'D4', 'E4', 'F4']) tp.items[`note:treble:${n}`] = updateItem(undefined, { key: n, correct: n !== 'E4', ms: 1500 });
    tp.lessons['pt1-1'] = { stars: 3, best: 1, plays: 1, passed: true, lastAt: 0 };
    tp.lessons['pt1-2'] = { stars: 3, best: 1, plays: 1, passed: true, lastAt: 0 };
    const l = buildReviewLesson(pianoTreble, tp)!;
    expect(l.steps.map(s => s.type)).toEqual(['name', 'play', 'read']);
    expect(buildReviewLesson(pianoTreble, newTrackProgress())).toBeNull();
  });
  it('builds endless rounds that get faster', () => {
    const tp = newTrackProgress();
    for (const r of allLessons(pianoTreble).slice(0, 10)) tp.lessons[r.lesson.id] = { stars: 1, best: 0.8, plays: 1, passed: true, lastAt: 0 };
    const a = buildEndlessLesson(pianoTreble, tp, 0)!;
    const b = buildEndlessLesson(pianoTreble, tp, 5)!;
    const tempo = (l: typeof a) => (l.steps[1].type === 'read' ? l.steps[1].tempo ?? 0 : 0);
    expect(tempo(b)).toBeGreaterThan(tempo(a));
  });
});

describe('fingering view', () => {
  it('thins fingering to position changes', () => {
    const s = generateScore({ clef: 'treble', key: 'C', time: [4, 4], measures: 4, pool: ['C4', 'D4', 'E4', 'F4', 'G4'], rhythms: { q: 1 }, maxLeap: 2, fivePosition: true }, makeRng(4));
    const first = applyFingeringMode(s, 'first');
    const fingered = first.staves[0].voices[0].notes.filter(n => n.fingers);
    expect(fingered.length).toBe(1); // a fixed five-finger position only needs the first finger
    const none = applyFingeringMode(s, 'none');
    expect(none.staves[0].voices[0].notes.every(n => !n.fingers)).toBe(true);
    expect(s.staves[0].voices[0].notes.every(n => n.fingers)).toBe(true); // original untouched
  });
});

describe('hand shifts', () => {
  const piano = (voice: string, hand: 'R' | 'L' = 'R') =>
    scoreFromText({ id: 't', instrument: 'piano', key: 'C', time: [4, 4], staves: [{ clef: hand === 'R' ? 'treble' : 'bass', hand, voices: [voice] }] });
  const shifts = (s: Score) => s.staves[0].voices[0].notes.filter(n => !n.rest).map(n => n.shift ?? 0);

  it('marks where the hand moves up or down a position', () => {
    // Twinkle: up one key for G and A (G with 4), back down to C position for the last C
    const s = markHandShifts(piano('C4/q@1 C4@1 G4@4 G4@4 | A4@5 A4@5 G4/h@4 | F4/q@3 F4@3 E4@2 E4@2 | D4@1 D4@1 C4/h@1 |'));
    expect(shifts(s)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1]);
  });
  it('leaves a fixed five-finger position alone', () => {
    const s = piano('C4/q@1 D4@2 E4@3 F4@4 | G4@5 F4@4 E4@3 D4@2 | C4/w@1 |');
    expect(markHandShifts(s)).toBe(s);
  });
  it('reads the left hand the other way round', () => {
    // left hand in C position (5 on C3): the thumb moving from G3 up to A3 is a move up
    expect(shifts(markHandShifts(piano('C3/q@5 E3@3 G3@1 A3@1 |', 'L')))).toEqual([0, 0, 0, 1]);
  });
  it('marks a repeated figure only the first time', () => {
    const s = markHandShifts(piano('G4/e@1 C5@3 E5@5 G4@1 C5@3 E5@5 G4@1 C5@3 |'));
    expect(shifts(s)).toEqual([0, 1, 0, -1, 0, 0, 0, 0]);
  });
  it('keeps the shifted notes\' fingers when fingering is thinned', () => {
    const s = piano('C4/q@1 D4@2 E4@3 F4@4 | G4@4 A4@5 G4@4 F4@3 |');
    const first = applyFingeringMode(s, 'first').staves[0].voices[0].notes;
    expect(first.filter(n => n.fingers).map(n => [n.id === first[4].id, n.shift ?? 0])).toEqual([[false, 0], [true, 1]]);
    expect(applyFingeringMode(s, 'none').staves[0].voices[0].notes.some(n => n.shift)).toBe(false);
    expect(s.staves[0].voices[0].notes.some(n => n.shift)).toBe(false); // original untouched
  });
  it('follows the fretting hand by its index finger', () => {
    // guitar, 1st string: 1st position (G with 3) then up to 5th position (A with 1)
    const s = scoreFromText({ id: 'g', instrument: 'guitar', key: 'C', time: [4, 4], staves: [{ clef: 'treble8vb', voices: ['E4/q@0%1 F4@1%1 G4@3%1 A4@1%1 |'] }] });
    expect(shifts(markHandShifts(s))).toEqual([0, 0, 0, 1]);
  });
});

describe('chord naming', () => {
  it('names intervals and chords', () => {
    expect(describeNotes([60, 64])).toBe('Major 3rd');
    expect(describeNotes([60, 64, 67])).toBe('C');
    expect(describeNotes([64, 67, 72])).toBe('C/E');
    expect(describeNotes([57, 60, 64])).toBe('Am');
    expect(describeNotes([55, 59, 62, 65])).toBe('G7');
  });
});

describe('chord track practice', () => {
  it('builds a chord gym from the chords learned so far, and a chord review', async () => {
    const { getTrack } = await import('../curriculum');
    const { buildEndlessLesson, buildReviewLesson, learnedChords } = await import('./review');
    const track = getTrack('ukulele-chords')!;
    expect(learnedChords(track)).toEqual(['C']);
    const tp = { lessons: { 'uc1-1': { passed: true }, 'uc1-2': { passed: true } }, items: { 'chord:ukulele:C': { n: 3, ok: 3, ms: 900, box: 2, due: 0, last: 0 }, 'chord:ukulele:Am': { n: 3, ok: 1, ms: 2000, box: 0, due: 0, last: 0 } } } as never;
    expect(learnedChords(track, tp)).toEqual(['C', 'Am']);
    const gym = buildEndlessLesson(track, tp, 3)!;
    expect(gym.title).toContain('Chord Gym');
    expect(gym.steps[0].type).toBe('chord-play');
    const review = buildReviewLesson(track, tp)!;
    expect(review.steps.map(s => s.type)).toEqual(['chord-quiz', 'chord-play']);
  });
});
