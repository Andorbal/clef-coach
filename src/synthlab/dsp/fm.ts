/**
 * FM synthesis: four sine-wave "operators". An operator can be heard (a carrier) or can
 * wobble another operator's phase so fast that the wobble becomes new harmonics (a
 * modulator). Which operator feeds which is the "algorithm", as on Yamaha's DX and TX
 * synths, FL Studio's Sytrus and Toxic Biohazard.
 *
 * This is phase modulation, like the DX7: a modulator's output is added to its target's
 * phase. A modulator's level is its modulation index, so turning it up brightens the
 * carrier, and its envelope makes the brightness change over the note: the heart of FM
 * electric pianos, bells and basses.
 */

export interface Algorithm {
  /** As drawn and spoken: "2 → 1". */
  name: string;
  /** Operators heard (1-based). */
  carriers: number[];
  /** [from, to]: `from` modulates `to`. A modulator's number is always higher than its target's. */
  links: [number, number][];
  /** Operator that feeds back into itself. */
  feedback: number;
  /** Operators that sound or modulate (unused ones are skipped). */
  used: number[];
  /** What it's good for, for the algorithm picker. */
  hint: string;
}

export const ALGORITHMS: readonly Algorithm[] = [
  { name: '2 → 1', carriers: [1], links: [[2, 1]], feedback: 2, used: [1, 2], hint: 'One modulator, one carrier: the classic pair.' },
  { name: '3 → 2 → 1', carriers: [1], links: [[3, 2], [2, 1]], feedback: 3, used: [1, 2, 3], hint: 'A stack of three: richer, more complex tones.' },
  { name: '4 → 3 → 2 → 1', carriers: [1], links: [[4, 3], [3, 2], [2, 1]], feedback: 4, used: [1, 2, 3, 4], hint: 'The tallest stack: harsh, metallic, wild.' },
  { name: '2 → 1 + 4 → 3', carriers: [1, 3], links: [[2, 1], [4, 3]], feedback: 4, used: [1, 2, 3, 4], hint: 'Two pairs side by side: the electric piano layout.' },
  { name: '(2 + 3) → 1', carriers: [1], links: [[2, 1], [3, 1]], feedback: 3, used: [1, 2, 3], hint: 'Two modulators on one carrier: two kinds of brightness.' },
  { name: '4 → (1, 2, 3)', carriers: [1, 2, 3], links: [[4, 1], [4, 2], [4, 3]], feedback: 4, used: [1, 2, 3, 4], hint: 'One modulator shared by three carriers: brass and organs.' },
  { name: '2 → 1 + 3 + 4', carriers: [1, 3, 4], links: [[2, 1]], feedback: 2, used: [1, 2, 3, 4], hint: 'A pair plus two plain sines: a tone with extra body.' },
  { name: '1 + 2 + 3 + 4', carriers: [1, 2, 3, 4], links: [], feedback: 4, used: [1, 2, 3, 4], hint: 'Four sines added: additive synthesis, like drawbars.' },
];

/**
 * A modulator's level (0..1) → its modulation index, in cycles of phase (7.5 radians at
 * full). Squared, so the middle of the knob covers the musical range (an index of about
 * 0.5 to 4) where FM tones change quickly, and the top end is there for harshness.
 */
export function modIndex(level: number): number {
  return level * level * 1.2;
}

/** Full feedback, in cycles of phase: enough to turn a sine into a buzzy saw, not into noise. */
export const FEEDBACK_MAX = 0.24;

/** Is operator `op` (1-based) a carrier in algorithm `algo`? */
export function isCarrier(algo: number, op: number): boolean {
  return ALGORITHMS[clampAlgo(algo)].carriers.includes(op);
}

export function clampAlgo(algo: number): number {
  return Math.min(ALGORITHMS.length - 1, Math.max(0, Math.round(algo)));
}
