import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/** A one-part MusicXML score of whole notes. */
const xml = (title: string, pitches: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>${title}</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${pitches
    .map(
      (p, i) =>
        `<measure number="${i + 1}">${i === 0 ? '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>' : ''}<note><pitch><step>${p[0]}</step><octave>${p[1]}</octave></pitch><duration>4</duration><type>whole</type></note></measure>`,
    )
    .join('')}</part>
</score-partwise>`;

/** A format 0 MIDI file: C D E F in quarter notes, 4/4. */
function midi(): Buffer {
  const ev: number[] = [0, 0xff, 0x58, 4, 4, 2, 24, 8];
  [60, 62, 64, 65].forEach(k => ev.push(0, 0x90, k, 80, 96, 0x80, k, 0));
  ev.push(0, 0xff, 0x2f, 0);
  const len = ev.length;
  return Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96, 0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...ev]);
}

/** A ZIP archive with stored (uncompressed) entries. */
function zip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt32LE(f.data.length, 18);
    head.writeUInt32LE(f.data.length, 22);
    head.writeUInt16LE(name.length, 26);
    parts.push(head, name, f.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(f.data.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + f.data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

test('import several songs at once, tag them, and find them by tag', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Collector');
  await page.goto('/#/songs/import');
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: 'First Carol.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer: Buffer.from(xml('First Carol', ['C4', 'E4', 'G4', 'C5'])) },
    { name: 'Second Carol.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer: Buffer.from(xml('Second Carol', ['D4', 'F4', 'A4', 'D5'])) },
    { name: 'scale.mid', mimeType: 'audio/midi', buffer: midi() },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a song') },
  ]);
  await expect(page.getByRole('heading', { name: '3 files' })).toBeVisible();
  await expect(page.locator('.bulk-row.ok')).toHaveCount(3);
  await expect(page.getByText('1 other file was left out')).toBeVisible();
  // a tag for all of them
  await page.locator('.bulk .tag-input').fill('christmas');
  await page.locator('.bulk .tag-input').press('Enter');
  // leave the MIDI file out
  await page.getByRole('checkbox', { name: /Import scale/ }).uncheck();
  await page.getByRole('button', { name: /Save 2 songs/ }).click();
  await expect(page.getByRole('heading', { name: 'Saved 2 songs' })).toBeVisible();
  await page.getByRole('button', { name: 'Show them' }).click();
  // the Songs page opens filtered by the tag
  await expect(page.locator('.songs-tags .chip-btn.on')).toHaveText(/christmas/);
  const mySongs = page.locator('.song-group', { has: page.getByRole('heading', { name: 'My songs' }) });
  await expect(mySongs.locator('.song-card')).toHaveCount(2);
  await expect(mySongs.locator('.song-card').first()).toContainText('christmas');

  // tag a library song in its studio, then filter by that tag
  await page.goto('/#/song/prh-ode-to-joy');
  await page.locator('.studio-tags .tag-input').fill('recital, warm-up');
  await page.locator('.studio-tags .tag-input').press('Enter');
  await expect(page.locator('.studio-tags .tag-chip', { hasText: 'recital' })).toBeVisible();
  await page.goto('/#/songs');
  await page.locator('.songs-tags').getByRole('button', { name: /^recital/ }).click();
  await expect(page.locator('.song-card')).toHaveCount(1);
  await expect(page.locator('.song-card')).toContainText('Ode to Joy');
  // a second tag narrows to songs with both
  await page.locator('.songs-tags').getByRole('button', { name: /^christmas/ }).click();
  await expect(page.getByText('No songs have all of those tags here.')).toBeVisible();
  await page.getByRole('button', { name: /Clear tags/ }).click();
  await expect(page.locator('.songs-tags .chip-btn.on')).toHaveCount(0);

  // tags are kept on the device
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('clefcoach.data.v1') ?? '{}'));
  expect(stored.songTags['prh-ode-to-joy']).toEqual(expect.arrayContaining(['recital', 'warm-up']));
  expect(Object.values(stored.songs as Record<string, { tags?: string[] }>).every(s => s.tags?.includes('christmas'))).toBe(true);
  expect(errors).toEqual([]);
});

test('import a .zip of songs, and spot songs already imported', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await onboard(page, 'Zipper');
  await page.goto('/#/songs/import');
  const archive = zip([
    { name: 'Hymns/Morning Hymn.musicxml', data: Buffer.from(xml('Morning Hymn', ['G4', 'A4'])) },
    { name: 'Hymns/Evening Hymn.musicxml', data: Buffer.from(xml('Evening Hymn', ['E4', 'D4'])) },
    { name: '__MACOSX/Hymns/._Morning Hymn.musicxml', data: Buffer.from('junk') },
  ]);
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'Hymns.zip', mimeType: 'application/zip', buffer: archive });
  await expect(page.getByRole('heading', { name: '2 files' })).toBeVisible();
  // the folder inside the archive suggests a tag
  await expect(page.locator('.bulk .tag-chip')).toHaveText(/Hymns/);
  await page.getByRole('button', { name: /Save 2 songs/ }).click();
  await expect(page.getByRole('heading', { name: 'Saved 2 songs' })).toBeVisible();
  // the same archive again: both are already in My songs and left unticked
  await page.getByRole('button', { name: 'Import more' }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'Hymns.zip', mimeType: 'application/zip', buffer: archive });
  await expect(page.locator('.bulk-dupe')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Save\s+songs/ })).toBeDisabled();
  expect(errors).toEqual([]);
});
