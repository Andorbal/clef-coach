/**
 * The console's building blocks, pure TS so they run the same in the AudioWorklet, in
 * offline renders (quiz targets and the judge) and in Vitest: a biquad, the channel EQ,
 * a compressor, a look-ahead limiter, a reverb, a delay and a loudness meter.
 *
 * Everything works in place on preallocated buffers and makes no garbage on the audio
 * thread. Coefficients change only when a setting does, never per sample.
 */
import { type BiquadCoeffs, biquadCoeffs } from '../../audio/dsp/util';

/** One biquad section (transposed direct form II). */
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private z1 = 0;
  private z2 = 0;
  set(c: BiquadCoeffs): void {
    this.b0 = c.b0;
    this.b1 = c.b1;
    this.b2 = c.b2;
    this.a1 = c.a1;
    this.a2 = c.a2;
  }
  process(buf: Float32Array, n: number): void {
    const { b0, b1, b2, a1, a2 } = this;
    let z1 = this.z1;
    let z2 = this.z2;
    for (let i = 0; i < n; i++) {
      const x = buf[i];
      const y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      buf[i] = y;
    }
    // denormals: let a decayed state fall to zero
    this.z1 = Math.abs(z1) < 1e-20 ? 0 : z1;
    this.z2 = Math.abs(z2) < 1e-20 ? 0 : z2;
  }
  reset(): void {
    this.z1 = this.z2 = 0;
  }
}

export interface EqSettings {
  hpOn: boolean;
  hpFreq: number;
  eqOn: boolean;
  lowFreq: number;
  lowGain: number;
  midFreq: number;
  midGain: number;
  midQ: number;
  presFreq: number;
  presGain: number;
  presQ: number;
  highFreq: number;
  highGain: number;
}

/** A channel's EQ: a 12 dB/octave high-pass, a low shelf, two bells and a high shelf. */
export class ChannelEq {
  private readonly hp = new Biquad();
  private readonly bands = [new Biquad(), new Biquad(), new Biquad(), new Biquad()];
  private active = [false, false, false, false];
  private hpOn = false;
  private readonly sr: number;
  constructor(sr: number) {
    this.sr = sr;
  }

  set(s: EqSettings): void {
    this.hpOn = s.hpOn;
    if (s.hpOn) this.hp.set(biquadCoeffs('highpass', s.hpFreq, Math.SQRT1_2, 0, this.sr));
    const gains = [s.lowGain, s.midGain, s.presGain, s.highGain];
    this.active = gains.map(g => s.eqOn && Math.abs(g) > 0.01);
    if (this.active[0]) this.bands[0].set(biquadCoeffs('lowshelf', s.lowFreq, Math.SQRT1_2, s.lowGain, this.sr));
    if (this.active[1]) this.bands[1].set(biquadCoeffs('peaking', s.midFreq, s.midQ, s.midGain, this.sr));
    if (this.active[2]) this.bands[2].set(biquadCoeffs('peaking', s.presFreq, s.presQ, s.presGain, this.sr));
    if (this.active[3]) this.bands[3].set(biquadCoeffs('highshelf', s.highFreq, Math.SQRT1_2, s.highGain, this.sr));
  }

  process(buf: Float32Array, n: number): void {
    if (this.hpOn) this.hp.process(buf, n);
    for (let b = 0; b < 4; b++) if (this.active[b]) this.bands[b].process(buf, n);
  }

  reset(): void {
    this.hp.reset();
    this.bands.forEach(b => b.reset());
  }
}

/** The EQ's response (dB) at a frequency, for drawing the curve. */
export function eqResponse(s: EqSettings, f: number, sr = 48000): number {
  let db = 0;
  const add = (c: BiquadCoeffs) => {
    const w = (2 * Math.PI * f) / sr;
    const cos1 = Math.cos(w);
    const cos2 = Math.cos(2 * w);
    const sin1 = Math.sin(w);
    const sin2 = Math.sin(2 * w);
    const nr = c.b0 + c.b1 * cos1 + c.b2 * cos2;
    const ni = -(c.b1 * sin1 + c.b2 * sin2);
    const dr = 1 + c.a1 * cos1 + c.a2 * cos2;
    const di = -(c.a1 * sin1 + c.a2 * sin2);
    db += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  };
  if (s.hpOn) add(biquadCoeffs('highpass', s.hpFreq, Math.SQRT1_2, 0, sr));
  if (s.eqOn) {
    if (s.lowGain) add(biquadCoeffs('lowshelf', s.lowFreq, Math.SQRT1_2, s.lowGain, sr));
    if (s.midGain) add(biquadCoeffs('peaking', s.midFreq, s.midQ, s.midGain, sr));
    if (s.presGain) add(biquadCoeffs('peaking', s.presFreq, s.presQ, s.presGain, sr));
    if (s.highGain) add(biquadCoeffs('highshelf', s.highFreq, Math.SQRT1_2, s.highGain, sr));
  }
  return db;
}

export interface CompSettings {
  on: boolean;
  /** dB */
  threshold: number;
  ratio: number;
  /** ms */
  attack: number;
  /** ms */
  release: number;
  /** dB */
  makeup: number;
}

/** Soft knee width (dB): compression eases in over this range around the threshold. */
const KNEE = 6;

/** The compressor's static curve: output level (dB) for an input level (dB). */
export function compCurve(x: number, threshold: number, ratio: number, knee = KNEE): number {
  const over = x - threshold;
  if (2 * over < -knee) return x;
  if (2 * Math.abs(over) <= knee) return x + ((1 / ratio - 1) * (over + knee / 2) ** 2) / (2 * knee);
  return threshold + over / ratio;
}

/** Samples per gain update: the detector reads every sample, the gain moves every 8 (0.17 ms at 48 kHz). */
const COMP_STEP = 8;

/**
 * A feed-forward compressor with a soft knee, smoothing the gain in dB with separate
 * attack and release (a "decoupled" peak detector, as most plug-ins do), and makeup gain.
 * Works on one channel (the console's sources are mono) or linked on two.
 *
 * The gain is worked out every 8 samples from the peak in between and ramped across them:
 * a log and a power per sample made a reference mix's compressors most of its cost.
 */
export class Compressor {
  private env = 0;
  private gain = 1;
  private aAtt = 0;
  private aRel = 0;
  private s: CompSettings = { on: false, threshold: 0, ratio: 1, attack: 10, release: 100, makeup: 0 };
  /** The most gain reduction since the meters last read it (dB, ≥ 0). */
  reduction = 0;
  private readonly sr: number;
  constructor(sr: number) {
    this.sr = sr;
  }

  set(s: CompSettings): void {
    if (s.on && !this.s.on) {
      this.env = 0;
      this.gain = Math.pow(10, s.makeup / 20);
    }
    this.s = s;
    this.aAtt = Math.exp(-COMP_STEP / (Math.max(0.05, s.attack) * 0.001 * this.sr));
    this.aRel = Math.exp(-COMP_STEP / (Math.max(1, s.release) * 0.001 * this.sr));
  }

  process(l: Float32Array, r: Float32Array | null, n: number): void {
    const { threshold, ratio, makeup } = this.s;
    if (!this.s.on) return;
    const aA = this.aAtt;
    const aR = this.aRel;
    let env = this.env;
    let g0 = this.gain;
    let most = this.reduction;
    for (let i0 = 0; i0 < n; i0 += COMP_STEP) {
      const i1 = Math.min(n, i0 + COMP_STEP);
      let x = 0;
      for (let i = i0; i < i1; i++) {
        const a = l[i] < 0 ? -l[i] : l[i];
        if (a > x) x = a;
        if (r) {
          const b = r[i] < 0 ? -r[i] : r[i];
          if (b > x) x = b;
        }
      }
      const xdb = x > 1e-6 ? 20 * Math.log10(x) : -120;
      const gs = compCurve(xdb, threshold, ratio) - xdb;
      env = gs < env ? aA * env + (1 - aA) * gs : aR * env + (1 - aR) * gs;
      if (-env > most) most = -env;
      const g1 = Math.pow(10, (env + makeup) / 20);
      const dg = (g1 - g0) / (i1 - i0);
      for (let i = i0, k = 1; i < i1; i++, k++) {
        const g = g0 + dg * k;
        l[i] *= g;
        if (r) r[i] *= g;
      }
      g0 = g1;
    }
    this.env = env;
    this.gain = g0;
    this.reduction = most;
  }

  reset(): void {
    this.env = 0;
    this.gain = Math.pow(10, this.s.makeup / 20);
    this.reduction = 0;
  }
}

/**
 * A look-ahead peak limiter: the signal is delayed a moment, so the gain is already down
 * when a peak arrives; the gain recovers smoothly afterwards. Nothing leaves above the
 * ceiling.
 */
export class Limiter {
  private readonly bufL: Float32Array;
  private readonly bufR: Float32Array;
  private pos = 0;
  private gain = 1;
  private hold = 0;
  private readonly look: number;
  private readonly rel: number;
  ceiling = 1;
  drive = 1;
  on = false;
  reduction = 0;
  constructor(sr: number) {
    this.look = Math.max(1, Math.round(0.0015 * sr));
    this.bufL = new Float32Array(this.look);
    this.bufR = new Float32Array(this.look);
    this.rel = Math.exp(-1 / (0.08 * sr));
  }

  process(l: Float32Array, r: Float32Array, n: number): void {
    if (!this.on) return;
    const { ceiling, drive, look } = this;
    let gain = this.gain;
    let hold = this.hold;
    let lowest = gain;
    let pos = this.pos;
    for (let i = 0; i < n; i++) {
      const xl = l[i] * drive;
      const xr = r[i] * drive;
      const peak = Math.max(Math.abs(xl), Math.abs(xr));
      const target = peak > ceiling ? ceiling / peak : 1;
      if (target < gain) {
        gain = target;
        hold = look;
      } else if (hold > 0) hold--;
      else gain = target + (gain - target) * this.rel;
      const dl = this.bufL[pos];
      const dr = this.bufR[pos];
      this.bufL[pos] = xl;
      this.bufR[pos] = xr;
      pos = pos + 1 === look ? 0 : pos + 1;
      let yl = dl * gain;
      let yr = dr * gain;
      // the safety net: the ceiling is absolute
      if (yl > ceiling) yl = ceiling;
      else if (yl < -ceiling) yl = -ceiling;
      if (yr > ceiling) yr = ceiling;
      else if (yr < -ceiling) yr = -ceiling;
      l[i] = yl;
      r[i] = yr;
      if (gain < lowest) lowest = gain;
    }
    this.gain = gain;
    this.hold = hold;
    this.pos = pos;
    // the meter's reading, worked out once a block rather than per sample
    const red = -20 * Math.log10(lowest);
    if (red > this.reduction) this.reduction = red;
  }

  reset(): void {
    this.bufL.fill(0);
    this.bufR.fill(0);
    this.gain = 1;
    this.hold = 0;
    this.reduction = 0;
  }
}

/** A delay line with a fractional read. */
class Line {
  readonly buf: Float32Array;
  pos = 0;
  constructor(len: number) {
    this.buf = new Float32Array(len);
  }
  read(d: number): number {
    const len = this.buf.length;
    let r = this.pos - d;
    if (r < 0) r += len;
    const i = r | 0;
    const f = r - i;
    return this.buf[i] + (this.buf[i + 1 === len ? 0 : i + 1] - this.buf[i]) * f;
  }
  write(x: number): void {
    this.buf[this.pos] = x;
    this.pos = this.pos + 1 === this.buf.length ? 0 : this.pos + 1;
  }
  clear(): void {
    this.buf.fill(0);
  }
}

/** Prime-ish line lengths (ms at size 1) for the reverb's eight lines. */
const FDN_MS = [31.7, 37.1, 41.1, 43.7, 47.3, 53.9, 59.3, 61.7];

/**
 * An eight-line feedback delay network reverb: lines mixed through a Hadamard matrix,
 * each with a damping filter for the high frequencies dying faster (`tone`), and a
 * pre-delay. `size` sets the room (line lengths) and the decay together.
 */
export class Reverb {
  private readonly lines: Line[];
  private readonly lens = new Float64Array(8);
  private readonly fb = new Float64Array(8);
  private readonly lp = new Float64Array(8);
  private damp = 0.3;
  private readonly pre: Line;
  private preLen = 1;
  private readonly sr: number;
  private readonly v = new Float64Array(8);
  /** Seconds the tail rings (to −60 dB), for the transport to know when it's quiet. */
  decay = 1.5;
  constructor(sr: number) {
    this.sr = sr;
    this.lines = FDN_MS.map(ms => new Line(Math.ceil(ms * 0.002 * sr) + 4));
    this.pre = new Line(Math.ceil(0.16 * sr) + 4);
    this.set(0.5, 20, 0.6);
  }

  /** size 0..1, pre-delay ms, tone 0..1 (dark … bright). */
  set(size: number, predelay: number, tone: number): void {
    const scale = 0.45 + size * 1.5;
    this.decay = 0.35 + size * size * 4;
    for (let i = 0; i < 8; i++) {
      this.lens[i] = Math.min(this.lines[i].buf.length - 2, FDN_MS[i] * 0.001 * scale * this.sr);
      this.fb[i] = Math.pow(10, (-3 * this.lens[i]) / (this.decay * this.sr));
    }
    this.damp = 0.05 + (1 - tone) * 0.6;
    this.preLen = Math.max(1, Math.min(this.pre.buf.length - 2, predelay * 0.001 * this.sr));
  }

  /** Mono in, stereo out (added to l and r). */
  process(input: Float32Array, l: Float32Array, r: Float32Array, n: number): void {
    const v = this.v;
    const damp = this.damp;
    for (let i = 0; i < n; i++) {
      this.pre.write(input[i]);
      const x = this.pre.read(this.preLen) * 0.35;
      for (let k = 0; k < 8; k++) {
        // damping: a one-pole low-pass inside each line's loop
        const y = this.lines[k].read(this.lens[k]);
        this.lp[k] += (y - this.lp[k]) * (1 - damp);
        v[k] = this.lp[k] * this.fb[k];
      }
      // Hadamard 8×8 (fast, unitary with the 1/√8)
      for (let s = 1; s < 8; s <<= 1)
        for (let k = 0; k < 8; k += s << 1)
          for (let j = k; j < k + s; j++) {
            const a = v[j];
            const b = v[j + s];
            v[j] = a + b;
            v[j + s] = a - b;
          }
      const norm = 0.35355339;
      for (let k = 0; k < 8; k++) this.lines[k].write(v[k] * norm + x);
      l[i] += (this.lp[0] + this.lp[2] + this.lp[4] + this.lp[6]) * 0.5;
      r[i] += (this.lp[1] + this.lp[3] + this.lp[5] + this.lp[7]) * 0.5;
    }
  }

  reset(): void {
    this.lines.forEach(x => x.clear());
    this.pre.clear();
    this.lp.fill(0);
  }
}

/** A ping-pong delay: echoes bounce left and right, each a little darker. */
export class PingPong {
  private readonly left: Line;
  private readonly right: Line;
  private len = 1;
  private fb = 0.35;
  private lpCoef = 0.5;
  private lpL = 0;
  private lpR = 0;
  private readonly sr: number;
  constructor(sr: number) {
    this.sr = sr;
    this.left = new Line(Math.ceil(2.1 * sr));
    this.right = new Line(Math.ceil(2.1 * sr));
  }

  /** How long the echoes take to fall 60 dB (s). */
  tailSeconds(): number {
    const repeats = this.fb > 0.01 ? Math.ceil(-3 / Math.log10(this.fb)) : 1;
    return ((Math.min(40, repeats) + 1) * this.len) / this.sr;
  }

  /** seconds, feedback 0..0.9, tone 0..1 */
  set(seconds: number, feedback: number, tone: number): void {
    this.len = Math.max(1, Math.min(this.left.buf.length - 2, seconds * this.sr));
    this.fb = feedback;
    this.lpCoef = 0.15 + tone * 0.8;
  }

  process(input: Float32Array, l: Float32Array, r: Float32Array, n: number): void {
    for (let i = 0; i < n; i++) {
      const dl = this.left.read(this.len);
      const dr = this.right.read(this.len);
      this.lpL += (dl - this.lpL) * this.lpCoef;
      this.lpR += (dr - this.lpR) * this.lpCoef;
      // the input goes left first; each side feeds the other
      this.left.write(input[i] + this.lpR * this.fb);
      this.right.write(this.lpL * this.fb);
      l[i] += this.lpL;
      r[i] += this.lpR;
    }
  }

  reset(): void {
    this.left.clear();
    this.right.clear();
    this.lpL = this.lpR = 0;
  }
}

/**
 * Loudness as the broadcast meters measure it (ITU-R BS.1770, roughly): K-weighting (a
 * high-frequency shelf and a low cut), then mean square over a 400 ms window
 * ("momentary") and a 3 s one ("short-term"), in LUFS.
 */
export class LoudnessMeter {
  private readonly shelfL = new Biquad();
  private readonly shelfR = new Biquad();
  private readonly hpL = new Biquad();
  private readonly hpR = new Biquad();
  private readonly tmpL: Float32Array;
  private readonly tmpR: Float32Array;
  private readonly block: number;
  private acc = 0;
  private count = 0;
  /** 100 ms blocks of mean square, newest last (up to 3 s). */
  private readonly blocks: number[] = [];
  constructor(sr: number, maxBlock = 4096) {
    this.shelfL.set(biquadCoeffs('highshelf', 1500, Math.SQRT1_2, 4, sr));
    this.shelfR.set(biquadCoeffs('highshelf', 1500, Math.SQRT1_2, 4, sr));
    this.hpL.set(biquadCoeffs('highpass', 38, 0.5, 0, sr));
    this.hpR.set(biquadCoeffs('highpass', 38, 0.5, 0, sr));
    this.tmpL = new Float32Array(maxBlock);
    this.tmpR = new Float32Array(maxBlock);
    this.block = Math.round(0.1 * sr);
  }

  process(l: Float32Array, r: Float32Array, n: number): void {
    for (let off = 0; off < n; off += this.tmpL.length) {
      const m = Math.min(this.tmpL.length, n - off);
      this.tmpL.set(l.subarray(off, off + m));
      this.tmpR.set(r.subarray(off, off + m));
      this.shelfL.process(this.tmpL, m);
      this.hpL.process(this.tmpL, m);
      this.shelfR.process(this.tmpR, m);
      this.hpR.process(this.tmpR, m);
      for (let i = 0; i < m; i++) {
        this.acc += this.tmpL[i] * this.tmpL[i] + this.tmpR[i] * this.tmpR[i];
        if (++this.count >= this.block) {
          this.blocks.push(this.acc / this.count);
          if (this.blocks.length > 30) this.blocks.shift();
          this.acc = 0;
          this.count = 0;
        }
      }
    }
  }

  private lufs(nBlocks: number): number {
    const b = this.blocks.slice(-nBlocks);
    if (!b.length) return -Infinity;
    const ms = b.reduce((a, x) => a + x, 0) / b.length;
    return ms > 1e-10 ? -0.691 + 10 * Math.log10(ms) : -Infinity;
  }

  get momentary(): number {
    return this.lufs(4);
  }

  get shortTerm(): number {
    return this.lufs(30);
  }

  reset(): void {
    this.blocks.length = 0;
    this.acc = 0;
    this.count = 0;
    [this.shelfL, this.shelfR, this.hpL, this.hpR].forEach(b => b.reset());
  }
}
