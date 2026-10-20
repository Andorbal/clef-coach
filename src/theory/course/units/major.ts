/**
 * Unit 5: the major scale. The pattern of tones and semitones behind most tunes, built on
 * any note with one of each letter, the names of its degrees, and the leading note's pull
 * towards home. Most rounds are generated, so a replay is a new set of questions.
 */
import type { Rng } from '../../../curriculum/generate';
import { parseKey } from '../../../music/keys';
import { type Pitch, midiOf, parsePitch, spellMidi, stepLabel } from '../../../music/pitch';
import { DEGREE_NAMES, type ScaleId, SCALES, pitchText, scaleNotes, tonicPitch } from '../../theory';
import { C, build, choices, degreeRounds, draw, explain, explore, fig, lesson, pick, quiz, scaleBuildRounds, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const lab = (p: Pitch) => stepLabel(p.step, p.alter);
const pcOf = (p: Pitch) => pitchText(p).replace(/-?\d+$/, '');
const scaleName = (t: Pitch, id: ScaleId) => `${lab(t)} ${SCALES[id].name}`;

/** Other spellings a learner might pick for a note: the same letter raised or lowered, and its enharmonic. */
export function spellingChoices(p: Pitch): string[] {
  const out = new Set<string>([lab(p)]);
  for (const alter of [-1, 0, 1]) if (alter !== p.alter) out.add(stepLabel(p.step, alter));
  const enh = spellMidi(midiOf(p), p.alter > 0 ? -1 : 1);
  if (enh.step !== p.step) out.add(lab(enh));
  return [...out];
}

/** Tone or semitone between neighbouring notes of a scale (a tone and a half in harmonic minor). */
export function scaleStepRounds(scales: [string, ScaleId][], count: number) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const [tonic, id] = pick(rng, scales);
      const notes = scaleNotes(tonic, id);
      const i = Math.floor(rng() * (notes.length - 1));
      const a = notes[i];
      const b = notes[i + 1];
      const s = midiOf(b) - midiOf(a);
      const answer = s === 1 ? 'Semitone' : s === 2 ? 'Tone' : 'Tone and a half';
      const options = id === 'harmonic-minor' ? ['Semitone', 'Tone', 'Tone and a half'] : ['Semitone', 'Tone'];
      return {
        prompt: `In ${scaleName(parsePitch(tonic), id)}, is ${lab(a)} to ${lab(b)} a tone or a semitone?`,
        figure: fig(`${pitchText(a)} ${pitchText(b)}`),
        options,
        answer,
        explain: `${lab(a)} up to ${lab(b)} is ${s} semitone${s === 1 ? '' : 's'}.`,
      };
    });
}

/** Spell a degree of a major scale ("What is the 3rd note of D major?"): the right letter, the right accidental. */
function degreeSpellRounds(tonics: string[], count: number, showTonic = true) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const t = parsePitch(pick(rng, tonics));
      const notes = scaleNotes(t, 'major');
      const d = 2 + Math.floor(rng() * 6);
      const note = notes[d - 1];
      const answer = lab(note);
      return {
        prompt: `What is note ${d} of ${lab(t)} major?`,
        figure: showTonic ? fig(pitchText(t)) : undefined,
        options: choices(rng, answer, spellingChoices(note), 3),
        answer,
        explain: `${lab(t)} major: ${notes.map(lab).join(' ')}. One of each letter, so note ${d} is ${answer}.`,
      };
    });
}

/** The leading note of a major key. */
function leadingNoteRounds(keys: string[], count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, keys, count).map(k => {
      const t = tonicPitch(parseKey(k), 4);
      const lead = scaleNotes(t, 'major')[6];
      const answer = lab(lead);
      return {
        prompt: `What is the leading note of ${lab(t)} major?`,
        figure: fig(pitchText(t)),
        options: choices(rng, answer, spellingChoices(lead), 3),
        answer,
        explain: `The leading note is a semitone below the tonic: ${answer}, leaning up to ${lab(t)}.`,
      };
    });
}

/** Play a degree of a key: "Play the dominant of G major". */
function degreeBuildRounds(keys: string[], degrees: number[], count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, degrees, count).map(d => {
      const k = pick(rng, keys);
      const t = tonicPitch(parseKey(k), 4);
      const note = scaleNotes(t, 'major')[d - 1];
      return {
        prompt: `Play the ${DEGREE_NAMES[d - 1]} of ${lab(t)} major`,
        figure: fig(pitchText(t), { key: k }),
        check: C.note(pcOf(note)),
        answer: [pitchText(note)],
        explain: `The ${DEGREE_NAMES[d - 1]} is degree ${d}: ${lab(note)}.`,
      };
    });
}

/** Ends at home, or not? Short phrases in a major key, by ear. */
function finishedRounds(count: number) {
  const finished = [
    [4, 3, 2, 1, 0],
    [2, 1, 0],
    [0, 1, 2, 3, 4, 5, 6, 7],
    [4, 2, 1, 0],
  ];
  const unfinished = [
    [0, 1, 2, 3, 4, 5, 6],
    [2, 1],
    [4, 5, 6],
    [7, 6],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Finished', 'Unfinished'], count).map(kind => {
      const k = pick(rng, ['C', 'G', 'F', 'D']);
      const notes = scaleNotes(tonicPitch(parseKey(k), k === 'G' || k === 'F' ? 3 : 4), 'major');
      const shape = pick(rng, kind === 'Finished' ? finished : unfinished);
      const text = shape.map((d, i) => `${pitchText(notes[d])}/${i === shape.length - 1 ? 'h' : 'q'}`).join(' ');
      return {
        figure: fig(text, { key: k }),
        options: ['Finished', 'Unfinished'],
        answer: kind,
        explain: kind === 'Finished' ? 'It comes to rest on the tonic, home.' : 'It stops away from the tonic, so it wants to go on.',
      };
    });
}

/** A major scale, or a major scale with one note wrong? By ear. */
function wrongNoteRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['right', 'wrong'], count).map(kind => {
      const t = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G3', 'Bb3']));
      const notes = scaleNotes(t, 'major');
      let explainText = `${lab(t)} major, every step in place.`;
      if (kind === 'wrong') {
        const [d, shift] = pick(rng, [
          [2, -1],
          [3, 1],
          [5, -1],
          [6, -1],
          [1, -1],
        ] as const);
        const was = notes[d];
        notes[d] = { ...was, alter: was.alter + shift };
        explainText = `Note ${d + 1} was ${lab(notes[d])} instead of ${lab(was)}.`;
      }
      return {
        figure: fig(notes.map(n => `${pitchText(n)}/q`).join(' '), { tempo: 120 }),
        options: ['A major scale', 'One note is wrong'],
        answer: kind === 'right' ? 'A major scale' : 'One note is wrong',
        explain: explainText,
      };
    });
}

/** Play back three notes of a major scale, heard but not seen. */
function playBackRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    Array.from({ length: count }, () => {
      const k = pick(rng, ['C', 'G', 'F']);
      const scale = scaleNotes(tonicPitch(parseKey(k), 4), 'major');
      const up = rng() < 0.5;
      const start = up ? Math.floor(rng() * 5) : 2 + Math.floor(rng() * 5);
      const notes = [0, 1, 2].map(i => scale[up ? start + i : start - i]);
      return {
        prompt: `Play back what you hear: three notes of ${lab(scale[0])} major, starting on ${lab(notes[0])}`,
        figure: fig(notes.map(n => `${pitchText(n)}/q`).join(' '), { key: k }),
        check: C.melody(...notes.map(pcOf)),
        answer: notes.map(pitchText),
        explain: `${notes.map(lab).join(', ')}: ${up ? 'up' : 'down'} the scale, step by step.`,
      };
    });
}

export const majorUnit = unit('th-major', 'The Major Scale', 'Scales and keys', 'The pattern of tones and semitones behind most tunes, built from any note.', [
  lesson(
    'th5-1',
    'Steps and Scales',
    'learn',
    'The major scale’s pattern of tones and semitones',
    [
      explain(
        'A ladder of notes',
        `A **scale** is a set of notes in order, from a home note (the **tonic**) up to the same note an octave higher. Play the white keys from C to C and you have the most famous one: **C major**.

Most of the tunes you know are built from a major scale. Hear it, then play it yourself.`,
        fig('C4 D4 E4 F4 G4 A4 B4 C5', { labels: 'names' }),
      ),
      explain(
        'Not all steps are equal',
        `Look at the keyboard between the notes. Most neighbours have a black key between them: they're a **tone** apart (W, a whole step). Two pairs don't: **E–F** and **B–C** are a **semitone** apart (H, a half step).

So the major scale climbs in this pattern: **W W H W W W H**. That pattern, not the white keys, is what makes a scale major.`,
        fig('C4 D4 E4 F4 G4 A4 B4 C5', { labels: 'steps' }),
      ),
      explore('Climb it', 'Play the scale and listen for the two small steps.', [
        task('Play C D E F G A B C, going up', C.scale('C', 'major')),
        task('Play the first semitone: E then F', C.melody('E', 'F')),
        task('Play the second: B then C', C.melody('B', 'C')),
      ]),
      quiz('Tone or semitone?', 'Two neighbouring notes of the C major scale. A tone has a key between them; a semitone doesn’t.', 'Tone or semitone?', scaleStepRounds([['C4', 'major']], 6)),
    ],
    { key: 'C', topics: ['scale:major'] },
  ),
  lesson(
    'th5-2',
    'Building Major Scales',
    'learn',
    'A major scale on any note, one of each letter',
    [
      explain(
        'Start anywhere',
        `The W W H W W W H pattern works from any note. Start on **G**: G–A is a tone, A–B a tone, B–C a semitone, C–D and D–E tones… but E–F is only a semitone, and the pattern needs a tone there. So F has to be raised: **F♯**. Then F♯–G is the final semitone.

**G major: G A B C D E F♯ G.** One sharp, and it sounds exactly as major as C major, just higher.`,
        fig('G4 A4 B4 C5 D5 E5 F#5 G5', { labels: 'steps' }),
      ),
      explain(
        'One of each letter',
        `Every major scale uses each letter once. From **F**, the pattern needs a note a semitone above A. That key could be called A♯ or B♭, and since A is already used, it must be **B♭**.

**F major: F G A B♭ C D E F.** Spelling matters: it's how a musician reads the scale at a glance.`,
        fig('F4 G4 A4 Bb4 C5 D5 E5 F5', { labels: 'steps' }),
      ),
      quiz('Spell it', 'Count the steps from the tonic, and use each letter once.', 'Which note is it?', degreeSpellRounds(['G4', 'D4', 'F4', 'A3', 'Bb3', 'E4'], 6)),
      build('Play major scales', 'Start on the tonic, and let the pattern tell you which black keys you need. Play up to the tonic an octave higher.', scaleBuildRounds({ tonics: ['G4', 'D4', 'F4', 'A3', 'E4'], scale: 'major', count: 3 })),
    ],
  ),
  lesson(
    'th5-3',
    'Scale Degrees',
    'learn',
    'Numbers and names for the notes of a scale',
    [
      explain(
        'Numbers for the notes',
        `The notes of a scale are its **degrees**, numbered from the tonic: 1, 2, 3… up to 7, and 8 is the tonic again. Numbers work in every key: degree 5 of C major is G, degree 5 of D major is A.

Each degree also has a name: **tonic** (1), **supertonic** (2), **mediant** (3), **subdominant** (4), **dominant** (5), **submediant** (6) and **leading note** (7).`,
        fig('C4 D4 E4 F4 G4 A4 B4 C5', { labels: 'degrees' }),
      ),
      explain(
        'The pillars',
        `Three degrees hold up a key. The **tonic** is home. The **dominant**, five notes up, is the strongest pull away and back. The **subdominant**, four up, sits just below the dominant and leads gently away from home. Melodies and chords lean on these three over and over.`,
        fig('C4 G4 F4 C4', { labels: ['tonic', 'dominant', 'subdominant', 'tonic'] }),
      ),
      quiz('Which note?', 'The degrees are labelled under the scale. Find the one asked for.', 'Which note is it?', degreeRounds({ keys: ['C', 'G', 'F', 'D'], degrees: [1, 2, 3, 4, 5, 6, 7], count: 6, ask: 'note' })),
      build('Play the degree', 'Count up from the tonic: the tonic is 1.', degreeBuildRounds(['C', 'G', 'F', 'D'], [1, 4, 5, 7], 5)),
      quiz('Name the degree', 'Count from the tonic, starting at 1.', 'Which degree is it?', degreeRounds({ keys: ['C', 'G', 'F'], degrees: [2, 3, 4, 5, 6, 7], count: 5, ask: 'name' })),
    ],
    { key: 'C' },
  ),
  lesson(
    'th5-4',
    'The Leading Note',
    'learn',
    'Why the seventh leans towards home',
    [
      explain(
        'Leaning home',
        `The seventh degree sits just a **semitone** below the tonic. Stop a scale on it and it hangs in the air: your ear wants that last small step home. That pull is why degree 7 is called the **leading note**: it leads to the tonic.

Hear the scale stop one note short.`,
        fig('C4/q D4/q E4/q F4/q G4/q A4/q B4/h', { play: 'as-written' }),
      ),
      explore('Feel the pull', 'Play the leading note, then let it step home.', [
        task('Play C major up to B, and stop', C.melody('C', 'D', 'E', 'F', 'G', 'A', 'B')),
        task('Now finish it: B then C', C.melody('B', 'C')),
        task('In G major the leading note is F♯: play F♯ then G', C.melody('F#', 'G')),
      ]),
      quiz('Finished or unfinished?', 'Does the phrase come to rest on the tonic, or stop somewhere that wants to go on?', 'Finished or unfinished?', finishedRounds(6), { mode: 'hear' }),
      quiz('Find the leading note', 'It’s always a semitone below the tonic, whatever the key.', 'Which note?', leadingNoteRounds(['G', 'D', 'A', 'F', 'Bb', 'E'], 5)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th5-5',
    'Major Scales by Ear',
    'ear',
    'Hear the major scale, and play back what you hear',
    [
      explain(
        'The sound of major',
        `A major scale sounds bright and settled, the sound of "do re mi". Your ear already knows it: you'll notice at once when a note of it is out of place. These questions are by ear only. Listen as often as you like.`,
        fig('D4/q E4/q F#4/q G4/q A4/q B4/q C#5/q D5/h', { key: 'D' }),
      ),
      quiz('Spot the wrong note', 'A major scale, or a major scale with one note out of place?', 'Is this a major scale?', wrongNoteRounds(6), { mode: 'hear' }),
      build('Play it back', 'Three notes, one step apart. Listen, find the first note, then follow the steps.', playBackRounds(4), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th5-c',
    'Checkpoint: The Major Scale',
    'checkpoint',
    'Steps, spellings, degrees and the leading note',
    [
      quiz('Tone or semitone?', '', 'Tone or semitone?', scaleStepRounds([['C4', 'major'], ['G4', 'major'], ['F4', 'major'], ['D4', 'major']], 4)),
      quiz('Spell it', '', 'Which note is it?', degreeSpellRounds(['G4', 'D4', 'F4', 'A3', 'Bb3', 'Eb4'], 4, false)),
      build('Play the scale', '', scaleBuildRounds({ tonics: ['C4', 'G4', 'F4', 'D4'], scale: 'major', count: 2 })),
      quiz('Find the leading note', '', 'Which note?', leadingNoteRounds(['G', 'D', 'F', 'Bb', 'A'], 3)),
      quiz('Spot the wrong note', '', 'Is this a major scale?', wrongNoteRounds(4), { mode: 'hear' }),
    ],
  ),
]);
