// Placeholder until the MIDI importer lands (replaced on merge).
import type { InstrumentId } from '../music/instruments';
import type { ImportResult } from './musicxml';
export function importMidi(_bytes: Uint8Array, _opts?: { instrument?: InstrumentId; tracks?: number[]; quantize?: 's' | 'e' | 't3' }): ImportResult {
  throw new Error('MIDI import is not available yet.');
}
