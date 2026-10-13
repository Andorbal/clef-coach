import { test } from '@playwright/test';
import { onboard, solveLesson } from './helpers';

// Not part of the regular suite: run with SHOTS=dir npx playwright test screens
const out = process.env.SHOTS;
test.skip(!out, 'screenshot run only');

test('screens', async ({ page }) => {
  test.setTimeout(300_000);
  await onboard(page, 'Andrew');
  await page.goto('/#/lesson/piano-treble/pt1-1');
  await solveLesson(page);
  await page.waitForTimeout(1500);
  for (const [name, path] of [['home', '/'], ['progress', '/progress'], ['songs', '/songs'], ['studio', '/studio'], ['settings', '/settings'], ['track-guitar', '/track/guitar-treble'], ['free', '/studio/free'], ['fretboard', '/studio/fretboard'], ['tuner', '/studio/tuner'], ['scales', '/studio/scales'], ['gym', '/studio/gym'], ['song-player', '/song/p2-fur-elise']] as const) {
    await page.goto(`/#${path}`);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/S-${name}.png`, fullPage: name === 'progress' || name === 'songs' || name === 'settings' });
  }
  // a guitar lesson and a grand staff piece in progress
  await page.goto('/#/lesson/guitar-treble/gt1-1');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Start lesson|^Next$/ }); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(600); } }
  await page.screenshot({ path: `${out}/S-guitar-lesson.png` });
  await page.goto('/#/song/p2-fur-elise');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Play$/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/S-fur-elise.png` });
});
