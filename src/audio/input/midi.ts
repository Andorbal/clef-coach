/**
 * Web MIDI input.
 *
 * Browser support: Chrome/Edge/Opera (desktop + Android) and Firefox (with a
 * site-permission prompt). Safari – including every browser on iPadOS/iOS –
 * does NOT implement Web MIDI, so everything here feature-detects and
 * degrades gracefully. iOS apps that inject navigator.requestMIDIAccess
 * (e.g. "Web MIDI Browser") work transparently.
 *
 *  • note-on with velocity 0 is treated as note-off
 *  • sustain pedal (CC64) is exposed as state; physical note-offs are still
 *    emitted (the app judges key presses, not sound)
 *  • hot-plugging via statechange; held notes of an unplugged / deselected
 *    device are released so nothing gets stuck
 *  • times come from MIDIMessageEvent.timeStamp (performance.now() timeline)
 */
import type { InputResult, MidiDeviceInfo, NoteInputEvent } from './types';

export type { MidiDeviceInfo } from './types';

export type MidiMessage =
  | { kind: 'on'; channel: number; note: number; velocity: number }
  | { kind: 'off'; channel: number; note: number; velocity: number }
  | { kind: 'sustain'; channel: number; down: boolean }
  | { kind: 'allOff'; channel: number }
  | { kind: 'other' };

/** Parse one MIDI message (pure – exported for tests). Velocity is 0..1. */
export function parseMidiMessage(data: ArrayLike<number>): MidiMessage {
  if (!data || data.length < 1) return { kind: 'other' };
  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;
  const d1 = (data[1] ?? 0) & 0x7f;
  const d2 = (data[2] ?? 0) & 0x7f;
  switch (status) {
    case 0x90:
      if (data.length < 3) return { kind: 'other' };
      return d2 === 0
        ? { kind: 'off', channel, note: d1, velocity: 0 }
        : { kind: 'on', channel, note: d1, velocity: d2 / 127 };
    case 0x80:
      if (data.length < 3) return { kind: 'other' };
      return { kind: 'off', channel, note: d1, velocity: d2 / 127 };
    case 0xb0:
      if (data.length < 3) return { kind: 'other' };
      if (d1 === 64) return { kind: 'sustain', channel, down: d2 >= 64 };
      if (d1 === 120 || d1 === 123) return { kind: 'allOff', channel };
      return { kind: 'other' };
    default:
      return { kind: 'other' };
  }
}

let access: MIDIAccess | null = null;
let enabling: Promise<InputResult> | null = null;
let selected = 'all';
let sustain = false;
const noteListeners = new Set<(e: NoteInputEvent) => void>();
const deviceListeners = new Set<(devices: MidiDeviceInfo[]) => void>();
const sustainListeners = new Set<(down: boolean) => void>();
/** Held notes per input id (so unplugging releases them). */
const held = new Map<string, Set<number>>();
const bound = new Map<string, MIDIInput>();

/** Does this browser expose Web MIDI? (false on Safari / iPadOS) */
export function isMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export function isMidiEnabled(): boolean {
  return access !== null;
}

function describeError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return 'MIDI access was blocked. Allow MIDI devices for this site in your browser settings and try again.';
  }
  if (name === 'NotSupportedError') return 'Web MIDI is not available in this browser.';
  if (name === 'AbortError') return 'The MIDI system is busy or unavailable. Try reconnecting your device.';
  const msg = (err as { message?: string } | null)?.message;
  return msg ? `Could not start MIDI: ${msg}` : 'Could not start MIDI.';
}

/** Ask for MIDI access (no sysex) and start listening. Call from a user gesture. */
export function enableMidi(): Promise<InputResult> {
  if (access) return Promise.resolve({ ok: true });
  if (!isMidiSupported()) {
    return Promise.resolve({
      ok: false,
      error:
        'This browser does not support MIDI keyboards (Safari and all iPad/iPhone browsers lack Web MIDI). ' +
        'Use Chrome or Edge on a computer, or play with the microphone.',
    });
  }
  if (enabling) return enabling;
  enabling = (async (): Promise<InputResult> => {
    try {
      const a = await navigator.requestMIDIAccess({ sysex: false });
      access = a;
      a.onstatechange = () => {
        bindInputs();
        notifyDevices();
      };
      bindInputs();
      notifyDevices();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    } finally {
      enabling = null;
    }
  })();
  return enabling;
}

function forEachInput(cb: (input: MIDIInput) => void): void {
  if (!access) return;
  // MIDIInputMap is maplike; forEach is the most widely supported iteration
  // (also on injected/polyfilled implementations).
  access.inputs.forEach((input) => cb(input));
}

/** Connected MIDI input devices. */
export function getMidiDevices(): MidiDeviceInfo[] {
  const out: MidiDeviceInfo[] = [];
  forEachInput((i) => {
    if (i.state === 'disconnected') return;
    out.push({ id: i.id, name: i.name || 'MIDI device', manufacturer: i.manufacturer || '' });
  });
  return out;
}

/** Listen to one device, or 'all' (default). */
export function setMidiDevice(id: string | 'all'): void {
  selected = id || 'all';
  bindInputs();
  notifyDevices();
}

export function getMidiDevice(): string {
  return selected;
}

/** Sustain pedal currently down (any device/channel)? */
export function getSustain(): boolean {
  return sustain;
}

export function onMidiDevicesChanged(cb: (devices: MidiDeviceInfo[]) => void): () => void {
  deviceListeners.add(cb);
  return () => deviceListeners.delete(cb);
}

export function onSustainChange(cb: (down: boolean) => void): () => void {
  sustainListeners.add(cb);
  return () => sustainListeners.delete(cb);
}

/** Note events from MIDI (the input manager subscribes; UI should use the manager). */
export function onMidiNote(cb: (e: NoteInputEvent) => void): () => void {
  noteListeners.add(cb);
  return () => noteListeners.delete(cb);
}

function notifyDevices(): void {
  const list = getMidiDevices();
  for (const cb of deviceListeners) {
    try {
      cb(list);
    } catch (err) {
      console.error(err);
    }
  }
}

function emitNote(e: NoteInputEvent): void {
  for (const cb of noteListeners) {
    try {
      cb(e);
    } catch (err) {
      console.error(err);
    }
  }
}

function setSustain(down: boolean): void {
  if (down === sustain) return;
  sustain = down;
  for (const cb of sustainListeners) {
    try {
      cb(down);
    } catch (err) {
      console.error(err);
    }
  }
}

function releaseHeld(inputId: string): void {
  const notes = held.get(inputId);
  if (!notes || notes.size === 0) return;
  const time = performance.now();
  for (const n of notes) emitNote({ type: 'off', midi: n, velocity: 0, time, source: 'midi' });
  notes.clear();
}

/** Event timestamps are on the performance.now() timeline; guard against bogus values. */
function eventTime(ev: Event): number {
  const now = performance.now();
  const t = ev.timeStamp;
  return Number.isFinite(t) && t > 0 && Math.abs(now - t) < 1000 ? t : now;
}

function handleMessage(input: MIDIInput, ev: MIDIMessageEvent): void {
  if (!ev.data) return;
  const msg = parseMidiMessage(ev.data);
  if (msg.kind === 'other') return;
  const time = eventTime(ev);
  let notes = held.get(input.id);
  if (!notes) {
    notes = new Set();
    held.set(input.id, notes);
  }
  switch (msg.kind) {
    case 'on':
      notes.add(msg.note);
      emitNote({ type: 'on', midi: msg.note, velocity: msg.velocity, time, source: 'midi' });
      break;
    case 'off':
      notes.delete(msg.note);
      emitNote({ type: 'off', midi: msg.note, velocity: msg.velocity, time, source: 'midi' });
      break;
    case 'sustain':
      setSustain(msg.down);
      break;
    case 'allOff':
      releaseHeld(input.id);
      setSustain(false);
      break;
  }
}

/** (Re)attach handlers to the inputs we should listen to. */
function bindInputs(): void {
  if (!access) return;
  const seen = new Set<string>();
  forEachInput((input) => {
    seen.add(input.id);
    const want = input.state !== 'disconnected' && (selected === 'all' || selected === input.id);
    const isBound = bound.get(input.id) === input;
    if (want && !isBound) {
      // Assigning onmidimessage implicitly opens the port.
      input.onmidimessage = (ev: MIDIMessageEvent) => handleMessage(input, ev);
      bound.set(input.id, input);
    } else if (!want && isBound) {
      input.onmidimessage = null;
      bound.delete(input.id);
      releaseHeld(input.id);
    }
  });
  // Inputs that vanished entirely.
  for (const [id, input] of bound) {
    if (!seen.has(id)) {
      input.onmidimessage = null;
      bound.delete(id);
      releaseHeld(id);
    }
  }
  if (bound.size === 0) setSustain(false);
}
