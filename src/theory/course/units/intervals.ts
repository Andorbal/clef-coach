/**
 * Unit 8: intervals. The distance between two notes, named exactly: the number from
 * counting letters, the quality (perfect, major, minor, augmented, diminished) from
 * counting semitones. Then inversions, compound intervals, and the sound of consonance
 * and dissonance.
 */
import type { Rng } from '../../../curriculum/generate';
import { interval as intervalDrill } from '../../../curriculum/builders';
import { type Pitch, diatonicIndex, fromDiatonic, midiOf, parsePitch, stepLabel } from '../../../music/pitch';
import { intervalName, intervalShort, withArticle, invertInterval, parseInterval, pitchText, transpose } from '../../theory';
import { C, build, choices, draw, drill, explain, explore, fig, intervalBuildRounds, intervalLabel, intervalRounds, lesson, numberLabel, pick, quiz, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const lab = (p: Pitch) => stepLabel(p.step, p.alter);
const pcOf = (p: Pitch) => pitchText(p).replace(/-?\d+$/, '');

const WHITE_FROM = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'];

/** Play the white key a number of letters above a white key ("the 3rd above D"). */
function whiteIntervalBuildRounds(numbers: number[], count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, numbers, count).map(n => {
      const a = parsePitch(pick(rng, WHITE_FROM));
      const b = fromDiatonic(diatonicIndex(a) + n - 1);
      const semis = midiOf(b) - midiOf(a);
      return {
        prompt: `Play ${lab(a)}, then the white key ${withArticle(numberLabel(n).toLowerCase())} above it`,
        figure: fig(pitchText(a)),
        check: C.interval(semis, { from: pcOf(a), up: true }),
        answer: [pitchText(a), pitchText(b)],
        explain: `Count ${n} letters from ${lab(a)}: ${Array.from({ length: n }, (_, i) => lab(fromDiatonic(diatonicIndex(a) + i))).join(' ')}.`,
      };
    });
}

/** Turn an interval upside down: what does it become? */
function inversionRounds(ids: string[], count: number) {
  const inv = (id: string) => intervalLabel(intervalShort(invertInterval(parseInterval(id))));
  return (rng: Rng): QuizRound[] =>
    draw(rng, ids, count).map(id => {
      const a = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G4']));
      const b = transpose(a, id);
      const up = transpose(a, 'P8');
      const answer = inv(id);
      return {
        prompt: `Turn ${withArticle(intervalName(parseInterval(id)))} upside down. What do you get?`,
        figure: fig(`[${pitchText(a)} ${pitchText(b)}] [${pitchText(b)} ${pitchText(up)}]`, { labels: [intervalShort(parseInterval(id)), '?'] }),
        options: choices(rng, answer, ids.map(inv), 4),
        answer,
        explain: `${lab(a)}–${lab(b)} becomes ${lab(b)}–${lab(up)}: the numbers add up to 9, and ${parseInterval(id).quality === 'P' ? 'perfect stays perfect' : 'major and minor swap (so do augmented and diminished)'}.`,
      };
    });
}

const CONSONANT = ['P5', 'P8', 'M3', 'm3', 'M6', 'm6'];
const DISSONANT = ['m2', 'M2', 'M7', 'm7', 'A4'];

/** Consonant or dissonant, by ear. */
function consonanceRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Consonant', 'Dissonant'], count).map(kind => {
      const id = pick(rng, kind === 'Consonant' ? CONSONANT : DISSONANT);
      const a = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G3', 'A3']));
      const b = transpose(a, id);
      return {
        figure: fig(`[${pitchText(a)} ${pitchText(b)}]/h`, { play: 'together' }),
        options: ['Consonant', 'Dissonant'],
        answer: kind,
        explain: `${lab(a)} and ${lab(b)}: ${withArticle(intervalName(parseInterval(id)))}, ${kind === 'Consonant' ? 'stable and at rest' : 'tense, wanting to move'}.`,
      };
    });
}

export const intervalsUnit = unit('th-intervals', 'Intervals', 'Intervals and the ear', 'The distance between two notes, named exactly: perfect, major, minor, augmented and diminished.', [
  lesson(
    'th8-1',
    'Counting Intervals',
    'learn',
    'Name the distance between two notes by counting letters',
    [
      explain(
        'Distance between notes',
        `An **interval** is the distance between two notes. Its number comes from counting letters, **including both ends**: C to E is C, D, E, so it's a **3rd**. C to G is C D E F G, a **5th**. The same letter is a **unison**, and eight letters up is an **octave**.`,
        fig('C4 D4 E4 F4 G4', { labels: ['1', '2', '3', '4', '5'] }),
      ),
      explain(
        'On the staff',
        `The staff makes counting quick. From a line to the next line is a **3rd**; from a line to the space just above is a **2nd**. Odd numbers (3rds, 5ths, 7ths) go line to line or space to space; even numbers (2nds, 4ths, 6ths) go from a line to a space.`,
        fig('E4 G4 E4 F4 E4 B4', { labels: ['', '3rd', '', '2nd', '', '5th'] }),
      ),
      quiz('Count them', 'Count the letters from the lower note to the higher, including both.', 'What number is this interval?', intervalRounds({ intervals: ['M2', 'M3', 'P4', 'P5', 'M6', 'M7', 'P8'], from: ['C4', 'D4', 'E4', 'F4', 'G4'], count: 6, by: 'number' })),
      build('Play them', 'Count up the white keys from the first note, including it.', whiteIntervalBuildRounds([2, 3, 4, 5, 6, 8], 4)),
      drill('Intervals on the staff', 'Read the distance at a glance.', intervalDrill('treble', 'C4 D4 E4 F4 G4 A4 B4 C5', [2, 3, 4, 5, 6, 8], 8)),
    ],
    { key: 'C', topics: ['intervals'] },
  ),
  lesson(
    'th8-2',
    'Perfect Intervals',
    'learn',
    'Unisons, 4ths, 5ths and octaves',
    [
      explain(
        'Perfect',
        `Four intervals are called **perfect**: the unison, the 4th, the 5th and the octave. They sound open and pure, which is why they were the first harmonies people sang.

Count semitones to be sure: a **perfect 4th** is 5 semitones, a **perfect 5th** is 7, an **octave** 12.`,
        fig('C4 F4 C4 G4 C4 C5', { labels: ['', 'P4', '', 'P5', '', 'P8'] }),
      ),
      explore('Play them', 'Hold each pair down together and listen to how open they sound.', [
        task('Hold a perfect 5th: any note and the note 7 semitones up', C.interval(7, { together: true })),
        task('Hold a perfect 4th: 5 semitones', C.interval(5, { together: true })),
        task('Hold an octave: 12 semitones', C.interval(12, { together: true })),
      ]),
      quiz('Name it', 'Count letters for the number; the semitones confirm it.', 'Which interval is it?', intervalRounds({ intervals: ['P4', 'P5', 'P8'], from: ['C4', 'D4', 'E4', 'G4', 'A3'], count: 6, by: 'name' })),
      quiz('By ear', 'The 5th sounds hollow and strong, the 4th a little restless, the octave like one note doubled.', 'Which interval do you hear?', intervalRounds({ intervals: ['P4', 'P5', 'P8'], from: ['C4', 'D4', 'F4', 'G3', 'A3'], count: 6, by: 'name', harmonic: true }), { mode: 'hear' }),
      build('Play perfect intervals', 'Play the note you’re given, then the note above it.', intervalBuildRounds({ intervals: ['P4', 'P5', 'P8'], from: ['C4', 'D4', 'E4', 'F4', 'G4', 'A3', 'Bb3'], count: 5 })),
    ],
    { key: 'C', topics: ['interval:4', 'interval:5', 'interval:8'] },
  ),
  lesson(
    'th8-3',
    'Major and Minor Intervals',
    'learn',
    '2nds, 3rds, 6ths and 7ths come in two sizes',
    [
      explain(
        'Two sizes',
        `2nds, 3rds, 6ths and 7ths come in two sizes: **major** (the larger) and **minor** (a semitone smaller). A major 3rd is 4 semitones; a minor 3rd is 3.

Here's a handy fact: from the tonic of a major scale, every note above is major or perfect. C–D is a major 2nd, C–E a major 3rd, C–A a major 6th, C–B a major 7th.`,
        fig('C4 D4 E4 F4 G4 A4 B4 C5', { labels: 'intervals' }),
      ),
      explain(
        'Making it minor',
        `Lower the top note by a semitone, **keeping its letter**, and a major interval becomes minor: C–E (major 3rd) becomes C–E♭ (minor 3rd). The letters still say "3rd"; the semitones say "minor".`,
        fig('C4 E4 C4 Eb4', { labels: ['', 'M3', '', 'm3'] }),
      ),
      explore('Two sizes', 'Hold each one and hear major (brighter) against minor (darker).', [
        task('Hold a major 3rd: 4 semitones', C.interval(4, { together: true })),
        task('Hold a minor 3rd: 3 semitones', C.interval(3, { together: true })),
        task('Hold a major 6th: 9 semitones', C.interval(9, { together: true })),
        task('Hold a minor 7th: 10 semitones', C.interval(10, { together: true })),
      ]),
      quiz('Name it', 'Letters give the number; semitones give major or minor.', 'Which interval is it?', intervalRounds({ intervals: ['m2', 'M2', 'm3', 'M3', 'm6', 'M6', 'm7', 'M7'], from: ['C4', 'D4', 'E4', 'F4', 'G4'], count: 8, by: 'name' })),
      quiz('Major or minor 3rd?', 'Major sounds bright, minor darker.', 'Which 3rd do you hear?', intervalRounds({ intervals: ['m3', 'M3'], from: ['C4', 'D4', 'F4', 'G4', 'A3'], count: 6, by: 'name', harmonic: true }), { mode: 'hear' }),
      build('Play them', 'Play the note you’re given, then the interval above it.', intervalBuildRounds({ intervals: ['M2', 'm3', 'M3', 'M6', 'm7'], from: ['C4', 'D4', 'F4', 'G4', 'A3'], count: 5 })),
    ],
    { key: 'C', topics: ['interval:2', 'interval:3', 'interval:6'] },
  ),
  lesson(
    'th8-4',
    'Augmented, Diminished and the Tritone',
    'learn',
    'Intervals stretched or squeezed by a semitone',
    [
      explain(
        'Stretched and squeezed',
        `Make a perfect or major interval a semitone **bigger** and it's **augmented**; make a perfect or minor interval a semitone **smaller** and it's **diminished**.

The same two keys can carry different names. C–F♯ is an **augmented 4th** (the letters say 4th); C–G♭ is a **diminished 5th** (the letters say 5th). Both are six semitones: three whole tones, the **tritone**.`,
        fig('C4 F#4 C4 Gb4', { labels: ['', 'A4', '', 'd5'] }),
      ),
      explain(
        'The restless one',
        `The tritone splits the octave exactly in half, and it never sounds settled. In C major it sits between **F and B**, and it pulls inward: B up to C, F down to E. You'll meet that pull again in the chords to come; it drives the music home.`,
        fig('[F4 B4]/h [E4 C5]/h', { labels: ['tritone', 'at rest'] }),
      ),
      explore('Hear the tension', 'Play the tritone, then let it settle.', [
        task('Hold a tritone: 6 semitones', C.interval(6, { together: true })),
        task('Hold F and B together', C.chordOf('F', 'B')),
        task('Now let it settle: hold E and C together', C.chordOf('E', 'C')),
      ]),
      quiz('Name it', 'The letters decide the number, even when the sound is the same.', 'Which interval is it?', intervalRounds({ intervals: ['P4', 'A4', 'd5', 'P5', 'A2', 'm3'], from: ['C4', 'D4', 'F4', 'G4'], count: 6, by: 'name' })),
      quiz('By ear', 'The tritone sounds tense and unresolved; 4ths and 5ths sound open.', 'Which interval do you hear?', intervalRounds({ intervals: ['P4', 'A4', 'P5'], from: ['C4', 'D4', 'F4', 'G3'], count: 6, by: 'name', harmonic: true }), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th8-5',
    'Inversions and Compound Intervals',
    'learn',
    'Intervals upside down, and bigger than an octave',
    [
      explain(
        'Upside down',
        `Move the lower note up an octave and the interval **inverts**. The two numbers always add up to **9**: a 3rd becomes a 6th, a 2nd a 7th, a 4th a 5th. Major becomes minor and minor major; augmented becomes diminished; perfect stays perfect.

C–E is a major 3rd; turn it over and E–C is a minor 6th.`,
        fig('[C4 E4] [E4 C5]', { labels: ['M3', 'm6'] }),
      ),
      explain(
        'Bigger than an octave',
        `Intervals wider than an octave are **compound**: a 9th is an octave plus a 2nd, a 10th an octave plus a 3rd, a 12th an octave plus a 5th. They keep their simple interval's quality and character, just with more space inside.`,
        fig('C4 D5 C4 E5', { labels: ['', 'M9', '', 'M10'] }),
      ),
      quiz('Turn it over', 'Numbers add to 9; major and minor swap; perfect stays perfect.', 'What is the inversion?', inversionRounds(['M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'm7', 'A4'], 6)),
      quiz('Compound intervals', 'Take away the octave (7 letters), then name what’s left.', 'Which interval is it?', intervalRounds({ intervals: ['m9', 'M9', 'm10', 'M10', 'P11', 'P12'], from: ['C4', 'D4', 'E4', 'G3'], count: 5, by: 'name' })),
      build('Play compound intervals', 'Up an octave, then a little more.', intervalBuildRounds({ intervals: ['M9', 'M10', 'P12'], from: ['C4', 'D4', 'G3'], count: 3 })),
    ],
    { topics: ['interval:10'] },
  ),
  lesson(
    'th8-6',
    'Consonance and Dissonance',
    'ear',
    'Stable intervals and tense ones, and why music needs both',
    [
      explain(
        'At rest, or wanting to move',
        `**Consonant** intervals sound stable: unisons, octaves and 5ths (the perfect consonances), and 3rds and 6ths (sweeter, the imperfect consonances). **Dissonant** ones sound tense: 2nds, 7ths and the tritone. The 4th is in between; it depends on what's around it.

Dissonance isn't a mistake. It's motion: music moves from tension to release, and that journey is most of what makes it move us.`,
        fig('[C4 D4]/h [C4 E4]/h', { labels: ['dissonant', 'consonant'] }),
      ),
      explore('Tension and release', 'Make some tension, then resolve it.', [
        task('Hold two notes a semitone apart', C.interval(1, { together: true })),
        task('Now hold a 3rd (3 or 4 semitones)', C.interval([3, 4], { together: true })),
        task('Hold an octave (12 semitones): the purest consonance of all', C.interval(12, { together: true })),
      ]),
      quiz('Consonant or dissonant?', 'At rest, or tense?', 'Consonant or dissonant?', consonanceRounds(8), { mode: 'hear' }),
      quiz('Name it by ear', 'Every interval in the octave, one note after the other.', 'Which interval do you hear?', intervalRounds({ intervals: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'], from: ['C4', 'D4', 'F4', 'G3', 'A3'], count: 8, by: 'name' }), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th8-c',
    'Checkpoint: Intervals',
    'checkpoint',
    'Name, hear and play intervals',
    [
      quiz('Name it', '', 'Which interval is it?', intervalRounds({ intervals: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'], from: ['C4', 'D4', 'E4', 'F4', 'G4', 'Bb3'], count: 6, by: 'name' })),
      quiz('By ear', '', 'Which interval do you hear?', intervalRounds({ intervals: ['m3', 'M3', 'P4', 'P5', 'P8'], from: ['C4', 'D4', 'F4', 'G3'], count: 4, by: 'name', harmonic: true }), { mode: 'hear' }),
      build('Play them', '', intervalBuildRounds({ intervals: ['M3', 'm3', 'P5', 'M6', 'm7', 'P4'], from: ['C4', 'D4', 'E4', 'F4', 'G4'], count: 4 })),
      quiz('Turn it over', '', 'What is the inversion?', inversionRounds(['M2', 'm3', 'M3', 'P4', 'm6', 'M7'], 3)),
      drill('In the bass clef', 'Intervals on the bass staff.', intervalDrill('bass', 'C3 D3 E3 F3 G3 A3 B3 C4', [2, 3, 4, 5, 6, 7, 8], 8)),
    ],
  ),
]);
