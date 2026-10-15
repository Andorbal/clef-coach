import type { FingeringMode } from '../curriculum/types';
import { familyOf, tuningFor } from '../music/instruments';
import { diatonicIndex, midiOf } from '../music/pitch';
import type { NoteEl, Score } from '../music/score';

/**
 * Return a copy of the score with fingering thinned out:
 *  'all'   – every finger / mallet shown
 *  'first' – only where the hand position changes (first note, crossings, shifts);
 *            for mallets, where the sticking stops simply alternating
 *  'none'  – no fingering
 * Unless 'none', the notes where the hand moves are marked too (see markHandShifts).
 */
export function applyFingeringMode(score: Score, mode: FingeringMode): Score {
  if (mode === 'all') return markHandShifts(score);
  const copy: Score = mode === 'none' ? structuredClone(score) : markHandShifts(score, true);
  const family = familyOf(copy.instrument);
  const tuning = copy.tuning ?? tuningFor(copy.instrument).open;
  copy.staves.forEach(st =>
    st.voices.forEach(v => {
      const simandl = isSimandl(copy, v.notes);
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
            : !prev || !!n.shift || positionChanged(prev, n, family === 'fretted', st.hand ?? 'R', tuning, simandl);
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

/** Bass fingered Simandl style (1-2-4 in the low positions): no third finger anywhere. */
function isSimandl(score: Score, notes: NoteEl[]): boolean {
  return score.instrument === 'bass' && !notes.some(n => n.fingers?.includes(3));
}

/** Index-finger fret for a fretted note (bass: Simandl 1-2-4 in the low positions). */
function indexFret(fret: number, finger: number, simandl: boolean): number {
  if (simandl && finger === 4 && fret - 2 < 7) return fret - 2;
  return fret - finger + 1;
}

/**
 * Where the hand is for a note (its top note): piano – the white key under the thumb in a
 * five-finger position (each finger has its own white key); fretted – the index finger's
 * fret. Higher numbers are higher up. null without a finger, on an open string, or on a
 * string the tuning doesn't have.
 */
function handPosition(n: NoteEl, fretted: boolean, hand: 'R' | 'L', tuning: readonly number[], simandl: boolean): number | null {
  const f = n.fingers?.[n.fingers.length - 1];
  const p = n.pitches[n.pitches.length - 1];
  if (f === undefined || !p) return null;
  if (fretted) {
    const s = n.strings?.[n.strings.length - 1];
    const fret = s === undefined || tuning[s - 1] === undefined ? -1 : midiOf(p) - tuning[s - 1];
    if (f === 0 || fret < 0) return null;
    return indexFret(fret, f, simandl);
  }
  return hand === 'R' ? diatonicIndex(p) - (f - 1) : diatonicIndex(p) + (f - 1);
}

function positionChanged(a: NoteEl, b: NoteEl, fretted: boolean, hand: 'R' | 'L', tuning: readonly number[], simandl = false): boolean {
  const fa = a.fingers?.[a.fingers.length - 1];
  const fb = b.fingers?.[b.fingers.length - 1];
  if (fa === undefined || fb === undefined) return true;
  if (fretted) {
    if (fb === 0) return false;
    if (a.strings?.[a.strings.length - 1] === undefined || b.strings?.[b.strings.length - 1] === undefined) return true;
    if (fa === 0) return false;
  }
  return handPosition(a, fretted, hand, tuning, simandl) !== handPosition(b, fretted, hand, tuning, simandl);
}

/** A move the hand made this many notes ago or less isn't marked again. */
const REPEAT_WINDOW = 4;

/**
 * Mark the notes where the hand has to move to a new position (NoteEl.shift: 1 up, -1
 * down), so the music can say so next to the finger. Read from the fingering: piano
 * five-finger positions, the fretting hand's position. Each voice is followed on its own,
 * across rests; notes without a finger and open strings leave the hand where it is, and a
 * move repeated within a few notes (a figure) isn't marked again. Mallets have no
 * positions to follow. Returns the score itself when nothing moves, unless `copy`.
 */
export function markHandShifts(score: Score, copy = false): Score {
  const family = familyOf(score.instrument);
  const shifts = new Map<string, 1 | -1>();
  if (family === 'keyboard' || family === 'fretted') {
    const tuning = score.tuning ?? tuningFor(score.instrument).open;
    for (const st of score.staves) {
      for (const v of st.voices) {
        let at: number | null = null;
        let i = 0;
        // a figure that repeats (an arpeggio, a broken chord) shows its moves the first time only
        const lastMove = new Map<string, number>();
        const simandl = isSimandl(score, v.notes);
        for (const n of v.notes) {
          if (n.rest || n.tiePrev) continue;
          const pos = handPosition(n, family === 'fretted', st.hand ?? 'R', tuning, simandl);
          if (pos === null) continue;
          i++;
          if (at !== null && pos !== at) {
            const move = `${at}>${pos}:${n.pitches.map(midiOf).join(',')}:${n.fingers?.join(',')}`;
            const seen = lastMove.get(move);
            if (seen === undefined || i - seen > REPEAT_WINDOW) shifts.set(n.id, pos > at ? 1 : -1);
            lastMove.set(move, i);
          }
          at = pos;
        }
      }
    }
  }
  if (!shifts.size && !copy) return score;
  const out: Score = structuredClone(score);
  for (const st of out.staves) for (const v of st.voices) for (const n of v.notes) {
    const s = shifts.get(n.id);
    if (s) n.shift = s;
    else delete n.shift;
  }
  return out;
}
