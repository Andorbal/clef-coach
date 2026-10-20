import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Cello · Bass clef (and, near the end, the tenor clef). The cello SOUNDS AS WRITTEN.
 * Strings are numbered from the highest: 1 = A3, 2 = D3, 3 = G2, 4 = C2.
 *
 * First position puts the 1st finger a whole tone above the open string and the other
 * fingers a semitone apart behind it (frets 2, 3, 4 and 5 in the app's terms, since a
 * fretless "fret" is a semitone). The 1st finger can reach back a semitone (the backward
 * extension: E♭ on the D string, B♭ on the A string) and the hand can open so the 4th
 * finger reaches a semitone further (the forward extension: F♯ on the C string, C♯ on
 * the G string). Fourth position puts the 1st finger on D on the A string.
 *
 * Generated reading stays inside one hand position at a time (`guitarPosition` is the
 * index finger's semitone: 2 for first position, 5 for fourth); music that needs an
 * extension or a shift is written out with its fingering.
 */
const B = 'bass' as const;
const TN = 'tenor' as const;

/** A fingerboard place for `meet`: string (1 = A … 4 = C), semitone above the open string, finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- Pitch pools (first position unless noted) ----
const OPEN = 'C2 G2 D3 A3';
const DA1 = 'D3 E3 A3 B3';
const D_STR = 'D3 E3 F#3 G3';
const DMAJ = 'D3 E3 F#3 G3 A3 B3 C#4 D4';
const G_STR = 'G2 A2 B2 C3';
const C_STR = 'C2 D2 E2 F2';
const CG = 'C2 D2 E2 F2 G2 A2 B2 C3';
const POS1_C = 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4';
const POS1_G = 'G2 A2 B2 C3 D3 E3 F#3 G3 A3 B3 C4 D4';
const POS1_F = 'C2 D2 E2 F2 G2 A2 Bb2 C3 D3 E3 F3 G3 A3';
const BB_TOP = 'D3 Eb3 F3 G3 A3 Bb3 C4 D4';
const BB_MAJ = 'Bb2 C3 D3 Eb3 F3 G3 A3 Bb3 C4';
const EXT_D = 'D2 E2 F#2 G2 A2 B2 C#3 D3';
const EXT_G = 'D2 E2 F#2 G2 A2 B2 C3 D3';
const AM = 'A2 B2 C3 D3 E3 F3 G3 A3';
const DM_TOP = 'D3 E3 F3 G3 A3 Bb3 C4 D4';
const EM = 'E2 F#2 G2 A2 B2 C3 D3 E3';
// ---- Fourth position (index finger on D on the A string, G on the D string) ----
const POS4 = 'G3 A3 Bb3 D4 E4 F4';
const POS4_D = 'G3 A3 B3 D4 E4 F#4';
// ---- Tenor clef ----
const TENOR_NAMES = 'D3 E3 F3 G3 A3 B3 C4 D4 E4';
const TENOR_READ = 'D3 G3 A3 Bb3 D4 E4 F4';
const FULL = 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4';

function cpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: B, voices }], o);
}

// ---- Études (string and finger written out where the choice is the lesson: `@finger %string`) ----
const OPEN_BOWS = 'C2/h G2/h | D3/h A3/h | A3/h D3/h | G2/w | G2/h D3/h | A3/h D3/h | G2/h C2/h | C2/w |';
const D_AND_A = 'D3/q E3 F#3 G3 | F#3/h E3/h | D3/q F#3 E3 G3 | F#3/w | A3/q B3 C#4 D4 | C#4/h B3/h | A3/q C#4 B3 D4 | A3/w |';
const CROSSINGS = 'C2/q G2 D3 A3 | A3/q D3 G2 C2 | D2/q A2 E3 B3 | B3/q E3 A2 D2 | E2/q B2 F3 C4 | C4/q F3 B2 E2 | F2/q C3 G3 D4 | C3/w |';
const TIES_D = 'D3/q F#3 A3 D4~ | D4/q C#4 B3 A3 | G3/h B3/h~ | B3/q A3 G3 F#3 | E3/q G3 B3 E3~ | E3/q F#3 G3 E3 | D3/w |';
/** D major in the low octave, in extended position: 1 on the 2nd semitone, 2 on the 4th, 4 on the 6th. */
const EXT_LOW_D = 'D2/q@1%4 E2@2%4 F#2@4%4 G2@0%3 | A2@1%3 B2@2%3 C#3@4%3 D3@0%2 | D3/q@0%2 C#3@4%3 B2@2%3 A2@1%3 | G2@0%3 F#2@4%4 E2@2%4 D2@1%4 | D2/w@1%4 |';
const D_TWO_OCTAVES =
  'D2/q@1%4 E2@2%4 F#2@4%4 G2@0%3 | A2@1%3 B2@2%3 C#3@4%3 D3@0%2 | E3@1%2 F#3@3%2 G3@4%2 A3@0%1 | B3@1%1 C#4@3%1 D4/h@4%1 | ' +
  'D4/q@4%1 C#4@3%1 B3@1%1 A3@0%1 | G3@4%2 F#3@3%2 E3@1%2 D3@0%2 | C#3@4%3 B2@2%3 A2@1%3 G2@0%3 | F#2@4%4 E2@2%4 D2/h@1%4 |';
const A_HARMONIC = 'A2/q@1%3 B2@3%3 C3@4%3 D3@0%2 | E3@1%2 F3@2%2 G#3@4%2 A3@0%1 | A3@0%1 G#3@4%2 F3@2%2 E3@1%2 | D3@0%2 C3@4%3 B2@3%3 A2@1%3 | A2/w@1%3 |';
const ARPEGGIOS = 'C2/q E2 G2 C3 | E3 G3 C4/h | C4/q G3 E3 C3 | G2 E2 C2/h | G2/q B2 D3 G3 | B3 D4 B3/h | G3/q D3 B2 G2 | D3/w |';
/** Up to fourth position on the A string and back, then across to the D string in fourth position. */
const SHIFT_UP =
  'A3/q@0%1 B3@1%1 C4@2%1 D4@4%1 | D4/q@1%1 E4@3%1 F4@4%1 E4@3%1 | D4/h@1%1 A3/h@0%1 | G3/q@1%2 A3@3%2 Bb3@4%2 A3@3%2 | ' +
  'G3/h@1%2 D3/h@0%2 | D4/q@1%1 F4@4%1 E4@3%1 D4@1%1 | Bb3/q@4%2 A3@3%2 G3@1%2 A3@3%2 | D4/w@1%1 |';
const CLEF_CHANGE = 'D3/q F3 A3 D3 | A3/h. r/q | [C:tenor] D4/q@1%1 E4@3%1 F4@4%1 E4@3%1 | D4/h@1%1 A3/h@0%1 | Bb3/q@4%2 A3@3%2 G3@1%2 A3@3%2 | [C:bass] D3/w@0%2 |';

export const celloBass: TrackDef = {
  id: 'cello-bass',
  instrument: 'cello',
  title: 'Bass Clef',
  subtitle: 'Cello · Reading music',
  description: 'Read cello music from the four open strings to the tenor clef: first position and its finger patterns, the keys of C, G, D, F and B♭, both extensions, minor keys, two-octave scales, fourth position and shifting, with Bach, Mozart, Dvořák and Grieg along the way.',
  clef: 'bass',
  accent: '#e39a5f',
  glyph: '𝄢',
  heatmap: [
    { clef: 'bass', low: 'C2', high: 'D4' },
    { clef: 'tenor', low: 'D3', high: 'F4' },
  ],
  units: [
    // ------------------------------------------------------------------ 1
    unit('vc1', 'The Open Strings', 'A, D, G and C in the bass clef, the bow, and your first open-string tunes.', [
      lesson('vc1-1', 'Open A and D', 'learn', 'Read your two highest strings', [
        meet(B, 'A3', { frets: [at(1, 0, 0)], tips: ['The open 1st string is A. It sits on the top line of the bass staff.'] }),
        meet(B, 'D3', { frets: [at(2, 0, 0)], tips: ['The open 2nd string is D, on the middle line.'] }),
        name(B, 'D3 A3', 8),
        play(B, 'D3 A3', 8, { hints: true }),
      ], [
        insight('Sitting with the cello', 'Sit on the front of the chair with your feet flat. Pull out the endpin so the cello’s neck rests near your left shoulder and the C-string peg sits by your left ear. Your knees lightly hold the cello’s sides; the instrument leans back against your chest.'),
        insight('The bass clef', 'Cello music is written in the bass clef (𝄢). It is an F clef: its two dots hug the 4th line, and every note on that line is the F below middle C. The cello sounds exactly where its music is written.', { kind: 'staff', clef: 'bass', notes: ['F3'], labels: true }),
        insight('String numbers', 'Strings are numbered from the highest: string 1 is A, nearest your right knee; string 2 is D, string 3 is G and string 4 is the low C.', { kind: 'frets', positions: [{ string: 1, fret: 0, label: 'A' }, { string: 2, fret: 0, label: 'D' }, { string: 3, fret: 0, label: 'G' }, { string: 4, fret: 0, label: 'C' }], maxFret: 5 }),
      ]),
      lesson('vc1-2', 'Open G and C', 'learn', 'The two lowest strings, down to the ledger lines', [
        meet(B, 'G2', { frets: [at(3, 0, 0)], tips: ['The open 3rd string is G, on the bottom line of the staff.'] }),
        meet(B, 'C2', { frets: [at(4, 0, 0)], tips: ['The open 4th string is C, the cello’s lowest note, on the second ledger line below the staff.'] }),
        name(B, OPEN, 12),
        play(B, OPEN, 10, { hints: true }),
      ], [
        insight('Strings a fifth apart', 'From the bottom, C, G, D and A: each string is five letters (a fifth) above the one below it. On the staff that is the second ledger line below, the bottom line, the middle line and the top line.', { kind: 'staff', clef: 'bass', notes: ['C2', 'G2', 'D3', 'A3'], labels: true }),
      ]),
      lesson('vc1-3', 'Bowing the Open Strings', 'practice', 'A straight bow, a steady sound', [
        tip('The bow hold', 'Bend your thumb and put its tip against the stick, right where the frog begins. Let the other fingers drape over the stick, relaxed and slightly apart, the little finger resting on top. The weight of your arm, not a squeeze, makes the sound.'),
        tip('Down-bow and up-bow', 'A down-bow (⊓) pulls the bow to the right, from the frog towards the tip; an up-bow (V) pushes it back. Keep the bow halfway between the bridge and the end of the fingerboard and parallel to the bridge. Each string has its own arm height: lower for the A string, higher for the C.'),
        cpiece('Open-String Bows', 'C', [4, 4], [OPEN_BOWS], { prompt: 'A whole bow for each half note: down, up, down, up. Let every note ring right to its end.' }),
        read(B, OPEN, { rhythms: RH.slow, maxLeap: 4, leapiness: 1, noteNames: true }),
        name(B, OPEN, 12, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('vc1-4', 'Open-String March', 'song', 'Your first tune: open strings only', [
        piece('cello-open-string-march'),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 1, fingering: 'first' }),
      ]),
      lesson('vc1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Name and play A, D, G and C', [
        name(B, OPEN, 12),
        play(B, OPEN, 8),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 1, fingering: 'first' }),
      ]),
    ], ['A D G C', 'Bass clef', 'Bow hold']),

    // ------------------------------------------------------------------ 2
    unit('vc2', 'The D and A Strings', 'First position on the top two strings: the D major pattern, 0, 1, 3 and 4.', [
      lesson('vc2-1', 'E and B: the 1st Finger', 'learn', 'Your first stopped notes', [
        meet(B, 'E3 B3', { frets: [at(2, 2, 1), at(1, 2, 1)], tips: ['E: D string, 1st finger, a whole tone above the open D. Written in the third space.', 'B: A string, 1st finger. Written in the space just above the staff.'] }),
        name(B, DA1, 10),
        play(B, DA1, 10, { hints: true }),
        read(B, DA1, { rhythms: RH.quarters, maxLeap: 3, leapiness: 0.5, measures: 2, noteNames: true }),
      ], [
        insight('First position', 'In first position the 1st finger stops the string a whole tone above the open note, and the other fingers fall a semitone apart behind it: fingers 1 2 3 4 cover four semitones. Keep the fingers rounded, and the thumb behind the neck, opposite the 2nd finger.', { kind: 'frets', positions: [{ string: 2, fret: 0, label: 'D' }, { string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 3, finger: 2, label: 'F' }, { string: 2, fret: 4, finger: 3, label: 'F♯' }, { string: 2, fret: 5, finger: 4, label: 'G' }], maxFret: 6 }),
        insight('No frets', 'A cello has no frets: your finger decides the pitch, so listen and adjust. The finger tapes on the screen show where first position’s fingers go; many teachers put the same tapes on a beginner’s fingerboard.'),
      ]),
      lesson('vc2-2', 'F♯ and G on the D String', 'learn', 'Fingers 3 and 4, and the key of D', [
        meet(B, 'F#3 G3', { frets: [at(2, 4, 3), at(2, 5, 4)], tips: ['F♯: D string, 3rd finger. Written on the 4th line, the F line, with a sharp.', 'G: D string, 4th finger, a semitone above F♯. Written in the top space.'] }),
        name(B, D_STR, 10, { key: 'D' }),
        play(B, D_STR, 8, { key: 'D', hints: true }),
        read(B, D_STR, { key: 'D', rhythms: RH.quarters, maxLeap: 2, noteNames: true }),
      ], [
        insight('Sharps and the key of D', 'A sharp (♯) raises a note a semitone. D major has two sharps, F♯ and C♯, written once at the start of every line: the key signature. Every F and every C is played sharp.', { kind: 'staff', clef: 'bass', notes: ['F#3', 'C#4'], key: 'D' }),
      ]),
      lesson('vc2-3', 'C♯ and D on the A String', 'learn', 'The same pattern one string higher', [
        meet(B, 'C#4 D4', { frets: [at(1, 4, 3), at(1, 5, 4)], tips: ['C♯: A string, 3rd finger. Written on the ledger line above the staff, with the key’s sharp.', 'D: A string, 4th finger, in the space above the ledger line.'] }),
        name(B, DMAJ, 12, { key: 'D' }),
        play(B, 'A3 B3 C#4 D4', 8, { key: 'D', hints: true }),
        read(B, DMAJ, { key: 'D', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('One pattern, two strings', 'Open, 1, 3, 4: a whole tone, a whole tone, a semitone. On the D string that is D E F♯ G; on the A string, A B C♯ D. Put the two together and you have the D major scale.', { kind: 'staff+frets', clef: 'bass', notes: ['D3', 'E3', 'F#3', 'G3'], positions: [{ string: 2, fret: 0 }, { string: 2, fret: 2, finger: 1 }, { string: 2, fret: 4, finger: 3 }, { string: 2, fret: 5, finger: 4 }] }),
      ]),
      lesson('vc2-4', 'Counting Beats', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'In 4/4 a quarter note lasts 1 beat, a half note 2 and a whole note 4. Divide the bow to match: a whole bow for a whole note, half the bow for a half note, and a quarter of it for each quarter.', { kind: 'staff', clef: 'bass', notes: ['D3/q', 'E3/q', 'F#3/h', 'A3/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(B, DMAJ, { key: 'D', rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 63 }),
        cpiece('D and A String Song', 'D', [4, 4], [D_AND_A]),
      ]),
      lesson('vc2-5', 'First Tunes in D', 'song', 'Three songs on the D and A strings', [
        piece('cello-hot-cross-buns'),
        piece('cello-mary-had-a-little-lamb'),
        piece('cello-lightly-row'),
      ]),
      lesson('vc2-c', 'Checkpoint: D and A Strings', 'checkpoint', 'D major in first position, in time', [
        name(B, DMAJ, 14, { key: 'D' }),
        play(B, DMAJ, 10, { key: 'D' }),
        read(B, DMAJ, { key: 'D', rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['First position', '0 1 3 4', 'Key of D']),

    // ------------------------------------------------------------------ 3
    unit('vc3', 'The G and C Strings', 'A, B and C on the G string, D, E and F on the C string: all of first position, and the key of C.', [
      lesson('vc3-1', 'A, B and C on the G String', 'learn', 'The bottom of the staff', [
        meet(B, 'A2 B2 C3', { frets: [at(3, 2, 1), at(3, 4, 3), at(3, 5, 4)], tips: ['A: G string, 1st finger, in the bottom space.', 'B: G string, 3rd finger, on the second line.', 'C: G string, 4th finger, in the second space.'] }),
        name(B, 'G2 A2 B2 C3 D3', 10),
        play(B, G_STR, 8, { hints: true }),
        read(B, `${G_STR} D3`, { rhythms: RH.quarters, maxLeap: 2, noteNames: true }),
      ], [
        insight('Fingers 3 and 4 touch', 'B and C are a semitone apart, so fingers 3 and 4 sit right next to each other, exactly like F♯ and G on the D string. Between 1 and 3 there is a whole tone: room for the 2nd finger.', { kind: 'frets', positions: [{ string: 3, fret: 0, label: 'G' }, { string: 3, fret: 2, finger: 1, label: 'A' }, { string: 3, fret: 4, finger: 3, label: 'B' }, { string: 3, fret: 5, finger: 4, label: 'C' }], maxFret: 6 }),
      ]),
      lesson('vc3-2', 'D, E and F on the C String', 'learn', 'Ledger lines below the staff', [
        meet(B, 'D2 E2 F2', { frets: [at(4, 2, 1), at(4, 4, 3), at(4, 5, 4)], tips: ['D: C string, 1st finger, in the space below the first ledger line.', 'E: C string, 3rd finger, on the first ledger line below the staff.', 'F: C string, 4th finger, in the space just below the staff.'] }),
        name(B, 'C2 D2 E2 F2 G2', 10),
        play(B, C_STR, 8, { hints: true }),
        read(B, `${C_STR} G2`, { rhythms: RH.quarters, maxLeap: 2, noteNames: true }),
      ], [
        insight('Ledger lines below', 'Below the staff, short ledger lines carry on the pattern of lines and spaces: F in the space below, E on the first ledger line, D under it, and the open C on the second ledger line.', { kind: 'staff', clef: 'bass', notes: ['C2', 'D2', 'E2', 'F2', 'G2'], labels: true }),
      ]),
      lesson('vc3-3', 'The Whole First Position', 'practice', 'Every natural note from C to D, and the 2nd finger', [
        meet(B, 'F3 C4', { frets: [at(2, 3, 2), at(1, 3, 2)], tips: ['F♮ on the D string: the 2nd finger, a semitone below F♯. Written on the 4th line with no sharp.', 'C♮ on the A string: the 2nd finger, on the ledger line above the staff (middle C).'] }),
        tip('First position in C', 'In C major the 2nd finger plays F and C on the top strings, and the 3rd finger plays E and B on the low strings. The open strings and 1st fingers stay the same.', {
          kind: 'frets',
          positions: [
            { string: 4, fret: 0, label: 'C' }, { string: 4, fret: 2, finger: 1, label: 'D' }, { string: 4, fret: 4, finger: 3, label: 'E' }, { string: 4, fret: 5, finger: 4, label: 'F' },
            { string: 3, fret: 0, label: 'G' }, { string: 3, fret: 2, finger: 1, label: 'A' }, { string: 3, fret: 4, finger: 3, label: 'B' }, { string: 3, fret: 5, finger: 4, label: 'C' },
            { string: 2, fret: 0, label: 'D' }, { string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 3, finger: 2, label: 'F' }, { string: 2, fret: 5, finger: 4, label: 'G' },
            { string: 1, fret: 0, label: 'A' }, { string: 1, fret: 2, finger: 1, label: 'B' }, { string: 1, fret: 3, finger: 2, label: 'C' }, { string: 1, fret: 5, finger: 4, label: 'D' },
          ],
          maxFret: 6,
        }),
        name(B, POS1_C, 18, { sequence: true, title: 'Note rush' }),
        play(B, POS1_C, 12),
        read(B, CG, { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('vc3-4', 'String Crossings', 'learn', 'Move the arm before the bow', [
        tip('Crossing strings', 'Each string has its own bow arm height. To cross, move the whole arm, from the elbow, a moment before the new note, so the bow arrives already on the next string. Small movements close to the string sound smooth; big ones bump.'),
        cpiece('String Crossings in C', 'C', [4, 4], [CROSSINGS], { prompt: 'Up across the strings and back down. The first four bars use the same finger across the strings.' }),
        read(B, POS1_C, { rhythms: RH.quarters, maxLeap: 4, leapiness: 0.7, fingering: 'first' }),
      ]),
      lesson('vc3-5', 'Songs on the Low Strings', 'song', 'Twinkle and a New Orleans march', [
        piece('cello-twinkle'),
        piece('cello-when-the-saints'),
      ]),
      lesson('vc3-c', 'Checkpoint: First Position', 'checkpoint', 'Every natural note from C2 to D4', [
        name(B, POS1_C, 18),
        play(B, POS1_C, 12),
        read(B, CG, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
        read(B, POS1_C, { rhythms: RH.qh, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['A B C', 'D E F', 'C major']),

    // ------------------------------------------------------------------ 4
    unit('vc4', 'Rhythm and the Bow', 'Eighth notes, rests, three-four time, ties and slurs.', [
      lesson('vc4-1', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighth notes', 'An eighth note lasts half a beat; pairs are joined by a beam. Count “1 & 2 &”. Give each eighth a short bow from the middle of the bow: down on the beat, up on the “&”.', { kind: 'staff', clef: 'bass', notes: ['D3/e', 'E3/e', 'F#3/q', 'E3/e', 'D3/e', 'A2/q'], time: [4, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(B, DMAJ, { key: 'D', rhythms: RH.eighths, maxLeap: 1 }),
        read(B, CG, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('vc4-2', 'Rests', 'learn', 'Counted silence', [
        tip('Stopping the sound', 'A rest is counted silence. Stop the bow on the string, without lifting it off with a bump, and keep counting. The next note starts from the string, ready.', { kind: 'staff', clef: 'bass', notes: ['D3/q', 'r/q', 'A3/q', 'r/q', 'F#3/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(B, POS1_C, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('vc4-3', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats, because a dot adds half the note’s value. Save bow on the long notes: you have to get back for the next one.', { kind: 'staff', clef: 'bass', notes: ['C3/q', 'E3/q', 'G3/q', 'C3/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(B, POS1_C, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('vc4-4', 'Ties and Slurs', 'learn', 'Notes that hold over, notes in one bow', [
        tip('Ties', 'A tie joins two notes of the same pitch: play the first and keep it sounding through the second, without a new bow.', { kind: 'staff', clef: 'bass', notes: ['D3/q', 'F#3/q', 'A3/h~', 'A3/h', 'D3/h'], time: [4, 4] }),
        tip('Slurs', 'A curved line over different notes is a slur: play all of them in one bow, changing fingers but not bow direction. Plan the bow’s speed so you don’t run out before the slur ends.'),
        cpiece('Ties Across the Bar', 'D', [4, 4], [TIES_D]),
      ]),
      lesson('vc4-5', 'Songs in Two Keys', 'song', 'Beethoven in D, and a slow Dvořák', [
        piece('cello-ode-to-joy'),
        piece('cello-goin-home'),
      ]),
      lesson('vc4-c', 'Checkpoint: Rhythm', 'checkpoint', 'Eighths, rests and 3/4 in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        read(B, DMAJ, { key: 'D', rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(B, POS1_C, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Eighth notes', 'Rests', '3/4', 'Ties & slurs']),

    // ------------------------------------------------------------------ 5
    unit('vc5', 'Major Scales: C, G and D', 'One-octave scales, key signatures, and the keys of G and D across the strings.', [
      lesson('vc5-1', 'The C Major Scale', 'learn', 'Tones and semitones', [
        scale('C', 'major', 'R', { octave: 2, clef: B }),
        scale('C', 'major', 'R', { octave: 2, clef: B, mode: 'tempo', tempo: 72 }),
        interval(B, CG, [2, 3, 4, 5], 10),
      ], [
        insight('Tones and semitones', 'Every major scale follows the same steps: tone, tone, semitone, tone, tone, tone, semitone. On the cello the two semitones in C major are E–F on the C string (fingers 3 and 4) and B–C on the G string.', { kind: 'staff', clef: 'bass', notes: ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3'], labels: true }),
      ]),
      lesson('vc5-2', 'G Major and F♯', 'learn', 'One sharp', [
        keysig(B, 'C G', 6),
        scale('G', 'major', 'R', { octave: 2, clef: B }),
        read(B, POS1_G, { key: 'G', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('The key of G', 'G major has one sharp, F♯, on the 4th line. On the D string F♯ is the 3rd finger; C on the A string stays natural, the 2nd finger.', { kind: 'staff', clef: 'bass', notes: ['G2', 'F#3'], key: 'G' }),
      ]),
      lesson('vc5-3', 'D Major and C♯', 'learn', 'Two sharps', [
        keysig(B, 'C G D', 8),
        scale('D', 'major', 'R', { octave: 3, clef: B }),
        read(B, DMAJ, { key: 'D', rhythms: RH.eighths, maxLeap: 3 }),
      ], [
        insight('D major on the low strings', 'Low down, D major needs F♯ on the C string and C♯ on the G string, one semitone beyond the 4th finger. Unit 7 opens the hand for them; for now, D major lives on the D and A strings.', { kind: 'staff', clef: 'bass', notes: ['D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C#4', 'D4'], key: 'D' }),
      ]),
      lesson('vc5-4', 'Reading in Three Keys', 'practice', 'Switch between C, G and D', [
        keysig(B, 'C G D', 9),
        read(B, POS1_G, { key: 'G', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
        read(B, POS1_C, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        interval(B, POS1_G, [3, 4, 5, 6], 10, { key: 'G' }),
      ]),
      lesson('vc5-5', 'Aura Lee', 'song', 'A parlour song in G', [
        piece('cello-aura-lee'),
        read(B, POS1_G, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vc5-c', 'Checkpoint: Major Scales', 'checkpoint', 'Scales and key signatures', [
        keysig(B, 'C G D', 8),
        scale('G', 'major', 'R', { octave: 2, clef: B, mode: 'tempo', tempo: 80, rhythm: 'e', fingering: 'first' }),
        read(B, POS1_G, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, DMAJ, { key: 'D', rhythms: RH.qh, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Major scales', 'Keys of G and D', 'Key signatures']),

    // ------------------------------------------------------------------ 6
    unit('vc6', 'Flat Keys and the Backward Extension', 'A low 2nd finger for B♭, F major, then the 1st finger reaching back for E♭ and B♭ major.', [
      lesson('vc6-1', 'B♭ and the Key of F', 'learn', 'One flat', [
        meet(B, 'Bb2', { frets: [at(3, 3, 2)], tips: ['B♭ on the G string: the 2nd finger, a semitone below B. Written on the second line with a flat.'] }),
        keysig(B, 'C F', 6),
        scale('F', 'major', 'R', { octave: 2, clef: B }),
        read(B, POS1_F, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Flats', 'A flat (♭) lowers a note a semitone. F major has one flat, B♭, on the middle line of the key signature: every B is played a semitone lower, with the 2nd finger instead of the 3rd.', { kind: 'staff', clef: 'bass', notes: ['F2', 'Bb2'], key: 'F' }),
      ]),
      lesson('vc6-2', 'The Backward Extension', 'learn', 'The 1st finger reaches back', [
        meet(B, 'Eb3 Bb3', { frets: [at(2, 1, 1), at(1, 1, 1)], tips: ['E♭ on the D string: leave the hand in first position and stretch the 1st finger back a semitone. Written in the third space with a flat.', 'B♭ on the A string: the same backward stretch, just above the staff.'] }),
        read(B, BB_TOP, { key: 'Bb', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Reaching back', 'Only the 1st finger moves: it reaches back towards the scroll while the thumb and the other fingers stay where they are. The 2nd and 4th fingers then fall on F and G as usual.', { kind: 'frets', positions: [{ string: 2, fret: 1, finger: 1, label: 'E♭' }, { string: 2, fret: 3, finger: 2, label: 'F' }, { string: 2, fret: 5, finger: 4, label: 'G' }, { string: 1, fret: 1, finger: 1, label: 'B♭' }, { string: 1, fret: 3, finger: 2, label: 'C' }, { string: 1, fret: 5, finger: 4, label: 'D' }], maxFret: 6 }),
      ]),
      lesson('vc6-3', 'B♭ Major', 'learn', 'Two flats', [
        keysig(B, 'C F Bb', 8),
        scale('Bb', 'major', 'R', { octave: 2, clef: B }),
        read(B, BB_MAJ, { key: 'Bb', rhythms: RH.eighths, maxLeap: 3 }),
      ]),
      lesson('vc6-4', 'Songs in F', 'song', 'A round and a hymn', [
        piece('cello-frere-jacques'),
        piece('cello-amazing-grace'),
      ]),
      lesson('vc6-c', 'Checkpoint: Flat Keys', 'checkpoint', 'Read in F and B♭', [
        keysig(B, 'C G D F Bb', 10),
        read(B, POS1_F, { key: 'F', rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, BB_MAJ, { key: 'Bb', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['B♭ E♭', 'F and B♭ major', 'Backward extension']),

    // ------------------------------------------------------------------ 7
    unit('vc7', 'The Forward Extension', 'The hand opens: F♯ on the C string, C♯ on the G string, and D major from the bottom of the cello.', [
      lesson('vc7-1', 'Opening the Hand', 'learn', 'The 4th finger reaches further', [
        meet(B, 'F#2 C#3', { frets: [at(4, 6, 4), at(3, 6, 4)], tips: ['F♯ on the C string: keep the 1st finger on D and open the hand, so the 4th finger lands a semitone beyond F. Written in the space below the staff with a sharp.', 'C♯ on the G string: the same extended shape, a major third between the 1st and 4th fingers.'] }),
        cpiece('D Major in the Low Octave', 'D', [4, 4], [EXT_LOW_D], { prompt: 'Extended position on the C and G strings: 1, 2 and 4 spread over a major third. Follow the finger numbers.' }),
      ], [
        insight('Extended position', 'In extended position the gap between the 1st and 2nd fingers opens to a whole tone, and the hand covers a major third: 1 on the second semitone, 2 on the fourth, 3 on the fifth, 4 on the sixth. Swing the thumb a little towards the 2nd finger and keep the elbow up.', { kind: 'frets', positions: [{ string: 4, fret: 2, finger: 1, label: 'D' }, { string: 4, fret: 4, finger: 2, label: 'E' }, { string: 4, fret: 6, finger: 4, label: 'F♯' }, { string: 3, fret: 2, finger: 1, label: 'A' }, { string: 3, fret: 4, finger: 2, label: 'B' }, { string: 3, fret: 6, finger: 4, label: 'C♯' }], maxFret: 7 }),
      ]),
      lesson('vc7-2', 'D Major, Two Octaves', 'practice', 'Up from the low D on the C string to D on the A string', [
        cpiece('D Major, Two Octaves', 'D', [4, 4], [D_TWO_OCTAVES], { prompt: 'Extended on the low strings, closed on the high ones. Change the hand shape as you cross from the G string to the D string.' }),
        read(B, EXT_D, { key: 'D', rhythms: RH.qh, maxLeap: 2, fingering: 'none' }),
      ]),
      lesson('vc7-3', 'The Low F♯ in G Major', 'learn', 'G major down to the C string', [
        read(B, EXT_G, { key: 'G', rhythms: RH.qh, maxLeap: 2, fingering: 'none' }),
        piece('cello-eine-kleine'),
      ], [
        insight('G major down low', 'Below the open G, G major needs F♯ on the C string: the extended 4th finger again. D and E stay with the 1st and 2nd fingers of the extended shape.', { kind: 'staff', clef: 'bass', notes: ['D2', 'E2', 'F#2', 'G2'], key: 'G' }),
      ]),
      lesson('vc7-4', 'Ground Bass', 'song', 'Pachelbel’s bass line and a minuet', [
        tip('What is a ground bass?', 'A ground bass is a short bass line repeated again and again while the music above it changes. Playing it steadily, in perfect time, has been the cellist’s job for over three hundred years.'),
        piece('cello-canon-ground'),
        piece('cello-minuet-in-g'),
      ]),
      lesson('vc7-c', 'Checkpoint: Extensions', 'checkpoint', 'D major, two octaves, in time', [
        cpiece('D Major, Two Octaves', 'D', [4, 4], [D_TWO_OCTAVES], { mode: 'tempo', tempo: 66, fingering: 'first' }),
        read(B, EXT_D, { key: 'D', rhythms: RH.eighths, maxLeap: 2, fingering: 'none' }),
        piece('cello-eine-kleine', { mode: 'tempo', fingering: 'first' }),
      ]),
    ], ['Forward extension', 'Low F♯ and C♯', 'D major, two octaves']),

    // ------------------------------------------------------------------ 8
    unit('vc8', 'Dotted Rhythms and Six-Eight', 'Long–short rhythms, compound time, syncopation and a sea shanty.', [
      lesson('vc8-1', 'The Dotted Quarter', 'learn', 'Long–short', [
        tip('The dot', 'A dotted quarter lasts 1½ beats and is usually followed by an eighth: count “1 – & 2”. Use more bow on the long note and a lighter, quicker bow on the short one.', { kind: 'staff', clef: 'bass', notes: ['F#3/q.', 'E3/e', 'D3/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(B, POS1_G, { key: 'G', rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 63 }),
      ]),
      lesson('vc8-2', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighths per bar, felt as two big beats: “ONE two three FOUR five six”. A down-bow on each big beat helps the music sway.', { kind: 'staff', clef: 'bass', notes: ['D3/q', 'E3/e', 'F#3/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(B, DMAJ, { key: 'D', time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
      ]),
      lesson('vc8-3', 'Syncopation', 'learn', 'Accents between the beats', [
        tip('Off the beat', 'Syncopation puts a long note between the beats: eighth–quarter–eighth, counted “1 & – 2 &”. Keep counting steadily and lean into the note that starts on the “&”.', { kind: 'staff', clef: 'bass', notes: ['C3/e', 'E3/q', 'G3/e', 'C3/h'], time: [4, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        read(B, POS1_C, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true }),
      ]),
      lesson('vc8-4', 'Drunken Sailor', 'song', 'A shanty in D minor', [
        piece('cello-drunken-sailor'),
        read(B, DM_TOP, { key: 'Dm', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vc8-c', 'Checkpoint: Rhythm', 'checkpoint', 'Dotted, compound and syncopated rhythms', [
        rhythm([6, 8], RH.compound, { tempo: 66, reps: 1 }),
        read(B, POS1_G, { key: 'G', rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, DMAJ, { key: 'D', time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', '6/8', 'Syncopation']),

    // ------------------------------------------------------------------ 9
    unit('vc9', 'Minor Keys', 'A, D and E minor: relative minors, the raised 7th, and both extensions at work.', [
      lesson('vc9-1', 'A Minor', 'learn', 'The relative minor of C', [
        meet(B, 'G#2 G#3', { frets: [at(3, 1, 1), at(2, 6, 4)], tips: ['G♯ on the G string: the 1st finger reaches back, as it does for B♭ on the A string.', 'G♯ on the D string: the forward extension, the 4th finger a semitone past G.'] }),
        scale('A', 'natural-minor', 'R', { octave: 2, clef: B }),
        cpiece('A Harmonic Minor', 'Am', [4, 4], [A_HARMONIC], { prompt: 'The raised 7th, G♯, is an extended 4th finger on the D string.' }),
        read(B, AM, { key: 'Am', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Relative minor', 'A minor uses the same notes and key signature as C major, but its home note is A. The harmonic minor raises the 7th note, G to G♯, so the melody leans into the home note.', { kind: 'staff', clef: 'bass', notes: ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G#3', 'A3'], key: 'Am' }),
      ]),
      lesson('vc9-2', 'D Minor and E Minor', 'learn', 'One flat; one sharp', [
        keysig(B, 'Am Dm Em', 8),
        scale('D', 'natural-minor', 'R', { octave: 3, clef: B }),
        read(B, DM_TOP, { key: 'Dm', rhythms: RH.qh, maxLeap: 2 }),
        read(B, EM, { key: 'Em', rhythms: RH.qh, maxLeap: 2, fingering: 'none' }),
      ], [
        insight('Two more minors', 'D minor shares F major’s flat (B♭, the backward 1st finger on the A string). E minor shares G major’s sharp, and down on the C string its F♯ is the extended 4th finger.', { kind: 'staff', clef: 'bass', notes: ['D3', 'Bb3', 'E2', 'F#2'], key: 'C' }),
      ]),
      lesson('vc9-3', 'Minor-Key Ballads', 'song', 'Two English ballads', [
        piece('cello-scarborough-fair'),
        piece('cello-greensleeves'),
      ], [
        insight('The Dorian sound', 'Scarborough Fair uses the Dorian mode: D minor with a raised 6th, so B♮ instead of B♭. Watch for the natural signs, and listen to how the B♮ brightens the tune.', { kind: 'staff', clef: 'bass', notes: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'], key: 'Dm' }),
      ]),
      lesson('vc9-4', 'Pizzicato', 'learn', 'Plucking the strings', [
        tip('Pizzicato', 'Pizzicato (pizz.) means plucked. Hold the bow in your hand, rest the thumb against the edge of the fingerboard, and pluck with the side of the index finger over the end of the fingerboard. “Arco” means take the bow again.'),
        piece('cello-mountain-king'),
      ]),
      lesson('vc9-c', 'Checkpoint: Minor Keys', 'checkpoint', 'Read in A, D and E minor', [
        keysig(B, 'C G D F Bb Am Dm Em', 10),
        read(B, AM, { key: 'Am', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(B, DM_TOP, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['A, D and E minor', 'Harmonic minor', 'Pizzicato']),

    // ------------------------------------------------------------------ 10
    unit('vc10', 'Two-Octave Scales and Arpeggios', 'The whole of first position in one breath, broken chords, and Bach.', [
      lesson('vc10-1', 'C Major, Two Octaves', 'learn', 'From the open C to middle C', [
        scale('C', 'major', 'R', { octaves: 2, octave: 2, clef: B }),
        scale('C', 'major', 'R', { octaves: 2, octave: 2, clef: B, mode: 'tempo', tempo: 72, rhythm: 'e' }),
      ], [
        insight('Two octaves in one position', 'First position spans two octaves and a tone, from the open C to D on the A string. C major fits completely: no shifts, just clean string crossings.', { kind: 'staff', clef: 'bass', notes: ['C2', 'G2', 'C3', 'G3', 'C4'], labels: true }),
      ]),
      lesson('vc10-2', 'Arpeggios', 'learn', 'Chords one note at a time', [
        cpiece('Arpeggios in C and G', 'C', [4, 4], [ARPEGGIOS], { prompt: 'Root, 3rd, 5th, octave: the notes of a chord, climbing and falling across the strings.' }),
        interval(B, POS1_C, [3, 5, 8], 10),
      ], [
        insight('Arpeggio', 'An arpeggio plays a chord’s notes one after another: the root, the 3rd, the 5th and the octave. Arpeggios are everywhere in cello music, from Bach to film scores.', { kind: 'staff', clef: 'bass', notes: ['C2', 'E2', 'G2', 'C3'], labels: true }),
      ]),
      lesson('vc10-3', 'Scales in Time', 'practice', 'D major again, and broken chords', [
        cpiece('D Major, Two Octaves', 'D', [4, 4], [D_TWO_OCTAVES], { mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, POS1_C, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.5, harmonic: true, fingering: 'first' }),
      ]),
      lesson('vc10-4', 'Bach', 'song', 'The first cello suite', [
        tip('The cello suites', 'Around 1720 Bach wrote six suites for cello alone, and the Prelude of the first rolls across the strings in broken chords over the open G. Keep the bow close to the strings and let small movements of the arm do the crossings.'),
        piece('cello-bach-prelude'),
      ]),
      lesson('vc10-c', 'Checkpoint: Scales and Arpeggios', 'checkpoint', 'Two octaves and broken chords', [
        scale('C', 'major', 'R', { octaves: 2, octave: 2, clef: B, mode: 'tempo', tempo: 76, rhythm: 'e', fingering: 'first' }),
        cpiece('Arpeggios in C and G', 'C', [4, 4], [ARPEGGIOS], { mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, POS1_C, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, fingering: 'none' }),
      ]),
    ], ['Two-octave scales', 'Arpeggios', 'Bach']),

    // ------------------------------------------------------------------ 11
    unit('vc11', 'Fourth Position and Shifting', 'Up to the end of the neck: D, E and F on the A string, G, A and B♭ on the D string.', [
      lesson('vc11-1', 'Fourth Position', 'learn', 'The hand at the heel of the neck', [
        meet(B, 'D4 E4 F4', { frets: [at(1, 5, 1), at(1, 7, 3), at(1, 8, 4)], tips: ['D in fourth position: the 1st finger on the A string, where the 4th finger played D in first position.', 'E: the 3rd finger, a whole tone higher, on the second ledger line above the staff.', 'F: the 4th finger, a semitone above E, just above the second ledger line.'] }),
        name(B, 'A3 B3 C4 D4 E4 F4', 12),
        read(B, POS4, { key: 'F', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Fourth position', 'In fourth position the 1st finger sits a fourth above the open string, and your thumb rests where the neck curves into the body: an easy place to find without looking. The fingers keep their first-position spacing: a semitone apart, 1 to 4 a minor third.', { kind: 'frets', positions: [{ string: 1, fret: 5, finger: 1, label: 'D' }, { string: 1, fret: 7, finger: 3, label: 'E' }, { string: 1, fret: 8, finger: 4, label: 'F' }, { string: 2, fret: 5, finger: 1, label: 'G' }, { string: 2, fret: 7, finger: 3, label: 'A' }, { string: 2, fret: 8, finger: 4, label: 'B♭' }], minFret: 3, maxFret: 10 }),
      ]),
      lesson('vc11-2', 'Shifting', 'learn', 'Move the whole hand', [
        tip('How to shift', 'Lighten the finger you are on, slide it along the string as the arm carries the hand up, and only press again when you arrive. Let the arm lead and the thumb travel with the hand. A shift on an open string is free: the hand moves while the string rings.'),
        cpiece('Shifting to Fourth Position', 'Dm', [4, 4], [SHIFT_UP], { prompt: 'First position up to D, then slide the 4th finger’s D into fourth position’s 1st finger. Follow the finger numbers.' }),
        read(B, POS4, { key: 'Dm', guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vc11-3', 'D Major in Fourth Position', 'learn', 'The extension up the neck', [
        meet(B, 'F#4 B3', { frets: [at(1, 9, 4), at(2, 9, 4)], tips: ['F♯ on the A string: in fourth position the 4th finger extends a semitone, just as it does in first position.', 'B on the D string: the same extended 4th finger.'] }),
        read(B, POS4_D, { key: 'D', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, fingering: 'none', prompt: 'Fourth position: 1st finger on D and G, 3rd on E and A, the extended 4th on F♯ and B.' }),
      ]),
      lesson('vc11-4', 'Across Two Positions', 'practice', 'First and fourth position together', [
        cpiece('Shifting to Fourth Position', 'Dm', [4, 4], [SHIFT_UP], { mode: 'tempo', tempo: 66, fingering: 'first' }),
        read(B, POS4, { key: 'F', guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vc11-c', 'Checkpoint: Fourth Position', 'checkpoint', 'Read and shift up the neck', [
        read(B, POS4, { key: 'Dm', guitarPosition: 5, rhythms: RH.dottedRests, maxLeap: 3, fingering: 'first' }),
        read(B, POS4_D, { key: 'D', guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
        cpiece('Shifting to Fourth Position', 'Dm', [4, 4], [SHIFT_UP], { mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['Fourth position', 'Shifting', 'Extensions up the neck']),

    // ------------------------------------------------------------------ 12
    unit('vc12', 'The Tenor Clef', 'The cellist’s second clef, clef changes, and a final repertoire and exam.', [
      lesson('vc12-1', 'Meet the Tenor Clef', 'learn', 'Middle C on the 4th line', [
        meet(TN, 'D4 A3 E4', { frets: [at(1, 5, 1), at(1, 0, 0), at(1, 7, 3)], tips: ['D, the 1st finger in fourth position, sits in the top space of the tenor clef. In the bass clef it needs a ledger line.', 'The open A string is the middle line.', 'E, the 3rd finger in fourth position, is the top line.'] }),
        name(TN, TENOR_NAMES, 14),
        play(TN, 'A3 B3 C4 D4 E4', 8, { hints: true }),
      ], [
        insight('Why another clef?', 'The tenor clef is a C clef: the line it points to is middle C, here the 4th line. It puts the cello’s high notes on the staff instead of on ledger lines. Bassoons and trombones read it too.', { kind: 'staff', clef: 'tenor', notes: ['C4', 'D4', 'E4', 'F4'], labels: true }),
        insight('Reading it', 'Every line and space of the tenor clef is a fifth higher than in the bass clef: the bottom line is D instead of G, the middle line A instead of D, the top line E instead of A. Learn the middle line (A, your open string) and middle C (the 4th line) and count from there.', { kind: 'staff', clef: 'tenor', notes: ['D3', 'F3', 'A3', 'C4', 'E4'], labels: true }),
      ]),
      lesson('vc12-2', 'Reading in the Tenor Clef', 'practice', 'Fourth position, without ledger lines', [
        name(TN, TENOR_NAMES, 16, { sequence: true, title: 'Note rush' }),
        read(TN, POS4, { key: 'F', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        read(TN, TENOR_READ, { key: 'Dm', guitarPosition: 5, rhythms: RH.eighths, maxLeap: 4, leapiness: 0.4, fingering: 'first' }),
      ]),
      lesson('vc12-3', 'Changing Clefs', 'learn', 'From bass to tenor and back', [
        tip('Clef changes', 'A small clef in the middle of a line changes the clef from that point on. Cello music switches to the tenor clef as a melody climbs, and back to the bass clef as it comes down. Read the new clef before the note after it.'),
        cpiece('Bass to Tenor and Back', 'Dm', [4, 4], [CLEF_CHANGE], { prompt: 'Bar 3 changes to the tenor clef: shift to fourth position. The last bar changes back.' }),
        piece('cello-tenor-song'),
      ]),
      lesson('vc12-4', 'Final Repertoire', 'song', 'A minuet and the Mountain King, in time', [
        piece('cello-minuet-in-g', { mode: 'tempo', fingering: 'first' }),
        piece('cello-mountain-king', { mode: 'tempo', fingering: 'first' }),
      ]),
      lesson('vc12-5', 'Sight-Reading Sprint', 'challenge', 'Read at tempo, in both clefs', [
        name(B, FULL, 30, { sequence: true, title: 'Lightning round' }),
        read(B, POS1_C, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(TN, POS4, { key: 'F', guitarPosition: 5, rhythms: RH.syncopation, maxLeap: 3, mode: 'tempo', tempo: 69, fingering: 'none' }),
      ]),
      lesson('vc12-c', 'Final Exam: Cello', 'checkpoint', 'Prove your mastery', [
        name(B, FULL, 30, { sequence: true }),
        keysig(B, 'C G D F Bb Am Dm Em', 10),
        read(B, POS1_C, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none', measures: 6 }),
        read(TN, POS4, { key: 'F', guitarPosition: 5, time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
        read(B, DM_TOP, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Tenor clef', 'Clef changes', 'Sight-reading']),
  ],
};
