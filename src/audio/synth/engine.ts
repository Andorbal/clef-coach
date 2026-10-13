/**
 * Playback engine for the synthesised instruments.
 *
 * Each (instrument, key, velocity-bucket) is rendered ONCE by the pure
 * renderers straight into an AudioBuffer's channel data and cached (LRU,
 * memory-capped). A note is then just
 *
 *   AudioBufferSourceNode → GainNode (velocity level + release envelope)
 *                         → StereoPannerNode (piano keyboard image) → synth bus
 *
 * which is about as cheap as Web Audio gets, so dense chords and fast
 * passages are fine on an iPad mini. Velocity changes timbre via the bucket
 * (soft / medium / hard renders) and level continuously via the gain.
 */
import {
  getAudioContext,
  getBus,
  markAppSound,
  onAudioStateChange,
  updateAppSoundMark,
} from '../context';
import type { AppSoundMark } from '../context';
import { clamp, interp } from '../dsp/util';
import { guitarNoteLength, renderGuitarSamples } from './guitar';
import { pianoNoteLength, renderPianoSamples } from './piano';

export type SynthVoice = 'piano' | 'guitar';

export interface PlayOptions {
  /** 0..1, default 0.7 */
  velocity?: number;
  /** Seconds until key-up; default: let it ring (natural decay). */
  duration?: number;
  /** AudioContext time to start; default: now. */
  when?: number;
  /** Instrument; default: the current voice (see setVoice). */
  voice?: SynthVoice;
}

export interface SequenceEvent {
  midi: number[];
  /** Seconds from now. */
  at: number;
  /** Seconds the notes are held. */
  duration: number;
  /** Optional per-event velocity (default 0.7). */
  velocity?: number;
}

export interface SequenceHandle {
  stop(): void;
  /** Context time at which the last note is released. */
  readonly endTime: number;
}

const DEFAULT_VELOCITY = 0.7;
/** Render velocities for the three timbre buckets. */
const BUCKET_VELOCITY = [0.32, 0.62, 0.9];
const MAX_VOICES = 48;
const CACHE_BUDGET_BYTES = 48 * 1024 * 1024;
/** How long a voice that was queued while the context was suspended may still sound. */
const STALE_MS = 400;

function bucketOf(v: number): number {
  return v < 0.45 ? 0 : v < 0.78 ? 1 : 2;
}

/** Velocity → linear level (≈ 22 dB dynamic range). */
function velocityGain(v: number): number {
  return 0.08 + 0.92 * Math.pow(clamp(v, 0, 1), 1.6);
}

/** Output trim per instrument so both sit at a similar loudness. */
const VOICE_TRIM: Record<SynthVoice, number> = { piano: 0.55, guitar: 0.6 };

/** Key-up release time constant (s). Top piano octave has no dampers → longer. */
function releaseTau(voice: SynthVoice, midi: number): number {
  if (voice === 'guitar') return 0.035;
  return midi >= 89 ? 0.25 : 0.04;
}

/** Roughly how long a note stays clearly audible (for the mic's self-hearing guard). */
function audibleSeconds(voice: SynthVoice, midi: number): number {
  return voice === 'piano'
    ? interp([[21, 3.2], [48, 2.4], [60, 1.9], [84, 1.1], [108, 0.5]], midi)
    : interp([[40, 2.6], [64, 1.7], [88, 0.9]], midi);
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode | null;
  midi: number;
  voice: SynthVoice;
  level: number;
  start: number;
  releasedAt: number | null;
  mark: AppSoundMark;
  /** performance.now() when queued on a non-running context, else null. */
  queuedSuspendedAt: number | null;
  onEnd?: () => void;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 120 });
    else setTimeout(resolve, 0);
  });
}

class BufferCache {
  private readonly map = new Map<string, AudioBuffer>();
  private bytes = 0;

  get(key: string): AudioBuffer | undefined {
    const b = this.map.get(key);
    if (b) {
      // LRU: move to the end
      this.map.delete(key);
      this.map.set(key, b);
    }
    return b;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, buf: AudioBuffer): void {
    this.map.set(key, buf);
    this.bytes += buf.length * buf.numberOfChannels * 4;
    for (const [k, b] of this.map) {
      if (this.bytes <= CACHE_BUDGET_BYTES || k === key) break;
      this.map.delete(k);
      this.bytes -= b.length * b.numberOfChannels * 4;
    }
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }
}

export class SynthEngine {
  private voiceType: SynthVoice = 'piano';
  private readonly held = new Map<number, Voice>();
  private readonly active = new Set<Voice>();
  private readonly sequences = new Set<SequenceHandle>();
  private readonly cache = new BufferCache();
  private cacheRate = 0;
  private stateHooked = false;

  setVoice(v: SynthVoice): void {
    this.voiceType = v;
  }

  getVoice(): SynthVoice {
    return this.voiceType;
  }

  /** Get (rendering on first use) the buffer for a note. */
  getBuffer(voice: SynthVoice, midi: number, velocity = DEFAULT_VELOCITY): AudioBuffer {
    const ctx = getAudioContext();
    if (this.cacheRate !== ctx.sampleRate) {
      this.cache.clear();
      this.cacheRate = ctx.sampleRate;
    }
    const m = Math.round(midi);
    const b = bucketOf(velocity);
    const key = `${voice}:${m}:${b}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const sr = ctx.sampleRate;
    const len = voice === 'piano' ? pianoNoteLength(m, sr) : guitarNoteLength(m, sr);
    const buf = ctx.createBuffer(1, len, sr);
    // Render straight into the buffer's memory – no extra copy.
    const data = buf.getChannelData(0);
    if (voice === 'piano') renderPianoSamples(m, BUCKET_VELOCITY[b], sr, { out: data });
    else renderGuitarSamples(m, BUCKET_VELOCITY[b], sr, { out: data });
    this.cache.set(key, buf);
    return buf;
  }

  private hookState(): void {
    if (this.stateHooked) return;
    this.stateHooked = true;
    onAudioStateChange((state) => {
      if (state !== 'running') return;
      // Drop notes that were queued while audio was locked/suspended and are
      // now stale – otherwise they would all blast out at once on resume.
      const nowMs = performance.now();
      for (const v of this.active) {
        if (v.queuedSuspendedAt !== null && nowMs - v.queuedSuspendedAt > STALE_MS) this.kill(v);
      }
    });
  }

  private startVoice(midi: number, opts: PlayOptions): Voice | null {
    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return null; // no Web Audio
    }
    this.hookState();
    const running = (ctx.state as string) === 'running';
    if (!running) ctx.resume().catch(() => {});
    const voice = opts.voice ?? this.voiceType;
    const vel = clamp(opts.velocity ?? DEFAULT_VELOCITY, 0, 1);
    const m = Math.round(midi);
    if (!(m >= 0 && m <= 127)) return null;
    const buffer = this.getBuffer(voice, m, vel);
    const now = ctx.currentTime;
    const start = Math.max(now, opts.when ?? now);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    const level = velocityGain(vel) * VOICE_TRIM[voice];
    gain.gain.setValueAtTime(level, now);
    src.connect(gain);
    let pan: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      // Piano: low notes slightly left, high slightly right (player's perspective).
      pan.pan.value = voice === 'piano' ? clamp((m - 64) / 48, -1, 1) * 0.35 : 0.05;
      gain.connect(pan);
      pan.connect(getBus('synth'));
    } else {
      gain.connect(getBus('synth'));
    }

    const audible = Math.min(buffer.duration, audibleSeconds(voice, m));
    const mark = markAppSound(start + audible, { from: start, midis: [m], kind: 'tonal' });
    const v: Voice = {
      src,
      gain,
      pan,
      midi: m,
      voice,
      level,
      start,
      releasedAt: null,
      mark,
      queuedSuspendedAt: running ? null : performance.now(),
    };
    src.onended = () => {
      try {
        src.disconnect();
        gain.disconnect();
        pan?.disconnect();
      } catch {
        /* ignore */
      }
      this.active.delete(v);
      if (this.held.get(m) === v) this.held.delete(m);
      v.onEnd?.();
    };
    src.start(start);
    this.active.add(v);
    this.enforcePolyphony();
    if (opts.duration !== undefined && Number.isFinite(opts.duration)) {
      this.release(v, start + Math.max(0.02, opts.duration));
    }
    return v;
  }

  private enforcePolyphony(): void {
    if (this.active.size <= MAX_VOICES) return;
    // Steal the oldest voices, preferring ones already releasing.
    const sorted = [...this.active].sort(
      (a, b) => (a.releasedAt === null ? 1 : 0) - (b.releasedAt === null ? 1 : 0) || a.start - b.start,
    );
    for (let i = 0; i < sorted.length && this.active.size > MAX_VOICES; i++) this.kill(sorted[i]);
  }

  /** Begin the key-up fade at context time `at`. */
  private release(v: Voice, at: number, tau = releaseTau(v.voice, v.midi)): void {
    const ctx = getAudioContext();
    const t = Math.max(at, ctx.currentTime);
    if (v.releasedAt !== null && v.releasedAt <= t) return;
    v.releasedAt = t;
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(v.level, t);
    g.setTargetAtTime(0, t, tau);
    const stopAt = t + tau * 7;
    try {
      v.src.stop(stopAt);
    } catch {
      /* already stopped */
    }
    if (v.mark.until > t + tau * 3) updateAppSoundMark(v.mark, t + tau * 3);
  }

  /** Stop a voice almost immediately (voice stealing / stale notes). */
  private kill(v: Voice): void {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    v.releasedAt = now;
    const g = v.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, 0.012);
    try {
      v.src.stop(now + 0.08);
    } catch {
      /* ignore */
    }
    updateAppSoundMark(v.mark, now + 0.05);
    this.active.delete(v);
    if (this.held.get(v.midi) === v) this.held.delete(v.midi);
  }

  /** Key down: sounds until noteOff (or natural decay). Re-striking a held key re-attacks it. */
  noteOn(midi: number, opts: PlayOptions = {}): void {
    const m = Math.round(midi);
    const prev = this.held.get(m);
    if (prev) this.release(prev, opts.when ?? getAudioContext().currentTime, 0.03);
    const v = this.startVoice(m, opts);
    if (v) this.held.set(m, v);
  }

  /** Key up. */
  noteOff(midi: number, when?: number): void {
    const m = Math.round(midi);
    const v = this.held.get(m);
    if (!v) return;
    this.held.delete(m);
    this.release(v, when ?? getAudioContext().currentTime);
  }

  /** One-shot note or chord. Guitar chords are gently strummed low → high. */
  play(midi: number | number[], opts: PlayOptions = {}): void {
    const notes = (Array.isArray(midi) ? midi : [midi]).slice().sort((a, b) => a - b);
    const voice = opts.voice ?? this.voiceType;
    let base: number;
    try {
      base = opts.when ?? getAudioContext().currentTime;
    } catch {
      return;
    }
    const strum = voice === 'guitar' && notes.length > 1 ? 0.014 : 0;
    notes.forEach((m, i) => {
      this.startVoice(m, { ...opts, voice, when: base + i * strum });
    });
  }

  /**
   * Schedule a sequence (e.g. a demo melody). Notes are scheduled just ahead
   * of time on the audio clock (sample-accurate) and rendered lazily.
   */
  playSequence(events: SequenceEvent[], voice?: SynthVoice): SequenceHandle {
    const v = voice ?? this.voiceType;
    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return { stop() {}, endTime: 0 };
    }
    const sorted = events
      .filter((e) => e && Array.isArray(e.midi) && Number.isFinite(e.at))
      .slice()
      .sort((a, b) => a.at - b.at);
    // `at` is relative to the context time NOW (callers often compute it from
    // getAudioContext().currentTime to line up with a metronome grid).
    const t0 = ctx.currentTime;
    const endTime = sorted.reduce((mx, e) => Math.max(mx, t0 + e.at + Math.max(0, e.duration)), t0);
    // Warm the cache for every distinct note in idle time.
    void this.preload(v, [...new Set(sorted.flatMap((e) => e.midi))]);

    const voices = new Set<Voice>();
    let idx = 0;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const pump = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const horizon = now + 0.3;
      while (idx < sorted.length && t0 + sorted[idx].at < horizon) {
        const ev = sorted[idx++];
        const when = t0 + ev.at;
        if (when < now - 0.05) continue; // fell behind (tab hidden): skip, don't burst
        const strum = v === 'guitar' && ev.midi.length > 1 ? 0.014 : 0;
        ev.midi
          .slice()
          .sort((a, b) => a - b)
          .forEach((m, i) => {
            const vo = this.startVoice(m, { voice: v, velocity: ev.velocity ?? DEFAULT_VELOCITY, when: when + i * strum });
            if (!vo) return;
            voices.add(vo);
            vo.onEnd = () => voices.delete(vo);
            this.release(vo, when + Math.max(0.02, ev.duration));
          });
      }
      if (idx >= sorted.length && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const handle: SequenceHandle = {
      endTime,
      stop: () => {
        if (stopped) return;
        stopped = true;
        if (timer !== null) clearInterval(timer);
        const now = ctx.currentTime;
        for (const vo of voices) {
          if (vo.start > now) this.kill(vo);
          else this.release(vo, now, 0.03);
        }
        voices.clear();
        this.sequences.delete(handle);
      },
    };
    this.sequences.add(handle);
    timer = setInterval(pump, 40);
    pump();
    return handle;
  }

  /** Silence everything (quick fade) and cancel sequences. */
  stopAll(): void {
    for (const s of [...this.sequences]) s.stop();
    if (this.active.size === 0) return;
    const now = getAudioContext().currentTime;
    for (const v of [...this.active]) {
      if (v.start > now) this.kill(v);
      else this.release(v, now, 0.025);
    }
    this.held.clear();
  }

  /**
   * Render buffers ahead of time, one note per idle slice, so the first
   * notes of a lesson never hitch. Safe to call before audio is unlocked.
   */
  async preload(voice: SynthVoice, midis: number[], velocity = DEFAULT_VELOCITY): Promise<void> {
    let sr: number;
    try {
      sr = getAudioContext().sampleRate;
    } catch {
      return;
    }
    const b = bucketOf(velocity);
    for (const m of [...new Set(midis.map((x) => Math.round(x)))]) {
      if (!(m >= 0 && m <= 127)) continue;
      if (this.cacheRate === sr && this.cache.has(`${voice}:${m}:${b}`)) continue;
      await yieldToMain();
      this.getBuffer(voice, m, velocity);
    }
  }
}
