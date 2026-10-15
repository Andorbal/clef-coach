/**
 * Shared AudioContext, master signal chain and app-sound bookkeeping.
 *
 *   synth ─┐                         ┌──────────────── dry ─────────────────┐
 *   sfx   ─┤                         │                                      │
 *   metro ─┼─ bus gains ─────────────┤                                      ├─ compressor ─ master ─ out
 *   band  ─┘        └─ per-bus send ─┴─ Convolver (procedural 1.6 s room) ─┘
 *                                       → high-pass → wet (0.12)
 *
 * The band bus has no send of its own: each band track sends to the reverb at its
 * own level (see getReverbInput).
 *
 * Nothing here touches the DOM at import time; the context is created lazily
 * on first use. On iOS/iPadOS the context starts "suspended" and must be
 * resumed from a user gesture – call {@link unlockAudio} from a tap/click
 * handler (e.g. the app's "Start" button). As a safety net, the first
 * pointer/key gesture after any suspension/interruption also tries to resume.
 */
import { generateImpulseResponse } from './dsp/reverb';

export type BusName = 'synth' | 'sfx' | 'metronome' | 'band';

interface Graph {
  ctx: AudioContext;
  preComp: GainNode;
  compressor: DynamicsCompressorNode;
  master: GainNode;
  buses: Record<BusName, GainNode>;
  /** Input of the shared reverb (before its wet level). */
  reverbIn: AudioNode;
}

/** Wet level of the shared reverb return. */
const REVERB_WET = 0.12;
/** Seconds of the reverb's response kept (its decay is 1.6 s). */
const REVERB_KEEP = 1.1;
/** How much of each bus feeds the reverb (× REVERB_WET). */
const BUS_SEND: Record<BusName, number> = { synth: 1, sfx: 1.5, metronome: 0.25, band: 0 };
const BUS_GAIN: Record<BusName, number> = { synth: 0.9, sfx: 0.85, metronome: 0.9, band: 0.9 };

let graph: Graph | null = null;
let masterVolume = 0.85;
let gestureHooksInstalled = false;
const stateListeners = new Set<(state: string) => void>();

type AudioCtor = new (opts?: AudioContextOptions) => AudioContext;

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** True if this browser has Web Audio at all. */
export function isAudioSupported(): boolean {
  return audioCtor() !== null;
}

/** True once the shared context exists (without creating it). */
export function hasAudioContext(): boolean {
  return graph !== null;
}

/** The shared AudioContext (created on first call). Throws if Web Audio is unavailable. */
export function getAudioContext(): AudioContext {
  return ensureGraph().ctx;
}

/** Input node of a mixer bus (synth / sfx / metronome / band). */
export function getBus(name: BusName): AudioNode {
  return ensureGraph().buses[name];
}

/** Input of the shared room reverb, for sends (a band track's reverb level). */
export function getReverbInput(): AudioNode {
  return ensureGraph().reverbIn;
}

function ensureGraph(): Graph {
  if (graph) return graph;
  const Ctor = audioCtor();
  if (!Ctor) throw new Error('Web Audio is not supported in this browser');
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    ctx = new Ctor();
  }

  const master = ctx.createGain();
  master.gain.value = volumeToGain(masterVolume);
  const compressor = ctx.createDynamicsCompressor();
  // Gentle glue + safety limiting; chords and sfx stacking never clip.
  compressor.threshold.value = -10;
  compressor.knee.value = 8;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  const preComp = ctx.createGain();
  preComp.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);

  // Procedural reverb: a 1.6 s room, cut where its tail is ~60 dB under the dry sound
  // (wet level and all). A convolver works whenever anything plays; that takes ~15% off it.
  const convolver = ctx.createConvolver();
  try {
    const ir = generateImpulseResponse(ctx.sampleRate, 1.6, 1234, REVERB_KEEP);
    const irBuf = ctx.createBuffer(2, ir.left.length, ctx.sampleRate);
    irBuf.getChannelData(0).set(ir.left);
    irBuf.getChannelData(1).set(ir.right);
    convolver.normalize = true;
    convolver.buffer = irBuf;
  } catch {
    /* reverb is optional */
  }
  const reverbHp = ctx.createBiquadFilter();
  reverbHp.type = 'highpass';
  reverbHp.frequency.value = 180;
  const wet = ctx.createGain();
  wet.gain.value = REVERB_WET;
  convolver.connect(reverbHp);
  reverbHp.connect(wet);
  wet.connect(preComp);

  const makeBus = (name: BusName): GainNode => {
    const bus = ctx.createGain();
    bus.gain.value = BUS_GAIN[name];
    bus.connect(preComp);
    if (BUS_SEND[name] > 0) {
      const send = ctx.createGain();
      send.gain.value = BUS_SEND[name];
      bus.connect(send);
      send.connect(convolver);
    }
    return bus;
  };
  const buses: Record<BusName, GainNode> = {
    synth: makeBus('synth'),
    sfx: makeBus('sfx'),
    metronome: makeBus('metronome'),
    band: makeBus('band'),
  };

  ctx.addEventListener('statechange', () => {
    for (const cb of stateListeners) {
      try {
        cb(ctx.state);
      } catch (err) {
        console.error(err);
      }
    }
  });

  graph = { ctx, preComp, compressor, master, buses, reverbIn: convolver };
  installGestureHooks();
  return graph;
}

// ---------------------------------------------------------------------------
// Unlock / resume (iOS)
// ---------------------------------------------------------------------------

/** Subset of the Audio Session API (Safari 16.4+/iPadOS 17+). */
interface AudioSessionLike {
  type: string;
}

function audioSession(): AudioSessionLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
}

let wantRecording = false;

/**
 * Configure the iOS audio session. 'playback' makes Web Audio audible even
 * with the ring/silent switch on; 'play-and-record' is needed while the mic is
 * open so playback isn't ducked or routed to the earpiece. No-op elsewhere.
 * @internal used by the mic input
 */
export function setRecordingSession(recording: boolean): void {
  wantRecording = recording;
  const s = audioSession();
  if (!s) return;
  try {
    s.type = recording ? 'play-and-record' : 'playback';
  } catch {
    /* ignore */
  }
}

/** iOS: make sure the ring/silent switch doesn't mute the app (unless recording). */
function ensurePlaybackSession(): void {
  const s = audioSession();
  if (!s || wantRecording) return;
  if (s.type === 'auto' || !s.type) {
    try {
      s.type = 'playback';
    } catch {
      /* ignore */
    }
  }
}

function playSilentBuffer(ctx: AudioContext): void {
  try {
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
    src.onended = () => src.disconnect();
  } catch {
    /* ignore */
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
}

/**
 * Unlock audio. MUST be called from a user-gesture handler (click/tap/keydown)
 * on iOS: resumes the context and plays a silent buffer, and sets the audio
 * session so the ring/silent switch doesn't mute the app. Safe to call often.
 */
export async function unlockAudio(): Promise<void> {
  if (!isAudioSupported()) return;
  const ctx = getAudioContext();
  ensurePlaybackSession();
  // The silent buffer has to be started synchronously inside the gesture.
  playSilentBuffer(ctx);
  if ((ctx.state as string) !== 'running') {
    try {
      await withTimeout(ctx.resume(), 1500);
    } catch {
      /* resume can reject outside a gesture; the gesture hook retries */
    }
  }
}

/** True when the context exists and is running (audible). */
export function isAudioUnlocked(): boolean {
  return graph !== null && (graph.ctx.state as string) === 'running';
}

/** Listen to AudioContext state changes ('running' | 'suspended' | 'interrupted' | 'closed'). */
export function onAudioStateChange(cb: (state: string) => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

function installGestureHooks(): void {
  if (gestureHooksInstalled || typeof document === 'undefined') return;
  gestureHooksInstalled = true;
  const tryResume = () => {
    if (!graph) return;
    const st = graph.ctx.state as string;
    if (st === 'suspended' || st === 'interrupted') {
      ensurePlaybackSession();
      playSilentBuffer(graph.ctx);
      graph.ctx.resume().catch(() => {});
    }
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  for (const type of ['pointerdown', 'touchend', 'mousedown', 'keydown']) {
    document.addEventListener(type, tryResume, opts);
  }
  // Coming back from the background (iOS interrupts audio): resume if allowed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryResume();
  });
}

// ---------------------------------------------------------------------------
// Master volume
// ---------------------------------------------------------------------------

function volumeToGain(v: number): number {
  return v * v; // perceptual-ish taper
}

/** Master volume 0..1. */
export function setMasterVolume(v: number): void {
  masterVolume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  if (graph) {
    const g = graph.master.gain;
    const now = graph.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(volumeToGain(masterVolume), now, 0.02);
  }
}

export function getMasterVolume(): number {
  return masterVolume;
}

// ---------------------------------------------------------------------------
// App-sound tracking (so the mic can ignore the app's own output)
// ---------------------------------------------------------------------------

export type AppSoundKind = 'tonal' | 'click';

export interface AppSoundOptions {
  /** Context time the sound starts (default: now). */
  from?: number;
  /** MIDI pitches being sounded; null/undefined = unknown / broadband. */
  midis?: readonly number[] | null;
  /** 'click' = short unpitched tick (metronome, tap); default 'tonal'. */
  kind?: AppSoundKind;
  /**
   * Intervals (semitones, heard − sounded) at which the mic could mistake this
   * sound for a note (default RELATED_INTERVALS). A short bright chime can't
   * plausibly be heard two octaves down, so UI sounds pass a narrower set.
   */
  intervals?: readonly number[];
}

export interface AppSoundMark {
  from: number;
  until: number;
  midis: readonly number[] | null;
  kind: AppSoundKind;
  intervals: readonly number[];
}

/** Release-tail margin after a mark ends (seconds). */
export const APP_SOUND_TAIL = 0.12;

const marks: AppSoundMark[] = [];

function ctxNow(): number | null {
  return graph ? graph.ctx.currentTime : null;
}

function pruneMarks(now: number): void {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].until + APP_SOUND_TAIL < now) marks.splice(i, 1);
  }
}

/**
 * Record that the app is making sound until `untilCtxTimeSeconds` (context
 * time). Everything in src/audio that makes sound calls this; other code that
 * plays audio (e.g. a video) can too. Returns the mark so its end can be
 * moved with {@link updateAppSoundMark} (e.g. when a note is released early).
 */
export function markAppSound(untilCtxTimeSeconds: number, opts: AppSoundOptions = {}): AppSoundMark {
  const now = ctxNow() ?? 0;
  const mark: AppSoundMark = {
    from: opts.from ?? now,
    until: untilCtxTimeSeconds,
    midis: opts.midis ?? null,
    kind: opts.kind ?? 'tonal',
    intervals: opts.intervals ?? RELATED_INTERVALS,
  };
  pruneMarks(now);
  marks.push(mark);
  return mark;
}

/** Move the end of a mark (e.g. a voice was released early). */
export function updateAppSoundMark(mark: AppSoundMark, untilCtxTimeSeconds: number): void {
  mark.until = untilCtxTimeSeconds;
}

function isLive(m: AppSoundMark, now: number): boolean {
  return now >= m.from - 0.01 && now <= m.until + APP_SOUND_TAIL;
}

/** True while any app-generated sound is audible (plus a ~120 ms tail). */
export function appSoundActive(): boolean {
  const now = ctxNow();
  if (now === null) return false;
  pruneMarks(now);
  return marks.some((m) => isLive(m, now));
}

/** True while a tonal (pitched or unknown) app sound is live. */
export function appTonalSoundActive(): boolean {
  const now = ctxNow();
  if (now === null) return false;
  return marks.some((m) => m.kind === 'tonal' && isLive(m, now));
}

/** True while a click-type app sound (metronome, tap) is live. */
export function appClickActive(): boolean {
  const now = ctxNow();
  if (now === null) return false;
  return marks.some((m) => m.kind === 'click' && isLive(m, now));
}

/** Intervals (semitones) at which a sounding note can be mis-heard: itself, octave errors, strong harmonics. */
const RELATED_INTERVALS = [-24, -12, 0, 12, 19, 24, 28, 31];

/**
 * Could a detected `midi` be the app's own sound right now? True if a live
 * tonal mark is broadband (no pitch info) or sounds a related pitch.
 */
export function appSoundBlocksNote(midi: number): boolean {
  const now = ctxNow();
  if (now === null) return false;
  for (const m of marks) {
    if (m.kind !== 'tonal' || !isLive(m, now)) continue;
    if (!m.midis) return true;
    for (const a of m.midis) if (m.intervals.includes(midi - a)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Clock mapping: AudioContext time ↔ performance.now()
// ---------------------------------------------------------------------------

interface OutputStamp {
  contextTime: number;
  performanceTime: number;
}

function outputStamp(ctx: AudioContext): OutputStamp | null {
  if (typeof ctx.getOutputTimestamp !== 'function' || (ctx.state as string) !== 'running') return null;
  try {
    const ts = ctx.getOutputTimestamp();
    const ct = ts.contextTime ?? 0;
    const pt = ts.performanceTime ?? 0;
    if (!(ct > 0) || !(pt > 0)) return null;
    // Sanity: the stamp must be recent and consistent with currentTime.
    const predicted = ct + (performance.now() - pt) / 1000;
    if (Math.abs(predicted - ctx.currentTime) > 0.5) return null;
    return { contextTime: ct, performanceTime: pt };
  } catch {
    return null;
  }
}

function fallbackLatency(ctx: AudioContext): number {
  const c = ctx as AudioContext & { outputLatency?: number };
  return (c.outputLatency || 0) + (ctx.baseLatency || 0);
}

/**
 * performance.now() (ms) at which audio scheduled at context time `t` is
 * actually HEARD (includes output latency when the browser reports it).
 */
export function ctxTimeToPerfNow(t: number): number {
  const ctx = getAudioContext();
  const s = outputStamp(ctx);
  if (s) return s.performanceTime + (t - s.contextTime) * 1000;
  return performance.now() + (t - ctx.currentTime + fallbackLatency(ctx)) * 1000;
}

/** Inverse of {@link ctxTimeToPerfNow}: context time whose audio is heard at performance time `ms`. */
export function perfNowToCtxTime(ms: number): number {
  const ctx = getAudioContext();
  const s = outputStamp(ctx);
  if (s) return s.contextTime + (ms - s.performanceTime) / 1000;
  return ctx.currentTime + (ms - performance.now()) / 1000 - fallbackLatency(ctx);
}
