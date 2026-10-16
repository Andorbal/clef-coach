/**
 * The quiz judge: renders the target once, then scores the learner's patch against it and
 * finds hints.
 *
 * A hint is found by experiment rather than by comparing numbers: each control the learner
 * can reach is tried at the target's value, and the one that would improve the sound the
 * most is the hint. So a knob that can't be heard in this sound (a decay time when sustain
 * is full) is never suggested, and "close enough" knobs are left alone.
 */
import { ANALYSIS_RATE, type Features, type MatchResult, analyse, compare } from './match';
import { PARAMS, type ParamKey, type Patch } from './params';
import { type Phrase, mono, renderLength, renderPhrase } from './render';

export interface Hint {
  key: ParamKey;
  /** Which way to move it. */
  direction: 'up' | 'down' | 'change' | 'on' | 'off';
  /** How much the match would improve (0..1). */
  gain: number;
  /** The target's value (revealed only by the last hint). */
  value: Patch[ParamKey];
}

/** Is the LFO (or the chorus, whose drift is an LFO too) moving anything you'd hear? */
export function usesLfo(p: Patch): boolean {
  const pw = p.engine === 'subtractive' && ((p.osc1Wave === 'square' && p.osc1Level > 0) || (p.osc2Wave === 'square' && p.osc2Level > 0));
  return p.lfoPitch > 0 || (p.filterOn && p.lfoCutoff > 0) || p.lfoAmp > 0 || (pw && p.lfoPw > 0) || (p.engine === 'wavetable' && p.lfoPos > 0) || p.chorusMix > 0;
}

export class Matcher {
  readonly target: Patch;
  readonly phrase: Phrase;
  readonly length: number;
  private readonly targetFeatures: Features;
  private readonly cache = new Map<string, MatchResult>();

  /** Notes overlap (a chord): pitch isn't judged. */
  private readonly chordal: boolean;

  constructor(target: Patch, ph: Phrase) {
    this.target = target;
    this.phrase = ph;
    this.chordal = ph.notes.some(a => ph.notes.some(b => a !== b && a.start === b.start));
    this.length = renderLength(target, ph);
    this.targetFeatures = this.features(target);
  }

  private features(p: Patch): Features {
    const first = this.phrase.notes[0];
    return analyse(mono(renderPhrase(p, this.phrase, ANALYSIS_RATE, this.length)), [first.start, first.start + first.dur]);
  }

  /** How close `mine` sounds to the target. */
  score(mine: Patch): MatchResult {
    const key = JSON.stringify(mine);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const r = compare(this.targetFeatures, this.features(mine), { movement: usesLfo(this.target) || usesLfo(mine), pitch: !this.chordal });
    if (this.cache.size > 64) this.cache.clear();
    this.cache.set(key, r);
    return r;
  }

  /**
   * Controls (among `keys`) worth changing, best first. Async so a screen stays
   * responsive between the trial renders.
   */
  async hints(mine: Patch, keys: readonly ParamKey[], yieldEvery = 2): Promise<Hint[]> {
    const base = this.score(mine).overall;
    const out: Hint[] = [];
    let n = 0;
    for (const k of keys) {
      const want = this.target[k];
      const have = mine[k];
      if (want === have) continue;
      const trial = { ...mine, [k]: want } as Patch;
      const s = this.score(trial).overall;
      if (++n % yieldEvery === 0) await new Promise(r => setTimeout(r, 0));
      const gain = s - base;
      if (gain < 0.01) continue;
      const spec = PARAMS[k];
      const direction: Hint['direction'] =
        spec.kind === 'num' ? ((want as number) > (have as number) ? 'up' : 'down') : spec.kind === 'bool' ? (want ? 'on' : 'off') : 'change';
      out.push({ key: k, direction, gain, value: want });
    }
    return out.sort((a, b) => b.gain - a.gain);
  }
}
