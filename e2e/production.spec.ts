import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test.describe('Production School', () => {
  test('a balance quiz: the console plays, the judge listens, and a matching mix passes', async ({ page }) => {
    test.setTimeout(120_000);
    await onboard(page, 'Mixer');
    await page.goto('/#/production/lesson/pr1-3?step=1');
    const check = page.getByRole('button', { name: /^Check/ });
    await expect(check).toBeEnabled({ timeout: 30_000 });
    await page.locator('.pr-play').click();
    await expect.poll(() => page.evaluate(async () => (await import('/src/production/audio/host.ts')).getStudio().playing)).toBe(true);
    // the meters move while the loop plays
    await expect.poll(() => page.locator('[data-strip="bass"] .pr-meter-bar span').first().evaluate(el => getComputedStyle(el).transform)).not.toBe('matrix(1, 0, 0, 0, 0, 0)');
    await check.click();
    await expect(page.getByText(/Not yet|Getting there|Very close/)).toBeVisible({ timeout: 20_000 });
    // bass up 5 dB, hats down 9 dB, in 0.5 dB steps from the keyboard
    const bass = page.locator('[data-key="bass:fader"]');
    await bass.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
    const hats = page.locator('[data-key="hats:fader"]');
    await hats.focus();
    for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowDown');
    await expect(bass).toHaveAttribute('aria-valuenow', '-1');
    await page.getByRole('button', { name: 'Target' }).click();
    await page.getByRole('button', { name: 'Yours' }).click();
    await check.click();
    await expect(page.getByText('That’s it!')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.locator('.course-coach[data-step="mix"]')).toBeVisible();
  });

  test('the Mix Lab plays any session against its reference', async ({ page }) => {
    test.setTimeout(120_000);
    await onboard(page, 'Mixer');
    await page.goto('/#/production/lab');
    await expect(page.locator('.pr-play')).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('radio', { name: 'Fuzz Garden' }).click();
    await expect(page.locator('[data-strip="gtrL"]')).toBeVisible();
    await expect(page.locator('.pr-play')).toBeEnabled({ timeout: 30_000 });
    await page.locator('.pr-play').click();
    await page.getByRole('button', { name: 'Reference' }).click();
    await expect(page.getByRole('button', { name: 'Reference' })).toHaveAttribute('aria-pressed', 'true');
    // the session and mix are remembered on this device
    await page.reload();
    await expect(page.locator('[data-strip="gtrL"]')).toBeVisible({ timeout: 30_000 });
  });
});
