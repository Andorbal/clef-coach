import { chordInsight, chordQuiz, chordTip, lesson, pickChord, strum, strumAlong, tip, unit } from '../builders';
import type { TrackDef } from '../types';

/**
 * Ukulele · Chords. How most people play the ukulele: C, Am, F and G7 first, strumming
 * patterns, the keys of G and F, sevenths, minor keys and colour chords — with a song to
 * strum along with in nearly every unit (the app plays the tune).
 *
 * Shapes come from the chord book at run time in the player's tuning (high-G, low-G or
 * baritone), so they are always right for the instrument in their hands.
 */
export const ukuleleChords: TrackDef = {
  id: 'ukulele-chords',
  instrument: 'ukulele',
  title: 'Chords & Strumming',
  subtitle: 'Ukulele · Chords and strumming',
  description: 'Strum your first song in the first lesson: C, Am, F and G7, strumming patterns, the keys of G and F, seventh chords, minor keys and colour chords, with songs to strum along with.',
  clef: 'chords',
  accent: '#7fe0c6',
  glyph: '♯',
  heatmap: [{ clef: 'treble', low: 'C4', high: 'C5' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('uc1', 'C and A minor', 'Two one-finger chords — and a whole song.', [
      lesson(
        'uc1-1',
        'C',
        'learn',
        'Read a chord box and play C.',
        [
          chordTip('C', 'One finger: ring finger on the 3rd fret of the A string (the string on the right). The other three strings ring open.', 'C'),
          pickChord('C', { prompt: 'Pick each string on its own — G, C, E, then the fretted A — and listen for a clear note every time. Then strum.' }),
          strum('C', { repeat: 4, prompt: 'Strum down across all four strings with the pad of your index finger, once per bar.' }),
        ],
        [
          chordInsight('Reading a chord box', 'A chord box is the neck standing up: the four strings run top to bottom — G, C, E, A from left to right — with the nut as the thick line at the top and the frets across. A dot is a finger (1 index, 2 middle, 3 ring, 4 little) and ○ an open string. The gold square is the root, the note that names the chord.', 'C'),
        ],
      ),
      lesson('uc1-2', 'A minor', 'learn', 'Play A minor and change to and from C.', [
        chordTip('A minor', 'Middle finger on the 2nd fret of the G string (the string on the left). A gentle, sadder sound than C.', 'Am'),
        pickChord('Am'),
        strum('C Am', { repeat: 3, prompt: 'Strum once per chord. Lift one finger, place the other — the app waits for you.' }),
      ]),
      lesson('uc1-3', 'Strum along: My Dog Has Fleas', 'song', 'Your first song with chords.', [
        tip('Strumming along', 'The tune plays on the top staff; your part is underneath: one strum on every beat. First the app waits for each strum, then you play in time — if a change is late, skip ahead and land on the next beat rather than stopping.'),
        strumAlong('uke-my-dog-has-fleas', { mode: 'wait' }),
        strumAlong('uke-my-dog-has-fleas'),
      ]),
      lesson('uc1-c', 'Checkpoint: C and A minor', 'checkpoint', 'Name and change C and A minor in time.', [
        chordQuiz('C Am', 6),
        strum('C Am', { repeat: 3, rhythm: 'q q q q', mode: 'tempo', tempo: 72 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 2
    unit('uc2', 'F and G7', 'Four chords — C, Am, F, G7 — and hundreds of songs.', [
      lesson('uc2-1', 'F', 'learn', 'Play F: A minor plus one finger.', [
        chordTip('F', 'Keep A minor’s middle finger on the G string and add your index finger on the 1st fret of the E string.', 'Am F'),
        pickChord('F'),
        strum('Am F', { repeat: 3, prompt: 'A minor to F: the middle finger stays put.' }),
      ]),
      lesson('uc2-2', 'G7', 'learn', 'Play G7: a little triangle.', [
        chordTip('G7', 'A triangle: middle finger on the C string (2nd fret), index on the E string (1st fret), ring finger on the A string (2nd fret). G7 leans back towards C.', 'G7'),
        pickChord('G7'),
        strum('C G7', { repeat: 3 }),
      ]),
      lesson('uc2-3', 'C – Am – F – G7', 'practice', 'The ukulele’s favourite progression.', [
        chordTip('I – vi – IV – V7', 'C, A minor, F, G7 and back to C: the sound of countless ukulele songs. Loop it until the changes feel automatic.', 'C Am F G7'),
        strum('C Am F G7', { repeat: 2 }),
        strum('C Am F G7', { repeat: 3, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
        strum('C Am F G7', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 76 }),
      ]),
      lesson('uc2-4', 'Strum along: C and G7', 'song', 'Two songs with C and G7.', [
        strumAlong('uke-mary-had-a-little-lamb', { mode: 'wait' }),
        strumAlong('uke-mary-had-a-little-lamb'),
        strumAlong('uke-ode-to-joy'),
      ]),
      lesson('uc2-c', 'Checkpoint: four chords', 'checkpoint', 'C, Am, F and G7 by sight and in a song.', [
        chordQuiz('C Am F G7', 8),
        strumAlong('uke-twinkle'),
      ]),
    ]),

    // ------------------------------------------------------------------ 3
    unit('uc3', 'Strumming patterns', 'Down-strums on the beat, up-strums in between, and the island strum.', [
      lesson('uc3-1', 'Down and up', 'learn', 'Add up-strums between the beats.', [
        tip('Down on the beat, up on the “and”', 'Your hand swings down on every beat and back up between them, like a pendulum — it never stops. Brush the strings on the way down for “1”, on the way up for “and”: 1 2-and 3 4-and.'),
        strum('C G7', { repeat: 3, rhythm: 'q e e q e e', mode: 'tempo', tempo: 66, prompt: 'Down, down-up, down, down-up. Keep the arm swinging even when it misses the strings.' }),
        strum('C Am F G7', { repeat: 2, rhythm: 'q e e q e e', mode: 'tempo', tempo: 70 }),
      ]),
      lesson('uc3-2', 'The island strum', 'learn', 'D – DU – UDU, the classic ukulele strum.', [
        tip('The island strum', 'Down, down-up, up-down-up: 1, 2-and, (3)-and, 4-and. The secret is beat 3 — your hand still swings down, but misses the strings, so the up-strum after it sounds off the beat.'),
        strum('C', { repeat: 4, rhythm: 'q e q e e e', mode: 'tempo', tempo: 66 }),
        strum('C Am F G7', { repeat: 2, rhythm: 'q e q e e e', mode: 'tempo', tempo: 70 }),
      ]),
      lesson('uc3-3', 'Waltz time', 'song', 'Strumming in 3/4.', [
        tip('Three beats', 'A waltz has three beats in a bar: strum beat 1 a little stronger — ONE two three.'),
        strum('C F G7 C', { repeat: 2, rhythm: 'q q q', time: [3, 4], mode: 'tempo', tempo: 96 }),
        strumAlong('uke-island-waltz', { mode: 'wait' }),
        strumAlong('uke-island-waltz'),
      ]),
      lesson('uc3-4', 'Strum along: Jingle Bells', 'song', 'C, F and G7 at a jingling pace.', [
        strumAlong('uke-jingle-bells', { mode: 'wait' }),
        strumAlong('uke-jingle-bells'),
      ]),
      lesson('uc3-c', 'Checkpoint: strumming', 'checkpoint', 'The island strum through the four chords.', [
        strum('C Am F G7', { repeat: 2, rhythm: 'q e q e e e', mode: 'tempo', tempo: 80 }),
        strumAlong('uke-hot-cross-buns'),
      ]),
    ]),

    // ------------------------------------------------------------------ 4
    unit('uc4', 'The key of G', 'G, E minor and D.', [
      lesson('uc4-1', 'G', 'learn', 'Play G major.', [
        chordTip('G', 'Index on the C string (2nd fret), middle on the A string (2nd fret), ring on the E string (3rd fret). Only the G string is open.', 'G'),
        pickChord('G'),
        strum('C G', { repeat: 3 }),
      ]),
      lesson('uc4-2', 'E minor', 'learn', 'Play E minor.', [
        chordTip('E minor', 'A diagonal line: ring finger on the C string (4th fret), middle on the E string (3rd), index on the A string (2nd).', 'Em'),
        pickChord('Em'),
        strum('G Em', { repeat: 3 }),
      ]),
      lesson('uc4-3', 'D', 'learn', 'Play D major.', [
        chordTip('D', 'Three fingers in a row on the 2nd fret of the G, C and E strings, with the A string open. If they don’t fit, try one finger flattened across all three.', 'D'),
        pickChord('D'),
        strum('G D', { repeat: 3 }),
      ]),
      lesson('uc4-4', 'G – Em – C – D', 'practice', 'A four-chord loop in G.', [
        strum('G Em C D', { repeat: 2 }),
        strum('G Em C D', { repeat: 3, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
        strum('G Em C D', { repeat: 2, rhythm: 'q e q e e e', mode: 'tempo', tempo: 72 }),
      ]),
      lesson('uc4-c', 'Checkpoint: the key of G', 'checkpoint', 'Six chords, named and changed.', [
        chordQuiz('G Em D C Am F', 8),
        strum('G Em C D', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 80 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 5
    unit('uc5', 'Seventh chords', 'A7, D7, C7, E7 and B7 — and the songs that use them.', [
      lesson('uc5-1', 'A7 and D7', 'learn', 'Two sevenths for the key of G.', [
        chordTip('A7 and D7', 'A7 is a single finger: index on the 1st fret of the C string. D7 here is a barre: index finger across the 2nd fret, middle finger on the A string at the 3rd.', 'A7 D7'),
        pickChord('A7'),
        pickChord('D7'),
        strum('G A7 D7 G', { repeat: 2 }),
      ]),
      lesson('uc5-2', 'C7 and E7', 'learn', 'C7 pulls to F; E7 pulls to A minor.', [
        chordTip('C7 and E7', 'C7 is one finger: index on the 1st fret of the A string. E7: index on the G string (1st fret), middle on the E string (2nd), ring on the A string (2nd).', 'C7 E7'),
        pickChord('E7'),
        strum('C C7 F C', { repeat: 2 }),
        strum('Am E7', { repeat: 3 }),
      ]),
      lesson('uc5-3', 'B7', 'learn', 'B7 leads to E minor.', [
        chordTip('B7', 'Index finger barres the 2nd fret; middle finger on the C string at the 3rd fret.', 'B7 Em'),
        pickChord('B7'),
        strum('Em B7', { repeat: 3 }),
      ]),
      lesson('uc5-4', 'Strum along: the Saints and Susanna', 'song', 'C, G7, C7 and F.', [
        strumAlong('uke-when-the-saints', { mode: 'wait' }),
        strumAlong('uke-when-the-saints'),
        strumAlong('uke-oh-susanna'),
      ]),
      lesson('uc5-5', 'Strum along: Aura Lee', 'song', 'A Civil-War ballad full of seventh chords.', [
        strumAlong('uke-aura-lee', { mode: 'wait' }),
        strumAlong('uke-aura-lee'),
      ]),
      lesson('uc5-c', 'Checkpoint: sevenths', 'checkpoint', 'Six sevenths and a song in 6/8.', [
        chordQuiz('A7 D7 C7 E7 B7 G7', 8),
        strumAlong('uke-row-your-boat'),
      ]),
    ]),

    // ------------------------------------------------------------------ 6
    unit('uc6', 'Minor keys', 'D minor, E and three songs in minor keys.', [
      lesson('uc6-1', 'D minor', 'learn', 'Play D minor.', [
        chordTip('D minor', 'Middle finger on the G string and ring finger on the C string (both 2nd fret), index on the E string (1st fret). It’s F with one more finger.', 'F Dm'),
        pickChord('Dm'),
        strum('Dm C', { repeat: 3 }),
      ]),
      lesson('uc6-2', 'Strum along: Drunken Sailor', 'song', 'D minor and C at a sea-shanty pace.', [
        strumAlong('uke-drunken-sailor', { mode: 'wait' }),
        strumAlong('uke-drunken-sailor'),
      ]),
      lesson('uc6-3', 'Strum along: Scarborough Fair', 'song', 'A ballad in D minor.', [
        strumAlong('uke-scarborough-fair', { mode: 'wait' }),
        strumAlong('uke-scarborough-fair'),
      ]),
      lesson('uc6-4', 'E and Greensleeves', 'song', 'E major, then a Tudor ballad in A minor.', [
        chordTip('E', 'The tricky one: index on the G string (1st fret), little finger on the C string (4th fret), middle on the A string (2nd fret), E string open. It pulls strongly back to A minor.', 'E Am'),
        pickChord('E'),
        strum('Am E', { repeat: 3 }),
        strumAlong('uke-greensleeves', { mode: 'wait' }),
        strumAlong('uke-greensleeves'),
      ]),
      lesson('uc6-c', 'Checkpoint: minor keys', 'checkpoint', 'Minor-key chords by sight and Greensleeves in time.', [
        chordQuiz('Am Dm Em E F G', 8),
        strumAlong('uke-greensleeves'),
      ]),
    ]),

    // ------------------------------------------------------------------ 7
    unit('uc7', 'B♭ and the key of F', 'Your first barre chord and three songs in F.', [
      lesson('uc7-1', 'B♭', 'learn', 'A small barre.', [
        chordTip('B♭', 'Index finger flat across the 1st fret of the E and A strings, middle finger on the C string (2nd fret), ring finger on the G string (3rd fret). Roll the index finger slightly onto its side.', 'Bb'),
        pickChord('Bb', { prompt: 'Pick each string: the E and A strings under the barre must both ring.' }),
        strum('F Bb C7 F', { repeat: 2 }),
      ]),
      lesson('uc7-2', 'Strum along: Yankee Doodle', 'song', 'F, C7 and B♭.', [
        strumAlong('uke-yankee-doodle', { mode: 'wait' }),
        strumAlong('uke-yankee-doodle'),
      ]),
      lesson('uc7-3', 'Strum along: Auld Lang Syne', 'song', 'The New Year’s song in F.', [
        strumAlong('uke-auld-lang-syne', { mode: 'wait' }),
        strumAlong('uke-auld-lang-syne'),
      ]),
      lesson('uc7-c', 'Checkpoint: the key of F', 'checkpoint', 'Amazing Grace in 3/4.', [
        chordQuiz('F Bb C7 C Dm', 8, { reverse: true }),
        strumAlong('uke-amazing-grace'),
      ]),
    ]),

    // ------------------------------------------------------------------ 8
    unit('uc8', 'Colour chords', 'Major and minor sevenths and sus chords.', [
      lesson('uc8-1', 'Major sevenths', 'learn', 'Dreamy major-seventh chords.', [
        chordTip('Major sevenths', 'Cmaj7 is C with the A-string note lowered to the 2nd fret — a soft, dreamy sound. Gmaj7 is a row of three fingers on the 2nd fret.', 'Cmaj7 Fmaj7 Gmaj7'),
        strum('C Cmaj7', { repeat: 3, rhythm: 'h h' }),
        strum('Cmaj7 Fmaj7', { repeat: 3 }),
      ]),
      lesson('uc8-2', 'Minor sevenths', 'learn', 'Am7 is all open strings.', [
        chordTip('Minor sevenths', 'Am7 needs no fingers at all — strum the open strings. Dm7 – G7 – Cmaj7 is the jazz move ii – V – I.', 'Am7 Dm7 Em7'),
        strum('Dm7 G7 Cmaj7 Am7', { repeat: 2 }),
        strum('Dm7 G7 Cmaj7 Am7', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
      ]),
      lesson('uc8-3', 'Sus chords', 'learn', 'Suspended chords: lift and resolve.', [
        chordTip('sus2 and sus4', 'Swap the third for the 2nd or 4th and the chord hangs in the air until it resolves. Csus4 – C is just one extra finger on the E string.', 'Csus4 Gsus4 Dsus2'),
        strum('C Csus4 C Csus4', { repeat: 2, rhythm: 'h h' }),
        strum('G Gsus4 D Dsus2', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 72 }),
      ]),
      lesson('uc8-4', 'Strum along: My Bonnie', 'song', 'A waltz with seven different chords.', [
        strumAlong('uke-my-bonnie', { mode: 'wait' }),
        strumAlong('uke-my-bonnie'),
      ]),
      lesson('uc8-c', 'Final checkpoint', 'checkpoint', 'Every chord in the track, and Silent Night.', [
        chordQuiz('Cmaj7 Fmaj7 Am7 Dm7 Em7 Csus4 Gsus4 Gmaj7', 10),
        chordQuiz('C Am F G7 G Em D Bb', 6, { reverse: true }),
        strumAlong('uke-silent-night'),
      ]),
    ]),
  ],
};
