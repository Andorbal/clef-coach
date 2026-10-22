/**
 * Microphone note input.
 *
 *   getUserMedia (no AEC/NS/AGC) → high-pass 40 Hz → AnalyserNode(8192) → (muted) destination
 *                                                      ↑ polled ~55×/s with setInterval
 *
 * The full analysis below only runs while something is listening for notes
 * ({@link MicInput.retain} – the input manager retains it for each note
 * subscriber). Otherwise the stream stays open (no new permission prompt or
 * audio-route change when a lesson starts) and a slow tick only measures the
 * level for the input meter, so browsing the app doesn't keep the CPU busy.
 *
 * Per frame (all the DSP lives in pure, unit-tested modules):
 *  1. FrameAnalyzer: short-window RMS + high-frequency level (onsets, meter,
 *     adaptive noise floor – calibrated during the first 0.6 s, then tracked
 *     slowly while nothing is sounding) and YIN on the newest 4096 samples;
 *  2. NoteTracker → mono note events. Before a pitch is reported it must have
 *     real spectral support (fundamental/octave peaks) and lie in the
 *     instrument's range, which removes the "virtual pitches" YIN can report
 *     while two notes overlap;
 *  3. when the lesson expects a chord (setExpected with ≥2 notes) the
 *     ChordTracker verifies the expected notes on the spectrum after each
 *     onset and emits them together once present on two consecutive frames,
 *     or reports what WAS heard after a short timeout (wrong/partial chords);
 *  4. when a single note is expected, YIN octave slips (±12) with modest
 *     clarity are corrected if the spectrum clearly supports the expected note,
 *     and the ExpectedNoteAssist (assist.ts) catches attacks of that note the
 *     mono tracker misses while other strings/notes still ring.
 *
 * Self-hearing: while the app is sounding something (see markAppSound),
 * note-ons the app could have caused are suppressed. By default this is
 * pitch-aware (only pitches related to what the app plays are blocked;
 * metronome clicks merely delay confirmation and can't fake re-attacks), so a
 * student playing over the "correct!" chime or the metronome isn't ignored.
 * setSelfSoundMode('strict') blocks every new note while any app sound plays.
 *
 * Audio interfaces (devices.ts): the player can choose the input (an iRig, a
 * Scarlett…) instead of the system default. One plugged in with a cable is
 * "direct": it can't hear the speakers, so none of the self-hearing guards
 * apply, and it can be played back to the player ("hear yourself") without
 * feedback, since an electric guitar into an interface makes no sound in
 * the room:
 *
 *   high-pass ─→ monitor gain ─→ destination   (direct inputs only, when asked)
 *
 * Whether an input is direct is decided by the device actually opened, never
 * by the choice alone: when the chosen interface is unplugged the stream falls
 * back to the default (usually the built-in mic), and playing that back would
 * howl.
 */
import {
  appClickActive,
  appSoundActive,
  appSoundBlocksNote,
  appTonalSoundActive,
  getAudioContext,
  isAudioSupported,
  setRecordingSession,
} from '../context';
import { ChordTracker } from './chord';
import { type AudioInputInfo, type InputDevicePref, audioInputs, isDirectInput, resolveInputDevice, sameDeviceLabel } from './devices';
import { AssistRouter, buildAssistFrame, computeSpectrum, FrameAnalyzer, harmonicPeak, NoteTracker, rms, verifyChord } from './pitch';
import type { PitchResult, TrackerControl, TrackerEvent } from './pitch';
import type { InputResult, NoteInputEvent } from './types';

const ANALYSER_SIZE = 8192; // time-domain history (≈170 ms @ 48 kHz)
const PITCH_WINDOW = 4096; // YIN window (≈85 ms)
const LEVEL_WINDOW = 1024; // short level/transient window for onsets (≈21 ms)
const POLL_MS = 18; // ≈55 frames/s
/** Level-meter-only polling while nothing listens for notes. */
const IDLE_POLL_MS = 80;
/**
 * Keep analysing this long after the last listener leaves: a lesson moving to
 * its next step releases and retains in one go, and a reset in between could
 * hear a note still ringing from the last step as a new one.
 */
const IDLE_AFTER_MS = 1500;
const CALIBRATE_MS = 600;
/** Chords whose lowest note is below this use the long (8192) window. */
const LONG_WINDOW_BELOW = 48;

export interface TunerReading {
  /** Smoothed frequency (Hz). */
  freq: number;
  /** Fractional MIDI number (69.0 = A4). */
  midi: number;
  /** Deviation from the nearest equal-tempered note, −50..+50. */
  cents: number;
  /** 0..1 pitch confidence. */
  clarity: number;
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function describeMicError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission was denied. Allow microphone access for this site (on iPad: Settings › Safari › Microphone, or the aA menu › Website Settings) and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is in use by another app or could not be started.';
    default: {
      const msg = (err as { message?: string } | null)?.message;
      return msg ? `Could not start the microphone: ${msg}` : 'Could not start the microphone.';
    }
  }
}

const midiOf = (freq: number) => 69 + 12 * Math.log2(freq / 440);

const errorName = (err: unknown): string => (err as { name?: string } | null)?.name ?? '';

/** No echo cancellation, noise suppression or gain control: they flatten the attacks onsets are found by. */
const RAW_AUDIO: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };

/** Is an opened input the chosen one? */
function isChosen(opened: AudioInputInfo | null, pref: InputDevicePref): boolean {
  return !!opened && (opened.id === pref.id || sameDeviceLabel(opened.label, pref.label));
}

function trackDevice(track: MediaStreamTrack | undefined): AudioInputInfo | null {
  if (!track) return null;
  return { id: track.getSettings?.().deviceId ?? '', label: track.label ?? '' };
}

export class MicInput {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sink: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** True while {@link timer} runs the full note analysis (not the idle level meter). */
  private fullRate = false;
  /** Number of {@link retain} holders. */
  private demand = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLevelAt = 0;
  private starting: Promise<InputResult> | null = null;
  private visHandler: (() => void) | null = null;

  private readonly buf = new Float32Array(ANALYSER_SIZE);
  private readonly longSpec = new Float32Array(ANALYSER_SIZE); // bins of the 16k chord FFT
  private readonly analyzer = new FrameAnalyzer({ pitchWindow: PITCH_WINDOW, levelWindow: LEVEL_WINDOW });
  private readonly tracker = new NoteTracker({ sensitivity: 0.5, noiseFloor: 0.001, pitchLatencyMs: 32 });
  private readonly chord = new ChordTracker();
  /** Single expected note: spectral help for attacks the mono tracker misses (see assist.ts). */
  private readonly router = new AssistRouter();

  private expected: number[] | null = null;
  private monoNote: number | null = null;
  private noteRange: [number, number] = [28, 108];
  private noiseFloor = 0.001;
  private calib: number[] = [];
  private calibrateUntil = 0;
  private unvoicedSince = 0;
  private level = 0;
  private tuner: { midi: number; clarity: number; time: number } | null = null;
  private lastCtxTime = -1;
  private inputLatencyMs = 12;
  private selfSoundMode: 'pitch-aware' | 'strict' = 'pitch-aware';
  /** The input chosen on this device (null: the system default). */
  private pref: InputDevicePref | null = null;
  /** The input actually open. */
  private opened: AudioInputInfo | null = null;
  private monitor: GainNode | null = null;
  private monitorOn = false;
  private monitorVolume = 0.8;
  private watchingDevices = false;
  /** The open input was unplugged: start again when the chosen one comes back. */
  private unplugged = false;
  private _lastError: string | undefined;
  private readonly noteListeners = new Set<(e: NoteInputEvent) => void>();
  private readonly stateListeners = new Set<() => void>();

  /** Is the microphone currently being analysed? */
  get active(): boolean {
    return this.timer !== null;
  }

  /** Last start/runtime error (user-presentable), if any. */
  get lastError(): string | undefined {
    return this._lastError;
  }

  /** Note events from the mic (UI should subscribe via the input manager). */
  onNote = (cb: (e: NoteInputEvent) => void): (() => void) => {
    this.noteListeners.add(cb);
    return () => this.noteListeners.delete(cb);
  };

  /** Fires when the mic starts/stops (incl. device unplugged). */
  onStateChange = (cb: () => void): (() => void) => {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  };

  /**
   * Run the full note analysis until the returned function is called. The
   * input manager retains it for each note subscriber; screens that read the
   * mic another way (the tuner) retain it themselves. Safe to call before the
   * mic is started.
   */
  retain = (): (() => void) => {
    this.demand++;
    this.updateTimer();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.demand--;
      this.updateTimer();
    };
  };

  /** Is the full note analysis running (mic open and someone listening)? */
  get analysing(): boolean {
    return this.fullRate;
  }

  /** Request the mic and start listening. Call from a user gesture (iOS). */
  start = (): Promise<InputResult> => {
    if (this.active) return Promise.resolve({ ok: true });
    if (!this.starting) {
      this.starting = this.doStart().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  };

  private async doStart(): Promise<InputResult> {
    const fail = (error: string): InputResult => {
      this._lastError = error;
      this.notifyState();
      return { ok: false, error };
    };
    if (!isAudioSupported()) return fail('Audio is not supported in this browser.');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return fail('Microphone access is not available here (it requires a secure https:// page).');
    }
    // iOS: keep playback on the speaker and un-ducked while recording.
    setRecordingSession(true);
    const ctx = getAudioContext();
    const resumed = (ctx.state as string) === 'running' ? null : ctx.resume().catch(() => {});

    const pref = this.pref;
    let stream: MediaStream;
    try {
      stream = await this.openStream(pref?.id);
    } catch (err) {
      setRecordingSession(false);
      return fail(describeMicError(err));
    }
    let opened = trackDevice(stream.getAudioTracks()[0]);
    if (pref && !isChosen(opened, pref)) {
      // the saved id has gone stale (Safari renews ids when site data is cleared): now that
      // the labels can be read, look for the chosen device by name
      const found = resolveInputDevice(await this.listInputs(), pref);
      if (found && found.id !== opened?.id) {
        try {
          const again = await navigator.mediaDevices.getUserMedia({ audio: { ...RAW_AUDIO, deviceId: { exact: found.id } } });
          stream.getTracks().forEach(t => t.stop());
          stream = again;
          opened = trackDevice(stream.getAudioTracks()[0]);
        } catch {
          /* keep the default */
        }
      }
    }
    if (resumed) await resumed;

    try {
      const source = ctx.createMediaStreamSource(stream);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 40;
      filter.Q.value = 0.6;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYSER_SIZE;
      analyser.smoothingTimeConstant = 0;
      // Safari only processes nodes that are pulled by the destination:
      // route through a muted gain so nothing is audible.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(filter);
      filter.connect(analyser);
      analyser.connect(sink);
      sink.connect(ctx.destination);
      this.ctx = ctx;
      this.stream = stream;
      this.source = source;
      this.filter = filter;
      this.analyser = analyser;
      this.sink = sink;
      this.opened = opened;
      this.updateMonitor();
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingSession(false);
      return fail(describeMicError(err));
    }

    for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        if (this.stream !== stream) return;
        const name = this.opened?.label;
        this.stop();
        this.unplugged = true;
        this._lastError = name ? `${name} was disconnected.` : 'The microphone was disconnected.';
        this.notifyState();
      });
    }
    this.watchDevices();
    this.unplugged = false;
    // Background tabs are throttled to ~1 Hz: close notes rather than mangle them.
    this.visHandler = () => {
      if (document.visibilityState === 'hidden') this.flush(performance.now());
    };
    document.addEventListener('visibilitychange', this.visHandler);

    this._lastError = undefined;
    this.calib = [];
    this.calibrateUntil = performance.now() + CALIBRATE_MS;
    this.lastCtxTime = -1;
    this.tracker.reset();
    this.resetChord(performance.now());
    this.updateTimer();
    this.notifyState();
    return { ok: true };
  }

  /** Full analysis while retained, the idle level meter otherwise (mic open only). */
  private updateTimer(): void {
    if (!this.stream) return;
    const want = this.demand > 0;
    if (want) this.cancelIdle();
    if (this.timer !== null && want === this.fullRate) return;
    if (this.timer !== null && !want) {
      this.idleTimer ??= setTimeout(() => {
        this.idleTimer = null;
        if (this.demand === 0 && this.stream) this.setRate(false);
      }, IDLE_AFTER_MS);
      return;
    }
    this.setRate(want);
  }

  private cancelIdle(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private setRate(want: boolean): void {
    if (this.timer !== null) clearInterval(this.timer);
    const now = performance.now();
    if (want) {
      // stale detector state from before the pause must not leak into the new frames
      this.tracker.reset(now);
      this.resetChord(now);
      this.lastCtxTime = -1;
    } else {
      this.flush(now); // close the notes we reported; nobody hears the rest
      this.tuner = null;
    }
    this.fullRate = want;
    this.lastLevelAt = now;
    this.timer = setInterval(want ? this.tick : this.idleTick, want ? POLL_MS : IDLE_POLL_MS);
  }

  /** Stop listening and release the microphone (tracks are stopped). */
  stop = (): void => {
    const wasActive = this.active || this.stream !== null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.fullRate = false;
    this.cancelIdle();
    this.flush(performance.now());
    try {
      this.source?.disconnect();
      this.filter?.disconnect();
      this.analyser?.disconnect();
      this.sink?.disconnect();
      this.monitor?.disconnect();
    } catch {
      /* ignore */
    }
    this.monitor = null;
    this.opened = null;
    this.unplugged = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.visHandler) document.removeEventListener('visibilitychange', this.visHandler);
    this.visHandler = null;
    this.stream = null;
    this.source = null;
    this.filter = null;
    this.analyser = null;
    this.sink = null;
    this.level = 0;
    this.tuner = null;
    if (wasActive) {
      setRecordingSession(false);
      this.notifyState();
    }
  };

  /**
   * Notes the lesson currently expects (null = free play). ≥2 notes enables
   * chord verification; 1 note enables octave-slip correction.
   */
  setExpected = (midis: number[] | null): void => {
    const next =
      midis && midis.length ? [...new Set(midis.map((m) => Math.round(m)))].sort((a, b) => a - b) : null;
    const prev = this.expected;
    if (prev === next || (prev && next && prev.length === next.length && prev.every((m, i) => m === next[i]))) {
      return;
    }
    const wasChord = !!prev && prev.length >= 2;
    const isChord = !!next && next.length >= 2;
    const now = performance.now();
    if (wasChord && !isChord) {
      this.emitAll(this.chord.reset(now));
      this.tracker.reset(now); // its notes were never reported in chord mode
    } else if (!wasChord && isChord) {
      // mono → chord: close any mono note we reported
      this.emitAll(this.tracker.reset(now));
    }
    this.expected = next;
    this.emitAll(this.router.setExpected(next && next.length === 1 ? next[0] : null, this.tracker.onsetSerial, now));
    if (isChord) {
      this.chord.timeoutMs = (next as number[])[0] < LONG_WINDOW_BELOW ? 450 : 300;
      this.emitAll(this.chord.setExpected(next as number[], this.tracker.onsetSerial, now));
    }
  };

  /** 0 (strict) .. 1 (very sensitive). Default 0.5. */
  setSensitivity = (s: number): void => {
    this.tracker.setSensitivity(s);
  };

  getSensitivity = (): number => this.tracker.sensitivity;

  /** Typical input latency of this device in ms (for timing compensation). Default 12. */
  setInputLatencyMs = (ms: number): void => {
    if (Number.isFinite(ms) && ms >= 0 && ms < 500) this.inputLatencyMs = ms;
  };

  /**
   * Restrict detection to an instrument's range, e.g. guitar 40–88 (E2–E6)
   * or piano 21–108. Notes outside are treated as artefacts. Default 28–108.
   */
  setNoteRange = (lowest: number, highest: number): void => {
    if (Number.isFinite(lowest) && Number.isFinite(highest) && lowest <= highest) {
      this.noteRange = [Math.round(lowest), Math.round(highest)];
      // the detector's default 50 Hz – 2.5 kHz covers piano and guitar; widen it for
      // a bass's low strings or a glockenspiel's top octave
      const f = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
      this.analyzer.setFreqRange(Math.min(50, f(lowest) * 0.93), Math.max(2500, f(highest) * 1.07));
    }
  };

  /** How app-generated sound is kept from being detected (see file header). */
  setSelfSoundMode = (mode: 'pitch-aware' | 'strict'): void => {
    this.selfSoundMode = mode;
  };

  /**
   * Listen to this input (null: the system default). If the mic is open on a
   * different device it reopens on the new one; a change of `direct` alone
   * applies at once.
   */
  setDevice = (pref: InputDevicePref | null): void => {
    const prev = this.pref;
    this.pref = pref ? { ...pref } : null;
    const reopen = !!this.stream && (pref ? !isChosen(this.opened, pref) : prev !== null);
    if (reopen) {
      this.restart();
      return;
    }
    this.updateMonitor();
    if ((prev?.id ?? null) !== (pref?.id ?? null) || prev?.direct !== pref?.direct) this.notifyState();
  };

  /** Play a direct input back to the player ("hear yourself"). Never plays a microphone back. */
  setMonitor = (on: boolean, volume: number): void => {
    this.monitorOn = on;
    if (Number.isFinite(volume)) this.monitorVolume = Math.min(1, Math.max(0, volume));
    this.updateMonitor();
  };

  /** The inputs the browser offers (their names are blank until mic permission is granted). */
  listInputs = async (): Promise<AudioInputInfo[]> => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
      return audioInputs(await navigator.mediaDevices.enumerateDevices());
    } catch {
      return [];
    }
  };

  /** The input that is open, or null while the mic is off. */
  get inputDevice(): AudioInputInfo | null {
    return this.stream ? this.opened : null;
  }

  /** Is the open input plugged in with a cable (see the file header)? */
  get direct(): boolean {
    return !!this.stream && isDirectInput(this.opened, this.pref);
  }

  /** The chosen input isn't connected, so the system default is open instead. */
  get choiceMissing(): boolean {
    return !!this.stream && !!this.pref && !isChosen(this.opened, this.pref);
  }

  /** Is the open input being played back? */
  get monitoring(): boolean {
    return this.monitor !== null;
  }

  /**
   * The chosen device first (an unplugged one is skipped quickly: the browser
   * rejects an exact id it doesn't have), then the default. Some devices reject
   * the processing constraints, so each is tried without them as well.
   */
  private async openStream(deviceId: string | undefined): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [];
    if (deviceId) attempts.push({ audio: { ...RAW_AUDIO, deviceId: { exact: deviceId } } }, { audio: { deviceId: { exact: deviceId } } });
    attempts.push({ audio: RAW_AUDIO }, { audio: true });
    let last: unknown;
    for (const c of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (err) {
        const name = errorName(err);
        if (name === 'NotAllowedError' || name === 'SecurityError') throw err;
        last = err;
      }
    }
    throw last;
  }

  /** Reopen on the chosen device. The retains survive, so a running lesson keeps listening. */
  private restart(): void {
    if (!this.stream) return;
    this.stop();
    void this.start();
  }

  private updateMonitor(): void {
    const ctx = this.ctx;
    const from = this.filter;
    const want = this.monitorOn && this.direct && !!ctx && !!from;
    if (!want) {
      if (this.monitor) {
        try {
          from?.disconnect(this.monitor);
          this.monitor.disconnect();
        } catch {
          /* ignore */
        }
        this.monitor = null;
        this.notifyState();
      }
      return;
    }
    if (!this.monitor) {
      // straight to the destination: the master compressor's look-ahead would add delay
      // to what the player hears of their own playing
      const g = ctx.createGain();
      g.gain.value = 0;
      from.connect(g);
      g.connect(ctx.destination);
      this.monitor = g;
      this.notifyState();
    }
    this.monitor.gain.setTargetAtTime(this.monitorVolume, ctx.currentTime, 0.02);
  }

  /** Follow the chosen input: switch to it when it's plugged in, start again when it comes back. */
  private watchDevices(): void {
    const md = navigator.mediaDevices;
    if (this.watchingDevices || !md?.addEventListener) return;
    this.watchingDevices = true;
    md.addEventListener('devicechange', () => {
      const pref = this.pref;
      if (!pref || this.starting) return;
      void this.listInputs().then(inputs => {
        if (!resolveInputDevice(inputs, pref) || this.starting) return;
        if (this.stream && !isChosen(this.opened, pref)) this.restart();
        else if (!this.stream && this.unplugged) void this.start();
      });
    });
  }

  /** 0..1 input level for a meter (fast attack, smooth release). */
  getLevel = (): number => this.level;

  /** Current adaptive noise floor (RMS). */
  getNoiseFloor = (): number => this.noiseFloor;

  /** Smoothed pitch for a tuner UI, or null when nothing clear is sounding. */
  getTunerReading = (): TunerReading | null => {
    const t = this.tuner;
    if (!t || performance.now() - t.time > 350) return null;
    const nearest = Math.round(t.midi);
    return {
      freq: 440 * Math.pow(2, (t.midi - 69) / 12),
      midi: t.midi,
      cents: (t.midi - nearest) * 100,
      clarity: t.clarity,
    };
  };

  // -------------------------------------------------------------------------

  private notifyState(): void {
    for (const cb of this.stateListeners) {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    }
  }

  private emitAll(events: TrackerEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'on') this.monoNote = ev.midi;
      else if (this.monoNote === ev.midi) this.monoNote = null;
      const e: NoteInputEvent = { type: ev.type, midi: ev.midi, velocity: ev.velocity, time: ev.time, source: 'mic' };
      for (const cb of this.noteListeners) {
        try {
          cb(e);
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  private resetChord(time: number): void {
    const exp = this.expected;
    this.emitAll(
      exp && exp.length >= 2 ? this.chord.setExpected(exp, this.tracker.onsetSerial, time) : this.chord.reset(time),
    );
  }

  /** Close every note we reported and reset detection state. */
  private flush(time: number): void {
    const chordMode = !!this.expected && this.expected.length >= 2;
    const evs = this.tracker.reset(time);
    if (!chordMode) this.emitAll(evs);
    this.emitAll(this.router.reset(time));
    if (this.expected && this.expected.length === 1) this.router.setExpected(this.expected[0], this.tracker.onsetSerial, time);
    this.resetChord(time);
    if (this.monoNote !== null && !chordMode) {
      this.emitAll([{ type: 'off', midi: this.monoNote, time, velocity: 0 }]);
    }
    this.monoNote = null;
  }

  private updateLevel(level: number, now: number): void {
    const db = 20 * Math.log10(Math.max(level, 1e-6));
    const v = Math.min(1, Math.max(0, (db + 60) / 60));
    // release: ×0.88 per 18 ms analysis frame, whatever the polling rate
    const keep = Math.pow(0.88, Math.min(10, Math.max(0, now - this.lastLevelAt) / POLL_MS));
    this.lastLevelAt = now;
    this.level = v > this.level ? v : this.level * keep + v * (1 - keep);
  }

  private updateNoiseFloor(level: number, now: number, voiced: boolean): void {
    if (now < this.calibrateUntil) {
      this.calib.push(level);
      if (this.calib.length >= 5) this.setFloor(median(this.calib) * 1.1);
      return;
    }
    if (this.calib.length) {
      this.setFloor(median(this.calib) * 1.1);
      this.calib = [];
    }
    // a direct input can't hear the app, so the band playing needn't hold the floor still
    if (this.tracker.activeNote !== null || this.chord.busy || (!this.direct && appSoundActive())) return;
    if (!(level > 0)) return;
    if (voiced) {
      this.unvoicedSince = now;
      return;
    }
    const f = this.noiseFloor;
    if (level < f) {
      this.setFloor(f * Math.pow(level / f, 0.05)); // follow quieter rooms quickly (~0.4 s)
    } else if (level < f * 3) {
      this.setFloor(f * Math.pow(level / f, 0.005)); // creep up slowly (~4 s)
    } else if (level < f * 12 && now - this.unvoicedSince > 2000) {
      // persistent unpitched noise (fan, traffic): adapt over a few seconds
      this.setFloor(f * Math.pow(level / f, 0.01));
    }
  }

  private setFloor(f: number): void {
    this.noiseFloor = Math.min(0.03, Math.max(2e-5, f));
    this.tracker.setNoiseFloor(this.noiseFloor);
  }

  /** Spectral plausibility + instrument range for a pitch about to be reported. */
  private readonly confirmPitch = (m: number): boolean =>
    m >= this.noteRange[0] - 1 && m <= this.noteRange[1] + 1 && this.analyzer.hasSupport(m);

  private control(): TrackerControl {
    if (this.direct) return { confirmPitch: this.confirmPitch, vetoPitch: this.analyzer.isPhantom };
    if (this.selfSoundMode === 'strict') {
      const busy = appSoundActive();
      return { allowNoteOn: busy ? () => false : undefined, allowReattack: !busy, confirmPitch: this.confirmPitch, vetoPitch: this.analyzer.isPhantom };
    }
    const tonal = appTonalSoundActive();
    const click = appClickActive();
    return {
      allowNoteOn: tonal ? (m: number) => !appSoundBlocksNote(m) : undefined,
      deferNoteOn: click,
      allowReattack: !tonal && !click,
      confirmPitch: this.confirmPitch,
      vetoPitch: this.analyzer.isPhantom,
    };
  }

  /** Nothing listens for notes: keep the level meter (and the first calibration) going, nothing else. */
  private idleTick = (): void => {
    const ctx = this.ctx;
    const analyser = this.analyser;
    if (!ctx || !analyser || (ctx.state as string) !== 'running') return;
    if (ctx.currentTime === this.lastCtxTime) return;
    this.lastCtxTime = ctx.currentTime;
    analyser.getFloatTimeDomainData(this.buf);
    const now = performance.now();
    const level = rms(this.buf, ANALYSER_SIZE - LEVEL_WINDOW, ANALYSER_SIZE);
    this.updateLevel(level, now);
    // Without pitch, only what is safe on level alone: the start-up
    // calibration and following a room that got quieter.
    if (now < this.calibrateUntil || this.calib.length || level < this.noiseFloor) this.updateNoiseFloor(level, now, false);
  };

  private tick = (): void => {
    const ctx = this.ctx;
    const analyser = this.analyser;
    if (!ctx || !analyser) return;
    if ((ctx.state as string) !== 'running') {
      this.flush(performance.now());
      return;
    }
    // No new audio since the last poll (render thread stalled) → skip.
    if (ctx.currentTime === this.lastCtxTime) return;
    this.lastCtxTime = ctx.currentTime;

    analyser.getFloatTimeDomainData(this.buf);
    const now = performance.now();
    const sr = ctx.sampleRate;
    const tr = this.tracker;
    // The newest level window is centred half a window before "now", plus
    // the device's input latency.
    const frameTime = now - this.inputLatencyMs - (LEVEL_WINDOW / 2 / sr) * 1000;
    const frame = this.analyzer.analyze(this.buf, sr, frameTime, this.noiseFloor * 1.5, tr.activeNote !== null);
    const level = frame.rms;
    this.updateLevel(level, now);
    let pitch: PitchResult | null = frame.pitch;
    this.updateNoiseFloor(level, now, !!pitch && pitch.clarity > 0.6);

    const exp = this.expected;
    // Single expected note: correct YIN octave slips with spectral evidence.
    if (exp && exp.length === 1 && pitch && pitch.clarity < 0.92) {
      pitch = this.correctOctave(pitch, exp[0], sr);
      frame.freq = pitch.freq;
      frame.clarity = pitch.clarity;
    }

    // Tuner (smoothed, independent of note logic).
    if (pitch && pitch.clarity >= 0.8 && level > tr.gateLevel * 0.6) {
      const m = midiOf(pitch.freq);
      const t = this.tuner;
      if (!t || Math.abs(m - t.midi) > 0.6 || now - t.time > 300) this.tuner = { midi: m, clarity: pitch.clarity, time: now };
      else this.tuner = { midi: t.midi + (m - t.midi) * 0.3, clarity: t.clarity * 0.7 + pitch.clarity * 0.3, time: now };
    }

    const ctl = this.control();
    const events = tr.process(frame, ctl);
    if (!exp || exp.length < 2) {
      const single = exp ? exp[0] : null;
      this.emitAll(
        this.router.route(
          events,
          buildAssistFrame({
            expected: single,
            time: frameTime,
            level,
            gate: tr.gateLevel,
            onsetSerial: tr.onsetSerial,
            onsetTime: tr.lastOnsetTime,
            sampleRate: sr,
            analyzer: this.analyzer,
            longBuf: this.buf,
            longSpec: this.longSpec,
            blocked: single !== null && !!ctl.allowNoteOn && !ctl.allowNoteOn(single),
            defer: ctl.deferNoteOn,
          }),
        ),
      );
      return;
    }

    // ---- chord mode ---------------------------------------------------------
    const chordExp = exp;
    const long = chordExp[0] < LONG_WINDOW_BELOW;
    const pitchMidi = pitch && pitch.clarity >= tr.minClarity ? Math.round(midiOf(pitch.freq)) : null;
    this.emitAll(
      this.chord.process({
        time: frameTime,
        level,
        gate: tr.gateLevel,
        onsetSerial: tr.onsetSerial,
        onsetTime: tr.lastOnsetTime,
        pitchMidi,
        blocked: !!ctl.allowNoteOn && chordExp.some((m) => !ctl.allowNoteOn?.(m)),
        defer: ctl.deferNoteOn,
        allowExtra: (m) => (!ctl.allowNoteOn || ctl.allowNoteOn(m)) && this.confirmPitch(m),
        verify: () => {
          // Low chords need the long window to resolve semitones in the bass.
          const win = long ? ANALYSER_SIZE : PITCH_WINDOW;
          const spec = long
            ? computeSpectrum(this.buf, { fftSize: win * 2, windowLength: win, out: this.longSpec })
            : this.analyzer.spectrum(); // same 4096 window, already computed/cached
          return verifyChord(spec, sr, win * 2, chordExp, { windowLength: win }).present;
        },
      }),
    );
  };

  /**
   * YIN reported expected±12 with modest clarity: decide from the spectrum
   * whether the lower of the two notes is really sounding (its odd harmonics
   * are present) and report the expected note if that's what is heard.
   */
  private correctOctave(pitch: PitchResult, expected: number, sr: number): PitchResult {
    const m = Math.round(midiOf(pitch.freq));
    if (m !== expected + 12 && m !== expected - 12) return pitch;
    const fft = this.analyzer.fftSize;
    const spec = this.analyzer.spectrum();
    const lower = Math.min(m, expected);
    const f = 440 * Math.pow(2, (lower - 69) / 12);
    let odd = 0;
    let even = 0;
    for (const h of [1, 3, 5]) odd += harmonicPeak(spec, sr, fft, f * h);
    for (const h of [2, 4, 6]) even += harmonicPeak(spec, sr, fft, f * h);
    const sounding = odd > 0.3 * even ? lower : lower + 12;
    if (sounding !== expected) return pitch;
    return {
      freq: pitch.freq * Math.pow(2, (expected - m) / 12),
      clarity: Math.max(pitch.clarity, this.tracker.minClarity + 0.02),
    };
  }
}

/** The app-wide microphone input. */
export const micInput = new MicInput();
