import * as alphaTab from '@coderline/alphatab';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const TAB = [
  'House of the Rising Sun',
  'Time: 6/8',
  '',
  '   Am          C',
  'e|-----0-----|-----0-----|',
  'B|---1---1---|---1---1---|',
  'G|-2-------2-|-0-------0-|',
  'D|-----------|-2---------|',
  'A|-0---------|-3---------|',
  'E|-----------|-----------|',
].join('\n');

test('paste a text tab, read it in another time signature, hand it to Claude', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Picker');
  await page.goto('/#/songs/import');
  await page.getByRole('button', { name: /Paste/ }).first().click();
  await page.locator('textarea.import-text').fill(TAB);
  await page.getByRole('button', { name: /Check & preview/ }).click();
  await expect(page.getByRole('heading', { name: 'Check it over' })).toBeVisible();
  await expect(page.getByText('Text tab', { exact: true })).toBeVisible();
  await expect(page.locator('.import-fields input').first()).toHaveValue('House of the Rising Sun');
  await expect(page.getByText(/guessed from how the notes are spaced/)).toBeVisible();
  await expect(page.getByText(/2 bars · 1 staff · chords/)).toBeVisible();
  // read again in 3/4: each 6/8 bar's rhythm now takes a 3/4 bar
  await page.getByRole('radio', { name: '3/4', exact: true }).click();
  await expect(page.getByRole('radio', { name: '3/4', exact: true })).toHaveAttribute('aria-checked', 'true');
  // Claude can work the rhythm out instead
  await page.getByRole('button', { name: /Read it with Claude/ }).click();
  await expect(page.getByRole('heading', { name: /Scan with Claude/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tab as text' })).toHaveValue(TAB);
  await expect(page.getByRole('radio', { name: /Guitar/ })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('import a Guitar Pro file and a .txt tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  alphaTab.Logger.logLevel = alphaTab.LogLevel.None;
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex(String.raw`\title "Little Riff" \artist "Tabber" \tempo 100 .
\track "Lead" \staff {tabs} 0.1.4 2.1 3.1 5.1 | (0.1 1.2).1
\track "Bass" \staff {tabs} \tuning g2 d2 a1 e1 \instrument 33 0.3.1 | 0.4.1`);
  const bytes = new alphaTab.exporter.Gp7Exporter().export(score, new alphaTab.Settings());
  await onboard(page, 'Bassist');
  await page.goto('/#/songs/import');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'little-riff.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(page.getByRole('heading', { name: 'Check it over' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Guitar Pro', { exact: true })).toBeVisible();
  await expect(page.locator('.import-fields input').first()).toHaveValue('Little Riff');
  // the other track, for its own instrument
  await page.getByRole('button', { name: 'Bass', exact: true }).last().click();
  await expect(page.getByText(/Imported "Lead"/)).toBeHidden();
  await page.getByRole('button', { name: /Save to my songs/ }).click();
  await expect(page.locator('.studio-top').getByText('Little Riff')).toBeVisible();
  await expect(page.getByText('Bass guitar', { exact: true }).first()).toBeVisible();

  await page.goto('/#/songs/import');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'rising-sun.txt', mimeType: 'text/plain', buffer: Buffer.from(TAB) });
  await expect(page.getByText('Text tab', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: '6/8', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});
