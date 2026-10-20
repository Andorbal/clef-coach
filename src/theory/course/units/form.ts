/**
 * Unit 17: form, the shapes whole pieces take. From a motif to a phrase to sections;
 * binary and ternary form; verse, chorus and the 12-bar blues; rondo and variations;
 * sonata form in outline. It ends with the course's final exam, which pulls everything
 * together: intervals, keys, chords, numerals, scales and cadences.
 */
import type { Rng } from '../../../curriculum/generate';
import { interval } from '../../../curriculum/builders';
import { parseKey } from '../../../music/keys';
import { midiOf, stepLabel } from '../../../music/pitch';
import { chordNotes, diatonicChord, pitchText, scaleNotes, tonicPitch, transpose } from '../../theory';
import {
  C,
  build,
  choices,
  chordRounds,
  draw,
  drill,
  explain,
  explore,
  fig,
  intervalRounds,
  keySignatureRounds,
  lesson,
  numeralBuildRounds,
  numeralRounds,
  pick,
  quiz,
  round,
  scaleRounds,
  task,
  unit,
} from '../build';
import type { BuildRound, QuizRound } from '../types';

const keyLabel = (k: string) => {
  const key = parseKey(k);
  const t = tonicPitch(key);
  return `${stepLabel(t.step, t.alter)} ${key.mode}`;
};

/** Labels for a figure with `count` notes: text at a few of them, nothing under the rest. */
function marks(count: number, at: Record<number, string>): string[] {
  return Array.from({ length: count }, (_, i) => at[i] ?? '');
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const C_MAJOR = scaleNotes('C4', 'major', 2).map(pitchText);

/** A four-note motif in C major (scale indexes), stepping and leaping a little. */
function motif(rng: Rng): number[] {
  const out = [2 + Math.floor(rng() * 5)];
  for (let i = 1; i < 4; i++) out.push(Math.max(0, Math.min(11, out[i - 1] + pick(rng, [-2, -1, 1, 2, 3, -3]))));
  return out;
}

const sameShape = (a: number[], b: number[]) => a.every((x, i) => x - a[0] === b[i] - b[0]);

/** Repetition, sequence or contrast: the second bar against the first. */
function phraseRounds(count: number) {
  const LABEL = { repeat: 'Repetition', sequence: 'Sequence', contrast: 'Something new' } as const;
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['repeat', 'sequence', 'contrast'] as const, count).map(kind => {
      const a = motif(rng);
      let b: number[];
      if (kind === 'repeat') b = [...a];
      else if (kind === 'sequence') {
        // a step or two up or down, staying on the scale written out
        const lo = Math.min(...a);
        const hi = Math.max(...a);
        const shift = pick(rng, [-2, -1, 1, 2].filter(d => lo + d >= 0 && hi + d < C_MAJOR.length));
        b = a.map(x => x + shift);
      } else {
        do b = motif(rng);
        while (sameShape(a, b));
      }
      const bar = (idx: number[]) => idx.map((x, i) => `${C_MAJOR[x]}${i === 0 ? '/q' : ''}`).join(' ');
      return {
        figure: fig(`${bar(a)} | ${bar(b)} |`, { time: [4, 4], play: 'as-written', tempo: 100, keys: false }),
        options: ['Repetition', 'Sequence', 'Something new'],
        answer: LABEL[kind],
        explain: kind === 'repeat' ? 'The second bar is the first again, note for note.' : kind === 'sequence' ? 'The same shape, starting on a different note: a sequence.' : 'A new shape: contrast.',
      };
    });
}

/** The 12-bar blues: I I I I | IV IV I I | V IV I V. */
const TWELVE_BAR = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'];

function bluesBarBuild(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, [1, 2, 5, 6, 7, 9, 10, 11, 12], count).map(bar => {
      const k = pick(rng, ['C', 'G', 'F', 'D']);
      const numeral = TWELVE_BAR[bar - 1];
      const deg = numeral === 'I' ? 1 : numeral === 'IV' ? 4 : 5;
      const c = diatonicChord(parseKey(k), deg);
      let root = { ...c.root, octave: 3 };
      if (midiOf(root) < 52) root = { ...root, octave: 4 };
      const notes = chordNotes(root, 'maj').map(pitchText);
      return {
        prompt: `A 12-bar blues in ${keyLabel(k)}: play the chord of bar ${bar}`,
        figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
        check: C.chord(['maj', '7'], { root: pitchText(root).replace(/\d$/, '') }),
        answer: notes,
        explain: `Bar ${bar} is ${numeral}: ${stepLabel(root.step, root.alter)} (a 7th on top makes it bluesier).`,
      };
    });
}

/** Cadences by ear: three chords, and how the last two end the phrase. */
const CADENCES = {
  perfect: { label: 'Perfect (V–I)', degrees: [1, 5, 1] },
  plagal: { label: 'Plagal (IV–I)', degrees: [1, 4, 1] },
  imperfect: { label: 'Imperfect (ends on V)', degrees: [1, 4, 5] },
  interrupted: { label: 'Interrupted (V–vi)', degrees: [1, 5, 6] },
};

function cadenceRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, Object.keys(CADENCES) as (keyof typeof CADENCES)[], count).map(kind => {
      const k = pick(rng, ['C', 'G', 'F', 'D']);
      const key = parseKey(k);
      const chord = (d: number) => {
        const c = diatonicChord(key, d);
        let root = { ...c.root, octave: 4 };
        if (midiOf(root) > 67) root = { ...root, octave: 3 };
        const bass = transpose(root, 'P8', true);
        return `[${[bass, ...chordNotes(root, c.quality.id)].map(pitchText).join(' ')}]`;
      };
      const [a, b, c] = CADENCES[kind].degrees.map(chord);
      return {
        figure: fig(`${a}/h ${b}/h | ${c}/w |`, { time: [4, 4], key: k, play: 'as-written', tempo: 72 }),
        options: Object.values(CADENCES).map(x => x.label),
        answer: CADENCES[kind].label,
        explain: `${keyLabel(k)}: ${CADENCES[kind].degrees.map(d => diatonicChord(key, d).numeral).join(' – ')}.`,
      };
    });
}

/** Name the form from its plan. */
const FORMS: [string, string][] = [
  ['A, repeated; then B, repeated', 'Binary (AB)'],
  ['A, then B, then A again', 'Ternary (ABA)'],
  ['A B A C A: a refrain that keeps coming back', 'Rondo'],
  ['A tune, then the same tune again and again, each time dressed differently', 'Theme and variations'],
  ['Verses with new words, and a chorus that returns with the same words', 'Verse–chorus'],
  ['Exposition, development, recapitulation', 'Sonata form'],
];

function formRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, FORMS, count).map(([plan, form]) => ({
      prompt: `Which form is this? ${plan}.`,
      options: choices(rng, form, FORMS.map(([, f]) => f), 4),
      answer: form,
    }));
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

const FATE = 'r/e G4/e G4/e G4/e | Eb4/h | r/e F4/e F4/e F4/e | D4/h |';

/** The last two bars of each phrase of Ode to Joy: the question's ending, then the answer's. */
const ODE_ENDINGS = 'C4/q C4 D4 E4 | E4/q. D4/e D4/h || C4/q C4 D4 E4 | D4/q. C4/e C4/h |';

/** The opening of each section of Twinkle, Twinkle. */
const TWINKLE_AB = 'C4/q C4 G4 G4 | A4 A4 G4/h || G4/q G4 F4 F4 | E4 E4 D4/h |';

const VARIATION = 'C4/q C4 G4 G4 | A4 A4 G4/h | C4/e D4 C4 D4 G4 A4 G4 A4 | A4/e B4 A4 B4 G4/h |';

export const formUnit = unit('th-form', 'Form', 'The shape of a whole piece', 'Motifs, phrases and sections; binary, ternary, song forms, rondo, variations and sonata form; and the final exam.', [
  lesson(
    'th17-1',
    'Motifs and Phrases',
    'learn',
    'How small ideas grow into a tune',
    [
      explain(
        'The motif',
        `Most music grows from small ideas. A **motif** is the smallest one: a few notes with a recognisable rhythm and shape. The most famous of all opens Beethoven's Fifth Symphony: three short notes and a long one.

Composers develop a motif instead of throwing it away. Here Beethoven repeats it a step lower: the same shape, starting on a different note. That's a **sequence**.`,
        fig(FATE, { time: [2, 4], key: 'Cm', tempo: 108, labels: marks(8, { 0: 'Motif', 4: 'Sequence' }), keys: false }),
      ),
      explain(
        'The phrase',
        `A **phrase** is a musical sentence, often four bars long, ending with a cadence. Phrases often come in pairs: a **question** that ends unfinished (on the dominant), and an **answer** that ends at home.

Beethoven's *Ode to Joy* does exactly that. Here are the last two bars of each of its first two phrases. The first stops on D, part of the V chord: a question. The second lands on C: the answer.`,
        fig(ODE_ENDINGS, { time: [4, 4], key: 'C', tempo: 120, labels: marks(14, { 0: 'Question', 7: 'Answer' }), keys: false }),
      ),
      explore('Play with a motif', 'Play Beethoven’s motif, then move it.', [
        task('Play G G G E♭', C.melody('G', 'G', 'G', 'Eb')),
        task('Play it a step lower: F F F D', C.melody('F', 'F', 'F', 'D')),
        task('Make up a motif of your own and play it twice', C.any(8)),
      ]),
      quiz('Repetition, sequence or something new?', 'Compare the second bar with the first. The same notes? The same shape, moved? Or a new shape?', 'How does the second bar relate to the first?', phraseRounds(6)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th17-2',
    'Binary and Ternary Form',
    'learn',
    'AB and ABA',
    [
      explain(
        'Sections and letters',
        `Longer pieces join phrases into **sections**, and musicians label the sections with letters. A section that comes back is given its letter again; a new one gets the next letter.

**Binary form** is two sections, A and B, each usually repeated: AABB. Most dances of Bach's time, like the minuets in every beginner's book, are binary. The A section moves away from home, often to the dominant; the B section finds its way back.`,
        fig('[C3 E4 G4 C5]/w | [G2 D4 G4 B4]/w || [G2 D4 G4 B4]/w | [C3 E4 G4 C5]/w |', { time: [4, 4], key: 'C', labels: ['A: home', 'A ends on V', 'B: from V', 'B ends home'] }),
      ),
      explain(
        'Ternary form',
        `**Ternary form** is ABA: a section, a contrasting one, then the first again. The return is the point: after the contrast, the familiar music feels like coming home.

*Twinkle, Twinkle* is ABA in miniature. Here is how its A and B sections begin; after B, A comes back just as it began.`,
        fig(TWINKLE_AB, { time: [4, 4], key: 'C', tempo: 116, labels: marks(14, { 0: 'A', 7: 'B' }), keys: false }),
      ),
      explore('Play the sections', 'Play the start of each section of Twinkle, Twinkle.', [
        task('A: C C G G A A G', C.melody('C', 'C', 'G', 'G', 'A', 'A', 'G')),
        task('B: G G F F E E D', C.melody('G', 'G', 'F', 'F', 'E', 'E', 'D')),
        task('And A again: C C G G A A G', C.melody('C', 'C', 'G', 'G', 'A', 'A', 'G')),
      ]),
      quiz('Which form?', 'Read the plan of each piece.', 'Which form?', formRounds(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th17-3',
    'Song Form',
    'learn',
    'Verse, chorus, bridge, and the 12-bar blues',
    [
      explain(
        'Verse and chorus',
        `Most songs you know are in **verse–chorus** form. The **verses** tell the story, with new words each time over the same music. The **chorus** is the hook: the same words and music every time it comes round. A **bridge** brings something new once, usually after the second chorus, so the last chorus feels fresh. An **intro** and **outro** open and close.

Many older popular songs and jazz standards use **AABA** instead: a tune, the tune again, a contrasting bridge, then the tune once more, usually eight bars each.`,
      ),
      explain(
        'The 12-bar blues',
        `The **12-bar blues** is a form made of chords: twelve bars, repeated for every verse and every solo.

- Bars 1–4: **I**
- Bars 5–6: **IV**, bars 7–8: **I**
- Bar 9: **V**, bar 10: **IV**, bars 11–12: **I** (with a **V** in the last bar to lead round again)

Play it in any key by finding I, IV and V. Every chord is usually a dominant 7th, which is part of the blues' sound.`,
        fig('[C3 E4 G4 Bb4]/w | [F3 F4 A4 Eb5]/w | [C3 E4 G4 Bb4]/w | [G2 F4 B4 D5]/h [F3 F4 A4 Eb5]/h |', { time: [4, 4], key: 'C', labels: ['I (bars 1–4)', 'IV (5–6)', 'I (7–8)', 'V', 'IV'] }),
      ),
      explore('The three chords', 'The blues in C needs just three chords. Hold each one.', [
        task('I: C major (or C7)', C.chord(['maj', '7'], { root: 'C' })),
        task('IV: F major (or F7)', C.chord(['maj', '7'], { root: 'F' })),
        task('V: G major (or G7)', C.chord(['maj', '7'], { root: 'G' })),
      ]),
      build('Find the bar', 'Count through the twelve bars: I I I I, IV IV I I, V IV I V.', bluesBarBuild(4)),
      quiz('Song form', 'Check what you know about song forms.', 'Which is right?', [
        round('Which part of a song returns with the same words each time?', 'The chorus', ['The chorus', 'The verse', 'The bridge']),
        round('In AABA form, how many times is the A section heard?', 'Three', ['Three', 'Two', 'Four']),
        round('How many bars has one time round a 12-bar blues?', 'Twelve', ['Twelve', 'Eight', 'Sixteen']),
        round('In a 12-bar blues, which chord fills the first four bars?', 'I', ['I', 'IV', 'V']),
      ]),
    ],
    { key: 'C' },
  ),
  lesson(
    'th17-4',
    'Rondo and Variations',
    'learn',
    'A refrain that returns, a theme in new clothes',
    [
      explain(
        'Rondo',
        `A **rondo** is built on a **refrain**: a main section, A, that keeps coming back between contrasting episodes: A B A C A. The refrain is usually cheerful and catchy, and the fun is in waiting for it to return.

Many final movements of classical sonatas and concertos are rondos: Mozart and Haydn used it to send the audience home happy.`,
      ),
      explain(
        'Theme and variations',
        `In **theme and variations**, a tune is played plainly first, then again and again, each time changed: faster notes, a new rhythm, a minor key, a new harmony underneath, while the tune's outline stays recognisable.

Mozart wrote twelve variations on the French song we know as *Twinkle, Twinkle*. Here is the theme's opening, then a variation of our own that fills it with running eighth notes, keeping the main notes in place.`,
        fig(VARIATION, { time: [4, 4], key: 'C', tempo: 100, labels: marks(20, { 0: 'Theme', 7: 'Variation' }), keys: false }),
      ),
      explore('Vary a theme', 'Play the theme, then change it.', [
        task('Play the theme: C C G G A A G', C.melody('C', 'C', 'G', 'G', 'A', 'A', 'G')),
        task('Play the variation’s first bar: C D C D G A G A', C.melody('C', 'D', 'C', 'D', 'G', 'A', 'G', 'A')),
        task('Make up a variation of your own: keep C, G and A, add notes between them', C.any(10)),
      ]),
      quiz('Which form?', 'Read the plan of each piece.', 'Which form?', formRounds(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th17-5',
    'Sonata Form',
    'learn',
    'The great drama of classical music, in outline',
    [
      explain(
        'Three acts',
        `**Sonata form** shaped the first movements of most symphonies, sonatas and string quartets from Haydn to Brahms. It is a drama in three acts:

- **Exposition**: a first theme at home, then a second theme in a new key, usually the **dominant** (or the relative major, in a minor key).
- **Development**: the themes are taken apart and passed through many keys. This is where the tension builds.
- **Recapitulation**: both themes return, now **both in the home key**. The conflict is resolved.

A **coda** often rounds it off.`,
        fig('[C3 E4 G4 C5]/w | [G2 D4 G4 B4]/w | [A2 C4 E4 A4]/w | [C3 E4 G4 C5]/w |', { time: [4, 4], key: 'C', labels: ['Theme 1: I', 'Theme 2: V', 'Development', 'Recap: I'] }),
      ),
      explore('Two keys', 'The exposition sets two keys against each other. Hold each home chord.', [
        task('The home key: C major', C.chord('maj', { root: 'C' })),
        task('The second theme’s key: G major, the dominant', C.chord('maj', { root: 'G' })),
        task('In a minor-key sonata the second theme goes to the relative major: from A minor (A C E)…', C.chord('min', { root: 'A' })),
        task('…to C major', C.chord('maj', { root: 'C' })),
      ]),
      build('Where the second theme goes', 'In a major key, the exposition’s second theme is usually in the dominant. Play its V chord.', numeralBuildRounds({ keys: ['C', 'G', 'D', 'F', 'A'], degrees: [5], count: 3 })),
      quiz('Sonata form', 'Put the acts in order, and know where each theme lives.', 'Which is right?', [
        round('Which section of sonata form comes first?', 'Exposition', ['Exposition', 'Development', 'Recapitulation']),
        round('Where do the themes travel through many keys?', 'Development', ['Development', 'Exposition', 'Coda']),
        round('In the recapitulation, the second theme is in…', 'The home key', ['The home key', 'The dominant', 'The relative minor']),
        round('In a minor-key sonata, the exposition’s second theme is usually in…', 'The relative major', ['The relative major', 'The dominant minor', 'The parallel major']),
      ]),
    ],
    { key: 'C' },
  ),
  lesson(
    'th17-c',
    'Final Exam',
    'checkpoint',
    'Everything from the whole course, together',
    [
      explain(
        'The final exam',
        `This last checkpoint pulls the whole course together: intervals, keys, chords, Roman numerals, scales, cadences and form. Take your time, use the keyboard to try things before you answer, and good luck.`,
      ),
      quiz('Intervals', '', 'Which interval is this?', intervalRounds({ intervals: ['m3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'], from: ['C4', 'D4', 'E4', 'F4', 'G4'], count: 4 })),
      quiz('Keys', '', 'Which key?', keySignatureRounds({ keys: ['G', 'D', 'A', 'F', 'Bb', 'Eb', 'Em', 'Bm', 'Dm', 'Gm'], count: 3, ask: 'key' })),
      quiz('Chords', '', 'Which chord is this?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7'], roots: ['C4', 'D4', 'F3', 'G3', 'A3'], count: 4 })),
      quiz('Numerals', '', 'Which chord is this?', numeralRounds({ keys: ['C', 'G', 'F', 'D'], degrees: [1, 2, 4, 5, 6], count: 4 })),
      build('Play the chords of a key', '', numeralBuildRounds({ keys: ['C', 'G', 'F', 'D'], degrees: [1, 2, 4, 5, 6], count: 3 })),
      quiz('Cadences', '', 'Which cadence do you hear?', cadenceRounds(4), { mode: 'hear' }),
      quiz('Scales and form', '', 'Which is right?', rng => [...scaleRounds({ scales: ['major', 'natural-minor', 'harmonic-minor', 'dorian', 'mixolydian'], tonics: ['C4', 'D4', 'A3'], count: 2 })(rng), ...formRounds(2)(rng)]),
      drill('Intervals on the staff', 'Count the letters from the lower note to the upper, counting both.', interval('treble', 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5', [2, 3, 4, 5, 6, 7], 6)),
    ],
  ),
]);
