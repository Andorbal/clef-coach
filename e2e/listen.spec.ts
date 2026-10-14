import { expect, type Page, test } from '@playwright/test';
import { onboard } from './helpers';

/** Count every note the app starts (buffer sources), with the time it was started. */
async function countNotes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __starts: number[] };
    w.__starts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      w.__starts.push(performance.now());
      return start.apply(this, args);
    };
  });
}
const startsSince = (page: Page, t: number) => page.evaluate(t => (window as unknown as { __starts: number[] }).__starts.filter(s => s > t).length, t);
const now = (page: Page) => page.evaluate(() => performance.now());

test('Listen turns into Stop, plays one copy at a time, and stops when you leave', async ({ page }) => {
  await countNotes(page);
  await onboard(page, 'Listener');
  await page.goto('/#/song/prh-ode-to-joy');
  const listen = page.locator('.studio-actions').getByRole('button', { name: /Listen|Stop/ });
  await expect(listen).toHaveText(/Listen/);

  // Listen ⇄ Stop
  await listen.click();
  await expect(listen).toHaveText(/Stop/);
  await expect(page.getByRole('button', { name: 'Stop listening' })).toBeVisible(); // the preview's button too
  await page.waitForTimeout(1200);
  await listen.click();
  await expect(listen).toHaveText(/Listen/);
  let t = await now(page);
  await page.waitForTimeout(1200);
  expect(await startsSince(page, t + 150)).toBe(0); // stopped: no more notes

  // tapping again doesn't stack copies: two quick taps = play, stop
  await listen.click();
  await listen.click();
  await expect(listen).toHaveText(/Listen/);
  t = await now(page);
  await page.waitForTimeout(1000);
  expect(await startsSince(page, t + 150)).toBe(0);

  // leaving the page stops it
  await listen.click();
  await page.waitForTimeout(1200);
  expect(await startsSince(page, 0)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).not.toHaveURL(/prh-ode-to-joy/);
  t = await now(page);
  await page.waitForTimeout(2000);
  expect(await startsSince(page, t + 150)).toBe(0);
});

test('Listen goes back to Listen by itself when the music ends', async ({ page }) => {
  await onboard(page, 'Patient');
  // a two-note song at 240 bpm: over in about a second
  await page.goto('/#/songs/import');
  await page.getByRole('button', { name: /Paste/ }).first().click();
  await page.locator('textarea.import-text').fill(JSON.stringify({ format: 'clef-coach-song', version: 1, title: 'Short', composer: 'Clef Coach Original', instrument: 'piano', key: 'C', time: [2, 4], tempo: 240, staves: [{ clef: 'treble', voices: ['C4/q E4 |'] }] }));
  await page.getByRole('button', { name: /Check & preview/ }).click();
  const listen = page.getByRole('button', { name: /^(Listen|Stop)$/ });
  await listen.click();
  await expect(listen).toHaveText(/Stop/);
  await expect(listen).toHaveText(/Listen/, { timeout: 4000 });
});
