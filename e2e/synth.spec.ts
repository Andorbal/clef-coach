import { expect, test, type Page } from '@playwright/test';
import { onboard, pressMidi } from './helpers';

/** Listen on the lab synth's analyser (the same module instance the app uses) and report the loudest level heard. */
async function tapLab(page: Page) {
  await page.evaluate(async () => {
    const { getLabSynth } = await import('/src/synthlab/audio/host.ts');
    const w = window as unknown as { __labPeak: number };
    w.__labPeak = 0;
    const buf = new Float32Array(2048);
    setInterval(() => {
      const a = getLabSynth().analyser;
      if (!a) return;
      a.getFloatTimeDomainData(buf);
      for (const x of buf) w.__labPeak = Math.max(w.__labPeak, Math.abs(x));
    }, 40);
  });
  return {
    peak: () => page.evaluate(() => (window as unknown as { __labPeak: number }).__labPeak),
    reset: () => page.evaluate(() => void ((window as unknown as { __labPeak: number }).__labPeak = 0)),
  };
}

test('Synth School: learn, explore and match a sound by ear', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Synthesist');

  await page.goto('/#/synth');
  await expect(page.getByRole('heading', { name: 'Learn to speak synth' })).toBeVisible();
  await page.getByRole('button', { name: /Start the course/ }).click();
  await expect(page.getByRole('heading', { name: 'A synth makes sound from scratch' })).toBeVisible();

  // pitch: an explanation, a few things to try, then two sounds to rebuild
  await page.goto('/#/synth/lesson/sy1-2');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByText('Move it around')).toBeVisible();
  const osc = page.locator('[data-module="osc1"]');
  await osc.getByRole('button', { name: 'Octave down' }).click();
  await expect(page.locator('.sl-tasks li.done')).toHaveCount(0); // that task needs a note too
  await pressMidi(page, 60);
  await expect(page.locator('.sl-tasks li.done')).toHaveCount(1);
  await page.getByRole('button', { name: /Skip ahead/ }).click();

  // quiz 1: the target is an octave down; the quiz starts from the lesson's patch again
  await expect(page.getByText('Quiz: match the bass')).toBeVisible();
  const peak = await tapLab(page);
  await page.getByRole('button', { name: /Target/ }).click();
  await expect.poll(peak.peak, { timeout: 10_000 }).toBeGreaterThan(0.02);
  await page.getByRole('button', { name: /^Check/ }).click();
  await expect(page.locator('.sl-score')).toBeVisible();
  await expect(page.locator('.sl-score')).not.toHaveClass(/pass/);
  await page.getByRole('button', { name: /^Hint/ }).click();
  await expect(page.locator('.sl-hint')).toBeVisible();
  await osc.getByRole('button', { name: 'Octave down' }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await expect(page.getByText('That’s it!')).toBeVisible();
  await page.getByRole('button', { name: /^Continue/ }).click();

  // quiz 2: a square, an octave up
  await expect(page.getByText('Quiz: a brighter one')).toBeVisible();
  await osc.getByRole('radio', { name: 'Square' }).click();
  await osc.getByRole('button', { name: 'Octave up' }).click();
  await page.getByRole('button', { name: /^Check/ }).click();
  await expect(page.getByText('That’s it!')).toBeVisible();
  await page.getByRole('button', { name: /^Continue/ }).click();

  await expect(page.locator('.results')).toBeVisible();
  await expect(page.getByRole('button', { name: /Next: Harmonics and pulse width/ })).toBeVisible();
  const synth = await page.evaluate(() => JSON.parse(localStorage.getItem('clefcoach.data.v1') ?? '{}'));
  const profile = Object.values(synth.profiles as Record<string, { synth?: { lessons: Record<string, { passed: boolean }> } }>)[0];
  expect(profile.synth?.lessons['sy1-2']?.passed).toBe(true);

  // the course map ticks it off
  await page.getByRole('button', { name: 'Synth School' }).click();
  await expect(page.locator('.synth-lessons li', { hasText: 'Pitch: octaves and semitones' }).locator('.synth-lesson-stars')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Synth Lab: four engines, presets and saved patches', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Patcher');

  await page.goto('/#/synth/lab');
  await expect(page.locator('[data-module="osc1"]')).toBeVisible();
  const peak = await tapLab(page);
  await page.locator('.sl-piano').click({ position: { x: 20, y: 60 } }); // a gesture unlocks audio
  await page.keyboard.down('KeyA');
  await expect.poll(peak.peak, { timeout: 10_000 }).toBeGreaterThan(0.02);
  await page.keyboard.up('KeyA');

  // each engine has its own panel, and makes sound
  // (a phone shows short engine names)
  for (const [engine, mod] of [[/^FM$/, 'algo'], [/^Additive$/, 'harmonics'], [/^(Wavetable|Table)$/, 'wt1'], [/^(Subtractive|Analog)$/, 'filter']] as const) {
    await page.getByRole('radio', { name: engine }).click();
    await expect(page.locator(`[data-module="${mod}"]`)).toBeVisible();
    await peak.reset();
    await page.keyboard.down('KeyD');
    await expect.poll(peak.peak, { timeout: 10_000 }).toBeGreaterThan(0.01);
    await page.keyboard.up('KeyD');
  }

  // load a preset, then save it as your own
  await page.getByRole('button', { name: /Presets/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Bell', exact: true }).click();
  await dialog.getByRole('button', { name: /^FM bell/ }).click();
  await expect(page.locator('.synth-top-title')).toContainText('FM bell');
  await page.getByRole('button', { name: /^Save/ }).click();
  await page.getByLabel('Patch name').fill('My bell');
  await dialog.getByRole('button', { name: /^Save/ }).click();
  await expect(page.locator('.synth-top-title')).toContainText('My bell');
  await page.getByRole('button', { name: /Presets/ }).click();
  await expect(dialog.getByRole('button', { name: /^My bell/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // the last patch comes back next time
  await page.reload();
  await expect(page.locator('[data-module="algo"]')).toBeVisible();
  expect(errors).toEqual([]);
});
