import { describe, expect, it } from 'vitest';
import { addTrack, applyOutcome, effectiveStreak, emptyData, makeExport, mergeData, newProfile, parseImport, testOut, ImportError, type LessonOutcome } from './logic';
import { updateItem, mastery, reviewPriority } from './srs';
import { dayKey } from './dates';
import { levelFromXp } from './achievements';

const outcome = (o: Partial<LessonOutcome> = {}): LessonOutcome => ({
  trackId: 'piano-treble',
  lessonId: 'pt1-1',
  lessonKind: 'learn',
  accuracy: 0.9,
  stars: 2,
  passed: true,
  ms: 60000,
  notes: 20,
  xp: 25,
  items: [{ key: 'note:treble:C4', correct: true, ms: 900 }],
  ...o,
});

describe('profile progress', () => {
  it('records lessons, xp, streak and achievements', () => {
    const p0 = addTrack(newProfile('Ann'), 'piano-treble');
    const t0 = new Date(2026, 9, 10, 18).getTime();
    const r = applyOutcome(p0, outcome(), t0);
    expect(r.profile.tracks['piano-treble']!.lessons['pt1-1'].passed).toBe(true);
    expect(r.profile.xp).toBe(25);
    expect(r.streakExtended).toBe(true);
    expect(r.profile.streak.current).toBe(1);
    expect(r.achievements.map(a => a.id)).toContain('first-lesson');
    // same day again: streak unchanged
    const r2 = applyOutcome(r.profile, outcome({ lessonId: 'pt1-2' }), t0 + 3600_000);
    expect(r2.profile.streak.current).toBe(1);
    expect(r2.streakExtended).toBe(false);
    // next day: streak 2
    const r3 = applyOutcome(r2.profile, outcome({ lessonId: 'pt1-3' }), t0 + 24 * 3600_000);
    expect(r3.profile.streak.current).toBe(2);
    // keeps best stars and accuracy
    const r4 = applyOutcome(r3.profile, outcome({ stars: 1, accuracy: 0.71 }), t0 + 25 * 3600_000);
    expect(r4.profile.tracks['piano-treble']!.lessons['pt1-1'].stars).toBe(2);
    expect(r4.profile.tracks['piano-treble']!.lessons['pt1-1'].plays).toBe(2);
  });

  it('breaks the streak after a missed day unless a freeze covers it', () => {
    const p = newProfile('B');
    p.streak = { current: 5, best: 5, lastDay: dayKey(new Date(2026, 9, 1)), freezes: 0 };
    expect(effectiveStreak(p, dayKey(new Date(2026, 9, 2)))).toBe(5);
    expect(effectiveStreak(p, dayKey(new Date(2026, 9, 4)))).toBe(0);
    p.streak.freezes = 2;
    expect(effectiveStreak(p, dayKey(new Date(2026, 9, 4)))).toBe(5);
  });

  it('practice-only sessions do not touch lesson progress', () => {
    const r = applyOutcome(newProfile('C'), outcome({ lessonId: 'gym', practiceOnly: true }));
    expect(r.profile.tracks['piano-treble']!.lessons.gym).toBeUndefined();
    expect(r.profile.tracks['piano-treble']!.items['note:treble:C4'].n).toBe(1);
  });

  it('test-out marks lessons passed but skipped', () => {
    const p = testOut(newProfile('D'), 'guitar-treble', ['a', 'b']);
    expect(p.tracks['guitar-treble']!.lessons.a).toMatchObject({ passed: true, skipped: true, stars: 0 });
  });
});

describe('spaced repetition', () => {
  it('promotes fast correct answers and demotes mistakes', () => {
    let s = updateItem(undefined, { key: 'note:treble:C4', correct: true, ms: 800 }, 0);
    expect(s.box).toBe(1);
    s = updateItem(s, { key: 'note:treble:C4', correct: true, ms: 800 }, 1000);
    expect(s.box).toBe(2);
    s = updateItem(s, { key: 'note:treble:C4', correct: false }, 2000);
    expect(s.box).toBe(0);
    expect(mastery(s, 2000)).toBeLessThan(0.6);
    expect(reviewPriority(s, 2000 + 86400_000)).toBeGreaterThan(reviewPriority(updateItem(undefined, { key: 'x', correct: true, ms: 500 }, 0), 1000));
  });
  it('levels up with xp', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(80).level).toBe(2);
    expect(levelFromXp(10000).level).toBeGreaterThan(10);
  });
});

describe('export / import', () => {
  it('round-trips through JSON', () => {
    const d = emptyData();
    const p = applyOutcome(addTrack(newProfile('Eve', 120), 'piano-bass'), outcome({ trackId: 'piano-bass', lessonId: 'pb1-1' })).profile;
    d.profiles[p.id] = p;
    d.activeProfileId = p.id;
    const text = JSON.stringify(makeExport(d, 'test'));
    const back = parseImport(text);
    expect(back.profiles[p.id].name).toBe('Eve');
    expect(back.profiles[p.id].tracks['piano-bass']!.lessons['pb1-1'].passed).toBe(true);
    expect(back.activeProfileId).toBe(p.id);
  });
  it('rejects garbage with friendly errors', () => {
    expect(() => parseImport('not json')).toThrow(ImportError);
    expect(() => parseImport('{"hello":1}')).toThrow(/Clef Coach backup/);
    expect(() => parseImport('{"app":"clef-coach","version":9,"profiles":{}}')).toThrow(/newer version/);
  });
  it('merges two devices keeping the best of each', () => {
    const base = addTrack(newProfile('Sam'), 'piano-treble');
    const a = applyOutcome(base, outcome({ lessonId: 'pt1-1', stars: 3, accuracy: 1 }), 1000).profile;
    const b = applyOutcome(base, outcome({ lessonId: 'pt1-2', stars: 1, accuracy: 0.75 }), 2000).profile;
    const da = { ...emptyData(), profiles: { [a.id]: a }, activeProfileId: a.id };
    const db = { ...emptyData(), profiles: { [b.id]: b }, activeProfileId: b.id };
    const m = mergeData(da, db);
    const lessons = m.profiles[a.id].tracks['piano-treble']!.lessons;
    expect(Object.keys(lessons).sort()).toEqual(['pt1-1', 'pt1-2']);
    expect(lessons['pt1-1'].stars).toBe(3);
    // a different player is added alongside
    const other = newProfile('Kim');
    const m2 = mergeData(m, { ...emptyData(), profiles: { [other.id]: other }, activeProfileId: other.id });
    expect(Object.keys(m2.profiles)).toHaveLength(2);
    expect(m2.activeProfileId).toBe(a.id);
  });
});
