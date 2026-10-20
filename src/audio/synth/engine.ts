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
import { MALLET_VARIANTS, type SynthVoiceId } from '../../music/instruments';
import { bowedLoop, bowedNoteLength, bowedRelease, isBowedVoice, renderBowedSamples } from './bowed';
import { epianoAudibleSeconds, epianoNoteLength, renderEPianoSamples } from './epiano';
import { guitarNoteLength, renderGuitarSamples } from './guitar';
import { type MalletVoice, malletAudibleSeconds, malletNoteLength, renderMalletSamples } from './mallets';
import { pianoNoteLength, renderPianoSamples } from './piano';

export type SynthVoice = SynthVoiceId;

const isPlucked = (v: SynthVoice): v is 'guitar' | 'ukulele' | 'bass' => v === 'guitar' || v === 'ukulele' || v === 'bass';
const isMalletVoice = (v: SynthVoice): v is MalletVoice => v === 'marimba' || v === 'xylophone' || v === 'glockenspiel' || v === 'vibraphone';

/**
 * Semitones a voice sounds above the written note it is given (xylophone 12,
 * glockenspiel 24): mallet music is played in written pitch.
 */
export function voiceOffset(v: SynthVoice): number {
  return isMalletVoice(v) ? MALLET_VARIANTS[v].offset : 0;
}

export interface PlayOptions {
  /** 0..1, default 0.7 */
  velocity?: number;
  /** Seconds until key-up; default: let it ring (natural decay). */
  duration?: number;
  /** AudioContext time to start; default: now. */
  when?: number;
  /** Instrument; default: the current voice (see setVoice). */
  voice?: SynthVoice;
  /** Where the note goes (default: the synth bus). A band track passes its channel strip. */
  destination?: AudioNode;
  /**
   * Stereo position −1..1 (default: keyboards spread low-left / high-right, others centred).
   * Ignored when there's no StereoPannerNode.
   */
  pan?: number;
  /**
   * Intervals at which the microphone could mistake this note for one the player plays
   * (see markAppSound); false = don't tell the microphone at all. Default: the usual set.
   */
  mark?: readonly number[] | false;
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
/** Default memory for rendered notes; raised on devices with plenty (see setSynthCacheBudget). */
const CACHE_BUDGET_BYTES = 48 * 1024 * 1024;
let cacheBudget = CACHE_BUDGET_BYTES;

/** How much memory rendered notes may keep (bytes). Rendering again costs CPU, not sound. */
export function setSynthCacheBudget(bytes: number): void {
  cacheBudget = Math.max(8 * 1024 * 1024, bytes);
}

export function getSynthCacheBudget(): number {
  return cacheBudget;
}
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
const VOICE_TRIM: Record<SynthVoice, number> = {
  piano: 0.55,
  epiano: 0.55,
  guitar: 0.6,
  ukulele: 0.6,
  bass: 0.72,
  marimba: 0.62,
  xylophone: 0.5,
  glockenspiel: 0.42,
  vibraphone: 0.55,
  violin: 0.62,
  viola: 0.66,
  cello: 0.7,
  doublebass: 0.8,
};

/**
 * A bowed note's sustain loops until it is released (see bowed.ts). One that is never
 * released (a lost key-up) still stops after this long, and a one-shot without a length
 * (a "hear it" button) gets a bow stroke's worth.
 */
const MAX_BOW_SECONDS = 16;
const BOW_STROKE_SECONDS = 1.2;

/**
 * Key-up release time constant (s). Top piano octave has no dampers → longer.
 * A struck bar keeps ringing after the mallet leaves it, so mallet "releases" are
 * gentle (the vibraphone's pedal is down).
 */
function releaseTau(voice: SynthVoice, midi: number): number {
  if (isPlucked(voice)) return voice === 'bass' ? 0.05 : 0.035;
  if (isBowedVoice(voice)) return bowedRelease(voice);
  if (voice === 'vibraphone') return 0.45;
  if (isMalletVoice(voice)) return 0.22;
  return midi >= 89 ? 0.25 : 0.04;
}

/** Roughly how long a (sounding) note stays clearly audible (for the mic's self-hearing guard). */
function audibleSeconds(voice: SynthVoice, midi: number): number {
  if (voice === 'piano') return interp([[21, 3.2], [48, 2.4], [60, 1.9], [84, 1.1], [108, 0.5]], midi);
  if (voice === 'epiano') return epianoAudibleSeconds(midi);
  if (isMalletVoice(voice)) return malletAudibleSeconds(voice, midi);
  if (isBowedVoice(voice)) return MAX_BOW_SECONDS;
  const base = interp([[28, 3.0], [40, 2.6], [64, 1.7], [88, 0.9]], midi);
  return voice === 'ukulele' ? base * 0.7 : voice === 'bass' ? base * 1.2 : base;
}

/**
 * Another sound for a voice — a sampled instrument from a sound bank — played instead of
 * the rendered one, or layered with it.
 */
export interface ExternalVoice {
  /** Start a note (sounding pitch) at `when` into `out`; null if it can't play it (yet). */
  noteOn(midi: number, velocity: number, when: number, out: AudioNode): ExternalNote | null;
  /** Get these notes ready (decode their samples). */
  prepare?(notes: { midi: number; velocity: number }[]): Promise<unknown>;
}

export interface ExternalNote {
  release(at: number): void;
  stop(at?: number): void;
}

interface Voice {
  /** The rendered note (null when an external sound plays instead). */
  src: AudioBufferSourceNode | null;
  gain: GainNode | null;
  pan: StereoPannerNode | null;
  /** An external sound's note, instead of or with the rendered one. */
  ext?: ExternalNote;
  midi: number;
  voice: SynthVoice;
  level: number;
  start: number;
  releasedAt: number | null;
  mark: AppSoundMark | null;
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
      if (this.bytes <= cacheBudget || k === key) break;
      this.map.delete(k);
      this.bytes -= b.length * b.numberOfChannels * 4;
    }
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }

  get size(): number {
    return this.bytes;
  }
}

/** One cache for every engine (the app's instrument and the band render the same notes). */
const sharedCache = new BufferCache();
let sharedCacheRate = 0;

/** Bytes of rendered notes held in memory. */
export function synthCacheBytes(): number {
  return sharedCache.size;
}

export class SynthEngine {
  private voiceType: SynthVoice = 'piano';
  private readonly held = new Map<number, Voice>();
  private readonly active = new Set<Voice>();
  private readonly sequences = new Set<SequenceHandle>();
  private readonly cache = sharedCache;
  private stateHooked = false;
  private readonly maxVoices: number;
  private readonly externals = new Map<SynthVoice, { ext: ExternalVoice; layer: boolean }>();

  constructor(opts: { maxVoices?: number } = {}) {
    this.maxVoices = opts.maxVoices ?? MAX_VOICES;
  }

  setVoice(v: SynthVoice): void {
    this.voiceType = v;
  }

  /** Play a voice through another sound (a sampled instrument), instead of the rendered one or layered with it. */
  setExternal(voice: SynthVoice, ext: ExternalVoice | null, layer = false): void {
    if (ext) this.externals.set(voice, { ext, layer });
    else this.externals.delete(voice);
  }

  hasExternal(voice: SynthVoice): boolean {
    return this.externals.has(voice);
  }

  getVoice(): SynthVoice {
    return this.voiceType;
  }

  /** Get (rendering on first use) the buffer for a note. */
  getBuffer(voice: SynthVoice, midi: number, velocity = DEFAULT_VELOCITY): AudioBuffer {
    const ctx = getAudioContext();
    if (sharedCacheRate !== ctx.sampleRate) {
      this.cache.clear();
      sharedCacheRate = ctx.sampleRate;
    }
    const m = Math.round(midi);
    const b = bucketOf(velocity);
    const key = `${voice}:${m}:${b}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const sr = ctx.sampleRate;
    const len =
      voice === 'piano'
        ? pianoNoteLength(m, sr)
        : voice === 'epiano'
          ? epianoNoteLength(m, sr)
          : isMalletVoice(voice)
            ? malletNoteLength(voice, m, sr)
            : isBowedVoice(voice)
              ? bowedNoteLength(voice, sr)
              : guitarNoteLength(m, sr, voice);
    const buf = ctx.createBuffer(1, len, sr);
    // Render straight into the buffer's memory – no extra copy.
    const data = buf.getChannelData(0);
    if (voice === 'piano') renderPianoSamples(m, BUCKET_VELOCITY[b], sr, { out: data });
    else if (voice === 'epiano') renderEPianoSamples(m, BUCKET_VELOCITY[b], sr, { out: data });
    else if (isMalletVoice(voice)) renderMalletSamples(voice, m, BUCKET_VELOCITY[b], sr, { out: data });
    else if (isBowedVoice(voice)) renderBowedSamples(voice, m, BUCKET_VELOCITY[b], sr, { out: data });
    else renderGuitarSamples(m, BUCKET_VELOCITY[b], sr, { out: data, variant: voice });
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
    // `midi` is the written note; transposing voices (xylophone, glockenspiel) sound higher
    const written = Math.round(midi);
    const m = written + voiceOffset(voice);
    if (!(m >= 0 && m <= 127)) return null;
    const now = ctx.currentTime;
    const start = Math.max(now, opts.when ?? now);
    const external = this.externals.get(voice);
    const extNote = external?.ext.noteOn(m, vel, start, opts.destination ?? getBus('synth')) ?? undefined;
    if (extNote && !external!.layer) {
      // the sampled sound alone
      const mark = opts.mark === false ? null : markAppSound(start + 2, { from: start, midis: [m], kind: 'tonal', intervals: opts.mark });
      const v: Voice = { src: null, gain: null, pan: null, ext: extNote, midi: written, voice, level: 1, start, releasedAt: null, mark, queuedSuspendedAt: running ? null : performance.now() };
      this.active.add(v);
      this.enforcePolyphony();
      if (opts.duration !== undefined && Number.isFinite(opts.duration)) this.release(v, start + Math.max(0.02, opts.duration));
      return v;
    }
    const buffer = this.getBuffer(voice, m, vel);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bowed = isBowedVoice(voice);
    if (bowed) {
      // the sustain loops until the note is released
      const loop = bowedLoop(voice, buffer.sampleRate);
      src.loop = true;
      src.loopStart = loop.start / buffer.sampleRate;
      src.loopEnd = loop.end / buffer.sampleRate;
    }
    const gain = ctx.createGain();
    const level = velocityGain(vel) * VOICE_TRIM[voice];
    gain.gain.setValueAtTime(level, now);
    src.connect(gain);
    let pan: StereoPannerNode | null = null;
    const out = opts.destination ?? getBus('synth');
    if (typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      // Keyboards and mallets: low notes slightly left, high slightly right (player's perspective).
      pan.pan.value = opts.pan ?? (voice === 'piano' || voice === 'epiano' || isMalletVoice(voice) ? clamp((m - 64 - voiceOffset(voice)) / 48, -1, 1) * 0.35 : 0.05);
      gain.connect(pan);
      pan.connect(out);
    } else {
      gain.connect(out);
    }

    const audible = bowed ? MAX_BOW_SECONDS : Math.min(buffer.duration, audibleSeconds(voice, m));
    const mark = opts.mark === false ? null : markAppSound(start + audible, { from: start, midis: [m], kind: 'tonal', intervals: opts.mark });
    const v: Voice = {
      src,
      gain,
      pan,
      midi: written,
      voice,
      level,
      start,
      releasedAt: null,
      mark,
      queuedSuspendedAt: running ? null : performance.now(),
      ext: extNote,
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
      if (this.held.get(written) === v) this.held.delete(written);
      v.onEnd?.();
    };
    src.start(start);
    this.active.add(v);
    this.enforcePolyphony();
    if (opts.duration !== undefined && Number.isFinite(opts.duration)) {
      this.release(v, start + Math.max(0.02, opts.duration));
    } else if (bowed) {
      this.release(v, start + MAX_BOW_SECONDS);
    }
    return v;
  }

  private enforcePolyphony(): void {
    if (this.active.size <= this.maxVoices) return;
    // Steal the oldest voices, preferring ones already releasing.
    const sorted = [...this.active].sort(
      (a, b) => (a.releasedAt === null ? 1 : 0) - (b.releasedAt === null ? 1 : 0) || a.start - b.start,
    );
    for (let i = 0; i < sorted.length && this.active.size > this.maxVoices; i++) this.kill(sorted[i]);
  }

  /** Begin the key-up fade at context time `at`. */
  private release(v: Voice, at: number, tau = releaseTau(v.voice, v.midi)): void {
    const ctx = getAudioContext();
    const t = Math.max(at, ctx.currentTime);
    if (v.releasedAt !== null && v.releasedAt <= t) return;
    v.releasedAt = t;
    v.ext?.release(t);
    if (!v.src || !v.gain) {
      // an external sound alone: it fades by itself; forget the voice once it has
      if (v.mark && v.mark.until > t + 0.5) updateAppSoundMark(v.mark, t + 0.5);
      setTimeout(() => {
        this.active.delete(v);
        if (this.held.get(v.midi) === v) this.held.delete(v.midi);
        v.onEnd?.();
      }, Math.max(0, (t - ctx.currentTime) * 1000) + 1500);
      return;
    }
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
    if (v.mark && v.mark.until > t + tau * 3) updateAppSoundMark(v.mark, t + tau * 3);
  }

  /** Stop a voice almost immediately (voice stealing / stale notes). */
  private kill(v: Voice): void {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    v.releasedAt = now;
    v.ext?.stop(now);
    if (v.gain && v.src) {
      const g = v.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(0, now, 0.012);
      try {
        v.src.stop(now + 0.08);
      } catch {
        /* ignore */
      }
    }
    if (v.mark) updateAppSoundMark(v.mark, now + 0.05);
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

  /** One-shot note or chord. Guitar and ukulele chords are gently strummed low → high. */
  play(midi: number | number[], opts: PlayOptions = {}): void {
    const notes = (Array.isArray(midi) ? midi : [midi]).slice().sort((a, b) => a - b);
    const voice = opts.voice ?? this.voiceType;
    let base: number;
    try {
      base = opts.when ?? getAudioContext().currentTime;
    } catch {
      return;
    }
    const strum = (voice === 'guitar' || voice === 'ukulele') && notes.length > 1 ? 0.014 : 0;
    const duration = opts.duration ?? (isBowedVoice(voice) ? BOW_STROKE_SECONDS : undefined);
    notes.forEach((m, i) => {
      this.startVoice(m, { ...opts, voice, duration, when: base + i * strum });
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
        const strum = (v === 'guitar' || v === 'ukulele') && ev.midi.length > 1 ? 0.014 : 0;
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
    const external = this.externals.get(voice);
    if (external?.ext.prepare) {
      await external.ext.prepare(midis.map(m => ({ midi: Math.round(m) + voiceOffset(voice), velocity })));
      if (!external.layer) return;
    }
    let sr: number;
    try {
      sr = getAudioContext().sampleRate;
    } catch {
      return;
    }
    const b = bucketOf(velocity);
    for (const m of [...new Set(midis.map((x) => Math.round(x)))]) {
      if (!(m >= 0 && m <= 127)) continue;
      const sounding = m + voiceOffset(voice);
      if (sharedCacheRate === sr && this.cache.has(`${voice}:${sounding}:${b}`)) continue;
      await yieldToMain();
      this.getBuffer(voice, sounding, velocity);
    }
  }
}
