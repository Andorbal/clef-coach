/**
 * Production School's AudioWorklet: the Mixer on the audio thread, playing the session's
 * stems round and round.
 *
 * Bundled on its own (`?worker&url`), with the console inlined (audio/core.ts). Messages
 * carry the channel list and stems (once per lesson), the whole mix or one setting while a
 * control moves, and the transport. Once the effect tails have died away the mixer writes
 * zeros and posts nothing.
 */
import { ConsoleCore, type ConsoleMessage } from './core';

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class ConsoleProcessor extends AudioWorkletProcessor {
  private readonly core: ConsoleCore;

  constructor() {
    super();
    this.core = new ConsoleCore(sampleRate, m => this.port.postMessage(m));
    this.port.onmessage = (e: MessageEvent<ConsoleMessage>) => this.core.handle(e.data);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const l = out[0];
    const r = out[1] ?? out[0];
    this.core.render(l, r, l.length);
    return true;
  }
}

registerProcessor('production-console', ConsoleProcessor);
