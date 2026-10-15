import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/** A small General MIDI SoundFont 3 that ships with alphaTab: stands in for the downloads (no network in CI). */
const SF3 = readFileSync(new URL('../node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf3', import.meta.url));

/** Listen on the band's bus and report the loudest level heard. */
async function tapBand(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const c = await import('/src/audio/context.ts');
    const ctx = c.getAudioContext();
    const a = ctx.createAnalyser();
    a.fftSize = 2048;
    c.getBus('band').connect(a);
    const buf = new Float32Array(a.fftSize);
    const w = window as unknown as { __bandPeak: number };
    w.__bandPeak = 0;
    setInterval(() => {
      a.getFloatTimeDomainData(buf);
      for (const x of buf) w.__bandPeak = Math.max(w.__bandPeak, Math.abs(x));
    }, 50);
  });
  return () => page.evaluate(() => (window as unknown as { __bandPeak: number }).__bandPeak);
}

test('perform a song with the band, and mix it', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Drummer');
  // Ode to Joy has a band written for it
  await page.goto('/#/song/prh-ode-to-joy');
  const card = page.locator('.studio-perform');
  await expect(card.getByText('Drums, Bass, Guitar, Strings')).toBeVisible();
  const peak = await tapBand(page);

  await card.getByRole('button', { name: /Listen with the band/ }).click();
  await expect(card.getByRole('button', { name: /^Stop$/ })).toBeVisible();
  await expect.poll(peak, { timeout: 15_000 }).toBeGreaterThan(0.01);
  await card.getByRole('button', { name: /^Stop$/ }).click();
  await expect(card.getByRole('button', { name: /Listen with the band/ })).toBeVisible();

  // the mixer: the song's own parts or an automatic band, and each part's level
  await card.getByRole('button', { name: /Band & mix/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Song’s parts')).toBeVisible();
  await dialog.getByRole('radio', { name: 'Automatic' }).click();
  await dialog.getByRole('button', { name: 'Waltz' }).click();
  await expect(dialog.locator('.mix-row')).toHaveCount(4);
  await dialog.locator('.mix-row').first().getByRole('button', { name: 'M' }).click();
  await expect(dialog.locator('.mix-row').first()).toHaveClass(/muted/);
  await page.keyboard.press('Escape');
  // remembered on this device
  await page.reload();
  await expect(card.getByText(/waltz style/)).toBeVisible();

  // perform: count-in, then the band plays along
  await card.getByRole('button', { name: /Perform the whole song/ }).click();
  await expect(page.getByText('Play in time with the band.')).toBeVisible();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(page.locator('.activity.playalong')).toHaveAttribute('data-phase', /countin|playing/);
  await expect(page.locator('.activity.playalong')).toHaveAttribute('data-phase', 'playing', { timeout: 10_000 });
  await page.getByRole('button', { name: /^Stop$/ }).first().click();
  expect(errors).toEqual([]);
});

test('add a sound bank and play the band with it', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/sounds/GeneralUser-GS.sf3', route => route.fulfill({ body: SF3, contentType: 'application/octet-stream' }));
  await onboard(page, 'Sampler');
  await page.goto('/#/settings');
  await page.getByRole('link', { name: /Instrument sounds/ }).click();
  await expect(page.getByRole('heading', { name: 'Instrument sounds' })).toBeVisible();
  await expect(page.getByRole('note')).toBeVisible();
  const entry = page.locator('.catalog-item').filter({ hasText: 'Start here' });
  await entry.getByRole('button', { name: /Download/ }).click();
  await expect(entry.getByText('On this device')).toBeVisible({ timeout: 30_000 });
  // the first General MIDI bank becomes the band's
  await expect(page.getByLabel('Sounds for the band')).toHaveValue(/bank-/);
  await expect(page.locator('.bank-item')).toHaveCount(1);

  await page.goto('/#/song/p2-ode-to-joy');
  const card = page.locator('.studio-perform');
  const peak = await tapBand(page);
  await card.getByRole('button', { name: /Listen with the band/ }).click();
  await expect.poll(peak, { timeout: 15_000 }).toBeGreaterThan(0.01);
  const memory = await page.evaluate(async () => (await import('/src/audio/samples/sampler.ts')).sampleMemory());
  expect(memory).toBeGreaterThan(0);
  await card.getByRole('button', { name: /^Stop$/ }).click();
  // each part can pick any instrument of the bank
  await card.getByRole('button', { name: /Band & mix/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Bass sound')).toBeVisible();
  expect(errors).toEqual([]);
});

test('keep an automatic band: a copy of the song with the band written in', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Arranger');
  await page.goto('/#/song/prh-twinkle-twinkle');
  const card = page.locator('.studio-perform');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Band & mix/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Save a copy with this band/ }).click();
  await expect(page.locator('.studio-top').getByText('(with band)')).toBeVisible();
  await expect(page.locator('.studio-perform').getByText(/the parts written for this song/)).toBeVisible();
  // and it's in My songs, band and all
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('clefcoach.data.v1') ?? '{}');
    return Object.values(data.songs ?? {}).map((s: any) => [s.title, s.band?.length ?? 0]);
  });
  expect(saved).toEqual([[expect.stringContaining('(with band)'), expect.any(Number)]]);
  expect((saved[0] as [string, number])[1]).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

/** A score for a small combo: flute (the part to learn), electric bass and a drum kit. */
const COMBO = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Combo Tune</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Flute</part-name><midi-instrument id="P1-I1"><midi-program>74</midi-program></midi-instrument></score-part>
    <score-part id="P2"><part-name>Electric Bass</part-name><midi-instrument id="P2-I1"><midi-program>34</midi-program></midi-instrument></score-part>
    <score-part id="P3"><part-name>Drum Set</part-name>
      <score-instrument id="P3-K"><instrument-name>Bass Drum</instrument-name></score-instrument>
      <score-instrument id="P3-S"><instrument-name>Snare</instrument-name></score-instrument>
      <midi-instrument id="P3-K"><midi-channel>10</midi-channel><midi-unpitched>37</midi-unpitched></midi-instrument>
      <midi-instrument id="P3-S"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">${[0, 1, 2, 3]
    .map(m => `<measure number="${m + 1}">${m === 0 ? '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>' : ''}${['C', 'E', 'G', 'E'].map(s => `<note><pitch><step>${s}</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>`).join('')}</measure>`)
    .join('')}</part>
  <part id="P2">${[0, 1, 2, 3]
    .map(m => `<measure number="${m + 1}">${m === 0 ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>' : ''}<note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><type>half</type></note><note><pitch><step>G</step><octave>2</octave></pitch><duration>2</duration><type>half</type></note></measure>`)
    .join('')}</part>
  <part id="P3">${[0, 1, 2, 3]
    .map(m => `<measure number="${m + 1}">${m === 0 ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign></clef></attributes>' : ''}${['K', 'S', 'K', 'S'].map(i => `<note><unpitched><display-step>${i === 'K' ? 'F' : 'C'}</display-step><display-octave>${i === 'K' ? 4 : 5}</display-octave></unpitched><duration>1</duration><instrument id="P3-${i}"/><type>quarter</type></note>`).join('')}</measure>`)
    .join('')}</part>
</score-partwise>`;

test('import a full score: the other parts, drums included, play as the band', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Bandleader');
  await page.goto('/#/songs/import');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'Combo Tune.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer: Buffer.from(COMBO) });
  await expect(page.getByRole('heading', { name: 'Check it over' })).toBeVisible();
  await expect(page.getByText(/Electric Bass \(Fingered Bass\), Drum Set \(Standard kit\)/)).toBeVisible();
  await page.getByRole('button', { name: /Save to my songs/ }).click();
  const card = page.locator('.studio-perform');
  await expect(card.getByText(/Electric Bass, Drum Set — the parts written for this song/)).toBeVisible();
  const peak = await tapBand(page);
  await card.getByRole('button', { name: /Listen with the band/ }).click();
  await expect.poll(peak, { timeout: 15_000 }).toBeGreaterThan(0.01);
  await card.getByRole('button', { name: /^Stop$/ }).click();
  expect(errors).toEqual([]);
});
