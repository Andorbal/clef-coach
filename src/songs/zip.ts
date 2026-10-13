/**
 * A minimal ZIP reader, enough for compressed MusicXML (.mxl): it reads the central
 * directory and extracts stored and deflated entries. Inflating uses the platform's
 * DecompressionStream('deflate-raw') (modern browsers and Node 22), so there are no
 * dependencies. ZIP64 archives and encrypted entries are not supported.
 */

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  size: number;
  /** Offset of the entry's local file header. */
  headerOffset: number;
  encrypted: boolean;
}

export class ZipError extends Error {}

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** Does this look like a ZIP archive ("PK\3\4")? */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** List the entries of a ZIP archive from its central directory. */
export function listZip(bytes: Uint8Array): ZipEntry[] {
  // the end-of-central-directory record sits in the last 22 + 65535 (comment) bytes
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('This is not a ZIP archive (no central directory found).');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  if (p === 0xffffffff || count === 0xffff) throw new ZipError('ZIP64 archives are not supported.');
  const decoder = new TextDecoder('utf-8');
  const out: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new ZipError('The ZIP central directory is damaged.');
    const flags = u16(bytes, p + 8);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    out.push({
      name: decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method: u16(bytes, p + 10),
      compressedSize: u32(bytes, p + 20),
      size: u32(bytes, p + 24),
      headerOffset: u32(bytes, p + 42),
      encrypted: (flags & 1) === 1,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Inflate raw DEFLATE data with the platform's DecompressionStream. */
export async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ZipError("This browser can't unpack compressed files; export the score as uncompressed MusicXML (.musicxml) instead.");
  }
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The uncompressed bytes of one entry. */
export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  if (entry.encrypted) throw new ZipError(`"${entry.name}" is encrypted.`);
  const h = entry.headerOffset;
  if (h + 30 > bytes.length || u32(bytes, h) !== 0x04034b50) throw new ZipError(`The ZIP entry "${entry.name}" is damaged.`);
  const start = h + 30 + u16(bytes, h + 26) + u16(bytes, h + 28);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data);
  throw new ZipError(`"${entry.name}" uses an unsupported compression method (${entry.method}).`);
}

/** Read a whole archive into a name → bytes map (optionally only the names that pass `filter`). */
export async function unzip(bytes: Uint8Array, filter: (name: string) => boolean = () => true): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const e of listZip(bytes)) {
    if (e.name.endsWith('/') || !filter(e.name)) continue;
    out.set(e.name, await readZipEntry(bytes, e));
  }
  return out;
}
