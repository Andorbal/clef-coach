/**
 * One entry point for every kind of song file the app can import:
 *  - Clef Coach song files (.json / .clefsong.json)
 *  - MusicXML (.musicxml, .xml, compressed .mxl) – what notation apps and
 *    sheet-music scanners (MuseScore, Finale, Sibelius, Dorico, Audiveris, PlayScore…) export
 *  - Standard MIDI files (.mid, .midi)
 */
import type { InstrumentId } from '../music/instruments';
import type { SongDef } from '../music/parse';
import { type ParsedSong, SongFormatError, parseSongDoc } from './format';

export interface ImportOutcome {
  song: SongDef;
  warnings: string[];
  /** Parts / tracks found in the file, for files that have a choice. */
  parts?: { id: string; name: string; staves: number }[];
  kind: 'clefsong' | 'musicxml' | 'midi';
}

export interface ImportOptions {
  instrument?: InstrumentId;
  /** MusicXML part ids / MIDI track indexes (as strings) to import */
  parts?: string[];
}

/**
 * `accept` for the song file picker. Not for iOS/iPadOS: their picker filters by the
 * file types the system knows, and it knows nothing of .mxl, .musicxml or .clefsong,
 * so listing them greys those very files out. There the picker offers every file and
 * {@link importBytes} tells them apart by name and content.
 */
export const IMPORT_ACCEPT = '.json,.clefsong,.musicxml,.xml,.mxl,.mid,.midi,application/json,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,audio/midi,audio/x-midi';

export function fileKind(name: string): ImportOutcome['kind'] | null {
  const n = name.toLowerCase();
  if (n.endsWith('.mid') || n.endsWith('.midi')) return 'midi';
  if (n.endsWith('.mxl') || n.endsWith('.musicxml') || n.endsWith('.xml')) return 'musicxml';
  if (n.endsWith('.json') || n.endsWith('.clefsong')) return 'clefsong';
  return null;
}

/** What a file holds, judged by its first bytes (for names without a known extension). */
export function sniffKind(bytes: Uint8Array): ImportOutcome['kind'] | null {
  if (bytes[0] === 0x4d && bytes[1] === 0x54) return 'midi'; // "MThd"
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
      `“${shown}” isn’t a song file Clef Coach can read. Choose a MusicXML (.musicxml, .mxl, .xml), MIDI (.mid) or Clef Coach song (.json) file. For a PDF or a photo of sheet music, use “Scan sheet music”.`,
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
  const md = await import('./midi');
  const res = md.importMidi(bytes, { instrument: opts.instrument, tracks: opts.parts?.map(Number), title });
  const { song, warnings } = checked(res.song, res.warnings);
  return { song, warnings, parts: res.parts, kind };
}

export { SongFormatError };
