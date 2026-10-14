/**
 * Importing many song files at once: a multiple choice in the file picker, a folder,
 * files dropped on the page, or a .zip archive of songs. Pure helpers, no UI.
 */
import type { SongDef } from '../music/parse';
import { fileKind } from './importers';
import { isZip, listZip, readZipEntry } from './zip';

export interface BulkFile {
  /** File name with any folders it came from ("Bach/Minuet.mxl"). */
  path: string;
  bytes: Uint8Array;
}

/** Just the file name of a path. */
export const baseName = (path: string) => path.replace(/^.*[\\/]/, '');

/** Hidden and system files that come along with folders and archives (macOS resource forks, .DS_Store…). */
export function isJunk(path: string): boolean {
  return path.split(/[\\/]/).some(part => part.startsWith('.') || part === '__MACOSX' || part === 'Thumbs.db' || part === 'desktop.ini');
}

/** A ZIP archive of songs – not a compressed MusicXML score (.mxl) or a Guitar Pro 7 file (.gp), which are ZIPs too. */
export function isSongArchive(path: string, bytes: Uint8Array): boolean {
  if (!isZip(bytes) || /\.(mxl|gp)$/i.test(path)) return false;
  try {
    return !listZip(bytes).some(e => e.name === 'META-INF/container.xml' || e.name === 'Content/score.gpif');
  } catch {
    return false;
  }
}

/**
 * Is this file worth importing? Text files often come along with songs (a readme, the
 * lyrics): a .txt counts only when it holds a song file or a few lines of tab.
 */
function isSongFile(path: string, bytes: Uint8Array): boolean {
  const kind = fileKind(path);
  if (kind !== 'tab') return !!kind;
  const text = new TextDecoder().decode(bytes.subarray(0, 200_000));
  if (/^\s*\{/.test(text)) return true;
  let run = 0;
  for (const line of text.split(/\r\n?|\n/)) {
    run = /-{3,}/.test(line) && /[|\d]/.test(line) ? run + 1 : 0;
    if (run >= 3) return true;
  }
  return false;
}

/**
 * Unpack song archives (.zip) into the song files inside them, and drop what isn't a
 * song file (with its name in `skipped`). Archives inside archives aren't opened.
 */
export async function expandArchives(files: BulkFile[]): Promise<{ files: BulkFile[]; skipped: string[] }> {
  const out: BulkFile[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (isJunk(f.path)) continue;
    if (isSongArchive(f.path, f.bytes)) {
      try {
        for (const e of listZip(f.bytes)) {
          if (e.name.endsWith('/') || isJunk(e.name)) continue;
          if (!fileKind(e.name)) {
            skipped.push(`${baseName(f.path)}: ${e.name}`);
            continue;
          }
          const bytes = await readZipEntry(f.bytes, e);
          if (isSongFile(e.name, bytes)) out.push({ path: `${f.path.replace(/\.zip$/i, '')}/${e.name}`, bytes });
          else skipped.push(`${baseName(f.path)}: ${e.name}`);
        }
      } catch {
        skipped.push(f.path);
      }
      continue;
    }
    if (isSongFile(f.path, f.bytes)) out.push(f);
    else skipped.push(f.path);
  }
  return { files: out, skipped };
}

/**
 * A tag the files suggest: the folder they were all picked from ("Christmas carols"),
 * or the archive they came in. Null when there's no single one.
 */
export function folderTag(paths: string[]): string | null {
  const dirs = paths.map(p => p.split(/[\\/]/).slice(0, -1));
  if (!dirs.length || dirs.some(d => !d.length)) return null;
  // the deepest folder every file shares
  let shared = dirs[0];
  for (const d of dirs) {
    let k = 0;
    while (k < shared.length && k < d.length && shared[k] === d[k]) k++;
    shared = shared.slice(0, k);
  }
  const name = shared[shared.length - 1]?.replace(/\.zip$/i, '').replace(/[_]+/g, ' ').trim();
  return name || null;
}

const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** A song already on the device with the same title, composer and instrument, if any. */
export function findDuplicate(song: Pick<SongDef, 'title' | 'composer' | 'instrument'>, existing: Iterable<SongDef>): SongDef | undefined {
  const t = norm(song.title);
  const c = norm(song.composer);
  for (const s of existing) if (norm(s.title) === t && norm(s.composer) === c && s.instrument === song.instrument) return s;
  return undefined;
}
