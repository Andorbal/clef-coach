/**
 * The performer: plays a band's tracks on the audio clock, each through its own
 * channel strip.
 *
 *   track notes → sound (built-in or sampled) → volume → pan ─┬──────────── band bus → master
 *                                                            └ reverb send → shared room
 *
 * Notes are scheduled a few hundred milliseconds ahead from a timer (the same
 * look-ahead the metronome uses), so a long song never creates thousands of nodes at
 * once and the band stays sample-accurate with the metronome and the player's part.
 * Mixer changes (volume, pan, mute, solo, reverb) apply while it plays.
 */
import { getAudioContext, getBus, getReverbInput, markAppSound } from '../audio/context';
import { DrumKitPlayer } from '../audio/synth/drumkit';
import { SynthEngine, voiceOffset } from '../audio/synth/engine';
import { type LiveNote, liveRelease, playLive } from '../audio/synth/live';
import { PPQ } from '../music/rhythm';
import { type BuiltinSound, builtinFor } from './builtin';
import type { PerfNote, PerfTrack } from './types';

/** One track's mixer settings. */
export interface TrackMix {
  /** 0..1 (a perceptual taper is applied) */
  volume: number;
  /** −1..1 */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** reverb send 0..1 */
  reverb: number;
}

export interface BandMix {
  /** Whole band 0..1 */
  master: number;
  /** Room size of the shared reverb, scales every send 0..1 */
  reverb: number;
  tracks: Record<string, Partial<TrackMix>>;
}

export const DEFAULT_MIX: BandMix = { master: 0.8, reverb: 0.5, tracks: {} };

/** A track's mix: what the mixer says, else the track's own defaults. */
export function trackMix(mix: BandMix, track: PerfTrack): TrackMix {
  const t = mix.tracks[track.id] ?? {};
  return {
    volume: t.volume ?? track.volume,
    pan: t.pan ?? track.pan,
    mute: t.mute ?? false,
    solo: t.solo ?? false,
    reverb: t.reverb ?? (track.drums ? 0.35 : track.role === 'bass' ? 0.2 : 0.55),
  };
}

/** Something a track can play its notes through. */
export interface NoteSink {
  /** Get the sounds ready (render or decode) for these notes. */
  prepare(notes: readonly PerfNote[]): Promise<void>;
  /** Play a note at context time `when` for `duration` seconds into `out`. */
  play(midi: number, velocity: number, when: number, duration: number, out: AudioNode): void;
  /** Silence everything it started. */
  stop(): void;
  /** The track's mix changed (a sink that doesn't play through the channel strip — MIDI out — applies it itself). */
  mix?(m: TrackMix, master: number): void;
}

// ---------------------------------------------------------------------------
// Built-in sinks
// ---------------------------------------------------------------------------

/** The band's own engine: more voices than the app's instrument needs, and the same note cache. */
let bandEngine: SynthEngine | null = null;
const engine = () => (bandEngine ??= new SynthEngine({ maxVoices: 160 }));
let drumPlayer: DrumKitPlayer | null = null;
const drums = () => (drumPlayer ??= new DrumKitPlayer());

/** The microphone could hear the band; only its exact pitches are ignored (headphones are best). */
const BAND_MARK = [0] as const;

class RenderedSink implements NoteSink {
  private readonly sound: Extract<BuiltinSound, { kind: 'rendered' }>;
  constructor(sound: Extract<BuiltinSound, { kind: 'rendered' }>) {
    this.sound = sound;
  }
  async prepare(notes: readonly PerfNote[]): Promise<void> {
    const byLayer = new Map<number, Set<number>>();
    for (const n of notes) {
      const layer = n.velocity < 0.45 ? 0.32 : n.velocity < 0.78 ? 0.62 : 0.9;
      (byLayer.get(layer) ?? byLayer.set(layer, new Set()).get(layer)!).add(n.midi - this.sound.offset);
    }
    for (const [vel, midis] of byLayer) await engine().preload(this.sound.voice, [...midis], vel);
  }
  play(midi: number, velocity: number, when: number, duration: number, out: AudioNode): void {
    engine().play(midi - voiceOffset(this.sound.voice), { voice: this.sound.voice, velocity, when, duration, destination: out, mark: BAND_MARK });
  }
  stop(): void {
    engine().stopAll();
  }
}

class LiveSink implements NoteSink {
  private readonly notes = new Set<LiveNote>();
  private readonly sound: Extract<BuiltinSound, { kind: 'live' }>;
  constructor(sound: Extract<BuiltinSound, { kind: 'live' }>) {
    this.sound = sound;
  }
  async prepare(): Promise<void> {}
  play(midi: number, velocity: number, when: number, duration: number, out: AudioNode): void {
    const ctx = getAudioContext();
    const note = playLive(ctx, this.sound.patch, midi, velocity, when, duration, out);
    markAppSound(when + duration + liveRelease(this.sound.patch), { from: when, midis: [midi], kind: 'tonal', intervals: BAND_MARK });
    this.notes.add(note);
    // forget notes once they have died away
    const now = ctx.currentTime;
    for (const n of this.notes) if (n.end < now) this.notes.delete(n);
  }
  stop(): void {
    for (const n of this.notes) n.stop();
    this.notes.clear();
  }
}

class DrumSink implements NoteSink {
  private readonly sound: Extract<BuiltinSound, { kind: 'drums' }>;
  constructor(sound: Extract<BuiltinSound, { kind: 'drums' }>) {
    this.sound = sound;
  }
  prepare(notes: readonly PerfNote[]): Promise<void> {
    return drums().prepare(this.sound.kit, [...notes, { midi: 31, velocity: 0.7 }]);
  }
  play(midi: number, velocity: number, when: number, _duration: number, out: AudioNode): void {
    drums().play(this.sound.kit, midi, velocity, when, out);
  }
  stop(): void {
    drums().stopAll();
  }
}

const SILENT: NoteSink = { prepare: async () => {}, play: () => {}, stop: () => {} };

/** A sink for a built-in sound. */
export function builtinSink(sound: BuiltinSound): NoteSink {
  switch (sound.kind) {
    case 'rendered':
      return new RenderedSink(sound);
    case 'live':
      return new LiveSink(sound);
    case 'drums':
      return new DrumSink(sound);
    default:
      return SILENT;
  }
}

/** Plays through several sinks at once (a sampled sound layered over the built-in one). */
export function layeredSink(sinks: NoteSink[]): NoteSink {
  return {
    prepare: async notes => {
      await Promise.all(sinks.map(s => s.prepare(notes)));
    },
    play: (m, v, w, d, o) => sinks.forEach(s => s.play(m, v, w, d, o)),
    stop: () => sinks.forEach(s => s.stop()),
  };
}

/** Chooses each track's sound: built-in by default; the sounds layer (sample banks) can override. */
export type SinkFactory = (track: PerfTrack) => NoteSink;

export const builtinFactory: SinkFactory = track => builtinSink(track.sound ?? builtinFor(track.program, track.drums));

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Swung eighths: the off-beat eighth lands two-thirds of the way through the beat. */
export function swingTick(tick: number): number {
  const beat = PPQ;
  const base = Math.floor(tick / beat) * beat;
  const p = tick - base;
  const half = beat / 2;
  const long = (beat * 2) / 3;
  return base + (p < half ? (p * long) / half : long + ((p - half) * (beat - long)) / half);
}

interface Strip {
  track: PerfTrack;
  sink: NoteSink;
  input: GainNode;
  pan: StereoPannerNode | null;
  send: GainNode;
}

interface Scheduled {
  time: number;
  duration: number;
  strip: Strip;
  note: PerfNote;
}

const LOOKAHEAD = 0.35;
const TICK_MS = 25;

export class Performer {
  private strips: Strip[] = [];
  private bus: GainNode | null = null;
  private mix: BandMix = DEFAULT_MIX;
  private queue: Scheduled[] = [];
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private swing = false;
  private _end = 0;
  private prepared: Promise<void> | null = null;

  private factory: SinkFactory;

  constructor(factory: SinkFactory = builtinFactory) {
    this.factory = factory;
  }

  /** Choose sounds differently from the next load on. */
  setFactory(factory: SinkFactory): void {
    this.factory = factory;
  }

  /** Set up the tracks (cut to the passage, in ticks from 0) and their channel strips. */
  load(tracks: PerfTrack[], mix: BandMix, opts: { swing?: boolean } = {}): void {
    this.stop();
    this.disconnect();
    const ctx = getAudioContext();
    this.swing = !!opts.swing;
    this.bus = ctx.createGain();
    this.bus.connect(getBus('band'));
    const reverb = getReverbInput();
    this.strips = tracks.map(track => {
      const input = ctx.createGain();
      const send = ctx.createGain();
      let pan: StereoPannerNode | null = null;
      if (typeof ctx.createStereoPanner === 'function') {
        pan = ctx.createStereoPanner();
        input.connect(pan);
        pan.connect(this.bus!);
        pan.connect(send);
      } else {
        input.connect(this.bus!);
        input.connect(send);
      }
      send.connect(reverb);
      return { track, sink: this.factory(track), input, pan, send };
    });
    this.prepared = null;
    this.setMix(mix, true);
  }

  get tracks(): PerfTrack[] {
    return this.strips.map(s => s.track);
  }

  get hasDrums(): boolean {
    return this.strips.some(s => s.track.drums && this.audible(s));
  }

  /** Render / decode every sound the tracks need. Safe to call more than once. */
  prepare(): Promise<void> {
    this.prepared ??= (async () => {
      for (const s of this.strips) await s.sink.prepare(s.track.notes);
    })();
    return this.prepared;
  }

  private audible(s: Strip): boolean {
    const m = trackMix(this.mix, s.track);
    const solo = this.strips.some(x => trackMix(this.mix, x.track).solo);
    return !m.mute && (!solo || m.solo) && m.volume > 0;
  }

  /** Apply mixer settings (smoothly, while playing). */
  setMix(mix: BandMix, immediate = false): void {
    this.mix = mix;
    if (!this.bus) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      if (immediate) p.value = v;
      else p.setTargetAtTime(v, now, 0.03);
    };
    set(this.bus.gain, mix.master * mix.master);
    for (const s of this.strips) {
      const m = trackMix(mix, s.track);
      s.sink.mix?.(m, mix.master);
      set(s.input.gain, this.audible(s) ? m.volume * m.volume : 0);
      if (s.pan) set(s.pan.pan, Math.max(-1, Math.min(1, m.pan)));
      // the send leaves before the band bus, so it takes the band volume itself
      set(s.send.gain, m.reverb * mix.reverb * 2 * mix.master * mix.master);
    }
  }

  /**
   * Start playing: tick 0 sounds at context time `t0`, `secPerTick` apart. `countIn` are
   * context times for a drummer's count-in on the sticks (when the band has drums);
   * `beatOffset` is how far tick 0 is from a beat (a passage starting with a pickup), so
   * swung eighths fall on the right side of the beat.
   */
  start(t0: number, secPerTick: number, opts: { countIn?: number[]; beatOffset?: number } = {}): void {
    this.stopTimer();
    const off = opts.beatOffset ?? 0;
    const time = (tick: number) => t0 + (this.swing ? swingTick(tick + off) - off : tick) * secPerTick;
    const queue: Scheduled[] = [];
    let end = t0;
    for (const strip of this.strips) {
      for (const note of strip.track.notes) {
        const at = time(note.tick) + (note.offset ?? 0);
        const duration = Math.max(0.02, time(note.tick + note.ticks) - time(note.tick));
        queue.push({ time: at, duration, strip, note });
        end = Math.max(end, at + duration);
      }
    }
    queue.sort((a, b) => a.time - b.time);
    this.queue = queue;
    this.next = 0;
    this._end = end;
    const sticks = this.strips.find(s => s.track.drums && this.audible(s));
    if (sticks) for (const t of opts.countIn ?? []) sticks.sink.play(31, 0.75, t, 0.1, sticks.input);
    this.pump();
    this.timer = setInterval(() => this.pump(), TICK_MS);
  }

  /** Context time the last note ends (after start). */
  get endTime(): number {
    return this._end;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  private pump(): void {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    while (this.next < this.queue.length && this.queue[this.next].time < horizon) {
      const ev = this.queue[this.next++];
      // fell behind (a hidden tab): skip, don't burst
      if (ev.time < now - 0.05 || !this.audible(ev.strip)) continue;
      ev.strip.sink.play(ev.note.midi, ev.note.velocity, ev.time, ev.duration, ev.strip.input);
    }
    if (this.next >= this.queue.length) this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Stop: cancel what's queued and fade what sounds. */
  stop(): void {
    this.stopTimer();
    this.queue = [];
    this.next = 0;
    for (const s of this.strips) s.sink.stop();
  }

  private disconnect(): void {
    // let the last notes (and stop's fades) ring out through the old strips and bus before dropping them
    const strips = this.strips;
    const bus = this.bus;
    this.strips = [];
    this.bus = null;
    if (!strips.length && !bus) return;
    setTimeout(() => {
      for (const s of strips) {
        try {
          s.input.disconnect();
          s.pan?.disconnect();
          s.send.disconnect();
        } catch {
          /* already gone */
        }
      }
      bus?.disconnect();
    }, 3000);
  }

  /**
   * Release the audio graph. Sounds are shared between performers (one band engine, one
   * set of samplers), so a performer that never played passes `stop = false` and leaves
   * whatever another one is playing alone.
   */
  dispose(stop = true): void {
    if (stop) this.stop();
    this.disconnect();
  }
}
