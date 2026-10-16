/**
 * SynthCore: the whole synth as a plain object that turns note events and a patch into
 * stereo samples. The live synth (an AudioWorklet, see audio/worklet.ts), the offline
 * renders behind "play the target" and the sound matcher, and the tests all run this same
 * code, so what a quiz compares is exactly what the player hears.
 *
 * - Poly: eight voices; a new note takes a free voice, else the quietest released one,
 *   else the oldest.
 * - Mono: one voice and a stack of held keys (last note wins; letting go of it returns to
 *   the one still held). Every new key restarts the envelopes.
 * - Legato: like mono, but a key pressed while another is held only moves the pitch
 *   (gliding there if glide is up), which is how 303 slides and smooth leads are played.
 *
 * After the voices: effects, the volume knob and a soft limiter so chords and resonant
 * whistles never clip.
 */
import { Effects } from './fx';
import { INIT_PATCH, type Patch } from './params';
import { Voice } from './voice';
import { softClip } from './waves';

export const POLYPHONY = 8;
/** Largest block render() accepts in one go (bigger requests are split). */
const MAX_BLOCK = 128;

export class SynthCore {
  readonly sampleRate: number;
  patch: Patch = INIT_PATCH;
  private version = 0;
  private readonly voices: Voice[];
  private readonly fx: Effects;
  private order = 0;
  private seed: number;
  /** Mono/legato: keys held, oldest first. */
  private readonly stack: number[] = [];
  /** Pitch of the last note started (where a glide starts from). */
  private lastPitch = -1;
  private readonly tmpL = new Float32Array(MAX_BLOCK);
  private readonly tmpR = new Float32Array(MAX_BLOCK);
  private tailSamples = 0;

  constructor(sampleRate: number, seed = 1) {
    this.sampleRate = sampleRate;
    this.seed = seed >>> 0 || 1;
    this.voices = Array.from({ length: POLYPHONY }, (_, i) => new Voice(sampleRate, seed + i * 7919));
    this.fx = new Effects(sampleRate);
  }

  setPatch(p: Patch): void {
    const modeChanged = p.voiceMode !== this.patch.voiceMode;
    this.patch = p;
    this.version++;
    if (modeChanged) this.allNotesOff();
  }

  /** Change one setting (what a knob does). */
  set<K extends keyof Patch>(key: K, value: Patch[K]): void {
    this.setPatch({ ...this.patch, [key]: value });
  }

  private nextSeed(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0 || 1;
    return this.seed;
  }

  noteOn(midi: number, velocity = 0.8): void {
    const p = this.patch;
    const vel = Math.min(1, Math.max(0.05, velocity));
    if (p.voiceMode !== 'poly') {
      const held = this.stack.length > 0;
      const i = this.stack.indexOf(midi);
      if (i >= 0) this.stack.splice(i, 1);
      this.stack.push(midi);
      const v = this.voices[0];
      for (let k = 1; k < this.voices.length; k++) if (this.voices[k].active) this.voices[k].kill();
      if (p.voiceMode === 'legato' && held && v.active && v.gate) v.glideTo(midi, p);
      else v.start(p, midi, vel, v.active ? v.pitch : this.lastPitch, true, this.nextSeed());
      v.order = ++this.order;
      this.lastPitch = midi;
      return;
    }
    // the same key again: restart its voice
    let v = this.voices.find(x => x.note === midi && x.active);
    if (!v) v = this.voices.find(x => !x.active);
    if (!v) {
      const released = this.voices.filter(x => !x.gate);
      const pool = released.length ? released : this.voices;
      v = pool.reduce((a, b) => (released.length ? (a.amp.level <= b.amp.level ? a : b) : a.order <= b.order ? a : b));
    }
    v.start(p, midi, vel, this.lastPitch, true, this.nextSeed());
    v.order = ++this.order;
    this.lastPitch = midi;
  }

  noteOff(midi: number): void {
    const p = this.patch;
    if (p.voiceMode !== 'poly') {
      const i = this.stack.indexOf(midi);
      if (i < 0) return;
      this.stack.splice(i, 1);
      const v = this.voices[0];
      if (v.note !== midi) return;
      if (this.stack.length) {
        const back = this.stack[this.stack.length - 1];
        v.glideTo(back, p);
        this.lastPitch = back;
      } else v.release();
      return;
    }
    for (const v of this.voices) if (v.note === midi && v.gate) v.release();
  }

  /** Release every note (they fade by their release). */
  allNotesOff(): void {
    this.stack.length = 0;
    for (const v of this.voices) if (v.gate) v.release();
  }

  /** Silence everything at once, effects tails included. */
  panic(): void {
    this.stack.length = 0;
    for (const v of this.voices) v.kill();
    this.fx.clear();
    this.tailSamples = 0;
  }

  /** Voices sounding right now. */
  activeVoices(): number {
    let n = 0;
    for (const v of this.voices) if (v.active) n++;
    return n;
  }

  /** True when nothing sounds (no voices, effect tails finished). */
  get silent(): boolean {
    return this.tailSamples <= 0 && this.activeVoices() === 0;
  }

  /**
   * Render `n` samples into outL/outR (overwriting them). Returns false (and writes
   * zeros) when the synth is silent, so a worklet can skip work.
   */
  render(outL: Float32Array, outR: Float32Array, n: number, offset = 0): boolean {
    let any = false;
    for (let done = 0; done < n; ) {
      const len = Math.min(MAX_BLOCK, n - done);
      if (this.renderBlock(outL, outR, offset + done, len)) any = true;
      done += len;
    }
    return any;
  }

  private renderBlock(outL: Float32Array, outR: Float32Array, off: number, n: number): boolean {
    const p = this.patch;
    const l = this.tmpL;
    const r = this.tmpR;
    l.fill(0, 0, n);
    r.fill(0, 0, n);
    let voices = 0;
    for (const v of this.voices) {
      if (!v.active) continue;
      voices++;
      v.render(p, this.version, this.sampleRate, l, r, 0, n);
    }
    if (voices > 0) this.tailSamples = Math.ceil(this.fx.tailFor(p) * this.sampleRate);
    else if (this.tailSamples > 0) this.tailSamples -= n;
    else {
      for (let i = 0; i < n; i++) {
        outL[off + i] = 0;
        outR[off + i] = 0;
      }
      return false;
    }
    this.fx.process(p, l, r, n);
    const g = p.volume * p.volume * 1.6;
    for (let i = 0; i < n; i++) {
      outL[off + i] = limit(l[i] * g);
      outR[off + i] = limit(r[i] * g);
    }
    return true;
  }
}

/** Transparent below 0.8, rounding off smoothly towards 1 above it. */
function limit(x: number): number {
  const a = x < 0 ? -x : x;
  if (a <= 0.8) return x;
  const y = 0.8 + 0.2 * softClip((a - 0.8) / 0.2);
  return x < 0 ? -y : y;
}
