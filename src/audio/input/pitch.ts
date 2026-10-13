/**
 * Pure, DOM-free pitch/DSP toolkit used by the microphone input (and tests).
 *
 *  - detectPitch / rms           → ./yin
 *  - computeSpectrum, noteSalience, harmonicPeak, verifyChord → ./spectrum
 *  - NoteTracker                 → ./tracker
 *  - FrameAnalyzer (per-frame level/HF/pitch/spectrum, shared by mic + tests) → ./analyzer
 */
export { detectPitch, rms } from './yin';
export type { PitchResult, DetectPitchOptions } from './yin';
export { computeSpectrum, noteSalience, harmonicPeak, verifyChord, hasPitchSupport } from './spectrum';
export type {
  SpectrumOptions,
  WindowType,
  SalienceOptions,
  VerifyChordOptions,
  VerifyChordResult,
  PitchSupportOptions,
} from './spectrum';
export { FrameAnalyzer } from './analyzer';
export type { FrameAnalyzerOptions, AnalyzedFrame } from './analyzer';
export { NoteTracker, velocityFromRms } from './tracker';
export { ExpectedNoteAssist, AssistRouter, buildAssistFrame, notePartials, subFundamentals } from './assist';
export type { AssistFrame, ExpectedNoteAssistOptions } from './assist';
export type { PitchFrame, TrackerEvent, TrackerControl, NoteTrackerOptions } from './tracker';
