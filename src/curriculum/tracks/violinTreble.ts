import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, Insight, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Violin · Treble clef. Violin music SOUNDS AS WRITTEN. The open strings, numbered from
 * the highest as violinists do, are 1 = E5, 2 = A4, 3 = D4, 4 = G3: the open G hangs
 * below two ledger lines, the open E sits in the top space of the staff.
 *
 * The fingerboard has no frets, so a "fret" here is a semitone above the open string:
 * where the finger stops it. In first position the 1st finger lies a tone above the open
 * string (fret 2, or fret 1 for a "low 1"), the 2nd finger at fret 3 ("low 2") or 4
 * ("high 2"), the 3rd at fret 5 (6 for a "high 3") and the 4th at fret 7, which sounds
 * the next open string. Third position (`guitarPosition: 5`) puts the 1st finger where
 * the 3rd finger was. The fingering engine follows the same system (see autofinger.ts).
 *
 * Bowing, posture, pizzicato and slurs can't be heard by the app as such: they are taught
 * in the insight cards, while the activities check the notes.
 */
const T = 'treble' as const;

/** A fingerboard place for `meet`: string (1 = E, 2 = A, 3 = D, 4 = G), semitone above the open string, finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- First-position pitch pools (sounding = written) ----
const OPEN = 'G3 D4 A4 E5';
const FIRST1 = 'D4 E4 A4 B4';
const HIGH2 = 'D4 E4 F#4 A4 B4 C#5';
const D_MAJ = 'D4 E4 F#4 G4 A4 B4 C#5 D5';
const D_MAJ_E = 'D4 E4 F#4 G4 A4 B4 C#5 D5 E5';
const A_MAJ = 'A4 B4 C#5 D5 E5 F#5 G#5 A5';
const G_STR = 'G3 A3 B3 C4 D4';
const G_MAJ = 'G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5';
const G_MAJ_HIGH = 'G4 A4 B4 C5 D5 E5 F#5 G5';
const G_MAJ2 = 'G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5 E5 F#5 G5';
const C_MAJ = 'C4 D4 E4 F4 G4 A4 B4 C5';
const C_MAJ_WIDE = 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5';
const F_MAJ = 'C4 D4 E4 F4 G4 A4 Bb4 C5 D5 E5 F5';
const BB_MAJ = 'Bb3 C4 D4 Eb4 F4 G4 A4 Bb4 C5 D5';
const A_MAJ_LOW = 'E4 F#4 G#4 A4 B4 C#5 D5 E5';
const CHROMATIC = 'D4 Eb4 E4 F4 F#4 G4 G#4 A4 Bb4 B4 C5 C#5 D5';
const A_MIN = 'E4 F4 G4 A4 B4 C5 D5 E5';
const A_MIN_H = 'E4 F4 G#4 A4 B4 C5 D5 E5';
const D_MIN = 'D4 E4 F4 G4 A4 Bb4 C5 D5';
const D_MIN_H = 'D4 E4 F4 G4 A4 Bb4 C#5 D5';
const E_MIN = 'E4 F#4 G4 A4 B4 C5 D5 E5';
const FULL1 = 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5';
// ---- Third position (1st finger a fourth above the open string) ----
const POS3_A = 'D5 E5 F#5 G5';
const POS3_AE = 'D5 E5 F#5 G5 A5 B5 C6 D6';
const POS3_DAE = 'G4 A4 B4 C5 D5 E5 F#5 G5 A5 B5 C6 D6';
const POS3_AE_D = 'D5 E5 F#5 G5 A5 B5 C#6 D6';
const POS3_DAE_D = 'G4 A4 B4 C#5 D5 E5 F#5 G5 A5 B5 C#6 D6';
const FULL = 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6';

const fretsVisual = (positions: { string: number; fret: number; label?: string; finger?: number }[], minFret?: number, maxFret?: number): Insight['visual'] => ({ kind: 'frets', positions, minFret, maxFret });

function vpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: T, voices }], o);
}

// ---- Études (string and finger choices written where they are the point: @finger %string) ----
const CROSSINGS = 'D4/q A4 D4 A4 | D4/h A4/h | G3/q D4 G3 D4 | G3/h D4/h | A4/q E5 A4 E5 | A4/h E5/h | D4/q A4 G3 D4 | D4/w |';
const FOURTH_FINGER = 'D4/q@0 E4@1 F#4@2 G4@3 | A4/h@4%3 A4/h@0%2 | A4/q@0 B4@1 C#5@2 D5@3 | E5/h@4%2 E5/h@0%1 | D5/q@3 C#5@2 B4@1 A4@4%3 | G4@3 F#4@2 E4@1 D4@0 | A4/q@4%3 G4@3 F#4@2 E4@1 | D4/w@0 |';
const TIES = 'D4/q F#4 A4 B4~ | B4/q A4 F#4 A4 | G4/h B4/h~ | B4/q G4 E4 F#4 | D4/q F#4 A4 D5~ | D5/q B4 C#5 A4 | D5/w |';
const SLURS = 'G4/e A4 B4 C5 D5/q D5 | E5/e D5 C5 B4 A4/q A4 | B4/e C5 D5 B4 G4/q B4 | A4/e G4 F#4 A4 G4/h | D5/e C5 B4 A4 B4/q G4 | C5/e B4 A4 G4 F#4/q D4 | E4/e F#4 G4 A4 B4/q A4 | G4/w |';
const CHROMATIC_A = 'A4/e@0%2 Bb4@1%2 B4@1%2 C5@2%2 C#5@2%2 D5@3%2 D#5@3%2 E5@4%2 | E5/e@4%2 Eb5@3%2 D5@3%2 C#5@2%2 C5@2%2 B4@1%2 Bb4@1%2 A4@0%2 | D4/e@0%3 Eb4@1%3 E4@1%3 F4@2%3 F#4@2%3 G4@3%3 G#4@3%3 A4@4%3 | A4/e@4%3 Ab4@3%3 G4@3%3 F#4@2%3 F4@2%3 E4@1%3 Eb4@1%3 D4/e@0%3 |';
const NEIGHBOURS = 'A4/q G#4 A4 | B4/h A4/q | E5/q D#5 E5 | F#5/h. | B4/q A#4 B4 | C#5/h B4/q | E4/q D#4 E4 | A4/h. | A4/q G#4 A4 | F#4/h E4/q | D4/q C#4 D4 | E4/h F#4/q | E4/q D4 C#4 | D4/h. |';
const SHIFTING =
  'A4/q@0%2 B4@1%2 C#5@2%2 D5@3%2 | E5/h@0%1 A4/h@0%2 | D5/q@1%2 E5@2%2 F#5@3%2 G5@4%2 | F#5/h@3%2 D5/h@1%2 | ' +
  'B4/q@1%2 C#5@2%2 D5@3%2 E5@2%2 | F#5/q@3%2 G5@4%2 A5/h@1%1 | B5/q@2%1 A5@1%1 G5@4%2 F#5@3%2 | E5/h@2%2 A4/h@0%2 |';
const DRONE_STUDY = '[D4 A4]/h@0,0%3,2 [D4 B4]@0,1%3,2 | [D4 C#5]/h@0,2%3,2 [D4 A4]@0,0%3,2 | [D4 B4]/q@0,1%3,2 [D4 C#5]@0,2%3,2 [D4 D5]/h@0,3%3,2 | [D4 A4]/w@0,0%3,2 | [E4 A4]/h@1,0%3,2 [F#4 A4]@2,0%3,2 | [G4 A4]/h@3,0%3,2 [F#4 A4]@2,0%3,2 | [E4 A4]/q@1,0%3,2 [F#4 A4]@2,0%3,2 [G4 A4]@3,0%3,2 [E4 A4]@1,0%3,2 | [D4 A4]/w@0,0%3,2 |';

export const violinTreble: TrackDef = {
  id: 'violin-treble',
  instrument: 'violin',
  title: 'Treble Clef',
  subtitle: 'Violin · Reading music',
  description: 'Read violin music from your first open string to third position: the finger patterns, the keys of D, A, G, C, F and B♭, minor keys, rhythm in 3/4 and 6/8, shifting, double stops and a songbook of folk tunes and classics.',
  clef: 'treble',
  accent: '#e8a87c',
  glyph: '𝄞',
  heatmap: [{ clef: 'treble', low: 'G3', high: 'D6' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('vt1', 'The Open Strings', 'G, D, A and E: four notes, the bow and your first tune.', [
      lesson('vt1-1', 'Open D and A', 'learn', 'Read your first two notes', [
        meet(T, 'D4', { frets: [at(3, 0, 0)], tips: ['The open 3rd string is D. It sits in the space just below the staff.'] }),
        meet(T, 'A4', { frets: [at(2, 0, 0)], tips: ['The open 2nd string is A, in the second space of the staff.'] }),
        name(T, 'D4 A4', 8),
        play(T, 'D4 A4', 8, { hints: true }),
      ], [
        insight('Violin music sounds as written', 'Violin music uses the treble clef, and it sounds exactly where it is written. The four open strings are G, D, A and E, each a fifth above the one before.', { kind: 'staff', clef: 'treble', notes: ['G3', 'D4', 'A4', 'E5'], labels: true }),
        insight('Strings are numbered from the top', 'Violinists number the strings from the highest: E is the 1st string, A the 2nd, D the 3rd and G the 4th. On the screen the E string is at the top, nearest your eyes.', fretsVisual([{ string: 1, fret: 0, label: 'E' }, { string: 2, fret: 0, label: 'A' }, { string: 3, fret: 0, label: 'D' }, { string: 4, fret: 0, label: 'G' }], 0, 4)),
        insight('Holding the violin', 'Rest the violin on your left collarbone with your jaw on the chin rest, so the head can hold it without the hand. The scroll points out to your left, level with the floor or a little higher. A shoulder rest makes this much easier.'),
      ]),
      lesson('vt1-2', 'Open G and E', 'learn', 'The lowest and the highest string', [
        meet(T, 'G3', { frets: [at(4, 0, 0)], tips: ['The open 4th string is G, the lowest note on the violin. It hangs below two ledger lines under the staff.'] }),
        meet(T, 'E5', { frets: [at(1, 0, 0)], tips: ['The open 1st string is E, in the top space of the staff. It is the thinnest string and the brightest.'] }),
        name(T, OPEN, 10),
        play(T, OPEN, 10, { hints: true }),
      ], [
        insight('Ledger lines', 'Notes below the staff borrow short extra lines called ledger lines. Middle C sits on one ledger line; the violin’s open G hangs below the second.', { kind: 'staff', clef: 'treble', notes: ['C4', 'B3', 'A3', 'G3'], labels: true }),
        insight('Pizzicato first', 'You can start by plucking: rest your right thumb on the corner of the fingerboard and pluck with the pad of your index finger, over the end of the fingerboard. Musicians write this as pizz.; arco means “play with the bow”.'),
      ]),
      lesson('vt1-3', 'The Bow and the Beat', 'practice', 'Open strings in time', [
        tip('Counting beats', 'A quarter note lasts one beat; a half note lasts two. In 4/4 there are four beats in every bar: count “1 2 3 4” as you play. Use half the bow for a quarter note and the whole bow for a half note.', { kind: 'staff', clef: 'treble', notes: ['D4/q', 'D4/q', 'A4/h', 'A4/q', 'A4/q', 'D4/h'], time: [4, 4] }),
        read(T, OPEN, { rhythms: RH.quarters, maxLeap: 4, leapiness: 0.8, measures: 2, noteNames: true, title: 'Your first melody' }),
        rhythm([4, 4], RH.qh, { tempo: 72 }),
        read(T, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8 }),
        name(T, OPEN, 12, { sequence: true, title: 'Note rush' }),
      ], [
        insight('Holding the bow', 'Curve your thumb and rest its tip on the stick where it meets the frog. The fingers drape over the stick; the little finger sits curved on top. Keep the hand soft, as if holding a small bird.'),
        insight('Where the bow goes', 'Draw the bow halfway between the bridge and the end of the fingerboard, parallel to the bridge. The weight of your arm, not squeezing, makes the sound. Down-bow (towards the tip) and up-bow (back to the frog) take turns.'),
      ]),
      lesson('vt1-4', 'Open-String Hoedown', 'song', 'Your first tune: open strings only', [
        vpiece('Crossing Strings', 'D', [4, 4], [CROSSINGS], { prompt: 'Change your arm’s height for each string: lower for the E string, higher for the G.' }),
        piece('violin-open-string-hoedown'),
      ], [
        insight('String crossings', 'Each string has its own bow level. Your right elbow moves with the bow: high for the G string, low for the E string. Move the arm a moment before the change, so each new note starts cleanly.'),
      ]),
      lesson('vt1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Name and play G, D, A and E', [
        name(T, OPEN, 12),
        play(T, OPEN, 8),
        read(T, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8, fingering: 'first' }),
      ]),
    ], ['G D A E', 'Bow and pizzicato', 'Quarter & half notes']),

    // ------------------------------------------------------------------ 2
    unit('vt2', 'First and Second Fingers', 'E and B with the 1st finger, F♯ and C♯ with a high 2nd, and your first songs.', [
      lesson('vt2-1', 'First Finger: E and B', 'learn', 'Your first stopped notes', [
        meet(T, 'E4 B4', { frets: [at(3, 2, 1), at(2, 2, 1)], tips: ['E on the D string: the 1st finger a tone above the open string. It sits on the bottom line of the staff.', 'B on the A string, also 1st finger. It is the middle line of the staff.'] }),
        name(T, FIRST1, 10),
        play(T, FIRST1, 8, { hints: true }),
        read(T, FIRST1, { rhythms: RH.quarters, maxLeap: 4, measures: 2, noteNames: true }),
      ], [
        insight('Left-hand fingers', 'Index = 1, middle = 2, ring = 3, little finger = 4, and 0 means an open string. Many beginners put thin tapes on the fingerboard to show where the fingers go in first position.', fretsVisual([{ string: 2, fret: 0, label: 'A' }, { string: 2, fret: 2, finger: 1 }, { string: 2, fret: 4, finger: 2 }, { string: 2, fret: 5, finger: 3 }, { string: 2, fret: 7, finger: 4 }], 0, 8)),
        insight('No frets: you place every note', 'A violin has no frets, so the pitch is exactly where your fingertip stops the string. Press with the tip, on the tape, and listen: if a note sounds too high, slide the finger towards the scroll; too low, towards the bridge.'),
      ]),
      lesson('vt2-2', 'Counting Time', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'In 4/4 a quarter note lasts 1 beat, a half note 2 and a whole note 4. Spread a long note over the whole bow and keep the speed steady to the very end.', { kind: 'staff', clef: 'treble', notes: ['D4/q', 'E4/q', 'A4/h', 'B4/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(T, FIRST1, { rhythms: RH.qhw, maxLeap: 4, mode: 'tempo', tempo: 63 }),
      ]),
      lesson('vt2-3', 'High Second Finger: F♯ and C♯', 'learn', 'The 2nd finger, a tone above the 1st', [
        meet(T, 'F#4 C#5', { frets: [at(3, 4, 2), at(2, 4, 2)], tips: ['F♯ on the D string: the 2nd finger a tone above the 1st. The sharp sign raises F by a semitone, and in this key it is always there.', 'C♯ on the A string, the same high 2nd finger. It sits in the third space.'] }),
        name(T, HIGH2, 12),
        play(T, HIGH2, 10, { hints: true }),
        read(T, HIGH2, { key: 'D', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('The key of D', 'The two sharps after the clef, on F and C, are the key signature of D major: every F is F♯ and every C is C♯. That is why the 2nd finger sits high, a tone above the 1st.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F#4', 'A4', 'B4', 'C#5'], key: 'D', labels: true }),
      ]),
      lesson('vt2-4', 'Hot Cross Buns & Mary', 'song', 'Two songs with three fingers', [
        piece('violin-hot-cross-buns'),
        piece('violin-mary-had-a-little-lamb'),
      ]),
      lesson('vt2-c', 'Checkpoint: Two Fingers', 'checkpoint', 'D, E, F♯, A, B and C♯ in time', [
        name(T, HIGH2, 12),
        play(T, HIGH2, 8),
        read(T, HIGH2, { key: 'D', rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['E F♯ B C♯', 'Finger numbers', 'Whole notes']),

    // ------------------------------------------------------------------ 3
    unit('vt3', 'The D Major Scale', 'Third and fourth fingers, the D major pattern, rests and two famous tunes.', [
      lesson('vt3-1', 'Third Finger: G and D', 'learn', 'Fingers 2 and 3 side by side', [
        meet(T, 'G4 D5', { frets: [at(3, 5, 3), at(2, 5, 3)], tips: ['G on the D string: the 3rd finger, touching the 2nd. It sits on the second line.', 'D on the A string, 3rd finger. It is the same note as the open D string an octave higher, on the fourth line.'] }),
        name(T, D_MAJ, 14),
        play(T, 'E4 F#4 G4 B4 C#5 D5', 10, { hints: true }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('The D major pattern', 'On the D and A strings in D major the fingers fall in the same pattern: a tone, a tone, then a semitone, so fingers 2 and 3 touch. Violinists call this the 0 1 23 pattern, or “high 2”.', fretsVisual([{ string: 3, fret: 0, label: 'D' }, { string: 3, fret: 2, finger: 1, label: 'E' }, { string: 3, fret: 4, finger: 2, label: 'F♯' }, { string: 3, fret: 5, finger: 3, label: 'G' }, { string: 2, fret: 0, label: 'A' }, { string: 2, fret: 2, finger: 1, label: 'B' }, { string: 2, fret: 4, finger: 2, label: 'C♯' }, { string: 2, fret: 5, finger: 3, label: 'D' }], 0, 7)),
      ]),
      lesson('vt3-2', 'The D Major Scale', 'learn', 'Eight notes up and down', [
        scale('D', 'major', 'R', { octave: 4, clef: T }),
        scale('D', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 72 }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.qh, maxLeap: 3, leapiness: 0.4 }),
      ], [
        insight('A scale is a ladder', 'A scale climbs from a note to the same note an octave higher, step by step. D major uses the same finger pattern on two strings: D string, then A string.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'], key: 'D' }),
      ]),
      lesson('vt3-3', 'Rests', 'learn', 'Counted silence', [
        tip('Silence on a bowed string', 'A rest is counted silence. Stop the bow on the string to end the note, keep counting, and get ready for the next one. The quarter rest looks like a squiggle; the half rest is a small block sitting on the middle line.', { kind: 'staff', clef: 'treble', notes: ['D4/q', 'r/q', 'F#4/q', 'r/q', 'A4/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('vt3-4', 'The Fourth Finger', 'learn', 'The little finger reaches the next string’s note', [
        meet(T, 'A4 E5', { frets: [at(3, 7, 4), at(2, 7, 4)], tips: ['A with the 4th finger on the D string: the same pitch as the open A string next to it.', 'E with the 4th finger on the A string: the same pitch as the open E string.'] }),
        vpiece('Fourth-Finger Étude', 'D', [4, 4], [FOURTH_FINGER], { prompt: 'Play each 4th-finger note, then the open string beside it. They should sound exactly the same.' }),
        read(T, D_MAJ_E, { key: 'D', rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('Ringing tones', 'When a stopped note matches an open string, that string starts vibrating by itself: the violin rings. A 4th-finger A that rings with the open A, or a 3rd-finger D that rings with the open D, is perfectly in tune. Listen for it.', fretsVisual([{ string: 3, fret: 7, finger: 4, label: 'A' }, { string: 2, fret: 0, label: 'A' }], 0, 8)),
      ]),
      lesson('vt3-5', 'Twinkle & Lightly Row', 'song', 'A nursery classic and a German folk song', [
        piece('violin-twinkle'),
        piece('violin-lightly-row'),
      ]),
      lesson('vt3-c', 'Checkpoint: D Major', 'checkpoint', 'The D major scale and tunes in time', [
        name(T, D_MAJ, 14),
        play(T, D_MAJ, 10),
        scale('D', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['G and D', 'D major scale', 'Rests', '4th finger']),

    // ------------------------------------------------------------------ 4
    unit('vt4', 'The E String & A Major', 'F♯, G♯ and A on the E string, the A major scale and waltz time.', [
      lesson('vt4-1', 'The E String: F♯, G♯ and A', 'learn', 'The same pattern on the 1st string', [
        meet(T, 'F#5 G#5 A5', { frets: [at(1, 2, 1), at(1, 4, 2), at(1, 5, 3)], tips: ['F♯ on the E string, 1st finger: the top line of the staff.', 'G♯ with a high 2nd finger, in the space above the staff.', 'A with the 3rd finger, on the first ledger line above the staff.'] }),
        name(T, A_MAJ, 12),
        play(T, 'E5 F#5 G#5 A5', 8, { hints: true }),
        read(T, A_MAJ, { key: 'A', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Ledger lines above', 'High notes climb above the staff: F♯ on the top line, G♯ just above it, A on the first ledger line.', { kind: 'staff', clef: 'treble', notes: ['E5', 'F#5', 'G#5', 'A5'], labels: true }),
        insight('A lighter bow for the E string', 'The E string speaks easily. Use a little less weight and keep the bow nearer the fingerboard, or it can sound thin and scratchy.'),
      ]),
      lesson('vt4-2', 'The A Major Scale', 'learn', 'Three sharps, the same finger pattern', [
        scale('A', 'major', 'R', { octave: 4, clef: T }),
        scale('A', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 72 }),
        keysig(T, 'D A', 6),
        read(T, A_MAJ, { key: 'A', rhythms: RH.qh, maxLeap: 3 }),
      ], [
        insight('The key of A', 'A major has three sharps: F♯, C♯ and G♯. On the A and E strings it uses exactly the same high-2 pattern as D major on the D and A strings.', { kind: 'staff', clef: 'treble', notes: ['A4', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'G#5', 'A5'], key: 'A' }),
      ]),
      lesson('vt4-3', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats, because a dot adds half of the note’s value. Save bow on the long notes so you don’t run out.', { kind: 'staff', clef: 'treble', notes: ['D4/q', 'F#4/q', 'A4/q', 'D5/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(T, D_MAJ, { key: 'D', time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
        read(T, A_MAJ, { key: 'A', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vt4-4', 'Frère Jacques & London Bridge', 'song', 'Two songs on the A and E strings', [
        piece('violin-frere-jacques'),
        piece('violin-london-bridge'),
      ], [
        insight('Loud and soft', 'f (forte) means loud and p (piano) soft. For a louder note use more bow, more weight and play a little nearer the bridge; for a softer one, less of each and nearer the fingerboard.'),
      ]),
      lesson('vt4-5', 'Ode to Joy', 'practice', 'Beethoven’s tune, and reading in two keys', [
        piece('violin-ode-to-joy'),
        keysig(T, 'D A', 8),
        read(T, D_MAJ, { key: 'D', rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
        read(T, A_MAJ, { key: 'A', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vt4-c', 'Checkpoint: The E String', 'checkpoint', 'D and A major in time', [
        name(T, 'D4 E4 F#4 G4 A4 B4 C#5 D5 E5 F#5 G#5 A5', 16),
        scale('A', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(T, A_MAJ, { key: 'A', rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
        read(T, D_MAJ, { key: 'D', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['E-string notes', 'A major scale', '3/4 time']),

    // ------------------------------------------------------------------ 5
    unit('vt5', 'The G String & G Major', 'A, B and C on the G string, the low 2nd finger, G major and eighth notes.', [
      lesson('vt5-1', 'The G String: A, B and C', 'learn', 'Down among the ledger lines', [
        meet(T, 'A3 B3 C4', { frets: [at(4, 2, 1), at(4, 4, 2), at(4, 5, 3)], tips: ['A on the G string, 1st finger, on the second ledger line below the staff.', 'B with a high 2nd finger, just under the first ledger line.', 'C, middle C, with the 3rd finger, on the first ledger line.'] }),
        name(T, G_STR, 10),
        play(T, G_STR, 8, { hints: true }),
        read(T, G_STR, { key: 'G', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Notes below the staff', 'G, A, B and C count up the ledger lines: G below the second line, A on it, B between the lines, C on the first.', { kind: 'staff', clef: 'treble', notes: ['G3', 'A3', 'B3', 'C4'], labels: true }),
        insight('Reaching the G string', 'Raise your right elbow for the G string, and bring your left elbow a little further under the violin so the fingers can curve over to it. The G string is thick: give it time to start speaking.'),
      ]),
      lesson('vt5-2', 'Low Second Finger: C and G', 'learn', 'The 2nd finger slides back to touch the 1st', [
        meet(T, 'C5 G5', { frets: [at(2, 3, 2), at(1, 3, 2)], tips: ['C natural on the A string: the 2nd finger low, touching the 1st. One semitone lower than C♯.', 'G natural on the E string: low 2nd finger again, in the space above the staff.'] }),
        name(T, 'A4 B4 C5 D5 E5 F#5 G5', 12),
        play(T, 'B4 C5 D5 F#5 G5 A5', 8, { hints: true }),
        read(T, G_MAJ_HIGH, { key: 'G', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Low 2: the 1 2 3 pattern', 'In G major the A and E strings need C and G natural, so the 2nd finger moves back to touch the 1st: a tone, a semitone, a tone. Now fingers 1 and 2 touch, and 2 and 3 are apart.', fretsVisual([{ string: 2, fret: 0, label: 'A' }, { string: 2, fret: 2, finger: 1, label: 'B' }, { string: 2, fret: 3, finger: 2, label: 'C' }, { string: 2, fret: 5, finger: 3, label: 'D' }], 0, 7)),
      ]),
      lesson('vt5-3', 'The G Major Scale', 'learn', 'One octave, then two', [
        scale('G', 'major', 'R', { octave: 3, clef: T }),
        scale('G', 'major', 'R', { octave: 4, clef: T }),
        scale('G', 'major', 'R', { octave: 3, octaves: 2, clef: T, title: 'G major, two octaves' }),
        read(T, G_MAJ, { key: 'G', rhythms: RH.qh, maxLeap: 3 }),
      ], [
        insight('The key of G', 'G major has one sharp, F♯. The pattern changes from string to string: high 2 on the G and D strings, low 2 on the A and E strings. Listen to the ringing tones on G, D and A to check yourself.', { kind: 'staff', clef: 'treble', notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'], key: 'G' }),
      ]),
      lesson('vt5-4', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighth notes', 'An eighth note lasts half a beat; pairs are joined by a beam. Count “1 & 2 &”. Use short, even bows in the middle of the bow, down on the beat and up on the “&”.', { kind: 'staff', clef: 'treble', notes: ['D4/e', 'E4/e', 'F#4/q', 'F#4/e', 'E4/e', 'D4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.eighths, maxLeap: 1 }),
        read(T, G_MAJ, { key: 'G', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('vt5-5', 'Aura Lee & the Saints', 'song', 'A ballad in G and a march in D', [
        piece('violin-aura-lee'),
        piece('violin-when-the-saints'),
      ]),
      lesson('vt5-c', 'Checkpoint: G Major', 'checkpoint', 'G major across all four strings', [
        name(T, G_MAJ2, 16, { sequence: true }),
        play(T, G_MAJ, 10),
        scale('G', 'major', 'R', { octave: 3, octaves: 2, clef: T, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(T, G_MAJ, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['G-string notes', 'Low 2', 'G major', 'Eighth notes']),

    // ------------------------------------------------------------------ 6
    unit('vt6', 'C Major & Natural Notes', 'F and C natural, the C major scale, pickups, ties and a minuet by Bach’s circle.', [
      lesson('vt6-1', 'F Natural on the D String', 'learn', 'One finger, two places', [
        meet(T, 'F4 F#4', { frets: [at(3, 3, 2), at(3, 4, 2)], tips: ['F natural: the 2nd finger low, touching the 1st, on the bottom space of the staff.', 'F♯: the same finger high, touching the 3rd. Same line on the staff; the sharp makes the difference.'] }),
        name(T, C_MAJ, 12),
        play(T, 'D4 E4 F4 G4 A4 B4 C5', 10, { hints: true }),
        read(T, C_MAJ, { rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('High 2 or low 2?', 'The key signature tells your 2nd finger where to go. With F♯ and C♯ (D major) it sits high; with F and C natural (C major) it sits low, next to the 1st finger.', fretsVisual([{ string: 3, fret: 2, finger: 1, label: 'E' }, { string: 3, fret: 3, finger: 2, label: 'F' }, { string: 3, fret: 4, finger: 2, label: 'F♯' }, { string: 3, fret: 5, finger: 3, label: 'G' }], 0, 7)),
      ]),
      lesson('vt6-2', 'The C Major Scale', 'learn', 'No sharps, no flats', [
        scale('C', 'major', 'R', { octave: 4, clef: T }),
        scale('C', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 72 }),
        keysig(T, 'C G D A', 8),
        read(T, C_MAJ_WIDE, { rhythms: RH.eighths, maxLeap: 3 }),
      ], [
        insight('C major on the violin', 'C major starts with the 3rd finger on the G string. Low 2 on the D and A strings gives F and C natural: no sharps at all.', { kind: 'staff', clef: 'treble', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], labels: true }),
      ]),
      lesson('vt6-3', 'Pickups & Ties', 'learn', 'Notes that lead in and notes that hold over', [
        tip('Pickups and ties', 'A pickup is a short first bar that leads into beat one: count the missing beats before you start. A tie joins two notes of the same pitch: keep the bow moving through both, with no new start.', { kind: 'staff', clef: 'treble', notes: ['D4/q', 'F#4/q', 'A4/h~', 'A4/h', 'F#4/h'], time: [4, 4] }),
        vpiece('Ties Across the Bar', 'D', [4, 4], [TIES]),
        read(T, G_MAJ, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vt6-4', 'A Minuet and a Serenade', 'song', 'Bach’s Notebook and Mozart’s night music', [
        piece('violin-minuet-in-g'),
        piece('violin-eine-kleine-nachtmusik'),
      ], [
        insight('The minuet', 'A minuet is an elegant dance in three. This one comes from the notebook Bach kept for his wife Anna Magdalena (it was probably written by Christian Petzold). Lean a little on beat one of every bar.'),
      ]),
      lesson('vt6-c', 'Checkpoint: Natural Notes', 'checkpoint', 'High and low 2nd fingers on sight', [
        name(T, C_MAJ_WIDE, 16),
        keysig(T, 'C G D A', 8),
        read(T, C_MAJ, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, G_MAJ, { key: 'G', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['F and C naturals', 'C major', 'Pickups & ties']),

    // ------------------------------------------------------------------ 7
    unit('vt7', 'Dotted Rhythms, Slurs & Six-Eight', 'Long–short rhythms, two notes in one bow, compound time and a jig.', [
      lesson('vt7-1', 'The Dotted Quarter', 'learn', 'Long–short: dotted quarter + eighth', [
        tip('The dot', 'A dotted quarter lasts 1½ beats and is usually followed by an eighth: count “1 – & 2”. Use a longer, slower bow for the dotted note and a quick, light one for the eighth.', { kind: 'staff', clef: 'treble', notes: ['F#4/q.', 'E4/e', 'E4/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 63 }),
        piece('violin-oh-susanna'),
      ]),
      lesson('vt7-2', 'Slurs', 'learn', 'Two or more notes in one bow', [
        tip('Slurs', 'A curved line joining different notes is a slur: play them all in one bow, changing only the left-hand fingers. (A curve joining the same note twice is a tie.) Slurred notes need less bow each, so plan your bow before you start.'),
        vpiece('Slurred Pairs', 'G', [4, 4], [SLURS], { prompt: 'Try slurring each pair of eighth notes into one bow: down for the first pair, up for the next.' }),
        read(T, G_MAJ, { key: 'G', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('vt7-3', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighth notes per bar, grouped in two sets of three: “ONE two three FOUR five six”. Feel two big beats, not six small ones.', { kind: 'staff', clef: 'treble', notes: ['D4/q', 'E4/e', 'F#4/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(T, D_MAJ, { key: 'D', time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
        piece('violin-row-your-boat'),
      ]),
      lesson('vt7-4', 'A Jig', 'song', 'An Irish dance tune in 6/8', [
        piece('violin-irish-washerwoman'),
        read(T, G_MAJ, { key: 'G', time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Fiddle or violin?', 'Same instrument, different music. Fiddlers play dance tunes like this jig by ear and at speed. Keep the bow short and lively, with a little lift on each big beat.'),
      ]),
      lesson('vt7-c', 'Checkpoint: Rhythm', 'checkpoint', 'Dotted, slurred and compound rhythms', [
        rhythm([6, 8], RH.compound, { tempo: 66, reps: 1 }),
        read(T, D_MAJ, { key: 'D', rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(T, G_MAJ, { key: 'G', time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', 'Slurs', '6/8', 'Jigs']),

    // ------------------------------------------------------------------ 8
    unit('vt8', 'Low First Finger: F and B♭ Major', 'B♭, F and E♭ with a low 1st finger, flat keys and two songs to sing along to.', [
      lesson('vt8-1', 'B Flat and F Natural', 'learn', 'The 1st finger moves back towards the scroll', [
        meet(T, 'Bb4 F5', { frets: [at(2, 1, 1), at(1, 1, 1)], tips: ['B♭ on the A string: the 1st finger low, a semitone above the open string. It sits on the middle line with a flat.', 'F natural on the E string, low 1st finger: the top line of the staff.'] }),
        name(T, F_MAJ, 12),
        play(T, 'A4 Bb4 C5 D5 E5 F5', 8, { hints: true }),
        read(T, F_MAJ, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Low 1', 'A flat lowers a note by a semitone. B♭ is the 1st finger pulled back, almost touching the nut, half a tone from the open A. Keep the rest of the hand where it was.', fretsVisual([{ string: 2, fret: 0, label: 'A' }, { string: 2, fret: 1, finger: 1, label: 'B♭' }, { string: 2, fret: 2, finger: 1, label: 'B' }, { string: 2, fret: 3, finger: 2, label: 'C' }], 0, 6)),
      ]),
      lesson('vt8-2', 'The F Major Scale', 'learn', 'One flat', [
        scale('F', 'major', 'R', { octave: 4, clef: T }),
        scale('F', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 72 }),
        read(T, F_MAJ, { key: 'F', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('The key of F', 'F major has one flat, B♭, on the middle line: every B becomes B♭. On the violin, F major starts with a low 2nd finger on the D string.', { kind: 'staff', clef: 'treble', notes: ['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5'], key: 'F' }),
      ]),
      lesson('vt8-3', 'E Flat and B Flat Major', 'learn', 'Two flats', [
        meet(T, 'Eb4 Bb3', { frets: [at(3, 1, 1), at(4, 3, 2)], tips: ['E♭ on the D string: low 1st finger, in the bottom line of the staff with a flat.', 'B♭ on the G string: low 2nd finger, just under the first ledger line.'] }),
        scale('Bb', 'major', 'R', { octave: 3, clef: T }),
        read(T, BB_MAJ, { key: 'Bb', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('The key of B♭', 'B♭ major has two flats, B♭ and E♭. Low 1st fingers on the D and A strings, low 2nd on the G string: the hand leans back towards the scroll.', { kind: 'staff', clef: 'treble', notes: ['Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4'], key: 'Bb' }),
      ]),
      lesson('vt8-4', 'Key Signatures', 'practice', 'Sharps and flats at a glance', [
        keysig(T, 'C G D A F Bb', 10),
        read(T, F_MAJ, { key: 'F', rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
        read(T, BB_MAJ, { key: 'Bb', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        interval(T, F_MAJ, [3, 4, 5, 6], 10, { key: 'F' }),
      ], [
        insight('Reading a key signature', 'Sharps always come in the order F C G D…, flats in the order B E A D… In a sharp key the last sharp is one step below the home note; in a flat key the second-to-last flat is the home note.', { kind: 'staff', clef: 'treble', notes: ['A4'], key: 'A' }),
      ]),
      lesson('vt8-5', 'Yankee Doodle & Amazing Grace', 'song', 'A march and a hymn in F', [
        piece('violin-yankee-doodle'),
        piece('violin-amazing-grace'),
      ]),
      lesson('vt8-c', 'Checkpoint: Flat Keys', 'checkpoint', 'F and B♭ major on sight', [
        keysig(T, 'C G D F Bb', 8),
        read(T, F_MAJ, { key: 'F', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, BB_MAJ, { key: 'Bb', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Low 1', 'F and B♭ major', 'Key signatures']),

    // ------------------------------------------------------------------ 9
    unit('vt9', 'Accidentals & the High Third Finger', 'G♯, D♯ and C♯ with a high 3rd finger, sharps, flats and naturals anywhere.', [
      lesson('vt9-1', 'High Third Finger', 'learn', 'The 3rd finger reaches up towards the 4th', [
        meet(T, 'G#4 C#4 D#5', { frets: [at(3, 6, 3), at(4, 6, 3), at(2, 6, 3)], tips: ['G♯ on the D string: the 3rd finger a semitone higher than G, close to where the 4th finger goes.', 'C♯ on the G string, high 3rd finger: middle C’s ledger line with a sharp.', 'D♯ on the A string, high 3rd finger.'] }),
        read(T, A_MAJ_LOW, { key: 'A', rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        scale('A', 'major', 'R', { octave: 3, octaves: 2, clef: T, title: 'A major, two octaves' }),
      ], [
        insight('A major from the bottom', 'Starting A major on the G string needs a high 3rd finger for C♯ and G♯: the pattern 0 1 2 34, with 3 and 4 touching.', fretsVisual([{ string: 3, fret: 2, finger: 1, label: 'E' }, { string: 3, fret: 4, finger: 2, label: 'F♯' }, { string: 3, fret: 6, finger: 3, label: 'G♯' }, { string: 3, fret: 7, finger: 4, label: 'A' }], 0, 8)),
      ]),
      lesson('vt9-2', 'Sharps, Flats and Naturals', 'learn', 'Every semitone in first position', [
        tip('Accidentals last a bar', 'A sharp, flat or natural written before a note lasts until the next bar line; then the key signature takes over again. A natural sign (♮) cancels a sharp or flat.', { kind: 'staff', clef: 'treble', notes: ['F4/q', 'F#4/q', 'G4/q', 'F4/q'], time: [4, 4] }),
        name(T, CHROMATIC, 14, { answers: 'accidentals' }),
        play(T, CHROMATIC, 12, { hints: true }),
      ], [
        insight('Semitones on a fretless string', 'Two notes a semitone apart are played with fingers touching, or by sliding one finger. Between E and F, and between B and C, there is only a semitone, so those are always close fingers.'),
      ]),
      lesson('vt9-3', 'Chromatic Melodies', 'practice', 'Climbing in semitones', [
        vpiece('Chromatic Climb', 'C', [4, 4], [CHROMATIC_A], { prompt: 'Slide each finger up a semitone for the sharp, back down for the flat. Follow the finger numbers.' }),
        vpiece('Neighbour-Note Waltz', 'D', [3, 4], [NEIGHBOURS], { prompt: 'Each sharp leans on the note above it: up a semitone and back.' }),
        play(T, CHROMATIC, 12),
      ]),
      lesson('vt9-4', 'Grieg and Beethoven', 'song', 'Two famous tunes full of accidentals', [
        piece('violin-hall-of-the-mountain-king'),
        piece('violin-fur-elise'),
      ]),
      lesson('vt9-c', 'Checkpoint: Accidentals', 'checkpoint', 'Name and play every semitone in first position', [
        name(T, CHROMATIC, 16, { answers: 'accidentals' }),
        play(T, CHROMATIC, 12),
        vpiece('Chromatic Climb', 'C', [4, 4], [CHROMATIC_A], { mode: 'tempo', tempo: 60, fingering: 'first' }),
      ]),
    ], ['High 3', '♯ ♭ ♮', 'Chromatic notes']),

    // ------------------------------------------------------------------ 10
    unit('vt10', 'Minor Keys', 'A, D and E minor: relative minors, the raised 7th and folk tunes in the Dorian mode.', [
      lesson('vt10-1', 'A Minor', 'learn', 'The relative minor of C', [
        scale('A', 'natural-minor', 'R', { octave: 4, clef: T }),
        read(T, A_MIN, { key: 'Am', rhythms: RH.qh, maxLeap: 2 }),
        scale('A', 'harmonic-minor', 'R', { octave: 4, clef: T }),
        read(T, A_MIN_H, { key: 'Am', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Relative minor', 'A minor uses the same notes and key signature as C major, but its home note is A. Minor tunes often raise the 7th note to lead home: G♯ in A minor, written as an accidental.', { kind: 'staff', clef: 'treble', notes: ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5'], key: 'Am' }),
      ]),
      lesson('vt10-2', 'D Minor', 'learn', 'One flat, with C♯ leading home', [
        keysig(T, 'Am Dm Em', 8),
        scale('D', 'natural-minor', 'R', { octave: 4, clef: T }),
        scale('D', 'harmonic-minor', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 66 }),
        read(T, D_MIN, { key: 'Dm', rhythms: RH.qh, maxLeap: 2 }),
        read(T, D_MIN_H, { key: 'Dm', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('D minor', 'D minor shares F major’s key signature, one flat. Its harmonic form raises the 7th to C♯: a high 2nd finger on the A string, right next to the 3rd.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C#5', 'D5'], key: 'Dm' }),
      ]),
      lesson('vt10-3', 'E Minor', 'learn', 'One sharp, the relative minor of G', [
        scale('E', 'natural-minor', 'R', { octave: 4, clef: T }),
        read(T, E_MIN, { key: 'Em', rhythms: RH.qh, maxLeap: 3 }),
        piece('violin-greensleeves'),
      ], [
        insight('Minor colour', 'Minor keys sound darker because the 3rd note of the scale is a semitone lower. On the violin that often means a low 2nd finger where a major key had a high one.'),
      ]),
      lesson('vt10-4', 'Folk Songs in Minor', 'song', 'An English ballad and a sea shanty', [
        piece('violin-scarborough-fair'),
        piece('violin-drunken-sailor'),
      ], [
        insight('The Dorian sound', 'Many folk tunes use the Dorian mode: a minor scale with a raised 6th. In D minor that means B natural instead of B♭, so watch for the natural signs.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'], key: 'Dm' }),
      ]),
      lesson('vt10-c', 'Checkpoint: Minor Keys', 'checkpoint', 'Read in A, D and E minor', [
        keysig(T, 'Am Dm Em', 8),
        read(T, A_MIN_H, { key: 'Am', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, D_MIN, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
        read(T, E_MIN, { key: 'Em', rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['A, D and E minor', 'Harmonic minor', 'Dorian']),

    // ------------------------------------------------------------------ 11
    unit('vt11', 'Third Position', 'Move the whole hand up: new places for old notes, shifting, and notes up to D6.', [
      lesson('vt11-1', 'What Is Third Position?', 'learn', 'The 1st finger takes the 3rd finger’s place', [
        meet(T, 'D5 E5 F#5 G5', {
          frets: [at(2, 5, 1), at(2, 7, 2), at(2, 9, 3), at(2, 10, 4)],
          tips: ['D on the A string with the 1st finger, where the 3rd finger played it in first position.', 'E with the 2nd finger: the same pitch as the open E string.', 'F♯ with the 3rd finger.', 'G with the 4th finger: in first position this was the low 2nd on the E string.'],
        }),
        read(T, POS3_A, { key: 'G', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Positions', 'A position is named after where the 1st finger lies. In first position it is a tone above the open string; in third position it sits where the 3rd finger was. The finger patterns stay the same, a fourth higher.', fretsVisual([{ string: 2, fret: 5, finger: 1, label: 'D' }, { string: 2, fret: 7, finger: 2, label: 'E' }, { string: 2, fret: 9, finger: 3, label: 'F♯' }, { string: 2, fret: 10, finger: 4, label: 'G' }], 3, 11)),
        insight('The whole hand moves', 'Move the thumb with the hand, and let the base of your palm touch the violin’s shoulder: that is your landmark for third position. Keep the elbow a little further under the violin.'),
      ]),
      lesson('vt11-2', 'The E String Up High', 'learn', 'A, B, C and D above the staff', [
        meet(T, 'A5 B5 C6 D6', { frets: [at(1, 5, 1), at(1, 7, 2), at(1, 8, 3), at(1, 10, 4)], tips: ['A on the E string, 1st finger in third position: the first ledger line above the staff.', 'B, 2nd finger.', 'C, 3rd finger, close to the 2nd: on the second ledger line.', 'D, 4th finger, above the second ledger line.'] }),
        name(T, 'E5 F5 G5 A5 B5 C6 D6', 12),
        read(T, POS3_AE, { key: 'G', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('High ledger lines', 'Above the staff the ledger lines count on: G above the top line, A on the first ledger line, B above it, C on the second, D above that.', { kind: 'staff', clef: 'treble', notes: ['G5', 'A5', 'B5', 'C6', 'D6'], labels: true }),
      ]),
      lesson('vt11-3', 'Shifting', 'learn', 'Travel between first and third position', [
        tip('How to shift', 'Shift on an open string when you can: the hand moves while the string rings. Otherwise slide lightly along the string on the finger you are using, keep the thumb loose and travel with it, then let the new finger fall. Lighten the bow a little as you go.'),
        vpiece('Shifting Study', 'D', [4, 4], [SHIFTING], { prompt: 'First position, then shift to third while the open string rings. Follow the finger numbers.' }),
        read(T, POS3_DAE, { key: 'G', guitarPosition: 5, rhythms: RH.qh, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('vt11-4', 'Two-Octave Scales', 'practice', 'G, A and B♭ in two octaves, D up in third position', [
        scale('G', 'major', 'R', { octave: 3, octaves: 2, clef: T, mode: 'tempo', tempo: 76, fingering: 'first' }),
        scale('A', 'major', 'R', { octave: 3, octaves: 2, clef: T }),
        scale('Bb', 'major', 'R', { octave: 3, octaves: 2, clef: T }),
        scale('D', 'major', 'R', { octave: 5, clef: T, guitarPosition: 5, title: 'D major in third position' }),
      ]),
      lesson('vt11-5', 'Songs up High', 'song', 'Dvořák’s Largo and a carol in third position', [
        piece('violin-goin-home'),
        piece('violin-silent-night'),
      ]),
      lesson('vt11-c', 'Checkpoint: Third Position', 'checkpoint', 'Read and shift up to D6', [
        name(T, FULL, 18, { sequence: true }),
        read(T, POS3_AE, { key: 'G', guitarPosition: 5, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, POS3_DAE_D, { key: 'D', guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['3rd position', 'Shifting', 'Two-octave scales']),

    // ------------------------------------------------------------------ 12
    unit('vt12', 'Double Stops & Repertoire', 'Two strings at once, Pachelbel’s Canon and a final songbook.', [
      lesson('vt12-1', 'Double Stops with Open Strings', 'learn', 'A melody over a drone', [
        tip('Two strings at once', 'To play two strings together, find the bow level between them and let the bow rest on both with even weight. Start with an open string under a melody, like a bagpipe’s drone.', { kind: 'staff+frets', clef: 'treble', notes: ['[D4 B4]/w'], positions: [{ string: 3, fret: 0 }, { string: 2, fret: 2, finger: 1 }] }),
        vpiece('Drone Study', 'D', [4, 4], [DRONE_STUDY], { prompt: 'The open D (then the open A) sounds under every note. Keep both strings ringing.' }),
        piece('violin-drone-hymn'),
      ]),
      lesson('vt12-2', 'Sixths', 'practice', 'Stacked notes on neighbouring strings', [
        interval(T, D_MAJ, [5, 6, 8], 10, { harmonic: true, key: 'D' }),
        read(T, 'E4 F#4 G4 A4 B4 C#5 D5', { key: 'D', rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.35, intervals: [6] } }),
      ], [
        insight('Reading stacked notes', 'Two notes stacked on the staff sound together. Read the bottom note, then the gap: a 6th lies on neighbouring strings with the upper finger a little higher than the lower one.', { kind: 'staff+frets', clef: 'treble', notes: ['[F#4 D5]/w'], positions: [{ string: 3, fret: 4, finger: 2 }, { string: 2, fret: 5, finger: 3 }] }),
      ]),
      lesson('vt12-3', 'Final Songbook', 'song', 'Pachelbel’s famous melody and a hymn', [
        piece('violin-canon-in-d'),
        piece('violin-amazing-grace', { mode: 'tempo', fingering: 'first' }),
      ]),
      lesson('vt12-4', 'Speed Reading', 'challenge', 'Sight-read at tempo', [
        name(T, FULL1, 30, { sequence: true, title: 'Lightning round' }),
        read(T, G_MAJ2, { key: 'G', rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(T, POS3_DAE, { key: 'G', guitarPosition: 5, rhythms: RH.syncopation, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 69, fingering: 'none' }),
      ]),
      lesson('vt12-c', 'Final Exam: Violin', 'checkpoint', 'Prove your mastery', [
        name(T, FULL, 30, { sequence: true }),
        keysig(T, 'D A G F Bb Am Dm', 9),
        read(T, G_MAJ2, { key: 'G', rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none', measures: 6 }),
        read(T, POS3_AE_D, { key: 'D', guitarPosition: 5, time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
        read(T, D_MIN_H, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Double stops', 'Sixths', 'Sight-reading']),
  ],
};
