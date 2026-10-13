import { expect, test, type Page } from '@playwright/test';

const KEYS: Record<number, string> = {
  60: 'KeyA', 61: 'KeyW', 62: 'KeyS', 63: 'KeyE', 64: 'KeyD', 65: 'KeyF', 66: 'KeyT', 67: 'KeyG',
  68: 'KeyY', 69: 'KeyH', 70: 'KeyU', 71: 'KeyJ', 72: 'KeyK', 73: 'KeyO', 74: 'KeyL', 75: 'KeyP', 76: 'Semicolon',
};

async function onboard(page: Page, name = 'Tester') {
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: /Get started/ }).click();
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByRole('button', { name: /Let’s play/ }).click();
  await expect(page.getByRole('heading', { name: 'Treble Clef' })).toBeVisible();
}

async function pressMidi(page: Page, midi: number) {
  const key = KEYS[midi];
  if (!key) throw new Error(`no computer key for midi ${midi}`);
  await page.keyboard.down(key);
  await page.waitForTimeout(40);
  await page.keyboard.up(key);
}

/** Play through whatever activity is on screen, correctly, until the results appear. */
async function solveLesson(page: Page) {
  for (let guard = 0; guard < 400; guard++) {
    if (await page.locator('.results').isVisible()) return;
    const intro = page.getByRole('button', { name: /Start lesson|^Next$/ });
    if (await intro.isVisible().catch(() => false)) {
      await intro.click();
      continue;
    }
    const tip = page.getByRole('button', { name: /Got it/ });
    if (await tip.isVisible().catch(() => false)) {
      await tip.click();
      continue;
    }
    const act = page.locator('.activity').first();
    if (!(await act.isVisible().catch(() => false))) {
      await page.waitForTimeout(150);
      continue;
    }
    const cls = (await act.getAttribute('class')) ?? '';
    const expected = await act.getAttribute('data-expected');
    if (!expected) {
      await page.waitForTimeout(150);
      continue;
    }
    if (cls.includes('meet')) {
      await pressMidi(page, Number(expected));
      await page.waitForTimeout(120);
    } else if (cls.includes('flashcards')) {
      if (/^[A-G]$/.test(expected)) await page.keyboard.press(`Key${expected}`);
      else if (/^[A-G]-?\d$/.test(expected)) {
        const alter = Number(expected.slice(1));
        await page.keyboard.press(`${alter > 0 ? 'Shift+' : alter < 0 ? 'Alt+' : ''}Key${expected[0]}`);
      } else await pressMidi(page, Number(expected));
      await page.waitForTimeout(550);
    } else if (cls.includes('playalong')) {
      for (const m of expected.split(',').map(Number)) await pressMidi(page, m);
      await page.waitForTimeout(90);
    } else {
      await page.waitForTimeout(150);
    }
  }
  throw new Error('lesson did not finish');
}

test('onboarding, first lesson, progress saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page);
  await page.goto('/#/lesson/piano-treble/pt1-1');
  await solveLesson(page);
  await expect(page.locator('.results-title')).toHaveText(/Flawless|Outstanding/);
  await page.getByRole('button', { name: /Next: Hello, E/ }).click();
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
  for (const path of ['/', '/learn', '/songs', '/studio', '/studio/free', '/studio/fretboard', '/studio/tuner', '/studio/scales', '/studio/gym', '/progress', '/settings', '/track/piano-bass', '/track/guitar-fretboard']) {
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
  await expect(page.getByText('Backup', { exact: true })).toBeVisible();
});
