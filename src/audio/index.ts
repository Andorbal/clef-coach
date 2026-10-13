/**
 * Clef Coach audio subsystem – public API.
 *
 *  Output:  getAudioContext / unlockAudio / setMasterVolume, `synth`
 *           (piano & guitar), `Metronome`, `sfx`.
 *  Input:   `inputManager` (single subscription point for MIDI, mic, touch,
 *           computer keyboard), `micInput` (level meter, tuner, sensitivity),
 *           Web MIDI helpers, keyboardToMidi.
 *  DSP:     pure pitch-detection / chord-verification helpers (unit-testable).
 *
 * iOS: call `unlockAudio()` (or `inputManager.enableMic()`) from a user
 * gesture before expecting sound; Safari has no Web MIDI.
 */

// Context, master chain, self-sound tracking, clock mapping
export {
  getAudioContext,
  unlockAudio,
  isAudioSupported,
  isAudioUnlocked,
  onAudioStateChange,
  setMasterVolume,
  getMasterVolume,
  getBus,
  markAppSound,
  updateAppSoundMark,
  appSoundActive,
  appSoundBlocksNote,
  ctxTimeToPerfNow,
  perfNowToCtxTime,
  APP_SOUND_TAIL,
} from './context';
export type { BusName, AppSoundKind, AppSoundMark, AppSoundOptions } from './context';

// Instruments
export {
  synth,
  renderPianoSamples,
  renderGuitarSamples,
  PIANO_LOWEST,
  PIANO_HIGHEST,
  GUITAR_LOWEST,
  GUITAR_HIGHEST,
} from './synth';
export type { SynthVoice, PlayOptions, SequenceEvent, SequenceHandle } from './synth';

// Metronome
export { Metronome } from './metronome';
export type { BeatInfo, MetronomeStartOptions } from './metronome';

// UI sounds
export { sfx, setSfxEnabled, isSfxEnabled, setSfxVolume, getSfxVolume } from './sfx';
export type { SfxName } from './sfx';

// Input
export type { InputSource, NoteInputEvent, MidiDeviceInfo, InputResult } from './input/types';
export { inputManager } from './input/manager';
export type { InputStatus } from './input/manager';
export { keyboardToMidi, keyboardOctaveDelta, KEYBOARD_NOTE_CODES } from './input/keyboard';
export { micInput, MicInput } from './input/mic';
export type { TunerReading } from './input/mic';
export {
  isMidiSupported,
  isMidiEnabled,
  enableMidi,
  getMidiDevices,
  setMidiDevice,
  getMidiDevice,
  getSustain,
  onMidiDevicesChanged,
  onSustainChange,
  parseMidiMessage,
} from './input/midi';

// Pure DSP
export {
  detectPitch,
  rms,
  computeSpectrum,
  noteSalience,
  harmonicPeak,
  verifyChord,
  NoteTracker,
} from './input/pitch';
export type {
  PitchResult,
  DetectPitchOptions,
  VerifyChordOptions,
  VerifyChordResult,
  PitchFrame,
  TrackerEvent,
  NoteTrackerOptions,
} from './input/pitch';
