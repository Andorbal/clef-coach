/**
 * The judge: how close a mix is to a target mix, as an engineer listening would say, and
 * what to try next.
 *
 * Both mixes are rendered and measured (analyse.ts), then compared aspect by aspect:
 *
 * - **balance**: each channel's loudness against the others. Turning everything up
 *   together changes nothing (the median difference is taken out), so a fader and a
 *   trim do the same job, as they do to an ear.
 * - **pan**: where each channel sits.
 * - **tone**: each channel's spectrum shape in third octaves, weighted towards the bands
 *   that carry its energy; a high-pass and a low shelf that sound alike score alike.
 * - **dynamics**: how much each channel's level moves, and how sharp its peaks are
 *   (compression evens out the first; a fast attack blunts the second).
 * - **space**: each channel's reverb and delay against its dry sound, and the room's size,
 *   pre-delay and tone, the echoes' time and repeats.
 * - **master**: the mix's loudness and peaks.
 *
 * Each measurement has a tolerance, the difference an ear starts to notice in a mix; an
 * error of one tolerance scores 0.75, the pass mark, and further off scores fall away
 * gently, so every step closer shows. An aspect scores its worst channel,
 * and the mix its worst aspect, so one track badly off can't hide behind good ones.
 *
 * A quiz can also set goals instead of (or as well as) a target: a loudness, a peak
 * ceiling, input levels for gain staging, no clipping.
 */
import { type ChannelFeatures, type MixFeatures, BAND_FREQS, analyseMix, renderMix, wetLevel } from './analyse';
import { type Mix, SILENT_DB, withoutMonitoring } from './params';

export type Aspect = 'balance' | 'pan' | 'tone' | 'dynamics' | 'space' | 'master';
export const ASPECTS: readonly Aspect[] = ['balance', 'pan', 'tone', 'dynamics', 'space', 'master'];

export const PASS_MARK = 0.75;

/** The difference (in each measurement's units) that scores PASS_MARK. */
export const TOL = {
  balance: 2, // dB
  pan: 0.2,
  tone: 2.5, // dB, weighted RMS over bands
  range: 2, // dB
  crest: 2.5, // dB
  wet: 4, // dB
  size: 0.15,
  predelay: 25, // ms
  fxTone: 0.25,
  beats: 0.07,
  feedback: 0.12,
  loud: 1, // LU
  peak: 0.5, // dB
};

export type Goal =
  /** Integrated loudness of the mix, LUFS. */
  | { kind: 'loudness'; target: number; tol?: number }
  /** The master's peaks at or below this (dBFS). */
  | { kind: 'peak'; max: number }
  /** Peaks into these channels (after the trim) between min and max dBFS: gain staging. */
  | { kind: 'input'; channels: string[]; min: number; max: number }
  /** The mix's peaks stay this far below full scale before any limiter: headroom on the bus. */
  | { kind: 'headroom'; min: number }
  /** A channel this many dB above or below another (loudness). */
  | { kind: 'relative'; channel: string; to: string; min: number; max: number };

export interface Item {
  aspect: Aspect | 'goal';
  /** Channel id, 'fx' or 'master'. */
  where: string;
  score: number;
  /** For hints: what's off, in words, with **bold** names. */
  hint: string;
}

export interface JudgeResult {
  overall: number;
  aspects: Partial<Record<Aspect | 'goal', number>>;
  items: Item[];
  /** The worst item first. */
  worst: Item | null;
}

export interface JudgeSpec {
  /** Which aspects count (default: all that the target differs in). */
  aspects?: readonly Aspect[];
  /** Which channels count (default: all). */
  channels?: readonly string[];
  goals?: readonly Goal[];
  names?: Record<string, string>;
}

/** 1 when exact, PASS_MARK at one tolerance off, falling away gently beyond (so getting closer always shows). */
const score = (err: number, tol: number) => 1 / (1 + (err / tol) ** 2 / 3);
const finite = (x: number, floor = -60) => (Number.isFinite(x) ? Math.max(floor, x) : floor);

/** Regions of the spectrum, as engineers name them. */
const REGIONS: { name: string; from: number; to: number }[] = [
  { name: 'low end (below 150 Hz)', from: 0, to: 150 },
  { name: 'low mids (150–500 Hz, the muddy, boxy part)', from: 150, to: 500 },
  { name: 'mids (500 Hz–2 kHz)', from: 500, to: 2000 },
  { name: 'upper mids (2–6 kHz, presence and bite)', from: 2000, to: 6000 },
  { name: 'top end (above 6 kHz, air and sizzle)', from: 6000, to: 30000 },
];

function toneError(mine: Float32Array, target: Float32Array): { err: number; region: string; more: boolean } {
  // the bands carrying energy (in either) matter; a band 40 dB down hardly does
  const w = new Float64Array(BAND_FREQS.length);
  const d = new Float64Array(BAND_FREQS.length);
  let sw = 0;
  let sd = 0;
  for (let b = 0; b < BAND_FREQS.length; b++) {
    w[b] = Math.pow(10, Math.max(target[b], mine[b]) / 20);
    d[b] = mine[b] - target[b];
    sw += w[b];
    sd += w[b] * d[b];
  }
  // shapes, not levels: each spectrum is measured against its loudest band, so a boost in
  // the lows pulls everything else down with it; take the average difference out, and the
  // boost reads as too much low end rather than too little everything else
  const mean = sw > 0 ? sd / sw : 0;
  let se = 0;
  const regionDiff = REGIONS.map(() => ({ w: 0, d: 0 }));
  for (let b = 0; b < BAND_FREQS.length; b++) {
    const x = Math.max(-15, Math.min(15, d[b] - mean));
    se += w[b] * x * x;
    const r = REGIONS.findIndex(g => BAND_FREQS[b] >= g.from && BAND_FREQS[b] < g.to);
    regionDiff[r].w += w[b];
    regionDiff[r].d += w[b] * x;
  }
  let worst = 0;
  let worstVal = 0;
  regionDiff.forEach((r, i) => {
    const v = r.w > 0 ? r.d / r.w : 0;
    // a region weighs by how much of the sound lives there
    const weighted = v * Math.sqrt(r.w / Math.max(1e-9, sw));
    if (Math.abs(weighted) > Math.abs(worstVal)) {
      worstVal = weighted;
      worst = i;
    }
  });
  return { err: sw > 0 ? Math.sqrt(se / sw) : 0, region: REGIONS[worst].name, more: worstVal > 0 };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dbWords = (d: number) => (Math.abs(d) < 1.5 ? 'a touch' : `about ${Math.round(Math.abs(d))} dB`);

export function compareMixes(mine: MixFeatures, target: MixFeatures | null, spec: JudgeSpec = {}): JudgeResult {
  const items: Item[] = [];
  const name = (id: string) => `**${spec.names?.[id] ?? id}**`;
  // "Hi-hats are", "Bass is": a name ending in a single s is plural
  const plural = (id: string) => /[^s]s$/i.test(spec.names?.[id] ?? id);
  const is = (id: string) => (plural(id) ? 'are' : 'is');
  const has = (id: string) => (plural(id) ? 'have' : 'has');
  const needs = (id: string) => (plural(id) ? 'need' : 'needs');
  const ids = Object.keys(mine.channels).filter(id => !spec.channels || spec.channels.includes(id));
  const want = new Set<Aspect>(spec.aspects ?? (target ? inferAspects(mine.mix, target.mix) : []));
  if (target) {
    // balance: loudness differences, less the common offset (everything up together is no change)
    const diffs: Record<string, number> = {};
    for (const id of Object.keys(mine.channels)) {
      const t = target.channels[id];
      if (t && Number.isFinite(t.loud)) diffs[id] = finite(mine.channels[id].loud, -80) - t.loud;
    }
    const offset = median(Object.values(diffs));
    for (const id of ids) {
      const t = target.channels[id];
      const m = mine.channels[id];
      if (!t || !m) continue;
      if (want.has('balance')) {
        if (!Number.isFinite(t.loud)) {
          // the target has this channel silent (muted, or faded right out)
          const on = Number.isFinite(m.loud) && m.loud > -50;
          items.push({ aspect: 'balance', where: id, score: on ? 0 : 1, hint: `In the target, ${name(id)} ${is(id)} silent.` });
        } else {
          const d = (diffs[id] ?? 0) - offset;
          items.push({ aspect: 'balance', where: id, score: score(d, TOL.balance), hint: `${name(id)} ${is(id)} ${dbWords(d)} too ${d > 0 ? 'loud' : 'quiet'} against the rest.` });
        }
      }
      if (want.has('pan')) {
        const pm = mine.mix[`${id}:pan`] ?? 0;
        const pt = target.mix[`${id}:pan`] ?? 0;
        const d = pm - pt;
        items.push({ aspect: 'pan', where: id, score: score(d, TOL.pan), hint: `${name(id)} should sit ${Math.abs(pt) < 0.05 ? 'in the centre' : `further ${d > 0 ? 'left' : 'right'}`}.` });
      }
      if (!Number.isFinite(t.loud) || !Number.isFinite(m.loud)) continue;
      if (want.has('tone')) {
        const e = toneError(m.bands, t.bands);
        items.push({ aspect: 'tone', where: id, score: score(e.err, TOL.tone), hint: `${name(id)} ${has(id)} too ${e.more ? 'much' : 'little'} ${e.region}.` });
      }
      if (want.has('dynamics')) items.push(dynamicsItem(id, m, t, name, is(id), attackOff(mine.mix, target.mix, id)));
      if (want.has('space')) {
        for (const fx of ['reverb', 'delay'] as const) {
          const wm = finite(wetLevel(mine.mix, id, fx), -40);
          const wt = finite(wetLevel(target.mix, id, fx), -40);
          if (wm <= -40 && wt <= -40) continue;
          const d = wm - wt;
          items.push({ aspect: 'space', where: id, score: score(d, TOL.wet), hint: wt <= -40 ? `${name(id)} ${has(id)} ${fx} the target doesn’t.` : `${name(id)} ${needs(id)} ${d > 0 ? 'less' : 'more'} ${fx}.` });
        }
      }
    }
    if (want.has('space')) items.push(...fxItems(mine.mix, target.mix));
    if (want.has('master')) {
      const d = finite(mine.master.loud) - finite(target.master.loud);
      items.push({ aspect: 'master', where: 'master', score: score(d, TOL.loud), hint: `The whole mix is ${dbWords(d).replace('dB', 'LU')} too ${d > 0 ? 'loud' : 'quiet'}.` });
      const pd = finite(mine.master.peak) - finite(target.master.peak);
      if (pd > 0) items.push({ aspect: 'master', where: 'master', score: score(pd, TOL.peak * 2), hint: 'The mix’s peaks go higher than the target’s: bring the limiter’s ceiling down.' });
      const rd = mine.master.range - target.master.range;
      items.push({ aspect: 'master', where: 'master', score: score(rd, TOL.range * 1.5), hint: rd > 0 ? 'The whole mix moves in level more than the target: a little bus compression would hold it together.' : 'The whole mix is squashed flatter than the target: ease off the bus compressor or the limiter.' });
    }
  }
  for (const g of spec.goals ?? []) items.push(goalItem(g, mine, name, is, needs));

  const aspects: Partial<Record<Aspect | 'goal', number>> = {};
  for (const it of items) aspects[it.aspect] = Math.min(aspects[it.aspect] ?? 1, it.score);
  const overall = items.length ? Math.min(...items.map(i => i.score)) : 1;
  const worst = items.length ? items.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  return { overall, aspects, items, worst };
}

/**
 * Is the compressor's attack what's different (both on, the same amount of squeeze, an
 * attack far from the target's)? A fast attack flattens the level as well as the hits, so
 * the sound alone can't tell the two apart; the hint then names the attack.
 */
function attackOff(mine: Mix, target: Mix, id: string): boolean {
  const g = (m: Mix, p: string) => m[`${id}:${p}`] ?? 0;
  if (g(mine, 'compOn') < 0.5 || g(target, 'compOn') < 0.5) return false;
  const ratio = Math.max(g(mine, 'attack'), 0.1) / Math.max(g(target, 'attack'), 0.1);
  return (ratio > 1.6 || ratio < 1 / 1.6) && Math.abs(g(mine, 'threshold') - g(target, 'threshold')) < 4 && Math.abs(Math.log(g(mine, 'ratio') / g(target, 'ratio'))) < 0.4;
}

function dynamicsItem(id: string, m: ChannelFeatures, t: ChannelFeatures, name: (id: string) => string, is: string, attack: boolean): Item {
  const dr = m.range - t.range;
  const dc = m.crest - t.crest;
  const sr = score(dr, TOL.range);
  const sc = score(dc, TOL.crest);
  if (attack && Math.abs(dc) > TOL.crest * 0.5)
    return { aspect: 'dynamics', where: id, score: Math.min(sr, sc), hint: dc > 0 ? `${name(id)}’s hits are sharper than the target’s: a faster attack catches more of each one.` : `${name(id)}’s hits are blunter than the target’s: a slower attack lets the start of each one through.` };
  if (sr <= sc)
    return { aspect: 'dynamics', where: id, score: sr, hint: dr > 0 ? `${name(id)}’s level still jumps around more than the target’s: compress it harder (a lower threshold, or a higher ratio).` : `${name(id)} ${is} squashed flatter than the target: ease off the compression.` };
  return { aspect: 'dynamics', where: id, score: sc, hint: dc > 0 ? `${name(id)}’s hits are sharper than the target’s: a faster attack catches more of each one.` : `${name(id)}’s hits are blunter than the target’s: a slower attack lets the start of each one through.` };
}

function fxItems(mine: Mix, target: Mix): Item[] {
  const out: Item[] = [];
  const usesReverb = Object.keys(target).some(k => k.endsWith(':reverb') && target[k] > SILENT_DB);
  const usesDelay = Object.keys(target).some(k => k.endsWith(':delay') && target[k] > SILENT_DB);
  const v = (m: Mix, k: string) => m[k] ?? 0;
  if (usesReverb) {
    const ds = v(mine, 'fx:reverbSize') - v(target, 'fx:reverbSize');
    out.push({ aspect: 'space', where: 'fx', score: score(ds, TOL.size), hint: `The room is ${ds > 0 ? 'bigger' : 'smaller'} than the target’s (reverb size).` });
    const dp = v(mine, 'fx:reverbPredelay') - v(target, 'fx:reverbPredelay');
    out.push({ aspect: 'space', where: 'fx', score: score(dp, TOL.predelay), hint: `The reverb starts ${dp > 0 ? 'later' : 'sooner'} than the target’s (pre-delay).` });
    const dt = v(mine, 'fx:reverbTone') - v(target, 'fx:reverbTone');
    out.push({ aspect: 'space', where: 'fx', score: score(dt, TOL.fxTone), hint: `The reverb is ${dt > 0 ? 'brighter' : 'darker'} than the target’s.` });
  }
  if (usesDelay) {
    const db = v(mine, 'fx:delayBeats') - v(target, 'fx:delayBeats');
    out.push({ aspect: 'space', where: 'fx', score: score(db, TOL.beats), hint: `The echoes come ${db > 0 ? 'later' : 'sooner'} than the target’s (delay time).` });
    const df = v(mine, 'fx:delayFeedback') - v(target, 'fx:delayFeedback');
    out.push({ aspect: 'space', where: 'fx', score: score(df, TOL.feedback), hint: `The echoes repeat ${df > 0 ? 'more' : 'less'} than the target’s (feedback).` });
    const dt = v(mine, 'fx:delayTone') - v(target, 'fx:delayTone');
    out.push({ aspect: 'space', where: 'fx', score: score(dt, TOL.fxTone), hint: `The echoes are ${dt > 0 ? 'brighter' : 'darker'} than the target’s (delay tone).` });
  }
  return out;
}

function goalItem(g: Goal, mine: MixFeatures, name: (id: string) => string, is: (id: string) => string, needs: (id: string) => string): Item {
  switch (g.kind) {
    case 'loudness': {
      const d = finite(mine.master.loud) - g.target;
      return { aspect: 'goal', where: 'master', score: score(d, g.tol ?? TOL.loud), hint: `The mix measures ${finite(mine.master.loud).toFixed(1)} LUFS; aim for ${g.target}.` };
    }
    case 'peak': {
      const over = Math.max(0, finite(mine.master.peak) - g.max);
      return { aspect: 'goal', where: 'master', score: score(over, TOL.peak), hint: `The peaks reach ${finite(mine.master.peak).toFixed(1)} dBFS; keep them at ${g.max} or below.` };
    }
    case 'headroom': {
      const over = Math.max(0, finite(mine.master.peak) + g.min);
      return { aspect: 'goal', where: 'master', score: score(over, TOL.peak * 2), hint: `The mix peaks at ${finite(mine.master.peak).toFixed(1)} dBFS: leave at least ${g.min} dB of headroom.` };
    }
    case 'input': {
      let worst: Item | null = null;
      for (const id of g.channels) {
        const v = finite(mine.channels[id]?.input ?? -Infinity, -90);
        const off = v < g.min ? g.min - v : v > g.max ? v - g.max : 0;
        const it: Item = { aspect: 'goal', where: id, score: score(off, 1.5), hint: `${name(id)} peaks at ${v.toFixed(0)} dBFS going in; aim between ${g.min} and ${g.max}.` };
        if (!worst || it.score < worst.score) worst = it;
      }
      return worst ?? { aspect: 'goal', where: 'master', score: 1, hint: '' };
    }
    case 'relative': {
      const d = finite(mine.channels[g.channel]?.loud ?? -Infinity) - finite(mine.channels[g.to]?.loud ?? -Infinity);
      const off = d < g.min ? g.min - d : d > g.max ? d - g.max : 0;
      return { aspect: 'goal', where: g.channel, score: score(off, TOL.balance), hint: d < g.min ? `${name(g.channel)} ${needs(g.channel)} to come up against ${name(g.to)}.` : `${name(g.channel)} ${is(g.channel)} too loud against ${name(g.to)}.` };
    }
  }
}

/** The aspects a target differs in from a starting mix (what a quiz is about). */
export function inferAspects(start: Mix, target: Mix): Aspect[] {
  const out = new Set<Aspect>();
  for (const k of Object.keys(target)) {
    if ((start[k] ?? NaN) === target[k]) continue;
    const [scope, p] = k.split(':');
    if (p === 'solo' || p === 'mono') continue;
    if (scope === 'master') out.add('master');
    else if (scope === 'fx') out.add('space');
    else if (p === 'fader' || p === 'gain' || p === 'mute') out.add('balance');
    else if (p === 'pan') out.add('pan');
    else if (p === 'reverb' || p === 'delay') out.add('space');
    else if (['compOn', 'threshold', 'ratio', 'attack', 'release'].includes(p)) out.add('dynamics').add('balance');
    else if (p === 'makeup') out.add('balance');
    else out.add('tone');
  }
  return ASPECTS.filter(a => out.has(a));
}

/**
 * A judge for one quiz: renders and measures the target once, then scores mixes against it.
 */
export class Judge {
  readonly target: MixFeatures | null;
  private readonly stems: Record<string, Float32Array>;
  private readonly channels: readonly string[];
  private readonly sr: number;
  private readonly tempo: number;
  readonly spec: JudgeSpec;

  constructor(o: { stems: Record<string, Float32Array>; channels: readonly string[]; sampleRate: number; tempo: number; start: Mix; target?: Mix; spec?: JudgeSpec; seconds?: number }) {
    // the course test listens to part of the loop, to stay quick
    const n = o.seconds ? Math.round(o.seconds * o.sampleRate) : 0;
    this.stems = n ? Object.fromEntries(Object.entries(o.stems).map(([k, x]) => [k, x.subarray(0, Math.min(n, x.length))])) : o.stems;
    this.channels = o.channels;
    this.sr = o.sampleRate;
    this.tempo = o.tempo;
    this.target = o.target ? this.measure(o.target) : null;
    this.spec = { ...o.spec, aspects: o.spec?.aspects ?? (o.target ? inferAspects(o.start, o.target) : []) };
  }

  /** Render and measure a mix (solo and mono are for listening: they don't count). */
  measure(mix: Mix): MixFeatures {
    const m = withoutMonitoring(mix);
    return analyseMix(renderMix(this.stems, this.channels, m, this.sr, this.tempo), m);
  }

  score(mix: Mix): JudgeResult {
    return compareMixes(this.measure(mix), this.target, this.spec);
  }
}
