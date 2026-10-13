import { RH, inlinePiece, insight, interval, lesson, meet, name, play, read, tip, unit } from '../builders';
import type { ActivityDef, Insight, TrackDef } from '../types';
import { type ShapeName, allLocationsOfPitchClass, stepPitchClass } from '../../music/guitar';
import type { Step } from '../../music/pitch';

/**
 * Guitar · Fretboard Navigator — learn the neck itself: every note, every octave,
 * the CAGED shapes, pentatonic boxes and 3-notes-per-string major patterns.
 */
const G = 'treble8vb' as const;
const ALL = [1, 2, 3, 4, 5, 6];
const NATURALS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
type Frets = [number, number];

// ---- Activity helpers ----
const fretName = (strings: number[], frets: Frets, count: number, o: { accidentals?: boolean; title?: string; prompt?: string } = {}): ActivityDef =>
  ({ type: 'fret-name', strings, frets, count, naturalsOnly: !o.accidentals, title: o.title, prompt: o.prompt });
const fretPlay = (strings: number[], frets: Frets, count: number, o: { accidentals?: boolean; title?: string; prompt?: string } = {}): ActivityDef =>
  ({ type: 'fret-play', strings, frets, count, naturalsOnly: !o.accidentals, title: o.title, prompt: o.prompt });
const fretFind = (notes: string[], strings: number[], frets: Frets, o: { rounds?: number; title?: string; prompt?: string } = {}): ActivityDef =>
  ({ type: 'fret-find', notes, strings, frets, rounds: o.rounds ?? notes.length, title: o.title, prompt: o.prompt });
const fretOctave = (strings: number[], frets: Frets, count: number, o: { title?: string; prompt?: string } = {}): ActivityDef =>
  ({ type: 'fret-octave', strings, frets, count, title: o.title, prompt: o.prompt });

interface ShapeOpts { mode?: 'wait' | 'tempo'; tempo?: number; updown?: boolean; title?: string }
const shapeOpts = (o: ShapeOpts) => ({ direction: o.updown ? ('updown' as const) : ('up' as const), mode: o.mode ?? ('wait' as const), tempo: o.tempo, title: o.title });
const caged = (root: string, shape: ShapeName, o: ShapeOpts & { minor?: boolean } = {}): ActivityDef =>
  ({ type: 'fret-shape', shape: { kind: 'caged', root, shape, quality: o.minor ? 'minor' : 'major' }, ...shapeOpts(o) });
const penta = (root: string, box: number, o: ShapeOpts & { major?: boolean } = {}): ActivityDef =>
  ({ type: 'fret-shape', shape: { kind: 'pentatonic', root, box, quality: o.major ? 'major' : 'minor' }, ...shapeOpts(o) });
const nps = (root: string, startDegree: number, o: ShapeOpts = {}): ActivityDef =>
  ({ type: 'fret-shape', shape: { kind: 'scale3nps', root, startDegree, quality: 'major' }, ...shapeOpts(o) });

// ---- Visual helpers ----
type Pos = { string: number; fret: number; label?: string; finger?: number; root?: boolean };
const fretsVisual = (positions: Pos[], minFret?: number, maxFret?: number): Insight['visual'] => ({ kind: 'frets', positions, minFret, maxFret });
/** Labelled landmarks on one string: [[fret, 'G'], ...]. */
const landmarks = (string: number, marks: [number, string][]): Pos[] => marks.map(([fret, label]) => ({ string, fret, label }));
/** Every location of a natural note between two frets (the "where are all the A's" picture). */
const everywhere = (note: Step, lo = 0, hi = 12): Pos[] =>
  allLocationsOfPitchClass(stepPitchClass(note, 0), lo, hi).map(p => ({ ...p, label: note, root: true }));

/** The opening of Ode to Joy, mapped onto any fingering of E F G D C. */
const ODE = 'E E F G | G F E D | C C D E | E/q. D/e D/h | E/q E F G | G F E D | C C D E | D/q. C/e C/h';
const withDur = (tok: string, d: string) => tok.replace(/^([A-G][#b]?\d)/, `$1/${d}`);
function ode(map: Record<string, string>): string {
  return ODE.split(/\s+/)
    .map(t => (t === '|' ? '|' : t.length > 1 ? withDur(map[t[0]], t.slice(2)) : map[t]))
    .join(' ') + ' |';
}
const odeIn = (title: string, map: Record<string, string>, o: { mode?: 'wait' | 'tempo'; tempo?: number } = {}) =>
  inlinePiece(title, 'C', [4, 4], [{ clef: G, voices: [ode(map)] }], o);
const ODE_POS1 = { E: 'E4@0%1', F: 'F4@1%1', G: 'G4@3%1', D: 'D4@3%2', C: 'C4@1%2' };
const ODE_POS5 = { E: 'E4@1%2', F: 'F4@2%2', G: 'G4@4%2', D: 'D4@3%3', C: 'C4@1%3' };
const ODE_POS7 = { E: 'E4@3%3', F: 'F4@4%3', G: 'G4@2%2', D: 'D4@1%3', C: 'C4@4%4' };

const MELODY = 'C4 D4 E4 F4 G4'; // the Ode-to-Joy notes
const POS1_POOL = 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4';
const POS5_C = 'C3 D3 E3 F3 G3 A3 C4 D4 E4 F4 G4 A4 B4 C5';
const POS7_G = 'B2 C3 D3 E3 F#3 G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5';
const POS5_POOL = 'A2 B2 C3 D3 E3 F3 G3 A3 C4 D4 E4';

export const guitarFretboard: TrackDef = {
  id: 'guitar-fretboard',
  instrument: 'guitar',
  title: 'Fretboard Navigator',
  subtitle: 'Guitar · Know every note',
  description: 'Know the neck cold: every note on every string, octave shapes, “where are all the A’s”, CAGED chords, pentatonic boxes, the seven major-scale patterns and the upper frets.',
  clef: 'fretboard',
  accent: '#3cc8c8',
  glyph: '◉',
  heatmap: [{ clef: 'treble8vb', low: 'E2', high: 'E5' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('gf1', 'The Musical Alphabet', 'Seven letters, six open strings, and frets as half steps.', [
      lesson('gf1-1', 'Six Open Strings', 'learn', 'E A D G B E — from the thickest string', [
        meet(G, 'E2 A2 D3 G3 B3 E4', {
          frets: [{ string: 6, fret: 0, finger: 0 }, { string: 5, fret: 0, finger: 0 }, { string: 4, fret: 0, finger: 0 }, { string: 3, fret: 0, finger: 0 }, { string: 2, fret: 0, finger: 0 }, { string: 1, fret: 0, finger: 0 }],
          tips: ['String 6: low E — the thickest string.', 'String 5: A.', 'String 4: D.', 'String 3: G.', 'String 2: B.', 'String 1: high E — two octaves above string 6.'],
          reps: 2,
        }),
        fretName(ALL, [0, 0], 12, { title: 'Name the open string' }),
      ], [
        insight('The musical alphabet', 'Music uses seven letters — A B C D E F G — and then starts again at A. Each time round is an octave: same letter, higher sound.'),
        insight('E A D G B E', 'From the thickest string: E A D G B E — “Eddie Ate Dynamite, Good Bye Eddie.” Strings are numbered from the thinnest: string 1 is high E, string 6 is low E.', fretsVisual(landmarks(6, [[0, 'E']]).concat(landmarks(5, [[0, 'A']]), landmarks(4, [[0, 'D']]), landmarks(3, [[0, 'G']]), landmarks(2, [[0, 'B']]), landmarks(1, [[0, 'E']])), 0, 5)),
      ]),
      lesson('gf1-2', 'Frets Are Half Steps', 'learn', 'Count up the neck letter by letter', [
        tip('Half and whole steps', 'Each fret raises the note one half step; two frets make a whole step. Most letters are a whole step apart — but B–C and E–F are only one fret apart.', fretsVisual(landmarks(5, [[0, 'A'], [2, 'B'], [3, 'C'], [5, 'D'], [7, 'E'], [8, 'F'], [10, 'G'], [12, 'A']]), 0, 12)),
        fretName([5, 6], [0, 5], 12),
        fretPlay([5, 6], [0, 5], 8),
      ]),
      lesson('gf1-3', 'The First-Position Map', 'practice', 'Every natural note in frets 0–3', [
        fretName(ALL, [0, 3], 16),
        fretPlay(ALL, [0, 3], 10),
        fretName(ALL, [0, 3], 16, { title: 'Faster', prompt: 'Answer as soon as you see the dot.' }),
      ]),
      lesson('gf1-c', 'Checkpoint: The Alphabet', 'checkpoint', 'Open strings and first-position naturals', [
        fretName(ALL, [0, 0], 8),
        fretName(ALL, [0, 3], 16),
        fretPlay(ALL, [0, 3], 10),
      ]),
    ], ['E A D G B E', 'Half steps', 'B–C & E–F']),

    // ------------------------------------------------------------------ 2
    unit('gf2', 'Sixth-String Landmarks', 'Every natural note on low E, from the nut to the 12th fret.', [
      lesson('gf2-1', 'Follow the Dots', 'learn', 'G 3 · A 5 · B 7 · C 8 · D 10 · E 12', [
        fretName([6], [0, 12], 12),
        fretPlay([6], [0, 12], 8),
      ], [
        insight('The dots are road signs', 'The fret markers are your landmarks. On the 6th string: 3 = G, 5 = A, 7 = B, 8 = C, 10 = D, and the double dot at 12 = E, an octave above the open string.', fretsVisual(landmarks(6, [[0, 'E'], [1, 'F'], [3, 'G'], [5, 'A'], [7, 'B'], [8, 'C'], [10, 'D'], [12, 'E']]), 0, 12)),
      ]),
      lesson('gf2-2', 'Fill the Gaps', 'practice', 'Use the landmarks to find the rest', [
        tip('Step from a landmark', 'F is one fret above E. Everything else on this string sits two frets from its neighbours — except B–C (frets 7–8).'),
        fretName([6], [0, 12], 16),
        fretFind(['G', 'A', 'C'], [6], [0, 12]),
      ]),
      lesson('gf2-3', 'Sixth-String Roots', 'practice', 'The notes that name your chords and scales', [
        tip('Why this string matters', 'Barre chords, power chords and many scale patterns are named after their lowest note on the 6th string. Know it cold and you can find G at 3, A at 5 or C at 8 without thinking.'),
        fretFind(['B', 'D', 'E', 'F'], [6], [0, 12]),
        fretPlay([6], [0, 12], 12),
      ]),
      lesson('gf2-c', 'Checkpoint: Sixth String', 'checkpoint', 'Name and play every natural on string 6', [
        fretName([6], [0, 12], 16),
        fretPlay([6], [0, 12], 10),
      ]),
    ], ['String 6', 'Fret markers']),

    // ------------------------------------------------------------------ 3
    unit('gf3', 'Fifth-String Landmarks', 'The A string — and both bass strings together.', [
      lesson('gf3-1', 'Landmarks on A', 'learn', 'C 3 · D 5 · E 7 · G 10 · A 12', [
        fretName([5], [0, 12], 12),
        fretPlay([5], [0, 12], 8),
      ], [
        insight('The A string', 'On the 5th string: 2 = B, 3 = C, 5 = D, 7 = E, 8 = F, 10 = G, 12 = A. Notice C and F — each sits one fret above B and E.', fretsVisual(landmarks(5, [[0, 'A'], [2, 'B'], [3, 'C'], [5, 'D'], [7, 'E'], [8, 'F'], [10, 'G'], [12, 'A']]), 0, 12)),
      ]),
      lesson('gf3-2', 'Fill the Gaps', 'practice', 'Every natural on string 5', [
        fretName([5], [0, 12], 16),
        fretFind(['B', 'C', 'F'], [5], [0, 12]),
      ]),
      lesson('gf3-3', 'Two Bass Strings', 'practice', 'Strings 5 and 6 together', [
        tip('Across the same fret', 'At any fret, the 5th string is four letters above the 6th: fret 3 = G and C, fret 5 = A and D, fret 7 = B and E.', fretsVisual([...landmarks(6, [[3, 'G'], [5, 'A'], [7, 'B']]), ...landmarks(5, [[3, 'C'], [5, 'D'], [7, 'E']])], 0, 9)),
        fretName([5, 6], [0, 12], 20),
        fretPlay([5, 6], [0, 12], 12),
      ]),
      lesson('gf3-c', 'Checkpoint: Bass Strings', 'checkpoint', 'Strings 5 and 6, frets 0–12', [
        fretName([5, 6], [0, 12], 20),
        fretPlay([5, 6], [0, 12], 12),
      ]),
    ], ['String 5', 'Bass-string map']),

    // ------------------------------------------------------------------ 4
    unit('gf4', 'Octave Shapes', 'Carry any note across the neck with three simple shapes.', [
      lesson('gf4-1', 'Two Strings Over, Two Frets Up', 'learn', 'Octaves from strings 6 and 5', [
        fretOctave([5, 6], [0, 10], 10),
      ], [
        insight('The basic octave shape', 'From the 6th or 5th string, the octave is two strings higher and two frets up: A at 6/5 → A at 4/7; C at 5/3 → C at 3/5. Fingers 1 and 3 (or 4).', fretsVisual([{ string: 6, fret: 5, label: 'A', root: true }, { string: 4, fret: 7, label: 'A' }, { string: 5, fret: 3, label: 'C', root: true }, { string: 3, fret: 5, label: 'C' }], 0, 9)),
      ]),
      lesson('gf4-2', 'The B-String Shift', 'learn', 'Octaves from strings 4 and 3', [
        fretOctave([3, 4], [0, 9], 10),
      ], [
        insight('Crossing onto the B string', 'The 2nd string is tuned one fret “lower” than the pattern expects, so any shape that lands on it moves up a fret. From the 4th or 3rd string the octave is two strings higher and THREE frets up: E at 4/2 → 2/5; A at 3/2 → 1/5.', fretsVisual([{ string: 4, fret: 2, label: 'E', root: true }, { string: 2, fret: 5, label: 'E' }, { string: 3, fret: 2, label: 'A', root: true }, { string: 1, fret: 5, label: 'A' }], 0, 7)),
      ]),
      lesson('gf4-3', 'Octaves Down & Two-Octave Twins', 'learn', 'Reverse the shapes; strings 6 and 1 match', [
        fretOctave([1, 2], [3, 12], 10, { title: 'Find the octave below', prompt: 'Reverse the B-string shape: from string 1 or 2, go two strings down and three frets back.' }),
        fretName([1, 6], [0, 12], 14, { title: 'Twin strings', prompt: 'Strings 6 and 1 share every note name at the same fret.' }),
      ], [
        insight('Two octaves apart', 'The 6th and 1st strings are both E, two octaves apart, so any note on the 6th string sits at the same fret on the 1st. Between them you’ll find the middle octave with the first shape.', fretsVisual([{ string: 6, fret: 3, label: 'G', root: true }, { string: 4, fret: 5, label: 'G' }, { string: 1, fret: 3, label: 'G' }], 0, 7)),
      ]),
      lesson('gf4-4', 'Octave Chains', 'practice', 'Link the shapes across all six strings', [
        tip('Chaining', 'Chain the shapes to carry one note across the neck: G at 6/3 → 4/5 → 2/8, and back down to 1/3. Each hop is “two strings, two frets” — three frets when you land on the B string.', fretsVisual([{ string: 6, fret: 3, label: 'G', root: true }, { string: 4, fret: 5, label: 'G' }, { string: 2, fret: 8, label: 'G' }, { string: 1, fret: 3, label: 'G' }, { string: 3, fret: 0, label: 'G' }], 0, 10)),
        fretOctave(ALL, [0, 12], 15),
        fretFind(['G'], ALL, [0, 12]),
      ]),
      lesson('gf4-c', 'Checkpoint: Octaves', 'checkpoint', 'Find the octave of anything', [
        fretOctave(ALL, [0, 12], 15),
        fretFind(['C', 'A'], ALL, [0, 12]),
      ]),
    ], ['Octave shapes', 'B-string shift']),

    // ------------------------------------------------------------------ 5
    unit('gf5', 'Find All the Notes', 'Where are all the A’s? Every natural note, everywhere in frets 0–12.', [
      lesson('gf5-1', 'Every A and E', 'learn', 'The open-string notes', [
        fretFind(['A'], ALL, [0, 12]),
        fretFind(['E'], ALL, [0, 12]),
      ], [
        insight('All the A’s', 'Every note appears on every string — usually twice below the 12th fret. Find them with what you know: the landmark on string 6 or 5, the octave shapes, and the open strings.', fretsVisual(everywhere('A'), 0, 12)),
      ]),
      lesson('gf5-2', 'Every D and G', 'practice', 'Two more open-string notes', [
        tip('Use the octave shapes', 'Start from the lowest D (open 4th string) or G (6th string, 3rd fret) and hop up with “two strings, two frets” — three frets onto the B string.', fretsVisual(everywhere('G'), 0, 12)),
        fretFind(['D'], ALL, [0, 12]),
        fretFind(['G'], ALL, [0, 12]),
      ]),
      lesson('gf5-3', 'Every C and F', 'practice', 'The notes just above B and E', [
        tip('Next to B and E', 'C and F always sit one fret above B and E — the two natural half steps. Find a B or E, move up one fret, and you’re there.', fretsVisual(everywhere('C'), 0, 12)),
        fretFind(['C'], ALL, [0, 12]),
        fretFind(['F'], ALL, [0, 12]),
      ]),
      lesson('gf5-4', 'Every B — and the Mix', 'practice', 'All seven naturals', [
        fretFind(['B'], ALL, [0, 12]),
        fretFind(NATURALS, ALL, [0, 12], { title: 'All seven' }),
      ]),
      lesson('gf5-c', 'Checkpoint: Every Note', 'checkpoint', 'Find any natural anywhere', [
        fretFind(['F', 'D', 'B', 'G', 'C'], ALL, [0, 12]),
      ]),
    ], ['All the A’s', 'Every natural']),

    // ------------------------------------------------------------------ 6
    unit('gf6', 'The Treble Strings', 'Strings 4, 3, 2 and 1 — the whole neck in naturals.', [
      lesson('gf6-1', 'The Fourth String', 'learn', 'D: E 2 · F 3 · G 5 · A 7 · B 9 · C 10 · D 12', [
        fretName([4], [0, 12], 12),
        fretPlay([4], [0, 12], 8),
      ], [
        insight('The D string', 'Use the octave shape: the 4th string is the 6th string’s notes moved over two strings and up two frets. Landmarks: 5 = G, 7 = A, 10 = C, 12 = D.', fretsVisual(landmarks(4, [[0, 'D'], [2, 'E'], [3, 'F'], [5, 'G'], [7, 'A'], [9, 'B'], [10, 'C'], [12, 'D']]), 0, 12)),
      ]),
      lesson('gf6-2', 'The Third String', 'learn', 'G: A 2 · B 4 · C 5 · D 7 · E 9 · F 10 · G 12', [
        fretName([3], [0, 12], 12),
        fretPlay([3], [0, 12], 8),
      ], [
        insight('The G string', 'The 3rd string mirrors the 5th string two frets up. Landmarks: 5 = C, 7 = D, 9 = E, 12 = G.', fretsVisual(landmarks(3, [[0, 'G'], [2, 'A'], [4, 'B'], [5, 'C'], [7, 'D'], [9, 'E'], [10, 'F'], [12, 'G']]), 0, 12)),
      ]),
      lesson('gf6-3', 'The Second String', 'learn', 'B: C 1 · D 3 · E 5 · F 6 · G 8 · A 10 · B 12', [
        fretName([2], [0, 12], 12),
        fretPlay([2], [0, 12], 8),
      ], [
        insight('The B string', 'Landmarks: 1 = C, 3 = D, 5 = E (same as the open 1st string), 8 = G, 10 = A, 12 = B.', fretsVisual(landmarks(2, [[0, 'B'], [1, 'C'], [3, 'D'], [5, 'E'], [6, 'F'], [8, 'G'], [10, 'A'], [12, 'B']]), 0, 12)),
      ]),
      lesson('gf6-4', 'The First String', 'learn', 'Same as the sixth, two octaves up', [
        tip('Free knowledge', 'The 1st string has exactly the same note names as the 6th: 3 = G, 5 = A, 7 = B, 8 = C, 10 = D, 12 = E.', fretsVisual(landmarks(1, [[0, 'E'], [1, 'F'], [3, 'G'], [5, 'A'], [7, 'B'], [8, 'C'], [10, 'D'], [12, 'E']]), 0, 12)),
        fretName([1], [0, 12], 12),
        fretPlay([1], [0, 12], 8),
      ]),
      lesson('gf6-5', 'All Six Strings', 'practice', 'The whole neck in naturals', [
        fretName(ALL, [0, 12], 24),
        fretPlay(ALL, [0, 12], 14),
      ]),
      lesson('gf6-c', 'Checkpoint: The Whole Neck', 'checkpoint', 'Every natural, every string, frets 0–12', [
        fretName(ALL, [0, 12], 24),
        fretPlay(ALL, [0, 12], 14),
      ]),
    ], ['Strings 4–1', 'Whole-neck naturals']),

    // ------------------------------------------------------------------ 7
    unit('gf7', 'Sharps & Flats Everywhere', 'The frets between the naturals — and their two names.', [
      lesson('gf7-1', 'One Fret Up, One Fret Down', 'learn', 'Sharps and flats on the bass strings', [
        fretName([5, 6], [0, 12], 14, { accidentals: true }),
        fretPlay([5, 6], [0, 12], 10, { accidentals: true }),
      ], [
        insight('Two names, one fret', 'One fret above G is G♯; one fret below A is A♭ — the same fret, the same sound. Every fret between two naturals has both names. B–C and E–F have no fret between them.', fretsVisual(landmarks(6, [[3, 'G'], [4, 'G♯/A♭'], [5, 'A'], [6, 'A♯/B♭'], [7, 'B'], [8, 'C']]), 0, 9)),
      ]),
      lesson('gf7-2', 'Treble-String Accidentals', 'practice', 'Strings 4 to 1', [
        fretName([1, 2, 3, 4], [0, 12], 16, { accidentals: true }),
        fretPlay([1, 2, 3, 4], [0, 12], 10, { accidentals: true }),
      ]),
      lesson('gf7-3', 'Find the Accidentals', 'practice', 'F♯, B♭, C♯, E♭ and G♯ everywhere', [
        tip('Find the natural first', 'To find every B♭, find every A or B and move one fret. The octave shapes work for sharps and flats exactly as for naturals.'),
        fretFind(['F#', 'Bb'], ALL, [0, 12]),
        fretFind(['C#', 'Eb', 'G#'], ALL, [0, 12]),
      ]),
      lesson('gf7-4', 'The Chromatic Neck', 'practice', 'Every fret, every string', [
        fretName(ALL, [0, 12], 24, { accidentals: true }),
        fretOctave(ALL, [0, 12], 10),
      ]),
      lesson('gf7-c', 'Checkpoint: Sharps & Flats', 'checkpoint', 'Name and find any note', [
        fretName(ALL, [0, 12], 20, { accidentals: true }),
        fretPlay(ALL, [0, 12], 10, { accidentals: true }),
        fretFind(['Ab', 'D#'], ALL, [0, 12]),
      ]),
    ], ['♯ / ♭ on the neck', 'Enharmonics']),

    // ------------------------------------------------------------------ 8
    unit('gf8', 'Speed Drills', 'Turn knowledge into instant recall.', [
      lesson('gf8-1', 'Bass-String Sprint', 'practice', 'Strings 5 and 6 at speed', [
        fretName([5, 6], [0, 12], 30, { accidentals: true, title: 'Sprint' }),
        fretPlay([5, 6], [0, 12], 15, { accidentals: true }),
      ]),
      lesson('gf8-2', 'Treble-String Sprint', 'practice', 'Strings 1 to 4 at speed', [
        fretName([1, 2, 3, 4], [0, 12], 30, { accidentals: true, title: 'Sprint' }),
        fretPlay([1, 2, 3, 4], [0, 12], 15, { accidentals: true }),
      ]),
      lesson('gf8-3', 'Staff to Fretboard', 'practice', 'Connect notation with the neck', [
        tip('Read it, place it', 'Now connect the neck with notation: read each note and play it at the first place your eyes find — then try another place for the same pitch.'),
        play(G, 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5', 16),
        name(G, 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5', 20, { sequence: true, title: 'Note rush' }),
        read(G, MELODY, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, title: 'Read it in 5th position' }),
      ]),
      lesson('gf8-4', 'Whole-Neck Lightning', 'challenge', 'Forty notes, no hesitation', [
        fretName(ALL, [0, 12], 40, { accidentals: true, title: 'Lightning round' }),
        fretPlay(ALL, [0, 12], 20, { accidentals: true }),
      ]),
      lesson('gf8-c', 'Checkpoint: Speed', 'checkpoint', 'Fast and accurate everywhere', [
        fretName(ALL, [0, 12], 30, { accidentals: true }),
        fretPlay(ALL, [0, 12], 15, { accidentals: true }),
        fretFind(['E', 'Bb', 'D', 'F#'], ALL, [0, 12]),
      ]),
    ], ['Instant recall', 'Staff ↔ neck']),

    // ------------------------------------------------------------------ 9
    unit('gf9', 'CAGED Chord Shapes', 'Five open-chord shapes that tile the whole neck.', [
      lesson('gf9-1', 'The C and A Shapes', 'learn', 'C major, open and at the 3rd fret', [
        caged('C', 'C'),
        caged('C', 'A'),
        fretFind(['C'], ALL, [0, 5], { title: 'Find the roots', prompt: 'Every C between the nut and the 5th fret — the roots of both shapes.' }),
      ], [
        insight('CAGED', 'The open chords C, A, G, E and D are five shapes. Slide a shape up the neck and it becomes a new chord. The five shapes of any one chord link together up the neck in the order C → A → G → E → D, then start again.', fretsVisual([{ string: 5, fret: 3, finger: 3, root: true, label: 'C' }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 1, finger: 1, root: true, label: 'C' }, { string: 1, fret: 0 }], 0, 5)),
        insight('Roots first', 'Every shape is built around its root notes (highlighted). Find the root on the neck first — the rest of the shape hangs around it.'),
      ]),
      lesson('gf9-2', 'The G and E Shapes', 'learn', 'C major at the 5th and 8th frets', [
        tip('The E shape', 'The E shape is the classic barre chord: the open E chord moved up so the index finger barres at the root. Root on the 6th string — C at the 8th fret.'),
        caged('C', 'G'),
        caged('C', 'E'),
      ]),
      lesson('gf9-3', 'The D Shape & the Full Cycle', 'learn', 'C major from the nut to the 13th fret', [
        caged('C', 'D'),
        tip('The cycle', 'C major all the way up: C shape (open) → A shape (3rd fret) → G shape (5th) → E shape (8th) → D shape (10th) → C shape again at the 12th. Each shape shares notes with the next.'),
        caged('C', 'A', { mode: 'tempo', tempo: 66, updown: true }),
        caged('C', 'E', { mode: 'tempo', tempo: 66, updown: true }),
      ]),
      lesson('gf9-4', 'Moving the Shapes', 'practice', 'G, A, D and E major around the neck', [
        tip('Same shapes, new roots', 'Find the new root, then hang the shape on it. G: E shape at the 3rd fret, D shape at the 5th. A: open A shape, E shape at the 5th. D: open D shape, A shape at the 5th. E: open E shape, A shape at the 7th.'),
        caged('G', 'E'),
        caged('G', 'D'),
        caged('A', 'E'),
        caged('D', 'A'),
        caged('E', 'A'),
      ]),
      lesson('gf9-5', 'Minor Shapes', 'learn', 'Lower the third', [
        caged('A', 'E', { minor: true }),
        caged('A', 'A', { minor: true }),
        caged('E', 'A', { minor: true }),
        caged('D', 'D', { minor: true }),
      ], [
        insight('Major to minor', 'A minor chord is a major chord with its 3rd lowered one fret. The Em, Am and Dm shapes move up the neck exactly like the major shapes: Am barre at the 5th fret (E shape), Em at the 7th (A shape).', fretsVisual([{ string: 6, fret: 5, root: true, label: 'A' }, { string: 5, fret: 7 }, { string: 4, fret: 7, root: true, label: 'A' }, { string: 3, fret: 5, label: 'C' }, { string: 2, fret: 5 }, { string: 1, fret: 5, root: true, label: 'A' }], 3, 9)),
      ]),
      lesson('gf9-c', 'Checkpoint: CAGED', 'checkpoint', 'Shapes in time', [
        caged('C', 'G', { mode: 'tempo', tempo: 72, updown: true }),
        caged('G', 'E', { mode: 'tempo', tempo: 72, updown: true }),
        caged('A', 'E', { minor: true, mode: 'tempo', tempo: 72, updown: true }),
        caged('D', 'C', { mode: 'tempo', tempo: 66 }),
      ]),
    ], ['C A G E D', 'Moving shapes', 'Minor shapes']),

    // ------------------------------------------------------------------ 10
    unit('gf10', 'Pentatonic Boxes', 'The five boxes of A minor pentatonic — then E minor and G major.', [
      lesson('gf10-1', 'Box 1: A Minor Pentatonic', 'learn', 'The most-played shape on the guitar', [
        penta('A', 0),
        penta('A', 0, { updown: true }),
        fretFind(['A'], ALL, [5, 8], { title: 'Find the roots', prompt: 'Every A in box 1 (frets 5–8).' }),
      ], [
        insight('Five notes, two per string', 'A minor pentatonic is A C D E G. Box 1 starts on the 6th-string root at the 5th fret: two notes per string, fingers 1 and 4 on the outer strings, 1 and 3 in the middle.', fretsVisual([
          { string: 6, fret: 5, root: true, label: 'A' }, { string: 6, fret: 8, label: 'C' }, { string: 5, fret: 5, label: 'D' }, { string: 5, fret: 7, label: 'E' },
          { string: 4, fret: 5, label: 'G' }, { string: 4, fret: 7, root: true, label: 'A' }, { string: 3, fret: 5, label: 'C' }, { string: 3, fret: 7, label: 'D' },
          { string: 2, fret: 5, label: 'E' }, { string: 2, fret: 8, label: 'G' }, { string: 1, fret: 5, root: true, label: 'A' }, { string: 1, fret: 8, label: 'C' },
        ], 3, 10)),
      ]),
      lesson('gf10-2', 'Boxes 2 and 3', 'learn', 'Climbing from the 7th to the 13th fret', [
        tip('Overlapping boxes', 'Each box starts where the last one’s upper notes were. Box 2 begins on C (6th string, 8th fret); box 3 on D (10th fret).'),
        penta('A', 1),
        penta('A', 2),
      ]),
      lesson('gf10-3', 'Boxes 4 and 5', 'learn', 'Completing the cycle', [
        tip('Around again', 'Box 4 begins on E at the 12th fret. Box 5 begins on G — at the 3rd fret, just below box 1 (and again at the 15th). Then box 1 repeats at the 17th.'),
        penta('A', 3),
        penta('A', 4),
      ]),
      lesson('gf10-4', 'Connecting the Boxes', 'practice', 'Move freely between boxes', [
        penta('A', 4, { mode: 'tempo', tempo: 72, updown: true }),
        penta('A', 0, { mode: 'tempo', tempo: 72, updown: true }),
        penta('A', 1, { mode: 'tempo', tempo: 72, updown: true }),
        fretFind(['A', 'E'], ALL, [0, 15], { title: 'Roots and fifths', prompt: 'The A’s and E’s anchor every box.' }),
      ]),
      lesson('gf10-5', 'E Minor & G Major Pentatonic', 'learn', 'One set of notes, two home notes', [
        penta('E', 0),
        penta('E', 1),
        penta('G', 0, { major: true }),
      ], [
        insight('Relative pentatonics', 'E minor pentatonic (E G A B D) and G major pentatonic (G A B D E) are the same five notes — only the home note changes. E minor’s box 1 is in open position; G major’s main box starts on G at the 3rd fret.'),
      ]),
      lesson('gf10-c', 'Checkpoint: Pentatonics', 'checkpoint', 'Boxes in time', [
        penta('A', 0, { mode: 'tempo', tempo: 84, updown: true }),
        penta('A', 2, { mode: 'tempo', tempo: 76, updown: true }),
        penta('E', 0, { mode: 'tempo', tempo: 84, updown: true }),
        penta('G', 1, { major: true, mode: 'tempo', tempo: 72 }),
      ]),
    ], ['5 boxes', 'Minor & major pentatonic']),

    // ------------------------------------------------------------------ 11
    unit('gf11', 'Major Scale Patterns', 'Seven 3-notes-per-string patterns that cover the neck.', [
      lesson('gf11-1', 'Three Notes per String', 'learn', 'Pattern 1 in G major', [
        nps('G', 0),
        nps('G', 0, { updown: true }),
      ], [
        insight('Seven patterns', 'Three notes on every string gives seven patterns — one starting on each note of the scale. They’re built for flow: same fingering on neighbouring strings, a stretch where needed. Pattern 1 in G starts on G at the 3rd fret of the 6th string.', fretsVisual([
          { string: 6, fret: 3, root: true, label: 'G' }, { string: 6, fret: 5 }, { string: 6, fret: 7 },
          { string: 5, fret: 3 }, { string: 5, fret: 5 }, { string: 5, fret: 7 },
          { string: 4, fret: 4 }, { string: 4, fret: 5, root: true, label: 'G' }, { string: 4, fret: 7 },
          { string: 3, fret: 4 }, { string: 3, fret: 5 }, { string: 3, fret: 7 },
          { string: 2, fret: 5 }, { string: 2, fret: 7 }, { string: 2, fret: 8, root: true, label: 'G' },
          { string: 1, fret: 5 }, { string: 1, fret: 7 }, { string: 1, fret: 8 },
        ], 2, 9)),
      ]),
      lesson('gf11-2', 'Patterns 2 and 3', 'learn', 'Starting on A and B', [
        nps('G', 1),
        nps('G', 2),
      ]),
      lesson('gf11-3', 'Patterns 4 to 7', 'practice', 'Starting on C, D, E and F♯', [
        tip('Up the neck and back', 'Patterns 4 (C, 8th fret) and 5 (D, 10th fret) climb higher; pattern 6 starts on open E and pattern 7 on F♯ at the 2nd fret — the neck wraps around.'),
        nps('G', 3),
        nps('G', 4),
        nps('G', 5),
        nps('G', 6),
      ]),
      lesson('gf11-4', 'The Patterns in C', 'practice', 'Same shapes, new key', [
        tip('Move the key', 'For C major, every pattern moves up five frets from G (or down seven). Pattern 1 in C starts on C at the 8th fret.'),
        nps('C', 0, { mode: 'tempo', tempo: 66 }),
        nps('C', 2, { mode: 'tempo', tempo: 66 }),
        nps('C', 5, { mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gf11-c', 'Checkpoint: Scale Patterns', 'checkpoint', 'Patterns in time, two keys', [
        nps('G', 0, { mode: 'tempo', tempo: 84, updown: true }),
        nps('G', 3, { mode: 'tempo', tempo: 76, updown: true }),
        nps('C', 6, { mode: 'tempo', tempo: 72 }),
      ]),
    ], ['3 notes per string', 'G & C major']),

    // ------------------------------------------------------------------ 12
    unit('gf12', 'Intervals & Positions', 'See intervals as shapes; play one melody in three places.', [
      lesson('gf12-1', 'Shapes of Intervals', 'learn', 'Fifths, octaves and thirds on the neck', [
        interval(G, POS5_POOL, [3, 5, 8], 10, { harmonic: true }),
        read(G, POS5_POOL, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.4, intervals: [5, 8] }, title: 'Fifths and octaves in 5th position' }),
      ], [
        insight('Fifths and octaves', 'A 5th is the power-chord shape: next string up, two frets higher. An octave is two strings up, two frets higher (three when you land on the B string).', fretsVisual([{ string: 6, fret: 5, root: true, label: 'A' }, { string: 5, fret: 7, label: '5th' }, { string: 4, fret: 7, label: '8ve' }], 3, 9)),
        insight('Thirds', 'A major 3rd is the next string up, one fret lower; a minor 3rd is the next string up, two frets lower. Crossing from the G to the B string, add one fret: the major 3rd is at the same fret.', fretsVisual([{ string: 5, fret: 3, root: true, label: 'C' }, { string: 4, fret: 2, label: 'E' }, { string: 3, fret: 5, root: true, label: 'C' }, { string: 2, fret: 5, label: 'E' }], 0, 7)),
      ]),
      lesson('gf12-2', 'One Melody, Three Places', 'practice', 'Ode to Joy in 1st, 5th and 7th position', [
        tip('Same notes, new map', 'The same pitches sit in different places: in 1st position the tune lives on strings 1–2; in 5th on strings 2–3; in 7th on strings 2–4. Watch the string numbers.'),
        odeIn('Ode to Joy — 1st position', ODE_POS1),
        odeIn('Ode to Joy — 5th position', ODE_POS5),
        odeIn('Ode to Joy — 7th position', ODE_POS7),
      ]),
      lesson('gf12-3', 'Reading in Three Positions', 'practice', 'Sight-read with the hand at frets 1, 5 and 7', [
        tip('Choose a position, stay there', 'Before you play, find where the passage lies best and park the hand: index finger on the position fret, one finger per fret. The fingering numbers show the plan.'),
        read(G, POS1_POOL, { guitarPosition: 1, rhythms: RH.eighths, maxLeap: 2, title: 'Position 1 — C major' }),
        read(G, POS5_C, { guitarPosition: 5, rhythms: RH.eighths, maxLeap: 2, title: 'Position 5 — C major' }),
        read(G, POS7_G, { key: 'G', guitarPosition: 7, rhythms: RH.eighths, maxLeap: 2, title: 'Position 7 — G major' }),
      ]),
      lesson('gf12-4', 'Octaves & Tenths', 'practice', 'Wide intervals as fixed shapes', [
        fretOctave(ALL, [0, 12], 12),
        read(G, POS5_POOL, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.45, intervals: [8, 10] }, title: 'Octaves and tenths' }),
      ]),
      lesson('gf12-c', 'Checkpoint: Intervals & Positions', 'checkpoint', 'Shapes, positions and reading', [
        interval(G, POS5_POOL, [3, 5, 6, 8], 12, { harmonic: true }),
        odeIn('Ode to Joy — 5th position', ODE_POS5, { mode: 'tempo', tempo: 84 }),
        read(G, POS7_G, { key: 'G', guitarPosition: 7, rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['Interval shapes', 'Positions 1 · 5 · 7']),

    // ------------------------------------------------------------------ 13
    unit('gf13', 'Beyond the 12th Fret', 'The upper neck mirrors the lower — then the final exam.', [
      lesson('gf13-1', 'The Neck Starts Over', 'learn', 'Frets 12–19 = frets 0–7, an octave up', [
        fretName(ALL, [12, 19], 16),
        fretPlay(ALL, [12, 19], 10),
      ], [
        insight('Twelve frets up', 'Above the 12th fret everything repeats an octave higher: fret 12 = the open string, 15 = fret 3, 17 = fret 5, 19 = fret 7. The double dot at 12 is your new “nut”.', fretsVisual([...landmarks(6, [[12, 'E'], [15, 'G'], [17, 'A'], [19, 'B']]), ...landmarks(5, [[12, 'A'], [14, 'B'], [15, 'C'], [17, 'D'], [19, 'E']])], 12, 19)),
      ]),
      lesson('gf13-2', 'High Landmarks', 'practice', 'Find notes on the upper neck', [
        fretFind(['E', 'A'], ALL, [12, 19]),
        fretFind(['C', 'G', 'D'], ALL, [12, 19]),
        fretName(ALL, [12, 19], 14, { accidentals: true }),
      ]),
      lesson('gf13-3', 'High Octaves & Reading', 'practice', 'Octave shapes and notation above the 12th fret', [
        fretOctave(ALL, [7, 16], 12),
        read(G, 'E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5', { guitarPosition: 12, rhythms: RH.qh, maxLeap: 2, title: 'Reading in 12th position' }),
      ]),
      lesson('gf13-4', 'Whole-Neck Mastery', 'challenge', 'Nut to 19th fret', [
        fretName(ALL, [0, 19], 40, { accidentals: true, title: 'Lightning round' }),
        fretFind(['F#', 'Bb', 'D', 'G'], ALL, [0, 19]),
      ]),
      lesson('gf13-c', 'Final Exam: Fretboard Navigator', 'checkpoint', 'Prove you know the neck', [
        fretName(ALL, [0, 19], 30, { accidentals: true }),
        fretOctave(ALL, [0, 12], 12),
        fretFind(['C#', 'F', 'A'], ALL, [0, 15]),
        caged('G', 'C', { mode: 'tempo', tempo: 72, updown: true }),
        penta('A', 2, { mode: 'tempo', tempo: 84, updown: true }),
        nps('G', 4, { mode: 'tempo', tempo: 80, updown: true }),
      ]),
    ], ['Frets 12–19', 'Mastery']),
  ],
};
