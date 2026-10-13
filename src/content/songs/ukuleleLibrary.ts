import type { SongDef } from '../../music/parse';

/**
 * Ukulele song library. Ukulele music is written in the ordinary treble clef and
 * SOUNDS AS WRITTEN: the open strings of a standard (re-entrant, high-G) ukulele are
 * A4 E4 C4 G4 = strings 1..4. Every melody stays between C4 (open C string) and A5
 * (A string, 12th fret).
 *
 * Fingering is left to the auto-fingering (it follows the player's tuning), except
 * where a string choice IS the lesson — the E-string G in Ode to Joy, and the
 * campanella piece, which needs the high G string. Tokens may carry the left-hand
 * finger (`@n`, 0 = open) and the string (`%n`).
 *
 * Every song has a `chords` line in the same bar structure (pickup bar included) for
 * strumming along. Songs that use chords never use repeat signs, so the chord line
 * and the notes stay bar-for-bar aligned.
 */

export const UKULELE: SongDef[] = [
  // ------------------------------------------------------------------ Level 1–2
  {
    id: 'uke-my-dog-has-fleas',
    title: 'My Dog Has Fleas',
    composer: 'Clef Coach Original',
    instrument: 'ukulele',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 72,
    blurb: 'The famous tuning phrase G–C–E–A (“my dog has fleas”) turned into a tune. Open strings only, so your fretting hand gets the day off.',
    staves: [{
      clef: 'treble',
      voices: ['G4/q C4 E4 A4 | A4/h E4/h | G4/q C4 E4 A4 | A4/w | A4/q E4 G4 E4 | C4/h E4/h | G4/q E4 C4 E4 | C4/w |'],
    }],
    chords: 'C/w | Am/w | C/w | Am/w | Am/w | C/w | C/w | C/w |',
    tags: ['original', 'open strings'],
  },
  {
    id: 'uke-mary-had-a-little-lamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional (American)',
    year: '1830s',
    instrument: 'ukulele',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 80,
    blurb: 'The nursery classic on C, D and E, with the open G string for the high notes in bar 4.',
    staves: [{
      clef: 'treble',
      voices: ['E4/q D4 C4 D4 | E4 E4 E4/h | D4/q D4 D4/h | E4/q G4 G4/h | E4/q D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4/w |'],
    }],
    chords: 'C/w | C/w | G7/w | C/w | C/w | C/w | G7/w | C/w |',
    tags: ['folk', 'C string'],
  },
  {
    id: 'uke-ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    year: '1824',
    instrument: 'ukulele',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 76,
    blurb: 'Beethoven’s great tune on the C and E strings. This time play G on the E string’s 3rd fret, and watch the dotted rhythm in bars 4 and 8.',
    staves: [{
      clef: 'treble',
      voices: [
        'E4/q E4 F4 G4%2 | G4%2 F4 E4 D4 | C4 C4 D4 E4 | E4/q. D4/e D4/h | ' +
        'E4/q E4 F4 G4%2 | G4%2 F4 E4 D4 | C4 C4 D4 E4 | D4/q. C4/e C4/h |',
      ],
    }],
    chords: 'C/w | G7/w | C/w | C/h G7/h | C/w | G7/w | C/w | G7/h C/h |',
    tags: ['classical', 'E string'],
  },
  {
    id: 'uke-lightly-row',
    title: 'Lightly Row',
    composer: 'Traditional (German)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 84,
    blurb: 'The German folk song “Hänschen klein”, walking up and down the C and E strings. Let every half note ring for two full beats.',
    staves: [{
      clef: 'treble',
      voices: [
        'G4/q E4 E4/h | F4/q D4 D4/h | C4/q D4 E4 F4 | G4 G4 G4/h | G4/q E4 E4/h | F4/q D4 D4/h | C4/q E4 G4 G4 | C4/w | ' +
        'D4/q D4 D4 D4 | D4 E4 F4/h | E4/q E4 E4 E4 | E4 F4 G4/h | G4/q E4 E4/h | F4/q D4 D4/h | C4/q E4 G4 G4 | C4/w |',
      ],
    }],
    chords: 'C/w | G7/w | C/w | C/w | C/w | G7/w | C/w | C/w | G7/w | G7/w | C/w | C/w | C/w | G7/w | C/w | C/w |',
    tags: ['folk', 'C and E strings'],
  },
  {
    id: 'uke-twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional (French)',
    year: '1761',
    instrument: 'ukulele',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 84,
    blurb: 'On a ukulele the high notes G and A are open strings, so this tune almost plays itself. The melody is the French song “Ah! vous dirai-je, maman”.',
    staves: [{
      clef: 'treble',
      voices: [
        'C4/q C4 G4 G4 | A4 A4 G4/h | F4/q F4 E4 E4 | D4 D4 C4/h | G4/q G4 F4 F4 | E4 E4 D4/h | ' +
        'G4/q G4 F4 F4 | E4 E4 D4/h | C4/q C4 G4 G4 | A4 A4 G4/h | F4/q F4 E4 E4 | D4 D4 C4/h |',
      ],
    }],
    chords: 'C/w | F/h C/h | F/h C/h | G7/h C/h | C/h F/h | C/h G7/h | C/h F/h | C/h G7/h | C/w | F/h C/h | F/h C/h | G7/h C/h |',
    tags: ['folk', 'open strings'],
  },
  {
    id: 'uke-island-waltz',
    title: 'Island Waltz',
    composer: 'Clef Coach Original',
    instrument: 'ukulele',
    level: 2,
    key: 'C',
    time: [3, 4],
    tempo: 92,
    blurb: 'A gentle waltz across all four strings, climbing to C on the A string. Count “ONE two three” and let the dotted half notes ring.',
    staves: [{
      clef: 'treble',
      voices: [
        'C4/q E4 G4 | A4/h F4/q | G4/q F4 D4 | E4/h. | E4/q G4 C5 | C5/h A4/q | B4/q G4 D4 | C4/h. | ' +
        'A4/q C5 A4 | F4/h A4/q | G4/q E4 C4 | D4/h. | E4/q G4 C5 | A4/h C5/q | B4/q G4 D4 | C4/h. |',
      ],
    }],
    chords: 'C/h. | F/h. | G7/h. | C/h. | C/h. | F/h. | G7/h. | C/h. | Am/h. | F/h. | C/h. | G7/h. | C/h. | F/h. | G7/h. | C/h. |',
    tags: ['original', 'waltz', 'first position'],
  },
  // ------------------------------------------------------------------ Level 3–4
  {
    id: 'uke-hot-cross-buns',
    title: 'Hot Cross Buns',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 80,
    blurb: 'Three notes and a burst of eighth notes: “one a penny, two a penny” is two notes to every beat. Count “1 & 2 & 3 & 4 &”.',
    staves: [{
      clef: 'treble',
      voices: ['E4/q D4 C4/h | E4/q D4 C4/h | C4/e C4 C4 C4 D4 D4 D4 D4 | E4/q D4 C4/h |'],
    }],
    chords: 'C/q G7/q C/h | C/q G7/q C/h | C/h G7/h | C/q G7/q C/h |',
    tags: ['folk', 'eighth notes'],
  },
  {
    id: 'uke-when-the-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 96,
    pickup: 'h.',
    blurb: 'The New Orleans favourite starts with a three-note pickup: count “1” silently, play on 2 3 4, and land on G for beat one. Stop the strings on the rests.',
    staves: [{
      clef: 'treble',
      voices: [
        'C4/q E4 F4 | G4/w | r/q C4 E4 F4 | G4/w | r/q C4 E4 F4 | G4/h E4/h | C4/h E4/h | D4/w | ' +
        'r/q E4 E4 D4 | C4/h. C4/q | E4/h G4/h | G4/q F4/h. | r/h E4/q F4 | G4/h E4/h | C4/h D4/h | C4/w |',
      ],
    }],
    chords: 'N.C./h. | C/w | C/w | C/w | C/w | C/w | C/w | G7/w | G7/w | C/w | C7/w | F/w | F/h C/h | C/w | C/h G7/h | C/w |',
    tags: ['folk', 'pickup', 'rests'],
  },
  {
    id: 'uke-row-your-boat',
    title: 'Row, Row, Row Your Boat',
    composer: 'Traditional',
    year: '1852',
    instrument: 'ukulele',
    level: 3,
    key: 'C',
    time: [6, 8],
    tempo: 96,
    blurb: 'A round in 6/8: feel two big, rocking beats per bar. The “merrily, merrily” bars are six even eighth notes.',
    staves: [{
      clef: 'treble',
      voices: ['C4/q. C4/q. | C4/q D4/e E4/q. | E4/q D4/e E4/q F4/e | G4/h. | C5/e C5 C5 G4 G4 G4 | E4/e E4 E4 C4 C4 C4 | G4/q F4/e E4/q D4/e | C4/h. |'],
    }],
    chords: 'C/h. | C/h. | C/h. | C/h. | C/h. | C/h. | G7/h. | C/h. |',
    tags: ['folk', '6/8', 'round'],
  },
  {
    id: 'uke-jingle-bells',
    title: 'Jingle Bells (chorus)',
    composer: 'James Lord Pierpont',
    year: '1857',
    instrument: 'ukulele',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 104,
    blurb: 'The sleigh-ride chorus with its real rhythm: a dotted quarter and an eighth on “jin-gle all the way”.',
    staves: [{
      clef: 'treble',
      voices: [
        'E4/q E4 E4/h | E4/q E4 E4/h | E4/q G4 C4/q. D4/e | E4/w | F4/q F4 F4/q. F4/e | F4/q E4 E4 E4/e E4/e | E4/q D4 D4 E4 | D4/h G4/h | ' +
        'E4/q E4 E4/h | E4/q E4 E4/h | E4/q G4 C4/q. D4/e | E4/w | F4/q F4 F4/q. F4/e | F4/q E4 E4 E4/e E4/e | G4/q G4 F4 D4 | C4/w |',
      ],
    }],
    chords: 'C/w | C/w | C/w | C/w | F/w | C/w | G7/w | G7/w | C/w | C/w | C/w | C/w | F/w | C/w | G7/w | C/w |',
    tags: ['holiday', 'folk', 'dotted rhythm'],
  },
  {
    id: 'uke-yankee-doodle',
    title: 'Yankee Doodle',
    composer: 'Traditional (American)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 3,
    key: 'F',
    time: [4, 4],
    tempo: 100,
    blurb: 'A key-of-F classic with one B♭ (A string, 1st fret) in bar 6. Steady quarter notes all the way.',
    staves: [{
      clef: 'treble',
      voices: ['F4/q F4 G4 A4 | F4 A4 G4 C4 | F4 F4 G4 A4 | F4/h E4/h | F4/q F4 G4 A4 | Bb4 A4 G4 F4 | E4 C4 D4 E4 | F4/h F4/h |'],
    }],
    chords: 'F/w | F/h C7/h | F/w | F/h C7/h | F/w | Bb/h F/h | C7/w | F/w |',
    tags: ['folk', 'key of F'],
  },
  {
    id: 'uke-oh-susanna',
    title: 'Oh! Susanna',
    composer: 'Stephen Foster',
    year: '1848',
    instrument: 'ukulele',
    level: 4,
    key: 'C',
    time: [4, 4],
    tempo: 92,
    pickup: 'q',
    blurb: 'Foster’s banjo song is a natural on the ukulele: an eighth-note pickup, a bouncy dotted rhythm, and a chorus that sings out on the A string.',
    staves: [{
      clef: 'treble',
      voices: [
        'C4/e D4 | E4/q G4 G4/q. A4/e | G4/q E4 C4/q. D4/e | E4/q E4 D4 C4 | D4/h. C4/e D4 | ' +
        'E4/q G4 G4/q. A4/e | G4/q E4 C4/q. D4/e | E4/q E4 D4 D4 | C4/h. r/q | ' +
        'F4/h F4/h | A4/q A4/h A4/q | G4/q G4 E4 C4 | D4/h. C4/e D4 | ' +
        'E4/q G4 G4/q. A4/e | G4/q E4 C4/q. D4/e | E4/q E4 D4 D4 | C4/h. |',
      ],
    }],
    chords: 'N.C./q | C/w | C/w | C/w | G7/w | C/w | C/w | C/h G7/h | C/w | F/w | F/w | C/w | G7/w | C/w | C/w | C/h G7/h | C/h. |',
    tags: ['folk', 'pickup', 'dotted rhythm'],
  },
  {
    id: 'uke-amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditional (“New Britain”)',
    year: '1835',
    instrument: 'ukulele',
    level: 4,
    key: 'F',
    time: [3, 4],
    tempo: 84,
    pickup: 'q',
    blurb: 'The hymn tune “New Britain” in F, in 3/4 with a one-beat pickup. Hold the tied high Cs for their full length.',
    staves: [{
      clef: 'treble',
      voices: [
        'C4/q | F4/h A4/e F4/e | A4/h G4/q | F4/h D4/q | C4/h C4/q | F4/h A4/e F4/e | A4/h G4/q | C5/h.~ | C5/h A4/q | ' +
        'C5/h A4/e F4/e | A4/h G4/q | F4/h D4/q | C4/h C4/q | F4/h A4/e F4/e | A4/h G4/q | F4/h.~ | F4/h |',
      ],
    }],
    chords: 'N.C./q | F/h. | F/h. | Bb/h. | F/h. | F/h. | F/h. | C/h. | C7/h. | F/h. | F/h. | Bb/h. | F/h. | Dm/h. | C7/h. | F/h. | F/h |',
    tags: ['hymn', 'waltz', 'pickup', 'key of F'],
  },
  {
    id: 'uke-aura-lee',
    title: 'Aura Lee',
    composer: 'George R. Poulton',
    year: '1861',
    instrument: 'ukulele',
    level: 4,
    key: 'G',
    time: [4, 4],
    tempo: 76,
    blurb: 'A Civil War parlour song whose melody later became “Love Me Tender”, in G major: F♯ is the E string’s 2nd fret.',
    staves: [{
      clef: 'treble',
      voices: [
        'D4/q G4 F#4 G4 | A4 E4 A4/h | G4/q F#4 E4 F#4 | G4/w | D4/q G4 F#4 G4 | A4 E4 A4/h | G4/q F#4 E4 F#4 | G4/w | ' +
        'B4/q B4 B4 B4 | B4 B4 B4/h | B4/q A4 G4 A4 | B4/w | B4/q B4 C5 B4 | A4 E4 A4/h | G4/q F#4 E4 F#4 | G4/w |',
      ],
    }],
    chords: 'G/w | A7/w | D7/w | G/w | G/w | A7/w | D7/w | G/w | G/w | B7/w | Em/w | G7/w | C/w | A7/w | D7/w | G/w |',
    tags: ['folk', 'key of G'],
  },
  // ------------------------------------------------------------------ Level 5–6
  {
    id: 'uke-auld-lang-syne',
    title: 'Auld Lang Syne',
    composer: 'Traditional (Scottish)',
    year: '1788',
    instrument: 'ukulele',
    level: 5,
    key: 'F',
    time: [4, 4],
    tempo: 80,
    pickup: 'q',
    blurb: 'The New Year song in F: a dotted rhythm in almost every bar, and a reach up to D at the A string’s 5th fret.',
    staves: [{
      clef: 'treble',
      voices: ['C4/q | F4/q. F4/e F4/q A4 | G4/q. F4/e G4/q A4 | F4/q. F4/e A4/q C5@3 | D5/h.@4 D5/q@4 | C5/q.@3 A4/e A4/q F4@1 | G4/q. F4/e G4/q A4 | F4/q. D4/e D4/q C4 | F4/h. |'],
    }],
    chords: 'N.C./q | F/w | C7/w | F/w | Bb/w | F/w | C7/w | Bb/h C7/h | F/h. |',
    tags: ['folk', 'pickup', 'dotted rhythm', 'key of F'],
  },
  {
    id: 'uke-drunken-sailor',
    title: 'Drunken Sailor',
    composer: 'Traditional (sea shanty)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 5,
    key: 'Dm',
    time: [4, 4],
    tempo: 104,
    blurb: 'The sea shanty in D Dorian: the B♮ in bar 6 gives it that bright, salty sound. Keep the eighth notes even and drive the beat.',
    staves: [{
      clef: 'treble',
      voices: ['A4/q A4/e A4/e A4/q A4/e A4/e | A4/q D4 F4 A4 | G4/q G4/e G4/e G4/q G4/e G4/e | G4/q C4 E4 G4 | A4/q A4/e A4/e A4/q A4/e A4/e | A4/q B4@2 C5@3 D5@4 | C5/q@3 A4 G4 E4 | D4/h@2 D4/h@2 |'],
    }],
    chords: 'Dm/w | Dm/w | C/w | C/w | Dm/w | Dm/w | C/w | Dm/w |',
    tags: ['folk', 'shanty', 'dorian', 'minor'],
  },
  {
    id: 'uke-my-bonnie',
    title: 'My Bonnie Lies Over the Ocean',
    composer: 'Traditional (Scottish)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 6,
    key: 'C',
    time: [3, 4],
    tempo: 100,
    pickup: 'q',
    blurb: 'A Scottish waltz that leaps up to E at the A string’s 7th fret. Shift while an open string or a long note rings.',
    staves: [{
      clef: 'treble',
      voices: [
        'G4/q | E5/q.@3%1 D5/e@1%1 C5/q@4%2 | D5/q@1%1 C5@4%2 A4@1%2 | G4/q E4/h~ | E4/h G4/q | ' +
        'E5/q.@3%1 D5/e@1%1 C5/q@4%2 | C5/q@4%2 B4@3%2 C5@4%2 | D5/h.@1%1~ | D5/h G4/q | ' +
        'E5/q.@3%1 D5/e@1%1 C5/q@4%2 | D5/q@1%1 C5@4%2 A4@1%2 | G4/q E4/h~ | E4/h G4/q | ' +
        'A4/q@1%2 D5@1%1 C5@4%2 | B4/q@3%2 A4@1%2 B4@3%2 | C5/h.@4%2~ | C5/h |',
      ],
    }],
    chords: 'N.C./q | C/h. | F/h. | C/h. | C/h. | C/h. | D7/h. | G/h. | G7/h. | C/h. | F/h. | C/h. | A7/h. | Dm/h. | G7/h. | C/h. | C/h |',
    tags: ['folk', 'waltz', 'pickup', 'positions'],
  },
  {
    id: 'uke-scarborough-fair',
    title: 'Scarborough Fair',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'ukulele',
    level: 6,
    key: 'Dm',
    time: [3, 4],
    tempo: 84,
    blurb: 'The haunting English ballad in D Dorian: a minor tune with a raised 6th, so watch for the B♮. Let every note ring like a harp.',
    staves: [{
      clef: 'treble',
      voices: [
        'D4/h D4/q | A4/h A4/e A4/e | E4/q. F4/e E4/q | D4/h. | r/q A4/q C5/q@3 | D5/h@4 C5/q@3 | A4/q B4/q@2 G4/q | A4/h. | ' +
        'D5/h@4 D5/q@4 | D5/h@4 C5/e@3 A4/e | A4/q. G4/e F4/q@1 | C4/h. | r/q D4/q A4/q | G4/h F4/q | E4/q D4/q C4/q | D4/h. |',
      ],
    }],
    chords: 'Dm/h. | Dm/h. | C/h. | Dm/h. | F/h. | Dm/h. | G/h. | Dm/h. | Dm/h. | Dm/h. | F/h. | C/h. | Dm/h. | C/h. | C/h. | Dm/h. |',
    tags: ['folk', 'dorian', 'minor', 'waltz'],
  },
  // ------------------------------------------------------------------ Level 7–8
  {
    id: 'uke-campanella-waltz',
    title: 'Campanella Waltz',
    composer: 'Clef Coach Original',
    instrument: 'ukulele',
    level: 7,
    key: 'C',
    time: [3, 4],
    tempo: 88,
    blurb: 'A harp-style waltz for standard high-G tuning. Hold each chord shape and play every note on a different string from the last, so they ring together like bells.',
    staves: [{
      clef: 'treble',
      voices: [
        'E4/q@0%2 G4@0%4 C5@3%1 | B4@3%1 G4@0%4 F4@1%2 | A4@0%1 E4@0%2 C4@0%3 | D4@2%3 G4@0%4 B4@3%1 | ' +
        'C5@3%1 G4@0%4 E4@0%2 | F4@1%2 A4@0%1 C4@0%3 | D4@2%3 F4@1%2 G4@0%4 | [C4 E4 G4 C5]/h.@0,0,0,3%3,2,4,1 | ' +
        'C5/q@3%1 A4@2%4 E4@0%2 | A4@0%1 F4@1%2 C4@0%3 | G4@0%4 E4@0%2 C5@3%1 | B4@3%1 D4@2%3 G4@0%4 | ' +
        'E4@0%2 G4@0%4 C5@3%1 | C5@3%1 A4@2%4 F4@1%2 | D4@2%3 B4@3%1 G4@0%4 | [C4 E4 G4 C5]/h.@0,0,0,3%3,2,4,1 |',
      ],
    }],
    chords: 'C/h. | G7/h. | Am/h. | G7/h. | C/h. | F/h. | G7/h. | C/h. | Am/h. | F/h. | C/h. | G7/h. | C/h. | F/h. | G7/h. | C/h. |',
    tags: ['original', 'campanella', 'high G', 'waltz'],
  },
  {
    id: 'uke-greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English)',
    year: 'c. 1580',
    instrument: 'ukulele',
    level: 7,
    key: 'Am',
    time: [3, 4],
    tempo: 92,
    pickup: 'q',
    blurb: 'The Tudor ballad in A minor, up the neck: the verse sits in 5th position, then the chorus moves up to 7th position for high G and F♯ on the A string.',
    staves: [{
      clef: 'treble',
      voices: [
        // verse: 5th position (A B C on the E string, D E F on the A string, G G# on the C string)
        'A4/q@1%2 | C5/h@4%2 D5/q@1%1 | E5/q.@3%1 F5/e@4%1 E5/q@3%1 | D5/h@1%1 B4/q@3%2 | G4/q.@3%3 A4/e@1%2 B4/q@3%2 | ' +
        'C5/h@4%2 A4/q@1%2 | A4/q.@1%2 G#4/e@4%3 A4/q@1%2 | B4/h@3%2 G#4/q@4%3 | E4/h@0%2 A4/q@1%2 | ' +
        'C5/h@4%2 D5/q@1%1 | E5/q.@3%1 F5/e@4%1 E5/q@3%1 | D5/h@1%1 B4/q@3%2 | G4/q.@3%3 A4/e@1%2 B4/q@3%2 | ' +
        'C5/q.@4%2 B4/e@3%2 A4/q@1%2 | G#4/q.@4%3 F#4/e@2%3 G#4/q@4%3 | A4/h.@1%2~ | A4/h. | ' +
        // chorus: 7th position (E F# G on the A string, B C D on the E string, G G# A on the C string)
        'G5/h.@4%1 | G5/q.@4%1 F#5/e@3%1 E5/q@1%1 | D5/h@4%2 B4/q@1%2 | G4/q.@1%3 A4/e@3%3 B4/q@1%2 | ' +
        'C5/h@2%2 A4/q@3%3 | A4/q.@3%3 G#4/e@2%3 A4/q@3%3 | B4/h@1%2 G#4/q@2%3 | E4/h.@0%2 | ' +
        'G5/h.@4%1 | G5/q.@4%1 F#5/e@3%1 E5/q@1%1 | D5/h@4%2 B4/q@1%2 | G4/q.@1%3 A4/e@3%3 B4/q@1%2 | ' +
        'C5/q.@2%2 B4/e@1%2 A4/q@3%3 | G#4/q.@2%3 F#4/e@1%3 G#4/q@2%3 | A4/h.@3%3~ | A4/h |',
      ],
    }],
    chords:
      'N.C./q | Am/h. | C/h. | G/h. | Em/h. | Am/h. | F/h. | E/h. | E/h. | ' +
      'Am/h. | C/h. | G/h. | Em/h. | Am/h. | E/h. | Am/h. | Am/h. | ' +
      'C/h. | G/h. | G/h. | Em/h. | Am/h. | F/h. | E/h. | E/h. | ' +
      'C/h. | G/h. | G/h. | Em/h. | Am/h. | E/h. | Am/h. | Am/h |',
    tags: ['folk', 'minor', 'renaissance', 'positions'],
  },
  {
    id: 'uke-silent-night',
    title: 'Silent Night',
    composer: 'Franz Xaver Gruber',
    year: '1818',
    instrument: 'ukulele',
    level: 7,
    key: 'C',
    time: [6, 8],
    tempo: 76,
    blurb: 'Gruber’s carol in a gentle 6/8: feel two slow beats per bar. Shift to 5th position while the open strings ring, and reach F at the A string’s 8th fret.',
    staves: [{
      clef: 'treble',
      voices: [
        'G4/q. A4/e G4/q | E4/h. | G4/q. A4/e G4/q | E4/h. | D5/h@1%1 D5/q@1%1 | B4/h.@3%2 | C5/h@4%2 C5/q@4%2 | G4/h. | ' +
        'A4/h A4/q | C5/q.@3%1 B4/e@2%1 A4/q@0%1 | G4/q. A4/e G4/q | E4/h. | A4/h A4/q | C5/q.@3%1 B4/e@2%1 A4/q@0%1 | G4/q. A4/e G4/q | E4/h. | ' +
        'D5/h@1%1 D5/q@1%1 | F5/q.@4%1 D5/e@1%1 B4/q@3%2 | C5/h.@4%2 | E5/h.@3%1 | C5/q.@4%2 G4/e E4/q | G4/q. F4/e@1%2 D4/q@2%3 | C4/h.~ | C4/h. |',
      ],
    }],
    chords:
      'C/h. | C/h. | C/h. | C/h. | G7/h. | G7/h. | C/h. | C/h. | ' +
      'F/h. | F/h. | C/h. | C/h. | F/h. | F/h. | C/h. | C/h. | ' +
      'G7/h. | G7/h. | C/h. | C/h. | C/h. | G7/h. | C/h. | C/h. |',
    tags: ['holiday', '6/8', 'positions'],
  },
  {
    id: 'uke-double-stop-serenade',
    title: 'Double-Stop Serenade',
    composer: 'Clef Coach Original',
    instrument: 'ukulele',
    level: 8,
    key: 'C',
    time: [4, 4],
    tempo: 72,
    blurb: 'An original study in thirds and sixths: two strings at once in first position, then up the neck in the second half. Pinch both strings with thumb and finger.',
    staves: [{
      clef: 'treble',
      voices: [
        // first position
        '[E4 G4]/q [F4 A4]@1,0%2,1 [E4 G4]/h | [D4 F4]/q [E4 G4] [D4 F4]/h | ' +
        '[D4 B4]/q@2,3%3,1 [E4 C5]@0,3%2,1 [C4 A4] [D4 B4]@2,3%3,1 | [E4 C5]/w@0,3%2,1 | ' +
        '[F4 A4]/q@1,0%2,1 [G4 B4] [A4 C5]/h | [G4 B4]/q [F4 A4]@1,0%2,1 [E4 G4]/h | ' +
        '[D4 F4]/q [F4 A4]@1,0%2,1 [D4 B4]@2,3%3,1 [F4 B4]@1,2%2,1 | [C4 E4 G4 C5]/w | ' +
        // fifth position
        '[F4 D5]/q@1,1%3,1 [G4 E5]@3,4%3,1 [F4 D5]/h@1,1%3,1 | [B4 D5]/q@3,1%2,1 [C5 E5]@4,3%2,1 [B4 D5]/h@3,1%2,1 | ' +
        '[F4 A4]/q@1,1%3,2 [G4 B4]@3,4%3,2 [A4 C5]@1,1%2,4 [B4 D5]@3,1%2,1 | [C5 E5]/w@4,3%2,1 | ' +
        '[G4 E5]/q@3,4%3,1 [F4 D5]@1,1%3,1 [E4 C5]@0,1%2,4 [D4 B4]@2,3%3,1 | [C4 A4]/h [F4 A4]/h@1,0%2,1 | ' +
        '[D4 B4]/h@2,3%3,1 [F4 B4]/h@1,2%2,1 | [C4 E4 G4 C5]/w@0,0,0,3 |',
      ],
    }],
    chords:
      'C/w | G7/w | G7/q C/q Am/q G7/q | C/w | F/w | G7/h C/h | G7/w | C/w | ' +
      'Dm/q C/q Dm/h | G7/q C/q G7/h | F/q G7/q Am/q G7/q | C/w | C/q Dm/q C/q G7/q | Am/h F/h | G7/w | C/w |',
    tags: ['original', 'double stops', 'positions'],
  },
];
