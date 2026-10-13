import { P, RH, insight, inlinePiece, lesson, meet, n, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ReadOpts } from '../builders';
import type { TimeSig } from '../../music/rhythm';
import type { AccompPattern, ActivityDef, RhythmCell, TrackDef } from '../types';

const T = 'treble' as const;
const B = 'bass' as const;

type PieceOpts = Parameters<typeof inlinePiece>[4];

interface GrandOpts extends ReadOpts {
  /** Left hand stays in a fixed five-finger position (pool = exactly 5 notes). */
  lhFive?: boolean;
  /** Rhythm cells for the left hand (patterns 'alternate' and 'counter'). */
  lhRhythms?: Record<RhythmCell, number>;
}

/** Grand-staff sight-reading: right-hand melody from `rh`, left-hand part from `lh` in the given pattern. */
function both(pattern: AccompPattern, rh: string, lh: string, o: GrandOpts = {}): ActivityDef {
  const { lhFive, lhRhythms, ...rest } = o;
  return read(T, rh, { ...rest, accomp: { pattern, pool: n(lh), fivePosition: lhFive, rhythms: lhRhythms } });
}

/** Both hands in fixed five-finger positions. */
const five = (pattern: AccompPattern, rh: string, lh: string, o: GrandOpts = {}): ActivityDef =>
  both(pattern, rh, lh, { five: true, lhFive: true, ...o });

/** A fixed hands-together étude. */
const duet = (title: string, key: string, time: TimeSig, rh: string, lh: string, o?: PieceOpts): ActivityDef =>
  inlinePiece(title, key, time, [{ clef: T, hand: 'R', voices: [rh] }, { clef: B, hand: 'L', voices: [lh] }], o);

/** A fixed left-hand-alone drill (to learn a pattern before adding the melody). */
const lhAlone = (title: string, key: string, time: TimeSig, voice: string, o?: PieceOpts): ActivityDef =>
  inlinePiece(title, key, time, [{ clef: B, hand: 'L', voices: [voice] }], o);

// Rhythms
const SLOW: Record<RhythmCell, number> = { h: 2, w: 1 };

// Left-hand pools
const LH_F = 'F3 G3 A3 Bb3 C4';
/** Blocked chords in C: C–E–G, C–F–A, B–D–G (one hand position). */
const CHORDS_C = 'B2 C3 D3 E3 F3 G3 A3';
/** Blocked chords in G: G–B–D, G–C–E, F♯–A–D. */
const CHORDS_G = 'F#2 G2 A2 B2 C3 D3 E3';
/** Blocked chords in A minor: E–A–C, E–G♯–B, F–A–D. */
const CHORDS_AM = 'E2 F2 G#2 A2 B2 C3 D3 E3';
/** Root-position broken / Alberti chords in C: C–G–E–G, G–D–B–D, F–C–A–C. */
const BROKEN_C = 'G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4';
/** Root-position broken / Alberti chords in G: G–D–B–D, D–A–F♯–A, C–G–E–G. */
const BROKEN_G = 'C3 D3 E3 F#3 G3 A3 B3 C4 D4';
/** Root-position broken / Alberti chords in F: F–C–A–C, C–G–E–G, B♭–F–D–F. */
const BROKEN_F = 'Bb2 C3 D3 E3 F3 G3 A3 Bb3 C4';

// Keyboard pictures
const C_POS_BOTH = { kind: 'keys' as const, notes: ['C3', 'D3', 'E3', 'F3', 'G3', 'C4', 'D4', 'E4', 'F4', 'G4'], fingers: [5, 4, 3, 2, 1, 1, 2, 3, 4, 5] };

export const pianoGrand: TrackDef = {
  id: 'piano-grand',
  instrument: 'piano',
  title: 'Both Hands',
  subtitle: 'Piano · Grand staff',
  description: 'Play with both hands from the grand staff — a gentle path from taking turns to full hand independence, with chords, accompaniment patterns, scales and real repertoire.',
  clef: 'grand',
  accent: '#9b8cff',
  glyph: '𝄞𝄢',
  heatmap: [
    { clef: 'treble', low: 'C4', high: 'C6' },
    { clef: 'bass', low: 'C2', high: 'C4' },
  ],
  recommends: ['piano-treble', 'piano-bass'],
  units: [
    // -----------------------------------------------------------------------
    unit('pg1', 'The Grand Staff', 'Two staves, two hands, one Middle C.', [
      lesson('pg1-1', 'Two Staves, One Piano', 'learn', 'See how the treble and bass staves meet at Middle C', [
        meet(T, 'C4', { hand: 'R', fingers: [1], tips: ['On the treble staff, Middle C hangs on a short ledger line BELOW the staff. Right thumb.'] }),
        meet(B, 'C4', { hand: 'L', fingers: [1], tips: ['On the bass staff, the very same Middle C floats on a ledger line ABOVE the staff. Left thumb.'] }),
        name(T, 'C4 D4 E4', 8),
        name(B, 'A3 B3 C4', 8),
      ], [
        insight('The grand staff', 'Piano music is written on two staves joined by a brace: treble on top for the right hand, bass below for the left. Together they make the grand staff.', { kind: 'staff', clef: 'treble', notes: ['C4', 'G4'], labels: true }),
        insight('One Middle C', 'Middle C sits between the staves. Written below the treble staff it’s for the right hand; written above the bass staff it’s for the left. Same key either way.', { kind: 'staff', clef: 'bass', notes: ['C4', 'F3'], labels: true }),
      ]),
      lesson('pg1-2', 'Middle C Position', 'learn', 'Five fingers of each hand around Middle C', [
        meet(T, 'D4 E4 F4 G4', { hand: 'R', fingers: [2, 3, 4, 5], tips: ['D hangs just below the treble staff — finger 2.', 'E sits on the bottom line — finger 3.', 'F, first space — finger 4.', 'G, second line (the treble clef’s line) — finger 5.'] }),
        meet(B, 'B3 A3 G3 F3', { hand: 'L', fingers: [2, 3, 4, 5], tips: ['B sits just above the bass staff — finger 2.', 'A, top line — finger 3.', 'G, top space — finger 4.', 'F, the bass clef’s line between the dots — finger 5.'] }),
        name(T, P.rhC, 10),
        name(B, P.lhMid, 10),
      ], [insight('Middle C position', 'Right hand: C D E F G with fingers 1–5. Left hand: C B A G F with fingers 1–5 going down. Both thumbs share Middle C and the finger numbers grow outward from it.', { kind: 'keys', notes: ['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'], fingers: [5, 4, 3, 2, 1, 2, 3, 4, 5] })]),
      lesson('pg1-3', 'Which Staff, Which Hand?', 'practice', 'Play from either staff with the right hand for the job', [
        tip('Top staff, right hand', 'Before each note, glance at its staff: top staff → right hand, bottom staff → left hand. For Middle C, use the thumb of that staff’s hand.'),
        play(T, P.rhC, 8, { hand: 'R', hints: true }),
        play(B, P.lhMid, 8, { hand: 'L', hints: true }),
        five('alternate', P.rhC, P.lhMid, { rhythms: SLOW, maxLeap: 1, noteNames: true, title: 'Back and forth', prompt: 'One hand at a time — watch which staff each bar is on.' }),
      ]),
      lesson('pg1-c', 'Checkpoint: The Grand Staff', 'checkpoint', 'Read both staves in Middle C position', [
        name(T, P.rhC, 10),
        name(B, P.lhMid, 10),
        five('alternate', P.rhC, P.lhMid, { rhythms: SLOW, maxLeap: 2, fingering: 'first' }),
        five('alternate', P.rhC, P.lhMid, { rhythms: RH.qh, maxLeap: 1, fingering: 'first' }),
      ]),
    ], ['Grand staff', 'Middle C position', 'Which hand?']),

    // -----------------------------------------------------------------------
    unit('pg2', 'Hands Take Turns', 'Call and response: one hand plays while the other gets ready.', [
      lesson('pg2-1', 'Call and Response', 'learn', 'Answer the right hand with the left', [
        five('alternate', P.rhC, P.lhMid, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
        five('alternate', P.rhC, P.lhMid, { rhythms: RH.qh, maxLeap: 2 }),
        five('alternate', P.rhC, P.lhMid, { rhythms: RH.qhw, maxLeap: 2, fingering: 'first' }),
      ], [insight('Take turns', 'Here the hands take turns, one bar each. While one hand plays, the other waits ON its keys, fingers touching — ready to answer without looking down.')]),
      lesson('pg2-2', 'Passing the Melody', 'learn', 'Share one tune between the hands', [
        tip('One tune, two hands', 'A melody can walk from one hand into the other. Keep it smooth as it changes hands, as if one singer were singing it.', { kind: 'staff', clef: 'treble', notes: ['G4', 'F4', 'E4', 'D4', 'C4'] }),
        duet('Down the Stairs', 'C', [4, 4],
          'G4/q@5 F4@4 E4@3 D4@2 | C4/h@1 r/h | r/w | r/h C4/q@1 D4@2 | E4@3 F4@4 G4/h@5 | E4/q@3 D4@2 C4/h@1 |',
          'r/w | r/h B3/q@2 A3@3 | G3@4 F3@5 G3@4 A3@3 | B3/h@2 r/h | r/w | r/w |'),
        duet('Echo', 'C', [4, 4],
          'E4/q@3 D4@2 C4@1 D4@2 | E4@3 E4@3 E4/h@3 | r/w | r/w | D4/q@2 D4@2 D4/h@2 | E4/q@3 G4@5 G4/h@5 | r/w | r/w |',
          'r/w | r/w | A3/q@3 G3@4 F3@5 G3@4 | A3@3 A3@3 A3/h@3 | r/w | r/w | G3/q@4 G3@4 G3/h@4 | A3/q@3 C4@1 C4/h@1 |'),
      ]),
      lesson('pg2-3', 'Both Hands in C Position', 'learn', 'Move the left hand down an octave', [
        meet(B, 'C3 D3 E3', { hand: 'L', fingers: [5, 4, 3], tips: ['Bass C sits in the second space — one octave below Middle C. Finger 5.', 'D is the middle line — finger 4.', 'E, third space — finger 3. F and G above it take fingers 2 and 1.'] }),
        name(B, P.lhC, 10),
        five('alternate', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2 }),
      ], [insight('C position, both hands', 'Move the left hand down so finger 5 sits on the C below Middle C. Now each hand has its own C position an octave apart, and the thumbs no longer share a key.', C_POS_BOTH)]),
      lesson('pg2-4', 'Songs That Take Turns', 'song', 'First pieces for two hands', [
        piece('p2-hot-cross-buns'),
        piece('p2-mary-had-a-little-lamb'),
      ]),
      lesson('pg2-c', 'Checkpoint: Hands Take Turns', 'checkpoint', 'Switch hands smoothly, in time', [
        five('alternate', P.rhC, P.lhMid, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
        five('alternate', P.rhC, P.lhC, { rhythms: RH.rests, maxLeap: 2, fingering: 'none' }),
        five('alternate', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['Call & response', 'Shared melodies', 'C position ×2']),

    // -----------------------------------------------------------------------
    unit('pg3', 'Hands Together: Long Notes', 'Your first hands-together playing: one hand holds while the other moves.', [
      lesson('pg3-1', 'Long Notes Below', 'learn', 'Hold a left-hand whole note under a melody', [
        duet('First Together', 'C', [4, 4],
          'C4/q@1 D4@2 E4@3 C4@1 | E4@3 F4@4 G4/h@5 | G4/q@5 F4@4 E4@3 D4@2 | C4/w@1 |',
          'C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 |', { prompt: 'Play beat 1 of every bar with BOTH hands at once, then let the left hand hold.' }),
        duet('C and G Below', 'C', [4, 4],
          'E4/q@3 F4@4 G4/h@5 | E4/q@3 F4@4 G4/h@5 | G4/q@5 F4@4 E4@3 D4@2 | C4/w@1 |',
          'C3/w@5 | C3/w@5 | G3/w@1 | C3/w@5 |'),
        five('drone', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 1 }),
      ], [insight('Together means together', 'Start simple: the left hand plays one long note on beat 1 and holds it while the right hand carries on. Press both notes of beat 1 at exactly the same moment.', { kind: 'keys', notes: ['C3', 'C4', 'D4', 'E4', 'F4', 'G4'], fingers: [5, 1, 2, 3, 4, 5] })]),
      lesson('pg3-2', 'Drone Melodies', 'practice', 'Melodies over long left-hand notes', [
        five('drone', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2 }),
        five('drone', P.rhC, P.lhC, { rhythms: RH.qhw, maxLeap: 2, fingering: 'first' }),
        five('drone', P.rhC, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pg3-3', 'Now the Left Hand Moves', 'learn', 'Hold in the right hand while the left hand walks', [
        tip('Switch roles', 'Now the right hand holds while the left hand moves. Let your eyes favour the bottom staff — the top line only changes once a bar.'),
        duet('Left Hand Walks', 'C', [4, 4],
          'G4/w@5 | E4/w@3 | D4/w@2 | C4/w@1 |',
          'C3/q@5 D3@4 E3@3 C3@5 | E3@3 F3@2 G3/h@1 | G3/q@1 F3@2 E3@3 D3@4 | C3/w@5 |'),
        duet('Half-Note Partners', 'C', [4, 4],
          'E4/h@3 G4@5 | F4@4 D4@2 | E4@3 D4@2 | C4/w@1 |',
          'C3/q@5 E3@3 G3@1 E3@3 | D3@4 F3@2 G3@1 F3@2 | C3@5 E3@3 G3@1 G3@1 | C3/w@5 |'),
      ]),
      lesson('pg3-4', 'First Songs Together', 'song', 'Melodies with a simple left hand', [
        piece('p2-ode-to-joy'),
        piece('p2-twinkle-twinkle'),
      ]),
      lesson('pg3-c', 'Checkpoint: Long Notes', 'checkpoint', 'Hold in one hand, move in the other', [
        five('drone', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
        duet('Steps Below', 'C', [4, 4],
          'E4/w@3 | F4/w@4 | E4/h@3 D4@2 | C4/w@1 |',
          'C3/q@5 D3@4 E3@3 F3@2 | G3@1 F3@2 E3@3 D3@4 | C3@5 E3@3 G3/h@1 | C3/w@5 |', { fingering: 'first' }),
        five('drone', P.rhC, P.lhC, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
    ], ['Hands together', 'Drone bass', 'Hold & move']),

    // -----------------------------------------------------------------------
    unit('pg4', 'Moving Together', 'Both hands on the move: parallel and contrary motion.', [
      lesson('pg4-1', 'Parallel Motion', 'learn', 'Both hands play the same notes an octave apart', [
        duet('Parallel Five', 'C', [4, 4],
          'C4/q@1 D4@2 E4@3 F4@4 | G4/h@5 G4@5 | G4/q@5 F4@4 E4@3 D4@2 | C4/w@1 |',
          'C3/q@5 D3@4 E3@3 F3@2 | G3/h@1 G3@1 | G3/q@1 F3@2 E3@3 D3@4 | C3/w@5 |'),
        five('parallel', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 1 }),
        five('parallel', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2 }),
      ], [insight('Same notes, an octave apart', 'In parallel motion both hands play the same note names in the same direction. The fingers are mirror images: right 1 with left 5, right 2 with left 4, and so on.', C_POS_BOTH)]),
      lesson('pg4-2', 'Contrary Motion', 'learn', 'The hands move in opposite directions', [
        duet('Opening Out', 'C', [4, 4],
          'C4/q@1 D4@2 E4@3 F4@4 | G4/w@5 | G4/q@5 F4@4 E4@3 D4@2 | C4/w@1 |',
          'G3/q@1 F3@2 E3@3 D3@4 | C3/w@5 | C3/q@5 D3@4 E3@3 F3@2 | G3/h@1 C3@5 |'),
        five('contrary', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 1 }),
        five('contrary', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2 }),
      ], [insight('Mirror moves', 'In contrary motion the hands move apart and back together like a reflection. The fingers match exactly: both thumbs together, then both 2s, both 3s.', { kind: 'keys', notes: ['F3', 'G3', 'C4', 'D4'], fingers: [2, 1, 1, 2] })]),
      lesson('pg4-3', 'Mixed Motion', 'practice', 'Parallel and contrary with longer melodies', [
        five('parallel', P.rhC, P.lhC, { rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
        five('contrary', P.rhC, P.lhC, { rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
        five('parallel', P.rhC, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2, fingering: 'first' }),
        five('contrary', P.rhC, P.lhC, { rhythms: RH.rests, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pg4-4', 'Songs in Motion', 'song', 'Hands moving together', [
        piece('p2-lightly-row'),
        piece('p2-london-bridge'),
      ]),
      lesson('pg4-c', 'Checkpoint: Moving Together', 'checkpoint', 'Parallel and contrary motion in time', [
        five('parallel', P.rhC, P.lhC, { rhythms: RH.rests, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'first' }),
        five('contrary', P.rhC, P.lhC, { rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
    ], ['Parallel motion', 'Contrary motion', 'Mirror fingering']),

    // -----------------------------------------------------------------------
    unit('pg5', 'Simple Accompaniment', 'The left hand follows the harmony with roots in half notes.', [
      lesson('pg5-1', 'Roots in Half Notes', 'learn', 'Play the root of each chord under the melody', [
        duet('Moonlight Roots', 'C', [4, 4],
          'C4/q@1 C4@1 C4@1 D4@2 | E4/h@3 D4@2 | C4/q@1 E4@3 D4@2 D4@2 | C4/w@1 | C4/q@1 C4@1 C4@1 D4@2 | E4/h@3 D4@2 | C4/q@1 E4@3 D4@2 D4@2 | C4/w@1 |',
          'C3/h@5 G3@1 | C3@5 G3@1 | C3@5 G3@1 | C3/w@5 | C3/h@5 G3@1 | C3@5 G3@1 | C3@5 G3@1 | C3/w@5 |'),
        five('roots', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2 }),
      ], [insight('The root', 'Every chord is named after its root. Under a C-position melody, the left hand plays C (finger 5) for the C chord, G (thumb) for the G chord and F (finger 2) for the F chord.', { kind: 'staff', clef: 'bass', notes: ['C3/h', 'G3/h', 'F3/h', 'C3/h'], time: [4, 4] })]),
      lesson('pg5-2', 'Following the Harmony', 'practice', 'Longer melodies over moving roots', [
        five('roots', P.rhC, P.lhC, { rhythms: RH.qhw, maxLeap: 2, measures: 6 }),
        five('roots', P.rhC, P.lhC, { rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
        five('roots', P.rhC, P.lhC, { rhythms: RH.qh, maxLeap: 2, mode: 'tempo', tempo: 63, fingering: 'first' }),
      ]),
      lesson('pg5-3', 'Roots in Three', 'learn', 'One long root per bar in 3/4', [
        tip('Roots in 3/4', 'In 3/4 the left hand often plays a single dotted half note per bar — the root, held through all three beats.', { kind: 'staff', clef: 'bass', notes: ['C3/h.', 'G3/h.', 'F3/h.', 'C3/h.'], time: [3, 4] }),
        five('roots', P.rhC, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
        five('roots', P.rhC, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('pg5-4', 'Songs with a Bass Line', 'song', 'Folk songs with left-hand roots', [
        piece('p2-when-the-saints'),
        piece('p2-oh-susanna'),
      ]),
      lesson('pg5-c', 'Checkpoint: Accompaniment', 'checkpoint', 'Melody and bass in time', [
        five('roots', P.rhC, P.lhC, { rhythms: RH.rests, maxLeap: 3, mode: 'tempo', tempo: 69, fingering: 'first' }),
        five('roots', P.rhC, P.lhC, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, mode: 'tempo', tempo: 80, fingering: 'none' }),
      ]),
    ], ['Chord roots', 'Half-note bass', '3/4 bass']),

    // -----------------------------------------------------------------------
    unit('pg6', 'Blocked Chords', 'Three-note chords in the left hand: I, IV and V7.', [
      lesson('pg6-1', 'C and G7', 'learn', 'Two chords, one hand position', [
        lhAlone('C and G7', 'C', [4, 4], '[C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/w@5,2,1 | [B2 F3 G3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 |', { prompt: 'Left hand alone first: feel how little the hand moves.' }),
        duet('Joyful Chords', 'C', [4, 4],
          'E4/q@3 E4@3 F4@4 G4@5 | G4@5 F4@4 E4@3 D4@2 | C4@1 C4@1 D4@2 E4@3 | E4/h@3 D4@2 | E4/q@3 E4@3 F4@4 G4@5 | G4@5 F4@4 E4@3 D4@2 | C4@1 C4@1 D4@2 E4@3 | D4/h@2 C4@1 |',
          '[C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 | [C3 E3 G3]/h@5,3,1 [B2 F3 G3]@5,2,1 | [C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/h@5,2,1 [C3 E3 G3]@5,3,1 |'),
      ], [insight('Two chords, one hand shape', 'C chord: C–E–G with fingers 5-3-1. For G7, the pinky slips down to B, finger 2 takes F and the thumb stays on G. Small moves, big sound.', { kind: 'staff+keys', clef: 'bass', notes: ['[C3 E3 G3]/w'], fingers: [5, 3, 1], hand: 'L' })]),
      lesson('pg6-2', 'Adding F', 'learn', 'I – IV – V7 in one hand position', [
        tip('The F chord', 'For F, keep the pinky on C, move finger 2 up to F and the thumb up to A: C–F–A, 5-2-1. Three chords now live under one hand.', { kind: 'staff+keys', clef: 'bass', notes: ['[C3 F3 A3]/w'], fingers: [5, 2, 1], hand: 'L' }),
        lhAlone('I – IV – I – V7 – I', 'C', [4, 4], '[C3 E3 G3]/w@5,3,1 | [C3 F3 A3]/w@5,2,1 | [C3 E3 G3]/h@5,3,1 [B2 F3 G3]@5,2,1 | [C3 E3 G3]/w@5,3,1 |'),
        duet('Three-Chord Song', 'C', [4, 4],
          'E4/q@3 F4@4 G4/h@5 | F4/q@4 E4@3 F4/h@4 | E4/q@3 D4@2 C4/h@1 | D4/w@2 | E4/q@3 F4@4 G4/h@5 | F4/q@4 E4@3 D4/h@2 | D4/q@2 E4@3 F4@4 D4@2 | C4/w@1 |',
          '[C3 E3 G3]/w@5,3,1 | [C3 F3 A3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 | [B2 F3 G3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 | [C3 F3 A3]/w@5,2,1 | [B2 F3 G3]/w@5,2,1 | [C3 E3 G3]/w@5,3,1 |'),
      ]),
      lesson('pg6-3', 'Melody over Chords', 'practice', 'Sight-read melodies over blocked chords', [
        tip('Read the shape', 'The G chord also appears as B–D–G — no F, same fingers 5-3-1. Read the lowest note first, then recognise the shape above it.', { kind: 'staff', clef: 'bass', notes: ['[B2 D3 G3]/h', '[B2 F3 G3]/h'] }),
        both('blocked', P.rhC, CHORDS_C, { five: true, rhythms: RH.qh, maxLeap: 2 }),
        both('blocked', P.rhC, CHORDS_C, { five: true, rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
        both('blocked', P.rhC, CHORDS_C, { five: true, time: [3, 4], rhythms: RH.waltz, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pg6-4', 'Songs with Chords', 'song', 'Melodies over left-hand chords', [
        piece('p2-jingle-bells'),
        piece('p2-yankee-doodle'),
      ]),
      lesson('pg6-c', 'Checkpoint: Blocked Chords', 'checkpoint', 'Change chords on time', [
        duet('Evening Song', 'C', [3, 4],
          'E4/h@3 F4/q@4 | G4/h.@5 | F4/h@4 D4/q@2 | D4/h.@2 | E4/h@3 G4/q@5 | F4/h.@4 | D4/q@2 E4@3 F4@4 | C4/h.@1 |',
          '[C3 E3 G3]/h.@5,3,1 | [C3 E3 G3]/h.@5,3,1 | [B2 F3 G3]/h.@5,2,1 | [B2 F3 G3]/h.@5,2,1 | [C3 E3 G3]/h.@5,3,1 | [C3 F3 A3]/h.@5,2,1 | [B2 F3 G3]/h.@5,2,1 | [C3 E3 G3]/h.@5,3,1 |', { fingering: 'first' }),
        both('blocked', P.rhC, CHORDS_C, { five: true, rhythms: RH.rests, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'first' }),
        both('blocked', P.rhC, CHORDS_C, { five: true, rhythms: RH.qhw, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Blocked chords', 'I–IV–V7', 'Hand stays put']),

    // -----------------------------------------------------------------------
    unit('pg7', 'Keys of G and F', 'Same skills, new hand positions: G major and F major with both hands.', [
      lesson('pg7-1', 'G Position, Both Hands', 'learn', 'Both hands on G A B C D', [
        name(T, P.rhG, 8),
        name(B, P.lhG, 8),
        five('parallel', P.rhG, P.lhG, { key: 'G', rhythms: RH.qh, maxLeap: 2 }),
        five('drone', P.rhG, P.lhG, { key: 'G', rhythms: RH.qhw, maxLeap: 2 }),
      ], [insight('G position', 'Right thumb on the G above Middle C, left pinky on the G at the bottom of the bass staff. Both hands cover G A B C D, two octaves apart.', { kind: 'keys', notes: ['G2', 'A2', 'B2', 'C3', 'D3', 'G4', 'A4', 'B4', 'C5', 'D5'], fingers: [5, 4, 3, 2, 1, 1, 2, 3, 4, 5] })]),
      lesson('pg7-2', 'Chords in G', 'learn', 'G, C and D7 in one hand position', [
        tip('Three chords in G', 'G chord: G–B–D (5-3-1). C chord: G–C–E (5-2-1). D7: F♯–C–D (5-2-1), or plain D: F♯–A–D (5-3-1). The same moves as in C — the F♯ comes from the key signature.', { kind: 'staff', clef: 'bass', notes: ['[G2 B2 D3]/h', '[G2 C3 E3]/h', '[F#2 C3 D3]/h', '[G2 B2 D3]/h'], key: 'G' }),
        lhAlone('Chords in G', 'G', [4, 4], '[G2 B2 D3]/w@5,3,1 | [G2 C3 E3]/w@5,2,1 | [G2 B2 D3]/h@5,3,1 [F#2 C3 D3]@5,2,1 | [G2 B2 D3]/w@5,3,1 |'),
        duet('Folk Song in G', 'G', [4, 4],
          'G4/q@1 B4@3 D5@5 B4@3 | C5/q@4 D5@5 C5/h@4 | B4/q@3 A4@2 G4/h@1 | A4/w@2 | G4/q@1 B4@3 D5@5 B4@3 | C5/q@4 B4@3 A4/h@2 | A4/q@2 B4@3 C5@4 A4@2 | G4/w@1 |',
          '[G2 B2 D3]/w@5,3,1 | [G2 C3 E3]/w@5,2,1 | [G2 B2 D3]/w@5,3,1 | [F#2 C3 D3]/w@5,2,1 | [G2 B2 D3]/w@5,3,1 | [G2 C3 E3]/w@5,2,1 | [F#2 C3 D3]/w@5,2,1 | [G2 B2 D3]/w@5,3,1 |'),
        both('blocked', P.rhG, CHORDS_G, { key: 'G', five: true, rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('pg7-3', 'F Position, Both Hands', 'learn', 'Both hands on F G A B♭ C', [
        five('parallel', P.rhF, LH_F, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
        five('roots', P.rhF, LH_F, { key: 'F', rhythms: RH.qhw, maxLeap: 2 }),
        duet('Lightly Row in F', 'F', [4, 4],
          'C5/q@5 A4@3 A4/h@3 | Bb4/q@4 G4@2 G4/h@2 | F4/q@1 G4@2 A4@3 Bb4@4 | C5@5 C5@5 C5/h@5 | C5/q@5 A4@3 A4/h@3 | Bb4/q@4 G4@2 G4/h@2 | F4/q@1 A4@3 C5@5 C5@5 | F4/w@1 |',
          '[F3 A3 C4]/w@5,3,1 | [E3 Bb3 C4]/w@5,2,1 | [F3 A3 C4]/w@5,3,1 | [E3 Bb3 C4]/w@5,2,1 | [F3 A3 C4]/w@5,3,1 | [E3 Bb3 C4]/w@5,2,1 | [F3 A3 C4]/w@5,3,1 | [F3 A3 C4]/w@5,3,1 |', { prompt: 'Left hand: F chord F–A–C (5-3-1), C7 chord E–B♭–C (5-2-1).' }),
      ], [insight('F position', 'Right thumb on the F above Middle C, with B♭ under finger 4. Left pinky on the F below Middle C, with B♭ under finger 2. The key signature’s flat reminds you.', { kind: 'keys', notes: ['F3', 'G3', 'A3', 'Bb3', 'C4', 'F4', 'G4', 'A4', 'Bb4', 'C5'], fingers: [5, 4, 3, 2, 1, 1, 2, 3, 4, 5] })]),
      lesson('pg7-4', 'Songs in G and F', 'song', 'Both hands in new keys', [
        piece('p2-frere-jacques'),
        piece('p2-aura-lee'),
      ]),
      lesson('pg7-c', 'Checkpoint: Keys of G and F', 'checkpoint', 'Both hands with key signatures', [
        five('parallel', P.rhG, P.lhG, { key: 'G', rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
        both('blocked', P.rhG, CHORDS_G, { key: 'G', five: true, rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
        five('roots', P.rhF, LH_F, { key: 'F', rhythms: RH.qh, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
    ], ['G position', 'F position', 'Chords in G']),

    // -----------------------------------------------------------------------
    unit('pg8', 'Waltz Bass & Broken Chords', 'Oom-pah-pah in 3/4, and chords that flow note by note.', [
      lesson('pg8-1', 'Oom-pah-pah', 'learn', 'The waltz bass under a 3/4 melody', [
        lhAlone('Waltz Bass', 'C', [3, 4], 'C3/q@5 [E3 G3]@3,1 [E3 G3]@3,1 | C3@5 [E3 G3]@3,1 [E3 G3]@3,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | C3@5 [E3 G3]@3,1 [E3 G3]@3,1 |', { prompt: 'Left hand alone: lean on beat one, keep two and three light.' }),
        duet('Little Waltz', 'C', [3, 4],
          'C4/q@1 E4@3 G4@5 | G4/h.@5 | F4/q@4 E4@3 D4@2 | D4/h.@2 | D4/q@2 E4@3 F4@4 | E4/h.@3 | D4/q@2 F4@4 D4@2 | C4/h.@1 |',
          'C3/q@5 [E3 G3]@3,1 [E3 G3]@3,1 | C3@5 [E3 G3]@3,1 [E3 G3]@3,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | C3@5 [E3 G3]@3,1 [E3 G3]@3,1 | B2@5 [F3 G3]@2,1 [F3 G3]@2,1 | C3/h.@5 |'),
      ], [insight('Waltz bass', 'In 3/4 the left hand plays a low note on beat 1 and the rest of the chord on beats 2 and 3: low, high, high. Keep two and three light so the melody sings.', { kind: 'staff', clef: 'bass', notes: ['C3/q', '[E3 G3]/q', '[E3 G3]/q', 'B2/q', '[F3 G3]/q', '[F3 G3]/q'], time: [3, 4] })]),
      lesson('pg8-2', 'Waltz Reading', 'practice', 'Sight-read melodies over a waltz bass', [
        both('waltz', P.rhC, P.lhOctave, { five: true, time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
        both('waltz', P.rhC, P.lhOctave, { five: true, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
        both('waltz', P.rhG, 'G2 A2 B2 C3 D3 E3 F#3 G3', { key: 'G', five: true, time: [3, 4], rhythms: RH.waltz, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('pg8-3', 'Broken Chords', 'learn', 'Chords that flow one note at a time', [
        lhAlone('Broken Chords', 'C', [4, 4], 'C3/q@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 | B2@5 G3@1 F3@2 G3@1 | C3/h@5 [C3 E3 G3]@5,3,1 |'),
        duet('Flowing Chords', 'C', [4, 4],
          'E4/h@3 G4@5 | F4/w@4 | E4/h@3 C4@1 | D4/w@2 | E4/h@3 G4@5 | F4/h@4 C4@1 | D4/h@2 F4@4 | C4/w@1 |',
          'C3/q@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 | C3@5 G3@1 E3@3 G3@1 | B2@5 G3@1 F3@2 G3@1 | C3@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 | B2@5 G3@1 F3@2 G3@1 | C3/w@5 |'),
        both('broken', P.rhC, BROKEN_C, { five: true, rhythms: RH.qhw, maxLeap: 2, fingering: 'none', prompt: 'Left hand: root-position chords, fingers 5-1-3-1 every time.' }),
      ], [insight('Broken chords', 'Play the chord one note at a time — low, high, middle, high — with fingers 5-1-3-1. Keep the hand in its chord shape as it moves.', { kind: 'staff+keys', clef: 'bass', notes: ['C3/q', 'G3/q', 'E3/q', 'G3/q'], fingers: [5, 1, 3, 1], hand: 'L' })]),
      lesson('pg8-4', 'Waltzes and Ballads', 'song', 'Songs in 3/4 with a flowing left hand', [
        piece('p2-goin-home'),
        piece('p2-cradle-song'),
      ]),
      lesson('pg8-c', 'Checkpoint: Waltz & Broken Chords', 'checkpoint', 'Flowing accompaniments in time', [
        both('waltz', P.rhC, P.lhOctave, { five: true, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, mode: 'tempo', tempo: 88, fingering: 'first' }),
        both('broken', P.rhC, BROKEN_C, { five: true, rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
    ], ['Waltz bass', 'Broken chords', '3/4 accompaniment']),

    // -----------------------------------------------------------------------
    unit('pg9', 'Scales Hands Together', 'Contrary and parallel motion scales: C, G, D and F.', [
      lesson('pg9-1', 'Contrary Motion Scales', 'learn', 'Both thumbs on Middle C, hands moving apart', [
        scale('C', 'major', 'R'),
        scale('C', 'major', 'L'),
        scale('C', 'major', 'both', { motion: 'contrary' }),
        scale('C', 'major', 'both', { motion: 'contrary', mode: 'tempo', tempo: 66 }),
      ], [insight('Start with contrary motion', 'Both thumbs start on Middle C and the hands move apart. The fingering is a mirror image, so both thumbs cross at the same moment — the friendliest way to begin scales hands together.', { kind: 'keys', notes: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], fingers: [5, 4, 3, 2, 1, 3, 2, 1, 2, 3, 1, 2, 3, 4, 5] })]),
      lesson('pg9-2', 'Parallel Motion Scales', 'learn', 'Hands an octave apart, crossing at different times', [
        scale('C', 'major', 'both'),
        scale('C', 'major', 'both', { mode: 'tempo', tempo: 60 }),
        scale('G', 'major', 'both'),
      ], [insight('Parallel motion', 'Now the crossings come at different moments: going up, the right thumb tucks under after E while the left hand’s finger 3 crosses over after G. Go slowly and say the finger numbers aloud.')]),
      lesson('pg9-3', 'D and F Major', 'practice', 'Two more keys, both motions', [
        tip('F major is different', 'D major uses the same fingering as C. F major is the odd one out: the right hand plays 1-2-3-4 up to B♭ before the thumb tucks under on C. Practise the first five notes hands together until it clicks.'),
        scale('D', 'major', 'both', { motion: 'contrary' }),
        scale('D', 'major', 'both'),
        scale('F', 'major', 'both'),
      ]),
      lesson('pg9-4', 'Two Octaves', 'practice', 'Contrary motion over two octaves', [
        tip('Two octaves', 'Over two octaves the pattern repeats: at the first octave the thumb tucks under after finger 4 instead of playing 5. Keep the wrists level and the thumbs light.'),
        scale('C', 'major', 'both', { motion: 'contrary', octaves: 2 }),
        scale('D', 'major', 'both', { motion: 'contrary', octaves: 2 }),
        scale('C', 'major', 'both', { motion: 'contrary', octaves: 2, rhythm: 'e', mode: 'tempo', tempo: 60 }),
      ]),
      lesson('pg9-5', 'Scale Songs', 'song', 'Music built from scales', [
        duet('Bagpipe Scales', 'C', [4, 4],
          'C4/q@1 D4@2 E4@3 F4@1 | G4@2 A4@3 B4@4 C5@5 | C5@5 B4@4 A4@3 G4@2 | F4@1 E4@3 D4@2 C4@1 | [E4 G4]/w@3,5 | [E4 G4]/w@3,5 | [E4 G4]/w@3,5 | [E4 G4]/w@3,5 |',
          '[C3 G3]/w@5,1 | [C3 G3]/w@5,1 | [C3 G3]/w@5,1 | [C3 G3]/w@5,1 | C3/q@5 D3@4 E3@3 F3@2 | G3@1 A3@3 B3@2 C4@1 | C4@1 B3@2 A3@3 G3@1 | F3@2 E3@3 D3@4 C3@5 |', { prompt: 'First the right hand has the scale, then the left.' }),
        piece('p2-festive-march'),
      ]),
      lesson('pg9-c', 'Checkpoint: Scales', 'checkpoint', 'Scales hands together in time', [
        scale('C', 'major', 'both', { mode: 'tempo', tempo: 72, fingering: 'first' }),
        scale('G', 'major', 'both', { mode: 'tempo', tempo: 66, fingering: 'first' }),
        scale('D', 'major', 'both', { motion: 'contrary', octaves: 2, rhythm: 'e', mode: 'tempo', tempo: 60, fingering: 'none' }),
      ]),
    ], ['Contrary scales', 'Parallel scales', 'C G D F', 'Two octaves']),

    // -----------------------------------------------------------------------
    unit('pg10', 'Alberti Bass & Classical Style', 'The engine of Mozart and Haydn: Alberti bass under a singing melody.', [
      lesson('pg10-1', 'Alberti Bass', 'learn', 'Low–high–middle–high in eighth notes', [
        lhAlone('Alberti Bass', 'C', [4, 4], 'C3/e@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 C3@5 A3@1 F3@2 A3@1 | B2@5 G3@1 F3@2 G3@1 B2@5 G3@1 F3@2 G3@1 | C3@5 G3@1 E3@3 G3@1 C3/h@5 |', { prompt: 'Left hand alone, slowly and evenly.' }),
        duet('Sonatina Theme', 'C', [4, 4],
          'E4/h@3 G4@5 | F4/q@4 E4@3 D4/h@2 | E4/q@3 G4@5 F4@4 E4@3 | D4/w@2 | E4/h@3 G4@5 | F4/h@4 E4/q@3 F4@4 | D4/q@2 E4@3 F4@4 D4@2 | C4/w@1 |',
          'C3/e@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | B2@5 G3@1 F3@2 G3@1 B2@5 G3@1 F3@2 G3@1 | C3@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | B2@5 G3@1 F3@2 G3@1 B2@5 G3@1 F3@2 G3@1 | C3@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | C3@5 A3@1 F3@2 A3@1 C3@5 A3@1 F3@2 A3@1 | B2@5 G3@1 F3@2 G3@1 B2@5 G3@1 F3@2 G3@1 | C3@5 G3@1 E3@3 G3@1 C3/h@5 |'),
      ], [insight('Alberti bass', 'Low–high–middle–high in steady eighths: C G E G, fingers 5-1-3-1. Keep the hand still and quiet so the right-hand melody floats on top.', { kind: 'staff+keys', clef: 'bass', notes: ['C3/e', 'G3/e', 'E3/e', 'G3/e'], fingers: [5, 1, 3, 1], hand: 'L' })]),
      lesson('pg10-2', 'Alberti Reading', 'practice', 'Sight-read melodies over Alberti bass', [
        both('alberti', P.rhC, BROKEN_C, { five: true, rhythms: RH.qh, maxLeap: 2, fingering: 'none', prompt: 'Left hand: 5-1-3-1 on every chord.' }),
        both('alberti', P.rhC, BROKEN_C, { five: true, rhythms: RH.qhw, maxLeap: 3, fingering: 'none', mode: 'tempo', tempo: 60 }),
      ]),
      lesson('pg10-3', 'Classical Phrases', 'practice', 'Alberti bass in G and the cadence', [
        tip('Cadences', 'Classical phrases end with a cadence: the bass moves to the V chord, then home to I. Feel the “full stop” and land on it together.'),
        duet('Alberti in G', 'G', [4, 4],
          'B4/h@3 D5@5 | C5/q@4 B4@3 A4/h@2 | B4/q@3 C5@4 D5@5 B4@3 | A4/w@2 | B4/h@3 D5@5 | C5/q@4 B4@3 C5/h@4 | A4/q@2 B4@3 C5@4 A4@2 | G4/w@1 |',
          'G2/e@5 D3@1 B2@3 D3@1 G2@5 D3@1 B2@3 D3@1 | F#2@5 D3@1 C3@2 D3@1 F#2@5 D3@1 C3@2 D3@1 | G2@5 D3@1 B2@3 D3@1 G2@5 D3@1 B2@3 D3@1 | F#2@5 D3@1 C3@2 D3@1 F#2@5 D3@1 C3@2 D3@1 | G2@5 D3@1 B2@3 D3@1 G2@5 D3@1 B2@3 D3@1 | G2@5 E3@1 C3@2 E3@1 G2@5 E3@1 C3@2 E3@1 | F#2@5 D3@1 C3@2 D3@1 F#2@5 D3@1 C3@2 D3@1 | G2@5 D3@1 B2@3 D3@1 G2/h@5 |'),
        both('alberti', P.rhG, BROKEN_G, { key: 'G', five: true, rhythms: RH.qh, maxLeap: 2, fingering: 'none' }),
      ]),
      lesson('pg10-4', 'Minuet in G', 'song', 'Learn a classic hands separately, then together', [
        tip('Hands separately first', 'Learn each hand alone while the app plays the other, then put them together slowly. Professionals learn new pieces exactly this way.'),
        piece('p2-minuet-in-g', { hands: 'R', title: 'Minuet in G — right hand' }),
        piece('p2-minuet-in-g', { hands: 'L', title: 'Minuet in G — left hand' }),
        piece('p2-minuet-in-g', { hands: 'both', title: 'Minuet in G — hands together' }),
      ]),
      lesson('pg10-c', 'Checkpoint: Classical Style', 'checkpoint', 'Alberti bass in time', [
        both('alberti', P.rhC, BROKEN_C, { five: true, rhythms: RH.rests, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none' }),
        both('alberti', P.rhG, BROKEN_G, { key: 'G', five: true, rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 60, fingering: 'none' }),
        piece('p2-minuet-in-g', { hands: 'both', mode: 'tempo', fingering: 'first' }),
      ]),
    ], ['Alberti bass', 'Cadences', 'Minuet in G']),

    // -----------------------------------------------------------------------
    unit('pg11', 'Moving Hands', 'Two speeds at once, hand shifts, dotted rhythms and a melody in the bass.', [
      lesson('pg11-1', 'Two Speeds', 'learn', 'Eighths in the right hand over left-hand quarters', [
        duet('Two Speeds', 'C', [4, 4],
          'E4/e@3 D4@2 C4@1 D4@2 E4/q@3 E4@3 | D4/e@2 E4@3 F4@4 E4@3 D4/h@2 | E4/e@3 F4@4 G4@5 F4@4 E4/q@3 C4@1 | D4/e@2 E4@3 F4@4 D4@2 C4/h@1 |',
          'C3/q@5 E3@3 G3@1 E3@3 | B2@5 F3@2 G3@1 F3@2 | C3@5 E3@3 G3@1 E3@3 | B2@5 G3@1 C3/h@5 |'),
        five('roots', P.rhC, P.lhC, { rhythms: RH.eighths, maxLeap: 2 }),
        both('blocked', P.rhC, CHORDS_C, { five: true, rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ], [insight('Two speeds at once', 'When the right hand plays eighths over left-hand quarters, the left hand marks the beat and the right fits two notes into each one. Count “1 & 2 &” — the left hand lands on the numbers.', { kind: 'staff', clef: 'treble', notes: ['E4/e', 'D4/e', 'C4/e', 'D4/e', 'E4/q', 'E4/q'], time: [4, 4] })]),
      lesson('pg11-2', 'Shifting Positions', 'practice', 'Melodies that leave the five-finger position', [
        tip('Look ahead', 'Shifts are easiest when you see them coming: during a long note or a rest, glance ahead and move the hand early — never at the last moment.'),
        both('roots', P.rhOctave, P.lhC, { lhFive: true, rhythms: RH.qh, maxLeap: 2 }),
        both('blocked', P.rhOctave, CHORDS_C, { rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
        both('roots', P.rhStaff, P.lhC, { lhFive: true, rhythms: RH.qh, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('pg11-3', 'Dotted Rhythms', 'practice', 'Long–short in the right hand, steady left hand', [
        tip('Dotted rhythms over a steady bass', 'In a dotted rhythm the short note falls on the “&”. Let the left hand keep the beat and slip the right-hand eighth in just after it.', { kind: 'staff', clef: 'treble', notes: ['E4/q.', 'D4/e', 'C4/h'], time: [4, 4] }),
        five('roots', P.rhC, P.lhC, { rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 60 }),
        both('blocked', P.rhG, CHORDS_G, { key: 'G', five: true, rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        both('waltz', P.rhC, P.lhOctave, { five: true, time: [3, 4], rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('pg11-4', 'Melody in the Left Hand', 'learn', 'The tune moves to the bass; the right hand accompanies', [
        tip('Swap jobs', 'Sometimes the tune is in the bass and the right hand accompanies. Bring the left hand out a little and keep the right-hand chords soft.'),
        duet('Bass Melody', 'C', [4, 4],
          '[C4 E4 G4]/h@1,3,5 [C4 E4 G4]@1,3,5 | [B3 F4 G4]@1,4,5 [B3 F4 G4]@1,4,5 | [B3 F4 G4]@1,4,5 [B3 F4 G4]@1,4,5 | [C4 E4 G4]/w@1,3,5 |',
          'C3/q@5 D3@4 E3@3 F3@2 | G3/h@1 G3@1 | F3/q@2 E3@3 D3@4 E3@3 | C3/w@5 |'),
        duet('Evening Bells', 'C', [3, 4],
          'r/q [E4 G4]@3,5 [E4 G4]@3,5 | r/q [E4 G4]@3,5 [E4 G4]@3,5 | r/q [D4 G4]@2,5 [D4 G4]@2,5 | r/q [D4 F4]@2,4 [D4 F4]@2,4 | r/q [E4 G4]@3,5 [E4 G4]@3,5 | r/q [E4 G4]@3,5 [E4 G4]@3,5 | r/q [D4 F4]@2,4 [D4 F4]@2,4 | [C4 E4]/h.@1,3 |',
          'C3/h@5 D3/q@4 | E3/h.@3 | F3/h@2 E3/q@3 | D3/h.@4 | E3/h@3 F3/q@2 | G3/h.@1 | F3/q@2 E3@3 D3@4 | C3/h.@5 |'),
      ]),
      lesson('pg11-5', 'Songs on the Move', 'song', 'Pieces with moving hands', [
        piece('p2-greensleeves'),
        piece('p2-musette'),
      ]),
      lesson('pg11-c', 'Checkpoint: Moving Hands', 'checkpoint', 'Shifts and mixed rhythms in time', [
        both('blocked', P.rhOctave, CHORDS_C, { rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'first' }),
        five('roots', P.rhC, P.lhC, { rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none' }),
        both('roots', P.rhStaff, P.lhC, { lhFive: true, rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Eighths vs quarters', 'Shifting', 'Dotted rhythms', 'LH melody']),

    // -----------------------------------------------------------------------
    unit('pg12', 'Independence', 'Two real lines at once: counter-melodies, two-part writing and syncopation.', [
      lesson('pg12-1', 'Counter-Melodies', 'learn', 'A second tune in the left hand', [
        both('counter', P.rhC, P.lhOctave, { five: true, rhythms: RH.qh, maxLeap: 2, lhRhythms: { h: 3, w: 1 } }),
        both('counter', P.rhC, P.lhOctave, { five: true, rhythms: RH.qh, maxLeap: 2, lhRhythms: { h: 3, q: 2, w: 1 } }),
        both('counter', P.rhG, 'G2 A2 B2 C3 D3 E3 F#3 G3', { key: 'G', five: true, rhythms: RH.eighths, maxLeap: 2, lhRhythms: { h: 2, q: 3 }, fingering: 'first' }),
      ], [insight('Two voices', 'A counter-melody is a second tune with its own rhythm and shape. Play each line alone first, then together slowly — your ear should follow both at once.')]),
      lesson('pg12-2', 'Two-Part Writing', 'learn', 'Bach-style imitation between the hands', [
        tip('Two equal parts', 'In two-part music both hands have melodies of equal importance, often imitating each other. Spot where the left hand repeats what the right hand just played.'),
        duet('Little Invention', 'C', [4, 4],
          'C4/e@1 D4@2 E4@3 F4@4 D4@2 E4@3 C4/q@1 | E4@3 G4@5 F4@4 E4@3 | D4/e@2 E4@3 F4@4 G4@5 E4@3 F4@4 D4/q@2 | F4@4 D4@2 E4@3 F4@4 | E4/e@3 F4@4 G4@5 F4@4 E4@3 D4@2 E4/q@3 | D4@2 F4@4 E4@3 D4@2 | C4/w@1 |',
          'r/w | C3/e@5 D3@4 E3@3 F3@2 D3@4 E3@3 C3/q@5 | G3@1 D3@4 G3@1 F3@2 | D3/e@4 E3@3 F3@2 G3@1 E3@3 F3@2 D3/q@4 | C3@5 D3@4 E3@3 C3@5 | G3@1 G3@1 C3@5 G3@1 | C3/w@5 |'),
        both('counter', P.rhOctave, P.lhOctave, { rhythms: RH.eighths, maxLeap: 3, lhRhythms: { q: 3, 'e e': 1.5, h: 1 }, fingering: 'first' }),
      ]),
      lesson('pg12-3', 'Syncopation over a Steady Bass', 'learn', 'Off-beat melody, on-beat bass', [
        tip('Off the beat', 'Let the left hand keep a steady beat while the right hand lands between beats. If the hands start to pull together, slow down and count “1 & 2 &” aloud.', { kind: 'staff', clef: 'treble', notes: ['C5/e', 'D5/q', 'C5/e'], time: [2, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        both('blocked', P.rhC, CHORDS_C, { five: true, rhythms: RH.syncopation, maxLeap: 2 }),
        both('broken', P.rhC, BROKEN_C, { five: true, rhythms: RH.syncopation, maxLeap: 2, fingering: 'none' }),
      ]),
      lesson('pg12-4', 'Minor Keys, Both Hands', 'practice', 'A, D and E minor with chords and counter-melodies', [
        tip('Minor with both hands', 'A minor uses the white keys, but its V chord borrows G♯ from the harmonic minor. Expect that accidental in the left hand at every cadence.', { kind: 'staff', clef: 'bass', notes: ['[E2 A2 C3]/h', '[E2 G#2 B2]/h', '[E2 A2 C3]/w'] }),
        both('blocked', P.rhA, CHORDS_AM, { key: 'Am', five: true, rhythms: RH.qh, maxLeap: 2 }),
        both('counter', 'D4 E4 F4 G4 A4', 'D3 E3 F3 G3 A3 Bb3 C#4 D4', { key: 'Dm', five: true, rhythms: RH.dotted, maxLeap: 2, lhRhythms: { h: 3, q: 2 }, fingering: 'first' }),
        both('waltz', 'E4 F#4 G4 A4 B4', 'E3 F#3 G3 A3 B3 C4 D#4 E4', { key: 'Em', five: true, time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('pg12-5', 'Two Lines, Two Hands', 'song', 'Repertoire for independent hands', [
        piece('p2-minuet-in-a-minor'),
        piece('p2-ragtime'),
      ]),
      lesson('pg12-c', 'Checkpoint: Independence', 'checkpoint', 'Independent lines in time', [
        both('counter', P.rhOctave, P.lhOctave, { rhythms: RH.eighths, maxLeap: 3, lhRhythms: { q: 3, h: 1.5, 'e e': 1 }, mode: 'tempo', tempo: 60, fingering: 'first' }),
        both('blocked', P.rhOctave, CHORDS_C, { rhythms: RH.syncopation, maxLeap: 3, mode: 'tempo', tempo: 63, fingering: 'none' }),
        both('blocked', P.rhA, CHORDS_AM, { key: 'Am', five: true, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Counter-melody', 'Two-part reading', 'Syncopation', 'Minor keys']),

    // -----------------------------------------------------------------------
    unit('pg13', 'Repertoire & Mastery', 'Concert pieces, sight-reading at tempo and the final exam.', [
      lesson('pg13-1', 'Für Elise', 'song', 'Beethoven’s famous bagatelle, hands separately then together', [
        piece('p2-fur-elise', { hands: 'R', title: 'Für Elise — right hand' }),
        piece('p2-fur-elise', { hands: 'L', title: 'Für Elise — left hand' }),
        piece('p2-fur-elise', { hands: 'both', title: 'Für Elise — hands together' }),
      ], [insight('Sharing the line', 'In Für Elise the hands pass broken chords between them: left hand goes up, right hand carries on. Make the hand-over seamless — it should sound like one hand.')]),
      lesson('pg13-2', 'Prelude in C', 'song', 'Bach’s chain of broken chords', [
        tip('Read the chord, not the notes', 'Every bar of this prelude is one chord broken into the same pattern. Read the whole bar as a shape, set the hands on it, then play the pattern.'),
        piece('p2-prelude-in-c', { fingering: 'first' }),
        piece('p2-prelude-in-c', { mode: 'tempo', fingering: 'none', title: 'Prelude in C — in tempo' }),
      ]),
      lesson('pg13-3', 'Gymnopédie & Canon', 'song', 'Two slow classics with wide left-hand leaps', [
        piece('p2-gymnopedie-1'),
        piece('p2-canon-in-d'),
      ]),
      lesson('pg13-4', 'Scales Like a Pro', 'practice', 'Faster scales in more keys', [
        scale('C', 'major', 'both', { motion: 'contrary', octaves: 2, rhythm: 's', mode: 'tempo', tempo: 60, fingering: 'first' }),
        scale('E', 'major', 'both', { rhythm: 'e', mode: 'tempo', tempo: 72, fingering: 'first' }),
        scale('Bb', 'major', 'both', { octave: 3, rhythm: 'e', mode: 'tempo', tempo: 66, fingering: 'first' }),
        scale('A', 'harmonic-minor', 'both', { octave: 3, rhythm: 'e', mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
      lesson('pg13-5', 'Sight-Reading Marathon', 'challenge', 'New music at tempo in many keys and styles', [
        both('blocked', 'D4 E4 F#4 G4 A4 B4 C#5 D5', 'A2 B2 C#3 D3 E3 F#3 G3 A3', { key: 'D', rhythms: RH.dotted, harmonic: true, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'none', measures: 8 }),
        both('alberti', 'F4 G4 A4 Bb4 C5 D5 E5 F5', BROKEN_F, { key: 'F', rhythms: RH.eighths, harmonic: true, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none', measures: 8 }),
        both('waltz', 'D4 E4 F#4 G4 A4 B4 C5 D5', 'G2 A2 B2 C3 D3 E3 F#3 G3 A3 B3', { key: 'G', time: [3, 4], rhythms: RH.waltz, harmonic: true, maxLeap: 4, mode: 'tempo', tempo: 96, fingering: 'none', measures: 8 }),
        both('counter', P.rhWide, P.lhWide, { rhythms: RH.advanced, harmonic: true, maxLeap: 4, lhRhythms: { q: 2, h: 1, 'e e': 1 }, mode: 'tempo', tempo: 60, fingering: 'none', measures: 8 }),
      ]),
      lesson('pg13-c', 'Final Exam: Both Hands', 'checkpoint', 'Prove your mastery of the grand staff', [
        scale('E', 'major', 'both', { rhythm: 'e', mode: 'tempo', tempo: 80, fingering: 'none' }),
        both('alberti', P.rhStaff, BROKEN_C, { rhythms: RH.dotted, harmonic: true, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'none', measures: 6 }),
        both('counter', P.rhWide, P.lhWide, { rhythms: RH.advanced, harmonic: true, maxLeap: 4, lhRhythms: { q: 2, h: 1, 'e e': 1.5 }, mode: 'tempo', tempo: 63, fingering: 'none', measures: 8 }),
      ]),
    ], ['Repertoire', 'Sight-reading at tempo', 'Advanced scales']),
  ],
};
