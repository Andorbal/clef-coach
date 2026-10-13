import { P, RH, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit, inlinePiece } from '../builders';
import type { TrackDef } from '../types';

const T = 'treble' as const;

export const pianoTreble: TrackDef = {
  id: 'piano-treble',
  instrument: 'piano',
  title: 'Treble Clef',
  subtitle: 'Piano · Right hand',
  description: 'Read the treble clef fluently with your right hand — from Middle C to the top of the keyboard, with real fingering, rhythm and keys.',
  clef: 'treble',
  hand: 'R',
  accent: '#ff9b6a',
  glyph: '𝄞',
  heatmap: [{ clef: 'treble', low: 'G3', high: 'C6' }],
  units: [
    unit('pt1', 'Middle C & Friends', 'Your first three notes, with the thumb on Middle C.', [
      lesson('pt1-1', 'Meet Middle C', 'learn', 'Find Middle C on the staff and the keyboard', [
        meet(T, 'C4', { hand: 'R', fingers: [1], tips: ['Middle C sits on its own short ledger line just below the treble staff. On the keyboard it is the C nearest the middle — just left of the group of two black keys. Rest your right thumb (finger 1) on it.'] }),
        meet(T, 'D4', { hand: 'R', fingers: [2], tips: ['D hangs just below the bottom line of the staff. Play it with finger 2, the key right next to C.'] }),
        name(T, 'C4 D4', 8),
        play(T, 'C4 D4', 8, { hand: 'R', hints: true }),
      ], [
        insight('The treble clef', 'The treble clef (𝄞) is also called the G clef: its curl wraps around the second line from the bottom, and every note on that line is a G. Your right hand usually reads this staff.', { kind: 'staff', clef: 'treble', notes: ['G4'], labels: true }),
        insight('Fingers have numbers', 'Pianists number their fingers 1–5 starting from the thumb. You will see these small numbers above the notes — they tell you which finger to use.', { kind: 'keys', notes: ['C4', 'D4', 'E4', 'F4', 'G4'], fingers: [1, 2, 3, 4, 5], hand: 'R' }),
      ]),
      lesson('pt1-2', 'Hello, E', 'learn', 'Add E — the bottom line of the staff', [
        meet(T, 'E4', { hand: 'R', fingers: [3], tips: ['E sits right on the bottom line of the treble staff. Finger 3 plays it.'] }),
        name(T, 'C4 D4 E4', 10),
        play(T, 'C4 D4 E4', 10, { hand: 'R', hints: true }),
        read(T, 'C4 D4 E4', { rhythms: RH.quarters, maxLeap: 1, measures: 2, five: true, noteNames: true, title: 'Your first melody' }),
      ]),
      lesson('pt1-3', 'Step by Step', 'practice', 'Read stepwise melodies with C, D and E', [
        tip('Steps', 'When a note moves from a line to the next space (or space to the next line), it moves by a step — the next key on the piano.', { kind: 'staff', clef: 'treble', notes: ['C4', 'D4', 'E4', 'D4', 'C4'], labels: true }),
        read(T, 'C4 D4 E4', { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: true }),
        read(T, 'C4 D4 E4', { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: false }),
        name(T, 'C4 D4 E4', 12, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('pt1-4', 'Skipping', 'practice', 'Jump from C to E — a skip', [
        tip('Skips', 'C (ledger line) to E (bottom line) jumps over D. Line-to-line or space-to-space is a skip — you skip one key.', { kind: 'staff', clef: 'treble', notes: ['C4', 'E4', 'C4'], labels: true }),
        read(T, 'C4 D4 E4', { rhythms: RH.qh, maxLeap: 2, leapiness: 0.6, five: true, noteNames: false }),
        piece('prh-hot-cross-buns', { fingering: 'all' }),
      ]),
      lesson('pt1-c', 'Checkpoint: Middle C & Friends', 'checkpoint', 'Show you know C, D and E', [
        name(T, 'C4 D4 E4', 12),
        play(T, 'C4 D4 E4', 10, { hand: 'R' }),
        read(T, 'C4 D4 E4', { rhythms: RH.qh, maxLeap: 2, five: true, fingering: 'first' }),
      ]),
    ], ['C D E', 'Finger numbers', 'Steps & skips']),

    unit('pt2', 'The C Position', 'All five fingers on C D E F G.', [
      lesson('pt2-1', 'F and G', 'learn', 'Meet F (first space) and G (second line)', [
        meet(T, 'F4 G4', { hand: 'R', fingers: [4, 5], tips: ['F lives in the first space of the staff — finger 4.', 'G sits on the second line, the line the treble clef curls around — finger 5.'] }),
        name(T, 'C4 D4 E4 F4 G4', 12),
        play(T, 'C4 D4 E4 F4 G4', 12, { hand: 'R', hints: true }),
      ], [insight('C position', 'Put your thumb on Middle C and let each finger rest on the next white key. This is the C position: five notes, five fingers, no moving required.', { kind: 'keys', notes: ['C4', 'D4', 'E4', 'F4', 'G4'], fingers: [1, 2, 3, 4, 5], hand: 'R' })]),
      lesson('pt2-2', 'Lines and Spaces', 'practice', 'Tell line notes from space notes', [
        tip('Lines and spaces', 'E and G sit ON lines. D and F sit IN spaces. Noticing line-or-space instantly is the secret to fast reading.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F4', 'G4'], labels: true }),
        name(T, 'C4 D4 E4 F4 G4', 15),
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: true }),
      ]),
      lesson('pt2-3', 'Five Fingers', 'practice', 'Melodies across the whole C position', [
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 2, five: true }),
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 2, five: true, fingering: 'first' }),
        play(T, P.rhC, 10, { hand: 'R' }),
      ]),
      lesson('pt2-4', 'First Songs', 'song', 'Play two classics in C position', [
        piece('prh-mary-had-a-little-lamb'),
        piece('prh-ode-to-joy'),
      ]),
      lesson('pt2-5', 'Reading by Interval', 'learn', 'See the distance between notes', [
        tip('Intervals', 'Good readers don’t name every note — they see how far the next note is. A 2nd is a step (line→space), a 3rd is a skip (line→line), a 4th and 5th are bigger jumps.', { kind: 'staff', clef: 'treble', notes: ['C4', 'D4', 'C4', 'E4', 'C4', 'F4', 'C4', 'G4'] }),
        interval(T, P.rhC, [2, 3], 10),
        interval(T, P.rhC, [2, 3, 4, 5], 10),
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.5, five: true, fingering: 'first' }),
      ]),
      lesson('pt2-c', 'Checkpoint: C Position', 'checkpoint', 'Read anything in C position', [
        name(T, P.rhC, 15),
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 3, five: true, fingering: 'first' }),
        read(T, P.rhC, { rhythms: RH.qhw, maxLeap: 4, five: true, fingering: 'none' }),
      ]),
    ], ['F G', 'C position', 'Intervals 2nd–5th']),

    unit('pt3', 'Rhythm & Rests', 'Count quarters, halves, wholes and silences.', [
      lesson('pt3-1', 'Counting Time', 'learn', 'Quarter, half and whole notes in 4/4', [
        tip('Note values', 'In 4/4 time there are four beats in every bar. A quarter note gets 1 beat, a half note 2, a whole note 4. Count “1 2 3 4” steadily.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'C4/q', 'E4/h', 'G4/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(T, P.rhC, { rhythms: RH.qhw, maxLeap: 2, five: true, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('pt3-2', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats — the dot adds half the note’s value again.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'E4/q', 'G4/q', 'E4/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(T, P.rhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2, five: true }),
      ]),
      lesson('pt3-3', 'Silence Counts', 'learn', 'Quarter and half rests', [
        tip('Rests', 'A rest is a beat of silence — it still gets counted. The quarter rest looks like a squiggle; the half rest is a small hat sitting on the middle line.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'r/q', 'E4/q', 'r/q', 'G4/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(T, P.rhC, { rhythms: RH.rests, maxLeap: 2, five: true, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('pt3-4', 'Folk Songs', 'song', 'Lightly Row and Au Clair de la Lune', [
        piece('prh-lightly-row'),
        piece('prh-au-clair-de-la-lune'),
      ]),
      lesson('pt3-c', 'Checkpoint: Rhythm', 'checkpoint', 'Keep steady time while reading', [
        rhythm([4, 4], RH.rests, { tempo: 76, reps: 1 }),
        read(T, P.rhC, { rhythms: RH.rests, maxLeap: 3, five: true, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(T, P.rhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, five: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
      ]),
    ], ['4/4 & 3/4', 'Rests', 'Steady pulse']),

    unit('pt4', 'Moving Up: G Position', 'Shift the hand to G and read the middle of the staff.', [
      lesson('pt4-1', 'A and B', 'learn', 'The middle of the staff', [
        meet(T, 'G4 A4 B4', { hand: 'R', fingers: [1, 2, 3], tips: ['Move your thumb up to G — the line the clef curls around.', 'A is in the second space.', 'B sits on the middle line of the staff — a great landmark.'] }),
        name(T, 'G4 A4 B4', 10),
        play(T, 'G4 A4 B4', 10, { hand: 'R', hints: true }),
      ], [insight('G position', 'Shift your whole hand so the thumb rests on G. Now fingers 1–5 cover G A B C D.', { kind: 'keys', notes: ['G4', 'A4', 'B4', 'C5', 'D5'], fingers: [1, 2, 3, 4, 5], hand: 'R' })]),
      lesson('pt4-2', 'Treble C and D', 'learn', 'C in the third space, D on the fourth line', [
        meet(T, 'C5 D5', { hand: 'R', fingers: [4, 5], tips: ['C5 — “treble C” — sits in the third space. It is one octave above Middle C.', 'D5 sits on the fourth line.'] }),
        name(T, P.rhG, 12),
        read(T, P.rhG, { rhythms: RH.qh, maxLeap: 1, five: true, noteNames: true }),
      ]),
      lesson('pt4-3', 'G Position Melodies', 'practice', 'Read freely in G position', [
        read(T, P.rhG, { rhythms: RH.qhw, maxLeap: 2, five: true }),
        read(T, P.rhG, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, five: true, fingering: 'first' }),
        name(T, 'C4 D4 E4 F4 G4 A4 B4 C5 D5', 15, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('pt4-4', 'Two Positions', 'practice', 'Switch between C and G positions', [
        tip('Shifting', 'When the music moves out of your five fingers, lift the hand and re-place it. Look ahead for the next group of notes before you get there.'),
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 2, five: true, measures: 2 }),
        read(T, P.rhG, { rhythms: RH.qh, maxLeap: 2, five: true, measures: 2 }),
        play(T, 'C4 D4 E4 F4 G4 A4 B4 C5 D5', 12, { hand: 'R' }),
      ]),
      lesson('pt4-5', 'Twinkle & Jingle', 'song', 'Two favourites using both positions', [
        piece('prh-twinkle-twinkle'),
        piece('prh-jingle-bells'),
      ]),
      lesson('pt4-c', 'Checkpoint: G Position', 'checkpoint', 'Read C4 up to D5', [
        name(T, 'C4 D4 E4 F4 G4 A4 B4 C5 D5', 16),
        read(T, P.rhG, { rhythms: RH.rests, maxLeap: 3, five: true, fingering: 'first' }),
        read(T, P.rhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['A B C D', 'G position', 'Hand shifts']),

    unit('pt5', 'Landmarks of the Staff', 'Every line, every space — the whole treble staff.', [
      lesson('pt5-1', 'Every Line', 'learn', 'E G B D F', [
        tip('The lines', 'From the bottom: E G B D F — “Every Good Boy Deserves Fruit”. Better still: memorise G (clef line) and B (middle line) as landmarks and count from them.', { kind: 'staff', clef: 'treble', notes: ['E4', 'G4', 'B4', 'D5', 'F5'], labels: true }),
        meet(T, 'E5 F5', { hand: 'R', fingers: [4, 5], tips: ['E5 is in the top space.', 'F5 is the top line — the F that the key signature’s first sharp sits on.'] }),
        name(T, 'E4 G4 B4 D5 F5', 15),
      ]),
      lesson('pt5-2', 'Every Space', 'learn', 'F A C E', [
        tip('The spaces', 'The four spaces spell F A C E from the bottom up.', { kind: 'staff', clef: 'treble', notes: ['F4', 'A4', 'C5', 'E5'], labels: true }),
        name(T, 'F4 A4 C5 E5', 12),
        name(T, P.rhStaff, 16, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('pt5-3', 'Upper Position', 'practice', 'C position, one octave up', [
        read(T, P.rhC5, { rhythms: RH.qh, maxLeap: 2, five: true }),
        read(T, P.rhC5, { rhythms: RH.rests, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pt5-4', 'Across the Staff', 'practice', 'Melodies that move between positions', [
        read(T, P.rhOctave, { rhythms: RH.qh, maxLeap: 2, fingering: 'all' }),
        read(T, P.rhStaff, { rhythms: RH.qh, maxLeap: 2, fingering: 'all' }),
        play(T, P.rhWide, 14, { hand: 'R' }),
      ]),
      lesson('pt5-c', 'Checkpoint: The Staff', 'checkpoint', 'Name and play every staff note', [
        name(T, P.rhWide, 20, { sequence: true }),
        play(T, P.rhWide, 14, { hand: 'R' }),
        read(T, P.rhStaff, { rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['Lines EGBDF', 'Spaces FACE', 'C4–G5']),

    unit('pt6', 'Eighth Notes', 'Two notes per beat, pickups and ties.', [
      lesson('pt6-1', 'Two per Beat', 'learn', 'Eighth notes and beams', [
        tip('Eighth notes', 'An eighth note is half a beat. Pairs are joined by a beam. Count “1 & 2 & 3 & 4 &”.', { kind: 'staff', clef: 'treble', notes: ['C4/e', 'D4/e', 'E4/q', 'E4/e', 'F4/e', 'G4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(T, P.rhC, { rhythms: RH.eighths, maxLeap: 2, five: true }),
      ]),
      lesson('pt6-2', 'Eighths in G', 'practice', 'Eighth notes in G position', [
        read(T, P.rhG, { rhythms: RH.eighths, maxLeap: 2, five: true }),
        read(T, P.rhG, { rhythms: RH.eighthsRests, maxLeap: 2, five: true, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
      lesson('pt6-3', 'Pickups & Ties', 'learn', 'Music that starts before beat one', [
        tip('Pickups and ties', 'A pickup (anacrusis) is a short first bar that leads into beat one. A tie joins two notes of the same pitch — play once, hold for both.', { kind: 'staff', clef: 'treble', notes: ['G4/q', 'C5/h', 'C5/q'], time: [4, 4] }),
        piece('prh-oh-susanna'),
        piece('prh-when-the-saints'),
      ]),
      lesson('pt6-c', 'Checkpoint: Eighths', 'checkpoint', 'Read eighth-note melodies in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        read(T, P.rhOctave, { rhythms: RH.eighths, maxLeap: 2, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(T, P.rhG, { rhythms: RH.eighthsRests, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['Eighth notes', 'Pickups', 'Ties']),

    unit('pt7', 'Sharps & Flats', 'Black keys, key signatures, G and F major.', [
      lesson('pt7-1', 'F Sharp', 'learn', 'The black key just above F', [
        tip('Sharps', 'A sharp (♯) raises a note by a half step — to the very next key on the right, usually a black key. F♯ is the black key between F and G.', { kind: 'keys', notes: ['F4', 'F#4', 'G4'], low: 'C4', high: 'C5' }),
        meet(T, 'F#4', { hand: 'R', fingers: [3], tips: ['In D position (D E F♯ G A), F♯ falls under finger 3.'] }),
        read(T, P.rhD, { key: 'C', rhythms: RH.qh, maxLeap: 2, five: true, noteNames: true }),
        name(T, 'D4 E4 F#4 G4 A4', 12, { answers: 'accidentals' }),
      ]),
      lesson('pt7-2', 'The Key of G', 'learn', 'One sharp in the key signature', [
        tip('Key signatures', 'Instead of writing ♯ before every F, music in G major puts one sharp on the F line right after the clef. Every F is now F♯ — in every octave — until the key changes.', { kind: 'staff', clef: 'treble', notes: ['F#4', 'F#5'], key: 'G' }),
        keysig(T, 'C G', 6),
        read(T, P.rhD, { key: 'G', rhythms: RH.eighths, maxLeap: 2, five: true }),
        read(T, P.rhG, { key: 'G', rhythms: RH.qhw, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pt7-3', 'B Flat & the Key of F', 'learn', 'One flat: B♭', [
        tip('Flats', 'A flat (♭) lowers a note a half step — to the next key on the left. In F major the key signature has one flat, on the B line: every B is B♭.', { kind: 'keys', notes: ['A4', 'Bb4', 'B4'], low: 'F4', high: 'C5' }),
        meet(T, 'Bb4', { hand: 'R', fingers: [4], tips: ['In F position (F G A B♭ C), B♭ falls under finger 4.'] }),
        keysig(T, 'C G F', 8),
        read(T, P.rhF, { key: 'F', rhythms: RH.qh, maxLeap: 2, five: true }),
      ]),
      lesson('pt7-4', 'Accidentals', 'practice', 'Sharps and flats that appear mid-piece', [
        tip('Accidentals last a bar', 'A sharp or flat written next to a note (an accidental) lasts until the end of that bar. A natural sign (♮) cancels it.'),
        name(T, 'C4 C#4 D4 Eb4 E4 F4 F#4 G4 Ab4 A4 Bb4 B4 C5', 16, { answers: 'accidentals' }),
        play(T, 'C4 C#4 D4 Eb4 E4 F4 F#4 G4 Ab4 A4 Bb4 B4 C5', 12, { hand: 'R' }),
      ]),
      lesson('pt7-5', 'Songs in G and F', 'song', 'Aura Lee in G major and Meadow in F', [
        piece('prh-aura-lee'),
        piece('prh-meadow-in-f'),
      ]),
      lesson('pt7-c', 'Checkpoint: Keys of G and F', 'checkpoint', 'Read with key signatures', [
        keysig(T, 'C G F', 6),
        read(T, P.rhD, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, five: true, fingering: 'first' }),
        read(T, P.rhF, { key: 'F', rhythms: RH.eighths, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['♯ and ♭', 'G major', 'F major']),

    unit('pt8', 'Thumb Under: Scales', 'Play beyond five fingers with smooth crossings.', [
      lesson('pt8-1', 'The C Major Scale', 'learn', 'Fingering 1-2-3, thumb under, 1-2-3-4-5', [
        tip('Thumb under', 'To play 8 notes with 5 fingers, play C-D-E with 1-2-3, then tuck the thumb under to F and continue 1-2-3-4-5. Coming down, finger 3 crosses over the thumb.', { kind: 'keys', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], fingers: [1, 2, 3, 1, 2, 3, 4, 5], hand: 'R' }),
        scale('C', 'major', 'R'),
        scale('C', 'major', 'R', { mode: 'tempo', tempo: 72 }),
      ]),
      lesson('pt8-2', 'G and F Major Scales', 'learn', 'Same idea, new keys', [
        scale('G', 'major', 'R'),
        scale('F', 'major', 'R', { title: 'F major — thumb under after finger 4' }),
        read(T, P.rhOctave, { rhythms: RH.eighths, maxLeap: 1, fingering: 'all' }),
      ]),
      lesson('pt8-3', 'Scale Melodies', 'practice', 'Stepwise lines across an octave', [
        read(T, 'G4 A4 B4 C5 D5 E5 F#5 G5', { key: 'G', rhythms: RH.eighths, maxLeap: 2, fingering: 'all' }),
        read(T, P.rhF + ' D5 E5 F5', { key: 'F', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pt8-4', 'Minuet & Country Dance', 'song', 'The Minuet in G and a quick country dance', [
        piece('prh-minuet-in-g'),
        piece('prh-country-dance'),
      ]),
      lesson('pt8-c', 'Checkpoint: Scales', 'checkpoint', 'Smooth crossings in time', [
        scale('C', 'major', 'R', { mode: 'tempo', tempo: 84, fingering: 'first' }),
        scale('G', 'major', 'R', { mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(T, P.rhStaff, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['Thumb under', 'C G F scales', 'One octave']),

    unit('pt9', 'Dotted Rhythms & Minor Keys', 'Lilting rhythms and the darker sound of minor.', [
      lesson('pt9-1', 'Dotted Quarter', 'learn', 'Long–short: dotted quarter + eighth', [
        tip('The dot', 'A dotted quarter lasts 1½ beats, so it’s usually followed by an eighth: “1 – & 2”. You know it from the end of Ode to Joy.', { kind: 'staff', clef: 'treble', notes: ['E4/q.', 'D4/e', 'D4/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        piece('prh-ode-to-joy-original'),
        read(T, P.rhC, { rhythms: RH.dotted, maxLeap: 2, five: true, mode: 'tempo', tempo: 63 }),
      ]),
      lesson('pt9-2', 'A Minor', 'learn', 'The relative minor of C', [
        tip('Relative minor', 'A minor uses the same notes and key signature as C major, but centres on A. It sounds darker. In the harmonic minor form, G becomes G♯.', { kind: 'staff', clef: 'treble', notes: ['A4', 'B4', 'C5', 'D5', 'E5'], labels: true }),
        scale('A', 'natural-minor', 'R'),
        read(T, P.rhA, { key: 'Am', rhythms: RH.dotted, maxLeap: 2, five: true }),
      ]),
      lesson('pt9-3', 'E Minor & D Minor', 'practice', 'Two more minor keys', [
        keysig(T, 'Am Em Dm G F', 8),
        scale('E', 'harmonic-minor', 'R'),
        read(T, 'E4 F#4 G4 A4 B4', { key: 'Em', rhythms: RH.dotted, maxLeap: 3, five: true }),
        read(T, 'D4 E4 F4 G4 A4', { key: 'Dm', rhythms: RH.eighths, maxLeap: 3, five: true, fingering: 'first' }),
      ]),
      lesson('pt9-4', 'Melodies in Minor', 'song', 'Greensleeves and a Dorian air', [
        piece('prh-greensleeves'),
        piece('prh-dorian-air'),
      ]),
      lesson('pt9-c', 'Checkpoint: Dotted & Minor', 'checkpoint', 'Dotted rhythms in minor keys', [
        keysig(T, 'C G F Am Em Dm', 6),
        read(T, P.rhA, { key: 'Am', rhythms: RH.dottedRests, maxLeap: 3, five: true, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(T, 'E4 F#4 G4 A4 B4 C5 D5 E5', { key: 'Em', rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', 'A E D minor']),

    unit('pt10', 'Ledger Lines', 'Above and below the staff.', [
      lesson('pt10-1', 'Above the Staff', 'learn', 'G5, A5, B5, C6', [
        tip('Ledger lines', 'Ledger lines extend the staff. Count them like extra staff lines: A5 sits on the first ledger line above, C6 on the second.', { kind: 'staff', clef: 'treble', notes: ['G5', 'A5', 'B5', 'C6'], labels: true }),
        meet(T, 'G5 A5 B5 C6', { hand: 'R', fingers: [2, 3, 4, 5] }),
        name(T, P.rhHigh, 15),
      ]),
      lesson('pt10-2', 'High Melodies', 'practice', 'Reading in the upper register', [
        read(T, 'G5 A5 B5 C6 D6', { rhythms: RH.eighths, maxLeap: 2, five: true }),
        read(T, 'C5 D5 E5 F5 G5 A5 B5 C6', { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pt10-3', 'Below Middle C', 'learn', 'B3, A3, G3 in the treble clef', [
        tip('Under the staff', 'Below Middle C the ledger lines continue downward: B3 hangs under Middle C’s line, A3 sits on the second ledger line below.', { kind: 'staff', clef: 'treble', notes: ['C4', 'B3', 'A3', 'G3'], labels: true }),
        meet(T, 'B3 A3 G3', { hand: 'R', fingers: [3, 2, 1] }),
        read(T, P.rhLow, { rhythms: RH.qh, maxLeap: 2, five: true }),
      ]),
      lesson('pt10-4', 'The Full Range', 'practice', 'From G3 to C6', [
        name(T, P.rhFull, 24, { sequence: true, title: 'Note rush' }),
        play(T, P.rhFull, 16, { hand: 'R' }),
        read(T, P.rhWide, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.4, fingering: 'first' }),
      ]),
      lesson('pt10-c', 'Checkpoint: Ledger Lines', 'checkpoint', 'Fluent across the whole range', [
        name(T, P.rhFull, 20, { sequence: true }),
        read(T, 'C5 D5 E5 F5 G5 A5 B5 C6', { rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        read(T, 'G3 A3 B3 C4 D4 E4 F4 G4', { rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Ledger lines', 'G3–C6']),

    unit('pt11', 'More Keys', 'Up to three sharps and three flats.', [
      lesson('pt11-1', 'D and A Major', 'learn', 'Two and three sharps', [
        tip('Order of sharps', 'Sharps are always added in the same order: F C G D A E B. D major has F♯ and C♯; A major adds G♯. The last sharp is one half step below the key’s name.'),
        keysig(T, 'G D A', 8),
        scale('D', 'major', 'R'),
        scale('A', 'major', 'R'),
        read(T, 'D4 E4 F#4 G4 A4 B4 C#5 D5', { key: 'D', rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pt11-2', 'B♭ and E♭ Major', 'learn', 'Two and three flats', [
        tip('Order of flats', 'Flats go B E A D G C F — the sharps backwards. The second-to-last flat names the key: B♭ E♭ → B♭ major.'),
        keysig(T, 'F Bb Eb', 8),
        scale('Bb', 'major', 'R', { title: 'B♭ major — starts on finger 4' }),
        scale('Eb', 'major', 'R'),
        read(T, 'Bb3 C4 D4 Eb4 F4 G4 A4 Bb4', { key: 'Bb', rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pt11-3', 'Key Workout', 'practice', 'Reading in six keys', [
        keysig(T, 'C G D A F Bb Eb Am Em Dm', 10),
        read(T, 'A4 B4 C#5 D5 E5 F#5 G#5 A5', { key: 'A', rhythms: RH.dotted, maxLeap: 3, harmonic: true, fingering: 'first' }),
        read(T, 'Eb4 F4 G4 Ab4 Bb4 C5 D5 Eb5', { key: 'Eb', rhythms: RH.dotted, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pt11-4', 'Classical Themes', 'song', 'Mozart and Dvořák', [
        piece('prh-eine-kleine-nachtmusik'),
        piece('prh-largo-new-world'),
      ]),
      lesson('pt11-c', 'Checkpoint: Keys', 'checkpoint', 'Sight-read in unfamiliar keys', [
        keysig(T, 'G D A F Bb Eb', 8),
        read(T, 'D4 E4 F#4 G4 A4 B4 C#5 D5 E5', { key: 'D', rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 76, fingering: 'first' }),
        read(T, 'Bb3 C4 D4 Eb4 F4 G4 A4 Bb4 C5', { key: 'Bb', rhythms: RH.eighths, maxLeap: 4, harmonic: true, fingering: 'none' }),
      ]),
    ], ['D A major', 'B♭ E♭ major', 'Order of ♯/♭']),

    unit('pt12', 'Chords & Two-Note Reading', 'Read stacked notes at a glance.', [
      lesson('pt12-1', 'Thirds and Sixths', 'learn', 'Two notes at once', [
        tip('Reading dyads', 'Two notes stacked line-on-line (or space-on-space) are a 3rd apart. A 6th spans further: one on a line, one in a space. Read the bottom note, then see the shape.', { kind: 'staff', clef: 'treble', notes: ['[C4 E4]', '[D4 F4]', '[E4 C5]', '[F4 D5]'] }),
        interval(T, P.rhOctave, [3, 4, 5, 6], 10, { harmonic: true }),
        read(T, P.rhC, { rhythms: RH.qh, maxLeap: 2, five: true, dyads: { chance: 0.4, intervals: [3] } }),
      ]),
      lesson('pt12-2', 'Triads', 'learn', 'Three notes in thirds', [
        tip('Triads', 'A triad stacks two thirds: all lines or all spaces — a “snowman”. Play root position triads with fingers 1-3-5.', { kind: 'staff+keys', clef: 'treble', notes: ['[C4 E4 G4]'], fingers: [1, 3, 5], hand: 'R' }),
        inlinePiece('Triads in C', 'C', [4, 4], [{ clef: 'treble', hand: 'R', voices: ['[C4 E4 G4]/h@1,3,5 [D4 F4 A4]@1,3,5 | [E4 G4 B4]@1,3,5 [F4 A4 C5]@1,3,5 | [G4 B4 D5]@1,3,5 [F4 A4 C5]@1,3,5 | [C4 E4 G4]/w@1,3,5 |'] }]),
        inlinePiece('I – IV – V – I', 'C', [4, 4], [{ clef: 'treble', hand: 'R', voices: ['[C4 E4 G4]/w@1,3,5 | [C4 F4 A4]/w@1,3,5 | [B3 D4 G4]/w@1,2,5 | [C4 E4 G4]/w@1,3,5 |'] }], { prompt: 'Inversions keep the hand close: notice the fingers.' }),
      ]),
      lesson('pt12-3', 'Broken Chords', 'practice', 'Arpeggios across the hand', [
        inlinePiece('Arpeggio Study', 'C', [4, 4], [{ clef: 'treble', hand: 'R', voices: ['C4/e@1 E4@2 G4@3 C5@5 G4@3 E4@2 C4/q@1 | F4/e@1 A4@2 C5@3 F5@5 C5@3 A4@2 F4/q@1 | G4/e@1 B4@2 D5@3 G5@5 D5@3 B4@2 G4/q@1 | C4/e@1 E4@2 G4@3 C5@5 C5/h@5 |'] }]),
        read(T, P.rhOctave, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.6, harmonic: true, fingering: 'all' }),
      ]),
      lesson('pt12-c', 'Checkpoint: Chords', 'checkpoint', 'Read dyads and triads', [
        interval(T, P.rhWide, [2, 3, 4, 5, 6, 8], 12, { harmonic: true }),
        read(T, P.rhG, { rhythms: RH.qh, maxLeap: 3, five: true, dyads: { chance: 0.5, intervals: [3, 4, 5] }, fingering: 'first' }),
      ]),
    ], ['Harmonic intervals', 'Triads', 'Arpeggios']),

    unit('pt13', 'Rhythm Workshop', 'Sixteenths, triplets, syncopation and 6/8.', [
      lesson('pt13-1', 'Sixteenth Notes', 'learn', 'Four notes per beat', [
        tip('Sixteenths', 'Sixteenth notes have two beams: four per beat. Count “1 e & a”.', { kind: 'staff', clef: 'treble', notes: ['C5/s', 'B4/s', 'A4/s', 'G4/s', 'F4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.sixteenths, { tempo: 60 }),
        read(T, P.rhG, { rhythms: RH.sixteenths, maxLeap: 2, five: true }),
        piece('prh-perpetual-motion', { title: 'Perpetual Motion (take it slowly)' }),
      ]),
      lesson('pt13-2', 'Triplets', 'learn', 'Three in the space of two', [
        tip('Triplets', 'A “3” over three eighth notes squeezes them into one beat: “tri-po-let”.', { kind: 'staff', clef: 'treble', notes: ['C5/e3', 'D5/e3', 'E5/e3', 'G5/q'], time: [2, 4] }),
        rhythm([4, 4], RH.triplets, { tempo: 66 }),
        read(T, P.rhC5, { rhythms: RH.triplets, maxLeap: 2, five: true }),
      ]),
      lesson('pt13-3', 'Syncopation', 'learn', 'Accents off the beat', [
        tip('Off the beat', 'Syncopation places a long note between beats: “1 & – & ”. Keep counting steadily and let the note ride across the beat.', { kind: 'staff', clef: 'treble', notes: ['C5/e', 'D5/q', 'C5/e'], time: [2, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        read(T, P.rhOctave, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true }),
      ]),
      lesson('pt13-4', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighth notes per bar grouped in two sets of three: “ONE two three FOUR five six”. It sways.', { kind: 'staff', clef: 'treble', notes: ['C5/q', 'A4/e', 'G4/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(T, P.rhG, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, five: true }),
      ]),
      lesson('pt13-5', 'Rhythmic Classics', 'song', 'Für Elise and the Mountain King', [
        piece('prh-fur-elise'),
        piece('prh-mountain-king'),
      ]),
      lesson('pt13-c', 'Checkpoint: Rhythm Workshop', 'checkpoint', 'Mixed rhythms in time', [
        rhythm([4, 4], RH.advanced, { tempo: 66, reps: 1 }),
        read(T, P.rhStaff, { rhythms: RH.advanced, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 60, fingering: 'first' }),
        read(T, P.rhG, { time: [6, 8], rhythms: RH.compoundAdv, maxLeap: 3, five: true, fingering: 'none' }),
      ]),
    ], ['16ths', 'Triplets', 'Syncopation', '6/8']),

    unit('pt14', 'Virtuoso Reading', 'Advanced repertoire and fast sight-reading.', [
      lesson('pt14-1', 'Four Sharps, Four Flats', 'learn', 'E major and A♭ major', [
        keysig(T, 'D A E Bb Eb Ab', 10),
        scale('E', 'major', 'R', { octaves: 2, octave: 4, rhythm: 'e' }),
        scale('Ab', 'major', 'R', { octaves: 2, octave: 4, rhythm: 'e' }),
      ]),
      lesson('pt14-2', 'Wide Leaps', 'practice', 'Jumps across the keyboard', [
        read(T, P.rhFull, { rhythms: RH.eighths, maxLeap: 7, leapiness: 0.7, harmonic: true, fingering: 'first' }),
        read(T, 'E4 F#4 G#4 A4 B4 C#5 D#5 E5 F#5 G#5 A5', { key: 'E', rhythms: RH.dotted, maxLeap: 5, harmonic: true, fingering: 'first' }),
      ]),
      lesson('pt14-3', 'Speed Reading', 'challenge', 'Sight-read at tempo', [
        name(T, P.rhFull, 30, { sequence: true, title: 'Lightning round' }),
        read(T, P.rhWide, { rhythms: RH.advanced, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(T, 'Ab3 Bb3 C4 Db4 Eb4 F4 G4 Ab4 Bb4 C5 Db5 Eb5', { key: 'Ab', rhythms: RH.syncopation, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
      lesson('pt14-4', 'Concert Pieces', 'song', 'Advanced right-hand repertoire', [
        piece('prh-toccata-in-a-minor'),
        piece('prh-ragtime-strut'),
      ]),
      lesson('pt14-c', 'Final Exam: Treble Clef', 'checkpoint', 'Prove your mastery', [
        name(T, P.rhFull, 30, { sequence: true }),
        keysig(T, 'C G D A E F Bb Eb Ab Am Em Dm', 10),
        read(T, P.rhFull, { rhythms: RH.advanced, maxLeap: 5, harmonic: true, mode: 'tempo', tempo: 76, fingering: 'none', measures: 6 }),
      ]),
    ], ['4♯ / 4♭', 'Leaps', 'At tempo']),
  ],
};
