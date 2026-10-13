/**
 * ChordTracker – emits note events for an EXPECTED chord heard through the
 * microphone. PURE + DOM-free (driven by MicInput, or by tests).
 *
 * After each level onset (from the NoteTracker) it "listens": the expected
 * chord is verified on every frame's spectrum (see verifyChord) and once all
 * expected notes are present on two consecutive frames, an 'on' event is
 * emitted for each of them (time = the onset). If the full chord doesn't
 * show up within `timeoutMs`, whatever WAS heard is reported instead (the
 * expected notes that are present plus the monophonic pitch if it is not part
 * of the chord), so wrong or partial chords still reach the lesson engine.
 * 'off' events follow when the sound decays below the release gate, or when
 * a new onset re-strikes.
 */
import type { TrackerEvent } from './tracker';
import { velocityFromRms } from './tracker';

export interface ChordFrame {
  time: number;
  /** Short-window RMS. */
  level: number;
  /** Level gate (same as the NoteTracker's). */
  gate: number;
  /** NoteTracker.onsetSerial / lastOnsetTime – a changed serial means a new attack. */
  onsetSerial: number;
  onsetTime: number;
  /** Confident monophonic pitch (rounded MIDI) or null. */
  pitchMidi: number | null;
  /** Evaluate the expected chord on this frame (called lazily, only while listening). */
  verify: () => readonly boolean[];
  /** The app itself is sounding (one of) these notes: don't trust this attack. */
  blocked?: boolean;
  /** A click is sounding: keep evaluating but hold any decision. */
  defer?: boolean;
  /** Extra plausibility filter for a reported non-chord note. */
  allowExtra?: (midi: number) => boolean;
}

export interface ChordTrackerOptions {
  /** Consecutive frames with every note present (default 2). */
  confirmFrames?: number;
  /** Max wait for the full chord before reporting what was heard (default 300 ms). */
  timeoutMs?: number;
  /** Frames below the release gate before 'off' (default 3). */
  releaseFrames?: number;
}

type Phase = 'idle' | 'listening' | 'sounding';

export class ChordTracker {
  private expected: number[] = [];
  private phase: Phase = 'idle';
  private serial = 0;
  private onsetTime = 0;
  private listenStart = 0;
  private okFrames = 0;
  private lowFrames = 0;
  private peak = 0;
  private emitted: number[] = [];
  private readonly confirmFrames: number;
  private readonly releaseFrames: number;
  timeoutMs: number;

  constructor(opts: ChordTrackerOptions = {}) {
    this.confirmFrames = opts.confirmFrames ?? 2;
    this.timeoutMs = opts.timeoutMs ?? 300;
    this.releaseFrames = opts.releaseFrames ?? 3;
  }

  /** Notes currently reported as sounding. */
  get sounding(): readonly number[] {
    return this.emitted;
  }

  /** True while listening for / sounding a chord. */
  get busy(): boolean {
    return this.phase !== 'idle';
  }

  /**
   * Set the chord to listen for. Returns 'off' events for anything reported
   * for the previous chord. `onsetSerial` is the tracker's current serial so
   * an attack that happened before the change isn't reused.
   */
  setExpected(midis: readonly number[], onsetSerial: number, time: number): TrackerEvent[] {
    const out = this.reset(time);
    this.expected = [...midis];
    this.serial = onsetSerial;
    return out;
  }

  /** Release everything and go idle. */
  reset(time: number): TrackerEvent[] {
    const out = this.emitted.map((m): TrackerEvent => ({ type: 'off', midi: m, time, velocity: 0 }));
    this.emitted = [];
    this.phase = 'idle';
    this.okFrames = 0;
    this.lowFrames = 0;
    return out;
  }

  process(f: ChordFrame): TrackerEvent[] {
    const out: TrackerEvent[] = [];
    const exp = this.expected;
    if (exp.length === 0) return out;
    if (f.onsetSerial !== this.serial) {
      this.serial = f.onsetSerial;
      if (this.phase === 'sounding') out.push(...this.reset(f.onsetTime));
      this.phase = 'listening';
      this.onsetTime = f.onsetTime;
      this.listenStart = f.time;
      this.okFrames = 0;
      this.peak = f.level;
    }
    if (this.phase === 'listening') {
      this.peak = Math.max(this.peak, f.level);
      if (f.level < f.gate * 0.5 || f.blocked) {
        // faded before we could decide, or the attack was the app's own sound
        this.phase = 'idle';
        return out;
      }
      const present = f.verify();
      const all = present.length === exp.length && present.every(Boolean);
      this.okFrames = all ? this.okFrames + 1 : 0;
      if (f.defer) return out;
      const velocity = velocityFromRms(this.peak);
      if (this.okFrames >= this.confirmFrames) {
        for (const m of exp) out.push({ type: 'on', midi: m, time: this.onsetTime, velocity });
        this.emitted = exp.slice();
        this.phase = 'sounding';
        this.lowFrames = 0;
        return out;
      }
      if (f.time - this.listenStart > this.timeoutMs) {
        const heard = exp.filter((_, i) => present[i]);
        const p = f.pitchMidi;
        if (p !== null && !exp.includes(p) && (!f.allowExtra || f.allowExtra(p))) heard.push(p);
        if (heard.length) {
          for (const m of heard) out.push({ type: 'on', midi: m, time: this.onsetTime, velocity });
          this.emitted = heard;
          this.phase = 'sounding';
          this.lowFrames = 0;
        } else {
          this.phase = 'idle';
        }
      }
      return out;
    }
    if (this.phase === 'sounding') {
      if (f.level < f.gate * 0.5) {
        if (++this.lowFrames >= this.releaseFrames) out.push(...this.reset(f.time));
      } else {
        this.lowFrames = 0;
      }
    }
    return out;
  }
}
