import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// index.html's loading screen: up while the app's code downloads, gone once a screen shows

test('the loading screen shows while the app downloads, and goes once a screen is up', async ({ page }) => {
  // a slow connection: the app's entry arrives late
  await page.route(/\/src\/main\.tsx/, async route => {
    await new Promise(r => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#boot')).toBeVisible();
  await expect(page.getByText('Loading Clef Coach…')).toBeVisible();
  // no profile yet: the first render only redirects; the boot screen waits for Onboarding
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Get started/ })).toBeVisible();
});

test('a link straight to a screen inside the app keeps the loading screen up until that screen is there', async ({ page }) => {
  await onboard(page, 'Booter');
  // the Songs screen's code arrives late
  await page.route(/\/src\/screens\/Songs\.tsx/, async route => {
    await new Promise(r => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto('/#/songs');
  await page.reload();
  await expect(page.locator('#boot')).toBeVisible();
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Learn a song' })).toBeVisible();
});

test('the loading screen says so when the app cannot be downloaded', async ({ page }) => {
  await page.route(/\/src\/main\.tsx/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#boot.boot-failed')).toBeVisible();
  await expect(page.getByText(/couldn’t load/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'try again' })).toBeVisible();
});
