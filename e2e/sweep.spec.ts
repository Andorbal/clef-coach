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
