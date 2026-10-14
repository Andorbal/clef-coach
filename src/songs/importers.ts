/**
 * One entry point for every kind of song file the app can import:
 *  - Clef Coach song files (.json / .clefsong.json)
 *  - MusicXML (.musicxml, .xml, compressed .mxl) – what notation apps and
 *    sheet-music scanners (MuseScore, Finale, Sibelius, Dorico, Audiveris, PlayScore…) export
 *  - Standard MIDI files (.mid, .midi)
 *  - Guitar Pro files (.gp3, .gp4, .gp5, .gpx, .gp) – tab with its rhythm
 *  - text tab (.txt, .tab) – the tab people post online
 */
import type { InstrumentId } from '../music/instruments';
import type { SongDef } from '../music/parse';
import { type ParsedSong, SongFormatError, parseSongDoc } from './format';
import { isZip, listZip } from './zip';

export interface ImportOutcome {
  song: SongDef;
  warnings: string[];
  /** Parts / tracks found in the file, for files that have a choice. */
  parts?: { id: string; name: string; staves: number }[];
  kind: ImportKind;
}

export type ImportKind = 'clefsong' | 'musicxml' | 'midi' | 'guitarpro' | 'tab';

/** How each kind of file is named to the player. */
export const KIND_LABELS: Record<ImportKind, string> = { clefsong: 'Clef Coach song', musicxml: 'MusicXML', midi: 'MIDI', guitarpro: 'Guitar Pro', tab: 'Text tab' };

export interface ImportOptions {
  instrument?: InstrumentId;
  /** MusicXML part ids / MIDI and Guitar Pro track indexes (as strings) to import */
  parts?: string[];
  /** Text tab: the time signature its rhythm is read in (the tab doesn't say). */
  time?: [number, number];
}

/**
 * `accept` for the song file picker. Not for iOS/iPadOS: their picker filters by the
 * file types the system knows, and it knows nothing of .mxl, .musicxml or .clefsong,
 * so listing them greys those very files out. There the picker offers every file and
 * {@link importBytes} tells them apart by name and content.
 */
export const IMPORT_ACCEPT =
  '.json,.clefsong,.musicxml,.xml,.mxl,.mid,.midi,.gp,.gp3,.gp4,.gp5,.gpx,.txt,.tab,application/json,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,audio/midi,audio/x-midi,text/plain';

export function isGuitarProName(name: string): boolean {
  return /\.(gp|gp3|gp4|gp5|gpx)$/i.test(name);
}

/** Does this look like a Guitar Pro file, whatever its name? */
export function sniffGuitarPro(bytes: Uint8Array): boolean {
  const ascii = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
  if (ascii(1, 18) === 'FICHIER GUITAR PRO' || ascii(1, 18) === 'FICHIER GUITARE PR') return true; // GP3–GP5
  if (ascii(0, 4) === 'BCFZ' || ascii(0, 4) === 'BCFS') return true; // GP6 (.gpx)
  if (isZip(bytes)) {
    try {
      return listZip(bytes).some(e => e.name === 'Content/score.gpif'); // GP7 and later (.gp)
    } catch {
      return false;
    }
  }
  return false;
}

export function fileKind(name: string): ImportKind | null {
  const n = name.toLowerCase();
  if (n.endsWith('.mid') || n.endsWith('.midi')) return 'midi';
  if (n.endsWith('.mxl') || n.endsWith('.musicxml') || n.endsWith('.xml')) return 'musicxml';
  if (n.endsWith('.json') || n.endsWith('.clefsong')) return 'clefsong';
  if (isGuitarProName(n)) return 'guitarpro';
  if (n.endsWith('.tab') || n.endsWith('.txt')) return 'tab';
  return null;
}

/** What a file holds, judged by its first bytes (for names without a known extension). */
export function sniffKind(bytes: Uint8Array): ImportKind | null {
  if (bytes[0] === 0x4d && bytes[1] === 0x54) return 'midi'; // "MThd"
  if (sniffGuitarPro(bytes)) return 'guitarpro';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'musicxml'; // zip: compressed .mxl
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return 'musicxml'; // UTF-16 XML
  let i = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0; // UTF-8 BOM
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  if (bytes[i] === 0x3c) return 'musicxml'; // "<"
  if (bytes[i] === 0x7b) return 'clefsong'; // "{"
  return null;
}

/** Validate a song after conversion so every importer hands back something that loads. */
function checked(song: SongDef, warnings: string[]): ParsedSong {
  const parsed = parseSongDoc(song, { id: song.id });
  return { ...parsed, warnings: [...warnings, ...parsed.warnings] };
}

export async function importBytes(name: string, bytes: Uint8Array, opts: ImportOptions = {}): Promise<ImportOutcome> {
  const kind = fileKind(name) ?? sniffKind(bytes);
  if (!kind) {
    const shown = name.replace(/^.*[\\/]/, '');
    throw new SongFormatError([
      `“${shown}” isn’t a song file Clef Coach can read. Choose a MusicXML (.musicxml, .mxl, .xml), MIDI (.mid), Guitar Pro (.gp, .gp5…), text tab (.txt) or Clef Coach song (.json) file. For a PDF or a photo of sheet music or tab, use “Scan sheet music”.`,
    ]);
  }
  if (kind === 'clefsong') {
    const text = new TextDecoder().decode(bytes);
    const { song, warnings } = parseSongDoc(text);
    return { song, warnings, kind };
  }
  const title = name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || undefined;
  if (kind === 'musicxml') {
    const mx = await import('./musicxml');
    // importMxl reads zipped .mxl as well as plain (UTF-8 or UTF-16) MusicXML
    const res = await mx.importMxl(bytes, { instrument: opts.instrument, partIds: opts.parts, title });
    const { song, warnings } = checked(res.song, res.warnings);
    return { song, warnings, parts: res.parts, kind };
  }
  if (kind === 'guitarpro') {
    const gp = await import('./guitarpro');
    const res = await gp.importGuitarPro(bytes, { instrument: opts.instrument, partIds: opts.parts, title });
    const { song, warnings } = checked(res.song, res.warnings);
    return { song, warnings, parts: res.parts, kind };
  }
  if (kind === 'tab') {
    const text = new TextDecoder().decode(bytes);
    // a song file saved as .txt is still a song file
    if (/^\s*\{/.test(text)) {
      const { song, warnings } = parseSongDoc(text);
      return { song, warnings, kind: 'clefsong' };
    }
    return importTabText(text, { ...opts, title });
  }
  const md = await import('./midi');
  const res = md.importMidi(bytes, { instrument: opts.instrument, tracks: opts.parts?.map(Number), title });
  const { song, warnings } = checked(res.song, res.warnings);
  return { song, warnings, parts: res.parts, kind };
}

/** Text tab (pasted, or from a .txt / .tab file) → a song. */
export async function importTabText(text: string, opts: ImportOptions & { title?: string } = {}): Promise<ImportOutcome> {
  const tab = await import('./tabtext');
  const res = tab.importTextTab(text, { instrument: opts.instrument, time: opts.time, title: opts.title, parts: opts.parts });
  const { song, warnings } = checked(res.song, res.warnings);
  return { song, warnings, parts: res.parts, kind: 'tab' };
}

export { SongFormatError };
