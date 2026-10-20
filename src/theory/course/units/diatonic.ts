/**
 * Unit 11: chords in a key. The triad on every degree of a scale and its Roman numeral,
 * the primary chords I, IV and V, what each chord does (home, away, wanting home), the
 * minor key's raised 7th, and the progressions half the world's songs are built on.
 *
 * Lessons think in a key (`key`), so whatever is held is named with its numeral too
 * ("IV in C major").
 */
import type { Rng } from '../../../curriculum/generate';
import { parseKey } from '../../../music/keys';
import { type Pitch, midiOf, stepLabel } from '../../../music/pitch';
import { chordNotes, chordSymbolOf, diatonicChord, pitchText, tonicPitch } from '../../theory';
import { C, build, choices, draw, explain, explore, fig, lesson, numeralBuildRounds, numeralRounds, pick, quiz, task, unit } from '../build';
import type { BuildRound, Figure, QuizRound } from '../types';

const keyLabel = (k: string) => {
  const key = parseKey(k);
  const t = tonicPitch(key);
  return `${stepLabel(t.step, t.alter)} ${key.mode}`;
};

/**
 * The chords on these degrees, voiced so each moves as little as it can from the one
 * before (as a pianist or arranger would), kept between E3 and G5.
 */
function voiced(k: string, degrees: number[]): Pitch[][] {
  const key = parseKey(k);
  const out: Pitch[][] = [];
  for (const d of degrees) {
    const c = diatonicChord(key, d);
    const candidates: Pitch[][] = [];
    for (const octave of [3, 4]) for (const inv of [0, 1, 2]) candidates.push(chordNotes({ ...c.root, octave }, c.quality.id, inv));
    const fits = candidates.filter(v => v.every(p => midiOf(p) >= 52 && midiOf(p) <= 79));
    const prev = out[out.length - 1];
    const cost = (v: Pitch[]) => (prev ? v.reduce((s, p, i) => s + Math.abs(midiOf(p) - midiOf(prev[i])), 0) : Math.abs(midiOf(v[0]) - 57) + (v === candidates[0] || v === candidates[3] ? 0 : 6));
    out.push([...(fits.length ? fits : candidates)].sort((a, b) => cost(a) - cost(b))[0]);
  }
  return out;
}

const numeralsOf = (k: string, degrees: number[]) => degrees.map(d => diatonicChord(parseKey(k), d).numeral);

/** A progression as a figure: half-note chords, numerals underneath. */
function progression(k: string, degrees: number[], o: { labels?: boolean; beats?: 'h' | 'w' } = {}): Figure {
  const chords = voiced(k, degrees);
  return fig(chords.map(v => `[${v.map(pitchText).join(' ')}]/${o.beats ?? 'h'}`).join(' '), { key: k, play: 'as-written', tempo: 84, labels: o.labels === false ? undefined : numeralsOf(k, degrees) });
}

/** Does the progression end at home (on I) or hang in the air (on V)? */
function finishedRounds(count: number, keys: string[]) {
  const homes = [
    [1, 4, 5, 1],
    [1, 6, 4, 5, 1],
    [1, 2, 5, 1],
    [4, 5, 1],
  ];
  const aways = [
    [1, 4, 1, 5],
    [1, 6, 2, 5],
    [1, 4, 5],
    [4, 1, 5],
  ];
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['home', 'away'], count).map(kind => {
      const k = pick(rng, keys);
      const degrees = pick(rng, kind === 'home' ? homes : aways);
      return {
        prompt: 'Does it come home, or stop in the air?',
        figure: progression(k, degrees, { labels: true }),
        options: ['Finished', 'Unfinished'],
        answer: kind === 'home' ? 'Finished' : 'Unfinished',
        explain: `${numeralsOf(k, degrees).join(' – ')}: ${kind === 'home' ? 'it comes home to I' : 'it stops on V, still wanting home'}.`,
      };
    });
}

const FUNCTION: Record<number, string> = { 1: 'Tonic', 6: 'Tonic', 4: 'Subdominant', 2: 'Subdominant', 5: 'Dominant', 7: 'Dominant' };

/** Which job does this chord do? */
function functionRounds(count: number, keys: string[]) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, [1, 4, 5, 2, 6, 7], count).map(d => {
      const k = pick(rng, keys);
      const c = diatonicChord(parseKey(k), d);
      return {
        prompt: `In ${keyLabel(k)}, what job does ${c.numeral} (${chordSymbolOf(c.root, c.quality)}) do?`,
        figure: fig(`[${c.notes.map(pitchText).join(' ')}]`, { key: k, play: 'together' }),
        options: ['Tonic', 'Subdominant', 'Dominant'],
        answer: FUNCTION[d],
        explain:
          FUNCTION[d] === 'Tonic'
            ? `${c.numeral} is home${d === 6 ? ': it shares two notes with I' : ''}.`
            : FUNCTION[d] === 'Subdominant'
              ? `${c.numeral} leads away from home${d === 2 ? ': it shares two notes with IV' : ''}.`
              : `${c.numeral} holds the leading note, which pulls up to the tonic.`,
      };
    });
}

const PROGRESSIONS: [string, number[]][] = [
  ['I – V – vi – IV', [1, 5, 6, 4]],
  ['I – vi – IV – V', [1, 6, 4, 5]],
  ['ii – V – I', [2, 5, 1]],
  ['I – IV – V – I', [1, 4, 5, 1]],
];

/** Which progression is this? (heard) */
function progressionRounds(count: number, keys: string[]) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, PROGRESSIONS, count).map(([name, degrees]) => {
      const k = pick(rng, keys);
      return {
        prompt: 'Which progression is this?',
        figure: progression(k, degrees),
        options: choices(
          rng,
          name,
          PROGRESSIONS.map(p => p[0]),
          4,
          true,
        ),
        answer: name,
        explain: `In ${keyLabel(k)}: ${degrees
          .map(d => diatonicChord(parseKey(k), d))
          .map(c => chordSymbolOf(c.root, c.quality))
          .join(' – ')}.`,
      };
    });
}

/** Play a progression chord by chord. */
function progressionBuild(keys: string[], which: number[] = [0, 1, 2]) {
  return (rng: Rng): BuildRound[] => {
    const [name, degrees] = PROGRESSIONS[pick(rng, which)];
    const k = pick(rng, keys);
    const chords = voiced(k, degrees);
    return degrees.map((d, i) => {
      const c = diatonicChord(parseKey(k), d);
      return {
        prompt: `${name} in ${keyLabel(k)}: chord ${i + 1}, ${c.numeral}`,
        figure: fig('r/w', { key: k, keys: false, play: 'none' }),
        check: C.chord(c.quality.id, { root: pitchText(c.root).replace(/-?\d$/, '') }),
        answer: chords[i].map(pitchText),
        explain: `${c.numeral} is ${chordSymbolOf(c.root, c.quality)}.`,
      };
    });
  };
}

/** Major key or minor key? The same shape of progression in each. */
function keyModeRounds(count: number) {
  return (rng: Rng): QuizRound[] =>
    draw(rng, ['major', 'minor'], count).map(mode => {
      const tonic = pick(rng, ['C', 'D', 'E', 'G', 'A']);
      const k = mode === 'major' ? tonic : `${tonic}m`;
      return {
        figure: progression(k, [1, 4, 5, 1], { labels: false }),
        options: ['Major key', 'Minor key'],
        answer: mode === 'major' ? 'Major key' : 'Minor key',
        explain: `${numeralsOf(k, [1, 4, 5, 1]).join(' – ')} in ${keyLabel(k)}.`,
      };
    });
}

const MAJOR_KEYS = ['C', 'G', 'F', 'D', 'Bb'];
const MINOR_KEYS = ['Am', 'Em', 'Dm', 'Gm'];

export const diatonicUnit = unit('th-diatonic', 'Chords in a Key', 'Harmony', 'A chord on every note of the scale, Roman numerals, home and away, minor keys and the great progressions.', [
  lesson(
    'th11-1',
    'The Chords of a Key',
    'learn',
    'A triad on every degree, and its Roman numeral',
    [
      explain(
        'A triad on every note',
        `Build a triad on each note of the C major scale, using only the notes of the scale. Seven chords, and they come in a fixed pattern of colours: **major, minor, minor, major, major, minor, diminished**.

These seven are the key's own chords, its **diatonic** chords. Most songs in C major use only these.`,
        fig('[C4 E4 G4] [D4 F4 A4] [E4 G4 B4] [F4 A4 C5] [G4 B4 D5] [A4 C5 E5] [B4 D5 F5]', { key: 'C', play: 'as-written', labels: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'] }),
      ),
      explain(
        'Roman numerals',
        `Musicians number the chords by the scale degree of their root, in **Roman numerals**: capitals for major (**I**, **IV**, **V**), small letters for minor (**ii**, **iii**, **vi**), and a small circle for diminished (**vii°**).

The pattern is the same in every major key. "I – IV – V" means C – F – G in C major and G – C – D in G major: numerals describe a song's harmony in any key, which is why players use them to change key on the spot.`,
        fig('[C4 E4 G4] [D4 F4 A4] [E4 G4 B4] [F4 A4 C5] [G4 B4 D5] [A4 C5 E5] [B4 D5 F5]', { key: 'C', play: 'as-written', labels: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] }),
      ),
      explore('Hold them', 'In C major every chord is on the white keys. The readout gives each one its numeral.', [
        task('Hold ii: D, F and A', C.chord('min', { root: 'D' })),
        task('Hold V: G, B and D', C.chord('maj', { root: 'G' })),
        task('Hold vi: A, C and E', C.chord('min', { root: 'A' })),
        task('Hold vii°: B, D and F', C.chord('dim', { root: 'B' })),
      ]),
      quiz('Name the numeral', 'Count up the scale from C to the chord’s root (its lowest note here).', 'Which chord of C major is this?', numeralRounds({ keys: ['C'], degrees: [1, 2, 3, 4, 5, 6, 7], count: 7 })),
      build('Play the numeral', 'Find the root on the scale degree, then stack two 3rds using the key’s notes.', numeralBuildRounds({ keys: ['C', 'G', 'F'], degrees: [1, 2, 4, 5, 6], count: 6 })),
    ],
    { key: 'C' },
  ),
  lesson(
    'th11-2',
    'I, IV and V',
    'learn',
    'The three primary chords',
    [
      explain(
        'The primary chords',
        `Three chords matter more than the rest: **I** (the **tonic**), **IV** (the **subdominant**) and **V** (the **dominant**). They're the three major chords of the key.

Between them they hold every note of the scale: G major's G, C and D chords contain G A B C D E F♯. So any tune in the key can be accompanied with just these three, which is why so many folk songs, hymns and blues use nothing else.`,
        progression('G', [1, 4, 5, 1]),
      ),
      explore('Play them in G', 'Hold each chord. Listen to how V wants to go back to I.', [
        task('Hold I: G, B, D', C.chord('maj', { root: 'G' })),
        task('Hold IV: C, E, G', C.chord('maj', { root: 'C' })),
        task('Hold V: D, F♯, A', C.chord('maj', { root: 'D' })),
      ]),
      build('Primary chords in any key', 'Count up the scale: I is the tonic, IV four notes up, V five.', numeralBuildRounds({ keys: MAJOR_KEYS, degrees: [1, 4, 5], count: 6 })),
      quiz('By ear', 'You hear the tonic chord, then another: IV or V? IV feels like stepping away; V like leaning towards home.', 'I, IV or V?', numeralRounds({ keys: ['C', 'G', 'F'], degrees: [1, 4, 5], count: 6, mode: 'hear' }), { mode: 'hear' }),
    ],
    { key: 'G' },
  ),
  lesson(
    'th11-3',
    'Home, Away and Back',
    'learn',
    'What each chord does',
    [
      explain(
        'Every chord has a job',
        `Chords have jobs, called **functions**:

- **Tonic** (I, and vi, which shares two of its notes): home, at rest.
- **Subdominant** (IV, and ii): moving away, opening up.
- **Dominant** (V, and vii°): tension, wanting to go home.

A huge amount of music is that journey, over and over: home, away, tension, home.`,
        progression('C', [1, 4, 5, 1]),
      ),
      explain(
        'Why V wants to go home',
        `V pulls towards I for two reasons. Its root falls a 5th to the tonic, the strongest move a bass can make. And it holds the **leading note**, the 7th degree, a semitone below the tonic: in C, the B in G B D aches to rise to C.

Play V and stop. You can hear the music hanging, waiting. Then play I: resolved.`,
        fig('[G3 B3 D4] [C4 E4 G4]', { key: 'C', play: 'as-written', labels: ['V', 'I'] }),
      ),
      explore('Feel the pull', 'Hold V, let go, then hold I.', [
        task('Hold V in C: G, B, D', C.chord('maj', { root: 'G' })),
        task('Then home to I: C, E, G', C.chord('maj', { root: 'C' })),
        task('Try IV to I too: F, A, C, then C, E, G', C.chord('maj', { root: 'F' })),
      ]),
      quiz('Finished or not?', 'Does the progression come home to I, or stop in the air?', 'Finished or unfinished?', finishedRounds(6, ['C', 'G', 'F', 'D']), { mode: 'hear' }),
      quiz('Name the job', 'Tonic, subdominant or dominant?', 'Which function?', functionRounds(6, ['C', 'G', 'F'])),
    ],
    { key: 'C' },
  ),
  lesson(
    'th11-4',
    'Chords in a Minor Key',
    'learn',
    'i, iv and the borrowed leading note',
    [
      explain(
        'The minor key’s chords',
        `Build triads on the A natural minor scale and you get **i, ii°, III, iv, v, VI, VII**. The tonic chord is minor (Am), and so is iv (Dm).

But v (E G B) is a problem: it's minor, and its G is a whole tone below A, so it doesn't pull home. Composers fix this by **raising the 7th**: G becomes G♯ (the harmonic minor scale), and v becomes a major **V** (E G♯ B), with a leading note that aches up to A.`,
        fig('[E4 G4 B4] [E4 G#4 B4] [A4 C5 E5]', { key: 'Am', play: 'as-written', labels: ['v', 'V', 'i'] }),
      ),
      explain(
        'Minor-key harmony',
        `So in a minor key you'll mostly meet **i, iv and V**, with **VI**, **III** and **VII** from the natural minor for colour. The V chord's raised 7th isn't in the key signature: it's written as an accidental every time. When you see G♯s in a piece in A minor, this is why.`,
        progression('Am', [1, 4, 5, 1]),
      ),
      explore('Play them in A minor', 'Hold each chord. Notice the G♯ in V.', [
        task('Hold i: A, C, E', C.chord('min', { root: 'A' })),
        task('Hold iv: D, F, A', C.chord('min', { root: 'D' })),
        task('Hold V: E, G♯, B', C.chord('maj', { root: 'E' })),
      ]),
      quiz('Name the numeral', 'A minor key’s chords. Remember V is major, with the raised 7th.', 'Which chord is this?', numeralRounds({ keys: MINOR_KEYS, degrees: [1, 4, 5, 6], count: 6 })),
      build('Play i, iv and V', 'Raise the 7th for V.', numeralBuildRounds({ keys: MINOR_KEYS, degrees: [1, 4, 5], count: 6 })),
      quiz('Major or minor key?', 'The same progression, I – IV – V – I, in a major key or a minor one?', 'Major key or minor key?', keyModeRounds(6), { mode: 'hear' }),
    ],
    { key: 'Am' },
  ),
  lesson(
    'th11-5',
    'Famous Progressions',
    'learn',
    'I–V–vi–IV, I–vi–IV–V and ii–V–I',
    [
      explain(
        'Four chords, a thousand songs',
        `Some progressions are so useful they turn up everywhere:

- **I – V – vi – IV**: the backbone of countless pop songs.
- **I – vi – IV – V**: the 1950s doo-wop progression.
- **I – IV – V – I**: hymns, folk songs, the blues.

None of them belongs to anyone. Knowing them, you can hear a song's harmony and play along in any key.`,
        progression('C', [1, 5, 6, 4]),
      ),
      explain(
        'ii – V – I',
        `**ii – V – I** is the great cadence of jazz, and of classical music too. ii (a subdominant chord) leads to V (dominant), which resolves to I. Each root falls a 5th to the next: D to G to C.

Jazz musicians practise it in every key; once you hear it, you'll notice it everywhere.`,
        progression('C', [2, 5, 1]),
      ),
      explore('Play I – V – vi – IV in C', 'Hold each chord in turn: C, G, Am, F.', [
        task('I: C, E, G', C.chord('maj', { root: 'C' })),
        task('V: G, B, D', C.chord('maj', { root: 'G' })),
        task('vi: A, C, E', C.chord('min', { root: 'A' })),
        task('IV: F, A, C', C.chord('maj', { root: 'F' })),
      ]),
      quiz('Which progression?', 'Listen to the chords. Follow the bass, and listen for where the minor chord comes.', 'Which progression?', progressionRounds(6, ['C', 'G', 'F', 'D']), { mode: 'hear' }),
      build('Play a progression', 'One chord at a time. The readout names each numeral as you hold it.', progressionBuild(['C', 'G', 'F'])),
    ],
    { key: 'C' },
  ),
  lesson(
    'th11-c',
    'Checkpoint: Chords in a Key',
    'checkpoint',
    'Numerals, functions and progressions',
    [
      quiz('Name the numeral', '', 'Which chord is this?', numeralRounds({ keys: ['C', 'G', 'F', 'D'], degrees: [1, 2, 4, 5, 6], count: 6 })),
      build('Play the chord', '', rng => [...numeralBuildRounds({ keys: MAJOR_KEYS, degrees: [1, 4, 5, 6], count: 3 })(rng), ...numeralBuildRounds({ keys: MINOR_KEYS, degrees: [1, 5], count: 2 })(rng)]),
      quiz('Name the job', '', 'Which function?', functionRounds(4, ['C', 'G', 'D'])),
      quiz('By ear', '', 'What do you hear?', rng => [...finishedRounds(3, ['C', 'G'])(rng), ...progressionRounds(3, ['C', 'F'])(rng)], { mode: 'hear' }),
    ],
    { key: 'C' },
  ),
]);
