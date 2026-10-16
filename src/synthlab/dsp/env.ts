/**
 * Envelopes: how a setting moves over the life of a note.
 *
 * The ADSR follows an analogue circuit: the attack charges towards a level a little above
 * full and stops at full (a quick, slightly bowed rise), decay and release fall
 * exponentially. Times mean what a player expects: the attack reaches full in about
 * `attack` seconds, and decay and release have done 99% of their fall after their time
 * (the last whisper of a release, down to −80 dB, takes about twice as long).
 *
 * `envelopeLevel` gives the same curve as a formula, for drawing it.
 */

/** Attack aims this far past full, so the rise is quick and bows like a charging capacitor. */
const OVERSHOOT = 1.3;
const ATTACK_SHAPE = Math.log(OVERSHOOT / (OVERSHOOT - 1));
/** Time constants in a decay or release time (e^-5 ≈ 0.7% left). */
const FALL_TAUS = 5;
/** Below this a released envelope is silent (−80 dB). */
export const ENV_FLOOR = 1e-4;
const MIN_TIME = 0.0005;

/** Envelope stages (plain numbers: the build has no enums). */
export const Stage = { Idle: 0, Attack: 1, Decay: 2, Sustain: 3, Release: 4 } as const;
export type Stage = (typeof Stage)[keyof typeof Stage];

export class Adsr {
  stage: Stage = Stage.Idle;
  level = 0;
  private aCoef = 1;
  private dCoef = 1;
  private rCoef = 1;
  private sustain = 1;
  private attackTime = 0;

  /** Set times (s) and sustain (0..1) for a sample rate, or a control rate (rate = samples per second of `step`). */
  set(attack: number, decay: number, sustain: number, release: number, rate: number): void {
    this.attackTime = attack;
    const a = Math.max(MIN_TIME, attack);
    this.aCoef = 1 - Math.exp(-ATTACK_SHAPE / (a * rate));
    this.dCoef = 1 - Math.exp(-FALL_TAUS / (Math.max(MIN_TIME, decay) * rate));
    this.rCoef = 1 - Math.exp(-FALL_TAUS / (Math.max(MIN_TIME, release) * rate));
    this.sustain = Math.min(1, Math.max(0, sustain));
  }

  /** Start (or restart from wherever it is, like an analogue envelope: no click). */
  gateOn(): void {
    this.stage = this.attackTime <= 0 ? Stage.Decay : Stage.Attack;
    if (this.attackTime <= 0) this.level = 1;
  }

  gateOff(): void {
    if (this.stage !== Stage.Idle) this.stage = Stage.Release;
  }

  /** Jump to silence. */
  reset(): void {
    this.stage = Stage.Idle;
    this.level = 0;
  }

  get active(): boolean {
    return this.stage !== Stage.Idle;
  }

  /** Advance one step and return the level. */
  next(): number {
    switch (this.stage) {
      case Stage.Attack:
        this.level += (OVERSHOOT - this.level) * this.aCoef;
        if (this.level >= 1) {
          this.level = 1;
          this.stage = Stage.Decay;
        }
        break;
      case Stage.Decay:
        this.level += (this.sustain - this.level) * this.dCoef;
        if (Math.abs(this.level - this.sustain) < 1e-5) {
          this.level = this.sustain;
          this.stage = this.sustain <= ENV_FLOOR ? Stage.Idle : Stage.Sustain;
          if (this.stage === Stage.Idle) this.level = 0;
        }
        break;
      case Stage.Sustain:
        this.level = this.sustain;
        break;
      case Stage.Release:
        this.level -= this.level * this.rCoef;
        if (this.level < ENV_FLOOR) {
          this.level = 0;
          this.stage = Stage.Idle;
        }
        break;
      default:
        break;
    }
    return this.level;
  }
}

/**
 * The envelope's level `t` seconds into a note held for `hold` seconds (for drawing).
 * Mirrors Adsr exactly in continuous time.
 */
export function envelopeLevel(attack: number, decay: number, sustain: number, release: number, hold: number, t: number): number {
  const at = (x: number): number => {
    // level at time x while held
    let level: number;
    let tAfterAttack: number;
    if (attack <= 0) {
      level = 1;
      tAfterAttack = x;
    } else {
      const a = Math.max(MIN_TIME, attack);
      // 1.3·(1 − e^{−x·S/a}) reaches 1 at x = a
      if (x < a) return OVERSHOOT * (1 - Math.exp((-x * ATTACK_SHAPE) / a));
      level = 1;
      tAfterAttack = x - a;
    }
    const d = Math.max(MIN_TIME, decay);
    return sustain + (level - sustain) * Math.exp((-tAfterAttack * FALL_TAUS) / d);
  };
  if (t <= hold) return at(t);
  const from = at(hold);
  const r = Math.max(MIN_TIME, release);
  return from * Math.exp((-(t - hold) * FALL_TAUS) / r);
}

/** How long after release a note is still audible (to −80 dB), for sizing renders. */
export function releaseTail(release: number): number {
  return (Math.max(MIN_TIME, release) / FALL_TAUS) * Math.log(1 / ENV_FLOOR);
}
