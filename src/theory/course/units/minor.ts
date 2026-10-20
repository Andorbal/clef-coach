/**
 * Unit 7: minor keys. The natural minor scale and its relative major, the harmonic minor's
 * raised seventh (and why), the melodic minor, parallel keys, and telling major from minor
 * by ear.
 */
import type { Rng } from '../../../curriculum/generate';
import { parseKey } from '../../../music/keys';
import { type Pitch, parsePitch, stepLabel } from '../../../music/pitch';
import { pitchText, scaleNotes, tonicPitch, transpose } from '../../theory';
import { C, build, choices, draw, explain, explore, fig, keySignatureRounds, lesson, pick, quiz, scaleBuildRounds, scaleRounds, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';
import { scaleStepRounds } from './major';

const lab = (p: Pitch) => stepLabel(p.step, p.alter);
const pcOf = (p: Pitch) => pitchText(p).replace(/-?\d+$/, '');

const MAJORS = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'];

/** Relative keys: the minor a minor 3rd below a major tonic, the major a minor 3rd above a minor one. */
function relativeRounds(count: number, toMinor?: boolean) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const minor = toMinor ?? rng() < 0.6;
      const major = pick(rng, MAJORS);
      const t = tonicPitch(parseKey(major), 4);
      const rel = transpose(t, 'm3', true);
      const labelOf = (p: Pitch, mode: string) => `${lab(p)} ${mode}`;
      const majors = MAJORS.map(k => tonicPitch(parseKey(k), 4));
      if (minor) {
        const answer = labelOf(rel, 'minor');
        return {
          prompt: `What is the relative minor of ${labelOf(t, 'major')}?`,
          figure: fig(pitchText(t), { key: major }),
          options: choices(rng, answer, majors.map(p => labelOf(transpose(p, 'm3', true), 'minor')), 4),
          answer,
          explain: `Three semitones (a minor 3rd) below ${lab(t)} is ${lab(rel)}. ${labelOf(t, 'major')} and ${answer} share a key signature.`,
        };
      }
      const answer = labelOf(t, 'major');
      return {
        prompt: `What is the relative major of ${labelOf(rel, 'minor')}?`,
        figure: fig(pitchText(rel), { key: major }),
        options: choices(rng, answer, majors.map(p => labelOf(p, 'major')), 4),
        answer,
        explain: `Three semitones (a minor 3rd) above ${lab(rel)} is ${lab(t)}.`,
      };
    });
}

/** Play the tonic of a relative key. */
function relativeBuildRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, MAJORS, count).map(major => {
      const t = tonicPitch(parseKey(major), 4);
      const rel = transpose(t, 'm3', true);
      return {
        prompt: `Play the tonic of ${lab(t)} major’s relative minor`,
        figure: fig(pitchText(t), { key: major }),
        check: C.note(pcOf(rel)),
        answer: [pitchText(rel)],
        explain: `Down three semitones from ${lab(t)}: ${lab(rel)} minor.`,
      };
    });
}

/** Up five notes of the scale and back: major or minor? */
function pentachordRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Major', 'Minor'], count).map(kind => {
      const t = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G3', 'A3']));
      const s = scaleNotes(t, kind === 'Major' ? 'major' : 'natural-minor');
      const shape = [0, 1, 2, 3, 4, 3, 2, 1, 0];
      return {
        figure: fig(shape.map((d, i) => `${pitchText(s[d])}/${i === shape.length - 1 ? 'h' : 'q'}`).join(' '), { tempo: 112 }),
        options: ['Major', 'Minor'],
        answer: kind,
        explain: `The third note gives it away: ${lab(s[2])}, a ${kind === 'Major' ? 'major' : 'minor'} 3rd above ${lab(t)}.`,
      };
    });
}

/** The tonic and its third, broken: major or minor? */
function arpeggioRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Major', 'Minor'], count).map(kind => {
      const t = parsePitch(pick(rng, ['C4', 'D4', 'E4', 'F4', 'G3', 'A3']));
      const notes = [t, transpose(t, kind === 'Major' ? 'M3' : 'm3'), transpose(t, 'P5'), transpose(t, 'P8')];
      return {
        figure: fig(`${notes.map(n => `${pitchText(n)}/q`).join(' ')} [${notes.slice(0, 3).map(pitchText).join(' ')}]/h`, { tempo: 100 }),
        options: ['Major', 'Minor'],
        answer: kind,
        explain: `${notes.map(lab).join(' ')}: the ${kind === 'Major' ? 'major' : 'minor'} 3rd makes it ${kind.toLowerCase()}.`,
      };
    });
}

/** Play back a tonic and its third (major or minor), heard but not seen. */
function thirdPlayBackRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, ['M3', 'm3'], count).map(iv => {
      const t = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G4', 'A3']));
      const third = transpose(t, iv);
      return {
        prompt: `Play back what you hear. It starts on ${lab(t)}.`,
        figure: fig(`${pitchText(t)}/q ${pitchText(third)}/h`),
        check: C.melody(pcOf(t), pcOf(third)),
        answer: [pitchText(t), pitchText(third)],
        explain: `${lab(t)} up to ${lab(third)}: a ${iv === 'M3' ? 'major' : 'minor'} 3rd.`,
      };
    });
}

export const minorUnit = unit('th-minor', 'Minor Keys', 'Scales and keys', 'The darker family: natural, harmonic and melodic minor, and how they relate to the major keys.', [
  lesson(
    'th7-1',
    'The Natural Minor Scale',
    'learn',
    'A scale with a darker colour',
    [
      explain(
        'Another home',
        `Play the white keys from **A** up to A: A B C D E F G A. They're the same notes as C major, but with A as home they sound darker, sadder, more serious. This is the **natural minor** scale.

The steps fall in a different order: **W H W W H W W**.`,
        fig('A3 B3 C4 D4 E4 F4 G4 A4', { labels: 'steps' }),
      ),
      explain(
        'The minor 3rd',
        `What makes the difference most is the third note. In A minor it's C, **three** semitones above the tonic (a **minor 3rd**). In a major key the third note is four semitones up (a major 3rd). Hear them side by side: A to C♯, then A to C.`,
        fig('A3 C#4 A3 C4', { labels: ['', 'major 3rd', '', 'minor 3rd'] }),
      ),
      explore('Play natural minor', 'From A it’s all white keys. From D you’ll need one black key, to keep the pattern.', [
        task('Play A natural minor, going up', C.scale('A', 'natural-minor')),
        task('Play D natural minor (it needs B♭)', C.scale('D', 'natural-minor')),
      ]),
      quiz('Tone or semitone?', 'Natural minor climbs W H W W H W W.', 'Tone or semitone?', scaleStepRounds([['A3', 'natural-minor'], ['D4', 'natural-minor'], ['E4', 'natural-minor']], 6)),
      build('Play natural minor scales', 'Follow W H W W H W W from the tonic, up to the tonic an octave higher.', scaleBuildRounds({ tonics: ['A3', 'D4', 'E4', 'G3'], scale: 'natural-minor', count: 2 })),
    ],
    { key: 'Am', topics: ['key:minor', 'scale:minor'] },
  ),
  lesson(
    'th7-2',
    'Relative Major and Minor',
    'learn',
    'Two keys, one key signature',
    [
      explain(
        'Same signature, different home',
        `Every major key has a **relative minor** that uses exactly the same notes and the same key signature. Its tonic is three semitones (a minor 3rd) **below** the major tonic: C major and **A minor**, G major and **E minor**, F major and **D minor**.

Here's E minor with its key signature: one sharp, just like G major.`,
        fig('E4 F#4 G4 A4 B4 C5 D5 E5', { key: 'Em', labels: 'names' }),
      ),
      explain(
        'Which is it?',
        `So one sharp could mean G major or E minor. The music tells you: where melodies come to rest, and the bass note at the end. In minor there's often a giveaway too: an accidental raising the seventh (D♯ in E minor). You'll see why in the next lesson.`,
        fig('B4/q A4/q G4/q F#4/q | E4/w', { key: 'Em', time: [4, 4] }),
      ),
      quiz('Find the relative', 'A minor 3rd is three semitones: down for the relative minor, up for the relative major.', 'Which key?', relativeRounds(6)),
      quiz('Minor key signatures', 'A minor key has its relative major’s signature.', 'Which key is it?', keySignatureRounds({ keys: ['Am', 'Em', 'Dm', 'Bm', 'Gm', 'F#m', 'Cm'], count: 5, ask: 'key' })),
      build('Play the relative minor', 'Count three semitones down from the major key’s tonic.', relativeBuildRounds(4)),
    ],
  ),
  lesson(
    'th7-3',
    'The Harmonic Minor',
    'learn',
    'Raise the seventh, and minor gets its pull home',
    [
      explain(
        'No leading note',
        `In natural minor the seventh note is a **tone** below the tonic (G to A in A minor). It doesn't lean home the way a major key's leading note does.

So composers raise it by a semitone: **G♯** in A minor. This is the **harmonic minor** scale. The raised 7th is written as an accidental each time; it never goes in the key signature.`,
        fig('A3 B3 C4 D4 E4 F4 G#4 A4', { key: 'Am', labels: 'steps' }),
      ),
      explain(
        'A step and a half',
        `Raising the 7th leaves a wide gap between the 6th and 7th notes: F to G♯ is **three** semitones, a tone and a half. It gives harmonic minor its exotic flavour. And it gives minor keys a leading note, and later a strong major chord on the 5th degree.`,
        fig('E4 F4 G#4 A4', { key: 'Am', labels: 'steps' }),
      ),
      explore('Play harmonic minor', 'Listen for the wide step near the top.', [
        task('Play A harmonic minor, going up', C.scale('A', 'harmonic-minor')),
        task('Play the step and a half: F then G♯', C.melody('F', 'G#')),
        task('Play the leading note home: G♯ then A', C.melody('G#', 'A')),
      ]),
      quiz('Natural or harmonic?', 'Listen to the top of the scale: a tone below the tonic, or a semitone?', 'Which minor scale?', scaleRounds({ scales: ['natural-minor', 'harmonic-minor'], tonics: ['A3', 'D4', 'E4', 'G3'], count: 5 }), { mode: 'hear' }),
      build('Play harmonic minor scales', 'Natural minor with the 7th raised by a semitone.', scaleBuildRounds({ tonics: ['A3', 'E4', 'D4'], scale: 'harmonic-minor', count: 2 })),
    ],
    { key: 'Am', topics: ['scale:harmonic-minor'] },
  ),
  lesson(
    'th7-4',
    'The Melodic Minor',
    'learn',
    'Smooth on the way up, natural on the way down',
    [
      explain(
        'Smoothing the gap',
        `Singers found harmonic minor's step and a half awkward. The **melodic minor** fixes it: on the way **up** it raises both the 6th and the 7th (F♯ and G♯ in A minor), so the top climbs in smooth tones. On the way **down** it lowers them again and falls as natural minor.

Classical teaching uses this up-and-down version; in jazz the melodic minor stays raised both ways.`,
        fig('A3 B3 C4 D4 E4 F#4 G#4 A4 G4 F4 E4 D4 C4 B3 A3', { key: 'Am' }),
      ),
      explore('Up and down', 'Climb with F♯ and G♯, come down with F and G.', [
        task('Play A melodic minor, going up', C.scale('A', 'melodic-minor')),
        task('Now come down: A natural minor, from the top', C.scale('A', 'natural-minor', true)),
      ]),
      quiz('Which minor?', 'Look at the 6th and 7th notes.', 'Which scale is it?', scaleRounds({ scales: ['natural-minor', 'harmonic-minor', 'melodic-minor'], tonics: ['A3', 'D4', 'E4', 'G3'], count: 6 })),
      quiz('Which minor, by ear?', 'Listen to the top of the scale: from the 5th note to the tonic, how do the steps go?', 'Which scale is it?', scaleRounds({ scales: ['natural-minor', 'harmonic-minor', 'melodic-minor'], tonics: ['A3', 'D4', 'E4'], count: 5 }), { mode: 'hear' }),
    ],
    { key: 'Am' },
  ),
  lesson(
    'th7-5',
    'Major or Minor?',
    'ear',
    'Parallel keys, and hearing the difference',
    [
      explain(
        'Parallel keys',
        `C major and C minor share a tonic but not a key signature (C minor has three flats). They're **parallel** keys. Switching from one to the other is like changing the light on the same room, and songwriters do it all the time.

Hear five notes of C major, then of C minor.`,
        fig('C4/q D4/q E4/q F4/q G4/h G4/q F4/q Eb4/q D4/q C4/h', { tempo: 108 }),
      ),
      quiz('Major or minor?', 'Up five notes and back down.', 'Major or minor?', pentachordRounds(6), { mode: 'hear' }),
      quiz('The third decides', 'The tonic, its third, its fifth, then all together.', 'Major or minor?', arpeggioRounds(6), { mode: 'hear' }),
      build('Play it back', 'Two notes: the tonic, then its third. Major (four semitones) or minor (three)?', thirdPlayBackRounds(4), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th7-c',
    'Checkpoint: Minor Keys',
    'checkpoint',
    'Relative keys, the three minor scales, major or minor by ear',
    [
      quiz('Find the relative', '', 'Which key?', relativeRounds(4)),
      quiz('Minor key signatures', '', 'Which key is it?', keySignatureRounds({ keys: ['Am', 'Em', 'Dm', 'Bm', 'Gm', 'Cm'], count: 3, ask: 'key' })),
      quiz('Which scale?', '', 'Which scale is it?', scaleRounds({ scales: ['major', 'natural-minor', 'harmonic-minor', 'melodic-minor'], tonics: ['A3', 'D4', 'E4', 'G3'], count: 4 })),
      quiz('Major or minor?', '', 'Major or minor?', pentachordRounds(4), { mode: 'hear' }),
      build('Play the scale', '', rng => [...scaleBuildRounds({ tonics: ['A3', 'D4', 'E4'], scale: 'natural-minor', count: 1 })(rng), ...scaleBuildRounds({ tonics: ['A3', 'D4', 'E4'], scale: 'harmonic-minor', count: 1 })(rng)]),
    ],
  ),
]);
