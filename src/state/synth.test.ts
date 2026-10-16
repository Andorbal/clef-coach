import { describe, expect, it } from 'vitest';
import { applySynthOutcome, deleteSynthPatch, emptyData, makeExport, mergeData, newProfile, parseImport, saveSynthPatch, synthTestOut, type SynthOutcome } from './logic';
import type { PersistedData } from './types';

const outcome = (o: Partial<SynthOutcome> = {}): SynthOutcome => ({ lessonId: 'sy1-1', lessonKind: 'learn', score: 0.9, stars: 2, passed: true, ms: 60_000, notes: 40, xp: 30, ...o });

describe('Synth School progress', () => {
  it('records a lesson, XP, the day and the streak', () => {
    const p = newProfile('Ada');
    const r = applySynthOutcome(p, outcome(), Date.UTC(2026, 9, 16, 12));
    expect(r.profile.synth?.lessons['sy1-1']).toMatchObject({ passed: true, stars: 2, best: 0.9, plays: 1 });
    expect(r.profile.xp).toBe(30);
    expect(r.profile.totals.lessons).toBe(1);
    expect(r.streakExtended).toBe(true);
    expect(r.achievements.map(a => a.id)).toContain('synth-first');
    // the original is untouched
    expect(p.synth).toBeUndefined();
  });

  it('keeps the best result and never un-passes a lesson', () => {
    let p = newProfile('Ada');
    p = applySynthOutcome(p, outcome({ score: 0.95, stars: 3 })).profile;
    p = applySynthOutcome(p, outcome({ score: 0.5, stars: 0, passed: false })).profile;
    expect(p.synth?.lessons['sy1-1']).toMatchObject({ passed: true, stars: 3, best: 0.95, plays: 2 });
  });

  it('tests out of a unit, and a real pass replaces the test-out', () => {
    let p = synthTestOut(newProfile('Ada'), ['sy2-1', 'sy2-2']);
    expect(p.synth?.lessons['sy2-1']).toMatchObject({ passed: true, skipped: true });
    p = applySynthOutcome(p, outcome({ lessonId: 'sy2-1' })).profile;
    expect(p.synth?.lessons['sy2-1'].skipped).toBeUndefined();
  });

  it('saves patches, newest first, replacing by id', () => {
    let p = newProfile('Ada');
    p = saveSynthPatch(p, { id: 'a', name: 'Bass', patch: { osc1Octave: -1 }, at: 1 });
    p = saveSynthPatch(p, { id: 'b', name: 'Lead', patch: {}, at: 2 });
    p = saveSynthPatch(p, { id: 'a', name: 'Bass 2', patch: {}, at: 3 });
    expect(p.synth?.patches?.map(x => x.name)).toEqual(['Bass 2', 'Lead']);
    p = deleteSynthPatch(p, 'b');
    expect(p.synth?.patches?.map(x => x.id)).toEqual(['a']);
  });

  it('survives a backup and merges between devices', () => {
    let a = newProfile('Ada');
    a = applySynthOutcome(a, outcome({ lessonId: 'sy1-1', stars: 1 })).profile;
    a = saveSynthPatch(a, { id: 'x', name: 'Mine', patch: { filterCutoff: 500 }, at: 5 });
    const data: PersistedData = { ...emptyData(), profiles: { [a.id]: a }, activeProfileId: a.id };
    const back = parseImport(JSON.stringify(makeExport(data, 'test')));
    expect(back.profiles[a.id].synth?.lessons['sy1-1'].passed).toBe(true);
    expect(back.profiles[a.id].synth?.patches?.[0].name).toBe('Mine');

    let b: typeof a = { ...a, synth: undefined };
    b = applySynthOutcome(b, outcome({ lessonId: 'sy1-2', stars: 3 })).profile;
    b = applySynthOutcome(b, outcome({ lessonId: 'sy1-1', stars: 3 })).profile;
    const merged = mergeData(data, { ...emptyData(), profiles: { [b.id]: b }, activeProfileId: b.id }).profiles[a.id];
    expect(Object.keys(merged.synth?.lessons ?? {}).sort()).toEqual(['sy1-1', 'sy1-2']);
    expect(merged.synth?.lessons['sy1-1'].stars).toBe(3);
    expect(merged.synth?.patches?.[0].id).toBe('x');
  });

  it('ignores damaged synth data in a backup', () => {
    const p = newProfile('Ada');
    const raw = { app: 'clef-coach', version: 1, activeProfileId: p.id, profiles: { [p.id]: { ...p, synth: { lessons: 'nope', patches: [{ id: 1 }] } } } };
    const back = parseImport(JSON.stringify(raw));
    expect(back.profiles[p.id].synth?.lessons).toEqual({});
    expect(back.profiles[p.id].synth?.patches).toBeUndefined();
  });
});
