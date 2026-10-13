import type { SongDef } from '../../music/parse';

/**
 * Guitar song library. All pitches are SOUNDING pitches (open strings E4 B3 G3 D3 A2 E2 = strings 1..6).
 * Treble songs use the octave-transposing guitar clef (treble8vb); bass-clef songs are written at real pitch.
 * Tokens may carry the left-hand finger (`@n`, 0 = open) and the string (`%n`).
 */

export const GUITAR_TREBLE: SongDef[] = [
  // ------------------------------------------------------------------ Level 1–2
  {
    id: 'gt-ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    year: '1824',
    instrument: 'guitar',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 72,
    blurb: 'Beethoven’s great tune from the Ninth Symphony, played on just the top two strings — open, finger 1 and finger 3.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'E4/q@0 E4@0 F4@1 G4@3 | G4@3 F4@1 E4@0 D4@3 | C4@1 C4@1 D4@3 E4@0 | E4/q.@0 D4/e@3 D4/h@3 | ' +
        'E4/q@0 E4@0 F4@1 G4@3 | G4@3 F4@1 E4@0 D4@3 | C4@1 C4@1 D4@3 E4@0 | D4/q.@3 C4/e@1 C4/h@1 |',
      ],
    }],
    tags: ['classical', 'strings 1–2'],
  },
  {
    id: 'gt-jingle-bells',
    title: 'Jingle Bells (chorus)',
    composer: 'James Lord Pierpont',
    year: '1857',
    instrument: 'guitar',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 92,
    blurb: 'The sleigh-ride chorus everyone knows, simplified to quarters, halves and wholes on the top two strings.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'E4/q@0 E4@0 E4/h@0 | E4/q@0 E4@0 E4/h@0 | E4/q@0 G4@3 C4@1 D4@3 | E4/w@0 | ' +
        'F4/q@1 F4@1 F4@1 F4@1 | F4@1 E4@0 E4@0 E4@0 | E4@0 D4@3 D4@3 E4@0 | D4/h@3 G4/h@3 | ' +
        'E4/q@0 E4@0 E4/h@0 | E4/q@0 E4@0 E4/h@0 | E4/q@0 G4@3 C4@1 D4@3 | E4/w@0 | ' +
        'F4/q@1 F4@1 F4@1 F4@1 | F4@1 E4@0 E4@0 E4@0 | G4@3 G4@3 F4@1 D4@3 | C4/w@1 |',
      ],
    }],
    tags: ['holiday', 'folk', 'strings 1–2'],
  },
  {
    id: 'gt-aura-lee',
    title: 'Aura Lee',
    composer: 'George R. Poulton',
    year: '1861',
    instrument: 'guitar',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 72,
    blurb: 'A Civil War parlour song whose melody later became “Love Me Tender” — a gentle tune over the top three strings.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'G3/q@0 C4@1 B3@0 C4@1 | D4@3 A3@2 D4/h@3 | C4/q@1 B3@0 A3@2 B3@0 | C4/w@1 | ' +
        'G3/q@0 C4@1 B3@0 C4@1 | D4@3 A3@2 D4/h@3 | C4/q@1 B3@0 A3@2 B3@0 | C4/w@1 | ' +
        'E4/q@0 E4@0 E4@0 E4@0 | E4@0 E4@0 E4/h@0 | E4/q@0 D4@3 C4@1 D4@3 | E4/w@0 | ' +
        'E4/q@0 E4@0 F4@1 E4@0 | D4@3 A3@2 D4/h@3 | C4/q@1 B3@0 A3@2 B3@0 | C4/w@1 |',
      ],
    }],
    tags: ['folk', 'strings 1–3'],
  },
  {
    id: 'gt-when-the-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American)',
    year: 'Traditional',
    instrument: 'guitar',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 96,
    pickup: 'h.',
    blurb: 'The New Orleans marching favourite. It starts with a three-note pickup — count “2 3 4” and land on G for beat one.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'C4/q@1 E4@0 F4@1 | G4/w@3 | r/q C4@1 E4@0 F4@1 | G4/w@3 | r/q C4@1 E4@0 F4@1 | G4/h@3 E4/h@0 | C4/h@1 E4/h@0 | D4/w@3 | ' +
        'r/q E4@0 E4@0 D4@3 | C4/h.@1 C4/q@1 | E4/h@0 G4/h@3 | G4/q@3 F4/h.@1 | r/h E4/q@0 F4@1 | G4/h@3 E4/h@0 | C4/h@1 D4/h@3 | C4/h.@1 |',
      ],
    }],
    tags: ['folk', 'pickup', 'strings 1–2'],
  },
  {
    id: 'gt-oh-susanna',
    title: 'Oh! Susanna',
    composer: 'Stephen Foster',
    year: '1848',
    instrument: 'guitar',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 84,
    pickup: 'q',
    blurb: 'Foster’s banjo song, played low on strings 3, 4 and 5 — eighth-note pickups and a bouncy dotted rhythm.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'C3/e@3 D3@0 | E3/q@2 G3@0 G3/q.@0 A3/e@2 | G3/q@0 E3@2 C3/q.@3 D3/e@0 | E3/q@2 E3@2 D3@0 C3@3 | D3/h.@0 C3/e@3 D3@0 | ' +
        'E3/q@2 G3@0 G3/q.@0 A3/e@2 | G3/q@0 E3@2 C3/q.@3 D3/e@0 | E3/q@2 E3@2 D3@0 D3@0 | C3/h.@3 r/q | ' +
        'F3/h@3 F3/h@3 | A3/q@2 A3/h@2 A3/q@2 | G3/q@0 G3@0 E3@2 C3@3 | D3/h.@0 C3/e@3 D3@0 | ' +
        'E3/q@2 G3@0 G3/q.@0 A3/e@2 | G3/q@0 E3@2 C3/q.@3 D3/e@0 | E3/q@2 E3@2 D3@0 D3@0 | C3/h.@3 |',
      ],
    }],
    tags: ['folk', 'pickup', 'eighth notes'],
  },
  // ------------------------------------------------------------------ Level 4–5
  {
    id: 'gt-greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English)',
    year: 'c. 1580',
    instrument: 'guitar',
    level: 4,
    key: 'Am',
    time: [3, 4],
    tempo: 84,
    pickup: 'q',
    blurb: 'The Tudor ballad in A minor, all in first position. Watch the accidentals: G♯ and F♯ lead up to A, while the chorus soars to G and F♯.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'A3/q | C4/h D4/q | E4/q. F4/e E4/q | D4/h B3/q | G3/q. A3/e B3/q | C4/h A3/q | A3/q. G#3/e A3/q | B3/h G#3/q | E3/h A3/q | ' +
        'C4/h D4/q | E4/q. F4/e E4/q | D4/h B3/q | G3/q. A3/e B3/q | C4/q. B3/e A3/q | G#3/q. F#3/e G#3/q | A3/h.~ | A3/h. | ' +
        'G4/h. | G4/q. F#4/e E4/q | D4/h B3/q | G3/q. A3/e B3/q | C4/h A3/q | A3/q. G#3/e A3/q | B3/h G#3/q | E3/h. | ' +
        'G4/h. | G4/q. F#4/e E4/q | D4/h B3/q | G3/q. A3/e B3/q | C4/q. B3/e A3/q | G#3/q. F#3/e G#3/q | A3/h.~ | A3/h |',
      ],
    }],
    tags: ['folk', 'minor', 'renaissance'],
  },
  {
    id: 'gt-house-of-the-rising-sun',
    title: 'Rising Sun (original melody)',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 4,
    key: 'Am',
    time: [6, 8],
    tempo: 66,
    blurb: 'An original 6/8 melody over the famous folk chords of “The House of the Rising Sun” (Am–C–D–F–Am–C–E). It is not the sung tune, but it rolls the same way.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'A3/q E3/e A3/q B3/e | C4/q. E4/q. | D4/q A3/e F#4/q. | F4/q E4/e C4/q. | A3/q B3/e C4/q B3/e | G3/q. E4/q. | E4/q D4/e B3/q G#3/e | B3/h. | ' +
        'A3/q C4/e E4/q E4/e | G4/q E4/e C4/q. | F#4/q E4/e D4/q A3/e | C4/q A3/e F3/q. | E3/q A3/e C4/q B3/e | G#3/q B3/e E4/q D4/e | C4/q B3/e A3/q G#3/e | A3/h. |',
      ],
    }],
    tags: ['original', '6/8', 'minor'],
  },
  {
    id: 'gt-scarborough-fair',
    title: 'Scarborough Fair',
    composer: 'Traditional (English)',
    year: 'Traditional',
    instrument: 'guitar',
    level: 5,
    key: 'Em',
    time: [3, 4],
    tempo: 80,
    blurb: 'The haunting English ballad in E Dorian — a minor key with a bright C♯. Let every note ring like a harp.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'E3/h E3/q | B3/h B3/e B3/e | F#3/q. G3/e F#3/q | E3/h. | r/q B3/q D4/q | E4/h D4/q | B3/q C#4/q A3/q | B3/h. | ' +
        'E4/h E4/q | E4/h D4/e B3/e | B3/q. A3/e G3/q | D3/h. | r/q E3/q B3/q | A3/h G3/q | F#3/q E3/q D3/q | E3/h. |',
      ],
    }],
    tags: ['folk', 'dorian', 'waltz'],
  },
];

export const GUITAR_BASS: SongDef[] = [];
