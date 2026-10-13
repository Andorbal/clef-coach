/**
 * inputManager – THE place the UI subscribes to note input, whatever the
 * source (MIDI keyboard, microphone, on-screen keyboard/fretboard taps,
 * computer keyboard).
 *
 *   const off = inputManager.subscribe((e) => lesson.handle(e));
 *   inputManager.emit({ type: 'on', midi: 60, velocity: 0.8, time: performance.now(), source: 'touch' });
 *
 * It also tracks held notes across sources, forwards the lesson's expected
 * notes to the mic detector, exposes a status snapshot (React-friendly:
 * `useSyncExternalStore(inputManager.onStatus, () => inputManager.status)`)
 * and optionally "echoes" notes through the synth so silent controllers and
 * on-screen keys make sound (on for touch/keyboard, off for MIDI by default
 * because digital pianos make their own sound; never for the mic).
 */
import { unlockAudio } from '../context';
import { synth } from '../synth';
import { micInput } from './mic';
import {
  enableMidi as enableMidiAccess,
  getMidiDevice,
  getMidiDevices,
  getSustain,
  isMidiEnabled,
  isMidiSupported,
  onMidiDevicesChanged,
  onMidiNote,
  onSustainChange,
  setMidiDevice,
} from './midi';
import type { InputResult, InputSource, MidiDeviceInfo, NoteInputEvent } from './types';

export { keyboardToMidi, keyboardOctaveDelta, KEYBOARD_NOTE_CODES } from './keyboard';

export interface InputStatus {
  midiSupported: boolean;
  midiEnabled: boolean;
  midiDevices: MidiDeviceInfo[];
  /** Selected MIDI device id or 'all'. */
  midiDevice: string;
  /** Sustain pedal (CC64) currently down. */
  sustain: boolean;
  micActive: boolean;
  micError?: string;
  /** Source of the most recent note event. */
  lastSource?: InputSource;
}

const SOURCES: InputSource[] = ['midi', 'mic', 'touch', 'keyboard'];

class InputManager {
  private readonly listeners = new Set<(e: NoteInputEvent) => void>();
  private readonly statusListeners = new Set<() => void>();
  private readonly heldBySource = new Map<InputSource, Set<number>>(SOURCES.map((s) => [s, new Set<number>()]));
  private readonly held = new Set<number>();
  private echoEnabled = true;
  private readonly echo: Record<InputSource, boolean> = { midi: false, mic: false, touch: true, keyboard: true };
  /** MIDI echo notes released while the pedal was down. */
  private readonly sustained = new Set<number>();
  /** Semitones added to microphone and MIDI notes (−12 for a xylophone: written = sounding − 12). */
  private transpose = 0;
  private _status: InputStatus;

  constructor() {
    this._status = {
      midiSupported: isMidiSupported(),
      midiEnabled: false,
      midiDevices: [],
      midiDevice: 'all',
      sustain: false,
      micActive: false,
    };
    onMidiNote((e) => this.emit(e));
    onMidiDevicesChanged(() => this.refreshStatus());
    onSustainChange((down) => {
      if (!down) this.releaseSustainedEcho();
      this.refreshStatus();
    });
    micInput.onNote((e) => this.emit(e));
    micInput.onStateChange(() => {
      if (!micInput.active) this.releaseSource('mic');
      this.refreshStatus();
    });
  }

  /** Current status snapshot (a new object whenever something changes). */
  get status(): InputStatus {
    return this._status;
  }

  /** Subscribe to note events from every source. Returns an unsubscribe function. */
  subscribe = (cb: (e: NoteInputEvent) => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  /** Status changes (devices, mic on/off, last source…). */
  onStatus = (cb: () => void): (() => void) => {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  };

  /**
   * Inject a note event – used by the on-screen keyboard/fretboard and
   * computer-keyboard handlers (and internally by MIDI/mic).
   */
  emit = (e: NoteInputEvent): void => {
    // real instruments report what they sound; lessons work in written pitch
    const shift = e.source === 'mic' || e.source === 'midi' ? this.transpose : 0;
    const midi = Math.round(e.midi) + shift;
    if (!(midi >= 0 && midi <= 127)) return;
    const ev: NoteInputEvent = {
      type: e.type === 'off' ? 'off' : 'on',
      midi,
      velocity: Math.min(1, Math.max(0, Number.isFinite(e.velocity) ? e.velocity : 0.7)),
      time: Number.isFinite(e.time) ? e.time : performance.now(),
      source: e.source,
    };
    const set = this.heldBySource.get(ev.source);
    if (set) {
      if (ev.type === 'on') set.add(midi);
      else set.delete(midi);
    }
    this.recomputeHeld();
    this.echoNote(ev);
    for (const cb of this.listeners) {
      try {
        cb(ev);
      } catch (err) {
        console.error(err);
      }
    }
    if (ev.type === 'on' && this._status.lastSource !== ev.source) this.setStatus({ lastSource: ev.source });
  };

  /** Notes currently held down, across all sources. */
  getHeld = (): ReadonlySet<number> => this.held;

  /** Notes the lesson expects next (forwarded to the mic detector, which hears sounding pitch). */
  setExpected = (midis: number[] | null): void => {
    micInput.setExpected(midis && this.transpose ? midis.map(m => m - this.transpose) : midis);
  };

  /**
   * Shift microphone and MIDI notes into written pitch. For a xylophone (sounds an
   * octave above written) pass −12; for a glockenspiel −24; otherwise 0.
   */
  setTranspose = (semitones: number): void => {
    if (semitones === this.transpose || !Number.isFinite(semitones)) return;
    this.releaseSource('mic');
    this.releaseSource('midi');
    this.transpose = Math.round(semitones);
  };

  getTranspose = (): number => this.transpose;

  /** Request Web MIDI (call from a user gesture). */
  enableMidi = async (): Promise<InputResult> => {
    const res = await enableMidiAccess();
    this.refreshStatus();
    return res;
  };

  /** Choose a MIDI input device ('all' = every connected device). */
  setMidiDevice = (id: string | 'all'): void => {
    setMidiDevice(id);
    this.refreshStatus();
  };

  /** Start the microphone (call from a user gesture – also unlocks audio on iOS). */
  enableMic = async (): Promise<InputResult> => {
    await unlockAudio();
    const res = await micInput.start();
    this.refreshStatus();
    return res;
  };

  disableMic = (): void => {
    micInput.stop();
    this.releaseSource('mic');
    this.refreshStatus();
  };

  /** Master switch for echoing notes through the synth (default true). */
  setEchoPlayback = (enabled: boolean): void => {
    this.echoEnabled = !!enabled;
    if (!this.echoEnabled) this.silenceEcho();
  };

  /** Per-source echo (defaults: touch/keyboard on, MIDI off, mic always off). */
  setEchoForSource = (source: InputSource, enabled: boolean): void => {
    if (source === 'mic') return; // never echo the microphone (feedback)
    this.echo[source] = !!enabled;
    if (!enabled) for (const m of this.heldBySource.get(source) ?? []) synth.noteOff(m);
  };

  getEchoForSource = (source: InputSource): boolean => this.echoEnabled && this.echo[source];

  // -------------------------------------------------------------------------

  private echoNote(e: NoteInputEvent): void {
    if (!this.echoEnabled || !this.echo[e.source] || e.source === 'mic') return;
    if (e.type === 'on') {
      this.sustained.delete(e.midi);
      synth.noteOn(e.midi, { velocity: e.source === 'midi' ? e.velocity : Math.max(0.35, e.velocity) });
    } else if (e.source === 'midi' && getSustain()) {
      this.sustained.add(e.midi); // pedal holds the sound; release on pedal-up
    } else if (!this.isHeldElsewhere(e.midi, e.source)) {
      synth.noteOff(e.midi);
    }
  }

  private releaseSustainedEcho(): void {
    for (const m of this.sustained) if (!this.held.has(m)) synth.noteOff(m);
    this.sustained.clear();
  }

  private silenceEcho(): void {
    for (const m of this.held) synth.noteOff(m);
    for (const m of this.sustained) synth.noteOff(m);
    this.sustained.clear();
  }

  private isHeldElsewhere(midi: number, source: InputSource): boolean {
    for (const [s, set] of this.heldBySource) if (s !== source && set.has(midi) && this.echo[s]) return true;
    return false;
  }

  private releaseSource(source: InputSource): void {
    const set = this.heldBySource.get(source);
    if (!set || set.size === 0) return;
    const time = performance.now();
    for (const m of [...set]) this.emit({ type: 'off', midi: m, velocity: 0, time, source });
  }

  private recomputeHeld(): void {
    this.held.clear();
    for (const set of this.heldBySource.values()) for (const m of set) this.held.add(m);
  }

  private refreshStatus(): void {
    this.setStatus({
      midiSupported: isMidiSupported(),
      midiEnabled: isMidiEnabled(),
      midiDevices: getMidiDevices(),
      midiDevice: getMidiDevice(),
      sustain: getSustain(),
      micActive: micInput.active,
      micError: micInput.lastError,
    });
  }

  private setStatus(patch: Partial<InputStatus>): void {
    const next = { ...this._status, ...patch };
    const changed = (Object.keys(next) as (keyof InputStatus)[]).some((k) => {
      const a = next[k];
      const b = this._status[k];
      return Array.isArray(a) && Array.isArray(b) ? JSON.stringify(a) !== JSON.stringify(b) : a !== b;
    });
    if (!changed) return;
    this._status = next;
    for (const cb of this.statusListeners) {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

/** The app-wide input hub. */
export const inputManager = new InputManager();
