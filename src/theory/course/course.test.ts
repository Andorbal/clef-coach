import { describe, expect, it } from 'vitest';
import { makeRng } from '../../curriculum/generate';
import { parseKey } from '../../music/keys';
import { parsePitch } from '../../music/pitch';
import { knownTopics, practiceFor, theoryFor } from '../links';
import { figureScore } from '../ui/figure';
import { attemptMissed, checkPlayed, parseNoteSpec, stateOf } from './checks';
import { COURSE, PARTS, THEORY } from './index';
import type { BuildRound, Check, Figure, QuizRound, StepDef } from './types';

/** Topics only Theory School talks about (no instrument lesson is "about" them by its activities). */
const THEORY_ONLY = new Set(['pitch', 'note-names', 'octaves', 'semitones']);

const SEEDS = [1, 2, 3, 4, 5];

function checkFigure(f: Figure | undefined, where: string) {
  if (!f) return;
  if (f.key) parseKey(f.key);
  const fs = figureScore(f);
  expect(fs.score.staves.length, `${where}: staves`).toBeGreaterThan(0);
  if (Array.isArray(f.labels)) expect(f.labels.length, `${where}: labels`).toBeGreaterThan(0);
  f.keys && f.keys.forEach(k => parsePitch(k));
}

function checkCheck(c: Check, where: string) {
  switch (c.kind) {
    case 'note':
      parseNoteSpec(c.note);
      break;
    case 'notes':
      c.notes.forEach(parseNoteSpec);
      break;
    case 'interval':
      if (c.from) parseNoteSpec(c.from);
      expect(c.semitones.length, where).toBeGreaterThan(0);
      break;
    case 'chord':
      if (c.root) parseNoteSpec(c.root);
      break;
    case 'scale':
      parseNoteSpec(c.tonic);
      break;
    default:
      break;
  }
}

function roundsOf<R>(r: R[] | ((rng: ReturnType<typeof makeRng>) => R[])): R[][] {
  return typeof r === 'function' ? SEEDS.map(s => r(makeRng(s))) : [r];
}

function checkQuiz(r: QuizRound, where: string) {
  expect(r.options.length, `${where}: options`).toBeGreaterThanOrEqual(2);
  expect(new Set(r.options).size, `${where}: duplicate options ${r.options.join('|')}`).toBe(r.options.length);
  expect(r.options, `${where}: the answer "${r.answer}" is an option`).toContain(r.answer);
  checkFigure(r.figure, where);
}

function checkBuild(r: BuildRound, where: string) {
  expect(r.prompt, `${where}: prompt`).toBeTruthy();
  checkCheck(r.check, where);
  checkFigure(r.figure, where);
  const state = stateOf(r.check, r.answer);
  expect(checkPlayed(r.check, state), `${where}: "${r.prompt}" is answered by ${r.answer.join(' ')}`).toBe(true);
  // playing the answer is never counted as a miss on the way
  for (let n = 1; n < state.struck.length; n++) expect(attemptMissed(r.check, state.struck.slice(0, n)), `${where}: ${r.answer.slice(0, n).join(' ')} is not a miss`).toBe(false);
}

function checkStep(s: StepDef, where: string) {
  expect(s.title, `${where}: title`).toBeTruthy();
  checkFigure(s.figure, where);
  switch (s.type) {
    case 'explain':
      expect(s.body.length, `${where}: body`).toBeGreaterThan(20);
      break;
    case 'explore':
      expect(s.tasks.length, `${where}: tasks`).toBeGreaterThan(0);
      s.tasks.forEach((t, i) => checkCheck(t.check, `${where} task ${i + 1}`));
      break;
    case 'quiz':
      for (const list of roundsOf(s.rounds)) {
        expect(list.length, `${where}: rounds`).toBeGreaterThan(0);
        list.forEach((r, i) => checkQuiz(r, `${where} round ${i + 1}`));
      }
      break;
    case 'build':
      for (const list of roundsOf(s.rounds)) {
        expect(list.length, `${where}: rounds`).toBeGreaterThan(0);
        list.forEach((r, i) => checkBuild(r, `${where} round ${i + 1}`));
      }
      break;
    case 'drill':
      expect(['name', 'play', 'interval', 'keysig', 'rhythm'], `${where}: drill type`).toContain(s.activity.type);
      if ('pool' in s.activity) s.activity.pool.forEach(p => parsePitch(p));
      if (s.activity.type === 'keysig') s.activity.keys.forEach(k => parseKey(k));
      break;
  }
}

describe('Theory School course', () => {
  it('has unique unit and lesson ids, and every unit ends with a checkpoint', () => {
    const units = new Set<string>();
    const lessons = new Set<string>();
    for (const u of COURSE) {
      expect(units.has(u.id), `duplicate unit ${u.id}`).toBe(false);
      units.add(u.id);
      expect(u.lessons.length, `${u.id} has lessons`).toBeGreaterThan(1);
      expect(u.lessons[u.lessons.length - 1].kind, `${u.id} ends with a checkpoint`).toBe('checkpoint');
      for (const l of u.lessons) {
        expect(lessons.has(l.id), `duplicate lesson ${l.id}`).toBe(false);
        lessons.add(l.id);
        expect(l.steps.length, `${l.id} has steps`).toBeGreaterThan(0);
        if (l.key) parseKey(l.key);
      }
      for (const r of u.requires ?? []) expect(units.has(r), `${u.id} requires an earlier unit (${r})`).toBe(true);
    }
    // every unit is on the map, once
    const mapped = PARTS.flatMap(p => p.units);
    expect([...mapped].sort()).toEqual([...units].sort());
  });

  for (const u of COURSE) {
    it(`${u.id}: every step is well-formed and every round can be answered`, () => {
      for (const l of u.lessons) l.steps.forEach((s, i) => checkStep(s, `${l.id}#${i + 1}(${s.type})`));
    });
  }

  it('teaches topics the instrument tracks use (or its own)', () => {
    const known = knownTopics();
    for (const r of THEORY.allLessons()) for (const t of r.lesson.topics ?? []) expect(known.has(t) || THEORY_ONLY.has(t), `${r.lesson.id}: topic "${t}"`).toBe(true);
  });

  it('links theory and instrument lessons both ways', () => {
    const withPractice = THEORY.allLessons().filter(r => practiceFor(r.lesson.id).length > 0);
    // most lessons with instrument topics lead somewhere
    if (THEORY.allLessons().some(r => r.lesson.topics?.some(t => !THEORY_ONLY.has(t)))) expect(withPractice.length).toBeGreaterThan(0);
    for (const r of withPractice) {
      for (const p of practiceFor(r.lesson.id)) expect(theoryFor(p.track.id, p.lesson.id).map(l => l.id), `${p.track.id}/${p.lesson.id} links back to ${r.lesson.id}`).toContain(r.lesson.id);
    }
  });
});
