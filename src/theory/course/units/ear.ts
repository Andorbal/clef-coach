/**
 * Unit 9: ear training. Hearing what the earlier units named: notes together or apart, every
 * interval in an octave (with a well-known tune to hang each one on), the four triad
 * colours, major against minor, and playing back short tunes heard but not seen.
 *
 * The quizzes here hide the notes and play them (`mode: 'hear'`); the answer shows them.
 */
import type { Rng } from '../../../curriculum/generate';
import { parseKey } from '../../../music/keys';
import { parsePitch, stepLabel } from '../../../music/pitch';
import { type ScaleId, SCALES, parseInterval, pitchText, scaleNotes, tonicPitch, transpose, withArticle } from '../../theory';
import { C, build, chordRounds, choices, draw, explain, explore, fig, intervalLabel, intervalRounds, lesson, pick, quiz, round, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const label = (n: string) => {
  const p = parsePitch(n);
  return stepLabel(p.step, p.alter);
};

/** Starting notes that keep every interval inside the keyboard. */
const FROM = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
const LOW_FROM = ['C4', 'D4', 'E4', 'F4', 'G4'];

/** Together (harmonic) or one after the other (melodic)? */
function togetherRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['together', 'apart'], count).map(kind => {
      const a = parsePitch(pick(rng, FROM));
      const b = transpose(a, pick(rng, ['M3', 'P4', 'P5', 'M6', 'P8']));
      const notes = kind === 'together' ? `[${pitchText(a)} ${pitchText(b)}]` : `${pitchText(a)} ${pitchText(b)}`;
      return {
        figure: fig(notes, { play: kind === 'together' ? 'together' : 'as-written' }),
        options: ['Together', 'One after the other'],
        answer: kind === 'together' ? 'Together' : 'One after the other',
        explain: kind === 'together' ? 'Both notes at once: a harmonic interval.' : 'One note, then the other: a melodic interval.',
      };
    });
}

/** A step (a 2nd) or a leap (anything wider)? */
function stepLeapRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['step', 'leap'], count).map(kind => {
      const a = parsePitch(pick(rng, FROM));
      const iv = kind === 'step' ? pick(rng, ['m2', 'M2']) : pick(rng, ['m3', 'M3', 'P4', 'P5', 'M6']);
      const down = rng() < 0.4;
      const b = transpose(a, iv, down);
      return {
        figure: fig(`${pitchText(a)} ${pitchText(b)}`, { play: 'as-written' }),
        options: ['A step', 'A leap'],
        answer: kind === 'step' ? 'A step' : 'A leap',
        explain: `${label(pitchText(a))} to ${label(pitchText(b))}: ${kind === 'step' ? 'the next note along, a step' : `a leap of ${withArticle(intervalLabel(iv).toLowerCase())}`}.`,
      };
    });
}

/** Hear two notes, play them back: the first note is given. */
function intervalPlayback(intervals: string[], count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, intervals, count).map(id => {
      const a = parsePitch(pick(rng, LOW_FROM));
      const b = transpose(a, id);
      const semis = parseInterval(id).semitones;
      return {
        prompt: `Play back the two notes you hear. The first is ${label(pitchText(a))}.`,
        figure: fig(`${pitchText(a)} ${pitchText(b)}`, { play: 'as-written' }),
        check: C.interval(semis, { from: pitchText(a).replace(/-?\d$/, ''), up: true }),
        answer: [pitchText(a), pitchText(b)],
        explain: `${label(pitchText(a))} up to ${label(pitchText(b))}: ${withArticle(intervalLabel(id).toLowerCase())}.`,
      };
    });
}

/** Short tunes in a major or minor key: which is it? */
const TUNES = [
  [1, 3, 5, 3, 1],
  [5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5],
  [3, 2, 1, 2, 3, 3, 3],
  [1, 5, 3, 1],
  [5, 3, 4, 2, 1],
];

function tune(tonic: string, scale: ScaleId, degrees: number[]): string[] {
  const s = scaleNotes(tonic, scale);
  return degrees.map(d => pitchText(s[d - 1]));
}

function majorMinorTuneRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['major', 'minor'], count).map(kind => {
      const t = pick(rng, ['C4', 'D4', 'F4', 'G4', 'A3']);
      const notes = tune(t, kind === 'major' ? 'major' : 'natural-minor', pick(rng, TUNES));
      return {
        figure: fig(notes.map(n => `${n}/q`).join(' '), { play: 'as-written', tempo: 104 }),
        options: ['Major', 'Minor'],
        answer: kind === 'major' ? 'Major' : 'Minor',
        explain: kind === 'major' ? `In ${label(t)} major: bright, settled.` : `In ${label(t)} minor: the lowered 3rd gives the darker colour.`,
      };
    });
}

function scaleEarRounds(scales: ScaleId[], count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, scales, count).map(id => {
      const t = pick(rng, ['C4', 'D4', 'E4', 'G4', 'A3']);
      const notes = scaleNotes(t, id).map(pitchText);
      const name = (s: ScaleId) => SCALES[s].name[0].toUpperCase() + SCALES[s].name.slice(1);
      return {
        figure: fig(notes.map(n => `${n}/q`).join(' '), { play: 'as-written', tempo: 132 }),
        options: choices(rng, name(id), scales.map(name), 4, true),
        answer: name(id),
        explain: `${label(t)} ${SCALES[id].name}${id === 'harmonic-minor' ? ': the raised 7th leaves a wide gap just before the top' : ''}.`,
      };
    });
}

/** Hear a short tune, play it back (it starts on the note named). */
function tunePlayback(count: number, keys: string[]) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, TUNES.slice(0, 5), count).map(degrees => {
      const k = pick(rng, keys);
      const key = parseKey(k);
      const t = pitchText(tonicPitch(key, 4));
      const notes = tune(t, key.mode === 'major' ? 'major' : 'natural-minor', degrees);
      return {
        prompt: `Play back the tune you hear. It starts on ${label(notes[0])}.`,
        figure: fig(notes.map(n => `${n}/q`).join(' '), { play: 'as-written', tempo: 96, key: k }),
        check: C.melody(...notes.map(n => n.replace(/-?\d$/, ''))),
        answer: notes,
        explain: `${notes.map(label).join(' ')}.`,
      };
    });
}

export const earUnit = unit('th-ear', 'Ear Training', 'Listening', 'Hear what you can name: intervals, chord colours, major and minor, and tunes played back.', [
  lesson('th9-1', 'Together or Apart', 'ear', 'Harmonic and melodic intervals, steps and leaps', [
    explain(
      'Two ways to hear an interval',
      `An interval can be heard two ways. Played **one after the other**, it's a **melodic** interval: the way a tune moves. Played **together**, it's a **harmonic** interval: the two notes blend into one sound, the beginning of harmony.

Ear training starts here, because everything else is built from intervals. Close your eyes when you listen: you're training your ears, not your eyes.`,
      fig('C4 G4 [C4 G4]', { play: 'as-written' }),
    ),
    quiz('Together or apart?', 'Listen, then say how the two notes came.', 'Together, or one after the other?', togetherRounds(6), { mode: 'hear' }),
    explain(
      'Steps and leaps',
      `In a tune, most moves are **steps**: to the next note up or down (a 2nd). The rest are **leaps**: skipping over notes (a 3rd or wider). Tunes that mostly step are easy to sing; leaps give a tune its shape and its surprises.

Hum the start of "Frère Jacques": steps. "Twinkle, Twinkle, Little Star": a leap straight away.`,
      fig('C4/q D4 E4 C4 | C4/q G4 r/h |', { time: [4, 4], play: 'as-written' }),
    ),
    quiz('Step or leap?', 'Listen to two notes. Did the tune step to the next note, or leap?', 'A step or a leap?', stepLeapRounds(8), { mode: 'hear' }),
  ]),
  lesson('th9-2', 'Fourths, Fifths and Octaves', 'ear', 'The perfect intervals by ear, each with a tune', [
    explain(
      'Hang each interval on a tune',
      `The quickest way to recognise an interval is to know a tune that starts with it. Sing the tune in your head; if it fits, you've found the interval.

- **Perfect 4th**: "Here Comes the Bride", or the start of "Amazing Grace".
- **Perfect 5th**: "Twinkle, Twinkle, Little Star" (*Twin-kle, twin-kle*: the leap up).
- **Octave**: the same note, higher. "Somewhere over the rainbow" opens with one.

The perfect intervals sound open and hollow: no colour of happy or sad, just strong.`,
      fig('C4 F4 C4 G4 C4 C5', { play: 'as-written', labels: ['', 'P4', '', 'P5', '', 'Octave'] }),
    ),
    explore('Play them', 'Find each one from any note: count the semitones (4th: 5, 5th: 7, octave: 12), then listen.', [
      task('Play a perfect 4th up from any note', C.interval(5, { up: true })),
      task('Play a perfect 5th up from any note', C.interval(7, { up: true })),
      task('Hold a perfect 5th: both notes together', C.interval(7, { together: true })),
    ]),
    quiz('4th, 5th or octave?', 'Listen to the leap up. Sing your tunes in your head.', 'Which interval?', intervalRounds({ intervals: ['P4', 'P5', 'P8'], from: FROM, count: 8 }), { mode: 'hear' }),
    quiz('Together now', 'The same intervals, played together. A 5th sounds open and full; a 4th a little restless; an octave almost like one note.', 'Which interval?', intervalRounds({ intervals: ['P4', 'P5', 'P8'], from: FROM, count: 6, harmonic: true }), { mode: 'hear' }),
    build('Play it back', 'You hear two notes going up. Play them back, starting on the note named.', intervalPlayback(['P4', 'P5', 'P8'], 4), { mode: 'hear' }),
  ]),
  lesson('th9-3', 'Thirds and Sixths', 'ear', 'Major and minor 3rds and 6ths, by ear', [
    explain(
      'Sweet intervals',
      `Thirds and sixths are the sweet intervals, the ones that make harmony warm. Each comes in two sizes, and the size gives it a colour: **major** ones sound bright, **minor** ones darker.

- **Major 3rd**: "Oh When the Saints" (*Oh when*).
- **Minor 3rd**: "Greensleeves" (*A-las*).
- **Major 6th**: "My Bonnie Lies Over the Ocean" (*My Bon-*).
- **Minor 6th**: the leap in the opening of Scott Joplin's "The Entertainer".`,
      fig('C4 E4 A4 C5 C4 A4 E4 C5', { play: 'as-written', labels: ['', 'M3', '', 'm3', '', 'M6', '', 'm6'] }),
    ),
    quiz('Major or minor 3rd?', 'Listen for the colour: bright or dark.', 'Which 3rd?', intervalRounds({ intervals: ['m3', 'M3'], from: FROM, count: 8 }), { mode: 'hear' }),
    quiz('Major or minor 6th?', 'Wider, and the same bright-or-dark question.', 'Which 6th?', intervalRounds({ intervals: ['m6', 'M6'], from: LOW_FROM, count: 6 }), { mode: 'hear' }),
    quiz('Thirds and sixths together', 'Now all four, played together. A 6th has more space between its notes than a 3rd.', 'Which interval?', intervalRounds({ intervals: ['m3', 'M3', 'm6', 'M6'], from: LOW_FROM, count: 8, harmonic: true }), { mode: 'hear' }),
    build('Play it back', 'Two notes going up. Play them back from the note named.', intervalPlayback(['m3', 'M3', 'M6'], 4), { mode: 'hear' }),
  ]),
  lesson('th9-4', 'Seconds, Sevenths and the Tritone', 'ear', 'The tense intervals, by ear', [
    explain(
      'Rubbing notes',
      `Some intervals clash: their notes rub against each other and want to move. That tension is useful, it's what makes music go somewhere.

- **Minor 2nd**: the opening of Beethoven's "Für Elise", rocking back and forth a semitone.
- **Major 2nd**: "Frère Jacques" (*Frè-re*).
- **Minor 7th** and **major 7th**: an octave that falls short, by a tone (minor 7th, bluesy) or by a semitone (major 7th, sharp and bright).
- **The tritone** (augmented 4th): exactly half an octave, six semitones. Restless and strange; it was once called "the devil in music".`,
      fig('E4 D#4 C4 D4 C4 Bb4 C4 B4 C4 F#4', { play: 'as-written', labels: ['', 'm2', '', 'M2', '', 'm7', '', 'M7', '', 'tritone'] }),
    ),
    quiz('Seconds', 'A semitone or a tone?', 'Which 2nd?', intervalRounds({ intervals: ['m2', 'M2'], from: FROM, count: 6 }), { mode: 'hear' }),
    quiz('Sevenths', 'Nearly an octave: is it a tone short (minor 7th) or a semitone short (major 7th)?', 'Which 7th?', intervalRounds({ intervals: ['m7', 'M7', 'P8'], from: LOW_FROM, count: 6 }), { mode: 'hear' }),
    quiz('Every interval', 'Everything from a 2nd to the octave. Take your time, and use your tunes.', 'Which interval?', intervalRounds({ intervals: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'], from: LOW_FROM, count: 10 }), { mode: 'hear' }),
    build('Play it back', 'Two notes going up. Play them back from the note named.', intervalPlayback(['M2', 'm3', 'P4', 'P5', 'm7'], 5), { mode: 'hear' }),
  ]),
  lesson('th9-5', 'Major or Minor?', 'ear', 'Chord colours, scales and tunes by ear', [
    explain(
      'Four chord colours',
      `A triad (three notes, stacked in 3rds) has one of four colours:

- **Major**: bright and settled.
- **Minor**: darker, softer.
- **Diminished**: tight and tense, as if squeezed.
- **Augmented**: wide, floating, unresolved, like a question.

Major and minor are everywhere; diminished and augmented are spices.`,
      fig('[C4 E4 G4] [C4 Eb4 G4] [C4 Eb4 Gb4] [C4 E4 G#4]', { play: 'as-written', labels: ['Major', 'Minor', 'Diminished', 'Augmented'] }),
    ),
    quiz('Major or minor chord?', 'Each chord is played note by note, then together.', 'Major or minor?', chordRounds({ qualities: ['maj', 'min'], roots: ['C4', 'D4', 'F4', 'G4', 'A3'], count: 8 }), { mode: 'hear' }),
    quiz('All four colours', 'Now the spices too.', 'Which chord?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug'], roots: ['C4', 'D4', 'E4', 'F4', 'G4'], count: 8 }), { mode: 'hear' }),
    quiz('Major or minor tune?', 'A short tune: does it sound major or minor? Listen to how it settles at the end.', 'Major or minor?', majorMinorTuneRounds(6), { mode: 'hear' }),
    quiz('Which scale?', 'Major, natural minor or harmonic minor (listen near the top: the harmonic minor has a wide gap there).', 'Which scale?', scaleEarRounds(['major', 'natural-minor', 'harmonic-minor'], 6), { mode: 'hear' }),
    build('Play back the tune', 'Listen, then play the tune back. It moves by steps and by notes of the key chord.', tunePlayback(4, ['C', 'G', 'F']), { mode: 'hear' }),
  ]),
  lesson('th9-c', 'Checkpoint: Ear Training', 'checkpoint', 'Intervals, chords and tunes by ear', [
    quiz('Intervals', '', 'Which interval?', intervalRounds({ intervals: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'], from: LOW_FROM, count: 8 }), { mode: 'hear' }),
    quiz('Chord colours', '', 'Which chord?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug'], roots: ['C4', 'D4', 'F4', 'G4'], count: 6 }), { mode: 'hear' }),
    quiz('Major or minor?', '', 'Major or minor?', rng => [...majorMinorTuneRounds(3)(rng), round('Is this chord major or minor?', 'Minor', ['Major', 'Minor'], { figure: fig('[A3 C4 E4]', { play: 'apart-then-together' }) })], { mode: 'hear' }),
    build('Play it back', '', rng => [...intervalPlayback(['M3', 'P5'], 2)(rng), ...tunePlayback(2, ['C', 'G', 'D'])(rng)], { mode: 'hear' }),
  ]),
]);
