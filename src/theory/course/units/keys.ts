/**
 * Unit 6: key signatures. Why the sharps or flats go at the start of every line, the order
 * they come in, naming a key from its signature at a glance, the circle of fifths, and
 * accidentals that overrule the signature for a bar.
 */
import type { Rng } from '../../../curriculum/generate';
import { keysig } from '../../../curriculum/builders';
import { keyAlterations, parseKey } from '../../../music/keys';
import { type Pitch, stepLabel } from '../../../music/pitch';
import { pitchText, scaleNotes, tonicPitch } from '../../theory';
import { C, build, choices, drill, explain, explore, fig, intervalBuildRounds, keySignatureRounds, lesson, pick, quiz, task, unit } from '../build';
import type { QuizRound } from '../types';

const lab = (p: Pitch) => stepLabel(p.step, p.alter);
const keyLabel = (k: string) => {
  const key = parseKey(k);
  const t = tonicPitch(key);
  return `${lab(t)} ${key.mode}`;
};

/**
 * Read a note under a key signature: plain notes take the signature's sharp or flat, a
 * natural sign (or a written accidental) overrules it.
 */
function signatureNoteRounds(keys: string[], count: number, naturals = true) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const k = pick(rng, keys);
      const key = parseKey(k);
      const alt = keyAlterations(key.fifths);
      const scale = scaleNotes(tonicPitch(key, 4), key.mode === 'major' ? 'major' : 'natural-minor').slice(0, 7);
      const altered = scale.filter(p => alt[p.step] !== 0);
      const note = pick(rng, altered);
      const natural = naturals && rng() < 0.35;
      const shown: Pitch = natural ? { ...note, alter: 0 } : note;
      const answer = lab(shown);
      const other = natural ? note : { ...note, alter: 0 };
      const third = { ...note, alter: -alt[note.step] };
      return {
        prompt: `In ${keyLabel(k)}, which note is this?`,
        // no lit key: that would give the answer away
        figure: fig(pitchText(shown), { key: k, keys: false }),
        options: choices(rng, answer, [answer, lab(other), lab(third)], 3),
        answer,
        explain: natural ? `The natural sign cancels the key signature’s ${alt[note.step] > 0 ? 'sharp' : 'flat'}: it’s ${answer}.` : `There’s no accidental by the note, so the key signature decides: every ${note.step} in ${keyLabel(k)} is ${answer}.`,
      };
    });
}

/** The circle of fifths, clockwise from C (F♯ and G♭ meet at the bottom). */
const CIRCLE = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

/** Round the circle: the key a fifth above (clockwise) or below (anticlockwise). */
function circleRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const clockwise = rng() < 0.6;
      // stay away from the bottom of the circle, where F♯ and G♭ are the same key
      const i = pick(rng, clockwise ? [0, 1, 2, 3, 4, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5, 9, 10, 11]);
      const j = (i + (clockwise ? 1 : 11)) % 12;
      const answer = keyLabel(CIRCLE[j]);
      return {
        prompt: `Going ${clockwise ? 'clockwise (up a fifth)' : 'anticlockwise (down a fifth)'} from ${keyLabel(CIRCLE[i])}, which key comes next?`,
        options: choices(
          rng,
          answer,
          CIRCLE.filter(k => k !== 'F#').map(keyLabel),
          4,
        ),
        answer,
        explain: `${keyLabel(CIRCLE[i])} → ${answer}: ${clockwise ? 'one more sharp (or one flat fewer)' : 'one more flat (or one sharp fewer)'}.`,
      };
    });
}

export const keysUnit = unit('th-keys', 'Key Signatures', 'Scales and keys', 'The sharps or flats after the clef, the order they come in, and the circle of fifths.', [
  lesson(
    'th6-1',
    'Why Key Signatures',
    'learn',
    'The sharps or flats a key always uses, written once',
    [
      explain(
        'Write it once',
        `A piece in G major uses F♯, never F, so writing a sharp beside every F would be clutter. Instead the sharp goes once, at the start of every line, just after the clef: the **key signature**.

It applies to **every** F, in every octave, all the way through. Here's the G major scale with its key signature: no sharp beside the F, but it's still F♯.`,
        fig('G4 A4 B4 C5 D5 E5 F#5 G5', { key: 'G', labels: 'names' }),
      ),
      explain(
        'Accidentals',
        `A sharp, flat or **natural** sign (♮) written beside a note is an **accidental**. It overrules the key signature, but only for that note's line or space, and only until the end of the bar.

In G major, a natural sign turns F♯ back into F for the rest of the bar. After the bar line, the key signature is back in charge.`,
        fig('G4/q F4/q F4/q G4/q | F#4/q E4/q F#4/h', { key: 'G', time: [4, 4], labels: 'names' }),
      ),
      explore('Play in G major', 'Every F in G major is F♯. Try it.', [
        task('Play an F♯', C.note('F#')),
        task('Play the G major scale, up', C.scale('G', 'major')),
      ]),
      quiz('Count them', 'Each key has its own number of sharps or flats.', 'How many?', keySignatureRounds({ keys: ['C', 'G', 'D', 'F', 'Bb'], count: 5, ask: 'count' })),
    ],
    { key: 'G', topics: ['keysig'] },
  ),
  lesson(
    'th6-2',
    'Sharp Keys',
    'learn',
    'The order of sharps, and naming a sharp key',
    [
      explain(
        'The order of sharps',
        `Sharps always come in the same order: **F C G D A E B**. A key with one sharp has F♯; with two, F♯ and C♯; with three, F♯ C♯ G♯… A sentence helps: **F**ather **C**harles **G**oes **D**own **A**nd **E**nds **B**attle.

Here are all seven, as written for C♯ major.`,
        fig('r/w', { key: 'C#', keys: false, play: 'none' }),
      ),
      explain(
        'Name it in a second',
        `The **last sharp** of the signature is the leading note of the major key, so the key is a semitone above it. Two sharps, F♯ and C♯: the last is C♯, so the key is **D major**. Three sharps end on G♯: **A major**.`,
        fig('C#5 D5', { key: 'D', labels: ['last sharp', 'the key'] }),
      ),
      quiz('Which key?', 'Find the last sharp, then go up a semitone.', 'Which key is it?', keySignatureRounds({ keys: ['G', 'D', 'A', 'E', 'B', 'F#'], count: 6, ask: 'key' })),
      quiz('Which sharps?', 'Say them in order: F C G D A E B.', 'Which sharps?', keySignatureRounds({ keys: ['G', 'D', 'A', 'E', 'B'], count: 4, ask: 'accidentals' })),
      drill('Sharp keys at a glance', 'Name each key signature as fast as you can.', keysig('treble', 'G D A E', 8)),
    ],
    { key: 'D', topics: ['key:sharps'] },
  ),
  lesson(
    'th6-3',
    'Flat Keys',
    'learn',
    'The order of flats, and naming a flat key',
    [
      explain(
        'The order of flats',
        `Flats come in the opposite order: **B E A D G C F**, the order of sharps backwards. (**B**attle **E**nds **A**nd **D**own **G**oes **C**harles’s **F**ather.)

Here are all seven, as written for C♭ major.`,
        fig('r/w', { key: 'Cb', keys: false, play: 'none' }),
      ),
      explain(
        'Name it in a second',
        `With two or more flats, the **second-to-last flat** is the key: B♭ E♭ → **B♭ major**; B♭ E♭ A♭ → **E♭ major**. One flat on its own is the one to remember: **F major**.`,
        fig('Bb4 Eb5', { key: 'Bb', labels: ['the key', 'last flat'] }),
      ),
      quiz('Which key?', 'The second-to-last flat names it (one flat is F major).', 'Which key is it?', keySignatureRounds({ keys: ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'], count: 6, ask: 'key' })),
      quiz('Count them', 'How many flats does each key have?', 'How many?', keySignatureRounds({ keys: ['F', 'Bb', 'Eb', 'Ab', 'Db'], count: 4, ask: 'count' })),
      drill('Flat keys at a glance', 'Name each key signature as fast as you can.', keysig('treble', 'F Bb Eb Ab', 8)),
    ],
    { key: 'Bb', topics: ['key:flats'] },
  ),
  lesson(
    'th6-4',
    'The Circle of Fifths',
    'learn',
    'Every key in one picture, a fifth apart',
    [
      explain(
        'Up a fifth, one more sharp',
        `Start on C (no sharps or flats) and go up five letters to G: one sharp. Up another fifth to D: two sharps. Then A (three), E (four), B (five)… Each step **up a fifth** adds one sharp.

Laid out in a ring, like a clock, this is the **circle of fifths**: C at the top, the sharp keys going clockwise.`,
        fig('C3 G3 D4 A4 E5 B5', { labels: ['C', 'G 1♯', 'D 2♯', 'A 3♯', 'E 4♯', 'B 5♯'] }),
      ),
      explain(
        'Down a fifth, one more flat',
        `Going the other way, **down a fifth** each time, adds flats: F (one flat), B♭ (two), E♭ (three), A♭ (four), D♭ (five). At the bottom of the circle the two sides meet: **F♯ major** (six sharps) and **G♭ major** (six flats) are the same keys on the piano.

Neighbours on the circle share all but one note. That's why music moves so easily to the key next door.`,
        fig('C5 F4 Bb4 Eb4 Ab4 Db4', { labels: ['C', 'F 1♭', 'B♭ 2♭', 'E♭ 3♭', 'A♭ 4♭', 'D♭ 5♭'] }),
      ),
      quiz('Round the circle', 'Clockwise is up a fifth; anticlockwise is down a fifth.', 'Which key comes next?', circleRounds(6)),
      build('Up a fifth', 'Play the note you’re given, then the note five letters above it (count the one you start on). It’s seven semitones up.', intervalBuildRounds({ intervals: ['P5'], from: ['C4', 'G4', 'D4', 'A3', 'F4', 'Bb3'], count: 4 })),
      quiz('How many?', 'Use the circle: count the steps from C.', 'How many?', keySignatureRounds({ keys: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'], count: 6, ask: 'count' })),
    ],
  ),
  lesson(
    'th6-5',
    'Reading in a Key',
    'practice',
    'Notes under a key signature, and accidentals that overrule it',
    [
      explain(
        'Check the signature first',
        `Before you read a note, read the key signature. In F major, every B is B♭, even though nothing is written beside it. Only an accidental changes that, and only until the bar line: here the natural sign makes the third note B, then the next bar is back to B♭.`,
        fig('A4/q Bb4/q B4/q C5/q | Bb4/q A4/q G4/h', { key: 'F', time: [4, 4], labels: 'names' }),
      ),
      quiz('Name the note', 'Look at the key signature, then at the note: is there an accidental beside it?', 'Which note is it?', signatureNoteRounds(['G', 'D', 'A', 'F', 'Bb', 'Eb', 'E', 'Ab'], 8)),
      drill('All the keys', 'Sharp and flat keys mixed together.', keysig('treble', 'C G D A E F Bb Eb Ab', 10)),
    ],
    { key: 'F' },
  ),
  lesson(
    'th6-c',
    'Checkpoint: Key Signatures',
    'checkpoint',
    'Name keys from their signatures, and read notes in a key',
    [
      quiz('Which key?', '', 'Which key is it?', keySignatureRounds({ keys: ['G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'], count: 5, ask: 'key' })),
      quiz('Name the note', '', 'Which note is it?', signatureNoteRounds(['G', 'D', 'F', 'Bb', 'A', 'Eb'], 5)),
      quiz('Round the circle', '', 'Which key comes next?', circleRounds(4)),
      quiz('Which accidentals?', '', 'Which sharps or flats?', keySignatureRounds({ keys: ['G', 'D', 'A', 'F', 'Bb', 'Eb'], count: 3, ask: 'accidentals' })),
      drill('In the bass clef', 'The same signatures, a line lower.', keysig('bass', 'G D A F Bb Eb', 8)),
    ],
  ),
]);

