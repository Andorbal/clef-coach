/**
 * Every lesson of Production School, checked: ids, sessions and tracks, the controls
 * shown, the explore tasks (each reads controls the learner can see), the ear-training
 * rounds (five seeds of every generator: the answer is an option, A and B differ), and
 * every mix quiz through the judge: the target can be reached with the controls shown,
 * the starting mix doesn't already pass, the target passes against itself, and a near
 * miss (every control a little off) passes too.
 *
 * The judge listens at 16 kHz to the first few seconds here, to keep the suite quick;
 * PRODUCTION_FULL=1 runs it as the app does (half the playback rate, the whole loop).
 */
import { describe, expect, it } from 'vitest';
import { makeRng } from '../../curriculum/generate';
import { Judge, PASS_MARK } from '../dsp/judge';
import { type Mix, makeMix, specOf } from '../dsp/params';
import { getSession } from '../dsp/sessions';
import { renderStems, resolveTracks } from '../dsp/stems';
import { condKeys } from './build';
import { expandControls } from './controls';
import { COURSE, PARTS, PRODUCTION } from './index';
import type { ListenRound, MixStep, ProductionLesson } from './types';

const FULL = !!process.env.PRODUCTION_FULL;
const SR = FULL ? 24000 : 16000;
const SECONDS = FULL ? undefined : 5;

const stemCache = new Map<string, Record<string, Float32Array>>();
function stemsFor(l: ProductionLesson) {
  const key = JSON.stringify([l.session, l.channels ?? null]);
  let s = stemCache.get(key);
  if (!s) stemCache.set(key, (s = renderStems({ session: l.session, channels: l.channels, sampleRate: SR })));
  return s;
}

const channelsOf = (l: ProductionLesson) => resolveTracks(getSession(l.session), l.channels).map(t => t.id);

function checkMixKeys(mix: Mix, channels: string[], where: string) {
  for (const k of Object.keys(mix)) {
    expect(specOf(k), `${where}: unknown setting ${k}`).toBeDefined();
    const [scope] = k.split(':');
    if (scope !== 'master' && scope !== 'fx') expect(channels, `${where}: ${k} names a channel the lesson doesn't have`).toContain(scope);
  }
}

/** Every changed setting a little off, as a learner who got close would leave it. */
function nearMiss(base: Mix, target: Mix, visible: Set<string>, rng: () => number): Mix {
  const out: Mix = { ...target };
  for (const k of visible) {
    const v = target[k];
    if (v === undefined || v === base[k]) continue;
    const spec = specOf(k)!;
    if (spec.step === 1 && spec.max === 1) continue;
    const p = k.split(':')[1];
    const sign = rng() < 0.5 ? -1 : 1;
    let x = v;
    if (spec.scale === 'log') x = v * Math.pow(1.08, sign);
    else if (p === 'pan') x = v + sign * 0.05;
    else if (spec.max - spec.min <= 1.01) x = v + sign * 0.03 * (spec.max - spec.min);
    else x = v + sign * 0.6;
    if (spec.detents?.includes(v)) x = v;
    out[k] = Math.min(spec.max, Math.max(spec.min, x));
  }
  return out;
}

describe('Production School course', () => {
  it('has well-formed ids, parts and checkpoints', () => {
    const lessonIds = new Set<string>();
    const unitIds = new Set<string>();
    for (const u of COURSE) {
      expect(u.id, u.id).toMatch(/^pr-[a-z]+$/);
      expect(unitIds.has(u.id), `duplicate unit ${u.id}`).toBe(false);
      unitIds.add(u.id);
      expect(u.lessons.length, u.id).toBeGreaterThan(1);
      const last = u.lessons[u.lessons.length - 1];
      expect(last.kind, `${u.id} ends with a checkpoint`).toBe('checkpoint');
      for (const l of u.lessons) {
        expect(l.id, l.id).toMatch(/^pr\d+-(\d+|c)$/);
        expect(lessonIds.has(l.id), `duplicate lesson ${l.id}`).toBe(false);
        lessonIds.add(l.id);
        expect(l.steps.length, l.id).toBeGreaterThan(0);
      }
    }
    const inParts = PARTS.flatMap(p => p.units);
    for (const u of COURSE) expect(inParts, `${u.id} is on the map`).toContain(u.id);
    for (const id of inParts) expect(unitIds.has(id), `part lists unknown unit ${id}`).toBe(true);
    expect(PRODUCTION.totalLessons).toBe(lessonIds.size);
  });

  for (const u of COURSE)
    for (const l of u.lessons)
      describe(l.id, () => {
        it('names real tracks, controls and settings', () => {
          const channels = channelsOf(l);
          const lessonVisible = expandControls(l.controls, channels);
          for (const f of [...expandControls(l.fresh ?? [], channels)]) expect(lessonVisible.has(f), `${l.id}: fresh ${f} isn't shown`).toBe(true);
          if (l.start) checkMixKeys(l.start, channels, `${l.id} start`);
          l.steps.forEach((s, i) => {
            const where = `${l.id}#${i} (${s.type})`;
            const visible = expandControls(s.controls ?? l.controls, channels);
            if (s.start) checkMixKeys(s.start, channels, where);
            if (s.type === 'explain') for (const h of s.hear ?? []) checkMixKeys(h.mix, channels, `${where} hear ${h.label}`);
            if (s.type === 'explore') {
              expect(s.tasks.length, where).toBeGreaterThan(0);
              for (const t of s.tasks) for (const k of condKeys(t.check)) expect(visible.has(k), `${where}: task "${t.text}" reads ${k}, which isn't shown`).toBe(true);
            }
            if (s.type === 'listen') {
              const values = s.options.map(o => o.value);
              expect(new Set(values).size, `${where}: options repeat`).toBe(values.length);
              const runs: ListenRound[][] = typeof s.rounds === 'function' ? [1, 2, 3, 4, 5].map(seed => (s.rounds as (r: () => number) => ListenRound[])(makeRng(seed))) : [s.rounds];
              for (const rounds of runs) {
                expect(rounds.length, where).toBeGreaterThan(0);
                for (const r of rounds) {
                  expect(values, `${where}: answer ${r.answer}`).toContain(r.answer);
                  expect(r.mixes.length, where).toBeGreaterThanOrEqual(1);
                  expect(r.mixes.length, where).toBeLessThanOrEqual(2);
                  r.mixes.forEach(m => checkMixKeys(m, channels, where));
                  if (r.mixes.length === 2) expect(JSON.stringify(r.mixes[0]), `${where}: A and B are the same`).not.toBe(JSON.stringify(r.mixes[1]));
                }
              }
            }
            if (s.type === 'mix') {
              expect(s.target || s.goals?.length, `${where}: a target or goals`).toBeTruthy();
              if (s.target) {
                checkMixKeys(s.target, channels, where);
                for (const k of Object.keys(s.target)) expect(visible.has(k), `${where}: the target changes ${k}, which isn't shown`).toBe(true);
              }
              if (s.answer) {
                checkMixKeys(s.answer, channels, where);
                for (const k of Object.keys(s.answer)) expect(visible.has(k), `${where}: the answer changes ${k}, which isn't shown`).toBe(true);
              }
              if (!s.target) expect(s.answer, `${where}: goals need an answer`).toBeDefined();
            }
          });
        });

        const mixSteps = l.steps.map((s, i) => [s, i] as const).filter((x): x is [MixStep, number] => x[0].type === 'mix');
        for (const [s, i] of mixSteps)
          it(`#${i} "${s.title}" can be mixed: start fails, target and a near miss pass`, () => {
            const channels = channelsOf(l);
            const session = getSession(l.session);
            const base = makeMix(channels, session.rough, l.start, s.start);
            const visible = expandControls(s.controls ?? l.controls, channels);
            const target = s.target ? makeMix(channels, base, s.target) : undefined;
            const judge = new Judge({ stems: stemsFor(l), channels, sampleRate: SR, tempo: session.tempo, start: base, target, spec: { goals: s.goals, aspects: s.aspects, channels: s.channels }, seconds: SECONDS });
            const pass = s.pass ?? PASS_MARK;
            const right = target ?? makeMix(channels, base, s.answer);
            const start = judge.score(base);
            expect(start.overall, `${l.id}#${i}: the starting mix already passes (${start.overall.toFixed(2)})`).toBeLessThan(pass);
            const self = judge.score(right);
            expect(self.overall, `${l.id}#${i}: the ${target ? 'target' : 'answer'} scores ${self.overall.toFixed(2)}: ${self.worst?.hint}`).toBeGreaterThan(target ? 0.95 : pass);
            if (target) {
              const near = judge.score(nearMiss(base, target, visible, makeRng(i + 7)));
              expect(near.overall, `${l.id}#${i}: a near miss scores ${near.overall.toFixed(2)}: ${near.worst?.hint}`).toBeGreaterThanOrEqual(pass);
            }
          });
      });
});
