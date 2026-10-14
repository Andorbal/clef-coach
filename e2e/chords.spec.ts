import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('chord chart: chords side by side on several instruments', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Chords');
  await page.goto('/#/chords?chords=C,G&instruments=guitar,piano');
  const wide = (page.viewportSize()?.width ?? 0) >= 1000;
  if (wide) {
    await expect(page.locator('.cc-grid')).toBeVisible();
    await expect(page.locator('.cc-col-head')).toHaveCount(2);
    await expect(page.locator('.cc-row-head')).toHaveCount(2);
    await expect(page.locator('.cc-grid .chord-diagram')).toHaveCount(2);
    // add a chord and make it D minor seventh
    await page.getByRole('button', { name: 'Add a chord' }).click();
    await expect(page.locator('.cc-col-head')).toHaveCount(3);
    await page.locator('.cc-roots').getByRole('button', { name: 'D', exact: true }).click();
    await page.locator('.cc-qualities').getByRole('button', { name: 'm7', exact: true }).click();
    await expect(page.locator('.cc-col-head').nth(2)).toContainText('Dm7');
    // type one
    await page.getByLabel('Type a chord symbol').fill('F#m7b5');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.cc-col-head')).toHaveCount(4);
    await expect(page.locator('.cc-col-head').nth(3)).toContainText('F♯m7♭5');
    // every voicing of the selected chord, one card per instrument
    await page.getByRole('radio', { name: /^Every / }).click();
    await expect(page.locator('.cc-inst')).toHaveCount(2);
    await expect(page.locator('.cc-thumb').first()).toBeVisible();
  } else {
    // phones: one chord on one instrument
    await expect(page.locator('.cc-inst')).toHaveCount(1);
    await expect(page.locator('.cc-inst .chord-diagram')).toBeVisible();
    await page.locator('.cc-tray-name', { hasText: 'G' }).click();
    await expect(page.locator('.cc-focus-head h2')).toHaveText('G');
  }
  // the URL keeps the set, so it can be shared or bookmarked
  expect(page.url()).toContain('chords=');
  expect(errors).toEqual([]);
});

test('chord lesson: name the chords, then strum them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Strummer');
  await page.goto('/#/lesson/ukulele-chords/uc2-c');
  const quiz = page.locator('.activity.chord-quiz');
  await expect(quiz).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const name = await quiz.getAttribute('data-expected');
    await page.locator('.cq-answers .answer-btn', { hasText: new RegExp(`^${name}$`) }).click();
    await page.waitForTimeout(1300);
    if (!(await quiz.isVisible().catch(() => false))) break;
  }
  // next: strum along with a song, the tune on its own staff
  await expect(page.locator('.activity.playalong')).toBeVisible();
  await expect(page.getByText('Strum along: Twinkle', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('chord chart: Notation writes each picture on the staff', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Reader');
  await page.goto('/#/chords?chords=C,G7,Am&instruments=guitar,piano');
  const wide = (page.viewportSize()?.width ?? 0) >= 1000;
  await expect(page.locator('.chord-staff')).toHaveCount(0);
  await page.getByRole('button', { name: 'Notation' }).click();
  // one staff per picture: every chord on every instrument shown (phones: one picture)
  const staves = page.locator('.chord-staff');
  await expect(staves).toHaveCount(wide ? 6 : 1);
  await expect(staves.first().locator('svg .vf-stavenote').first()).toBeVisible();
  // the guitar's open C, written as played: five notes in one chord
  await expect(staves.first().locator('.vf-stavenote')).toHaveCount(1);
  await expect(staves.first().locator('.vf-notehead')).toHaveCount(5);
  expect(page.url()).toContain('notation=1');
  // the choice survives a reload (it lives in the URL)
  await page.reload();
  await expect(page.locator('.chord-staff')).toHaveCount(wide ? 6 : 1);
  await page.getByRole('button', { name: 'Notation' }).click();
  await expect(page.locator('.chord-staff')).toHaveCount(0);
  expect(errors).toEqual([]);
});
