import type { FingeringMode } from '../curriculum/types';
import { diatonicIndex, midiOf } from '../music/pitch';
import type { NoteEl, Score } from '../music/score';

/**
 * Return a copy of the score with fingering thinned out:
 *  'all'   – every finger shown
 *  'first' – only where the hand position changes (first note, crossings, shifts)
 *  'none'  – no fingering
 */
export function applyFingeringMode(score: Score, mode: FingeringMode): Score {
  if (mode === 'all') return score;
  const copy: Score = structuredClone(score);
  copy.staves.forEach(st =>
    st.voices.forEach(v => {
      let prev: NoteEl | null = null;
      for (const n of v.notes) {
        if (n.rest || n.tiePrev) {
          if (n.tiePrev) n.fingers = undefined;
          continue;
        }
        if (mode === 'none') {
          n.fingers = undefined;
          continue;
        }
        const orig: NoteEl = { ...n };
        const keep = !prev || positionChanged(prev, n, copy.instrument, st.hand ?? 'R');
        if (!keep) n.fingers = undefined;
        prev = orig;
      }
      // keep string numbers only where fingers remain (guitar)
      if (copy.instrument === 'guitar') v.notes.forEach(n => {
        if (!n.fingers) n.strings = mode === 'none' ? undefined : n.strings;
      });
    }),
  );
  return copy;
}

function positionChanged(a: NoteEl, b: NoteEl, instrument: 'piano' | 'guitar', hand: 'R' | 'L'): boolean {
  const fa = a.fingers?.[a.fingers.length - 1];
  const fb = b.fingers?.[b.fingers.length - 1];
  if (fa === undefined || fb === undefined) return true;
  if (instrument === 'guitar') {
    const sa = a.strings?.[a.strings.length - 1];
    const sb = b.strings?.[b.strings.length - 1];
    if (fb === 0) return false;
    if (sa === undefined || sb === undefined) return true;
    // hand position = fret - finger
    const pa = fa === 0 ? null : midiOf(a.pitches[a.pitches.length - 1]) - [64, 59, 55, 50, 45, 40][sa - 1] - fa;
    const pb = midiOf(b.pitches[b.pitches.length - 1]) - [64, 59, 55, 50, 45, 40][sb - 1] - fb;
    return pa === null ? false : pa !== pb;
  }
  const da = diatonicIndex(a.pitches[a.pitches.length - 1]);
  const db = diatonicIndex(b.pitches[b.pitches.length - 1]);
  // In a fixed five-finger position, the finger difference equals the diatonic distance
  const df = hand === 'R' ? fb - fa : fa - fb;
  return df !== db - da;
}
