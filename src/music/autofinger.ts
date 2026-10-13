import { fingerPianoLine } from './fingering';
import { type FingerSystem, fingerGuitarLine } from './guitar';
import { type InstrumentPrefs, familyOf, tuningFor } from './instruments';
import { midiOf } from './pitch';
import type { Score } from './score';
import { stickLine } from './sticking';

export interface AutoFingerOptions extends InstrumentPrefs {
  /** Fretted: preferred hand position (index-finger fret). */
  guitarPosition?: number;
  maxFret?: number;
  /** Fretted: override the tuning (open-string MIDI notes, string 1 first). */
  tuning?: number[];
}

/**
 * Fill in missing fingering throughout a score (in place) and return it.
 *  Piano:   finger numbers per hand.
 *  Fretted: string + left-hand finger (guitar, ukulele, bass – any tuning).
 *  Mallets: mallet sticking (L/R, or 1–4 with four mallets).
 */
export function autoFinger(score: Score, opts: AutoFingerOptions = {}): Score {
  const family = familyOf(score.instrument);
  if (family === 'fretted') {
    score.tuning = opts.tuning ?? score.tuning ?? tuningFor(score.instrument, opts).open;
  }
  if (family === 'mallet') score.mallets = score.mallets ?? 2;
  const fingerSystem: FingerSystem = score.instrument === 'bass' ? 'simandl' : 'one-per-fret';
  score.staves.forEach((staff, si) => {
    staff.voices.forEach(voice => {
      const notes = voice.notes.filter(n => !n.rest && !n.tiePrev);
      if (!notes.length) return;
      if (family === 'keyboard') {
        const hand = staff.hand ?? (si === 0 && score.staves.length > 1 ? 'R' : staff.clef === 'bass' ? 'L' : 'R');
        const complete = notes.every(n => n.fingers && n.fingers.every(f => f !== undefined));
        if (complete) return;
        const res = fingerPianoLine(
          notes.map(n => ({ midis: n.pitches.map(midiOf), fixed: n.fingers })),
          hand,
        );
        notes.forEach((n, i) => (n.fingers = res[i]));
      } else if (family === 'mallet') {
        const complete = notes.every(n => n.fingers && n.fingers.every(f => f !== undefined));
        if (complete) return;
        // a hand is only fixed when the part is split across staves
        const hand = score.staves.length > 1 ? staff.hand : undefined;
        const res = stickLine(
          notes.map((n, i) => ({ midis: n.pitches.map(midiOf), fixed: n.fingers, gap: (notes[i + 1]?.tick ?? n.tick + n.ticks) - n.tick })),
          { mallets: score.mallets ?? 2, hand },
        );
        notes.forEach((n, i) => (n.fingers = res[i]));
      } else {
        const complete = notes.every(n => n.strings && n.strings.every(s => s !== undefined) && n.fingers && n.fingers.every(f => f !== undefined));
        if (complete) return;
        const res = fingerGuitarLine(
          notes.map(n => ({ midis: n.pitches.map(midiOf), strings: n.strings })),
          { preferPosition: opts.guitarPosition ?? 1, maxFret: opts.maxFret ?? 15, tuning: score.tuning, fingerSystem },
        );
        notes.forEach((n, i) => {
          n.strings = res[i].map(r => r.string);
          n.fingers = n.fingers && n.fingers.every(f => f !== undefined) ? n.fingers : res[i].map(r => r.finger);
        });
      }
      // tied continuations inherit fingering
      for (let i = 1; i < voice.notes.length; i++) {
        const n = voice.notes[i];
        if (n.tiePrev) {
          n.fingers = voice.notes[i - 1].fingers;
          n.strings = voice.notes[i - 1].strings;
        }
      }
    });
  });
  return score;
}
