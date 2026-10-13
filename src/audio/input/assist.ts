/**
 * ExpectedNoteAssist – helps the monophonic NoteTracker when the lesson is
 * waiting for ONE known note. PURE + DOM-free (driven by MicInput, or tests).
 *
 * The mono tracker follows a single pitch. On a guitar the previous string
 * often keeps ringing (D on the 2nd string while the open 1st-string E is
 * plucked): YIN then sees two notes, may report a "virtual" pitch between
 * them (D♯) or stay on the louder old note, and the new note is missed. A
 * re-plucked open string that is still ringing is similar: the level barely
 * rises, so the attack can go unnoticed.
 *
 * Knowing what to listen for makes this tractable. After each level onset the
 * assist compares the expected note's partials with the frame just before the
 * attack: if the note is spectrally present AND its partials grew (a fresh
 * attack, not a note that was already ringing) on two consecutive frames, it
 * reports the expected note, back-dated to the onset.
 *
 * Safeguards:
 *  • a real lower note whose harmonics contain the expected one (A2 when E4
 *    is expected: 330 Hz is A2's 3rd harmonic) vetoes the assist – judged from
 *    the spectrum, not from YIN, whose "missing fundamental" reports while two
 *    strings ring are exactly what the assist works around;
 *  • while the assist listens, the caller holds back the tracker's other
 *    notes from the same attack, and drops them if the assist confirms (they
 *    are the virtual pitches it exists to fix) – genuine wrong notes are
 *    released after a short delay when the expected note is clearly absent;
 *  • if the tracker reports the expected note itself, the assist stands down.
 */
import type { FrameAnalyzer } from './analyzer';
import { computeSpectrum, harmonicPeak, hasPitchSupport, verifyChord } from './spectrum';
import type { TrackerEvent } from './tracker';
import { velocityFromRms } from './tracker';

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/** Expected notes below this (C3) are judged on the long window. */
const LONG_WINDOW_BELOW = 48;
const LONG_WINDOW = 8192;

/** Magnitudes of a note's partials (h = 1…n, up to 5 kHz) in a magnitude spectrum. */
export function notePartials(spec: Float32Array, sampleRate: number, fftSize: number, midi: number, n = 8): number[] {
  const f0 = midiHz(midi);
  const out: number[] = [];
  for (let h = 1; h <= n && f0 * h < 5000; h++) out.push(harmonicPeak(spec, sampleRate, fftSize, f0 * h));
  return out;
}

/** Intervals below a note whose fundamentals have it in their harmonic series (octave, twelfth, 2 octaves, 2 oct + 3rd). */
const SUB_INTERVALS = [12, 19, 24, 28];

/**
 * Fundamental magnitudes of the lower notes whose harmonic series contains
 * `midi` (an octave, a twelfth, two octaves… below; 0 below 60 Hz).
 */
export function subFundamentals(spec: Float32Array, sampleRate: number, fftSize: number, midi: number): number[] {
  return SUB_INTERVALS.map(d => {
    const f = midiHz(midi - d);
    return f < 60 ? 0 : harmonicPeak(spec, sampleRate, fftSize, f);
  });
}

export interface AssistFrame {
  time: number;
  /** Short-window RMS. */
  level: number;
  /** The tracker's level gate. */
  gate: number;
  /** Tracker onset bookkeeping – a changed serial means a new attack. */
  onsetSerial: number;
  onsetTime: number;
  /** Magnitudes of the expected note's partials (h = 1…n) on this frame. */
  partials: () => readonly number[];
  /** Is the expected note spectrally present on this frame (verifyChord)? */
  present: () => boolean;
  /**
   * Does the spectrum support the expected note as a pitch of its own – a real
   * fundamental, odd partials not negligible next to the even ones (so the
   * note an octave up doesn't count)? See hasPitchSupport.
   */
  supported?: () => boolean;
  /**
   * Fundamental magnitudes of the lower notes whose harmonics contain the
   * expected note (see subFundamentals). A FRESHLY plucked one (E3 or A2 when
   * E4 is expected) explains the expected partials, so it vetoes the assist;
   * one that was already ringing before the attack does not.
   */
  subs?: () => readonly number[];
  /** The app itself is sounding something that could be mistaken for the note. */
  blocked?: boolean;
  /** A click is sounding: keep evaluating but hold any decision. */
  defer?: boolean;
}

export interface ExpectedNoteAssistOptions {
  /** Mean partial rise (dB) vs. the pre-attack frame that marks a fresh attack (default 3). */
  riseDb?: number;
  /** …and mean rise of the three lowest partials, which only a real attack of THIS note lifts (default 2). */
  lowRiseDb?: number;
  /** Consecutive confirming frames (default 2). */
  confirmFrames?: number;
  /** Frames earlier than this after the attack can't confirm (default 75 ms). */
  settleMs?: number;
  /** Give up this long after the onset (default 350 ms). */
  timeoutMs?: number;
  /** Release held-back notes once the note has been clearly absent this long after the onset (default 120 ms). */
  absentAfterMs?: number;
  /** Magnitude treated as silence when comparing partials (default 2e-4). */
  floor?: number;
}

const HISTORY_MS = 400;
/** No spectral self-trigger this soon after a reported note-on or a level onset (ms). */
const SELF_TRIGGER_REFRACTORY_MS = 250;

type Phase = 'idle' | 'listening';

export class ExpectedNoteAssist {
  private expected: number | null = null;
  private phase: Phase = 'idle';
  private serial = 0;
  private onsetTime = 0;
  private reference: readonly number[] | null = null;
  private okFrames = 0;
  private absentFrames = 0;
  private peak = 0;
  private history: { time: number; partials: readonly number[]; subs: readonly number[] }[] = [];
  private referenceSubs: readonly number[] | null = null;
  private quietUntil = -Infinity;
  private readonly riseDb: number;
  private readonly lowRiseDb: number;
  private readonly confirmFrames: number;
  private readonly settleMs: number;
  private readonly timeoutMs: number;
  private readonly absentAfterMs: number;
  private readonly floor: number;

  constructor(opts: ExpectedNoteAssistOptions = {}) {
    this.riseDb = opts.riseDb ?? 3;
    this.lowRiseDb = opts.lowRiseDb ?? 2;
    this.confirmFrames = opts.confirmFrames ?? 2;
    this.settleMs = opts.settleMs ?? 75;
    this.timeoutMs = opts.timeoutMs ?? 350;
    this.absentAfterMs = opts.absentAfterMs ?? 120;
    this.floor = opts.floor ?? 2e-4;
  }

  /** The note being waited for (null = off). Attacks before this call are never reused. */
  setExpected(midi: number | null, onsetSerial: number): void {
    if (midi === this.expected) return;
    this.expected = midi;
    this.serial = onsetSerial;
    this.phase = 'idle';
    this.history = [];
  }

  get expectedNote(): number | null {
    return this.expected;
  }

  /** True while deciding about the latest attack (the caller holds back other notes meanwhile). */
  get listening(): boolean {
    return this.phase === 'listening';
  }

  /** The tracker reported the expected note for this attack: nothing to add. */
  standDown(): void {
    this.phase = 'idle';
  }

  /**
   * Consume one frame. Returns 'confirmed' with the note-on to emit, 'released'
   * when the attack turned out not to be the expected note (flush held-back
   * notes), or null while undecided / idle.
   */
  process(f: AssistFrame): { kind: 'confirmed'; event: TrackerEvent } | { kind: 'released' } | null {
    const exp = this.expected;
    if (exp === null) return null;

    // Record this frame's partials (they become the reference for the next attack).
    const partials = f.partials();
    const subs = f.subs?.() ?? [];
    const cutoff = f.time - HISTORY_MS;
    while (this.history.length && this.history[0].time < cutoff) this.history.shift();
    this.history.push({ time: f.time, partials, subs });

    if (f.onsetSerial !== this.serial) {
      this.serial = f.onsetSerial;
      this.quietUntil = Math.max(this.quietUntil, f.time + SELF_TRIGGER_REFRACTORY_MS);
      this.phase = 'listening';
      this.onsetTime = f.onsetTime;
      this.okFrames = 0;
      this.absentFrames = 0;
      this.peak = f.level;
      // the newest frame whose analysis window ended before the attack
      let ref: { partials: readonly number[]; subs: readonly number[] } | null = null;
      for (const h of this.history) if (h.time <= f.onsetTime - 15) ref = h;
      this.reference = ref?.partials ?? null;
      this.referenceSubs = ref?.subs ?? null;
    }
    if (this.phase !== 'listening') {
      if (!this.spectralOnset(f, partials)) return null;
    }

    this.peak = Math.max(this.peak, f.level);
    const since = f.time - this.onsetTime;
    if (f.level < f.gate * 0.5 || f.blocked) return this.release();

    const present = f.present();
    // The attack's click stays in the 85 ms analysis window for a while and
    // lights up every bin (incl. a missing fundamental): judge only frames
    // whose window is mostly the new sound.
    const settled = since >= this.settleMs;
    const fresh =
      settled &&
      present &&
      this.rise(partials, 0, partials.length) >= this.riseDb &&
      this.rise(partials, 0, 3) >= this.lowRiseDb &&
      this.rise(partials, 0, 5, 2) >= this.lowRiseDb && // odd partials: the note an octave up can't lift these
      (f.supported?.() ?? true) &&
      !this.freshLowerNote(partials, subs);
    this.okFrames = fresh ? this.okFrames + 1 : 0;
    this.absentFrames = present ? 0 : this.absentFrames + 1;
    if (f.defer) return null;
    if (this.okFrames >= this.confirmFrames) {
      this.phase = 'idle';
      return { kind: 'confirmed', event: { type: 'on', midi: exp, time: this.onsetTime, velocity: velocityFromRms(this.peak) } };
    }
    if (since > this.timeoutMs) return this.release();
    if (since > this.absentAfterMs && this.absentFrames >= 3) return this.release();
    return null;
  }

  /** A note-on was reported (by anyone): no spectral self-trigger shortly after it. */
  noteEmitted(time: number): void {
    this.quietUntil = Math.max(this.quietUntil, time + SELF_TRIGGER_REFRACTORY_MS);
  }

  /**
   * Some attacks don't move the overall level enough for an onset (a soft
   * pluck while another string still rings loudly). If the expected note's
   * own partials jump out of nowhere, treat that as the attack.
   */
  private spectralOnset(f: AssistFrame, partials: readonly number[]): boolean {
    if (f.time < this.quietUntil || f.blocked || f.level < f.gate * 0.5) return false;
    let ref: { time: number; partials: readonly number[]; subs: readonly number[] } | null = null;
    for (const h of this.history) if (h.time <= f.time - 60) ref = h;
    if (!ref || f.time - ref.time > 140) return false;
    this.reference = ref.partials;
    this.referenceSubs = ref.subs;
    if (this.rise(partials, 0, partials.length) < 6 || this.rise(partials, 0, 3) < 4 || this.rise(partials, 0, 5, 2) < 4) return false;
    if (!f.present() || !(f.supported?.() ?? true) || this.freshLowerNote(partials, this.history[this.history.length - 1].subs)) return false;
    this.phase = 'listening';
    this.onsetTime = ref.time + 20;
    this.okFrames = 0;
    this.absentFrames = 0;
    this.peak = f.level;
    this.quietUntil = f.time + SELF_TRIGGER_REFRACTORY_MS;
    return true;
  }

  private release(): { kind: 'released' } {
    this.phase = 'idle';
    return { kind: 'released' };
  }

  /** A lower note that explains the expected partials was plucked with this attack. */
  private freshLowerNote(partials: readonly number[], subs: readonly number[]): boolean {
    const own = Math.max(partials[0] ?? 0, this.floor);
    const fl = this.floor;
    return subs.some((m, i) => {
      if (m < 0.3 * own || m <= fl * 2) return false;
      const before = Math.max(this.referenceSubs?.[i] ?? 0, fl);
      return 20 * Math.log10(m / before) >= 3;
    });
  }

  /** Mean dB growth of partials [from, to) (every `step`-th) vs. the pre-attack reference; partials in the noise are ignored. */
  private rise(now: readonly number[], from: number, to: number, step = 1): number {
    const ref = this.reference;
    const fl = this.floor;
    let sum = 0;
    let n = 0;
    for (let h = from; h < Math.min(to, now.length); h += step) {
      const a = Math.max(now[h], fl);
      const b = Math.max(ref?.[h] ?? 0, fl);
      if (a <= fl * 2 && b <= fl * 2) continue;
      const d = 20 * Math.log10(a / b);
      sum += Math.min(20, Math.max(-10, d));
      n++;
    }
    return n ? sum / n : 0;
  }
}

/**
 * Routes the mono tracker's events through an ExpectedNoteAssist:
 *  • other notes reported while the assist is deciding about an attack are
 *    held back; dropped if the assist confirms (they came from the same attack
 *    – virtual pitches), released in order otherwise;
 *  • after a confirmation, everything the tracker reports from that same
 *    attack (duplicates of the note, legato changes as the old string decays)
 *    is dropped until a new attack;
 *  • the assisted note is released at the next attack, when the sound decays,
 *    or when the expected note changes.
 */
export class AssistRouter {
  readonly assist: ExpectedNoteAssist;
  private held: TrackerEvent[] = [];
  private readonly suppressed = new Set<number>();
  private assisted: { midi: number; serial: number; time: number } | null = null;
  private sounding: number | null = null;
  private lowFrames = 0;

  constructor(assist = new ExpectedNoteAssist()) {
    this.assist = assist;
  }

  /** Change the awaited note (null = off). Returns events to emit (held notes, releases). */
  setExpected(midi: number | null, onsetSerial: number, time: number): TrackerEvent[] {
    if (midi === this.assist.expectedNote) return [];
    this.assist.setExpected(midi, onsetSerial);
    const out = this.flushHeld();
    out.push(...this.releaseSounding(time));
    return out;
  }

  /** Forget everything (mic restarted, lesson left). */
  reset(time: number): TrackerEvent[] {
    this.held = [];
    this.suppressed.clear();
    this.assisted = null;
    this.assist.setExpected(null, 0);
    return this.releaseSounding(time);
  }

  /**
   * One frame: the tracker's events for it plus the assist's view of the same
   * frame. Returns the events to emit.
   */
  route(trackerEvents: TrackerEvent[], frame: AssistFrame): TrackerEvent[] {
    const out: TrackerEvent[] = [];
    const exp = this.assist.expectedNote;

    // a new attack ends the assisted note and the "same attack" window
    if (this.assisted && frame.onsetSerial !== this.assisted.serial) {
      out.push(...this.releaseSounding(frame.onsetTime));
      this.assisted = null;
    }
    // the tracker found the expected note itself: the assist isn't needed
    if (exp !== null && trackerEvents.some(e => e.type === 'on' && e.midi === exp) && !this.assisted) {
      this.assist.standDown();
    }
    const wasListening = this.assist.listening;
    const decision = this.assist.process(frame);
    const deciding = wasListening || this.assist.listening || decision?.kind === 'confirmed';

    for (const e of trackerEvents) {
      if (e.type === 'off') {
        if (this.suppressed.delete(e.midi)) continue;
        if (this.held.some(h => h.midi === e.midi)) this.held.push(e);
        else out.push(e);
        continue;
      }
      if (this.assisted && frame.onsetSerial === this.assisted.serial && e.time <= this.assisted.time + 600) {
        this.suppressed.add(e.midi); // same attack as the assisted note
        continue;
      }
      if (e.midi !== exp && deciding) this.held.push(e);
      else out.push(e);
    }

    if (decision?.kind === 'confirmed') {
      for (const h of this.held) if (h.type === 'on') this.suppressed.add(h.midi);
      // offs of held notes were held too; their notes were never reported
      for (const h of this.held) if (h.type === 'off') this.suppressed.delete(h.midi);
      this.held = [];
      out.push(...this.releaseSounding(decision.event.time));
      out.push(decision.event);
      this.sounding = decision.event.midi;
      this.assisted = { midi: decision.event.midi, serial: frame.onsetSerial, time: decision.event.time };
      this.lowFrames = 0;
    } else if (decision?.kind === 'released' || (!this.assist.listening && this.held.length)) {
      out.push(...this.flushHeld());
    }

    for (const e of out) if (e.type === 'on') this.assist.noteEmitted(frame.time);

    // release the assisted note when the sound dies away
    if (this.sounding !== null) {
      if (frame.level < frame.gate * 0.5) {
        if (++this.lowFrames >= 3) out.push(...this.releaseSounding(frame.time));
      } else this.lowFrames = 0;
    }
    return out;
  }

  private flushHeld(): TrackerEvent[] {
    const out = this.held;
    this.held = [];
    return out;
  }

  private releaseSounding(time: number): TrackerEvent[] {
    if (this.sounding === null) return [];
    const m = this.sounding;
    this.sounding = null;
    return [{ type: 'off', midi: m, time, velocity: 0 }];
  }
}

/**
 * Build the assist's view of one analysed frame. Shared by MicInput and the
 * offline tests so both run exactly the same logic. Notes below C3 are judged
 * on a longer window (`longBuf`, ≥ 8192 samples) – semitones in the bass are
 * only a few Hz apart.
 */
export function buildAssistFrame(a: {
  expected: number | null;
  time: number;
  level: number;
  gate: number;
  onsetSerial: number;
  onsetTime: number;
  sampleRate: number;
  analyzer: FrameAnalyzer;
  longBuf?: Float32Array;
  longSpec?: Float32Array;
  blocked?: boolean;
  defer?: boolean;
}): AssistFrame {
  const exp = a.expected;
  const sr = a.sampleRate;
  const long = exp !== null && exp < LONG_WINDOW_BELOW && !!a.longBuf && a.longBuf.length >= LONG_WINDOW;
  let longSpec: Float32Array | null = null;
  const spec = (): Float32Array => {
    if (!long) return a.analyzer.spectrum();
    if (!longSpec) {
      const buf = a.longBuf as Float32Array;
      longSpec = computeSpectrum(buf.subarray(buf.length - LONG_WINDOW), {
        fftSize: LONG_WINDOW * 2,
        windowLength: LONG_WINDOW,
        out: a.longSpec,
      });
    }
    return longSpec;
  };
  const fft = long ? LONG_WINDOW * 2 : a.analyzer.fftSize;
  const win = long ? LONG_WINDOW : a.analyzer.pitchWindow;
  return {
    time: a.time,
    level: a.level,
    gate: a.gate,
    onsetSerial: a.onsetSerial,
    onsetTime: a.onsetTime,
    blocked: a.blocked,
    defer: a.defer,
    partials: () => (exp === null ? [] : notePartials(spec(), sr, fft, exp)),
    subs: () => (exp === null ? [] : subFundamentals(spec(), sr, fft, exp)),
    present: () => exp !== null && verifyChord(spec(), sr, fft, [exp], { windowLength: win }).present[0],
    supported: () => exp !== null && hasPitchSupport(spec(), sr, fft, exp),
  };
}
