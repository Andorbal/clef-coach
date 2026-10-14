import { expect, test } from '@playwright/test';
import { onboard, solveLesson } from './helpers';

test('onboarding, first lesson, progress saved', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page);
  await page.goto('/#/lesson/piano-treble/pt1-1');
  await solveLesson(page);
  await expect(page.locator('.results-title')).toHaveText(/Flawless|Outstanding/);
  await page.getByRole('button', { name: /Next: Hello, E/ }).click();
  await expect(page.locator('.results')).toHaveCount(0);
  await solveLesson(page);
  await expect(page.locator('.results-title')).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByText(/XP/).first()).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('clefcoach.data.v1'));
  expect(stored).toContain('pt1-2');
  expect(errors).toEqual([]);
});

test('every screen renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Screens');
  for (const path of ['/', '/learn', '/songs', '/songs/import', '/song/prh-ode-to-joy', '/studio', '/studio/free', '/studio/fretboard', '/studio/tuner', '/studio/scales', '/studio/gym', '/studio/metronome', '/progress', '/settings', '/track/piano-bass', '/track/guitar-fretboard']) {
    await page.goto(`/#${path}`);
    await page.waitForTimeout(500);
    await expect(page.locator('#root')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('export and import round trip', async ({ page }) => {
  await onboard(page, 'Backup');
  await page.goto('/#/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export backup/ }).click()]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs');
  const text = fs.readFileSync(path!, 'utf8');
  expect(JSON.parse(text).app).toBe('clef-coach');
  // wipe and restore
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/welcome');
  await page.reload();
  await onboard(page, 'Other');
  await page.goto('/#/settings');
  await page.locator('input[type=file]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Merge' }).click();
  await expect(page.locator('.profile-item', { hasText: 'Backup' })).toBeVisible();
});
