/**
 * One voice: everything one key plays, from the raw sound through filter and amplifier.
 *
 *   source (oscillators | FM operators | harmonics) → drive → filter → amplifier → out
 *        ↑ pitch: glide, mod envelope, LFO       ↑ cutoff: key, filter env, LFO   ↑ amp env, LFO
 *
 * Modulation (envelopes other than the amplifier's, the LFO, glide, the filter's cutoff)
 * is worked out every CONTROL samples (a third of a millisecond at 48 kHz) and the
 * sound itself every sample. Moving a filter's coefficients or an oscillator's pitch at
 * that rate can't be heard, and it's what lets eight voices of three-oscillator unison
 * run inside an AudioWorklet on a tablet. The amplifier envelope runs per sample, so
 * fast attacks stay click-free.
 *
 * A voice reads the patch as it plays, so turning a knob changes held notes at once:
 * the whole point of experimenting.
 */
import { Adsr, Stage } from './env';
import { Filter } from './filter';
import { ALGORITHMS, FEEDBACK_MAX, clampAlgo, modIndex } from './fm';
import { Lfo } from './lfo';
import { type Patch, divisionSeconds, HARMONIC_KEYS } from './params';
import { getTable, tableLevel, tableSample } from './tables';
import { noise, sine, softClip, waveSample } from './waves';

/** Samples per modulation step. */
export const CONTROL = 16;
export const MAX_UNISON = 7;
/** Level of one voice into the mix (headroom for chords and unison). */
const VOICE_GAIN = 0.3;

const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Voice {
  /** Key that owns the voice (−1 = free). */
  note = -1;
  velocity = 0.8;
  gate = false;
  /** Allocation order (for stealing the oldest). */
  order = 0;
  /** Current pitch in semitones (glides towards target). */
  pitch = 60;
  target = 60;
  /** Seconds since the note started. */
  time = 0;

  readonly amp = new Adsr();
  readonly fenv = new Adsr();
  readonly menv = new Adsr();
  readonly opEnv = [new Adsr(), new Adsr(), new Adsr(), new Adsr()];
  readonly lfo: Lfo;

  private readonly ph1 = new Float64Array(MAX_UNISON);
  private readonly ph2 = new Float64Array(MAX_UNISON);
  private readonly inc1 = new Float64Array(MAX_UNISON);
  private readonly inc2 = new Float64Array(MAX_UNISON);
  private readonly det = new Float64Array(MAX_UNISON);
  private readonly panL = new Float64Array(MAX_UNISON);
  private readonly panR = new Float64Array(MAX_UNISON);
  private phSub = 0;
  private readonly noiseState = new Uint32Array(1);

  private readonly opPh = new Float64Array(4);
  private readonly opInc = new Float64Array(4);
  private readonly opOut = new Float64Array(4);
  /** Operator envelope values at the start and end of the current step (ramped between). */
  private readonly opFrom = new Float64Array(4);
  private readonly opTo = new Float64Array(4);
  private readonly opRatio = new Float64Array(4);
  private readonly opLevel = new Float64Array(4);
  private readonly opIdx = new Float64Array(4);
  private fb1 = 0;
  private fb2 = 0;

  private readonly hPh = new Float64Array(16);
  private readonly hInc = new Float64Array(16);
  private readonly hFrom = new Float64Array(16);
  private readonly hTo = new Float64Array(16);

  private readonly fL = new Filter();
  private readonly fR = new Filter();

  private version = -1;
  private unisonSeen = 0;
  private widthSeen = -1;
  private detuneSeen = -1;

  private readonly sr: number;

  constructor(sampleRate: number, seed: number) {
    this.sr = sampleRate;
    this.lfo = new Lfo(seed);
  }

  get active(): boolean {
    return this.amp.stage !== Stage.Idle;
  }

  /** Start a note. `retrigger` false = legato (envelopes carry on, only the pitch moves). */
  start(p: Patch, note: number, velocity: number, fromPitch: number, retrigger: boolean, seed: number): void {
    const wasActive = this.active;
    this.note = note;
    this.velocity = velocity;
    this.gate = true;
    this.target = note;
    this.pitch = p.glide > 0 && fromPitch >= 0 ? fromPitch : note;
    if (!retrigger && wasActive) return;
    this.time = 0;
    this.lfo.reset(seed);
    let s = seed * 2654435761;
    const rnd = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    if (!wasActive) {
      // a fresh voice starts its oscillators together; unison copies at scattered phases
      for (let u = 0; u < MAX_UNISON; u++) {
        this.ph1[u] = u === 0 ? 0 : rnd();
        this.ph2[u] = u === 0 ? 0 : rnd();
      }
      this.phSub = 0;
      this.opPh.fill(0);
      this.opOut.fill(0);
      this.fb1 = this.fb2 = 0;
      this.hPh.fill(0);
      this.opFrom.fill(0);
      this.hFrom.fill(0);
      this.fL.reset();
      this.fR.reset();
    }
    this.noiseState[0] = (seed * 747796405 + 1) >>> 0 || 1;
    this.unisonSeen = 0;
    // envelope times first: a gate opened with stale ones would start at the wrong speed
    this.version = -1;
    this.setEnvelopes(p, this.sr);
    this.amp.gateOn();
    this.fenv.reset();
    this.fenv.gateOn();
    this.menv.reset();
    this.menv.gateOn();
    for (const e of this.opEnv) {
      if (!wasActive) e.reset();
      e.gateOn();
    }
  }

  /** Move a held (legato) voice to a new key. */
  glideTo(note: number, p: Patch): void {
    this.note = note;
    this.target = note;
    if (!(p.glide > 0)) this.pitch = note;
  }

  release(): void {
    this.gate = false;
    this.amp.gateOff();
    this.fenv.gateOff();
    this.menv.gateOff();
    for (const e of this.opEnv) e.gateOff();
  }

  /** Silence at once (voice reset). */
  kill(): void {
    this.gate = false;
    this.note = -1;
    this.amp.reset();
  }

  private setEnvelopes(p: Patch, sr: number): void {
    const cr = sr / CONTROL;
    this.amp.set(p.ampAttack, p.ampDecay, p.ampSustain, p.ampRelease, sr);
    this.fenv.set(p.fAttack, p.fDecay, p.fSustain, p.fRelease, cr);
    // the mod envelope is attack–decay: no sustain, release as fast as its decay
    this.menv.set(p.modAttack, p.modDecay, 0, p.modDecay, cr);
    this.opEnv[0].set(p.op1Attack, p.op1Decay, p.op1Sustain, p.op1Release, cr);
    this.opEnv[1].set(p.op2Attack, p.op2Decay, p.op2Sustain, p.op2Release, cr);
    this.opEnv[2].set(p.op3Attack, p.op3Decay, p.op3Sustain, p.op3Release, cr);
    this.opEnv[3].set(p.op4Attack, p.op4Decay, p.op4Sustain, p.op4Release, cr);
  }

  private setUnison(p: Patch): void {
    const n = this.unisonCount(p);
    this.unisonSeen = n;
    this.widthSeen = p.unisonWidth;
    this.detuneSeen = p.unisonDetune;
    for (let u = 0; u < MAX_UNISON; u++) {
      const x = n > 1 ? u / (n - 1) - 0.5 : 0; // −0.5..0.5
      this.det[u] = Math.pow(2, (x * p.unisonDetune) / 1200);
      const pan = n > 1 ? 2 * x * p.unisonWidth : 0;
      const th = ((pan + 1) * Math.PI) / 4;
      this.panL[u] = Math.cos(th) * Math.SQRT2;
      this.panR[u] = Math.sin(th) * Math.SQRT2;
    }
  }

  private unisonCount(p: Patch): number {
    if (p.engine === 'fm' || p.engine === 'additive') return 1;
    return Math.max(1, Math.min(MAX_UNISON, Math.round(p.unison)));
  }

  /**
   * Add `n` samples of this voice into out[L/R] from `off`. `version` changes whenever
   * the patch does (envelope coefficients are refreshed then).
   */
  render(p: Patch, version: number, sr: number, outL: Float32Array, outR: Float32Array, off: number, n: number): void {
    if (version !== this.version) {
      this.version = version;
      this.setEnvelopes(p, sr);
    }
    const U = this.unisonCount(p);
    if (U !== this.unisonSeen || p.unisonWidth !== this.widthSeen || p.unisonDetune !== this.detuneSeen) this.setUnison(p);
    let i = off;
    const end = off + n;
    while (i < end && this.active) {
      const len = Math.min(CONTROL, end - i);
      this.step(p, sr, U, outL, outR, i, len);
      i += len;
    }
    if (!this.active) this.note = -1;
  }

  /** One modulation step: work out the modulators, then `len` samples of sound. */
  private step(p: Patch, sr: number, U: number, outL: Float32Array, outR: Float32Array, off: number, len: number): void {
    const dtStep = len / sr;
    this.time += dtStep;

    // ---- modulators ----
    if (this.pitch !== this.target) {
      if (p.glide > 0) {
        const k = 1 - Math.exp((-dtStep * 4) / p.glide);
        this.pitch += (this.target - this.pitch) * k;
        if (Math.abs(this.target - this.pitch) < 0.001) this.pitch = this.target;
      } else this.pitch = this.target;
    }
    const fenv = this.fenv.next();
    const menv = this.menv.next();
    const rate = p.lfoSync ? 1 / divisionSeconds(p.lfoDiv) : p.lfoRate;
    const fade = p.lfoFade > 0 ? Math.min(1, this.time / p.lfoFade) : 1;
    const lfo = this.lfo.step(p.lfoShape, rate * dtStep) * fade;

    const pitch = this.pitch + menv * p.modPitch + (lfo * p.lfoPitch) / 100;
    const nyq = sr * 0.45;
    const vel = 0.5 + 0.5 * this.velocity;
    // tremolo: the LFO dips the level by up to `lfoAmp`
    const trem = 1 - p.lfoAmp * (0.5 - 0.5 * lfo);
    const gain = VOICE_GAIN * vel * trem;

    // ---- filter ----
    const filterOn = p.filterOn;
    if (filterOn) {
      const oct = p.filterEnv * 6 * fenv + lfo * p.lfoCutoff + (p.filterKey * (this.pitch - 60)) / 12;
      const fc = Math.min(nyq, Math.max(20, p.filterCutoff * Math.pow(2, oct)));
      this.fL.set(p.filterType, p.filterSlope, fc, p.filterRes, sr);
      this.fR.set(p.filterType, p.filterSlope, fc, p.filterRes, sr);
    }
    const driveG = 1 + 6 * p.filterDrive;
    const driveNorm = p.filterDrive > 0 ? 0.5 / softClip(0.5 * driveG) : 1;

    const amp = this.amp;
    const fL = this.fL;
    const fR = this.fR;
    const stereo = U > 1 && p.unisonWidth > 0;

    if (p.engine === 'fm') {
      this.renderFm(p, sr, pitch, outL, outR, off, len, gain, filterOn, driveG, driveNorm);
      return;
    }
    if (p.engine === 'additive') {
      this.renderAdditive(p, sr, pitch, fenv, outL, outR, off, len, gain, filterOn, driveG, driveNorm);
      return;
    }

    // ---- subtractive / wavetable ----
    const wt = p.engine === 'wavetable';
    const f1 = midiFreq(pitch + p.osc1Octave * 12 + p.osc1Semi + p.osc1Fine / 100);
    const f2 = midiFreq(pitch + p.osc2Octave * 12 + p.osc2Semi + p.osc2Fine / 100 + menv * p.modOsc2);
    for (let u = 0; u < U; u++) {
      this.inc1[u] = Math.min(0.49, (f1 * this.det[u]) / sr);
      this.inc2[u] = Math.min(0.49, (f2 * this.det[u]) / sr);
    }
    const incSub = f1 / 2 / sr;
    const l1 = p.osc1Level;
    const l2 = p.osc2Level;
    const ring = p.ringLevel;
    const sync = p.osc2Sync;
    const use1 = l1 > 0 || ring > 0;
    const use2 = l2 > 0 || ring > 0;
    const pwMod = lfo * p.lfoPw * 0.45;
    const pw1 = Math.min(0.95, Math.max(0.05, p.osc1Pw + pwMod));
    const pw2 = Math.min(0.95, Math.max(0.05, p.osc2Pw + pwMod));
    const w1 = p.osc1Wave;
    const w2 = p.osc2Wave;
    const t1 = wt ? getTable(p.osc1Table) : null;
    const t2 = wt ? getTable(p.osc2Table) : null;
    const posMod = lfo * p.lfoPos + menv * p.modPos;
    const pos1 = Math.min(1, Math.max(0, p.osc1Pos + posMod));
    const pos2 = Math.min(1, Math.max(0, p.osc2Pos + posMod));
    const lev1 = wt ? tableLevel(f1 * this.det[U - 1], nyq) : 0;
    const lev2 = wt ? tableLevel(f2 * this.det[U - 1], nyq) : 0;
    const subL = p.subLevel;
    const subSquare = p.subWave === 'square';
    const nz = p.noiseLevel;
    const uNorm = 1 / Math.sqrt(U);
    const ph1 = this.ph1;
    const ph2 = this.ph2;
    const inc1 = this.inc1;
    const inc2 = this.inc2;
    const panL = this.panL;
    const panR = this.panR;

    for (let i = off, e = off + len; i < e; i++) {
      let l = 0;
      let r = 0;
      for (let u = 0; u < U; u++) {
        let a = ph1[u] + inc1[u];
        let wrapped = false;
        if (a >= 1) {
          a -= 1;
          wrapped = true;
        }
        ph1[u] = a;
        let o1 = 0;
        let o2 = 0;
        if (use1) o1 = t1 ? tableSample(t1, lev1, pos1, a) : waveSample(w1, a, inc1[u], pw1);
        if (use2) {
          let b = ph2[u] + inc2[u];
          // hard sync: restart oscillator 2 where oscillator 1 restarted, keeping the fraction
          if (sync && wrapped) b = (a / inc1[u]) * inc2[u];
          else if (b >= 1) b -= Math.floor(b);
          ph2[u] = b;
          o2 = t2 ? tableSample(t2, lev2, pos2, b) : waveSample(w2, b, inc2[u], pw2);
        }
        const s = o1 * l1 + o2 * l2 + o1 * o2 * ring;
        l += s * panL[u];
        r += s * panR[u];
      }
      let m = 0;
      if (subL > 0) {
        let sp = this.phSub + incSub;
        if (sp >= 1) sp -= 1;
        this.phSub = sp;
        m += subL * (subSquare ? waveSample('square', sp, incSub, 0.5) : sine(sp));
      }
      if (nz > 0) m += nz * 0.6 * noise(this.noiseState);
      l = l * uNorm + m;
      r = r * uNorm + m;
      if (filterOn) {
        if (driveG > 1) {
          l = softClip(l * driveG) * driveNorm;
          r = softClip(r * driveG) * driveNorm;
        }
        l = fL.run(l);
        r = stereo ? fR.run(r) : l;
      } else if (!stereo) r = l;
      const g = amp.next() * gain;
      outL[i] += l * g;
      outR[i] += r * g;
    }
  }

  private renderFm(p: Patch, sr: number, pitch: number, outL: Float32Array, outR: Float32Array, off: number, len: number, gain: number, filterOn: boolean, driveG: number, driveNorm: number): void {
    const algo = ALGORITHMS[clampAlgo(p.fmAlgo)];
    const f = midiFreq(pitch);
    // (preallocated: an AudioWorklet should make no garbage while it plays)
    const ratios = this.opRatio;
    const levels = this.opLevel;
    const idx = this.opIdx;
    ratios[0] = p.op1Ratio;
    ratios[1] = p.op2Ratio;
    ratios[2] = p.op3Ratio;
    ratios[3] = p.op4Ratio;
    levels[0] = p.op1Level;
    levels[1] = p.op2Level;
    levels[2] = p.op3Level;
    levels[3] = p.op4Level;
    for (let o = 0; o < 4; o++) idx[o] = modIndex(levels[o]);
    const opPh = this.opPh;
    const opOut = this.opOut;
    const from = this.opFrom;
    const to = this.opTo;
    // per operator: is it heard, how hard it modulates, and its envelope ramp for this step
    let carriersAlive = false;
    for (let o = 0; o < 4; o++) {
      this.opInc[o] = Math.min(0.49, (f * ratios[o]) / sr);
      from[o] = to[o];
      to[o] = this.opEnv[o].next();
      if (algo.carriers.includes(o + 1) && (this.opEnv[o].active || to[o] > 0)) carriersAlive = true;
    }
    const fbOp = algo.feedback - 1;
    const fbAmt = p.fmFeedback * FEEDBACK_MAX;
    const used = algo.used;
    const carriers = algo.carriers;
    const links = algo.links;
    const norm = 1 / Math.max(1, Math.sqrt(carriers.length));
    const amp = this.amp;
    const fL = this.fL;
    const inv = 1 / len;
    for (let i = 0; i < len; i++) {
      const t = (i + 1) * inv;
      // operators from the top down, so modulators are computed before their targets
      for (let k = used.length - 1; k >= 0; k--) {
        const o = used[k] - 1;
        let mod = 0;
        for (let j = 0; j < links.length; j++) if (links[j][1] === o + 1) mod += opOut[links[j][0] - 1] * idx[links[j][0] - 1];
        if (o === fbOp && fbAmt > 0) mod += fbAmt * 0.5 * (this.fb1 + this.fb2);
        let ph = opPh[o] + this.opInc[o];
        if (ph >= 1) ph -= 1;
        opPh[o] = ph;
        const env = from[o] + (to[o] - from[o]) * t;
        const v = sine(ph + mod) * env;
        opOut[o] = v;
        if (o === fbOp) {
          this.fb2 = this.fb1;
          this.fb1 = v;
        }
      }
      let s = 0;
      for (let c = 0; c < carriers.length; c++) s += opOut[carriers[c] - 1] * levels[carriers[c] - 1];
      s *= norm;
      if (filterOn) {
        if (driveG > 1) s = softClip(s * driveG) * driveNorm;
        s = fL.run(s);
      }
      const g = amp.next() * gain;
      outL[off + i] += s * g;
      outR[off + i] += s * g;
    }
    // every carrier has faded out: the note is over even if the key is still down
    if (!carriersAlive) this.amp.reset();
  }

  private renderAdditive(p: Patch, sr: number, pitch: number, fenv: number, outL: Float32Array, outR: Float32Array, off: number, len: number, gain: number, filterOn: boolean, driveG: number, driveNorm: number): void {
    const f = midiFreq(pitch);
    const open = p.addOpen + p.addEnv * fenv;
    const stretch = 1 + 0.5 * p.addStretch;
    const nyq = sr * 0.45;
    let sumSq = 0;
    for (let h = 0; h < 16; h++) sumSq += p[HARMONIC_KEYS[h]] ** 2;
    const norm = 1 / Math.max(1, Math.sqrt(sumSq));
    let top = 0;
    for (let h = 0; h < 16; h++) {
      const n = h + 1;
      const fn = f * Math.pow(n, stretch);
      this.hInc[h] = fn / sr;
      const pass = Math.min(1, Math.max(0, open - n + 1));
      this.hFrom[h] = this.hTo[h];
      this.hTo[h] = fn < nyq ? p[HARMONIC_KEYS[h]] * pass * norm : 0;
      if (this.hTo[h] > 0 || this.hFrom[h] > 0) top = n;
    }
    const hPh = this.hPh;
    const hInc = this.hInc;
    const from = this.hFrom;
    const to = this.hTo;
    const amp = this.amp;
    const fL = this.fL;
    const inv = 1 / len;
    for (let i = 0; i < len; i++) {
      const t = (i + 1) * inv;
      let s = 0;
      for (let h = 0; h < top; h++) {
        let ph = hPh[h] + hInc[h];
        if (ph >= 1) ph -= Math.floor(ph);
        hPh[h] = ph;
        const a = from[h] + (to[h] - from[h]) * t;
        if (a !== 0) s += sine(ph) * a;
      }
      if (filterOn) {
        if (driveG > 1) s = softClip(s * driveG) * driveNorm;
        s = fL.run(s);
      }
      const g = amp.next() * gain;
      outL[off + i] += s * g;
      outR[off + i] += s * g;
    }
  }
}
