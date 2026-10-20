/**
 * Unit 15: modes and other scales. The pentatonic scales of folk, blues and rock, the blues
 * scale and its blue notes, the seven modes (as rotations of the major scale, then by the
 * one note that gives each its colour), and the two scales with no home: chromatic and
 * whole-tone.
 */
import type { Rng } from '../../../curriculum/generate';
import { parsePitch, stepLabel } from '../../../music/pitch';
import { type ScaleId, SCALES, pitchText, scaleNotes } from '../../theory';
import { C, build, choices, draw, explain, explore, fig, lesson, pick, quiz, round, scaleBuildRounds, scaleRounds, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const label = (n: string) => {
  const p = parsePitch(n);
  return stepLabel(p.step, p.alter);
};

const scaleName = (s: ScaleId) => SCALES[s].name[0].toUpperCase() + SCALES[s].name.slice(1);

/** A scale written out as quarter notes, labelled with its degrees in `key`. */
const scaleFig = (tonic: string, id: ScaleId, key: string) => fig(scaleNotes(tonic, id).map(n => `${pitchText(n)}/q`).join(' '), { key, labels: 'degrees', play: 'as-written', tempo: 120 });

/** The white-key modes: each starts on its own white key. */
const WHITE_MODES: [string, ScaleId][] = [
  ['C', 'ionian'],
  ['D', 'dorian'],
  ['E', 'phrygian'],
  ['F', 'lydian'],
  ['G', 'mixolydian'],
  ['A', 'aeolian'],
  ['B', 'locrian'],
];

/** "Which mode runs from E to E on the white keys?" */
function whiteModeRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, WHITE_MODES, count).map(([start, id]) => ({
      prompt: `Which mode runs on the white keys from ${start} up to ${start}?`,
      figure: fig(scaleNotes(`${start}4`, id).map(n => `${pitchText(n)}/q`).join(' '), { play: 'as-written', tempo: 120, labels: 'steps' }),
      options: choices(rng, scaleName(id), WHITE_MODES.map(([, m]) => scaleName(m)), 4, true),
      answer: scaleName(id),
      explain: `The white keys from ${start} make the ${SCALES[id].name} mode.`,
    }));
}

/** Play a white-key mode: "Play the white keys from G up to G". */
function whiteModeBuild(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, WHITE_MODES.slice(1), count).map(([start, id]) => {
      const notes = scaleNotes(`${start}4`, id).map(pitchText);
      return {
        prompt: `Play ${start} ${SCALES[id].name}: the white keys from ${start} up to ${start}`,
        figure: fig(`${start}4`, { play: 'as-written' }),
        check: C.scale(start, id),
        answer: notes,
        explain: `${start} ${SCALES[id].name}: ${notes.map(label).join(' ')}.`,
      };
    });
}

/** The modes away from the white keys: "Play A Dorian", "Play D Mixolydian". */
function modeBuild(count: number) {
  const pairs: [string, ScaleId][] = [
    ['A3', 'dorian'],
    ['G3', 'dorian'],
    ['E4', 'dorian'],
    ['D4', 'mixolydian'],
    ['A3', 'mixolydian'],
    ['C4', 'mixolydian'],
    ['G3', 'lydian'],
    ['C4', 'lydian'],
    ['A3', 'phrygian'],
    ['D4', 'phrygian'],
  ];
  return (rng: Rng): BuildRound[] =>
    draw(rng, pairs, count).map(([t, id]) => {
      const notes = scaleNotes(t, id).map(pitchText);
      return {
        prompt: `Play ${label(t)} ${SCALES[id].name}, from ${label(t)} up to ${label(t)}`,
        figure: fig(t, { play: 'as-written' }),
        check: C.scale(t.replace(/\d$/, ''), id),
        answer: notes,
        explain: `${label(t)} ${SCALES[id].name}: ${notes.map(label).join(' ')}.`,
      };
    });
}

/** What makes each mode itself, as a question. */
const CHARACTER: [string, string][] = [
  ['Major with a flattened 7th', 'Mixolydian'],
  ['Major with a sharpened 4th', 'Lydian'],
  ['Minor with a raised 6th', 'Dorian'],
  ['Minor with a flattened 2nd', 'Phrygian'],
  ['Minor with a flattened 2nd and 5th', 'Locrian'],
  ['The major scale itself', 'Ionian'],
  ['The natural minor scale itself', 'Aeolian'],
];

function characterRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, CHARACTER, count).map(([desc, mode]) => ({
      prompt: `Which mode is this? ${desc}.`,
      options: choices(rng, mode, CHARACTER.map(([, m]) => m), 4, true),
      answer: mode,
    }));
}

/** A blue note over a major chord: the ♭3 bending up to the 3. */
function bluesBuild(count: number) {
  const roots = ['A3', 'C4', 'E4', 'G3', 'D4'];
  return (rng: Rng): BuildRound[] =>
    draw(rng, roots, count).map(t => {
      const notes = scaleNotes(t, 'blues').map(pitchText);
      return {
        prompt: `Play the ${label(t)} blues scale, from ${label(t)} up to ${label(t)}`,
        figure: fig(t, { play: 'as-written' }),
        check: C.scale(t.replace(/\d$/, ''), 'blues'),
        answer: notes,
        explain: `${label(t)} blues: ${notes.map(label).join(' ')}.`,
      };
    });
}

/** Major or minor pentatonic, from a random tonic. */
function pentatonicBuild(count: number) {
  const pairs: [string, ScaleId][] = [
    ['C4', 'major-pentatonic'],
    ['G3', 'major-pentatonic'],
    ['F4', 'major-pentatonic'],
    ['D4', 'major-pentatonic'],
    ['A3', 'minor-pentatonic'],
    ['E4', 'minor-pentatonic'],
    ['D4', 'minor-pentatonic'],
    ['G3', 'minor-pentatonic'],
  ];
  return (rng: Rng): BuildRound[] =>
    draw(rng, pairs, count).map(([t, id]) => {
      const notes = scaleNotes(t, id).map(pitchText);
      return {
        prompt: `Play the ${label(t)} ${SCALES[id].name} scale, from ${label(t)} up to ${label(t)}`,
        figure: fig(t, { play: 'as-written' }),
        check: C.scale(t.replace(/\d$/, ''), id),
        answer: notes,
        explain: `${label(t)} ${SCALES[id].name}: ${notes.map(label).join(' ')}.`,
      };
    });
}

/** Ear: the same tonic, which scale? */
function sameTonicRounds(scales: ScaleId[], count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, scales, count).map(id => {
      const t = pick(rng, ['C4', 'D4', 'F4', 'G3', 'A3']);
      const notes = scaleNotes(t, id).map(pitchText);
      // up and back down, so the ear hears the colour twice
      const there = [...notes, ...notes.slice(0, -1).reverse()];
      return {
        figure: fig(there.map(n => `${n}/q`).join(' '), { play: 'as-written', tempo: 132 }),
        options: choices(rng, scaleName(id), scales.map(scaleName), 4, true),
        answer: scaleName(id),
        explain: `${label(t)} ${SCALES[id].name}: ${notes.map(label).join(' ')}.`,
      };
    });
}

/** The second half of the shanty's first verse ("…drunken sailor, early in the morning"). */
const DRUNKEN_SAILOR = 'A4/e A4/s A4/s A4/e A4/s A4/s | A4/e B4 C5 D5 | C5/e A4 G4 E4 | D4/q D4/q |';

export const modesUnit = unit('th-modes', 'Modes and Other Scales', 'Beyond major and minor', 'Pentatonic and blues scales, the seven modes and their colours, and the scales with no home.', [
  lesson(
    'th15-1',
    'Pentatonic Scales',
    'learn',
    'Five notes that never clash',
    [
      explain(
        'Five notes',
        `Take the major scale and leave out its 4th and 7th: what's left is the **major pentatonic** scale, five notes (*penta* is Greek for five). From C: C D E G A.

The two notes it drops are the ones a semitone away from their neighbours (F next to E, B next to C). With no semitones left, nothing in it can rub against anything else, so any of its notes sounds good over any other. That's why it turns up in folk songs all over the world, in the blues, in rock solos and in the first tunes children make up.`,
        scaleFig('C4', 'major-pentatonic', 'C'),
      ),
      explain(
        'The minor pentatonic',
        `Play the same five notes but start from A: A C D E G. Now it sounds minor. This is the **minor pentatonic**, the scale behind most blues and rock guitar solos.

It works like a major key and its relative minor: C major pentatonic and A minor pentatonic share every note. Which one you hear depends on which note feels like home.`,
        scaleFig('A3', 'minor-pentatonic', 'Am'),
      ),
      explore('Try it', 'The five black keys are a pentatonic scale on their own: try making up a tune using only them. It’s very hard to play a wrong note.', [
        task('Play the black keys up from F♯ (F♯ G♯ A♯ C♯ D♯ F♯)', C.scale('F#', 'major-pentatonic')),
        task('Play C major pentatonic: C D E G A C', C.scale('C', 'major-pentatonic')),
        task('Play A minor pentatonic: A C D E G A', C.scale('A', 'minor-pentatonic')),
      ]),
      build('Play pentatonics', 'Major pentatonic: the major scale without its 4th and 7th. Minor pentatonic: the natural minor without its 2nd and 6th.', pentatonicBuild(4)),
      quiz('Count the notes', 'Pentatonic scales have five different notes, major and minor scales seven. Which is this?', 'Which scale is this?', scaleRounds({ scales: ['major', 'major-pentatonic', 'natural-minor', 'minor-pentatonic'], tonics: ['C4', 'D4', 'G3', 'A3'], count: 5 })),
    ],
    { key: 'C', topics: ['scale:pentatonic'] },
  ),
  lesson(
    'th15-2',
    'The Blues Scale',
    'learn',
    'Blue notes, and why they sound so good',
    [
      explain(
        'One extra note',
        `Add one note to the minor pentatonic, between its 4th and 5th, and you have the **blues scale**: A C D D♯ E G A.

That squeezed-in note (the ♯4, often written ♭5) is a **blue note**. Slid through on the way from the 4th to the 5th, it gives the blues its cry.`,
        scaleFig('A3', 'blues', 'A'),
      ),
      explain(
        'Minor notes over major chords',
        `Here is the surprise: the blues is usually played over **major** chords. The scale's ♭3 (C over an A major chord) clashes with the chord's major 3rd (C♯), and that clash is the point. Singers and guitarists bend the ♭3 up towards the 3rd, landing somewhere in between.

The blue notes are the ♭3, the ♭5 and the ♭7: notes from outside the major scale, sung over major chords.`,
        fig('[A3 C#4 E4]/h C4/q C#4/q', { time: [4, 4], play: 'as-written', labels: ['A', '♭3', '3'] }),
      ),
      explore('Bend a blue note', 'Hold an A major chord with one hand if you can (or play it, then the melody).', [
        task('Hold an A major chord: A C♯ E', C.chord('maj', { root: 'A' })),
        task('Slide from the ♭3 to the 3: play C then C♯', C.melody('C', 'C#')),
        task('Play the A blues scale: A C D D♯ E G A', C.scale('A', 'blues')),
      ]),
      build('Play blues scales', 'Minor pentatonic plus the ♯4: 1, ♭3, 4, ♯4, 5, ♭7.', bluesBuild(3)),
      quiz('Blues or pentatonic?', 'Listen to the scale go up and back down. Can you hear the extra blue note?', 'Which scale do you hear?', sameTonicRounds(['blues', 'minor-pentatonic', 'major-pentatonic'], 5), { mode: 'hear' }),
    ],
    { key: 'A' },
  ),
  lesson(
    'th15-3',
    'Modes from the Major Scale',
    'learn',
    'Seven scales from the same seven notes',
    [
      explain(
        'Start somewhere else',
        `Play the white keys from C to C and you have C major. Play the same white keys from **D to D** and it sounds quite different: darker, a little folky. Nothing changed but the starting note, and with it the order of tones and semitones.

Each starting note gives one of the seven **modes**. They have old Greek names, from medieval church music: starting on C, **Ionian** (the major scale); D, **Dorian**; E, **Phrygian**; F, **Lydian**; G, **Mixolydian**; A, **Aeolian** (the natural minor); B, **Locrian**.`,
        fig('D4/q E4 F4 G4 A4 B4 C5 D5', { labels: 'steps', play: 'as-written', tempo: 120 }),
      ),
      explain(
        'Why they sound different',
        `What makes each mode itself is where its two semitones fall. In C major they come between the 3rd and 4th and the 7th and 8th: W W H W W W H. Start on D and the pattern becomes W H W W W H W, with a minor 3rd above the home note, so Dorian sounds minor.

Count the steps under the notes as you play each one: the home note decides how the same seven notes feel.`,
        fig('E4/q F4 G4 A4 B4 C5 D5 E5', { labels: 'steps', play: 'as-written', tempo: 120 }),
      ),
      build('Play the white-key modes', 'Each mode uses only the white keys, from its own starting note up to the next one with the same name.', whiteModeBuild(4)),
      quiz('Which mode?', 'Count up from C to the starting note: C is Ionian, D Dorian, E Phrygian, F Lydian, G Mixolydian, A Aeolian, B Locrian.', 'Which mode is it?', whiteModeRounds(6)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th15-4',
    'The Colour of Each Mode',
    'learn',
    'One note makes the difference',
    [
      explain(
        'Major-sounding modes',
        `Three modes have a major 3rd, and each is the major scale with one note changed:

- **Lydian**: major with a **sharpened 4th**. Bright and dreamy, a favourite of film composers.
- **Mixolydian**: major with a **flattened 7th**. Bluesy and relaxed: rock, folk and a lot of fiddle tunes.
- **Ionian**: the major scale itself.

Here is G Mixolydian: G major's notes with F natural instead of F♯.`,
        scaleFig('G4', 'mixolydian', 'G'),
      ),
      explain(
        'Minor-sounding modes',
        `Three modes have a minor 3rd and change one note of the natural minor:

- **Dorian**: minor with a **raised 6th**. A brighter, more hopeful minor.
- **Phrygian**: minor with a **flattened 2nd**. Dark, and Spanish-sounding: the half step down to home is the sound of flamenco.
- **Aeolian**: the natural minor itself.

**Locrian** flattens both the 2nd and the 5th. Its home chord is diminished, so it never quite settles; you'll rarely meet a whole piece in it.`,
        scaleFig('D4', 'dorian', 'Dm'),
      ),
      explain(
        'Dorian in a sea shanty',
        `*What shall we do with the drunken sailor?* is in D Dorian. It's a minor tune, but listen for the B natural in the second bar here: that's Dorian's raised 6th, and it's what makes the tune bounce instead of mourn.`,
        fig(DRUNKEN_SAILOR, { time: [2, 4], key: 'Dm', tempo: 116, keys: false }),
      ),
      quiz('Name the mode', 'Each mode is a major or minor scale with one note changed.', 'Which mode is this?', characterRounds(6)),
      build('Play modes anywhere', 'Start from the major or minor scale on the same note, then change the one note that gives the mode its colour.', modeBuild(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th15-5',
    'Modes by Ear',
    'ear',
    'Hear the colour of a scale',
    [
      explain(
        'Listen for the odd note',
        `Every mode played from the same note shares most of its notes with major or minor. So listen in two steps: first, is the 3rd major or minor? Then, which note sounds different from plain major or plain minor?

A bright, floating 4th is Lydian; a bluesy 7th is Mixolydian. A hopeful 6th is Dorian; a dark half step at the top, falling home, is Phrygian.`,
        scaleFig('C4', 'lydian', 'C'),
      ),
      quiz('Major or Mixolydian?', 'Both are major. Listen to the 7th, just below the top note: a semitone below (major) or a tone below (Mixolydian)?', 'Which do you hear?', sameTonicRounds(['major', 'mixolydian', 'lydian'], 5), { mode: 'hear' }),
      quiz('Minor or Dorian?', 'Both are minor. Listen for the 6th (bright in Dorian) and the 2nd (dark in Phrygian).', 'Which do you hear?', sameTonicRounds(['natural-minor', 'dorian', 'phrygian'], 5), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th15-6',
    'Chromatic and Whole-Tone Scales',
    'learn',
    'Two scales with no home',
    [
      explain(
        'Every note',
        `The **chromatic scale** uses all twelve notes, each a semitone from the next. Because every step is the same, no note stands out as home: it's a colour rather than a key. Melodies use bits of it to slide between notes (those are the accidentals you meet in otherwise plain music).`,
        fig('C4/q C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5', { play: 'as-written', tempo: 160, labels: 'steps' }),
      ),
      explain(
        'All tones',
        `The **whole-tone scale** takes every other note: six notes, each a tone apart. With no semitones and no perfect 5th above its first note, it floats: think of a dream sequence in an old film, or the music of Claude Debussy.

There are only two different whole-tone scales: one from C, one from C♯. Every other starting note gives you one of those two again.`,
        fig('C4/q D4 E4 F#4 G#4 A#4 C5', { play: 'as-written', tempo: 120, labels: 'steps' }),
      ),
      explore('Try them', 'Play each scale and listen to how it never lands.', [
        task('Play the chromatic scale up from C: every key, black and white, to the next C', C.scale('C', 'chromatic')),
        task('Play the whole-tone scale up from C: C D E F♯ G♯ A♯ C', C.scale('C', 'whole-tone')),
        task('Hold three notes of it a major 3rd apart: an augmented triad (C E G♯)', C.chord('aug')),
      ]),
      build('Whole tones anywhere', 'Every step a tone: two keys along each time, black or white.', scaleBuildRounds({ tonics: ['C4', 'D4', 'Db4', 'E4', 'G3'], scale: 'whole-tone', count: 3 })),
      quiz('Which scale?', 'Listen: does it have a home note, and are its steps all the same?', 'Which scale do you hear?', sameTonicRounds(['chromatic', 'whole-tone', 'major', 'major-pentatonic'], 5), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th15-c',
    'Checkpoint: Modes and Scales',
    'checkpoint',
    'Pentatonics, blues, modes and the scales with no home',
    [
      quiz('Which scale?', '', 'Which scale is this?', scaleRounds({ scales: ['major-pentatonic', 'minor-pentatonic', 'blues', 'dorian', 'mixolydian', 'lydian', 'phrygian'], tonics: ['C4', 'D4', 'G3', 'A3'], count: 6 })),
      build('Play them', '', rng => [...pentatonicBuild(1)(rng), ...bluesBuild(1)(rng), ...modeBuild(2)(rng)]),
      quiz('Name the mode', '', 'Which mode is this?', rng => [...characterRounds(3)(rng), ...whiteModeRounds(2)(rng)]),
      quiz('By ear', '', 'Which do you hear?', sameTonicRounds(['major', 'mixolydian', 'natural-minor', 'dorian', 'whole-tone'], 5), { mode: 'hear' }),
      quiz('Facts', '', 'Which is right?', [
        round('How many different notes has a pentatonic scale?', 'Five', ['Five', 'Six', 'Seven']),
        round('Which note does the blues scale add to the minor pentatonic?', 'The ♯4 (♭5)', ['The ♯4 (♭5)', 'The major 3rd', 'The major 7th']),
        round('How many different whole-tone scales are there?', 'Two', ['Two', 'Six', 'Twelve']),
        round('C major pentatonic has the same notes as which scale?', 'A minor pentatonic', ['A minor pentatonic', 'C minor pentatonic', 'G major pentatonic']),
      ]),
    ],
  ),
]);
