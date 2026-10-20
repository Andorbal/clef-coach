/**
 * Unit 3: beat and rhythm. The pulse and its tempo, note values from whole notes to
 * sixteenths, rests, bars and simple time signatures, dots and ties, and counting out
 * loud ("1 e + a"). Rhythm can't be played into a check, so the playing here is tapping
 * (the track's rhythm drill) and the quizzes are read and heard.
 */
import type { Rng } from '../../../curriculum/generate';
import { RH, rhythm as rhythmDrill } from '../../../curriculum/builders';
import { choices, draw, drill, explain, explore, fig, lesson, pick, quiz, round, task, unit, C } from '../build';
import type { Figure, QuizRound } from '../types';

/** Beats as they're read: 1½, ½, ¾. */
export function beatText(b: number): string {
  const whole = Math.floor(b);
  const frac = b - whole;
  const f = frac === 0.5 ? '½' : frac === 0.25 ? '¼' : frac === 0.75 ? '¾' : '';
  return whole ? `${whole}${f}` : f || '0';
}

interface Value {
  dur: string;
  beats: number;
  name: string;
}

const WHOLE: Value = { dur: 'w', beats: 4, name: 'whole note' };
const HALF: Value = { dur: 'h', beats: 2, name: 'half note' };
const QUARTER: Value = { dur: 'q', beats: 1, name: 'quarter note' };
const EIGHTH: Value = { dur: 'e', beats: 0.5, name: 'eighth note' };
const SIXTEENTH: Value = { dur: 's', beats: 0.25, name: 'sixteenth note' };
const DOTTED_HALF: Value = { dur: 'h.', beats: 3, name: 'dotted half note' };
const DOTTED_QUARTER: Value = { dur: 'q.', beats: 1.5, name: 'dotted quarter note' };

const BASIC = [WHOLE, HALF, QUARTER];
const DOTTED = [WHOLE, DOTTED_HALF, HALF, DOTTED_QUARTER, QUARTER];
const SHORT = [QUARTER, EIGHTH, SIXTEENTH, HALF];

/** A note value on its own (no bar): how many beats? */
function beatsRounds(values: Value[], count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, values, count).map(v => ({
      figure: fig(`C5/${v.dur}`, { keys: false, play: 'none' }),
      options: [...new Set(values.map(x => beatText(x.beats)))].sort((a, b) => parseBeats(a) - parseBeats(b)),
      answer: beatText(v.beats),
      explain: `A ${v.name} lasts ${beatText(v.beats)} beat${v.beats === 1 ? '' : 's'} (counting quarter notes).`,
    }));
}

/** Does each note stay inside its bar of four beats? */
function fitsBars(vs: Value[]): boolean {
  let at = 0;
  for (const v of vs) {
    if (Math.floor(at / 4) !== Math.floor((at + v.beats - 1e-6) / 4)) return false;
    at += v.beats;
  }
  return true;
}

const parseBeats = (t: string) => Number(t.replace('½', '.5').replace('¼', '.25').replace('¾', '.75').replace(/^\./, '0.'));

/** A few notes in a row (no bar): how many beats in all? */
function sumRounds(values: Value[], count: number, ties = false) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const n = pick(rng, [2, 3, 3]);
      // no note may cross a (hidden) bar line, or it would be drawn as two tied notes
      let vs: Value[] = [];
      for (let tries = 0; tries < 40; tries++) {
        vs = Array.from({ length: n }, () => pick(rng, values));
        if (fitsBars(vs)) break;
      }
      if (!fitsBars(vs)) vs = [QUARTER, QUARTER, HALF];
      const total = vs.reduce((s, v) => s + v.beats, 0);
      // with ties, two notes of the same pitch joined into one
      const tied = ties && n >= 2 && rng() < 0.6;
      const text = vs.map((v, i) => `C5/${v.dur}${tied && i === 0 ? '~' : ''}`).join(' ');
      // whole beats only when every value is a whole number of beats
      const steps = values.every(v => Number.isInteger(v.beats)) ? [-2, -1, 1, 2] : [-1, -0.5, 0.5, 1, 2];
      const near = steps.map(d => total + d).filter(x => x > 0).map(beatText);
      return {
        figure: fig(text, { keys: false, play: 'none' }),
        options: choices(rng, beatText(total), [beatText(total), ...near], 4).sort((a, b) => parseBeats(a) - parseBeats(b)),
        answer: beatText(total),
        explain: `${vs.map(v => beatText(v.beats)).join(' + ')} = ${beatText(total)} beat${total === 1 ? '' : 's'}${tied ? '; the tie joins the first two into one long note, but the beats still add up' : ''}.`,
      };
    });
}

/** Name the rest. */
function restRounds(count: number) {
  const rests: [string, string][] = [
    ['w', 'Whole rest'],
    ['h', 'Half rest'],
    ['q', 'Quarter rest'],
    ['e', 'Eighth rest'],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, rests, count).map(([d, label]) => ({
      figure: fig(`r/${d}`, { keys: false, play: 'none' }),
      options: rests.map(r => r[1]),
      answer: label,
      explain: d === 'w' ? 'The whole rest hangs down from a line.' : d === 'h' ? 'The half rest sits on top of a line, like a hat.' : d === 'q' ? 'The quarter rest is the squiggle.' : 'The eighth rest has one flag, like an eighth note.',
    }));
}

/** An accompaniment that makes the metre audible: a bass note on the downbeat, chords after it. */
export function metreFigure(beats: 2 | 3 | 4 | 5, tempo = 104): Figure {
  const bar = (bass: string, chord: string) => [`${bass}/q`, ...Array.from({ length: beats - 1 }, () => `${chord}/q`)].join(' ');
  const bars = [bar('C3', '[E4 G4]'), bar('G2', '[D4 F4]'), bar('C3', '[E4 G4]'), bar('G2', '[D4 G4]')];
  return fig(bars.join(' | '), { time: [beats, 4], clef: 'grand', keys: false, tempo });
}

/** Hear the metre: how many beats in a bar? */
export function metreRounds(choicesOf: (2 | 3 | 4 | 5)[], count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, choicesOf, count).map(b => ({
      figure: metreFigure(b, pick(rng, [92, 104, 116])),
      options: choicesOf.map(x => `${x} beats`),
      answer: `${b} beats`,
      explain: `The low note comes round every ${b} beats: that’s beat 1 of each bar, so it’s in ${b}/4.`,
    }));
}

/** Slow, medium or fast? */
function tempoRounds(count: number) {
  const tempos: [string, number][] = [
    ['Slow (about 60)', 60],
    ['Medium (about 100)', 100],
    ['Fast (about 150)', 150],
  ];
  const phrases = ['C4/q E4 G4 E4 | C4/q E4 G4/h', 'G4/q F4 E4 D4 | C4/q D4 E4/h', 'E4/q E4 F4 G4 | G4/q F4 E4/h'];
  return (rng: Rng): QuizRound[] =>
    draw(rng, tempos, count).map(([label, t]) => ({
      figure: fig(pick(rng, phrases), { time: [4, 4], keys: false, tempo: t }),
      options: tempos.map(x => x[0]),
      answer: label,
      explain: `That was ${t} beats per minute.`,
    }));
}

/** Quarters, eighths or sixteenths: how is the beat divided? */
function divisionRounds(count: number) {
  const kinds: [string, string][] = [
    ['Quarter notes', 'C5/q C5/q C5/q C5/q'],
    ['Eighth notes', 'C5/e C5/e C5/e C5/e C5/e C5/e C5/e C5/e'],
    ['Sixteenth notes', Array.from({ length: 16 }, () => 'C5/s').join(' ')],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, kinds, count).map(([label, notes]) => ({
      figure: fig(notes, { time: [4, 4], keys: false, tempo: 66 }),
      options: kinds.map(k => k[0]),
      answer: label,
      explain: label === 'Quarter notes' ? 'One note per beat.' : label === 'Eighth notes' ? 'Two notes per beat: 1 + 2 +.' : 'Four notes per beat: 1 e + a.',
    }));
}

export const rhythmUnit = unit('th-rhythm', 'Beat and Rhythm', 'Reading time', 'The pulse, how long each note lasts, rests, bars and time signatures, dots and ties.', [
  lesson(
    'th3-1',
    'The Beat',
    'learn',
    'Feel the pulse, and how fast it goes',
    [
      explain(
        'A steady pulse',
        `Under almost all music there's a steady **beat**: the pulse you tap your foot to. Rhythm is how the notes fit against it: some last one beat, some several, some only part of one.

Tap along as you hear this: one tap per note, all evenly spaced. Counting out loud ("1, 2, 3, 4") is how musicians keep their place.`,
        fig('B4/q B4/q B4/q B4/q | B4/q B4/q B4/q B4/q', { time: [4, 4], keys: false, labels: ['1', '2', '3', '4', '1', '2', '3', '4'], tempo: 80 }),
      ),
      explain(
        'Tempo',
        `How fast the beat goes is the **tempo**, measured in **beats per minute** (bpm). 60 bpm is one beat a second; a brisk march is about 120.

Music also uses Italian words for tempo: **largo** (very slow), **andante** (walking pace), **moderato** (moderate), **allegro** (quick and bright), **presto** (very fast). The same tune at a different tempo sounds calm or excited.`,
        fig('C4/q E4 G4 E4 | C4/q E4 G4/h', { time: [4, 4], keys: false, labels: ['1', '2', '3', '4', '1', '2', '3'], tempo: 132 }),
      ),
      quiz('How fast?', 'Listen: is the beat slow, medium or fast?', 'What’s the tempo?', tempoRounds(5), { mode: 'hear' }),
      drill('Tap the beat', 'One tap for each note, right on the beat. Count 1 2 3 4 in your head.', rhythmDrill([4, 4], RH.quarters, { tempo: 72, measures: 2 })),
    ],
    { topics: ['rhythm:basic'] },
  ),
  lesson(
    'th3-2',
    'Note Values',
    'learn',
    'Whole, half and quarter notes',
    [
      explain(
        'Long and short',
        `A note's look tells you how long it lasts, counted in beats:

- a **whole note** (a hollow oval, no stem) lasts **4** beats
- a **half note** (hollow, with a stem) lasts **2**
- a **quarter note** (filled in, with a stem) lasts **1**

Each is half the one before. The numbers under the notes are their beats.`,
        fig('C5/w | C5/h C5/h | C5/q C5/q C5/q C5/q', { time: [4, 4], keys: false, labels: ['4', '2', '2', '1', '1', '1', '1'], tempo: 80 }),
      ),
      explore('Hold them', 'Play a note and hold it while you count. Long notes are easy to cut short: count every beat.', [
        task('Play four short notes, one per beat (quarter notes)', C.any(4)),
        task('Now two notes, holding each for two beats (half notes)', C.any(6)),
        task('Now one note, held for four beats (a whole note)', C.any(7)),
      ]),
      quiz('How many beats?', 'Each note on its own: how many beats does it last?', 'How many beats?', beatsRounds(BASIC, 6)),
      quiz('Add them up', 'Several notes in a row: how many beats do they take altogether?', 'How many beats in all?', sumRounds(BASIC, 5)),
      drill('Tap the rhythm', 'Tap when each note starts. Long notes mean waiting: keep counting.', rhythmDrill([4, 4], RH.qhw, { tempo: 72 })),
    ],
  ),
  lesson(
    'th3-3',
    'Rests and Bars',
    'learn',
    'Counted silence, bar lines and time signatures',
    [
      explain(
        'Rests',
        `A **rest** is a silence of a set length, and every note value has one. Rests are counted exactly like notes: a quarter rest is one beat of silence.

The **whole rest** hangs down from a line; the **half rest** sits on top of a line like a hat. The quarter rest is a squiggle, and the eighth rest has a flag.`,
        fig('r/w | r/h r/h | r/q r/q r/q r/q', { time: [4, 4], keys: false, play: 'none' }),
      ),
      explain(
        'Bars and time signatures',
        `**Bar lines** split music into **bars** (measures) with the same number of beats in each. The **time signature** at the start says how many: the top number is the beats in a bar, the bottom number which note is one beat (4 means a quarter note).

**4/4** (also written C, "common time") has four quarter-note beats; **3/4** has three; **2/4** two. Every bar adds up exactly, rests included.`,
        fig('G4/q B4 D5 | G4/h r/q | E4/q G4 C5 | C5/h.', { time: [3, 4], keys: false, labels: ['1', '2', '3', '1', '1', '2', '3', '1'], tempo: 96 }),
      ),
      quiz('Name the rest', 'Which rest is this?', 'Which rest is this?', restRounds(6)),
      quiz('Two, three or four?', 'Listen for the low note: it marks beat 1 of each bar. How many beats until it comes round again?', 'How many beats in each bar?', metreRounds([2, 3, 4], 6), { mode: 'hear' }),
      drill('Tap the rhythm', 'Rests are silences, not pauses: keep counting through them, and don’t tap.', rhythmDrill([4, 4], RH.rests, { tempo: 72 })),
    ],
    { topics: ['rhythm:rests', 'time:simple'] },
  ),
  lesson(
    'th3-4',
    'Dots and Ties',
    'learn',
    'Make notes half as long again, or join them',
    [
      explain(
        'The dot',
        `A **dot** after a note makes it half as long again. A half note is 2 beats, so a **dotted half** is 3. A quarter is 1 beat, so a **dotted quarter** is 1½.

A dotted quarter is usually followed by an eighth note (½ beat) to complete the beat: long, short. You'll hear that pattern everywhere.`,
        fig('C5/h. C5/q | C5/q. C5/e C5/h', { time: [4, 4], keys: false, labels: ['3', '1', '1½', '½', '2'], tempo: 80 }),
      ),
      explain(
        'The tie',
        `A **tie** is a curved line joining two notes of the **same pitch**: play the first and hold it for both values, without playing the second.

Ties let a note last across a bar line, or make lengths no single note has (a half tied to a quarter is 3 beats in the middle of a bar). Don't confuse it with a **slur**, which joins different notes and means "play smoothly".`,
        fig('C5/h C5/q C5/q~ | C5/q C5/q C5/h', { time: [4, 4], keys: false, labels: ['1', '3', '4 (hold)', '2', '3'], tempo: 80 }),
      ),
      quiz('How long?', 'Dotted notes too: how many beats?', 'How many beats?', beatsRounds(DOTTED, 6)),
      quiz('Add them up', 'Dots and ties included.', 'How many beats in all?', sumRounds(DOTTED, 5, true)),
      drill('Tap the rhythm', 'Long, short: the dotted quarter takes a beat and a half, the eighth after it fills the beat.', rhythmDrill([4, 4], RH.dotted, { tempo: 66 })),
    ],
    { topics: ['rhythm:dotted', 'rhythm:ties'] },
  ),
  lesson(
    'th3-5',
    'Eighths and Sixteenths',
    'learn',
    'Split the beat in two and in four',
    [
      explain(
        'Eighth notes',
        `An **eighth note** lasts half a beat: it has a flag, or a **beam** joining it to its neighbours. Two eighths make one beat.

Count them by adding "and" (written +) between the beats: **1 + 2 + 3 + 4 +**. The numbers fall on the beat, the "and"s halfway between.`,
        fig('C5/e C5/e C5/e C5/e C5/q C5/q', { time: [4, 4], keys: false, labels: ['1', '+', '2', '+', '3', '4'], tempo: 76 }),
      ),
      explain(
        'Sixteenth notes',
        `A **sixteenth note** has two flags or two beams, and lasts a quarter of a beat: four to a beat.

Count them **1 e + a, 2 e + a** (say "one-ee-and-uh"). Fast music is mostly a matter of counting small: the beat stays the same, the notes divide it.`,
        fig('C5/s C5/s C5/s C5/s C5/e C5/e C5/q C5/q', { time: [4, 4], keys: false, labels: ['1', 'e', '+', 'a', '2', '+', '3', '4'], tempo: 66 }),
      ),
      quiz('How many fit?', 'Note values are halves of each other, so they fit together exactly.', 'How many fit?', [
        round('How many eighth notes last as long as a quarter note?', '2', ['1', '2', '4']),
        round('How many eighth notes last as long as a half note?', '4', ['2', '4', '8']),
        round('How many sixteenth notes fit in one beat?', '4', ['2', '3', '4']),
        round('How many sixteenths make an eighth note?', '2', ['2', '4', '8']),
        round('How many eighth notes fill a bar of 4/4?', '8', ['4', '6', '8']),
      ]),
      quiz('Hear the division', 'The beat stays the same: how many notes are there in each beat?', 'Which notes are these?', divisionRounds(5), { mode: 'hear' }),
      quiz('Add them up', '', 'How many beats in all?', sumRounds(SHORT, 4)),
      drill('Tap the rhythm', 'Count “1 + 2 +” out loud, and tap on every note.', rhythmDrill([4, 4], RH.eighths, { tempo: 72 })),
    ],
    { topics: ['rhythm:eighths', 'rhythm:sixteenths'] },
  ),
  lesson(
    'th3-c',
    'Checkpoint: Rhythm',
    'checkpoint',
    'Note values, rests, dots and time signatures',
    [
      quiz('How many beats?', '', 'How many beats?', beatsRounds([...DOTTED, EIGHTH], 6)),
      quiz('Add them up', '', 'How many beats in all?', sumRounds([...DOTTED, EIGHTH], 4, true)),
      quiz('Name the rest', '', 'Which rest is this?', restRounds(3)),
      quiz('Two, three or four?', '', 'How many beats in each bar?', metreRounds([2, 3, 4], 4), { mode: 'hear' }),
      drill('Tap the rhythm', '', rhythmDrill([4, 4], RH.dottedRests, { tempo: 72 })),
    ],
  ),
]);
