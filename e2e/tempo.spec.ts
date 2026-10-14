import { expect, type Page, test } from '@playwright/test';
import { onboard } from './helpers';

const song = (title: string, time: [number, number], voice: string) => ({
  format: 'clef-coach-song',
  version: 1,
  title,
  composer: 'Clef Coach Original',
  instrument: 'piano',
  key: 'C',
  time,
  tempo: 120,
  staves: [{ clef: 'treble', voices: [voice] }],
});

async function importSong(page: Page, s: ReturnType<typeof song>) {
  await page.goto('/#/songs/import');
  await page.getByRole('button', { name: /Paste/ }).first().click();
  await page.locator('textarea.import-text').fill(JSON.stringify(s));
  await page.getByRole('button', { name: /Check & preview/ }).click();
  await page.getByRole('button', { name: /Save to my songs/ }).click();
  await expect(page.locator('.studio-top').getByText(s.title)).toBeVisible();
}

/** Start an "In time" run from the Song Studio and record the count-in numbers as they appear. */
async function countIn(page: Page): Promise<number[]> {
  await page.getByRole('radio', { name: 'In time' }).click();
  await page.getByRole('button', { name: /^Practise / }).click();
  await page.getByRole('button', { name: /^Start — / }).click();
  const seen: number[] = [];
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const phase = await page.locator('.activity.playalong').getAttribute('data-phase');
    const n = await page.locator('.count-in').last().textContent({ timeout: 50 }).catch(() => null);
    if (n && seen[seen.length - 1] !== Number(n)) seen.push(Number(n));
    if (phase === 'playing') break;
    await page.waitForTimeout(30);
  }
  return seen;
}

test('count-in counts up through the bar, with a visual beat', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Counter');

  await importSong(page, song('Four Four', [4, 4], 'C4/q D4 E4 F4 | G4/w |'));
  expect(await countIn(page)).toEqual([1, 2, 3, 4]);
  // the visual metronome: a dot per beat, one lit, while playing
  const dots = page.locator('.beat-light .beat-dot');
  await expect(dots).toHaveCount(4);
  await expect(page.locator('.beat-light .beat-dot.on')).toHaveCount(1);
  await page.locator('.studio-shell button[aria-label="Stop"]').click();

  await importSong(page, song('Waltz', [3, 4], 'C4/q D4 E4 | F4/h. |'));
  expect(await countIn(page)).toEqual([1, 2, 3]);
  await expect(page.locator('.beat-light .beat-dot')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('the input dialog opens on screen from the Song Studio header', async ({ page }) => {
  await onboard(page, 'Picker');
  await importSong(page, song('Header Test', [4, 4], 'C4/q D4 E4 F4 |'));
  await page.locator('.studio-top').getByRole('button', { name: 'Input settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // the frosted (backdrop-filter) header must not trap the fixed dialog
  const box = (await dialog.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  await expect(dialog.getByRole('button', { name: /Microphone/ })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});
