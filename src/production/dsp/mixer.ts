/**
 * The mixing console: stems in, a stereo mix out, the way a DAW's mixer is wired.
 *
 *   stem ─ trim ─ high-pass ─ EQ ─ compressor ─ fader ─ pan ─┬─────────────► mix bus
 *                                                         ├─ reverb send ─► reverb ─► return ─┤
 *                                                         └─ delay send ──► delay ──► return ─┤
 *   mix bus ─ bus compressor ─ limiter ─ master fader ─ [mono] ─ out (meters on every channel and the master)
 *
 * Sends are post-fader, as on most desks: turn a channel down and its echo goes with it.
 * Solo works as on a desk too: any solo mutes every channel that isn't soloed (the effect
 * returns stay).
 *
 * The stems are mono, one loop each, all the same length; the transport plays them round
 * and round. Pure TS: the worklet, the offline renders and the tests all use this class.
 */
import { ChannelEq, Compressor, Limiter, LoudnessMeter, PingPong, Reverb } from './blocks';
import { type Mix, SILENT_DB, dbToGain, makeMix } from './params';

const BLOCK = 128;

export interface ChannelMeter {
  /** Peak since the last read (linear, post-fader). */
  peak: number;
  /** RMS since the last read (linear, post-fader). */
  rms: number;
  /** Most compressor gain reduction since the last read (dB). */
  reduction: number;
  /** Peak into the channel after the trim (for gain staging; > 1 clips). */
  input: number;
}

export interface MeterSnapshot {
  channels: Record<string, ChannelMeter>;
  master: { peakL: number; peakR: number; rmsL: number; rmsR: number; momentary: number; shortTerm: number; compReduction: number; limitReduction: number; clipped: boolean };
  /** Playback position in the loop (0..1). */
  position: number;
}

interface Strip {
  id: string;
  stem: Float32Array;
  eq: ChannelEq;
  comp: Compressor;
  trim: number;
  fader: number;
  /** Fader gain the last block ended on (ramped to avoid zipper noise). */
  faderNow: number;
  panL: number;
  panR: number;
  rev: number;
  del: number;
  muted: boolean;
  soloed: boolean;
  // meters
  peak: number;
  sum: number;
  count: number;
  input: number;
}

export class Mixer {
  readonly sr: number;
  readonly channels: string[];
  private strips: Strip[];
  private mix: Mix;
  private loopLen = 0;
  private pos = 0;
  private playing = false;
  tempo = 100;
  private readonly busL = new Float32Array(BLOCK);
  private readonly busR = new Float32Array(BLOCK);
  private readonly ch = new Float32Array(BLOCK);
  private readonly revIn = new Float32Array(BLOCK);
  private readonly delIn = new Float32Array(BLOCK);
  private readonly fxL = new Float32Array(BLOCK);
  private readonly fxR = new Float32Array(BLOCK);
  private readonly reverb: Reverb;
  private readonly delay: PingPong;
  private revLevel = 1;
  private delLevel = 1;
  /** Samples since anything was sent to each effect: once its tail has died it's skipped. */
  private revIdle = Infinity;
  private delIdle = Infinity;
  private readonly busComp: Compressor;
  private readonly limiter: Limiter;
  private masterGain = 1;
  private mono = false;
  private readonly loud: LoudnessMeter;
  private mPeakL = 0;
  private mPeakR = 0;
  private mSumL = 0;
  private mSumR = 0;
  private mCount = 0;
  private clipped = false;
  /** Samples of effect tail still sounding after the transport stops. */
  private tail = 0;
  /** Capture each channel's output (post-fader, before pan) for the judge. */
  capture: Record<string, Float32Array> | null = null;
  private captureAt = 0;

  constructor(sr: number, channels: readonly string[]) {
    this.sr = sr;
    this.channels = [...channels];
    this.mix = makeMix(channels);
    this.strips = channels.map(id => this.newStrip(id, new Float32Array(0)));
    this.reverb = new Reverb(sr);
    this.delay = new PingPong(sr);
    this.busComp = new Compressor(sr);
    this.limiter = new Limiter(sr);
    this.loud = new LoudnessMeter(sr, BLOCK);
    this.setMix(this.mix);
  }

  private newStrip(id: string, stem: Float32Array): Strip {
    return { id, stem, eq: new ChannelEq(this.sr), comp: new Compressor(this.sr), trim: 1, fader: 1, faderNow: 1, panL: Math.SQRT1_2, panR: Math.SQRT1_2, rev: 0, del: 0, muted: false, soloed: false, peak: 0, sum: 0, count: 0, input: 0 };
  }

  /** The stems (mono, one loop each; the shortest sets the loop). */
  setStems(stems: Record<string, Float32Array>): void {
    for (const s of this.strips) s.stem = stems[s.id] ?? new Float32Array(0);
    const lens = this.strips.map(s => s.stem.length).filter(n => n > 0);
    this.loopLen = lens.length ? Math.min(...lens) : 0;
    if (this.pos >= this.loopLen) this.pos = 0;
  }

  getMix(): Mix {
    return this.mix;
  }

  /** The whole console at once. */
  setMix(mix: Mix): void {
    this.mix = { ...this.mix, ...mix };
    for (const s of this.strips) this.applyStrip(s);
    this.applyMaster();
    this.applyFx();
  }

  /** One setting (a fader moving). */
  set(key: string, value: number): void {
    this.mix[key] = value;
    const [scope] = key.split(':');
    if (scope === 'master') this.applyMaster();
    else if (scope === 'fx') this.applyFx();
    else {
      const s = this.strips.find(x => x.id === scope);
      if (s) this.applyStrip(s);
    }
  }

  private v(key: string): number {
    return this.mix[key] ?? 0;
  }

  private applyStrip(s: Strip): void {
    const k = (p: string) => this.v(`${s.id}:${p}`);
    s.trim = dbToGain(k('gain'));
    s.eq.set({
      hpOn: k('hpOn') > 0.5,
      hpFreq: k('hpFreq'),
      eqOn: k('eqOn') > 0.5,
      lowFreq: k('lowFreq'),
      lowGain: k('lowGain'),
      midFreq: k('midFreq'),
      midGain: k('midGain'),
      midQ: k('midQ'),
      presFreq: k('presFreq'),
      presGain: k('presGain'),
      presQ: k('presQ'),
      highFreq: k('highFreq'),
      highGain: k('highGain'),
    });
    s.comp.set({ on: k('compOn') > 0.5, threshold: k('threshold'), ratio: k('ratio'), attack: k('attack'), release: k('release'), makeup: k('makeup') });
    s.fader = k('fader') <= SILENT_DB ? 0 : dbToGain(k('fader'));
    // equal-power pan law (−3 dB in the centre)
    const th = ((Math.max(-1, Math.min(1, k('pan'))) + 1) * Math.PI) / 4;
    s.panL = Math.cos(th);
    s.panR = Math.sin(th);
    s.rev = dbToGain(k('reverb'));
    s.del = dbToGain(k('delay'));
    s.muted = k('mute') > 0.5;
    s.soloed = k('solo') > 0.5;
  }

  private applyMaster(): void {
    const k = (p: string) => this.v(`master:${p}`);
    this.busComp.set({ on: k('compOn') > 0.5, threshold: k('threshold'), ratio: k('ratio'), attack: k('attack'), release: k('release'), makeup: k('makeup') });
    this.limiter.on = k('limitOn') > 0.5;
    this.limiter.drive = dbToGain(k('drive'));
    this.limiter.ceiling = dbToGain(k('ceiling'));
    this.masterGain = k('fader') <= SILENT_DB ? 0 : dbToGain(k('fader'));
    this.mono = k('mono') > 0.5;
  }

  private applyFx(): void {
    const k = (p: string) => this.v(`fx:${p}`);
    this.reverb.set(k('reverbSize'), k('reverbPredelay'), k('reverbTone'));
    this.revLevel = dbToGain(k('reverbLevel'));
    this.delay.set((k('delayBeats') * 60) / this.tempo, k('delayFeedback'), k('delayTone'));
    this.delLevel = dbToGain(k('delayLevel'));
  }

  play(from?: number): void {
    if (from !== undefined) this.pos = Math.max(0, Math.min(this.loopLen - 1, Math.round(from * this.loopLen)));
    this.playing = true;
  }

  stop(): void {
    this.playing = false;
    this.tail = Math.round((Math.max(this.reverb.decay, Math.min(8, this.delay.tailSeconds()), 2) + 0.5) * this.sr);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Nothing playing and the effect tails have died away. */
  get silent(): boolean {
    return !this.playing && this.tail <= 0;
  }

  get position(): number {
    return this.loopLen ? this.pos / this.loopLen : 0;
  }

  /** Clear every filter, envelope and tail (a new quiz target, a new clip). */
  reset(): void {
    for (const s of this.strips) {
      s.eq.reset();
      s.comp.reset();
      s.faderNow = s.fader;
    }
    this.reverb.reset();
    this.delay.reset();
    this.revIdle = this.delIdle = Infinity;
    this.busComp.reset();
    this.limiter.reset();
    this.loud.reset();
    this.tail = 0;
  }

  /** Render n samples into l and r (overwriting) from `offset`. */
  render(l: Float32Array, r: Float32Array, n: number, offset = 0): void {
    for (let done = 0; done < n; ) {
      const m = Math.min(BLOCK, n - done);
      this.renderBlock(m);
      l.set(this.busL.subarray(0, m), offset + done);
      r.set(this.busR.subarray(0, m), offset + done);
      done += m;
    }
  }

  private renderBlock(n: number): void {
    const { busL, busR, ch, revIn, delIn } = this;
    busL.fill(0, 0, n);
    busR.fill(0, 0, n);
    if (!this.playing && this.tail <= 0) return;
    revIn.fill(0, 0, n);
    delIn.fill(0, 0, n);
    const anySolo = this.strips.some(s => s.soloed);
    const len = this.loopLen;
    let revSent = false;
    let delSent = false;
    for (const s of this.strips) {
      const audible = !s.muted && (!anySolo || s.soloed);
      // read the loop (silence once stopped, while the tails ring out)
      if (this.playing && len > 0) {
        let p = this.pos;
        for (let i = 0; i < n; i++) {
          ch[i] = s.stem[p] * s.trim;
          if (++p >= len) p = 0;
        }
      } else ch.fill(0, 0, n);
      let inPeak = s.input;
      for (let i = 0; i < n; i++) {
        const a = Math.abs(ch[i]);
        if (a > inPeak) inPeak = a;
      }
      s.input = inPeak;
      s.eq.process(ch, n);
      s.comp.process(ch, null, n);
      // fader, ramped across the block
      const g0 = s.faderNow;
      const g1 = audible ? s.fader : 0;
      const dg = (g1 - g0) / n;
      let peak = s.peak;
      let sum = s.sum;
      for (let i = 0; i < n; i++) {
        const y = ch[i] * (g0 + dg * (i + 1));
        ch[i] = y;
        const a = Math.abs(y);
        if (a > peak) peak = a;
        sum += y * y;
      }
      s.faderNow = g1;
      s.peak = peak;
      s.sum = sum;
      s.count += n;
      if (this.capture?.[s.id]) {
        const out = this.capture[s.id];
        const room = Math.min(n, out.length - this.captureAt);
        if (room > 0) out.set(ch.subarray(0, room), this.captureAt);
      }
      const { panL, panR, rev, del } = s;
      if (rev > 0 && g0 + g1 > 0) revSent = true;
      if (del > 0 && g0 + g1 > 0) delSent = true;
      for (let i = 0; i < n; i++) {
        const y = ch[i];
        busL[i] += y * panL;
        busR[i] += y * panR;
        revIn[i] += y * rev;
        delIn[i] += y * del;
      }
    }
    // the returns (an effect nothing has been sent to since its tail died costs nothing:
    // a reverb with no sends was a third of a rough mix's cost)
    const { fxL, fxR } = this;
    this.revIdle = revSent ? 0 : this.revIdle + n;
    this.delIdle = delSent ? 0 : this.delIdle + n;
    const revTail = (this.reverb.decay + 0.5) * this.sr;
    const delTail = this.delay.tailSeconds() * this.sr;
    if (this.revLevel > 0 && this.revIdle < revTail) {
      fxL.fill(0, 0, n);
      fxR.fill(0, 0, n);
      this.reverb.process(revIn, fxL, fxR, n);
      for (let i = 0; i < n; i++) {
        busL[i] += fxL[i] * this.revLevel;
        busR[i] += fxR[i] * this.revLevel;
      }
    }
    if (this.delLevel > 0 && this.delIdle < delTail) {
      fxL.fill(0, 0, n);
      fxR.fill(0, 0, n);
      this.delay.process(delIn, fxL, fxR, n);
      for (let i = 0; i < n; i++) {
        busL[i] += fxL[i] * this.delLevel;
        busR[i] += fxR[i] * this.delLevel;
      }
    }
    // the master
    this.busComp.process(busL, busR, n);
    this.limiter.process(busL, busR, n);
    const mg = this.masterGain;
    let pl = this.mPeakL;
    let pr = this.mPeakR;
    const mono = this.mono;
    for (let i = 0; i < n; i++) {
      if (mono) busL[i] = busR[i] = 0.5 * (busL[i] + busR[i]);
      const a = (busL[i] *= mg);
      const b = (busR[i] *= mg);
      const aa = Math.abs(a);
      const bb = Math.abs(b);
      if (aa > pl) pl = aa;
      if (bb > pr) pr = bb;
      this.mSumL += a * a;
      this.mSumR += b * b;
    }
    if (pl > 1 || pr > 1) this.clipped = true;
    this.mPeakL = pl;
    this.mPeakR = pr;
    this.mCount += n;
    this.loud.process(busL, busR, n);
    if (this.playing && len > 0) this.pos = (this.pos + n) % len;
    else this.tail -= n;
    if (this.capture) this.captureAt += n;
  }

  /** Read and reset the meters. */
  meters(): MeterSnapshot {
    const channels: Record<string, ChannelMeter> = {};
    for (const s of this.strips) {
      channels[s.id] = { peak: s.peak, rms: s.count ? Math.sqrt(s.sum / s.count) : 0, reduction: s.comp.reduction, input: s.input };
      s.peak = 0;
      s.sum = 0;
      s.count = 0;
      s.input = 0;
      s.comp.reduction = 0;
    }
    const snap: MeterSnapshot = {
      channels,
      master: {
        peakL: this.mPeakL,
        peakR: this.mPeakR,
        rmsL: this.mCount ? Math.sqrt(this.mSumL / this.mCount) : 0,
        rmsR: this.mCount ? Math.sqrt(this.mSumR / this.mCount) : 0,
        momentary: this.loud.momentary,
        shortTerm: this.loud.shortTerm,
        compReduction: this.busComp.reduction,
        limitReduction: this.limiter.reduction,
        clipped: this.clipped,
      },
      position: this.position,
    };
    this.mPeakL = this.mPeakR = this.mSumL = this.mSumR = 0;
    this.mCount = 0;
    this.clipped = false;
    this.busComp.reduction = 0;
    this.limiter.reduction = 0;
    return snap;
  }

  /** Start capturing each channel's output (n samples) for analysis. */
  startCapture(n: number): Record<string, Float32Array> {
    this.capture = Object.fromEntries(this.channels.map(c => [c, new Float32Array(n)]));
    this.captureAt = 0;
    return this.capture;
  }
}
