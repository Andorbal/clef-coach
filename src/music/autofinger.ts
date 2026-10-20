import { fingerPianoLine } from './fingering';
import { type FingerSystem, fingerFor, fingerGuitarLine } from './guitar';
import { type InstrumentId, type InstrumentPrefs, familyOf, instrumentDef, tuningFor } from './instruments';
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

/** How a fretted instrument's left hand covers the neck (see FingerSystem). */
export function fingerSystemFor(instrument: InstrumentId): FingerSystem {
  const bowed = instrumentDef(instrument).bowed;
  if (bowed) return bowed.fingers;
  return instrument === 'bass' ? 'simandl' : 'one-per-fret';
}

/**
 * The hand position (index-finger fret) fingering assumes when a lesson names none: first
 * position. On a guitar the index finger plays fret 1; on a violin, viola or cello it sits
 * a tone above the open string; a double bass starts in half position.
 */
export function defaultPosition(instrument: InstrumentId): number {
  return instrumentDef(instrument).bowed?.firstPosition ?? 1;
}

/** The finger for a fret in the instrument's first position (a violin's 2nd fret is its 1st finger). */
export function firstPositionFinger(instrument: InstrumentId, fret: number): number {
  return fingerFor(fingerSystemFor(instrument), defaultPosition(instrument), fret);
}

/**
 * Options for fingering music in one hand position: the position (or the instrument's
 * first) and the highest fret the hand reaches from it without shifting. A violinist's 4th
 * finger lies five semitones above the 1st; a cellist reaches four with an extension.
 */
export function positionWindow(instrument: InstrumentId, position?: number): { guitarPosition: number; maxFret: number } {
  const pos = position ?? defaultPosition(instrument);
  const bowed = instrumentDef(instrument).bowed;
  if (!bowed) return { guitarPosition: pos, maxFret: Math.max(5, pos + 4) };
  const reach = bowed.fingers === 'violin' ? 5 : bowed.fingers === 'one-per-fret' ? 4 : 3;
  return { guitarPosition: pos, maxFret: pos + reach };
}

/**
 * Fill in missing fingering throughout a score (in place) and return it.
 *  Piano:   finger numbers per hand.
 *  Fretted: string + left-hand finger (guitar, ukulele, bass – any tuning – and the
 *           violin family, in its own finger systems).
 *  Mallets: mallet sticking (L/R, or 1–4 with four mallets).
 */
export function autoFinger(score: Score, opts: AutoFingerOptions = {}): Score {
  const family = familyOf(score.instrument);
  if (family === 'fretted') {
    score.tuning = opts.tuning ?? score.tuning ?? tuningFor(score.instrument, opts).open;
  }
  if (family === 'mallet') score.mallets = score.mallets ?? 2;
  const fingerSystem = fingerSystemFor(score.instrument);
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
          { preferPosition: opts.guitarPosition ?? defaultPosition(score.instrument), maxFret: opts.maxFret ?? 15, tuning: score.tuning, fingerSystem },
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
