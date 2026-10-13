import type { FingeringMode } from '../curriculum/types';
import { STANDARD_TUNING } from '../music/guitar';
import { familyOf } from '../music/instruments';
import { diatonicIndex, midiOf } from '../music/pitch';
import type { NoteEl, Score } from '../music/score';

/**
 * Return a copy of the score with fingering thinned out:
 *  'all'   – every finger / mallet shown
 *  'first' – only where the hand position changes (first note, crossings, shifts);
 *            for mallets, where the sticking stops simply alternating
 *  'none'  – no fingering
 */
export function applyFingeringMode(score: Score, mode: FingeringMode): Score {
  if (mode === 'all') return score;
  const copy: Score = structuredClone(score);
  const family = familyOf(copy.instrument);
  const tuning = copy.tuning ?? STANDARD_TUNING;
  copy.staves.forEach(st =>
    st.voices.forEach(v => {
      let prev: NoteEl | null = null;
      let prevPrev: NoteEl | null = null;
      for (const n of v.notes) {
        if (n.rest || n.tiePrev) {
          if (n.tiePrev) n.fingers = undefined;
          if (n.rest) {
            // a rest restarts the sticking pattern
            prev = null;
            prevPrev = null;
          }
          continue;
        }
        if (mode === 'none') {
          n.fingers = undefined;
          continue;
        }
        const orig: NoteEl = { ...n };
        const keep =
          family === 'mallet'
            ? !prev || stickingBreaks(prevPrev, prev, n)
            : !prev || positionChanged(prev, n, family === 'fretted', st.hand ?? 'R', tuning, copy.instrument === 'bass');
        if (!keep) n.fingers = undefined;
        prevPrev = prev;
        prev = orig;
      }
      // keep string numbers only where fingers remain (fretted)
      if (family === 'fretted') v.notes.forEach(n => {
        if (!n.fingers) n.strings = mode === 'none' ? undefined : n.strings;
      });
    }),
  );
  return copy;
}

const handOfMallets = (n: NoteEl) => (n.fingers ?? []).map(f => (f === undefined ? '' : f <= 2 ? 'L' : 'R')).join('');

/** Two-mallet lines: show the sticking where it doesn't just alternate (doubles, chords, after a chord). */
function stickingBreaks(pp: NoteEl | null, p: NoteEl, n: NoteEl): boolean {
  const a = handOfMallets(p);
  const b = handOfMallets(n);
  if (a.length !== 1 || b.length !== 1) return true;
  if (a === b) return true;
  if (pp && handOfMallets(pp).length !== 1) return true;
  return false;
}

/** Index-finger fret for a fretted note (bass: Simandl 1-2-4 in the low positions). */
function indexFret(fret: number, finger: number, simandl: boolean): number {
  if (simandl && finger === 4 && fret - 2 < 7) return fret - 2;
  return fret - finger + 1;
}

function positionChanged(a: NoteEl, b: NoteEl, fretted: boolean, hand: 'R' | 'L', tuning: readonly number[], simandl = false): boolean {
  const fa = a.fingers?.[a.fingers.length - 1];
  const fb = b.fingers?.[b.fingers.length - 1];
  if (fa === undefined || fb === undefined) return true;
  if (fretted) {
    const sa = a.strings?.[a.strings.length - 1];
    const sb = b.strings?.[b.strings.length - 1];
    if (fb === 0) return false;
    if (sa === undefined || sb === undefined) return true;
    // hand position = the index finger's fret
    const pa = fa === 0 ? null : indexFret(midiOf(a.pitches[a.pitches.length - 1]) - tuning[sa - 1], fa, simandl);
    const pb = indexFret(midiOf(b.pitches[b.pitches.length - 1]) - tuning[sb - 1], fb, simandl);
    return pa === null ? false : pa !== pb;
  }
  const da = diatonicIndex(a.pitches[a.pitches.length - 1]);
  const db = diatonicIndex(b.pitches[b.pitches.length - 1]);
  // In a fixed five-finger position, the finger difference equals the diatonic distance
  const df = hand === 'R' ? fb - fa : fa - fb;
  return df !== db - da;
}
