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
    chords: 'C/w | G7/w | C/w | C/h G7/h | C/w | G7/w | C/w | G7/h C/h |',
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
    tempo: 88,
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
    tempo: 88,
    pickup: 'h.',
    blurb: 'The New Orleans marching favourite. It starts with a three-note pickup — count “2 3 4” and land on G for beat one.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'C4/q@1 E4@0 F4@1 | G4/w@3 | r/q C4@1 E4@0 F4@1 | G4/w@3 | r/q C4@1 E4@0 F4@1 | G4/h@3 E4/h@0 | C4/h@1 E4/h@0 | D4/w@3 | ' +
        'r/q E4@0 E4@0 D4@3 | C4/h.@1 C4/q@1 | E4/h@0 G4/h@3 | G4/q@3 F4/h.@1 | r/h E4/q@0 F4@1 | G4/h@3 E4/h@0 | C4/h@1 D4/h@3 | C4/w@1 |',
      ],
    }],
    chords: 'N.C./h. | C/w | C/w | C/w | C/w | C/w | C/w | G7/w | G7/w | C/w | C7/w | F/w | F/h C/h | C/w | C/h G7/h | C/w |',
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
    chords: 'N.C./q | C/w | C/w | C/w | G7/w | C/w | C/w | C/h G7/h | C/w | F/w | F/w | C/w | G7/w | C/w | C/w | C/h G7/h | C/h. |',
    tags: ['folk', 'pickup', 'eighth notes'],
  },
  // ------------------------------------------------------------------ Originals, Level 1–2
  {
    id: 'gt-first-light',
    title: 'First Light',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 66,
    blurb: 'Your very first tune: just E, F and G on the 1st string — open, finger 1, finger 3.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'E4/q@0 F4@1 G4/h@3 | G4/q@3 F4@1 E4/h@0 | E4/q@0 E4@0 F4@1 F4@1 | G4/w@3 | ' +
        'G4/q@3 G4@3 F4@1 E4@0 | F4/h@1 G4/h@3 | F4/q@1 E4@0 F4@1 G4@3 | E4/w@0 |',
      ],
    }],
    tags: ['original', 'string 1'],
  },
  {
    id: 'gt-sunrise-waltz',
    title: 'Sunrise Waltz',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 1,
    key: 'C',
    time: [3, 4],
    tempo: 76,
    blurb: 'A gentle one-string waltz: count “ONE two three” and let the long notes ring for all three beats.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'E4/h@0 F4/q@1 | G4/h.@3 | F4/h@1 E4/q@0 | F4/h.@1 | E4/q@0 F4@1 G4@3 | G4/h@3 F4/q@1 | E4/q@0 F4@1 F4@1 | E4/h.@0 |',
      ],
    }],
    tags: ['original', 'string 1', 'waltz'],
  },
  {
    id: 'gt-little-march',
    title: 'Little March',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 72,
    blurb: 'Step smartly between the top two strings: B, C and D on the 2nd string, E, F and G on the 1st.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'C4/q@1 D4@3 E4/h@0 | D4/q@3 C4@1 B3/h@0 | C4/q@1 E4@0 G4/h@3 | F4/q@1 E4@0 D4/h@3 | ' +
        'C4/q@1 D4@3 E4@0 F4@1 | G4/q@3 F4@1 E4@0 D4@3 | E4/q@0 D4@3 B3@0 D4@3 | C4/w@1 |',
      ],
    }],
    tags: ['original', 'strings 1–2'],
  },
  {
    id: 'gt-evening-bells',
    title: 'Evening Bells',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 2,
    key: 'C',
    time: [3, 4],
    tempo: 80,
    blurb: 'Bells ringing across a valley in waltz time. The rests are part of the tune — stop the string and count them.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'G4/q@3 E4@0 C4@1 | D4/h@3 r/q | E4/q@0 F4@1 G4@3 | E4/h.@0 | F4/q@1 D4@3 B3@0 | C4/h@1 r/q | D4/q@3 E4@0 D4@3 | B3/h.@0 | ' +
        'G4/q@3 E4@0 C4@1 | D4/h@3 r/q | E4/q@0 F4@1 G4@3 | F4/h.@1 | E4/q@0 D4@3 B3@0 | D4/h@3 E4/q@0 | D4/q@3 B3@0 D4@3 | C4/h.@1 |',
      ],
    }],
    tags: ['original', 'strings 1–2', 'rests', 'waltz'],
  },
  {
    id: 'gt-garden-stroll',
    title: 'Garden Stroll',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 80,
    blurb: 'An easy-going walk over three strings, from open G up to high G — finger 2 meets A on the 3rd string.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'G3/q@0 A3@2 B3@0 C4@1 | D4/h@3 B3/h@0 | C4/q@1 A3@2 G3@0 A3@2 | B3/w@0 | E4/q@0 D4@3 C4@1 B3@0 | A3/h@2 C4/h@1 | B3/q@0 A3@2 B3@0 D4@3 | G3/w@0 | ' +
        'A3/q@2 B3@0 C4@1 A3@2 | B3/q@0 C4@1 D4/h@3 | E4/q@0 F4@1 G4@3 E4@0 | D4/w@3 | C4/q@1 E4@0 D4@3 B3@0 | A3/q@2 C4@1 B3@0 G3@0 | A3/q@2 B3@0 D4@3 B3@0 | C4/w@1 |',
      ],
    }],
    tags: ['original', 'strings 1–3'],
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
    chords: 'N.C./q | Am/h. | C/h. | G/h. | Em/h. | Am/h. | F/h. | E/h. | E/h. | ' +
      'Am/h. | C/h. | G/h. | Em/h. | Am/h. | E/h. | Am/h. | Am/h. | ' +
      'C/h. | G/h. | G/h. | Em/h. | Am/h. | F/h. | E/h. | E/h. | ' +
      'C/h. | G/h. | G/h. | Em/h. | Am/h. | E/h. | Am/h. | Am/h |',
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
    chords: 'Em/h. | Em/h. | D/h. | Em/h. | G/h. | Em/h. | A/h. | Em/h. | Em/h. | Em/h. | G/h. | D/h. | Em/h. | D/h. | D/h. | Em/h. |',
    tags: ['folk', 'dorian', 'waltz'],
  },
  // ------------------------------------------------------------------ Level 6–7 (two voices, up the neck)
  {
    id: 'gt-romanza',
    title: 'Romanza (Spanish Romance) — opening',
    composer: 'Anonymous',
    year: '19th century',
    instrument: 'guitar',
    level: 6,
    key: 'Em',
    time: [3, 4],
    tempo: 60,
    blurb: 'The first eight bars of the beloved Spanish Romance: a melody on the 1st string, open B and G rippling in triplets, and an open bass under it all. Bars 7–8 use a half barre at the 5th fret.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'B4/e3@4%1 B3@0%2 G3@0%3 B4@4%1 B3@0%2 G3@0%3 B4@4%1 B3@0%2 G3@0%3 | ' +
        'B4@4%1 B3@0%2 G3@0%3 A4@2%1 B3@0%2 G3@0%3 G4@1%1 B3@0%2 G3@0%3 | ' +
        'G4@3%1 B3@0%2 G3@0%3 F#4@2%1 B3@0%2 G3@0%3 E4@0%1 B3@0%2 G3@0%3 | ' +
        'E4@0%1 B3@0%2 G3@0%3 G4@1%1 B3@0%2 G3@0%3 B4@4%1 B3@0%2 G3@0%3 | ' +
        'E5@4%1 B3@0%2 G3@0%3 E5@4%1 B3@0%2 G3@0%3 E5@4%1 B3@0%2 G3@0%3 | ' +
        'E5@4%1 B3@0%2 G3@0%3 D5@2%1 B3@0%2 G3@0%3 C5@1%1 B3@0%2 G3@0%3 | ' +
        'C5@4%1 E4@1%2 C4@1%3 B4@3%1 E4@1%2 C4@1%3 A4@1%1 E4@1%2 C4@1%3 | ' +
        'A4@1%1 E4@1%2 C4@1%3 B4@3%1 E4@1%2 C4@1%3 C5@4%1 E4@1%2 C4@1%3 |',
        'E2/h.@0%6 | E2/h.@0%6 | E2/h.@0%6 | E2/h.@0%6 | E2/h.@0%6 | E2/h.@0%6 | A2/h.@0%5 | A2/h.@0%5 |',
      ],
    }],
    tags: ['classical', 'triplets', 'two voices', 'positions'],
  },
  {
    id: 'gt-malaguena',
    title: 'Malagueña (traditional theme)',
    composer: 'Traditional (Spanish), arr. Clef Coach',
    year: 'Traditional',
    instrument: 'guitar',
    level: 6,
    key: 'Am',
    time: [3, 4],
    tempo: 76,
    blurb: 'The old Andalusian flamenco theme: the falling A–G–F–E chords, then the famous B–C–B–A–G–F–E line in the bass under a ringing open E, and finally the melody up high over an open-E bass.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        // Andalusian cadence
        '[A2 E3 A3 C4 E4]/h.@0,2,2,1,0%5,4,3,2,1 | [G2 B2 D3 G3 B3 G4]/h.@3,2,0,0,0,4%6,5,4,3,2,1 | ' +
        '[F3 A3 C4 F4]/h.@3,2,1,1%4,3,2,1 | [E2 B2 E3 G#3 B3 E4]/h.@0,2,3,1,0,0%6,5,4,3,2,1 | ' +
        // the theme in the bass, thumb against the open 1st string
        'B2/e@2%5 E4@0%1 C3@3%5 E4@0%1 B2@2%5 E4@0%1 | A2@0%5 E4@0%1 G2@3%6 E4@0%1 F2@1%6 E4@0%1 | ' +
        'E2@0%6 E4@0%1 F2@1%6 E4@0%1 G2@3%6 E4@0%1 | F2@1%6 E4@0%1 E2/q@0%6 r/q | ' +
        'B2/e@2%5 E4@0%1 C3@3%5 E4@0%1 B2@2%5 E4@0%1 | A2@0%5 E4@0%1 G2@3%6 E4@0%1 F2@1%6 E4@0%1 | ' +
        'F2@1%6 E4@0%1 G2@3%6 E4@0%1 F2@1%6 E4@0%1 | [E2 B2 E3 G#3 B3 E4]/h.@0,2,3,1,0,0%6,5,4,3,2,1 | ' +
        // the melody on top over the open low E
        '[E2 B3]/q@0,0%6,2 C4/e@1%2 B3@0%2 A3/q@2%3 | [E2 G3]/q@0,0%6,3 A3/e@2%3 G3@0%3 F3/q@3%4 | ' +
        '[E2 E3]/q@0,2%6,4 F3/e@3%4 G3@0%3 A3@2%3 B3@0%2 | [E2 C4]/q@0,1%6,2 B3/e@0%2 A3@2%3 B3/q@0%2 | ' +
        '[E2 B3]/q@0,0%6,2 C4/e@1%2 B3@0%2 A3/q@2%3 | [E2 G3]/q@0,0%6,3 A3/e@2%3 G3@0%3 F3/q@3%4 | ' +
        '[E2 A3]/q@0,2%6,3 G3/e@0%3 F3@3%4 G3@0%3 F3@3%4 | [E2 B2 E3 G#3 B3 E4]/h.@0,2,3,1,0,0%6,5,4,3,2,1 |',
      ],
    }],
    tags: ['flamenco', 'phrygian', 'chords'],
  },
  {
    id: 'gt-bourree-in-e-minor',
    title: 'Bourrée in E Minor (original, in Baroque style)',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 7,
    key: 'Em',
    time: [4, 4],
    tempo: 76,
    pickup: 'q',
    blurb: 'An original two-voice dance in the style of Bach’s lute music (not his famous Bourrée): a singing upper part over a walking bass, each on its own strings.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'G3/e@0%3 A3@2%3 | B3/q@0%2 G3@0%3 E4/e@0%1 F#4@2%1 G4/q@4%1 | E4/q@0%1 C4@1%2 F#4/e@2%1 E4@0%1 D#4/q@4%2 | ' +
        'E4/q@0%1 B3@0%2 C4/e@1%2 B3@0%2 A3/q@2%3 | F#4/q@2%1 D4@3%2 G4/h@4%1 | ' +
        'E4/q@0%1 C4@1%2 A3/e@2%3 B3@0%2 C4/q@1%2 | B3/q@0%2 D#4@4%2 F#4/e@2%1 E4@0%1 D#4/q@4%2 | ' +
        'G4/q@3%1 E4/e@0%1 C4@1%2 A3/q@2%3 D#4@4%2 | [G3 B3 E4]/h.@0,0,0%3,2,1 |',
        'r/q | E2/q@0%6 G2@3%6 B2@1%5 G2@3%6 | C3/q@3%5 A2@0%5 B2/h@1%5 | ' +
        'E2/h@0%6 A2/h@0%5 | D3/h@0%4 G2/h@3%6 | ' +
        'C3/q@3%5 E3@2%4 A2@0%5 C3@3%5 | B2/q@1%5 A2@0%5 G2@3%6 F#2@1%6 | ' +
        'E2/q@0%6 C3@3%5 A2@0%5 B2@1%5 | E2/h.@0%6 |',
      ],
    }],
    tags: ['original', 'baroque', 'two voices'],
  },
  {
    id: 'gt-lagrima',
    title: 'Little Teardrop (original, after Tárrega)',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 7,
    key: 'E',
    time: [3, 4],
    tempo: 63,
    blurb: 'An original two-voice miniature inspired by Tárrega’s “Lágrima” (Teardrop): a sighing E-major melody that climbs to the 12th fret over open and half-barre bass notes.',
    staves: [{
      clef: 'treble8vb',
      voices: [
        'B4/q.@4%1 A4/e@2%1 G#4/q@1%1 | A4/h@4%1 F#4/q@1%1 | C#5/q.@4%1 B4/e@2%1 A4/q@1%1 | G#4/q@3%1 F#4/h@1%1 | ' +
        'E4/q@0%1 G#4@1%1 B4@4%1 | E5/q.@4%1 D#5/e@3%1 C#5/q@1%1 | A4/q@4%1 F#4@1%1 D#4@3%2 | [G#3 B3 E4]/h.@1,0,0%3,2,1 |',
        'E2/h.@0%6 | B2/h.@1%5 | A2/h.@0%5 | B2/h.@1%5 | E2/h.@0%6 | A2/h.@0%5 | B2/h.@1%5 | E2/h.@0%6 |',
      ],
    }],
    tags: ['original', 'romantic', 'two voices', 'positions'],
  },
];

export const GUITAR_BASS: SongDef[] = [
  // ------------------------------------------------------------------ Originals, Level 1–2
  {
    id: 'gb-open-string-stomp',
    title: 'Open-String Stomp',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 76,
    blurb: 'No left hand needed: a stomping bass line on the four open strings E, A, D and G. Thumb only, nice and steady.',
    staves: [{
      clef: 'bass',
      voices: [
        'E2/q@0 E2@0 A2/h@0 | E2/q@0 E2@0 A2/h@0 | D3/q@0 D3@0 G3/h@0 | D3/q@0 A2@0 E2/h@0 | ' +
        'E2/q@0 A2@0 D3@0 G3@0 | G3/q@0 D3@0 A2/h@0 | A2/q@0 D3@0 A2@0 D3@0 | E2/w@0 |',
      ],
    }],
    tags: ['original', 'open strings'],
  },
  {
    id: 'gb-deep-water',
    title: 'Deep Water',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 1,
    key: 'Am',
    time: [3, 4],
    tempo: 72,
    blurb: 'A slow, rocking waltz at the very bottom of the guitar: E, F and G on the 6th string, with open A.',
    staves: [{
      clef: 'bass',
      voices: [
        'E2/h@0 F2/q@1 | G2/h.@3 | F2/q@1 E2@0 F2@1 | E2/h.@0 | G2/h@3 A2/q@0 | G2/h@3 F2/q@1 | E2/q@0 F2@1 G2@3 | E2/h.@0 |',
      ],
    }],
    tags: ['original', 'string 6', 'waltz'],
  },
  {
    id: 'gb-two-string-walk',
    title: 'Two-String Walk',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 2,
    key: 'Am',
    time: [4, 4],
    tempo: 80,
    blurb: 'Walk up and down the two lowest strings — E, F, G on the 6th and A, B, C on the 5th — one finger per fret.',
    staves: [{
      clef: 'bass',
      voices: [
        'E2/q@0 F2@1 G2@3 A2@0 | B2/h@2 A2/h@0 | C3/q@3 B2@2 A2@0 G2@3 | A2/w@0 | ' +
        'A2/q@0 B2@2 C3@3 B2@2 | A2/q@0 G2@3 F2@1 G2@3 | A2/q@0 G2@3 F2@1 F2@1 | E2/w@0 |',
      ],
    }],
    tags: ['original', 'strings 5–6'],
  },
  {
    id: 'gb-dusk-waltz',
    title: 'Dusk Waltz',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 2,
    key: 'Am',
    time: [3, 4],
    tempo: 84,
    blurb: 'A twilight waltz in A minor between low F and open D. Lean on beat one, the way a bass player would.',
    staves: [{
      clef: 'bass',
      voices: [
        'A2/h@0 C3/q@3 | B2/h@2 G2/q@3 | A2/q@0 B2@2 C3@3 | D3/h.@0 | C3/h@3 A2/q@0 | B2/h@2 G2/q@3 | F2/q@1 G2@3 B2@2 | A2/h.@0 |',
      ],
    }],
    tags: ['original', 'strings 4–6', 'waltz'],
  },
  {
    id: 'gb-stop-and-go',
    title: 'Stop and Go',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 80,
    blurb: 'A punchy bass riff full of rests. Mute each note right on the rest — the silence is what makes it groove.',
    staves: [{
      clef: 'bass',
      voices: [
        'E2/q@0 r G2@3 r | A2/q@0 r C3/h@3 | D3/q@0 E3@2 F3@3 r | E3/h@2 r/h | ' +
        'F3/q@3 E3@2 D3@0 r | C3/q@3 r A2/h@0 | G2/q@3 A2@0 B2@2 r | C3/w@3 |',
      ],
    }],
    tags: ['original', 'rests', 'strings 4–6'],
  },
  // ------------------------------------------------------------------ Level 3–4
  {
    id: 'gb-when-the-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American)',
    year: 'Traditional',
    instrument: 'guitar',
    level: 3,
    key: 'C',
    time: [4, 4],
    tempo: 88,
    pickup: 'h.',
    blurb: 'The marching tune down low, from C on the 5th string up to open G — with the real three-note pickup (“Oh when the…”).',
    staves: [{
      clef: 'bass',
      voices: [
        'C3/q@3 E3@2 F3@3 | G3/w@0 | r/q C3@3 E3@2 F3@3 | G3/w@0 | r/q C3@3 E3@2 F3@3 | G3/h@0 E3/h@2 | C3/h@3 E3/h@2 | D3/w@0 | ' +
        'r/q E3@2 E3@2 D3@0 | C3/h.@3 C3/q@3 | E3/h@2 G3/h@0 | G3/q@0 F3/h.@3 | r/h E3/q@2 F3@3 | G3/h@0 E3/h@2 | C3/h@3 D3/h@0 | C3/w@3 |',
      ],
    }],
    tags: ['folk', 'pickup'],
  },
  {
    id: 'gb-house-of-the-rising-sun',
    title: 'House of the Rising Sun (bass line)',
    composer: 'Traditional, arr. Clef Coach',
    year: 'Traditional',
    instrument: 'guitar',
    level: 4,
    key: 'Am',
    time: [6, 8],
    tempo: 66,
    blurb: 'A rolling 6/8 bass line on the song’s famous changes, Am–C–D–F–Am–C–E. No melody here — this is the part the thumb (or a bass player) holds down. Count two big beats per bar.',
    staves: [{
      clef: 'bass',
      voices: [
        'A2/q C3/e E3/q C3/e | C3/q E3/e G3/q E3/e | D3/q F#3/e A3/q F#3/e | F2/q A2/e C3/q A2/e | ' +
        'A2/q C3/e E3/q C3/e | C3/q E3/e G3/q E3/e | E2/q G#2/e B2/q G#2/e | E2/q B2/e E3/q D3/e | ' +
        'A2/q E3/e A3/q E3/e | C3/q G3/e C4/q G3/e | D3/q A3/e D4/q A3/e | F2/q C3/e F3/q C3/e | ' +
        'A2/q E3/e A3/q E3/e | E2/q B2/e E3/q G#3/e | A2/q E3/e A3/q E3/e | A2/h. |',
      ],
    }],
    tags: ['folk', '6/8', 'bass line', 'minor'],
  },
  // ------------------------------------------------------------------ Level 6
  {
    id: 'gb-bach-cello-prelude',
    title: 'Prelude from Cello Suite No. 1 — opening',
    composer: 'Johann Sebastian Bach',
    year: 'c. 1720',
    instrument: 'guitar',
    level: 6,
    key: 'G',
    time: [4, 4],
    tempo: 56,
    blurb: 'The first four bars of Bach’s G-major cello prelude at the cello’s own pitch: a low G under rolling sixteenths. Let the open strings ring.',
    staves: [{
      clef: 'bass',
      voices: [
        'G2/s D3 B3 A3 B3 D3 B3 D3 G2 D3 B3 A3 B3 D3 B3 D3 | G2/s E3 C4 B3 C4 E3 C4 E3 G2 E3 C4 B3 C4 E3 C4 E3 | ' +
        'G2/s F#3 C4 B3 C4 F#3 C4 F#3 G2 F#3 C4 B3 C4 F#3 C4 F#3 | G2/s G3 B3 A3 B3 G3 B3 G3 G2 G3 B3 A3 B3 G3 B3 F#3 | ' +
        '[G2 D3 G3 B3]/w |',
      ],
    }],
    tags: ['baroque', 'sixteenths', 'cello'],
  },
  {
    id: 'gb-the-swan',
    title: 'Swan Song (original)',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 6,
    key: 'G',
    time: [6, 4],
    tempo: 76,
    blurb: 'An original slow, singing melody in the manner of a cello solo — long, connected notes in a gliding 6/4. Keep every finger down until the next note speaks.',
    staves: [{
      clef: 'bass',
      voices: [
        'B3/h. A3/q G3/h | D4/h. C4/q B3/q A3/q | G3/h. F#3/q E3/q F#3/q | G3/w. | ' +
        'E3/h. F#3/q G3/q A3/q | B3/h. C4/q D4/q E4/q | D4/h. B3/q G3/q B3/q | A3/w. | ' +
        'B3/h. A3/q G3/h | E4/h. D4/q C4/q B3/q | A3/h. G3/q F#3/q E3/q | D3/h. F#3/q A3/q C4/q | ' +
        'B3/h. A3/q G3/h | C4/h. B3/q A3/q F#3/q | G3/h. D3/q B2/q D3/q | G2/w. |',
      ],
    }],
    tags: ['original', 'lyrical', 'cello'],
  },
  {
    id: 'gb-volga-boatmen',
    title: 'Boatmen’s Haul (original)',
    composer: 'Clef Coach Original',
    instrument: 'guitar',
    level: 4,
    key: 'Am',
    time: [4, 4],
    tempo: 60,
    blurb: 'An original slow hauling song in A minor, written in the spirit of the Russian “Song of the Volga Boatmen”: a heavy dotted pull on every first beat, and a G♯ that drags the line home.',
    staves: [{
      clef: 'bass',
      voices: [
        'A2/q. C3/e E3/h | D3/q. C3/e B2/h | A2/q. C3/e E3/q G3/q | F3/h E3/h | ' +
        'A3/q. G3/e F3/q E3/q | D3/q. E3/e F3/q D3/q | E3/q. D3/e C3/q B2/q | A2/w | ' +
        'E3/q. E3/e A3/q G3/q | F3/h E3/h | D3/q. D3/e G3/q F3/q | E3/w | ' +
        'A3/q. G3/e F3/q E3/q | D3/q F3/q C3/q B2/q | C3/q. B2/e A2/q G#2/q | A2/w |',
      ],
    }],
    tags: ['original', 'minor', 'dotted rhythm'],
  },
];
