import { RH, inlinePiece, insight, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Guitar · Bass clef. Notes are written at REAL (sounding) pitch — no octave transposition:
 * low E (E2) sits on the ledger line below the bass staff, open G (G3) in the top space.
 */
const B = 'bass' as const;

/** A fretboard location for `meet`: string (1 = high E), fret, left-hand finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- Pitch pools (first position unless noted) ----
const OPEN = 'E2 A2 D3 G3';
const S6 = 'E2 F2 G2';
const S56 = 'E2 F2 G2 A2 B2 C3';
const S456 = 'E2 F2 G2 A2 B2 C3 D3 E3 F3';
const S3456 = 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3';
const ALL1 = 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4';
const EM = 'E2 F#2 G2 A2 B2 C3 D3 E3 F#3 G3';
const GMAJ = 'G2 A2 B2 C3 D3 E3 F#3 G3 A3 B3';
const AM_H = 'A2 B2 C3 D3 E3 F3 G#3 A3';
const AM = 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4';
const DMAJ = 'D3 E3 F#3 G3 A3 B3 C#4 D4';
const PENTA_E = 'E2 G2 A2 B2 D3 E3 G3 A3 B3 D4';
const POS5 = 'A2 B2 C3 D3 E3 F3 G3 A3 C4 D4 E4'; // B3 omitted: it would need a stretch to the 4th fret
const POS5_LOW = 'A2 B2 C3 D3 E3 F3 G3 A3';
const FULL = 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4';

function bpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: B, voices }], o);
}

// ---- Tunes, bass lines and études (sounding pitch) ----
const LOW_E_GROOVE = 'E2/q E2 G2 E2 | F2/h E2/h | E2/q G2 A2 G2 | F2/q F2 E2/h | E2/q E2 G2 E2 | A2/h G2/h | F2/q G2 F2 E2 | E2/w |';
const ODE_LOW = 'B2/q B2 C3 D3 | D3 C3 B2 A2 | G2 G2 A2 B2 | B2/q. A2/e A2/h | B2/q B2 C3 D3 | D3 C3 B2 A2 | G2 G2 A2 B2 | A2/q. G2/e G2/h |';
const SAINTS_LOW = 'r/q C3 E3 F3 | G3/w | r/q C3 E3 F3 | G3/w | r/q C3 E3 F3 | G3/h E3/h | C3/h E3/h | D3/w | r/q E3 E3 D3 | C3/h. C3/q | E3/h G3/h | F3/w | r/h E3/q F3/q | G3/h E3/h | C3/h D3/h | C3/w |';
const LOW_SONG = 'C3/q E3 G3 | C4/h B3/q | A3/q G3 F3 | E3/h. | D3/q F3 A3 | D4/h C4/q | B3/q A3 G3 | A3/h. | G3/q E3 C3 | F3/h D3/q | G2/q B2 D3 | G3/h F3/q | E3/q C3 E3 | D3/q G2 B2 | C3/h. |';
const ROOT_FIFTH_AM = 'A2/q E3 A2 E3 | D3 A3 D3 A3 | A2 E3 A2 E3 | E2 B2 E2 B2 | A2 E3 A2 E3 | D3 A3 D3 A3 | E2 B2 E3 B2 | A2/w |';
const ALT_BASS_C = 'C3/q G2 C3 G2 | F2 C3 F2 C3 | C3 G2 C3 G2 | G2 D3 G2 D3 | C3 G2 C3 G2 | F2 C3 F2 C3 | G2 D3 G2 B2 | C3/w |';
const ROOT_FIFTH_OCTAVE = 'A2/q E3 A3 E3 | D3 A3 D4 A3 | C3 G3 C4 G3 | G2 D3 G3 D3 | A2 E3 A3 E3 | D3 A3 D4 A3 | E2 B2 E3 B2 | A2/w |';
const EIGHTH_ROCK = 'A2/e A2 A2 A2 E2 E2 G2 G2 | A2/e A2 A2 A2 C3 C3 D3 D3 | D3/e D3 D3 D3 A2 A2 C3 C3 | D3/e D3 D3 D3 F3 F3 E3 E3 | E2/e E2 E2 E2 G2 G2 B2 B2 | D3/e D3 C3 C3 B2 B2 G2 G2 | A2/e A2 A2 A2 E2 E2 G2 G2 | A2/w |';
const WALK_C = 'C3/q E3 G3 E3 | A2 C3 E3 C#3 | D3 F3 A3 F#3 | G3 F3 D3 B2 | C3 D3 E3 G3 | A3 G3 E3 C#3 | D3 E3 F3 F#3 | G3 F3 D3 B2 | C3/w |';
const WALK_G = 'G2/q B2 D3 B2 | E2 G2 B2 G#2 | A2 C3 E3 C#3 | D3 F#3 A3 F#3 | G3 D3 B2 G2 | E2 F#2 G2 G#2 | A2 B2 C3 C#3 | D3 C3 A2 F#2 | G2/w |';
const PENTA_RUN = 'E2/e G2 A2 B2 D3 E3 G3 A3 | B3/e D4 B3 A3 G3 E3 D3 B2 | A2/e B2 D3 E3 G3 E3 D3 B2 | A2/e G2 E2 G2 E2/h |';
const ARPS_C = 'C3/q E3 G3 C4 | A2 C3 E3 A3 | D3 F3 A3 D4 | G2 B2 D3 G3 | C3 E3 G3 C4 | F2 A2 C3 F3 | G2 B2 D3 F3 | C3/w |';
const MOTOWN = 'C3/q. C3/e r/e G2/e A2/e B2/e | C3/q. C3/e r/q E3/q | F2/q. F2/e r/e C3/e D3/e E3/e | F3/q. F3/e r/q A2/q | G2/q. G2/e r/e D3/e E3/e F3/e | G3/q. G3/e r/q B2/q | C3/q. C3/e r/e G2/e A2/e B2/e | C3/w |';
const SYNC_LINE = 'A2/e E3/q A2/e r/q G2/q | A2/e C3/q D3/e r/q E3/q | D3/e A3/q D3/e r/q C3/q | D3/e F3/q G3/e r/q A3/q | E2/e B2/q E3/e r/q D3/q | E2/e G#2/q B2/e r/q E3/q | A2/e E3/q A2/e r/q G2/q | A2/w |';
const BLUES_A = 'A2/q C#3 E3 F#3 | G3 F#3 E3 C#3 | A2 C#3 E3 F#3 | A2 B2 C3 C#3 | D3 F#3 A3 B3 | C4 A3 F#3 D3 | A2 C#3 E3 F#3 | A2 B2 C#3 D#3 | E3 G#3 B3 G#3 | D3 F#3 A3 F#3 | A2 C#3 E3 C#3 | E2 G#2 B2 D3 | A2/w |';
const SARABANDE = 'D3/h A3/q | F3/h D3/q | Bb3/h A3/q | G3/h. | G3/h C4/q | Bb3/q A3 G3 | A3/h F3/q | E3/h. | D3/h F3/q | E3/q G3 Bb3 | A3/q. G3/e C#3/q | D3/h. |';
const BACH_PRELUDE = 'G2/s D3 B3 A3 B3 D3 B3 D3 G2 D3 B3 A3 B3 D3 B3 D3 | G2/s E3 C4 B3 C4 E3 C4 E3 G2 E3 C4 B3 C4 E3 C4 E3 | G2/s F#3 C4 B3 C4 F#3 C4 F#3 G2 F#3 C4 B3 C4 F#3 C4 F#3 | G2/s G3 B3 A3 B3 G3 B3 G3 G2 G3 B3 A3 B3 G3 B3 F#3 | [G2 D3 G3 B3]/w |';
const FIFTH_POS_LINE = 'A2@1%6 C3@4%6 E3@3%5 A3@3%4 | G3@1%4 E3@3%5 C3@4%6 E3@3%5 | D3@1%5 F3@4%5 A3@3%4 C4@1%3 | B3@1%3 G3@1%4 E3/h@3%5 | A2/q@1%6 B2@3%6 C3@4%6 D3@1%5 | E3@3%5 F3@4%5 G3@1%4 A3@3%4 | C4@1%3 D4@3%3 E4@1%2 D4@3%3 | A3/w@3%4 |';

export const guitarBass: TrackDef = {
  id: 'guitar-bass',
  instrument: 'guitar',
  title: 'Bass Clef',
  subtitle: 'Guitar · Bass lines & low voices',
  description: 'Read the bass clef on the guitar at real pitch — bass lines, walking bass, cello melodies and piano left-hand parts — and become a true two-clef reader.',
  clef: 'bass',
  accent: '#ffcb6b',
  glyph: '𝄢',
  heatmap: [{ clef: 'bass', low: 'E2', high: 'E4' }],
  recommends: ['guitar-treble'],
  units: [
    // ------------------------------------------------------------------ 1
    unit('gb1', 'Open Strings in Bass Clef', 'E, A, D and G — the four low open strings at real pitch.', [
      lesson('gb1-1', 'Why Bass Clef?', 'learn', 'Meet the F clef and your two lowest strings', [
        meet(B, 'E2', { frets: [at(6, 0, 0)], tips: ['The open 6th string — the lowest note on the guitar — sits on one ledger line below the bass staff.'] }),
        meet(B, 'A2', { frets: [at(5, 0, 0)], tips: ['The open 5th string is A: the bottom space of the bass staff.'] }),
        name(B, 'E2 A2', 8),
        play(B, 'E2 A2', 8, { hints: true }),
      ], [
        insight('Why read bass clef on guitar?', 'Bass clef opens a whole library: bass lines, cello melodies, bassoon parts and the left hand of piano music. There is no octave trick here — notes are written exactly where they sound. Reading both clefs makes you a complete musician.'),
        insight('The F clef', 'The bass clef (𝄢) is an F clef: its two dots hug the 4th line, and every note on that line is the F below middle C — on the guitar, the 4th string, 3rd fret.', { kind: 'staff', clef: 'bass', notes: ['F3'], labels: true }),
      ]),
      lesson('gb1-2', 'Open D and G', 'learn', 'The middle line and the top space', [
        meet(B, 'D3', { frets: [at(4, 0, 0)], tips: ['The open 4th string, D, sits right on the middle line.'] }),
        meet(B, 'G3', { frets: [at(3, 0, 0)], tips: ['The open 3rd string, G, sits in the top space.'] }),
        name(B, OPEN, 12),
        play(B, OPEN, 10, { hints: true }),
      ], [
        insight('Open strings in bass clef', 'From the bottom: E (ledger line), A (bottom space), D (middle line), G (top space). Each open string sits four letters above the one before.', { kind: 'staff', clef: 'bass', notes: ['E2', 'A2', 'D3', 'G3'], labels: true }),
      ]),
      lesson('gb1-3', 'Open-String Lines', 'practice', 'Read bass lines on open strings', [
        tip('Thumb technique', 'Play bass notes with your thumb (p), striking down-and-through the string. Rest your fingers lightly on the treble strings for a steady hand.'),
        read(B, OPEN, { rhythms: RH.quarters, maxLeap: 3, leapiness: 1, noteNames: true }),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 3, leapiness: 1 }),
        name(B, OPEN, 12, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gb1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Know E, A, D and G on sight', [
        name(B, OPEN, 12),
        play(B, OPEN, 8),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 3, leapiness: 1, fingering: 'first' }),
      ]),
    ], ['F clef', 'Open strings', 'Thumb strokes']),

    // ------------------------------------------------------------------ 2
    unit('gb2', 'The Sixth String', 'E, F and G at the bottom of the staff.', [
      lesson('gb2-1', 'F and G', 'learn', 'Below the staff and the bottom line', [
        meet(B, 'F2 G2', { frets: [at(6, 1, 1), at(6, 3, 3)], tips: ['F hangs in the space just below the staff: 6th string, 1st fret, finger 1.', 'G sits on the bottom line: 6th string, 3rd fret, finger 3.'] }),
        name(B, 'E2 F2 G2 A2', 10),
        play(B, S6, 10, { hints: true }),
        read(B, S6, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true }),
      ], [
        insight('One finger per fret', 'In first position each left-hand finger owns a fret: 1 → fret 1, 2 → fret 2, 3 → fret 3, 4 → fret 4. Press right behind the fret wire.', { kind: 'frets', positions: [{ string: 6, fret: 0, label: 'E' }, { string: 6, fret: 1, finger: 1, label: 'F' }, { string: 6, fret: 3, finger: 3, label: 'G' }], maxFret: 5 }),
      ]),
      lesson('gb2-2', 'Counting Beats', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'A quarter note lasts 1 beat, a half note 2, a whole note 4. Bass players are the timekeepers — count steadily.', { kind: 'staff', clef: 'bass', notes: ['E2/q', 'F2/q', 'G2/h', 'A2/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(B, 'E2 F2 G2 A2', { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 63 }),
      ]),
      lesson('gb2-3', 'Low E Groove', 'song', 'Your first bass riff', [
        bpiece('Low E Groove', 'C', [4, 4], [LOW_E_GROOVE]),
        read(B, 'E2 F2 G2 A2 D3', { rhythms: RH.qh, maxLeap: 3, leapiness: 0.5 }),
      ]),
      lesson('gb2-c', 'Checkpoint: Sixth String', 'checkpoint', 'E, F, G and the open strings', [
        name(B, 'E2 F2 G2 A2 D3 G3', 12),
        play(B, 'E2 F2 G2 A2', 8),
        read(B, 'E2 F2 G2 A2', { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 69, fingering: 'first' }),
      ]),
    ], ['F G', 'Note values']),

    // ------------------------------------------------------------------ 3
    unit('gb3', 'The Fifth String', 'B and C — the lower half of the staff.', [
      lesson('gb3-1', 'B and C', 'learn', 'Second line and second space', [
        meet(B, 'B2 C3', { frets: [at(5, 2, 2), at(5, 3, 3)], tips: ['B sits on the second line: 5th string, 2nd fret, finger 2.', 'C sits in the second space: 5th string, 3rd fret, finger 3.'] }),
        name(B, S56, 12),
        play(B, S56, 10, { hints: true }),
      ]),
      lesson('gb3-2', 'Two Strings', 'practice', 'E2 up to C3', [
        read(B, S56, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
        read(B, S56, { rhythms: RH.qh, maxLeap: 2 }),
        name(B, S56, 14, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gb3-3', 'Waltz Time', 'learn', 'Three beats per bar', [
        tip('3/4 time', 'Three beats per bar: ONE two three. In a waltz the bass plays the strong first beat — make it count.', { kind: 'staff', clef: 'bass', notes: ['A2/q', 'B2/q', 'C3/q', 'A2/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(B, S56 + ' D3', { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('gb3-4', 'Ode to Joy, Low', 'song', 'Beethoven in the bass', [
        bpiece('Ode to Joy (low)', 'C', [4, 4], [ODE_LOW]),
        read(B, S56 + ' D3', { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gb3-c', 'Checkpoint: Fifth String', 'checkpoint', 'Read E2 to D3', [
        name(B, S56 + ' D3', 14),
        play(B, S56, 10),
        read(B, S56 + ' D3', { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['B C', '3/4 time']),

    // ------------------------------------------------------------------ 4
    unit('gb4', 'The Fourth String & Rests', 'E and F in the staff, and silence in the bass.', [
      lesson('gb4-1', 'E and F', 'learn', 'Third space and fourth line', [
        meet(B, 'E3 F3', { frets: [at(4, 2, 2), at(4, 3, 3)], tips: ['E sits in the third space: 4th string, 2nd fret, finger 2.', 'F sits on the 4th line — between the two dots of the clef: 4th string, 3rd fret, finger 3.'] }),
        name(B, S456, 14),
        play(B, S456, 10, { hints: true }),
      ]),
      lesson('gb4-2', 'Rests', 'learn', 'Stop the bass for clean silence', [
        tip('Muting', 'A rest is counted silence. Low strings ring a long time, so stop them: relax a fretted finger, or touch an open string with the thumb or palm.', { kind: 'staff', clef: 'bass', notes: ['A2/q', 'r/q', 'E3/q', 'r/q', 'D3/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(B, S456, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gb4-3', 'Three Strings', 'practice', 'E2 up to F3', [
        read(B, S456, { rhythms: RH.qh, maxLeap: 3, leapiness: 0.4, fingering: 'first' }),
        read(B, S456, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
        name(B, S456, 16, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gb4-4', 'When the Saints', 'song', 'A classic marching tune', [
        bpiece('When the Saints Go Marching In', 'C', [4, 4], [SAINTS_LOW]),
        piece('gb-when-the-saints'),
      ]),
      lesson('gb4-c', 'Checkpoint: Fourth String', 'checkpoint', 'Read E2 to G3 with rests', [
        name(B, S3456, 16),
        play(B, S456, 10),
        read(B, S456, { rhythms: RH.rests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['E F', 'Rests & muting']),

    // ------------------------------------------------------------------ 5
    unit('gb5', 'Up to Middle C and Beyond', 'The 3rd and 2nd strings — ledger lines above the staff.', [
      lesson('gb5-1', 'A and B at the Top', 'learn', 'The top line and the space above', [
        meet(B, 'A3 B3', { frets: [at(3, 2, 2), at(2, 0, 0)], tips: ['A sits on the top line: 3rd string, 2nd fret, finger 2.', 'B floats just above the staff: the open 2nd string.'] }),
        name(B, 'E3 F3 G3 A3 B3', 10),
        play(B, 'G3 A3 B3', 8, { hints: true }),
      ]),
      lesson('gb5-2', 'Middle C and D', 'learn', 'Ledger lines above the staff', [
        meet(B, 'C4 D4', { frets: [at(2, 1, 1), at(2, 3, 3)], tips: ['Middle C sits on the first ledger line above the bass staff: 2nd string, 1st fret, finger 1.', 'D floats above that ledger line: 2nd string, 3rd fret, finger 3.'] }),
        name(B, 'G3 A3 B3 C4 D4', 12),
        play(B, 'G3 A3 B3 C4 D4', 10, { hints: true }),
        read(B, 'G3 A3 B3 C4 D4', { rhythms: RH.quarters, maxLeap: 1, noteNames: true }),
      ], [
        insight('Middle C', 'C on the ledger line above the bass staff is middle C — the same note as the ledger line below the treble staff. It’s where the two clefs meet.', { kind: 'staff', clef: 'bass', notes: ['A3', 'B3', 'C4', 'D4'], labels: true }),
      ]),
      lesson('gb5-3', 'The Whole First Position', 'practice', 'E2 to D4', [
        name(B, ALL1, 20, { sequence: true, title: 'Note rush' }),
        play(B, ALL1, 14),
        read(B, ALL1, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gb5-4', 'Song of the Low Strings', 'song', 'A melody across two octaves', [
        bpiece('Song of the Low Strings', 'C', [3, 4], [LOW_SONG]),
        read(B, ALL1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('gb5-c', 'Checkpoint: First Position', 'checkpoint', 'Every natural note, E2 to D4', [
        name(B, ALL1, 20, { sequence: true }),
        play(B, ALL1, 12),
        read(B, ALL1, { rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['A B C D', 'Middle C', 'Two octaves']),

    // ------------------------------------------------------------------ 6
    unit('gb6', 'Eighth Notes & Bass Lines', 'Root–fifth patterns, alternating bass and driving eighths.', [
      lesson('gb6-1', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighths in the bass', 'Count “1 & 2 &”. On the low strings, alternate the thumb with i (p–i), or use i–m on repeated notes, so the line stays even.', { kind: 'staff', clef: 'bass', notes: ['A2/e', 'A2/e', 'E3/q', 'D3/e', 'C3/e', 'A2/q'], time: [2, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(B, S456, { rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('gb6-2', 'Root and Fifth', 'learn', 'The backbone of every bass line', [
        bpiece('Root–Fifth in A Minor', 'Am', [4, 4], [ROOT_FIFTH_AM]),
        read(B, AM, { key: 'Am', rhythms: RH.qh, maxLeap: 4, leapiness: 0.7, harmonic: true }),
      ], [
        insight('Root–fifth', 'Most bass lines start from the chord’s root and its 5th. On the guitar the 5th has one shape: one string higher, two frets up. From an open-string root (E, A, D) that’s the 2nd fret of the next string.', { kind: 'frets', positions: [{ string: 5, fret: 0, label: 'A', root: true }, { string: 4, fret: 2, finger: 2, label: 'E' }, { string: 4, fret: 0, label: 'D', root: true }, { string: 3, fret: 2, finger: 2, label: 'A' }], maxFret: 5 }),
      ]),
      lesson('gb6-3', 'Alternating Bass', 'learn', 'Root, fifth below, and the octave', [
        tip('Alternating bass', 'Folk and country bass alternates the root with the 5th below it: C–G, F–C, G–D. Add the octave for a bigger sound.'),
        bpiece('Alternating Bass in C', 'C', [4, 4], [ALT_BASS_C]),
        bpiece('Root–Fifth–Octave', 'Am', [4, 4], [ROOT_FIFTH_OCTAVE]),
      ]),
      lesson('gb6-4', 'Eighth-Note Rock', 'song', 'Driving eighths with clean string changes', [
        bpiece('Eighth-Note Rock', 'Am', [4, 4], [EIGHTH_ROCK], { mode: 'tempo', tempo: 80 }),
        read(B, ALL1, { rhythms: RH.eighthsRests, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('gb6-c', 'Checkpoint: Bass Lines', 'checkpoint', 'Eighths and root–fifth lines in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        bpiece('Root–Fifth–Octave', 'Am', [4, 4], [ROOT_FIFTH_OCTAVE], { mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(B, ALL1, { rhythms: RH.eighths, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 69, fingering: 'first' }),
      ]),
    ], ['Eighths', 'Root–fifth', 'Alternating bass']),

    // ------------------------------------------------------------------ 7
    unit('gb7', 'Sharps, Flats & Walking Bass', 'E minor, G major, A minor and D major — then walk.', [
      lesson('gb7-1', 'F Sharp: E Minor & G Major', 'learn', 'One sharp', [
        meet(B, 'F#2 F#3', { frets: [at(6, 2, 2), at(4, 4, 4)], tips: ['Low F♯: 6th string, 2nd fret, finger 2.', 'F♯ on the 4th string: 4th fret, finger 4 — the line under the clef’s dots, raised.'] }),
        keysig(B, 'C G Em', 8),
        read(B, EM, { key: 'Em', rhythms: RH.qh, maxLeap: 2 }),
        read(B, GMAJ, { key: 'G', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('Sharps and key signatures', 'A sharp raises a note one fret. In G major and E minor the key signature puts a sharp on the F line: every F is F♯, in every octave.', { kind: 'staff', clef: 'bass', notes: ['F#2', 'F#3'], key: 'G' }),
      ]),
      lesson('gb7-2', 'G Sharp: A Minor', 'learn', 'The raised 7th', [
        meet(B, 'G#2 G#3', { frets: [at(6, 4, 4), at(3, 1, 1)], tips: ['Low G♯: 6th string, 4th fret, finger 4.', 'G♯ on the 3rd string: 1st fret, finger 1.'] }),
        tip('Harmonic minor', 'A minor has no key signature, but its bass lines often raise G to G♯ to lead home to A — written as an accidental.'),
        keysig(B, 'C G Am Em', 8),
        read(B, AM_H, { key: 'Am', rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('gb7-3', 'C Sharp: D Major', 'learn', 'Two sharps', [
        meet(B, 'C#3 C#4', { frets: [at(5, 4, 4), at(2, 2, 2)], tips: ['Low C♯: 5th string, 4th fret, finger 4.', 'C♯ above the staff: 2nd string, 2nd fret, finger 2.'] }),
        keysig(B, 'C G D Am Em', 8),
        read(B, DMAJ, { key: 'D', rhythms: RH.qh, maxLeap: 2 }),
        read(B, DMAJ, { key: 'D', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gb7-4', 'Walking Bass', 'learn', 'Steady quarters that lead to the next chord', [
        bpiece('Walking in C', 'C', [4, 4], [WALK_C], { prompt: 'Chord tone on beat 1, a step or half step into the next root on beat 4.' }),
        bpiece('Walking in G', 'G', [4, 4], [WALK_G]),
      ], [
        insight('How a walking bass works', 'A walking bass moves in steady quarter notes: the chord’s root on beat 1, chord tones or scale steps in between, and a step or half step into the next root on beat 4. That last note is what makes it “walk”.'),
      ]),
      lesson('gb7-5', 'Bass Lines in Keys', 'song', 'Songs and lines in four keys', [
        piece('gb-house-of-the-rising-sun'),
        read(B, EM, { key: 'Em', rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('gb7-c', 'Checkpoint: Keys & Walking', 'checkpoint', 'Read in four keys and walk in time', [
        keysig(B, 'C G D Am Em', 8),
        bpiece('Walking in C', 'C', [4, 4], [WALK_C], { mode: 'tempo', tempo: 84, fingering: 'first' }),
        read(B, GMAJ, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(B, DMAJ, { key: 'D', rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['F♯ C♯ G♯', 'Em G Am D', 'Walking bass']),

    // ------------------------------------------------------------------ 8
    unit('gb8', 'Scales & Arpeggios', 'Pentatonic, major and minor scales and chord outlines in bass clef.', [
      lesson('gb8-1', 'E Minor Pentatonic', 'learn', 'Five notes that fit everywhere', [
        { type: 'fret-shape', shape: { kind: 'pentatonic', root: 'E', box: 0, quality: 'minor' }, direction: 'updown', mode: 'wait', title: 'E minor pentatonic — open position' },
        bpiece('Pentatonic Run', 'Em', [4, 4], [PENTA_RUN]),
        read(B, PENTA_E, { key: 'Em', rhythms: RH.eighths, maxLeap: 2 }),
      ], [
        insight('The minor pentatonic', 'The minor pentatonic leaves out the two “tense” notes of the minor scale. In E minor it is E G A B D — in first position it falls on open strings and frets 2–3.', { kind: 'frets', positions: [{ string: 6, fret: 0, root: true }, { string: 6, fret: 3, finger: 3 }, { string: 5, fret: 0 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 0 }, { string: 4, fret: 2, finger: 2, root: true }, { string: 3, fret: 0 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 0 }, { string: 2, fret: 3, finger: 3 }], maxFret: 5 }),
      ]),
      lesson('gb8-2', 'Major Scales: C and G', 'learn', 'One octave in bass clef', [
        scale('C', 'major', 'R', { octave: 3, clef: B }),
        scale('G', 'major', 'R', { octave: 2, clef: B }),
        scale('G', 'major', 'R', { octave: 2, clef: B, mode: 'tempo', tempo: 72, rhythm: 'e' }),
      ]),
      lesson('gb8-3', 'Minor Scales: A and E', 'learn', 'Natural and harmonic minor', [
        scale('A', 'natural-minor', 'R', { octave: 2, clef: B }),
        scale('A', 'harmonic-minor', 'R', { octave: 2, clef: B }),
        scale('E', 'natural-minor', 'R', { octaves: 2, octave: 2, clef: B, title: 'E minor, two octaves — up to E on the second ledger line' }),
      ]),
      lesson('gb8-4', 'Arpeggios', 'learn', 'Outline the chords', [
        bpiece('Arpeggios in C', 'C', [4, 4], [ARPS_C]),
        read(B, ALL1, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.7, harmonic: true }),
      ], [
        insight('Arpeggios', 'An arpeggio plays a chord one note at a time: root, 3rd, 5th, octave. On the staff it’s a stack of skips — line-line-line or space-space-space.', { kind: 'staff', clef: 'bass', notes: ['C3/q', 'E3/q', 'G3/q', 'C4/q'], time: [4, 4] }),
      ]),
      lesson('gb8-5', 'Scale Workout', 'practice', 'Scales at tempo, two octaves', [
        scale('E', 'harmonic-minor', 'R', { octaves: 2, octave: 2, clef: B, mode: 'tempo', tempo: 69 }),
        scale('A', 'natural-minor', 'R', { octave: 2, clef: B, mode: 'tempo', tempo: 80, rhythm: 'e' }),
        read(B, AM, { key: 'Am', rhythms: RH.eighths, maxLeap: 1, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
      lesson('gb8-c', 'Checkpoint: Scales & Arpeggios', 'checkpoint', 'Clean scales and chord outlines', [
        scale('G', 'major', 'R', { octave: 2, clef: B, mode: 'tempo', tempo: 84, rhythm: 'e', fingering: 'first' }),
        scale('E', 'natural-minor', 'R', { octaves: 2, octave: 2, clef: B, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(B, ALL1, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.6, harmonic: true, fingering: 'first' }),
      ]),
    ], ['Pentatonic', 'Major & minor', 'Arpeggios']),

    // ------------------------------------------------------------------ 9
    unit('gb9', 'Fifth Position & Grooves', 'A new hand position, up to E4 — plus dotted and syncopated grooves.', [
      lesson('gb9-1', 'Fifth Position', 'learn', 'The same low notes in a new place', [
        meet(B, 'A2 C3 D3 F3', { frets: [at(6, 5, 1), at(6, 8, 4), at(5, 5, 1), at(5, 8, 4)], tips: ['A on the 6th string, 5th fret, finger 1 — the same pitch as the open 5th string.', 'C on the 6th string, 8th fret, finger 4.', 'D on the 5th string, 5th fret, finger 1.', 'F on the 5th string, 8th fret, finger 4.'] }),
        read(B, POS5_LOW, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        read(B, POS5_LOW, { guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Fifth position', 'Put finger 1 at the 5th fret and keep one finger per fret (5–8). Bass players love this spot: the fretted notes are fatter than open strings and every note is under a finger.', { kind: 'frets', positions: [{ string: 6, fret: 5, finger: 1, label: 'A' }, { string: 6, fret: 7, finger: 3, label: 'B' }, { string: 6, fret: 8, finger: 4, label: 'C' }, { string: 5, fret: 5, finger: 1, label: 'D' }, { string: 5, fret: 7, finger: 3, label: 'E' }, { string: 5, fret: 8, finger: 4, label: 'F' }, { string: 4, fret: 5, finger: 1, label: 'G' }, { string: 4, fret: 7, finger: 3, label: 'A' }], minFret: 3, maxFret: 10 }),
      ]),
      lesson('gb9-2', 'Up to E4', 'learn', 'Two ledger lines above', [
        meet(B, 'C4 D4 E4', { frets: [at(3, 5, 1), at(3, 7, 3), at(2, 5, 1)], tips: ['Middle C on the 3rd string, 5th fret, finger 1.', 'D on the 3rd string, 7th fret, finger 3.', 'E sits on the second ledger line above the staff: 2nd string, 5th fret, finger 1.'] }),
        name(B, 'G3 A3 B3 C4 D4 E4', 12),
        read(B, POS5, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('gb9-3', 'Dotted Rhythms', 'learn', 'Long–short in the bass', [
        tip('Dotted quarter', 'A dotted quarter lasts 1½ beats and is usually followed by an eighth: “1 – & 2”. It gives a bass line its bounce.', { kind: 'staff', clef: 'bass', notes: ['A2/q.', 'A2/e', 'E3/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(B, POS5, { guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, harmonic: true }),
        read(B, ALL1, { rhythms: RH.dottedRests, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('gb9-4', 'Syncopated Grooves', 'learn', 'Notes that push across the beat', [
        tip('Syncopation', 'Syncopation lands notes between the beats: “1 & – & ”. Keep your foot steady on the beat and let the bass push against it.', { kind: 'staff', clef: 'bass', notes: ['A2/e', 'E3/q', 'A2/e'], time: [2, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        bpiece('Motown-Style Groove', 'C', [4, 4], [MOTOWN]),
        bpiece('Syncopated Line', 'Am', [4, 4], [SYNC_LINE]),
      ]),
      lesson('gb9-5', 'Twelve-Bar Blues', 'song', 'A walking blues in A', [
        bpiece('Walking Blues in A', 'A', [4, 4], [BLUES_A], { prompt: 'Three sharps (F♯ C♯ G♯); the G♮ and C♮ are the bluesy notes. Keep the quarters even.' }),
        bpiece('Bass Line in Fifth Position', 'Am', [4, 4], [FIFTH_POS_LINE]),
      ]),
      lesson('gb9-c', 'Checkpoint: Positions & Grooves', 'checkpoint', 'Fifth position and syncopation in time', [
        read(B, POS5, { guitarPosition: 5, rhythms: RH.dottedRests, maxLeap: 3, harmonic: true, fingering: 'first' }),
        bpiece('Motown-Style Groove', 'C', [4, 4], [MOTOWN], { mode: 'tempo', tempo: 84, fingering: 'first' }),
        read(B, ALL1, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 69, fingering: 'none' }),
      ]),
    ], ['5th position', 'E4', 'Dotted & syncopated']),

    // ------------------------------------------------------------------ 10
    unit('gb10', 'Cello Lines & Final Exam', 'Singing low melodies, Bach, and the full bass-clef range.', [
      lesson('gb10-1', 'Singing Lines', 'learn', 'Play the bass like a cellist', [
        tip('Legato', 'Cello lines sing: keep each finger down until the next note sounds, use rest strokes with the thumb, and shape long notes. Wide leaps are part of the style — look ahead.'),
        tip('One flat', 'D minor has one flat, B♭ (3rd string, 3rd fret) — it shares its key signature with F major. The raised 7th, C♯, appears as an accidental.', { kind: 'staff', clef: 'bass', notes: ['Bb2', 'Bb3'], key: 'Dm' }),
        keysig(B, 'F Dm C Am', 6),
        bpiece('Sarabande in D Minor', 'Dm', [3, 4], [SARABANDE]),
        read(B, POS5, { guitarPosition: 5, time: [3, 4], rhythms: RH.slow, maxLeap: 5, leapiness: 0.6, harmonic: true }),
      ]),
      lesson('gb10-2', 'Bach on the Low Strings', 'song', 'The opening of the Cello Suite No. 1 Prelude', [
        tip('Sixteenth notes', 'Four notes per beat: “1 e & a”. Bach’s prelude rolls in steady sixteenths — practise slowly with even thumb and finger strokes.', { kind: 'staff', clef: 'bass', notes: ['G2/s', 'D3/s', 'B3/s', 'A3/s', 'B3/q'], time: [2, 4] }),
        bpiece('Prelude in G — opening (after J. S. Bach)', 'G', [4, 4], [BACH_PRELUDE], { prompt: 'Hold the low G with finger 3 while the upper notes ring. Start slowly — evenness first.' }),
        piece('gb-bach-cello-prelude'),
      ]),
      lesson('gb10-3', 'Repertoire', 'song', 'Melodies from the cello and bass repertoire', [
        piece('gb-the-swan'),
        piece('gb-volga-boatmen'),
      ]),
      lesson('gb10-4', 'Sight-Reading Sprint', 'challenge', 'Read the full range at tempo', [
        name(B, FULL, 30, { sequence: true, title: 'Lightning round' }),
        read(B, ALL1, { rhythms: RH.sixteenths, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 60, fingering: 'none' }),
        read(B, POS5, { guitarPosition: 5, rhythms: RH.syncopation, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
      lesson('gb10-c', 'Final Exam: Guitar Bass Clef', 'checkpoint', 'Prove your bass-clef mastery', [
        name(B, FULL, 30, { sequence: true }),
        keysig(B, 'C G D A F Am Em Dm', 10),
        read(B, 'E2 F#2 G2 A2 B2 C3 D3 E3 F#3 G3 A3 B3 C4 D4', { key: 'Em', rhythms: RH.advanced, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 66, fingering: 'none', measures: 6 }),
        read(B, POS5, { guitarPosition: 5, rhythms: RH.dotted, maxLeap: 5, harmonic: true, fingering: 'none' }),
      ]),
    ], ['Legato', 'Bach', 'Full range']),
  ],
};
