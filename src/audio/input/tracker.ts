/**
 * NoteTracker – turns a stream of per-frame pitch estimates into discrete
 * note on/off events. PURE + DOM-free (driven by the mic loop, or by tests).
 *
 * Rules (all thresholds derive from `sensitivity` unless overridden):
 *  • A note starts when the same rounded MIDI pitch is seen for `stableFrames`
 *    consecutive frames with clarity ≥ minClarity and rms ≥ noiseFloor·gateK.
 *  • While a note is active, frames within ±(50 + hysteresisCents) of it keep
 *    it alive, so vibrato and small bends do not retrigger.
 *  • A different pitch that is stable for `stableFrames` frames ends the note
 *    and starts the new one (legato playing).
 *  • An onset – an edge-triggered rise of the level (≥ reattackDb) or of the
 *    high-frequency transient level (≥ hfOnsetDb) above the running minimum
 *    of the last `onsetWindowMs` – on the SAME pitch is a re-attack: off + on.
 *    This is what makes repeated notes (E E F G…) register separately. It is
 *    confirmed once the pitch is still the same ~one analysis window later.
 *  • An optional `confirmPitch` hook (spectral support in the mic) vetoes
 *    implausible pitches, e.g. the "virtual" pitches YIN reports while two
 *    notes overlap in the analysis window.
 *  • The note ends when the level falls below the release gate (gate −6 dB),
 *    collapses quickly (damper), or the pitch is lost for too long.
 *  • After a note ends (or was vetoed via `allowNoteOn`), the same pitch may
 *    only start again after a fresh onset – a decaying tail never re-triggers.
 *
 * Times are in whatever unit the caller uses for `frame.time` (ms with
 * performance.now() in the app). Note-on times are back-dated to the detected
 * onset where possible, giving much better timing than "when we were sure".
 */

export interface PitchFrame {
  /** Frame time (ms), ideally already compensated for analysis latency. */
  time: number;
  /** Detected fundamental (Hz) or null when unpitched/silent. */
  freq: number | null;
  /** 0..1 pitch confidence. */
  clarity: number;
  /** Short-window RMS level of the frame (linear). */
  rms: number;
  /**
   * Optional high-frequency level (e.g. RMS of the first difference). A sharp
   * rise marks a pick/hammer transient even when the overall level barely
   * changes – essential for fast repeated notes.
   */
  hf?: number;
}

export interface TrackerEvent {
  type: 'on' | 'off';
  midi: number;
  time: number;
  /** 0..1 (derived from level for note-ons; 0 for offs). */
  velocity: number;
}

/** Per-frame control from the caller (app-sound suppression etc.). */
export interface TrackerControl {
  /** Return false to veto starting a note at this pitch right now. */
  allowNoteOn?: (midi: number) => boolean;
  /** Keep accumulating evidence but hold any note-on until a later frame. */
  deferNoteOn?: boolean;
  /** When false, rms rises cannot re-attack the active note (default true). */
  allowReattack?: boolean;
  /**
   * Final plausibility check before a pitch is reported (new note, pitch
   * change or re-attack), e.g. spectral support. Returning false discards
   * the candidate without penalty so it can be re-evaluated on later,
   * cleaner frames (a vetoed re-attack is dropped).
   */
  confirmPitch?: (midi: number) => boolean;
}

export interface NoteTrackerOptions {
  /** 0 (strict) .. 1 (very sensitive). Default 0.5. */
  sensitivity?: number;
  /** Consecutive agreeing frames needed to start a note (default 3 ≈ 50 ms at 55 fps). */
  stableFrames?: number;
  /** Frames on the same pitch needed to confirm a re-attack (default 2). */
  reattackFrames?: number;
  /**
   * Re-attack confirmation only counts frames at least this long after the
   * onset (default 90 ms ≈ one 4096-sample pitch window): earlier frames
   * still contain the OLD note, and while two notes overlap YIN can report a
   * pitch (e.g. the sub-octave of a new note an octave higher) that looks
   * like a re-strike of the old one. The event is still back-dated to the
   * onset, and a second onset commits a pending re-attack immediately.
   */
  reattackSettleMs?: number;
  /** Initial noise-floor RMS (default 0.001). */
  noiseFloor?: number;
  /** Extra tolerance beyond ±50 cents before a pitch counts as "different" (default 20). */
  hysteresisCents?: number;
  /** Level rise vs running minimum that counts as an onset (default from sensitivity: 7.5 → 4.5 dB; 6 dB at 0.5). */
  reattackDb?: number;
  /** High-frequency (frame.hf) rise that counts as an onset (default from sensitivity: 11 → 5 dB; 8 dB at 0.5). */
  hfOnsetDb?: number;
  /** Running-minimum window for onsets (default 120 ms). */
  onsetWindowMs?: number;
  /** Minimum time between two onsets (default 70 ms). */
  minNoteMs?: number;
  /** Frames below the release gate before 'off' (default 2). */
  releaseFrames?: number;
  /** Frames without a confident pitch (while loud) before 'off' (default 6). */
  maxUnvoicedFrames?: number;
  /** A fall of this many dB within the onset window counts as damping → 'off' (default 20). */
  dropDb?: number;
  /** Subtracted from note-on times that had no detected level onset (default 30 ms). */
  pitchLatencyMs?: number;
  /** Absolute minimum gate RMS (default 0.0006 ≈ −64 dBFS). */
  minRms?: number;
  /** A candidate stable for this long is accepted even if confirmPitch says no (default 250 ms). */
  trustAfterMs?: number;
}

interface HistEntry {
  time: number;
  rms: number;
  hf: number;
}

const LN10_20 = Math.LN10 / 20;

function freqToMidiF(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Map an RMS level (linear) to a 0..1 velocity. −54 dBFS → ~0, −12 dBFS → 1. */
export function velocityFromRms(level: number): number {
  const db = 20 * Math.log10(Math.max(level, 1e-9));
  return Math.min(1, Math.max(0.05, (db + 54) / 42));
}

export class NoteTracker {
  // --- tunables -----------------------------------------------------------
  private _sensitivity = 0.5;
  private gateK = 4;
  private _minClarity = 0.78;
  private readonly stableFrames: number;
  private readonly reattackFrames: number;
  private readonly reattackSettleMs: number;
  private readonly hysteresis: number;
  private reattackRatio = 2;
  private hfRatio = 2.5;
  private readonly fixedReattackDb: number | undefined;
  private readonly fixedHfDb: number | undefined;
  private readonly onsetWindowMs: number;
  private readonly minNoteMs: number;
  private readonly releaseFrames: number;
  private readonly maxUnvoicedFrames: number;
  private readonly dropRatio: number;
  private readonly pitchLatencyMs: number;
  private readonly minRms: number;
  private readonly trustAfterMs: number;

  // --- state ----------------------------------------------------------------
  private floor: number;
  private active: number | null = null;
  private candMidi: number | null = null;
  private candCount = 0;
  private candStart = 0;
  private candPeak = 0;
  private releaseCount = 0;
  private releaseStart = 0;
  private unvoicedCount = 0;
  private unvoicedStart = 0;
  private history: HistEntry[] = [];
  private aboveOnset = false;
  private risingSince: number | null = null;
  private _lastOnsetTime = -Infinity;
  /** Onset time already attributed to a note-on (each onset is used once). */
  private onsetUsed = -Infinity;
  private _onsetSerial = 0;
  private reattack: { time: number; count: number; support: number; peak: number } | null = null;
  private readonly needsOnset = new Map<number, number>();

  constructor(opts: NoteTrackerOptions = {}) {
    this.stableFrames = Math.max(1, opts.stableFrames ?? 3);
    this.reattackFrames = Math.max(1, opts.reattackFrames ?? 2);
    this.reattackSettleMs = opts.reattackSettleMs ?? 90;
    this.hysteresis = (opts.hysteresisCents ?? 20) / 100;
    this.fixedReattackDb = opts.reattackDb;
    this.fixedHfDb = opts.hfOnsetDb;
    this.onsetWindowMs = opts.onsetWindowMs ?? 120;
    this.minNoteMs = opts.minNoteMs ?? 70;
    this.releaseFrames = Math.max(1, opts.releaseFrames ?? 2);
    this.maxUnvoicedFrames = opts.maxUnvoicedFrames ?? 6;
    this.dropRatio = Math.exp(-(opts.dropDb ?? 20) * LN10_20);
    this.pitchLatencyMs = opts.pitchLatencyMs ?? 30;
    this.minRms = opts.minRms ?? 0.0006;
    this.trustAfterMs = opts.trustAfterMs ?? 250;
    this.floor = opts.noiseFloor ?? 0.001;
    this.setSensitivity(opts.sensitivity ?? 0.5);
  }

  /**
   * 0 (strict) .. 1 (sensitive). Maps to: level gate 18 → 6 dB above the
   * noise floor, pitch clarity 0.86 → 0.70, onset rise 7.5 → 4.5 dB (level)
   * and 11 → 5 dB (high-frequency transient).
   */
  setSensitivity(s: number): void {
    const v = Math.min(1, Math.max(0, s));
    this._sensitivity = v;
    this.gateK = Math.exp((18 - 12 * v) * LN10_20);
    this._minClarity = 0.86 - 0.16 * v;
    this.reattackRatio = Math.exp((this.fixedReattackDb ?? 7.5 - 3 * v) * LN10_20);
    this.hfRatio = Math.exp((this.fixedHfDb ?? 11 - 6 * v) * LN10_20);
  }

  get sensitivity(): number {
    return this._sensitivity;
  }

  setNoiseFloor(rms: number): void {
    if (rms > 0 && Number.isFinite(rms)) this.floor = rms;
  }

  get noiseFloor(): number {
    return this.floor;
  }

  /** RMS a frame must reach to start a note. */
  get gateLevel(): number {
    return Math.max(this.minRms, this.floor * this.gateK);
  }

  get minClarity(): number {
    return this._minClarity;
  }

  /** MIDI note currently considered sounding (null if none). */
  get activeNote(): number | null {
    return this.active;
  }

  /** Time of the most recent level onset. */
  get lastOnsetTime(): number {
    return this._lastOnsetTime;
  }

  /** Increments on every detected level onset (lets callers spot new attacks). */
  get onsetSerial(): number {
    return this._onsetSerial;
  }

  /** Forget all state. Returns an 'off' event for a sounding note, if any. */
  reset(time?: number): TrackerEvent[] {
    const out: TrackerEvent[] = [];
    if (this.active !== null) {
      out.push({ type: 'off', midi: this.active, time: time ?? this.lastTime(), velocity: 0 });
    }
    this.active = null;
    this.candMidi = null;
    this.candCount = 0;
    this.releaseCount = 0;
    this.unvoicedCount = 0;
    this.history = [];
    this.aboveOnset = false;
    this.risingSince = null;
    this.reattack = null;
    this.needsOnset.clear();
    return out;
  }

  private lastTime(): number {
    return this.history.length ? this.history[this.history.length - 1].time : 0;
  }

  /** Consume one analysis frame; returns the events it produced (usually none). */
  process(frame: PitchFrame, ctl: TrackerControl = {}): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    const t = frame.time;
    const level = Number.isFinite(frame.rms) ? frame.rms : 0;
    const gate = this.gateLevel;
    const releaseGate = gate * 0.5;

    // ---- 1. level onset (edge-triggered rise vs. running minimum) ---------
    const cutoff = t - this.onsetWindowMs;
    let drop = 0;
    while (drop < this.history.length && this.history[drop].time < cutoff) drop++;
    if (drop) this.history.splice(0, drop);
    const hf = frame.hf !== undefined && Number.isFinite(frame.hf) ? frame.hf : -1;
    let runMin = Infinity;
    let runMax = 0;
    let hfMin = Infinity;
    for (const h of this.history) {
      if (h.rms < runMin) runMin = h.rms;
      if (h.rms > runMax) runMax = h.rms;
      if (h.hf >= 0 && h.hf < hfMin) hfMin = h.hf;
    }
    const hfRise = hf > 0 && hfMin < Infinity && hf >= Math.max(hfMin, 1e-9) * this.hfRatio;
    const rising =
      this.history.length > 0 ? level >= runMin * this.reattackRatio || hfRise : level >= gate;
    if (rising) {
      if (this.risingSince === null) this.risingSince = t;
    } else {
      this.risingSince = null;
    }
    const above = rising && level >= gate;
    let onset = false;
    if (above && !this.aboveOnset && t - this._lastOnsetTime >= this.minNoteMs) {
      onset = true;
      // Back-date to the start of the rise if it began just before.
      const rs = this.risingSince ?? t;
      this._lastOnsetTime = t - rs <= 60 ? rs : t;
      this._onsetSerial++;
    }
    this.aboveOnset = above;
    this.history.push({ time: t, rms: level, hf });

    // Silence clears "needs a fresh attack" bookkeeping.
    if (level < releaseGate) this.needsOnset.clear();
    else if (this.needsOnset.size) {
      for (const [m, at] of this.needsOnset) if (t - at > 4000) this.needsOnset.delete(m);
    }

    // ---- 2. classify this frame -------------------------------------------
    const clarityNeeded = this.active !== null ? this._minClarity - 0.08 : this._minClarity;
    const levelNeeded = this.active !== null ? releaseGate : gate;
    const voiced =
      frame.freq !== null && frame.freq > 0 && frame.clarity >= clarityNeeded && level >= levelNeeded;
    const midiF = voiced ? freqToMidiF(frame.freq as number) : NaN;

    if (onset && this.active !== null && ctl.allowReattack !== false) {
      // A previous re-attack still waiting for confirmation whose pitch held
      // steady until this new onset was real – commit it before tracking the
      // new one (fast repeated notes).
      const prev = this.reattack;
      if (
        prev &&
        prev.support > 0 &&
        !ctl.deferNoteOn &&
        (!ctl.allowNoteOn || ctl.allowNoteOn(this.active)) &&
        (!ctl.confirmPitch || ctl.confirmPitch(this.active))
      ) {
        const A = this.active;
        this.onsetUsed = Math.max(this.onsetUsed, prev.time);
        this.noteOff(events, prev.time);
        this.noteOn(events, A, prev.time, prev.peak);
      }
      this.reattack = { time: this._lastOnsetTime, count: 0, support: 0, peak: level };
    }

    // ---- 3. active note maintenance ---------------------------------------
    if (this.active !== null) {
      const A = this.active;
      if (level < releaseGate) {
        if (this.releaseCount++ === 0) this.releaseStart = t;
      } else {
        this.releaseCount = 0;
      }
      const damped = runMax > 0 && level < runMax * this.dropRatio;
      if (this.releaseCount >= this.releaseFrames || damped) {
        this.noteOff(events, damped ? t : this.releaseStart);
        this.needsOnset.set(A, t);
      } else if (voiced && Math.abs(midiF - A) <= 0.5 + this.hysteresis) {
        // Supports the active note (vibrato/bends inside the band are fine).
        this.unvoicedCount = 0;
        this.candMidi = null;
        this.candCount = 0;
        if (this.reattack) {
          this.reattack.support++;
          if (level > this.reattack.peak) this.reattack.peak = level;
        }
        if (this.reattack && t - this.reattack.time >= this.reattackSettleMs) {
          this.reattack.count++;
          if (this.reattack.count >= this.reattackFrames && !ctl.deferNoteOn) {
            const at = this.reattack.time;
            const peak = this.reattack.peak;
            this.reattack = null;
            const plausible = !ctl.confirmPitch || ctl.confirmPitch(A);
            if (plausible && (!ctl.allowNoteOn || ctl.allowNoteOn(A))) {
              this.onsetUsed = Math.max(this.onsetUsed, at);
              this.noteOff(events, at);
              this.noteOn(events, A, at, peak);
            }
          }
        }
      } else if (voiced) {
        // A different pitch: candidate for a legato change.
        this.unvoicedCount = 0;
        this.trackCandidate(Math.round(midiF), t, level);
        if (this.candCount >= this.stableFrames && !ctl.deferNoteOn) {
          const m = this.candMidi as number;
          if (ctl.confirmPitch && t - this.candStart < this.trustAfterMs && !ctl.confirmPitch(m)) {
            this.candCount = 0; // implausible (e.g. transition artefact) – keep listening
            return events;
          }
          const at = this.onsetTimeFor(this.candStart);
          this.noteOff(events, at);
          if (ctl.allowNoteOn && !ctl.allowNoteOn(m)) {
            this.needsOnset.set(m, t);
            this.candCount = 0;
          } else {
            this.noteOn(events, m, at, this.candPeak);
          }
        }
      } else {
        // Loud but unpitched: tolerate briefly (attack transients, noise).
        if (this.unvoicedCount++ === 0) this.unvoicedStart = t;
        if (this.unvoicedCount > this.maxUnvoicedFrames) {
          this.noteOff(events, this.unvoicedStart);
          this.needsOnset.set(A, t);
        }
      }
      if (this.reattack && t - this.reattack.time > 300) this.reattack = null;
      return events;
    }

    // ---- 4. no active note: look for a new one ----------------------------
    if (!voiced) {
      this.candMidi = null;
      this.candCount = 0;
      return events;
    }
    const m = Math.round(midiF);
    this.trackCandidate(m, t, level);
    if (this.candCount >= this.stableFrames && !ctl.deferNoteOn) {
      if (ctl.allowNoteOn && !ctl.allowNoteOn(m)) {
        // Vetoed (e.g. the app itself is playing this pitch). Require a fresh
        // attack once the veto lifts so its decaying tail can't sneak in.
        this.needsOnset.set(m, t);
        this.candCount = 0;
      } else {
        const blockedAt = this.needsOnset.get(m);
        if (blockedAt === undefined || this._lastOnsetTime > blockedAt) {
          if (ctl.confirmPitch && t - this.candStart < this.trustAfterMs && !ctl.confirmPitch(m)) {
            this.candCount = 0;
          } else {
            this.needsOnset.delete(m);
            this.noteOn(events, m, this.onsetTimeFor(this.candStart), this.candPeak);
          }
        }
      }
    }
    return events;
  }

  private trackCandidate(m: number, t: number, level: number): void {
    if (m === this.candMidi) {
      this.candCount++;
      if (level > this.candPeak) this.candPeak = level;
    } else {
      this.candMidi = m;
      this.candCount = 1;
      this.candStart = t;
      this.candPeak = level;
    }
  }

  /**
   * Prefer the detected onset if it plausibly belongs to this note: not yet
   * attributed to another note and at most 300 ms before the pitch settled
   * (low notes after big leaps can take a while to be confirmed).
   */
  private onsetTimeFor(candStart: number): number {
    const o = this._lastOnsetTime;
    if (o > this.onsetUsed && o >= candStart - 300 && o <= candStart + 60) {
      this.onsetUsed = o;
      return o;
    }
    return candStart - this.pitchLatencyMs;
  }

  private noteOn(events: TrackerEvent[], midi: number, time: number, level: number): void {
    events.push({ type: 'on', midi, time, velocity: velocityFromRms(level) });
    this.active = midi;
    this.candMidi = null;
    this.candCount = 0;
    this.releaseCount = 0;
    this.unvoicedCount = 0;
    this.reattack = null;
  }

  private noteOff(events: TrackerEvent[], time: number): void {
    if (this.active === null) return;
    events.push({ type: 'off', midi: this.active, time, velocity: 0 });
    this.active = null;
    this.releaseCount = 0;
    this.unvoicedCount = 0;
    this.reattack = null;
  }
}
