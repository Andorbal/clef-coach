import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Double bass · Bass clef. Scores hold SOUNDING pitch; the bass8vb clef writes every note
 * an octave higher, exactly as double bass parts are printed. The open strings are
 * E1 A1 D2 G2 (strings 4..1), tuned in fourths like a bass guitar's.
 *
 * Fingering is Simandl's: the hand covers a whole tone with fingers 1, 2 and 4 (the 3rd
 * finger presses along with the 4th). Positions are named by the 1st finger: half
 * position a semitone above the open string, first position a tone, second position a
 * minor third, third position a fourth, fourth position a fifth (`guitarPosition` is the
 * index finger's semitone: 1, 2, 3, 5, 7). Generated reading stays inside one position;
 * fourth-position music is written out with its fingering.
 */
const B = 'bass8vb' as const;

/** A fingerboard place for `meet`: string (1 = G … 4 = E), semitone above the open string, finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- Pitch pools (sounding pitch) ----
const OPEN = 'E1 A1 D2 G2';
const HALF_E = 'E1 F1 G1';
const HALF_EA = 'E1 F1 G1 A1 B1 C2';
const HALF_C = 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2';
const POS1_G = 'E1 F#1 G1 A1 B1 C2 D2 E2 F#2 G2 A2 B2';
const POS1_D = 'E1 F#1 G1 A1 B1 C#2 D2 E2 F#2 G2 A2 B2';
const F_MAJ = 'F1 G1 A1 Bb1 C2 D2 E2 F2 G2 A2 Bb2';
const BB_MAJ = 'F1 G1 A1 Bb1 C2 D2 Eb2 F2 G2 A2 Bb2';
const EM = 'E1 F#1 G1 A1 B1 C2 D2 E2 F#2 G2';
const AM = 'E1 G#1 A1 B1 C2 D2 E2 F2 G2 A2';
const DM = 'A1 Bb1 C2 D2 E2 F2 G2 A2 Bb2';
const BM = 'B1 C#2 D2 E2 F#2 G2 A2 B2';
/** Second position: the 1st finger a minor third above each open string. */
const POS2 = 'G1 A1 C2 D2 F2 G2 Bb2 C3';
/** Third position: the 1st finger a fourth above each open string. */
const POS3 = 'A1 B1 D2 E2 G2 A2 C3 D3';
const FULL = 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3 D3';

function dpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: B, voices }], o);
}

// ---- Bass lines and studies (sounding pitch) ----
const ROOTS_G = 'G1/w | C2/w | D2/w | G1/w | G1/h C2/h | G1/h D2/h | C2/h D2/h | G1/w |';
const RF_F = 'F1/h C2/h | Bb1/h F1/h | C2/h G1/h | F1/h C2/h | F1/q C2 F1 C2 | Bb1/q F1 Bb1 F1 | C2/q G1 C2 G1 | F1/w |';
const WALK_F = 'F1/q A1 C2 A1 | Bb1/q D2 F2 D2 | C2/q E2 G2 E2 | F2/q D2 C2 A1 | Bb1/q A1 G1 A1 | Bb1/q C2 D2 E2 | F2/q E2 D2 C2 | F1/w |';
const APPROACH = 'C2/q E2 G2 B1 | A1/q C2 E2 C#2 | D2/q F2 A2 F#1 | G1/q B1 D2 B1 | C2/q E2 G2 Bb1 | A1/q C2 E2 Eb2 | D2/q F2 G1 B1 | C2/w |';
/** Half position, then second and third positions on the G string, and back down. */
const SHIFT_G =
  'G2/q@0%1 A2@2%1 Bb2@4%1 A2@2%1 | Bb2/q@1%1 B2@2%1 C3@4%1 B2@2%1 | C3/q@1%1 Db3@2%1 D3@4%1 C3@1%1 | D3/h@4%1 C3/h@1%1 | ' +
  'C3/q@4%1 B2@2%1 Bb2@1%1 B2@2%1 | A2/q@2%1 Bb2@4%1 A2@2%1 G2@0%1 | D2/q@0%2 F2@4%2 A2@2%1 Bb2@4%1 | G2/w@0%1 |';
/** Fourth position on the A, D and G strings: 1 a fifth above the open string, 4 a tone higher. */
const POS4_STUDY =
  'A2/q@1%2 B2@4%2 D3@1%1 E3@4%1 | D3/h@1%1 B2/h@4%2 | A2/q@1%2 Bb2@2%2 B2@4%2 D3@1%1 | E3/w@4%1 | ' +
  'E3/q@4%1 D3@1%1 B2@4%2 A2@1%2 | E2/q@1%3 F#2@4%3 A2@1%2 B2@4%2 | D3/q@1%1 B2@4%2 A2@1%2 F#2@4%3 | G2/w@0%1 |';

export const doubleBassLines: TrackDef = {
  id: 'doublebass-lines',
  instrument: 'doublebass',
  title: 'Bass Clef',
  subtitle: 'Double bass · Reading bass lines',
  description: 'Read double bass parts the way bassists do, an octave above where they sound. Open strings, half and first position in Simandl fingering, sharp and flat keys, bowed long tones and pizzicato, walking bass lines, minor keys and the positions up to fourth, with Pachelbel, Beethoven, Mozart and Grieg.',
  clef: 'bass8vb',
  accent: '#7aa7ff',
  glyph: '𝄢',
  heatmap: [{ clef: 'bass8vb', low: 'E1', high: 'E3' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('db1', 'The Open Strings', 'E, A, D and G, written an octave up; plucked and bowed.', [
      lesson('db1-1', 'Meet the Double Bass', 'learn', 'The bass clef and your two lowest strings', [
        meet(B, 'E1', { frets: [at(4, 0, 0)], tips: ['The open 4th string, the thickest, is low E. It is written on the ledger line below the bass staff.'] }),
        meet(B, 'A1', { frets: [at(3, 0, 0)], tips: ['The open 3rd string, A, is written in the bottom space of the staff.'] }),
        name(B, 'E1 A1', 8),
        play(B, 'E1 A1', 8, { hints: true }),
      ], [
        insight('Standing with the bass', 'Set the endpin so the nut is about level with your eyebrows. The bass leans gently against the left side of your body, and stays balanced there without your left hand holding it up. Many players sit on a tall stool instead; the bass leans against the inside of the left knee.'),
        insight('Written an octave up', 'The double bass sounds an octave lower than its music is written. Your open E is one of the lowest notes in the orchestra, but it is written on the ledger line just below the bass staff. Writing bass parts an octave up keeps them on the staff instead of buried under ledger lines.'),
        insight('The F clef', 'The bass clef (𝄢) is an F clef: its two dots hug the 4th line, and every note on that line is an F. On the double bass that written F is the D string, played with the 4th finger in half position.', { kind: 'staff', clef: B, notes: ['F2'], labels: true }),
        insight('String numbers', 'Strings are numbered from the highest: string 1 is G, string 2 is D, string 3 is A and string 4 is the low E.', { kind: 'frets', positions: [{ string: 1, fret: 0, label: 'G' }, { string: 2, fret: 0, label: 'D' }, { string: 3, fret: 0, label: 'A' }, { string: 4, fret: 0, label: 'E' }], maxFret: 5 }),
      ]),
      lesson('db1-2', 'Open D and G', 'learn', 'The middle line and the top space', [
        meet(B, 'D2', { frets: [at(2, 0, 0)], tips: ['The open 2nd string, D, is written on the middle line.'] }),
        meet(B, 'G2', { frets: [at(1, 0, 0)], tips: ['The open 1st string, G, is written in the top space.'] }),
        name(B, OPEN, 12),
        play(B, OPEN, 10, { hints: true }),
      ], [
        insight('Strings a fourth apart', 'From the bottom: E on the ledger line, A in the bottom space, D on the middle line, G in the top space. Each string is four letters (a fourth) above the one below it.', { kind: 'staff', clef: B, notes: ['E1', 'A1', 'D2', 'G2'], labels: true }),
      ]),
      lesson('db1-3', 'Pizzicato', 'practice', 'Plucked open-string lines', [
        tip('Pizzicato', 'Rest the thumb against the side of the fingerboard and pull the side of your index finger across the string, near the end of the fingerboard, in a smooth arc. Let the string ring: a good pizzicato note sustains like a bell. Jazz and pop bassists play most notes this way.'),
        read(B, OPEN, { rhythms: RH.quarters, maxLeap: 3, leapiness: 1, noteNames: true }),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 3, leapiness: 1 }),
        name(B, OPEN, 12, { sequence: true, title: 'Note rush' }),
        piece('doublebass-open-string-stroll'),
      ]),
      lesson('db1-4', 'The Bow', 'learn', 'Long tones, arco', [
        tip('French or German bow', 'There are two kinds of bass bow. The French bow is held like a cello bow, from above; the German bow has a deep frog and is held from the side, a little like a saw’s handle. Use the one your teacher or orchestra uses: the music is the same.'),
        tip('Long tones', '“Arco” means bowed. Let the weight of your arm sink into the string, keep the bow straight and halfway between the bridge and the fingerboard, and move it slowly: low strings need a slow, heavy bow to speak.'),
        piece('doublebass-long-tones'),
        read(B, OPEN, { rhythms: RH.slow, maxLeap: 3, leapiness: 1, mode: 'tempo', tempo: 60 }),
      ]),
      lesson('db1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Know E, A, D and G on sight', [
        name(B, OPEN, 12),
        play(B, OPEN, 8),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 3, leapiness: 1, fingering: 'first' }),
      ]),
    ], ['E A D G', 'Written 8va', 'Pizz. and arco']),

    // ------------------------------------------------------------------ 2
    unit('db2', 'Half Position: E and A Strings', 'Simandl fingering, 1, 2 and 4 over a whole tone: F and G, B and C.', [
      lesson('db2-1', 'F and G on the E String', 'learn', 'Below the staff and the bottom line', [
        meet(B, 'F1 G1', { frets: [at(4, 1, 1), at(4, 3, 4)], tips: ['F: E string, 1st finger, a semitone above the open E. Written in the space below the staff.', 'G: E string, 4th finger, with the 3rd finger pressing beside it. Written on the bottom line.'] }),
        name(B, 'E1 F1 G1 A1', 10),
        play(B, HALF_E, 10, { hints: true }),
        read(B, `${HALF_E} A1`, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true }),
      ], [
        insight('Half position and Simandl fingering', 'Near the scroll the notes are far apart, so a bassist covers a whole tone with three fingers: the 1st finger a semitone above the open string, the 2nd a semitone higher, and the 4th (helped by the 3rd) a semitone above that. This is half position, in Franz Simandl’s fingering.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'E' }, { string: 4, fret: 1, finger: 1, label: 'F' }, { string: 4, fret: 2, finger: 2, label: 'F♯' }, { string: 4, fret: 3, finger: 4, label: 'G' }], maxFret: 5 }),
      ]),
      lesson('db2-2', 'B and C on the A String', 'learn', 'The second line and the second space', [
        meet(B, 'B1 C2', { frets: [at(3, 2, 2), at(3, 3, 4)], tips: ['B: A string, 2nd finger in half position. Written on the second line.', 'C: A string, 4th finger. Written in the second space.'] }),
        name(B, HALF_EA, 12),
        play(B, HALF_EA, 10, { hints: true }),
        read(B, HALF_EA, { rhythms: RH.quarters, maxLeap: 2, noteNames: true }),
      ]),
      lesson('db2-3', 'Counting Beats', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'A quarter note lasts one beat, a half note two and a whole note four. The bass keeps time for everyone, so count out loud: “1 2 3 4”, and let long notes last their full value.', { kind: 'staff', clef: B, notes: ['E1/q', 'F1/q', 'G1/h', 'A1/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(B, HALF_EA, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('db2-4', 'Hot Cross Buns', 'song', 'A song on the E and A strings', [
        piece('doublebass-hot-cross-buns'),
        read(B, HALF_EA, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('db2-c', 'Checkpoint: E and A Strings', 'checkpoint', 'E1 up to C2, in time', [
        name(B, `${HALF_EA} D2 G2`, 12),
        play(B, HALF_EA, 10),
        read(B, HALF_EA, { rhythms: RH.qhw, maxLeap: 3, leapiness: 0.4, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['F G B C', 'Half position', 'Simandl 1-2-4']),

    // ------------------------------------------------------------------ 3
    unit('db3', 'Half Position: D and G Strings', 'E and F on the D string, A on the G string: all of half position.', [
      lesson('db3-1', 'E and F on the D String', 'learn', 'The third space and the fourth line', [
        meet(B, 'E2 F2', { frets: [at(2, 2, 2), at(2, 3, 4)], tips: ['E: D string, 2nd finger. Written in the third space, an octave above the open E string.', 'F: D string, 4th finger. Written on the 4th line, between the dots of the clef.'] }),
        name(B, 'C2 D2 E2 F2 G2', 10),
        play(B, 'D2 E2 F2', 8, { hints: true }),
        read(B, 'B1 C2 D2 E2 F2', { rhythms: RH.quarters, maxLeap: 2, noteNames: true }),
      ], [
        insight('Octave partners', 'E on the D string sounds exactly an octave above the open E string, and F on the D string an octave above F on the E string: two strings higher and two semitones up always gives the octave.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'E', root: true }, { string: 2, fret: 2, finger: 2, label: 'E' }, { string: 4, fret: 1, finger: 1, label: 'F', root: true }, { string: 2, fret: 3, finger: 4, label: 'F' }], maxFret: 5 }),
      ]),
      lesson('db3-2', 'A on the G String', 'learn', 'The top line', [
        meet(B, 'A2', { frets: [at(1, 2, 2)], tips: ['A: G string, 2nd finger in half position, on the top line of the staff.'] }),
        name(B, HALF_C, 14),
        play(B, 'E2 F2 G2 A2', 8, { hints: true }),
        read(B, 'D2 E2 F2 G2 A2', { rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ]),
      lesson('db3-3', 'The Whole Half Position', 'practice', 'Every natural note from E1 to A2', [
        tip('Half position in C', 'Fingers 2 and 4 do most of the work in C major: B and C on the A string, E and F on the D string, A on the G string, and F and G on the E string with fingers 1 and 4.', {
          kind: 'frets',
          positions: [
            { string: 4, fret: 0, label: 'E' }, { string: 4, fret: 1, finger: 1, label: 'F' }, { string: 4, fret: 3, finger: 4, label: 'G' },
            { string: 3, fret: 0, label: 'A' }, { string: 3, fret: 2, finger: 2, label: 'B' }, { string: 3, fret: 3, finger: 4, label: 'C' },
            { string: 2, fret: 0, label: 'D' }, { string: 2, fret: 2, finger: 2, label: 'E' }, { string: 2, fret: 3, finger: 4, label: 'F' },
            { string: 1, fret: 0, label: 'G' }, { string: 1, fret: 2, finger: 2, label: 'A' },
          ],
          maxFret: 5,
        }),
        name(B, HALF_C, 18, { sequence: true, title: 'Note rush' }),
        play(B, HALF_C, 12),
        read(B, HALF_C, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
        read(B, HALF_C, { rhythms: RH.qhw, maxLeap: 3, leapiness: 0.4 }),
      ]),
      lesson('db3-4', 'Ode to Joy', 'song', 'Beethoven in half position', [
        piece('doublebass-ode-to-joy'),
        read(B, HALF_C, { rhythms: RH.qhw, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('db3-c', 'Checkpoint: Half Position', 'checkpoint', 'Every natural note, E1 to A2', [
        name(B, HALF_C, 18, { sequence: true }),
        play(B, HALF_C, 12),
        read(B, HALF_C, { rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['E F A', 'Half position', 'Octaves']),

    // ------------------------------------------------------------------ 4
    unit('db4', 'Rhythm, Rests and the Bow', 'Eighth notes, rests that really stop, three-four time and pickups.', [
      lesson('db4-1', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighths on the bass', 'Count “1 & 2 & 3 & 4 &”. Bowed, give each eighth a short stroke in the middle of the bow; plucked, alternate the index and middle fingers so every note has the same weight.', { kind: 'staff', clef: B, notes: ['A1/e', 'A1/e', 'E2/q', 'D2/e', 'C2/e', 'A1/q'], time: [4, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(B, HALF_C, { rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('db4-2', 'Rests', 'learn', 'Stopping the string', [
        tip('Stopping the sound', 'Bass strings ring for a long time, so a rest takes work. Ease the finger’s pressure without leaving the string, or touch a ringing open string with your plucking finger or a free left-hand finger. Bowed, stop the bow on the string.', { kind: 'staff', clef: B, notes: ['A1/q', 'r/q', 'E2/q', 'r/q', 'D2/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(B, HALF_C, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('db4-3', 'Three-Four Time', 'learn', 'A strong beat one', [
        tip('3/4 time', 'Three beats in a bar: ONE two three. In a waltz the bass owns beat one: play it full and let the others fill beats two and three.', { kind: 'staff', clef: B, notes: ['C2/h.', 'G1/h', 'B1/q'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 84 }),
        read(B, HALF_C, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('db4-4', 'When the Saints', 'song', 'A pickup and rests', [
        tip('Pickups', 'A pickup is a short first bar that leads into beat one. Count the missing beat silently (“1”), play on 2, 3 and 4, and land on the strong beat.'),
        piece('doublebass-when-the-saints'),
      ]),
      lesson('db4-c', 'Checkpoint: Rhythm', 'checkpoint', 'Eighths, rests and 3/4 in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        read(B, HALF_C, { rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(B, HALF_C, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Eighths', 'Rests', '3/4', 'Pickups']),

    // ------------------------------------------------------------------ 5
    unit('db5', 'First Position: G and D Major', 'The hand moves up a semitone: F♯, B and C♯, and the sharp keys.', [
      lesson('db5-1', 'Moving to First Position', 'learn', 'The 1st finger a whole tone up', [
        meet(B, 'F#1 B2', { frets: [at(4, 2, 1), at(1, 4, 4)], tips: ['F♯: E string, 1st finger in first position, a semitone higher than half position. Written in the space below the staff with a sharp.', 'B: G string, 4th finger in first position. Written in the space above the staff.'] }),
        name(B, POS1_G, 14, { key: 'G' }),
        play(B, 'F#1 G1 B1 C2 E2 F#2 A2 B2', 10, { key: 'G', hints: true }),
        read(B, POS1_G, { key: 'G', guitarPosition: 2, rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Positions', 'A position is named after where the 1st finger sits: in half position a semitone above the open string, in first position a whole tone. Fingers 1, 2 and 4 keep their spacing, so first position covers F♯ G G♯ on the E string, B C C♯ on the A string, E F F♯ on the D string and A B♭ B on the G string.', { kind: 'frets', positions: [{ string: 4, fret: 2, finger: 1, label: 'F♯' }, { string: 4, fret: 3, finger: 2, label: 'G' }, { string: 3, fret: 2, finger: 1, label: 'B' }, { string: 3, fret: 3, finger: 2, label: 'C' }, { string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 4, finger: 4, label: 'F♯' }, { string: 1, fret: 2, finger: 1, label: 'A' }, { string: 1, fret: 4, finger: 4, label: 'B' }], maxFret: 6 }),
      ]),
      lesson('db5-2', 'G Major', 'learn', 'One sharp', [
        keysig(B, 'C G', 6),
        scale('G', 'major', 'R', { octave: 1, guitarPosition: 2 }),
        read(B, POS1_G, { key: 'G', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 3, harmonic: true }),
      ], [
        insight('The key of G', 'A sharp on the F line at the start of every staff means every F is F♯, in every octave. In first position both F♯s fall under the fingers: the 1st finger on the E string and the 4th on the D string.', { kind: 'staff', clef: B, notes: ['F#1', 'F#2'], key: 'G' }),
      ]),
      lesson('db5-3', 'C♯ and D Major', 'learn', 'Two sharps, and a shift up the G string', [
        meet(B, 'C#2', { frets: [at(3, 4, 4)], tips: ['C♯: A string, 4th finger in first position. Written in the second space with a sharp.'] }),
        keysig(B, 'C G D', 8),
        scale('D', 'major', 'R', { octave: 2, guitarPosition: 4 }),
        read(B, POS1_D, { key: 'D', guitarPosition: 2, rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('The top of the D scale', 'D major from the open D climbs past B on the G string. For C♯ and D, slide the hand up the G string so the 1st finger lands on C♯ and the 2nd on D. Your first shift.'),
      ]),
      lesson('db5-4', 'Songs in D', 'song', 'Pachelbel’s ground and Dvořák’s Largo', [
        piece('doublebass-canon-ground'),
        piece('doublebass-goin-home'),
      ]),
      lesson('db5-c', 'Checkpoint: Sharp Keys', 'checkpoint', 'Read in G and D', [
        keysig(B, 'C G D', 8),
        scale('G', 'major', 'R', { octave: 1, guitarPosition: 2, mode: 'tempo', tempo: 84, rhythm: 'e', fingering: 'first' }),
        read(B, POS1_D, { key: 'D', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, POS1_G, { key: 'G', guitarPosition: 2, rhythms: RH.qh, maxLeap: 3, harmonic: true, fingering: 'none' }),
      ]),
    ], ['First position', 'F♯ and C♯', 'G and D major']),

    // ------------------------------------------------------------------ 6
    unit('db6', 'Flat Keys: F and B♭', 'Back to half position for B♭, E♭ and A♭: F major, B♭ major and Beethoven in C minor.', [
      lesson('db6-1', 'B♭ and the Key of F', 'learn', 'One flat', [
        meet(B, 'Bb1 Bb2', { frets: [at(3, 1, 1), at(1, 3, 4)], tips: ['B♭: A string, 1st finger in half position. Written on the second line with a flat.', 'B♭: G string, 4th finger in half position, just above the staff.'] }),
        keysig(B, 'C F', 6),
        scale('F', 'major', 'R', { octave: 1, guitarPosition: 1 }),
        read(B, F_MAJ, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Flats in half position', 'A flat lowers a note a semitone. F major has one flat, B♭: every B is played a semitone lower. Flat keys suit half position: B♭, E♭ and A♭ all fall under the 1st finger.', { kind: 'staff', clef: B, notes: ['Bb1', 'Bb2'], key: 'F' }),
      ]),
      lesson('db6-2', 'E♭, A♭ and B♭ Major', 'learn', 'Two flats', [
        meet(B, 'Eb2 Ab2', { frets: [at(2, 1, 1), at(1, 1, 1)], tips: ['E♭: D string, 1st finger in half position, in the third space with a flat.', 'A♭: G string, 1st finger in half position, on the top line with a flat.'] }),
        keysig(B, 'C F Bb', 8),
        scale('Bb', 'major', 'R', { octave: 1, guitarPosition: 1 }),
        read(B, BB_MAJ, { key: 'Bb', rhythms: RH.eighths, maxLeap: 3, harmonic: true }),
      ]),
      lesson('db6-3', 'Flat-Key Songs', 'song', 'A nursery tune and a march', [
        piece('doublebass-twinkle-in-f'),
        piece('doublebass-bb-march'),
      ]),
      lesson('db6-4', 'Beethoven’s Fifth', 'song', 'Four notes the whole orchestra plays together', [
        tip('C minor', 'C minor has three flats, B♭, E♭ and A♭, the same as E♭ major. Beethoven’s Fifth Symphony opens with the whole orchestra in unison: short–short–short–long. Feel the rest at the start of each bar as a beat.'),
        piece('doublebass-beethoven-five'),
      ]),
      lesson('db6-c', 'Checkpoint: Flat Keys', 'checkpoint', 'Read in F and B♭', [
        keysig(B, 'C G D F Bb', 10),
        read(B, F_MAJ, { key: 'F', rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, BB_MAJ, { key: 'Bb', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['B♭ E♭ A♭', 'F and B♭ major', 'C minor']),

    // ------------------------------------------------------------------ 7
    unit('db7', 'Bass Lines: Roots, Fifths and Walking', 'The bass player’s job: roots on the beat, fifths, walking quarter notes and approach notes.', [
      lesson('db7-1', 'Roots', 'learn', 'The note a chord is named after', [
        dpiece('Roots in G', 'G', [4, 4], [ROOTS_G], { prompt: 'G, C and D: the I, IV and V chords in G.' }),
        dpiece('Root and Fifth in F', 'F', [4, 4], [RF_F], { prompt: 'F, B♭ and C, each with its 5th.' }),
      ], [
        insight('Root notes', 'A chord symbol such as G, C or D7 names its root, the note the chord is built on. Playing the root on beat 1 is the bass’s first job: it tells everyone’s ears what the harmony is.'),
        insight('I, IV and V', 'Most folk songs, hymns and blues live on three chords, numbered from the key note: I, IV and V. In G they are G, C and D; in F they are F, B♭ and C.'),
      ]),
      lesson('db7-2', 'Root and Fifth', 'learn', 'The backbone of a bass line', [
        interval(B, HALF_C, [4, 5], 10),
        read(B, HALF_C, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.7, harmonic: true }),
      ], [
        insight('Root–fifth', 'The 5th of a chord is five letters up from the root. On the double bass it is on the next string up, two semitones higher, or on the same place one string down: the 5th underneath the root.', { kind: 'frets', positions: [{ string: 3, fret: 3, label: 'C', root: true }, { string: 2, fret: 5, label: 'G' }, { string: 4, fret: 3, label: 'G' }], maxFret: 7 }),
      ]),
      lesson('db7-3', 'Walking Bass', 'learn', 'Steady quarters that lead to the next chord', [
        dpiece('Walking in F', 'F', [4, 4], [WALK_F], { prompt: 'Plucked, steady quarter notes: a chord tone on beat 1, a step into the next bar on beat 4.' }),
      ], [
        insight('How a walking bass works', 'A walking bass moves in steady quarter notes: the root on beat 1, chord tones or scale steps on beats 2 and 3, and on beat 4 a note one step away from the next root. That last note is what makes it walk.'),
      ]),
      lesson('db7-4', 'Approach Notes', 'learn', 'A semitone away from the target', [
        dpiece('Chromatic Walk in C', 'C', [4, 4], [APPROACH], { prompt: 'Beat 4 is a semitone above or below the next root.' }),
        tip('Swing', 'In jazz the bass walks in steady quarter notes while everyone else swings the eighths, long–short. Feel beats 2 and 4, where the drummer’s hi-hat closes, and play right on the front of the beat.'),
        piece('doublebass-walking-blues-in-f'),
      ], [
        insight('One semitone away', 'The strongest way into a new root is from a semitone away, below or above. These chromatic approach notes don’t belong to the key, but on beat 4 they pull into the next bar like a magnet.'),
      ]),
      lesson('db7-c', 'Checkpoint: Bass Lines', 'checkpoint', 'Roots, fifths and a walk', [
        interval(B, HALF_C, [4, 5, 8], 8),
        dpiece('Walking in F', 'F', [4, 4], [WALK_F], { mode: 'tempo', tempo: 96, fingering: 'first' }),
        read(B, HALF_C, { rhythms: RH.quarters, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 84, fingering: 'first' }),
      ]),
    ], ['Roots', 'Root–fifth', 'Walking bass']),

    // ------------------------------------------------------------------ 8
    unit('db8', 'Minor Keys', 'E, A, D and B minor: relative minors, the raised 7th and two minor-key classics.', [
      lesson('db8-1', 'E Minor', 'learn', 'The relative minor of G', [
        scale('E', 'natural-minor', 'R', { octave: 1, guitarPosition: 2 }),
        read(B, EM, { key: 'Em', guitarPosition: 2, rhythms: RH.qh, maxLeap: 3 }),
      ], [
        insight('Relative minor', 'E minor shares G major’s key signature, one sharp, but its home note is E: your lowest open string. That deep, ringing tonic is why so much bass music sits in E minor.', { kind: 'staff', clef: B, notes: ['E1', 'F#1', 'G1', 'A1', 'B1', 'C2', 'D2', 'E2'], key: 'Em' }),
      ]),
      lesson('db8-2', 'A Minor and G♯', 'learn', 'The raised 7th', [
        meet(B, 'G#1', { frets: [at(4, 4, 4)], tips: ['G♯: E string, 4th finger in first position. In A minor it leads straight up to the open A.'] }),
        scale('A', 'natural-minor', 'R', { octave: 1, guitarPosition: 1 }),
        read(B, AM, { key: 'Am', guitarPosition: 2, rhythms: RH.qh, maxLeap: 3, harmonic: true }),
      ], [
        insight('The raised 7th', 'Minor-key bass lines often raise the 7th note so it leans into the home note: G♯ in A minor, written as an accidental each time.', { kind: 'staff', clef: B, notes: ['A1/q', 'E1/q', 'G#1/q', 'A1/q'], time: [4, 4] }),
      ]),
      lesson('db8-3', 'D Minor and B Minor', 'learn', 'One flat; two sharps', [
        keysig(B, 'Am Em Dm Bm', 8),
        read(B, DM, { key: 'Dm', rhythms: RH.qh, maxLeap: 2 }),
        read(B, BM, { key: 'Bm', guitarPosition: 2, rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Two more minors', 'D minor shares F major’s flat and lives in half position. B minor shares D major’s two sharps and lies perfectly in first position: 1, 2 and 4 on every string.'),
      ]),
      lesson('db8-4', 'Minor-Key Classics', 'song', 'Greensleeves and the Mountain King', [
        piece('doublebass-greensleeves'),
        piece('doublebass-mountain-king'),
      ]),
      lesson('db8-c', 'Checkpoint: Minor Keys', 'checkpoint', 'Read in A, E, D and B minor', [
        keysig(B, 'Am Em Dm Bm', 8),
        read(B, AM, { key: 'Am', guitarPosition: 2, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(B, BM, { key: 'Bm', guitarPosition: 2, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['E, A, D and B minor', 'Raised 7th', 'Grieg']),

    // ------------------------------------------------------------------ 9
    unit('db9', 'Dotted Rhythms and Six-Eight', 'Long–short rhythms, two big beats per bar, and notes between the beats.', [
      lesson('db9-1', 'The Dotted Quarter', 'learn', 'Long–short in the bass', [
        tip('The dot', 'A dotted quarter lasts 1½ beats and is usually answered by an eighth: count “1 – & 2”. Bowed, use more bow on the long note and a quick, light stroke on the short one.', { kind: 'staff', clef: B, notes: ['G1/q.', 'A1/e', 'B1/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(B, POS1_G, { key: 'G', guitarPosition: 2, rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 63 }),
      ]),
      lesson('db9-2', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('6/8 time', 'Six eighths per bar, felt as two big beats: ONE two three FOUR five six. A quarter and an eighth fill one big beat; a down-bow on each big beat keeps the lilt.', { kind: 'staff', clef: B, notes: ['D2/q', 'A1/e', 'D2/q', 'F#2/e'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(B, POS1_D, { key: 'D', guitarPosition: 2, time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
        piece('doublebass-rowing-jig'),
      ]),
      lesson('db9-3', 'Syncopation', 'learn', 'Notes that push across the beat', [
        tip('Syncopation', 'Syncopation puts notes between the beats and holds them across the next one: “1 & (2) &”. Keep your foot on every beat and let the bass push against it.', { kind: 'staff', clef: B, notes: ['A1/e', 'E2/q', 'A1/e', 'r/q', 'G1/q'], time: [4, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        read(B, HALF_C, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true }),
      ]),
      lesson('db9-c', 'Checkpoint: Rhythm', 'checkpoint', 'Dotted, compound and syncopated rhythms', [
        rhythm([6, 8], RH.compound, { tempo: 66, reps: 1 }),
        read(B, POS1_G, { key: 'G', guitarPosition: 2, rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, POS1_D, { key: 'D', guitarPosition: 2, time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', '6/8', 'Syncopation']),

    // ------------------------------------------------------------------ 10
    unit('db10', 'Second and Third Positions', 'The hand climbs: second position, third position, and how to shift.', [
      lesson('db10-1', 'Second Position', 'learn', 'The 1st finger a minor third up', [
        meet(B, 'C2 F2 Bb2 C3', { frets: [at(3, 3, 1), at(2, 3, 1), at(1, 3, 1), at(1, 5, 4)], tips: ['C: A string, 1st finger in second position.', 'F: D string, 1st finger, the same place one string higher.', 'B♭: G string, 1st finger.', 'C: G string, 4th finger, on the ledger line above the staff.'] }),
        read(B, POS2, { key: 'F', guitarPosition: 3, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Second position', 'In second position the 4th finger plays the same pitch as the next string up, open: A on the E string matches the open A, D on the A string the open D, G on the D string the open G. Play each pair to check you are in tune.', { kind: 'frets', positions: [{ string: 4, fret: 3, finger: 1, label: 'G' }, { string: 4, fret: 5, finger: 4, label: 'A' }, { string: 3, fret: 3, finger: 1, label: 'C' }, { string: 3, fret: 5, finger: 4, label: 'D' }, { string: 2, fret: 3, finger: 1, label: 'F' }, { string: 2, fret: 5, finger: 4, label: 'G' }, { string: 1, fret: 3, finger: 1, label: 'B♭' }, { string: 1, fret: 5, finger: 4, label: 'C' }], maxFret: 7 }),
      ]),
      lesson('db10-2', 'Third Position', 'learn', 'The 1st finger a fourth up', [
        meet(B, 'D2 G2 C3 D3', { frets: [at(3, 5, 1), at(2, 5, 1), at(1, 5, 1), at(1, 7, 4)], tips: ['D: A string, 1st finger in third position, the same pitch as the open D string. Check it against the open string.', 'G: D string, 1st finger, matching the open G.', 'C: G string, 1st finger.', 'D: G string, 4th finger, in the space above the ledger line.'] }),
        read(B, POS3, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Third position', 'In third position the 1st finger plays the note of the next open string up: D on the A string, G on the D string, and C on the G string. The thumb travels behind the neck with the hand; never leave it behind.', { kind: 'frets', positions: [{ string: 4, fret: 5, finger: 1, label: 'A' }, { string: 4, fret: 7, finger: 4, label: 'B' }, { string: 3, fret: 5, finger: 1, label: 'D' }, { string: 3, fret: 7, finger: 4, label: 'E' }, { string: 2, fret: 5, finger: 1, label: 'G' }, { string: 2, fret: 7, finger: 4, label: 'A' }, { string: 1, fret: 5, finger: 1, label: 'C' }, { string: 1, fret: 7, finger: 4, label: 'D' }], minFret: 3, maxFret: 9 }),
      ]),
      lesson('db10-3', 'Shifting', 'learn', 'Move the whole hand', [
        tip('How to shift', 'Lighten the finger, slide it along the string as the whole arm carries the hand up or down, thumb included, and press again only when you arrive. Look ahead, and shift during an open string or a rest whenever you can.'),
        dpiece('Climbing the G String', 'C', [4, 4], [SHIFT_G], { prompt: 'Half position, then second and third, and back down. Follow the finger numbers.' }),
        read(B, POS3, { guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('db10-4', 'Songs Up the Neck', 'song', 'A hymn and a ballad that climb the G string', [
        piece('doublebass-amazing-grace'),
        piece('doublebass-scarborough-fair'),
      ]),
      lesson('db10-c', 'Checkpoint: Positions', 'checkpoint', 'Read and shift up the neck', [
        read(B, POS2, { key: 'F', guitarPosition: 3, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(B, POS3, { guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
        dpiece('Climbing the G String', 'C', [4, 4], [SHIFT_G], { mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['Second position', 'Third position', 'Shifting']),

    // ------------------------------------------------------------------ 11
    unit('db11', 'Fourth Position and the Orchestra', 'Up to E on the G string, and orchestral parts that use the whole bass.', [
      lesson('db11-1', 'Fourth Position', 'learn', 'The 1st finger a fifth up', [
        meet(B, 'D3 E3 A2 B2', { frets: [at(1, 7, 1), at(1, 9, 4), at(2, 7, 1), at(2, 9, 4)], tips: ['D: G string, 1st finger in fourth position, a fifth above the open G.', 'E: G string, 4th finger, on the second ledger line above the staff: the highest note in this course.', 'A: D string, 1st finger, a fifth above the open D.', 'B: D string, 4th finger.'] }),
        dpiece('Fourth-Position Study', 'G', [4, 4], [POS4_STUDY], { prompt: 'Fingers 1 and 4 a whole tone apart on the A, D and G strings. Every note shows its string and finger.' }),
      ], [
        insight('Fourth position', 'In fourth position the 1st finger sits a fifth above each open string: B on the E string, E on the A string, A on the D string and D on the G string. The hand keeps its Simandl shape: 1, 2 and 4 over a whole tone.', { kind: 'frets', positions: [{ string: 3, fret: 7, finger: 1, label: 'E' }, { string: 3, fret: 9, finger: 4, label: 'F♯' }, { string: 2, fret: 7, finger: 1, label: 'A' }, { string: 2, fret: 9, finger: 4, label: 'B' }, { string: 1, fret: 7, finger: 1, label: 'D' }, { string: 1, fret: 9, finger: 4, label: 'E' }], minFret: 5, maxFret: 11 }),
      ]),
      lesson('db11-2', 'Orchestral Parts', 'learn', 'Counting rests and coming in together', [
        tip('The bass in the orchestra', 'Double basses usually play the cellos’ line an octave lower, hold the long notes the harmony stands on, and join the whole string section for the big unison moments. Count every rest, breathe with the conductor, and come in exactly together.'),
        piece('doublebass-eine-kleine'),
        read(B, POS3, { guitarPosition: 5, time: [2, 4], rhythms: RH.eighthsRests, maxLeap: 4, harmonic: true, fingering: 'first' }),
      ]),
      lesson('db11-3', 'High on the Neck', 'song', 'A song in fourth position', [
        piece('doublebass-high-on-the-neck'),
        dpiece('Fourth-Position Study', 'G', [4, 4], [POS4_STUDY], { mode: 'tempo', tempo: 60, fingering: 'first' }),
      ]),
      lesson('db11-c', 'Checkpoint: Up the Neck', 'checkpoint', 'Fourth position and an orchestral excerpt', [
        dpiece('Fourth-Position Study', 'G', [4, 4], [POS4_STUDY], { mode: 'tempo', tempo: 66, fingering: 'first' }),
        piece('doublebass-eine-kleine', { mode: 'tempo', fingering: 'first' }),
        read(B, POS3, { guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
    ], ['Fourth position', 'Orchestral parts']),

    // ------------------------------------------------------------------ 12
    unit('db12', 'Final Repertoire and Exam', 'The blues, the orchestra, a sight-reading sprint and the final test.', [
      lesson('db12-1', 'Walking the Blues', 'song', 'Twelve bars in steady quarters', [
        piece('doublebass-walking-blues-in-f', { mode: 'tempo' }),
        dpiece('Chromatic Walk in C', 'C', [4, 4], [APPROACH], { mode: 'tempo', tempo: 96, fingering: 'first' }),
      ], [
        insight('The 12-bar blues', 'Twelve bars, three chords: four bars of I, two of IV, two of I, then V, IV, I and a bar of V that turns the form around. In F: F7, B♭7 and C7. Learn the form and you can play with almost anyone.'),
      ]),
      lesson('db12-2', 'Orchestral Classics', 'song', 'Beethoven and Grieg, in time', [
        piece('doublebass-beethoven-five', { mode: 'tempo' }),
        piece('doublebass-mountain-king', { mode: 'tempo', fingering: 'first' }),
      ]),
      lesson('db12-3', 'Sight-Reading Sprint', 'challenge', 'Read the whole range at tempo', [
        name(B, FULL, 30, { sequence: true, title: 'Lightning round' }),
        read(B, HALF_C, { rhythms: RH.dottedRests, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
        read(B, POS3, { guitarPosition: 5, rhythms: RH.syncopation, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
      lesson('db12-c', 'Final Exam: Double Bass', 'checkpoint', 'Prove your bass-reading mastery', [
        name(B, FULL, 30, { sequence: true }),
        keysig(B, 'C G D F Bb', 10),
        read(B, POS1_G, { key: 'G', guitarPosition: 2, rhythms: RH.dottedRests, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 66, fingering: 'none', measures: 6 }),
        read(B, POS3, { guitarPosition: 5, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
        read(B, BM, { key: 'Bm', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Walking blues', 'Orchestral excerpts', 'Sight-reading']),
  ],
};
