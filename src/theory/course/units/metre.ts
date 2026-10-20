/**
 * Unit 4: metre. How beats group into strong and weak, three-beat time, compound time
 * (beats split in three), triplets and syncopation, and the odd metres of five and seven.
 * Metre is something you hear, so most quizzes listen: a low note marks beat 1 of each bar.
 */
import type { Rng } from '../../../curriculum/generate';
import { RH, rhythm as rhythmDrill } from '../../../curriculum/builders';
import type { TimeSig } from '../../../music/rhythm';
import { draw, drill, explain, fig, lesson, pick, quiz, round, unit } from '../build';
import type { QuizRound } from '../types';
import { beatText, metreRounds } from './rhythm';

const eighths = (n: number, note = 'C5') => Array.from({ length: n }, () => `${note}/e`).join(' ');

/** Simple or compound: the low note on every beat, then the beat split in two or in three. */
function twosOrThreesRounds(count: number) {
  const simple = '[C3 E4]/e G4/e [C3 E4]/e G4/e | [G2 D4]/e F4/e [G2 D4]/e F4/e | [C3 E4]/e G4/e [C3 E4]/e G4/e | [G2 D4]/e F4/e [C3 E4]/q';
  const compound = '[C3 E4]/e G4/e C5/e [C3 E4]/e G4/e C5/e | [G2 D4]/e F4/e B4/e [G2 D4]/e F4/e B4/e | [C3 E4]/e G4/e C5/e [C3 E4]/e G4/e C5/e | [G2 D4]/e F4/e B4/e [C3 E4]/q.';
  const kinds: [string, string, TimeSig, number][] = [
    ['Twos (simple time)', simple, [2, 4], 76],
    ['Threes (compound time)', compound, [6, 8], 104],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, kinds, count).map(([label, notes, time, tempo]) => ({
      figure: fig(notes, { time, clef: 'grand', keys: false, tempo }),
      options: kinds.map(k => k[0]),
      answer: label,
      explain: time[1] === 8 ? 'Each beat splits into three: ONE-and-a TWO-and-a. That’s 6/8.' : 'Each beat splits into two: ONE-and TWO-and. That’s 2/4.',
    }));
}

/** How many beats does a bar of this time signature have? */
function beatsInBarRounds(count: number) {
  const sigs: [TimeSig, number][] = [
    [[2, 4], 4],
    [[3, 4], 6],
    [[4, 4], 8],
    [[6, 8], 6],
    [[9, 8], 9],
    [[12, 8], 12],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, sigs, count).map(([t, n]) => {
      const beats = t[1] === 8 ? t[0] / 3 : t[0];
      return {
        prompt: `How many beats does a bar of ${t[0]}/${t[1]} have?`,
        figure: fig(eighths(n), { time: t, keys: false, tempo: 84 }),
        options: ['2', '3', '4', '6'],
        answer: String(beats),
        explain: t[1] === 8 ? `In ${t[0]}/8 a beat is a dotted quarter, three eighths: ${t[0]} ÷ 3 = ${beats} beats.` : `In ${t[0]}/4 a beat is a quarter note (two eighths): ${t[0]} beats.`,
      };
    });
}

/** Does this fill one bar of 3/4? */
function fillRounds(count: number) {
  const fill: string[][] = [['h.'], ['h', 'q'], ['q', 'h'], ['q', 'q', 'q'], ['q.', 'e', 'q'], ['q', 'e', 'e', 'q']];
  const miss: string[][] = [['h', 'h'], ['w'], ['q', 'q'], ['h.', 'q'], ['q', 'q', 'q', 'q'], ['h', 'e', 'e', 'q']];
  const beats: Record<string, number> = { w: 4, 'h.': 3, h: 2, 'q.': 1.5, q: 1, e: 0.5 };
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['Yes', 'No'], count).map(ans => {
      const vs = pick(rng, ans === 'Yes' ? fill : miss);
      const total = vs.reduce((s, v) => s + beats[v], 0);
      return {
        figure: fig(vs.map(v => `G4/${v}`).join(' '), { keys: false, play: 'none' }),
        options: ['Yes', 'No'],
        answer: ans,
        explain: `${vs.map(v => beatText(beats[v])).join(' + ')} = ${beatText(total)} beats${ans === 'Yes' ? ': exactly a bar of 3/4.' : `, not 3.`}`,
      };
    });
}

/** Even eighths, triplets or syncopation? */
function feelRounds(count: number) {
  const kinds: [string, string][] = [
    ['Even eighths', 'C5/e E5/e G5/e E5/e C5/e E5/e G5/e E5/e | C5/h G4/h'],
    ['Triplets', 'C5/e3 E5/e3 G5/e3 C5/e3 E5/e3 G5/e3 C5/e3 E5/e3 G5/e3 C5/e3 E5/e3 G5/e3 | C5/h G4/h'],
    ['Syncopated', 'C5/e E5/q G5/e E5/q C5/e E5/e | C5/h G4/h'],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, kinds, count).map(([label, notes]) => ({
      figure: fig(notes, { time: [4, 4], keys: false, tempo: 72 }),
      options: kinds.map(k => k[0]),
      answer: label,
      explain: label === 'Even eighths' ? 'Two equal notes in every beat.' : label === 'Triplets' ? 'Three equal notes in every beat.' : 'Long notes start between the beats, on the “and”: off-beat accents.',
    }));
}

export const metreUnit = unit('th-metre', 'Metre', 'Feeling time', 'Strong and weak beats, waltzes and jigs, triplets, syncopation, and the odd metres of five and seven.', [
  lesson(
    'th4-1',
    'Strong and Weak Beats',
    'learn',
    'Why some beats feel heavier than others',
    [
      explain(
        'Not every beat is equal',
        `Beats come in patterns of **strong** and **weak**. The first beat of every bar, the **downbeat**, is the strongest: it's where the bar line puts it.

In 4/4 the pattern is strong, weak, medium, weak. In 2/4 it's strong, weak: left, right, like a march. That repeating pattern of accents is the music's **metre**, and it's what makes you want to move.`,
        fig('C3/q [E4 G4]/q [E4 G4]/q [E4 G4]/q | G2/q [D4 F4]/q [D4 F4]/q [D4 F4]/q', { time: [4, 4], clef: 'grand', keys: false, labels: ['strong', 'weak', 'medium', 'weak', 'strong', 'weak', 'medium', 'weak'], tempo: 92 }),
      ),
      explain(
        'Upbeats',
        `Plenty of tunes start just before a strong beat, on an **upbeat** (also called a **pickup** or **anacrusis**). "Happy Birthday" does: "hap-py" comes before the first strong beat on "birth".

Printed music often begins with a short bar holding only the upbeat; here the beats before it are shown as a rest. Feel the lift into beat 1.`,
        fig('r/h. G4/q | C5/q. B4/e A4/q G4/q | E5/h C5/h', { time: [4, 4], keys: false, labels: ['up', '1', '', '', '', '1', ''], tempo: 96 }),
      ),
      quiz('March or waltz?', 'The low note marks beat 1. Does it come back every two beats (a march) or every three (a waltz)?', 'How many beats in each bar?', metreRounds([2, 3], 6), { mode: 'hear' }),
      drill('Tap in two', 'A march: count “1 2, 1 2” and tap each note.', rhythmDrill([2, 4], RH.qh, { tempo: 84, measures: 4 })),
    ],
  ),
  lesson(
    'th4-2',
    'Three Beats: the Waltz',
    'learn',
    'Count and feel 3/4',
    [
      explain(
        'One, two, three',
        `**3/4** has three quarter-note beats in a bar: strong, weak, weak. It's the time of the **waltz** and the **minuet**, and of many songs and hymns ("Amazing Grace", "Happy Birthday").

The classic waltz accompaniment says it all: a low note on beat 1, then two lighter chords. Oom-pah-pah.`,
        fig('C3/q [E4 G4] [E4 G4] | G2/q [D4 F4] [D4 F4] | C3/q [E4 G4] [E4 G4] | G2/q [D4 G4] [D4 G4]', { time: [3, 4], clef: 'grand', keys: false, labels: ['1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3'], tempo: 120 }),
      ),
      explain(
        'Filling a bar of three',
        `Three beats can be filled many ways: a **dotted half** (3 beats) on its own, a half and a quarter (either way round), three quarters, or any mix that adds up to three.

A whole note never fits in 3/4: it's four beats. That's why a held note at the end of a waltz is a dotted half.`,
        fig('C5/h. | C5/h C5/q | C5/q C5/h | C5/q C5/q C5/q', { time: [3, 4], keys: false, labels: ['3', '2', '1', '1', '2', '1', '1', '1'], tempo: 96 }),
      ),
      quiz('Three or four?', 'Count from one low note to the next.', 'How many beats in each bar?', metreRounds([3, 4], 6), { mode: 'hear' }),
      quiz('Does it fill the bar?', 'Add up the beats: is it exactly one bar of 3/4?', 'Exactly three beats?', fillRounds(6)),
      drill('Tap the waltz', 'Count “1 2 3” and feel the weight on 1.', rhythmDrill([3, 4], RH.waltz, { tempo: 88 })),
    ],
    { topics: ['time:3/4'] },
  ),
  lesson(
    'th4-3',
    'Compound Time',
    'learn',
    'Beats that split into three: 6/8, 9/8 and 12/8',
    [
      explain(
        'Beats in threes',
        `In **6/8** the beat is a **dotted quarter**, and it splits into **three** eighth notes. So a bar has six eighths but only **two beats**: count "**1** + a **2** + a" (ONE-and-a TWO-and-a).

It has a lilting, rolling feel: jigs, lullabies, sea shanties, "Row, Row, Row Your Boat". Music whose beats split in three is in **compound time**.`,
        fig('C5/e D5/e E5/e F5/e E5/e D5/e | C5/q. G4/q.', { time: [6, 8], keys: false, labels: ['1', '+', 'a', '2', '+', 'a', '1', '2'], tempo: 100 }),
      ),
      explain(
        'Simple or compound?',
        `In **simple time** (2/4, 3/4, 4/4) each beat splits in **two**. In **compound time** (6/8, 9/8, 12/8) each splits in **three**.

To find the beats in compound time, divide the top number by three: 6/8 has 2 beats, 9/8 has 3, 12/8 has 4. Slow blues and many ballads are in 12/8: four big beats, each with a triplet swing inside.`,
        fig('C5/q. E5/q. G5/q. E5/q. | C5/e D5/e E5/e G5/e F5/e E5/e D5/e C5/e D5/e C5/q.', { time: [12, 8], keys: false, labels: ['1', '2', '3', '4', '1', '', '', '2', '', '', '3', '', '', '4'], tempo: 104 }),
      ),
      quiz('Twos or threes?', 'Listen to how each beat divides: into two notes, or three?', 'Simple or compound time?', twosOrThreesRounds(6), { mode: 'hear' }),
      quiz('How many beats?', 'Simple or compound, the top number and the beat tell you.', 'How many beats in a bar?', beatsInBarRounds(6)),
      drill('Tap in six-eight', 'Count “1 + a 2 + a”: two beats, three notes in each.', rhythmDrill([6, 8], RH.compound, { tempo: 60 })),
    ],
    { topics: ['time:compound'] },
  ),
  lesson(
    'th4-4',
    'Triplets and Syncopation',
    'learn',
    'Three in the space of two, and accents off the beat',
    [
      explain(
        'Triplets',
        `A **triplet** squeezes three notes into the time of two. Three triplet eighths share one beat equally, marked with a little **3**. Count them "1-trip-let, 2-trip-let".

Triplets borrow the feel of compound time for a moment, inside simple time. Swing in jazz is built on them.`,
        fig('C5/e3 C5/e3 C5/e3 D5/e3 D5/e3 D5/e3 E5/q E5/q', { time: [4, 4], keys: false, labels: ['1', 'trip', 'let', '2', 'trip', 'let', '3', '4'], tempo: 72 }),
      ),
      explain(
        'Syncopation',
        `**Syncopation** puts the accent where you don't expect it: a note starts between the beats, on an "and", and is held through the next beat. The rhythm pulls against the steady pulse underneath.

It's the heartbeat of jazz, funk, Latin music and most pop. Count steadily and let the notes land off the beat.`,
        fig('C5/e C5/q C5/e C5/q C5/q | E5/e E5/q E5/e E5/h', { time: [4, 4], keys: false, labels: ['1', '+', '+', '3', '4', '1', '+', '+', '3'], tempo: 84 }),
      ),
      quiz('What’s the feel?', 'Even eighths, triplets, or syncopation?', 'Which rhythm is this?', feelRounds(6), { mode: 'hear' }),
      drill('Tap the triplets', 'Three even taps in each beat when you see the 3.', rhythmDrill([4, 4], RH.triplets, { tempo: 66 })),
      drill('Tap the syncopation', 'Keep the beat in your head; some notes start between beats.', rhythmDrill([4, 4], RH.syncopation, { tempo: 66 })),
    ],
    { topics: ['rhythm:triplets', 'rhythm:syncopation'] },
  ),
  lesson(
    'th4-5',
    'Odd Metres',
    'learn',
    'Five and seven beats, grouped in twos and threes',
    [
      explain(
        'Five beats',
        `**5/4** has five beats, and nobody hears five equal beats: it's felt as **3 + 2** (or 2 + 3), a short group and a long one. Here the low notes fall on beats 1 and 4.

Five-beat music has a restless, limping energy. Holst's "Mars" and many film and progressive-rock themes use it.`,
        fig('C3/q [E4 G4] [E4 G4] G2/q [D4 G4] | C3/q [E4 G4] [E4 G4] G2/q [D4 G4]', { time: [5, 4], clef: 'grand', keys: false, labels: ['1', '2', '3', '4', '5', '1', '2', '3', '4', '5'], tempo: 120 }),
      ),
      explain(
        'Seven eighths',
        `**7/8** is seven quick eighths, grouped as **2 + 2 + 3** (or 3 + 2 + 2, or 2 + 3 + 2): count "1-2 1-2 1-2-3". Here each group is one note: a quarter is two eighths, a dotted quarter three. The long group feels like a little hiccup at the end of each bar.

Folk dances from the Balkans live in metres like this: 7/8, 9/8 grouped 2+2+2+3, even 11/8. Once you count the groups, they swing.`,
        fig('C5/q E5/q G5/q. | D5/q F5/q A5/q.', { time: [7, 8], keys: false, labels: ['1-2', '1-2', '1-2-3', '1-2', '1-2', '1-2-3'], tempo: 132 }),
      ),
      quiz('How is it grouped?', 'Every metre groups its notes in twos and threes.', 'How is the bar grouped?', [
        round('How is a bar of 5/4 usually felt?', '3 + 2 or 2 + 3', ['3 + 2 or 2 + 3', 'Five equal beats', '4 + 1']),
        round('How is a bar of 7/8 usually grouped?', '2 + 2 + 3, in some order', ['2 + 2 + 3, in some order', 'Seven equal beats', '4 + 4']),
        round('How does 6/8 group its six eighths?', '3 + 3', ['3 + 3', '2 + 2 + 2', '4 + 2']),
        round('How does 3/4 group its six eighths?', '2 + 2 + 2', ['2 + 2 + 2', '3 + 3', '5 + 1']),
        round('How does 9/8 group its nine eighths?', '3 + 3 + 3', ['3 + 3 + 3', '4 + 5', '2 + 2 + 2 + 3']),
      ]),
      quiz('Count the beats', 'Three, four or five? Count from one low note to the next downbeat.', 'How many beats in each bar?', metreRounds([3, 4, 5], 6), { mode: 'hear' }),
      drill('Tap in five', 'Count “1 2 3 4 5”, leaning on 1 and 4.', rhythmDrill([5, 4], { q: 4, h: 1.2 }, { tempo: 84 })),
    ],
    { topics: ['time:odd'] },
  ),
  lesson(
    'th4-c',
    'Checkpoint: Metre',
    'checkpoint',
    'Hear and count simple, compound and odd metres',
    [
      quiz('How many beats?', '', 'How many beats in each bar?', metreRounds([2, 3, 4, 5], 5), { mode: 'hear' }),
      quiz('Twos or threes?', '', 'Simple or compound time?', twosOrThreesRounds(4), { mode: 'hear' }),
      quiz('Beats in a bar', '', 'How many beats in a bar?', beatsInBarRounds(4)),
      quiz('What’s the feel?', '', 'Which rhythm is this?', feelRounds(3), { mode: 'hear' }),
      drill('Tap in six-eight', '', rhythmDrill([6, 8], RH.compound, { tempo: 66, reps: 1 })),
    ],
  ),
]);
