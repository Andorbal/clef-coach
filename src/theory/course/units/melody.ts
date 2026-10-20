/**
 * Unit 14: melody. How tunes move (steps and leaps), how their notes relate to the chords
 * beneath them (chord tones, passing and neighbour notes, suspensions, appoggiaturas), and
 * how they're built and shaped: motifs, repetition and sequence, phrases that ask and
 * answer, and periods.
 *
 * Non-chord tones are shown over a chord struck with every melody note, so the clash of a
 * passing note is there to see and to hear.
 */
import { interval as intervalDrill } from '../../../curriculum/builders';
import type { Rng } from '../../../curriculum/generate';
import { type KeySig, parseKey } from '../../../music/keys';
import { type Pitch, stepLabel } from '../../../music/pitch';
import { diatonicChord, pitchText, scaleNotes, tonicPitch, withArticle } from '../../theory';
import { C, build, choices, draw, drill, explain, explore, fig, lesson, numberLabel, pick, quiz, round, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const name = (p: Pitch) => stepLabel(p.step, p.alter);
const spec = (p: Pitch) => pitchText(p).replace(/-?\d$/, '');
const atOctave = (p: Pitch, octave: number): Pitch => ({ ...p, octave });

/** Two octaves of a major key's scale from its tonic in octave 4 (index 0 = tonic). */
function scaleOf(key: KeySig): Pitch[] {
  return scaleNotes(atOctave(tonicPitch(key), 4), 'major', 2);
}

const C_SCALE = scaleOf(parseKey('C'));

/** Step or leap? Two notes of the C major scale. */
function stepLeapRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['step', 'leap'], count).map(kind => {
      const size = kind === 'step' ? 1 : pick(rng, [2, 3, 4, 5]);
      const up = rng() < 0.5;
      const i = up ? Math.floor(rng() * (14 - size)) : size + Math.floor(rng() * (14 - size));
      const j = up ? i + size : i - size;
      const [a, b] = [C_SCALE[i], C_SCALE[j]];
      return {
        figure: fig(`${pitchText(a)} ${pitchText(b)}`, { play: 'as-written' }),
        options: ['Step', 'Leap'],
        answer: kind === 'step' ? 'Step' : 'Leap',
        explain: `${name(a)} to ${name(b)}: ${withArticle(numberLabel(size + 1).toLowerCase())}, ${kind === 'step' ? 'the next note of the scale' : 'skipping over notes'}.`,
      };
    });
}

type Nct = 'passing' | 'neighbour' | 'appoggiatura';
const NCT_LABEL: Record<Nct, string> = { passing: 'Passing note', neighbour: 'Neighbour note', appoggiatura: 'Appoggiatura' };

/**
 * Three melody notes over the tonic chord, the middle one not in the chord: a passing
 * note (steps between two chord tones), a neighbour (steps away and back) or an
 * appoggiatura (leapt to, then resolved by step).
 */
function nctMelody(rng: Rng, key: KeySig, kind: Nct): Pitch[] {
  const sc = scaleOf(key);
  // chord tones of I in the scale: degrees 1, 3, 5, 8, 10, 12 (indexes 0, 2, 4, 7, 9, 11)
  const cts = [0, 2, 4, 7, 9, 11];
  if (kind === 'passing') {
    const pairs: [number, number][] = [
      [0, 2],
      [2, 4],
      [7, 9],
      [9, 11],
    ];
    const [a, b] = pick(rng, pairs);
    return rng() < 0.5 ? [sc[a], sc[a + 1], sc[b]] : [sc[b], sc[a + 1], sc[a]];
  }
  if (kind === 'neighbour') {
    const ct = pick(rng, [2, 4, 7, 9]);
    const n = pick(rng, cts.includes(ct + 1) ? [ct - 1] : cts.includes(ct - 1) ? [ct + 1] : [ct - 1, ct + 1]);
    return [sc[ct], sc[n], sc[ct]];
  }
  // appoggiatura: the non-chord tone a step above or below the target, leapt to from a chord tone
  const target = pick(rng, [2, 4, 7, 9]);
  const nct = cts.includes(target + 1) ? target - 1 : target + 1;
  const from = pick(rng, cts.filter(c => Math.abs(c - nct) >= 2 && c !== target));
  return [sc[from], sc[nct], sc[target]];
}

function overChord(key: KeySig, melody: Pitch[]): string {
  const chord = diatonicChord(key, 1).notes.map(p => atOctave(p, 3));
  const bass = chord.map(pitchText).join(' ');
  const durs = ['q', 'q', 'h'];
  return melody.map((m, i) => `[${bass} ${pitchText(m)}]/${durs[i]}`).join(' ');
}

function nctRounds(o: { kinds: Nct[]; count: number }) {
  const keys = ['C', 'G', 'F'];
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.kinds, o.count).map(kind => {
      const k = pick(rng, keys);
      const key = parseKey(k);
      const mel = nctMelody(rng, key, kind);
      const chord = diatonicChord(key, 1);
      const why = {
        passing: `${name(mel[1])} fills the gap between ${name(mel[0])} and ${name(mel[2])}, by step.`,
        neighbour: `${name(mel[1])} steps away from ${name(mel[0])} and straight back.`,
        appoggiatura: `${name(mel[1])} is leapt to, clashes, then steps to ${name(mel[2])}.`,
      }[kind];
      return {
        figure: fig(overChord(key, mel), { key: k, play: 'as-written' }),
        options: choices(rng, NCT_LABEL[kind], o.kinds.map(x => NCT_LABEL[x]), 3, true),
        answer: NCT_LABEL[kind],
        explain: `The chord is ${name(chord.root)} major (${chord.notes.map(name).join(' ')}). ${why}`,
      };
    });
}

/** Play a passing or neighbour note in C major. */
function nctBuildRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, ['passing', 'neighbour'] as const, count).map(kind => {
      const mel = nctMelody(rng, parseKey('C'), kind);
      const names = mel.map(spec);
      return {
        prompt:
          kind === 'passing'
            ? `Join ${name(mel[0])} and ${name(mel[2])} with a passing note: play ${name(mel[0])}, the note between, then ${name(mel[2])}`
            : `Decorate ${name(mel[0])} with a neighbour note: play ${name(mel[0])}, the note just ${scaleIndex(mel[1]) > scaleIndex(mel[0]) ? 'above' : 'below'} it in C major, then ${name(mel[0])} again`,
        figure: fig(`${pitchText(mel[0])}/h ${pitchText(mel[2])}/h`, { key: 'C', play: 'as-written' }),
        check: C.melody(...names),
        answer: mel.map(pitchText),
        explain: `${mel.map(name).join(', ')}: ${name(mel[1])} is the ${kind === 'passing' ? 'passing' : 'neighbour'} note.`,
      };
    });
}

const scaleIndex = (p: Pitch) => C_SCALE.findIndex(s => s.step === p.step && s.octave === p.octave);

type Relation = 'repetition' | 'sequence' | 'contrast';
const RELATION_LABEL: Record<Relation, string> = { repetition: 'Repetition', sequence: 'Sequence', contrast: 'Contrast' };

/** A three-note motif (scale indexes in C major), and a second phrase that repeats it, moves it, or does something else. */
function motifPair(rng: Rng, kind: Relation): [number[], number[]] {
  const shapes = [
    [0, 1, 2],
    [2, 1, 0],
    [0, 2, 1],
    [0, 0, 1],
    [2, 0, 1],
    [0, 2, 4],
    [4, 2, 0],
    [1, 0, 2],
  ];
  const shape = pick(rng, shapes);
  const start = 2 + Math.floor(rng() * 4);
  const a = shape.map(x => x + start);
  if (kind === 'repetition') return [a, a];
  if (kind === 'sequence') {
    const shift = pick(rng, [-2, -1, 1, 2]);
    return [a, a.map(x => x + shift)];
  }
  // contrast: another shape, not a copy or a move of the first
  const diffs = (s: number[]) => s.slice(1).map((x, i) => x - s[i]).join(',');
  const other = pick(rng, shapes.filter(s => diffs(s) !== diffs(shape)));
  const st = 2 + Math.floor(rng() * 4);
  return [a, other.map(x => x + st)];
}

function motifText(a: number[], b: number[]): string {
  const n = (i: number) => pitchText(C_SCALE[i]);
  return `${n(a[0])}/q ${n(a[1])} ${n(a[2])} r | ${n(b[0])}/q ${n(b[1])} ${n(b[2])} r |`;
}

function motifRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['repetition', 'sequence', 'contrast'] as Relation[], count).map(kind => {
      const [a, b] = motifPair(rng, kind);
      const shift = b[0] - a[0];
      return {
        figure: fig(motifText(a, b), { key: 'C', time: [4, 4], play: 'as-written', tempo: 100 }),
        options: ['Repetition', 'Sequence', 'Contrast'],
        answer: RELATION_LABEL[kind],
        explain:
          kind === 'repetition'
            ? 'The second bar is the same three notes again.'
            : kind === 'sequence'
              ? `The same shape, moved ${Math.abs(shift) === 1 ? 'one step' : 'two steps'} ${shift > 0 ? 'higher' : 'lower'}.`
              : 'The second bar has a shape of its own.',
      };
    });
}

/** Play a motif again, one step higher or lower (a sequence). */
function sequenceBuildRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    Array.from({ length: count }, () => {
      const [a] = motifPair(rng, 'repetition');
      const shift = pick(rng, [-1, 1]);
      const b = a.map(x => x + shift);
      return {
        prompt: `Play this motif as a sequence: the same shape, one step ${shift > 0 ? 'higher' : 'lower'} (white keys only)`,
        figure: fig(`${a.map(i => `${pitchText(C_SCALE[i])}/q`).join(' ')} r`, { key: 'C', time: [4, 4], play: 'as-written', tempo: 100 }),
        check: C.melody(...b.map(i => spec(C_SCALE[i]))),
        answer: b.map(i => pitchText(C_SCALE[i])),
        explain: `${a.map(i => name(C_SCALE[i])).join(' ')} becomes ${b.map(i => name(C_SCALE[i])).join(' ')}.`,
      };
    });
}

/**
 * A two-bar phrase in C: four quarter notes walking by step to a last note held over its
 * chord. Ending on the tonic over I sounds finished (an answer); on 2 or 7 over V, open (a question).
 */
function phraseRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['question', 'answer'], count).map(kind => {
      const end = kind === 'answer' ? pick(rng, [0, 7]) : pick(rng, [1, 6, 8]);
      // four notes stepping towards the last one, from above or (when there's room) below
      const dir = end < 4 ? -1 : pick(rng, [-1, 1]);
      const walk = [4, 3, 2, 1].map(d => end - dir * d);
      const n = (i: number) => pitchText(C_SCALE[i]);
      const chord = kind === 'answer' ? 'C3 E3 G3' : 'G2 B2 D3';
      const text = `${walk.map(i => `${n(i)}/q`).join(' ')} | [${chord} ${n(end)}]/w`;
      return {
        figure: fig(text, { key: 'C', time: [4, 4], play: 'as-written', tempo: 96 }),
        options: ['Question (unfinished)', 'Answer (finished)'],
        answer: kind === 'answer' ? 'Answer (finished)' : 'Question (unfinished)',
        explain: kind === 'answer' ? `It comes to rest on ${name(C_SCALE[end])}, the tonic, over I.` : `It stops on ${name(C_SCALE[end])}, over V: it wants an answer.`,
      };
    });
}

export const melodyUnit = unit('th-melody', 'Melody', 'Tunes and how they’re built', 'Steps and leaps, the notes that clash with the chord, motifs and sequences, and phrases that ask and answer.', [
  lesson(
    'th14-1',
    'Steps and Leaps',
    'learn',
    'How a tune moves from note to note',
    [
      explain(
        'Steps and leaps',
        `A melody moves in two ways. A **step** goes to the next note of the scale (a 2nd): C to D, E to F. A **leap** jumps over notes: a 3rd or more.

Most memorable tunes move mainly by **step**, with the odd leap for drama. After a big leap, a good melody usually turns and steps back the other way, filling the gap. Sing "Somewhere over the rainbow": an octave leap up, then a step back down.`,
        fig('C4/q D4 E4 F4 | G4/h C5/h | B4/q A4 G4 F4 | E4/w', { key: 'C', time: [4, 4], labels: ['', 'step', 'step', 'step', 'step', 'leap', 'step', 'step', 'step', 'step', 'step'], play: 'as-written', tempo: 104 }),
      ),
      explore('Move by step and by leap', 'Play these one note at a time.', [
        task('Steps: play C D E F G', C.melody('C', 'D', 'E', 'F', 'G')),
        task('Leaps: play C E G C', C.melody('C', 'E', 'G', 'C')),
        task('A big leap: play a note and then the same note an octave higher', C.interval(12, { up: true })),
      ]),
      quiz('Step or leap?', 'Next note of the scale, or a jump over notes?', 'Step or leap?', stepLeapRounds(8)),
      drill('How far?', 'Name the distance between the two notes: count the letters, both included.', intervalDrill('treble', 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5', [2, 3, 4, 5], 8)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th14-2',
    'Passing and Neighbour Notes',
    'learn',
    'Notes that aren’t in the chord',
    [
      explain(
        'Chord tones and the rest',
        `Under a melody there's usually a chord. Melody notes that belong to the chord are **chord tones**: they sound settled. Notes that don't are **non-chord tones**: they clash a little, and the clash keeps the tune moving.

Over a C major chord (C E G), the notes C, E and G are chord tones; D, F, A and B are not.`,
        fig('[C3 E3 G3 E4]/q [C3 E3 G3 F4]/q [C3 E3 G3 G4]/h', { key: 'C', labels: ['chord tone', 'clash', 'chord tone'], play: 'as-written' }),
      ),
      explain(
        'Passing and neighbour notes',
        `The two most common non-chord tones move by step:

- A **passing note** fills the gap between two chord tones a 3rd apart: E–**F**–G. It passes through.
- A **neighbour note** steps away from a chord tone and comes straight back: E–**F**–E, or E–**D**–E.

Both fall on weaker beats, so the clash is brief and gentle.`,
        fig('[C3 E3 G3 E4]/q [C3 E3 G3 D4]/q [C3 E3 G3 E4]/h', { key: 'C', labels: ['', 'neighbour', ''], play: 'as-written' }),
      ),
      quiz('Passing or neighbour?', 'Does the middle note move on in the same direction, or come back?', 'What is the middle note?', nctRounds({ kinds: ['passing', 'neighbour'], count: 6 })),
      build('Decorate the line', 'Play the three notes one after another.', nctBuildRounds(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th14-3',
    'Suspensions and Appoggiaturas',
    'learn',
    'Clashes on the strong beat',
    [
      explain(
        'The appoggiatura',
        `An **appoggiatura** (Italian for "leaning") is **leapt to**, clashes with the chord on a strong beat, and then **steps** to a chord tone. It's the sigh in a love song: the clash comes first, the resolution after.

Over C major: C leaps up to **F**, which leans on the E below it, and resolves down to E.`,
        fig('[C3 E3 G3 C4]/q [C3 E3 G3 F4]/q [C3 E3 G3 E4]/h', { key: 'C', labels: ['', 'appoggiatura', 'resolved'], play: 'as-written' }),
      ),
      explain(
        'The suspension',
        `A **suspension** is a note held over from one chord into the next, where it doesn't belong, and then let down by step to a note that does.

Below, F is part of the F major chord. The harmony changes to C major, but the F hangs on: it's suspended, clashing with the E it wants to become. Then it falls to E. Three stages: **prepare** (it fits), **suspend** (it clashes), **resolve** (it steps down).`,
        fig('[F3 A3 C4 F4]/h [C3 G3 C4 F4]/q [C3 G3 C4 E4]/q', { key: 'C', labels: ['prepare', 'suspend', 'resolve'], play: 'as-written', tempo: 72 }),
      ),
      quiz('Which non-chord tone?', 'Was the clash stepped to and from (passing, neighbour), or leapt to and then resolved (appoggiatura)?', 'What is the middle note?', nctRounds({ kinds: ['passing', 'neighbour', 'appoggiatura'], count: 6 })),
      quiz('Name the stages', 'Think about the suspension above.', 'Which stage is it?', [
        round('The held note first sounds as part of the chord. Which stage is that?', 'Preparation', ['Preparation', 'Suspension', 'Resolution']),
        round('The chord changes and the held note clashes with it.', 'Suspension', ['Preparation', 'Suspension', 'Resolution']),
        round('The held note steps down to a chord tone.', 'Resolution', ['Preparation', 'Suspension', 'Resolution']),
        round('Which way does a suspension usually resolve?', 'Down by step', ['Down by step', 'Up by a leap', 'It doesn’t move']),
      ]),
    ],
    { key: 'C' },
  ),
  lesson(
    'th14-4',
    'Motifs and Sequences',
    'learn',
    'Small ideas, repeated and moved',
    [
      explain(
        'The motif',
        `A **motif** is a short musical idea, a few notes long, with a recognisable rhythm and shape. Beethoven's Fifth Symphony is built from one: short-short-short-**long**.

Composers rarely just state a motif once. They **repeat** it (the same again), set it in **sequence** (the same shape starting higher or lower), or follow it with **contrast** (something new). Beethoven's opening is a sequence: G G G E♭, then F F F D, one step lower.`,
        fig('r/e G4/e G4 G4 | Eb4/h | r/e F4/e F4 F4 | D4/h |', { key: 'Cm', time: [2, 4], labels: ['motif', '', '', '', 'sequence', '', '', ''], play: 'as-written', tempo: 108 }),
      ),
      quiz('Repetition, sequence or contrast?', 'Compare the second bar with the first: the same notes, the same shape moved, or a new shape?', 'How does the second bar relate to the first?', motifRounds(6)),
      build('Make a sequence', 'Keep the shape; start one note higher or lower. Play the three notes one after another.', sequenceBuildRounds(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th14-5',
    'Questions and Answers',
    'learn',
    'Phrases, and how they pair up',
    [
      explain(
        'Phrases',
        `Melodies are made of **phrases**, musical sentences usually two or four bars long, each ending with a cadence where the tune takes a breath.

Phrases often come in pairs. The first ends on an open note, often over V: it sounds like a **question**. The second starts the same way but ends on the tonic over I: the **answer**. Together they make a **period**. "Twinkle, twinkle" begins with exactly this kind of pair.`,
        fig('C4/q C4 G4 G4 | A4/q A4 G4/h | F4/q F4 E4 E4 | D4/q D4 C4/h |', { key: 'C', time: [4, 4], labels: ['', '', '', '', '', '', 'question', '', '', '', '', '', '', 'answer'], play: 'as-written', tempo: 100 }),
      ),
      explain(
        'Why the endings feel the way they do',
        `An ending on the **tonic** (C in C major), over the I chord, sounds finished: that's home. An ending on **2** or **7** (D or B), over V, sounds open: those notes lean towards the tonic and want to go there.

In "Twinkle" above, the first phrase stops on G, the 5th of the scale, and hangs in the air; the second comes home to C.`,
        fig('[G2 B2 D3 D4]/w [C3 E3 G3 C4]/w', { key: 'C', labels: ['open', 'closed'], play: 'as-written', tempo: 72 }),
      ),
      quiz('Question or answer?', 'Listen to where the phrase stops: still going, or home?', 'Does the phrase sound finished?', phraseRounds(6), { mode: 'hear' }),
      quiz('Building blocks', 'Put the words to the ideas.', 'Which word fits?', [
        round('A short idea of a few notes, with its own rhythm and shape', 'Motif', ['Motif', 'Phrase', 'Period']),
        round('A musical sentence, usually two or four bars, ending with a cadence', 'Phrase', ['Motif', 'Phrase', 'Period']),
        round('A question phrase and an answer phrase together', 'Period', ['Motif', 'Phrase', 'Period']),
      ]),
    ],
    { key: 'C' },
  ),
  lesson(
    'th14-c',
    'Checkpoint: Melody',
    'checkpoint',
    'Steps, non-chord tones, motifs and phrases',
    [
      quiz('Step or leap?', '', 'Step or leap?', stepLeapRounds(4)),
      quiz('Non-chord tones', '', 'What is the middle note?', nctRounds({ kinds: ['passing', 'neighbour', 'appoggiatura'], count: 5 })),
      quiz('Motifs', '', 'How does the second bar relate to the first?', motifRounds(4)),
      build('Sequence', '', sequenceBuildRounds(2)),
      quiz('Phrases', '', 'Does the phrase sound finished?', phraseRounds(4), { mode: 'hear' }),
    ],
    { key: 'C' },
  ),
]);
