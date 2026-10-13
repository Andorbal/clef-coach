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

export const IMPORT_ACCEPT = '.json,.clefsong,.musicxml,.xml,.mxl,.mid,.midi,application/json,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,audio/midi,audio/x-midi';

export function fileKind(name: string): ImportOutcome['kind'] | null {
  const n = name.toLowerCase();
  if (n.endsWith('.mid') || n.endsWith('.midi')) return 'midi';
  if (n.endsWith('.mxl') || n.endsWith('.musicxml') || n.endsWith('.xml')) return 'musicxml';
  if (n.endsWith('.json') || n.endsWith('.clefsong')) return 'clefsong';
  return null;
}

/** Validate a song after conversion so every importer hands back something that loads. */
function checked(song: SongDef, warnings: string[]): ParsedSong {
  const parsed = parseSongDoc(song, { id: song.id });
  return { ...parsed, warnings: [...warnings, ...parsed.warnings] };
}

export async function importBytes(name: string, bytes: Uint8Array, opts: ImportOptions = {}): Promise<ImportOutcome> {
  const kind = fileKind(name) ?? (bytes[0] === 0x4d && bytes[1] === 0x54 ? 'midi' : bytes[0] === 0x50 && bytes[1] === 0x4b ? 'musicxml' : 'clefsong');
  if (kind === 'clefsong') {
    const text = new TextDecoder().decode(bytes);
    const { song, warnings } = parseSongDoc(text);
    return { song, warnings, kind };
  }
  if (kind === 'musicxml') {
    const mx = await import('./musicxml');
    const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const res = zipped ? await mx.importMxl(bytes, { instrument: opts.instrument, partIds: opts.parts }) : mx.importMusicXml(new TextDecoder().decode(bytes), { instrument: opts.instrument, partIds: opts.parts });
    const { song, warnings } = checked(res.song, res.warnings);
    return { song, warnings, parts: res.parts, kind };
  }
  const md = await import('./midi');
  const res = md.importMidi(bytes, { instrument: opts.instrument, tracks: opts.parts?.map(Number) });
  const { song, warnings } = checked(res.song, res.warnings);
  return { song, warnings, parts: res.parts, kind };
}

export { SongFormatError };
