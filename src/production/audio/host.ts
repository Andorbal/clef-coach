/**
 * Production School's audio on the page's side: the console that plays (an AudioWorklet,
 * or a ScriptProcessorNode where there's none) and the studio worker that renders stems
 * and judges mixes.
 *
 *   stems (worker) ─→ console (worklet: Mixer) ─→ out (gain) ─→ band bus
 *
 * The console goes to the band bus dry: the app's room reverb would colour a mix the
 * learner is judging by ear. Screens share one Studio (`getStudio()`) and hold it with
 * `retainStudio()`; the node is torn down once nobody uses it, and the worker is kept
 * (with its cache of tracks) so the next lesson starts fast.
 *
 * Playback marks itself as app sound (markAppSound), like every other sound in the app.
 */
import { getAudioContext, getBus, markAppSound, type AppSoundMark, updateAppSoundMark } from '../../audio/context';
import type { JudgeResult } from '../dsp/judge';
import type { MeterSnapshot } from '../dsp/mixer';
import type { Mix } from '../dsp/params';
import type { StemRequest } from '../dsp/stems';
import { ConsoleCore, type ConsoleMessage, type ConsoleReply } from './core';
import type { StudioRequest } from './stems.worker';
import { type JudgeRequest, StudioCore } from './studioCore';
import StudioWorker from './stems.worker?worker';
import workletUrl from './worklet?worker&url';

const modules = new WeakMap<BaseAudioContext, Promise<boolean>>();

function loadModule(ctx: AudioContext): Promise<boolean> {
  let p = modules.get(ctx);
  if (!p) {
    p = ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined'
      ? ctx.audioWorklet.addModule(workletUrl).then(() => true, err => {
          console.warn('Production School: AudioWorklet unavailable, using the main thread', err);
          return false;
        })
      : Promise.resolve(false);
    modules.set(ctx, p);
  }
  return p;
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

/** The worker, or the same work on the main thread where workers fail. */
class Backroom {
  private worker: Worker | null = null;
  private local: StudioCore | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();

  private ensure(): void {
    if (this.worker || this.local) return;
    try {
      const w = new StudioWorker();
      w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown; error?: string }>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.value);
        else p.reject(new Error(e.data.error));
      };
      w.onerror = e => {
        console.warn('Production School: studio worker failed, using the main thread', e.message);
        w.terminate();
        this.worker = null;
        this.local = new StudioCore();
        for (const p of this.pending.values()) p.reject(new Error('worker failed'));
        this.pending.clear();
      };
      this.worker = w;
    } catch {
      this.local = new StudioCore();
    }
  }

  private call<T>(m: Omit<StudioRequest, 'id'> & { t: StudioRequest['t'] }): Promise<T> {
    this.ensure();
    if (this.local) {
      const core = this.local;
      // let the page paint first
      return new Promise<T>((resolve, reject) =>
        setTimeout(() => {
          try {
            const x = m as StudioRequest;
            // stems are copied: the cache keeps its own, and the page hands these to the audio thread
            const value = x.t === 'stems' ? Object.fromEntries(Object.entries(core.stems(x.req)).map(([k, v]) => [k, v.slice()])) : x.t === 'prepare' ? core.prepare(x.job) : core.score(x.key, x.mix);
            resolve(value as T);
          } catch (e) {
            reject(e as Error);
          }
        }, 16),
      );
    }
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: v => resolve(v as T), reject });
      this.worker!.postMessage({ ...m, id });
    });
  }

  stems(req: StemRequest): Promise<Record<string, Float32Array>> {
    return this.call({ t: 'stems', req } as StudioRequest);
  }

  prepare(job: JudgeRequest): Promise<void> {
    return this.call({ t: 'prepare', job } as StudioRequest);
  }

  score(key: string, mix: Mix): Promise<JudgeResult> {
    return this.call({ t: 'score', key, mix } as StudioRequest);
  }
}

/** Main-thread fallback: the same console behind a ScriptProcessorNode. */
class ScriptConsole {
  readonly node: ScriptProcessorNode;
  readonly core: ConsoleCore;
  constructor(ctx: AudioContext, onReply: (m: ConsoleReply) => void) {
    this.core = new ConsoleCore(ctx.sampleRate, onReply);
    this.node = ctx.createScriptProcessor(1024, 0, 2);
    this.node.onaudioprocess = e => {
      const l = e.outputBuffer.getChannelData(0);
      const r = e.outputBuffer.getChannelData(1);
      this.core.render(l, r, l.length);
    };
  }
}

export type MeterListener = (m: MeterSnapshot) => void;
export type StateListener = (s: { playing: boolean; sounding: boolean }) => void;

export class Studio {
  readonly backroom = new Backroom();
  private worklet: AudioWorkletNode | null = null;
  private script: ScriptConsole | null = null;
  private out: GainNode | null = null;
  private starting: Promise<void> | null = null;
  private readonly meterListeners = new Set<MeterListener>();
  private readonly stateListeners = new Set<StateListener>();
  private mark: AppSoundMark | null = null;
  private state = { playing: false, sounding: false };
  /** What the console was last told, replayed if the graph is rebuilt. */
  private channels: string[] = [];
  private tempo = 100;
  /** The last lesson's tracks (fetched again from the worker's cache if the graph is rebuilt). */
  private loaded: Omit<StemRequest, 'sampleRate'> | null = null;
  private mix: Mix = {};

  get sampleRate(): number {
    return getAudioContext().sampleRate;
  }

  /** Build the audio graph (after audio is unlocked; safe to call often). */
  start(): Promise<void> {
    if (this.worklet || this.script) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const ctx = getAudioContext();
      const out = ctx.createGain();
      out.connect(getBus('band'));
      this.out = out;
      const onReply = (m: ConsoleReply) => this.reply(m);
      if (await loadModule(ctx)) {
        const node = new AudioWorkletNode(ctx, 'production-console', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        node.port.onmessage = (e: MessageEvent<ConsoleReply>) => onReply(e.data);
        node.connect(out);
        this.worklet = node;
      } else {
        const s = new ScriptConsole(ctx, onReply);
        s.node.connect(out);
        this.script = s;
      }
      this.post({ t: 'init', channels: this.channels, tempo: this.tempo });
      this.post({ t: 'mix', mix: this.mix });
      if (this.loaded) this.sendStems(await this.backroom.stems({ ...this.loaded, sampleRate: ctx.sampleRate }));
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Tear the graph down. */
  stop(): void {
    this.post({ t: 'reset' });
    this.worklet?.disconnect();
    this.worklet?.port.close();
    if (this.script) {
      this.script.node.onaudioprocess = null;
      this.script.node.disconnect();
    }
    this.out?.disconnect();
    this.worklet = null;
    this.script = null;
    this.out = null;
    this.reply({ t: 'state', playing: false, sounding: false });
  }

  private post(m: ConsoleMessage, transfer: Transferable[] = []): void {
    if (this.worklet) this.worklet.port.postMessage(m, transfer);
    else this.script?.core.handle(m);
  }

  /** Hand the tracks over to the audio thread (moved, not copied: the page doesn't keep them). */
  private sendStems(stems: Record<string, Float32Array>): void {
    this.post({ t: 'stems', stems }, this.worklet ? Object.values(stems).map(x => x.buffer as ArrayBuffer) : []);
  }

  private reply(m: ConsoleReply): void {
    if (m.t === 'meters') {
      for (const cb of this.meterListeners) cb(m.m);
      if (this.mark) updateAppSoundMark(this.mark, this.now() + 0.6);
      return;
    }
    this.state = { playing: m.playing, sounding: m.sounding };
    const now = this.now();
    if (m.sounding) {
      if (!this.mark || this.mark.until < now) this.mark = markAppSound(now + 0.6, { from: now });
      else updateAppSoundMark(this.mark, now + 0.6);
    } else if (this.mark) {
      updateAppSoundMark(this.mark, now);
      this.mark = null;
    }
    for (const cb of this.stateListeners) cb(this.state);
  }

  private now(): number {
    try {
      return getAudioContext().currentTime;
    } catch {
      return 0;
    }
  }

  get playing(): boolean {
    return this.state.playing;
  }

  onMeters(cb: MeterListener): () => void {
    this.meterListeners.add(cb);
    return () => this.meterListeners.delete(cb);
  }

  onState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    cb(this.state);
    return () => this.stateListeners.delete(cb);
  }

  /** A lesson's tracks: render (or fetch from the cache) and hand them to the console. */
  async load(req: Omit<StemRequest, 'sampleRate'>, channels: string[], tempo: number): Promise<void> {
    const stems = await this.backroom.stems({ ...req, sampleRate: this.sampleRate });
    this.channels = channels;
    this.tempo = tempo;
    this.loaded = req;
    this.post({ t: 'stop' });
    this.post({ t: 'init', channels, tempo });
    this.post({ t: 'mix', mix: this.mix });
    this.sendStems(stems);
  }

  setMix(mix: Mix): void {
    this.mix = mix;
    this.post({ t: 'mix', mix });
  }

  set(key: string, value: number): void {
    this.mix = { ...this.mix, [key]: value };
    this.post({ t: 'set', key, value });
  }

  play(from?: number): void {
    this.post({ t: 'play', from });
  }

  pause(): void {
    this.post({ t: 'stop' });
  }

  /** A quiz's judge, in the worker. */
  prepareJudge(job: Omit<JudgeRequest, 'req'> & { req: Omit<StemRequest, 'sampleRate'> }): Promise<void> {
    return this.backroom.prepare({ ...job, req: { ...job.req, sampleRate: this.sampleRate } });
  }

  score(key: string, mix: Mix): Promise<JudgeResult> {
    return this.backroom.score(key, mix);
  }
}

let shared: Studio | null = null;
let users = 0;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

export function getStudio(): Studio {
  if (!shared) shared = new Studio();
  return shared;
}

/** Keep the console's audio graph alive; call the returned function when done. */
export function retainStudio(): () => void {
  const studio = getStudio();
  users++;
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users > 0) return;
    studio.pause();
    stopTimer = setTimeout(() => {
      stopTimer = null;
      if (users === 0) studio.stop();
    }, 4000);
  };
}
