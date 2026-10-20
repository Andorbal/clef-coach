/**
 * Unit 13: cadences and progressions. How phrases end (perfect, plagal, imperfect and
 * interrupted cadences, by eye and by ear), how chords move smoothly from one to the next
 * (common tones, steps, contrary motion, and why parallel 5ths are avoided), harmonising a
 * melody with I, IV and V, and the 12-bar blues.
 *
 * Progressions are voiced as a pianist (or a choir) would: the root in the bass, three
 * voices above that move as little as they can.
 */
import type { Rng } from '../../../curriculum/generate';
import { type KeySig, parseKey } from '../../../music/keys';
import { type Pitch, midiOf, parsePitch, stepLabel } from '../../../music/pitch';
import { chordNotes, chordSymbolOf, diatonicChord, pitchText, scaleNotes, tonicPitch } from '../../theory';
import { C, build, choices, draw, explain, explore, fig, lesson, pick, quiz, round, task, unit } from '../build';
import type { BuildRound, Figure, QuizRound } from '../types';
import { chordQuality } from '../../../music/chords';

const name = (p: Pitch) => stepLabel(p.step, p.alter);
const spec = (p: Pitch) => pitchText(p).replace(/-?\d$/, '');
const keyLabel = (key: KeySig) => `${name(tonicPitch(key))} ${key.mode}`;
const atOctave = (p: Pitch, octave: number): Pitch => ({ ...p, octave });

/**
 * A progression voiced for four parts: the root in the bass (E2–D♯3), three upper voices
 * in close position between middle C and E5 (on the treble staff, stems up, clear of the
 * labels), each chord's upper voices as near the last as they can be. A seventh chord drops its 5th so the 3rd and 7th (the notes that resolve) stay.
 */
export function voiceProgression(key: KeySig, degrees: number[], sevenths: boolean[] = []): Pitch[][] {
  const out: Pitch[][] = [];
  let prev: number[] | null = null;
  degrees.forEach((d, i) => {
    const c = diatonicChord(key, d, { seventh: sevenths[i] });
    let bass = c.root;
    while (midiOf(bass) > 51) bass = atOctave(bass, bass.octave - 1);
    while (midiOf(bass) < 40) bass = atOctave(bass, bass.octave + 1);
    const tones = sevenths[i] ? [c.notes[0], c.notes[1], c.notes[3]] : c.notes.slice(0, 3);
    const cands: Pitch[][] = [];
    for (let inv = 0; inv < 3; inv++) {
      const rot = [...tones.slice(inv), ...tones.slice(0, inv)];
      for (let oct = 3; oct <= 5; oct++) {
        const v: Pitch[] = [atOctave(rot[0], oct)];
        for (const t of rot.slice(1)) {
          let p = atOctave(t, v[v.length - 1].octave);
          while (midiOf(p) <= midiOf(v[v.length - 1])) p = atOctave(p, p.octave + 1);
          v.push(p);
        }
        if (midiOf(v[0]) >= 60 && midiOf(v[2]) <= 76) cands.push(v);
      }
    }
    const last = prev;
    const cost = (v: Pitch[]) => (last ? v.reduce((s, p, j) => s + Math.abs(midiOf(p) - last[j]), 0) : Math.abs(midiOf(v[2]) - 67));
    cands.sort((a, b) => cost(a) - cost(b));
    prev = cands[0].map(midiOf);
    out.push([bass, ...cands[0]]);
  });
  return out;
}

/** A progression as a figure: half-note chords in 4/4, labelled with their numerals. */
export function progressionFigure(key: KeySig, keyName: string, degrees: number[], o: { sevenths?: boolean[]; labels?: boolean } = {}): Figure {
  const chords = voiceProgression(key, degrees, o.sevenths);
  const notes = chords.map(ch => `[${ch.map(pitchText).join(' ')}]/h`);
  // an odd chord out fills the last bar
  if (notes.length % 2) notes[notes.length - 1] = notes[notes.length - 1].replace('/h', '/w');
  const text = notes.reduce((acc, n, i) => acc + (i && i % 2 === 0 ? ' | ' : ' ') + n, '').trim();
  const numerals = degrees.map((d, i) => diatonicChord(key, d, { seventh: o.sevenths?.[i] }).numeral);
  return { notes: text, key: keyName, time: [4, 4], labels: o.labels === false ? undefined : numerals, play: 'as-written', tempo: 80 };
}

const CADENCES = {
  perfect: { label: 'Perfect (authentic)', ends: [5, 1], leads: [[1, 4], [1, 2], [1, 6]] },
  plagal: { label: 'Plagal', ends: [4, 1], leads: [[1, 5], [1, 6], [1, 2]] },
  imperfect: { label: 'Imperfect (half)', ends: [5], leads: [[1, 4, 1], [1, 6, 2], [1, 6, 4], [1, 2, 4]] },
  interrupted: { label: 'Interrupted (deceptive)', ends: [5, 6], leads: [[1, 4], [1, 2], [1, 6]] },
} as const;
type CadenceId = keyof typeof CADENCES;

const CADENCE_KEYS = ['C', 'G', 'F', 'D', 'Bb', 'A'];

/** Name the cadence at the end of a four-chord phrase, heard (or seen). */
function cadenceRounds(o: { kinds: CadenceId[]; count: number }) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, o.kinds, o.count).map(kind => {
      const c = CADENCES[kind];
      const k = pick(rng, CADENCE_KEYS);
      const key = parseKey(k);
      const lead = pick(rng, c.leads.filter(l => l.length + c.ends.length === 4));
      const degrees = [...lead, ...c.ends];
      const ends = c.ends.map(d => diatonicChord(key, d).numeral).join('–');
      const why = { perfect: `${ends} in ${keyLabel(key)}: home.`, plagal: `${ends} in ${keyLabel(key)}: the Amen.`, imperfect: `It stops on V in ${keyLabel(key)}, left hanging.`, interrupted: `${ends} in ${keyLabel(key)}: V swerves to vi instead of going home.` }[kind];
      return {
        figure: progressionFigure(key, k, degrees),
        options: choices(rng, c.label, o.kinds.map(x => CADENCES[x].label), 4, true),
        answer: c.label,
        explain: why,
      };
    });
}

/** Two voices, two notes each: parallel 5ths, parallel octaves, or neither? */
function parallelRounds(count: number) {
  const scale = scaleNotes('C3', 'major', 3);
  const semis = (i: number, j: number) => midiOf(scale[j]) - midiOf(scale[i]);
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['5ths', 'octaves', 'neither', 'neither'], count).map(kind => {
      let lo1 = 0;
      let lo2 = 0;
      let up1 = 0;
      let up2 = 0;
      if (kind === '5ths' || kind === 'octaves') {
        const steps = kind === '5ths' ? 4 : 7;
        const want = kind === '5ths' ? 7 : 12;
        const pairs: [number, number][] = [];
        for (let i = 0; i < 7; i++) for (const m of [-2, -1, 1, 2]) if (i + m >= 0 && i + m < 7 && semis(i, i + steps) === want && semis(i + m, i + m + steps) === want) pairs.push([i, i + m]);
        [lo1, lo2] = pick(rng, pairs);
        up1 = lo1 + steps;
        up2 = lo2 + steps;
      } else {
        // fine: parallel 3rds or 6ths, or contrary motion into a new interval
        const [s1, s2, way] = pick(rng, [
          [2, 2, 'same'],
          [5, 5, 'same'],
          [4, 2, 'in'],
          [2, 4, 'out'],
          [7, 5, 'in'],
          [5, 7, 'out'],
        ] as [number, number, string][]);
        lo1 = 1 + Math.floor(rng() * 5);
        up1 = lo1 + s1;
        if (way === 'same') {
          lo2 = lo1 + pick(rng, [-1, 1]);
          up2 = lo2 + s2;
        } else {
          lo2 = way === 'in' ? lo1 + 1 : lo1 - 1;
          up2 = lo2 + s2;
        }
      }
      const notes = `[${pitchText(scale[lo1])} ${pitchText(scale[up1])}]/h [${pitchText(scale[lo2])} ${pitchText(scale[up2])}]/h`;
      const answer = kind === '5ths' ? 'Parallel 5ths' : kind === 'octaves' ? 'Parallel octaves' : 'Neither';
      return {
        figure: fig(notes, { play: 'as-written' }),
        options: ['Parallel 5ths', 'Parallel octaves', 'Neither'],
        answer,
        explain:
          kind === 'neither'
            ? `${name(scale[lo1])}–${name(scale[up1])} to ${name(scale[lo2])}–${name(scale[up2])}: the voices keep their independence.`
            : `Both voices move the same way, from one perfect ${kind === '5ths' ? '5th' : 'octave'} to another: they sound like a single voice.`,
      };
    });
}

/** Melody notes that belong to only one of I, IV and V: 2, 3, 4, 6 and 7. */
const HARMONY_DEGREES: [number, number][] = [
  [2, 5],
  [3, 1],
  [4, 4],
  [6, 4],
  [7, 5],
];
const HARMONY_KEYS = ['C', 'G', 'F', 'D'];

function melodyNoteOf(key: KeySig, degree: number): Pitch {
  return scaleNotes(atOctave(tonicPitch(key), 4), 'major')[degree - 1];
}

/** Which of I, IV and V fits this melody note? */
function harmonyRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, HARMONY_DEGREES, count).map(([deg, chord]) => {
      const k = pick(rng, HARMONY_KEYS);
      const key = parseKey(k);
      const note = melodyNoteOf(key, deg);
      const c = diatonicChord(key, chord);
      const answer = c.numeral;
      return {
        prompt: `In ${keyLabel(key)}, which chord fits under ${name(note)}?`,
        figure: { notes: `${pitchText(note)}/w`, key: k, play: 'as-written' },
        options: ['I', 'IV', 'V'],
        answer,
        explain: `${name(note)} is in ${answer} (${chordSymbolOf(c.root, c.quality)}: ${c.notes.map(name).join(' ')}), and in neither of the others.`,
      };
    });
}

/** Play the chord (I, IV or V) under a melody note. */
function harmonyBuildRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, HARMONY_DEGREES, count).map(([deg, chord]) => {
      const k = pick(rng, HARMONY_KEYS);
      const key = parseKey(k);
      const note = melodyNoteOf(key, deg);
      const c = diatonicChord(key, chord);
      const notes = chordNotes(atOctave(c.root, 3), 'maj').map(pitchText);
      return {
        prompt: `Play the chord (I, IV or V) that fits ${name(note)} in ${keyLabel(key)}`,
        figure: { notes: `${pitchText(note)}/w`, key: k, play: 'as-written' },
        check: C.chord('maj', { root: spec(c.root) }),
        answer: notes,
        explain: `${name(note)} belongs to ${c.numeral}: ${chordSymbolOf(c.root, c.quality)}.`,
      };
    });
}

const BLUES = [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 1];
const BLUES_KEYS = ['C', 'F', 'G', 'A', 'E', 'Bb'];

/** Which chord is bar N of a 12-bar blues? */
function bluesRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, [3, 5, 6, 7, 9, 10, 11, 12], count).map(bar => {
      const k = pick(rng, BLUES_KEYS);
      const key = parseKey(k);
      const answer = ['I', 'IV', 'V'][[1, 4, 5].indexOf(BLUES[bar - 1])];
      const root = diatonicChord(key, BLUES[bar - 1]).root;
      return {
        prompt: `In a 12-bar blues in ${name(tonicPitch(key))}, which chord is bar ${bar}?`,
        options: ['I', 'IV', 'V'],
        answer,
        explain: `Bar ${bar} is ${answer}: ${name(root)}7. The pattern: I I I I · IV IV I I · V IV I I.`,
      };
    });
}

/** Play a blues chord: I7, IV7 or V7 in a key, root at the bottom. */
function bluesBuildRounds(count: number) {
  return (rng: Rng): BuildRound[] =>
    draw(rng, [1, 4, 5], count).map(d => {
      const k = pick(rng, ['C', 'F', 'G', 'A']);
      const key = parseKey(k);
      const root = atOctave(diatonicChord(key, d).root, 3);
      const notes = chordNotes(root, '7').map(pitchText);
      const numeral = ['I7', 'IV7', 'V7'][[1, 4, 5].indexOf(d)];
      return {
        prompt: `Play the ${numeral} of a blues in ${name(tonicPitch(key))}, with ${name(root)} at the bottom`,
        check: C.chord('7', { root: spec(root), inversion: 0 }),
        answer: notes,
        explain: `${numeral} is ${chordSymbolOf(root, chordQuality('7')!)}: ${notes.map(n => name(parsePitch(n))).join(' ')}. In the blues every chord can be a dominant 7th.`,
      };
    });
}

/** Move from one chord to the next, keeping the note they share. */
const COMMON_TONE_ROUNDS: BuildRound[] = [
  { prompt: 'From C major (C E G), move to F major keeping C: play C F A', figure: fig('[C4 E4 G4]', { play: 'together' }), check: C.chord('maj', { root: 'F', inversion: 2 }), answer: ['C4', 'F4', 'A4'], explain: 'C stays put; E and G step up to F and A.' },
  { prompt: 'From C major (C E G), move to G major keeping G: play B D G', figure: fig('[C4 E4 G4]', { play: 'together' }), check: C.chord('maj', { root: 'G', inversion: 1 }), answer: ['B3', 'D4', 'G4'], explain: 'G stays; C steps down to B, E steps down to D.' },
  { prompt: 'From G major (B D G), move to C major keeping G: play C E G', figure: fig('[B3 D4 G4]', { play: 'together' }), check: C.chord('maj', { root: 'C', inversion: 0 }), answer: ['C4', 'E4', 'G4'], explain: 'G stays; B steps up to C, D up to E.' },
  { prompt: 'From F major (C F A), move to C major keeping C: play C E G', figure: fig('[C4 F4 A4]', { play: 'together' }), check: C.chord('maj', { root: 'C', inversion: 0 }), answer: ['C4', 'E4', 'G4'], explain: 'C stays; F steps down to E, A down to G.' },
];

export const cadencesUnit = unit('th-cadences', 'Cadences and Progressions', 'How harmony moves', 'How phrases end, how chords move smoothly, harmonising a tune, and the 12-bar blues.', [
  lesson(
    'th13-1',
    'Full Stops',
    'learn',
    'Perfect and plagal cadences',
    [
      explain(
        'Musical punctuation',
        `A **cadence** is the way a phrase ends: the last two chords, where the music takes a breath. Like punctuation in a sentence, some cadences close a thought and some leave it open.

The strongest close is the **perfect cadence** (in America, the *authentic* cadence): **V to I**. The dominant pulls home to the tonic, and the music sounds finished. Listen to the last two chords.`,
        progressionFigure(parseKey('C'), 'C', [1, 4, 5, 1]),
      ),
      explain(
        'The Amen',
        `The **plagal cadence** is **IV to I**. It closes too, but more gently, with a warm, settled sound. It's the "A-men" sung at the end of hymns, and it often follows a perfect cadence as a soft goodbye.

Both cadences end on I: that's what makes them full stops.`,
        progressionFigure(parseKey('C'), 'C', [1, 5, 4, 1]),
      ),
      explore('Play the cadences', 'Hold each chord (three notes together). The readout names its numeral in C major.', [
        task('Play V in C: G B D', C.chord('maj', { root: 'G' })),
        task('…and resolve it to I: C E G', C.chord('maj', { root: 'C' })),
        task('Now IV: F A C', C.chord('maj', { root: 'F' })),
      ]),
      quiz('Perfect or plagal?', 'Listen to the last two chords: V to I (a strong pull home) or IV to I (a gentle Amen)?', 'Which cadence ends this phrase?', cadenceRounds({ kinds: ['perfect', 'plagal'], count: 6 }), { mode: 'hear' }),
    ],
    { key: 'C' },
  ),
  lesson(
    'th13-2',
    'Commas and Surprises',
    'learn',
    'Imperfect and interrupted cadences',
    [
      explain(
        'Left hanging',
        `A phrase that ends on **V** sounds unfinished, like a question or a comma. That's an **imperfect cadence** (in America, a *half* cadence). Any chord can lead to it: I–V, ii–V, IV–V.

Composers use it in the middle of a tune, so the next phrase can answer it.`,
        progressionFigure(parseKey('C'), 'C', [1, 6, 2, 5]),
      ),
      explain(
        'The surprise',
        `The **interrupted cadence** (in America, *deceptive*) sets up a perfect cadence and then swerves: **V goes to vi** instead of I. The bass steps up instead of falling home, and the minor chord gives the ending a twist.

It's a way to keep the music going: the listener expects a full stop and gets a semicolon.`,
        progressionFigure(parseKey('C'), 'C', [1, 4, 5, 6]),
      ),
      quiz('Four cadences', 'Does it end on I (perfect or plagal), hang on V (imperfect), or swerve to vi (interrupted)?', 'Which cadence ends this phrase?', cadenceRounds({ kinds: ['perfect', 'plagal', 'imperfect', 'interrupted'], count: 8 }), { mode: 'hear' }),
      build('Write the endings', 'Each round shows the key. Hold the chord that ends the phrase.', [
        { prompt: 'In C major, V has just played. Make it an interrupted cadence', figure: { notes: '[G3 B3 D4]', key: 'C', play: 'together' }, check: C.chord('min', { root: 'A' }), answer: ['A3', 'C4', 'E4'], explain: 'vi in C is A minor: A C E.' },
        { prompt: 'In C major, end the phrase with an imperfect cadence: play V', figure: { notes: '[F3 A3 C4]', key: 'C', play: 'together' }, check: C.chord(['maj', '7'], { root: 'G' }), answer: ['G3', 'B3', 'D4'], explain: 'V in C is G major: G B D.' },
        { prompt: 'In G major, V (D major) has just played. Finish with a perfect cadence', figure: { notes: '[D4 F#4 A4]', key: 'G', play: 'together' }, check: C.chord('maj', { root: 'G' }), answer: ['G3', 'B3', 'D4'], explain: 'I in G is G major: G B D.' },
        { prompt: 'In F major, finish with a plagal cadence: IV has played, now play I', figure: { notes: '[Bb3 D4 F4]', key: 'F', play: 'together' }, check: C.chord('maj', { root: 'F' }), answer: ['F3', 'A3', 'C4'], explain: 'I in F is F major: F A C.' },
      ]),
    ],
    { key: 'C' },
  ),
  lesson(
    'th13-3',
    'Smooth Moves',
    'learn',
    'Common tones, steps, contrary motion and parallel 5ths',
    [
      explain(
        'Move as little as you can',
        `When chords change, each note of one chord can be thought of as a **voice**, like a singer in a choir, moving to a note of the next chord. Good **voice leading** keeps those moves small:

- a note the two chords **share** (a *common tone*) stays where it is;
- the others move by **step** to the nearest note of the new chord.

C to F: C stays, E steps up to F, G steps up to A. Smooth, and easy to sing.`,
        fig('[C4 E4 G4]/h [C4 F4 A4]/h [B3 D4 G4]/h [C4 E4 G4]/h', { labels: ['I', 'IV', 'V', 'I'], key: 'C', play: 'as-written' }),
      ),
      explain(
        'Contrary motion, and parallel 5ths',
        `Voices sound most independent when they move in **contrary motion**: one up, one down. Moving together in 3rds or 6ths sounds sweet and is fine.

But two voices moving together in **perfect 5ths** (or octaves) blend so completely that they stop sounding like two voices: the harmony suddenly thins out. That's why classical harmony avoids **parallel 5ths** and octaves. (Rock guitarists love them: a power-chord riff is nothing but parallel 5ths. Rules depend on the style.)`,
        fig('[C3 G3]/h [D3 A3]/h [E3 C4]/h [D3 D4]/h', { labels: ['5th', '5th', '6th', 'octave'], play: 'as-written' }),
      ),
      build('Keep the common tone', 'Hold the first chord on the staff in your head, then play the next chord keeping the shared note.', COMMON_TONE_ROUNDS),
      quiz('Spot the parallels', 'Look at both voices: same direction, same perfect interval both times?', 'Parallel 5ths, parallel octaves, or neither?', parallelRounds(6)),
    ],
    { key: 'C' },
  ),
  lesson(
    'th13-4',
    'Harmonising a Tune',
    'learn',
    'Choose I, IV or V for each melody note',
    [
      explain(
        'Three chords cover every note',
        `Between them, the three **primary chords** of a key contain every note of its scale. In C major: **I** is C E G, **IV** is F A C, **V** is G B D.

So to harmonise a simple tune, look at each important melody note and pick the chord that contains it. Some notes belong to two chords (C is in I and IV; G is in I and V): then let your ear choose, and end with V–I.`,
        fig('[C3 E3 G3 E4]/h [C3 E3 G3 G4]/h | [F3 A3 C4 A4]/h [F3 A3 C4 F4]/h | [G2 B2 D3 D4]/h [G2 B2 D3 B4]/h | [C3 E3 G3 C5]/w', { key: 'C', time: [4, 4], labels: ['I', 'I', 'IV', 'IV', 'V', 'V', 'I'], play: 'as-written' }),
      ),
      quiz('Which chord?', 'Is the note in I, IV or V? Spell the three chords in the key and look for it.', 'Which chord fits?', harmonyRounds(8)),
      build('Harmonise it', 'Play the chord that contains the melody note (three notes held together).', harmonyBuildRounds(5)),
    ],
  ),
  lesson(
    'th13-5',
    'The 12-Bar Blues',
    'learn',
    'The most famous progression in popular music',
    [
      explain(
        'Twelve bars, three chords',
        `The **12-bar blues** is a chord pattern twelve bars long, repeated over and over. It's the backbone of the blues, early rock and roll and a great deal of jazz:

- bars 1–4: **I I I I**
- bars 5–8: **IV IV I I**
- bars 9–12: **V IV I I**

The four-bar lines often answer each other like a call and response. A common variation (the "quick change") moves to IV in bar 2 and back.`,
        fig('C3 C3 C3 C3 F3 F3 C3 C3 G3 F3 C3 C3', { labels: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I'], key: 'C', play: 'as-written', tempo: 160 }),
      ),
      explain(
        'Sevenths everywhere',
        `In the blues, every chord is usually a **dominant 7th**: C7, F7, G7 in C. Normally only V gets a dominant 7th, but the blues isn't bothered: the "wrong" 7ths, with their minor 7th on top, give it its gritty, restless sound.`,
        fig('[C3 E3 G3 Bb3]/w [F3 A3 C4 Eb4]/w [G3 B3 D4 F4]/w', { labels: ['I7', 'IV7', 'V7'], play: 'as-written' }),
      ),
      quiz('Find your place', 'Say the pattern to yourself: I I I I, IV IV I I, V IV I I.', 'Which chord is it?', bluesRounds(6)),
      build('Blues sevenths', 'Find I, IV or V of the key, then stack a dominant 7th on it: a major triad plus a minor 7th.', bluesBuildRounds(4)),
    ],
  ),
  lesson(
    'th13-c',
    'Checkpoint: Cadences and Progressions',
    'checkpoint',
    'Cadences, voice leading, harmonising and the blues',
    [
      quiz('Name the cadence', '', 'Which cadence ends this phrase?', cadenceRounds({ kinds: ['perfect', 'plagal', 'imperfect', 'interrupted'], count: 6 }), { mode: 'hear' }),
      quiz('Parallels', '', 'Parallel 5ths, parallel octaves, or neither?', parallelRounds(3)),
      quiz('Harmonise', '', 'Which chord fits?', harmonyRounds(4)),
      quiz('The blues', '', 'Which chord is it?', bluesRounds(3)),
      quiz('Cadence names', '', 'Which cadence is it?', [
        round('V to I?', 'Perfect (authentic)', ['Perfect (authentic)', 'Plagal', 'Imperfect (half)', 'Interrupted (deceptive)']),
        round('IV to I?', 'Plagal', ['Perfect (authentic)', 'Plagal', 'Imperfect (half)', 'Interrupted (deceptive)']),
        round('Ending on V?', 'Imperfect (half)', ['Perfect (authentic)', 'Plagal', 'Imperfect (half)', 'Interrupted (deceptive)']),
        round('V to vi?', 'Interrupted (deceptive)', ['Perfect (authentic)', 'Plagal', 'Imperfect (half)', 'Interrupted (deceptive)']),
      ]),
    ],
  ),
]);
