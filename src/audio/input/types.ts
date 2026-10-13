/** Where a note event came from. */
export type InputSource = 'midi' | 'mic' | 'touch' | 'keyboard';

/** One note press/release, from any input source. */
export interface NoteInputEvent {
  type: 'on' | 'off';
  midi: number;
  /** 0..1 */
  velocity: number;
  /** performance.now() ms of the physical event, latency-compensated where possible. */
  time: number;
  source: InputSource;
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface InputResult {
  ok: boolean;
  error?: string;
}
