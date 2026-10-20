import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Content sweep: render every step of every lesson and fail on any runtime error.
// Not part of the regular suite (it takes a while): SWEEP=1 npx playwright test sweep --project=ipad
test.skip(!process.env.SWEEP, 'content sweep only');
test.describe.configure({ mode: 'parallel' });

const TRACK_IDS = [
  'piano-treble',
  'piano-bass',
  'piano-grand',
  'guitar-treble',
  'guitar-bass',
  'guitar-fretboard',
  'guitar-chords',
  'ukulele-treble',
  'ukulele-chords',
  'bass-lines',
  'bass-fretboard',
  'mallets-two',
  'mallets-four',
  'violin-treble',
  'viola-alto',
  'cello-bass',
  'doublebass-lines',
];

for (const trackId of TRACK_IDS) {
  test(`every step renders: ${trackId}`, async ({ page }) => {
    test.setTimeout(30 * 60_000);
    const errors: string[] = [];
    let where = '';
    page.on('pageerror', e => errors.push(`${where}: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`${where}: console: ${m.text()}`);
    });
    await onboard(page, 'Sweep');
    const lessons = await page.evaluate(async id => {
      const mod = await import(/* @vite-ignore */ '/src/curriculum/index.ts');
      const track = mod.getTrack(id);
      return track.units.flatMap((u: { lessons: { id: string; steps: { type: string }[] }[] }) => u.lessons.map(l => ({ id: l.id, steps: l.steps.map(s => s.type) })));
    }, trackId);
    expect(lessons.length).toBeGreaterThan(20);
    let count = 0;
    for (const l of lessons) {
      for (let i = 0; i < l.steps.length; i++) {
        where = `${l.id}#${i}(${l.steps[i]})`;
        await page.goto(`/#/lesson/${trackId}/${l.id}?step=${i}`);
        await expect(page.locator('.lesson-step .activity, .lesson-step .tip-activity, .lesson-step [data-activity]').first(), where).toBeVisible({ timeout: 8000 });
        await page.waitForTimeout(250);
        count++;
      }
    }
    console.log(`${trackId}: ${lessons.length} lessons, ${count} steps`);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('every step renders: Synth School', async ({ page }) => {
  test.setTimeout(30 * 60_000);
  const errors: string[] = [];
  let where = '';
  page.on('pageerror', e => errors.push(`${where}: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`${where}: console: ${m.text()}`);
  });
  await onboard(page, 'Sweep');
  const lessons = await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/src/synthlab/course/progress.ts');
    return mod.allLessons().map((r: { lesson: { id: string; steps: { type: string }[] } }) => ({ id: r.lesson.id, steps: r.lesson.steps.map(s => s.type) }));
  });
  expect(lessons.length).toBeGreaterThan(40);
  let count = 0;
  for (const l of lessons) {
    for (let i = 0; i < l.steps.length; i++) {
      where = `${l.id}#${i}(${l.steps[i]})`;
      await page.goto(`/#/synth/lesson/${l.id}?step=${i}`);
      await expect(page.locator(`.sl-coach[data-step="${l.steps[i]}"]`), where).toBeVisible({ timeout: 8000 });
      // a quiz is ready once its target has been rendered and analysed
      if (l.steps[i] === 'match') await expect(page.getByRole('button', { name: /^Check/ }), where).toBeEnabled({ timeout: 8000 });
      await page.waitForTimeout(150);
      count++;
    }
  }
  console.log(`Synth School: ${lessons.length} lessons, ${count} steps`);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('every step renders: Theory School', async ({ page }) => {
  test.setTimeout(30 * 60_000);
  const errors: string[] = [];
  let where = '';
  page.on('pageerror', e => errors.push(`${where}: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`${where}: console: ${m.text()}`);
  });
  await onboard(page, 'Sweep');
  const lessons = await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/src/theory/course/index.ts');
    return mod.THEORY.allLessons().map((r: { lesson: { id: string; steps: { type: string }[] } }) => ({ id: r.lesson.id, steps: r.lesson.steps.map(s => s.type) }));
  });
  expect(lessons.length).toBeGreaterThan(60);
  let count = 0;
  for (const l of lessons) {
    for (let i = 0; i < l.steps.length; i++) {
      where = `${l.id}#${i}(${l.steps[i]})`;
      await page.goto(`/#/theory/lesson/${l.id}?step=${i}`);
      await expect(page.locator(`.course-coach[data-step="${l.steps[i]}"]`), where).toBeVisible({ timeout: 8000 });
      if (l.steps[i] === 'drill') await expect(page.locator('.th-drill .activity, .th-drill .tip-activity, .th-drill [data-activity]').first(), where).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(150);
      count++;
    }
  }
  console.log(`Theory School: ${lessons.length} lessons, ${count} steps`);
  expect(errors, errors.join('\n')).toEqual([]);
});
