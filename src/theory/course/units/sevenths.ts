/**
 * Unit 12: seventh chords. One more third on top of a triad: the five common sevenths
 * (major 7th, dominant 7th, minor 7th, half-diminished, diminished), the sevenths a key
 * makes on each of its degrees, the dominant 7th's tritone and the way it resolves, and
 * telling them apart by ear.
 *
 * A seventh chord turned upside down can read as another chord (C E♭ G B♭ with E♭ at the
 * bottom is also E♭6), so the "play it" rounds ask for the root at the bottom.
 */
import { interval as intervalDrill } from '../../../curriculum/builders';
import type { Rng } from '../../../curriculum/generate';
import { chordQuality } from '../../../music/chords';
import { parseKey } from '../../../music/keys';
import { type Pitch, parsePitch, stepLabel } from '../../../music/pitch';
import { chordNotes, chordSymbolOf, diatonicChord, pitchText, tonicPitch, withArticle } from '../../theory';
import { C, build, choices, draw, drill, explain, explore, fig, lesson, numeralRounds, pick, qualityLabel, quiz, round, task, unit } from '../build';
import type { BuildRound, QuizRound } from '../types';

const SEVENTHS = ['maj7', '7', 'm7', 'm7b5', 'dim7'];

/** Roots that spell each quality without double sharps or flats. */
const ROOTS: Record<string, string[]> = {
  maj7: ['C4', 'D4', 'F4', 'G4', 'Bb3', 'Eb4', 'A3'],
  '7': ['C4', 'D4', 'E4', 'F4', 'G3', 'A3', 'Bb3'],
  m7: ['C4', 'D4', 'E4', 'G3', 'A3', 'B3', 'F#3'],
  m7b5: ['B3', 'E4', 'F#3', 'C#4', 'A3', 'D4', 'G#3'],
  dim7: ['B3', 'C#4', 'F#3', 'G#3', 'D#4', 'E4', 'A#3'],
};

const name = (p: Pitch) => stepLabel(p.step, p.alter);
/** A note name for a check: any octave ("Bb"). */
const spec = (p: Pitch) => pitchText(p).replace(/-?\d$/, '');
const symbol = (root: Pitch, q: string) => chordSymbolOf(root, chordQuality(q)!);

/** Name a seventh chord's quality, seen or heard. */
function seventhRounds(o: { qualities: string[]; count: number; prompt?: string }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.qualities, o.count).map(q => {
      const root = parsePitch(pick(rng, ROOTS[q]));
      const notes = chordNotes(root, q);
      const answer = qualityLabel(q);
      return {
        prompt: o.prompt,
        figure: fig(`[${notes.map(pitchText).join(' ')}]`, { play: 'apart-then-together' }),
        options: choices(rng, answer, o.qualities.map(qualityLabel), 5, true),
        answer,
        explain: `${symbol(root, q)}: ${notes.map(name).join(' ')}.`,
      };
    });
}

/** Play a seventh chord from its symbol, root at the bottom. */
function seventhBuildRounds(o: { qualities: string[]; count: number }) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, o.qualities, o.count).map(q => {
      const root = parsePitch(pick(rng, ROOTS[q]));
      const notes = chordNotes(root, q).map(pitchText);
      return {
        prompt: `Play ${symbol(root, q)}, with ${name(root)} at the bottom`,
        check: C.chord(q, { root: spec(root), inversion: 0 }),
        answer: notes,
        explain: `${symbol(root, q)} is ${notes.map(n => name(parsePitch(n))).join(' ')}: ${withArticle(qualityLabel(q).toLowerCase())}.`,
      };
    });
}

/** Triad or seventh chord? */
function triadOrSeventhRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['maj', 'min', 'maj7', '7', 'm7'], count).map(q => {
      const root = parsePitch(pick(rng, ['C4', 'D4', 'F4', 'G3', 'A3']));
      const notes = chordNotes(root, q);
      const answer = q.includes('7') ? 'Seventh chord' : 'Triad';
      return {
        figure: fig(`[${notes.map(pitchText).join(' ')}]`, { play: 'apart-then-together' }),
        options: ['Triad', 'Seventh chord'],
        answer,
        explain: `${symbol(root, q)}: ${notes.length} notes, ${notes.map(name).join(' ')}.`,
      };
    });
}

/** Where does this dominant 7th want to go? (The tonic a 5th below its root.) */
function resolveRounds(count: number) {
  const keys = ['C', 'F', 'G', 'D', 'Bb', 'A', 'Eb', 'E'];
  return (rng: Rng): QuizRound[] =>
    draw(rng, keys, count).map(k => {
      const key = parseKey(k);
      const v7 = diatonicChord(key, 5, { seventh: true });
      const tonic = tonicPitch(key);
      const answer = `${name(tonic)} major`;
      const all = keys.map(x => `${name(tonicPitch(parseKey(x)))} major`);
      return {
        prompt: `Where does ${symbol(v7.root, '7')} want to go?`,
        figure: fig(`[${v7.notes.map(pitchText).join(' ')}]`, { play: 'together' }),
        options: choices(rng, answer, all, 4),
        answer,
        explain: `${symbol(v7.root, '7')} is V7 in ${name(tonic)} major: its tritone (${name(v7.notes[1])}–${name(v7.notes[3])}) closes in on ${name(tonic)} and ${name(diatonicChord(key, 1).notes[1])}.`,
      };
    });
}

/** Play V7 in a key, root at the bottom, then its I. */
function dominantBuildRounds(count: number) {
  const keys = ['C', 'F', 'G', 'D', 'Bb'];
  return (rng: Rng): BuildRound[] =>
    draw(rng, keys, count).flatMap(k => {
      const key = parseKey(k);
      const v7 = diatonicChord(key, 5, { seventh: true });
      const i = diatonicChord(key, 1);
      const keyName = `${name(tonicPitch(key))} major`;
      const v7Notes = chordNotes({ ...v7.root, octave: 3 }, '7').map(pitchText);
      return [
        {
          prompt: `Play V7 in ${keyName}, with ${name(v7.root)} at the bottom`,
          figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
          check: C.chord('7', { root: spec(v7.root), inversion: 0 }),
          answer: v7Notes,
          explain: `V7 in ${keyName} is ${symbol(v7.root, '7')}: ${v7.notes.map(name).join(' ')}.`,
        },
        {
          prompt: `Now resolve it: play I in ${keyName}`,
          figure: { notes: 'r/w', key: k, keys: false, play: 'none' },
          check: C.chord('maj', { root: spec(i.root) }),
          answer: i.notes.map(pitchText),
          explain: `I is ${name(i.root)} major: ${i.notes.map(name).join(' ')}.`,
        },
      ];
    });
}

/** Play a seventh chord of C major from its numeral, root at the bottom. */
function numeralSeventhBuildRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, [1, 2, 4, 5, 6], count).map(d => {
      const c = diatonicChord(parseKey('C'), d, { seventh: true });
      return {
        prompt: `Play ${c.numeral} in C major, with ${name(c.root)} at the bottom`,
        check: C.chord(c.quality.id, { root: spec(c.root), inversion: 0 }),
        answer: c.notes.map(pitchText),
        explain: `${c.numeral} is ${symbol(c.root, c.quality.id)}: ${c.notes.map(name).join(' ')}.`,
      };
    });
}

export const seventhsUnit = unit('th-sevenths', 'Seventh Chords', 'Four-note chords', 'One more third on top: the five seventh chords, the sevenths of a key, and the dominant 7th’s pull home.', [
  lesson(
    'th12-1',
    'Adding a Seventh',
    'learn',
    'Stack one more third on a triad',
    [
      explain(
        'One more third',
        `A triad is three notes stacked in thirds: root, 3rd, 5th. Stack one more third on top and you reach the note a **7th** above the root. The result is a **seventh chord**: four notes, root, 3rd, 5th and 7th.

The extra note makes the chord richer, and a little restless. Jazz lives on seventh chords; pop and classical music use them to add colour and to push towards the next chord.`,
        fig('[C4 E4 G4]/w [C4 E4 G4 B4]/w [G3 B3 D4]/w [G3 B3 D4 F4]/w', { labels: ['C', 'Cmaj7', 'G', 'G7'], play: 'as-written' }),
      ),
      explore('Hear the difference', 'Hold a triad, then add the 7th on top and listen to the colour change.', [
        task('Hold C E G (a C major triad)', C.chordOf('C', 'E', 'G')),
        task('Now hold C E G B: add the B, a 7th above C', C.chordOf('C', 'E', 'G', 'B')),
        task('Hold G B D F (G7, the chord on the right of the picture)', C.chord('7', { root: 'G' })),
        task('Build any seventh chord of your own: four notes, a third apart', C.chord(SEVENTHS)),
      ]),
      quiz('Triad or seventh chord?', 'Count the notes, and listen for the extra colour on top.', 'Triad or seventh chord?', triadOrSeventhRounds(6)),
      drill('Count to the 7th', 'Name the interval between the two notes: count the letters, both ends included.', intervalDrill('treble', 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5', [3, 5, 7], 8)),
    ],
    { topics: ['chord:seventh'] },
  ),
  lesson(
    'th12-2',
    'Five Seventh Chords',
    'learn',
    'Major 7th, dominant 7th, minor 7th, half-diminished and diminished',
    [
      explain(
        'A triad plus a 7th',
        `Each seventh chord is a triad with a 7th on top, and its name says which:

- **Major 7th** (Cmaj7): a major triad plus a major 7th. Soft and dreamy.
- **Dominant 7th** (C7): a major triad plus a *minor* 7th. Bluesy and restless: it wants to move.
- **Minor 7th** (Cm7): a minor triad plus a minor 7th. Mellow and smooth.

The 7th is a semitone below the octave (B above C) in a major 7th, and a tone below it (B♭) in the other two.`,
        fig('[C4 E4 G4 B4]/w [C4 E4 G4 Bb4]/w [C4 Eb4 G4 Bb4]/w', { labels: ['Cmaj7', 'C7', 'Cm7'], play: 'as-written' }),
      ),
      explain(
        'The two diminished sevenths',
        `Two more start from a **diminished** triad (minor 3rd, diminished 5th):

- **Half-diminished** (Cø7, also written Cm7♭5): a diminished triad plus a minor 7th. Dark, searching.
- **Diminished 7th** (C°7): a diminished triad plus a *diminished* 7th, which sounds like a major 6th. Every note is a minor 3rd from the next: tense, dramatic, the sound of a silent-film villain.

Notice the spelling: C°7's top note is B𝄫 (B double-flat), because it's a 7th above C, even though it sounds like A.`,
        fig('[C4 Eb4 Gb4 Bb4]/w [C4 Eb4 Gb4 Bbb4]/w', { labels: ['Cø7', 'C°7'], play: 'as-written' }),
      ),
      quiz('Name the seventh chord', 'Look at the triad underneath, then at the 7th on top.', 'Which seventh chord is this?', seventhRounds({ qualities: SEVENTHS, count: 8 })),
      build('Build them', 'Start from the root, stack thirds, and check each one: major or minor?', seventhBuildRounds({ qualities: SEVENTHS, count: 5 })),
    ],
  ),
  lesson(
    'th12-3',
    'Sevenths in a Key',
    'learn',
    'Imaj7, ii7, iii7, IVmaj7, V7, vi7 and viiø7',
    [
      explain(
        'A seventh on every degree',
        `Stack four notes of the C major scale on each degree (every other note: C E G B, D F A C…) and you get a seventh chord on each one. Using only the key's notes, the qualities fall into place by themselves:

- **Imaj7** and **IVmaj7**: major 7ths
- **ii7**, **iii7** and **vi7**: minor 7ths
- **V7**: the only dominant 7th in the key
- **viiø7**: half-diminished

Every major key has the same pattern. That one dominant 7th on V is what makes V the strongest chord in the key.`,
        fig('[C4 E4 G4 B4]/w [D4 F4 A4 C5]/w [E4 G4 B4 D5]/w [F4 A4 C5 E5]/w [G4 B4 D5 F5]/w [A4 C5 E5 G5]/w [B4 D5 F5 A5]/w', { labels: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'], play: 'as-written' }),
      ),
      explore('Walk up the key', 'Play some of the key’s seventh chords. The readout names each one and its numeral in C major.', [
        task('Hold Dm7 (D F A C), the ii7', C.chord('m7', { root: 'D' })),
        task('Hold G7 (G B D F), the V7', C.chord('7', { root: 'G' })),
        task('Hold Fmaj7 (F A C E), the IVmaj7', C.chord('maj7', { root: 'F' })),
      ]),
      quiz('Which numeral?', 'Find the root, count up from C, and listen to the quality.', 'Which chord of C major is this?', numeralRounds({ keys: ['C'], degrees: [1, 2, 3, 4, 5, 6, 7], count: 7, seventh: true })),
      build('Play the numeral', 'Count up the scale from C to find the root, then stack three thirds using only white keys.', numeralSeventhBuildRounds(4)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th12-4',
    'The Dominant Seventh',
    'learn',
    'The tritone, and how V7 resolves',
    [
      explain(
        'A tritone inside',
        `G7 holds two notes, B and F, that are a **tritone** apart (three whole tones). The tritone is the most unstable interval there is, and it wants to resolve: **B rises** a semitone to C, and **F falls** a semitone to E. C and E are the heart of the C major chord.

That's why V7 pulls so hard towards I: two of its notes are a semitone away from home, leaning in.`,
        fig('[B3 F4]/h [C4 E4]/h', { labels: ['tritone', 'resolved'], play: 'as-written' }),
      ),
      explain(
        'V7 to I',
        `Here is the whole move: G7 to C. The bass leaps from G down to C, B steps up to C, and F steps down to E.

You'll hear this move everywhere, from Bach chorales to the end of a pop song. Every major key has its own: D7 to G, C7 to F, E7 to A.`,
        fig('[G2 B3 F4]/h [C3 C4 E4]/h', { labels: ['V7', 'I'], play: 'as-written' }),
      ),
      explore('Feel the pull', 'Hold the tritone first, then resolve it.', [
        task('Hold B and the F above it together (a tritone)', C.interval(6, { together: true, from: 'B' })),
        task('Resolve it: hold C and E together', C.chordOf('C', 'E')),
        task('Play G7 (G B D F)…', C.chord('7', { root: 'G' })),
        task('…then C major', C.chord('maj', { root: 'C' })),
      ]),
      quiz('Where does it go?', 'A dominant 7th is V7 of the key a 5th below its root.', 'Where does this chord want to go?', resolveRounds(6)),
      build('V7 and home', 'Find V (count up five notes from the key’s name), add a minor 7th, then resolve to I.', dominantBuildRounds(3)),
    ],
  ),
  lesson(
    'th12-5',
    'Sevenths by Ear',
    'ear',
    'Hear major 7th, dominant 7th, minor 7th and the diminished chords',
    [
      explain(
        'What to listen for',
        `Each seventh chord has a mood you can learn to hear:

- **Major 7th**: soft and shimmering, a little wistful.
- **Dominant 7th**: bright but unsettled, bluesy; it wants to go somewhere.
- **Minor 7th**: dark but relaxed, smooth.
- **Half-diminished**: dark and questioning.
- **Diminished 7th**: tense and dramatic, all minor 3rds.

Listen to the bottom (major or minor triad?) and then the top (does the 7th rub or sit comfortably?).`,
        fig('[C4 E4 G4 B4]/w [C4 E4 G4 Bb4]/w [C4 Eb4 G4 Bb4]/w', { labels: ['maj7', '7', 'm7'], play: 'as-written' }),
      ),
      quiz('Three sevenths', 'Major 7th, dominant 7th or minor 7th? Play it as often as you like.', 'Which seventh chord do you hear?', seventhRounds({ qualities: ['maj7', '7', 'm7'], count: 8 }), { mode: 'hear' }),
      quiz('All five', 'Now with the half-diminished and diminished 7ths too.', 'Which seventh chord do you hear?', seventhRounds({ qualities: SEVENTHS, count: 8 }), { mode: 'hear' }),
    ],
  ),
  lesson(
    'th12-c',
    'Checkpoint: Seventh Chords',
    'checkpoint',
    'Build, name and hear seventh chords',
    [
      quiz('Name it', '', 'Which seventh chord is this?', seventhRounds({ qualities: SEVENTHS, count: 5 })),
      build('Build it', '', seventhBuildRounds({ qualities: SEVENTHS, count: 3 })),
      quiz('In the key', '', 'Which chord of C major is this?', numeralRounds({ keys: ['C'], degrees: [1, 2, 4, 5, 6, 7], count: 4, seventh: true })),
      quiz('Resolutions', '', 'Where does this chord want to go?', resolveRounds(3)),
      quiz('By ear', '', 'Which seventh chord do you hear?', seventhRounds({ qualities: ['maj7', '7', 'm7'], count: 4 }), { mode: 'hear' }),
      quiz('Chord symbols', '', 'What does the symbol mean?', [
        round('What is Fmaj7?', 'F A C E', ['F A C E', 'F A C E♭', 'F A♭ C E♭'], { explain: 'A major triad (F A C) plus a major 7th (E).' }),
        round('What is D7?', 'D F♯ A C', ['D F♯ A C', 'D F♯ A C♯', 'D F A C'], { explain: 'A major triad (D F♯ A) plus a minor 7th (C): a dominant 7th.' }),
        round('What is Am7?', 'A C E G', ['A C E G', 'A C♯ E G', 'A C E G♯'], { explain: 'A minor triad (A C E) plus a minor 7th (G).' }),
        round('What is Bø7?', 'B D F A', ['B D F A', 'B D F A♭', 'B D♯ F♯ A'], { explain: 'A diminished triad (B D F) plus a minor 7th (A): half-diminished, also written Bm7♭5.' }),
      ]),
    ],
  ),
]);
