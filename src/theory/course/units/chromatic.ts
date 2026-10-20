/**
 * Unit 16: chromatic harmony. Chords from outside the key that still belong to it:
 * secondary dominants, chords borrowed from the parallel minor, the chords that carry a
 * piece into a new key, extended chords (9ths, 11ths, 13ths), and a first taste of the
 * Neapolitan and the augmented sixth.
 */
import type { Rng } from '../../../curriculum/generate';
import { parseKey } from '../../../music/keys';
import { parsePitch, stepLabel } from '../../../music/pitch';
import { chordNotes, pitchText, tonicPitch, transpose } from '../../theory';
import { C, build, choices, chordBuildRounds, chordRounds, draw, explain, explore, fig, lesson, pick, quiz, round, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const label = (n: string) => {
  const p = parsePitch(n);
  return stepLabel(p.step, p.alter);
};
const noteName = (p: { step: string; alter: number }) => stepLabel(p.step as never, p.alter);
const keyLabel = (k: string) => {
  const key = parseKey(k);
  const t = tonicPitch(key);
  return `${noteName(t)} ${key.mode}`;
};
const chordText = (notes: { step: string; alter: number; octave: number }[]) => `[${notes.map(n => pitchText(n as never)).join(' ')}]`;

/** Secondary dominants in a key: the dominant 7th a perfect 5th above each target chord. */
const SECONDARY: [key: string, target: string, numeral: string, targetName: string][] = [
  ['C', 'D', 'V⁷/ii', 'D minor'],
  ['C', 'E', 'V⁷/iii', 'E minor'],
  ['C', 'F', 'V⁷/IV', 'F major'],
  ['C', 'G', 'V⁷/V', 'G major'],
  ['C', 'A', 'V⁷/vi', 'A minor'],
  ['G', 'A', 'V⁷/ii', 'A minor'],
  ['G', 'C', 'V⁷/IV', 'C major'],
  ['G', 'D', 'V⁷/V', 'D major'],
  ['G', 'E', 'V⁷/vi', 'E minor'],
];

/** "Play V7/V in C major." The root is a perfect 5th above the chord it leads to. */
function secondaryBuild(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, SECONDARY, count).map(([k, target, numeral, targetName]) => {
      // the 7th chord's root a 5th above the target (A3 to E4: the middle of the keyboard)
      const root = transpose(parsePitch(`${target}3`), 'P5');
      const notes = chordNotes(root, '7').map(pitchText);
      return {
        prompt: `In ${keyLabel(k)}, play ${numeral}: the dominant 7th that leads to ${targetName}`,
        figure: fig(chordText(chordNotes(parsePitch(`${target}4`), targetName.endsWith('minor') ? 'min' : 'maj')), { key: k, play: 'together' }),
        check: C.chord('7', { root: pitchText(root).replace(/\d$/, '') }),
        answer: notes,
        explain: `${noteName(root)}7 (${notes.map(label).join(' ')}) is the dominant of ${targetName}.`,
      };
    });
}

/** Which chord does this secondary dominant lead to? */
function secondaryQuiz(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, SECONDARY, count).map(([k, target, numeral, targetName]) => {
      const root = transpose(parsePitch(`${target}4`), 'P5');
      const all = SECONDARY.filter(s => s[0] === k).map(s => s[3]);
      return {
        prompt: `In ${keyLabel(k)}, ${noteName(root)}7 leads most naturally to which chord?`,
        figure: fig(chordText(chordNotes(transpose(root, 'P8', true), '7')), { key: k, play: 'together' }),
        options: choices(rng, targetName, all, 4),
        answer: targetName,
        explain: `${noteName(root)}7 is ${numeral}: its root is a 5th above ${targetName.split(' ')[0]}, and its leading note pulls up to it.`,
      };
    });
}

/** Ear: did the progression go through a plain ii or the secondary dominant V7/V? */
function secondaryHear(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['plain', 'secondary'], count).map(kind => {
      const t = parsePitch(pick(rng, ['C4', 'D4', 'F4']));
      const I = chordNotes(t, 'maj');
      const two = kind === 'plain' ? chordNotes(transpose(t, 'M2'), 'min') : chordNotes(transpose(t, 'M2'), '7');
      const V = chordNotes(transpose(t, 'P4', true), '7');
      const text = `${chordText(I)}/h ${chordText(two)}/h | ${chordText(V)}/h ${chordText(I)}/h |`;
      return {
        figure: fig(text, { time: [4, 4], play: 'as-written', tempo: 80 }),
        options: ['ii (minor)', 'V⁷/V (major, with a 7th)'],
        answer: kind === 'plain' ? 'ii (minor)' : 'V⁷/V (major, with a 7th)',
        explain: kind === 'plain' ? 'A plain ii: the chord on the 2nd degree is minor.' : `The 2nd chord was ${noteName(transpose(t, 'M2'))}7: its raised 3rd leads up to the dominant.`,
      };
    });
}

/** Ear: IV or the borrowed minor iv? */
function borrowedHear(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['IV', 'iv'], count).map(kind => {
      const t = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G3']));
      const I = chordNotes(t, 'maj');
      const four = chordNotes(transpose(t, 'P4'), kind === 'IV' ? 'maj' : 'min');
      return {
        figure: fig(`${chordText(I)}/h ${chordText(four)}/h | ${chordText(I)}/w |`, { time: [4, 4], play: 'as-written', tempo: 76 }),
        options: ['IV (major)', 'iv (minor, borrowed)'],
        answer: kind === 'IV' ? 'IV (major)' : 'iv (minor, borrowed)',
        explain: kind === 'IV' ? 'The ordinary IV: major, as the key gives it.' : 'The iv was minor: its 3rd is borrowed from the parallel minor key.',
      };
    });
}

/** Play a chord borrowed from the parallel minor: iv, ♭VI or ♭VII. */
function borrowedBuild(count: number) {
  const kinds: [string, string, string][] = [
    ['iv', 'P4', 'min'],
    ['♭VI', 'm6', 'maj'],
    ['♭VII', 'm7', 'maj'],
  ];
  return (rng: Rng): BuildRound[] =>
    draw(rng, kinds, count).map(([numeral, iv, q]) => {
      const k = pick(rng, ['C', 'G', 'D', 'F']);
      const root = transpose(tonicPitch(parseKey(k), 3), iv);
      const notes = chordNotes(root, q).map(pitchText);
      return {
        prompt: `In ${keyLabel(k)}, play the borrowed ${numeral} chord`,
        figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
        check: C.chord(q, { root: pitchText(root).replace(/\d$/, '') }),
        answer: notes,
        explain: `${numeral} in ${keyLabel(k)} is ${noteName(root)} ${q === 'min' ? 'minor' : 'major'}: ${notes.map(label).join(' ')}, borrowed from ${noteName(tonicPitch(parseKey(k)))} minor.`,
      };
    });
}

/** Modulating to a closely related key: play the new key's V7. */
const MODULATIONS: [from: string, to: string][] = [
  ['C', 'G'],
  ['C', 'F'],
  ['G', 'D'],
  ['F', 'C'],
  ['C', 'Am'],
  ['G', 'Em'],
  ['D', 'A'],
  ['F', 'Dm'],
];

function modulationBuild(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, MODULATIONS, count).map(([from, to]) => {
      let root = transpose(tonicPitch(parseKey(to), 3), 'P5');
      if (root.octave >= 4 && root.step !== 'C' && root.step !== 'D') root = transpose(root, 'P8', true);
      const notes = chordNotes(root, '7').map(pitchText);
      return {
        prompt: `The music moves from ${keyLabel(from)} to ${keyLabel(to)}. Play the V⁷ of the new key`,
        figure: { notes: 'r/w', key: to, keys: false, play: 'none' },
        check: C.chord('7', { root: pitchText(root).replace(/\d$/, '') }),
        answer: notes,
        explain: `The V⁷ of ${keyLabel(to)} is ${noteName(root)}7: ${notes.map(label).join(' ')}.`,
      };
    });
}

const RELATED: Record<string, { near: string[]; far: string[] }> = {
  C: { near: ['G major', 'F major', 'A minor', 'E minor', 'D minor'], far: ['E major', 'A♭ major', 'D♭ major', 'B major', 'F♯ major'] },
  G: { near: ['D major', 'C major', 'E minor', 'B minor', 'A minor'], far: ['B♭ major', 'E♭ major', 'F minor', 'A♭ major', 'C♯ major'] },
  F: { near: ['C major', 'B♭ major', 'D minor', 'A minor', 'G minor'], far: ['E major', 'A major', 'B minor', 'F♯ minor', 'D♭ major'] },
};

function relatedRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['C', 'G', 'F'], count).map(k => {
      const answer = pick(rng, RELATED[k].near);
      const options = [answer, ...draw(rng, RELATED[k].far, 6).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3)];
      return {
        prompt: `Which key is closely related to ${keyLabel(k)}?`,
        options: choices(rng, answer, options, 4),
        answer,
        explain: `Closely related keys differ by at most one sharp or flat: their scales share all but one note.`,
      };
    });
}

/** The Neapolitan: a major chord on the flattened 2nd, in first inversion (minor keys). */
function neapolitanBuild(count: number) {
  const keys: [string, string][] = [
    ['Am', 'Bb3'],
    ['Dm', 'Eb4'],
    ['Em', 'F3'],
    ['Cm', 'Db4'],
    ['Gm', 'Ab3'],
  ];
  return (rng: Rng): BuildRound[] =>
    draw(rng, keys, count).map(([k, r]) => {
      const root = parsePitch(r);
      const notes = chordNotes(root, 'maj', 1).map(pitchText);
      return {
        prompt: `In ${keyLabel(k)}, play the Neapolitan sixth: a major chord on the ♭2, with its 3rd in the bass`,
        figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
        check: C.chord('maj', { root: r.replace(/\d$/, ''), inversion: 1 }),
        answer: notes,
        explain: `The ♭2 of ${keyLabel(k)} is ${label(r)}; ${label(r)} major in first inversion is ${notes.map(label).join(' ')}.`,
      };
    });
}

export const chromaticUnit = unit('th-chromatic', 'Chromatic Harmony', 'Colour from outside the key', 'Secondary dominants, borrowed chords, changing key, extended chords, and two famous chords from the classical era.', [
  lesson(
    'th16-1',
    'Secondary Dominants',
    'learn',
    'The dominant of the dominant, and its cousins',
    [
      explain(
        'A dominant for any chord',
        `The V⁷ chord pulls hard towards I. Any major or minor chord in a key can borrow that pull for a moment: put in front of it the dominant 7th a perfect 5th above it, and it sounds like a little home of its own.

These are **secondary dominants**. The commonest is the **dominant of the dominant**, written **V⁷/V** ("five of five"): in C major, D7 leading to G. Its F♯ isn't in C major: that accidental is the giveaway.`,
        fig('[C3 E4 G4 C5] [D3 F#4 A4 C5] [G2 F4 B4 D5] [C3 E4 G4 C5]', { key: 'C', labels: ['I', 'V⁷/V', 'V⁷', 'I'] }),
      ),
      explain(
        'Five of six',
        `The same trick leads into the minor chords. **V⁷/vi** in C major is E7, leading to A minor; its G♯ is the leading note of A minor.

Composers love it because it surprises without leaving the key: you hear a moment of A minor, then the music carries on in C.`,
        fig('[C3 E4 G4 C5] [E3 D4 G#4 B4] [A2 C4 E4 A4]', { key: 'C', labels: ['I', 'V⁷/vi', 'vi'] }),
      ),
      explore('Try them', 'Hold each chord, then the one it leads to. Listen to the pull.', [
        task('Hold D7: D F♯ A C', C.chord('7', { root: 'D' })),
        task('Then G7: G B D F', C.chord('7', { root: 'G' })),
        task('Hold E7: E G♯ B D', C.chord('7', { root: 'E' })),
        task('Then A minor: A C E', C.chord('min', { root: 'A' })),
      ]),
      quiz('Where does it lead?', 'A secondary dominant leads to the chord a perfect 5th below its root.', 'Where does it lead?', secondaryQuiz(5)),
      quiz('ii or V⁷/V?', 'Two progressions to G (or to the dominant of another key). Is the second chord the plain minor ii, or the secondary dominant?', 'Which did you hear?', secondaryHear(5), { mode: 'hear' }),
      build('Play secondary dominants', 'Find the chord it leads to, go up a perfect 5th, and build a dominant 7th there.', secondaryBuild(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th16-2',
    'Borrowed Chords',
    'learn',
    'A touch of minor in a major key',
    [
      explain(
        'Borrowing from the parallel minor',
        `C major and C minor share their home note. Music in C major can **borrow** chords from C minor for a moment, a trick called **modal mixture**.

The favourite is the **minor iv**: in C major the IV chord is F major (F A C); borrow F minor (F A♭ C) and the music turns bittersweet for a beat. It's in countless film scores and pop ballads.`,
        fig('[C3 E4 G4 C5] [F3 F4 A4 C5] [F3 F4 Ab4 C5] [C3 E4 G4 C5]', { key: 'C', labels: ['I', 'IV', 'iv', 'I'] }),
      ),
      explain(
        '♭VI and ♭VII',
        `Two more borrowings are everywhere in rock and film music: **♭VI** and **♭VII**, the major chords on the flattened 6th and 7th. In C major that's A♭ major and B♭ major.

Played ♭VI – ♭VII – I, they climb to the tonic like a hero arriving: a big, bright ending made from minor-key chords.`,
        fig('[Ab2 Eb4 Ab4 C5] [Bb2 D4 F4 Bb4] [C3 E4 G4 C5]', { key: 'C', labels: ['♭VI', '♭VII', 'I'] }),
      ),
      explore('Try them', 'In C major, play the borrowed chords and listen to the change of light.', [
        task('Hold F minor (the borrowed iv): F A♭ C', C.chord('min', { root: 'F' })),
        task('Hold A♭ major (♭VI): A♭ C E♭', C.chord('maj', { root: 'Ab' })),
        task('Hold B♭ major (♭VII): B♭ D F', C.chord('maj', { root: 'Bb' })),
        task('And home: C major', C.chord('maj', { root: 'C' })),
      ]),
      quiz('IV or iv?', 'Tonic, then the chord on the 4th degree, then tonic again. Was the middle chord major, or the borrowed minor?', 'Which did you hear?', borrowedHear(6), { mode: 'hear' }),
      build('Play borrowed chords', 'iv is minor on the 4th degree; ♭VI and ♭VII are major, a semitone lower than the key’s own 6th and 7th.', borrowedBuild(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th16-3',
    'Changing Key',
    'learn',
    'Modulation and the pivot chord',
    [
      explain(
        'Moving home',
        `A piece that stays in one key all the way through can feel static. **Modulation** is moving to a new key: the new home's leading note appears as an accidental, and a cadence in the new key confirms the move.

The easiest moves are to **closely related keys**: the ones next door on the circle of fifths, and their relative minors. From C major: G major, F major, A minor, E minor and D minor. Their scales share all but one note with C major, so the move is smooth.`,
        fig('C4/q D4 E4 F4 G4 A4 B4 C5 | G4/q A4 B4 C5 D5 E5 F#5 G5', { time: [4, 4], play: 'as-written', tempo: 120, keys: false }),
      ),
      explain(
        'The pivot chord',
        `The smoothest way across is a **pivot chord**: a chord that belongs to both keys. A minor is vi in C major and ii in G major. Arrive on it in C, then treat it as ii in G: ii – V⁷ – I, and you're home in G.

Listen to the F♯ in the D7: once it appears, the ear accepts the new home.`,
        fig('[C3 E4 G4 C5] [A2 E4 A4 C5] [D3 F#4 A4 C5] [G2 D4 G4 B4]', { key: 'C', labels: ['I', 'vi = ii', 'V⁷ of G', 'I of G'] }),
      ),
      explore('Walk across', 'Play the progression from C major to G major, one chord at a time.', [
        task('C major (I in C)', C.chord('maj', { root: 'C' })),
        task('A minor (vi in C, ii in G): the pivot', C.chord('min', { root: 'A' })),
        task('D7 (V⁷ in G)', C.chord('7', { root: 'D' })),
        task('G major: the new home', C.chord('maj', { root: 'G' })),
      ]),
      quiz('Closely related keys', 'Neighbours on the circle of fifths, and the relative minors of the key and its neighbours.', 'Which is closely related?', relatedRounds(5)),
      build('Lead into the new key', 'The V⁷ of the new key is the clearest way to announce it.', modulationBuild(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th16-4',
    'Extended Chords',
    'learn',
    'Ninths, elevenths and thirteenths',
    [
      explain(
        'Keep stacking thirds',
        `A triad is three notes in thirds; a 7th chord adds a fourth. Keep stacking thirds and you reach the **9th**, the **11th** and the **13th**: the notes of the scale an octave up, coloured by the chord beneath.

These **extended chords** are the everyday sound of jazz, soul and gospel. A dominant 9th (G B D F A) is a G7 with the A on top; it sounds richer and warmer than plain G7.`,
        fig('[G3 B3 D4 F4] [G3 B3 D4 F4 A4] [G2 F3 B3 E4]', { labels: ['G7', 'G9', 'G13'] }),
      ),
      explain(
        'Leaving notes out',
        `A full 13th chord would have seven notes, more than anyone wants to play or hear at once. So players leave notes out: usually the 5th (it adds little), and the 11th on dominant chords (it clashes with the 3rd).

A G13 is often just G, F, B and E: the root, the 7th, the 3rd and the 13th. The 3rd and 7th say what kind of chord it is; the 13th adds the colour.`,
        fig('[G2 F3 B3 E4]', { labels: ['G13'], play: 'apart-then-together' }),
      ),
      explore('Try them', 'Build each chord up from C, a third at a time.', [
        task('Hold a dominant 9th: C E G B♭ D', C.chord('9', { root: 'C' })),
        task('Hold a major 9th: C E G B D', C.chord('maj9', { root: 'C' })),
        task('Hold a minor 9th: C E♭ G B♭ D', C.chord('m9', { root: 'C' })),
        task('Hold a C13 without its 11th: C E G B♭ D A', C.chordOf('C', 'E', 'G', 'Bb', 'D', 'A')),
      ]),
      quiz('Which chord?', 'Listen to each note, then all of them together. Is the 7th major or minor, and is there a 9th on top?', 'Which chord is this?', chordRounds({ qualities: ['7', '9', 'maj9', 'm9'], roots: ['C4', 'F3', 'G3', 'D4'], count: 5 })),
      build('Play 9th chords', 'A 7th chord with a note a 3rd above its 7th (a major 9th above the root).', chordBuildRounds({ qualities: ['9', 'maj9', 'm9'], roots: ['C4', 'F3', 'G3', 'D4', 'A3'], count: 4 })),
    ],
  ),
  lesson(
    'th16-5',
    'Two Famous Chords',
    'learn',
    'The Neapolitan and the augmented sixth',
    [
      explain(
        'The Neapolitan',
        `Classical composers had two favourite ways to darken the approach to the dominant in a minor key. The first is the **Neapolitan sixth** (written N⁶): a major chord on the **flattened 2nd**, usually with its 3rd in the bass.

In A minor that's B♭ major, as D F B♭. Its B♭ falls a semitone to A, and towards the dominant's G♯: a sound of deep sorrow, used by Mozart and Beethoven alike.`,
        fig('[D3 D4 F4 A4] [D3 D4 F4 Bb4] [E3 E4 G#4 B4] [A2 E4 A4 C5]', { key: 'Am', labels: ['iv', 'N⁶', 'V', 'i'] }),
      ),
      explain(
        'The augmented sixth',
        `The second is the **augmented sixth** chord. In A minor its outer notes are F and D♯: an augmented 6th apart. Each is a semitone from E, so they spread outwards, F down and D♯ up, onto an octave of E: the dominant.

There are three kinds, named (for no good reason) after countries: the **Italian** (F A D♯), the **French** (F A B D♯) and the **German** (F A C D♯). The German one sounds exactly like a dominant 7th, until it resolves.`,
        fig('[F3 A3 D#4] [E3 G#3 B3 E4]', { key: 'Am', labels: ['It⁺⁶', 'V'] }),
      ),
      explore('Try them', 'In A minor. Play each chord, then where it goes.', [
        task('Hold the Neapolitan: B♭ major with D in the bass (D F B♭)', C.chord('maj', { root: 'Bb', inversion: 1 })),
        task('Hold F and D♯ together: an augmented 6th', C.interval(10, { from: 'F', together: true })),
        task('Spread them outwards onto an octave of E', C.interval(12, { from: 'E', together: true })),
      ]),
      build('Play Neapolitans', 'The major chord on the ♭2 of the key, with its 3rd at the bottom.', neapolitanBuild(3)),
      quiz('What do they do?', 'Both chords lead to the same place.', 'Which is right?', [
        round('Where do the Neapolitan and the augmented sixth usually lead?', 'To the dominant (V)', ['To the dominant (V)', 'To the tonic (i)', 'To the subdominant (iv)']),
        round('The Neapolitan is a major chord on which degree?', 'The flattened 2nd', ['The flattened 2nd', 'The 4th', 'The flattened 6th']),
        round('Which augmented sixth sounds like a dominant 7th?', 'The German', ['The German', 'The Italian', 'The French']),
        round('In A minor, the augmented sixth’s outer notes F and D♯ resolve to…', 'An octave of E', ['An octave of E', 'An octave of A', 'A unison G']),
      ]),
    ],
    { key: 'Am' },
  ),
  lesson(
    'th16-c',
    'Checkpoint: Chromatic Harmony',
    'checkpoint',
    'Secondary dominants, borrowing, modulation and extended chords',
    [
      build('Secondary dominants', '', secondaryBuild(3)),
      quiz('Borrowed or not?', '', 'Which did you hear?', borrowedHear(4), { mode: 'hear' }),
      quiz('Extended chords', '', 'Which chord is this?', chordRounds({ qualities: ['7', '9', 'maj9', 'm9'], roots: ['C4', 'F3', 'G3'], count: 3 })),
      build('Change key', '', rng => [...modulationBuild(2)(rng), ...borrowedBuild(1)(rng)]),
      quiz('Facts', '', 'Which is right?', rng => [
        ...secondaryQuiz(2)(rng),
        ...relatedRounds(2)(rng),
        round('What is a pivot chord?', 'A chord in both the old key and the new one', ['A chord in both the old key and the new one', 'The last chord of a piece', 'A chord with no 3rd']),
      ]),
    ],
  ),
]);
