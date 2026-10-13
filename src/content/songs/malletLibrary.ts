/**
 * Mallet percussion song library (marimba, xylophone, glockenspiel, vibraphone):
 * public-domain melodies (arranged) and Clef Coach originals.
 *
 * Pitches are WRITTEN pitch, exactly as a percussionist reads them (the marimba's
 * sounding pitch); the app transposes for xylophone and glockenspiel. Sticking that
 * isn't written here is filled in by the sticking engine when a song is loaded.
 *
 *  - Two-mallet songs: one treble staff, kept within G3–C6 so they fit every
 *    instrument, glockenspiel included.
 *  - Four-mallet songs: Stevens numbering (1-2 left hand, 3-4 right hand). Either one
 *    treble staff of chords (fits xylophone and vibraphone too) or a grand staff with
 *    the right hand on the treble staff and the left hand on the bass staff (the low
 *    notes need a marimba).
 */
import type { SongDef } from '../../music/parse';

type Time = [number, number];
const TRAD = 'Traditional';
const ORIGINAL = 'Clef Coach Original';

interface Extra {
  pickup?: string;
  chords?: string;
  arranger?: string;
}

/** A two-mallet melody on the treble staff. */
function two(id: string, title: string, composer: string, year: string | undefined, level: number, key: string, time: Time, tempo: number, voice: string, blurb: string, x: Extra = {}): SongDef {
  return { id, title, composer, year, instrument: 'mallets', mallets: 2, level, key, time, tempo, blurb, ...x, staves: [{ clef: 'treble', voices: [voice] }] };
}

/** A four-mallet piece on one treble staff (chords of two to four notes). */
function fourTreble(id: string, title: string, composer: string, year: string | undefined, level: number, key: string, time: Time, tempo: number, voice: string, blurb: string, x: Extra = {}): SongDef {
  return { id, title, composer, year, instrument: 'mallets', mallets: 4, level, key, time, tempo, blurb, ...x, staves: [{ clef: 'treble', voices: [voice] }] };
}

/** A four-mallet piece on the grand staff: right hand (mallets 3-4) on top, left hand (mallets 1-2) below. */
function fourGrand(id: string, title: string, composer: string, year: string | undefined, level: number, key: string, time: Time, tempo: number, right: string, left: string, blurb: string, x: Extra = {}): SongDef {
  return {
    id, title, composer, year, instrument: 'mallets', mallets: 4, level, key, time, tempo, blurb, ...x,
    staves: [
      { clef: 'treble', hand: 'R', voices: [right], name: 'Right hand (3-4)' },
      { clef: 'bass', hand: 'L', voices: [left], name: 'Left hand (1-2)' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Two mallets
// ---------------------------------------------------------------------------

export const MALLETS_TWO: SongDef[] = [
  two(
    'mal-hot-cross-buns', 'Hot Cross Buns', TRAD, TRAD, 1, 'C', [4, 4], 84,
    'E4/q@R D4@L C4/h@R | E4/q@R D4@L C4/h@R | C4/q@R C4@L D4@R D4@L | E4/q@R D4@L C4/h@R |',
    'Three bars, three notes. Start with your right mallet and keep the hands taking turns.',
    { chords: 'C/q G/q C/h | C/q G/q C/h | C/h G/h | C/q G/q C/h |' },
  ),
  two(
    'mal-mary-had-a-little-lamb', 'Mary Had a Little Lamb', 'Lowell Mason (arr.)', '1830', 1, 'C', [4, 4], 88,
    'E4/q@R D4@L C4@R D4@L | E4@R E4@L E4/h@R | D4/q@R D4@L D4/h@R | E4/q@R G4@L G4/h@R | E4/q@R D4@L C4@R D4@L | E4@R E4@L E4@R E4@L | D4@R D4@L E4@R D4@L | C4/w@R |',
    'Repeated notes are easy with two mallets: right, left, right — never the same hand twice.',
    { chords: 'C | C | G | C | C | C | G | C |' },
  ),
  two(
    'mal-ode-to-joy', 'Ode to Joy', 'Ludwig van Beethoven', '1824', 2, 'C', [4, 4], 84,
    'E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4 D4 D4/h | E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4 C4 C4/h |',
    'Beethoven’s tune from the Ninth Symphony: steps up and down with steady alternating sticking.',
    { chords: 'C | C/h G/h | C | C/q G/h. | C | C/h G/h | C | G/q C/h. |' },
  ),
  two(
    'mal-twinkle-twinkle', 'Twinkle, Twinkle, Little Star', TRAD, '1761 melody', 2, 'C', [4, 4], 88,
    'C4/q@R C4@L G4@R G4@L | A4@R A4@L G4/h@R | F4/q@R F4@L E4@R E4@L | D4@R D4@L C4/h@R | G4/q@R G4@L F4@R F4@L | E4@R E4@L D4/h@R | G4/q@R G4@L F4@R F4@L | E4@R E4@L D4/h@R | C4/q@R C4@L G4@R G4@L | A4@R A4@L G4/h@R | F4/q@R F4@L E4@R E4@L | D4@R D4@L C4/h@R |',
    'Every note comes in pairs — strike the pair right-left, and glide down the bars.',
    { chords: 'C | F/h C/h | F/h C/h | G/h C/h | C/h F/h | C/h G/h | C/h F/h | C/h G/h | C | F/h C/h | F/h C/h | G/h C/h |' },
  ),
  two(
    'mal-frere-jacques', 'Frère Jacques', TRAD, '18th century', 3, 'C', [4, 4], 92,
    'C4/q D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4/h | E4/q F4 G4/h | G4/e A4 G4 F4 E4/q C4 | G4/e A4 G4 F4 E4/q C4 | C4/q G3 C4/h | C4/q G3 C4/h |',
    'The famous round. Eighth notes in the “morning bells” bars, and a low G under Middle C.',
    { chords: 'C | C | C | C | C | C | C/q G/q C/h | C/q G/q C/h |' },
  ),
  two(
    'mal-jingle-bells', 'Jingle Bells (chorus)', 'James Lord Pierpont', '1857', 3, 'C', [4, 4], 100,
    'E4/q E4 E4/h | E4/q E4 E4/h | E4/q G4 C4 D4 | E4/w | F4/q F4 F4 F4 | F4 E4 E4 E4 | E4@R D4@L D4@R E4@L | D4/h@L G4@R | E4/q E4 E4/h | E4/q E4 E4/h | E4/q G4 C4 D4 | E4/w | F4/q F4 F4 F4 | F4 E4 E4 E4 | G4 G4 F4 D4 | C4/w |',
    'Sleigh-bell repeated notes: keep the hands alternating and the mallets bouncing off the bars.',
    { chords: 'C | C | C | C | F | C | D7 | G | C | C | C | C | F | C | G7 | C |' },
  ),
  two(
    'mal-when-the-saints', 'When the Saints Go Marching In', TRAD, 'Spiritual', 3, 'C', [4, 4], 104,
    'r/q C4 E4 F4 | G4/w | r/q C4 E4 F4 | G4/w | r/q C4 E4 F4 | G4/h E4 | C4/h E4 | D4/w | r/q E4 E4 D4 | C4/h. C4/q | E4/h@L G4/q@R G4@L | F4/h E4/q F4 | G4/h E4 | C4/h D4 | C4/w |',
    'A marching tune. The rest at the start of each phrase is your moment to lift the mallets.',
    { chords: 'C | C | C | G7 | C | C | C | G7 | C | C | C7 | F | C | C/h G7/h | C |' },
  ),
  two(
    'mal-oh-susanna', 'Oh! Susanna', 'Stephen Foster', '1848', 3, 'C', [4, 4], 100,
    'C4/e D4 | E4/q G4 G4/q. A4/e | G4/q E4 C4/q. D4/e | E4/q E4 D4 C4 | D4/h. C4/e D4 | E4/q G4 G4/q. A4/e | G4/q E4 C4/q. D4/e | E4/q E4 D4 D4 | C4/h. |',
    'Starts with a two-note pickup. The dotted rhythms make the hands swap in surprising places — follow the sticking.',
    { pickup: 'q', chords: 'r | C | C | C | G7 | C | C | C/h G7/h | C |' },
  ),
  two(
    'mal-row-your-boat', 'Row, Row, Row Your Boat', TRAD, '1852', 4, 'C', [6, 8], 96,
    'C4/q.@R C4/q.@L | C4/q@R D4/e E4/q. | E4/q D4/e E4/q F4/e | G4/h. | C5/e C5 C5 G4 G4 G4 | E4 E4 E4 C4 C4 C4 | G4/q F4/e E4/q D4/e | C4/h. |',
    'A rowing song in 6/8: two big swings per bar. The “merrily” bars are fast repeated notes — alternate!',
    { chords: 'C | C | C/q. G7/q. | C | C | C | G7 | C |' },
  ),
  two(
    'mal-aura-lee', 'Aura Lee', 'George R. Poulton', '1861', 4, 'G', [4, 4], 76,
    'D4/q G4 F#4 G4 | A4 E4 A4/h | G4/q F#4 E4 F#4 | G4/w | D4/q G4 F#4 G4 | A4 E4 A4/h | G4/q@R F#4@L E4@R F#4@L | G4/w@R | B4/q B4 B4/h | B4/q B4 B4/h | B4/q A4 G4 A4 | B4/w | B4/q B4 C5 B4 | A4 E4 A4/h | G4/q F#4 B4 A4 | G4/w |',
    'A slow Civil-War ballad in G major — every F is sharp. Its long notes are perfect for practising rolls.',
    { chords: 'G | A7 | D7 | G | G | A7 | D7 | G | G | B7 | Em | G7 | C | A7 | G/h D7/h | G |' },
  ),
  two(
    'mal-minuet-in-g', 'Minuet in G', 'Christian Petzold (attr. J. S. Bach)', 'c. 1725', 5, 'G', [3, 4], 100,
    'D5/q@R G4/e@L A4@R B4@L C5@R | D5/q@R G4@L G4@R | E5/q@R C5/e@L D5@R E5@L F#5@R | G5/q@R G4@L G4@R | C5/q D5/e C5 B4 A4 | B4/q C5/e B4 A4 G4 | F#4/q G4/e A4 B4 G4 | A4/h. | D5/q@R G4/e@L A4@R B4@L C5@R | D5/q@R G4@L G4@R | E5/q@R C5/e@L D5@R E5@L F#5@R | G5/q@R G4@L G4@R | C5/q D5/e C5 B4 A4 | B4/q C5/e B4 A4 G4 | A4/q B4/e A4 G4 F#4 | G4/h. |',
    'From Anna Magdalena Bach’s notebook. Scale runs alternate smoothly; the leaps down to G need a double sticking.',
    { chords: 'G | G | C | G | Am | G | D | D | G | G | C | G | Am | G | D7 | G |' },
  ),
  two(
    'mal-greensleeves', 'Greensleeves', TRAD, '16th century', 5, 'Am', [3, 4], 88,
    'A4/q | C5/h D5/q | E5/q. F5/e E5/q | D5/h@R B4/q@L | G4/q. A4/e B4/q | C5/h A4/q | A4/q. G#4/e A4/q | B4/h G#4/q | E4/h A4/q | C5/h@L D5/q@R | E5/q.@L F5/e@R E5/q@L | D5/h@R B4/q@L | G4/q. A4/e B4/q | C5/q. B4/e A4/q | G#4/q. F#4/e G#4/q | A4/h |',
    'A Tudor ballad in A minor. The G♯ and F♯ are raised bars — reach for the back row at each cadence.',
    { pickup: 'q', chords: 'r | Am | C | G | Em | Am | Am | E | E/h Am/q | Am | C | G | Em | Am | E | Am |' },
  ),
  two(
    'mal-mountain-king', 'In the Hall of the Mountain King', 'Edvard Grieg', '1875', 6, 'Am', [4, 4], 100,
    'A4/e B4 C5 D5 E5 C5 E5/q | D#5/e B4 D#5/q D5/e Bb4 D5/q | A4/e B4 C5 D5 E5 C5 E5 A5 | G5/e E5 C5 E5 G5/h | A4/e B4 C5 D5 E5 C5 E5/q | D#5/e B4 D#5/q D5/e Bb4 D5/q | A4/e B4 C5 D5 E5 C5 E5 A5 | E5/e C5 B4 G#4 A4/h |',
    'From Peer Gynt: the trolls creep up the scale. Short, crisp strokes from the wrists — perfect on xylophone.',
    { chords: 'Am | B/h Bb/h | Am | C | Am | B/h Bb/h | Am | E/h Am/h |' },
  ),
  two(
    'mal-can-can', 'Can-Can (Galop)', 'Jacques Offenbach', '1858', 6, 'C', [4, 4], 120,
    'C5/h@R D5/e@L F5@R E5@L D5@R | G5/q G5 G5/e A5 E5 F5 | D5/q D5 D5/e F5 E5 D5 | C5/e C6 B5 A5 G5 F5 E5 D5 | C5/h@L D5/e@L F5@R E5@L D5@R | G5/q G5 G5/e A5 E5 F5 | D5/q D5 D5/e F5 E5 D5 | C5/e G5 D5 E5 C5/h |',
    'The galop from Orpheus in the Underworld (simplified). Bar 4 runs down a whole octave from top C.',
    { chords: 'C | C | G7 | C/h G7/h | C | C | G7 | G7/h C/h |' },
  ),
  two(
    'mal-entertainer', 'The Entertainer (A section)', 'Scott Joplin', '1902', 7, 'C', [4, 4], 80,
    'D4/e D#4 | E4/e C5/q E4/e C5/q E4/e C5/e~ | C5/q. C5/e D5 D#5 E5 C5 | D5/e E5/q B4/e D5/q C5~ | C5/h r/q D4/e D#4 | E4/e C5/q E4/e C5/q E4/e C5/e~ | C5/h r/q A4/e G4 | F#4/e A4 C5 E5/q D5/e C5 A4 | D5/h r/q D4/e D#4 | E4/e C5/q E4/e C5/q E4/e C5/e~ | C5/q. C5/e D5 D#5 E5 C5 | D5/e E5/q B4/e D5/q C5~ | C5/h. |',
    'Joplin’s ragtime hit, simplified and an octave lower. Syncopation: the C lands between the beats — count “1 & 2 &”.',
    { pickup: 'q', chords: 'r | C | C | G7/h. C/q | C | C | C/h D7/h | D7 | G7 | C | C | G7/h. C/q | C |' },
  ),
  two(
    'mal-big-top-galop', 'Big Top Galop', ORIGINAL, undefined, 7, 'C', [2, 4], 108,
    'E5/e D#5 E5 G5 | C5/e B4 C5 E5 | D5/e C#5 D5 F5 | B4/q G4 | E5/e D#5 E5 G5 | C6/e B5 A5 G5 | F5/e E5 D5 B4 | C5/q r/q | A4/e G#4 A4 C5 | F5/e E5 D5 C5 | B4/e A#4 B4 D5 | G5/q G4 | C5/s B4 Bb4 A4 Ab4 G4 Gb4 F4 | E4/e G4 C5 E5 | F5/e D5 B4 G4 | C5/e G4 C5/q |',
    'A circus galop for xylophone: chromatic neighbour notes on the raised bars and a sliding run down to F.',
    { chords: 'C | C | G7 | G | C | C | G7 | C | Am | Dm | G | G | C | C | G7 | C |' },
  ),
];

// ---------------------------------------------------------------------------
// Four mallets
// ---------------------------------------------------------------------------

export const MALLETS_FOUR: SongDef[] = [
  fourTreble(
    'mal-permutations', 'Mallet Permutations', ORIGINAL, undefined, 1, 'C', [4, 4], 72,
    'C4/q@1 G4@2 C5@3 E5@4 | E5@4 C5@3 G4@2 C4@1 | C4@1 C5@3 G4@2 E5@4 | E5@4 G4@2 C5@3 C4@1 | G4@2 C5@3 G4@2 C5@3 | C4@1 E5@4 C4@1 E5@4 | ' +
      '[C4 G4]@1,2 [C5 E5]@3,4 [C4 G4]@1,2 [C5 E5]@3,4 | [C4 G4 C5 E5]/w@1,2,3,4 | C4/q@1 A4@2 C5@3 F5@4 | F5@4 C5@3 A4@2 C4@1 | B3@1 G4@2 B4@3 D5@4 | D5@4 B4@3 G4@2 B3@1 | [C4 G4 C5 E5]/w@1,2,3,4 |',
    'The classic first four-mallet exercise: each mallet on its own, in every order, then in pairs and all together.',
    { chords: 'C | C | C | C | C | C | C | C | F | F | G | G | C |' },
  ),
  fourTreble(
    'mal-interval-waltz', 'Interval Waltz', ORIGINAL, undefined, 1, 'C', [3, 4], 88,
    '[C4 G4]/q@1,2 [C5 E5]@3,4 [C5 E5]@3,4 | [C4 G4]@1,2 [B4 D5]@3,4 [C5 E5]@3,4 | [B3 G4]@1,2 [B4 D5]@3,4 [B4 D5]@3,4 | [B3 G4]@1,2 [D5 F5]@3,4 [B4 D5]@3,4 | ' +
      '[C4 G4]@1,2 [C5 E5]@3,4 [E5 G5]@3,4 | [C4 A4]@1,2 [C5 F5]@3,4 [F5 A5]@3,4 | [B3 G4]@1,2 [B4 D5]@3,4 [D5 F5]@3,4 | [C4 G4 C5 E5]/h.@1,2,3,4 | ' +
      '[C4 E4]/q@1,2 [G4 E5]@3,4 [G4 E5]@3,4 | [C4 F4]@1,2 [A4 F5]@3,4 [A4 F5]@3,4 | [B3 D4]@1,2 [G4 D5]@3,4 [B4 G5]@3,4 | [C4 E4]@1,2 [G4 E5]@3,4 [G4 C5]@3,4 | ' +
      '[A3 E4]@1,2 [C5 A5]@3,4 [C5 A5]@3,4 | [F3 C4]@1,2 [A4 F5]@3,4 [C5 F5]@3,4 | [G3 D4]@1,2 [B4 G5]@3,4 [B4 F5]@3,4 | [C4 G4 C5 E5]/h.@1,2,3,4 |',
    'Oom-pah-pah with double vertical strokes: the left hand plays the low pair, the right hand answers — then all four together.',
    { chords: 'C | C | G | G7 | C | F | G7 | C | C | F | G7 | C | Am | F | G7 | C |' },
  ),
  fourTreble(
    'mal-ode-to-joy-chorale', 'Ode to Joy (four-mallet chorale)', 'Ludwig van Beethoven', '1824', 2, 'C', [4, 4], 72,
    '[C4 G4 C5 E5]/q [C5 E5] [C4 G4 D5 F5] [E5 G5] | [G3 D4 D5 G5] [D5 F5] [C4 G4 C5 E5] [B4 D5] | [C4 E4 G4 C5] [G4 C5] [B3 D4 B4 D5] [C5 E5] | [C4 G4 C5 E5] [B4 D5] [B3 G4 B4 D5]/h | ' +
      '[C4 G4 C5 E5]/q [C5 E5] [C4 G4 D5 F5] [E5 G5] | [G3 D4 D5 G5] [D5 F5] [C4 G4 C5 E5] [B4 D5] | [C4 E4 G4 C5] [G4 C5] [B3 D4 B4 D5] [C5 E5] | [G3 D4 B4 D5] [G4 C5] [C4 E4 G4 C5]/h |',
    'Beethoven’s melody on top, a partner a third below it in the right hand, and the left hand adding the bass on beats 1 and 3.',
    { arranger: 'Clef Coach', chords: 'C | G/h C/q G/q | C/h G/h | C/q G/h. | C | G/h C/q G/q | C/h G/h | G/q C/h. |' },
  ),
  fourTreble(
    'mal-marimba-chorale', 'Marimba Chorale', ORIGINAL, undefined, 2, 'C', [4, 4], 60,
    '[C4 G4 C5 E5]/h [C4 A4 C5 F5] | [C4 G4 C5 E5] [B3 G4 B4 D5] | [A3 E4 A4 C5] [F3 C4 A4 C5] | [G3 D4 G4 B4]/w | ' +
      '[A3 E4 A4 C5]/h [G3 D4 G4 D5] | [C4 G4 C5 E5] [C4 A4 C5 F5] | [C4 G4 C5 E5] [B3 G4 B4 D5] | [C4 E4 G4 C5]/w |',
    'A slow hymn in block chords. All four mallets strike together; let each chord ring before you move to the next.',
    { chords: 'C/h F/h | C/h G/h | Am/h F/h | G | Am/h G/h | C/h F/h | C/h G/h | C |' },
  ),
  fourGrand(
    'mal-chorale-in-g', 'Chorale in G (in the style of Bach)', ORIGINAL, undefined, 4, 'G', [4, 4], 66,
    '[G4 B4]/h [D4 A4] | [E4 G4] [F#4 A4] | [G4 B4] [G4 C5] | [F#4 D5]/w | [G4 D5]/h [G4 E5] | [G4 D5] [A4 C5] | [G4 B4] [F#4 A4] | [D4 G4]/w |',
    '[G3 D4]/h [F#3 A3] | [E3 B3] [D3 D4] | [G3 D4] [E3 C4] | [D3 A3]/w | [B2 G3]/h [C3 G3] | [B2 G3] [A2 E3] | [D3 B3] [D3 C4] | [G3 B3]/w |',
    'Four voices, like a Bach chorale: the left hand plays bass and tenor, the right hand alto and soprano.',
    { chords: 'G/h D/F#/h | Em/h D/h | G/h C/E/h | D | G/B/h C/h | G/B/h Am/h | G/D/h D7/h | G |' },
  ),
  fourGrand(
    'mal-amazing-grace', 'Amazing Grace', 'Traditional (New Britain)', '1835 tune', 4, 'F', [3, 4], 72,
    'C5/q | [A4 F5]/h A5/e F5 | [C5 A5]/h [Bb4 G5]/q | [D5 F5]/h [Bb4 D5]/q | [A4 C5]/h C5/q | [A4 F5]/h A5/e F5 | [C5 A5]/h [Bb4 G5]/q | [E5 C6]/h.~ | [E5 C6]/h A5/q | ' +
      '[A5 C6]/h A5/e F5 | [C5 A5]/h [Bb4 G5]/q | [D5 F5]/h [Bb4 D5]/q | [A4 C5]/h C5/q | [A4 F5]/h A5/e F5 | [C5 A5]/h [Bb4 G5]/q | [A4 F5]/h.~ | [A4 F5]/h |',
    'r/q | [F3 C4]/h. | [F3 C4]/h [C3 Bb3]/q | [Bb2 F3]/h. | [F3 C4]/h. | [F3 C4]/h. | [F3 C4]/h [C3 Bb3]/q | [C3 G3]/h. | [C3 Bb3]/h. | ' +
      '[F3 C4]/h. | [F3 C4]/h [C3 Bb3]/q | [Bb2 F3]/h. | [F3 C4]/h. | [F3 C4]/h. | [F3 C4]/h [C3 Bb3]/q | [F3 C4]/h.~ | [F3 C4]/h |',
    'The hymn in F major. Right hand: melody on mallet 4 with a harmony note on mallet 3. Left hand: the bass on each downbeat.',
    { pickup: 'q', arranger: 'Clef Coach', chords: 'r | F | F/h C7/q | Bb | F | F | F/h C7/q | C | C7 | F | F/h C7/q | Bb | F | F | F/h C7/q | F | F |' },
  ),
  fourGrand(
    'mal-silent-night', 'Silent Night', 'Franz Xaver Gruber', '1818', 5, 'C', [3, 4], 60,
    '[E4 G4]/q. A4/e G4/q | [C4 E4]/h. | [E4 G4]/q. A4/e G4/q | [C4 E4]/h. | [F4 D5]/h D5/q | [G4 B4]/h. | [E4 C5]/h C5/q | [E4 G4]/h. | ' +
      '[F4 A4]/h A4/q | [A4 C5]/q. B4/e A4/q | [E4 G4]/q. A4/e G4/q | [C4 E4]/h. | [F4 A4]/h A4/q | [A4 C5]/q. B4/e A4/q | [E4 G4]/q. A4/e G4/q | [C4 E4]/h. | ' +
      '[F4 D5]/h D5/q | [B4 F5]/q. D5/e B4/q | [E4 C5]/h. | [G4 E5]/h. | C5/q G4 E4 | G4/q. F4/e D4/q | [G3 C4]/h.~ | [G3 C4]/h. |',
    '[C3 G3]/h. | [C3 G3]/h. | [C3 G3]/h. | [C3 G3]/h. | [G3 B3]/h. | [G3 D4]/h. | [C3 G3]/h. | [C3 G3]/h. | ' +
      '[F3 C4]/h. | [F3 C4]/h. | [C3 G3]/h. | [C3 G3]/h. | [F3 C4]/h. | [F3 C4]/h. | [C3 G3]/h. | [C3 G3]/h. | ' +
      '[G3 B3]/h. | [G3 B3]/h. | [C3 G3]/h. | [C3 G3]/h. | [C3 G3]/h. | [B2 F3]/h. | [C3 E3]/h.~ | [C3 E3]/h. |',
    'Gruber’s carol, arranged for four mallets: the left hand rings one low chord per bar under the melody.',
    { arranger: 'Clef Coach', chords: 'C | C | C | C | G7 | G | C | C | F | F | C | C | F | F | C | C | G7 | G7 | C | C | C | G7 | C | C |' },
  ),
  fourGrand(
    'mal-brahms-lullaby', 'Lullaby (Wiegenlied)', 'Johannes Brahms', '1868', 6, 'C', [3, 4], 69,
    'E5/e E5 | [E5 G5]/h E5/e E5 | [E5 G5]/h E5/e G5 | C6/q B5/q. A5/e | A5/q G5 D5/e E5 | [D5 F5]/h D5/e E5 | [D5 F5]/h D5/e F5 | B5/e A5 G5/q B5 | ' +
      '[E5 C6]/h C5/e C5 | [A5 C6]/h A5/e F5 | [E5 G5]/h E5/e C5 | F5/q G5 A5 | [E5 G5]/h C5/e C5 | [A5 C6]/h A5/e F5 | [E5 G5]/h E5/e C5 | F5/q E5 D5 | [G4 C5]/h |',
    'r/q | C3/q G3 E3 | C3 G3 E3 | B2 G3 F3 | C3 G3 E3 | B2 G3 F3 | B2 G3 F3 | B2 G3 F3 | ' +
      'C3 G3 E3 | C3 A3 F3 | C3 G3 E3 | C3 A3 F3 | C3 G3 E3 | C3 A3 F3 | C3 G3 E3 | B2 G3 F3 | [C3 E3]/h |',
    'Brahms’ cradle song: the left hand rocks through each chord one mallet at a time while the right hand sings.',
    { pickup: 'q', arranger: 'Clef Coach', chords: 'r | C | C | G7 | C | G7 | G7 | G7 | C | F | C | F | C | F | C | G7 | C |' },
  ),
  fourGrand(
    'mal-greensleeves-chords', 'Greensleeves (with chords)', TRAD, '16th century', 7, 'Am', [3, 4], 80,
    'A4/q | [A4 C5]/h D5/q | [C5 E5]/q. F5/e E5/q | [B4 D5]/h B4/q | [E4 G4]/q. A4/e B4/q | [E4 C5]/h A4/q | [E4 A4]/q. G#4/e A4/q | [E4 B4]/h G#4/q | E4/h A4/q | ' +
      '[A4 C5]/h D5/q | [C5 E5]/q. F5/e E5/q | [B4 D5]/h B4/q | [E4 G4]/q. A4/e B4/q | [E4 C5]/q. B4/e A4/q | [E4 G#4]/q. F#4/e G#4/q | [C4 A4]/h |',
    'r/q | [A2 E3]/h. | [C3 G3]/h. | [G3 D4]/h. | [E3 B3]/h. | [A2 E3]/h. | [A2 E3]/h. | [E3 B3]/h. | [E3 B3]/h [A2 E3]/q | ' +
      '[A2 E3]/h. | [C3 G3]/h. | [G3 D4]/h. | [E3 B3]/h. | [A2 E3]/h. | [E3 B3]/h. | [A2 E3]/h |',
    'The Tudor ballad with a low open fifth under every bar and a harmony note in the right hand on the long notes.',
    { pickup: 'q', arranger: 'Clef Coach', chords: 'r | Am | C | G | Em | Am | Am | E | E/h Am/q | Am | C | G | Em | Am | E | Am |' },
  ),
];

export const MALLETS: SongDef[] = [...MALLETS_TWO, ...MALLETS_FOUR];
