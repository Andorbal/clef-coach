/**
 * The live Synth Lab synth, on the page's side.
 *
 * It runs SynthCore in an AudioWorklet (audio/worklet.ts) where the browser has one, and
 * on the main thread through a ScriptProcessorNode where it doesn't (old Safari), so the
 * lab works everywhere the app does. Screens share one instance (`getLabSynth()`) and keep it alive with `retainLabSynth()`; the node is torn down once nobody uses
 * it, so the lab costs nothing anywhere else in the app.
 *
 *   SynthCore ─→ out (gain) ─┬→ band bus (dry: the room reverb would blur what's being taught)
 *   rendered A/B clips ─┘    └→ analyser (the scope)
 *
 * Every note marks itself as app sound (markAppSound), like every other sound in the app.
 */
import { getAudioContext, getBus, markAppSound, type AppSoundMark, updateAppSoundMark } from '../../audio/context';
import { SynthCore } from '../dsp/core';
import { releaseTail } from '../dsp/env';
import { INIT_PATCH, type Patch } from '../dsp/params';
import type { Rendered } from '../dsp/render';
import type { LabMessage } from './worklet';
import workletUrl from './worklet?worker&url';

type Listener = (active: boolean) => void;

const modules = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Load the worklet module into a context once (false: no AudioWorklet here). */
function loadModule(ctx: AudioContext): Promise<boolean> {
  let p = modules.get(ctx);
  if (!p) {
    p = ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined'
      ? ctx.audioWorklet.addModule(workletUrl).then(() => true, err => {
          console.warn('Synth Lab: AudioWorklet unavailable, using the main thread', err);
          return false;
        })
      : Promise.resolve(false);
    modules.set(ctx, p);
  }
  return p;
}

/** Main-thread fallback: the same engine behind a ScriptProcessorNode. */
class ScriptHost {
  readonly node: ScriptProcessorNode;
  private readonly core: SynthCore;
  private queue: { at: number; on: boolean; midi: number; vel: number }[] = [];
  private active = false;
  onActive: Listener = () => undefined;

  constructor(ctx: AudioContext) {
    this.core = new SynthCore(ctx.sampleRate, 777);
    this.node = ctx.createScriptProcessor(1024, 0, 2);
    this.node.onaudioprocess = e => {
      const l = e.outputBuffer.getChannelData(0);
      const r = e.outputBuffer.getChannelData(1);
      const t0 = e.playbackTime;
      let pos = 0;
      while (this.queue.length) {
        const ev = this.queue[0];
        const at = Math.round((ev.at - t0) * ctx.sampleRate);
        if (at >= l.length) break;
        if (at > pos) {
          this.core.render(l, r, at - pos, pos);
          pos = at;
        }
        this.queue.shift();
        if (ev.on) this.core.noteOn(ev.midi, ev.vel);
        else this.core.noteOff(ev.midi);
      }
      if (pos < l.length) this.core.render(l, r, l.length - pos, pos);
      const now = !this.core.silent;
      if (now !== this.active) {
        this.active = now;
        this.onActive(now);
      }
    };
  }

  post(m: LabMessage): void {
    switch (m.t) {
      case 'patch':
        this.core.setPatch(m.patch);
        break;
      case 'set':
        this.core.set(m.key, m.value);
        break;
      case 'on':
        if (m.at) this.enqueue({ at: m.at, on: true, midi: m.midi, vel: m.vel });
        else this.core.noteOn(m.midi, m.vel);
        break;
      case 'off':
        if (m.at) this.enqueue({ at: m.at, on: false, midi: m.midi, vel: 0 });
        else this.core.noteOff(m.midi);
        break;
      case 'allOff':
      case 'cancel':
        this.queue = [];
        this.core.allNotesOff();
        break;
      case 'panic':
        this.queue = [];
        this.core.panic();
        break;
    }
  }

  private enqueue(e: { at: number; on: boolean; midi: number; vel: number }): void {
    this.queue.push(e);
    this.queue.sort((a, b) => a.at - b.at || Number(a.on) - Number(b.on));
  }
}

export class LabSynth {
  private patch: Patch = INIT_PATCH;
  private worklet: AudioWorkletNode | null = null;
  private script: ScriptHost | null = null;
  private out: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private starting: Promise<void> | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly marks = new Map<number, AppSoundMark>();
  private clip: AudioBufferSourceNode | null = null;
  private clipEnd = 0;
  private activeNow = false;

  /** Build the audio graph (call after audio is unlocked; safe to call often). */
  start(): Promise<void> {
    if (this.worklet || this.script) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const ctx = getAudioContext();
      const out = ctx.createGain();
      out.gain.value = 1;
      out.connect(getBus('band'));
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.6;
      out.connect(an);
      this.out = out;
      this.analyserNode = an;
      const ok = await loadModule(ctx);
      if (ok) {
        const node = new AudioWorkletNode(ctx, 'synthlab', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        node.port.onmessage = (e: MessageEvent<{ t: string; active: boolean }>) => {
          if (e.data?.t === 'active') this.setActive(e.data.active);
        };
        node.connect(out);
        this.worklet = node;
      } else {
        const s = new ScriptHost(ctx);
        s.onActive = a => this.setActive(a);
        s.node.connect(out);
        this.script = s;
      }
      this.post({ t: 'patch', patch: this.patch });
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Tear the graph down (the lab was left). */
  stop(): void {
    this.post({ t: 'panic' });
    this.stopClip();
    this.worklet?.disconnect();
    this.worklet?.port.close();
    if (this.script) {
      this.script.node.onaudioprocess = null;
      this.script.node.disconnect();
    }
    this.out?.disconnect();
    this.analyserNode?.disconnect();
    this.worklet = null;
    this.script = null;
    this.out = null;
    this.analyserNode = null;
    this.setActive(false);
  }

  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /** Is anything sounding (notes or a clip)? */
  get active(): boolean {
    return this.activeNow || (this.clip !== null && this.now() < this.clipEnd);
  }

  /** Called when sound starts or stops. */
  onActive(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setActive(a: boolean): void {
    if (a === this.activeNow) return;
    this.activeNow = a;
    for (const cb of this.listeners) cb(a || (this.clip !== null && this.now() < this.clipEnd));
  }

  private post(m: LabMessage): void {
    if (this.worklet) this.worklet.port.postMessage(m);
    else this.script?.post(m);
  }

  private now(): number {
    try {
      return getAudioContext().currentTime;
    } catch {
      return 0;
    }
  }

  getPatch(): Patch {
    return this.patch;
  }

  setPatch(p: Patch): void {
    if (p === this.patch) return;
    this.patch = p;
    this.post({ t: 'patch', patch: p });
  }

  set<K extends keyof Patch>(key: K, value: Patch[K]): void {
    if (this.patch[key] === value) return;
    this.patch = { ...this.patch, [key]: value };
    this.post({ t: 'set', key, value });
  }

  /** Start a note now, or at a context time. */
  noteOn(midi: number, velocity = 0.8, at?: number): void {
    this.post({ t: 'on', midi, vel: velocity, at });
    const from = at ?? this.now();
    // held until its key is released (the release moves the end)
    const old = this.marks.get(midi);
    if (old) updateAppSoundMark(old, from);
    this.marks.set(midi, markAppSound(from + 30, { from, midis: [midi] }));
  }

  noteOff(midi: number, at?: number): void {
    this.post({ t: 'off', midi, at });
    const mark = this.marks.get(midi);
    if (mark) {
      updateAppSoundMark(mark, (at ?? this.now()) + releaseTail(this.patch.ampRelease) + 0.2);
      this.marks.delete(midi);
    }
  }

  /** Release every note. */
  allOff(): void {
    this.post({ t: 'allOff' });
    const t = this.now() + releaseTail(this.patch.ampRelease);
    for (const m of this.marks.values()) updateAppSoundMark(m, t);
    this.marks.clear();
  }

  /** Drop notes scheduled ahead (a loop stopping) and release the rest. */
  cancelScheduled(): void {
    this.post({ t: 'cancel' });
    const t = this.now() + releaseTail(this.patch.ampRelease);
    for (const m of this.marks.values()) updateAppSoundMark(m, t);
    this.marks.clear();
  }

  /** Silence at once. */
  panic(): void {
    this.post({ t: 'panic' });
    this.stopClip();
  }

  /** Play a rendered sound (the quiz's target, or "mine" for comparison). Returns its length (s). */
  playClip(r: Rendered): number {
    this.stopClip();
    const ctx = getAudioContext();
    if (!this.out) return 0;
    const buf = ctx.createBuffer(2, r.left.length, r.sampleRate);
    buf.getChannelData(0).set(r.left);
    buf.getChannelData(1).set(r.right);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    const t = ctx.currentTime + 0.02;
    src.start(t);
    this.clip = src;
    this.clipEnd = t + buf.duration;
    markAppSound(this.clipEnd, { from: t });
    for (const cb of this.listeners) cb(true);
    src.onended = () => {
      if (this.clip === src) {
        this.clip = null;
        for (const cb of this.listeners) cb(this.activeNow);
      }
      src.disconnect();
    };
    return buf.duration;
  }

  stopClip(): void {
    if (!this.clip) return;
    try {
      this.clip.stop();
    } catch {
      /* not started */
    }
    this.clip = null;
  }
}

let shared: LabSynth | null = null;
let users = 0;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

/** The one lab synth (created on first use; nothing touches audio until start()). */
export function getLabSynth(): LabSynth {
  if (!shared) shared = new LabSynth();
  return shared;
}

/**
 * Keep the lab synth's audio graph alive; call the returned function when done (from an
 * effect, so React's double-mounting in development pairs up). The graph is taken down
 * a moment after the last user lets go, when release tails have finished.
 */
export function retainLabSynth(): () => void {
  const synth = getLabSynth();
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
    synth.allOff();
    stopTimer = setTimeout(() => {
      stopTimer = null;
      if (users === 0) synth.stop();
    }, 1500);
  };
}
