import type { SongDef } from '../../music/parse';

/**
 * Cello song library. The cello sounds as written, in the bass clef: the open strings are
 * A3 D3 G2 C2 (strings 1..4), and first position puts the 1st finger a tone above each
 * open string, a semitone per finger (frets 2, 3, 4 and 5).
 *
 * Fingering and strings are left to the fingering engine except where the choice is the
 * point: the extensions (a 4th finger stretched to the 6th fret, a 1st finger reaching
 * back to the 1st), the shift to fourth position and the tenor-clef song. Tokens may carry
 * the left-hand finger (`@n`, 0 = open) and the string (`%n`). Every melody stays between
 * the open C (C2) and F4 in fourth position on the A string.
 *
 * Public-domain tunes only: folk songs, hymns, and Bach, Mozart, Beethoven, Dvořák and
 * Grieg, arranged for the cello's range; the rest are Clef Coach originals.
 */
export const CELLO: SongDef[] = [
  // ------------------------------------------------------------------ Level 1
  {
    id: 'cello-open-string-march',
    title: 'Open-String March',
    composer: 'Clef Coach Original',
    instrument: 'cello',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 76,
    blurb: 'A march on the four open strings, C, G, D and A. No left hand at all: let the bow do the work, a full stroke on each half note.',
    staves: [{
      clef: 'bass',
      voices: ['C2/q C2 G2 G2 | D3/h G2/h | A3/q A3 D3 D3 | G2/w | C2/q G2 D3 A3 | A3/h D3/h | G2/q D3 G2 G2 | C2/w |'],
    }],
    chords: 'C/w | G/w | Dm/w | G/w | C/w | Dm/w | G/w | C/w |',
    tags: ['original', 'open strings'],
  },
  {
    id: 'cello-hot-cross-buns',
    title: 'Hot Cross Buns',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'cello',
    level: 1,
    key: 'D',
    time: [4, 4],
    tempo: 84,
    blurb: 'The old street cry on the D string: open D, E with the 1st finger and F♯ with the 3rd. Short, even bows on the eighth notes.',
    staves: [{
      clef: 'bass',
      voices: ['F#3/q E3 D3/h | F#3/q E3 D3/h | D3/e D3 D3 D3 E3 E3 E3 E3 | F#3/q E3 D3/h |'],
    }],
    chords: 'D/w | D/w | D/h A/h | D/q A/q D/h |',
    tags: ['folk', 'D string'],
  },
  {
    id: 'cello-mary-had-a-little-lamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional (American)',
    year: '1830s',
    instrument: 'cello',
    level: 1,
    key: 'D',
    time: [4, 4],
    tempo: 84,
    blurb: 'The nursery tune in D major, mostly on the D string, with one trip across to the open A.',
    staves: [{
      clef: 'bass',
      voices: ['F#3/q E3 D3 E3 | F#3 F#3 F#3/h | E3/q E3 E3/h | F#3/q A3 A3/h | F#3/q E3 D3 E3 | F#3 F#3 F#3 F#3 | E3 E3 F#3 E3 | D3/w |'],
    }],
    chords: 'D/w | D/w | A/w | D/w | D/w | D/w | A/w | D/w |',
    tags: ['folk', 'D string'],
  },
  // ------------------------------------------------------------------ Level 2
  {
    id: 'cello-lightly-row',
    title: 'Lightly Row',
    composer: 'Traditional (German)',
    year: 'Traditional',
    instrument: 'cello',
    level: 2,
    key: 'D',
    time: [4, 4],
    tempo: 88,
    blurb: 'A German children’s song (“Hänschen klein”) on the D and A strings: every note of the D major pattern, 1, 3 and 4 on each string.',
    staves: [{
      clef: 'bass',
      voices: [
        'A3/q F#3 F#3/h | G3/q E3 E3/h | D3/q E3 F#3 G3 | A3 A3 A3/h | A3/q F#3 F#3/h | G3/q E3 E3/h | D3/q F#3 A3 A3 | F#3/w | ' +
        'E3/q E3 E3 E3 | E3 F#3 G3/h | F#3/q F#3 F#3 F#3 | F#3 G3 A3/h | A3/q F#3 F#3/h | G3/q E3 E3/h | D3/q F#3 A3 A3 | D3/w |',
      ],
    }],
    chords: 'D/w | A/w | D/w | D/w | D/w | A/w | D/w | D/w | A/w | A/w | D/w | D/w | D/w | A/w | D/w | D/w |',
    tags: ['folk', 'D major'],
  },
  {
    id: 'cello-ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    year: '1824',
    arranger: 'Clef Coach',
    instrument: 'cello',
    level: 2,
    key: 'D',
    time: [4, 4],
    tempo: 80,
    blurb: 'Beethoven’s tune from the Ninth Symphony in D major, with its dotted rhythm at the end of each phrase. Slow bows, a smooth change between the D and A strings.',
    staves: [{
      clef: 'bass',
      voices: ['F#3/q F#3 G3 A3 | A3 G3 F#3 E3 | D3 D3 E3 F#3 | F#3/q. E3/e E3/h | F#3/q F#3 G3 A3 | A3 G3 F#3 E3 | D3 D3 E3 F#3 | E3/q. D3/e D3/h |'],
    }],
    chords: 'D/w | A/w | D/w | D/h A/h | D/w | A/w | D/w | A/h D/h |',
    tags: ['classical', 'D major', 'dotted rhythm'],
  },
  {
    id: 'cello-twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional (French)',
    year: '1761 melody',
    instrument: 'cello',
    level: 2,
    key: 'G',
    time: [4, 4],
    tempo: 84,
    blurb: 'The tune Mozart wrote variations on, in G major on the G and D strings: A, B and C with fingers 1, 3 and 4 on the G string.',
    staves: [{
      clef: 'bass',
      voices: [
        'G2/q G2 D3 D3 | E3 E3 D3/h | C3/q C3 B2 B2 | A2 A2 G2/h | D3/q D3 C3 C3 | B2 B2 A2/h | ' +
        'D3/q D3 C3 C3 | B2 B2 A2/h | G2/q G2 D3 D3 | E3 E3 D3/h | C3/q C3 B2 B2 | A2 A2 G2/h |',
      ],
    }],
    chords: 'G/w | C/h G/h | C/h G/h | D/h G/h | G/h C/h | G/h D/h | G/h C/h | G/h D/h | G/w | C/h G/h | C/h G/h | D/h G/h |',
    tags: ['folk', 'G string'],
  },
  // ------------------------------------------------------------------ Level 3
  {
    id: 'cello-when-the-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American)',
    year: 'Traditional',
    instrument: 'cello',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 96,
    pickup: 'h.',
    blurb: 'The New Orleans march down on the C string: C, E and F with the open, 3rd and 4th fingers, then the open G. Count the rests before each “Oh when the”.',
    staves: [{
      clef: 'bass',
      voices: [
        'C2/q E2 F2 | G2/w | r/q C2 E2 F2 | G2/w | r/q C2 E2 F2 | G2/h E2/h | C2/h E2/h | D2/w | ' +
        'r/q E2 E2 D2 | C2/h. C2/q | E2/h G2/h | G2/q F2/h. | r/h E2/q F2 | G2/h E2/h | C2/h D2/h | C2/w |',
      ],
    }],
    chords: 'N.C./h. | C/w | C/w | C/w | C/w | C/w | C/w | G7/w | G7/w | C/w | C7/w | F/w | F/h C/h | C/w | C/h G7/h | C/w |',
    tags: ['folk', 'C string', 'pickup', 'rests'],
  },
  {
    id: 'cello-goin-home',
    title: 'Goin’ Home (Largo)',
    composer: 'Antonín Dvořák',
    year: '1893',
    arranger: 'Clef Coach',
    instrument: 'cello',
    level: 3,
    key: 'D',
    time: [4, 4],
    tempo: 60,
    blurb: 'The slow theme from the “New World” Symphony, in D major on the D and A strings. Use long, slow bows and let every half note sing.',
    staves: [{
      clef: 'bass',
      voices: ['F#3/q A3 A3/h | F#3/q E3 D3/h | E3/q F#3 A3 F#3 | E3/w | F#3/q A3 A3/h | F#3/q E3 D3/h | E3/q F#3 E3 D3 | D3/w |'],
    }],
    chords: 'D/w | D/w | D/w | A/w | D/w | D/w | A/w | D/w |',
    tags: ['classical', 'D major', 'slow'],
  },
  {
    id: 'cello-frere-jacques',
    title: 'Frère Jacques',
    composer: 'Traditional (French)',
    year: '18th century',
    instrument: 'cello',
    level: 3,
    key: 'F',
    time: [4, 4],
    tempo: 88,
    blurb: 'The round in F major: B♭ on the G string is a low 2nd finger, right next to A. The eighth notes in the “morning bells” bars want small, quick bows.',
    staves: [{
      clef: 'bass',
      voices: ['F2/q G2 A2 F2 | F2 G2 A2 F2 | A2 Bb2 C3/h | A2/q Bb2 C3/h | C3/e D3 C3 Bb2 A2/q F2 | C3/e D3 C3 Bb2 A2/q F2 | F2/q C2 F2/h | F2/q C2 F2/h |'],
    }],
    chords: 'F/w | F/w | F/w | F/w | F/w | F/w | F/q C/q F/h | F/q C/q F/h |',
    tags: ['folk', 'key of F', 'eighth notes'],
  },
  {
    id: 'cello-aura-lee',
    title: 'Aura Lee',
    composer: 'George R. Poulton',
    year: '1861',
    instrument: 'cello',
    level: 3,
    key: 'G',
    time: [4, 4],
    tempo: 76,
    blurb: 'A Civil War parlour song (its tune became “Love Me Tender”), in G major on the D and A strings. F♯ is the 3rd finger, G the 4th.',
    staves: [{
      clef: 'bass',
      voices: [
        'D3/q G3 F#3 G3 | A3 E3 A3/h | G3/q F#3 E3 F#3 | G3/w | D3/q G3 F#3 G3 | A3 E3 A3/h | G3/q F#3 E3 F#3 | G3/w | ' +
        'B3/q B3 B3 B3 | B3 B3 B3/h | B3/q A3 G3 A3 | B3/w | B3/q B3 C4 B3 | A3 E3 A3/h | G3/q F#3 B3 A3 | G3/w |',
      ],
    }],
    chords: 'G/w | A7/w | D7/w | G/w | G/w | A7/w | D7/w | G/w | G/w | B7/w | Em/w | G7/w | C/w | A7/w | D7/w | G/w |',
    tags: ['folk', 'key of G'],
  },
  // ------------------------------------------------------------------ Level 4–5
  {
    id: 'cello-amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditional (“New Britain”)',
    year: '1835',
    instrument: 'cello',
    level: 4,
    key: 'F',
    time: [3, 4],
    tempo: 80,
    pickup: 'q',
    blurb: 'The hymn in F major and 3/4, rising to C on the A string. A slow, even bow on the long notes; hold the tied Cs for all five beats.',
    staves: [{
      clef: 'bass',
      voices: [
        'C3/q | F3/h A3/e F3/e | A3/h G3/q | F3/h D3/q | C3/h C3/q | F3/h A3/e F3/e | A3/h G3/q | C4/h.~ | C4/h A3/q | ' +
        'C4/h A3/e F3/e | A3/h G3/q | F3/h D3/q | C3/h C3/q | F3/h A3/e F3/e | A3/h G3/q | F3/h.~ | F3/h |',
      ],
    }],
    chords: 'N.C./q | F/h. | F/h. | Bb/h. | F/h. | F/h. | F/h. | C/h. | C7/h. | F/h. | F/h. | Bb/h. | F/h. | Dm/h. | C7/h. | F/h. | F/h |',
    tags: ['hymn', 'waltz', 'pickup', 'key of F'],
  },
  {
    id: 'cello-drunken-sailor',
    title: 'Drunken Sailor',
    composer: 'Traditional (sea shanty)',
    year: 'Traditional',
    instrument: 'cello',
    level: 4,
    key: 'Dm',
    time: [4, 4],
    tempo: 100,
    blurb: 'The shanty in D minor on the D and A strings. The repeated eighth notes are quick, small bows near the middle of the bow.',
    staves: [{
      clef: 'bass',
      voices: ['A3/q A3/e A3/e A3/q A3/e A3/e | A3/q D3 F3 A3 | G3/q G3/e G3/e G3/q G3/e G3/e | G3/q C3 E3 G3 | A3/q A3/e A3/e A3/q A3/e A3/e | A3/q B3 C4 D4 | C4/q A3 G3 E3 | D3/h D3/h |'],
    }],
    chords: 'Dm/w | Dm/w | C/w | C/w | Dm/w | Dm/w | C/h Am/h | Dm/w |',
    tags: ['folk', 'minor', 'eighth notes'],
  },
  {
    id: 'cello-scarborough-fair',
    title: 'Scarborough Fair',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'cello',
    level: 5,
    key: 'Dm',
    time: [3, 4],
    tempo: 84,
    blurb: 'The English ballad in D Dorian: a minor tune with a raised 6th, so watch for B♮ on the A string. A singing tone in the middle of the bow.',
    staves: [{
      clef: 'bass',
      voices: [
        'D3/h D3/q | A3/h A3/e A3/e | E3/q. F3/e E3/q | D3/h. | r/q A3/q C4/q | D4/h C4/q | A3/q B3/q G3/q | A3/h. | ' +
        'D4/h D4/q | D4/h C4/e A3/e | A3/q. G3/e F3/q | C3/h. | r/q D3/q A3/q | G3/h F3/q | E3/q D3/q C3/q | D3/h. |',
      ],
    }],
    chords: 'Dm/h. | Dm/h. | C/h. | Dm/h. | F/h. | Dm/h. | G/h. | Dm/h. | Dm/h. | Dm/h. | F/h. | C/h. | Dm/h. | C/h. | C/h. | Dm/h. |',
    tags: ['folk', 'dorian', 'minor', 'waltz'],
  },
  {
    id: 'cello-canon-ground',
    title: 'Canon in D (ground bass)',
    composer: 'Johann Pachelbel',
    year: 'c. 1690',
    arranger: 'Clef Coach',
    instrument: 'cello',
    level: 5,
    key: 'D',
    time: [4, 4],
    tempo: 66,
    blurb: 'The cellist’s part in Pachelbel’s Canon: the same eight notes over and over, first slow, then filled in. F♯ on the C string and C♯ on the G string are 4th-finger extensions.',
    staves: [{
      clef: 'bass',
      voices: [
        'D3/h A2 | B2/h F#2@4%4 | G2/h D2 | G2/h A2 | ' +
        'D3/q F#3 A2 C#3@4%3 | B2 D3 F#2@4%4 A2 | G2 B2 D2 F#2@4%4 | G2 B2 A2 C#3@4%3 | ' +
        'D3/h A2 | B2/h F#2@4%4 | G2/h D2 | G2/h A2 | D3/w |',
      ],
    }],
    chords: 'D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/w |',
    tags: ['baroque', 'ground bass', 'extensions'],
  },
  {
    id: 'cello-eine-kleine',
    title: 'Eine kleine Nachtmusik (opening)',
    composer: 'Wolfgang Amadeus Mozart',
    year: '1787',
    arranger: 'Clef Coach',
    instrument: 'cello',
    level: 5,
    key: 'G',
    time: [4, 4],
    tempo: 112,
    blurb: 'Mozart’s fanfare, which the whole string section plays together: up a G chord, then a D7 chord. The low F♯ is a 4th-finger extension on the C string.',
    staves: [{
      clef: 'bass',
      voices: ['G2/q r/e D2/e G2/q r/e D2/e | G2/e D2 G2 B2 D3/q r/q | C3/q r/e A2/e C3/q r/e A2/e | C3/e A2 F#2@4%4 A2 D2/q r/q | G2/w |'],
    }],
    chords: 'G/w | G/w | D7/w | D7/w | G/w |',
    tags: ['classical', 'arpeggios', 'extensions'],
  },
  // ------------------------------------------------------------------ Level 6–8
  {
    id: 'cello-minuet-in-g',
    title: 'Minuet in G',
    composer: 'Christian Petzold (attr. J. S. Bach)',
    year: 'c. 1725',
    arranger: 'Clef Coach',
    instrument: 'cello',
    level: 6,
    key: 'G',
    time: [3, 4],
    tempo: 100,
    blurb: 'From the Notebook for Anna Magdalena Bach, two octaves below the keyboard original. Light, separate bows on the eighths, and an extension for the low F♯.',
    staves: [{
      clef: 'bass',
      voices: [
        'D3/q G2/e A2 B2 C3 | D3/q G2 G2 | E3/q C3/e D3 E3 F#3 | G3/q G2 G2 | C3/q D3/e C3 B2 A2 | B2/q C3/e B2 A2 G2 | F#2/q@4%4 G2/e A2 B2 G2 | A2/h. | ' +
        'D3/q G2/e A2 B2 C3 | D3/q G2 G2 | E3/q C3/e D3 E3 F#3 | G3/q G2 G2 | C3/q D3/e C3 B2 A2 | B2/q C3/e B2 A2 G2 | A2/q B2/e A2 G2 F#2@4%4 | G2/h. |',
      ],
    }],
    chords: 'G/h. | G/h. | C/h. | G/h. | C/h. | G/h. | D/h. | D/h. | G/h. | G/h. | C/h. | G/h. | C/h. | G/h. | D/h. | G/h. |',
    tags: ['baroque', 'waltz', 'eighth notes'],
  },
  {
    id: 'cello-greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English)',
    year: 'c. 1580',
    instrument: 'cello',
    level: 6,
    key: 'Am',
    time: [3, 4],
    tempo: 88,
    pickup: 'q',
    blurb: 'The Tudor ballad in A minor. G♯ on the G string is the 1st finger reaching back; F♯ on the C string is the 4th finger stretching forward.',
    staves: [{
      clef: 'bass',
      voices: [
        'A2/q | C3/h D3/q | E3/q. F3/e E3/q | D3/h B2/q | G2/q. A2/e B2/q | C3/h A2/q | A2/q. G#2/e@1%3 A2/q | B2/h G#2/q@1%3 | E2/h A2/q | ' +
        'C3/h D3/q | E3/q. F3/e E3/q | D3/h B2/q | G2/q. A2/e B2/q | C3/q. B2/e A2/q | G#2/q.@1%3 F#2/e@4%4 G#2/q@1%3 | A2/h |',
      ],
    }],
    chords: 'N.C./q | Am/h. | C/h. | G/h. | Em/h. | Am/h. | F/h. | E/h. | E/h. | Am/h. | C/h. | G/h. | Em/h. | Am/h. | E/h. | Am/h |',
    tags: ['folk', 'minor', 'extensions', 'pickup'],
  },
  {
    id: 'cello-mountain-king',
    title: 'In the Hall of the Mountain King',
    composer: 'Edvard Grieg',
    year: '1875',
    arranger: 'Clef Coach',
    instrument: 'cello',
    level: 7,
    key: 'Bm',
    time: [4, 4],
    tempo: 100,
    blurb: 'From Peer Gynt, in Grieg’s own key of B minor: in the orchestra the cellos and basses creep in with this theme, plucked. Play it pizzicato first, then with short bows.',
    staves: [{
      clef: 'bass',
      voices: [
        'B2/e C#3@4%3 D3 E3 F#3 D3 F#3/q | F3/e C#3@4%3 F3/q E3/e C3 E3/q | B2/e C#3@4%3 D3 E3 F#3 D3 F#3 B3 | A3/e F#3 D3 F#3 A3/h | ' +
        'B2/e C#3@4%3 D3 E3 F#3 D3 F#3/q | F3/e C#3@4%3 F3/q E3/e C3 E3/q | B2/e C#3@4%3 D3 E3 F#3 D3 F#3 B3 | A3/h r/h |',
      ],
    }],
    tags: ['romantic', 'minor', 'pizzicato', 'extensions'],
  },
  {
    id: 'cello-bach-prelude',
    title: 'Prelude from Cello Suite No. 1 — opening',
    composer: 'Johann Sebastian Bach',
    year: 'c. 1720',
    instrument: 'cello',
    level: 8,
    key: 'G',
    time: [4, 4],
    tempo: 56,
    blurb: 'The first four bars of the most famous piece ever written for the cello, all in first position: the open G under rolling sixteenths. Keep the bow close to the strings and let the crossings flow.',
    staves: [{
      clef: 'bass',
      voices: [
        'G2/s D3 B3 A3 B3 D3 B3 D3 G2 D3 B3 A3 B3 D3 B3 D3 | ' +
        'G2/s E3 C4 B3 C4 E3 C4 E3 G2 E3 C4 B3 C4 E3 C4 E3 | ' +
        'G2/s F#3 C4 B3 C4 F#3 C4 F#3 G2 F#3 C4 B3 C4 F#3 C4 F#3 | ' +
        'G2/s G3 B3 A3 B3 G3 B3 G3 G2 G3 B3 A3 B3 G3 B3 F#3 | G2/w |',
      ],
    }],
    chords: 'G/w | C/G/w | D7/G/w | G/w | G/w |',
    tags: ['baroque', 'sixteenths', 'string crossings'],
  },
  {
    id: 'cello-tenor-song',
    title: 'Song in the Tenor Clef',
    composer: 'Clef Coach Original',
    instrument: 'cello',
    level: 8,
    key: 'Dm',
    time: [4, 4],
    tempo: 72,
    blurb: 'A song that climbs out of the bass clef: when the tenor clef appears, shift to fourth position (1st finger on D on the A string) and read the high notes without ledger lines.',
    staves: [{
      clef: 'bass',
      voices: [
        'D3/q F3 A3 D3 | A3/h. r/q | [C:tenor] D4/q@1%1 E4@3%1 F4@4%1 E4@3%1 | D4/h@1%1 A3/h@0%1 | Bb3/q@4%2 A3@3%2 G3@1%2 A3@3%2 | D4/w@1%1 | ' +
        'F4/q@4%1 E4@3%1 D4@1%1 E4@3%1 | F4/h@4%1 D4/h@1%1 | E4/q@3%1 D4@1%1 Bb3@4%2 A3@3%2 | G3/h@1%2 Bb3/h@4%2 | [C:bass] A3/q@0%1 F3 E3 C#3 | D3/w |',
      ],
    }],
    chords: 'Dm/w | A/w | Dm/w | Dm/w | Gm/w | Dm/w | Dm/w | Dm/w | A/w | Gm/w | A7/w | Dm/w |',
    tags: ['original', 'tenor clef', 'fourth position'],
  },
];
