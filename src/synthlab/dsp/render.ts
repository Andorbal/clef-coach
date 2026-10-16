/**
 * Offline rendering: a patch playing a short phrase, as samples. Behind "play the
 * target", the sound matcher, the hint search, the lesson tests and the drawings.
 *
 * Renders are deterministic (same patch, same phrase → the same samples), because
 * SynthCore seeds its noise, its unison phases and its random LFO from a fixed seed.
 */
import { SynthCore } from './core';
import { releaseTail } from './env';
import { type Patch, divisionSeconds } from './params';

export interface PhraseNote {
  midi: number;
  /** Seconds from the start. */
  start: number;
  /** Seconds held. */
  dur: number;
  vel?: number;
}

export interface Phrase {
  notes: PhraseNote[];
  /** Total seconds rendered (the tail is cut here). */
  length: number;
}

export type PhraseId = 'note' | 'low' | 'high' | 'long' | 'short' | 'notes' | 'chord' | 'legato' | 'riff' | 'arp';

/**
 * The phrases lessons play: one held note (most quizzes), short repeated notes (plucks,
 * envelopes), a chord, a legato line (glide), a bass riff, an arpeggio (delay, sequences).
 * Lengths leave room for a release; renderFor extends them for long tails.
 */
export function phrase(id: PhraseId, root = 48): Phrase {
  const n = (midi: number, start: number, dur: number): PhraseNote => ({ midi, start, dur, vel: 0.8 });
  switch (id) {
    case 'note':
      return { notes: [n(root, 0, 1)], length: 1.8 };
    case 'low':
      return { notes: [n(root - 12, 0, 1)], length: 1.8 };
    case 'high':
      return { notes: [n(root + 12, 0, 1)], length: 1.8 };
    case 'long':
      return { notes: [n(root, 0, 2.4)], length: 3.2 };
    case 'short':
      return { notes: [n(root, 0, 0.25)], length: 1.4 };
    case 'notes':
      return { notes: [n(root, 0, 0.3), n(root + 7, 0.5, 0.3), n(root + 12, 1, 0.3)], length: 2.2 };
    case 'chord':
      return { notes: [n(root, 0, 1.4), n(root + 4, 0, 1.4), n(root + 7, 0, 1.4)], length: 2.4 };
    case 'legato':
      return { notes: [n(root, 0, 0.6), n(root + 7, 0.5, 0.6), n(root + 12, 1, 0.7)], length: 2.4 };
    case 'riff':
      return {
        notes: [n(root - 12, 0, 0.2), n(root - 12, 0.25, 0.2), n(root, 0.5, 0.2), n(root - 12, 0.75, 0.2), n(root + 3, 1, 0.2), n(root - 12, 1.25, 0.2), n(root + 5, 1.5, 0.4)],
        length: 2.6,
      };
    case 'arp':
      return { notes: [n(root, 0, 0.2), n(root + 4, 0.25, 0.2), n(root + 7, 0.5, 0.2), n(root + 12, 0.75, 0.2)], length: 2.4 };
  }
}

/** How long a phrase has to run for a patch's tail (release, delay, reverb) to finish, capped. */
export function renderLength(p: Patch, ph: Phrase, cap = 4.5): number {
  const lastOff = Math.max(...ph.notes.map(x => x.start + x.dur));
  let tail = Math.min(2.5, releaseTail(p.ampRelease) * 0.6);
  if (p.delayMix > 0) tail = Math.max(tail, divisionSeconds(p.delayDiv) * 4);
  if (p.reverbMix > 0) tail = Math.max(tail, 0.5 + 2 * p.reverbSize);
  return Math.min(cap, Math.max(ph.length, lastOff + tail));
}

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

/** Render a phrase (`length` seconds, default: the phrase's own). */
export function renderPhrase(p: Patch, ph: Phrase, sampleRate: number, length = ph.length): Rendered {
  const total = Math.max(1, Math.round(length * sampleRate));
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const core = new SynthCore(sampleRate, 12345);
  core.setPatch(p);
  type Ev = { at: number; on: boolean; midi: number; vel: number };
  const events: Ev[] = [];
  for (const x of ph.notes) {
    events.push({ at: Math.round(x.start * sampleRate), on: true, midi: x.midi, vel: x.vel ?? 0.8 });
    events.push({ at: Math.round((x.start + x.dur) * sampleRate), on: false, midi: x.midi, vel: 0 });
  }
  // offs before ons at the same instant, so a repeated key restarts cleanly
  events.sort((a, b) => a.at - b.at || Number(a.on) - Number(b.on));
  let pos = 0;
  for (const e of events) {
    const at = Math.min(total, e.at);
    if (at > pos) {
      core.render(left, right, at - pos, pos);
      pos = at;
    }
    if (e.on) core.noteOn(e.midi, e.vel);
    else core.noteOff(e.midi);
  }
  if (pos < total) core.render(left, right, total - pos, pos);
  return { left, right, sampleRate };
}

/** Mono mix of a render. */
export function mono(r: Rendered): Float32Array {
  const out = new Float32Array(r.left.length);
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * (r.left[i] + r.right[i]);
  return out;
}
