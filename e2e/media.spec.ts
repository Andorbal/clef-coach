/**
 * Screenshots and animations for the README (docs/media). Not part of the regular suite:
 *
 *   MEDIA=docs/media npx playwright test media --project=ipad
 *   MEDIA=docs/media npx playwright test media --project=phone
 *
 * Animations are recorded as frames (Chrome screencast); tools/make-gifs.sh turns them into GIFs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { onboard, pressMidi, solveLesson } from './helpers';

const out = process.env.MEDIA;
test.skip(!out, 'media run only');
// an evening practice session, not the container's clock
test.use({ timezoneId: 'America/Los_Angeles' });

async function shot(page: Page, name: string, opts: { fullPage?: boolean; wait?: number } = {}) {
  await page.waitForTimeout(opts.wait ?? 1200);
  await page.screenshot({ path: join(out!, `${name}.png`), fullPage: opts.fullPage });
}

/** Record the screen (Chrome screencast) while `run` plays; frames + timestamps go to <out>/frames/<name>. */
async function record(page: Page, name: string, run: () => Promise<void>) {
  const dir = join(out!, 'frames', name);
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames: { file: string; t: number }[] = [];
  let size = '';
  cdp.on('Page.screencastFrame', async f => {
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
    // a page.screenshot() meanwhile would send frames of another size, which ffmpeg can't mix
    const fsize = `${f.metadata.deviceWidth}x${f.metadata.deviceHeight}`;
    if (size && fsize !== size) return;
    size = fsize;
    const file = `${String(frames.length).padStart(5, '0')}.png`;
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
    writeFileSync(join(dir, file), Buffer.from(f.data, 'base64'));
  });
  // lossless frames: unchanged pixels stay identical, so the GIF only stores what moves
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await run();
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(200);
  // ffmpeg concat list: each frame lasts until the next one
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 0.5;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  writeFileSync(join(dir, 'frames.txt'), lines.join('\n'));
}

/** Schedule computer-key presses in the page, timed from the moment the run starts playing. */
async function playInTime(page: Page, keys: (string | null)[], beatMs: number) {
  await page.evaluate(
    ({ keys, beatMs }) =>
      new Promise<void>(resolve => {
        const act = document.querySelector('.activity.playalong')!;
        const go = () => {
          const t0 = performance.now();
          keys.forEach((code, i) => {
            if (!code) return;
            const at = t0 + i * beatMs + 15;
            setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })), at - performance.now());
            setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), at - performance.now() + beatMs * 0.6);
          });
          setTimeout(resolve, keys.length * beatMs + 200);
        };
        if (act.getAttribute('data-phase') === 'playing') go();
        else {
          const mo = new MutationObserver(() => {
            if (act.getAttribute('data-phase') === 'playing') {
              mo.disconnect();
              go();
            }
          });
          mo.observe(act, { attributes: true, attributeFilter: ['data-phase'] });
        }
      }),
    { keys, beatMs },
  );
}

test('README media', async ({ page }, info) => {
  test.setTimeout(600_000);
  const phone = info.project.name === 'phone';
  mkdirSync(out!, { recursive: true });
  await onboard(page, 'Andy');
  // a little real progress for the home and progress screens
  await page.goto('/#/lesson/piano-treble/pt1-1');
  await solveLesson(page);

  await page.goto('/#/');
  const gotIt = page.getByRole('button', { name: 'Got it' }); // the iOS "Add to Home Screen" tip
  if (await gotIt.isVisible({ timeout: 1500 }).catch(() => false)) await gotIt.click();

  if (phone) {
    await page.goto('/#/');
    await shot(page, 'phone-home');
    await page.goto('/#/song/prh-twinkle-twinkle');
    await page.getByRole('button', { name: /^Start$/ }).first().click();
    await expect(page.locator('.activity.playalong')).toBeVisible();
    for (const m of [60, 60]) await pressMidi(page, m);
    await shot(page, 'phone-song', { wait: 900 });
    await page.goto('/#/chords');
    await page.locator('.cc-options').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'phone-chords');
    return;
  }

  await page.goto('/#/');
  await shot(page, 'home');
  await page.goto('/#/track/piano-treble');
  await shot(page, 'track-map');
  await page.goto('/#/songs');
  await shot(page, 'songs');
  await page.goto('/#/song/prh-ode-to-joy');
  await shot(page, 'song-studio');
  await page.goto('/#/chords');
  await page.locator('.cc-instruments').getByRole('button', { name: 'Guitar' }).click();
  await page.waitForTimeout(600);
  await page.locator('.cc-options').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot(page, 'chord-chart');
  await page.goto('/#/progress');
  await shot(page, 'progress');
  await page.goto('/#/studio/metronome');
  await shot(page, 'metronome');
  await page.goto('/#/studio/fretboard');
  await shot(page, 'fretboard');

  // a guitar lesson: standard notation over the fretboard
  await page.goto('/#/lesson/guitar-treble/gt1-1');
  await page.waitForTimeout(1200);
  for (let i = 0; i < 3; i++) {
    const b = page.getByRole('button', { name: /Start lesson|^Next$/ });
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      await page.waitForTimeout(600);
    }
  }
  await shot(page, 'guitar-lesson');

  // ---- animation 1: wait mode – the music waits for each note; a wrong note shows in red
  await page.goto('/#/song/prh-twinkle-twinkle');
  await page.getByRole('button', { name: /^Start$/ }).first().click();
  const act = page.locator('.activity.playalong');
  await expect(act).toBeVisible();
  await page.waitForTimeout(1500);
  await record(page, 'wait-mode', async () => {
    await page.waitForTimeout(700);
    let played = 0;
    for (let guard = 0; guard < 40 && played < 12; guard++) {
      const expected = await act.getAttribute('data-expected');
      if (!expected) break;
      if (played === 4) {
        await pressMidi(page, 65); // F instead of G: a red ghost note
        await page.waitForTimeout(1300);
      }
      for (const m of expected.split(',').map(Number)) await pressMidi(page, m);
      played++;
      await page.waitForTimeout(played % 4 === 0 ? 650 : 380);
    }
    await page.waitForTimeout(800);
  });
  await page.locator('.studio-shell button[aria-label="Stop"]').click();

  // ---- animation 2: in time – 1-2-3-4 count-in, the beat light, notes judged as you play
  await page.goto('/#/song/prh-ode-to-joy');
  await page.getByRole('radio', { name: 'In time' }).click();
  await page.locator('input[type="range"]').first().fill('100');
  await page.getByRole('button', { name: /^Practise / }).click();
  const start = page.getByRole('button', { name: /^Start — / });
  await expect(start).toBeVisible();
  await page.waitForTimeout(800);
  const E = 'KeyD', F = 'KeyF', G = 'KeyG', D = 'KeyS', C = 'KeyA';
  const ODE = [E, E, F, G, G, F, E, D, C, C, D, E, E, D, D, null];
  await record(page, 'tempo-mode', async () => {
    await page.waitForTimeout(500);
    await start.click();
    await playInTime(page, ODE, 60000 / 84);
    await page.waitForTimeout(900);
  });
  // a still from the middle of the phrase (not while recording): the loop counts in again by itself
  await expect(page.locator('.activity.playalong[data-phase="countin"]')).toBeVisible({ timeout: 10_000 });
  const again = playInTime(page, ODE, 60000 / 84);
  await expect(act).toHaveAttribute('data-phase', 'playing', { timeout: 8000 });
  await page.waitForTimeout((60000 / 84) * 6 + 150);
  await page.screenshot({ path: join(out!, 'tempo-mode.png') });
  await again;
});

test('README media: the band', async ({ page }, info) => {
  test.skip(info.project.name !== 'ipad', 'tablet shots only');
  test.setTimeout(120_000);
  await onboard(page, 'Maya');
  // Ode to Joy brings its own band: brushes, acoustic bass, nylon guitar and strings
  await page.goto('/#/song/prh-ode-to-joy');
  await page.locator('.studio-perform').getByRole('button', { name: /Band & mix/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await shot(page, 'band-mixer');
  await page.keyboard.press('Escape');
  await page.goto('/#/settings/sounds');
  await expect(page.getByRole('heading', { name: 'Instrument sounds' })).toBeVisible();
  await page.getByRole('heading', { name: /Free sounds/ }).evaluate(h => h.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -24));
  await shot(page, 'sounds');
});
