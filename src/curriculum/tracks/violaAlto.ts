import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, Insight, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Viola · Alto clef. Viola music SOUNDS AS WRITTEN and is read in the alto clef, a C
 * clef whose centre marks middle C on the middle line. The open strings, numbered from
 * the highest, are 1 = A4, 2 = D4, 3 = G3, 4 = C3: a fifth below the violin's. The open C
 * hangs below one ledger line; the open A sits in the space above the staff.
 *
 * The left hand works exactly like a violinist's (see autofinger.ts): in first position
 * the 1st finger lies a tone above the open string, the 2nd finger low (a semitone
 * higher) or high (a tone higher), the 3rd a semitone above a high 2nd, the 4th
 * sounding the next open string. Third position (`guitarPosition: 5`) puts the 1st
 * finger where the 3rd was. High passages switch to the treble clef, taught in the last
 * unit.
 *
 * Bowing, posture, pizzicato and slurs are taught in the insight cards; the activities
 * check the notes.
 */
const A = 'alto' as const;
const TR = 'treble' as const;

/** A fingerboard place for `meet`: string (1 = A, 2 = D, 3 = G, 4 = C), semitone above the open string, finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- First-position pitch pools (sounding = written) ----
const OPEN = 'C3 G3 D4 A4';
const FIRST1 = 'D4 E4 A4 B4';
const HIGH2 = 'D4 E4 F#4 A4 B4 C#5';
const D_MAJ = 'D4 E4 F#4 G4 A4 B4 C#5 D5';
const D_MAJ_E = 'D4 E4 F#4 G4 A4 B4 C#5 D5 E5';
const G_STR = 'G3 A3 B3 C4 D4';
const G_MAJ = 'G3 A3 B3 C4 D4 E4 F#4 G4';
const G_MAJ_WIDE = 'G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4';
const C_STR = 'C3 D3 E3 F3 G3';
const C_MAJ = 'C3 D3 E3 F3 G3 A3 B3 C4';
const C_MAJ_WIDE = 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4';
const C_MAJ2 = 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5';
const F_MAJ = 'C3 D3 E3 F3 G3 A3 Bb3 C4 D4 E4 F4';
const BB_MAJ = 'F3 G3 A3 Bb3 C4 D4 Eb4 F4 G4 A4 Bb4';
const D_MAJ_LOW = 'A3 B3 C#4 D4 E4 F#4 G4 A4';
const CHROMATIC = 'G3 Ab3 A3 Bb3 B3 C4 C#4 D4 Eb4 E4 F4 F#4 G4';
const D_MIN = 'D4 E4 F4 G4 A4 Bb4 C5 D5';
const D_MIN_H = 'D4 E4 F4 G4 A4 Bb4 C#5 D5';
const G_MIN = 'G3 A3 Bb3 C4 D4 Eb4 F4 G4';
const G_MIN_H = 'G3 A3 Bb3 C4 D4 Eb4 F#4 G4';
const C_MIN = 'C3 D3 Eb3 F3 G3 Ab3 Bb3 C4';
const FULL1 = 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5';
// ---- Third position (1st finger a fourth above the open string) ----
const POS3_A = 'D5 E5 F#5 G5';
const POS3_DA = 'G4 A4 B4 C5 D5 E5 F#5 G5';
const POS3_DA_C = 'G4 A4 B4 C5 D5 E5 F5 G5';
const TREBLE = 'A4 B4 C5 D5 E5 F5 G5';
const FULL = 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5';

const fretsVisual = (positions: { string: number; fret: number; label?: string; finger?: number }[], minFret?: number, maxFret?: number): Insight['visual'] => ({ kind: 'frets', positions, minFret, maxFret });

function vapiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: A, voices }], o);
}

// ---- Études (string and finger choices written where they are the point: @finger %string) ----
const CROSSINGS = 'G3/q D4 G3 D4 | G3/h D4/h | C3/q G3 C3 G3 | C3/h G3/h | D4/q A4 D4 A4 | D4/h A4/h | G3/q D4 C3 G3 | G3/w |';
const FOURTH_FINGER = 'D4/q@0 E4@1 F#4@2 G4@3 | A4/h@4%2 A4/h@0%1 | A4/q@0 B4@1 C#5@2 D5@3 | E5/w@4%1 | D5/q@3 C#5@2 B4@1 A4@4%2 | G4@3 F#4@2 E4@1 D4@0 | A4/q@4%2 G4@3 F#4@2 E4@1 | D4/w@0 |';
const C_STRING = 'C3/q D3 E3 F3 | G3/h E3/h | C3/q E3 G3 E3 | D3/w | E3/q F3 G3 A3 | B3/q G3 D3/h | E3/q D3 C3 D3 | C3/w |';
const TIES = 'C4/q E4 G4 A4~ | A4/q G4 E4 G4 | F4/h A4/h~ | A4/q F4 D4 E4 | C4/q E4 G4 C5~ | C5/q A4 B4 G4 | C5/w |';
const SLURS = 'C4/e D4 E4 F4 G4/q G4 | A4/e G4 F4 E4 D4/q D4 | E4/e F4 G4 E4 C4/q E4 | D4/e C4 B3 D4 C4/h | G4/e F4 E4 D4 E4/q C4 | F4/e E4 D4 C4 B3/q G3 | A3/e B3 C4 D4 E4/q D4 | C4/w |';
const CHROMATIC_G = 'G3/e@0%3 Ab3@1%3 A3@1%3 Bb3@2%3 B3@2%3 C4@3%3 C#4@3%3 D4@4%3 | D4/e@4%3 Db4@3%3 C4@3%3 B3@2%3 Bb3@2%3 A3@1%3 Ab3@1%3 G3@0%3 | D4/e@0%2 Eb4@1%2 E4@1%2 F4@2%2 F#4@2%2 G4@3%2 G#4@3%2 A4@4%2 | A4/e@4%2 Ab4@3%2 G4@3%2 F#4@2%2 F4@2%2 E4@1%2 Eb4@1%2 D4/e@0%2 |';
const NEIGHBOURS = 'D4/q C#4 D4 | E4/h D4/q | A4/q G#4 A4 | B4/h. | E4/q D#4 E4 | F#4/h E4/q | A3/q G#3 A3 | D4/h. | D4/q C#4 D4 | B3/h A3/q | G3/q F#3 G3 | A3/h B3/q | A3/q G3 F#3 | G3/h. |';
const SHIFTING =
  'D4/q@0%2 E4@1%2 F#4@2%2 G4@3%2 | A4/h@0%1 D4/h@0%2 | G4/q@1%2 A4@2%2 B4@3%2 C5@4%2 | B4/h@3%2 G4/h@1%2 | ' +
  'E4/q@1%2 F#4@2%2 G4@3%2 A4@2%2 | B4/q@3%2 C5@4%2 D5/h@1%1 | E5/q@2%1 D5@1%1 C5@4%2 B4@3%2 | A4/h@2%2 D4/h@0%2 |';
const DRONE_STUDY = '[G3 D4]/h@0,0%3,2 [G3 E4]@0,1%3,2 | [G3 F#4]/h@0,2%3,2 [G3 D4]@0,0%3,2 | [G3 E4]/q@0,1%3,2 [G3 F#4]@0,2%3,2 [G3 G4]/h@0,3%3,2 | [G3 D4]/w@0,0%3,2 | [A3 D4]/h@1,0%3,2 [B3 D4]@2,0%3,2 | [C4 D4]/h@3,0%3,2 [B3 D4]@2,0%3,2 | [A3 D4]/q@1,0%3,2 [B3 D4]@2,0%3,2 [C4 D4]@3,0%3,2 [A3 D4]@1,0%3,2 | [G3 D4]/w@0,0%3,2 |';
const TREBLE_STUDY = 'A4/q@0%1 B4@1%1 C5@2%1 D5@1%1 | E5/h@2%1 D5/h@1%1 | C5/q@4%2 D5@1%1 E5@2%1 F5@3%1 | G5/w@4%1 | G5/q@4%1 F5@3%1 E5@2%1 D5@1%1 | E5/h@2%1 C5/h@4%2 | D5/q@1%1 C5@4%2 B4@3%2 A4@2%2 | C5/w@4%2 |';

export const violaAlto: TrackDef = {
  id: 'viola-alto',
  instrument: 'viola',
  title: 'Alto Clef',
  subtitle: 'Viola · Reading music',
  description: 'Read the viola’s own clef, the alto clef, from the open C string to third position: finger patterns, the keys of C, G, D, F and B♭, minor keys, rhythm in 3/4 and 6/8, shifting, the treble clef for high notes, double stops and a songbook.',
  clef: 'alto',
  accent: '#d4a373',
  glyph: '𝄡',
  heatmap: [{ clef: 'alto', low: 'C3', high: 'G5' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('va1', 'The Open Strings & the Alto Clef', 'C, G, D and A in the viola’s own clef, the bow, and your first tune.', [
      lesson('va1-1', 'Open D and A', 'learn', 'Meet the alto clef and two notes', [
        meet(A, 'D4', { frets: [at(2, 0, 0)], tips: ['The open 2nd string is D. In the alto clef it sits in the space just above the middle line.'] }),
        meet(A, 'A4', { frets: [at(1, 0, 0)], tips: ['The open 1st string is A, in the space just above the staff.'] }),
        name(A, 'D4 A4', 8),
        play(A, 'D4 A4', 8, { hints: true }),
      ], [
        insight('The alto clef', 'Viola music has a clef of its own. The alto clef is a C clef: the point where its two curves meet marks middle C, on the middle line. The viola’s notes sit right in the middle of this staff, with few ledger lines.', { kind: 'staff', clef: 'alto', notes: ['C4'], labels: true }),
        insight('Four strings, a fifth apart', 'The viola’s open strings are C, G, D and A, a fifth below the violin’s. Violists number them from the highest: A is the 1st string, D the 2nd, G the 3rd and C the 4th.', { kind: 'staff', clef: 'alto', notes: ['C3', 'G3', 'D4', 'A4'], labels: true }),
        insight('Holding the viola', 'Rest the viola on your left collarbone with your jaw on the chin rest. It is bigger and heavier than a violin, so let the head and shoulder carry it, and keep the left arm free. Violas come in sizes measured in inches, from about 12 to 17.'),
      ]),
      lesson('va1-2', 'Open G and C', 'learn', 'The two lower strings', [
        meet(A, 'G3', { frets: [at(3, 0, 0)], tips: ['The open 3rd string is G, in the bottom space of the staff.'] }),
        meet(A, 'C3', { frets: [at(4, 0, 0)], tips: ['The open 4th string is C, the viola’s lowest note and its richest sound. It hangs below one ledger line under the staff.'] }),
        name(A, OPEN, 10),
        play(A, OPEN, 10, { hints: true }),
      ], [
        insight('Below the staff', 'Notes below the staff borrow ledger lines. Under the bottom line (F) comes E in the space, D on the first ledger line, and the open C just below it.', { kind: 'staff', clef: 'alto', notes: ['F3', 'E3', 'D3', 'C3'], labels: true }),
        insight('Strings on the screen', 'On the fingerboard below, the A string is at the top and the thick C string at the bottom, the way you see them looking down the viola.', fretsVisual([{ string: 1, fret: 0, label: 'A' }, { string: 2, fret: 0, label: 'D' }, { string: 3, fret: 0, label: 'G' }, { string: 4, fret: 0, label: 'C' }], 0, 4)),
        insight('Pizzicato first', 'You can start by plucking: rest your right thumb on the corner of the fingerboard and pluck with the pad of your index finger. pizz. means pluck; arco means play with the bow.'),
      ]),
      lesson('va1-3', 'The Bow and the Beat', 'practice', 'Open strings in time', [
        tip('Counting beats', 'A quarter note lasts one beat; a half note lasts two. In 4/4 there are four beats in every bar: count “1 2 3 4” as you play. Use half the bow for a quarter note and the whole bow for a half note.', { kind: 'staff', clef: 'alto', notes: ['G3/q', 'G3/q', 'D4/h', 'D4/q', 'D4/q', 'G3/h'], time: [4, 4] }),
        read(A, OPEN, { rhythms: RH.quarters, maxLeap: 4, leapiness: 0.8, measures: 2, noteNames: true, title: 'Your first melody' }),
        rhythm([4, 4], RH.qh, { tempo: 72 }),
        read(A, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8 }),
        name(A, OPEN, 12, { sequence: true, title: 'Note rush' }),
      ], [
        insight('Holding the bow', 'Curve your thumb and rest its tip on the stick where it meets the frog. The fingers drape over the stick; the little finger sits curved on top. A viola bow is a little heavier than a violin bow: let its weight do the work.'),
        insight('Where the bow goes', 'Draw the bow halfway between the bridge and the end of the fingerboard, straight and parallel to the bridge. The C string needs a slower, heavier bow to speak; the A string a lighter one.'),
      ]),
      lesson('va1-4', 'Open-String March', 'song', 'Your first tune: open strings only', [
        vapiece('Crossing Strings', 'C', [4, 4], [CROSSINGS], { prompt: 'Change your arm’s height for each string: highest for the C string, lowest for the A.' }),
        piece('viola-open-string-march'),
      ], [
        insight('String crossings', 'Each string has its own bow level. Your right elbow moves with the bow: high for the C string, low for the A string. Move the arm a moment before the change, so each new note starts cleanly.'),
      ]),
      lesson('va1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Name and play C, G, D and A in the alto clef', [
        name(A, OPEN, 12),
        play(A, OPEN, 8),
        read(A, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8, fingering: 'first' }),
      ]),
    ], ['C G D A', 'The alto clef', 'Quarter & half notes']),

    // ------------------------------------------------------------------ 2
    unit('va2', 'First and Second Fingers', 'E and B with the 1st finger, F♯ and C♯ with a high 2nd, and your first songs.', [
      lesson('va2-1', 'First Finger: E and B', 'learn', 'Your first stopped notes', [
        meet(A, 'E4 B4', { frets: [at(2, 2, 1), at(1, 2, 1)], tips: ['E on the D string: the 1st finger a tone above the open string. It sits on the fourth line.', 'B on the A string, also 1st finger, on the first ledger line above the staff.'] }),
        name(A, FIRST1, 10),
        play(A, FIRST1, 8, { hints: true }),
        read(A, FIRST1, { rhythms: RH.quarters, maxLeap: 4, measures: 2, noteNames: true }),
      ], [
        insight('Left-hand fingers', 'Index = 1, middle = 2, ring = 3, little finger = 4, and 0 means an open string. Thin tapes on the fingerboard show where the fingers go in first position until your ear and hand know.', fretsVisual([{ string: 1, fret: 0, label: 'A' }, { string: 1, fret: 2, finger: 1 }, { string: 1, fret: 4, finger: 2 }, { string: 1, fret: 5, finger: 3 }, { string: 1, fret: 7, finger: 4 }], 0, 8)),
        insight('No frets: you place every note', 'The viola has no frets, so the pitch is where your fingertip stops the string. The viola’s strings are longer than a violin’s, so the fingers spread a little wider. Listen: too high, slide towards the scroll; too low, towards the bridge.'),
      ]),
      lesson('va2-2', 'Counting Time', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'In 4/4 a quarter note lasts 1 beat, a half note 2 and a whole note 4. Spread a long note over the whole bow and keep the speed steady to the end.', { kind: 'staff', clef: 'alto', notes: ['D4/q', 'E4/q', 'A4/h', 'B4/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(A, FIRST1, { rhythms: RH.qhw, maxLeap: 4, mode: 'tempo', tempo: 63 }),
      ]),
      lesson('va2-3', 'High Second Finger: F♯ and C♯', 'learn', 'The 2nd finger, a tone above the 1st', [
        meet(A, 'F#4 C#5', { frets: [at(2, 4, 2), at(1, 4, 2)], tips: ['F♯ on the D string: the 2nd finger a tone above the 1st, in the top space of the staff.', 'C♯ on the A string, the same high 2nd finger, just above the first ledger line.'] }),
        name(A, HIGH2, 12),
        play(A, HIGH2, 10, { hints: true }),
        read(A, HIGH2, { key: 'D', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('The key of D', 'The two sharps after the clef are the key signature of D major: every F is F♯ and every C is C♯. In the alto clef the F♯ sits in the top space and the C♯ just above the first ledger line.', { kind: 'staff', clef: 'alto', notes: ['D4', 'E4', 'F#4', 'A4', 'B4', 'C#5'], key: 'D', labels: true }),
      ]),
      lesson('va2-4', 'Hot Cross Buns & Mary', 'song', 'Two songs with three fingers', [
        piece('viola-hot-cross-buns'),
        piece('viola-mary-had-a-little-lamb'),
      ]),
      lesson('va2-c', 'Checkpoint: Two Fingers', 'checkpoint', 'D, E, F♯, A, B and C♯ in time', [
        name(A, HIGH2, 12),
        play(A, HIGH2, 8),
        read(A, HIGH2, { key: 'D', rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['E F♯ B C♯', 'Finger numbers', 'Whole notes']),

    // ------------------------------------------------------------------ 3
    unit('va3', 'The D Major Scale', 'Third and fourth fingers, the D major pattern, rests and two folk tunes.', [
      lesson('va3-1', 'Third Finger: G and D', 'learn', 'Fingers 2 and 3 side by side', [
        meet(A, 'G4 D5', { frets: [at(2, 5, 3), at(1, 5, 3)], tips: ['G on the D string: the 3rd finger, touching the 2nd. It sits on the top line.', 'D on the A string, 3rd finger, on the second ledger line above the staff: an octave above the open D.'] }),
        name(A, D_MAJ, 14),
        play(A, 'E4 F#4 G4 B4 C#5 D5', 10, { hints: true }),
        read(A, D_MAJ, { key: 'D', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('The D major pattern', 'On the D and A strings in D major the fingers fall in the same pattern: a tone, a tone, then a semitone, so fingers 2 and 3 touch. This is the 0 1 23 pattern, or “high 2”.', fretsVisual([{ string: 2, fret: 0, label: 'D' }, { string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 4, finger: 2, label: 'F♯' }, { string: 2, fret: 5, finger: 3, label: 'G' }, { string: 1, fret: 0, label: 'A' }, { string: 1, fret: 2, finger: 1, label: 'B' }, { string: 1, fret: 4, finger: 2, label: 'C♯' }, { string: 1, fret: 5, finger: 3, label: 'D' }], 0, 7)),
      ]),
      lesson('va3-2', 'The D Major Scale', 'learn', 'Eight notes up and down', [
        scale('D', 'major', 'R', { octave: 4, clef: A }),
        scale('D', 'major', 'R', { octave: 4, clef: A, mode: 'tempo', tempo: 72 }),
        read(A, D_MAJ, { key: 'D', rhythms: RH.qh, maxLeap: 3, leapiness: 0.4 }),
      ], [
        insight('A scale is a ladder', 'A scale climbs from a note to the same note an octave higher, step by step. D major uses the same finger pattern on two strings: D string, then A string.', { kind: 'staff', clef: 'alto', notes: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'], key: 'D' }),
      ]),
      lesson('va3-3', 'Rests', 'learn', 'Counted silence', [
        tip('Silence on a bowed string', 'A rest is counted silence. Stop the bow on the string to end the note, keep counting, and get ready for the next one.', { kind: 'staff', clef: 'alto', notes: ['D4/q', 'r/q', 'F#4/q', 'r/q', 'A4/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(A, D_MAJ, { key: 'D', rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('va3-4', 'The Fourth Finger', 'learn', 'The little finger reaches the next string’s note', [
        meet(A, 'A4 E5', { frets: [at(2, 7, 4), at(1, 7, 4)], tips: ['A with the 4th finger on the D string: the same pitch as the open A string beside it.', 'E with the 4th finger on the A string. The viola has no E string, so this is the way to reach it in first position.'] }),
        vapiece('Fourth-Finger Étude', 'D', [4, 4], [FOURTH_FINGER], { prompt: 'Play each 4th-finger A, then the open A. They should sound exactly the same.' }),
        read(A, D_MAJ_E, { key: 'D', rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('Ringing tones', 'When a stopped note matches an open string, that string starts vibrating by itself and the viola rings. A 4th-finger A that rings with the open A, or a 3rd-finger G that rings with the open G, is perfectly in tune.', fretsVisual([{ string: 2, fret: 7, finger: 4, label: 'A' }, { string: 1, fret: 0, label: 'A' }], 0, 8)),
      ]),
      lesson('va3-5', 'Lightly Row & London Bridge', 'song', 'Two folk tunes in D', [
        piece('viola-lightly-row'),
        piece('viola-london-bridge'),
      ]),
      lesson('va3-c', 'Checkpoint: D Major', 'checkpoint', 'The D major scale and tunes in time', [
        name(A, D_MAJ, 14),
        play(A, D_MAJ, 10),
        scale('D', 'major', 'R', { octave: 4, clef: A, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(A, D_MAJ, { key: 'D', rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['G and D', 'D major scale', 'Rests', '4th finger']),

    // ------------------------------------------------------------------ 4
    unit('va4', 'The G String & G Major', 'A, B and C on the G string, the G major scale and waltz time.', [
      lesson('va4-1', 'The G String: A, B and C', 'learn', 'Down to middle C', [
        meet(A, 'A3 B3 C4', { frets: [at(3, 2, 1), at(3, 4, 2), at(3, 5, 3)], tips: ['A on the G string, 1st finger, on the second line.', 'B with a high 2nd finger, in the second space.', 'C, middle C, with the 3rd finger: the middle line, where the alto clef points.'] }),
        name(A, G_STR, 10),
        play(A, G_STR, 8, { hints: true }),
        read(A, G_STR, { key: 'G', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('The lower half of the staff', 'G, A, B and C climb from the bottom space to the middle line. Middle C on the middle line is the alto clef’s anchor: count up or down from it.', { kind: 'staff', clef: 'alto', notes: ['G3', 'A3', 'B3', 'C4'], labels: true }),
      ]),
      lesson('va4-2', 'The G Major Scale', 'learn', 'One sharp, the high-2 pattern on two strings', [
        scale('G', 'major', 'R', { octave: 3, clef: A }),
        scale('G', 'major', 'R', { octave: 3, clef: A, mode: 'tempo', tempo: 72 }),
        read(A, G_MAJ, { key: 'G', rhythms: RH.qh, maxLeap: 3 }),
      ], [
        insight('The key of G', 'G major has one sharp, F♯. On the G and D strings it uses exactly the same high-2 pattern as D major on the D and A strings, a string lower.', { kind: 'staff', clef: 'alto', notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'], key: 'G' }),
      ]),
      lesson('va4-3', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats, because a dot adds half of the note’s value. Save bow on the long notes.', { kind: 'staff', clef: 'alto', notes: ['G3/q', 'B3/q', 'D4/q', 'G4/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(A, G_MAJ, { key: 'G', time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
        read(A, D_MAJ, { key: 'D', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('va4-4', 'Ode to Joy & Frère Jacques', 'song', 'Beethoven on the G string and a round in D', [
        piece('viola-ode-to-joy'),
        piece('viola-frere-jacques'),
      ], [
        insight('Loud and soft', 'f (forte) means loud and p (piano) soft. For a louder note use more bow and weight, a little nearer the bridge; for a softer one, less of each, nearer the fingerboard.'),
      ]),
      lesson('va4-c', 'Checkpoint: G Major', 'checkpoint', 'G and D major in time', [
        name(A, G_MAJ_WIDE, 14),
        play(A, G_MAJ, 10),
        scale('G', 'major', 'R', { octave: 3, clef: A, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(A, G_MAJ, { key: 'G', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['G-string notes', 'G major scale', '3/4 time']),

    // ------------------------------------------------------------------ 5
    unit('va5', 'The C String & C Major', 'D, E and F on the C string, the C major scale and eighth notes.', [
      lesson('va5-1', 'The C String: D, E and F', 'learn', 'The viola’s deepest notes', [
        meet(A, 'D3 E3 F3', { frets: [at(4, 2, 1), at(4, 4, 2), at(4, 5, 3)], tips: ['D on the C string, 1st finger, on the ledger line below the staff.', 'E with a high 2nd finger, in the space just below the staff.', 'F with the 3rd finger, on the bottom line.'] }),
        name(A, C_STR, 10),
        play(A, C_STR, 8, { hints: true }),
        vapiece('C-String Song', 'C', [4, 4], [C_STRING], { prompt: 'The C string needs a slow, heavy bow. Let each note ring.' }),
      ], [
        insight('The C string', 'The C string is what makes a viola sound like a viola: dark and warm. Give it a slower bow with more arm weight, and raise your right elbow higher than for any other string.', { kind: 'staff', clef: 'alto', notes: ['C3', 'D3', 'E3', 'F3', 'G3'], labels: true }),
      ]),
      lesson('va5-2', 'The C Major Scale', 'learn', 'No sharps, no flats', [
        scale('C', 'major', 'R', { octave: 3, clef: A }),
        scale('C', 'major', 'R', { octave: 3, clef: A, mode: 'tempo', tempo: 72 }),
        keysig(A, 'C G D', 6),
        read(A, C_MAJ, { rhythms: RH.qh, maxLeap: 3 }),
      ], [
        insight('C major on the viola', 'The lower octave of C major uses the high-2 pattern twice: C D E F on the C string, G A B C on the G string. It is the viola’s home key.', { kind: 'staff', clef: 'alto', notes: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'] }),
      ]),
      lesson('va5-3', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighth notes', 'An eighth note lasts half a beat; pairs are joined by a beam. Count “1 & 2 &”. Use short, even bows in the middle of the bow, down on the beat and up on the “&”.', { kind: 'staff', clef: 'alto', notes: ['C4/e', 'D4/e', 'E4/q', 'E4/e', 'D4/e', 'C4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(A, C_MAJ, { rhythms: RH.eighths, maxLeap: 1 }),
        read(A, G_MAJ, { key: 'G', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('va5-4', 'Twinkle & the Saints', 'song', 'Two tunes down on the C and G strings', [
        piece('viola-twinkle'),
        piece('viola-when-the-saints'),
      ]),
      lesson('va5-c', 'Checkpoint: C Major', 'checkpoint', 'The C and G strings on sight', [
        name(A, C_MAJ, 12),
        play(A, C_MAJ, 10),
        scale('C', 'major', 'R', { octave: 3, clef: A, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(A, C_MAJ, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['C-string notes', 'C major', 'Eighth notes']),

    // ------------------------------------------------------------------ 6
    unit('va6', 'The Low Second Finger', 'F and C natural, B♭, C major in two octaves, F major, pickups and ties.', [
      lesson('va6-1', 'F and C Natural', 'learn', 'The 2nd finger slides back to touch the 1st', [
        meet(A, 'F4 C5', { frets: [at(2, 3, 2), at(1, 3, 2)], tips: ['F natural on the D string: the 2nd finger low, touching the 1st, in the top space.', 'C natural on the A string, low 2nd finger, just above the first ledger line.'] }),
        name(A, C_MAJ2, 14),
        play(A, 'D4 E4 F4 G4 A4 B4 C5', 10, { hints: true }),
        read(A, 'C4 D4 E4 F4 G4 A4 B4 C5', { rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('High 2 or low 2?', 'The key signature tells your 2nd finger where to go. With F♯ and C♯ it sits high; with F and C natural it sits low, next to the 1st finger.', fretsVisual([{ string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 3, finger: 2, label: 'F' }, { string: 2, fret: 4, finger: 2, label: 'F♯' }, { string: 2, fret: 5, finger: 3, label: 'G' }], 0, 7)),
      ]),
      lesson('va6-2', 'C Major in Two Octaves', 'learn', 'All four strings', [
        scale('C', 'major', 'R', { octave: 3, octaves: 2, clef: A, title: 'C major, two octaves' }),
        read(A, C_MAJ_WIDE, { rhythms: RH.eighths, maxLeap: 3 }),
        keysig(A, 'C G D', 6),
      ], [
        insight('Two patterns', 'C major in two octaves uses high 2 on the C and G strings and low 2 on the D and A strings. Listen for the ringing tones on every C, G, D and A.', { kind: 'staff', clef: 'alto', notes: ['C3', 'G3', 'C4', 'F4', 'C5'], labels: true }),
      ]),
      lesson('va6-3', 'B Flat & F Major', 'learn', 'One flat', [
        meet(A, 'Bb3', { frets: [at(3, 3, 2)], tips: ['B♭ on the G string: low 2nd finger, in the second space with a flat.'] }),
        scale('F', 'major', 'R', { octave: 3, clef: A }),
        read(A, F_MAJ, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('The key of F', 'F major has one flat, B♭: every B becomes B♭. On the viola it starts with the 3rd finger on the C string, with low 2nd fingers on the G and D strings.', { kind: 'staff', clef: 'alto', notes: ['F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4'], key: 'F' }),
      ]),
      lesson('va6-4', 'Pickups & Ties', 'learn', 'Notes that lead in and notes that hold over', [
        tip('Pickups and ties', 'A pickup is a short first bar that leads into beat one: count the missing beats before you start. A tie joins two notes of the same pitch: keep the bow moving through both, with no new start.', { kind: 'staff', clef: 'alto', notes: ['C4/q', 'E4/q', 'G4/h~', 'G4/h', 'E4/h'], time: [4, 4] }),
        vapiece('Ties Across the Bar', 'C', [4, 4], [TIES]),
        piece('viola-aura-lee'),
      ]),
      lesson('va6-5', 'A Minuet and a Serenade', 'song', 'Bach’s Notebook and Mozart’s night music, in C', [
        piece('viola-minuet'),
        piece('viola-eine-kleine-nachtmusik'),
      ], [
        insight('The minuet', 'A minuet is an elegant dance in three. Violinists know this one as the Minuet in G; violists play it a fifth lower, in C. Lean a little on beat one of every bar.'),
      ]),
      lesson('va6-c', 'Checkpoint: Low 2', 'checkpoint', 'High and low 2nd fingers on sight', [
        name(A, C_MAJ2, 16),
        scale('C', 'major', 'R', { octave: 3, octaves: 2, clef: A, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(A, C_MAJ_WIDE, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(A, F_MAJ, { key: 'F', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['F and C naturals', 'Two octaves', 'F major', 'Pickups & ties']),

    // ------------------------------------------------------------------ 7
    unit('va7', 'Dotted Rhythms, Slurs & Six-Eight', 'Long–short rhythms, two notes in one bow, compound time and a jig.', [
      lesson('va7-1', 'The Dotted Quarter', 'learn', 'Long–short: dotted quarter + eighth', [
        tip('The dot', 'A dotted quarter lasts 1½ beats and is usually followed by an eighth: count “1 – & 2”. Use a longer, slower bow for the dotted note and a quick, light one for the eighth.', { kind: 'staff', clef: 'alto', notes: ['B3/q.', 'A3/e', 'A3/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(A, G_MAJ, { key: 'G', rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 63 }),
        piece('viola-oh-susanna'),
      ]),
      lesson('va7-2', 'Slurs', 'learn', 'Two or more notes in one bow', [
        tip('Slurs', 'A curved line joining different notes is a slur: play them all in one bow, changing only the left-hand fingers. (A curve joining the same note twice is a tie.) Slurred notes need less bow each, so plan the bow before you start.'),
        vapiece('Slurred Pairs', 'C', [4, 4], [SLURS], { prompt: 'Try slurring each pair of eighth notes into one bow: down for the first pair, up for the next.' }),
        read(A, C_MAJ_WIDE, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('va7-3', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighth notes per bar, grouped in two sets of three: “ONE two three FOUR five six”. Feel two big beats, not six small ones.', { kind: 'staff', clef: 'alto', notes: ['C4/q', 'D4/e', 'E4/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(A, C_MAJ, { time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
        piece('viola-row-your-boat'),
      ]),
      lesson('va7-4', 'A Jig', 'song', 'An Irish dance tune in 6/8', [
        piece('viola-irish-washerwoman'),
        read(A, C_MAJ_WIDE, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Dance music', 'Jigs are dance tunes in 6/8. Keep the bow short and lively, with a little lift on each big beat, and the viola will drive the dancers.'),
      ]),
      lesson('va7-c', 'Checkpoint: Rhythm', 'checkpoint', 'Dotted, slurred and compound rhythms', [
        rhythm([6, 8], RH.compound, { tempo: 66, reps: 1 }),
        read(A, G_MAJ, { key: 'G', rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(A, C_MAJ_WIDE, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', 'Slurs', '6/8', 'Jigs']),

    // ------------------------------------------------------------------ 8
    unit('va8', 'Low First Finger & Flat Keys', 'E♭, B♭ and A♭ with a low 1st finger, B♭ major and key signatures.', [
      lesson('va8-1', 'E Flat and B Flat', 'learn', 'The 1st finger moves back towards the scroll', [
        meet(A, 'Eb4 Bb4', { frets: [at(2, 1, 1), at(1, 1, 1)], tips: ['E♭ on the D string: the 1st finger low, a semitone above the open string. The fourth line with a flat.', 'B♭ on the A string, low 1st finger: the first ledger line above the staff, with a flat.'] }),
        name(A, BB_MAJ, 12),
        play(A, 'D4 Eb4 F4 G4 A4 Bb4', 8, { hints: true }),
        read(A, BB_MAJ, { key: 'Bb', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Low 1', 'A flat lowers a note by a semitone. E♭ is the 1st finger pulled back, almost touching the nut, half a tone from the open D. Keep the rest of the hand where it was.', fretsVisual([{ string: 2, fret: 0, label: 'D' }, { string: 2, fret: 1, finger: 1, label: 'E♭' }, { string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 3, finger: 2, label: 'F' }], 0, 6)),
      ]),
      lesson('va8-2', 'The B Flat Major Scale', 'learn', 'Two flats', [
        scale('Bb', 'major', 'R', { octave: 3, clef: A }),
        scale('Bb', 'major', 'R', { octave: 3, clef: A, mode: 'tempo', tempo: 72 }),
        read(A, BB_MAJ, { key: 'Bb', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('The key of B♭', 'B♭ major has two flats, B♭ and E♭. It starts with a low 2nd finger on the G string, then low 1st fingers on the D and A strings.', { kind: 'staff', clef: 'alto', notes: ['Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4'], key: 'Bb' }),
      ]),
      lesson('va8-3', 'Key Signatures', 'practice', 'Sharps and flats at a glance', [
        keysig(A, 'C G D F Bb', 10),
        read(A, F_MAJ, { key: 'F', rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
        read(A, BB_MAJ, { key: 'Bb', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        interval(A, C_MAJ_WIDE, [3, 4, 5, 6], 10),
      ], [
        insight('Reading a key signature', 'Sharps always come in the order F C G D…, flats in the order B E A D… In a sharp key the last sharp is one step below the home note; in a flat key the second-to-last flat is the home note.', { kind: 'staff', clef: 'alto', notes: ['Bb3'], key: 'Bb' }),
      ]),
      lesson('va8-4', 'Yankee Doodle & Amazing Grace', 'song', 'A march in B♭ and a hymn in F', [
        piece('viola-yankee-doodle'),
        piece('viola-amazing-grace'),
      ]),
      lesson('va8-c', 'Checkpoint: Flat Keys', 'checkpoint', 'F and B♭ major on sight', [
        keysig(A, 'C G D F Bb', 8),
        read(A, F_MAJ, { key: 'F', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(A, BB_MAJ, { key: 'Bb', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Low 1', 'B♭ major', 'Key signatures']),

    // ------------------------------------------------------------------ 9
    unit('va9', 'Accidentals & the High Third Finger', 'C♯, G♯ and F♯ with a high 3rd finger, sharps, flats and naturals anywhere.', [
      lesson('va9-1', 'High Third Finger', 'learn', 'The 3rd finger reaches up towards the 4th', [
        meet(A, 'C#4 G#4 F#3', { frets: [at(3, 6, 3), at(2, 6, 3), at(4, 6, 3)], tips: ['C♯ on the G string: the 3rd finger a semitone higher than C. Middle C’s line with a sharp.', 'G♯ on the D string, high 3rd finger: the top line with a sharp.', 'F♯ on the C string, high 3rd finger: the bottom line with a sharp.'] }),
        read(A, D_MAJ_LOW, { key: 'D', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        scale('D', 'major', 'R', { octave: 3, octaves: 2, clef: A, title: 'D major, two octaves' }),
      ], [
        insight('D major from the bottom', 'D major from the C string’s D needs a high 3rd finger for F♯ on the C string and C♯ on the G string: the pattern 0 1 2 34, with 3 and 4 touching.', fretsVisual([{ string: 3, fret: 2, finger: 1, label: 'A' }, { string: 3, fret: 4, finger: 2, label: 'B' }, { string: 3, fret: 6, finger: 3, label: 'C♯' }, { string: 3, fret: 7, finger: 4, label: 'D' }], 0, 8)),
      ]),
      lesson('va9-2', 'Sharps, Flats and Naturals', 'learn', 'Every semitone in first position', [
        tip('Accidentals last a bar', 'A sharp, flat or natural written before a note lasts until the next bar line; then the key signature takes over again. A natural sign (♮) cancels a sharp or flat.', { kind: 'staff', clef: 'alto', notes: ['B3/q', 'Bb3/q', 'A3/q', 'B3/q'], time: [4, 4] }),
        name(A, CHROMATIC, 14, { answers: 'accidentals' }),
        play(A, CHROMATIC, 12, { hints: true }),
      ], [
        insight('Semitones on a fretless string', 'Two notes a semitone apart are played with fingers touching, or by sliding one finger. Between E and F, and between B and C, there is only a semitone, so those are always close fingers.'),
      ]),
      lesson('va9-3', 'Chromatic Melodies', 'practice', 'Climbing in semitones', [
        vapiece('Chromatic Climb', 'C', [4, 4], [CHROMATIC_G], { prompt: 'Slide each finger up a semitone for the sharp, back down for the flat. Follow the finger numbers.' }),
        vapiece('Neighbour-Note Waltz', 'D', [3, 4], [NEIGHBOURS], { prompt: 'Each sharp leans on the note above it: up a semitone and back.' }),
        play(A, CHROMATIC, 12),
      ]),
      lesson('va9-4', 'Grieg and Beethoven', 'song', 'Two famous tunes full of accidentals', [
        piece('viola-hall-of-the-mountain-king'),
        piece('viola-fur-elise'),
      ]),
      lesson('va9-c', 'Checkpoint: Accidentals', 'checkpoint', 'Name and play every semitone in first position', [
        name(A, CHROMATIC, 16, { answers: 'accidentals' }),
        play(A, CHROMATIC, 12),
        vapiece('Chromatic Climb', 'C', [4, 4], [CHROMATIC_G], { mode: 'tempo', tempo: 60, fingering: 'first' }),
      ]),
    ], ['High 3', '♯ ♭ ♮', 'Chromatic notes']),

    // ------------------------------------------------------------------ 10
    unit('va10', 'Minor Keys', 'D, G and C minor: relative minors, the raised 7th and folk tunes in the Dorian mode.', [
      lesson('va10-1', 'D Minor', 'learn', 'One flat, with C♯ leading home', [
        scale('D', 'natural-minor', 'R', { octave: 4, clef: A }),
        read(A, D_MIN, { key: 'Dm', rhythms: RH.qh, maxLeap: 2 }),
        scale('D', 'harmonic-minor', 'R', { octave: 4, clef: A }),
        read(A, D_MIN_H, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Relative minor', 'D minor uses the same key signature as F major, one flat, but its home note is D. Minor tunes often raise the 7th note to lead home: C♯ in D minor, written as an accidental.', { kind: 'staff', clef: 'alto', notes: ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C#5', 'D5'], key: 'Dm' }),
      ]),
      lesson('va10-2', 'G Minor', 'learn', 'Two flats, with F♯ leading home', [
        keysig(A, 'Dm Gm Cm', 8),
        scale('G', 'natural-minor', 'R', { octave: 3, clef: A }),
        scale('G', 'harmonic-minor', 'R', { octave: 3, clef: A, mode: 'tempo', tempo: 66 }),
        read(A, G_MIN, { key: 'Gm', rhythms: RH.qh, maxLeap: 2 }),
        read(A, G_MIN_H, { key: 'Gm', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('G minor', 'G minor shares B♭ major’s key signature, two flats. Its harmonic form raises the 7th to F♯: a high 2nd finger on the D string, right next to the 3rd.', { kind: 'staff', clef: 'alto', notes: ['G3', 'A3', 'Bb3', 'C4', 'D4', 'Eb4', 'F#4', 'G4'], key: 'Gm' }),
      ]),
      lesson('va10-3', 'C Minor', 'learn', 'Three flats, down on the C string', [
        scale('C', 'natural-minor', 'R', { octave: 3, clef: A }),
        read(A, C_MIN, { key: 'Cm', rhythms: RH.qh, maxLeap: 3 }),
        piece('viola-greensleeves'),
      ], [
        insight('Minor colour', 'Minor keys sound darker because the 3rd note of the scale is a semitone lower. On the viola’s C string, C minor is about as dark and rich as music gets: E♭ with a low 2nd finger, A♭ with a low 1st.'),
      ]),
      lesson('va10-4', 'Folk Songs in Minor', 'song', 'An English ballad and a sea shanty', [
        piece('viola-scarborough-fair'),
        piece('viola-drunken-sailor'),
      ], [
        insight('The Dorian sound', 'Many folk tunes use the Dorian mode: a minor scale with a raised 6th. In G minor that means E natural instead of E♭, so watch for the natural signs.', { kind: 'staff', clef: 'alto', notes: ['G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4'], key: 'Gm' }),
      ]),
      lesson('va10-c', 'Checkpoint: Minor Keys', 'checkpoint', 'Read in D, G and C minor', [
        keysig(A, 'Dm Gm Cm', 8),
        read(A, D_MIN_H, { key: 'Dm', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(A, G_MIN, { key: 'Gm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
        read(A, C_MIN, { key: 'Cm', rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['D, G and C minor', 'Harmonic minor', 'Dorian']),

    // ------------------------------------------------------------------ 11
    unit('va11', 'Third Position', 'Move the whole hand up: new places for old notes, shifting, and notes up to G5.', [
      lesson('va11-1', 'What Is Third Position?', 'learn', 'The 1st finger takes the 3rd finger’s place', [
        meet(A, 'D5 E5 F#5 G5', {
          frets: [at(1, 5, 1), at(1, 7, 2), at(1, 9, 3), at(1, 10, 4)],
          tips: ['D on the A string with the 1st finger, where the 3rd finger played it in first position.', 'E with the 2nd finger: in first position this was the 4th finger’s note.', 'F♯ with the 3rd finger, on the third ledger line.', 'G with the 4th finger, just above the third ledger line.'],
        }),
        read(A, POS3_A, { key: 'G', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Positions', 'A position is named after where the 1st finger lies. In first position it is a tone above the open string; in third position it sits where the 3rd finger was. The finger patterns stay the same, a fourth higher.', fretsVisual([{ string: 1, fret: 5, finger: 1, label: 'D' }, { string: 1, fret: 7, finger: 2, label: 'E' }, { string: 1, fret: 9, finger: 3, label: 'F♯' }, { string: 1, fret: 10, finger: 4, label: 'G' }], 3, 11)),
        insight('The whole hand moves', 'Move the thumb with the hand, and let the base of your palm touch the viola’s shoulder: that is your landmark for third position. Bring the elbow a little further under the instrument.'),
      ]),
      lesson('va11-2', 'The D String Up High', 'learn', 'G, A, B and C in third position', [
        meet(A, 'G4 A4 B4 C5', { frets: [at(2, 5, 1), at(2, 7, 2), at(2, 9, 3), at(2, 10, 4)], tips: ['G on the D string with the 1st finger: the top line of the staff.', 'A with the 2nd finger: the same pitch as the open A string beside it.', 'B with the 3rd finger.', 'C with the 4th finger.'] }),
        name(A, 'G4 A4 B4 C5 D5 E5 F5 G5', 12),
        read(A, POS3_DA, { key: 'G', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('High ledger lines', 'Above the staff the ledger lines count on: A in the space above the top line, B on the first ledger line, C above it, D on the second, and so on. When they pile up too high, viola music switches to the treble clef (the last unit).', { kind: 'staff', clef: 'alto', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5'], labels: true }),
      ]),
      lesson('va11-3', 'Shifting', 'learn', 'Travel between first and third position', [
        tip('How to shift', 'Shift on an open string when you can: the hand moves while the string rings. Otherwise slide lightly along the string on the finger you are using, keep the thumb loose and travel with it, then let the new finger fall. Lighten the bow a little as you go.'),
        vapiece('Shifting Study', 'G', [4, 4], [SHIFTING], { prompt: 'First position, then shift to third while the open string rings. Follow the finger numbers.' }),
        read(A, POS3_DA_C, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('va11-4', 'Scales up High', 'practice', 'Two octaves in first position, one octave in third', [
        scale('C', 'major', 'R', { octave: 3, octaves: 2, clef: A, mode: 'tempo', tempo: 76, fingering: 'first' }),
        scale('D', 'major', 'R', { octave: 3, octaves: 2, clef: A }),
        scale('G', 'major', 'R', { octave: 4, clef: A, guitarPosition: 5, title: 'G major in third position' }),
      ]),
      lesson('va11-5', 'Silent Night', 'song', 'A carol that ends in third position', [
        piece('viola-silent-night'),
        read(A, POS3_DA, { key: 'G', guitarPosition: 5, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('va11-c', 'Checkpoint: Third Position', 'checkpoint', 'Read and shift up to G5', [
        name(A, FULL, 18, { sequence: true }),
        read(A, POS3_DA, { key: 'G', guitarPosition: 5, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(A, POS3_DA_C, { guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['3rd position', 'Shifting', 'Two-octave scales']),

    // ------------------------------------------------------------------ 12
    unit('va12', 'The Treble Clef & Double Stops', 'Read high passages in the treble clef, play two strings at once, and a final songbook.', [
      lesson('va12-1', 'The Treble Clef', 'learn', 'For notes high above the alto staff', [
        name(TR, TREBLE, 14),
        play(TR, TREBLE, 10, { hints: true }),
        inlinePiece('Treble-Clef Study', 'C', [4, 4], [{ clef: TR, voices: [TREBLE_STUDY] }], { prompt: 'The same notes you know, written in the treble clef. Third position from the D in bar 1.' }),
      ], [
        insight('Why a second clef?', 'When viola music climbs high, the alto clef would need a ladder of ledger lines, so the music switches to the treble clef. The notes are the same; only the staff changes. In the treble clef the A string’s A sits in the second space.', { kind: 'staff', clef: 'treble', notes: ['A4', 'C5', 'E5', 'G5'], labels: true }),
        insight('Same note, two clefs', 'The A above middle C sits in the space above the alto staff, but in the second space of the treble staff. Read clef first, then the notes.', { kind: 'staff', clef: 'alto', notes: ['A4', 'B4', 'C5', 'D5'], labels: true }),
      ]),
      lesson('va12-2', 'Reading in Two Clefs', 'practice', 'Up high in the treble clef', [
        read(TR, TREBLE, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2 }),
        piece('viola-goin-home'),
        read(TR, TREBLE, { guitarPosition: 5, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('va12-3', 'Double Stops with Open Strings', 'learn', 'A melody over a drone', [
        tip('Two strings at once', 'To play two strings together, find the bow level between them and let the bow rest on both with even weight. Start with an open string under a melody, like a bagpipe’s drone.', { kind: 'staff+frets', clef: 'alto', notes: ['[G3 E4]/w'], positions: [{ string: 3, fret: 0 }, { string: 2, fret: 2, finger: 1 }] }),
        vapiece('Drone Study', 'G', [4, 4], [DRONE_STUDY], { prompt: 'The open G (then the open D) sounds under every note. Keep both strings ringing.' }),
        interval(A, G_MAJ, [5, 6, 8], 10, { harmonic: true, key: 'G' }),
        piece('viola-drone-hymn'),
      ]),
      lesson('va12-4', 'Final Songbook', 'song', 'Pachelbel’s famous melody and a hymn', [
        piece('viola-canon'),
        piece('viola-amazing-grace', { mode: 'tempo', fingering: 'first' }),
      ]),
      lesson('va12-5', 'Speed Reading', 'challenge', 'Sight-read at tempo', [
        name(A, FULL1, 30, { sequence: true, title: 'Lightning round' }),
        read(A, C_MAJ2, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(A, POS3_DA, { key: 'G', guitarPosition: 5, rhythms: RH.syncopation, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 69, fingering: 'none' }),
      ]),
      lesson('va12-c', 'Final Exam: Viola', 'checkpoint', 'Prove your mastery', [
        name(A, FULL, 30, { sequence: true }),
        keysig(A, 'C G D F Bb Dm Gm', 9),
        read(A, C_MAJ2, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none', measures: 6 }),
        read(TR, TREBLE, { guitarPosition: 5, time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
        read(A, G_MIN_H, { key: 'Gm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Treble clef', 'Double stops', 'Sight-reading']),
  ],
};
