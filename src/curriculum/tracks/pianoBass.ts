import { P, RH, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit, inlinePiece } from '../builders';
import type { TimeSig } from '../../music/rhythm';
import type { ActivityDef, TrackDef } from '../types';

const B = 'bass' as const;

type PieceOpts = Parameters<typeof inlinePiece>[4];

/** A fixed left-hand étude on the bass staff. */
const lhPiece = (title: string, key: string, time: TimeSig, voice: string, o?: PieceOpts): ActivityDef =>
  inlinePiece(title, key, time, [{ clef: B, hand: 'L', voices: [voice] }], o);

// Pools used in more than one place
const MID_C_DOWN = 'A3 B3 C4';
const G2_C4 = 'G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4';
const F2_C4 = 'F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4';
const C2_E4 = 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4';
const CHROMATIC = 'C3 C#3 D3 Eb3 E3 F3 F#3 G3 Ab3 A3 Bb3 B3 C4';
const DEEP = 'C1 D1 E1 F1 G1 A1 B1 C2 D2 E2';

export const pianoBass: TrackDef = {
  id: 'piano-bass',
  instrument: 'piano',
  title: 'Bass Clef',
  subtitle: 'Piano · Left hand',
  description: 'Read the bass clef fluently with your left hand — from Middle C down to the deepest notes, with real fingering, bass lines and accompaniment patterns.',
  clef: 'bass',
  hand: 'L',
  accent: '#69b8ff',
  glyph: '𝄢',
  heatmap: [{ clef: 'bass', low: 'C2', high: 'E4' }],
  units: [
    // -----------------------------------------------------------------------
    unit('pb1', 'Middle C from Below', 'Your first three left-hand notes, with the thumb on Middle C.', [
      lesson('pb1-1', 'Meet Middle C', 'learn', 'Find Middle C on the bass staff and play it with your left thumb', [
        meet(B, 'C4', { hand: 'L', fingers: [1], tips: ['In the bass clef, Middle C sits on its own short ledger line just ABOVE the staff. It is the very same key as the treble clef’s Middle C. Rest your left thumb (finger 1) on it.'] }),
        meet(B, 'B3', { hand: 'L', fingers: [2], tips: ['B sits in the space just above the top line — the white key right next to Middle C. Finger 2.'] }),
        name(B, 'B3 C4', 8),
        play(B, 'B3 C4', 8, { hand: 'L', hints: true }),
      ], [
        insight('The bass clef', 'The bass clef (𝄢) is also called the F clef: its two dots surround the fourth line, and every note on that line is the F below Middle C. Your left hand usually reads this staff.', { kind: 'staff', clef: 'bass', notes: ['F3'], labels: true }),
        insight('Left-hand fingers', 'The thumb is finger 1 on both hands, so on the left hand the numbers run the other way: pinky (5) on the left, thumb (1) on the right, nearest the middle of the piano.', { kind: 'keys', notes: ['F3', 'G3', 'A3', 'B3', 'C4'], fingers: [5, 4, 3, 2, 1], hand: 'L' }),
      ]),
      lesson('pb1-2', 'Hello, A', 'learn', 'Add A — the top line of the bass staff', [
        meet(B, 'A3', { hand: 'L', fingers: [3], tips: ['A sits right on the top line of the bass staff. Your middle finger, 3, plays it.'] }),
        name(B, MID_C_DOWN, 10),
        play(B, MID_C_DOWN, 10, { hand: 'L', hints: true }),
        lhPiece('Your first melody', 'C', [4, 4], 'C4/q@1 B3@2 A3@3 B3@2 | C4@1 C4@1 C4/h@1 | B3/q@2 B3@2 A3@3 B3@2 | C4/w@1 |', { noteNames: true }),
      ]),
      lesson('pb1-3', 'Step by Step', 'practice', 'Read stepwise melodies with C, B and A', [
        tip('Steps', 'From a line to the very next space (or space to line) is a step — the next key on the piano. Middle C (ledger line) → B (space) → A (top line) walks down by steps.', { kind: 'staff', clef: 'bass', notes: ['C4', 'B3', 'A3', 'B3', 'C4'], labels: true }),
        read(B, MID_C_DOWN, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true }),
        read(B, MID_C_DOWN, { rhythms: RH.qh, maxLeap: 1 }),
        name(B, MID_C_DOWN, 12, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('pb1-4', 'Skipping', 'practice', 'Jump from Middle C to A — a skip', [
        tip('Skips', 'Middle C (ledger line) to A (top line) jumps over B: line to line is a skip. Thumb and finger 3 play it while finger 2 hovers over B.', { kind: 'staff', clef: 'bass', notes: ['C4', 'A3', 'C4'], labels: true }),
        lhPiece('Skip Study', 'C', [4, 4], 'C4/q@1 A3@3 C4@1 A3@3 | B3@2 C4@1 A3/h@3 | A3/q@3 C4@1 B3@2 A3@3 | C4/w@1 |'),
        read(B, MID_C_DOWN, { rhythms: RH.qh, maxLeap: 2, leapiness: 0.6, fingering: 'first' }),
        piece('plh-hot-cross-buns'),
      ]),
      lesson('pb1-c', 'Checkpoint: Middle C from Below', 'checkpoint', 'Show you know C, B and A', [
        name(B, MID_C_DOWN, 12),
        play(B, MID_C_DOWN, 10, { hand: 'L' }),
        read(B, MID_C_DOWN, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['C B A', 'LH finger numbers', 'Steps & skips']),

    // -----------------------------------------------------------------------
    unit('pb2', 'Middle C Position', 'All five left-hand fingers on F G A B C.', [
      lesson('pb2-1', 'G and F', 'learn', 'Meet G (top space) and F (the F-clef line)', [
        meet(B, 'G3 F3', { hand: 'L', fingers: [4, 5], tips: ['G lives in the top space of the staff — finger 4.', 'F sits on the fourth line, right between the two dots of the bass clef — finger 5, your pinky.'] }),
        name(B, P.lhMid, 12),
        play(B, P.lhMid, 12, { hand: 'L', hints: true }),
      ], [insight('Middle C position', 'Left thumb on Middle C, the other fingers on the next white keys down: F G A B C under 5 4 3 2 1. Five notes, five fingers, no moving required.', { kind: 'keys', notes: ['F3', 'G3', 'A3', 'B3', 'C4'], fingers: [5, 4, 3, 2, 1], hand: 'L' })]),
      lesson('pb2-2', 'Lines and Spaces', 'practice', 'Tell line notes from space notes', [
        tip('Lines and spaces', 'F, A and Middle C sit ON lines. G and B sit IN spaces. Spot line-or-space first and the name follows.', { kind: 'staff', clef: 'bass', notes: ['F3', 'G3', 'A3', 'B3', 'C4'], labels: true }),
        name(B, P.lhMid, 15),
        read(B, P.lhMid, { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: true }),
      ]),
      lesson('pb2-3', 'Five Fingers', 'practice', 'Melodies across the whole Middle C position', [
        read(B, P.lhMid, { rhythms: RH.qh, maxLeap: 2, five: true }),
        read(B, P.lhMid, { rhythms: RH.qh, maxLeap: 2, five: true, fingering: 'first' }),
        play(B, P.lhMid, 10, { hand: 'L' }),
      ]),
      lesson('pb2-4', 'First Songs', 'song', 'Two classics for the left hand alone', [
        piece('plh-mary-had-a-little-lamb'),
        piece('plh-lantern-walk'),
      ]),
      lesson('pb2-5', 'Reading by Interval', 'learn', 'See the distance between notes', [
        tip('Intervals', 'Good readers see distances. A 2nd is a step (line→space), a 3rd a skip (line→line), then 4ths and 5ths. Pinky F to thumb C is a 5th — your whole hand.', { kind: 'staff', clef: 'bass', notes: ['F3', 'G3', 'F3', 'A3', 'F3', 'B3', 'F3', 'C4'] }),
        interval(B, P.lhMid, [2, 3], 10),
        interval(B, P.lhMid, [2, 3, 4, 5], 10),
        read(B, P.lhMid, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.5, five: true, fingering: 'first' }),
      ]),
      lesson('pb2-c', 'Checkpoint: Middle C Position', 'checkpoint', 'Read anything from F to Middle C', [
        name(B, P.lhMid, 15),
        read(B, P.lhMid, { rhythms: RH.qh, maxLeap: 3, five: true, fingering: 'first' }),
        read(B, P.lhMid, { rhythms: RH.qhw, maxLeap: 4, five: true, fingering: 'none' }),
      ]),
    ], ['F G', 'Middle C position', 'Intervals 2nd–5th']),

    // -----------------------------------------------------------------------
    unit('pb3', 'Rhythm & Rests', 'Count quarters, halves, wholes and silences — left hand.', [
      lesson('pb3-1', 'Counting Time', 'learn', 'Quarter, half and whole notes in 4/4', [
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(B, P.lhMid, { rhythms: RH.qhw, maxLeap: 2, five: true, mode: 'tempo', tempo: 66 }),
      ], [insight('Note values', 'In 4/4 there are four beats in every bar. A quarter note gets 1 beat, a half note 2, a whole note 4. Count “1 2 3 4” out loud while you play.', { kind: 'staff', clef: 'bass', notes: ['C4/q', 'B3/q', 'A3/h', 'F3/w'], time: [4, 4] })]),
      lesson('pb3-2', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three — the dot adds half the note’s value again.', { kind: 'staff', clef: 'bass', notes: ['F3/q', 'A3/q', 'C4/q', 'A3/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(B, P.lhMid, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2, five: true }),
      ]),
      lesson('pb3-3', 'Silence Counts', 'learn', 'Quarter and half rests', [
        tip('Rests', 'A rest is a beat of silence — it still gets counted. Lift the finger but keep the hand resting in position, ready for the next note.', { kind: 'staff', clef: 'bass', notes: ['C4/q', 'r/q', 'A3/q', 'r/q', 'F3/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(B, P.lhMid, { rhythms: RH.rests, maxLeap: 2, five: true, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('pb3-4', 'Waltz & Moonlight', 'song', 'A quiet waltz and Au Clair de la Lune', [
        piece('plh-quiet-waltz'),
        piece('plh-au-clair-de-la-lune'),
      ]),
      lesson('pb3-c', 'Checkpoint: Rhythm', 'checkpoint', 'Keep steady time while reading', [
        rhythm([4, 4], RH.rests, { tempo: 76, reps: 1 }),
        read(B, P.lhMid, { rhythms: RH.rests, maxLeap: 3, five: true, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, P.lhMid, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, five: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
      ]),
    ], ['4/4 & 3/4', 'Rests', 'Steady pulse']),

    // -----------------------------------------------------------------------
    unit('pb4', 'Down the Staff', 'Move the hand down: bass C position and G position.', [
      lesson('pb4-1', 'Bass C Position', 'learn', 'C, D and E in the middle of the staff', [
        meet(B, 'C3 D3 E3', { hand: 'L', fingers: [5, 4, 3], tips: ['Bass C sits in the second space — exactly one octave below Middle C. A landmark worth memorising. Finger 5.', 'D sits on the middle line of the staff — finger 4.', 'E sits in the third space — finger 3.'] }),
        meet(B, 'F3 G3', { hand: 'L', fingers: [2, 1], tips: ['You know F: the clef line. In this position it’s finger 2.', 'G in the top space is now under your thumb.'] }),
        name(B, P.lhC, 12),
        play(B, P.lhC, 12, { hand: 'L', hints: true }),
      ], [insight('Bass C position', 'Slide the whole hand down so the pinky rests on the C below Middle C. Fingers 5 4 3 2 1 now cover C D E F G — same hand shape, new notes.', { kind: 'keys', notes: ['C3', 'D3', 'E3', 'F3', 'G3'], fingers: [5, 4, 3, 2, 1], hand: 'L' })]),
      lesson('pb4-2', 'C Position Melodies', 'practice', 'Read freely in bass C position', [
        read(B, P.lhC, { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: true }),
        read(B, P.lhC, { rhythms: RH.qhw, maxLeap: 2, five: true }),
        read(B, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pb4-3', 'Low G Position', 'learn', 'G, A and B at the bottom of the staff', [
        meet(B, 'G2 A2 B2', { hand: 'L', fingers: [5, 4, 3], tips: ['Low G sits on the bottom line of the bass staff. Finger 5.', 'A is in the first space — finger 4.', 'B sits on the second line — finger 3.'] }),
        name(B, P.lhG, 12),
        read(B, P.lhG, { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: true }),
      ], [insight('G position', 'One more step down: pinky on G, the bottom line. Fingers 5 4 3 2 1 cover G A B C D — and C, your old landmark, is now under finger 2.', { kind: 'keys', notes: ['G2', 'A2', 'B2', 'C3', 'D3'], fingers: [5, 4, 3, 2, 1], hand: 'L' })]),
      lesson('pb4-4', 'Three Positions', 'practice', 'Switch between G, C and Middle C positions', [
        tip('Shifting', 'When the notes leave your five fingers, lift the whole hand and land in the new position. Find the new pinky note before you need it.'),
        read(B, P.lhG, { rhythms: RH.qh, maxLeap: 2, five: true, measures: 2 }),
        read(B, P.lhC, { rhythms: RH.qh, maxLeap: 2, five: true, measures: 2 }),
        read(B, P.lhMid, { rhythms: RH.qh, maxLeap: 2, five: true, measures: 2 }),
        play(B, G2_C4, 12, { hand: 'L' }),
      ]),
      lesson('pb4-5', 'Songs Down Low', 'song', 'Two favourites in the lower positions', [
        piece('plh-ode-to-joy'),
        piece('plh-london-bridge'),
      ]),
      lesson('pb4-c', 'Checkpoint: Down the Staff', 'checkpoint', 'Read from low G up to Middle C', [
        name(B, G2_C4, 16),
        read(B, P.lhG, { rhythms: RH.rests, maxLeap: 3, five: true, fingering: 'first' }),
        read(B, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['C D E', 'G A B', 'Hand shifts']),

    // -----------------------------------------------------------------------
    unit('pb5', 'Landmarks of the Staff', 'Every line, every space — the whole bass staff.', [
      lesson('pb5-1', 'Every Line', 'learn', 'G B D F A', [
        name(B, 'G2 B2 D3 F3 A3', 15),
        play(B, 'G2 B2 D3 F3 A3', 10, { hand: 'L' }),
      ], [insight('The lines', 'From the bottom: G B D F A — “Good Boys Do Fine Always”. Faster still: use landmarks — low G (bottom line), D (middle line), F (the clef line) — and count from the nearest one.', { kind: 'staff', clef: 'bass', notes: ['G2', 'B2', 'D3', 'F3', 'A3'], labels: true })]),
      lesson('pb5-2', 'Every Space', 'learn', 'A C E G', [
        tip('The spaces', 'The four spaces spell A C E G from the bottom up — “All Cows Eat Grass”. Bass C in the second space is your landmark.', { kind: 'staff', clef: 'bass', notes: ['A2', 'C3', 'E3', 'G3'], labels: true }),
        name(B, 'A2 C3 E3 G3', 12),
        name(B, P.lhStaff, 16, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('pb5-3', 'Across the Staff', 'practice', 'Low F, and melodies that roam the staff', [
        meet(B, 'F2', { hand: 'L', fingers: [5], tips: ['Low F hangs in the space just below the staff — one octave below the clef’s F line. With B above the top line, it frames the staff.'] }),
        read(B, P.lhOctave, { rhythms: RH.qh, maxLeap: 2 }),
        read(B, P.lhStaff, { rhythms: RH.qh, maxLeap: 2 }),
        play(B, F2_C4, 14, { hand: 'L' }),
      ]),
      lesson('pb5-4', 'Songs Across the Staff', 'song', 'Melodies that use the whole staff', [
        piece('plh-jingle-bells'),
        piece('plh-yankee-doodle'),
      ]),
      lesson('pb5-c', 'Checkpoint: The Staff', 'checkpoint', 'Name and play every staff note', [
        name(B, F2_C4, 20, { sequence: true }),
        play(B, F2_C4, 14, { hand: 'L' }),
        read(B, P.lhStaff, { rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['Lines GBDFA', 'Spaces ACEG', 'F2–C4']),

    // -----------------------------------------------------------------------
    unit('pb6', 'Eighth Notes', 'Two notes per beat, pickups and ties.', [
      lesson('pb6-1', 'Two per Beat', 'learn', 'Eighth notes and beams', [
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(B, P.lhC, { rhythms: RH.eighths, maxLeap: 2, five: true }),
      ], [insight('Eighth notes', 'An eighth note is half a beat; pairs are joined by a beam. Count “1 & 2 & 3 & 4 &” and keep the fingers close to the keys.', { kind: 'staff', clef: 'bass', notes: ['C3/e', 'D3/e', 'E3/q', 'E3/e', 'F3/e', 'G3/q'], time: [2, 4] })]),
      lesson('pb6-2', 'Eighths in Every Position', 'practice', 'Eighth notes in G and Middle C positions', [
        read(B, P.lhG, { rhythms: RH.eighths, maxLeap: 2, five: true }),
        read(B, P.lhMid, { rhythms: RH.eighthsRests, maxLeap: 2, five: true, mode: 'tempo', tempo: 66, fingering: 'first' }),
        read(B, P.lhOctave, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pb6-3', 'Pickups & Ties', 'learn', 'Music that starts before beat one', [
        tip('Pickups and ties', 'A pickup is a short first bar that leads into beat one. A tie joins two notes of the same pitch — play once, hold for both.', { kind: 'staff', clef: 'bass', notes: ['G2/q', 'C3/h~', 'C3/q'], time: [4, 4] }),
        piece('plh-when-the-saints'),
        piece('plh-oh-susanna'),
      ]),
      lesson('pb6-c', 'Checkpoint: Eighths', 'checkpoint', 'Read eighth-note melodies in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        read(B, P.lhOctave, { rhythms: RH.eighths, maxLeap: 2, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(B, P.lhG, { rhythms: RH.eighthsRests, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['Eighth notes', 'Pickups', 'Ties']),

    // -----------------------------------------------------------------------
    unit('pb7', 'Sharps & Flats', 'Black keys, key signatures, G, F and D major.', [
      lesson('pb7-1', 'F Sharp', 'learn', 'The black key just above F', [
        meet(B, 'F#3', { hand: 'L', fingers: [3], tips: ['In D position (D E F♯ G A) the long middle finger reaches F♯ easily.'] }),
        read(B, P.lhD, { rhythms: RH.qh, maxLeap: 2, five: true, noteNames: true }),
        name(B, P.lhD, 12, { answers: 'accidentals' }),
      ], [insight('Sharps', 'A sharp (♯) raises a note a half step — to the very next key on the right, usually a black key. F♯ is the black key between F and G.', { kind: 'keys', notes: ['F3', 'F#3', 'G3'], low: 'C3', high: 'C4' })]),
      lesson('pb7-2', 'The Key of G', 'learn', 'One sharp in the key signature', [
        tip('Key signatures', 'In G major one sharp sits on the F line, right after the clef. Every F is now F♯ — in every octave — until the key changes.', { kind: 'staff', clef: 'bass', notes: ['F#3', 'F#2'], key: 'G' }),
        keysig(B, 'C G', 6),
        read(B, P.lhD, { key: 'G', rhythms: RH.eighths, maxLeap: 2, five: true }),
        read(B, P.lhG, { key: 'G', rhythms: RH.qhw, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pb7-3', 'B Flat & the Key of F', 'learn', 'One flat: B♭', [
        tip('Flats', 'A flat (♭) lowers a note a half step — to the next key on the left. F major has one flat, on the B line: every B is B♭.', { kind: 'staff', clef: 'bass', notes: ['Bb2', 'Bb3'], key: 'F' }),
        meet(B, 'Bb2', { hand: 'L', fingers: [2], tips: ['In F position (F G A B♭ C) B♭ falls under finger 2 — reach forward into the black keys.'] }),
        keysig(B, 'C G F', 8),
        read(B, P.lhF, { key: 'F', rhythms: RH.qh, maxLeap: 2, five: true }),
        read(B, 'F3 G3 A3 Bb3 C4', { key: 'F', rhythms: RH.qh, maxLeap: 2, five: true, fingering: 'first' }),
      ]),
      lesson('pb7-4', 'C Sharp & the Key of D', 'learn', 'Two sharps: F♯ and C♯', [
        tip('Two sharps', 'D major adds a second sharp, C♯, in the second space. In A position (A B C♯ D E) finger 3 takes the C♯.', { kind: 'staff', clef: 'bass', notes: ['C#3', 'F#3'], key: 'D' }),
        meet(B, 'C#3', { hand: 'L', fingers: [3] }),
        keysig(B, 'G F D', 8),
        read(B, 'A2 B2 C#3 D3 E3', { key: 'D', rhythms: RH.eighths, maxLeap: 2, five: true }),
        read(B, P.lhD, { key: 'D', rhythms: RH.qhw, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pb7-5', 'Accidentals', 'practice', 'Sharps and flats that appear mid-piece', [
        tip('Accidentals last a bar', 'A sharp, flat or natural written in the music lasts until the barline. Here E♭ turns C position into C minor — drop finger 3 onto the black key.', { kind: 'keys', notes: ['C3', 'D3', 'Eb3', 'F3', 'G3'], fingers: [5, 4, 3, 2, 1], hand: 'L' }),
        read(B, 'C3 D3 Eb3 F3 G3', { rhythms: RH.qh, maxLeap: 2, five: true }),
        name(B, CHROMATIC, 16, { answers: 'accidentals' }),
        play(B, CHROMATIC, 12, { hand: 'L' }),
      ]),
      lesson('pb7-6', 'Songs in G and F', 'song', 'Aura Lee in G and Frère Jacques in F', [
        piece('plh-aura-lee'),
        piece('plh-frere-jacques'),
      ]),
      lesson('pb7-c', 'Checkpoint: Sharps & Flats', 'checkpoint', 'Read with key signatures', [
        keysig(B, 'C G F D', 8),
        read(B, P.lhD, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, five: true, fingering: 'first' }),
        read(B, P.lhF, { key: 'F', rhythms: RH.eighths, maxLeap: 3, five: true, fingering: 'none' }),
        read(B, 'A2 B2 C#3 D3 E3', { key: 'D', rhythms: RH.qhw, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['♯ and ♭', 'G F D major', 'Key signatures']),

    // -----------------------------------------------------------------------
    unit('pb8', 'Finger Over: Scales', 'Play beyond five fingers with smooth left-hand crossings.', [
      lesson('pb8-1', 'The C Major Scale', 'learn', 'Fingering 5-4-3-2-1, then 3 over the thumb', [
        lhPiece('Crossing Drill', 'C', [4, 4], 'C3/q@5 D3@4 E3@3 F3@2 | G3@1 A3@3 B3@2 C4@1 | B3@2 A3@3 G3@1 F3@2 | E3@3 D3@4 C3/h@5 |', { prompt: 'Keep the wrist level as finger 3 crosses — no thumping.' }),
        scale('C', 'major', 'L'),
        scale('C', 'major', 'L', { mode: 'tempo', tempo: 72 }),
      ], [insight('Finger over', 'Going UP, play C D E F G with 5 4 3 2 1, then cross finger 3 OVER the thumb to A and finish B C with 2 1. Coming down, the thumb tucks UNDER after finger 3.', { kind: 'keys', notes: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'], fingers: [5, 4, 3, 2, 1, 3, 2, 1], hand: 'L' })]),
      lesson('pb8-2', 'G and F Major Scales', 'learn', 'Same fingering, new keys', [
        scale('G', 'major', 'L', { octave: 3 }),
        scale('F', 'major', 'L', { octave: 3, title: 'F major — same fingering, with B♭ under finger 2' }),
        read(B, P.lhOctave, { rhythms: RH.eighths, maxLeap: 1 }),
      ]),
      lesson('pb8-3', 'D Major & Scale Melodies', 'practice', 'D major and stepwise lines across an octave', [
        meet(B, 'D4', { hand: 'L', fingers: [1], tips: ['D sits just above Middle C’s ledger line — the top note of the D major scale.'] }),
        scale('D', 'major', 'L'),
        read(B, 'G2 A2 B2 C3 D3 E3 F#3 G3', { key: 'G', rhythms: RH.eighths, maxLeap: 2 }),
        read(B, 'F2 G2 A2 Bb2 C3 D3 E3 F3', { key: 'F', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pb8-4', 'Melodies with Crossings', 'song', 'Songs that need more than five fingers', [
        piece('plh-minuet-in-g'),
        piece('plh-climbing-song'),
      ]),
      lesson('pb8-c', 'Checkpoint: Scales', 'checkpoint', 'Smooth crossings in time', [
        scale('C', 'major', 'L', { mode: 'tempo', tempo: 84, fingering: 'first' }),
        scale('G', 'major', 'L', { octave: 3, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(B, 'D3 E3 F#3 G3 A3 B3 C#4 D4', { key: 'D', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['Finger over', 'C G F D scales', 'One octave']),

    // -----------------------------------------------------------------------
    unit('pb9', 'Dotted Rhythms & Minor Keys', 'Lilting rhythms and the darker sound of minor.', [
      lesson('pb9-1', 'Dotted Quarter', 'learn', 'Long–short: dotted quarter + eighth', [
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(B, P.lhC, { rhythms: RH.dotted, maxLeap: 2, five: true, mode: 'tempo', tempo: 63 }),
      ], [insight('The dot', 'A dotted quarter lasts 1½ beats, so an eighth usually follows: “1 – & 2”. Hold the long note its full length before the short one.', { kind: 'staff', clef: 'bass', notes: ['E3/q.', 'D3/e', 'D3/h'], time: [4, 4] })]),
      lesson('pb9-2', 'A Minor', 'learn', 'The relative minor of C', [
        tip('Relative minor', 'A minor uses the same notes and key signature as C major, but centres on A. In the harmonic minor form, G is raised to G♯.', { kind: 'staff', clef: 'bass', notes: ['A2', 'B2', 'C3', 'D3', 'E3'], labels: true }),
        scale('A', 'natural-minor', 'L', { octave: 3 }),
        scale('A', 'harmonic-minor', 'L', { octave: 3 }),
        read(B, P.lhA, { key: 'Am', rhythms: RH.dotted, maxLeap: 2, five: true }),
      ]),
      lesson('pb9-3', 'E Minor & D Minor', 'practice', 'Two more minor keys', [
        keysig(B, 'Am Em Dm G F', 8),
        read(B, 'E3 F#3 G3 A3 B3', { key: 'Em', rhythms: RH.dotted, maxLeap: 3, five: true }),
        scale('D', 'harmonic-minor', 'L'),
        read(B, 'D3 E3 F3 G3 A3', { key: 'Dm', rhythms: RH.eighths, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pb9-4', 'Melodies in Minor', 'song', 'Greensleeves and a Dorian air', [
        piece('plh-greensleeves'),
        piece('plh-dorian-air'),
      ]),
      lesson('pb9-c', 'Checkpoint: Dotted & Minor', 'checkpoint', 'Dotted rhythms in minor keys', [
        keysig(B, 'C G F D Am Em Dm', 6),
        read(B, P.lhA, { key: 'Am', rhythms: RH.dottedRests, maxLeap: 3, five: true, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, 'D3 E3 F3 G3 A3 Bb3 C#4 D4', { key: 'Dm', rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', 'A E D minor']),

    // -----------------------------------------------------------------------
    unit('pb10', 'Ledger Lines', 'Below and above the bass staff.', [
      lesson('pb10-1', 'Below the Staff', 'learn', 'E2, D2 and low C', [
        tip('Ledger lines below', 'Ledger lines extend the staff downward. E sits on the first ledger line below, D hangs under it, and low C sits on the second — two octaves below Middle C.', { kind: 'staff', clef: 'bass', notes: ['F2', 'E2', 'D2', 'C2'], labels: true }),
        meet(B, 'E2 D2 C2', { hand: 'L', fingers: [3, 4, 5] }),
        name(B, P.lhLow, 15),
        read(B, P.lhLow, { rhythms: RH.qh, maxLeap: 2, five: true }),
      ], [insight('Low C position', 'Pinky on low C, thumb on G: C D E F G again, two octaves below Middle C. Low notes speak slowly — give each one weight from the arm.', { kind: 'keys', notes: ['C2', 'D2', 'E2', 'F2', 'G2'], fingers: [5, 4, 3, 2, 1], hand: 'L' })]),
      lesson('pb10-2', 'Above the Staff', 'learn', 'Middle C, D and E in the bass clef', [
        tip('Ledger lines above', 'Above the staff: B in the space, Middle C on the first ledger line, D just above it, E on the second ledger line. The left hand often climbs up here.', { kind: 'staff', clef: 'bass', notes: ['B3', 'C4', 'D4', 'E4'], labels: true }),
        meet(B, 'D4 E4', { hand: 'L', fingers: [2, 1], tips: ['Put finger 5 on A (top line): D falls under finger 2.', 'E, on the second ledger line, is under the thumb.'] }),
        read(B, 'A3 B3 C4 D4 E4', { rhythms: RH.qh, maxLeap: 2, five: true }),
        name(B, 'G3 A3 B3 C4 D4 E4', 12),
      ]),
      lesson('pb10-3', 'The Full Range', 'practice', 'From low C to the E above Middle C', [
        name(B, C2_E4, 24, { sequence: true, title: 'Note rush' }),
        play(B, C2_E4, 16, { hand: 'L' }),
        read(B, P.lhWide, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.4, fingering: 'first' }),
      ]),
      lesson('pb10-4', 'Low and High Songs', 'song', 'Songs that leave the staff', [
        piece('plh-hall-of-the-mountain-king'),
        piece('plh-boatmans-song'),
      ]),
      lesson('pb10-c', 'Checkpoint: Ledger Lines', 'checkpoint', 'Fluent across the whole range', [
        name(B, C2_E4, 20, { sequence: true }),
        read(B, 'C2 D2 E2 F2 G2 A2 B2 C3', { rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        read(B, 'G3 A3 B3 C4 D4 E4', { rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Ledger lines', 'C2–E4']),

    // -----------------------------------------------------------------------
    unit('pb11', 'Accompaniment Patterns', 'The left hand’s day job: fifths, chords, waltz bass, Alberti bass and octaves.', [
      lesson('pb11-1', 'Root and Fifth', 'learn', 'The bare bones of every chord', [
        lhPiece('Open Fifths', 'C', [4, 4], '[C3 G3]/w@5,1 | [F2 C3]/w@5,1 | [G2 D3]/w@5,1 | [C3 G3]/w@5,1 |', { prompt: 'Pinky on the root, thumb on the fifth: move the whole hand as one shape.' }),
        lhPiece('Root–Fifth Bass', 'C', [4, 4], 'C3/q@5 G3@1 C3@5 G3@1 | F2@5 C3@1 F2@5 C3@1 | G2@5 D3@1 G2@5 D3@1 | C3/h@5 [C3 G3]@5,1 |'),
        read(B, P.lhC, { rhythms: RH.qh, maxLeap: 2, five: true, dyads: { chance: 0.35, intervals: [3, 5] } }),
      ], [insight('Chord roots', 'Most left-hand parts are built from chords. The root names the chord — C for a C chord — and the fifth sits five notes higher. Pinky on the root, thumb on the fifth.', { kind: 'staff+keys', clef: 'bass', notes: ['[C3 G3]/w'], fingers: [5, 1], hand: 'L' })]),
      lesson('pb11-2', 'Three Chords', 'learn', 'I, IV and V7 without moving the hand', [
        tip('One position, three chords', 'C chord: C E G (5-3-1). F chord: C F A (5-2-1). G7 chord: B F G (5-2-1). Each change moves only one or two fingers — the thumb hardly moves at all.', { kind: 'staff', clef: 'bass', notes: ['[C3 E3 G3]/h', '[C3 F3 A3]/h', '[B2 F3 G3]/h', '[C3 E3 G3]/h'] }),
        lhPiece('I – V7 – I', 'C', [4, 4], '[C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/h@5,2,1 [C3 E3 G3]@5,3,1 |'),
        lhPiece('I – IV – V7 – I', 'C', [4, 4], '[C3 E3 G3]/h@5,3,1 [C3 F3 A3]@5,2,1 | [C3 E3 G3]@5,3,1 [B2 F3 G3]@5,2,1 | [C3 E3 G3]/q@5,3,1 [C3 F3 A3]@5,2,1 [B2 F3 G3]@5,2,1 [B2 F3 G3]@5,2,1 | [C3 E3 G3]/w@5,3,1 |'),
        lhPiece('Three Chords in G', 'G', [4, 4], '[G2 B2 D3]/h@5,3,1 [G2 C3 E3]@5,2,1 | [G2 B2 D3]@5,3,1 [F#2 C3 D3]@5,2,1 | [G2 B2 D3]/q@5,3,1 [G2 C3 E3]@5,2,1 [F#2 C3 D3]@5,2,1 [F#2 C3 D3]@5,2,1 | [G2 B2 D3]/w@5,3,1 |'),
      ]),
      lesson('pb11-3', 'Waltz Bass', 'learn', 'Oom-pah-pah in 3/4', [
        tip('Oom-pah-pah', 'In 3/4 the left hand plays a low note on beat 1, then the rest of the chord on beats 2 and 3. Lean into beat one; keep two and three light.', { kind: 'staff', clef: 'bass', notes: ['C3/q', '[E3 G3]/q', '[E3 G3]/q', 'B2/q', '[F3 G3]/q', '[F3 G3]/q'], time: [3, 4] }),
        lhPiece('Waltz Bass in C', 'C', [3, 4], 'C3/q@5 [E3 G3]@3,1 [E3 G3]@3,1 | C3@5 [F3 A3]@2,1 [F3 A3]@2,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | C3@5 [E3 G3]@3,1 [E3 G3]@3,1 | C3@5 [F3 A3]@2,1 [F3 A3]@2,1 | C3@5 [E3 G3]@3,1 [E3 G3]@3,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | C3/h.@5 |'),
        lhPiece('Waltz Bass in G', 'G', [3, 4], 'G2/q@5 [B2 D3]@3,1 [B2 D3]@3,1 | G2@5 [C3 E3]@2,1 [C3 E3]@2,1 | F#2@5 [C3 D3]@2,1 [C3 D3]@2,1 | G2@5 [B2 D3]@3,1 [B2 D3]@3,1 | G2@5 [C3 E3]@2,1 [C3 E3]@2,1 | G2@5 [B2 D3]@3,1 [B2 D3]@3,1 | F#2@5 [C3 D3]@2,1 [C3 D3]@2,1 | G2/h.@5 |', { mode: 'tempo', tempo: 96 }),
      ]),
      lesson('pb11-4', 'Broken Chords & Alberti Bass', 'learn', 'Chords played one note at a time', [
        tip('Alberti bass', 'Break the chord into low–high–middle–high: C G E G, fingers 5-1-3-1, hand perfectly still. Named after Domenico Alberti, it drives countless Classical sonatas.', { kind: 'staff', clef: 'bass', notes: ['C3/e', 'G3/e', 'E3/e', 'G3/e', 'C3/e', 'G3/e', 'E3/e', 'G3/e'], time: [4, 4] }),
        lhPiece('Broken Chords', 'C', [4, 4], 'C3/q@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 | B2@5 G3@1 F3@2 G3@1 | C3/h@5 [C3 E3 G3]@5,3,1 |'),
        lhPiece('Alberti Bass in C', 'C', [4, 4], 'C3/e@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 C3@5 A3@1 F3@2 A3@1 | B2@5 G3@1 F3@2 G3@1 B2@5 G3@1 F3@2 G3@1 | C3@5 G3@1 E3@3 G3@1 C3/h@5 |'),
        lhPiece('Alberti Bass in G', 'G', [4, 4], 'G2/e@5 D3@1 B2@3 D3@1 G2@5 D3@1 B2@3 D3@1 | G2@5 E3@1 C3@2 E3@1 G2@5 E3@1 C3@2 E3@1 | F#2@5 D3@1 C3@2 D3@1 F#2@5 D3@1 C3@2 D3@1 | G2@5 D3@1 B2@3 D3@1 G2/h@5 |', { mode: 'tempo', tempo: 72 }),
      ]),
      lesson('pb11-5', 'Octave Bass', 'learn', 'Big, full bass lines in octaves', [
        tip('Octaves', 'Stretch thumb and pinky eight white keys apart — an octave. Keep that hand shape fixed and move from the arm; let fingers 2-3-4 relax.', { kind: 'staff+keys', clef: 'bass', notes: ['[C2 C3]/w'], fingers: [5, 1], hand: 'L' }),
        lhPiece('Octave Bass Line', 'C', [4, 4], '[C2 C3]/h@5,1 [G2 G3]@5,1 | [A2 A3]@5,1 [E2 E3]@5,1 | [F2 F3]@5,1 [C2 C3]@5,1 | [F2 F3]@5,1 [G2 G3]@5,1 | [C2 C3]/w@5,1 |'),
        read(B, 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3', { rhythms: RH.qh, maxLeap: 3, dyads: { chance: 0.6, intervals: [8] }, fingering: 'first' }),
      ]),
      lesson('pb11-6', 'Accompaniment Songs', 'song', 'Left-hand parts that hold a song together', [
        tip('Accompany the melody', 'In these pieces you play the real left-hand part while the app plays the melody. Listen to the tune and keep your pattern steady underneath it.'),
        piece('plh-canon-in-d'),
        piece('p2-goin-home', { hands: 'L', title: 'Goin’ Home — left hand' }),
        piece('p2-sonatina-classica', { hands: 'L', title: 'Sonatina Classica — left hand' }),
      ]),
      lesson('pb11-c', 'Checkpoint: Accompaniment', 'checkpoint', 'Read chords and patterns at a glance', [
        read(B, P.lhC, { rhythms: RH.qh, maxLeap: 3, five: true, dyads: { chance: 0.5, intervals: [3, 5] }, fingering: 'first' }),
        lhPiece('Waltz Bass in F', 'F', [3, 4], 'F2/q@5 [A2 C3]@3,1 [A2 C3]@3,1 | F2@5 [Bb2 D3]@2,1 [Bb2 D3]@2,1 | E2@5 [Bb2 C3]@2,1 [Bb2 C3]@2,1 | F2@5 [A2 C3]@3,1 [A2 C3]@3,1 | F2@5 [Bb2 D3]@2,1 [Bb2 D3]@2,1 | E2@5 [Bb2 C3]@2,1 [Bb2 C3]@2,1 | E2@5 [Bb2 C3]@2,1 [Bb2 C3]@2,1 | F2/h.@5 |', { mode: 'tempo', tempo: 96, fingering: 'first' }),
        lhPiece('Alberti Bass in F', 'F', [4, 4], 'F2/e@5 C3@1 A2@3 C3@1 F2@5 C3@1 A2@3 C3@1 | F2@5 D3@1 Bb2@2 D3@1 F2@5 D3@1 Bb2@2 D3@1 | E2@5 C3@1 Bb2@2 C3@1 E2@5 C3@1 Bb2@2 C3@1 | F2@5 C3@1 A2@3 C3@1 F2/h@5 |', { mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
    ], ['Root & fifth', 'I–IV–V7', 'Waltz & Alberti bass', 'Octaves']),

    // -----------------------------------------------------------------------
    unit('pb12', 'More Keys', 'Up to four sharps and three flats, and scales over two octaves.', [
      lesson('pb12-1', 'A and E Major', 'learn', 'Three and four sharps', [
        keysig(B, 'G D A E', 8),
        scale('A', 'major', 'L', { octave: 3 }),
        scale('E', 'major', 'L', { octave: 3 }),
        read(B, 'A2 B2 C#3 D3 E3 F#3 G#3 A3', { key: 'A', rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ], [insight('Order of sharps', 'Sharps are always added in the same order: F C G D A E B. A major has three (F♯ C♯ G♯), E major four (+ D♯). The last sharp is a half step below the key’s name.', { kind: 'staff', clef: 'bass', notes: ['E3'], key: 'E' })]),
      lesson('pb12-2', 'B♭ and E♭ Major', 'learn', 'Two and three flats', [
        tip('Order of flats', 'Flats go B E A D G C F — the sharps backwards. The second-to-last flat names the key: B♭ E♭ → B♭ major. Both scales start on LH finger 3.', { kind: 'staff', clef: 'bass', notes: ['Bb2'], key: 'Bb' }),
        keysig(B, 'F Bb Eb', 8),
        scale('Bb', 'major', 'L', { octave: 3, title: 'B♭ major — start on finger 3' }),
        scale('Eb', 'major', 'L', { octave: 3 }),
        read(B, 'Bb2 C3 D3 Eb3 F3 G3 A3 Bb3', { key: 'Bb', rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pb12-3', 'B Minor', 'learn', 'The relative minor of D', [
        tip('B minor', 'B minor shares D major’s two sharps; its harmonic form raises A to A♯. The left hand starts on finger 4 and crosses twice: 4-3-2-1, 4-3-2-1.', { kind: 'keys', notes: ['B2', 'C#3', 'D3', 'E3', 'F#3', 'G3', 'A#3', 'B3'], fingers: [4, 3, 2, 1, 4, 3, 2, 1], hand: 'L' }),
        keysig(B, 'D Bm G Em', 8),
        scale('B', 'harmonic-minor', 'L', { octave: 3 }),
        read(B, 'F#2 G2 A2 B2 C#3 D3 E3 F#3', { key: 'Bm', rhythms: RH.dotted, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pb12-4', 'Two Octaves', 'practice', 'Scales from low C to Middle C and beyond', [
        tip('Two octaves', 'For two octaves, the crossing happens three times. After the thumb, finger 4 crosses over at the octave: 5-4-3-2-1-3-2-1-4-3-2-1-3-2-1.', { kind: 'keys', notes: ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'], fingers: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1], hand: 'L' }),
        scale('C', 'major', 'L', { octaves: 2, octave: 3 }),
        scale('D', 'major', 'L', { octaves: 2, octave: 3, rhythm: 'e' }),
        scale('D', 'harmonic-minor', 'L', { octaves: 2, octave: 3, rhythm: 'e', mode: 'tempo', tempo: 60 }),
      ]),
      lesson('pb12-5', 'Classical Themes', 'song', 'Famous tunes for the left hand', [
        piece('plh-largo-new-world'),
        piece('p2-minuet-in-g', { hands: 'L', title: 'Minuet in G — left hand' }),
      ]),
      lesson('pb12-c', 'Checkpoint: Keys', 'checkpoint', 'Sight-read in unfamiliar keys', [
        keysig(B, 'G D A E F Bb Eb Bm', 8),
        scale('E', 'major', 'L', { octaves: 2, octave: 3, rhythm: 'e', mode: 'tempo', tempo: 66, fingering: 'first' }),
        read(B, 'D3 E3 F#3 G3 A3 B3 C#4 D4 E4', { key: 'D', rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 76, fingering: 'first' }),
        read(B, 'Eb2 F2 G2 Ab2 Bb2 C3 D3 Eb3 F3', { key: 'Eb', rhythms: RH.eighths, maxLeap: 4, harmonic: true, fingering: 'none' }),
      ]),
    ], ['A E major', 'B♭ E♭ major', 'B minor', 'Two octaves']),

    // -----------------------------------------------------------------------
    unit('pb13', 'Rhythm Workshop', 'Sixteenths, triplets, syncopation and 6/8 — plus real bass lines.', [
      lesson('pb13-1', 'Sixteenth Notes', 'learn', 'Four notes per beat', [
        rhythm([4, 4], RH.sixteenths, { tempo: 60 }),
        read(B, P.lhC, { rhythms: RH.sixteenths, maxLeap: 2, five: true }),
      ], [insight('Sixteenths', 'Sixteenth notes have two beams: four per beat. Count “1 e & a” and play from the fingertips, close to the keys.', { kind: 'staff', clef: 'bass', notes: ['G3/s', 'F3/s', 'E3/s', 'D3/s', 'C3/q'], time: [2, 4] })]),
      lesson('pb13-2', 'Triplets', 'learn', 'Three in the space of two', [
        tip('Triplets', 'A “3” over three eighths squeezes them into one beat: “tri-po-let”. Keep all three even.', { kind: 'staff', clef: 'bass', notes: ['G2/e3', 'A2/e3', 'B2/e3', 'C3/q'], time: [2, 4] }),
        rhythm([4, 4], RH.triplets, { tempo: 66 }),
        read(B, P.lhG, { rhythms: RH.triplets, maxLeap: 2, five: true }),
      ]),
      lesson('pb13-3', 'Syncopated Bass Lines', 'learn', 'Off-beat grooves and a boogie', [
        tip('Off the beat', 'Syncopation puts a note between the beats and lets it ride across the next one: “1 & – & ”. Keep counting steadily underneath.', { kind: 'staff', clef: 'bass', notes: ['C3/e', 'G3/q', 'C3/e'], time: [2, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        lhPiece('Syncopated Bass', 'C', [4, 4], 'C3/e@5 G3/q@1 C3/e@5 E3/q@3 G3@1 | F2/e@5 C3/q@1 F2/e@5 A2/q@3 C3@1 | G2/e@5 D3/q@1 G2/e@5 B2/q@3 D3@1 | C3/e@5 G3/q@1 C3/e@5 [C3 G3]/h@5,1 |'),
        lhPiece('Twelve-Bar Boogie', 'C', [4, 4], 'C3/e@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | C3@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | C3@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | C3@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | F2@5 A2@3 C3@2 D3@1 C3@2 A2@3 F2@5 A2@3 | F2@5 A2@3 C3@2 D3@1 C3@2 A2@3 F2@5 A2@3 | C3@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | C3@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | G2@5 B2@3 D3@2 E3@1 D3@2 B2@3 G2@5 B2@3 | F2@5 A2@3 C3@2 D3@1 C3@2 A2@3 F2@5 A2@3 | C3@5 E3@3 G3@2 A3@1 G3@2 E3@3 C3@5 E3@3 | C3@5 E3@3 G3@2 E3@3 C3/h@5 |', { mode: 'tempo', tempo: 96, fingering: 'first' }),
      ]),
      lesson('pb13-4', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighths per bar in two groups of three: “ONE two three FOUR five six”. It rocks like a boat.', { kind: 'staff', clef: 'bass', notes: ['C3/q', 'G3/e', 'E3/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(B, P.lhC, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, five: true }),
        lhPiece('Barcarolle Bass', 'C', [6, 8], 'C3/q@5 G3/e@1 E3/q@3 G3/e@1 | F2/q@5 C3/e@1 A2/q@3 C3/e@1 | G2/q@5 D3/e@1 B2/q@3 D3/e@1 | C3/q.@5 [C3 E3 G3]@5,3,1 |'),
      ]),
      lesson('pb13-5', 'Cello Melodies', 'song', 'Singing melodies in the bass register', [
        piece('plh-cello-song'),
        piece('plh-cello-suite-prelude'),
      ]),
      lesson('pb13-c', 'Checkpoint: Rhythm Workshop', 'checkpoint', 'Mixed rhythms in time', [
        rhythm([4, 4], RH.advanced, { tempo: 66, reps: 1 }),
        read(B, P.lhStaff, { rhythms: RH.advanced, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 60, fingering: 'first' }),
        read(B, P.lhG, { time: [6, 8], rhythms: RH.compoundAdv, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['16ths', 'Triplets', 'Syncopation', '6/8']),

    // -----------------------------------------------------------------------
    unit('pb14', 'Virtuoso Bass', 'The deepest notes, wide leaps and reading at speed.', [
      lesson('pb14-1', 'The Deep End', 'learn', 'Down to the lowest Cs on the piano', [
        name(B, DEEP, 15),
        read(B, 'C1 D1 E1 F1 G1', { rhythms: RH.qh, maxLeap: 2, five: true }),
        read(B, 'G1 A1 B1 C2 D2 E2 F2 G2', { rhythms: RH.qh, maxLeap: 3, fingering: 'first' }),
      ], [insight('Deep ledger lines', 'Below low C the ledger lines keep coming: A on the third, F on the fourth, D on the fifth. Count down from low C — or learn the shapes, as pianists do.', { kind: 'staff', clef: 'bass', notes: ['C2', 'A1', 'F1', 'D1', 'C1'], labels: true })]),
      lesson('pb14-2', 'Leaps & Octaves', 'practice', 'Jumps across the keyboard', [
        tip('Leap by feel', 'For a big jump, look at the landing note, not your hand, and move early. In octaves, keep thumb and pinky locked and let the arm travel.', { kind: 'staff+keys', clef: 'bass', notes: ['[A1 A2]/w'], fingers: [5, 1], hand: 'L' }),
        lhPiece('Octave Walk', 'Dm', [4, 4], '[D2 D3]/q@5,1 [A1 A2]@5,1 [D2 D3]@5,1 [F2 F3]@5,1 | [E2 E3]@5,1 [A1 A2]@5,1 [C#2 C#3]@5,1 [E2 E3]@5,1 | [D2 D3]@5,1 [Bb1 Bb2]@5,1 [G1 G2]@5,1 [A1 A2]@5,1 | [D2 D3]/w@5,1 |'),
        lhPiece('Stride Bass', 'C', [4, 4], '[C2 C3]/q@5,1 [E3 G3 C4]@5,3,1 [G1 G2]@5,1 [E3 G3 C4]@5,3,1 | [F1 F2]@5,1 [F3 A3 C4]@5,3,1 [C2 C3]@5,1 [F3 A3 C4]@5,3,1 | [G1 G2]@5,1 [F3 G3 B3]@5,4,1 [D2 D3]@5,1 [F3 G3 B3]@5,4,1 | [C2 C3]/q@5,1 [E3 G3 C4]@5,3,1 [C2 C3]/h@5,1 |', { mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, P.lhFull, { rhythms: RH.eighths, maxLeap: 7, leapiness: 0.7, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pb14-3', 'Speed Reading', 'challenge', 'Sight-read at tempo', [
        name(B, P.lhFull, 30, { sequence: true, title: 'Lightning round' }),
        read(B, P.lhWide, { rhythms: RH.advanced, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(B, 'Ab1 Bb1 C2 Db2 Eb2 F2 G2 Ab2 Bb2 C3 Db3 Eb3', { key: 'Ab', rhythms: RH.syncopation, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
      lesson('pb14-4', 'Concert Pieces', 'song', 'Advanced left-hand parts from the concert repertoire', [
        piece('p2-ragtime', { hands: 'L', title: 'Ragtime Promenade — left hand' }),
        piece('p2-fur-elise', { hands: 'L', title: 'Für Elise — left hand' }),
        piece('plh-thunder-etude'),
      ]),
      lesson('pb14-c', 'Final Exam: Bass Clef', 'checkpoint', 'Prove your mastery', [
        name(B, P.lhFull, 30, { sequence: true }),
        keysig(B, 'C G D A E F Bb Eb Ab Am Em Dm Bm', 10),
        scale('E', 'major', 'L', { octaves: 2, octave: 3, rhythm: 's', mode: 'tempo', tempo: 60, fingering: 'none' }),
        read(B, P.lhFull, { rhythms: RH.advanced, maxLeap: 5, harmonic: true, mode: 'tempo', tempo: 76, fingering: 'none', measures: 6 }),
      ]),
    ], ['C1–E4', 'Leaps & octaves', 'At tempo']),
  ],
};
