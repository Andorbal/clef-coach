import { expect, type Page } from '@playwright/test';

const KEYS: Record<number, string> = {
  60: 'KeyA', 61: 'KeyW', 62: 'KeyS', 63: 'KeyE', 64: 'KeyD', 65: 'KeyF', 66: 'KeyT', 67: 'KeyG',
  68: 'KeyY', 69: 'KeyH', 70: 'KeyU', 71: 'KeyJ', 72: 'KeyK', 73: 'KeyO', 74: 'KeyL', 75: 'KeyP', 76: 'Semicolon',
};

export async function onboard(page: Page, name = 'Tester') {
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

export async function pressMidi(page: Page, midi: number) {
  const key = KEYS[midi];
  if (!key) throw new Error(`no computer key for midi ${midi}`);
  await page.keyboard.down(key);
  await page.waitForTimeout(40);
  await page.keyboard.up(key);
}

/** Play through whatever activity is on screen, correctly, until the results appear. */
export async function solveLesson(page: Page) {
  for (let guard = 0; guard < 400; guard++) {
    if (await page.locator('.results').isVisible()) return;
    const intro = page.getByRole('button', { name: /Start lesson|^Next$/ });
    if (await intro.isVisible().catch(() => false)) {
      await intro.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      continue;
    }
    const tip = page.getByRole('button', { name: /Got it/ });
    if (await tip.isVisible().catch(() => false)) {
      await tip.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      continue;
    }
    const act = page.locator('.activity').first();
    if (!(await act.isVisible().catch(() => false))) {
      await page.waitForTimeout(150);
      continue;
    }
    // the activity can finish between the check above and these reads: don't wait for it forever
    const cls = (await act.getAttribute('class', { timeout: 1000 }).catch(() => null)) ?? '';
    const expected = await act.getAttribute('data-expected', { timeout: 1000 }).catch(() => null);
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

