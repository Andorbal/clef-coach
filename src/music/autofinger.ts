import { fingerPianoLine } from './fingering';
import { fingerGuitarLine } from './guitar';
import { midiOf } from './pitch';
import type { Score } from './score';

/**
 * Fill in missing fingering throughout a score (in place) and return it.
 * Piano: finger numbers per hand. Guitar: string + left-hand finger.
 */
export function autoFinger(score: Score, opts: { guitarPosition?: number; maxFret?: number } = {}): Score {
  score.staves.forEach((staff, si) => {
    staff.voices.forEach(voice => {
      const notes = voice.notes.filter(n => !n.rest && !n.tiePrev);
      if (!notes.length) return;
      if (score.instrument === 'piano') {
        const hand = staff.hand ?? (si === 0 && score.staves.length > 1 ? 'R' : staff.clef === 'bass' ? 'L' : 'R');
        const complete = notes.every(n => n.fingers && n.fingers.every(f => f !== undefined));
        if (complete) return;
        const res = fingerPianoLine(
          notes.map(n => ({ midis: n.pitches.map(midiOf), fixed: n.fingers })),
          hand,
        );
        notes.forEach((n, i) => (n.fingers = res[i]));
      } else {
        const complete = notes.every(n => n.strings && n.strings.every(s => s !== undefined) && n.fingers && n.fingers.every(f => f !== undefined));
        if (complete) return;
        const res = fingerGuitarLine(
          notes.map(n => ({ midis: n.pitches.map(midiOf), strings: n.strings })),
          { preferPosition: opts.guitarPosition ?? 1, maxFret: opts.maxFret ?? 15 },
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
