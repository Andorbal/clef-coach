/**
 * The Synth Lab's AudioWorklet: SynthCore on the audio thread.
 *
 * Bundled on its own (`?worker&url`), with the engine inlined. Messages carry the patch
 * (whole, or one setting at a time while a knob turns) and note events; a note can carry
 * a context time (`at`), so the demo loops play exactly in time: the block is split at
 * the event's sample.
 *
 * When nothing sounds, SynthCore renders silence without touching the voices, so an idle
 * lab costs next to nothing.
 */
import { SynthCore } from '../dsp/core';
import type { Patch } from '../dsp/params';

declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

export type LabMessage =
  | { t: 'patch'; patch: Patch }
  | { t: 'set'; key: keyof Patch; value: Patch[keyof Patch] }
  | { t: 'on'; midi: number; vel: number; at?: number }
  | { t: 'off'; midi: number; at?: number }
  | { t: 'allOff' }
  | { t: 'panic' }
  | { t: 'cancel' };

type Timed = { at: number; on: boolean; midi: number; vel: number };

class LabProcessor extends AudioWorkletProcessor {
  private readonly core = new SynthCore(sampleRate, 777);
  private queue: Timed[] = [];
  private wasActive = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<LabMessage>) => this.handle(e.data);
  }

  private handle(m: LabMessage): void {
    switch (m.t) {
      case 'patch':
        this.core.setPatch(m.patch);
        break;
      case 'set':
        this.core.set(m.key, m.value);
        break;
      case 'on':
        if (m.at && m.at > currentTime) this.enqueue({ at: m.at, on: true, midi: m.midi, vel: m.vel });
        else this.core.noteOn(m.midi, m.vel);
        break;
      case 'off':
        if (m.at && m.at > currentTime) this.enqueue({ at: m.at, on: false, midi: m.midi, vel: 0 });
        else this.core.noteOff(m.midi);
        break;
      case 'allOff':
        this.queue = [];
        this.core.allNotesOff();
        break;
      case 'panic':
        this.queue = [];
        this.core.panic();
        break;
      case 'cancel':
        // drop scheduled notes (a stopped loop), letting held ones ring out
        this.queue = [];
        this.core.allNotesOff();
        break;
    }
  }

  private enqueue(e: Timed): void {
    this.queue.push(e);
    this.queue.sort((a, b) => a.at - b.at || Number(a.on) - Number(b.on));
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const l = out[0];
    const r = out[1] ?? out[0];
    const n = l.length;
    let pos = 0;
    while (this.queue.length) {
      const e = this.queue[0];
      const at = Math.round((e.at - currentTime) * sampleRate);
      if (at >= n) break;
      if (at > pos) {
        this.core.render(l, r, at - pos, pos);
        pos = at;
      }
      this.queue.shift();
      if (e.on) this.core.noteOn(e.midi, e.vel);
      else this.core.noteOff(e.midi);
    }
    if (pos < n) this.core.render(l, r, n - pos, pos);
    // tell the page when the sound starts and stops (for the scope and the lights)
    const active = !this.core.silent;
    if (active !== this.wasActive) {
      this.wasActive = active;
      this.port.postMessage({ t: 'active', active });
    }
    return true;
  }
}

registerProcessor('synthlab', LabProcessor);
