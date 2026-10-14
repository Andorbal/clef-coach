import { describe, expect, it } from 'vitest';
import { expandArchives, findDuplicate, folderTag, isJunk, isSongArchive } from './bulk';

const enc = (s: string) => new TextEncoder().encode(s);

/** A ZIP archive with stored (uncompressed) entries. */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = [...enc(f.name)];
    const offset = out.length;
    out.push(...u32(0x04034b50), ...u16(20), 0, 0, 0, 0, 0, 0, 0, 0, ...u32(0), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), 0, 0, ...name, ...f.data);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), 0, 0, 0, 0, 0, 0, 0, 0, ...u32(0), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset), ...name);
  }
  const at = out.length;
  out.push(...central, ...u32(0x06054b50), 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(central.length), ...u32(at), 0, 0);
  return new Uint8Array(out);
}

describe('bulk import', () => {
  it('unpacks archives of songs and leaves out what isn’t a song', async () => {
    const archive = zip([
      { name: 'Carols/Silent Night.musicxml', data: enc('<score-partwise/>') },
      { name: 'Carols/readme.txt', data: enc('hi') },
      { name: '__MACOSX/Carols/._Silent Night.musicxml', data: enc('x') },
    ]);
    expect(isSongArchive('Carols.zip', archive)).toBe(true);
    const { files, skipped } = await expandArchives([
      { path: 'Carols.zip', bytes: archive },
      { path: 'tune.mid', bytes: enc('MThd') },
      { path: 'photo.jpg', bytes: enc('jpg') },
      { path: 'folder/.DS_Store', bytes: enc('') },
    ]);
    expect(files.map(f => f.path)).toEqual(['Carols/Carols/Silent Night.musicxml', 'tune.mid']);
    expect(skipped).toEqual(['Carols.zip: Carols/readme.txt', 'photo.jpg']);
  });

  it('keeps a compressed MusicXML score (.mxl) as one song', async () => {
    const mxl = zip([{ name: 'META-INF/container.xml', data: enc('<container/>') }, { name: 'score.xml', data: enc('<score-partwise/>') }]);
    expect(isSongArchive('score.mxl', mxl)).toBe(false);
    expect(isSongArchive('score.zip', mxl)).toBe(false);
    expect((await expandArchives([{ path: 'score.mxl', bytes: mxl }])).files).toHaveLength(1);
  });

  it('suggests the folder the files share as a tag', () => {
    expect(folderTag(['Christmas_carols/a.mxl', 'Christmas_carols/b.mid'])).toBe('Christmas carols');
    expect(folderTag(['Music/Bach/a.mxl', 'Music/Bach/Suites/b.mxl'])).toBe('Bach');
    expect(folderTag(['a.mxl', 'b.mxl'])).toBeNull();
    expect(isJunk('x/.hidden.mxl')).toBe(true);
  });

  it('spots a song that is already there', () => {
    const existing = [{ id: 'u1', title: 'Für Elise', composer: 'L. van Beethoven', instrument: 'piano' }] as never[];
    expect(findDuplicate({ title: 'für elise', composer: 'L. van Beethoven', instrument: 'piano' }, existing)).toBeDefined();
    expect(findDuplicate({ title: 'Für Elise', composer: 'L. van Beethoven', instrument: 'guitar' }, existing)).toBeUndefined();
  });
});
