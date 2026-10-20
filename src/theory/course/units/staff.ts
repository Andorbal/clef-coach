/**
 * Unit 2: the staff and its clefs. Lines and spaces, the treble and bass clefs, middle C,
 * ledger lines and the grand staff, then the C clefs the viola and cello read. Every
 * lesson ends in reading: name what's on the staff, then play it.
 *
 * Reading figures keep the keyboard dark (`keys: false`): the staff is the question, so
 * the keys mustn't give the answer away.
 */
import type { Rng } from '../../../curriculum/generate';
import { name as nameDrill } from '../../../curriculum/builders';
import { parsePitch } from '../../../music/pitch';
import type { Clef } from '../../../music/score';
import { C, build, choices, draw, drill, explain, explore, fig, lesson, pick, quiz, round, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const TREBLE_LINES = ['E4', 'G4', 'B4', 'D5', 'F5'];
const TREBLE_SPACES = ['F4', 'A4', 'C5', 'E5'];
const BASS_LINES = ['G2', 'B2', 'D3', 'F3', 'A3'];
const BASS_SPACES = ['A2', 'C3', 'E3', 'G3'];
const TREBLE_STAFF = 'E4 F4 G4 A4 B4 C5 D5 E5 F5';
const BASS_STAFF = 'G2 A2 B2 C3 D3 E3 F3 G3 A3';
const ALTO_STAFF = 'F3 G3 A3 B3 C4 D4 E4 F4 G4';
const TENOR_STAFF = 'D3 E3 F3 G3 A3 B3 C4 D4 E4';

const list = (s: string) => s.split(' ');
const letter = (n: string) => parsePitch(n).step;
const read = (note: string, clef: Clef | 'grand') => fig(note, { clef, keys: false });

/** Which line or space a note is on, counted from the bottom of its clef's staff. */
function placeOf(note: string, clef: 'treble' | 'bass'): string {
  const lines = clef === 'treble' ? TREBLE_LINES : BASS_LINES;
  const spaces = clef === 'treble' ? TREBLE_SPACES : BASS_SPACES;
  const li = lines.indexOf(note);
  if (li >= 0) return `the ${['bottom', 'second', 'middle', 'fourth', 'top'][li]} line`;
  const si = spaces.indexOf(note);
  return si >= 0 ? `the ${['bottom', 'second', 'third', 'top'][si]} space` : 'a ledger line';
}

/** Line or space? */
function lineSpaceRounds(clef: 'treble' | 'bass', count: number) {
  const lines = clef === 'treble' ? TREBLE_LINES : BASS_LINES;
  const spaces = clef === 'treble' ? TREBLE_SPACES : BASS_SPACES;
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Line', 'Space'], count).map(kind => {
      const n = pick(rng, kind === 'Line' ? lines : spaces);
      return { figure: read(n, clef), options: ['Line', 'Space'], answer: kind, explain: `It sits ${kind === 'Line' ? 'on' : 'in'} ${placeOf(n, clef)}.` };
    });
}

/** Step (the next letter) or skip (a letter missed out)? */
function stepSkipRounds(count: number) {
  const pool = list(TREBLE_STAFF);
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Step', 'Skip'], count).map(kind => {
      const i = Math.floor(rng() * (pool.length - 2));
      const [a, b] = rng() < 0.5 ? [pool[i], pool[i + (kind === 'Step' ? 1 : 2)]] : [pool[i + (kind === 'Step' ? 1 : 2)], pool[i]];
      return {
        figure: fig(`${a} ${b}`, { clef: 'treble', keys: false }),
        options: ['Step', 'Skip'],
        answer: kind,
        explain: kind === 'Step' ? `${letter(a)} to ${letter(b)}: line to space (or space to line), the next letter.` : `${letter(a)} to ${letter(b)}: line to line (or space to space), one letter missed out.`,
      };
    });
}

/** Name the note on the staff. */
function nameRounds(clef: Clef | 'grand', pool: string[], count: number, prompt = 'Which note is this?') {
  return (rng: Rng): QuizRound[] =>
    draw(rng, pool, count).map(n => ({ prompt, figure: read(n, clef), options: choices(rng, letter(n), WHITE, 7, true), answer: letter(n), explain: `It’s ${n}.` }));
}

/** Play the note on the staff, in its octave. */
function playRounds(clef: Clef | 'grand', pool: string[], count: number): (rng: Rng) => BuildRound[] {
  return rng =>
    draw(rng, pool, count).map(n => ({
      prompt: 'Play the note on the staff (in the right octave)',
      figure: read(n, clef),
      check: C.note(n),
      answer: [n],
      explain: `That’s ${n}.`,
    }));
}

/** Above or below middle C? */
function middleCRounds(count: number) {
  const below = ['C3', 'E3', 'G3', 'A3', 'B3', 'F3', 'D3'];
  const above = ['D4', 'E4', 'G4', 'A4', 'C5', 'F4', 'B4'];
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Below middle C', 'Middle C', 'Above middle C', 'Below middle C', 'Above middle C'], count).map(kind => {
      const n = kind === 'Middle C' ? 'C4' : pick(rng, kind === 'Below middle C' ? below : above);
      return { figure: read(n, 'grand'), options: ['Below middle C', 'Middle C', 'Above middle C'], answer: kind, explain: `It’s ${n}.` };
    });
}

export const staffUnit = unit('th-staff', 'The Staff and Clefs', 'Reading pitch', 'Five lines, two clefs and middle C: how a note’s place on the page tells you its pitch.', [
  lesson(
    'th2-1',
    'Lines and Spaces',
    'learn',
    'How the staff shows pitch',
    [
      explain(
        'Five lines',
        `Music is written on a **staff**: five lines with four spaces between them. Notes sit either **on a line** (the line runs through the middle of the note) or **in a space**.

The staff is a picture of pitch: the higher a note sits, the higher it sounds. Lines and spaces are counted **from the bottom**. The labels under these notes show L for a line and S for a space.`,
        fig(TREBLE_STAFF.split(' ').map(n => `${n}/q`).join(' '), { clef: 'treble', labels: ['L', 'S', 'L', 'S', 'L', 'S', 'L', 'S', 'L'], play: 'as-written' }),
      ),
      explain(
        'Steps and skips',
        `Moving from a line to the very next space (or a space to the next line) is a **step**: the next letter of the alphabet, up or down.

Moving from a line to the next line (or a space to the next space) is a **skip**: one letter is missed out. A long way up the staff is a big jump in pitch.`,
        fig('E4 F4 G4 | E4 G4 B4', { clef: 'treble', labels: ['', 'step', 'step', '', 'skip', 'skip'], play: 'as-written' }),
      ),
      quiz('Line or space?', 'Look where the note sits: does a line run through it, or does it sit between two lines?', 'Is this note on a line or in a space?', lineSpaceRounds('treble', 8)),
      quiz('Step or skip?', 'Two notes, one after the other. Do they move to the very next line or space, or jump over one?', 'A step or a skip?', stepSkipRounds(6)),
    ],
  ),
  lesson(
    'th2-2',
    'The Treble Clef',
    'learn',
    'Read every line and space of the treble staff',
    [
      explain(
        'The G clef',
        `A **clef** at the start of the staff tells you which notes the lines mean. The **treble clef** curls round the second line from the bottom, and that line is **G**: the G above middle C (G4). That's why it's also called the **G clef**.

From that G you can find any note by counting steps: up a step is A, down a step is F. Treble clef is for higher sounds: the right hand on a piano, violin, flute, guitar, voices.`,
        fig('G4', { clef: 'treble', labels: 'names', play: 'as-written' }),
      ),
      explain(
        'The lines: E G B D F',
        `The five lines of the treble staff, from the bottom, are **E G B D F**. A saying helps: **E**very **G**ood **B**oy **D**eserves **F**un.

Say it once or twice, then check it against the staff: E on the bottom line, F on the top.`,
        fig(TREBLE_LINES.join(' '), { clef: 'treble', labels: 'names', play: 'as-written' }),
      ),
      explain(
        'The spaces: F A C E',
        `The four spaces, from the bottom, spell a word: **F A C E**. Face is in the space.

Between them, lines and spaces give you every step from E (bottom line) to F (top line): E F G A B C D E F.`,
        fig(TREBLE_SPACES.join(' '), { clef: 'treble', labels: 'names', play: 'as-written' }),
      ),
      explore('Find them', 'Play each note. Your notes appear on the staff as you play, so you can check where they land.', [
        task('Play G4, the line the clef curls round', C.note('G4')),
        task('Play E4, the bottom line', C.note('E4')),
        task('Play F5, the top line', C.note('F5')),
        task('Play the spaces F A C E, bottom to top', C.melody('F4', 'A4', 'C5', 'E5')),
      ]),
      quiz('Name the note', 'Count from a line you know (G, or the E at the bottom) and name the note.', 'Which note is this?', nameRounds('treble', list(TREBLE_STAFF), 8)),
      build('Play what you see', 'A note on the treble staff: play it on the keyboard, in the same octave. The labels under the keys (C4, C5) help you find the octave.', playRounds('treble', list(TREBLE_STAFF), 6)),
    ],
    { topics: ['staff:treble'] },
  ),
  lesson(
    'th2-3',
    'The Bass Clef',
    'learn',
    'Read every line and space of the bass staff',
    [
      explain(
        'The F clef',
        `The **bass clef** is for lower sounds: the left hand on a piano, cello, bass, bassoon, trombone. Its two dots sit either side of the fourth line from the bottom, and that line is **F**: the F below middle C (F3). So it's also called the **F clef**.

The same staff, a different clef: here the bottom line is G, not E. Each clef is a key to reading the lines.`,
        fig('F3', { clef: 'bass', labels: 'names', play: 'as-written' }),
      ),
      explain(
        'The lines: G B D F A',
        `The bass staff's lines, from the bottom, are **G B D F A**: **G**ood **B**oys **D**o **F**ine **A**lways.`,
        fig(BASS_LINES.join(' '), { clef: 'bass', labels: 'names', play: 'as-written' }),
      ),
      explain(
        'The spaces: A C E G',
        `The spaces, from the bottom, are **A C E G**: **A**ll **C**ows **E**at **G**rass.

Notice the bass staff is the treble staff moved down: what's a line in one is often a space in the other, so learn each clef on its own terms rather than translating.`,
        fig(BASS_SPACES.join(' '), { clef: 'bass', labels: 'names', play: 'as-written' }),
      ),
      explore('Find them', 'Play each note, and watch it appear on the staff.', [
        task('Play F3, the line between the clef’s dots', C.note('F3')),
        task('Play G2, the bottom line', C.note('G2')),
        task('Play A3, the top line', C.note('A3')),
        task('Play the spaces A C E G, bottom to top', C.melody('A2', 'C3', 'E3', 'G3')),
      ]),
      quiz('Name the note', 'Count from a line you know (F between the dots, or G at the bottom).', 'Which note is this?', nameRounds('bass', list(BASS_STAFF), 8)),
      build('Play what you see', 'A note on the bass staff: play it in the same octave.', playRounds('bass', list(BASS_STAFF), 6)),
    ],
    { range: ['C2', 'C5'], topics: ['staff:bass'] },
  ),
  lesson(
    'th2-4',
    'Middle C and the Grand Staff',
    'learn',
    'Ledger lines, and two staves joined into one',
    [
      explain(
        'Ledger lines',
        `Notes can go above or below the staff. Short extra lines called **ledger lines** carry the staff on for just that note.

**Middle C** (C4) sits on one ledger line below the treble staff. Below it, B3 hangs from that line and A3 sits on a second one. Above the staff, A5 sits on a ledger line and C6 on two.`,
        fig('A3/q B3 C4 D4 | G5 A5 B5 C6', { clef: 'treble', labels: 'names', play: 'as-written' }),
      ),
      explain(
        'The grand staff',
        `Join a treble staff and a bass staff with a brace and you have the **grand staff**, used for piano, harp and organ: the whole range in one picture.

Middle C sits exactly between them, on a ledger line of its own: one below the treble staff, or one above the bass staff. It's the same note, the same key, written either way.`,
        fig('C3/q E3 G3 C4 E4 G4 C5/h', { clef: 'grand', labels: 'names', play: 'as-written' }),
      ),
      explore('Up and down the grand staff', 'Play each note and watch which staff it lands on.', [
        task('Play middle C (C4)', C.note('C4')),
        task('Play G2, the bottom line of the bass staff', C.note('G2')),
        task('Play F5, the top line of the treble staff', C.note('F5')),
        task('Hold C3 and C5 together, a C on each staff', C.chordOf('C3', 'C5')),
      ]),
      quiz('Above or below?', 'Is the note above middle C, below it, or middle C itself?', 'Where is this note?', middleCRounds(6)),
      build('Play what you see', 'Notes from the whole grand staff, ledger lines included.', playRounds('grand', ['A3', 'B3', 'C4', 'D4', 'G5', 'A5', 'E2', 'F2', 'G2', 'B3', 'C4', 'E3', 'G4', 'D5'], 7)),
    ],
    { range: ['C2', 'C6'], topics: ['staff:grand'] },
  ),
  lesson(
    'th2-5',
    'The C Clefs',
    'learn',
    'The alto and tenor clefs of the viola and cello',
    [
      explain(
        'A clef that points at C',
        `There's a third clef, the **C clef**: wherever its centre points, that line is **middle C**. It can sit on different lines, so it keeps middle-range music on the staff without ledger lines.

On the middle line it's the **alto clef**: the viola reads it all the time. Here are its lines: F3, A3, middle C in the middle, E4 and G4.`,
        fig('F3 A3 C4 E4 G4', { clef: 'alto', labels: 'names', play: 'as-written' }),
      ),
      explain(
        'The tenor clef',
        `On the fourth line it's the **tenor clef**: cellists, bassoonists and trombonists switch to it for high passages, so they don't need a forest of ledger lines above the bass staff. Its lines are D3, F3, A3, middle C (the fourth line) and E4.`,
        fig('D3 F3 A3 C4 E4', { clef: 'tenor', labels: 'names', play: 'as-written' }),
      ),
      quiz('Name the note: alto clef', 'Find middle C (the middle line) and count from it.', 'Which note is this?', nameRounds('alto', list(ALTO_STAFF), 6)),
      build('Play what you see', 'Alto clef first, then a few in tenor clef. Middle C is your landmark in both.', rng => [...playRounds('alto', list(ALTO_STAFF), 4)(rng), ...playRounds('tenor', list(TENOR_STAFF), 3)(rng)]),
      quiz('Which C?', 'The same middle C, written in four clefs.', 'Where is middle C?', [
        round('In the treble clef, middle C is…', 'One ledger line below the staff', ['One ledger line below the staff', 'The bottom line', 'One ledger line above the staff'], { figure: read('C4', 'treble') }),
        round('In the bass clef, middle C is…', 'One ledger line above the staff', ['One ledger line above the staff', 'The top line', 'One ledger line below the staff'], { figure: read('C4', 'bass') }),
        round('In the alto clef, middle C is…', 'The middle line', ['The middle line', 'The fourth line', 'The bottom line'], { figure: read('C4', 'alto') }),
        round('In the tenor clef, middle C is…', 'The fourth line', ['The fourth line', 'The middle line', 'The top line'], { figure: read('C4', 'tenor') }),
      ]),
    ],
    { range: ['C3', 'C5'], topics: ['staff:alto', 'staff:tenor'] },
  ),
  lesson(
    'th2-c',
    'Checkpoint: Reading the Staff',
    'checkpoint',
    'Name and play notes in the treble and bass clefs',
    [
      quiz('Treble clef', '', 'Which note is this?', nameRounds('treble', [...list(TREBLE_STAFF), 'C4', 'D4', 'G5', 'A5'], 6)),
      quiz('Bass clef', '', 'Which note is this?', nameRounds('bass', [...list(BASS_STAFF), 'E2', 'F2', 'B3', 'C4'], 6)),
      drill('Note rush', 'Name each note as fast as you can: tap the letter or play it.', nameDrill('bass', BASS_STAFF, 10, { title: 'Bass clef rush' })),
      build('Play what you see', '', playRounds('grand', ['E4', 'G4', 'C5', 'F5', 'C4', 'G2', 'D3', 'A3', 'F3', 'B3'], 6)),
      quiz('Alto clef', '', 'Which note is this?', nameRounds('alto', list(ALTO_STAFF), 3)),
    ],
    { range: ['C2', 'C6'] },
  ),
]);
