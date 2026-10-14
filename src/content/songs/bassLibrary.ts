import type { SongDef } from '../../music/parse';

/**
 * Bass guitar song library. All pitches are SOUNDING pitches: the open strings are
 * E1 A1 D2 G2 (strings 4..1). The bass8vb clef draws them an octave higher, which is
 * how bass parts are written – the open E sits on the ledger line below the staff.
 *
 * Fingering and strings are left to the Simandl fingering engine unless a part needs a
 * particular place on the neck. Every song carries a chord line in the same rhythm
 * notation, so the player can see the harmony a bass line is built on.
 */
export const BASS: SongDef[] = [
  // ------------------------------------------------------------------ Level 1
  {
    id: 'bass-open-string-groove',
    title: 'Open-String Groove',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 80,
    blurb: 'No left hand needed: a laid-back groove on the four open strings E, A, D and G. Alternate index and middle fingers and keep the quarters even.',
    staves: [{
      clef: 'bass8vb',
      voices: ['E1/q E1 E1 E1 | E1/h A1/h | A1/q A1 A1 A1 | A1/h D2/h | D2/q D2 G2 G2 | D2/h A1/h | A1/q D2 A1 E1 | E1/w |'],
    }],
    chords: 'E/w | E/h A/h | A/w | A/h D/h | D/h G/h | D/h A/h | A/w | E/w |',
    tags: ['original', 'open strings'],
  },
  {
    id: 'bass-ode-to-joy',
    title: 'Ode to Joy (bass line)',
    composer: 'Ludwig van Beethoven',
    year: '1824',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 1,
    key: 'C',
    time: [4, 4],
    tempo: 76,
    blurb: 'The bass part under Beethoven’s famous tune: roots and fifths of C and G in half notes, with a short trip to D in the middle section.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'C2/h G1/h | G1/h D2/h | C2/h G1/h | G1/w | C2/h G1/h | G1/h B1/h | C2/h E2/h | G1/h C2/h | ' +
        'G1/h C2/h | G1/h C2/h | G1/h A1/h | D2/h G1/h | C2/h G1/h | G1/h D2/h | C2/h E2/h | G1/h C2/h |',
      ],
    }],
    chords: 'C/w | G/w | C/w | G/w | C/w | G/w | C/w | G/h C/h | G/h C/h | G/h C/h | G/h Am/h | D7/h G/h | C/w | G/w | C/w | G/h C/h |',
    tags: ['classical', 'roots', 'half notes'],
  },
  {
    id: 'bass-andalusian-steps',
    title: 'Four-Chord Steps',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 1,
    key: 'Am',
    time: [4, 4],
    tempo: 80,
    blurb: 'The falling A minor – G – F – E chords of flamenco and rock, played on just the E and A strings: E, F, G, A, B and C.',
    staves: [{
      clef: 'bass8vb',
      voices: ['A1/h C2/h | G1/h B1/h | F1/h A1/h | E1/h B1/h | A1/q B1 C2 A1 | G1/q A1 B1 G1 | F1/h E1/h | A1/w |'],
    }],
    chords: 'Am/w | G/w | F/w | E/w | Am/w | G/w | F/h E/h | Am/w |',
    tags: ['original', 'E & A strings'],
  },
  // ------------------------------------------------------------------ Level 2
  {
    id: 'bass-chord-tone-rock',
    title: 'Chord-Tone Rock',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 88,
    blurb: 'Root, 3rd, 5th, 3rd: every bar outlines its chord, all in first position. Watch the chord symbols and hear how the line spells each one.',
    staves: [{
      clef: 'bass8vb',
      voices: ['C2/q E2 G2 E2 | F1/q A1 C2 A1 | G1/q B1 D2 B1 | C2/q G1 E1 G1 | A1/q C2 E2 C2 | F1/q A1 C2 F2 | G1/q B1 D2 F2 | C2/w |'],
    }],
    chords: 'C/w | F/w | G/w | C/w | Am/w | F/w | G7/w | C/w |',
    tags: ['original', 'arpeggios', 'first position'],
  },
  {
    id: 'bass-when-the-saints',
    title: 'When the Saints Go Marching In (bass line)',
    composer: 'Traditional (American)',
    year: 'Traditional',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 2,
    key: 'C',
    time: [4, 4],
    tempo: 96,
    pickup: 'h.',
    blurb: 'A marching root–fifth bass line with a walk-up pickup (G–A–B into C), a walk-down into G7 and a step up into F for “Oh Lord, I want to be in that number”.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'G1/q A1 B1 | C2/h G1/h | C2/h G1/h | C2/h G1/h | C2/h G1/h | C2/h G1/h | C2/q B1 A1/h | G1/h D2/h | G1/h D2/h | ' +
        'C2/h G1/h | C2/h D2/q E2/q | F2/h C2/h | F1/h A1/h | C2/h G1/h | G1/h D2/h | C2/w |',
      ],
    }],
    chords: 'N.C./h. | C/w | C/w | C/w | C/w | C/w | C/w | G7/w | G7/w | C/w | C7/w | F/w | F/w | C/w | G7/w | C/w |',
    tags: ['folk', 'pickup', 'root–fifth'],
  },
  {
    id: 'bass-riverboat-waltz',
    title: 'Riverboat Waltz',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 2,
    key: 'C',
    time: [3, 4],
    tempo: 108,
    blurb: 'An old-time waltz bass: a strong root on beat one, and a quarter note on beat three that walks into the next chord.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'C2/h. | G1/h E1/q | F1/h. | A1/h F1/q | G1/h. | D2/h B1/q | C2/h. | G1/h B1/q | ' +
        'C2/h G1/q | C2/h E1/q | F1/h C2/q | D2/h A1/q | G1/h D2/q | G1/h B1/q | C2/h G1/q | C2/h. |',
      ],
    }],
    chords: 'C/h. | C/h. | F/h. | F/h. | G7/h. | G7/h. | C/h. | C/h. | C/h. | C7/h. | F/h. | Dm/h. | G7/h. | G7/h. | C/h. | C/h. |',
    tags: ['original', 'waltz', '3/4'],
  },
  // ------------------------------------------------------------------ Level 3
  {
    id: 'bass-pachelbel-canon',
    title: 'Canon in D (ground bass)',
    composer: 'Johann Pachelbel',
    year: 'c. 1690',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 3,
    key: 'D',
    time: [4, 4],
    tempo: 60,
    blurb: 'Pachelbel’s eight-note ground bass, D A B F♯ G D G A, three times through — the middle time in quarter notes. The low D Pachelbel wrote sits below a 4-string bass’s open E, so here it jumps up to the open D string.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/h@0 A1@0 | B1/h@1 F#1@1 | G1/h@2 D2@0 | G1/h@2 A1@0 | ' +
        'D2/q@0 F#2@4 A1@0 C#2@4 | B1/q@1 D2@0 F#1@1 A1@0 | G1/q@2 B1@1 D2@0 F#2@4 | G1/q@2 B1@1 A1@0 C#2@4 | ' +
        'D2/h@0 A1@0 | B1/h@1 F#1@1 | G1/h@2 D2@0 | G1/h@2 A1@0 | D2/w@0 |',
      ],
    }],
    chords: 'D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/h A/h | Bm/h F#m/h | G/h D/h | G/h A/h | D/w |',
    tags: ['baroque', 'ground bass', 'sharps'],
  },
  {
    id: 'bass-swing-low',
    title: 'Swing Low, Sweet Chariot (bass line)',
    composer: 'Traditional (African-American spiritual)',
    year: 'Traditional',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 3,
    key: 'F',
    time: [4, 4],
    tempo: 72,
    blurb: 'The spiritual’s chords in F: half-note roots and fifths the first time, then a gentle walking line with B♭ and an E that leans into the final F.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'F1/h C2/h | Bb1/h F1/h | F1/h A1/h | C2/h G1/h | F1/h C2/h | F1/q A1 Bb1/h | F1/h C2/h | F1/w | ' +
        'F1/q A1 C2 A1 | Bb1/q D2 F1 A1 | F1/q G1 A1 Bb1 | C2/q Bb1 A1 G1 | F1/q A1 C2 A1 | F1/q A1 Bb1 D2 | F1/q A1 C2 E1 | F1/w |',
      ],
    }],
    chords: 'F/w | Bb/h F/h | F/w | C7/w | F/w | F7/h Bb/h | F/h C7/h | F/w | F/w | Bb/h F/h | F/w | C7/w | F/w | F7/h Bb/h | F/h C7/h | F/w |',
    tags: ['spiritual', 'flats', 'walking'],
  },
  {
    id: 'bass-drunken-sailor',
    title: 'Drunken Sailor (bass line)',
    composer: 'Traditional (sea shanty)',
    year: 'Traditional',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 3,
    key: 'Dm',
    time: [4, 4],
    tempo: 100,
    blurb: 'The shanty’s two chords, D minor and C: root–fifth quarters for the verse, then driving eighths for “Way, hay, and up she rises”. Mute the rests cleanly.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/q A1 D2 A1 | D2/q A1 F1 A1 | C2/q G1 C2 G1 | C2/q G1 E1 G1 | D2/q A1 D2 A1 | D2/q E2 F2 D2 | C2/q G1 C2 A1 | D2/h r/h | ' +
        'D2/e D2 A1 A1 D2 D2 A1 A1 | D2/e D2 A1 A1 F1 F1 A1 A1 | C2/e C2 G1 G1 C2 C2 G1 G1 | C2/e C2 G1 G1 E1 E1 G1 G1 | ' +
        'D2/e D2 A1 A1 D2 D2 A1 A1 | D2/e D2 A1 A1 D2 D2 E2 F2 | C2/e C2 G1 G1 C2/q A1/q | D2/h r/h |',
      ],
    }],
    chords: 'Dm/w | Dm/w | C/w | C/w | Dm/w | Dm/w | C/w | Dm/w | Dm/w | Dm/w | C/w | C/w | Dm/w | Dm/w | C/w | Dm/w |',
    tags: ['folk', 'shanty', 'eighths', 'rests'],
  },
  {
    id: 'bass-greensleeves',
    title: 'Greensleeves (bass line)',
    composer: 'Traditional (English)',
    year: '16th century',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 3,
    key: 'Am',
    time: [3, 4],
    tempo: 96,
    blurb: 'The bass under the old English ballad: A minor, G and E chords in a flowing 3/4, with a G♯ that leads every E chord home to A.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'A1/h E2/q | G1/h D2/q | A1/h C2/q | E1/h G#1/q | A1/h E2/q | G1/h D2/q | A1/h E1/q | A1/h. | ' +
        'C2/h E2/q | G1/h B1/q | A1/h C2/q | E1/h G#1/q | C2/q E2 G2 | G2/q D2 B1 | A1/h E1/q | A1/h. |',
      ],
    }],
    chords: 'Am/h. | G/h. | Am/h. | E/h. | Am/h. | G/h. | Am/h E/q | Am/h. | C/h. | G/h. | Am/h. | E/h. | C/h. | G/h. | Am/h E/q | Am/h. |',
    tags: ['folk', 'minor', '3/4'],
  },
  // ------------------------------------------------------------------ Level 4
  {
    id: 'bass-house-of-the-rising-sun',
    title: 'House of the Rising Sun (bass line)',
    composer: 'Traditional (American)',
    year: 'Traditional',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 4,
    key: 'Am',
    time: [6, 8],
    tempo: 72,
    blurb: 'A rolling 6/8 arpeggio line on the song’s famous changes, Am–C–D–F–Am–C–E. First root–3rd–5th, then wider root–5th–octave shapes. Count two big beats per bar.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'A1/q C2/e E2/q C2/e | C2/q E2/e G2/q E2/e | D2/q F#2/e A2/q F#2/e | F1/q A1/e C2/q A1/e | ' +
        'A1/q C2/e E2/q C2/e | C2/q E2/e G2/q E2/e | E1/q G#1/e B1/q G#1/e | E1/q B1/e E2/q D2/e | ' +
        'A1/e E2 A2 E2 C2 E2 | C2/e G2 C3 G2 E2 G2 | D2/e F#2 A2 F#2 D2 A1 | F1/e C2 F2 C2 A1 C2 | ' +
        'A1/e E2 A2 E2 C2 E2 | E1/e B1 E2 B1 G#1 B1 | A1/e E2 A2 E2 C2 E2 | A1/h. |',
      ],
    }],
    chords: 'Am/h. | C/h. | D/h. | F/h. | Am/h. | C/h. | E/h. | E7/h. | Am/h. | C/h. | D/h. | F/h. | Am/h. | E/h. | Am/h. | Am/h. |',
    tags: ['folk', '6/8', 'arpeggios', 'minor'],
  },
  {
    id: 'bass-sarabande',
    title: 'Sarabande in D Minor',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 4,
    key: 'Dm',
    time: [3, 4],
    tempo: 60,
    blurb: 'An original slow dance in the Baroque style. The sarabande leans on beat two (short–long), and the first half walks down the old “lament” bass D–C–B♭–A.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/q A1/h | C2/q G1/h | Bb1/q F1/h | A1/h. | D2/q F2/h | C2/q E2/h | Bb1/q D2/h | A1/q E1/h | ' +
        'D2/q A1/h | G1/q Bb1/h | C2/q E2/h | F1/q A1/h | Bb1/q D2/h | G1/q Bb1/h | A1/q C#2/h | D2/h. |',
      ],
    }],
    chords: 'Dm/h. | C/h. | Bb/h. | A/h. | Dm/h. | C/h. | Bb/h. | A/h. | Dm/h. | Gm/h. | C/h. | F/h. | Bb/h. | Gm/h. | A/h. | Dm/h. |',
    tags: ['original', 'baroque', 'minor', '3/4'],
  },
  // ------------------------------------------------------------------ Level 5
  {
    id: 'bass-motown-groove',
    title: 'Motor City Groove',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 5,
    key: 'C',
    time: [4, 4],
    tempo: 96,
    blurb: 'An original groove in the 1960s Detroit style: dotted roots, short rests, busy pick-up eighths and a chromatic F♯ that slides into G. Lock beat one to the kick drum.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'C2/q. C2/e r/e G1/e A1/e B1/e | A1/q. A1/e r/e E2/e D2/e C2/e | F1/q. F1/e r/e F1/e A1/e F#1/e | G1/q. G1/e r/e D2/e B1/e G1/e | ' +
        'C2/q. C2/e r/e G1/e A1/e B1/e | A1/q. A1/e r/e C2/e E2/e A1/e | D2/q. D2/e G1/q. G1/e | C2/q. C2/e r/e G1/e C2/q | ' +
        'C2/e C2/q C2/e r/e G1/e A1/e B1/e | A1/e A1/q A1/e r/e A1/e C2/e E2/e | F1/e F1/q F1/e r/e F1/e A1/e F#1/e | G1/e G1/q G1/e r/e G1/e B1/e D2/e | ' +
        'C2/q. C2/e r/e G1/e A1/e B1/e | A1/q. A1/e r/e E2/e D2/e C2/e | D2/q. F2/e G1/q. B1/e | C2/q. G1/e C2/h |',
      ],
    }],
    chords: 'C/w | Am/w | F/w | G/w | C/w | Am/w | Dm/h G/h | C/w | C/w | Am/w | F/w | G/w | C/w | Am/w | Dm/h G/h | C/w |',
    tags: ['original', 'motown', 'syncopation'],
  },
  {
    id: 'bass-walking-the-changes',
    title: 'Walking the Changes',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 5,
    key: 'F',
    time: [4, 4],
    tempo: 104,
    blurb: 'A walking bass in F: the root on every beat one and a chromatic approach note — one fret above or below — on most beat fours. Keep the quarters long and even.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'F1/q A1 C2 E2 | D2/q C2 A1 Ab1 | G1/q Bb1 D2 Db2 | C2/q Bb1 G1 E1 | F1/q G1 A1 C#2 | D2/q F2 A1 F#1 | G1/q Bb1 C2 E1 | F1/q C2 A1 E1 | ' +
        'F1/q A1 C2 D2 | F2/q Eb2 C2 B1 | Bb1/q D2 F2 D2 | Bb1/q A1 G1 Gb1 | F1/q A1 C2 C#2 | D2/q F#2 A1 Ab1 | G1/q Bb1 C2 E1 | F1/w |',
      ],
    }],
    chords: 'F/w | Dm/w | Gm/w | C7/w | F/w | Dm/w | Gm/h C7/h | F/w | F/w | F7/w | Bb/w | Bb/w | F/w | D7/w | Gm/h C7/h | F/w |',
    tags: ['original', 'walking bass', 'chromatic'],
  },
  {
    id: 'bass-boogie-blues-in-e',
    title: 'Boogie Blues in E',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 5,
    key: 'E',
    time: [4, 4],
    tempo: 100,
    blurb: 'A 12-bar blues on the classic boogie pattern: root, 5th, 6th and flat 7th in eighths, moved to A7 and B7. Play it straight, or swing the eighths for a shuffle.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'E1/e E1 B1 B1 C#2 C#2 D2 C#2 | E1/e E1 B1 B1 C#2 C#2 D2 C#2 | E1/e E1 B1 B1 C#2 C#2 D2 C#2 | E1/e E1 B1 B1 C#2 C#2 D2 C#2 | ' +
        'A1/e A1 E2 E2 F#2 F#2 G2 F#2 | A1/e A1 E2 E2 F#2 F#2 G2 F#2 | E1/e E1 B1 B1 C#2 C#2 D2 C#2 | E1/e E1 B1 B1 C#2 C#2 D2 C#2 | ' +
        'B1/e B1 F#2 F#2 G#2 G#2 A2 G#2 | A1/e A1 E2 E2 F#2 F#2 G2 F#2 | E1/e E1 B1 B1 C#2 C#2 D2 C#2 | B1/e B1 F#2 F#2 G#2 G#2 A2 G#2 | E1/w |',
      ],
    }],
    chords: 'E7/w | E7/w | E7/w | E7/w | A7/w | A7/w | E7/w | E7/w | B7/w | A7/w | E7/w | B7/w | E7/w |',
    tags: ['original', 'blues', '12-bar', 'eighths'],
  },
  {
    id: 'bass-minor-drag',
    title: 'Infirmary Drag',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 5,
    key: 'Dm',
    time: [4, 4],
    tempo: 66,
    blurb: 'An original slow minor blues in the spirit of the traditional “St. James Infirmary”: a two-beat feel the first time, then a heavy dotted drag with a G♯ that creeps up to A.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/h A1/h | G1/h D2/h | D2/h F1/h | A1/h C#2/h | D2/h A1/h | G1/h A1/h | D2/h A1/h | D2/h r/h | ' +
        'D2/q. D2/e A1/q. A1/e | G1/q. G1/e Bb1/q. Bb1/e | D2/q. D2/e F1/q. G#1/e | A1/q. A1/e C#2/q. E2/e | ' +
        'D2/q. D2/e A1/q. A1/e | G1/q. Bb1/e A1/q. C#2/e | D2/q. A1/e A1/q. C#2/e | D2/w |',
      ],
    }],
    chords: 'Dm/w | Gm/w | Dm/w | A7/w | Dm/w | Gm/h A7/h | Dm/h A7/h | Dm/w | Dm/w | Gm/w | Dm/w | A7/w | Dm/w | Gm/h A7/h | Dm/h A7/h | Dm/w |',
    tags: ['original', 'blues', 'minor', 'dotted rhythm'],
  },
  // ------------------------------------------------------------------ Level 6
  {
    id: 'bass-walking-blues-in-a',
    title: 'Walking Blues in A',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 6,
    key: 'A',
    time: [4, 4],
    tempo: 108,
    blurb: 'A 12-bar blues walked in quarter notes: chord tones, scale steps and chromatic approaches from above and below. The G♮ and C♮ against the three-sharp key are the bluesy flat sevenths.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'A1/q C#2 E2 C#2 | D2/q F#2 A1 G#1 | A1/q B1 C#2 E2 | A2/q G2 E2 C#2 | ' +
        'D2/q E2 F#2 A2 | D2/q C2 B1 Bb1 | A1/q C#2 E2 F#2 | A1/q G1 F#1 F1 | ' +
        'E1/q G#1 B1 C#2 | D2/q F#2 A1 G#1 | A1/q C#2 E2 F2 | E2/q D2 B1 G#1 | A1/w |',
      ],
    }],
    chords: 'A7/w | D7/w | A7/w | A7/w | D7/w | D7/w | A7/w | A7/w | E7/w | D7/w | A7/w | E7/w | A7/w |',
    tags: ['original', 'blues', '12-bar', 'walking bass'],
  },
  {
    id: 'bass-cello-etude',
    title: 'Suite Étude in D',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 6,
    key: 'D',
    time: [4, 4],
    tempo: 66,
    blurb: 'An original étude in the manner of a cello-suite prelude: rolling eighth-note arpeggios over a repeated low note, crossing all four strings. Let each chord ring into the next.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'D2/e A2 F#2 A2 D2 A2 F#2 A2 | D2/e B2 G2 B2 D2 B2 G2 B2 | C#2/e A2 G2 A2 E2 A2 G2 A2 | D2/e A2 F#2 A2 D3 A2 F#2 D2 | ' +
        'B1/e F#2 D2 F#2 B1 F#2 D2 F#2 | E1/e B1 G2 B1 E2 B1 G2 B1 | A1/e E2 G2 E2 C#2 E2 G2 E2 | D2/e A2 F#2 A2 D3 A2 F#2 A2 | ' +
        'G1/e D2 B1 D2 G2 D2 B1 D2 | A1/e E2 C#2 E2 A2 E2 C#2 E2 | D2/e F#2 A2 F#2 A1 C#2 E2 G2 | D2/w |',
      ],
    }],
    chords: 'D/w | G/D/w | A7/C#/w | D/w | Bm/w | Em/w | A7/w | D/w | G/w | A/w | D/h A7/h | D/w |',
    tags: ['original', 'étude', 'arpeggios', 'string crossing'],
  },
  // ------------------------------------------------------------------ Level 7–8
  {
    id: 'bass-bach-cello-prelude',
    title: 'Prelude from Cello Suite No. 1 — opening',
    composer: 'Johann Sebastian Bach',
    year: 'c. 1720',
    arranger: 'Clef Coach',
    instrument: 'bass',
    level: 7,
    key: 'G',
    time: [4, 4],
    tempo: 56,
    blurb: 'The first four bars of Bach’s G-major cello prelude, an octave below the cello: a low G under rolling sixteenths. Park the hand in second position, one finger per fret (index on the 2nd fret), and keep the low G ringing.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'G1/s@2%4 D2@0%2 B2@3%1 A2@1%1 B2@3%1 D2@0%2 B2@3%1 D2@0%2 G1@2%4 D2@0%2 B2@3%1 A2@1%1 B2@3%1 D2@0%2 B2@3%1 D2@0%2 | ' +
        'G1/s@2%4 E2@1%2 C3@4%1 B2@3%1 C3@4%1 E2@1%2 C3@4%1 E2@1%2 G1@2%4 E2@1%2 C3@4%1 B2@3%1 C3@4%1 E2@1%2 C3@4%1 E2@1%2 | ' +
        'G1/s@2%4 F#2@3%2 C3@4%1 B2@3%1 C3@4%1 F#2@3%2 C3@4%1 F#2@3%2 G1@2%4 F#2@3%2 C3@4%1 B2@3%1 C3@4%1 F#2@3%2 C3@4%1 F#2@3%2 | ' +
        'G1/s@2%4 G2@0%1 B2@3%1 A2@1%1 B2@3%1 G2@0%1 B2@3%1 G2@0%1 G1@2%4 G2@0%1 B2@3%1 A2@1%1 B2@3%1 G2@0%1 B2@3%1 F#2@3%2 | G1/w@2%4 |',
      ],
    }],
    chords: 'G/w | C/G/w | D7/G/w | G/w | G/w |',
    tags: ['baroque', 'sixteenths', 'cello'],
  },
  {
    id: 'bass-sixteenth-street-funk',
    title: 'Sixteenth-Street Funk',
    composer: 'Clef Coach Original',
    instrument: 'bass',
    level: 8,
    key: 'Em',
    time: [4, 4],
    tempo: 88,
    blurb: 'An original funk groove on the sixteenth-note grid: a fat downbeat, short notes, muted rests and octave pops on the E. Count “1 e & a” and never rush the rests.',
    staves: [{
      clef: 'bass8vb',
      voices: [
        'E1/e. E1/s r/s E1/s E2/e r/e E1/s E1/s G1/e A1/e | E1/e. E1/s r/s E1/s E2/e r/e D2/s E2/s G1/e G#1/e | ' +
        'A1/e. A1/s r/s A1/s A2/e r/e A1/s A1/s C2/e C#2/e | A1/e. A1/s r/s A1/s A2/e G2/s E2/s D2/s B1/s A1/e F1/e | ' +
        'E1/e. E1/s r/s E1/s E2/e r/e E1/s E1/s G1/e A1/e | E1/e. E1/s r/s E1/s E2/e r/e E1/s E1/s D2/e A1/e | ' +
        'B1/e. B1/s r/s B1/s B2/e r/e A2/s F#2/s D#2/e B1/e | E1/e. E1/s r/s E1/s E2/e r/e B1/s D2/s E1/q |',
      ],
    }],
    chords: 'Em7/w | Em7/w | A7/w | A7/w | Em7/w | Em7/w | B7/w | Em7/w |',
    tags: ['original', 'funk', 'sixteenths', 'octaves'],
  },
];
