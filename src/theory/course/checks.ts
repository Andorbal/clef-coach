/**
 * Does what's being played answer a task? Pure, so the course test can prove every task
 * and every "play it" round can be answered (with the round's own answer).
 *
 * A check sees what is held right now and the notes struck since the task began (newest
 * last). Note names without an octave match in any octave.
 */
import type { KeySig } from '../../music/keys';
import { STEP_SEMIS, type Step, midiOf, parsePitch, pitchClass } from '../../music/pitch';
import { identifyChord, scaleNotes } from '../theory';
import type { Check } from './types';

export interface PlayState {
  /** MIDI notes held down now. */
  held: number[];
  /** Notes struck, oldest first. */
  struck: number[];
}

const NOTE_RE = /^([A-G])(##|bb|#|b)?(-?\d)?$/;

interface NoteSpec {
  pc: number;
  midi?: number;
}

/** "E" → any E; "E4" → that E. */
export function parseNoteSpec(s: string): NoteSpec {
  const m = NOTE_RE.exec(s.trim());
  if (!m) throw new Error(`Not a note: "${s}"`);
  const alter = m[2] === '#' ? 1 : m[2] === '##' ? 2 : m[2] === 'b' ? -1 : m[2] === 'bb' ? -2 : 0;
  const pc = (((STEP_SEMIS[m[1] as Step] + alter) % 12) + 12) % 12;
  return m[3] === undefined ? { pc } : { pc, midi: midiOf(parsePitch(s)) };
}

const matches = (spec: NoteSpec, midi: number) => (spec.midi !== undefined ? spec.midi === midi : spec.pc === pitchClass(midi));

function lastN(state: PlayState, n: number): number[] | null {
  return state.struck.length >= n ? state.struck.slice(-n) : null;
}

export function checkPlayed(check: Check, state: PlayState, key?: KeySig): boolean {
  const held = [...new Set(state.held)].sort((a, b) => a - b);
  switch (check.kind) {
    case 'any':
      return state.struck.length >= (check.count ?? 1);
    case 'note': {
      const last = state.struck[state.struck.length - 1];
      return last !== undefined && matches(parseNoteSpec(check.note), last);
    }
    case 'notes': {
      const specs = check.notes.map(parseNoteSpec);
      if (check.inOrder) {
        const seq = lastN(state, specs.length);
        return !!seq && specs.every((sp, i) => matches(sp, seq[i]));
      }
      if (!held.length) return false;
      // every held note is wanted, and every wanted note is held
      return held.every(m => specs.some(sp => matches(sp, m))) && specs.every(sp => held.some(m => matches(sp, m)));
    }
    case 'interval': {
      let lo: number, hi: number, first: number;
      if (check.together) {
        if (held.length !== 2) return false;
        [lo, hi] = held;
        first = lo;
      } else {
        const two = lastN(state, 2);
        if (!two) return false;
        if (check.up && two[1] <= two[0]) return false;
        if (check.down && two[1] >= two[0]) return false;
        first = two[0];
        [lo, hi] = two[0] < two[1] ? two : [two[1], two[0]];
      }
      const diff = hi - lo;
      if (!check.compound && diff > 12) return false;
      if (!check.semitones.includes(diff)) return false;
      return !check.from || matches(parseNoteSpec(check.from), check.together ? lo : first);
    }
    case 'chord': {
      if (held.length < 3) return false;
      const id = identifyChord(held, key);
      if (!id || !check.qualities.includes(id.quality.id)) return false;
      if (check.root && parseNoteSpec(check.root).pc !== pitchClass(midiOf(id.root))) return false;
      if (check.inversion !== undefined && id.inversion !== check.inversion) return false;
      return true;
    }
    case 'scale': {
      const pcs = scaleNotes(check.tonic.replace(/-?\d$/, '') + '4', check.scale).map(p => pitchClass(midiOf(p)));
      const want = check.down ? [...pcs].reverse() : pcs;
      const seq = lastN(state, want.length);
      if (!seq) return false;
      for (let i = 0; i < want.length; i++) {
        if (pitchClass(seq[i]) !== want[i]) return false;
        if (i && (check.down ? seq[i] >= seq[i - 1] : seq[i] <= seq[i - 1])) return false;
      }
      return true;
    }
  }
}

/** Is this a check you answer by holding notes together (rather than one after another)? */
export function heldCheck(check: Check): boolean {
  return check.kind === 'chord' || (check.kind === 'notes' && !check.inOrder) || (check.kind === 'interval' && !!check.together);
}

/** The play state a list of answer notes makes: held together, or struck in turn. */
export function stateOf(check: Check, notes: string[]): PlayState {
  const midis = notes.map(n => midiOf(parsePitch(n)));
  return heldCheck(check) ? { held: midis, struck: midis } : { held: [], struck: midis };
}

/**
 * For checks answered one note after another: has the attempt under way already gone wrong
 * (so it counts as a miss, and the learner starts again)? Only asked when the check hasn't
 * passed. An attempt starts on its first note: wandering before it isn't a miss.
 */
export function attemptMissed(check: Check, struck: number[]): boolean {
  if (heldCheck(check) || check.kind === 'any') return false;
  if (check.kind === 'note') return struck.length > 0;
  if (check.kind === 'interval') {
    if (struck.length < 2) return false;
    return !check.from || matches(parseNoteSpec(check.from), struck[struck.length - 2]);
  }
  const want: NoteSpec[] =
    check.kind === 'scale'
      ? (() => {
          const pcs = scaleNotes(check.tonic.replace(/-?\d$/, '') + '4', check.scale).map(p => ({ pc: pitchClass(midiOf(p)) }));
          return check.down ? pcs.reverse() : pcs;
        })()
      : check.kind === 'notes'
        ? check.notes.map(parseNoteSpec)
        : [];
  if (!want.length) return false;
  let start = -1;
  for (let k = struck.length - 1; k >= 0; k--)
    if (matches(want[0], struck[k])) {
      start = k;
      break;
    }
  if (start < 0) return struck.length >= 2;
  const attempt = struck.slice(start);
  for (let j = 0; j < attempt.length; j++) {
    if (j >= want.length || !matches(want[j], attempt[j])) return true;
    if (check.kind === 'scale' && j && (check.down ? attempt[j] >= attempt[j - 1] : attempt[j] <= attempt[j - 1])) return true;
  }
  return false;
}
