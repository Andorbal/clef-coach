/**
 * Computer-keyboard → MIDI mapping (DAW style). Pure helpers only – no global
 * listeners are attached here; the UI decides when keys count as notes.
 *
 *   W E   T Y U   O P
 *  A S D F G H J K L ;      A = C4 … ; = E5     Z / X = octave down / up
 */
const KEY_OFFSETS = new Map<string, number>([
  ['KeyA', 0], // C
  ['KeyW', 1], // C#
  ['KeyS', 2], // D
  ['KeyE', 3], // D#
  ['KeyD', 4], // E
  ['KeyF', 5], // F
  ['KeyT', 6], // F#
  ['KeyG', 7], // G
  ['KeyY', 8], // G#
  ['KeyH', 9], // A
  ['KeyU', 10], // A#
  ['KeyJ', 11], // B
  ['KeyK', 12], // C5
  ['KeyO', 13], // C#5
  ['KeyL', 14], // D5
  ['KeyP', 15], // D#5
  ['Semicolon', 16], // E5
]);

/** KeyboardEvent.code → MIDI note (KeyA = C4 + 12·octaveShift), or null. */
export function keyboardToMidi(code: string, octaveShift = 0): number | null {
  const off = KEY_OFFSETS.get(code);
  if (off === undefined) return null;
  const m = 60 + off + 12 * Math.round(octaveShift || 0);
  return m >= 0 && m <= 127 ? m : null;
}

/** Octave-shift keys: KeyZ → −1, KeyX → +1, anything else → 0. */
export function keyboardOctaveDelta(code: string): -1 | 0 | 1 {
  return code === 'KeyZ' ? -1 : code === 'KeyX' ? 1 : 0;
}

/** All note key codes (e.g. to show hints or preventDefault). */
export const KEYBOARD_NOTE_CODES: readonly string[] = [...KEY_OFFSETS.keys()];
