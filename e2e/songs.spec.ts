import { expect, test } from '@playwright/test';
import { onboard, pressMidi } from './helpers';

const SONG = {
  format: 'clef-coach-song',
  version: 1,
  title: 'Test Tune',
  composer: 'Clef Coach Original',
  instrument: 'piano',
  key: 'C',
  time: [4, 4],
  tempo: 90,
  staves: [
    { clef: 'treble', voices: ['C4/q D4 E4 F4 | G4/h E4 | F4/q E4 D4 C4 | C4/w |'] },
    { clef: 'bass', voices: ['C3/w | C3/w | G2/w | C3/w |'] },
  ],
  chords: 'C/w | C/w | G7/w | C/w |',
};

test('import a song, learn its first phrase, progress is saved', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Singer');
  await page.goto('/#/songs/import');
  await page.getByRole('button', { name: /Paste/ }).first().click();
  await page.locator('textarea.import-text').fill(JSON.stringify(SONG));
  await page.getByRole('button', { name: /Check & preview/ }).click();
  await expect(page.getByRole('heading', { name: 'Check it over' })).toBeVisible();
  await page.getByRole('button', { name: /Save to my songs/ }).click();
  // the Song Studio opens on the new song
  await expect(page.locator('.studio-top').getByText('Test Tune')).toBeVisible();
  await expect(page.getByText('Chords in this song')).toBeVisible();
  // first plan step: phrase 1, right hand, wait mode
  await page.getByRole('button', { name: /^Start$/ }).first().click();
  const act = page.locator('.activity.playalong');
  await expect(act).toBeVisible();
  for (let guard = 0; guard < 40; guard++) {
    const expected = await act.getAttribute('data-expected').catch(() => null);
    if (!expected) break;
    for (const m of expected.split(',').map(Number)) await pressMidi(page, m);
    await page.waitForTimeout(80);
  }
  // the run is recorded for this profile
  await expect
    .poll(async () => page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('clefcoach.data.v1') ?? '{}');
      const p = d.profiles[d.activeProfileId];
      const id = Object.keys(d.songs ?? {})[0];
      return p?.songs?.[id]?.passages ? Object.keys(p.songs[id].passages) : [];
    }))
    .toContain('1-2');
  // back on the songs page it is in "Learning now"
  await page.locator('.studio-shell button[aria-label="Stop"]').click();
  await page.goto('/#/songs');
  await expect(page.getByRole('heading', { name: 'Learning now' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My songs' })).toBeVisible();
  expect(errors).toEqual([]);
});

const MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Little Tune</work-title></work>
  <identification><creator type="composer">A. Tester</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><notations><technical><fingering>1</fingering></technical></notations></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <harmony><root><root-step>G</root-step></root><kind>dominant</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

test('import a MusicXML file', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Reader');
  await page.goto('/#/songs/import');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'little-tune.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer: Buffer.from(MUSICXML) });
  await expect(page.getByRole('heading', { name: 'Check it over' })).toBeVisible();
  await expect(page.locator('.import-fields input').first()).toHaveValue('Little Tune');
  await expect(page.getByText('MusicXML', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Save to my songs/ }).click();
  await expect(page.locator('.studio-top').getByText('Little Tune')).toBeVisible();
  await expect(page.getByText('Chords in this song')).toBeVisible();
  expect(errors).toEqual([]);
});
