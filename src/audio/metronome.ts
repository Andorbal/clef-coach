/**
 * Sample-accurate metronome ("A Tale of Two Clocks" lookahead scheduler).
 *
 * A 25 ms setInterval wakes up and schedules every click that falls within
 * the next 100 ms on the AudioContext clock, so clicks are sample-accurate
 * even if the main thread is busy. Visual/logic callbacks (onBeat) are
 * delivered with setTimeout aimed at the moment the click is actually HEARD
 * (output latency included where the browser reports it).
 *
 * The beat grid is anchored in context time; use {@link Metronome.beatTime}
 * plus {@link ctxTimeToPerfNow} to compare input events (performance.now()
 * timestamps) with the grid.
 */
import {
  ctxTimeToPerfNow,
  getAudioContext,
  getBus,
  markAppSound,
  perfNowToCtxTime,
} from './context';
import { renderClickSamples } from './sounds';

export { ctxTimeToPerfNow, perfNowToCtxTime };

export interface BeatInfo {
  /** Beat within the bar, 0-based (0 = downbeat). */
  beat: number;
  /** Bar number: 0 is the first bar after the count-in; count-in bars are negative. */
  bar: number;
  /** AudioContext time of the click. */
  time: number;
  isCountIn: boolean;
}

export interface MetronomeStartOptions {
  bpm: number;
  beatsPerBar: number;
  /** Bars of count-in before bar 0 (default 0). */
  countIn?: number;
  onBeat?: (info: BeatInfo) => void;
  /** Click volume 0..1 (default: current volume). 0 = silent visual metronome. */
  volume?: number;
  /**
   * Silence the clicks AFTER the count-in (the count-in still sounds so the
   * player gets the tempo); onBeat keeps firing. Default false.
   */
  muted?: boolean;
  /** Softer clicks between the beats: 1 (none), 2 (eighths), 3 (triplets), 4 (sixteenths). Default 1. */
  subdivision?: number;
  /** Accent the first beat of each bar (default true). */
  accent?: boolean;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const START_DELAY_S = 0.12;

function clampBpm(bpm: number): number {
  return Math.min(400, Math.max(20, Number.isFinite(bpm) ? bpm : 100));
}

const clickCache = new Map<string, AudioBuffer>();

function clickBuffer(ctx: AudioContext, accent: boolean, sub = false): AudioBuffer {
  const key = `${ctx.sampleRate}:${accent ? 1 : 0}:${sub ? 1 : 0}`;
  let b = clickCache.get(key);
  if (!b) {
    const s = renderClickSamples(accent, ctx.sampleRate, sub);
    b = ctx.createBuffer(1, s.length, ctx.sampleRate);
    b.getChannelData(0).set(s);
    clickCache.set(key, b);
  }
  return b;
}

export class Metronome {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly timeouts = new Set<ReturnType<typeof setTimeout>>();
  private readonly sources = new Set<AudioBufferSourceNode>();
  private out: GainNode | null = null;
  private bpm = 100;
  private beatsPerBar = 4;
  private countInBeats = 0;
  /** Absolute beat index (0 = first count-in beat) of the next beat to schedule. */
  private nextIndex = 0;
  /** Tempo anchor: absolute beat `anchorIndex` happens at context time `anchorTime`. */
  private anchorIndex = 0;
  private anchorTime = 0;
  private _startTime = 0;
  private _running = false;
  private volume = 0.8;
  private muted = false;
  private subdivision = 1;
  private accent = true;
  private onBeat?: (info: BeatInfo) => void;

  get running(): boolean {
    return this._running;
  }

  /** Context time of beat 0 of bar 0 (i.e. right after the count-in). */
  get startTime(): number {
    return this._startTime;
  }

  get secondsPerBeat(): number {
    return 60 / this.bpm;
  }

  get tempo(): number {
    return this.bpm;
  }

  /**
   * Context time of beat `n` counted from bar 0 / beat 0 (negative = count-in),
   * following tempo changes made with setBpm.
   */
  beatTime(n: number): number {
    return this.timeOfIndex(n + this.countInBeats);
  }

  /** Mute/unmute the clicks after the count-in (takes effect from the next scheduled beat). */
  setMuted(m: boolean): void {
    this.muted = !!m;
  }

  /** Change the subdivision clicks (from the next scheduled beat). */
  setSubdivision(n: number): void {
    this.subdivision = Math.max(1, Math.min(6, Math.round(n)));
  }

  setAccent(on: boolean): void {
    this.accent = on;
  }

  /** Change beats per bar from the next bar line on (keeps the beat grid). */
  setBeatsPerBar(n: number): void {
    this.beatsPerBar = Math.max(1, Math.round(n));
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.out) this.out.gain.setTargetAtTime(this.volume, this.out.context.currentTime, 0.01);
  }

  start(opts: MetronomeStartOptions): void {
    this.stop();
    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return;
    }
    if ((ctx.state as string) !== 'running') ctx.resume().catch(() => {});
    if (opts.volume !== undefined) this.volume = Math.min(1, Math.max(0, opts.volume));
    this.muted = !!opts.muted;
    this.subdivision = Math.max(1, Math.min(6, Math.round(opts.subdivision ?? 1)));
    this.accent = opts.accent ?? true;
    this.bpm = clampBpm(opts.bpm);
    this.beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar || 4));
    this.countInBeats = Math.max(0, Math.round((opts.countIn ?? 0) * this.beatsPerBar));
    this.onBeat = opts.onBeat;
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    this.out.connect(getBus('metronome'));
    // warm the click buffers before the first beat
    clickBuffer(ctx, true);
    clickBuffer(ctx, false);
    this.anchorIndex = 0;
    this.anchorTime = ctx.currentTime + START_DELAY_S;
    this.nextIndex = 0;
    this._startTime = this.timeOfIndex(this.countInBeats);
    this._running = true;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop(): void {
    this._running = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const t of this.timeouts) clearTimeout(t);
    this.timeouts.clear();
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.sources.clear();
    if (this.out) {
      const out = this.out;
      setTimeout(() => out.disconnect(), 200);
      this.out = null;
    }
  }

  /** Change tempo from the next unscheduled beat on (grid stays continuous). */
  setBpm(bpm: number): void {
    const nb = clampBpm(bpm);
    if (!this._running) {
      this.bpm = nb;
      return;
    }
    this.anchorTime = this.timeOfIndex(this.nextIndex);
    this.anchorIndex = this.nextIndex;
    this.bpm = nb;
    if (this.nextIndex <= this.countInBeats) this._startTime = this.timeOfIndex(this.countInBeats);
  }

  private timeOfIndex(i: number): number {
    return this.anchorTime + ((i - this.anchorIndex) * 60) / this.bpm;
  }

  private schedule(): void {
    if (!this._running) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const horizon = now + SCHEDULE_AHEAD_S;
    let guard = 0;
    while (this.timeOfIndex(this.nextIndex) < horizon && guard++ < 64) {
      const idx = this.nextIndex++;
      const t = this.timeOfIndex(idx);
      // If we fell behind (tab hidden / context suspended) skip missed beats
      // instead of firing a burst of clicks.
      if (t < now - 0.03) continue;
      this.scheduleBeat(ctx, idx, t);
    }
  }

  private scheduleBeat(ctx: AudioContext, index: number, t: number): void {
    const rel = index - this.countInBeats;
    const bpb = this.beatsPerBar;
    const beat = ((rel % bpb) + bpb) % bpb;
    const bar = Math.floor(rel / bpb);
    const isCountIn = index < this.countInBeats;

    if (this.out && this.volume > 0 && (isCountIn || !this.muted)) {
      const click = (at: number, accent: boolean, sub: boolean) => {
        const src = ctx.createBufferSource();
        src.buffer = clickBuffer(ctx, accent, sub);
        src.connect(this.out!);
        src.onended = () => {
          src.disconnect();
          this.sources.delete(src);
        };
        src.start(at);
        this.sources.add(src);
        markAppSound(at + 0.05, { from: at, kind: 'click' });
      };
      click(t, beat === 0 && (this.accent || isCountIn), false);
      if (!isCountIn && this.subdivision > 1) {
        const step = (this.timeOfIndex(index + 1) - t) / this.subdivision;
        for (let k = 1; k < this.subdivision; k++) click(t + k * step, false, true);
      }
    }

    const cb = this.onBeat;
    if (cb) {
      const delay = Math.max(0, ctxTimeToPerfNow(t) - performance.now());
      const id = setTimeout(() => {
        this.timeouts.delete(id);
        if (!this._running) return;
        try {
          cb({ beat, bar, time: t, isCountIn });
        } catch (err) {
          console.error(err);
        }
      }, delay);
      this.timeouts.add(id);
    }
  }
}
