/**
 * Per-frame analysis shared by the microphone input and the offline tests –
 * PURE + DOM-free. Given the most recent block of input samples it produces
 * the level, high-frequency level and YIN pitch for the NoteTracker, plus a
 * lazily computed magnitude spectrum for spectral checks.
 */
import { computeSpectrum, hasPitchSupport } from './spectrum';
import { detectPitch, rms } from './yin';
import type { PitchResult } from './yin';
import type { PitchFrame } from './tracker';

export interface FrameAnalyzerOptions {
  /** Samples fed to YIN (default 4096). */
  pitchWindow?: number;
  /** Samples for the short level / onset measures (default 1024). */
  levelWindow?: number;
  minFreq?: number;
  maxFreq?: number;
}

export interface AnalyzedFrame extends PitchFrame {
  pitch: PitchResult | null;
}

export class FrameAnalyzer {
  readonly pitchWindow: number;
  readonly levelWindow: number;
  private readonly minFreq: number;
  private readonly maxFreq: number;
  private buf: Float32Array = new Float32Array(0);
  private sampleRate = 48000;
  private readonly spec: Float32Array;
  private specValid = false;

  constructor(opts: FrameAnalyzerOptions = {}) {
    this.pitchWindow = opts.pitchWindow ?? 4096;
    this.levelWindow = opts.levelWindow ?? 1024;
    this.minFreq = opts.minFreq ?? 50;
    this.maxFreq = opts.maxFreq ?? 2500;
    this.spec = new Float32Array(this.pitchWindow); // fft = 2 × window → window bins
  }

  /** Time-domain samples of the current frame's pitch window. */
  get pitchBuffer(): Float32Array {
    return this.buf.subarray(Math.max(0, this.buf.length - this.pitchWindow));
  }

  /**
   * Analyse the newest samples of `buf` (must hold ≥ pitchWindow samples).
   * YIN is skipped (pitch = null) when the level is below `pitchGate` and
   * `force` is false – silence costs almost nothing.
   */
  analyze(buf: Float32Array, sampleRate: number, time: number, pitchGate = 0, force = false): AnalyzedFrame {
    this.buf = buf;
    this.sampleRate = sampleRate;
    this.specValid = false;
    const n = buf.length;
    const lw = Math.min(this.levelWindow, n - 1);
    const level = rms(buf, n - lw, n);
    // HF level: RMS of the first difference (≈ +6 dB/oct emphasis)
    let s = 0;
    for (let i = n - lw; i < n; i++) {
      const d = buf[i] - buf[i - 1];
      s += d * d;
    }
    const hf = Math.sqrt(s / lw);
    const pitch =
      force || level > pitchGate
        ? detectPitch(this.pitchBuffer, sampleRate, { minFreq: this.minFreq, maxFreq: this.maxFreq })
        : null;
    return {
      time,
      freq: pitch ? pitch.freq : null,
      clarity: pitch ? pitch.clarity : 0,
      rms: Number.isFinite(level) ? level : 0,
      hf: Number.isFinite(hf) ? hf : 0,
      pitch,
    };
  }

  /** Magnitude spectrum of the pitch window (zero-padded ×2), computed on demand. */
  spectrum(): Float32Array {
    if (!this.specValid) {
      computeSpectrum(this.pitchBuffer, { fftSize: this.pitchWindow * 2, out: this.spec });
      this.specValid = true;
    }
    return this.spec;
  }

  /** FFT size of {@link spectrum}. */
  get fftSize(): number {
    return this.pitchWindow * 2;
  }

  /** Does the current frame's spectrum support `midi` (fundamental/octave peak present)? */
  hasSupport = (midi: number): boolean =>
    hasPitchSupport(this.spectrum(), this.sampleRate, this.fftSize, midi);
}
