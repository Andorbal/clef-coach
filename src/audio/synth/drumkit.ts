/**
 * Plays the synthesised drum kits (./drums.ts) on the audio clock.
 *
 * Like the melodic engine, each (kit, drum, velocity layer) is rendered once into an
 * AudioBuffer and cached; a hit is a buffer source → gain → panner into the band
 * track's channel strip. Hits in one choke group cut each other off, so a closed
 * hi-hat stops an open one ringing.
 */
import { getAudioContext } from '../context';
import { clamp } from '../dsp/util';
import { type DrumKit, drumChokeGroup, drumGain, drumNoteLength, drumPan, drumVelocityLevel, renderDrumSamples } from './drums';

const LAYERS = [0.35, 0.65, 0.95];
const layerOf = (v: number) => (v < 0.5 ? 0 : v < 0.8 ? 1 : 2);

interface Hit {
  src: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
  choke: number;
  out: AudioNode;
  /** the hit's steady gain */
  level: number;
  /** when a fade-out began (Infinity while it rings) */
  faded: number;
}

export class DrumKitPlayer {
  private readonly cache = new Map<string, AudioBuffer>();
  private rate = 0;
  private readonly hits = new Set<Hit>();

  private buffer(kit: DrumKit, note: number, layer: number): AudioBuffer {
    const ctx = getAudioContext();
    if (this.rate !== ctx.sampleRate) {
      this.cache.clear();
      this.rate = ctx.sampleRate;
    }
    const key = `${kit}:${note}:${layer}`;
    let buf = this.cache.get(key);
    if (!buf) {
      buf = ctx.createBuffer(1, drumNoteLength(note, ctx.sampleRate, kit), ctx.sampleRate);
      renderDrumSamples(note, LAYERS[layer], ctx.sampleRate, { kit, out: buf.getChannelData(0) });
      this.cache.set(key, buf);
    }
    return buf;
  }

  /** Render the hits a part uses ahead of time, a few per idle slice. */
  async prepare(kit: DrumKit, hits: readonly { midi: number; velocity: number }[]): Promise<void> {
    const todo = [...new Set(hits.map(h => `${h.midi}:${layerOf(h.velocity)}`))];
    for (let i = 0; i < todo.length; i++) {
      const [note, layer] = todo[i].split(':').map(Number);
      if (drumGain(note, kit) <= 0) continue;
      this.buffer(kit, note, layer);
      if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
    }
  }

  /** Bytes of rendered drums held. */
  get bytes(): number {
    let b = 0;
    for (const buf of this.cache.values()) b += buf.length * 4;
    return b;
  }

  play(kit: DrumKit, note: number, velocity: number, when: number, out: AudioNode): void {
    const ctx = getAudioContext();
    const n = Math.round(note);
    const trim = drumGain(n, kit);
    if (trim <= 0) return;
    const start = Math.max(when, ctx.currentTime);
    const choke = drumChokeGroup(n);
    if (choke) {
      for (const h of this.hits) {
        if (h.choke === choke && h.out === out && h.start < start && h.faded > start) this.fade(h, start, 0.012);
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(kit, n, layerOf(velocity));
    const gain = ctx.createGain();
    // the layer's render gives the timbre and its level; this moves the level to the exact velocity
    const layer = layerOf(velocity);
    const level = trim * (drumVelocityLevel(clamp(velocity, 0, 1)) / drumVelocityLevel(LAYERS[layer]));
    gain.gain.value = level;
    src.connect(gain);
    let tail: AudioNode = gain;
    if (typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      pan.pan.value = drumPan(n);
      gain.connect(pan);
      tail = pan;
    }
    tail.connect(out);
    const hit: Hit = { src, gain, start, choke, out, level, faded: Infinity };
    src.onended = () => {
      this.hits.delete(hit);
      try {
        tail.disconnect();
        gain.disconnect();
      } catch {
        /* already gone */
      }
    };
    src.start(start);
    this.hits.add(hit);
  }

  /** Fade a hit out from `at` (a fade already under way by then is left alone). */
  private fade(h: Hit, at: number, tau: number): void {
    if (h.faded <= at) return;
    h.faded = at;
    const g = h.gain.gain;
    // the gain is steady until a fade, so its level at `at` is known (g.value is now, not then)
    g.cancelScheduledValues(at);
    g.setValueAtTime(h.level, at);
    g.setTargetAtTime(0, at, tau);
    try {
      h.src.stop(at + tau * 8);
    } catch {
      /* already stopped */
    }
  }

  /** Stop everything (a quick fade; hits not yet started are cancelled). */
  stopAll(): void {
    const now = getAudioContext().currentTime;
    for (const h of [...this.hits]) {
      if (h.start > now) {
        try {
          h.src.stop();
        } catch {
          /* ignore */
        }
        this.hits.delete(h);
      } else this.fade(h, now, 0.03);
    }
  }
}
