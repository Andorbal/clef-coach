/**
 * The Synth Lab's patch: every setting of the learning synth, as one flat object.
 *
 * One synth teaches four kinds of synthesis (`engine`): subtractive (two analogue-style
 * oscillators, a sub and noise), FM (four sine operators), additive (sixteen harmonics)
 * and wavetable (two oscillators reading morphing tables). Whatever makes the raw sound,
 * it then goes through the same filter, amplifier, modulators and effects, the way it
 * does on most real synths, so what a learner finds out about a filter in one engine
 * holds in the others.
 *
 * Flat keys (`ampAttack`, `filterCutoff`) keep the DSP code readable and let the UI,
 * the lessons and the sound matcher treat every control the same way: a lesson lists the
 * keys it shows, a quiz's target is a partial patch, a hint is one key. The registry
 * (`PARAMS`) holds each key's range and default; what a control means to a player lives
 * in `ui/controls.ts`, so the audio worklet doesn't carry the course's prose.
 *
 * Patches are saved in profiles: never rename a key or an option value.
 */

export type EngineKind = 'subtractive' | 'fm' | 'additive' | 'wavetable';
export type Wave = 'sine' | 'triangle' | 'saw' | 'square';
export type SubWave = 'sine' | 'square';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type FilterSlope = '12' | '24';
export type LfoShape = 'sine' | 'triangle' | 'saw' | 'square' | 'random';
export type VoiceMode = 'poly' | 'mono' | 'legato';
export type TableId = 'basic' | 'pwm' | 'harmonic' | 'vowel' | 'metal' | 'sync';
/** Note lengths at the lab's tempo (120 BPM): T = triplet, D = dotted. */
export type Division = '1/1' | '1/2' | '1/4' | '1/4D' | '1/4T' | '1/8' | '1/8D' | '1/8T' | '1/16' | '1/16T';

export interface Patch {
  engine: EngineKind;

  // ---- voice ----
  /** Output level 0..1 (shown as %, heard roughly as its square). */
  volume: number;
  voiceMode: VoiceMode;
  /** Portamento: seconds to slide from the last note to the new one. */
  glide: number;
  /** Copies of each oscillator, detuned and spread (1 = off). */
  unison: number;
  /** Spread between the outermost unison copies, in cents. */
  unisonDetune: number;
  /** Stereo spread of the unison copies 0..1. */
  unisonWidth: number;

  // ---- oscillator 1 (subtractive / wavetable) ----
  osc1Wave: Wave;
  osc1Table: TableId;
  /** Wavetable position 0..1. */
  osc1Pos: number;
  osc1Octave: number;
  osc1Semi: number;
  /** Cents. */
  osc1Fine: number;
  osc1Level: number;
  /** Pulse width of the square wave, 0.5 = square. */
  osc1Pw: number;

  // ---- oscillator 2 ----
  osc2Wave: Wave;
  osc2Table: TableId;
  osc2Pos: number;
  osc2Octave: number;
  osc2Semi: number;
  osc2Fine: number;
  osc2Level: number;
  osc2Pw: number;
  /** Hard sync: oscillator 2 restarts its cycle whenever oscillator 1 does. */
  osc2Sync: boolean;

  // ---- mixer extras ----
  /** Sub oscillator, an octave below oscillator 1. */
  subLevel: number;
  subWave: SubWave;
  noiseLevel: number;
  /** Ring modulator: oscillator 1 × oscillator 2. */
  ringLevel: number;

  // ---- FM (four sine operators) ----
  /** Index into ALGORITHMS (fm.ts). */
  fmAlgo: number;
  /** The top operator modulates itself. */
  fmFeedback: number;
  op1Ratio: number;
  op1Level: number;
  op1Attack: number;
  op1Decay: number;
  op1Sustain: number;
  op1Release: number;
  op2Ratio: number;
  op2Level: number;
  op2Attack: number;
  op2Decay: number;
  op2Sustain: number;
  op2Release: number;
  op3Ratio: number;
  op3Level: number;
  op3Attack: number;
  op3Decay: number;
  op3Sustain: number;
  op3Release: number;
  op4Ratio: number;
  op4Level: number;
  op4Attack: number;
  op4Decay: number;
  op4Sustain: number;
  op4Release: number;

  // ---- additive (sixteen harmonics) ----
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  h7: number;
  h8: number;
  h9: number;
  h10: number;
  h11: number;
  h12: number;
  h13: number;
  h14: number;
  h15: number;
  h16: number;
  /** Harmonics that pass: an additive low-pass counted in harmonics (1..16). */
  addOpen: number;
  /** How many harmonics the filter envelope opens on top of addOpen (−16..16). */
  addEnv: number;
  /** Inharmonicity: partials drift sharp of the harmonic series (bells, metal). */
  addStretch: number;

  // ---- filter ----
  filterOn: boolean;
  filterType: FilterType;
  filterSlope: FilterSlope;
  /** Hz. */
  filterCutoff: number;
  /** 0..1 (whistles near 1). */
  filterRes: number;
  /** Saturation going into the filter, 0..1. */
  filterDrive: number;
  /** How far the cutoff follows the keyboard, 0..1 (1 = one octave per octave). */
  filterKey: number;
  /** Filter envelope depth, −1..1 (±6 octaves). */
  filterEnv: number;
  fAttack: number;
  fDecay: number;
  fSustain: number;
  fRelease: number;

  // ---- amplifier envelope ----
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  ampRelease: number;

  // ---- LFO ----
  lfoShape: LfoShape;
  /** Hz, when not synced. */
  lfoRate: number;
  lfoSync: boolean;
  lfoDiv: Division;
  /** Seconds for the LFO to fade in after a note starts. */
  lfoFade: number;
  /** LFO → pitch (vibrato), cents. */
  lfoPitch: number;
  /** LFO → cutoff (wah, wobble), octaves. */
  lfoCutoff: number;
  /** LFO → volume (tremolo), 0..1. */
  lfoAmp: number;
  /** LFO → pulse width (PWM), 0..1. */
  lfoPw: number;
  /** LFO → wavetable position, 0..1. */
  lfoPos: number;

  // ---- modulation envelope (attack–decay) ----
  modAttack: number;
  modDecay: number;
  /** Envelope → pitch of every oscillator, semitones. */
  modPitch: number;
  /** Envelope → oscillator 2's pitch only (sync sweeps), semitones. */
  modOsc2: number;
  /** Envelope → wavetable position, −1..1. */
  modPos: number;

  // ---- effects ----
  drive: number;
  chorusMix: number;
  chorusRate: number;
  chorusDepth: number;
  delayMix: number;
  delayDiv: Division;
  delayFeedback: number;
  reverbMix: number;
  reverbSize: number;
}

export type ParamKey = keyof Patch;

/** How a numeric control maps its travel to values (for knobs and for comparing sounds). */
export type Scale = 'lin' | 'log' | 'pow';

export interface NumSpec {
  kind: 'num';
  min: number;
  max: number;
  def: number;
  scale: Scale;
  /** Values snap to multiples of this. */
  step?: number;
  /** For 'log' controls that can reach zero: the value treated as "off" at the bottom. */
  floor?: number;
  /** Centred control (−x..+x). */
  bipolar?: boolean;
  unit: Unit;
}

export interface EnumSpec<T extends string = string> {
  kind: 'enum';
  options: readonly T[];
  def: T;
}

export interface BoolSpec {
  kind: 'bool';
  def: boolean;
}

export type Unit = 's' | 'Hz' | '%' | 'st' | 'ct' | 'oct' | 'x' | 'harm' | 'voices' | '';

export type ParamSpec = NumSpec | EnumSpec | BoolSpec;

const num = (min: number, max: number, def: number, scale: Scale, unit: Unit, extra: Partial<NumSpec> = {}): NumSpec => ({ kind: 'num', min, max, def, scale, unit, ...extra });
const time = (def: number, max = 10): NumSpec => num(0, max, def, 'log', 's', { floor: 0.001 });
const level = (def: number): NumSpec => num(0, 1, def, 'lin', '%');
const pick = <T extends string>(options: readonly T[], def: T): EnumSpec<T> => ({ kind: 'enum', options, def });
const flag = (def: boolean): BoolSpec => ({ kind: 'bool', def });

export const ENGINES: readonly EngineKind[] = ['subtractive', 'fm', 'additive', 'wavetable'];
export const WAVES: readonly Wave[] = ['sine', 'triangle', 'saw', 'square'];
export const FILTER_TYPES: readonly FilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
export const LFO_SHAPES: readonly LfoShape[] = ['sine', 'triangle', 'saw', 'square', 'random'];
export const TABLES: readonly TableId[] = ['basic', 'pwm', 'harmonic', 'vowel', 'metal', 'sync'];
export const DIVISIONS: readonly Division[] = ['1/1', '1/2', '1/4', '1/4D', '1/4T', '1/8', '1/8D', '1/8T', '1/16', '1/16T'];

const op = (ratio: number, lvl: number) => ({ ratio: num(0.5, 16, ratio, 'log', 'x', { step: 0.01 }), level: level(lvl) });
const op1 = op(1, 0.8);
const op2 = op(1, 0);
const op3 = op(2, 0);
const op4 = op(3, 0);

/** Every parameter's range and default. */
export const PARAMS: { readonly [K in ParamKey]: ParamSpec } = {
  engine: pick(ENGINES, 'subtractive'),

  volume: level(0.7),
  voiceMode: pick(['poly', 'mono', 'legato'] as const, 'poly'),
  glide: num(0, 2, 0, 'log', 's', { floor: 0.005 }),
  unison: num(1, 7, 1, 'lin', 'voices', { step: 1 }),
  unisonDetune: num(0, 100, 20, 'lin', 'ct', { step: 1 }),
  unisonWidth: level(0.6),

  osc1Wave: pick(WAVES, 'saw'),
  osc1Table: pick(TABLES, 'basic'),
  osc1Pos: level(0),
  osc1Octave: num(-3, 3, 0, 'lin', 'oct', { step: 1, bipolar: true }),
  osc1Semi: num(-12, 12, 0, 'lin', 'st', { step: 1, bipolar: true }),
  osc1Fine: num(-100, 100, 0, 'lin', 'ct', { step: 1, bipolar: true }),
  osc1Level: level(0.8),
  osc1Pw: num(0.05, 0.95, 0.5, 'lin', '%', { step: 0.01 }),

  osc2Wave: pick(WAVES, 'saw'),
  osc2Table: pick(TABLES, 'basic'),
  osc2Pos: level(0),
  osc2Octave: num(-3, 3, 0, 'lin', 'oct', { step: 1, bipolar: true }),
  osc2Semi: num(-12, 12, 0, 'lin', 'st', { step: 1, bipolar: true }),
  osc2Fine: num(-100, 100, 0, 'lin', 'ct', { step: 1, bipolar: true }),
  osc2Level: level(0),
  osc2Pw: num(0.05, 0.95, 0.5, 'lin', '%', { step: 0.01 }),
  osc2Sync: flag(false),

  subLevel: level(0),
  subWave: pick(['sine', 'square'] as const, 'sine'),
  noiseLevel: level(0),
  ringLevel: level(0),

  fmAlgo: num(0, 7, 0, 'lin', '', { step: 1 }),
  fmFeedback: level(0),
  op1Ratio: op1.ratio,
  op1Level: op1.level,
  op1Attack: time(0.002),
  op1Decay: time(1),
  op1Sustain: level(1),
  op1Release: time(0.3),
  op2Ratio: op2.ratio,
  op2Level: op2.level,
  op2Attack: time(0.002),
  op2Decay: time(1),
  op2Sustain: level(1),
  op2Release: time(0.3),
  op3Ratio: op3.ratio,
  op3Level: op3.level,
  op3Attack: time(0.002),
  op3Decay: time(1),
  op3Sustain: level(1),
  op3Release: time(0.3),
  op4Ratio: op4.ratio,
  op4Level: op4.level,
  op4Attack: time(0.002),
  op4Decay: time(1),
  op4Sustain: level(1),
  op4Release: time(0.3),

  h1: level(1),
  h2: level(0),
  h3: level(0),
  h4: level(0),
  h5: level(0),
  h6: level(0),
  h7: level(0),
  h8: level(0),
  h9: level(0),
  h10: level(0),
  h11: level(0),
  h12: level(0),
  h13: level(0),
  h14: level(0),
  h15: level(0),
  h16: level(0),
  addOpen: num(1, 16, 16, 'lin', 'harm', { step: 0.1 }),
  addEnv: num(-16, 16, 0, 'lin', 'harm', { step: 0.1, bipolar: true }),
  addStretch: level(0),

  filterOn: flag(false),
  filterType: pick(FILTER_TYPES, 'lowpass'),
  filterSlope: pick(['12', '24'] as const, '24'),
  filterCutoff: num(30, 18000, 18000, 'log', 'Hz'),
  filterRes: level(0),
  filterDrive: level(0),
  filterKey: level(0),
  filterEnv: num(-1, 1, 0, 'lin', '%', { bipolar: true }),
  fAttack: time(0.002),
  fDecay: time(0.5),
  fSustain: level(0),
  fRelease: time(0.3),

  ampAttack: time(0.004),
  ampDecay: time(0.4),
  ampSustain: level(1),
  ampRelease: time(0.25),

  lfoShape: pick(LFO_SHAPES, 'sine'),
  lfoRate: num(0.05, 20, 5, 'log', 'Hz'),
  lfoSync: flag(false),
  lfoDiv: pick(DIVISIONS, '1/8'),
  lfoFade: time(0, 4),
  lfoPitch: num(0, 1200, 0, 'pow', 'ct', { step: 1 }),
  lfoCutoff: num(0, 4, 0, 'lin', 'oct', { step: 0.01 }),
  lfoAmp: level(0),
  lfoPw: level(0),
  lfoPos: level(0),

  modAttack: time(0.001, 4),
  modDecay: time(0.2, 4),
  modPitch: num(-48, 48, 0, 'lin', 'st', { step: 0.1, bipolar: true }),
  modOsc2: num(0, 48, 0, 'lin', 'st', { step: 0.1 }),
  modPos: num(-1, 1, 0, 'lin', '%', { bipolar: true }),

  drive: level(0),
  chorusMix: level(0),
  chorusRate: num(0.1, 5, 0.8, 'log', 'Hz'),
  chorusDepth: level(0.5),
  delayMix: level(0),
  delayDiv: pick(DIVISIONS, '1/8D'),
  delayFeedback: num(0, 0.9, 0.35, 'lin', '%'),
  reverbMix: level(0),
  reverbSize: level(0.6),
};

export const PARAM_KEYS = Object.keys(PARAMS) as ParamKey[];

/** The default ("init") patch: one plain sawtooth, everything else out of the way. */
export const INIT_PATCH: Patch = Object.fromEntries(PARAM_KEYS.map(k => [k, PARAMS[k].def])) as unknown as Patch;

export type PatchDelta = Partial<Patch>;

/** A full patch from a partial one (missing keys from `base`, out-of-range values clamped). */
export function makePatch(delta: PatchDelta = {}, base: Patch = INIT_PATCH): Patch {
  const p = { ...base } as Record<ParamKey, unknown>;
  for (const k of PARAM_KEYS) {
    if (!(k in delta)) continue;
    const v = (delta as Record<string, unknown>)[k];
    const spec = PARAMS[k];
    if (spec.kind === 'num' && typeof v === 'number' && Number.isFinite(v)) p[k] = clampParam(spec, v);
    else if (spec.kind === 'enum' && typeof v === 'string' && spec.options.includes(v)) p[k] = v;
    else if (spec.kind === 'bool' && typeof v === 'boolean') p[k] = v;
  }
  return p as unknown as Patch;
}

/** Clamp (and snap) a value into a numeric parameter's range. */
export function clampParam(spec: NumSpec, v: number): number {
  let x = Math.min(spec.max, Math.max(spec.min, v));
  if (spec.step) x = Math.round(x / spec.step) * spec.step;
  // floating-point dust from the snap (0.30000000000000004)
  return Math.round(x * 1e6) / 1e6;
}

/** Position 0..1 of a value along a numeric control's travel (how far a knob is turned). */
export function toNorm(spec: NumSpec, v: number): number {
  const { min, max } = spec;
  if (spec.scale === 'log') {
    const lo = Math.max(min, spec.floor ?? min);
    if (v <= lo) return 0;
    return Math.min(1, Math.max(0, Math.log(v / lo) / Math.log(max / lo)));
  }
  if (spec.scale === 'pow') return Math.sqrt(Math.min(1, Math.max(0, (v - min) / (max - min))));
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

/** Inverse of toNorm (a log control at the very bottom gives its minimum, usually 0). */
export function fromNorm(spec: NumSpec, n: number): number {
  const t = Math.min(1, Math.max(0, n));
  const { min, max } = spec;
  let v: number;
  if (spec.scale === 'log') {
    const lo = Math.max(min, spec.floor ?? min);
    v = t <= 0 ? min : lo * Math.pow(max / lo, t);
  } else if (spec.scale === 'pow') v = min + (max - min) * t * t;
  else v = min + (max - min) * t;
  return clampParam(spec, v);
}

/** Seconds per beat at the lab's tempo. Everything tempo-synced in the lab runs at 120 BPM. */
export const BEAT_SECONDS = 0.5;

/** Length of a note division in seconds at 120 BPM. */
export function divisionSeconds(d: Division): number {
  const m = /^1\/(\d+)([DT]?)$/.exec(d);
  if (!m) return BEAT_SECONDS;
  const beats = 4 / Number(m[1]);
  const mult = m[2] === 'D' ? 1.5 : m[2] === 'T' ? 2 / 3 : 1;
  return beats * mult * BEAT_SECONDS;
}

/** The keys whose values differ between two patches. */
export function diffKeys(a: Patch, b: Patch): ParamKey[] {
  return PARAM_KEYS.filter(k => a[k] !== b[k]);
}

/** Harmonic levels h1..h16 as an array. */
export const HARMONIC_KEYS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15', 'h16'] as const;

export function harmonics(p: Patch): number[] {
  return HARMONIC_KEYS.map(k => p[k]);
}

/** Operator parameters by operator number (1..4). */
export function opKeys(n: 1 | 2 | 3 | 4) {
  return {
    ratio: `op${n}Ratio`,
    level: `op${n}Level`,
    attack: `op${n}Attack`,
    decay: `op${n}Decay`,
    sustain: `op${n}Sustain`,
    release: `op${n}Release`,
  } as const;
}
