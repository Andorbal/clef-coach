// Placeholder until the MusicXML importer lands (replaced on merge).
import type { InstrumentId } from '../music/instruments';
import type { SongDef } from '../music/parse';
export interface ImportResult { song: SongDef; warnings: string[]; parts: { id: string; name: string; staves: number }[] }
export function importMusicXml(_xml: string, _opts?: { instrument?: InstrumentId; partIds?: string[] }): ImportResult {
  throw new Error('MusicXML import is not available yet.');
}
export async function importMxl(_bytes: Uint8Array, _opts?: { instrument?: InstrumentId; partIds?: string[] }): Promise<ImportResult> {
  throw new Error('MusicXML import is not available yet.');
}
