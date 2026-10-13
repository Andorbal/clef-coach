import { RH, inlinePiece, insight, interval, lesson, meet, piece, read, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, Insight, TrackDef } from '../types';
import { allLocationsOfPitchClass, stepPitchClass } from '../../music/guitar';
import { TUNINGS } from '../../music/instruments';
import type { TimeSig } from '../../music/rhythm';
import type { Step } from '../../music/pitch';

/**
 * Bass guitar · Fretboard & Grooves — learn the bass neck itself: every note to the
 * 12th fret, octave shapes, the root–5th–octave box, arpeggio shapes, pentatonic boxes,
 * major and minor scale patterns and chromatic approach notes.
 *
 * Strings are numbered from the thinnest: 1 = G, 2 = D, 3 = A, 4 = low E. Pitches are
 * sounding pitches; the bass8vb clef writes them an octave higher.
 */
const B = 'bass8vb' as const;
const ALL = [1, 2, 3, 4];
const BASS4 = TUNINGS.bass4.open;
type Frets = [number, number];

const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

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
const penta = (root: string, box: number, o: ShapeOpts & { major?: boolean } = {}): ActivityDef =>
  ({ type: 'fret-shape', shape: { kind: 'pentatonic', root, box, quality: o.major ? 'major' : 'minor' }, ...shapeOpts(o) });
const nps = (root: string, startDegree: number, o: ShapeOpts & { minor?: boolean } = {}): ActivityDef =>
  ({ type: 'fret-shape', shape: { kind: 'scale3nps', root, startDegree, quality: o.minor ? 'minor' : 'major' }, ...shapeOpts(o) });

function bpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: B, voices }], o);
}

// ---- Visual helpers ----
type Pos = { string: number; fret: number; label?: string; finger?: number; root?: boolean };
const fretsVisual = (positions: Pos[], minFret?: number, maxFret?: number): Insight['visual'] => ({ kind: 'frets', positions, minFret, maxFret });
/** Labelled landmarks on one string: [[fret, 'G'], ...]. */
const landmarks = (string: number, marks: [number, string][]): Pos[] => marks.map(([fret, label]) => ({ string, fret, label }));
/** Every location of a natural note on a 4-string bass between two frets. */
const everywhere = (note: Step, lo = 0, hi = 12): Pos[] =>
  allLocationsOfPitchClass(stepPitchClass(note, 0), lo, hi, undefined, BASS4).map(p => ({ ...p, label: note, root: true }));

// ---- Shapes written out with strings (%) and fingers (@) ----
/** Root–5th–octave box on A, C, D, G, A, F, G — with the 5th below on C and D. */
const BOX =
  'A1/q@1%4 E2@3%3 A2@4%2 E2@3%3 | C2/q@1%3 G2@3%2 C3@4%1 G1@1%4 | D2/q@1%3 A2@3%2 D3@4%1 A1@1%4 | G1/q@1%4 D2@3%3 G2@4%2 D2@3%3 | ' +
  'A1/q@1%4 E2@3%3 A2@4%2 E2@3%3 | F1/q@1%4 C2@3%3 F2@4%2 C2@3%3 | G1/q@1%4 D2@3%3 G2@4%2 D2@3%3 | A1/w@1%4 |';
/** Major arpeggio shape (root with finger 2) on G, C and D. */
const MAJ_ARPS =
  'G1/q@2%4 B1@1%3 D2@4%3 G2@3%2 | D2/q@4%3 B1@1%3 G1/h@2%4 | C2/q@2%3 E2@1%2 G2@4%2 C3@3%1 | G2/q@4%2 E2@1%2 C2/h@2%3 | ' +
  'D2/q@2%3 F#2@1%2 A2@4%2 D3@3%1 | A2/q@4%2 F#2@1%2 D2/h@2%3 | G1/q@2%4 B1@1%3 D2@4%3 G2@3%2 | D2/q@4%3 B1@1%3 G1/h@2%4 |';
/** Minor arpeggio shape (root with finger 1) on A, D and E. */
const MIN_ARPS =
  'A1/q@1%4 C2@4%4 E2@3%3 A2@3%2 | E2/q@3%3 C2@4%4 A1/h@1%4 | D2/q@1%3 F2@4%3 A2@3%2 D3@3%1 | A2/q@3%2 F2@4%3 D2/h@1%3 | ' +
  'E2/q@1%3 G2@4%3 B2@3%2 E3@3%1 | B2/q@3%2 G2@4%3 E2/h@1%3 | A1/q@1%4 C2@4%4 E2@3%3 A2@3%2 | A1/w@1%4 |';
/** One-octave major scale shape (root with finger 2) in G, then moved to C and A. */
const MAJ_SHAPE_G = 'G1/q@2%4 A1@4%4 B1@1%3 C2@2%3 | D2/q@4%3 E2@1%2 F#2@3%2 G2@4%2 | G2/q@4%2 F#2@3%2 E2@1%2 D2@4%3 | C2/q@2%3 B1@1%3 A1@4%4 G1@2%4 | G1/w@2%4 |';
const MAJ_SHAPE_C = 'C2/q@2%3 D2@4%3 E2@1%2 F2@2%2 | G2/q@4%2 A2@1%1 B2@3%1 C3@4%1 | C3/q@4%1 B2@3%1 A2@1%1 G2@4%2 | F2/q@2%2 E2@1%2 D2@4%3 C2@2%3 | C2/w@2%3 |';
const MAJ_SHAPE_A = 'A1/q@2%4 B1@4%4 C#2@1%3 D2@2%3 | E2/q@4%3 F#2@1%2 G#2@3%2 A2@4%2 | A2/q@4%2 G#2@3%2 F#2@1%2 E2@4%3 | D2/q@2%3 C#2@1%3 B1@4%4 A1@2%4 | A1/w@2%4 |';
/** Roots C, A, D and G, each approached from one fret below or above on beat 4. */
const APPROACH = 'C2/h. G#1/q | A1/h. C#2/q | D2/h. Ab1/q | G1/h. B1/q | C2/h. Bb1/q | A1/h. Eb2/q | D2/h. F#1/q | G1/h. Db2/q | C2/w |';
/** Root–5th–octave moved to a new root every bar: a shifting study. */
const SHIFT_LINE =
  'A1/q@1%4 E2@3%3 A2@4%2 E2@3%3 | C2/q@1%4 G2@3%3 C3@4%2 G2@3%3 | D2/q@1%4 A2@3%3 D3@4%2 A2@3%3 | E2/q@1%3 B2@3%2 E3@4%1 B2@3%2 | ' +
  'A1/q@1%4 E2@3%3 A2@4%2 E2@3%3 | G1/q@1%4 D2@3%3 G2@4%2 D2@3%3 | F1/h@1%4 E1/h@0%4 | A1/w@0%3 |';

const POS5 = 'A1 B1 D2 E2 G2 A2 C3 D3';
const POS7 = 'B1 C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3';

export const bassFretboard: TrackDef = {
  id: 'bass-fretboard',
  instrument: 'bass',
  title: 'Fretboard & Grooves',
  subtitle: 'Bass guitar · The whole neck',
  description: 'Know the bass neck cold: every note to the 12th fret, octave shapes, the root–fifth–octave box, major and minor arpeggio shapes, pentatonic boxes, scale patterns and chromatic approach notes.',
  clef: 'fretboard',
  accent: '#f78c6c',
  glyph: '◉',
  heatmap: [{ clef: 'bass8vb', low: 'E1', high: 'G3' }],
  recommends: ['bass-lines'],
  units: [
    // ------------------------------------------------------------------ 1
    unit('bf1', 'Four Strings, Twelve Frets', 'E A D G, the musical alphabet, and frets as half steps.', [
      lesson('bf1-1', 'Four Open Strings', 'learn', 'E A D G — from the thickest string', [
        meet(B, 'E1 A1 D2 G2', {
          frets: [at(4, 0, 0), at(3, 0, 0), at(2, 0, 0), at(1, 0, 0)],
          tips: ['String 4: low E — the thickest string.', 'String 3: A.', 'String 2: D.', 'String 1: G — the thinnest string, nearest the floor.'],
          reps: 2,
        }),
        fretName(ALL, [0, 0], 8, { title: 'Name the open string' }),
      ], [
        insight('The musical alphabet', 'Music uses seven letters — A B C D E F G — and then starts again at A. Each time round is an octave: the same letter, higher.'),
        insight('E A D G', 'From the thickest string: E A D G — the same notes as the four lowest guitar strings, an octave lower. Strings are numbered from the thinnest: string 1 is G, string 4 is low E. A 5-string bass adds a low B as string 5.', fretsVisual([...landmarks(4, [[0, 'E']]), ...landmarks(3, [[0, 'A']]), ...landmarks(2, [[0, 'D']]), ...landmarks(1, [[0, 'G']])], 0, 5)),
      ]),
      lesson('bf1-2', 'Frets Are Half Steps', 'learn', 'Count up the neck letter by letter', [
        tip('Half and whole steps', 'Each fret raises the note one half step; two frets make a whole step. Most letters are two frets apart — but B–C and E–F are neighbours, one fret apart.', fretsVisual(landmarks(3, [[0, 'A'], [2, 'B'], [3, 'C'], [5, 'D'], [7, 'E'], [8, 'F'], [10, 'G'], [12, 'A']]), 0, 12)),
        fretName([3, 4], [0, 5], 12),
        fretPlay([3, 4], [0, 5], 8),
      ]),
      lesson('bf1-3', 'The First-Position Map', 'practice', 'Every natural note in frets 0–4', [
        fretName(ALL, [0, 4], 16),
        fretPlay(ALL, [0, 4], 10),
        fretName(ALL, [0, 4], 16, { title: 'Faster', prompt: 'Answer as soon as you see the dot.' }),
      ]),
      lesson('bf1-c', 'Checkpoint: The Alphabet', 'checkpoint', 'Open strings and first-position naturals', [
        fretName(ALL, [0, 0], 8),
        fretName(ALL, [0, 4], 16),
        fretPlay(ALL, [0, 4], 10),
      ]),
    ], ['E A D G', 'Half steps', 'B–C & E–F']),

    // ------------------------------------------------------------------ 2
    unit('bf2', 'E-String Landmarks', 'Every natural note on the low E string, from the nut to the 12th fret.', [
      lesson('bf2-1', 'Follow the Dots', 'learn', 'G 3 · A 5 · B 7 · C 8 · D 10 · E 12', [
        fretName([4], [0, 12], 12),
        fretPlay([4], [0, 12], 8),
      ], [
        insight('The dots are road signs', 'The fret markers are your landmarks. On the E string: 3 = G, 5 = A, 7 = B, 8 = C, 10 = D, and the double dot at 12 = E, an octave above the open string.', fretsVisual(landmarks(4, [[0, 'E'], [1, 'F'], [3, 'G'], [5, 'A'], [7, 'B'], [8, 'C'], [10, 'D'], [12, 'E']]), 0, 12)),
      ]),
      lesson('bf2-2', 'Fill the Gaps', 'practice', 'Use the landmarks to find the rest', [
        tip('Step from a landmark', 'F is one fret above E. Everything else on this string sits two frets from its neighbours — except B–C, at frets 7 and 8.'),
        fretName([4], [0, 12], 16),
        fretFind(['G', 'A', 'C'], [4], [0, 12]),
      ]),
      lesson('bf2-3', 'Roots on the E String', 'practice', 'The lowest roots on the bass', [
        tip('Why the E string matters', 'Most bass lines start from a root on the E or A string — the deepest, strongest notes you have. Know G at 3, A at 5 and C at 8 without counting and every new song gets easier.'),
        fretFind(['B', 'D', 'E', 'F'], [4], [0, 12]),
        fretPlay([4], [0, 12], 12),
      ]),
      lesson('bf2-c', 'Checkpoint: E String', 'checkpoint', 'Name and play every natural on string 4', [
        fretName([4], [0, 12], 16),
        fretPlay([4], [0, 12], 10),
      ]),
    ], ['String 4', 'Fret markers']),

    // ------------------------------------------------------------------ 3
    unit('bf3', 'A-String Landmarks', 'The A string — and both root strings together.', [
      lesson('bf3-1', 'Landmarks on A', 'learn', 'C 3 · D 5 · E 7 · G 10 · A 12', [
        fretName([3], [0, 12], 12),
        fretPlay([3], [0, 12], 8),
      ], [
        insight('The A string', 'On the A string: 2 = B, 3 = C, 5 = D, 7 = E, 8 = F, 10 = G, 12 = A. Notice C and F — each sits one fret above B and E.', fretsVisual(landmarks(3, [[0, 'A'], [2, 'B'], [3, 'C'], [5, 'D'], [7, 'E'], [8, 'F'], [10, 'G'], [12, 'A']]), 0, 12)),
      ]),
      lesson('bf3-2', 'Fill the Gaps', 'practice', 'Every natural on string 3', [
        fretName([3], [0, 12], 16),
        fretFind(['B', 'C', 'F'], [3], [0, 12]),
      ]),
      lesson('bf3-3', 'Two Root Strings', 'practice', 'Strings 3 and 4 together', [
        tip('Across the same fret', 'At any fret the A string is four letters above the E string: fret 3 = G and C, fret 5 = A and D, fret 7 = B and E. Turn it around and the note on the E string is the 5th BELOW the A-string note — a shape bass players use all the time.', fretsVisual([...landmarks(4, [[3, 'G'], [5, 'A'], [7, 'B']]), ...landmarks(3, [[3, 'C'], [5, 'D'], [7, 'E']])], 0, 9)),
        fretName([3, 4], [0, 12], 20),
        fretPlay([3, 4], [0, 12], 12),
      ]),
      lesson('bf3-c', 'Checkpoint: Root Strings', 'checkpoint', 'Strings 3 and 4, frets 0–12', [
        fretName([3, 4], [0, 12], 20),
        fretPlay([3, 4], [0, 12], 12),
        fretFind(['C', 'G'], [3, 4], [0, 12]),
      ]),
    ], ['String 3', 'Root strings']),

    // ------------------------------------------------------------------ 4
    unit('bf4', 'The Whole Neck', 'The D and G strings, then every fret in between — sharps and flats.', [
      lesson('bf4-1', 'The D String', 'learn', 'E 2 · F 3 · G 5 · A 7 · B 9 · C 10 · D 12', [
        fretName([2], [0, 12], 12),
        fretPlay([2], [0, 12], 8),
      ], [
        insight('The D string', 'The D string repeats the E string’s notes two frets higher and an octave up: E 2 · F 3 · G 5 · A 7 · B 9 · C 10 · D 12.', fretsVisual(landmarks(2, [[0, 'D'], [2, 'E'], [3, 'F'], [5, 'G'], [7, 'A'], [9, 'B'], [10, 'C'], [12, 'D']]), 0, 12)),
      ]),
      lesson('bf4-2', 'The G String', 'learn', 'A 2 · B 4 · C 5 · D 7 · E 9 · F 10 · G 12', [
        fretName([1], [0, 12], 12),
        fretPlay([1], [0, 12], 8),
      ], [
        insight('The G string', 'The G string mirrors the A string two frets up and an octave higher: A 2 · B 4 · C 5 · D 7 · E 9 · F 10 · G 12.', fretsVisual(landmarks(1, [[0, 'G'], [2, 'A'], [4, 'B'], [5, 'C'], [7, 'D'], [9, 'E'], [10, 'F'], [12, 'G']]), 0, 12)),
      ]),
      lesson('bf4-3', 'All Four Strings', 'practice', 'The whole neck in naturals', [
        fretName(ALL, [0, 12], 24),
        fretPlay(ALL, [0, 12], 14),
        fretFind(['A', 'E'], ALL, [0, 12]),
      ]),
      lesson('bf4-4', 'Sharps & Flats', 'learn', 'The frets between the naturals', [
        fretName(ALL, [0, 12], 16, { accidentals: true }),
        fretPlay(ALL, [0, 12], 10, { accidentals: true }),
        fretFind(['F#', 'Bb'], ALL, [0, 12]),
      ], [
        insight('Two names, one fret', 'One fret above G is G♯; one fret below A is A♭ — the same fret, the same sound. Every fret between two naturals has both names. B–C and E–F have no fret between them.', fretsVisual(landmarks(4, [[3, 'G'], [4, 'G♯/A♭'], [5, 'A'], [6, 'A♯/B♭'], [7, 'B'], [8, 'C']]), 0, 9)),
      ]),
      lesson('bf4-c', 'Checkpoint: The Whole Neck', 'checkpoint', 'Every note, every string, frets 0–12', [
        fretName(ALL, [0, 12], 24, { accidentals: true }),
        fretPlay(ALL, [0, 12], 12),
        fretFind(['C', 'G', 'Eb'], ALL, [0, 12]),
      ]),
    ], ['Strings 2 & 1', '♯ / ♭ on the neck']),

    // ------------------------------------------------------------------ 5
    unit('bf5', 'Octave Shapes', 'Two strings and two frets; three strings and three frets back.', [
      lesson('bf5-1', 'Two Strings Over, Two Frets Up', 'learn', 'Octaves from the E and A strings', [
        fretOctave([3, 4], [0, 10], 10),
      ], [
        insight('The octave shape', 'From the E or A string, the octave is two strings higher and two frets up: G at 4/3 → G at 2/5; C at 3/3 → C at 1/5. Index on the root, little finger on the octave. All four strings are tuned in 4ths, so this shape never changes.', fretsVisual([{ string: 4, fret: 3, label: 'G', root: true }, { string: 2, fret: 5, label: 'G' }, { string: 3, fret: 3, label: 'C', root: true }, { string: 1, fret: 5, label: 'C' }], 0, 7)),
      ]),
      lesson('bf5-2', 'Three Strings, Three Frets Back', 'learn', 'From the E string to the G string', [
        fretOctave([4], [3, 12], 10, { title: 'The long octave', prompt: 'From the E string, cross three strings to the G string and go back three frets — or use the two-string shape.' }),
      ], [
        insight('The long octave', 'From the E string you can also reach the octave on the G string: three strings over and three frets BACK. A at 4/5 → A at 1/2; C at 4/8 → C at 1/5. Same pitch as the two-string shape, just a different place.', fretsVisual([{ string: 4, fret: 5, label: 'A', root: true }, { string: 2, fret: 7, label: 'A' }, { string: 1, fret: 2, label: 'A' }], 0, 9)),
      ]),
      lesson('bf5-3', 'Octaves Down', 'practice', 'Reverse the shapes', [
        fretOctave([1, 2], [2, 12], 10, { title: 'Find the octave below', prompt: 'From the D or G string, go two strings down and two frets back.' }),
        fretName([2, 4], [0, 10], 14, { title: 'Octave partners', prompt: 'A note on the E string has the same name two frets higher on the D string.' }),
      ]),
      lesson('bf5-4', 'Where Are All the A’s?', 'practice', 'Find every copy of a note', [
        fretFind(['A'], ALL, [0, 12]),
        fretFind(['C'], ALL, [0, 12]),
        fretFind(['E', 'G'], ALL, [0, 12]),
      ], [
        insight('All the A’s', 'Every note appears on every string — usually twice below the 12th fret. Find one, then use the octave shapes and the open strings to find the rest.', fretsVisual(everywhere('A'), 0, 12)),
      ]),
      lesson('bf5-c', 'Checkpoint: Octaves', 'checkpoint', 'Find the octave of anything', [
        fretOctave(ALL, [0, 12], 15),
        fretFind(['D', 'F'], ALL, [0, 12]),
      ]),
    ], ['Octave shapes', 'Every copy of a note']),

    // ------------------------------------------------------------------ 6
    unit('bf6', 'Root–Fifth–Octave & Arpeggios', 'The bass player’s box, and major and minor arpeggio shapes that move anywhere.', [
      lesson('bf6-1', 'The Root–Fifth–Octave Box', 'learn', 'One shape for every chord', [
        bpiece('The Box on A, C, D and G', 'C', [4, 4], [BOX], { prompt: 'Root, 5th, octave, 5th — and on C and D the 5th below the root to finish the bar.' }),
        interval(B, 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3', [5, 8], 10),
      ], [
        insight('The box', 'Root on the E or A string, 5th one string up and two frets higher, octave two strings up and two frets higher. The 5th BELOW the root sits on the same fret, one string lower. Four notes, one hand shape — move it and it fits any chord.', fretsVisual([{ string: 3, fret: 3, label: 'C', root: true, finger: 1 }, { string: 2, fret: 5, label: 'G', finger: 3 }, { string: 1, fret: 5, label: 'C', finger: 4 }, { string: 4, fret: 3, label: 'G', finger: 1 }], 0, 7)),
      ]),
      lesson('bf6-2', 'The Major Arpeggio Shape', 'learn', 'Root, 3rd, 5th, octave', [
        bpiece('Major Arpeggios: G, C and D', 'G', [4, 4], [MAJ_ARPS]),
        read(B, 'G1 A1 B1 C2 D2 E2 F#2 G2 A2 B2', { key: 'G', guitarPosition: 2, rhythms: RH.qh, maxLeap: 5, leapiness: 0.9, harmonic: true }),
      ], [
        insight('Major arpeggio', 'Root with finger 2, the major 3rd one string up and one fret back (finger 1), the 5th two frets above the root (finger 4) and the octave beside it (finger 3). In G: G at 4/3, B at 3/2, D at 3/5, G at 2/5.', fretsVisual([{ string: 4, fret: 3, label: 'G', root: true, finger: 2 }, { string: 3, fret: 2, label: 'B', finger: 1 }, { string: 3, fret: 5, label: 'D', finger: 4 }, { string: 2, fret: 5, label: 'G', finger: 3 }], 0, 7)),
      ]),
      lesson('bf6-3', 'The Minor Arpeggio Shape', 'learn', 'Lower the 3rd', [
        bpiece('Minor Arpeggios: Am, Dm and Em', 'Am', [4, 4], [MIN_ARPS]),
        read(B, 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2', { key: 'Am', rhythms: RH.qh, maxLeap: 5, leapiness: 0.9, harmonic: true }),
      ], [
        insight('Minor arpeggio', 'Root with finger 1, the minor 3rd three frets higher on the same string (finger 4), the 5th one string up and two frets above the root (finger 3) and the octave beside it. In A minor: A at 4/5, C at 4/8, E at 3/7, A at 2/7.', fretsVisual([{ string: 4, fret: 5, label: 'A', root: true, finger: 1 }, { string: 4, fret: 8, label: 'C', finger: 4 }, { string: 3, fret: 7, label: 'E', finger: 3 }, { string: 2, fret: 7, label: 'A', finger: 3 }], 3, 10)),
      ]),
      lesson('bf6-4', 'Arpeggios in Songs', 'song', 'Chord tones in real bass lines', [
        piece('bass-chord-tone-rock'),
        piece('bass-house-of-the-rising-sun'),
      ]),
      lesson('bf6-c', 'Checkpoint: Box & Arpeggios', 'checkpoint', 'Shapes in time', [
        interval(B, 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3', [3, 5, 8], 10),
        bpiece('Major Arpeggios: G, C and D', 'G', [4, 4], [MAJ_ARPS], { mode: 'tempo', tempo: 80, fingering: 'first' }),
        bpiece('Minor Arpeggios: Am, Dm and Em', 'Am', [4, 4], [MIN_ARPS], { mode: 'tempo', tempo: 80, fingering: 'first' }),
      ]),
    ], ['R–5–8 box', 'Major arpeggio', 'Minor arpeggio']),

    // ------------------------------------------------------------------ 7
    unit('bf7', 'Pentatonic Boxes', 'The five boxes of A minor pentatonic — then E minor and G major.', [
      lesson('bf7-1', 'Box 1: A Minor Pentatonic', 'learn', 'The most-played shape in rock and blues', [
        penta('A', 0),
        penta('A', 0, { updown: true }),
        fretFind(['A'], ALL, [5, 8], { title: 'Find the roots', prompt: 'Every A in box 1 (frets 5–8).' }),
      ], [
        insight('Five notes, two per string', 'A minor pentatonic is A C D E G. Box 1 starts on the E-string root at the 5th fret: two notes on every string — fingers 1 and 4 on the E string, 1 and 3 on the others.', fretsVisual([
          { string: 4, fret: 5, root: true, label: 'A' }, { string: 4, fret: 8, label: 'C' }, { string: 3, fret: 5, label: 'D' }, { string: 3, fret: 7, label: 'E' },
          { string: 2, fret: 5, label: 'G' }, { string: 2, fret: 7, root: true, label: 'A' }, { string: 1, fret: 5, label: 'C' }, { string: 1, fret: 7, label: 'D' },
        ], 3, 10)),
      ]),
      lesson('bf7-2', 'Boxes 2 and 3', 'learn', 'Climbing from the 7th to the 12th fret', [
        tip('Overlapping boxes', 'Each box starts on the next note of the scale along the E string: box 2 on C (8th fret), box 3 on D (10th fret). The upper notes of one box are the lower notes of the next.'),
        penta('A', 1),
        penta('A', 2),
      ]),
      lesson('bf7-3', 'Boxes 4 and 5', 'learn', 'Down to the nut, and around again', [
        tip('Around again', 'Box 4 starts on E — the open string — so it is the open-position box, frets 0–3. Box 5 starts on G at the 3rd fret and leads straight back into box 1 at the 5th.'),
        penta('A', 3),
        penta('A', 4),
        penta('A', 4, { mode: 'tempo', tempo: 72, updown: true, title: 'Box 5 into box 1' }),
        penta('A', 0, { mode: 'tempo', tempo: 72, updown: true }),
      ]),
      lesson('bf7-4', 'E Minor & G Major Pentatonic', 'learn', 'One set of notes, two home notes', [
        penta('E', 0),
        penta('G', 0, { major: true }),
        read(B, 'E1 G1 A1 B1 D2 E2 G2 A2 B2', { key: 'Em', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 2, title: 'E minor pentatonic lines' }),
      ], [
        insight('Relative pentatonics', 'E minor pentatonic (E G A B D) and G major pentatonic (G A B D E) are the same five notes — only the home note changes. E minor’s first box is in open position; G major’s starts on G at the 3rd fret.'),
      ]),
      lesson('bf7-c', 'Checkpoint: Pentatonics', 'checkpoint', 'Boxes in time', [
        penta('A', 0, { mode: 'tempo', tempo: 84, updown: true }),
        penta('A', 3, { mode: 'tempo', tempo: 84, updown: true }),
        penta('E', 0, { mode: 'tempo', tempo: 84, updown: true }),
        penta('G', 0, { major: true, mode: 'tempo', tempo: 76 }),
      ]),
    ], ['5 boxes', 'Minor & major pentatonic']),

    // ------------------------------------------------------------------ 8
    unit('bf8', 'Scale Patterns', 'The one-octave major shape, then three-notes-per-string major and minor patterns.', [
      lesson('bf8-1', 'The Major Scale Shape', 'learn', 'One octave, one hand shape', [
        bpiece('G Major Shape', 'G', [4, 4], [MAJ_SHAPE_G]),
        bpiece('The Same Shape in C', 'C', [4, 4], [MAJ_SHAPE_C], { prompt: 'Root on the A string, 3rd fret — the same fingers, one string higher.' }),
        bpiece('The Same Shape in A', 'A', [4, 4], [MAJ_SHAPE_A], { prompt: 'Slide the G shape up two frets: the root is now A at the 5th fret.' }),
      ], [
        insight('One octave, one shape', 'Start a major scale with finger 2 on an E- or A-string root and it falls under the hand: 2 4 | 1 2 4 | 1 3 4. In G: G and A on the E string, B C D on the A string, E F♯ G on the D string. Slide the shape and it plays any major scale.', fretsVisual([{ string: 4, fret: 3, root: true, label: 'G', finger: 2 }, { string: 4, fret: 5, label: 'A', finger: 4 }, { string: 3, fret: 2, label: 'B', finger: 1 }, { string: 3, fret: 3, label: 'C', finger: 2 }, { string: 3, fret: 5, label: 'D', finger: 4 }, { string: 2, fret: 2, label: 'E', finger: 1 }, { string: 2, fret: 4, label: 'F♯', finger: 3 }, { string: 2, fret: 5, root: true, label: 'G', finger: 4 }], 0, 7)),
      ]),
      lesson('bf8-2', 'Three Notes per String', 'learn', 'Pattern 1 in G major', [
        nps('G', 0),
        nps('G', 0, { updown: true }),
      ], [
        insight('Three notes per string', 'Three scale notes on every string gives one pattern for each note of the scale. On four strings that covers an octave and a half. Pattern 1 in G starts on G at the 3rd fret of the E string.', fretsVisual([
          { string: 4, fret: 3, root: true, label: 'G' }, { string: 4, fret: 5 }, { string: 4, fret: 7 },
          { string: 3, fret: 3 }, { string: 3, fret: 5 }, { string: 3, fret: 7 },
          { string: 2, fret: 4 }, { string: 2, fret: 5, root: true, label: 'G' }, { string: 2, fret: 7 },
          { string: 1, fret: 4 }, { string: 1, fret: 5 }, { string: 1, fret: 7 },
        ], 2, 9)),
      ]),
      lesson('bf8-3', 'More Major Patterns', 'practice', 'Patterns 2 and 3, and C major', [
        tip('Every degree has a pattern', 'Start on A (pattern 2) or B (pattern 3) and the same three-per-string idea makes new shapes further up the neck. For C major, pattern 1 starts on C at the 8th fret.'),
        nps('G', 1),
        nps('G', 2),
        nps('C', 0, { mode: 'tempo', tempo: 66 }),
      ]),
      lesson('bf8-4', 'Minor Scale Patterns', 'learn', 'A minor and E minor', [
        nps('A', 0, { minor: true }),
        nps('A', 0, { minor: true, updown: true }),
        nps('E', 0, { minor: true }),
        scale('A', 'natural-minor', 'R', { octave: 1, guitarPosition: 5 }),
      ], [
        insight('Natural minor', 'The natural minor scale uses the notes of its relative major from a new home note: A minor is C major from A to A. Its three-per-string pattern from the 5th fret, and E minor’s from the open string, are two of the most useful shapes on the bass.'),
      ]),
      lesson('bf8-c', 'Checkpoint: Scale Patterns', 'checkpoint', 'Patterns in time', [
        nps('G', 0, { mode: 'tempo', tempo: 80, updown: true }),
        nps('A', 0, { minor: true, mode: 'tempo', tempo: 80, updown: true }),
        bpiece('The Same Shape in C', 'C', [4, 4], [MAJ_SHAPE_C], { mode: 'tempo', tempo: 84, fingering: 'first' }),
      ]),
    ], ['Major shape', '3 notes per string', 'Minor patterns']),

    // ------------------------------------------------------------------ 9
    unit('bf9', 'Approach Notes & the Whole Neck', 'Chromatic approach notes, connecting positions, the upper frets — and the final exam.', [
      lesson('bf9-1', 'One Fret Away', 'learn', 'Approach any root from below or above', [
        bpiece('Approach Notes', 'C', [4, 4], [APPROACH], { prompt: 'Beat 4 is always one fret from the next root — below, then above.' }),
        piece('bass-walking-the-changes'),
      ], [
        insight('Approach notes', 'Any root can be approached from one fret below or one fret above. On the neck it’s a single-fret move into the target — the sound of walking bass and Motown.', fretsVisual([{ string: 3, fret: 3, label: 'C', root: true }, { string: 3, fret: 2, label: 'B' }, { string: 3, fret: 4, label: 'C♯' }, { string: 4, fret: 3, label: 'G', root: true }, { string: 4, fret: 2, label: 'F♯' }, { string: 4, fret: 4, label: 'G♯' }], 0, 6)),
      ]),
      lesson('bf9-2', 'Connecting Positions', 'learn', 'One map instead of separate boxes', [
        tip('Connect the shapes', 'Positions overlap: the top of first position meets the 5th, and the 5th runs into the 7th. Shift on a note you can take with the index finger and the whole neck becomes one map.'),
        read(B, POS5, { key: 'Am', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, title: 'Fifth position' }),
        read(B, POS7, { guitarPosition: 7, rhythms: RH.qh, maxLeap: 2, title: 'Seventh position' }),
        bpiece('Box Shifts', 'Am', [4, 4], [SHIFT_LINE], { prompt: 'The root–5th–octave box, moved to a new root every bar.' }),
      ]),
      lesson('bf9-3', 'Above the 12th Fret', 'learn', 'The neck starts over', [
        fretName(ALL, [12, 17], 14),
        fretFind(['E', 'A'], ALL, [12, 17]),
      ], [
        insight('Twelve frets up', 'Above the 12th fret everything repeats an octave higher: 12 = the open string, 15 = fret 3, 17 = fret 5. The double dot at 12 is your new nut.', fretsVisual([...landmarks(4, [[12, 'E'], [15, 'G'], [17, 'A']]), ...landmarks(3, [[12, 'A'], [14, 'B'], [15, 'C'], [17, 'D']])], 12, 17)),
      ]),
      lesson('bf9-4', 'Whole-Neck Lightning', 'challenge', 'Forty notes, no hesitation', [
        fretName(ALL, [0, 12], 40, { accidentals: true, title: 'Lightning round' }),
        fretPlay(ALL, [0, 12], 20, { accidentals: true }),
        fretFind(['F#', 'Bb', 'D'], ALL, [0, 12]),
      ]),
      lesson('bf9-c', 'Final Exam: Fretboard & Grooves', 'checkpoint', 'Prove you know the neck', [
        fretName(ALL, [0, 15], 30, { accidentals: true }),
        fretOctave(ALL, [0, 12], 12),
        fretFind(['C#', 'F', 'A'], ALL, [0, 12]),
        penta('A', 1, { mode: 'tempo', tempo: 84, updown: true }),
        nps('G', 0, { mode: 'tempo', tempo: 84, updown: true }),
        bpiece('Approach Notes', 'C', [4, 4], [APPROACH], { mode: 'tempo', tempo: 88, fingering: 'none' }),
      ]),
    ], ['Approach notes', 'Positions', 'Frets 12–17']),
  ],
};
