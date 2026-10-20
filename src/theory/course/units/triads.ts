/**
 * Unit 10: triads. Three notes stacked in 3rds: how the two 3rds make a chord major,
 * minor, diminished or augmented, how the same chord can stand on any of its notes
 * (inversions), and how lead sheets write it (C, Dm, B°, C/E).
 */
import type { Rng } from '../../../curriculum/generate';
import { chordQuality } from '../../../music/chords';
import { parseKey } from '../../../music/keys';
import { parsePitch, stepLabel } from '../../../music/pitch';
import { chordNotes, chordSymbolOf, diatonicChord, pitchText } from '../../theory';
import { C, build, chordBuildRounds, chordRounds, choices, draw, explain, explore, fig, lesson, pick, quiz, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const label = (n: string) => {
  const p = parsePitch(n);
  return stepLabel(p.step, p.alter);
};

const ROOTS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A3', 'Bb3'];
const WIDE_ROOTS = ['C4', 'D4', 'Eb4', 'E4', 'F4', 'G4', 'Ab3', 'A3', 'Bb3', 'B3'];

/** Hold the white-key triad on a letter: the 3rds come from the C major scale. */
function stackRounds(count: number) {
  const C_MAJOR = parseKey('C');
  return (rng: Rng): BuildRound[] =>
    draw(rng, [2, 3, 4, 5, 6, 7], count).map(d => {
      const c = diatonicChord(C_MAJOR, d);
      const notes = c.notes.map(pitchText);
      return {
        prompt: `Hold the triad on ${label(notes[0])}, white keys only: ${label(notes[0])}, a 3rd up, and a 3rd above that`,
        figure: fig(notes[0], { play: 'as-written' }),
        check: C.chordOf(...notes.map(n => n.replace(/-?\d$/, ''))),
        answer: notes,
        explain: `${notes.map(label).join(' ')}: ${chordSymbolOf(c.root, c.quality)}.`,
      };
    });
}

const SYMBOL_QUALITIES = ['maj', 'min', 'dim', 'aug'];

/** A triad on the staff: which symbol names it? Options share its root, so the quality decides. */
function symbolRounds(count: number, inversions = false) {
  return (rng: Rng): QuizRound[] =>
    Array.from({ length: count }, () => {
      const root = parsePitch(pick(rng, ROOTS));
      const q = pick(rng, inversions ? ['maj', 'min'] : SYMBOL_QUALITIES);
      const inv = inversions ? pick(rng, [0, 1, 1, 2]) : 0;
      const notes = chordNotes(root, q, inv);
      const bass = notes[0];
      const answer = chordSymbolOf(root, chordQuality(q)!, inv ? bass : undefined);
      const all = inversions
        ? [0, 1, 2].map(i => chordSymbolOf(root, chordQuality(q)!, i ? chordNotes(root, q, i)[0] : undefined))
        : SYMBOL_QUALITIES.map(x => chordSymbolOf(root, chordQuality(x)!));
      return {
        figure: fig(`[${notes.map(pitchText).join(' ')}]`, { play: 'apart-then-together' }),
        options: choices(rng, answer, all, 4, true),
        answer,
        explain: `${notes.map(n => label(pitchText(n))).join(' ')}: ${answer}${inv ? `, with ${label(pitchText(bass))} in the bass` : ''}.`,
      };
    });
}

/** Play a chord from its symbol: "Dm", "F/A", "B°". */
function symbolBuildRounds(count: number, opts: { qualities: string[]; slash?: boolean }) {
  return (rng: Rng): BuildRound[] =>
    Array.from({ length: count }, () => {
      const root = parsePitch(pick(rng, ROOTS));
      const q = pick(rng, opts.qualities);
      const inv = opts.slash ? pick(rng, [1, 2]) : 0;
      const notes = chordNotes(root, q, inv);
      const symbol = chordSymbolOf(root, chordQuality(q)!, inv ? notes[0] : undefined);
      return {
        prompt: `Play ${symbol}`,
        check: C.chord(q, { root: pitchText(root).replace(/-?\d$/, ''), ...(opts.slash ? { inversion: inv } : {}) }),
        answer: notes.map(pitchText),
        explain: `${symbol} is ${notes.map(n => label(pitchText(n))).join(' ')}${inv ? `: ${label(pitchText(notes[0]))} at the bottom` : ''}.`,
      };
    });
}

export const triadsUnit = unit('th-triads', 'Triads', 'Harmony begins', 'Three notes stacked in 3rds: major, minor, diminished, augmented, their inversions and their symbols.', [
  lesson(
    'th10-1',
    'Stacking Thirds',
    'learn',
    'Build a chord from a root, a 3rd and a 5th',
    [
      explain(
        'Three notes, two thirds',
        `A **chord** is notes sounding together. The most important chord in Western music is the **triad**: three notes stacked in 3rds.

Start on any note, the **root**. Add the note a 3rd above it (the **3rd**), then the note a 3rd above that (the **5th**, a 5th above the root). C, E and G: the C major triad.`,
        fig('C4 E4 G4 [C4 E4 G4]', { play: 'as-written', labels: ['Root', '3rd', '5th', 'C major'] }),
      ),
      explain(
        'Snowmen on the staff',
        `On the staff a triad in this shape is easy to spot: three notes on **three lines** or in **three spaces**, stacked like a snowman. Skip a letter, take a letter, skip a letter: C (D) E (F) G.

Every letter can be a root: D F A, E G B, F A C… Using only white keys, you get a triad on every note of the scale.`,
        fig('[C4 E4 G4] [D4 F4 A4] [E4 G4 B4] [F4 A4 C5] [G4 B4 D5]', { play: 'as-written', labels: ['C E G', 'D F A', 'E G B', 'F A C', 'G B D'] }),
      ),
      explore('Build some', 'Hold the notes down together. The staff above names what you hold.', [
        task('Hold C, E and G together', C.chordOf('C', 'E', 'G')),
        task('Hold F, A and C together', C.chordOf('F', 'A', 'C')),
        task('Pick any white key and stack two 3rds on it', C.chord(['maj', 'min', 'dim'])),
      ]),
      build('Stack the thirds', 'Skip a white key, take one, skip one, take one.', stackRounds(5)),
    ],
    { topics: ['chords'] },
  ),
  lesson(
    'th10-2',
    'Major and Minor',
    'learn',
    'The 3rd decides the colour',
    [
      explain(
        'Two kinds of 3rd',
        `Not all 3rds are the same size. A **major 3rd** is four semitones (C up to E); a **minor 3rd** is three (C up to E♭).

A triad is two 3rds stacked. Put the major 3rd at the bottom and the minor 3rd on top, and you have a **major** triad: bright. Swap them, minor at the bottom, and it's a **minor** triad: darker. Only the middle note moves.`,
        fig('[C4 E4 G4] [C4 Eb4 G4]', { play: 'as-written', labels: ['C major', 'C minor'] }),
      ),
      explore('Change the colour', 'Hold a major triad, then lower its middle note by one semitone. Listen to the light change.', [
        task('Hold C major: C, E, G', C.chord('maj', { root: 'C' })),
        task('Now C minor: C, E♭, G', C.chord('min', { root: 'C' })),
        task('Hold A minor: A, C, E (all white keys)', C.chord('min', { root: 'A' })),
        task('Hold D major: D, F♯, A', C.chord('maj', { root: 'D' })),
      ]),
      quiz('Major or minor?', 'Look at the middle note: four semitones above the root (major) or three (minor)? Then listen.', 'Major or minor?', chordRounds({ qualities: ['maj', 'min'], roots: ROOTS, count: 8 })),
      build('Play them', 'Count semitones from the root: 4 then 3 for major, 3 then 4 for minor.', chordBuildRounds({ qualities: ['maj', 'min'], roots: ROOTS, count: 6 })),
      quiz('By ear', 'Now without looking.', 'Major or minor?', chordRounds({ qualities: ['maj', 'min'], roots: ROOTS, count: 6 }), { mode: 'hear' }),
    ],
    { topics: ['chord:minor'] },
  ),
  lesson('th10-3', 'Diminished and Augmented', 'learn', 'Two minor 3rds, or two major ones', [
    explain(
      'Two more colours',
      `Stack two **minor** 3rds and you get a **diminished** triad: B D F. Its 5th is a semitone short (a diminished 5th, the tritone), which makes it tense and restless.

Stack two **major** 3rds and you get an **augmented** triad: C E G♯. Its 5th is a semitone too wide. It floats, unresolved, like a question.`,
      fig('[B3 D4 F4] [C4 E4 G#4]', { play: 'as-written', labels: ['B diminished', 'C augmented'] }),
    ),
    explain(
      'All four, side by side',
      `With the root and the bottom 3rd you can name any triad:

- **Major**: major 3rd + minor 3rd (4 + 3 semitones).
- **Minor**: minor 3rd + major 3rd (3 + 4).
- **Diminished**: minor + minor (3 + 3).
- **Augmented**: major + major (4 + 4).

Major and minor triads have a perfect 5th from root to top; diminished and augmented don't, and that's why they sound unsettled.`,
      fig('[C4 E4 G4] [C4 Eb4 G4] [C4 Eb4 Gb4] [C4 E4 G#4]', { play: 'as-written', labels: ['Major', 'Minor', 'Diminished', 'Augmented'] }),
    ),
    quiz('Name the triad', 'Count the semitones in each 3rd, then listen.', 'Which kind of triad?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug'], roots: ROOTS, count: 8 })),
    build('Play them', 'Diminished: 3 + 3 semitones. Augmented: 4 + 4.', chordBuildRounds({ qualities: ['dim', 'aug'], roots: ['C4', 'D4', 'E4', 'F4', 'G4', 'A3'], count: 6 })),
    quiz('By ear', 'Major, minor, diminished or augmented? Bright, dark, tight or floating.', 'Which kind of triad?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug'], roots: ROOTS, count: 6 }), { mode: 'hear' }),
  ]),
  lesson('th10-4', 'Inversions', 'learn', 'The same chord, standing on a different note', [
    explain(
      'Turning a chord over',
      `Take C E G and move the C up an octave: E G C. Same three notes, still a C major chord, but now E is at the bottom. That's an **inversion**.

- **Root position**: the root at the bottom (C E G).
- **First inversion**: the 3rd at the bottom (E G C).
- **Second inversion**: the 5th at the bottom (G C E).

The chord's name doesn't change; what changes is its **bass note**, the lowest one.`,
      fig('[C4 E4 G4] [E4 G4 C5] [G4 C5 E5]', { play: 'as-written', labels: ['Root position', 'First inversion', 'Second inversion'] }),
    ),
    explain(
      'What the bass does',
      `The bass note colours the whole chord. Root position sounds solid, like standing on both feet. First inversion is lighter and wants to move on. Second inversion is the least stable: it usually leans on to another chord.

Inversions also let chords connect smoothly: from C (C E G) to F, you can keep C and move just two notes up a step (C F A). Keyboard players and arrangers do this all the time.`,
      fig('[C4 E4 G4] [C4 F4 A4] [B3 D4 G4] [C4 E4 G4]', { play: 'as-written', labels: ['C', 'F/C', 'G/B', 'C'] }),
    ),
    explore('Try them', 'Hold each one. The readout above tells you which inversion you have.', [
      task('Hold C major in first inversion (E at the bottom)', C.chord('maj', { root: 'C', inversion: 1 })),
      task('Hold C major in second inversion (G at the bottom)', C.chord('maj', { root: 'C', inversion: 2 })),
      task('Hold A minor with C at the bottom', C.chord('min', { root: 'A', inversion: 1 })),
    ]),
    quiz('Which inversion?', 'Find the root first (stack the notes in 3rds in your head), then see which note is at the bottom.', 'Root position, first or second inversion?', chordRounds({ qualities: ['maj', 'min'], roots: ROOTS, count: 8, ask: 'inversion' })),
    build('Play them', 'Find the chord, then decide which note goes at the bottom.', rng => [...chordBuildRounds({ qualities: ['maj', 'min'], roots: ROOTS, count: 3, inversion: 1 })(rng), ...chordBuildRounds({ qualities: ['maj'], roots: ROOTS, count: 2, inversion: 2 })(rng)]),
  ]),
  lesson('th10-5', 'Chord Symbols', 'learn', 'Read C, Dm, B° and C/E on a lead sheet', [
    explain(
      'Chords in letters',
      `Pop, jazz and folk songs write their chords as **symbols** above the tune. A guitarist, a pianist and a bassist all read the same symbol and play it their own way.

- A letter alone is **major**: C.
- Add **m** for **minor**: Cm.
- **°** (or dim) for **diminished**: C°.
- **+** (or aug) for **augmented**: C+.`,
      fig('[C4 E4 G4] [C4 Eb4 G4] [C4 Eb4 Gb4] [C4 E4 G#4]', { play: 'as-written', labels: ['C', 'Cm', 'C°', 'C+'] }),
    ),
    explain(
      'Slash chords',
      `When a song wants a particular bass note, it adds it after a slash. **C/E** means "C major, with E in the bass": the first inversion. **C/G** is the second inversion.

Slash chords make bass lines walk smoothly: C – C/B – Am – Am/G is a bass line stepping down while the chords change above it.`,
      fig('[C4 E4 G4] [E3 G3 C4] [G3 C4 E4]', { play: 'as-written', labels: ['C', 'C/E', 'C/G'] }),
    ),
    quiz('Name the chord', 'Which symbol is this?', 'Which chord symbol?', symbolRounds(8)),
    build('Read and play', 'Play each chord from its symbol.', symbolBuildRounds(5, { qualities: ['maj', 'min', 'dim'] })),
    quiz('Slash chords', 'Which note is at the bottom?', 'Which chord symbol?', symbolRounds(6, true)),
  ]),
  lesson('th10-c', 'Checkpoint: Triads', 'checkpoint', 'Name, build and read triads', [
    quiz('Name the triad', '', 'Which kind of triad?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug'], roots: WIDE_ROOTS, count: 6 })),
    quiz('Inversions', '', 'Root position, first or second inversion?', chordRounds({ qualities: ['maj', 'min'], roots: ROOTS, count: 4, ask: 'inversion' })),
    build('Play from the symbol', '', rng => [...symbolBuildRounds(3, { qualities: ['maj', 'min', 'dim'] })(rng), ...symbolBuildRounds(2, { qualities: ['maj', 'min'], slash: true })(rng)]),
    quiz('By ear', '', 'Which kind of triad?', chordRounds({ qualities: ['maj', 'min', 'dim', 'aug'], roots: ROOTS, count: 4 }), { mode: 'hear' }),
  ]),
]);
