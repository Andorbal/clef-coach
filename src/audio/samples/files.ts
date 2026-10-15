/**
 * Reading a bank's files without loading the whole bank: a ByteReader over a Blob
 * (one SoundFont), and the files of an SFZ bank — inside a .zip (ZIP64 too: big
 * libraries pass 4 GB) or stored one by one.
 */
import { inflateRaw } from '../../songs/zip';
import { BankFormatError, type ByteReader } from './types';

/** Random access to a Blob (a stored file stays on disk; only the slices read come into memory). */
export function blobReader(blob: Blob): ByteReader {
  return {
    size: blob.size,
    read: async (offset, length) => new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + length)).arrayBuffer()),
  };
}

export interface BankFiles {
  /** Every file path, '/' separated. */
  readonly paths: readonly string[];
  /** A file's bytes by path (matched exactly, else ignoring case and slashes), or null. */
  read(path: string): Promise<Uint8Array | null>;
  readText(path: string): Promise<string | null>;
}

const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();

function lookup(paths: readonly string[]): (path: string) => string | null {
  const exact = new Set(paths);
  const loose = new Map(paths.map(p => [norm(p), p]));
  return path => (exact.has(path) ? path : loose.get(norm(path)) ?? null);
}

const decoder = new TextDecoder('utf-8');
const textOf = (b: Uint8Array | null) => (b ? decoder.decode(b).replace(/^﻿/, '') : null);

/** Files kept one by one (a folder, or a bank downloaded file by file). */
export function separateFiles(paths: readonly string[], get: (path: string) => Promise<Blob | undefined>): BankFiles {
  const find = lookup(paths);
  const read = async (path: string) => {
    const p = find(path);
    const blob = p ? await get(p) : undefined;
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  };
  return { paths, read, readText: async p => textOf(await read(p)) };
}

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  headerOffset: number;
  encrypted: boolean;
}

/** The files inside a .zip Blob, read entry by entry. */
export async function zipFiles(blob: Blob): Promise<BankFiles> {
  const reader = blobReader(blob);
  const entries = await readCentralDirectory(reader);
  const byName = new Map(entries.filter(e => !e.name.endsWith('/')).map(e => [e.name, e]));
  const paths = [...byName.keys()];
  const find = lookup(paths);
  const read = async (path: string) => {
    const name = find(path);
    const e = name ? byName.get(name) : undefined;
    if (!e) return null;
    if (e.encrypted) throw new BankFormatError(`"${e.name}" in the ZIP is encrypted.`);
    const head = await reader.read(e.headerOffset, 30);
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    if (head.length < 30 || dv.getUint32(0, true) !== 0x04034b50) throw new BankFormatError(`The ZIP entry "${e.name}" is damaged.`);
    const start = e.headerOffset + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
    const data = await reader.read(start, e.compressedSize);
    if (e.method === 0) return data;
    if (e.method === 8) return inflateRaw(data);
    throw new BankFormatError(`"${e.name}" uses a compression the app can't unpack (method ${e.method}).`);
  };
  return { paths, read, readText: async p => textOf(await read(p)) };
}

async function readCentralDirectory(reader: ByteReader): Promise<Entry[]> {
  const tailLen = Math.min(reader.size, 22 + 0xffff + 20);
  const tail = await reader.read(reader.size - tailLen, tailLen);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new BankFormatError('This is not a ZIP archive (no central directory found).');
  let count = tv.getUint16(eocd + 10, true);
  let cdSize = tv.getUint32(eocd + 12, true);
  let cdOffset = tv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    // ZIP64: a locator just before the record points at the 64-bit end record
    const loc = eocd - 20;
    if (loc < 0 || tv.getUint32(loc, true) !== 0x07064b50) throw new BankFormatError('The ZIP64 archive is damaged.');
    const z64At = Number(tv.getBigUint64(loc + 8, true));
    const z = await reader.read(z64At, 56);
    const zv = new DataView(z.buffer, z.byteOffset, z.byteLength);
    if (zv.getUint32(0, true) !== 0x06064b50) throw new BankFormatError('The ZIP64 archive is damaged.');
    count = Number(zv.getBigUint64(32, true));
    cdSize = Number(zv.getBigUint64(40, true));
    cdOffset = Number(zv.getBigUint64(48, true));
  }
  const cd = await reader.read(cdOffset, cdSize);
  const dv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const utf8 = new TextDecoder('utf-8');
  const latin = new TextDecoder('latin1');
  const out: Entry[] = [];
  let p = 0;
  for (let k = 0; k < count; k++) {
    if (p + 46 > cd.length || dv.getUint32(p, true) !== 0x02014b50) throw new BankFormatError('The ZIP central directory is damaged.');
    const flags = dv.getUint16(p + 8, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    let compressedSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    let headerOffset = dv.getUint32(p + 42, true);
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    // bit 11: the name is UTF-8; older tools write their code page
    const name = ((flags & 0x800) !== 0 ? utf8 : latin).decode(nameBytes).replace(/\\/g, '/');
    // ZIP64 extra field: 64-bit sizes / offset where the 32-bit fields say 0xffffffff
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = dv.getUint16(x, true);
      const len = dv.getUint16(x + 2, true);
      if (id === 0x0001) {
        let q = x + 4;
        if (size === 0xffffffff) q += 8;
        if (compressedSize === 0xffffffff) {
          compressedSize = Number(dv.getBigUint64(q, true));
          q += 8;
        }
        if (headerOffset === 0xffffffff) headerOffset = Number(dv.getBigUint64(q, true));
      }
      x += 4 + len;
    }
    out.push({ name, method: dv.getUint16(p + 10, true), compressedSize, headerOffset, encrypted: (flags & 1) === 1 });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
