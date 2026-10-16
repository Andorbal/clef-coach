/**
 * The effects that follow almost every synth: drive, chorus, delay and reverb, in that
 * order (the order most synths and most producers use: dirt first, space last).
 *
 * All four are small stereo processors with fixed buffers made once, so they cost
 * nothing to keep around and make no garbage in the audio thread. Each is skipped
 * entirely while its mix is at zero.
 */
import { type Patch, divisionSeconds } from './params';
import { softClip } from './waves';

class DelayLine {
  readonly buf: Float32Array;
  pos = 0;
  constructor(len: number) {
    this.buf = new Float32Array(len);
  }
  write(x: number): void {
    this.buf[this.pos] = x;
    this.pos = this.pos + 1 === this.buf.length ? 0 : this.pos + 1;
  }
  /** Read `d` samples back (fractional, 1 ≤ d < length). */
  read(d: number): number {
    const len = this.buf.length;
    let r = this.pos - d;
    if (r < 0) r += len;
    const i = r | 0;
    const f = r - i;
    const a = this.buf[i];
    const b = this.buf[i + 1 === len ? 0 : i + 1];
    return a + (b - a) * f;
  }
  clear(): void {
    this.buf.fill(0);
  }
}

/** Saturation: the waveform's peaks are rounded off, adding harmonics (and grit). */
function drive(p: Patch, l: Float32Array, r: Float32Array, n: number): void {
  const g = 1 + 24 * p.drive * p.drive;
  // level-matched at a typical peak, so turning it up adds grit more than volume
  const norm = 0.4 / softClip(0.4 * g);
  for (let i = 0; i < n; i++) {
    l[i] = softClip(l[i] * g) * norm;
    r[i] = softClip(r[i] * g) * norm;
  }
}

class Chorus {
  private readonly dl: DelayLine;
  private readonly dr: DelayLine;
  private phase = 0;
  private readonly sr: number;
  constructor(sr: number) {
    this.sr = sr;
    this.dl = new DelayLine(Math.ceil(sr * 0.05));
    this.dr = new DelayLine(Math.ceil(sr * 0.05));
  }
  clear(): void {
    this.dl.clear();
    this.dr.clear();
    this.phase = 0;
  }
  process(p: Patch, l: Float32Array, r: Float32Array, n: number): void {
    const sr = this.sr;
    const base = 0.012 * sr;
    const depth = 0.006 * sr * p.chorusDepth;
    const inc = p.chorusRate / sr;
    const mix = p.chorusMix;
    for (let i = 0; i < n; i++) {
      this.phase += inc;
      if (this.phase >= 1) this.phase -= 1;
      // the two sides swing a quarter-cycle apart: that's the width
      const ml = Math.sin(2 * Math.PI * this.phase);
      const mr = Math.sin(2 * Math.PI * (this.phase + 0.25));
      const xl = l[i];
      const xr = r[i];
      this.dl.write(xl);
      this.dr.write(xr);
      const wl = this.dl.read(base + depth * (1 + ml));
      const wr = this.dr.read(base + depth * (1 + mr));
      l[i] = xl * (1 - 0.35 * mix) + wl * 0.75 * mix;
      r[i] = xr * (1 - 0.35 * mix) + wr * 0.75 * mix;
    }
  }
}

/** A ping-pong delay: echoes bounce left, right, left, each a little darker. */
class Delay {
  private readonly dl: DelayLine;
  private readonly dr: DelayLine;
  private lpL = 0;
  private lpR = 0;
  private readonly sr: number;
  constructor(sr: number) {
    this.sr = sr;
    this.dl = new DelayLine(Math.ceil(sr * 2.1));
    this.dr = new DelayLine(Math.ceil(sr * 2.1));
  }
  clear(): void {
    this.dl.clear();
    this.dr.clear();
    this.lpL = this.lpR = 0;
  }
  process(p: Patch, l: Float32Array, r: Float32Array, n: number): void {
    const d = Math.min(2, divisionSeconds(p.delayDiv)) * this.sr;
    const fb = p.delayFeedback;
    const mix = p.delayMix;
    const damp = 1 - Math.exp((-2 * Math.PI * 3500) / this.sr);
    for (let i = 0; i < n; i++) {
      const el = this.dl.read(d);
      const er = this.dr.read(d);
      this.lpL += (el - this.lpL) * damp;
      this.lpR += (er - this.lpR) * damp;
      const mono = 0.5 * (l[i] + r[i]);
      this.dl.write(mono + this.lpR * fb);
      this.dr.write(this.lpL * fb);
      l[i] += el * mix;
      r[i] += er * mix;
    }
  }
}

/**
 * Reverb: eight delay lines feeding each other through a mixing matrix (a feedback delay
 * network), with a little damping each pass so the tail darkens like a real room.
 */
const FDN_MS = [29.7, 37.1, 41.1, 43.7, 53.0, 59.3, 67.1, 73.1];

class Reverb {
  private readonly lines: DelayLine[];
  private readonly lens: number[];
  private readonly lp = new Float64Array(8);
  private readonly x = new Float64Array(8);
  private readonly sr: number;
  private gains = new Float64Array(8);
  private sizeSeen = -1;
  private readonly pre: DelayLine;
  constructor(sr: number) {
    this.sr = sr;
    this.lens = FDN_MS.map(ms => Math.round((ms / 1000) * sr * 1.5));
    this.lines = this.lens.map(len => new DelayLine(len + 2));
    this.pre = new DelayLine(Math.ceil(sr * 0.03));
  }
  clear(): void {
    for (const l of this.lines) l.clear();
    this.pre.clear();
    this.lp.fill(0);
  }
  process(p: Patch, l: Float32Array, r: Float32Array, n: number): void {
    const sr = this.sr;
    const scale = 0.55 + 0.45 * p.reverbSize;
    if (p.reverbSize !== this.sizeSeen) {
      this.sizeSeen = p.reverbSize;
      const rt60 = 0.5 + 5 * p.reverbSize * p.reverbSize;
      for (let k = 0; k < 8; k++) this.gains[k] = Math.pow(10, (-3 * (this.lens[k] * scale)) / sr / rt60);
    }
    const damp = 1 - Math.exp((-2 * Math.PI * (2500 + 6000 * (1 - p.reverbSize))) / sr);
    const mix = p.reverbMix;
    const x = this.x;
    const preD = 0.02 * sr;
    for (let i = 0; i < n; i++) {
      this.pre.write(0.5 * (l[i] + r[i]));
      const input = this.pre.read(preD) * 0.35;
      for (let k = 0; k < 8; k++) {
        const v = this.lines[k].read(this.lens[k] * scale);
        this.lp[k] += (v - this.lp[k]) * damp;
        x[k] = this.lp[k] * this.gains[k];
      }
      // 8-point Hadamard mix (energy-preserving)
      for (let h = 1; h < 8; h <<= 1) {
        for (let a = 0; a < 8; a += h << 1) {
          for (let b = a; b < a + h; b++) {
            const u = x[b];
            const v = x[b + h];
            x[b] = u + v;
            x[b + h] = u - v;
          }
        }
      }
      const s = 1 / Math.sqrt(8);
      let wl = 0;
      let wr = 0;
      for (let k = 0; k < 8; k++) {
        const v = x[k] * s;
        this.lines[k].write(v + (k & 1 ? -input : input));
        if (k & 1) wr += v;
        else wl += v;
      }
      l[i] = l[i] * (1 - 0.4 * mix) + wl * 0.9 * mix;
      r[i] = r[i] * (1 - 0.4 * mix) + wr * 0.9 * mix;
    }
  }
}

export class Effects {
  private readonly chorus: Chorus;
  private readonly delay: Delay;
  private readonly reverb: Reverb;
  /** Seconds of tail left after the last voice stopped. */
  tail = 0;

  constructor(sr: number) {
    this.chorus = new Chorus(sr);
    this.delay = new Delay(sr);
    this.reverb = new Reverb(sr);
  }

  clear(): void {
    this.chorus.clear();
    this.delay.clear();
    this.reverb.clear();
    this.tail = 0;
  }

  /** How long the effects ring on after the voices fall silent (s). */
  tailFor(p: Patch): number {
    let t = 0;
    if (p.chorusMix > 0) t = 0.06;
    if (p.delayMix > 0) t = Math.max(t, divisionSeconds(p.delayDiv) * (1 + Math.log(0.001) / Math.log(Math.max(0.01, p.delayFeedback))));
    if (p.reverbMix > 0) t = Math.max(t, 0.6 + 5 * p.reverbSize * p.reverbSize);
    return Math.min(12, t);
  }

  process(p: Patch, l: Float32Array, r: Float32Array, n: number): void {
    if (p.drive > 0) drive(p, l, r, n);
    if (p.chorusMix > 0) this.chorus.process(p, l, r, n);
    if (p.delayMix > 0) this.delay.process(p, l, r, n);
    if (p.reverbMix > 0) this.reverb.process(p, l, r, n);
  }
}
