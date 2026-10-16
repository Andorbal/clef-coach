import { describe, expect, it } from 'vitest';
import { Matcher } from '../dsp/matcher';
import { type NumSpec, PARAMS, PARAM_KEYS, type ParamKey, type Patch, makePatch } from '../dsp/params';
import { phrase } from '../dsp/render';
import { CONTROLS, engineKeys } from '../ui/controls';
import { FIELD_GUIDE } from './guide';
import { COURSE, PARTS } from './index';
import { allLessons } from './progress';
import { PASS_MARK } from './types';

const lessons = allLessons();

describe('the course', () => {
  it('has unique ids', () => {
    const ids = lessons.map(r => r.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    const units = COURSE.map(u => u.id);
    expect(new Set(units).size).toBe(units.length);
  });

  it('puts every unit in exactly one part, and its requirements exist', () => {
    const inParts = PARTS.flatMap(p => p.units);
    expect([...inParts].sort()).toEqual(COURSE.map(u => u.id).sort());
    for (const u of COURSE) for (const r of u.requires ?? []) expect(COURSE.some(x => x.id === r)).toBe(true);
    for (const g of FIELD_GUIDE) for (const id of g.units) expect(COURSE.some(u => u.id === id), `${g.name}: ${id}`).toBe(true);
  });

  it('ends every unit with a checkpoint', () => {
    for (const u of COURSE) {
      expect(u.lessons.length, u.id).toBeGreaterThan(1);
      expect(u.lessons[u.lessons.length - 1].kind, u.id).toBe('checkpoint');
    }
  });

  it('describes every control', () => {
    for (const k of PARAM_KEYS) {
      expect(CONTROLS[k]?.label, k).toBeTruthy();
      expect(CONTROLS[k]?.about, k).toBeTruthy();
    }
  });

  it.each(lessons.map(r => [r.lesson.id, r] as const))('lesson %s shows controls its engine has', (_, r) => {
    const engine = makePatch(r.lesson.start).engine;
    const keys = new Set(engineKeys(engine));
    for (const k of r.lesson.controls) expect(keys.has(k), `${k} on ${engine}`).toBe(true);
    for (const k of r.lesson.fresh ?? []) expect(r.lesson.controls, k).toContain(k);
    for (const s of r.lesson.steps) for (const k of s.controls ?? []) expect(keys.has(k), `${k} on ${engine}`).toBe(true);
  });

  it.each(lessons.map(r => [r.lesson.id, r] as const))('lesson %s has sound steps', (_, r) => {
    const start = makePatch(r.lesson.start);
    for (const s of r.lesson.steps) {
      expect(s.title).toBeTruthy();
      if (s.type === 'listen') {
        expect(s.rounds.length).toBeGreaterThanOrEqual(3);
        for (const rd of s.rounds) expect(s.options.map(o => o.value)).toContain(rd.answer);
        // every option is the answer at least once, or it's a distractor worth having (at most one)
        const used = new Set(s.rounds.map(rd => rd.answer));
        expect(s.options.filter(o => !used.has(o.value)).length).toBeLessThanOrEqual(1);
      }
      if (s.type === 'explore') {
        expect(s.tasks.length).toBeGreaterThan(0);
        // a task that needs no note mustn't be done before the learner touches anything
        const base = makePatch(s.start ?? {}, start);
        for (const t of s.tasks) if (!t.play) expect(t.check(base), t.text).toBe(false);
      }
    }
  });
});

const quizzes = lessons.flatMap(r =>
  r.lesson.steps.flatMap((s, i) => (s.type === 'match' ? [[`${r.lesson.id} step ${i + 1}`, r, s] as const] : [])),
);

/**
 * An answer a careful learner might give: every control the quiz changes set a little
 * short of the target (times and frequencies 12% off, levels 4%, cents 15%, an FM ratio
 * 0.01), except where the target sits at the end of a knob's travel or in a detent,
 * which are easy to hit exactly.
 */
function nearMiss(target: Patch, base: Patch): Patch {
  const near = { ...target } as Record<string, unknown>;
  for (const k of PARAM_KEYS) {
    const spec = PARAMS[k];
    if (spec.kind !== 'num' || target[k] === base[k] || spec.step === 1) continue;
    const sp = spec as NumSpec;
    const t = target[k] as number;
    const b = base[k] as number;
    if (t <= sp.min || t >= sp.max || sp.detents?.includes(t)) continue;
    const dir = Math.sign(b - t);
    const off: Record<string, number> = {
      s: t * Math.pow(1.12, dir) - t,
      Hz: t * Math.pow(1.12, dir) - t,
      '%': dir * 0.04,
      ct: dir * Math.max(3, Math.abs(t) * 0.15),
      st: dir * Math.max(1, Math.abs(t) * 0.1),
      oct: dir * 0.25,
      x: dir * 0.01,
      harm: dir * 0.6,
    };
    const v = t + (off[sp.unit] ?? 0);
    // never past the starting value
    near[k] = makePatch({ [k]: Math.abs(v - t) > Math.abs(b - t) ? b : v })[k];
  }
  return near as unknown as Patch;
}

describe('the quizzes', () => {
  it.each(quizzes)('%s is reachable, isn’t solved before you start, and passes a close answer', (_, r, s) => {
    const base = makePatch(s.start ?? {}, makePatch(r.lesson.start));
    const target = makePatch(s.target, base);
    const visible = new Set<ParamKey>(s.controls ?? r.lesson.controls);
    for (const k of PARAM_KEYS) if (target[k] !== base[k]) expect(visible.has(k), `${k} changes but isn't shown`).toBe(true);
    const m = new Matcher(target, phrase(s.phrase ?? 'note'));
    expect(m.score(target).overall).toBeGreaterThan(0.99);
    expect(m.score(base).overall).toBeLessThan(s.pass ?? PASS_MARK);
    // and it doesn't take perfection: an answer that's close by ear passes
    expect(m.score(nearMiss(target, base)).overall).toBeGreaterThanOrEqual(s.pass ?? PASS_MARK);
  });
});
