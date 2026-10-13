/**
 * Synthesised instruments (no samples): piano (additive) and guitar
 * (extended Karplus–Strong). See ./piano.ts, ./guitar.ts and ./engine.ts.
 */
import { SynthEngine } from './engine';
import type { PlayOptions, SequenceEvent, SequenceHandle, SynthVoice } from './engine';

export type { PlayOptions, SequenceEvent, SequenceHandle, SynthVoice } from './engine';
export { renderPianoSamples, pianoNoteDuration, pianoNoteLength, pianoInharmonicity, PIANO_LOWEST, PIANO_HIGHEST } from './piano';
export { renderGuitarSamples, guitarNoteDuration, guitarNoteLength, GUITAR_LOWEST, GUITAR_HIGHEST } from './guitar';
export type { PluckedVariant } from './guitar';
export { renderMalletSamples, malletNoteDuration, malletNoteLength } from './mallets';
export type { MalletVoice } from './mallets';
export { voiceOffset } from './engine';

const engine = new SynthEngine();

/** The app-wide instrument player. All methods are safe to pass around unbound. */
export const synth = {
  /** Default instrument for subsequent notes. */
  setVoice(v: SynthVoice): void {
    engine.setVoice(v);
  },
  getVoice(): SynthVoice {
    return engine.getVoice();
  },
  /** Key down – sustains until noteOff (or natural decay). */
  noteOn(midi: number, opts?: PlayOptions): void {
    engine.noteOn(midi, opts);
  },
  /** Key up (damper-like ~120 ms release). */
  noteOff(midi: number, when?: number): void {
    engine.noteOff(midi, when);
  },
  /** One-shot note or chord. */
  play(midi: number | number[], opts?: PlayOptions): void {
    engine.play(midi, opts);
  },
  /** Schedule timed events (seconds from now). Returns a handle to stop it. */
  playSequence(events: SequenceEvent[], voice?: SynthVoice): SequenceHandle {
    return engine.playSequence(events, voice);
  },
  /** Quickly fade out everything and cancel sequences. */
  stopAll(): void {
    engine.stopAll();
  },
  /** Pre-render note buffers in idle slices so first notes don't glitch. */
  preload(voice: SynthVoice, midis: number[]): Promise<void> {
    return engine.preload(voice, midis);
  },
};
