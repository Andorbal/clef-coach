import { describe, expect, it } from 'vitest';
import { applyCourseOutcome, courseTestOut, emptyData, makeExport, mergeData, newProfile, parseImport, type CourseOutcome } from './logic';
import type { PersistedData } from './types';

const outcome = (o: Partial<CourseOutcome> = {}): CourseOutcome => ({ lessonId: 'pr1-1', lessonKind: 'learn', score: 0.9, stars: 2, passed: true, ms: 60_000, notes: 0, xp: 25, ...o });

describe('Theory and Production School progress', () => {
  it('records a lesson in its own course, with XP and achievements', () => {
    const p = newProfile('Ada');
    const r = applyCourseOutcome(p, 'production', outcome());
    expect(r.profile.production?.lessons['pr1-1']).toMatchObject({ passed: true, stars: 2, plays: 1 });
    expect(r.profile.theory).toBeUndefined();
    expect(r.profile.xp).toBe(25);
    expect(r.achievements.map(a => a.id)).toContain('production-first');
    const t = applyCourseOutcome(r.profile, 'theory', outcome({ lessonId: 'th1-1' }));
    expect(t.achievements.map(a => a.id)).toContain('theory-first');
    expect(t.profile.production?.lessons['pr1-1']?.passed).toBe(true);
  });

  it('awards the checkpoint achievements, but not for tested-out lessons alone', () => {
    let p = newProfile('Ada');
    p = courseTestOut(p, 'production', ['pr1-1', 'pr1-c']);
    expect(p.production?.lessons['pr1-c']).toMatchObject({ passed: true, skipped: true });
    for (const id of ['pr1-c', 'pr2-c', 'pr3-c']) p = applyCourseOutcome(p, 'production', outcome({ lessonId: id, lessonKind: 'checkpoint' })).profile;
    expect(p.achievements['production-ears']).toBeDefined();
    // a real pass replaces a test-out
    expect(p.production?.lessons['pr1-c']?.skipped).toBeUndefined();
  });

  it('exports, imports and merges course progress', () => {
    let p = newProfile('Ada');
    p = applyCourseOutcome(p, 'production', outcome()).profile;
    const data: PersistedData = { ...emptyData(), profiles: { [p.id]: p }, activeProfileId: p.id };
    const back = parseImport(JSON.stringify(makeExport(data, 'test')));
    expect(back.profiles[p.id].production?.lessons['pr1-1']?.passed).toBe(true);
    const other = applyCourseOutcome(p, 'production', outcome({ lessonId: 'pr1-2' })).profile;
    const merged = mergeData(data, { ...emptyData(), profiles: { [other.id]: other }, activeProfileId: other.id }).profiles[p.id];
    expect(Object.keys(merged.production?.lessons ?? {}).sort()).toEqual(['pr1-1', 'pr1-2']);
  });
});
