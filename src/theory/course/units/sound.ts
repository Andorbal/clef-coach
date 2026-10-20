/**
 * Unit 1: sound and the keyboard. Pitch, the musical alphabet, octaves, sharps and flats,
 * tones and semitones: the map every later lesson reads from. No staff yet (it comes in
 * unit 2), so the figures light keys rather than write notes.
 */
import { C, build, explain, explore, fig, lesson, quiz, round, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';
import { draw, pick, choices } from '../build';
import { parsePitch, stepLabel } from '../../../music/pitch';
import { pitchText, transpose } from '../../theory';
import type { Rng } from '../../../curriculum/generate';

const keysOnly = (notes: string, o: { play?: 'as-written' | 'together' | 'apart-then-together' } = {}) => fig(notes, { staff: false, ...o });

const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const label = (n: string) => {
  const p = parsePitch(n);
  return stepLabel(p.step, p.alter);
};

/** Name a lit white key (no staff: the keyboard is the picture). */
function whiteKeyRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, WHITE, count).map(step => {
      const note = `${step}${pick(rng, [3, 4, 4, 5])}`;
      return { prompt: 'Which note is lit up?', figure: keysOnly(note), options: choices(rng, step, WHITE, 7, true), answer: step };
    });
}

/** Play a sharp or flat: the black key just above or below a white key. */
function blackKeyRounds(count: number) {
  const names = ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb'];
  return (rng: Rng): BuildRound[] =>
    draw(rng, names, count).map(n => {
      const p = parsePitch(`${n}4`);
      const from = p.alter > 0 ? `${p.step}4` : `${p.step}4`;
      return {
        prompt: `Play ${label(`${n}4`)}`,
        check: C.note(n),
        answer: [pitchText(p)],
        explain: `${label(`${n}4`)} is the black key just ${p.alter > 0 ? 'above' : 'below'} ${label(from)}.`,
      };
    });
}

/** Tone or semitone between two notes (by ear and by eye on the keys). */
function stepRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['m2', 'M2'], count).map(iv => {
      const a = parsePitch(`${pick(rng, WHITE)}4`);
      const b = transpose(a, iv);
      const answer = iv === 'm2' ? 'Semitone' : 'Tone';
      return {
        figure: keysOnly(`${pitchText(a)} ${pitchText(b)}`),
        options: ['Semitone', 'Tone'],
        answer,
        explain: `${label(pitchText(a))} to ${label(pitchText(b))}: ${iv === 'm2' ? 'the very next key, a semitone' : 'two semitones, a tone'}.`,
      };
    });
}

export const soundUnit = unit('th-sound', 'Sound and the Keyboard', 'Start here', 'High and low, the seven letters, octaves, sharps and flats: the map of every note.', [
  lesson(
    'th1-1',
    'High and Low',
    'learn',
    'Hear pitch, and see it on the keyboard',
    [
      explain(
        'Pitch',
        `Every musical sound is something vibrating: a string, the air in a pipe, a speaker cone. Fast vibrations sound **high**; slow ones sound **low**. How high or low a note sounds is its **pitch**.

On a keyboard, pitch goes from left to right: the lowest notes are on the left, the highest on the right. Every instrument has its own range, but the keyboard is the clearest map of pitch there is, so Theory School uses it throughout. You don't need to play the piano: any key, any finger.`,
        keysOnly('C3 C4 C5', { play: 'as-written' }),
      ),
      explore('Try it', 'Play anything on the keyboard below (tap it, use a MIDI keyboard, or the computer keys A W S E D F…). Watch your notes appear above it, named.', [
        task('Play a few low notes on the left', C.any(3)),
        task('Now some high notes on the right', C.any(6)),
        task('Play two notes together', C.interval([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { together: true })),
      ]),
      quiz('Higher or lower?', 'Two notes, one after the other. Is the second higher or lower than the first?', 'Is the second note higher or lower?', rng =>
        draw(rng, ['higher', 'lower'], 6).map(dir => {
          const a = pick(rng, [55, 57, 60, 62, 64, 65, 67]);
          const b = a + (dir === 'higher' ? 1 : -1) * pick(rng, [2, 3, 4, 5, 7]);
          const n = (m: number) => `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12]}${Math.floor(m / 12) - 1}`;
          return { figure: keysOnly(`${n(a)} ${n(b)}`), options: ['Higher', 'Lower'], answer: dir === 'higher' ? 'Higher' : 'Lower' };
        }),
        { mode: 'hear' },
      ),
    ],
    { topics: ['pitch'] },
  ),
  lesson(
    'th1-2',
    'The Musical Alphabet',
    'learn',
    'Seven letters, A to G, round and round',
    [
      explain(
        'Seven letters',
        `Music names its notes with just seven letters: **A B C D E F G**. After G comes A again, a little higher, and the pattern repeats all the way up.

On the keyboard the letters are the **white keys**. The black keys come in groups of **two** and **three**, and those groups are how you find your way: **C** is the white key just to the left of every group of two black keys.`,
        keysOnly('C3 C4 C5'),
      ),
      explore('Find the notes', 'The black keys are your landmarks. C sits just left of the two black keys; F just left of the three.', [
        task('Play a C (left of the two black keys)', C.note('C')),
        task('Play an F (left of the three black keys)', C.note('F')),
        task('Play C D E F G A B C, one after another, going up', C.melody('C', 'D', 'E', 'F', 'G', 'A', 'B', 'C')),
      ]),
      quiz('Name the key', 'A key lights up. Which letter is it? Find the nearest group of black keys and count from C or F.', 'Which note is lit up?', whiteKeyRounds(8)),
    ],
    { topics: ['note-names'] },
  ),
  lesson(
    'th1-3',
    'Octaves',
    'learn',
    'The same note, higher or lower',
    [
      explain(
        'Same name, different height',
        `Play a C, then the next C up. They sound like the *same note*, one higher than the other. That distance is an **octave** (eight letters: C D E F G A B C). An octave higher, a string vibrates exactly twice as fast; that's why the two notes blend so well.

To say *which* C, musicians number the octaves: **middle C**, in the middle of the piano, is **C4**. The C below it is C3, the one above C5. Every letter from C up to B shares its C's number: the D just above middle C is D4.`,
        keysOnly('C3 C4 C5', { play: 'as-written' }),
      ),
      explore('Hear octaves', 'Notes an octave apart share a name. Play some.', [
        task('Play middle C (C4)', C.note('C4')),
        task('Hold two Cs an octave apart together', C.interval(12, { from: 'C', together: true })),
        task('Play any note and then the same note an octave higher', C.interval(12, { up: true })),
      ]),
      quiz('Same note?', 'Two notes: are they the same letter an octave apart, or two different notes?', 'An octave apart, or different notes?', rng =>
        draw(rng, ['octave', 'other'], 6).map(kind => {
          const a = parsePitch(`${pick(rng, WHITE)}3`);
          const b = kind === 'octave' ? transpose(a, 'P8') : transpose(a, pick(rng, ['M7', 'm7', 'M6', 'P5', 'M9']));
          return { figure: keysOnly(`${pitchText(a)} ${pitchText(b)}`), options: ['An octave', 'Different notes'], answer: kind === 'octave' ? 'An octave' : 'Different notes', explain: `${label(pitchText(a))} and ${label(pitchText(b))}.` };
        }),
        { mode: 'hear' },
      ),
    ],
    { topics: ['octaves'] },
  ),
  lesson(
    'th1-4',
    'Sharps and Flats',
    'learn',
    'The black keys, semitones and tones',
    [
      explain(
        'Semitones',
        `The smallest step in Western music is a **semitone** (a half step): from any key to the very next one, black or white. Two semitones make a **tone** (a whole step).

Most white keys have a black key between them, so they are a tone apart. Two pairs don't: **E–F** and **B–C** are only a semitone apart. Look at the keyboard: there's no black key between them.`,
        keysOnly('E4 F4 B4 C5', { play: 'as-written' }),
      ),
      explain(
        'Sharp ♯ and flat ♭',
        `A **sharp** (♯) raises a note by a semitone; a **flat** (♭) lowers it by one. The black key between C and D is C♯ (C raised) and also D♭ (D lowered): two names for one key. Names like these, for the same sound, are called **enharmonic**.

Which name to use depends on the music around it, and later lessons will show why. White keys can be sharp or flat too: E♯ is the key we usually call F, and C♭ is B.`,
        keysOnly('C#4 Db4', { play: 'as-written' }),
      ),
      build('Play the black keys', 'A sharp is the key just above (to the right); a flat is the key just below (to the left).', blackKeyRounds(6)),
      quiz('Tone or semitone?', 'Two neighbouring notes. Are they a semitone (next key) or a tone (two semitones) apart?', 'Semitone or tone?', stepRounds(6)),
    ],
    { topics: ['accidentals', 'semitones'] },
  ),
  lesson(
    'th1-c',
    'Checkpoint: The Keyboard',
    'checkpoint',
    'Letters, octaves, sharps and flats',
    [
      quiz('Name the key', '', 'Which note is lit up?', whiteKeyRounds(6)),
      build('Play them', '', rng => [...blackKeyRounds(3)(rng), ...draw(rng, WHITE, 3).map(step => ({ prompt: `Play ${step}`, check: C.note(step), answer: [`${step}4`] }))]),
      quiz('Tone or semitone?', '', 'Semitone or tone?', stepRounds(4)),
      quiz('Enharmonics', '', 'Which is another name for this note?', [
        round('Another name for C♯?', 'D♭', ['D♭', 'B♯', 'E♭'], { figure: keysOnly('C#4') }),
        round('Another name for G♭?', 'F♯', ['F♯', 'A♯', 'G♯'], { figure: keysOnly('Gb4') }),
        round('Another name for the key we call F?', 'E♯', ['E♯', 'G♭', 'F♭'], { figure: keysOnly('F4') }),
        round('Another name for B♭?', 'A♯', ['A♯', 'C♭', 'B♯'], { figure: keysOnly('Bb4') }),
      ]),
    ],
  ),
]);
