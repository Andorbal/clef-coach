import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Bass guitar · Bass clef. Scores hold SOUNDING pitch; the bass8vb clef writes every
 * note an octave higher, exactly as bass parts are printed. The open strings are
 * E1 A1 D2 G2 (strings 4..1): the open E is drawn on the ledger line below the staff.
 *
 * Fingering follows the Simandl system in the low positions (fingers 1, 2 and 4 over
 * three frets) and one finger per fret from the 7th position up.
 */
const B = 'bass8vb' as const;

/** A fretboard location for `meet`: string (1 = G, 4 = low E), fret, left-hand finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- Pitch pools (sounding pitch; first position unless noted) ----
const OPEN = 'E1 A1 D2 G2';
const S4 = 'E1 F1 G1';
const S34 = 'E1 F1 G1 A1 B1 C2';
const S234 = 'E1 F1 G1 A1 B1 C2 D2 E2 F2';
const POS1 = 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2';
const ALL1 = 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3';
const GMAJ = 'E1 F#1 G1 A1 B1 C2 D2 E2 F#2 G2 A2 B2'; // second position
const EM = 'E1 F#1 G1 A1 B1 C2 D2 E2 F#2 G2'; // second position
const DMAJ = 'E1 F#1 G1 A1 B1 C#2 D2 E2 F#2 G2 A2 B2'; // second position
const FMAJ = 'E1 F1 G1 A1 Bb1 C2 D2 E2 F2 G2 A2 Bb2';
const BBMAJ = 'F1 G1 A1 Bb1 C2 D2 Eb2 F2 G2 A2 Bb2';
const AM_H = 'E1 F1 G#1 A1 B1 C2 D2 E2 F2 G#2 A2';
const DM = 'E1 F1 G1 A1 Bb1 C2 D2 E2 F2 G2 A2';
const POS5 = 'A1 B1 D2 E2 G2 A2 C3 D3'; // index on the 5th fret: frets 5–7
const POS7 = 'B1 C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3'; // one finger per fret, frets 7–10
const FULL = 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3';

function bpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: B, voices }], o);
}

// ---- Exercises and bass lines (sounding pitch) ----
const ROOTS_C = 'C2/w | F1/w | G1/w | C2/w | C2/h F1/h | C2/h G1/h | F1/h G1/h | C2/w |';
const ROOTS_G = 'G1/w | C2/w | D2/w | G1/w | G1/h C2/h | G1/h D2/h | C2/h D2/h | G1/w |';
const ROOTS_A = 'A1/w | D2/w | E1/w | A1/w | A1/h D2/h | A1/h E1/h | D2/h E1/h | A1/w |';
const RF_C = 'C2/h G1/h | F1/h C2/h | G1/h D2/h | C2/h G1/h | C2/q G1 C2 G1 | F1/q C2 F1 C2 | G1/q D2 G1 D2 | C2/w |';
const RF_G = 'G1/q D2 G1 D2 | C2/q G1 C2 G1 | D2/q A1 D2 A1 | G1/q D2 G1 D2 | C2/q G1 C2 G1 | G1/q D2 G1 D2 | D2/q A1 D2 A1 | G1/w |';
const RF_A = 'A1/q E2 A1 E2 | D2/q A2 D2 A2 | E1/q B1 E1 B1 | A1/q E2 A1 E2 | D2/q A1 D2 A1 | A1/q E1 A1 E1 | E1/q B1 E2 B1 | A1/w |';
const EIGHTH_DRIVE = 'A1/e A1 A1 A1 A1 A1 A1 A1 | F1/e F1 F1 F1 F1 F1 F1 F1 | C2/e C2 C2 C2 C2 C2 C2 C2 | G1/e G1 G1 G1 B1 B1 B1 B1 | A1/e A1 A1 A1 E2 E2 E2 E2 | F1/e F1 F1 F1 C2 C2 C2 C2 | G1/e G1 G1 G1 D2 D2 E2 E2 | A1/w |';
const WALTZ_C = 'C2/h. | G1/h. | F1/h. | C2/h. | G1/h. | D2/h. | G1/h B1/q | C2/h. |';
const RFO = 'A1/q E2 A2 E2 | F1/q C2 F2 C2 | G1/q D2 G2 D2 | C2/q G2 C3 G2 | A1/q E2 A2 E2 | F1/q C2 F2 C2 | G1/q D2 G2 B1 | C2/w |';
const WALK_C = 'C2/q D2 E2 B1 | A1/q B1 C2 E2 | D2/q F2 A1 F1 | G1/q B1 D2 B1 | C2/q G1 E1 G1 | A1/q E2 C2 E2 | D2/q F2 G1 B1 | C2/w |';
const WALK_G = 'G1/q A1 B1 D2 | E2/q D2 C2 B1 | A1/q C2 E2 C2 | D2/q F#2 A1 F#1 | G1/q B1 D2 B1 | C2/q E2 G2 E2 | D2/q A1 C2 F#1 | G1/w |';
const WALK_CHROM = 'C2/q E2 G1 G#1 | A1/q C2 E2 C#2 | D2/q F2 A1 F#1 | G1/q B1 D2 C#2 | C2/q E2 G1 Bb1 | A1/q C2 E2 Eb2 | D2/q F2 G1 B1 | C2/w |';
const SYNC_LINE = 'A1/e E2/q A1/e r/q G1/q | A1/e C2/q D2/e r/q E2/q | D2/e A1/q D2/e r/q C2/q | D2/e F2/q G2/e r/q A2/q | E1/e B1/q E2/e r/q D2/q | E1/e G#1/q B1/e r/q E2/q | A1/e E2/q A1/e r/q G1/q | A1/w |';
const ROCK_GROOVE = 'E1/e E1 E1 E1 E1 E1 D2 E2 | E1/e E1 E1 E1 G1 G1 A1 B1 | C2/e C2 C2 C2 C2 C2 B1 A1 | D2/e D2 D2 D2 D2 D2 C2 B1 | E1/e E1 E1 E1 E1 E1 D2 E2 | E1/e E1 E1 E1 G1 G1 A1 B1 | C2/e C2 C2 C2 D2 D2 D2 D2 | E1/w |';
/** Root–5th–octave shapes moved along the E and A strings: every bar is a shift. */
const SHIFT_LINE =
  'A1/q@1%4 E2@3%3 A2@4%2 E2@3%3 | C2/q@1%4 G2@3%3 C3@4%2 G2@3%3 | D2/q@1%4 A2@3%3 D3@4%2 A2@3%3 | E2/q@1%3 B2@3%2 E3@4%1 B2@3%2 | ' +
  'A1/q@1%4 E2@3%3 A2@4%2 E2@3%3 | G1/q@1%4 D2@3%3 G2@4%2 D2@3%3 | F1/h@1%4 E1/h@0%4 | A1/w@0%3 |';

export const bassLines: TrackDef = {
  id: 'bass-lines',
  instrument: 'bass',
  title: 'Bass Clef',
  subtitle: 'Bass guitar · Reading bass lines',
  description: 'Read bass clef the way bass players do — written an octave above where it sounds. From the open strings to roots and fifths, walking lines, Motown grooves, the 12-bar blues and funky sixteenths.',
  clef: 'bass8vb',
  accent: '#c792ea',
  glyph: '𝄢',
  heatmap: [{ clef: 'bass8vb', low: 'E1', high: 'G3' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('bl1', 'Open Strings in Bass Clef', 'E, A, D and G — your four open strings, written an octave up.', [
      lesson('bl1-1', 'Meet the Bass Clef', 'learn', 'The F clef and your two lowest strings', [
        meet(B, 'E1', { frets: [at(4, 0, 0)], tips: ['The open 4th string — the thickest — is low E. It is written on the ledger line below the bass staff.'] }),
        meet(B, 'A1', { frets: [at(3, 0, 0)], tips: ['The open 3rd string, A, is written in the bottom space of the staff.'] }),
        name(B, 'E1 A1', 8),
        play(B, 'E1 A1', 8, { hints: true }),
      ], [
        insight('Written an octave up', 'The bass sounds an octave lower than its music is written. Your open E is one of the lowest notes in the band, but it is written on the ledger line just below the bass staff. Writing bass parts an octave up keeps them on the staff instead of buried under ledger lines — guitar music uses the same trick.'),
        insight('The F clef', 'The bass clef (𝄢) is an F clef: its two dots hug the 4th line, and every note on that line is an F. On the bass that written F is the D string, 3rd fret.', { kind: 'staff', clef: B, notes: ['F2'], labels: true }),
        insight('String numbers', 'Strings are numbered from the thinnest: string 1 is G, string 2 is D, string 3 is A and string 4 is the low E.'),
      ]),
      lesson('bl1-2', 'Open D and G', 'learn', 'The middle line and the top space', [
        meet(B, 'D2', { frets: [at(2, 0, 0)], tips: ['The open 2nd string, D, is written on the middle line.'] }),
        meet(B, 'G2', { frets: [at(1, 0, 0)], tips: ['The open 1st string, G, is written in the top space.'] }),
        name(B, OPEN, 12),
        play(B, OPEN, 10, { hints: true }),
        tip('Five strings?', 'A 5-string bass adds a low B string (string 5) below the E. Everything in this course works the same way — the four strings you are learning are strings 1–4 on your instrument. Rest your thumb on the B string to keep it quiet.'),
      ], [
        insight('Open strings on the staff', 'From the bottom: E (ledger line), A (bottom space), D (middle line), G (top space). Each string sits four letters above the one before.', { kind: 'staff', clef: B, notes: ['E1', 'A1', 'D2', 'G2'], labels: true }),
      ]),
      lesson('bl1-3', 'Open-String Grooves', 'practice', 'Read bass lines on open strings', [
        tip('Plucking', 'Pluck with the index and middle fingers in turn (i–m), pulling across the string so the finger comes to rest on the next one. Anchor the thumb on the pickup, or on the E string when you play higher strings.'),
        read(B, OPEN, { rhythms: RH.quarters, maxLeap: 3, leapiness: 1, noteNames: true }),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 3, leapiness: 1 }),
        name(B, OPEN, 12, { sequence: true, title: 'Note rush' }),
        piece('bass-open-string-groove'),
      ]),
      lesson('bl1-c', 'Checkpoint: Open Strings', 'checkpoint', 'Know E, A, D and G on sight', [
        name(B, OPEN, 12),
        play(B, OPEN, 8),
        read(B, OPEN, { rhythms: RH.qh, maxLeap: 3, leapiness: 1, fingering: 'first' }),
      ]),
    ], ['Bass clef', 'Written 8va', 'Open strings']),

    // ------------------------------------------------------------------ 2
    unit('bl2', 'The E and A Strings', 'F and G, B and C — your first fretted notes, and counting beats.', [
      lesson('bl2-1', 'F and G on the E String', 'learn', 'Below the staff and the bottom line', [
        meet(B, 'F1 G1', { frets: [at(4, 1, 1), at(4, 3, 4)], tips: ['F: E string, 1st fret, index finger. Written in the space below the staff.', 'G: E string, 3rd fret, little finger. Written on the bottom line.'] }),
        name(B, 'E1 F1 G1 A1', 10),
        play(B, S4, 10, { hints: true }),
        read(B, S4, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true }),
      ], [
        insight('Fingers 1, 2 and 4', 'Down by the nut the frets are wide, so a bass player covers three frets with three fingers: index (1) on the 1st fret, middle (2) on the 2nd and little finger (4) on the 3rd — the ring finger presses along with it. This is Simandl fingering, and it keeps the hand relaxed.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'E' }, { string: 4, fret: 1, finger: 1, label: 'F' }, { string: 4, fret: 3, finger: 4, label: 'G' }], maxFret: 5 }),
      ]),
      lesson('bl2-2', 'B and C on the A String', 'learn', 'The second line and second space', [
        meet(B, 'B1 C2', { frets: [at(3, 2, 2), at(3, 3, 4)], tips: ['B: A string, 2nd fret, middle finger. Written on the second line.', 'C: A string, 3rd fret, little finger. Written in the second space.'] }),
        name(B, S34, 12),
        play(B, S34, 10, { hints: true }),
        read(B, S34, { rhythms: RH.quarters, maxLeap: 2, noteNames: true }),
      ]),
      lesson('bl2-3', 'Counting Beats', 'learn', 'Quarter, half and whole notes', [
        tip('Note values', 'A quarter note lasts one beat, a half note two and a whole note four. The bass and the drums keep time for the whole band, so count out loud: “1 2 3 4”.', { kind: 'staff', clef: B, notes: ['E1/q', 'F1/q', 'G1/h', 'A1/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(B, S34, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('bl2-4', 'Four-Chord Steps', 'song', 'A song on two strings', [
        piece('bass-andalusian-steps'),
        read(B, S34, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('bl2-c', 'Checkpoint: E and A Strings', 'checkpoint', 'E1 up to C2, in time', [
        name(B, S34 + ' D2 G2', 12),
        play(B, S34, 10),
        read(B, S34, { rhythms: RH.qhw, maxLeap: 3, leapiness: 0.4, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['F G B C', 'Simandl 1-2-4', 'Note values']),

    // ------------------------------------------------------------------ 3
    unit('bl3', 'The D and G Strings', 'E and F, then A, B and C — the whole first position.', [
      lesson('bl3-1', 'E and F on the D String', 'learn', 'The third space and the fourth line', [
        meet(B, 'E2 F2', { frets: [at(2, 2, 2), at(2, 3, 4)], tips: ['E: D string, 2nd fret, middle finger. Written in the third space — one octave above the open E string.', 'F: D string, 3rd fret, little finger. Written on the 4th line, between the dots of the clef.'] }),
        name(B, S234, 14),
        play(B, S234, 10, { hints: true }),
        read(B, S234, { rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Octave partners', 'E on the D string (2nd fret) sounds exactly an octave above the open E string. Two strings up and two frets higher always gives the octave on a bass — a shape you will use constantly.', { kind: 'frets', positions: [{ string: 4, fret: 0, label: 'E', root: true }, { string: 2, fret: 2, finger: 2, label: 'E' }, { string: 4, fret: 1, finger: 1, label: 'F', root: true }, { string: 2, fret: 3, finger: 4, label: 'F' }], maxFret: 5 }),
      ]),
      lesson('bl3-2', 'A, B and C on the G String', 'learn', 'The top line and above', [
        meet(B, 'A2 B2 C3', { frets: [at(1, 2, 2), at(1, 4, 1), at(1, 5, 2)], tips: ['A: G string, 2nd fret, middle finger. Written on the top line.', 'B: G string, 4th fret. Slide the whole hand up so the index finger plays it. Written just above the staff.', 'C: G string, 5th fret, middle finger with the hand still up. Written on the ledger line above the staff.'] }),
        name(B, 'F2 G2 A2 B2 C3', 12),
        play(B, 'G2 A2 B2 C3', 8, { hints: true }),
      ], [
        insight('A small shift', 'First position covers frets 1–3. For B and C on the G string the hand slides up so the index finger sits on the 4th fret — then back down for A. Move the thumb with the hand; never stretch.', { kind: 'frets', positions: [{ string: 1, fret: 2, finger: 2, label: 'A' }, { string: 1, fret: 4, finger: 1, label: 'B' }, { string: 1, fret: 5, finger: 2, label: 'C' }], maxFret: 7 }),
      ]),
      lesson('bl3-3', 'The Whole First Position', 'practice', 'E1 to C3', [
        name(B, ALL1, 20, { sequence: true, title: 'Note rush' }),
        play(B, ALL1, 14),
        read(B, POS1, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
        read(B, ALL1, { rhythms: RH.qhw, maxLeap: 3, leapiness: 0.4 }),
      ]),
      lesson('bl3-4', 'Chord-Tone Rock', 'song', 'Two songs across all four strings', [
        piece('bass-chord-tone-rock'),
        piece('bass-ode-to-joy'),
      ]),
      lesson('bl3-c', 'Checkpoint: First Position', 'checkpoint', 'Every natural note, E1 to C3', [
        name(B, ALL1, 20, { sequence: true }),
        play(B, ALL1, 12),
        read(B, POS1, { rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['E F A B C', 'First position', 'Shifting up']),

    // ------------------------------------------------------------------ 4
    unit('bl4', 'Roots & Fifths', 'Play the root of every chord, then add the fifth: I–IV–V in three keys.', [
      lesson('bl4-1', 'The Root of the Chord', 'learn', 'The note a chord is named after', [
        bpiece('Roots in C', 'C', [4, 4], [ROOTS_C], { prompt: 'C, F and G: the I, IV and V chords in C.' }),
        bpiece('Roots in G', 'G', [4, 4], [ROOTS_G], { prompt: 'G, C and D: the I, IV and V chords in G.' }),
        bpiece('Roots in A', 'C', [4, 4], [ROOTS_A], { prompt: 'A, D and E: the I, IV and V chords in A.' }),
      ], [
        insight('Root notes', 'A chord symbol such as C, F or G7 names its root — the note the chord is built on. Playing the root on beat 1 is the bass player’s first job: it tells everyone’s ears what the harmony is.'),
        insight('I, IV and V', 'Most folk, rock and blues songs live on three chords, numbered from the key note: I, IV and V. In C they are C, F and G; in G they are G, C and D; in A they are A, D and E. Their roots sit side by side in first position.', { kind: 'frets', positions: [{ string: 3, fret: 3, finger: 4, label: 'C', root: true }, { string: 4, fret: 1, finger: 1, label: 'F' }, { string: 4, fret: 3, finger: 4, label: 'G' }], maxFret: 5 }),
      ]),
      lesson('bl4-2', 'Root and Fifth', 'learn', 'The backbone of every bass line', [
        bpiece('Root–Fifth in C', 'C', [4, 4], [RF_C]),
        interval(B, POS1, [4, 5], 10),
        read(B, POS1, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.7, harmonic: true }),
      ], [
        insight('Root–fifth', 'The 5th of a chord is five letters up from the root: C–D–E–F–G. On the bass it is one string higher and two frets up — or, just as often, on the same fret one string lower: the 5th underneath the root.', { kind: 'frets', positions: [{ string: 3, fret: 3, label: 'C', root: true }, { string: 2, fret: 5, label: 'G' }, { string: 4, fret: 3, label: 'G' }], maxFret: 7 }),
      ]),
      lesson('bl4-3', 'Roots and Fifths in Three Keys', 'practice', 'G, C and D; A, D and E', [
        bpiece('Root–Fifth in G', 'G', [4, 4], [RF_G]),
        bpiece('Root–Fifth on A, D and E', 'C', [4, 4], [RF_A], { prompt: 'No sharps needed: the roots and 5ths of A, D and E are all natural notes.' }),
        read(B, POS1, { rhythms: RH.quarters, maxLeap: 4, leapiness: 0.8, harmonic: true, mode: 'tempo', tempo: 76 }),
      ]),
      lesson('bl4-4', 'When the Saints', 'song', 'A marching root–fifth bass line', [
        tip('Walk-ups', 'A bass line often walks by step into the next chord: G–A–B leads up to C, C–B–A falls toward G. Listen for where each walk is going — it always lands on a root on beat 1.'),
        piece('bass-when-the-saints'),
      ]),
      lesson('bl4-c', 'Checkpoint: Roots & Fifths', 'checkpoint', 'Roots and fifths in time', [
        bpiece('Root–Fifth in C', 'C', [4, 4], [RF_C], { mode: 'tempo', tempo: 80, fingering: 'first' }),
        interval(B, POS1, [4, 5], 8),
        read(B, POS1, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.7, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['Roots', 'I–IV–V', 'Root–fifth']),

    // ------------------------------------------------------------------ 5
    unit('bl5', 'Eighth Notes & Muting', 'Driving eighths, rests that really stop, and clean string changes.', [
      lesson('bl5-1', 'Eighth Notes', 'learn', 'Two notes per beat', [
        tip('Eighths in the bass', 'Count “1 & 2 & 3 & 4 &”. Alternate index and middle strictly — even on repeated notes — so every eighth has the same weight.', { kind: 'staff', clef: B, notes: ['A1/e', 'A1/e', 'E2/q', 'D2/e', 'C2/e', 'A1/q'], time: [4, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(B, S234, { rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('bl5-2', 'Rests & Muting', 'learn', 'Silence is part of the groove', [
        tip('Muting', 'Bass notes ring a long time, so a rest takes work: ease the fretting finger off the fret while still touching the string, or touch an open string with a plucking finger. Stopping on time matters as much as starting on time.', { kind: 'staff', clef: B, notes: ['A1/q', 'r/q', 'E2/q', 'r/q', 'D2/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(B, POS1, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('bl5-3', 'Driving Eighths', 'practice', 'Steady eighths on every chord', [
        bpiece('Eighth-Note Drive', 'Am', [4, 4], [EIGHTH_DRIVE], { mode: 'tempo', tempo: 84 }),
        read(B, POS1, { rhythms: RH.eighthsRests, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('bl5-4', 'Drunken Sailor', 'song', 'A sea shanty with a driving chorus', [
        piece('bass-drunken-sailor'),
        read(B, DM, { key: 'Dm', rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('bl5-c', 'Checkpoint: Eighths & Rests', 'checkpoint', 'Eighths and rests in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        bpiece('Eighth-Note Drive', 'Am', [4, 4], [EIGHTH_DRIVE], { mode: 'tempo', tempo: 92, fingering: 'none' }),
        read(B, POS1, { rhythms: RH.eighthsRests, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['Eighths', 'Rests', 'Muting']),

    // ------------------------------------------------------------------ 6
    unit('bl6', 'Three-Four Time', 'Waltz bass: a strong beat one, and a note on beat three that leads on.', [
      lesson('bl6-1', 'Counting in Three', 'learn', 'Three beats per bar', [
        tip('3/4 time', 'Three beats in a bar: ONE two three. In a waltz the bass owns beat one — play it full and let the band fill beats two and three.', { kind: 'staff', clef: B, notes: ['C2/h.', 'G1/h', 'B1/q'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 84 }),
        read(B, POS1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('bl6-2', 'Waltz Bass', 'learn', 'Root, fifth, and a step to the next chord', [
        bpiece('Waltz Roots in C', 'C', [3, 4], [WALTZ_C]),
        read(B, POS1, { time: [3, 4], rhythms: { 'h.': 2, 'h q': 2, q: 1 }, maxLeap: 4, leapiness: 0.6, harmonic: true }),
      ], [
        insight('Root on one', 'The classic waltz bass plays the root on beat one, often swapping to the 5th in the next bar: root… fifth… root… fifth. A quarter note on beat three can step into the next chord.'),
      ]),
      lesson('bl6-3', 'Riverboat Waltz', 'song', 'An old-time waltz bass', [
        piece('bass-riverboat-waltz'),
        read(B, POS1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('bl6-c', 'Checkpoint: Three-Four', 'checkpoint', 'Waltz time, steady and strong', [
        rhythm([3, 4], RH.waltz, { tempo: 92, reps: 1 }),
        bpiece('Waltz Roots in C', 'C', [3, 4], [WALTZ_C], { mode: 'tempo', tempo: 96, fingering: 'none' }),
        read(B, POS1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 84, fingering: 'first' }),
      ]),
    ], ['3/4 time', 'Waltz bass']),

    // ------------------------------------------------------------------ 7
    unit('bl7', 'Sharp Keys: G, D and E Minor', 'F♯ and C♯, second position, and bass lines in three keys.', [
      lesson('bl7-1', 'F♯ and Second Position', 'learn', 'One sharp: G major', [
        meet(B, 'F#1 F#2', { frets: [at(4, 2, 1), at(2, 4, 4)], tips: ['F♯ on the E string, 2nd fret — written in the space below the staff. In second position the index finger lives here.', 'F♯ on the D string, 4th fret, little finger — written on the 4th line, between the dots of the clef.'] }),
        keysig(B, 'C G', 6),
        read(B, GMAJ, { key: 'G', guitarPosition: 2, rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Second position', 'Sharp keys sit best with the index finger on the 2nd fret: fingers 1, 2 and 4 cover frets 2, 3 and 4. F♯, B, E and A fall under finger 1, G, C and F♮ under finger 2, and the 4th-fret notes — C♯, F♯ and B — under the little finger.', { kind: 'frets', positions: [{ string: 4, fret: 2, finger: 1, label: 'F♯' }, { string: 4, fret: 3, finger: 2, label: 'G', root: true }, { string: 3, fret: 2, finger: 1, label: 'B' }, { string: 3, fret: 3, finger: 2, label: 'C' }, { string: 2, fret: 2, finger: 1, label: 'E' }, { string: 2, fret: 4, finger: 4, label: 'F♯' }, { string: 1, fret: 2, finger: 1, label: 'A' }, { string: 1, fret: 4, finger: 4, label: 'B' }], minFret: 0, maxFret: 6 }),
        insight('Key signatures', 'A sharp on the F line at the start of every staff means every F is F♯, in every octave — the key of G major, or its relative minor, E minor.', { kind: 'staff', clef: B, notes: ['F#1', 'F#2'], key: 'G' }),
      ]),
      lesson('bl7-2', 'G Major & E Minor', 'practice', 'One key signature, two home notes', [
        scale('G', 'major', 'R', { octave: 1, guitarPosition: 2 }),
        read(B, GMAJ, { key: 'G', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 3, harmonic: true }),
        tip('Relative minor', 'E minor shares G major’s key signature — one sharp — but its home note is E: your lowest open string. That deep, ringing tonic is why so many rock and metal bass lines are in E minor.'),
        scale('E', 'natural-minor', 'R', { octave: 1, guitarPosition: 2 }),
        read(B, EM, { key: 'Em', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 3, harmonic: true }),
      ]),
      lesson('bl7-3', 'C♯ and D Major', 'learn', 'Two sharps', [
        meet(B, 'C#2', { frets: [at(3, 4, 4)], tips: ['C♯ on the A string, 4th fret, little finger — written in the second space with a sharp.'] }),
        keysig(B, 'C G D', 8),
        scale('D', 'major', 'R', { octave: 2, guitarPosition: 2 }),
        read(B, DMAJ, { key: 'D', guitarPosition: 2, rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('bl7-4', 'Canon in D', 'song', 'Pachelbel’s famous ground bass', [
        piece('bass-pachelbel-canon'),
        read(B, DMAJ, { key: 'D', guitarPosition: 2, rhythms: RH.eighthsRests, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('bl7-c', 'Checkpoint: Sharp Keys', 'checkpoint', 'Read in G, D and E minor', [
        keysig(B, 'C G D Em', 8),
        scale('G', 'major', 'R', { octave: 1, guitarPosition: 2, mode: 'tempo', tempo: 84, rhythm: 'e', fingering: 'first' }),
        read(B, DMAJ, { key: 'D', guitarPosition: 2, rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, EM, { key: 'Em', guitarPosition: 2, rhythms: RH.qh, maxLeap: 3, harmonic: true, fingering: 'none' }),
      ]),
    ], ['F♯ C♯', 'G D Em', 'Second position']),

    // ------------------------------------------------------------------ 8
    unit('bl8', 'Flat Keys & Minor Keys', 'B♭ and E♭, F and B♭ major, and the minor keys A and D.', [
      lesson('bl8-1', 'B♭: F Major', 'learn', 'One flat', [
        meet(B, 'Bb1 Bb2', { frets: [at(3, 1, 1), at(1, 3, 4)], tips: ['B♭ on the A string, 1st fret, index finger — written on the second line with a flat.', 'B♭ on the G string, 3rd fret, little finger — written just above the staff.'] }),
        keysig(B, 'C F', 6),
        scale('F', 'major', 'R', { octave: 1 }),
        read(B, FMAJ, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Flats', 'A flat lowers a note one fret. F major has one flat, B♭: every B is played a fret lower. Flat keys suit first position — B♭, E♭ and A♭ all fall on the 1st fret under the index finger.', { kind: 'staff', clef: B, notes: ['Bb1', 'Bb2'], key: 'F' }),
      ]),
      lesson('bl8-2', 'E♭: B♭ Major', 'learn', 'Two flats', [
        meet(B, 'Eb2', { frets: [at(2, 1, 1)], tips: ['E♭ on the D string, 1st fret, index finger — written in the third space with a flat.'] }),
        keysig(B, 'C F Bb', 8),
        scale('Bb', 'major', 'R', { octave: 1 }),
        read(B, BBMAJ, { key: 'Bb', rhythms: RH.eighths, maxLeap: 3, harmonic: true }),
        piece('bass-swing-low'),
      ]),
      lesson('bl8-3', 'A Minor and D Minor', 'learn', 'Relative minors and the raised 7th', [
        meet(B, 'G#1', { frets: [at(4, 4, 4)], tips: ['G♯ on the E string, 4th fret, little finger (second position). In A minor it leads straight up to A.'] }),
        keysig(B, 'C F G Am Dm Em', 8),
        scale('A', 'harmonic-minor', 'R', { octave: 1 }),
        scale('D', 'natural-minor', 'R', { octave: 2, guitarPosition: 3 }),
        read(B, AM_H, { key: 'Am', rhythms: RH.qh, maxLeap: 3, harmonic: true }),
      ], [
        insight('Relative minors', 'Every major key has a relative minor with the same key signature, three letters lower: C → A minor, F → D minor, G → E minor. Minor-key bass lines often raise the 7th — G♯ in A minor, C♯ in D minor — so the line leans into the home note.', { kind: 'staff', clef: B, notes: ['A1/q', 'E1/q', 'G#1/q', 'A1/q'], time: [4, 4] }),
      ]),
      lesson('bl8-4', 'Minor-Key Songs', 'song', 'Greensleeves and a sarabande', [
        piece('bass-greensleeves'),
        piece('bass-sarabande'),
        read(B, DM, { key: 'Dm', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('bl8-c', 'Checkpoint: Flats & Minor Keys', 'checkpoint', 'Read in F, B♭, A minor and D minor', [
        keysig(B, 'C G D F Bb Am Em Dm', 10),
        read(B, FMAJ, { key: 'F', rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(B, AM_H, { key: 'Am', rhythms: RH.qh, maxLeap: 3, harmonic: true, fingering: 'first' }),
        scale('Bb', 'major', 'R', { octave: 1, mode: 'tempo', tempo: 80, rhythm: 'e', fingering: 'none' }),
      ]),
    ], ['B♭ E♭', 'F B♭ Am Dm', 'Raised 7th']),

    // ------------------------------------------------------------------ 9
    unit('bl9', 'Octaves & Walking Bass', 'Root–fifth–octave patterns, walking quarter notes and chromatic approach notes.', [
      lesson('bl9-1', 'Root, Fifth and Octave', 'learn', 'The bass player’s box', [
        interval(B, ALL1, [5, 8], 10),
        bpiece('Root–Fifth–Octave', 'C', [4, 4], [RFO]),
        read(B, ALL1, { rhythms: RH.qh, maxLeap: 7, leapiness: 0.6, harmonic: true }),
      ], [
        insight('The octave shape', 'From a root on the E or A string, the 5th is one string up and two frets higher, and the octave is two strings up and two frets higher. Root, 5th and octave make a compact box — the shape behind countless bass lines.', { kind: 'frets', positions: [{ string: 4, fret: 3, label: 'G', root: true, finger: 1 }, { string: 3, fret: 5, label: '5th', finger: 3 }, { string: 2, fret: 5, label: '8ve', finger: 4 }], maxFret: 7 }),
      ]),
      lesson('bl9-2', 'Walking Bass', 'learn', 'Steady quarters that lead to the next chord', [
        bpiece('Walking in C', 'C', [4, 4], [WALK_C], { prompt: 'Root on beat 1, a step into the next root on beat 4.' }),
        bpiece('Walking in G', 'G', [4, 4], [WALK_G]),
      ], [
        insight('How a walking bass works', 'A walking bass moves in steady quarter notes: the root on beat 1, chord tones or scale steps on beats 2 and 3, and on beat 4 a note one step away from the next root. That last note is what makes it walk.'),
      ]),
      lesson('bl9-3', 'Chromatic Approach Notes', 'learn', 'One fret away from the target', [
        bpiece('Chromatic Walk in C', 'C', [4, 4], [WALK_CHROM], { prompt: 'Beat 4 is one fret above or below the next root.' }),
        tip('Above or below', 'An approach note from below (G♯ into A, C♯ into D) pushes upward; from above (B♭ into A, E♭ into D) it sinks into the root. Both are just one fret away — the ear forgives anything that resolves.'),
        piece('bass-walking-the-changes'),
      ], [
        insight('One fret away', 'The strongest way into a new root is from one fret away — a half step below or above. These chromatic approach notes don’t belong to the key, but on beat 4 they pull into the next bar like a magnet.', { kind: 'frets', positions: [{ string: 3, fret: 3, label: 'C', root: true }, { string: 3, fret: 2, label: 'B' }, { string: 3, fret: 4, label: 'C♯' }, { string: 2, fret: 0, label: 'D', root: true }], maxFret: 6 }),
      ]),
      lesson('bl9-4', 'Walking Practice', 'practice', 'Walk in time', [
        bpiece('Walking in G', 'G', [4, 4], [WALK_G], { mode: 'tempo', tempo: 96, fingering: 'first' }),
        read(B, ALL1, { rhythms: RH.quarters, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 84 }),
      ]),
      lesson('bl9-c', 'Checkpoint: Octaves & Walking', 'checkpoint', 'Octaves, fifths and a chromatic walk', [
        interval(B, ALL1, [5, 8], 8),
        bpiece('Chromatic Walk in C', 'C', [4, 4], [WALK_CHROM], { mode: 'tempo', tempo: 92, fingering: 'first' }),
        read(B, ALL1, { rhythms: RH.quarters, maxLeap: 7, leapiness: 0.5, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'first' }),
      ]),
    ], ['Octaves', 'Walking bass', 'Approach notes']),

    // ------------------------------------------------------------------ 10
    unit('bl10', 'Grooves: Dotted & Syncopated', 'Dotted rhythms, notes between the beats, Motown and rock grooves — and 6/8.', [
      lesson('bl10-1', 'Dotted Rhythms', 'learn', 'Long–short in the bass', [
        tip('Dotted quarter', 'A dotted quarter lasts 1½ beats and is usually answered by an eighth: “1 – & 2”. It is the heartbeat of countless bass grooves.', { kind: 'staff', clef: B, notes: ['A1/q.', 'A1/e', 'E2/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(B, POS1, { rhythms: RH.dotted, maxLeap: 3, harmonic: true }),
      ]),
      lesson('bl10-2', 'Syncopation', 'learn', 'Notes that push across the beat', [
        tip('Syncopation', 'Syncopation puts notes between the beats and holds them across the next one: “1 & (2) &”. Keep your foot on every beat and let the bass push against it.', { kind: 'staff', clef: B, notes: ['A1/e', 'E2/q', 'A1/e', 'r/q', 'G1/q'], time: [4, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        bpiece('Syncopated Line', 'Am', [4, 4], [SYNC_LINE]),
        read(B, POS1, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true }),
      ]),
      lesson('bl10-3', 'Motown & Rock', 'song', 'Two grooves that built popular music', [
        piece('bass-motown-groove'),
        bpiece('Rock Eighths in E Minor', 'Em', [4, 4], [ROCK_GROOVE], { mode: 'tempo', tempo: 100 }),
        read(B, EM, { key: 'Em', guitarPosition: 2, rhythms: RH.dottedRests, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ], [
        insight('The Motown sound', 'The great 1960s Detroit bass lines are built from chord tones and passing notes in busy, syncopated eighths — with short rests that let the groove breathe. Play short where you see a rest and land beat one with the kick drum.'),
      ]),
      lesson('bl10-4', 'Six-Eight Time', 'learn', 'Two big beats, six small ones', [
        tip('6/8 time', 'Six eighth notes per bar, felt as two big beats: ONE two three FOUR five six. A quarter followed by an eighth fills one big beat.', { kind: 'staff', clef: B, notes: ['A1/q', 'C2/e', 'E2/q', 'C2/e'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        piece('bass-house-of-the-rising-sun'),
      ]),
      lesson('bl10-c', 'Checkpoint: Grooves', 'checkpoint', 'Dotted and syncopated rhythms in time', [
        rhythm([4, 4], RH.dottedRests, { tempo: 72, reps: 1 }),
        bpiece('Syncopated Line', 'Am', [4, 4], [SYNC_LINE], { mode: 'tempo', tempo: 80, fingering: 'first' }),
        read(B, POS1, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
    ], ['Dotted rhythms', 'Syncopation', 'Motown', '6/8']),

    // ------------------------------------------------------------------ 11
    unit('bl11', 'Up the Neck & the Blues', 'Fifth and seventh position, shifting, and the 12-bar blues in E and A.', [
      lesson('bl11-1', 'Fifth Position', 'learn', 'The same notes, fretted', [
        meet(B, 'A1 D2 G2 C3', { frets: [at(4, 5, 1), at(3, 5, 1), at(2, 5, 1), at(1, 5, 1)], tips: ['A on the E string, 5th fret — the same pitch as the open A string.', 'D on the A string, 5th fret — the same as the open D.', 'G on the D string, 5th fret — the same as the open G.', 'C on the G string, 5th fret.'] }),
        read(B, POS5, { key: 'Am', guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        read(B, POS5, { key: 'Am', guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Fifth position', 'With the index finger at the 5th fret, fingers 1, 2 and 4 cover frets 5, 6 and 7. Every 5th-fret note matches the next open string — that’s how bassists tune — and fretted notes sound rounder and are easier to mute than open strings.', { kind: 'frets', positions: [{ string: 4, fret: 5, finger: 1, label: 'A' }, { string: 4, fret: 7, finger: 4, label: 'B' }, { string: 3, fret: 5, finger: 1, label: 'D' }, { string: 3, fret: 7, finger: 4, label: 'E' }, { string: 2, fret: 5, finger: 1, label: 'G' }, { string: 2, fret: 7, finger: 4, label: 'A' }, { string: 1, fret: 5, finger: 1, label: 'C' }, { string: 1, fret: 7, finger: 4, label: 'D' }], minFret: 3, maxFret: 9 }),
      ]),
      lesson('bl11-2', 'Seventh Position', 'learn', 'One finger per fret', [
        read(B, POS7, { guitarPosition: 7, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        scale('C', 'major', 'R', { octave: 2, guitarPosition: 7 }),
        read(B, POS7, { guitarPosition: 7, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ], [
        insight('Opening the hand', 'Higher up the frets get narrower, so the hand opens to one finger per fret: index on the 7th fret, fingers 1–4 on frets 7–10. A whole C major scale — B up to F — sits under the hand without a single open string.', { kind: 'frets', positions: [{ string: 4, fret: 7, finger: 1, label: 'B' }, { string: 4, fret: 8, finger: 2, label: 'C', root: true }, { string: 4, fret: 10, finger: 4, label: 'D' }, { string: 3, fret: 7, finger: 1, label: 'E' }, { string: 3, fret: 8, finger: 2, label: 'F' }, { string: 3, fret: 10, finger: 4, label: 'G' }, { string: 2, fret: 7, finger: 1, label: 'A' }, { string: 2, fret: 9, finger: 3, label: 'B' }, { string: 2, fret: 10, finger: 4, label: 'C', root: true }, { string: 1, fret: 7, finger: 1, label: 'D' }, { string: 1, fret: 9, finger: 3, label: 'E' }, { string: 1, fret: 10, finger: 4, label: 'F' }], minFret: 5, maxFret: 12 }),
      ]),
      lesson('bl11-3', 'Shifting', 'learn', 'Move the whole hand', [
        tip('Shifting', 'To change position, move the whole hand — thumb included — and keep the finger lightly on the string as it slides. Look ahead, and shift during an open string or a rest whenever you can.'),
        bpiece('Climbing the Neck', 'Am', [4, 4], [SHIFT_LINE], { prompt: 'One root–5th–octave shape, moved to a new root every bar. Follow the string numbers.' }),
        scale('F', 'major', 'R', { octaves: 2, octave: 1, guitarPosition: 5, title: 'F major, two octaves — shift as you climb' }),
      ]),
      lesson('bl11-4', 'The 12-Bar Blues', 'song', 'Blues in E, A and D minor', [
        piece('bass-boogie-blues-in-e'),
        piece('bass-walking-blues-in-a'),
        piece('bass-minor-drag'),
      ], [
        insight('The 12-bar blues', 'Twelve bars, three chords: four bars of I, two of IV, two of I, then V, IV, I and a last bar of V that turns the form around. In E: E7 E7 E7 E7 | A7 A7 E7 E7 | B7 A7 E7 B7. Learn the form and you can play with almost anyone.'),
      ]),
      lesson('bl11-c', 'Checkpoint: Positions & Blues', 'checkpoint', 'Read up the neck and walk the blues', [
        read(B, POS5, { key: 'Am', guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, harmonic: true, fingering: 'first' }),
        read(B, POS7, { guitarPosition: 7, rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        piece('bass-walking-blues-in-a', { mode: 'tempo', tempo: 100, fingering: 'first' }),
      ]),
    ], ['5th & 7th position', 'Shifting', '12-bar blues']),

    // ------------------------------------------------------------------ 12
    unit('bl12', 'Sixteenths, Funk & Final Exam', 'Four notes per beat, funk on the sixteenth grid, Bach on the bass — and the final test.', [
      lesson('bl12-1', 'Sixteenth Notes', 'learn', 'Four notes per beat', [
        tip('Sixteenths', 'Four notes per beat: “1 e & a”. Keep the plucking fingers strictly alternating and stay loose — speed comes from evenness, not effort.', { kind: 'staff', clef: B, notes: ['E1/s', 'E1/s', 'E2/s', 'E1/s', 'G1/e', 'A1/e', 'E1/h'], time: [4, 4] }),
        rhythm([4, 4], RH.sixteenths, { tempo: 60 }),
        read(B, POS1, { rhythms: RH.sixteenths, maxLeap: 2, mode: 'tempo', tempo: 56 }),
      ]),
      lesson('bl12-2', 'Funk Feel', 'learn', 'Short notes, muted rests, octave pops', [
        rhythm([4, 4], { 's s s s': 1, 'e s s': 1.2, 's s e': 1.2, 'e. s': 1, 'rs s e': 0.6, q: 1 }, { tempo: 60 }),
        piece('bass-sixteenth-street-funk'),
        read(B, EM, { key: 'Em', guitarPosition: 2, rhythms: RH.sixteenths, maxLeap: 7, leapiness: 0.5, harmonic: true, fingering: 'first' }),
      ], [
        insight('Funk', 'Funk lives on the sixteenth-note grid: a heavy “one”, short notes, rests that are really muted strings, and octave jumps that pop. Play fewer notes, but play them exactly in time.'),
      ]),
      lesson('bl12-3', 'Bach on the Bass', 'song', 'Cello-suite music an octave down', [
        tip('Cello music on the bass', 'Bach’s cello suites are a classic bass study: steady sixteenths, string crossings and a low pedal note. Here the bass plays the music an octave below the cello. Go slowly — evenness first.'),
        piece('bass-bach-cello-prelude'),
        piece('bass-cello-etude'),
      ]),
      lesson('bl12-4', 'Sight-Reading Sprint', 'challenge', 'Read the full range at tempo', [
        name(B, FULL, 30, { sequence: true, title: 'Lightning round' }),
        read(B, ALL1, { rhythms: RH.sixteenths, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 60, fingering: 'none' }),
        read(B, POS7, { guitarPosition: 7, rhythms: RH.syncopation, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
      lesson('bl12-c', 'Final Exam: Bass Clef', 'checkpoint', 'Prove your bass-reading mastery', [
        name(B, FULL, 30, { sequence: true }),
        keysig(B, 'C G D F Bb Am Em Dm', 10),
        read(B, GMAJ, { key: 'Em', guitarPosition: 2, rhythms: RH.advanced, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 66, fingering: 'none', measures: 6 }),
        read(B, POS7, { guitarPosition: 7, rhythms: RH.dotted, maxLeap: 5, harmonic: true, fingering: 'none' }),
      ]),
    ], ['Sixteenths', 'Funk', 'Bach', 'Full range']),
  ],
};
