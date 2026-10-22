/**
 * Choosing an audio input (an audio interface such as an iRig) in the input
 * dialog, with Chromium's fake audio devices standing in for real ones.
 */
import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const localChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
test.use({
  permissions: ['microphone'],
  launchOptions: { ...(existsSync(localChromium) ? { executablePath: localChromium } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test('an audio input can be chosen, marked as plugged in and heard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Cable');
  await page.goto('/#/settings');
  await page.getByRole('button', { name: /Microphone/ }).click();

  const select = page.locator('.input-setup select');
  await expect(select).toBeVisible();
  const options = select.locator('option');
  await expect.poll(() => options.count()).toBeGreaterThan(1);
  const label = (await options.nth(1).textContent())!.trim();
  await select.selectOption({ index: 1 });
  await expect(select.locator('option:checked')).toHaveText(label);

  // a fake input isn't named like an interface: say it's plugged in, then hear it
  await expect(page.getByText('Hear yourself')).toBeHidden();
  await page.getByText('Plugged in with a cable').click();
  await page.getByText('Hear yourself').click();
  await expect(page.locator('.input-setup input[type="range"]')).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('clefcoach.device.v1') ?? '{}'));
  expect(saved.micDevice).toMatchObject({ label, direct: true });
  expect(saved.monitor).toBe(true);
  if (process.env.SHOTS) await page.locator('.input-picker').screenshot({ path: `${process.env.SHOTS}/audio-input.png` });

  // back to the system default
  await select.selectOption({ index: 0 });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('clefcoach.device.v1') ?? '{}').micDevice)).toBeUndefined();
  expect(errors).toEqual([]);
});
