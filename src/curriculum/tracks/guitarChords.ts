import { chordInsight, chordQuiz, chordTip, lesson, pickChord, strum, strumAlong, tip, unit } from '../builders';
import type { TrackDef } from '../types';

/**
 * Guitar · Chords. Open chords first (Em, Am, E, A, D, G, C), then sevenths, the small F
 * and the full barre, minor keys, barre chords up the neck and colour chords.
 *
 * Every chord is drawn and checked at run time from the chord book in the player's tuning;
 * "F:xx3211" asks for that particular shape. Each new chord is learned note by note first
 * (pick every string so it rings clearly), then strummed, then changed to and from in
 * time, and finally strummed along with songs while the app plays the tune.
 */
export const guitarChords: TrackDef = {
  id: 'guitar-chords',
  instrument: 'guitar',
  title: 'Chords',
  subtitle: 'Guitar · Chords and strumming',
  description: 'The open chords every guitarist knows, clean changes in time, strumming along with songs, sevenths, the F chord, barre chords up the neck and colour chords.',
  clef: 'chords',
  accent: '#ffb86b',
  glyph: '♯',
  heatmap: [{ clef: 'treble8vb', low: 'E2', high: 'E4' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('gc1', 'Your first chords', 'E minor and A minor: two easy shapes and the change between them.', [
      lesson(
        'gc1-1',
        'E minor',
        'learn',
        'Read a chord box and play E minor.',
        [
          chordTip('E minor', 'Two fingers on the 2nd fret of the A and D strings — fingers 2 and 3 — and all six strings ring. Press just behind the fret wire with your fingertips.', 'Em'),
          pickChord('Em', { prompt: 'Hold the shape and pick each string on its own, low E to high E. Every string should ring clearly — if one buzzes or is muted, adjust that finger.' }),
          strum('Em', { repeat: 4, prompt: 'Strum all six strings with a relaxed down-stroke, once per bar. Let it ring.' }),
        ],
        [
          chordInsight('Reading a chord box', 'A chord box is the neck standing up. Strings run top to bottom with the low E on the left; the thick line at the top is the nut and the lines across are frets. A dot is a finger (1 index, 2 middle, 3 ring, 4 little), ○ an open string and × a string you don’t play. The gold square marks the root — the note that names the chord.', 'Em'),
        ],
      ),
      lesson('gc1-2', 'A minor', 'learn', 'Play A minor and keep the low E quiet.', [
        chordTip('A minor', 'Fingers 1, 2 and 3 — the E minor shape plus one finger, moved across one string. Start your strum on the open A string; the low E has an × above it.', 'Am'),
        pickChord('Am'),
        strum('Am', { repeat: 4 }),
      ]),
      lesson('gc1-3', 'Em ⇄ Am', 'practice', 'Change between your first two chords.', [
        tip('Changing chords', 'Move your fingers as one shape, not one at a time. From E minor to A minor, fingers 2 and 3 keep their shape and simply move across one string; finger 1 joins them. Look at where you’re going, not where you are.'),
        strum('Em Am', { repeat: 3, prompt: 'Strum each chord once. Take as long as you need for the change — the app waits.' }),
        strum('Em Am', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 60, prompt: 'Two strums per chord, in time. Start the change on the second strum.' }),
        chordQuiz('Em Am', 6),
      ]),
      lesson('gc1-c', 'Checkpoint: first chords', 'checkpoint', 'Name and change E minor and A minor in time.', [
        chordQuiz('Em Am', 6),
        strum('Em Am', { repeat: 3, rhythm: 'q q q q', mode: 'tempo', tempo: 66 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 2
    unit('gc2', 'E, A and D', 'Three major chords — and with them, hundreds of songs.', [
      lesson('gc2-1', 'E major', 'learn', 'Play E major.', [
        chordTip('E major', 'E minor with one more finger: index finger on the 1st fret of the G string. Hear how that one note turns the sad minor chord bright.', 'Em E'),
        pickChord('E'),
        strum('Em E', { repeat: 2, prompt: 'Minor, then major. Only finger 1 moves.' }),
      ]),
      lesson('gc2-2', 'A major', 'learn', 'Play A major.', [
        chordTip('A major', 'Three fingers side by side on the 2nd fret of the D, G and B strings. They’re crowded — angle your fingers so the high E string still rings. Start from the A string.', 'A'),
        pickChord('A'),
        strum('Am A', { repeat: 2 }),
      ]),
      lesson('gc2-3', 'D major', 'learn', 'Play D major on four strings.', [
        chordTip('D major', 'A triangle of three fingers on the top three strings. Only four strings play: start your strum on the open D string.', 'D'),
        pickChord('D'),
        strum('D', { repeat: 4 }),
      ]),
      lesson('gc2-4', 'A, D and E', 'practice', 'Change between A, D and E.', [
        tip('Guide fingers', 'Look for a finger that can slide during a change instead of lifting. Between A and D, finger 3 stays on the B string and slides from the 2nd fret to the 3rd — keep it touching the string. Between A and E every finger moves: practise the change slowly as one movement, landing all three fingers together.'),
        strum('A D', { repeat: 3 }),
        strum('A E', { repeat: 3 }),
        strum('A D E A', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 60 }),
        chordQuiz('E A D Em Am', 8),
      ]),
      lesson('gc2-c', 'Checkpoint: A, D and E', 'checkpoint', 'Find, name and change the five chords.', [
        chordQuiz('E A D Em Am', 6, { reverse: true }),
        strum('A D E A', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 70 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 3
    unit('gc3', 'G and C', 'The last two big open chords, the four-chord song, and your first strum-along.', [
      lesson('gc3-1', 'G major', 'learn', 'Play G major on all six strings.', [
        chordTip('G major', 'A wide shape: middle finger on the low E (3rd fret), index on the A string (2nd fret), ring finger on the high E (3rd fret). Keep your wrist low and your thumb behind the neck so the middle strings ring open.', 'G'),
        pickChord('G'),
        strum('G D', { repeat: 2 }),
      ]),
      lesson('gc3-2', 'C major', 'learn', 'Play C major.', [
        chordTip('C major', 'A staircase: ring finger on the A string (3rd fret), middle on the D string (2nd), index on the B string (1st). Don’t play the low E — start your strum on the A string.', 'C'),
        pickChord('C'),
        strum('C Am', { repeat: 2, prompt: 'C to A minor: fingers 1 and 2 stay where they are. Only finger 3 moves.' }),
      ]),
      lesson('gc3-3', 'G, C and D', 'practice', 'Change between the three chords of the key of G.', [
        strum('G C', { repeat: 3 }),
        strum('G D', { repeat: 3 }),
        strum('G C D G', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 60 }),
        chordQuiz('G C D A E', 8),
      ]),
      lesson('gc3-4', 'The four-chord song', 'practice', 'Play the most famous progression in pop.', [
        chordTip('G – D – Em – C', 'Thousands of songs use just these four chords in this order (I–V–vi–IV in G). Once you can loop them in time, you can strum along with half the radio.', 'G D Em C'),
        strum('G D Em C', { repeat: 2 }),
        strum('G D Em C', { repeat: 3, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
        strum('G D Em C', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 72 }),
      ]),
      lesson('gc3-5', 'Strum along: Scarborough Fair', 'song', 'Strum the chords of a whole song while the app sings the tune.', [
        tip('Strumming along', 'The tune plays on the top staff; your part is the chord on every beat, underneath. Wait mode first: the app waits for each strum. Then in time — if a change is late, skip ahead and land on the next beat rather than stopping.'),
        strumAlong('gt-scarborough-fair', { mode: 'wait' }),
        strumAlong('gt-scarborough-fair', { tempo: 84 }),
      ]),
      lesson('gc3-c', 'Checkpoint: open chords', 'checkpoint', 'All seven open chords, named and changed in time.', [
        chordQuiz('G C D E A Em Am', 8),
        strum('G Em C D', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 76 }),
        strumAlong('gt-scarborough-fair', { tempo: 96 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 4
    unit('gc4', 'Seventh chords', 'Dominant sevenths: the chords that pull you home — and the 12-bar blues.', [
      lesson('gc4-1', 'G7 and C7', 'learn', 'Play G7 and C7.', [
        chordTip('Seventh chords', 'A seventh chord adds one more note to a major chord (the ♭7) and gives it a restless pull towards the next chord. G7 pulls to C; C7 pulls to F.', 'G7 C7'),
        pickChord('G7'),
        pickChord('C7'),
        strum('C G7', { repeat: 3 }),
      ]),
      lesson('gc4-2', 'D7, A7 and E7', 'learn', 'Three more sevenths, each simpler than its major chord.', [
        chordTip('D7, A7 and E7', 'A7 and E7 are the A and E shapes with a finger lifted — the open string adds the seventh.', 'D7 A7 E7'),
        pickChord('D7'),
        strum('A7 D7', { repeat: 2 }),
        strum('E7 A7', { repeat: 2 }),
      ]),
      lesson('gc4-3', 'B7', 'learn', 'B7: four fingers, and the gateway to E minor songs.', [
        chordTip('B7', 'All four fingers. Skip the low E. B7 leads straight back to E minor or E.', 'B7 Em'),
        pickChord('B7'),
        strum('Em B7', { repeat: 3 }),
        strum('Em Am B7 Em', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 60 }),
      ]),
      lesson('gc4-4', '12-bar blues in A', 'practice', 'The 12-bar blues: twelve bars, three chords.', [
        tip('The 12-bar blues', 'Four bars of A7, two of D7, two of A7, then E7 – D7 – A7 – E7, and round again. It’s the backbone of blues, early rock and roll and a lot of jazz.'),
        strum('A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7', { repeat: 1, prompt: 'One strum per bar, taking your time. Count the bars.' }),
        strum('A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7', { repeat: 1, rhythm: 'q q q q', mode: 'tempo', tempo: 80 }),
      ]),
      lesson('gc4-5', 'Strum along: Ode to Joy', 'song', 'C and G7 under Beethoven’s tune.', [
        strumAlong('gt-ode-to-joy', { mode: 'wait' }),
        strumAlong('gt-ode-to-joy', { tempo: 90 }),
      ]),
      lesson('gc4-c', 'Checkpoint: sevenths', 'checkpoint', 'Six seventh chords and the blues in E.', [
        chordQuiz('G7 C7 D7 A7 E7 B7', 8),
        strum('E7 E7 E7 E7 A7 A7 E7 E7 B7 A7 E7 B7', { repeat: 1, rhythm: 'q q q q', mode: 'tempo', tempo: 84 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 5
    unit('gc5', 'The F chord', 'From an easy Fmaj7 to the small F, then the full barre.', [
      lesson('gc5-1', 'Fmaj7 and the small F', 'learn', 'Two friendly ways into F.', [
        chordTip('Sneaking up on F', 'F is famous for being hard. Start with Fmaj7 (three fingers, top four strings), then the small F: the same shape, with the index finger flattened across the top two strings at the 1st fret.', 'Fmaj7 F:xx3211'),
        pickChord('Fmaj7'),
        pickChord('F:xx3211', { prompt: 'Roll your index finger slightly onto its side so it covers both the B and high E strings. Pick each string: both must ring.' }),
        strum('C Fmaj7', { repeat: 2 }),
      ]),
      lesson('gc5-2', 'C, F and G7', 'practice', 'The three chords of the key of C.', [
        strum('C F:xx3211', { repeat: 3 }),
        strum('F:xx3211 G7', { repeat: 2 }),
        strum('C F:xx3211 G7 C', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 60 }),
        chordQuiz('C F:xx3211 G7 Am Dm7', 6),
      ]),
      lesson('gc5-3', 'Strum along: Oh! Susanna', 'song', 'C, F and G7 in a whole song.', [
        strumAlong('gt-oh-susanna', { mode: 'wait', shapes: 'F:xx3211' }),
        strumAlong('gt-oh-susanna', { tempo: 88, shapes: 'F:xx3211' }),
      ]),
      lesson('gc5-4', 'The full F barre', 'learn', 'Bar all six strings with your index finger.', [
        chordTip('The barre', 'The index finger lies across all six strings at the 1st fret; the other three fingers make an E major shape in front of it. Roll the finger slightly onto its bony side, keep it close to the fret, and squeeze with your arm’s weight, not your thumb.', 'F E'),
        pickChord('F', { prompt: 'Pick each string. The ones under your index finger (often the G and B strings) are the usual culprits — roll the finger until they ring.' }),
        strum('C F', { repeat: 3 }),
      ]),
      lesson('gc5-5', 'Strum along: When the Saints', 'song', 'C, G7, C7 and F — with the small F or the barre.', [
        strumAlong('gt-when-the-saints', { mode: 'wait', shapes: 'F:xx3211' }),
        strumAlong('gt-when-the-saints', { tempo: 96 }),
      ]),
      lesson('gc5-c', 'Checkpoint: F', 'checkpoint', 'F in both shapes, named and changed in time.', [
        chordQuiz('F F:xx3211 Fmaj7 C G7 C7', 6),
        strum('C Am F G7', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 72 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 6
    unit('gc6', 'Minor keys', 'D minor, the minor-key family and a Tudor ballad.', [
      lesson('gc6-1', 'D minor', 'learn', 'Play D minor.', [
        chordTip('D minor', 'D major with the top note lowered a fret: a small triangle on the top three strings. Start from the open D string.', 'D Dm'),
        pickChord('Dm'),
        strum('D Dm', { repeat: 2 }),
      ]),
      lesson('gc6-2', 'A minor, D minor, E', 'practice', 'The three chords of a minor key.', [
        tip('i – iv – V', 'In A minor the home chord is Am, the iv chord Dm and the V chord E (major — its G♯ pulls hard back to A). Many minor-key songs use only these three.'),
        strum('Am Dm', { repeat: 3 }),
        strum('Am Dm E Am', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
        chordQuiz('Am Dm E Em D', 8),
      ]),
      lesson('gc6-3', 'Strum along: Greensleeves', 'song', 'A waltz in A minor: Am, C, G, Em, F and E.', [
        tip('Strumming in 3/4', 'Greensleeves is a waltz: three beats in a bar, the first one strongest. Strum beat 1 a little harder.'),
        strumAlong('gt-greensleeves', { mode: 'wait', shapes: 'F:xx3211' }),
        strumAlong('gt-greensleeves', { tempo: 92, shapes: 'F:xx3211' }),
      ]),
      lesson('gc6-c', 'Checkpoint: minor keys', 'checkpoint', 'Minor-key chords and Greensleeves in time.', [
        chordQuiz('Am Dm E Em B7 F:xx3211', 8, { reverse: true }),
        strumAlong('gt-greensleeves', { tempo: 104 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 7
    unit('gc7', 'Barre chords up the neck', 'Movable shapes: one fingering, every key.', [
      lesson('gc7-1', 'B minor', 'learn', 'The A-minor shape as a barre at the 2nd fret.', [
        chordTip('B minor', 'Index finger barres the 2nd fret from the A string up; the other fingers make an A minor shape two frets higher. Don’t play the low E.', 'Bm Am'),
        pickChord('Bm'),
        strum('G D Em Bm', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gc7-2', 'F♯ minor', 'learn', 'The E-minor shape as a barre.', [
        chordTip('F♯ minor', 'The full barre at the 2nd fret with an E minor shape in front of it — fingers 3 and 4 on the A and D strings. Slide the same shape up and it names a new chord at every fret.', 'F#m Em'),
        pickChord('F#m'),
        strum('A F#m D E', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gc7-3', 'B♭ and the key of F', 'learn', 'An A-shape barre at the 1st fret.', [
        chordTip('B♭', 'Index finger across the 1st fret from the A string; fingers 2, 3 and 4 line up on the 3rd fret.', 'Bb F C'),
        pickChord('Bb'),
        strum('F Bb C F', { repeat: 2 }),
        strum('F Bb C F', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 60 }),
      ]),
      lesson('gc7-4', 'Power chords', 'learn', 'Root and fifth: the sound of rock.', [
        chordTip('Power chords', 'Just the root and the fifth (written “5”), often with the root doubled an octave up. No third, so they’re neither major nor minor — and they sound great loud. Away from the open strings the same shape moves anywhere on the low strings: G5 is the E5 shape moved up to the 3rd fret, the open E now under your index finger.', 'E5 A5 G5:355xxx'),
        pickChord('E5'),
        strum('E5 G5:355xxx A5 G5:355xxx', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 84 }),
      ]),
      lesson('gc7-c', 'Checkpoint: barre chords', 'checkpoint', 'Barre chords, named and changed.', [
        chordQuiz('Bm F#m Bb F E5 A5', 8),
        strum('D Bm G A', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 76 }),
      ]),
    ]),

    // ------------------------------------------------------------------ 8
    unit('gc8', 'Colour chords', 'Major and minor sevenths, sus chords and add9: the same shapes with a twist.', [
      lesson('gc8-1', 'Major sevenths', 'learn', 'Dreamy major-seventh chords.', [
        chordTip('Major sevenths', 'A major seventh adds the note a half step below the root — soft and dreamy. Cmaj7 is C with your index finger lifted.', 'Cmaj7 Fmaj7 Gmaj7'),
        pickChord('Cmaj7'),
        strum('Cmaj7 Fmaj7', { repeat: 3 }),
      ]),
      lesson('gc8-2', 'Minor sevenths and ii – V – I', 'learn', 'The jazz cadence.', [
        chordTip('Minor sevenths', 'Am7, Dm7 and Em7 are mellower than plain minor chords. Dm7 – G7 – Cmaj7 is the ii – V – I: the most common chord move in jazz.', 'Am7 Dm7 Em7'),
        pickChord('Dm7'),
        strum('Dm7 G7 Cmaj7 Am7', { repeat: 2 }),
        strum('Dm7 G7 Cmaj7 Am7', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gc8-3', 'Sus chords', 'learn', 'Suspended chords: lift and resolve.', [
        chordTip('sus2 and sus4', 'Swap the third for the 2nd or the 4th and the chord hangs in the air until the third comes back. Dsus4 – D – Dsus2 – D is a classic fill.', 'Dsus2 D Dsus4'),
        strum('D Dsus4 D Dsus2', { repeat: 2, rhythm: 'h h' }),
        strum('A Asus4 A Asus2', { repeat: 2, rhythm: 'h h', mode: 'tempo', tempo: 72 }),
      ]),
      lesson('gc8-4', 'The G family', 'practice', 'Cadd9, Dsus4 and Em7 around a G.', [
        chordTip('Shared fingers', 'Play G with fingers 3 and 4 on the 3rd fret of the B and high E strings, and keep them planted: Cadd9, Dsus4 and Em7 only move the fingers underneath. Four chords that flow into each other.', 'G:320033:210034 Cadd9:x32033:x21034 Dsus4:xx0233:xx0134 Em7:022033:012034'),
        strum('G:320033:210034 Cadd9:x32033:x21034 Dsus4:xx0233:xx0134 Em7:022033:012034', { repeat: 2 }),
        strum('G:320033:210034 Cadd9:x32033:x21034 Dsus4:xx0233:xx0134 Em7:022033:012034', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 80 }),
      ]),
      lesson('gc8-c', 'Final checkpoint', 'checkpoint', 'Everything from first chords to colour chords.', [
        chordQuiz('Cmaj7 Fmaj7 Am7 Dm7 Em7 Dsus4 Asus2 Cadd9', 10),
        chordQuiz('G C D Em Am F Bm B7', 6, { reverse: true }),
        strum('Cmaj7 Am7 Dm7 G7', { repeat: 2, rhythm: 'q q q q', mode: 'tempo', tempo: 84 }),
      ]),
    ]),
  ],
};
