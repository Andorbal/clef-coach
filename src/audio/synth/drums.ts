/**
 * Synthesised General MIDI drum kits – PURE render functions (no Web Audio).
 *
 * Every percussion note of the GM map (35–81) plus the common GS/GM2
 * extensions (27–34, 82–87) is built from a handful of physically-inspired
 * primitives, all rendered with recurrences rather than per-sample Math.sin /
 * Math.exp:
 *
 *  • Membranes (kick, snare, toms, hand drums): a few circular-membrane modes,
 *    the low ones as sines whose pitch glides down from the strike (tension
 *    modulation – harder hits glide further), the upper ones as static damped
 *    sinusoids (ResonatorBank).
 *  • Noise components (snare wires, beater/stick contact, claps, brushes):
 *    seeded xorshift noise, enveloped then filtered with biquad cascades.
 *  • Metal (hi-hats, cymbals): a dense set of inharmonic modal partials plus a
 *    "wash" of high-passed noise and square-wave metal (the 808's six
 *    inharmonic oscillators), each with its own decay; the ride adds a stick
 *    "ping", the bell a tonal partial set, the china a little saturation.
 *  • Particle models (maracas, cabasa, shaker, tambourine, sleigh bells, guiro):
 *    stochastic bead / jingle collisions (Cook's PhISEM) driving resonant
 *    band-pass filters.
 *  • Bars, blocks and bells (claves, wood blocks, cowbell, agogo, triangle,
 *    belltree): modal synthesis with a short contact transient.
 *
 * Kits vary tuning, decay, attack hardness and ambience ('room' adds a small
 * feedback-delay-network room; 'electronic' swaps the core voices for
 * 808/909-style circuits; 'brush' swaps the snare for brush strokes).
 *
 * Unlike the melodic renderers, a drum render INCLUDES its velocity level:
 * each hit is peak-normalised to DRUM_PEAK, then scaled by the velocity curve
 * (velocity also changes the timbre – harder is brighter, with more attack).
 * drumGain() is a separate per-note trim for the kit's internal balance.
 */
import {
  type BiquadCoeffs,
  type BiquadType,
  ResonatorBank,
  addDampedSine,
  biquadCoeffs,
  clamp,
  fadeIn,
  fadeOut,
  mulberry32,
  peakAbs,
  rmsRange,
  scaleInPlace,
} from '../dsp/util';

export type DrumKit = 'standard' | 'room' | 'power' | 'electronic' | 'jazz' | 'brush';

export const DRUM_KITS: readonly DrumKit[] = ['standard', 'room', 'power', 'electronic', 'jazz', 'brush'];

export const DRUM_LOWEST = 27;
export const DRUM_HIGHEST = 87;

/** GM percussion notes this kit renders (27–87; everything in the GM Level 1 map 35–81 at least, plus 31 Sticks). */
export const DRUM_NOTES: readonly number[] = Array.from({ length: DRUM_HIGHEST - DRUM_LOWEST + 1 }, (_, i) => DRUM_LOWEST + i);

/** Peak level of a full-velocity hit. */
export const DRUM_PEAK = 0.9;

export interface DrumRenderOptions {
  kit?: DrumKit;
  /** Render into this array (e.g. an AudioBuffer's channel data); its length defines the note length. */
  out?: Float32Array;
  /** Seed for the (deterministic) random detail. Default derived from note and kit. */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Note table
// ---------------------------------------------------------------------------

interface NoteInfo {
  name: string;
  /** buffer length (s) in the standard kit */
  len: number;
  /** ≈ −40 dB point (s) in the standard kit */
  audible: number;
  pan: number;
  gain: number;
  choke: number;
}

const NOTES: Record<number, NoteInfo> = {
  27: { name: 'High Q', len: 0.22, audible: 0.18, pan: 0, gain: 0.25, choke: 0 },
  28: { name: 'Slap', len: 0.3, audible: 0.09, pan: 0.1, gain: 0.61, choke: 0 },
  29: { name: 'Scratch Push', len: 0.22, audible: 0.16, pan: 0, gain: 0.25, choke: 0 },
  30: { name: 'Scratch Pull', len: 0.24, audible: 0.17, pan: 0, gain: 0.27, choke: 0 },
  31: { name: 'Sticks', len: 0.15, audible: 0.06, pan: 0, gain: 0.48, choke: 0 },
  32: { name: 'Square Click', len: 0.06, audible: 0.03, pan: 0, gain: 0.62, choke: 0 },
  33: { name: 'Metronome Click', len: 0.1, audible: 0.09, pan: 0, gain: 0.56, choke: 0 },
  34: { name: 'Metronome Bell', len: 1.1, audible: 1.04, pan: 0, gain: 0.14, choke: 0 },
  35: { name: 'Acoustic Bass Drum', len: 0.85, audible: 0.78, pan: 0, gain: 0.92, choke: 0 },
  36: { name: 'Bass Drum 1', len: 0.75, audible: 0.67, pan: 0, gain: 0.88, choke: 0 },
  37: { name: 'Side Stick', len: 0.3, audible: 0.12, pan: -0.08, gain: 0.74, choke: 0 },
  38: { name: 'Acoustic Snare', len: 0.65, audible: 0.52, pan: -0.08, gain: 1, choke: 0 },
  39: { name: 'Hand Clap', len: 0.6, audible: 0.39, pan: 0.05, gain: 0.99, choke: 0 },
  40: { name: 'Electric Snare', len: 0.5, audible: 0.34, pan: -0.08, gain: 0.82, choke: 0 },
  41: { name: 'Low Floor Tom', len: 1.3, audible: 1.13, pan: 0.38, gain: 0.76, choke: 0 },
  42: { name: 'Closed Hi-Hat', len: 0.3, audible: 0.21, pan: -0.3, gain: 0.33, choke: 1 },
  43: { name: 'High Floor Tom', len: 1.2, audible: 1.05, pan: 0.3, gain: 0.75, choke: 0 },
  44: { name: 'Pedal Hi-Hat', len: 0.22, audible: 0.12, pan: -0.3, gain: 0.28, choke: 1 },
  45: { name: 'Low Tom', len: 1.1, audible: 0.97, pan: 0.18, gain: 0.78, choke: 0 },
  46: { name: 'Open Hi-Hat', len: 1.4, audible: 1.26, pan: -0.3, gain: 0.33, choke: 1 },
  47: { name: 'Low-Mid Tom', len: 1.0, audible: 0.9, pan: 0.06, gain: 0.77, choke: 0 },
  48: { name: 'Hi-Mid Tom', len: 0.95, audible: 0.85, pan: -0.06, gain: 0.68, choke: 0 },
  49: { name: 'Crash Cymbal 1', len: 3.2, audible: 3.0, pan: -0.4, gain: 0.5, choke: 0 },
  50: { name: 'High Tom', len: 0.9, audible: 0.81, pan: -0.18, gain: 0.73, choke: 0 },
  51: { name: 'Ride Cymbal 1', len: 3.0, audible: 2.86, pan: 0.4, gain: 0.26, choke: 0 },
  52: { name: 'Chinese Cymbal', len: 2.4, audible: 2.27, pan: 0.5, gain: 0.27, choke: 0 },
  53: { name: 'Ride Bell', len: 3.0, audible: 2.9, pan: 0.36, gain: 0.39, choke: 0 },
  54: { name: 'Tambourine', len: 0.6, audible: 0.53, pan: 0.25, gain: 0.26, choke: 0 },
  55: { name: 'Splash Cymbal', len: 1.6, audible: 1.34, pan: -0.22, gain: 0.42, choke: 0 },
  56: { name: 'Cowbell', len: 0.6, audible: 0.38, pan: 0.18, gain: 0.63, choke: 0 },
  57: { name: 'Crash Cymbal 2', len: 3.6, audible: 3.44, pan: 0.42, gain: 0.48, choke: 0 },
  58: { name: 'Vibraslap', len: 1.2, audible: 0.96, pan: -0.25, gain: 0.29, choke: 0 },
  59: { name: 'Ride Cymbal 2', len: 3.2, audible: 3.07, pan: 0.42, gain: 0.3, choke: 0 },
  60: { name: 'Hi Bongo', len: 0.5, audible: 0.43, pan: -0.3, gain: 0.35, choke: 0 },
  61: { name: 'Low Bongo', len: 0.55, audible: 0.49, pan: -0.22, gain: 0.32, choke: 0 },
  62: { name: 'Mute Hi Conga', len: 0.3, audible: 0.15, pan: 0.28, gain: 0.56, choke: 0 },
  63: { name: 'Open Hi Conga', len: 0.75, audible: 0.69, pan: 0.3, gain: 0.28, choke: 0 },
  64: { name: 'Low Conga', len: 0.85, audible: 0.8, pan: 0.38, gain: 0.28, choke: 0 },
  65: { name: 'High Timbale', len: 0.8, audible: 0.69, pan: -0.32, gain: 0.39, choke: 0 },
  66: { name: 'Low Timbale', len: 0.9, audible: 0.79, pan: -0.4, gain: 0.38, choke: 0 },
  67: { name: 'High Agogo', len: 0.9, audible: 0.82, pan: 0.25, gain: 0.23, choke: 0 },
  68: { name: 'Low Agogo', len: 1.0, audible: 0.91, pan: 0.32, gain: 0.25, choke: 0 },
  69: { name: 'Cabasa', len: 0.35, audible: 0.2, pan: -0.4, gain: 0.28, choke: 0 },
  70: { name: 'Maracas', len: 0.25, audible: 0.11, pan: 0.4, gain: 0.44, choke: 0 },
  71: { name: 'Short Whistle', len: 0.2, audible: 0.12, pan: -0.15, gain: 0.1, choke: 2 },
  72: { name: 'Long Whistle', len: 0.55, audible: 0.45, pan: -0.15, gain: 0.1, choke: 2 },
  73: { name: 'Short Guiro', len: 0.3, audible: 0.12, pan: 0.32, gain: 0.42, choke: 3 },
  74: { name: 'Long Guiro', len: 0.65, audible: 0.46, pan: 0.32, gain: 0.34, choke: 3 },
  75: { name: 'Claves', len: 0.3, audible: 0.27, pan: -0.28, gain: 0.2, choke: 0 },
  76: { name: 'Hi Wood Block', len: 0.25, audible: 0.2, pan: 0.24, gain: 0.32, choke: 0 },
  77: { name: 'Low Wood Block', len: 0.3, audible: 0.21, pan: 0.3, gain: 0.34, choke: 0 },
  78: { name: 'Mute Cuica', len: 0.3, audible: 0.1, pan: -0.35, gain: 0.25, choke: 4 },
  79: { name: 'Open Cuica', len: 0.55, audible: 0.27, pan: -0.35, gain: 0.23, choke: 4 },
  80: { name: 'Mute Triangle', len: 0.3, audible: 0.23, pan: 0.45, gain: 0.27, choke: 5 },
  81: { name: 'Open Triangle', len: 2.6, audible: 2.52, pan: 0.45, gain: 0.22, choke: 5 },
  82: { name: 'Shaker', len: 0.4, audible: 0.28, pan: -0.42, gain: 0.46, choke: 0 },
  83: { name: 'Jingle Bell', len: 0.9, audible: 0.77, pan: 0.35, gain: 0.22, choke: 0 },
  84: { name: 'Belltree', len: 1.8, audible: 1.7, pan: -0.3, gain: 0.26, choke: 0 },
  85: { name: 'Castanets', len: 0.2, audible: 0.07, pan: 0.28, gain: 0.42, choke: 0 },
  86: { name: 'Mute Surdo', len: 0.45, audible: 0.36, pan: -0.2, gain: 0.66, choke: 6 },
  87: { name: 'Open Surdo', len: 1.4, audible: 1.26, pan: -0.2, gain: 0.64, choke: 6 },
};

// ---------------------------------------------------------------------------
// Kits
// ---------------------------------------------------------------------------

interface KitSpec {
  kickTune: number;
  kickDecay: number;
  kickClick: number;
  /** resonant-head "sub" level */
  kickSub: number;
  snareTune: number;
  snareDecay: number;
  /** snare-wire level */
  wires: number;
  tomTune: number;
  tomDecay: number;
  cymDecay: number;
  cymBright: number;
  /** 0 = sticks, 1 = very soft contact (felt beater, brushes) */
  soft: number;
  /** ambience send, its RT60 (s) and size */
  room: number;
  roomRt: number;
  roomSize: number;
  /** saturation on kick / snare / toms */
  drive: number;
  electronic: boolean;
  brush: boolean;
}

const STANDARD: KitSpec = {
  kickTune: 1, kickDecay: 1, kickClick: 1, kickSub: 0.3,
  snareTune: 1, snareDecay: 1, wires: 1,
  tomTune: 1, tomDecay: 1,
  cymDecay: 1, cymBright: 1,
  soft: 0, room: 0, roomRt: 0.5, roomSize: 1, drive: 0,
  electronic: false, brush: false,
};

const JAZZ: KitSpec = {
  kickTune: 1.32, kickDecay: 1.45, kickClick: 0.45, kickSub: 0.12,
  snareTune: 1.15, snareDecay: 0.95, wires: 0.8,
  tomTune: 1.3, tomDecay: 1.1,
  cymDecay: 1.2, cymBright: 0.9,
  soft: 0.3, room: 0.22, roomRt: 0.45, roomSize: 0.9, drive: 0,
  electronic: false, brush: false,
};

const KITS: Record<DrumKit, KitSpec> = {
  standard: STANDARD,
  room: { ...STANDARD, kickDecay: 1.12, kickSub: 0.42, snareDecay: 1.12, tomDecay: 1.15, room: 0.7, roomRt: 0.6, roomSize: 1.25 },
  power: {
    ...STANDARD,
    kickTune: 0.9, kickDecay: 1.25, kickClick: 1.4, kickSub: 0.5,
    snareTune: 0.92, snareDecay: 1.3, wires: 1.2,
    tomTune: 0.88, tomDecay: 1.3,
    cymDecay: 1.1, cymBright: 1.1,
    room: 0.4, roomRt: 0.7, roomSize: 1.4, drive: 0.55,
  },
  electronic: { ...STANDARD, kickSub: 0, electronic: true },
  jazz: JAZZ,
  brush: { ...JAZZ, kickClick: 0.25, wires: 0.9, soft: 0.8, brush: true },
};

const isKick = (n: number) => n === 35 || n === 36;
const isSnare = (n: number) => n === 38 || n === 40;
const isTom = (n: number) => n === 41 || n === 43 || n === 45 || n === 47 || n === 48 || n === 50;
const isCymbal = (n: number) => n === 49 || n === 51 || n === 52 || n === 53 || n === 55 || n === 57 || n === 59;

/** Extra buffer (s) a kit's ambience needs after the dry sound (short hits excite less of the room). */
function roomTail(k: KitSpec, dryLen: number): number {
  return k.room > 0 ? k.roomRt * clamp(0.25 + 0.5 * dryLen, 0.3, 0.55) : 0;
}

/** Dry length factor of a note in a kit. */
function kitLengthFactor(note: number, k: KitSpec): number {
  if (isKick(note)) return k.electronic ? (note === 35 ? 1.75 : 1.35) : k.kickDecay;
  if (isSnare(note)) {
    if (k.brush) return note === 40 ? 2.0 : 0.85;
    return k.snareDecay;
  }
  if (isTom(note)) return k.electronic ? 0.85 : k.tomDecay;
  if (isCymbal(note) || note === 46) return k.electronic ? 0.75 : k.cymDecay;
  if (note === 39) return k.brush ? 0.9 : k.electronic ? 1.2 : 1;
  return 1;
}

function noteSeconds(note: number, k: KitSpec): number {
  const info = NOTES[note];
  if (!info) return 0.05;
  const dry = info.len * kitLengthFactor(note, k);
  return dry + roomTail(k, dry);
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Buffer length (frames) for a note. */
export function drumNoteLength(note: number, sampleRate: number, kit: DrumKit = 'standard'): number {
  return Math.max(1, Math.round(noteSeconds(Math.round(note), KITS[kit] ?? STANDARD) * sampleRate));
}

/** Seconds the hit stays clearly audible (≈ its −40 dB point). */
export function drumAudibleSeconds(note: number, kit: DrumKit = 'standard'): number {
  const n = Math.round(note);
  const info = NOTES[n];
  if (!info) return 0;
  const k = KITS[kit] ?? STANDARD;
  const f = kitLengthFactor(n, k);
  const dry = info.len * f;
  // a brush swirl sounds for (almost) its whole length
  const a = k.brush && n === 40 ? dry * 0.95 : info.audible * f;
  // (errs on the long side in room-y kits: better a little too long for the mic guard)
  return Math.min(noteSeconds(n, k), a + roomTail(k, dry) * 0.9);
}

/** Stereo position −1..1 from the drummer's seat (hi-hat a little left, floor tom right, ride right…); subtle. */
export function drumPan(note: number): number {
  return NOTES[Math.round(note)]?.pan ?? 0;
}

/**
 * Per-kit level corrections (dB) for the voices a kit changes (an 808 kick
 * carries far more energy than an acoustic one at the same peak, a driven
 * power snare is denser…), measured with a K-weighted short-term loudness.
 */
const KIT_TRIM_DB: Partial<Record<DrumKit, Readonly<Record<number, number>>>> = {
  room: { 29: 1.5, 41: 1.5, 43: -1.5, 45: -2.5, 47: -1.5, 48: -2, 50: 1.5, 52: 2.5, 63: -1.5, 71: 1.5, 75: -1.5 },
  power: { 35: -1, 36: -1, 38: -2.5, 40: -2, 43: -2, 45: -3, 47: -2, 48: -2.5, 75: 1, 79: 2 },
  electronic: {
    35: -3.5, 36: -3.5, 37: -1.5, 38: -1.5, 40: -1.5, 41: -3, 42: 1.5, 43: -3, 44: 3, 45: -3.5,
    46: 1.5, 47: -4, 48: -2, 49: 2.5, 50: -3.5, 51: 2, 57: 2, 59: -1, 75: 1.5,
  },
  jazz: { 35: -1, 41: -1.5, 43: -2, 45: -3.5, 47: -1.5, 48: -1.5 },
  brush: { 35: -1, 38: -1.5, 39: -4, 40: -2, 43: -1.5, 45: -2.5, 55: -1.5, 59: -1 },
};

/**
 * Level trim so kick/snare/hats sit in a natural balance when played at the
 * same velocity (renders are peak-normalised, so a short hi-hat and a long
 * crash need very different trims). Pass the kit to include its own
 * corrections; all kits then sit at about the same overall loudness.
 */
export function drumGain(note: number, kit: DrumKit = 'standard'): number {
  const n = Math.round(note);
  const g = NOTES[n]?.gain ?? 0;
  const t = KIT_TRIM_DB[kit]?.[n] ?? 0;
  return t ? g * Math.pow(10, t / 20) : g;
}

/**
 * Kit choke class (GM: closed 42 / pedal 44 / open 46 hi-hat share one; mute/open
 * cuica, short/long whistle and guiro, mute/open triangle, mute/open surdo).
 * A new hit silences any sounding note of the same class. 0 = none.
 */
export function drumChokeGroup(note: number): number {
  return NOTES[Math.round(note)]?.choke ?? 0;
}

/** GM name of a percussion note ("Acoustic Snare"), or null. */
export function drumNoteName(note: number): string | null {
  return Number.isInteger(note) ? (NOTES[note]?.name ?? null) : null;
}

/** Velocity → peak level (≈ 22 dB range, same curve as the melodic voices). */
export function drumVelocityLevel(velocity: number): number {
  return 0.08 + 0.92 * Math.pow(clamp(velocity, 0, 1), 1.6);
}

// ---------------------------------------------------------------------------
// DSP primitives
// ---------------------------------------------------------------------------

const FLOOR = 2e-5;
type Stage = readonly [BiquadType, number, number, number?];

interface Ctx {
  out: Float32Array;
  sr: number;
  /** velocity 0..1 */
  v: number;
  k: KitSpec;
  rand: () => number;
}

function subSeed(c: Ctx): number {
  return ((c.rand() * 4294967296) | 0) || 0x2545f491;
}

/** Seeded white noise in [−1, 1) (inline xorshift32 – much cheaper than a closure per sample). */
function noise(n: number, seed: number): Float32Array {
  const b = new Float32Array(n);
  let x = seed | 0 || 0x2545f491;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    b[i] = x * 4.656612873077393e-10;
  }
  return b;
}

/**
 * One or two biquads in series over buf[from, to) in a single unrolled pass.
 * The filter state is flushed to zero once it is negligible (checked every
 * 64 samples), so a ringing-down tail never reaches (very slow) subnormal
 * arithmetic.
 */
function biquad2(buf: Float32Array, p: BiquadCoeffs, q: BiquadCoeffs | null, from: number, to: number): void {
  const a0 = p.b0, a1 = p.b1, a2 = p.b2, a3 = p.a1, a4 = p.a2;
  const c0 = q ? q.b0 : 1, c1 = q ? q.b1 : 0, c2 = q ? q.b2 : 0, c3 = q ? q.a1 : 0, c4 = q ? q.a2 : 0;
  let z1 = 0;
  let z2 = 0;
  let w1 = 0;
  let w2 = 0;
  for (let b = from; b < to; b += 64) {
    const e = Math.min(to, b + 64);
    for (let i = b; i < e; i++) {
      const x = buf[i];
      const y = a0 * x + z1;
      z1 = a1 * x - a3 * y + z2;
      z2 = a2 * x - a4 * y;
      const u = c0 * y + w1;
      w1 = c1 * y - c3 * u + w2;
      w2 = c2 * y - c4 * u;
      buf[i] = u;
    }
    if (Math.abs(z1) + Math.abs(z2) < 1e-25) z1 = z2 = 0;
    if (Math.abs(w1) + Math.abs(w2) < 1e-25) w1 = w2 = 0;
  }
}

/** Run a biquad cascade over buf (two stages per pass). */
function filt(buf: Float32Array, sr: number, stages: readonly Stage[], from = 0, to = buf.length): void {
  const cs = stages.map(([t, f, q, g]) => biquadCoeffs(t, Math.min(f, sr * 0.45), q, g ?? 0, sr));
  for (let i = 0; i < cs.length; i += 2) biquad2(buf, cs[i], cs[i + 1] ?? null, from, to);
}

/** Multiply by (1 − e^{−t/atk})·(mix·e^{−t/τ1} + (1 − mix)·e^{−t/τ2}) – recurrences only. */
function envelope(buf: Float32Array, sr: number, atk: number, tau1: number, tau2 = tau1, mix = 1): void {
  const da = atk > 0 ? Math.exp(-1 / (atk * sr)) : 0;
  const d1 = Math.exp(-1 / (tau1 * sr));
  const d2 = Math.exp(-1 / (tau2 * sr));
  let a = 1;
  let e1 = mix;
  let e2 = 1 - mix;
  for (let i = 0; i < buf.length; i++) {
    buf[i] *= (1 - a) * (e1 + e2);
    a = a > 1e-9 ? a * da : 0;
    e1 *= d1;
    e2 *= d2;
  }
}

function addInto(out: Float32Array, src: Float32Array, start: number, gain: number): void {
  const n = Math.min(src.length, out.length - start);
  for (let i = 0; i < n; i++) out[start + i] += src[i] * gain;
}

/** Samples a two-stage decay needs to fall ~70 dB. */
function decayLength(sr: number, atk: number, tau1: number, tau2 = tau1, mix = 1): number {
  const slow = mix < 1 ? Math.max(tau1, tau2) : tau1;
  return Math.ceil((atk * 3 + slow * 8) * sr);
}

/**
 * Enveloped, filtered noise added at `start` (s); the component is scaled so
 * that its RMS over its first `refSec` seconds is `amp` (or its peak, if refSec = 0).
 */
function addNoise(
  c: Ctx,
  start: number,
  amp: number,
  atk: number,
  tau1: number,
  stages: readonly Stage[],
  tau2 = tau1,
  mix = 1,
  refSec = 0,
): void {
  const { out, sr } = c;
  const s0 = Math.round(start * sr);
  const n = Math.min(out.length - s0, decayLength(sr, atk, tau1, tau2, mix));
  if (n <= 8 || amp <= 0) {
    subSeed(c); // keep the random sequence independent of velocity / length
    return;
  }
  const b = noise(n, subSeed(c));
  envelope(b, sr, atk, tau1, tau2, mix);
  filt(b, sr, stages);
  fadeOut(b, Math.min(n >> 2, Math.round(0.01 * sr)));
  const ref = refSec > 0 ? rmsRange(b, 0, Math.round(refSec * sr)) : peakAbs(b);
  if (ref > 0) addInto(out, b, s0, amp / ref);
}

/**
 * Add amp·env(t)·sin(φ(t)) whose frequency glides exponentially from fFrom to
 * fTo (time constant glideTau) – a struck membrane's tension modulation. The
 * per-sample rotation uses Taylor-series cos/sin (|ω| < ~0.8 rad) and is
 * renormalised every 512 samples, so it costs a handful of multiplies.
 */
function addGlide(
  c: Ctx,
  start: number,
  fFrom: number,
  fTo: number,
  glideTau: number,
  amp: number,
  tau: number,
  atk: number,
): void {
  const { out, sr } = c;
  const s0 = Math.round(start * sr);
  if (amp <= 0 || !(fTo > 0) || Math.max(fFrom, fTo) > sr / 7) return;
  const n = Math.min(out.length - s0, Math.ceil(tau * sr * Math.log(amp / FLOOR)) + Math.ceil(atk * 4 * sr));
  if (n <= 2) return;
  const k = (2 * Math.PI) / sr;
  const dg = Math.exp(-1 / (Math.max(glideTau, 1e-4) * sr));
  const de = Math.exp(-1 / (tau * sr));
  const da = atk > 0 ? Math.exp(-1 / (atk * sr)) : 0;
  const df = fFrom - fTo;
  let g = 1;
  let env = amp;
  let a = 1;
  let cs = 1;
  let sn = 0;
  for (let i = 0; i < n; i++) {
    out[s0 + i] += sn * env * (1 - a);
    const w = k * (fTo + df * g);
    const w2 = w * w;
    const cw = 1 - w2 * (0.5 - w2 * (1 / 24 - w2 / 720));
    const sw = w * (1 - w2 * (1 / 6 - w2 * (1 / 120 - w2 / 5040)));
    const nc = cs * cw - sn * sw;
    sn = sn * cw + cs * sw;
    cs = nc;
    g = g > 1e-9 ? g * dg : 0;
    env *= de;
    a = a > 1e-9 ? a * da : 0;
    if ((i & 511) === 511) {
      const r = 1 / Math.sqrt(cs * cs + sn * sn);
      cs *= r;
      sn *= r;
    }
  }
}

/** [ratio, amp, tau-fraction] */
type Mode = readonly [number, number, number];

/** Static damped modes f·ratio (amp, τ·fraction), slightly jittered, rendered with a ResonatorBank. */
function addModes(c: Ctx, f: number, tau: number, modes: readonly Mode[], ampScale = 1, jitter = 0.01): void {
  const bank = new ResonatorBank();
  for (const [r, a, t] of modes) {
    const fr = f * r * (1 + jitter * (c.rand() - 0.5));
    if (fr < c.sr * 0.45) bank.add(fr, a * ampScale, tau * t, c.sr, FLOOR);
  }
  bank.renderInto(c.out);
}

/** Struck membrane: gliding low modes + static upper modes. */
function addMembrane(
  c: Ctx,
  f: number,
  tau: number,
  sweep: number,
  glideTau: number,
  glideModes: readonly Mode[],
  staticModes: readonly Mode[],
  atk: number,
  upperGain = 1,
): void {
  for (const [r, a, t] of glideModes) addGlide(c, 0, f * r * sweep, f * r, glideTau, a, tau * t, atk);
  if (staticModes.length) addModes(c, f, tau, staticModes, upperGain);
}

/** The TR-808's six cymbal/hi-hat oscillators (Hz). */
const METAL_808 = [205.3, 304.4, 369.6, 522.7, 540, 800] as const;

/** Soft saturation x·(1+d)/(1+d|x|) after normalising the peak to 1 (adds punch, rounds transients). */
function saturate(buf: Float32Array, drive: number): void {
  const p = peakAbs(buf);
  if (!(p > 0) || drive <= 0) return;
  const g = 1 / p;
  const d = drive;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] * g;
    buf[i] = (x * (1 + d)) / (1 + d * Math.abs(x));
  }
}

/**
 * Bank of parallel resonant band-pass filters driven by `exc`: [freq, τ (s), gain].
 * Q is set from the ring time (Q = π·f·τ) and each band is scaled so its
 * impulse response has unit-ish amplitude regardless of Q.
 */
function resonate(exc: Float32Array, sr: number, modes: readonly (readonly [number, number, number])[]): Float32Array {
  const sum = new Float32Array(exc.length);
  const tmp = new Float32Array(exc.length);
  for (const [f, tau, gain] of modes) {
    if (f >= sr * 0.45) continue;
    const q = Math.max(0.5, Math.PI * f * tau);
    tmp.set(exc);
    filt(tmp, sr, [['bandpass', f, q]]);
    const w0 = (2 * Math.PI * f) / sr;
    const g = (gain * q) / Math.max(1e-3, Math.sin(w0));
    for (let i = 0; i < tmp.length; i++) sum[i] += tmp[i] * g;
  }
  return sum;
}

/** Stochastic collisions (PhISEM): impulses of random size driving `exc` – used by shakers and jingles. */
function collisions(
  c: Ctx,
  n: number,
  atk: number,
  tau: number,
  rate: number,
  grainTau: number,
): Float32Array {
  const { sr } = c;
  const buf = new Float32Array(n);
  const da = Math.exp(-1 / (Math.max(atk, 1e-4) * sr));
  const dd = Math.exp(-1 / (tau * sr));
  const dg = Math.exp(-1 / (grainTau * sr));
  const pScale = rate / sr;
  let a = 1;
  let e = 1;
  let level = 0;
  let x = subSeed(c);
  for (let i = 0; i < n; i++) {
    const env = (1 - a) * e;
    a = a > 1e-9 ? a * da : 0;
    e *= dd;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const u = (x >>> 0) * 2.3283064365386963e-10;
    if (u < pScale * env) level += env * (0.35 + 0.65 * (u / (pScale * env)));
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    buf[i] = level * x * 4.656612873077393e-10;
    level = level > 1e-12 ? level * dg : 0;
  }
  return buf;
}

/**
 * A small room: 8-line feedback delay network (Householder mixing, one-pole
 * damping in each loop), fed by the first 0.3 s of the hit and added in
 * place. The loops are damped around 5–7 kHz, so the network runs at half
 * the sample rate (pairs averaged in, linearly interpolated out) – half the
 * cost, and it runs for every note of a room kit.
 */
function addRoom(out: Float32Array, sr: number, mix: number, rt60: number, size: number): void {
  const hr = sr / 2;
  const L = [0.0071, 0.0089, 0.0113, 0.0131, 0.0157, 0.0181, 0.0209, 0.0239].map((d) => Math.max(4, Math.round(d * size * hr)));
  const G = L.map((l) => Math.pow(10, (-3 * l) / (rt60 * hr)));
  const [L0, L1, L2, L3, L4, L5, L6, L7] = L;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = G;
  const m0 = new Float64Array(L0), m1 = new Float64Array(L1), m2 = new Float64Array(L2), m3 = new Float64Array(L3);
  const m4 = new Float64Array(L4), m5 = new Float64Array(L5), m6 = new Float64Array(L6), m7 = new Float64Array(L7);
  let j0 = 0, j1 = 0, j2 = 0, j3 = 0, j4 = 0, j5 = 0, j6 = 0, j7 = 0;
  let l0 = 0, l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0, l6 = 0, l7 = 0;
  const da = Math.exp((-2 * Math.PI * Math.min(hr * 0.45, 6500 / Math.sqrt(size))) / hr);
  const db = 1 - da;
  const inputEnd = Math.min(out.length, Math.round(0.3 * sr));
  const end = Math.min(out.length, inputEnd + Math.round(rt60 * sr));
  const outGain = mix * 0.5;
  let prev = 0;
  for (let i = 0; i + 1 < end; i += 2) {
    const x = i < inputEnd ? (out[i] + out[i + 1]) * 0.15 : 0;
    l0 = db * m0[j0] + da * l0;
    l1 = db * m1[j1] + da * l1;
    l2 = db * m2[j2] + da * l2;
    l3 = db * m3[j3] + da * l3;
    l4 = db * m4[j4] + da * l4;
    l5 = db * m5[j5] + da * l5;
    l6 = db * m6[j6] + da * l6;
    l7 = db * m7[j7] + da * l7;
    const h = (l0 + l1 + l2 + l3 + l4 + l5 + l6 + l7) * 0.25;
    m0[j0] = x + g0 * (l0 - h);
    m1[j1] = x + g1 * (l1 - h);
    m2[j2] = x + g2 * (l2 - h);
    m3[j3] = x + g3 * (l3 - h);
    m4[j4] = x + g4 * (l4 - h);
    m5[j5] = x + g5 * (l5 - h);
    m6[j6] = x + g6 * (l6 - h);
    m7[j7] = x + g7 * (l7 - h);
    if (++j0 === L0) j0 = 0;
    if (++j1 === L1) j1 = 0;
    if (++j2 === L2) j2 = 0;
    if (++j3 === L3) j3 = 0;
    if (++j4 === L4) j4 = 0;
    if (++j5 === L5) j5 = 0;
    if (++j6 === L6) j6 = 0;
    if (++j7 === L7) j7 = 0;
    const y = (l0 - l1 + l2 - l3 + l4 - l5 + l6 - l7) * outGain;
    out[i] += (prev + y) * 0.5;
    out[i + 1] += y;
    prev = y;
  }
}

// ---------------------------------------------------------------------------
// Kick
// ---------------------------------------------------------------------------

function kick(c: Ctx, deep: boolean): void {
  const { v, k, sr } = c;
  if (k.electronic) {
    if (deep) {
      // 808: long, round boom, small pitch drop, a hint of trigger tick
      addGlide(c, 0, 112 * (0.85 + 0.3 * v), 46, 0.03, 1, 0.5, 0.0006);
      addNoise(c, 0, 0.06 + 0.12 * v, 0.0001, 0.0012, [['lowpass', 2500 + 3000 * v, 0.7]]);
      saturate(c.out, 0.5);
    } else {
      // 909: punchy pitch sweep, noisy click, slightly squared-off tail
      addGlide(c, 0, 250 * (0.8 + 0.35 * v), 52, 0.017, 1, 0.3, 0.0004);
      addNoise(c, 0, 0.16 + 0.3 * v, 0.0001, 0.0018, [['highpass', 700, 0.7], ['lowpass', 6000 + 7000 * v, 0.7]]);
      saturate(c.out, 1.1);
    }
    return;
  }
  const f = (deep ? 50 : 57) * k.kickTune;
  const tau = (deep ? 0.18 : 0.135) * k.kickDecay;
  const sweep = 1.4 + 1.0 * v - 0.25 * k.soft;
  const gT = 0.008 + 0.004 * (1 - v);
  const atk = 0.0005 + 0.0022 * k.soft;
  addMembrane(c, f, tau, sweep, gT, [[1, 1, 1], [1.6, 0.3, 0.38], [2.28, 0.12, 0.2]], [], atk);
  // resonant (front) head: blooms in after the hit and carries the low "sub"
  // tail; it rides the same pitch drop so it adds to the body without beating
  addGlide(c, 0, f * sweep, f, gT, k.kickSub, tau * 1.9, 0.012);
  // shell / head knock
  addModes(c, 1, 1, [[330 * k.kickTune, 0.03 + 0.14 * v, 0.016], [640 * k.kickTune, 0.01 + 0.08 * v, 0.009]]);
  // beater on head
  const click = (0.1 + 0.42 * v) * k.kickClick * (1 - 0.55 * k.soft);
  addNoise(c, 0, click, 0.00015 + 0.0015 * k.soft, 0.0011 + 0.0025 * k.soft, [
    ['highpass', 1100, 0.7],
    ['peaking', 2800 + 2600 * v, 1.2, 4],
    ['lowpass', Math.min(sr * 0.45, (5000 + 9000 * v) * (1 - 0.5 * k.soft)), 0.7],
  ]);
  if (k.drive > 0) saturate(c.out, k.drive * 1.6);
}

// ---------------------------------------------------------------------------
// Snares, side stick, claps
// ---------------------------------------------------------------------------

const SNARE_UPPER: readonly Mode[] = [
  [2.14, 0.3, 0.5],
  [2.3, 0.25, 0.45],
  [2.65, 0.18, 0.4],
  [2.92, 0.14, 0.35],
  [3.16, 0.1, 0.3],
  [3.5, 0.08, 0.28],
];

function snare(c: Ctx, electric: boolean): void {
  const { v, k } = c;
  if (k.brush) {
    brush(c, electric ? 'swirl' : 'tap');
    return;
  }
  if (k.electronic) {
    if (electric) {
      // 909: two swept tones, bright noise, a little drive
      addMembrane(c, 195, 0.06, 1.2 + 0.15 * v, 0.014, [[1, 1, 1], [1.8, 0.6, 0.7]], [], 0.0003);
      addNoise(c, 0, 0.9 * (0.75 + 0.35 * v), 0.0004, 0.03, [['highpass', 1200, 0.7], ['lowpass', 7000 + 7000 * v, 0.7]], 0.075, 0.45, 0.05);
      saturate(c.out, 0.7);
    } else {
      // 808: two bridged-T tones + "snappy" noise
      addMembrane(c, 185, 0.055, 1.04, 0.01, [[1, 1, 1], [1.78, 0.62, 0.7]], [], 0.0003);
      addNoise(c, 0, 0.75 * (0.75 + 0.35 * v), 0.0005, 0.11, [['highpass', 1800, 0.7], ['lowpass', 7500 + 5500 * v, 0.7]], 0.11, 1, 0.05);
    }
    return;
  }
  const f = (electric ? 232 : 186) * k.snareTune;
  const tau = (electric ? 0.05 : 0.075) * k.snareDecay;
  const atk = 0.0003 + 0.002 * k.soft;
  // the two tuned membrane modes, then the upper modes ("crack")
  addMembrane(c, f, tau, 1.04 + 0.1 * v, 0.012, [[1, 1, 1], [1.68, 0.6, 0.75]], SNARE_UPPER, atk, 0.35 + 0.9 * v);
  // the snares: bright, buzzy noise with its own two-stage envelope
  const wTau = (electric ? 0.085 : 0.15) * k.snareDecay;
  addNoise(
    c,
    0.0008,
    k.wires * (0.32 + 0.12 * v),
    0.0012,
    electric ? 0.03 : 0.045,
    [
      ['highpass', electric ? 2200 : 1300 + 500 * v, 0.7],
      ['peaking', 5200, 1.1, 3],
      ['lowpass', (electric ? 9000 : 5000) + 8000 * v, 0.7],
    ],
    wTau,
    0.5,
    0.05,
  );
  // stick crack
  addNoise(c, 0, (0.25 + 0.5 * v) * (1 - 0.5 * k.soft), 0.0001 + 0.001 * k.soft, 0.0011, [['bandpass', 2600 + 2400 * v, 0.9]]);
  if (electric) saturate(c.out, 0.35 + k.drive);
  else if (k.drive > 0) saturate(c.out, k.drive);
}

/** Brush strokes on the snare: 'tap' (38), 'slap' (39), 'swirl' (40). */
function brush(c: Ctx, kind: 'tap' | 'slap' | 'swirl'): void {
  const { v, k, sr, out } = c;
  const f = 186 * k.snareTune;
  if (kind === 'swirl') {
    // a circular stroke: slow swell and fade, gently pulsing as the brush turns
    const n = out.length;
    const b = noise(n, subSeed(c));
    envelope(b, sr, 0.11, 0.22);
    const w = (2 * Math.PI * 3.2) / sr;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    let cs = 1;
    let sn = 0;
    for (let i = 0; i < n; i++) {
      b[i] *= 0.8 + 0.2 * cs;
      const nc = cs * cw - sn * sw;
      sn = sn * cw + cs * sw;
      cs = nc;
    }
    filt(b, sr, [['highpass', 1500, 0.7], ['peaking', 3800, 0.9, 3], ['lowpass', 6500 + 3000 * v, 0.7]]);
    addInto(out, b, 0, 1 / (peakAbs(b) || 1));
    addGlide(c, 0.02, f, f, 1, 0.08, 0.05, 0.01);
    return;
  }
  const slap = kind === 'slap';
  // swishy wires
  addNoise(
    c,
    0,
    slap ? 0.9 : 0.75,
    slap ? 0.0012 : 0.004 - 0.002 * v,
    slap ? 0.035 : 0.05,
    [['highpass', 1500 - 300 * v, 0.7], ['peaking', 3500, 0.9, 3], ['lowpass', 4500 + 6500 * v, 0.7]],
    slap ? 0.12 : 0.16,
    0.55,
  );
  // the head under the brush
  addMembrane(c, f, slap ? 0.07 : 0.06, 1.02, 0.01, [[1, (slap ? 0.45 : 0.32) * (0.85 + 0.3 * v), 1], [1.68, 0.15, 0.7]], [], 0.003);
}

function sideStick(c: Ctx): void {
  const { v, k } = c;
  if (k.electronic) {
    // 808 rim shot: two clipped tones
    addModes(c, 1, 1, [[455, 1, 0.012], [1667, 0.9, 0.007]]);
    addNoise(c, 0, 0.3 + 0.3 * v, 0.0001, 0.0006, [['highpass', 3000, 0.7]]);
    saturate(c.out, 2.5);
    filt(c.out, c.sr, [['highpass', 250, 0.7]]);
    return;
  }
  const b = 0.3 + 1.0 * v;
  addModes(c, 1, 1, [
    [430, 1, 0.024],
    [1090, 0.55, 0.014],
    [1660, 0.5 * b, 0.01],
    [2560, 0.32 * b, 0.006],
    [3720, 0.2 * b, 0.004],
    [186 * k.snareTune, 0.25, 0.035],
  ]);
  addNoise(c, 0, 0.15 + 0.7 * v, 0.00008, 0.0008, [['highpass', 2500, 0.7], ['lowpass', 6000 + 10000 * v, 0.7]]);
  addNoise(c, 0.001, 0.035 * k.wires, 0.001, 0.035, [['highpass', 2000, 0.7]], 0.035, 1, 0.03);
}

/** Hand clap: a few staggered noise bursts and a short diffuse tail. `single` = one slap. */
function clap(c: Ctx, single: boolean): void {
  const { out, sr, v, k } = c;
  if (k.brush && !single) {
    brush(c, 'slap');
    return;
  }
  const n = out.length;
  const env = new Float32Array(n);
  const jit = () => (c.rand() - 0.5) * 0.002;
  const times = single ? [0] : k.electronic ? [0, 0.011 + jit(), 0.022 + jit()] : [0, 0.0098 + jit(), 0.0187 + jit(), 0.0302 + jit()];
  const amps = single ? [1] : k.electronic ? [0.8, 0.85, 1] : [0.7, 0.85, 0.75, 1];
  const burstTau = single ? 0.004 : 0.0022;
  const db = Math.exp(-1 / (burstTau * sr));
  times.forEach((t, j) => {
    const s0 = Math.round(Math.max(0, t) * sr);
    const m = Math.min(n - s0, Math.round(burstTau * 9 * sr));
    let e = amps[j];
    const atkN = Math.max(1, Math.round(0.00015 * sr));
    for (let i = 0; i < m; i++) {
      env[s0 + i] += e * Math.min(1, i / atkN);
      e *= db;
    }
  });
  // reverb-y tail after the last burst
  const tailStart = Math.round(Math.max(0, times[times.length - 1]) * sr);
  const tailTau = (single ? 0.03 : k.electronic ? 0.12 : 0.085) * (1 + 0.5 * k.room);
  const dt = Math.exp(-1 / (tailTau * sr));
  let e = single ? 0.12 : 0.33;
  const rise = Math.round(0.004 * sr);
  for (let i = tailStart; i < n; i++) {
    env[i] += e * Math.min(1, (i - tailStart) / rise);
    e *= dt;
    if (e < 1e-6) break;
  }
  const b = noise(n, subSeed(c));
  for (let i = 0; i < n; i++) b[i] *= env[i];
  const centre = (single ? 1300 : 1050) + 450 * v;
  filt(b, sr, [
    ['highpass', 550, 0.7],
    ['peaking', centre, 1.4, 9],
    ['lowpass', 5000 + 6000 * v, 0.7],
  ]);
  addInto(out, b, 0, 1 / (peakAbs(b) || 1));
  if (single) addGlide(c, 0, 230, 210, 0.01, 0.25, 0.015, 0.0003);
}

// ---------------------------------------------------------------------------
// Toms & hand drums
// ---------------------------------------------------------------------------

const TOM_HZ: Record<number, number> = { 41: 82, 43: 97, 45: 110, 47: 126, 48: 143, 50: 166 };
const TOM_808_HZ: Record<number, number> = { 41: 78, 43: 96, 45: 112, 47: 135, 48: 160, 50: 190 };

function tom(c: Ctx, note: number): void {
  const { v, k } = c;
  if (k.electronic) {
    const f = TOM_808_HZ[note];
    addMembrane(c, f, 0.2 + 12 / f, 1.2 + 0.35 * v, 0.03, [[1, 1, 1], [1.5, 0.08, 0.4]], [], 0.0004);
    addNoise(c, 0, 0.04 + 0.3 * v, 0.0001, 0.001, [['lowpass', 2500 + 5000 * v, 0.7]]);
    return;
  }
  const f = TOM_HZ[note] * k.tomTune;
  const tau = (0.16 + 15 / f) * k.tomDecay;
  const atk = 0.0004 + 0.003 * k.soft;
  addMembrane(
    c,
    f,
    tau,
    1.08 + 0.14 * v,
    0.05,
    [[1, 1, 1], [1.5, 0.32, 0.45], [1.98, 0.16, 0.3]],
    [[2.44, 0.1, 0.18], [2.9, 0.06, 0.12], [3.3, 0.04, 0.1]],
    atk,
    0.5 + v,
  );
  // the highest modes only speak when the head is hit hard
  addModes(c, f, tau, [[3.62, 0.04, 0.08], [4.15, 0.03, 0.07], [4.71, 0.025, 0.06], [5.33, 0.02, 0.05]], 2.5 * v * v);
  // stick
  addNoise(c, 0, (0.12 + 0.48 * v) * (1 - 0.5 * k.soft), 0.0001 + 0.002 * k.soft, 0.0018 + 0.004 * k.soft, [['bandpass', 1900 + 2800 * v, 0.8]]);
  // sympathetic snare buzz
  addNoise(c, 0.002, (0.004 + 0.014 * v) * k.wires, 0.002, 0.07, [['highpass', 3000, 0.7]], 0.07, 1, 0.05);
  if (k.brush) addNoise(c, 0, 0.04 + 0.12 * v, 0.004, 0.06, [['highpass', 1500, 0.7], ['lowpass', 4000 + 6000 * v, 0.7]], 0.06, 1, 0.04);
  if (k.drive > 0) saturate(c.out, k.drive);
}

interface HandDrum {
  f: number;
  tau: number;
  sweep: number;
  glide: number;
  modes: readonly Mode[];
  slap: number;
  slapHz: number;
  slapTau: number;
  /** metal shell ring [freq, amp, tau] */
  ring?: readonly Mode[];
}

function handDrum(c: Ctx, p: HandDrum): void {
  const { v } = c;
  addMembrane(c, p.f, p.tau, 1 + (p.sweep - 1) * (0.5 + v), p.glide, [[1, 1, 1]], p.modes, 0.0004, 0.5 + 0.8 * v);
  addNoise(c, 0, p.slap * (0.5 + 0.7 * v), 0.0001, p.slapTau, [['bandpass', p.slapHz * (0.8 + 0.4 * v), 0.9]]);
  if (p.ring) addModes(c, 1, 1, p.ring, 0.5 + 0.7 * v, 0.02);
}

const HAND_DRUMS: Record<number, HandDrum> = {
  60: { f: 395, tau: 0.12, sweep: 1.08, glide: 0.02, modes: [[1.55, 0.3, 0.5], [2.1, 0.15, 0.35], [2.6, 0.08, 0.25]], slap: 0.45, slapHz: 3000, slapTau: 0.002 },
  61: { f: 285, tau: 0.15, sweep: 1.08, glide: 0.025, modes: [[1.55, 0.3, 0.5], [2.1, 0.15, 0.35], [2.6, 0.08, 0.25]], slap: 0.4, slapHz: 2600, slapTau: 0.002 },
  62: { f: 345, tau: 0.035, sweep: 1.05, glide: 0.01, modes: [[1.6, 0.5, 0.6], [2.2, 0.3, 0.5], [2.8, 0.2, 0.4]], slap: 0.9, slapHz: 1900, slapTau: 0.006 },
  63: { f: 330, tau: 0.25, sweep: 1.06, glide: 0.03, modes: [[1.6, 0.22, 0.4], [2.2, 0.1, 0.3], [2.8, 0.05, 0.2]], slap: 0.35, slapHz: 2200, slapTau: 0.003 },
  64: { f: 222, tau: 0.3, sweep: 1.06, glide: 0.035, modes: [[1.6, 0.22, 0.4], [2.2, 0.1, 0.3], [2.8, 0.05, 0.2]], slap: 0.32, slapHz: 2000, slapTau: 0.003 },
  65: { f: 470, tau: 0.2, sweep: 1.04, glide: 0.015, modes: [[1.59, 0.4, 0.6], [2.14, 0.3, 0.5], [2.65, 0.2, 0.4], [3.16, 0.12, 0.3]], slap: 0.55, slapHz: 3500, slapTau: 0.0015, ring: [[1650, 0.18, 0.16], [2420, 0.12, 0.12], [3310, 0.08, 0.09]] },
  66: { f: 340, tau: 0.23, sweep: 1.04, glide: 0.018, modes: [[1.59, 0.4, 0.6], [2.14, 0.3, 0.5], [2.65, 0.2, 0.4], [3.16, 0.12, 0.3]], slap: 0.5, slapHz: 3200, slapTau: 0.0015, ring: [[1380, 0.18, 0.18], [2050, 0.12, 0.13], [2890, 0.08, 0.1]] },
  86: { f: 60, tau: 0.09, sweep: 1.15, glide: 0.02, modes: [[1.59, 0.3, 0.6], [2.14, 0.15, 0.4]], slap: 0.35, slapHz: 900, slapTau: 0.008 },
  87: { f: 58, tau: 0.42, sweep: 1.12, glide: 0.04, modes: [[1.59, 0.3, 0.5], [2.14, 0.15, 0.35], [2.65, 0.08, 0.25]], slap: 0.2, slapHz: 600, slapTau: 0.006 },
};

// ---------------------------------------------------------------------------
// Hi-hats & cymbals
// ---------------------------------------------------------------------------

function hat(c: Ctx, kind: 'closed' | 'pedal' | 'open'): void {
  const { out, sr, v, k } = c;
  const elec = k.electronic;
  const open = kind === 'open';
  const pedal = kind === 'pedal';
  const atk = (pedal ? 0.0022 : 0.0003) + 0.0015 * k.soft;
  const tau1 = open ? 0.07 : pedal ? 0.016 : 0.022 + 0.014 * v;
  const tau2 = open ? (elec ? 0.28 : 0.42) * k.cymDecay : pedal ? 0.045 : 0.075;
  const mix = open ? 0.4 : pedal ? 0.9 : 0.9;
  const n = Math.min(out.length, decayLength(sr, atk, tau1, tau2, mix));
  if (n < 8) return;
  // metallic source: square-wave metal + noise
  const scale = elec ? 1 : 1.32;
  const freqs = METAL_808.map((f) => f * scale * (1 + 0.01 * (c.rand() - 0.5)));
  const metalMix = elec ? 0.85 : 0.5;
  const m = metalWash(c, n, (1 - metalMix) / 0.577, freqs, metalMix / Math.sqrt(METAL_808.length), 1e3, atk, tau1, tau2, mix);
  // harder = more body AND much more top end
  const hp = (open ? 5600 : 6400) - 500 * v;
  filt(m, sr, [
    ['highpass', hp, 0.7],
    ['highpass', hp * 0.8, 0.7],
    ['peaking', elec ? 9500 : 9000 + 2000 * v, 1, 2 + 3 * v],
    ['lowpass', Math.min(sr * 0.45, (elec ? 9000 : 8500) + 9000 * v), 0.7],
  ]);
  fadeOut(m, Math.min(n >> 2, Math.round(0.02 * sr)));
  addInto(out, m, 0, 1 / (peakAbs(m) || 1));
  // stick tip / the cymbals clapping together
  if (pedal) addNoise(c, 0, 0.25, 0.002, 0.008, [['bandpass', 1600, 1.0]]);
  else addNoise(c, 0, (0.06 + 0.4 * v) * (1 - 0.6 * k.soft), 0.0001, 0.0012, [['bandpass', 4200 + 4000 * v, 1.0]]);
}

interface CymSpec {
  /** modal partials: range (Hz), count, spectral centre (Hz) and width (octaves) */
  lo: number;
  hi: number;
  count: number;
  center: number;
  width: number;
  /** partial decay at lo / hi (s) */
  tauLo: number;
  tauHi: number;
  modal: number;
  /** noise + metal "wash" */
  wash: number;
  washTau: number;
  washHp: number;
  washLp: number;
  washPeak: number;
  /** initial burst (relative to wash) and its decay */
  burst: number;
  burstTau: number;
  metal: number;
  metalScale: number;
  stick: number;
  trash: number;
  /** stick "ping" (ride) or bell partials: [freq, amp, tau] */
  ping?: readonly Mode[];
  pingLevel?: number;
}

const CRASH1: CymSpec = {
  lo: 380, hi: 12500, count: 14, center: 4200, width: 1.8, tauLo: 1.5, tauHi: 0.5, modal: 0.5,
  wash: 1, washTau: 0.9, washHp: 2200, washLp: 12000, washPeak: 5200, burst: 1.3, burstTau: 0.07,
  metal: 0.45, metalScale: 1.6, stick: 0.3, trash: 0,
};
const CRASH2: CymSpec = { ...CRASH1, lo: 330, hi: 11500, center: 3700, tauLo: 1.7, tauHi: 0.55, washTau: 1.05, washPeak: 4600, metalScale: 1.45, burst: 1.1 };
const RIDE1: CymSpec = {
  lo: 420, hi: 11000, count: 12, center: 4800, width: 1.6, tauLo: 1.8, tauHi: 0.8, modal: 0.45,
  wash: 0.5, washTau: 1.2, washHp: 3000, washLp: 11000, washPeak: 6000, burst: 0.4, burstTau: 0.04,
  metal: 0.5, metalScale: 1.7, stick: 0.45, trash: 0,
  ping: [[2480, 0.6, 0.3], [3170, 1, 0.26], [4090, 0.75, 0.2], [5260, 0.5, 0.15]], pingLevel: 0.9,
};
const RIDE2: CymSpec = {
  ...RIDE1, center: 4000, tauLo: 2.0, washTau: 1.35, metalScale: 1.5,
  ping: [[2210, 0.6, 0.32], [2860, 1, 0.28], [3720, 0.7, 0.22], [4810, 0.45, 0.16]], pingLevel: 0.75,
};
const RIDE_BELL: CymSpec = {
  ...RIDE1, modal: 0.25, wash: 0.3, burst: 0.2, stick: 0.3,
  ping: [
    [690, 0.5, 1.6], [1021, 0.7, 1.4], [1421, 1, 1.2], [1870, 0.85, 1.0],
    [2339, 0.7, 0.8], [2877, 0.5, 0.6], [3471, 0.35, 0.45], [4140, 0.25, 0.35],
  ],
  pingLevel: 1.6,
};
const CHINA: CymSpec = {
  lo: 300, hi: 9000, count: 16, center: 2600, width: 2.2, tauLo: 0.95, tauHi: 0.32, modal: 0.65,
  wash: 1, washTau: 0.6, washHp: 1400, washLp: 9500, washPeak: 3300, burst: 1.5, burstTau: 0.06,
  metal: 0.7, metalScale: 1.1, stick: 0.25, trash: 2.2,
};
const SPLASH: CymSpec = {
  lo: 900, hi: 14000, count: 12, center: 6500, width: 1.6, tauLo: 0.6, tauHi: 0.22, modal: 0.5,
  wash: 1, washTau: 0.38, washHp: 3500, washLp: 14000, washPeak: 7200, burst: 1.2, burstTau: 0.045,
  metal: 0.45, metalScale: 2.0, stick: 0.3, trash: 0,
};
/** 808-style cymbal: the six square oscillators dominate. */
const E_CRASH: CymSpec = { ...CRASH1, modal: 0.15, metal: 1, metalScale: 1, washHp: 3500, washPeak: 8000, washTau: 0.7, burst: 0.8 };
const E_RIDE: CymSpec = { ...RIDE1, modal: 0.2, metal: 1, metalScale: 1.25, washTau: 0.6, washHp: 5000, pingLevel: 0.3 };

/** Mean square over [0, T] of a·e^{−t/τ}·sin(ωt) (ω ≫ 1/T). */
function dampedMeanSquare(a: number, tau: number, T: number): number {
  return ((a * a) / 2) * (tau / (2 * T)) * (1 - Math.exp((-2 * T) / tau));
}

/**
 * Metallic noise: white noise (scaled by `noiseGain`) plus, for the first
 * `metalLen` samples, the six-square "metal" fading with time constant
 * `metalTau`, all under a two-stage envelope – one fused pass.
 */
function metalWash(
  c: Ctx,
  n: number,
  noiseGain: number,
  freqs: readonly number[],
  metalGain: number,
  metalTau: number,
  atk: number,
  tau1: number,
  tau2: number,
  mix: number,
  into?: Float32Array,
): Float32Array {
  const { sr } = c;
  const buf = into ?? new Float32Array(n);
  const da = atk > 0 ? Math.exp(-1 / (atk * sr)) : 0;
  const d1 = Math.exp(-1 / (tau1 * sr));
  const d2 = Math.exp(-1 / (tau2 * sr));
  const dm = Math.exp(-1 / (metalTau * sr));
  const metalLen = metalGain > 0 ? Math.min(n, Math.round(metalTau * 4.6 * sr)) : 0;
  // integer phase accumulators: the sign bit IS the square wave (branch-free)
  const inc = (f: number) => Math.round((f / sr) * 4294967296) | 0;
  const i0 = inc(freqs[0]), i1 = inc(freqs[1]), i2 = inc(freqs[2]);
  const i3 = inc(freqs[3]), i4 = inc(freqs[4]), i5 = inc(freqs[5]);
  let p0 = subSeed(c), p1 = subSeed(c), p2 = subSeed(c), p3 = subSeed(c), p4 = subSeed(c), p5 = subSeed(c);
  let x = subSeed(c);
  const ng = noiseGain * 4.656612873077393e-10;
  let a = 1;
  let e1 = mix;
  let e2 = 1 - mix;
  let mg = metalGain;
  for (let i = 0; i < metalLen; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    p0 = (p0 + i0) | 0;
    p1 = (p1 + i1) | 0;
    p2 = (p2 + i2) | 0;
    p3 = (p3 + i3) | 0;
    p4 = (p4 + i4) | 0;
    p5 = (p5 + i5) | 0;
    const sq = 6 + 2 * ((p0 >> 31) + (p1 >> 31) + (p2 >> 31) + (p3 >> 31) + (p4 >> 31) + (p5 >> 31));
    buf[i] = (x * ng + sq * mg) * (1 - a) * (e1 + e2);
    mg *= dm;
    a = a > 1e-9 ? a * da : 0;
    e1 *= d1;
    e2 *= d2;
  }
  for (let i = metalLen; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    buf[i] = x * ng * (1 - a) * (e1 + e2);
    a = a > 1e-9 ? a * da : 0;
    e1 *= d1;
    e2 *= d2;
  }
  return buf;
}

function cymbal(c: Ctx, s: CymSpec): void {
  const { out, sr, v, k } = c;
  const len = out.length;
  const bright = (0.55 + 0.7 * v) * k.cymBright;
  const decay = k.cymDecay;
  const T = Math.min(0.2, len / sr);
  const ref = Math.round(T * sr);
  // 1. modal partials and the ride's ping / the bell (one resonator bank,
  //    rendered after the wash; levels set analytically from their RMS over
  //    the first 0.2 s)
  const modal: [number, number, number][] = [];
  const lLo = Math.log(s.lo);
  const lHi = Math.log(s.hi);
  let msModal = 0;
  for (let i = 0; i < s.count; i++) {
    const x = (i + 0.5 + 0.7 * (c.rand() - 0.5)) / s.count;
    const f = Math.exp(lLo + (lHi - lLo) * x);
    const oct = Math.log2(f / s.center) / s.width;
    let a = (0.5 + c.rand()) / (1 + oct * oct);
    if (f > s.center) a *= Math.pow(bright, Math.log2(f / s.center));
    const tau = s.tauLo * Math.pow(s.tauHi / s.tauLo, x) * decay * (0.8 + 0.4 * c.rand());
    if (f >= sr * 0.45) continue;
    modal.push([f, a, tau]);
    msModal += dampedMeanSquare(a, tau, T);
  }
  const ping: [number, number, number][] = [];
  let msPing = 0;
  if (s.ping && s.pingLevel) {
    const soft = 1 - 0.5 * k.soft;
    for (const [f0, a0, t0] of s.ping) {
      const f = f0 * (1 + 0.004 * (c.rand() - 0.5));
      if (f >= sr * 0.45) continue;
      const a = a0 * soft * (f > 2000 ? Math.pow(bright, Math.log2(f / 2000)) : 1);
      ping.push([f, a, t0 * decay]);
      msPing += dampedMeanSquare(a, t0 * decay, T);
    }
  }
  // 2. wash: noise + square-wave metal (strongest in the attack, fading into
  //    the noise), two-stage envelope, band-limited – generated straight into
  //    the output, then the partials are added on top
  const freqs = METAL_808.map((f) => f * s.metalScale * (1 + 0.02 * (c.rand() - 0.5)));
  metalWash(
    c,
    len,
    (1 - 0.6 * s.metal) / 0.577,
    freqs,
    s.metal / Math.sqrt(METAL_808.length),
    s.washTau * decay * 0.45,
    0.0025 + 0.012 * k.soft,
    s.burstTau * decay,
    s.washTau * decay,
    s.burst / (s.burst + 1),
    out,
  );
  filt(out, sr, [
    ['highpass', s.washHp * (1.15 - 0.3 * v), 0.7],
    ['highpass', s.washHp * 0.8, 0.7],
    ['peaking', s.washPeak, 0.8, 4],
    ['lowpass', Math.min(sr * 0.45, s.washLp * (0.55 + 0.65 * v) * k.cymBright), 0.7],
  ]);
  const wr = rmsRange(out, 0, ref);
  if (wr > 0) scaleInPlace(out, s.wash / wr);
  const bank = new ResonatorBank();
  const gm = msModal > 0 ? s.modal / Math.sqrt(msModal) : 0;
  // (rendered down to ~−55 dB re the hit – inaudible under the wash by then)
  for (const [f, a, tau] of modal) bank.add(f, a * gm, tau, sr, 3e-3);
  const gp = msPing > 0 ? ((s.pingLevel ?? 0) * (0.8 + 0.3 * v)) / Math.sqrt(msPing) : 0;
  for (const [f, a, tau] of ping) bank.add(f, a * gp, tau, sr, 1e-3);
  bank.renderInto(out);
  // 3. stick (or brush) contact
  addNoise(c, 0, s.stick * 3 * (0.3 + 0.7 * v) * (1 - 0.7 * k.soft), 0.0001 + 0.003 * k.soft, 0.0015 + 0.006 * k.soft, [
    ['highpass', 2500, 0.7],
    ['lowpass', 12000, 0.7],
  ]);
  // 4. china "trash"
  if (s.trash > 0) saturate(out, s.trash);
}

// ---------------------------------------------------------------------------
// Latin & orchestral percussion, effects
// ---------------------------------------------------------------------------

/** A short woody/metal knock: modes [freq, amp, τ] + a contact tick. */
function knock(c: Ctx, modes: readonly Mode[], tick: number, tickHz: number, start = 0, gain = 1): void {
  const { v, sr, out } = c;
  const s0 = Math.round(start * sr);
  const bright = 0.5 + 0.8 * v;
  modes.forEach(([f, a, t], i) => {
    const amp = a * gain * (i === 0 ? 1 : bright);
    if (f < sr * 0.45) addDampedSine(out, s0, f * (1 + 0.006 * (c.rand() - 0.5)), amp, t, sr, FLOOR);
  });
  addNoise(c, start, tick * gain * (0.4 + 0.8 * v), 0.00008, 0.0007, [['highpass', tickHz, 0.7], ['lowpass', Math.min(sr * 0.45, 9000 + 7000 * v), 0.7]]);
}

function cowbell(c: Ctx): void {
  const { v, k, sr, out } = c;
  // two detuned square-ish tones (odd harmonics), a fast first decay into a ringing tail
  const bank = new ResonatorBank();
  const base = k.electronic ? [540, 800] : [562, 838];
  for (const f of base) {
    for (const h of [1, 3, 5, 7, 9]) {
      const fh = f * h * (1 + 0.003 * (c.rand() - 0.5));
      if (fh > sr * 0.45) continue;
      const a = (1 / h) * (h > 1 ? 0.6 + 0.6 * v : 1);
      bank.add(fh, a * 0.75, 0.012, sr, FLOOR);
      bank.add(fh * 1.0007, a * 0.25, (k.electronic ? 0.09 : 0.14) / (1 + 0.15 * h), sr, FLOOR);
    }
  }
  bank.renderInto(out);
  filt(out, sr, [['highpass', 380, 0.7], ['peaking', k.electronic ? 2600 : 1600, 0.8, 4], ['lowpass', 5000 + 4000 * v, 0.7]]);
  addNoise(c, 0, 0.25 + 0.3 * v, 0.0001, 0.0009, [['bandpass', 4000, 0.9]]);
}

function agogo(c: Ctx, high: boolean): void {
  const f = high ? 940 : 680;
  knock(
    c,
    [[f, 1, 0.3], [f * 1.96, 0.45, 0.22], [f * 2.89, 0.3, 0.15], [f * 4.03, 0.14, 0.1], [f * 5.3, 0.06, 0.07]],
    0.3,
    3000,
  );
}

function triangle(c: Ctx, open: boolean): void {
  const { v, sr, out } = c;
  const bank = new ResonatorBank();
  const bright = 0.5 + 0.8 * v;
  // in-plane and out-of-plane families of a bent steel bar: nearly harmonic, slightly stretched
  for (const [f0, B] of [[790, 0.0035], [846, 0.0045]] as const) {
    for (let h = 2; h <= 17; h++) {
      const f = f0 * h * (1 + B * h * h) * (1 + 0.004 * (c.rand() - 0.5));
      if (f > Math.min(sr * 0.45, 16000) || f < 1400) continue;
      const oct = Math.log2(f / 5500);
      const a = ((0.6 + 0.8 * c.rand()) / (1 + oct * oct)) * (f > 5500 ? Math.pow(bright, oct) : 1);
      const tau = open ? 1.6 * Math.pow(4000 / f, 0.45) : 0.045;
      bank.add(f, a, tau, sr, FLOOR * 0.2);
    }
  }
  bank.renderInto(out);
  addNoise(c, 0, 0.35 + 0.35 * v, 0.00008, 0.0006, [['highpass', 5000, 0.7]]);
}

/** Beads / seeds in a shell; harder shakes = more collisions and a brighter rattle. */
function shaker(c: Ctx, p: { atk: number; tau: number; rate: number; grain: number; hp: number; bp: number; q: number; gain: number }): void {
  const { out, sr, v } = c;
  const n = out.length;
  const b = collisions(c, n, p.atk, p.tau, p.rate * (0.6 + 0.8 * v), p.grain);
  const tilt = 0.8 + 0.4 * v;
  filt(b, sr, [['highpass', p.hp * tilt, 0.7], ['peaking', p.bp * tilt, p.q, p.gain], ['lowpass', Math.min(sr * 0.45, 7000 + 9000 * v), 0.7]]);
  fadeOut(b, Math.round(0.03 * sr));
  addInto(out, b, 0, 1 / (peakAbs(b) || 1));
}

function tambourine(c: Ctx): void {
  const { out, sr, v } = c;
  const n = out.length;
  const exc = collisions(c, n, 0.0005, 0.03 + 0.015 * v, 1400 + 800 * v, 0.0006);
  // jingle pairs ring at a handful of high, closely spaced frequencies
  const jingles: [number, number, number][] = [];
  for (const f of [3650, 5150, 6120, 7280, 8560, 10100, 11800]) jingles.push([f * (1 + 0.01 * (c.rand() - 0.5)), 0.06 + 0.06 * c.rand(), f > 7000 ? 0.6 + 0.6 * v : 1]);
  const ring = resonate(exc, sr, jingles);
  const rr = peakAbs(ring) || 1;
  filt(exc, sr, [['highpass', 4500, 0.7], ['lowpass', 9000 + 6000 * v, 0.7]]);
  const er = peakAbs(exc) || 1;
  for (let i = 0; i < n; i++) out[i] += ring[i] / rr + (0.6 * exc[i]) / er;
  fadeOut(out, Math.round(0.05 * sr));
}

function sleighBells(c: Ctx): void {
  const { out, sr, v } = c;
  const n = out.length;
  const exc = collisions(c, n, 0.004, 0.06, 900 + 500 * v, 0.0008);
  const bells: [number, number, number][] = [2500, 5300, 6500, 8300, 9800].map((f) => [f * (1 + 0.01 * (c.rand() - 0.5)), 0.12 + 0.08 * c.rand(), f > 6000 ? 0.5 + 0.7 * v : 1]);
  const ring = resonate(exc, sr, bells);
  addInto(out, ring, 0, 1 / (peakAbs(ring) || 1));
  fadeOut(out, Math.round(0.08 * sr));
}

function guiro(c: Ctx, long: boolean): void {
  const { out, sr, v } = c;
  const n = out.length;
  const exc = new Float32Array(n);
  const z = noise(Math.round(0.003 * sr), subSeed(c));
  const ticks = long ? 26 : 7;
  const dur = long ? 0.42 : 0.085;
  const td = Math.exp(-1 / (0.0004 * sr));
  for (let j = 0; j < ticks; j++) {
    const x = j / (ticks - 1);
    // the stroke speeds up then slows (a smooth time warp), loudest in the middle
    const t = dur * (x - (long ? 0.12 : 0.05) * Math.sin(2 * Math.PI * x)) + 0.0015 * (c.rand() - 0.5);
    const a = (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, x * 1.1 + 0.05))) * (0.75 + 0.25 * c.rand());
    const s0 = Math.round(Math.max(0, t) * sr);
    let e = a;
    for (let i = 0; i < z.length && s0 + i < n; i++) {
      exc[s0 + i] += z[i] * e;
      e *= td;
    }
  }
  const body = resonate(exc, sr, [[2650, 0.006, 1], [1250, 0.01, 0.6], [4400, 0.004, 0.5 + 0.5 * v]]);
  const br = peakAbs(body) || 1;
  filt(exc, sr, [['highpass', 2000, 0.7]]);
  const er = peakAbs(exc) || 1;
  for (let i = 0; i < n; i++) out[i] += body[i] / br + (0.4 * exc[i]) / er;
}

/** Oscillator following a per-sample frequency contour, with a little 2nd/3rd harmonic. */
function addContourTone(c: Ctx, freq: Float64Array, env: Float32Array, amp: number, h2: number, h3: number): void {
  const { out, sr } = c;
  const n = Math.min(out.length, freq.length, env.length);
  const k = (2 * Math.PI) / sr;
  let cs = 1;
  let sn = 0;
  for (let i = 0; i < n; i++) {
    out[i] += amp * env[i] * (sn + h2 * 2 * sn * cs + h3 * sn * (3 - 4 * sn * sn));
    const w = k * freq[i];
    const w2 = w * w;
    const cw = 1 - w2 * (0.5 - w2 * (1 / 24 - w2 / 720));
    const sw = w * (1 - w2 * (1 / 6 - w2 * (1 / 120 - w2 / 5040)));
    const nc = cs * cw - sn * sw;
    sn = sn * cw + cs * sw;
    cs = nc;
    if ((i & 255) === 255) {
      const r = 1 / Math.sqrt(cs * cs + sn * sn);
      cs *= r;
      sn *= r;
    }
  }
}

/** Attack / hold / release envelope (raised-cosine edges), length n. */
function arEnv(n: number, sr: number, atk: number, hold: number, rel: number): Float32Array {
  const e = new Float32Array(n);
  const a = Math.max(1, Math.round(atk * sr));
  const h = Math.round(hold * sr);
  const r = Math.max(1, Math.round(rel * sr));
  for (let i = 0; i < n; i++) {
    if (i < a) e[i] = 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
    else if (i < a + h) e[i] = 1;
    else if (i < a + h + r) e[i] = 0.5 + 0.5 * Math.cos((Math.PI * (i - a - h)) / r);
    else break;
  }
  return e;
}

function cuica(c: Ctx, open: boolean): void {
  const { out, sr, v } = c;
  const n = out.length;
  // f(t) = f2 + (f1 − f2)·e^{−t/τd} − (f1 − f0)·e^{−t/τu}: a quick rise then a falling "whoop"
  const [f0, f1, f2, tu, td] = open ? [360, 650, 410, 0.03, 0.13] : [520, 770, 590, 0.012, 0.05];
  const freq = new Float64Array(n);
  const du = Math.exp(-1 / (tu * sr));
  const dd = Math.exp(-1 / (td * sr));
  let eu = 1;
  let ed = 1;
  for (let i = 0; i < n; i++) {
    freq[i] = f2 + (f1 - f2) * ed - (f1 - f0) * eu;
    eu *= du;
    ed *= dd;
  }
  const env = arEnv(n, sr, open ? 0.012 : 0.006, open ? 0.06 : 0.015, open ? 0.2 : 0.07);
  const tone = new Float32Array(n);
  const sub: Ctx = { ...c, out: tone };
  addContourTone(sub, freq, env, 1, 0.45 + 0.2 * v, 0.2 + 0.1 * v);
  filt(tone, sr, [['peaking', 1100, 0.9, 5], ['highpass', 200, 0.7], ['lowpass', 3500 + 2000 * v, 0.7]]);
  addInto(out, tone, 0, 1 / (peakAbs(tone) || 1));
}

function whistle(c: Ctx, long: boolean): void {
  const { out, sr, v } = c;
  const n = out.length;
  const f0 = long ? 2280 : 2360;
  const freq = new Float64Array(n);
  const wr = (2 * Math.PI * 31) / sr;
  // the pea's warble: gentle FM and AM at ~31 Hz
  for (let i = 0; i < n; i++) freq[i] = f0 * (1 + 0.018 * Math.sin(wr * i) + 0.01 * Math.min(1, i / (0.03 * sr)));
  const env = arEnv(n, sr, 0.012, long ? 0.36 : 0.06, long ? 0.08 : 0.05);
  for (let i = 0; i < n; i++) env[i] *= 0.8 + 0.2 * Math.sin(wr * i + 1);
  addContourTone(c, freq, env, 1, 0.06, 0.02);
  // breath
  const b = noise(n, subSeed(c));
  for (let i = 0; i < n; i++) b[i] *= env[i];
  filt(b, sr, [['bandpass', f0, 3], ['highpass', 1500, 0.7]]);
  addInto(out, b, 0, (0.15 + 0.15 * v) / (peakAbs(b) || 1));
}

function vibraslap(c: Ctx): void {
  const { out, sr, v } = c;
  const n = out.length;
  const exc = new Float32Array(n);
  const z = noise(Math.round(0.002 * sr), subSeed(c));
  let t = 0;
  let j = 0;
  while (t < 0.95) {
    const a = Math.exp(-t / 0.28) * (0.7 + 0.3 * c.rand()) * (j === 0 ? 1.3 : 1);
    const s0 = Math.round(t * sr);
    for (let i = 0; i < z.length && s0 + i < n; i++) exc[s0 + i] += z[i] * a * (1 - i / z.length);
    t += 0.031 * (0.85 + 0.3 * c.rand()) * (1 + 0.25 * t);
    j++;
  }
  const rattle = resonate(exc, sr, [[1930, 0.025, 1], [2870, 0.022, 0.8], [4210, 0.018, 0.6 + 0.4 * v], [5640, 0.014, 0.4 + 0.4 * v], [720, 0.012, 0.5]]);
  addInto(out, rattle, 0, 1 / (peakAbs(rattle) || 1));
  fadeOut(out, Math.round(0.1 * sr));
}

function belltree(c: Ctx): void {
  const { out, sr, v } = c;
  const count = 14;
  for (let j = 0; j < count; j++) {
    const x = j / (count - 1);
    const t = 0.55 * Math.pow(x, 0.9);
    const f = 5600 * Math.pow(2300 / 5600, x) * (1 + 0.01 * (c.rand() - 0.5));
    const a = (0.6 + 0.4 * Math.sin(Math.PI * x)) * (0.85 + 0.3 * c.rand());
    const tau = 0.5 * Math.sqrt(3000 / f);
    const s0 = Math.round(t * sr);
    addDampedSine(out, s0, f, a, tau, sr, FLOOR);
    if (f * 2.38 < sr * 0.45) addDampedSine(out, s0, f * 2.38, a * (0.15 + 0.2 * v), tau * 0.35, sr, FLOOR);
  }
}

function scratch(c: Ctx, push: boolean): void {
  const { out, sr, v } = c;
  const n = out.length;
  // record speed r(t): a quick bump forward (push) or a slow pull and quick release
  const T = push ? 0.11 : 0.13;
  const freq = new Float64Array(n);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / sr / T;
    if (x >= 1) break;
    const shape = push ? Math.pow(x, 0.5) * (1 - x) * 2.6 : x * x * (1 - x) * 6.75 * 0.9;
    const r = Math.max(0, shape);
    freq[i] = 120 + 520 * r;
    env[i] = Math.min(1, r * 1.4);
  }
  const tone = new Float32Array(n);
  addContourTone({ ...c, out: tone }, freq, env, 1, 0.5, 0.3);
  const b = noise(n, subSeed(c));
  for (let i = 0; i < n; i++) b[i] *= env[i] * (0.4 + 0.6 * env[i]);
  filt(b, sr, [['bandpass', 1500, 0.8]]);
  const tp = peakAbs(tone) || 1;
  const bp = peakAbs(b) || 1;
  for (let i = 0; i < n; i++) out[i] += tone[i] / tp + ((0.35 + 0.2 * v) * b[i]) / bp;
  filt(out, sr, [['highpass', 150, 0.7], ['lowpass', 4500 + 2500 * v, 0.7]]);
}

function highQ(c: Ctx): void {
  const { v } = c;
  addGlide(c, 0, 1900 * (0.85 + 0.3 * v), 330, 0.014, 1, 0.04, 0.0004);
  addGlide(c, 0, 3800 * (0.85 + 0.3 * v), 660, 0.012, 0.2 * (0.5 + v), 0.025, 0.0004);
}

/** A very short, band-limited square-wave blip (odd harmonics of 1.6 kHz). */
function squareClick(c: Ctx): void {
  const { out, sr, v } = c;
  const f = 1600;
  for (const h of [1, 3, 5, 7]) {
    if (f * h >= sr * 0.45) continue;
    const a = (1 / h) * (h > 1 ? 0.4 + 0.8 * v : 1);
    addDampedSine(out, 0, f * h, a, 0.0016, sr, FLOOR);
    addDampedSine(out, 0, f * h, -a, 0.0002, sr, FLOOR);
  }
}

function metronomeBell(c: Ctx): void {
  const { out, sr, v } = c;
  const f = 1760;
  const modes: Mode[] = [[1, 1, 0.45], [2, 0.3, 0.3], [3, 0.12, 0.2], [4.16, 0.06, 0.12], [5.43, 0.03, 0.07]];
  for (const [r, a, t] of modes) {
    const amp = a * (r > 1 ? 0.5 + 0.8 * v : 1);
    if (f * r < sr * 0.45) {
      addDampedSine(out, 0, f * r, amp, t, sr, FLOOR);
      addDampedSine(out, 0, f * r, -amp, 0.0005, sr, FLOOR);
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatch & render
// ---------------------------------------------------------------------------

function renderVoice(c: Ctx, note: number): void {
  const { k } = c;
  switch (note) {
    case 27: return highQ(c);
    case 28: return clap(c, true);
    case 29: return scratch(c, true);
    case 30: return scratch(c, false);
    case 31: return knock(c, [[2350, 1, 0.012], [3600, 0.7, 0.008], [5200, 0.4, 0.006], [1250, 0.4, 0.01]], 0.5, 3000);
    case 32: return squareClick(c);
    case 33: return knock(c, [[1245, 1, 0.02], [2938, 0.42, 0.008], [4855, 0.12, 0.004]], 0.35, 3500);
    case 34: return metronomeBell(c);
    case 35: return kick(c, true);
    case 36: return kick(c, false);
    case 37: return sideStick(c);
    case 38: return snare(c, false);
    case 39: return clap(c, false);
    case 40: return snare(c, true);
    case 42: return hat(c, 'closed');
    case 44: return hat(c, 'pedal');
    case 46: return hat(c, 'open');
    case 41: case 43: case 45: case 47: case 48: case 50: return tom(c, note);
    case 49: return cymbal(c, k.electronic ? E_CRASH : CRASH1);
    case 57: return cymbal(c, k.electronic ? E_CRASH : CRASH2);
    case 51: return cymbal(c, k.electronic ? E_RIDE : RIDE1);
    case 59: return cymbal(c, k.electronic ? E_RIDE : RIDE2);
    case 53: return cymbal(c, RIDE_BELL);
    case 52: return cymbal(c, CHINA);
    case 55: return cymbal(c, SPLASH);
    case 54: return tambourine(c);
    case 56: return cowbell(c);
    case 58: return vibraslap(c);
    case 60: case 61: case 62: case 63: case 64: case 65: case 66: case 86: case 87:
      return handDrum(c, HAND_DRUMS[note]);
    case 67: return agogo(c, true);
    case 68: return agogo(c, false);
    case 69: return shaker(c, { atk: 0.01, tau: 0.055, rate: 9000, grain: 0.0004, hp: 4000, bp: 7000, q: 0.9, gain: 4 });
    case 70: return shaker(c, { atk: 0.005, tau: 0.03, rate: 2500, grain: 0.0007, hp: 2800, bp: 5500, q: 1.2, gain: 8 });
    case 82: return shaker(c, { atk: 0.018, tau: 0.065, rate: 4000, grain: 0.0006, hp: 2200, bp: 6000, q: 1, gain: 5 });
    case 71: return whistle(c, false);
    case 72: return whistle(c, true);
    case 73: return guiro(c, false);
    case 74: return guiro(c, true);
    case 75: return knock(c, k.electronic ? [[2500, 1, 0.03]] : [[2480, 1, 0.065], [2480 * 2.756, 0.12, 0.012], [2480 * 5.4, 0.04, 0.005]], 0.25, 4000);
    case 76: return knock(c, [[1180, 1, 0.045], [1180 * 2.32, 0.25, 0.015], [1180 * 3.9, 0.12, 0.008]], 0.3, 3000);
    case 77: return knock(c, [[840, 1, 0.05], [840 * 2.32, 0.25, 0.016], [840 * 3.9, 0.12, 0.009]], 0.3, 2500);
    case 78: return cuica(c, false);
    case 79: return cuica(c, true);
    case 80: return triangle(c, false);
    case 81: return triangle(c, true);
    case 83: return sleighBells(c);
    case 84: return belltree(c);
    case 85: {
      const m: Mode[] = [[1650, 1, 0.012], [2900, 0.6, 0.007], [4300, 0.3, 0.004]];
      knock(c, m, 0.4, 3000, 0, 0.7);
      return knock(c, m, 0.4, 3000, 0.016, 1);
    }
  }
}

/**
 * Render one drum hit (mono, deterministic). velocity 0..1 changes timbre
 * (harder = brighter, more attack) as well as level: the result peaks at
 * DRUM_PEAK · drumVelocityLevel(velocity). Notes outside DRUM_NOTES render silence.
 */
export function renderDrumSamples(
  note: number,
  velocity: number,
  sampleRate: number,
  opts: { kit?: DrumKit; out?: Float32Array; seed?: number } = {},
): Float32Array {
  const n = Math.round(note);
  const kitName: DrumKit = opts.kit && KITS[opts.kit] ? opts.kit : 'standard';
  const k = KITS[kitName];
  const v = clamp(Number.isFinite(velocity) ? velocity : 0, 0, 1);
  const sr = sampleRate;
  const out: Float32Array = opts.out ?? new Float32Array(drumNoteLength(n, sr, kitName));
  if (opts.out) out.fill(0);
  if (!NOTES[n] || out.length < 16) return out;
  const c: Ctx = { out, sr, v, k, rand: mulberry32(opts.seed ?? n * 7919 + 17) };

  renderVoice(c, n);

  if (k.room > 0) addRoom(out, sr, k.room, k.roomRt, k.roomSize);
  // gentle edges: no DC step at the start, no truncation click at the end
  fadeIn(out, Math.max(2, Math.round(0.00008 * sr)));
  fadeOut(out, Math.round(Math.min(0.25 * out.length, 0.4 * sr)));

  const pk = peakAbs(out);
  if (pk > 0) scaleInPlace(out, (DRUM_PEAK * drumVelocityLevel(v)) / pk);
  return out;
}
