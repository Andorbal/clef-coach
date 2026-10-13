import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, RhythmCell, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Ukulele · Treble clef. Ukulele music SOUNDS AS WRITTEN (no octave transposition).
 * Standard re-entrant tuning, strings numbered from the floor: 1 = A4, 2 = E4, 3 = C4,
 * 4 = G4 (the high G). First position covers C4–C5; the A string climbs to A5 at the
 * 12th fret. Low-G players have G3 on string 4 — every note here is still playable.
 */
const T = 'treble' as const;

/** A fretboard location for `meet`: string (1 = A, 2 = E, 3 = C, 4 = high G), fret, left-hand finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- First-position pitch pools (sounding = written) ----
const OPEN = 'C4 E4 G4 A4';
const CDE = 'C4 D4 E4';
const CDEG = 'C4 D4 E4 G4';
const C_TO_F = 'C4 D4 E4 F4';
const C_TO_G = 'C4 D4 E4 F4 G4';
const POS1 = 'C4 D4 E4 F4 G4 A4 B4 C5';
const POS1_F = 'C4 D4 E4 F4 G4 A4 Bb4 C5';
const POS1_G = 'C4 D4 E4 F#4 G4 A4 B4 C5';
const POS1_AM = 'C4 D4 E4 F4 G#4 A4 B4 C5';
const POS1_DM = 'C#4 D4 E4 F4 G4 A4 Bb4';
const CHROMATIC = 'C4 C#4 D4 Eb4 E4 F4 F#4 G4 G#4 A4 Bb4 B4 C5';
// ---- Up the neck ----
// 5th position: finger 1 lies across fret 5 (F on the C string, A on the E string, C on the G string,
// D on the A string). B4 and E4 are left out of generated 5th-position reading: they would pull the
// index finger back to the 4th fret.
const POS5 = 'F4 G4 A4 C5 D5 E5 F5';
const POS7 = 'G4 A4 B4 C5 D5 E5 F5 G5';
const POS7_G = 'G4 A4 B4 C5 D5 E5 F#5 G5';
const TOP = 'C5 D5 E5 F5 G5 A5'; // 10th position on the A and E strings
const FULL = 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5';

// ---- Rhythm vocabularies for this track ----
/** Island-strum syncopation, without sixteenths. */
const SYNC: Record<RhythmCell, number> = { q: 2, 'e e': 2, 'e q e': 1.5, 'q. e': 1 };

// ---- Inline notation helpers ----
function upiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: T, voices }], o);
}

// ---- Études and studies (every string choice that matters is written out: @finger %string) ----
const TIES = 'C4/q E4 G4 A4~ | A4/q G4 E4 G4 | F4/h A4/h~ | A4/q F4 D4 E4 | C4/q E4 G4 C5~ | C5/q A4 B4 G4 | C5/w |';
const TWO_STEP = 'C4/e D4 E4 F4 G4/q G4 | A4/e G4 F4 E4 F4/q D4 | E4/e F4 G4 A4 G4/q E4 | D4/e E4 F4 D4 C4/h | G4/e A4 B4 C5 B4/q G4 | A4/e G4 F4 E4 D4/q G4 | E4/e G4 F4 D4 E4/q D4 | C4/w |';
const ISLAND_STRUM = 'C4/e E4/q G4/e A4/q G4 | E4/e G4/q E4/e C4/h | D4/e F4/q A4/e G4/q F4 | E4/w | C4/e E4/q G4/e C5/q B4 | A4/e G4/q E4/e F4/q D4 | E4/q. D4/e E4/q D4 | C4/w |';
const SHIFT_UP = 'C5/q@3%1 B4@2%1 A4@0%1 B4@2%1 | C5@3%1 A4@0%1 D5@1%1 E5@3%1 | F5@4%1 E5@3%1 D5@1%1 C5@4%2 | B4/q@3%2 A4@1%2 D5/h@1%1 | E5/q@1%1 F5@2%1 G5@4%1 F5@2%1 | D5@4%2 C5@2%2 B4@1%2 E5@1%1 | G5@1%1 A5@3%1 G5@1%1 E5@1%1 | D5/q@4%2 B4@1%2 C5/h@2%2 |';
const CHROMATIC_CLIMB = 'C4/e@0%3 C#4@1%3 D4@2%3 D#4@3%3 E4@0%2 F4@1%2 F#4@2%2 G4@3%2 | G#4/e@4%2 A4@0%1 A#4@1%1 B4@2%1 C5/h@3%1 | C5/e@3%1 B4@2%1 Bb4@1%1 A4@0%1 Ab4@4%2 G4@3%2 Gb4@2%2 F4@1%2 | E4/e@0%2 Eb4@3%3 D4@2%3 Db4@1%3 C4/h@0%3 |';
const CHROMATIC_STROLL = 'C4/q E4 G4 G#4 | A4/h G4/h | F4/q F#4 G4 A4 | G4/w | E4/q D#4 E4 G4 | C5/q B4 Bb4 A4 | G4/q F#4 F4 D4 | C4/w |';
const NEIGHBOURS = 'E4/q D#4 E4 | G4/h F#4/q | G4/q A4 G#4 | A4/h. | C5/q B4 C5 | A4/h G#4/q | A4/q F4 D4 | E4/h. | E4/q F4 F#4 | G4/h A4/q | Bb4/q A4 G4 | F4/h E4/q | D4/q C#4 D4 | A4/h G4/q | F4/q E4 D4 | C4/h. |';
const G_STRING_TUNE = 'C4/q@0%3 E4@0%2 G4@0%4 A4@2%4 | G4/h@0%4 E4/h@0%2 | D4/q@2%3 F4@1%2 A4@2%4 B4@4%4 | A4/h@2%4 G4/h@0%4 | E4/q@0%2 G4@0%4 B4@4%4 A4@2%4 | G4/q@0%4 E4@0%2 C4@0%3 E4@0%2 | D4/q@2%3 G4@0%4 F4@1%2 D4@2%3 | C4/w@0%3 |';
const CAMPANELLA_THIRDS = 'C4/e@0%3 E4@0%2 D4@2%3 F4@1%2 E4@4%3 G4@0%4 F4@1%2 A4@0%1 | G4/e@0%4 B4@2%1 A4@1%4 C5@3%1 B4/h@4%4 | C5/e@3%1 A4@1%4 B4@2%1 G4@0%4 A4@0%1 F4@1%2 G4@0%4 E4@0%2 | F4/e@1%2 D4@2%3 E4@0%2 C4@0%3 [C4 E4 G4 C5]/h@0,0,0,3%3,2,4,1 |';
const THIRDS_SIXTHS = '[C4 E4]/q [D4 F4] [E4 G4] [F4 A4]@1,0%2,1 | [G4 B4]/h [E4 G4]/h | [C4 A4]/q [D4 B4]@2,3%3,1 [E4 C5]@0,3%2,1 [D4 B4]@2,3%3,1 | [C4 A4]/h [E4 G4]/h | [F4 A4]/q@1,0%2,1 [E4 G4] [D4 F4] [G4 B4] | [E4 C5]/h@0,3%2,1 [C4 A4]/h | [D4 F4]/q [F4 A4]@1,0%2,1 [D4 B4]@2,3%3,1 [F4 B4]@1,2%2,1 | [E4 C5]/w@0,3%2,1 |';
/**
 * Ode to Joy in G as chord-melody, in 2nd position (finger 1 lies across fret 2): the tune on
 * top, a G or D chord shape underneath on the strong beats.
 */
const ODE_PHRASE =
  '[D4 G4 B4]/q@1,0,1%3,4,1 B4@1%1 C5@2%1 [B4 D5]@3,4%4,1 | [F#4 A4 D5]@1,1,4%2,4,1 C5@2%1 B4@1%1 [F#4 A4]@1,0%2,1 | ' +
  '[D4 G4]@1,0%3,4 G4@0%4 A4@0%1 [D4 G4 B4]@1,0,1%3,4,1 | ';
const ODE_CHORD_MELODY =
  ODE_PHRASE + '[D4 G4 B4]/q.@1,0,1%3,4,1 A4/e@0%1 [F#4 A4]/h@1,0%2,1 | ' +
  ODE_PHRASE + '[F#4 A4]/q.@1,0%2,1 G4/e@0%4 [D4 G4]/h@1,0%3,4 |';

export const ukuleleTreble: TrackDef = {
  id: 'ukulele-treble',
  instrument: 'ukulele',
  title: 'Treble Clef',
  subtitle: 'Ukulele · Reading melodies',
  description: 'Read real ukulele music in the treble clef, from the four open strings to high A at the 12th fret: first position, rhythm, the keys of C, F and G, minor keys, positions up the neck, campanella, double stops and chord-melody.',
  clef: 'treble',
  accent: '#ff7eb6',
  glyph: '𝄞',
  heatmap: [{ clef: 'treble', low: 'C4', high: 'A5' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('ut1', 'The Open Strings', 'G, C, E and A, the re-entrant high G, and your first tune.', [
      lesson('ut1-1', 'Open C and E', 'learn', 'Read your first two notes', [
        meet(T, 'C4', { frets: [at(3, 0, 0)], tips: ['The open 3rd string is middle C. It sits on its own ledger line below the staff, and it is the lowest note on a standard ukulele.'] }),
        meet(T, 'E4', { frets: [at(2, 0, 0)], tips: ['The open 2nd string is E, on the bottom line of the staff.'] }),
        name(T, 'C4 E4', 8),
        play(T, 'C4 E4', 8, { hints: true }),
      ], [
        insight('Ukulele music sounds as written', 'Ukulele music uses the ordinary treble clef, and unlike guitar music it sounds exactly where it is written. Middle C, on the ledger line below the staff, is your open 3rd string.', { kind: 'staff', clef: 'treble', notes: ['C4', 'E4', 'G4', 'A4'], labels: true }),
        insight('Strings are numbered from the floor', 'Hold the uke with the neck to your left (if you are right-handed). The string nearest the floor is string 1, A; the one nearest your face is string 4, G. Pluck with the pad of your thumb or the tip of your index finger, where the neck meets the body.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'G' }, { string: 3, fret: 0, label: 'C' }, { string: 2, fret: 0, label: 'E' }, { string: 1, fret: 0, label: 'A' }], maxFret: 4 }),
      ]),
      lesson('ut1-2', 'Open G and A', 'learn', 'The high G string and the A string', [
        meet(T, 'G4', { frets: [at(4, 0, 0)], tips: ['The open 4th string is G, on the second line (the line the treble clef curls around). It sounds higher than the C and E strings next to it.'] }),
        meet(T, 'A4', { frets: [at(1, 0, 0)], tips: ['The open 1st string is A, in the second space of the staff.'] }),
        name(T, OPEN, 10),
        play(T, OPEN, 10, { hints: true }),
      ], [
        insight('The re-entrant G', 'Your 4th string is tuned to the G above middle C, higher than the C and E strings beside it. This “re-entrant” tuning gives the ukulele its bright, bell-like sound. Sing the open strings from 4 to 1: G C E A, “my dog has fleas”.', { kind: 'staff', clef: 'treble', notes: ['G4', 'C4', 'E4', 'A4'], labels: true }),
        insight('Low-G ukuleles', 'Some players string the 4th string an octave lower (low G, G3). Everything in this track still works: the notes on the staff are the same, and Clef Coach supports low-G tuning too. Only the campanella tricks in unit 11 need the high G.'),
      ]),
      lesson('ut1-3', 'Open-String Melodies', 'practice', 'Read tunes on the four open strings', [
        tip('Counting beats', 'A quarter note lasts one beat; a half note lasts two. In 4/4 there are four beats in every bar: count “1 2 3 4” out loud as you play.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'E4/q', 'G4/h', 'A4/h', 'G4/h'], time: [4, 4] }),
        read(T, OPEN, { rhythms: RH.quarters, maxLeap: 4, leapiness: 0.8, measures: 2, noteNames: true, title: 'Your first melody' }),
        read(T, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8 }),
        name(T, OPEN, 12, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('ut1-4', 'My Dog Has Fleas', 'song', 'Your first tune: open strings only', [
        piece('uke-my-dog-has-fleas'),
        read(T, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8, fingering: 'first' }),
      ], [
        insight('Strum the open strings', 'Brush your index finger down across all four open strings: that is a C6 chord, the classic ukulele sound. Notes on the staff are played one at a time; the chord symbols above a song tell you what to strum when you accompany someone.'),
      ]),
      lesson('ut1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Name and play G, C, E and A', [
        name(T, OPEN, 12),
        play(T, OPEN, 8),
        read(T, OPEN, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.8, fingering: 'first' }),
      ]),
    ], ['G C E A', 'Re-entrant tuning', 'Quarter & half notes']),

    // ------------------------------------------------------------------ 2
    unit('ut2', 'The C String', 'D on the 2nd fret, and quarter, half and whole notes.', [
      lesson('ut2-1', 'D on the Second Fret', 'learn', 'Your first fretted note', [
        meet(T, 'D4', { frets: [at(3, 2, 2)], tips: ['D hangs just below the staff. Press the C string at the 2nd fret with finger 2.'] }),
        name(T, CDE, 9),
        play(T, CDE, 9, { hints: true }),
        read(T, CDE, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true }),
      ], [
        insight('Left-hand fingers', 'Index = 1, middle = 2, ring = 3, pinky = 4, and 0 means an open string. In first position each finger looks after one fret: finger 1 at fret 1, finger 2 at fret 2, and so on. Press with the fingertip just behind the fret wire.', { kind: 'frets', positions: [{ string: 3, fret: 1, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 3, fret: 3, finger: 3 }, { string: 3, fret: 4, finger: 4 }], maxFret: 5 }),
      ]),
      lesson('ut2-2', 'Counting Time', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'In 4/4 a quarter note lasts 1 beat, a half note 2 and a whole note 4. Keep your foot tapping and let long notes ring for their full value.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'D4/q', 'E4/h', 'C4/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(T, CDE, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 63 }),
        read(T, CDEG, { rhythms: RH.qh, maxLeap: 2, leapiness: 0.5 }),
      ]),
      lesson('ut2-3', 'Mary Had a Little Lamb', 'song', 'Your first real song', [
        piece('uke-mary-had-a-little-lamb'),
        read(T, CDEG, { rhythms: RH.qhw, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('ut2-c', 'Checkpoint: The C String', 'checkpoint', 'C, D, E and G in time', [
        name(T, 'C4 D4 E4 G4 A4', 12),
        play(T, CDEG, 8),
        read(T, CDEG, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['D', 'Finger numbers', 'Whole notes']),

    // ------------------------------------------------------------------ 3
    unit('ut3', 'The E String', 'F and G on the 2nd string, rests, and your first classics.', [
      lesson('ut3-1', 'F on the First Fret', 'learn', 'C, D, E and F in a row', [
        meet(T, 'F4', { frets: [at(2, 1, 1)], tips: ['F sits in the first space. Finger 1 presses the E string at the 1st fret.'] }),
        name(T, C_TO_F, 10),
        play(T, 'D4 E4 F4', 9, { hints: true }),
        read(T, C_TO_F, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
      ], [
        insight('Step by step', 'C, D, E and F are neighbours on the staff: line, space, line, space. On the uke that is open C, D at fret 2, open E and F at fret 1. Each step on the staff is the next letter of the musical alphabet.', { kind: 'staff+frets', clef: 'treble', notes: ['C4', 'D4', 'E4', 'F4'], positions: [{ string: 3, fret: 0 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 0 }, { string: 2, fret: 1, finger: 1 }] }),
      ]),
      lesson('ut3-2', 'G on the Third Fret', 'learn', 'Two places to play G', [
        meet(T, 'G4 G4', { frets: [at(2, 3, 3), at(4, 0, 0)], tips: ['G on the E string: finger 3 at the 3rd fret.', 'The very same G is your open 4th string. Ukulele players use both: pick whichever keeps the melody smooth.'] }),
        name(T, C_TO_G, 12),
        play(T, C_TO_G, 10, { hints: true }),
        read(T, C_TO_G, { rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Same note, two places', 'The 3rd fret of the E string sounds exactly like the open G string. That happens all over a fretted instrument, and the re-entrant G makes it especially handy on the uke.', { kind: 'frets', positions: [{ string: 2, fret: 3, finger: 3, label: 'G' }, { string: 4, fret: 0, label: 'G' }], maxFret: 5 }),
      ]),
      lesson('ut3-3', 'Rests', 'learn', 'Counted silence on a ringing instrument', [
        tip('Stopping the sound', 'A rest is counted silence, but ukulele strings keep ringing. To stop a fretted note, relax the finger so it still touches the string. To stop an open string, touch it lightly with your thumb or fingertip.', { kind: 'staff', clef: 'treble', notes: ['E4/q', 'r/q', 'G4/q', 'r/q', 'F4/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(T, C_TO_G, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('ut3-4', 'First Classics', 'song', 'Beethoven and a German folk song', [
        piece('uke-ode-to-joy'),
        piece('uke-lightly-row'),
      ]),
      lesson('ut3-c', 'Checkpoint: The E String', 'checkpoint', 'C to G on sight', [
        name(T, C_TO_G, 14),
        play(T, C_TO_G, 10),
        read(T, C_TO_G, { rhythms: RH.rests, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['F G', 'Unisons', 'Rests']),

    // ------------------------------------------------------------------ 4
    unit('ut4', 'The A String', 'B and C on the 1st string: a full octave in first position, and 3/4 time.', [
      lesson('ut4-1', 'B and C on the A String', 'learn', 'Into the top half of the staff', [
        meet(T, 'A4 B4 C5', {
          frets: [at(1, 0, 0), at(1, 2, 2), at(1, 3, 3)],
          tips: ['A, the open 1st string, sits in the second space.', 'B is the middle line: finger 2 at the 2nd fret of the A string.', 'C is in the third space: finger 3 at the 3rd fret.'],
        }),
        name(T, 'G4 A4 B4 C5', 10),
        play(T, 'A4 B4 C5', 9, { hints: true }),
        read(T, 'G4 A4 B4 C5', { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
      ], [
        insight('The same fingers on every string', 'On the A string, B and C use fingers 2 and 3 at frets 2 and 3, just like D on the C string and G on the E string. One finger per fret, always.', { kind: 'staff+frets', clef: 'treble', notes: ['A4', 'B4', 'C5'], positions: [{ string: 1, fret: 0 }, { string: 1, fret: 2, finger: 2 }, { string: 1, fret: 3, finger: 3 }] }),
      ]),
      lesson('ut4-2', 'The First-Position Octave', 'learn', 'Every note from C to C', [
        tip('First position', 'Eight notes, four strings, three frets: C and D on the C string, E F G on the E string, A B C on the A string, and the open G string as a bonus.', {
          kind: 'frets',
          positions: [
            { string: 3, fret: 0, label: 'C' }, { string: 3, fret: 2, finger: 2, label: 'D' },
            { string: 2, fret: 0, label: 'E' }, { string: 2, fret: 1, finger: 1, label: 'F' }, { string: 2, fret: 3, finger: 3, label: 'G' },
            { string: 4, fret: 0, label: 'G' },
            { string: 1, fret: 0, label: 'A' }, { string: 1, fret: 2, finger: 2, label: 'B' }, { string: 1, fret: 3, finger: 3, label: 'C' },
          ],
          maxFret: 5,
        }),
        name(T, POS1, 16, { sequence: true, title: 'Note rush' }),
        play(T, POS1, 12),
        read(T, POS1, { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('ut4-3', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats, because a dot adds half of the note’s value.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'E4/q', 'G4/q', 'A4/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(T, POS1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('ut4-4', 'Twinkle & Island Waltz', 'song', 'A nursery classic and a waltz across all four strings', [
        piece('uke-twinkle'),
        piece('uke-island-waltz'),
      ]),
      lesson('ut4-c', 'Checkpoint: First Position', 'checkpoint', 'Every note from C4 to C5', [
        name(T, POS1, 16),
        play(T, POS1, 12),
        read(T, POS1, { rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
        read(T, POS1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['A B C', 'First position', '3/4 time']),

    // ------------------------------------------------------------------ 5
    unit('ut5', 'Melodies in C', 'The C major scale, steps and leaps, eighth notes, pickups and ties.', [
      lesson('ut5-1', 'The C Major Scale', 'learn', 'Climb the octave; read steps and leaps', [
        scale('C', 'major', 'R', { octave: 4, clef: T }),
        scale('C', 'major', 'R', { octave: 4, clef: T, mode: 'tempo', tempo: 72 }),
        interval(T, POS1, [2, 3, 4, 5], 10),
        read(T, POS1, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.5 }),
      ], [
        insight('Steps, skips and leaps', 'Line to the next space is a step (a 2nd). Line to the next line skips a note (a 3rd). Bigger jumps are leaps: a 4th, a 5th. Read the distance, not every letter; your hand soon knows the shapes.', { kind: 'staff', clef: 'treble', notes: ['C4', 'D4', 'E4', 'G4', 'C5'], labels: true }),
      ]),
      lesson('ut5-2', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighth notes', 'An eighth note lasts half a beat, and pairs are joined by a beam. Count “1 & 2 &”. One easy way to keep them even: thumb down on the beat, index finger on the “&”.', { kind: 'staff', clef: 'treble', notes: ['E4/e', 'F4/e', 'G4/q', 'G4/e', 'F4/e', 'E4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(T, C_TO_G, { rhythms: RH.eighths, maxLeap: 1 }),
        read(T, POS1, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('ut5-3', 'Pickups & Ties', 'learn', 'Notes that lead in and notes that hold over', [
        tip('Pickups and ties', 'A pickup is a short first bar that leads into beat one: count the missing beats before you start. A tie joins two notes of the same pitch: pluck once and let it ring through both.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'E4/q', 'G4/h~', 'G4/h', 'E4/h'], time: [4, 4] }),
        upiece('Ties Across the Bar', 'C', [4, 4], [TIES]),
        piece('uke-when-the-saints'),
      ]),
      lesson('ut5-4', 'Eighth-Note Tunes', 'song', 'A nursery rhyme and a two-step', [
        piece('uke-hot-cross-buns'),
        upiece('Ukulele Two-Step', 'C', [4, 4], [TWO_STEP]),
        read(T, POS1, { rhythms: RH.eighthsRests, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
      lesson('ut5-c', 'Checkpoint: Melodies in C', 'checkpoint', 'Eighths and leaps in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        read(T, POS1, { rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(T, POS1, { rhythms: RH.eighthsRests, maxLeap: 4, leapiness: 0.4, fingering: 'none' }),
      ]),
    ], ['C major scale', 'Eighth notes', 'Pickups & ties']),

    // ------------------------------------------------------------------ 6
    unit('ut6', 'Dotted Rhythms & Six-Eight', 'Long–short rhythms, compound time, syncopation and toe-tapping folk songs.', [
      lesson('ut6-1', 'The Dotted Quarter', 'learn', 'Long–short: dotted quarter + eighth', [
        tip('The dot', 'A dotted quarter lasts 1½ beats and is usually followed by an eighth: count “1 – & 2”. You already played it in bar 4 of Ode to Joy.', { kind: 'staff', clef: 'treble', notes: ['E4/q.', 'D4/e', 'D4/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(T, POS1, { rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 63 }),
        piece('uke-jingle-bells'),
      ]),
      lesson('ut6-2', 'Oh! Susanna', 'song', 'Foster’s banjo song on the uke', [
        piece('uke-oh-susanna'),
        read(T, POS1, { rhythms: RH.dottedRests, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('ut6-3', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighth notes per bar, grouped in two sets of three: “ONE two three FOUR five six”. It sways like a boat. Feel two big beats, not six small ones.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'D4/e', 'E4/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(T, POS1, { time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
        piece('uke-row-your-boat'),
      ]),
      lesson('ut6-4', 'Syncopation', 'learn', 'The island strum: accents between the beats', [
        tip('Off the beat', 'Syncopation puts a long note between the beats: eighth–quarter–eighth, counted “1 & – 2 &”, is the rhythm of the classic island strum. Keep counting steadily and let the quarter ride across the beat.', { kind: 'staff', clef: 'treble', notes: ['C4/e', 'E4/q', 'G4/e', 'A4/h'], time: [4, 4] }),
        rhythm([4, 4], SYNC, { tempo: 66 }),
        upiece('Island Strum', 'C', [4, 4], [ISLAND_STRUM]),
        read(T, POS1, { rhythms: SYNC, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('ut6-c', 'Checkpoint: Rhythm', 'checkpoint', 'Dotted, compound and syncopated rhythms', [
        rhythm([6, 8], RH.compound, { tempo: 66, reps: 1 }),
        read(T, POS1, { rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(T, POS1, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
        read(T, POS1, { rhythms: SYNC, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', '6/8', 'Syncopation']),

    // ------------------------------------------------------------------ 7
    unit('ut7', 'F Major & G Major', 'B♭ and F♯, key signatures, and songs in the ukulele’s favourite keys.', [
      lesson('ut7-1', 'B Flat & the Key of F', 'learn', 'One flat', [
        meet(T, 'Bb4 Bb4', { frets: [at(1, 1, 1), at(4, 3, 3)], tips: ['B♭ on the A string: finger 1 at the 1st fret, one fret below B.', 'The same B♭ on the G string, 3rd fret, finger 3. Handy when the melody sits on the G string.'] }),
        keysig(T, 'C F', 6),
        read(T, POS1_F, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
        piece('uke-yankee-doodle'),
      ], [
        insight('Flats and sharps on the uke', 'A flat (♭) lowers a note by one fret; a sharp (♯) raises it by one fret. B is the 2nd fret of the A string, so B♭ is the 1st.', { kind: 'frets', positions: [{ string: 1, fret: 1, finger: 1, label: 'B♭' }, { string: 1, fret: 2, finger: 2, label: 'B' }, { string: 1, fret: 3, finger: 3, label: 'C' }], maxFret: 5 }),
        insight('The key of F', 'F major has one flat in its key signature, on the middle line: every B becomes B♭ unless a natural sign cancels it. F, B♭ and C7 are friendly chords on the uke, so F is a favourite ukulele key.', { kind: 'staff', clef: 'treble', notes: ['F4', 'Bb4'], key: 'F' }),
      ]),
      lesson('ut7-2', 'F Sharp & the Key of G', 'learn', 'One sharp', [
        meet(T, 'F#4', { frets: [at(2, 2, 2)], tips: ['F♯ on the E string: finger 2 at the 2nd fret, one fret above F.'] }),
        keysig(T, 'C F G', 8),
        read(T, POS1_G, { key: 'G', rhythms: RH.qh, maxLeap: 2 }),
        read(T, POS1_G, { key: 'G', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('The key of G', 'G major has one sharp, on the top line: every F becomes F♯. On the uke the open G string is the home note, and G, C and D7 are the three chords of the key.', { kind: 'staff', clef: 'treble', notes: ['G4', 'F#4'], key: 'G' }),
      ]),
      lesson('ut7-3', 'Songs in F and G', 'song', 'A hymn in 3/4 and a parlour song', [
        piece('uke-amazing-grace'),
        piece('uke-aura-lee'),
      ]),
      lesson('ut7-4', 'Reading in Three Keys', 'practice', 'Switch between C, F and G', [
        keysig(T, 'C F G', 9),
        read(T, POS1_F, { key: 'F', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
        read(T, POS1_G, { key: 'G', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        interval(T, POS1_F, [3, 4, 5, 6], 10, { key: 'F' }),
      ]),
      lesson('ut7-c', 'Checkpoint: F and G Major', 'checkpoint', 'Read with key signatures', [
        keysig(T, 'C F G', 8),
        read(T, POS1_F, { key: 'F', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, POS1_G, { key: 'G', rhythms: RH.dottedRests, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['B♭ and F♯', 'Keys of F and G', 'Key signatures']),

    // ------------------------------------------------------------------ 8
    unit('ut8', 'Up the A String', 'Ledger lines above the staff, 5th and 7th position, and high A at the 12th fret.', [
      lesson('ut8-1', 'D, E and F Up High', 'learn', 'Fifth position on the A string', [
        meet(T, 'D5 E5 F5', {
          frets: [at(1, 5, 1), at(1, 7, 3), at(1, 8, 4)],
          tips: [
            'D sits on the 4th line: A string, 5th fret. You can stretch finger 4 up from first position, or slide your hand up so finger 1 rests on fret 5 (5th position).',
            'E in the top space: 7th fret, finger 3 in 5th position.',
            'F on the top line: 8th fret, finger 4.',
          ],
        }),
        name(T, 'A4 B4 C5 D5 E5 F5', 12),
        play(T, 'C5 D5 E5 F5', 8, { hints: true }),
        read(T, 'A4 C5 D5 E5 F5', { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('What is a position?', 'A position is named after the fret under finger 1. In 5th position finger 1 sits at fret 5 and finger 4 at fret 8: one finger per fret, exactly like first position, just further up the neck.', { kind: 'frets', positions: [{ string: 1, fret: 5, finger: 1, label: 'D' }, { string: 1, fret: 7, finger: 3, label: 'E' }, { string: 1, fret: 8, finger: 4, label: 'F' }, { string: 2, fret: 5, finger: 1, label: 'A' }, { string: 4, fret: 5, finger: 1, label: 'C' }, { string: 3, fret: 5, finger: 1, label: 'F' }, { string: 3, fret: 7, finger: 3, label: 'G' }], minFret: 3, maxFret: 10 }),
        insight('Unisons up the neck', 'The 5th fret of the E string is the same A as the open A string, and the 5th fret of the high G string is the same C as the A string’s 3rd fret. In 5th position finger 1 lies across fret 5 and covers F, A, C and D without moving.', { kind: 'frets', positions: [{ string: 2, fret: 5, finger: 1, label: 'A' }, { string: 1, fret: 0, label: 'A' }, { string: 4, fret: 5, finger: 1, label: 'C' }, { string: 1, fret: 3, finger: 3, label: 'C' }], maxFret: 7 }),
      ]),
      lesson('ut8-2', 'Reading in Fifth Position', 'practice', 'F4 to F5 with the hand at the 5th fret', [
        meet(T, 'F4 G4 A4 C5', {
          frets: [at(3, 5, 1), at(3, 7, 3), at(2, 5, 1), at(4, 5, 1)],
          tips: ['F on the C string, 5th fret, finger 1.', 'G on the C string, 7th fret, finger 3.', 'A on the E string, 5th fret, finger 1: the same pitch as the open A string.', 'C on the re-entrant G string, 5th fret, finger 1: the same pitch as the A string’s 3rd fret. (It also lives on the E string’s 8th fret, finger 4.)'],
        }),
        read(T, POS5, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2 }),
        read(T, POS5, { guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
        scale('F', 'major', 'R', { octave: 4, clef: T, guitarPosition: 5, title: 'F major in 5th position' }),
      ]),
      lesson('ut8-3', 'Seventh Position & High A', 'learn', 'G major up the neck, and shifting to the 12th fret', [
        meet(T, 'G5 A5', { frets: [at(1, 10, 4), at(1, 12, 3)], tips: ['G sits just above the staff: A string, 10th fret. In 7th position finger 1 is at fret 7 (E) and finger 4 reaches G.', 'A on the first ledger line above the staff: 12th fret, the open A an octave higher. Slide finger 1 up to fret 10 and finger 3 lands on it.'] }),
        scale('G', 'major', 'R', { octave: 4, clef: T, guitarPosition: 7, title: 'G major in 7th position' }),
        read(T, POS7_G, { key: 'G', guitarPosition: 7, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        upiece('Shifting Up the A String', 'C', [4, 4], [SHIFT_UP], { prompt: 'First position, then shift to 5th while the open A rings, slide finger 1 up to 7th, and reach high A in 10th position. Follow the finger numbers.' }),
        read(T, TOP, { guitarPosition: 10, rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('How to shift', 'Shift on an open string when you can: the hand moves while the string rings. Otherwise slide lightly along the string with the finger you are on (a guide finger), then press at the new fret.'),
        insight('Ledger lines above', 'High notes climb onto ledger lines above the staff: G just above the top line, A on the first ledger line. On the uke they all live high on the A string.', { kind: 'staff', clef: 'treble', notes: ['F5', 'G5', 'A5'], labels: true }),
      ]),
      lesson('ut8-4', 'Songs up the Neck', 'song', 'Melodies that climb the A string', [
        piece('uke-auld-lang-syne'),
        piece('uke-my-bonnie'),
      ]),
      lesson('ut8-c', 'Checkpoint: Up the Neck', 'checkpoint', 'Read and shift from first position to high A', [
        name(T, FULL, 18, { sequence: true }),
        read(T, POS5, { guitarPosition: 5, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, POS7, { guitarPosition: 7, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['5th & 7th position', 'Ledger lines above', 'Up to A5']),

    // ------------------------------------------------------------------ 9
    unit('ut9', 'Accidentals & Chromatic Notes', 'Every fret has a name: sharps, flats and naturals in first position.', [
      lesson('ut9-1', 'Sharps and Flats', 'learn', 'The notes between the notes', [
        meet(T, 'C#4 Eb4 G#4', {
          frets: [at(3, 1, 1), at(3, 3, 3), at(2, 4, 4)],
          tips: ['C♯ on the C string: 1st fret, finger 1.', 'E♭ on the C string: 3rd fret, finger 3. The same fret could be called D♯: two names, one sound.', 'G♯ on the E string: 4th fret, finger 4. It is also the 1st fret of the G string.'],
        }),
        tip('Accidentals last a bar', 'A sharp, flat or natural written before a note lasts until the next bar line; then the key signature takes over again. A natural sign (♮) cancels a sharp or flat.', { kind: 'staff', clef: 'treble', notes: ['F4/q', 'F#4/q', 'G4/q', 'F4/q'], time: [4, 4] }),
        name(T, CHROMATIC, 14, { answers: 'accidentals' }),
        play(T, CHROMATIC, 12, { hints: true }),
      ], [
        insight('Every fret is a half step', 'From one fret to the next is a half step, the smallest step in Western music. Between C and D there is one fret: C♯ (or D♭). Between E and F, and between B and C, there is none.', { kind: 'frets', positions: [{ string: 3, fret: 0, label: 'C' }, { string: 3, fret: 1, finger: 1, label: 'C♯' }, { string: 3, fret: 2, finger: 2, label: 'D' }, { string: 3, fret: 3, finger: 3, label: 'E♭' }, { string: 2, fret: 0, label: 'E' }, { string: 2, fret: 1, finger: 1, label: 'F' }], maxFret: 5 }),
      ]),
      lesson('ut9-2', 'The Chromatic Scale', 'learn', 'Every fret, finger = fret', [
        tip('Finger = fret', 'In first position the chromatic notes follow one rule: the finger number matches the fret number. Climb the C string to fret 3, the E string to fret 4 and the A string to fret 3. Sharps on the way up, flats on the way down.'),
        upiece('Chromatic Climb', 'C', [4, 4], [CHROMATIC_CLIMB]),
        name(T, CHROMATIC, 16, { answers: 'accidentals', sequence: true, title: 'Note rush' }),
      ]),
      lesson('ut9-3', 'Chromatic Melodies', 'practice', 'Passing notes and neighbour notes', [
        upiece('Chromatic Stroll', 'C', [4, 4], [CHROMATIC_STROLL], { prompt: 'Chromatic passing notes slide between the notes of the key. In bar 7, F♯ then F: the natural cancels the sharp.' }),
        upiece('Neighbour-Note Waltz', 'C', [3, 4], [NEIGHBOURS], { prompt: 'Each sharp or flat leans on a note of the key: up a fret and back, or down a fret and back.' }),
        play(T, CHROMATIC, 12),
      ]),
      lesson('ut9-c', 'Checkpoint: Accidentals', 'checkpoint', 'Name and play every fret in first position', [
        name(T, CHROMATIC, 16, { answers: 'accidentals' }),
        play(T, CHROMATIC, 12),
        upiece('Chromatic Climb', 'C', [4, 4], [CHROMATIC_CLIMB], { mode: 'tempo', tempo: 60, fingering: 'first' }),
      ]),
    ], ['♯ ♭ ♮', 'Chromatic scale', 'Finger = fret']),

    // ------------------------------------------------------------------ 10
    unit('ut10', 'Minor Keys', 'A minor and D minor: relative minors, the raised 7th and the Dorian sound.', [
      lesson('ut10-1', 'A Minor', 'learn', 'The relative minor of C', [
        meet(T, 'G#4', { frets: [at(4, 1, 1)], tips: ['G♯, the leading note of A minor, on the re-entrant G string: 1st fret, finger 1. It is also the 4th fret of the E string.'] }),
        read(T, POS1_AM, { key: 'Am', rhythms: RH.qh, maxLeap: 2 }),
        read(T, POS1_AM, { key: 'Am', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Relative minor', 'A minor uses the same notes and key signature as C major, but its home note is A. Minor tunes often raise the 7th note to lead home: G♯ in A minor, written as an accidental.', { kind: 'staff', clef: 'treble', notes: ['A4', 'B4', 'C5', 'G#4', 'A4'], key: 'Am' }),
      ]),
      lesson('ut10-2', 'D Minor', 'learn', 'One flat, with C♯ leading home', [
        meet(T, 'C#4 C#5', { frets: [at(3, 1, 1), at(1, 4, 4)], tips: ['C♯ on the C string: 1st fret, finger 1. It pulls up to D.', 'High C♯ on the A string: 4th fret, finger 4.'] }),
        keysig(T, 'Am Dm Em', 8),
        scale('D', 'natural-minor', 'R', { octave: 4, clef: T, guitarPosition: 2 }),
        scale('D', 'harmonic-minor', 'R', { octave: 4, clef: T, guitarPosition: 2, mode: 'tempo', tempo: 66 }),
        read(T, POS1_DM, { key: 'Dm', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('D minor', 'D minor shares F major’s key signature, one flat (B♭). Its harmonic form raises the 7th to C♯. Up to D at the 5th fret, put finger 1 at fret 2 (2nd position) so finger 4 lands on the high D.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C#5', 'D5'], key: 'Dm' }),
      ]),
      lesson('ut10-3', 'Dorian Folk Songs', 'song', 'A sea shanty and an English ballad', [
        piece('uke-drunken-sailor'),
        piece('uke-scarborough-fair'),
      ], [
        insight('The Dorian sound', 'Many folk tunes use the Dorian mode: a minor scale with a raised 6th. In D minor that means B♮ instead of B♭, so watch for the natural signs in these two songs.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'], key: 'Dm' }),
      ]),
      lesson('ut10-4', 'Greensleeves', 'song', 'The Tudor ballad, up the neck in A minor', [
        piece('uke-greensleeves'),
        read(T, POS5, { key: 'Am', guitarPosition: 5, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('ut10-c', 'Checkpoint: Minor Keys', 'checkpoint', 'Read in A minor and D minor', [
        keysig(T, 'Am Dm Em', 8),
        read(T, POS1_AM, { key: 'Am', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(T, POS1_DM, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['A minor', 'D minor', 'Dorian']),

    // ------------------------------------------------------------------ 11
    unit('ut11', 'Campanella & the High G', 'Use the re-entrant G string to make notes ring into each other: the ukulele’s own special effect.', [
      lesson('ut11-1', 'Melodies on the G String', 'learn', 'A, B and C on the 4th string', [
        meet(T, 'A4 B4', { frets: [at(4, 2, 2), at(4, 4, 4)], tips: ['A on the G string: 2nd fret, finger 2. The same pitch as the open A string.', 'B on the G string: 4th fret, finger 4. The same pitch as the A string’s 2nd fret.'] }),
        upiece('G-String Melody', 'C', [4, 4], [G_STRING_TUNE], { prompt: 'G, A and B are on the 4th string here: open, finger 2 and finger 4. Let each note ring as long as it can.' }),
        play(T, 'G4 A4 B4 C5', 8, { hints: true }),
      ], [
        insight('Why the G string is special', 'On a guitar each string is lower than the next. On a high-G ukulele the 4th string sits between the E and A strings in pitch, so a melody can hop onto it for G, A and B while the hand hardly moves.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'G' }, { string: 4, fret: 2, finger: 2, label: 'A' }, { string: 4, fret: 4, finger: 4, label: 'B' }, { string: 1, fret: 0, label: 'A' }, { string: 1, fret: 2, finger: 2, label: 'B' }], maxFret: 5 }),
      ]),
      lesson('ut11-2', 'Campanella', 'learn', 'Let every note ring like a bell', [
        tip('Campanella', '“Campanella” means little bell. Play each note on a different string from the one before, so every note keeps ringing under the next. On the uke the high G string makes this easy: hop between it and the A string.', { kind: 'staff+frets', clef: 'treble', notes: ['G4', 'A4', 'B4', 'C5'], positions: [{ string: 4, fret: 0 }, { string: 1, fret: 0 }, { string: 4, fret: 4, finger: 4 }, { string: 1, fret: 3, finger: 3 }] }),
        upiece('Campanella in Thirds', 'C', [4, 4], [CAMPANELLA_THIRDS], { prompt: 'Follow the string numbers: no two notes in a row share a string, so they ring into each other.' }),
        upiece('Campanella in Thirds', 'C', [4, 4], [CAMPANELLA_THIRDS], { mode: 'tempo', tempo: 60, fingering: 'first' }),
      ], [
        insight('High G only', 'Campanella needs the re-entrant G string. On a low-G ukulele, the G-string notes in this unit sit an octave lower, so play them on the E or A strings instead and enjoy the melody without the bells.'),
      ]),
      lesson('ut11-3', 'Campanella Waltz', 'song', 'Arpeggios that ring like a harp', [
        piece('uke-campanella-waltz'),
        upiece('G-String Melody', 'C', [4, 4], [G_STRING_TUNE], { mode: 'tempo', tempo: 76, fingering: 'first' }),
      ], [
        insight('Hold the shape', 'In the waltz each bar is a chord shape: C, G7, A minor or F. Put the whole shape down at the start of the bar and keep it there, so every note rings into the next.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'G' }, { string: 3, fret: 2, finger: 2, label: 'D' }, { string: 2, fret: 1, finger: 1, label: 'F' }, { string: 1, fret: 2, finger: 3, label: 'B' }], maxFret: 5 }),
      ]),
      lesson('ut11-c', 'Checkpoint: Campanella', 'checkpoint', 'Ringing melodies in time', [
        play(T, 'G4 A4 B4 C5', 8),
        upiece('Campanella in Thirds', 'C', [4, 4], [CAMPANELLA_THIRDS], { mode: 'tempo', tempo: 72, fingering: 'first' }),
        piece('uke-campanella-waltz', { mode: 'tempo', fingering: 'first' }),
      ]),
    ], ['High-G melodies', 'Campanella', 'Chord shapes']),

    // ------------------------------------------------------------------ 12
    unit('ut12', 'Double Stops & Chord-Melody', 'Two notes at once, a melody over chord shapes, and a final songbook.', [
      lesson('ut12-1', 'Double Stops', 'learn', 'Two strings at once: thirds and sixths', [
        interval(T, POS1, [3, 6], 10, { harmonic: true }),
        upiece('Thirds and Sixths', 'C', [4, 4], [THIRDS_SIXTHS]),
        read(T, POS1, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.4, intervals: [3] } }),
      ], [
        insight('Reading stacked notes', 'Two notes stacked on the staff sound together. Read the bottom note, then the gap: line–line or space–space is a 3rd; a 6th is much wider. Pinch both strings at once with thumb and index finger.', { kind: 'staff+frets', clef: 'treble', notes: ['[C4 E4]/w'], positions: [{ string: 3, fret: 0 }, { string: 2, fret: 0 }] }),
      ]),
      lesson('ut12-2', 'Chord-Melody', 'learn', 'The tune on top, a chord shape underneath', [
        upiece('Ode to Joy (chord-melody)', 'G', [4, 4], [ODE_CHORD_MELODY], { prompt: 'Second position: finger 1 lies across the 2nd fret. The melody is always the highest note, so finger the whole chord and let the top note sing out.' }),
        read(T, POS1, { rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.5, intervals: [3] }, fingering: 'first' }),
      ], [
        insight('Chord-melody', 'In chord-melody playing the tune is the top note and a chord shape fills in underneath. With re-entrant tuning, many chord shapes have their melody note on the A string, like this C chord with C on top.', { kind: 'staff+frets', clef: 'treble', notes: ['[C4 E4 G4 C5]/w'], positions: [{ string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 3, finger: 3 }] }),
      ]),
      lesson('ut12-3', 'Final Songbook', 'song', 'A carol in 6/8 and a serenade in double stops', [
        piece('uke-silent-night'),
        piece('uke-double-stop-serenade'),
      ]),
      lesson('ut12-4', 'Speed Reading', 'challenge', 'Sight-read at tempo, anywhere on the neck', [
        name(T, FULL, 30, { sequence: true, title: 'Lightning round' }),
        read(T, POS1, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        read(T, POS5, { guitarPosition: 5, rhythms: SYNC, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 69, fingering: 'none' }),
      ]),
      lesson('ut12-c', 'Final Exam: Ukulele Treble Clef', 'checkpoint', 'Prove your mastery', [
        name(T, FULL, 30, { sequence: true }),
        keysig(T, 'F G Am', 9),
        read(T, POS1, { rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, dyads: { chance: 0.25, intervals: [3] }, mode: 'tempo', tempo: 72, fingering: 'none', measures: 6 }),
        read(T, POS7_G, { key: 'G', guitarPosition: 7, time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
        read(T, POS1_DM, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Double stops', 'Chord-melody', 'Sight-reading']),
  ],
};
