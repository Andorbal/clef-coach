import type { SongDef } from '../../music/parse';

/**
 * Double bass song library. All pitches are SOUNDING pitches: the open strings are
 * E1 A1 D2 G2 (strings 4..1), exactly like a bass guitar's. The bass8vb clef draws them
 * an octave higher, which is how double bass parts are written: the open E sits on the
 * ledger line below the staff.
 *
 * Fingering follows Simandl (fingers 1, 2 and 4 over a whole tone) and is left to the
 * fingering engine, except in the high-position song, where every note says its string
 * and finger. Tokens may carry the left-hand finger (`@n`, 0 = open) and the string
 * (`%n`). Everything stays between the open E (E1) and E on the G string in fourth
 * position (E3), well clear of a 4-string bass's lowest note.
 *
 * Public-domain tunes only (folk songs, hymns, Pachelbel, Mozart, Beethoven, Dvořák and
 * Grieg, arranged for the bass's range) and Clef Coach originals.
 */
export const DOUBLEBASS: SongDef[] = [
  // ------------------------------------------------------------------ Level 1
  {
    id: 'doublebass-long-tones',
    title: 'Long Tones',
    composer: 'Clef Coach Original',
    instrument: 'doublebass',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 60,
    blurb: 'Whole notes on the four open strings, bowed. Use the whole bow for each note, keep it halfway between the bridge and the end of the fingerboard, and listen for a steady, buzzing tone.',
    staves: [{
      clef: 'bass8vb',
      voices: ['E1/w | A1/w | D2/w | A1/w | G2/w | D2/w | A1/w | E1/w |'],
    }],
    chords: 'Em/w | Am/w | Dm/w | Am/w | G/w | Dm/w | Am/w | Em/w |',
    tags: ['original', 'open strings', 'bowing'],
  },
  {
    id: 'doublebass-open-string-stroll',
    title: 'Open-String Stroll',
    composer: 'Clef Coach Original',
    instrument: 'doublebass',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 84,
    blurb: 'A walking line on the open strings, plucked. Pull the side of your index finger across the string near the end of the fingerboard and let each note ring its full length.',
    staves: [{
      clef: 'bass8vb',
      voices: ['E1/q E1 A1 A1 | D2/q D2 A1/h | A1/q A1 D2 D2 | G2/q G2 D2/h | G2/q D2 A1 D2 | A1/q E1 A1/h | D2/q A1 D2 A1 | E1/w |'],
    }],
    chords: 'Em/h Am/h | Dm/w | Am/h Dm/h | G/w | G/h Dm/h | Am/w | Dm/h Am/h | Em/w |',
    tags: ['original', 'open strings', 'pizzicato'],
  },
  {
    id: 'doublebass-hot-cross-buns',
    title: 'Hot Cross Buns',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'doublebass',
    level: 1,
    key: 'G',
    time: [4, 4],
    tempo: 84,
    blurb: 'The old street cry in half position: B with the 2nd finger on the A string, the open A, and G with the 4th finger on the E string.',
    staves: [{
      clef: 'bass8vb',
      voices: ['B1/q A1 G1/h | B1/q A1 G1/h | G1/e G1 G1 G1 A1 A1 A1 A1 | B1/q A1 G1/h |'],
    }],
    chords: 'G/w | G/w | G/h D/h | G/q D/q G/h |',
    tags: ['folk', 'half position'],
  },
  // ------------------------------------------------------------------ Level 2–3
  {
    id: 'doublebass-ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    year: '1824',
    arranger: 'Clef Coach',
    instrument: 'doublebass',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 76,
    blurb: 'Beethoven’s melody in C major, in half position on the A and D strings. The dotted rhythm at the end of each line wants a slightly longer bow on the dotted note.',
    staves: [{
      clef: 'bass8vb',
      voices: ['E2/q E2 F2 G2 | G2 F2 E2 D2 | C2 C2 D2 E2 | E2/q. D2/e D2/h | E2/q E2 F2 G2 | G2 F2 E2 D2 | C2 C2 D2 E2 | D2/q. C2/e C2/h |'],
    }],
    chords: 'C/w | G/w | C/w | C/h G/h | C/w | G/w | C/w | G/h C/h |',
    tags: ['classical', 'half position', 'dotted rhythm'],
  },
  {
    id: 'doublebass-when-the-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American)',
    year: 'Traditional',
    instrument: 'doublebass',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 96,
    pickup: 'h.',
    blurb: 'The New Orleans tune, plucked: C on the A string, E and F on the D string, and the open G. Stop each note before the rests by easing your finger off the string.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'C2/q E2 F2 | G2/w | r/q C2 E2 F2 | G2/w | r/q C2 E2 F2 | G2/h E2/h | C2/h E2/h | D2/w | ' +
        'r/q E2 E2 D2 | C2/h. C2/q | E2/h G2/h | G2/q F2/h. | r/h E2/q F2 | G2/h E2/h | C2/h D2/h | C2/w |',
      ],
    }],
    chords: 'N.C./h. | C/w | C/w | C/w | C/w | C/w | C/w | G7/w | G7/w | C/w | C7/w | F/w | F/h C/h | C/w | C/h G7/h | C/w |',
    tags: ['folk', 'pickup', 'rests', 'pizzicato'],
  },
  {
    id: 'doublebass-twinkle-in-f',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional (French)',
    year: '1761 melody',
    instrument: 'doublebass',
    level: 3,
    key: 'F',
    time: [4, 4],
    tempo: 80,
    blurb: 'The nursery tune down in F major, in half position: F on the E string, B♭ on the A string, both with the 1st finger.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'F1/q F1 C2 C2 | D2 D2 C2/h | Bb1/q Bb1 A1 A1 | G1 G1 F1/h | C2/q C2 Bb1 Bb1 | A1 A1 G1/h | ' +
        'C2/q C2 Bb1 Bb1 | A1 A1 G1/h | F1/q F1 C2 C2 | D2 D2 C2/h | Bb1/q Bb1 A1 A1 | G1 G1 F1/h |',
      ],
    }],
    chords: 'F/w | Bb/h F/h | Bb/h F/h | C/h F/h | F/h Bb/h | F/h C/h | F/h Bb/h | F/h C/h | F/w | Bb/h F/h | Bb/h F/h | C/h F/h |',
    tags: ['folk', 'key of F', 'half position'],
  },
  {
    id: 'doublebass-goin-home',
    title: 'Goin’ Home (Largo)',
    composer: 'Antonín Dvořák',
    year: '1893',
    arranger: 'Clef Coach',
    instrument: 'doublebass',
    level: 3,
    key: 'D',
    time: [4, 4],
    tempo: 58,
    blurb: 'The slow theme from the “New World” Symphony in first position: F♯ with the 4th finger on the D string. Long, heavy bows; let the bass sing.',
    staves: [{
      clef: 'bass8vb',
      voices: ['F#2/q A2 A2/h | F#2/q E2 D2/h | E2/q F#2 A2 F#2 | E2/w | F#2/q A2 A2/h | F#2/q E2 D2/h | E2/q F#2 E2 D2 | D2/w |'],
    }],
    chords: 'D/w | D/w | D/w | A/w | D/w | D/w | A/w | D/w |',
    tags: ['classical', 'first position', 'slow'],
  },
  // ------------------------------------------------------------------ Level 4–5
  {
    id: 'doublebass-canon-ground',
    title: 'Canon in D (ground bass)',
    composer: 'Johann Pachelbel',
    year: 'c. 1690',
    arranger: 'Clef Coach',
    instrument: 'doublebass',
    level: 4,
    key: 'D',
    time: [4, 4],
    tempo: 66,
    blurb: 'The bass line the whole Canon is built on, in first position: slow halves, then the same notes filled in with their thirds. Pachelbel’s second D lies below the open E, so it jumps up to the open D string here.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/h A1 | B1/h F#1 | G1/h D2 | G1/h A1 | ' +
        'D2/q F#2 A1 C#2 | B1 D2 F#1 A1 | G1 B1 D2 B1 | G1 B1 A1 C#2 | ' +
        'D2/h A1 | B1/h F#1 | G1/h D2 | G1/h A1 | D2/w |',
      ],
    }],
    chords: 'D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/w |',
    tags: ['baroque', 'ground bass', 'first position'],
  },
  {
    id: 'doublebass-beethoven-five',
    title: 'Symphony No. 5 — the opening motif',
    composer: 'Ludwig van Beethoven',
    year: '1808',
    arranger: 'Clef Coach',
    instrument: 'doublebass',
    level: 4,
    key: 'Cm',
    time: [2, 4],
    tempo: 108,
    blurb: 'Short–short–short–long: the four notes the whole orchestra hits together, then the motif climbing (arranged). Hold the long notes for their full length, with the bow still moving.',
    staves: [{
      clef: 'bass8vb',
      voices: ['r/e G2 G2 G2 | Eb2/h~ | Eb2/h | r/e F2 F2 F2 | D2/h~ | D2/h~ | D2/h | r/e G2 G2 G2 | Eb2/q r/q | r/e Ab2 Ab2 Ab2 | G2/q r/q | r/e Eb2 Eb2 Eb2 | C2/h~ | C2/h |'],
    }],
    tags: ['classical', 'minor', 'flats', 'half position'],
  },
  {
    id: 'doublebass-bb-march',
    title: 'B♭ March',
    composer: 'Clef Coach Original',
    instrument: 'doublebass',
    level: 4,
    key: 'Bb',
    time: [4, 4],
    tempo: 92,
    blurb: 'A brass-band march for the bass in B♭ major, all in half position: B♭, E♭ and F with the 1st finger, C and F with the 4th.',
    staves: [{
      clef: 'bass8vb',
      voices: ['Bb1/q D2 F2 D2 | Eb2/q G2 F2/h | D2/q F2 Bb1 D2 | C2/h F1/h | Bb1/q C2 D2 Eb2 | F2/q G2 A2 Bb2 | F2/q Eb2 D2 C2 | Bb1/w |'],
    }],
    chords: 'Bb/w | Eb/h Bb/h | Bb/w | F/w | Bb/w | Eb/h F/h | F7/w | Bb/w |',
    tags: ['original', 'key of B♭', 'half position'],
  },
  {
    id: 'doublebass-amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditional (“New Britain”)',
    year: '1835',
    instrument: 'doublebass',
    level: 5,
    key: 'F',
    time: [3, 4],
    tempo: 76,
    pickup: 'q',
    blurb: 'The hymn in F major. The high C is on the G string, reached by shifting up to second position: slide on the string, and move the thumb with the hand.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'C2/q | F2/h A2/e F2/e | A2/h G2/q | F2/h D2/q | C2/h C2/q | F2/h A2/e F2/e | A2/h G2/q | C3/h.~ | C3/h A2/q | ' +
        'C3/h A2/e F2/e | A2/h G2/q | F2/h D2/q | C2/h C2/q | F2/h A2/e F2/e | A2/h G2/q | F2/h.~ | F2/h |',
      ],
    }],
    chords: 'N.C./q | F/h. | F/h. | Bb/h. | F/h. | F/h. | F/h. | C/h. | C7/h. | F/h. | F/h. | Bb/h. | F/h. | Dm/h. | C7/h. | F/h. | F/h |',
    tags: ['hymn', 'waltz', 'pickup', 'shifting'],
  },
  {
    id: 'doublebass-greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English)',
    year: 'c. 1580',
    instrument: 'doublebass',
    level: 5,
    key: 'Am',
    time: [3, 4],
    tempo: 84,
    pickup: 'q',
    blurb: 'The Tudor ballad in A minor, low and dark. G♯ is the 4th finger in first position on the E string; the F♯ below it is the 1st.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'A1/q | C2/h D2/q | E2/q. F2/e E2/q | D2/h B1/q | G1/q. A1/e B1/q | C2/h A1/q | A1/q. G#1/e A1/q | B1/h G#1/q | E1/h A1/q | ' +
        'C2/h D2/q | E2/q. F2/e E2/q | D2/h B1/q | G1/q. A1/e B1/q | C2/q. B1/e A1/q | G#1/q. F#1/e G#1/q | A1/h |',
      ],
    }],
    chords: 'N.C./q | Am/h. | C/h. | G/h. | Em/h. | Am/h. | F/h. | E/h. | E/h. | Am/h. | C/h. | G/h. | Em/h. | Am/h. | E/h. | Am/h |',
    tags: ['folk', 'minor', 'pickup'],
  },
  {
    id: 'doublebass-rowing-jig',
    title: 'Rowing Jig',
    composer: 'Clef Coach Original',
    instrument: 'doublebass',
    level: 5,
    key: 'D',
    time: [6, 8],
    tempo: 66,
    blurb: 'A rolling 6/8 tune in D major: two big beats per bar, long–short, long–short. Down-bow on each big beat.',
    staves: [{
      clef: 'bass8vb',
      voices: ['D2/q A1/e D2/q F#2/e | A2/q F#2/e D2/q. | E2/q B1/e E2/q G2/e | F#2/q E2/e D2/q. | D2/q A1/e D2/q F#2/e | A2/q B2/e A2/q F#2/e | G2/q E2/e C#2/q E2/e | D2/h. |'],
    }],
    chords: 'D/h. | D/h. | Em/h. | D/h. | D/h. | D/h. | A7/h. | D/h. |',
    tags: ['original', '6/8', 'first position'],
  },
  // ------------------------------------------------------------------ Level 6–8
  {
    id: 'doublebass-mountain-king',
    title: 'In the Hall of the Mountain King',
    composer: 'Edvard Grieg',
    year: '1875',
    arranger: 'Clef Coach',
    instrument: 'doublebass',
    level: 6,
    key: 'Bm',
    time: [4, 4],
    tempo: 100,
    blurb: 'From Peer Gynt, in Grieg’s own B minor. In the orchestra the basses and cellos creep in with this tune, plucked, and it lies perfectly in first position: 1, 2 and 4 on every string.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'B1/e C#2 D2 E2 F#2 D2 F#2/q | F2/e C#2 F2/q E2/e C2 E2/q | B1/e C#2 D2 E2 F#2 D2 F#2 B2 | A2/e F#2 D2 F#2 A2/h | ' +
        'B1/e C#2 D2 E2 F#2 D2 F#2/q | F2/e C#2 F2/q E2/e C2 E2/q | B1/e C#2 D2 E2 F#2 D2 F#2 B2 | A2/h r/h |',
      ],
    }],
    tags: ['romantic', 'minor', 'pizzicato', 'first position'],
  },
  {
    id: 'doublebass-scarborough-fair',
    title: 'Scarborough Fair',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'doublebass',
    level: 6,
    key: 'Dm',
    time: [3, 4],
    tempo: 80,
    blurb: 'The English ballad in D Dorian. The second line climbs to C and D on the G string: third position, with the 1st finger on C and the 4th on D.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/h D2/q | A2/h A2/e A2/e | E2/q. F2/e E2/q | D2/h. | r/q A2/q C3/q | D3/h C3/q | A2/q B2/q G2/q | A2/h. | ' +
        'D3/h D3/q | D3/h C3/e A2/e | A2/q. G2/e F2/q | C2/h. | r/q D2/q A2/q | G2/h F2/q | E2/q D2/q C2/q | D2/h. |',
      ],
    }],
    chords: 'Dm/h. | Dm/h. | C/h. | Dm/h. | F/h. | Dm/h. | G/h. | Dm/h. | Dm/h. | Dm/h. | F/h. | C/h. | Dm/h. | C/h. | C/h. | Dm/h. |',
    tags: ['folk', 'dorian', 'minor', 'third position'],
  },
  {
    id: 'doublebass-walking-blues-in-f',
    title: 'Walking Blues in F',
    composer: 'Clef Coach Original',
    instrument: 'doublebass',
    level: 7,
    key: 'F',
    time: [4, 4],
    tempo: 104,
    blurb: 'A 12-bar blues walked in steady quarter notes, plucked: chord tones on the strong beats, and a note a semitone away from the next root on beat 4. Swing it, and land every bar line.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'F1/q A1 C2 B1 | Bb1/q D2 F2 E2 | F2/q C2 A1 C2 | F1/q A1 C2 A1 | Bb1/q D2 F2 D2 | Bb1/q A1 Ab1 Gb1 | F1/q A1 C2 D2 | F2/q Eb2 D2 Db2 | ' +
        'C2/q E2 G2 B1 | Bb1/q D2 F2 F#1 | F1/q A1 Bb1 B1 | C2/q E2 G1 E1 | F1/w |',
      ],
    }],
    chords: 'F7/w | Bb7/w | F7/w | F7/w | Bb7/w | Bb7/w | F7/w | F7/w | C7/w | Bb7/w | F7/w | C7/w | F7/w |',
    tags: ['original', 'blues', 'walking bass', 'pizzicato'],
  },
  {
    id: 'doublebass-eine-kleine',
    title: 'Eine kleine Nachtmusik (opening)',
    composer: 'Wolfgang Amadeus Mozart',
    year: '1787',
    arranger: 'Clef Coach',
    instrument: 'doublebass',
    level: 7,
    key: 'G',
    time: [4, 4],
    tempo: 112,
    blurb: 'Mozart’s fanfare, played by the whole string section together, here up on the G string: shift to third position for the high C and D, and keep the rests crisp.',
    staves: [{
      clef: 'bass8vb',
      voices: ['G2/q r/e D2/e G2/q r/e D2/e | G2/e D2 G2 B2 D3/q r/q | C3/q r/e A2/e C3/q r/e A2/e | C3/e A2 F#2 A2 D2/q r/q | G2/w |'],
    }],
    chords: 'G/w | G/w | D7/w | D7/w | G/w |',
    tags: ['classical', 'arpeggios', 'third position'],
  },
  {
    id: 'doublebass-high-on-the-neck',
    title: 'High on the Neck',
    composer: 'Clef Coach Original',
    instrument: 'doublebass',
    level: 8,
    key: 'Em',
    time: [4, 4],
    tempo: 72,
    blurb: 'A song in fourth position: the 1st finger on the 7th semitone of each string (B, E, A and D), the 4th two semitones higher. Every note shows its string and finger.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'E2/q@1%3 F#2@4%3 A2@1%2 B2@4%2 | D3/h@1%1 E3/h@4%1 | D3/q@1%1 B2@4%2 A2@1%2 F#2@4%3 | E2/w@1%3 | ' +
        'B1/q@1%4 C#2@4%4 E2@1%3 F#2@4%3 | A2/h@1%2 B2/h@4%2 | A2/q@1%2 F#2@4%3 D3@1%1 B2@4%2 | E2/w@1%3 |',
      ],
    }],
    chords: 'Em/w | Em/w | Bm/w | Em/w | A/w | D/w | Bm/w | Em/w |',
    tags: ['original', 'fourth position', 'shifting'],
  },
];
