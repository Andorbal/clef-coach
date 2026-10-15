/**
 * Web MIDI output: the band can play through a MIDI device — a digital piano's sounds,
 * a sound module, a hardware synth, or a DAW on the same computer — instead of the app's
 * own sounds. Chrome, Edge, Opera and Firefox; not Safari (iPad, iPhone).
 */

export interface MidiOutputInfo {
  id: string;
  name: string;
}

let access: MIDIAccess | null = null;
let asking: Promise<MIDIAccess | null> | null = null;
const listeners = new Set<() => void>();
/** The outputs as last seen (a stable array for React's useSyncExternalStore). */
let snapshot: MidiOutputInfo[] = [];

function refresh(): void {
  snapshot = access ? [...access.outputs.values()].filter(o => o.state !== 'disconnected').map(o => ({ id: o.id, name: o.name || o.manufacturer || 'MIDI device' })) : [];
  listeners.forEach(cb => cb());
}

export function midiOutSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/** Ask for MIDI access (the browser may prompt). Resolves to the outputs, empty when refused. */
export async function enableMidiOut(): Promise<MidiOutputInfo[]> {
  if (!midiOutSupported()) return [];
  asking ??= navigator
    .requestMIDIAccess({ sysex: false })
    .then(a => {
      access = a;
      a.addEventListener('statechange', refresh);
      refresh();
      return a;
    })
    .catch(() => {
      asking = null;
      return null;
    });
  await asking;
  return midiOutputs();
}

export function midiOutputs(): MidiOutputInfo[] {
  return snapshot;
}

/** MIDI access has been granted (so outputs can be listed). */
export function midiOutEnabled(): boolean {
  return access !== null;
}

export function onMidiOutputsChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** An output by id (access must have been granted). */
export function midiOutput(id: string): MIDIOutput | null {
  return access?.outputs.get(id) ?? null;
}
