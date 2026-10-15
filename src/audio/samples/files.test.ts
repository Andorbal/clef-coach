import { describe, expect, it } from 'vitest';
import { blobReader, separateFiles, zipFiles } from './files';

/** A minimal ZIP writer (stored entries, or deflated ones when given compressed bytes). */
function makeZip(entries: { name: string; data: Uint8Array; utf8?: boolean }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(6, e.utf8 ? 0x800 : 0, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(18, e.data.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(8, e.utf8 ? 0x800 : 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, e.data.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    parts.push(local, e.data);
    central.push(cd);
    offset += local.length + e.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const text = (s: string) => new TextEncoder().encode(s);

describe('bank files', () => {
  it('reads byte ranges from a Blob', async () => {
    const r = blobReader(new Blob([new Uint8Array([1, 2, 3, 4, 5])]));
    expect(r.size).toBe(5);
    expect([...(await r.read(1, 3))]).toEqual([2, 3, 4]);
    expect([...(await r.read(3, 10))]).toEqual([4, 5]);
  });

  it('lists and reads a ZIP entry by entry, matching paths loosely', async () => {
    const zip = makeZip([
      { name: 'Piano/piano.sfz', data: text('<region> sample=Samples/C4.wav') },
      { name: 'Piano/Samples/C4.wav', data: new Uint8Array([9, 9, 9]) },
      { name: 'Piano/Samples/', data: new Uint8Array() },
      { name: 'Piano/Ünïcode #1.txt', data: text('hi'), utf8: true },
    ]);
    const files = await zipFiles(new Blob([zip]));
    expect(files.paths).toEqual(['Piano/piano.sfz', 'Piano/Samples/C4.wav', 'Piano/Ünïcode #1.txt']);
    expect(await files.readText('Piano/piano.sfz')).toBe('<region> sample=Samples/C4.wav');
    expect([...(await files.read('piano\\samples\\c4.WAV'))!]).toEqual([9, 9, 9]);
    expect(await files.readText('Piano/Ünïcode #1.txt')).toBe('hi');
    expect(await files.read('nope.wav')).toBeNull();
  });

  it('says clearly when a file is not a ZIP', async () => {
    await expect(zipFiles(new Blob([text('not a zip at all, just some text')]))).rejects.toThrow(/not a ZIP/);
  });

  it('reads files stored one by one', async () => {
    const store = new Map([
      ['a.sfz', new Blob([text('﻿<region> sample=a.wav')])],
      ['Samples/a.wav', new Blob([new Uint8Array([1])])],
    ]);
    const files = separateFiles([...store.keys()], async p => store.get(p));
    expect(await files.readText('a.sfz')).toBe('<region> sample=a.wav'); // the byte-order mark is dropped
    expect(await files.read('samples/A.wav')).not.toBeNull();
  });
});
