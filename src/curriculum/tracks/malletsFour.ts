import { RH, inlinePiece, insight, interval, lesson, meet, n, name, piece, play, read, scale, tip, unit } from '../builders';
import type { ReadOpts } from '../builders';
import type { ScaleKind } from '../../music/keys';
import type { Clef } from '../../music/score';
import type { TimeSig } from '../../music/rhythm';
import type { AccompPattern, ActivityDef, TrackDef } from '../types';

/**
 * Four mallets: chords, independence and the grand staff on marimba (and, for the
 * treble-staff units, vibraphone or xylophone). Mallets use Stevens numbering,
 * 1-2 in the left hand and 3-4 in the right, left to right.
 *
 * Fixed exercises written inline carry explicit sticking; the play-along shows the
 * hand (L / R) for them, while songs from the library show the mallet numbers.
 */

const T = 'treble' as const;
const B = 'bass' as const;

type PieceOpts = Parameters<typeof inlinePiece>[4];

/** Sight-reading on one staff with four mallets. */
function rd4(clef: Clef, pool: string, o: ReadOpts = {}): ActivityDef {
  const a = read(clef, pool, o);
  return a.type === 'read' ? { ...a, gen: { ...a.gen, mallets: 4 } } : a;
}

/**
 * Grand-staff sight-reading: right hand (3-4) melody on the treble staff from `rh`,
 * left hand (1-2) on the bass staff from `lh` in an accompaniment pattern. Only
 * patterns a two-mallet left hand can play are used (drone, roots, waltz, broken).
 */
function grand(pattern: Extract<AccompPattern, 'drone' | 'roots' | 'waltz' | 'broken'>, rh: string, lh: string, o: ReadOpts = {}): ActivityDef {
  return rd4(T, rh, { ...o, accomp: { pattern, pool: n(lh) } });
}

/** A scale with four mallets in hand (single strokes, mostly the inner mallets). */
function sc4(tonic: string, kind: ScaleKind, o: Parameters<typeof scale>[3] = {}): ActivityDef {
  const a = scale(tonic, kind, 'both', { octave: 4, ...o });
  return a.type === 'scale' ? { ...a, mallets: 4 } : a;
}

/** A fixed exercise on one treble staff (sticking written out). */
const chords = (title: string, key: string, time: TimeSig, voice: string, o?: PieceOpts): ActivityDef =>
  inlinePiece(title, key, time, [{ clef: T, voices: [voice] }], o);

/** A fixed grand-staff exercise: right hand on the treble staff, left hand on the bass staff. */
const duet = (title: string, key: string, time: TimeSig, rh: string, lh: string, o?: PieceOpts): ActivityDef =>
  inlinePiece(title, key, time, [{ clef: T, hand: 'R', voices: [rh] }, { clef: B, hand: 'L', voices: [lh] }], o);

/** Prompt for generated interval reading on one staff (the engine may share an interval between the hands). */
const SHAPES = 'Read each interval as a shape and follow the mallet numbers: most intervals sit in one hand, some are shared between the hands.';

// Right-hand / treble pools
const OCT = 'C4 D4 E4 F4 G4 A4 B4 C5';
const WIDE = 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5';
const G_RH = 'D4 E4 F#4 G4 A4 B4 C5 D5';
const F_RH = 'C4 D4 E4 F4 G4 A4 Bb4 C5';
const RH_HIGH = 'E4 F4 G4 A4 B4 C5 D5 E5';
const G_RH_HIGH = 'E4 F#4 G4 A4 B4 C5 D5 E5';
const AM_RH = 'E4 F4 G#4 A4 B4 C5 D5 E5';
// Left-hand / bass pools (all below the right hand's notes)
const BASS_NOTES = 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4';
const LH_C = 'C3 D3 E3 F3 G3 A3 B3';
const LH_G = 'C3 D3 E3 F#3 G3 A3 B3';
const LH_F = 'Bb2 C3 D3 E3 F3 G3 A3';
const LH_C_BROKEN = 'C3 D3 E3 F3 G3 A3 B3 C4 D4';
const LH_G_BROKEN = 'C3 D3 E3 F#3 G3 A3 B3 C4 D4';
const LH_AM = 'A2 B2 C3 D3 E3 F3 G#3 A3';

export const malletsFour: TrackDef = {
  id: 'mallets-four',
  instrument: 'mallets',
  title: 'Four Mallets',
  subtitle: 'Mallets · Chords & grand staff',
  description:
    'Two mallets in each hand: the Stevens grip and mallet numbers, intervals and block chords, melodies with harmony, the bass clef and grand staff, chorales, progressions and accompaniment patterns — up to real four-mallet repertoire.',
  clef: 'grand',
  accent: '#89ddff',
  glyph: '𝄞',
  heatmap: [
    { clef: 'treble', low: 'C4', high: 'C6' },
    { clef: 'bass', low: 'A2', high: 'C4' },
  ],
  recommends: ['mallets-two'],
  units: [
    // -----------------------------------------------------------------------
    unit('m4u1', 'Four Mallets in Your Hands', 'Two grips, four numbers and your first strokes with two mallets in each hand.', [
      lesson('m4-1-1', 'Two Grips', 'learn', 'Hold four mallets and learn their numbers', [
        tip('The Stevens grip', 'Each hand holds two mallets that never touch. The inner mallet (2 or 3) is held by your middle, ring and little fingers, its end resting against the heel of your hand. The outer mallet (1 or 4) is held between your thumb and index finger. To open or close the interval, turn the outer mallet with your thumb and index finger — the inner mallet stays still.'),
        tip('The Burton grip', 'In the Burton grip the two shafts cross inside your palm and are held mainly by the thumb and index finger. It gives a strong, solid stroke for chords and is popular with vibraphonists. If your teacher uses Burton, that is fine — in Clef Coach the numbers simply count your mallets from left to right, whatever your grip.'),
        tip('Mallet numbers', 'Mallets are numbered 1 to 4 from left to right as you face the instrument: 1 and 2 in the left hand (1 is the outside mallet), 3 and 4 in the right hand (4 is the outside mallet). Small numbers above the notes tell you which mallet to use.', { kind: 'keys', notes: ['C4', 'G4', 'C5', 'E5'], sticking: ['1', '2', '3', '4'] }),
        meet(T, 'C4 G4 C5 E5', { fingers: [1, 2, 3, 4], reps: 2, tips: ['Mallet 1: the outside mallet of your left hand.', 'Mallet 2: the inside mallet of your left hand. Your left hand now holds a fifth, C–G.', 'Mallet 3: the inside mallet of your right hand.', 'Mallet 4: the outside mallet of your right hand. Your right hand holds a third, C–E.'] }),
      ], [
        insight('Stevens or Burton?', 'There are two main ways to hold four mallets. In the Stevens grip (named after the marimbist Leigh Howard Stevens) every mallet moves independently, which makes single strokes easy — most marimba players use it. In the Burton grip (named after the vibraphonist Gary Burton) the mallets cross in the palm for a powerful chord stroke. Clef Coach uses Stevens numbering, like most method books.'),
        insight('Before you start', 'This track builds on Two Mallets: you should already read the treble clef comfortably and know your way around the bars. Four-mallet music has two to four notes at a time, so you will read in shapes more than in single notes.'),
      ]),
      lesson('m4-1-2', 'Permutations', 'learn', 'Play every mallet on its own', [
        tip('Single independent strokes', 'A single independent stroke plays one mallet while its partner hovers just above the bars. Turn your forearm as if you were turning a door handle: the rotation lifts and drops the mallet. Keep the interval in each hand steady.', { kind: 'keys', notes: ['C4', 'G4', 'C5', 'E5'], sticking: ['1', '2', '3', '4'] }),
        piece('mal-permutations'),
        piece('mal-permutations', { mode: 'tempo', tempo: 66, fingering: 'first', title: 'Mallet Permutations — in time' }),
      ]),
      lesson('m4-1-3', 'Inner Mallets', 'practice', 'Melodies with mallets 2 and 3', [
        tip('Melodies on the inside', 'For a single melody, use the two inner mallets — 2 in the left hand and 3 in the right — and alternate them just like two-mallet playing. The outer mallets ride along, ready for the next chord.', { kind: 'staff+keys', clef: 'treble', notes: ['C4', 'D4', 'E4', 'F4', 'G4'], sticking: ['3', '2', '3', '2', '3'] }),
        rd4(T, OCT, { rhythms: RH.qh, maxLeap: 2 }),
        sc4('C', 'major'),
        rd4(T, WIDE, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('m4-1-c', 'Checkpoint: Four Mallets', 'checkpoint', 'Every mallet, every order', [
        piece('mal-permutations', { mode: 'tempo', tempo: 76, fingering: 'none' }),
        rd4(T, OCT, { rhythms: RH.qh, maxLeap: 3, fingering: 'first' }),
        sc4('G', 'major', { mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['Stevens grip', 'Mallets 1–4', 'Permutations']),

    // -----------------------------------------------------------------------
    unit('m4u2', 'Double Verticals', 'Both mallets of one hand together: thirds, fourths, fifths, sixths and octaves.', [
      lesson('m4-2-1', 'Thirds in Each Hand', 'learn', 'Two mallets, one stroke', [
        tip('Double vertical strokes', 'A double vertical stroke plays both mallets of one hand at the same time. Set the interval first, then strike with one wrist motion so both heads land together — one sound, no flam. Start with thirds: the easiest interval to hold.', { kind: 'staff+keys', clef: 'treble', notes: ['[C4 E4]', '[G4 B4]'], sticking: ['1', '2', '3', '4'] }),
        chords('Thirds, Hand by Hand', 'C', [4, 4], '[C4 E4]/q@1,2 [C4 E4]@1,2 [G4 B4]@3,4 [G4 B4]@3,4 | [D4 F4]@1,2 [D4 F4]@1,2 [A4 C5]@3,4 [A4 C5]@3,4 | [C4 E4]@1,2 [D4 F4]@1,2 [G4 B4]@3,4 [A4 C5]@3,4 | [C4 E4]/h@1,2 [C5 E5]@3,4 |', { prompt: 'Left hand on the low thirds, right hand on the high ones.' }),
        interval(T, OCT, [3], 8, { harmonic: true }),
        rd4(T, WIDE, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.6, intervals: [3] }, prompt: SHAPES }),
      ]),
      lesson('m4-2-2', 'Fourths, Fifths and Sixths', 'learn', 'Opening the interval', [
        tip('Opening the interval', 'To widen the interval, turn the outer mallet away from the inner one with your thumb and index finger — the inner mallet stays put. Fourths and fifths sound open and strong; sixths are warm and, with thirds, the most comfortable intervals to hold.', { kind: 'staff', clef: 'treble', notes: ['[C4 F4]', '[C4 G4]', '[C4 A4]'] }),
        interval(T, WIDE, [4, 5, 6], 10, { harmonic: true }),
        rd4(T, WIDE, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.6, intervals: [3, 4, 5, 6] }, prompt: SHAPES }),
      ]),
      lesson('m4-2-3', 'Octaves', 'learn', 'The widest interval in one hand', [
        tip('Octaves', 'An octave — C to C — is the widest interval most players use in one hand. The stretch comes from turning the outer mallet, not from squeezing. Octaves in the left hand make a strong, ringing bass.', { kind: 'staff+keys', clef: 'treble', notes: ['[C4 C5]'], sticking: ['1', '2'] }),
        interval(T, WIDE, [5, 6, 8], 8, { harmonic: true }),
        rd4(T, WIDE, { rhythms: RH.qh, maxLeap: 3, dyads: { chance: 0.5, intervals: [3, 6, 8] }, prompt: SHAPES }),
      ]),
      lesson('m4-2-4', 'Interval Waltz', 'song', 'Double verticals in three-four time', [
        piece('mal-interval-waltz'),
        piece('mal-interval-waltz', { mode: 'tempo', fingering: 'first', title: 'Interval Waltz — in time' }),
      ]),
      lesson('m4-2-c', 'Checkpoint: Double Verticals', 'checkpoint', 'Read intervals as shapes', [
        interval(T, WIDE, [3, 4, 5, 6, 8], 12, { harmonic: true }),
        rd4(T, WIDE, { rhythms: RH.qh, maxLeap: 3, dyads: { chance: 0.6, intervals: [3, 4, 5, 6, 8] }, fingering: 'first' }),
        rd4(T, WIDE, { rhythms: RH.qhw, maxLeap: 3, dyads: { chance: 0.5, intervals: [3, 6] }, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
    ], ['Double vertical', '3rds–octaves', 'Interval shapes']),

    // -----------------------------------------------------------------------
    unit('m4u3', 'Block Chords', 'All four mallets at once: C, F and G chords with the root doubled.', [
      lesson('m4-3-1', 'The C Chord', 'learn', 'Four mallets, one sound', [
        tip('Four notes, three names', 'A triad has three notes. With four mallets you double one of them — usually the root. For C: C–E in the left hand and G–C in the right. Set both intervals, then strike all four mallets at once.', { kind: 'staff+keys', clef: 'treble', notes: ['[C4 E4 G4 C5]'], sticking: ['1', '2', '3', '4'] }),
        chords('C Chord Strokes', 'C', [4, 4], '[C4 E4 G4 C5]/h@1,2,3,4 [C4 E4 G4 C5]@1,2,3,4 | [C4 E4 G4 C5]/q@1,2,3,4 [C4 E4 G4 C5]@1,2,3,4 [C4 E4 G4 C5]/h@1,2,3,4 | [C4 E4]/q@1,2 [G4 C5]@3,4 [C4 E4]@1,2 [G4 C5]@3,4 | [C4 E4 G4 C5]/w@1,2,3,4 |', { prompt: 'Mallets 1-2-3-4 from the lowest note up. All four heads should land as one sound.' }),
      ]),
      lesson('m4-3-2', 'Sliding Shapes', 'learn', 'F and G chords with the same shape', [
        tip('Same shape, new chord', 'F is F–A | C–F and G is G–B | D–G: a third in the left hand and a fourth in the right — exactly the shape of your C chord. Keep the shape in your hands and slide both hands together.', { kind: 'staff+keys', clef: 'treble', notes: ['[F4 A4 C5 F5]'], sticking: ['1', '2', '3', '4'] }),
        chords('Sliding Chords', 'C', [4, 4], '[C4 E4 G4 C5]/h@1,2,3,4 [F4 A4 C5 F5]@1,2,3,4 | [G4 B4 D5 G5]@1,2,3,4 [C4 E4 G4 C5]@1,2,3,4 | [F4 A4 C5 F5]@1,2,3,4 [C4 E4 G4 C5]@1,2,3,4 | [G4 B4 D5 G5]@1,2,3,4 [C4 E4 G4 C5]@1,2,3,4 |', { fingering: 'none', prompt: 'Mallets 1-2-3-4 from the bottom up on every chord.' }),
      ]),
      lesson('m4-3-3', 'Smooth Chords', 'learn', 'Keep shared notes still', [
        tip('Move as little as possible', 'In a chorale the hands don’t slide the whole shape: they keep shared notes still and move the others by a step. From C (C–G | C–E) to F (C–A | C–F), mallets 1 and 3 stay on their Cs while 2 and 4 step up.', { kind: 'staff+keys', clef: 'treble', notes: ['[C4 G4 C5 E5]', '[C4 A4 C5 F5]'], sticking: ['1', '2', '3', '4', '1', '2', '3', '4'] }),
        piece('mal-marimba-chorale'),
      ]),
      lesson('m4-3-4', 'Ode to Joy Chorale', 'song', 'Melody on top, harmony below', [
        tip('Melody on top', 'In a chorale arrangement the melody is the top note — mallet 4. Let it sing slightly louder than the others by lifting mallet 4 a little higher.'),
        piece('mal-ode-to-joy-chorale'),
      ]),
      lesson('m4-3-c', 'Checkpoint: Block Chords', 'checkpoint', 'Change chords on time', [
        chords('I – IV – V – I', 'C', [4, 4], '[C4 G4 C5 E5]/h@1,2,3,4 [C4 A4 C5 F5]@1,2,3,4 | [B3 G4 B4 D5]@1,2,3,4 [C4 G4 C5 E5]@1,2,3,4 | [C4 A4 C5 F5]/q@1,2,3,4 [C4 A4 C5 F5]@1,2,3,4 [B3 G4 B4 D5]@1,2,3,4 [B3 G4 B4 D5]@1,2,3,4 | [C4 G4 C5 E5]/w@1,2,3,4 |', { mode: 'tempo', tempo: 72, fingering: 'none' }),
        piece('mal-marimba-chorale', { mode: 'tempo', fingering: 'first' }),
      ]),
    ], ['Block chords', 'Doubled root', 'C F G']),

    // -----------------------------------------------------------------------
    unit('m4u4', 'Melody & Laterals', 'Single strokes and double laterals: melodies and broken chords with four mallets in hand.', [
      lesson('m4-4-1', 'Melody on the Inside', 'practice', 'Scales and melodies with mallets 2 and 3', [
        rd4(T, WIDE, { rhythms: RH.eighths, maxLeap: 2 }),
        sc4('F', 'major'),
        sc4('G', 'major', { mode: 'tempo', tempo: 72 }),
      ]),
      lesson('m4-4-2', 'Double Laterals', 'learn', 'Two notes from one turn of the wrist', [
        tip('Double lateral strokes', 'A double lateral plays the two mallets of one hand one after the other with a single turn of the forearm: outside–inside (1-2 or 4-3) or inside–outside (2-1 or 3-4). It is how four-mallet players play fast broken chords. Think of turning a key: one motion, two notes.', { kind: 'keys', notes: ['C4', 'G4', 'E5', 'C5'], sticking: ['1', '2', '4', '3'] }),
        chords('Turning Keys', 'C', [4, 4], 'C4/e@1 G4@2 E5@4 C5@3 C4@1 G4@2 E5@4 C5@3 | C4@1 A4@2 F5@4 C5@3 C4@1 A4@2 F5@4 C5@3 | B3@1 G4@2 D5@4 B4@3 B3@1 G4@2 D5@4 B4@3 | C4@1 G4@2 E5@4 C5@3 [C4 G4 C5 E5]/h@1,2,3,4 |', { prompt: 'Left hand 1-2, right hand 4-3: each pair is one turn of the wrist.' }),
        piece('mal-permutations', { title: 'Permutations — play each pair as one lateral motion' }),
      ]),
      lesson('m4-4-3', 'Melody with a Partner', 'practice', 'Add a harmony note under the tune', [
        tip('Add a harmony note', 'With two mallets in your right hand, the melody can have a partner: mallet 4 plays the tune and mallet 3 adds a note a third or a sixth below on the important beats.', { kind: 'staff+keys', clef: 'treble', notes: ['[C5 E5]', 'F5', '[B4 G5]'], sticking: ['3', '4', '4', '3', '4'] }),
        rd4(T, WIDE, { rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.35, intervals: [3, 6] } }),
        rd4(T, WIDE, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2, harmonic: true, dyads: { chance: 0.4, intervals: [3, 6] } }),
      ]),
      lesson('m4-4-c', 'Checkpoint: Melody & Laterals', 'checkpoint', 'Single strokes and laterals in time', [
        chords('Turning Keys', 'C', [4, 4], 'C4/e@1 G4@2 E5@4 C5@3 C4@1 G4@2 E5@4 C5@3 | C4@1 A4@2 F5@4 C5@3 C4@1 A4@2 F5@4 C5@3 | B3@1 G4@2 D5@4 B4@3 B3@1 G4@2 D5@4 B4@3 | C4@1 G4@2 E5@4 C5@3 [C4 G4 C5 E5]/h@1,2,3,4 |', { mode: 'tempo', tempo: 60, fingering: 'first' }),
        rd4(T, WIDE, { rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'first' }),
        rd4(T, WIDE, { rhythms: RH.qh, maxLeap: 3, harmonic: true, dyads: { chance: 0.4, intervals: [3, 6] }, fingering: 'none' }),
      ]),
    ], ['Inner mallets', 'Double lateral', 'Melody + harmony']),

    // -----------------------------------------------------------------------
    unit('m4u5', 'The Grand Staff', 'Bass clef for the left hand, treble for the right — the full marimba keyboard.', [
      lesson('m4-5-1', 'The Bass Clef', 'learn', 'Left-hand notes below Middle C', [
        tip('The bass clef', 'The bass clef (𝄢) is an F clef: its two dots sit either side of the F line (F3). Middle C sits on a ledger line just above the bass staff — the same C you know from just below the treble staff.', { kind: 'staff', clef: 'bass', notes: ['F3', 'C4'], labels: true }),
        meet(B, 'C3 G3 A2', { fingers: [1, 2, 1], tips: ['C3 sits in the second space of the bass staff, an octave below Middle C. Left hand, mallet 1.', 'G3 is in the top space. Mallet 2 — your left hand now holds a fifth.', 'A2 is in the bottom space: the lowest A on a standard marimba.'] }),
        name(B, BASS_NOTES, 12),
      ], [
        insight('Low notes need a marimba', 'From here on the left hand reads the bass clef and plays down to A2. Only a marimba reaches that low: a vibraphone and a xylophone stop at F3. On those instruments, the treble-staff lessons and chorales earlier in this track are your four-mallet workout.'),
      ]),
      lesson('m4-5-2', 'Bass Clef Reading', 'practice', 'Lines and spaces of the bass staff', [
        tip('Lines and spaces', 'Bass clef lines from the bottom: G B D F A — “Good Boys Do Fine Always”. Spaces: A C E G — “All Cows Eat Grass”.', { kind: 'staff', clef: 'bass', notes: ['A2', 'C3', 'E3', 'G3', 'B2', 'D3', 'F3', 'A3'], labels: true }),
        name(B, BASS_NOTES, 14, { sequence: true, title: 'Note rush' }),
        play(B, BASS_NOTES, 10, { hints: true }),
        rd4(B, 'C3 D3 E3 F3 G3 A3 B3 C4', { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m4-5-3', 'Hands on Two Staves', 'learn', 'Melody above, bass below', [
        tip('Two staves, two hands', 'The right hand (3-4) reads the treble staff and the left hand (1-2) the bass staff. On beat one both hands strike together: read the bass note first, then the melody above it.'),
        grand('drone', 'E4 F4 G4 A4 B4 C5', LH_C_BROKEN, { rhythms: RH.qh, maxLeap: 1 }),
        grand('roots', OCT, LH_C, { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m4-5-4', 'Silent Night', 'song', 'One low chord per bar under the carol', [
        piece('mal-silent-night'),
      ]),
      lesson('m4-5-c', 'Checkpoint: The Grand Staff', 'checkpoint', 'Read both staves together', [
        name(B, BASS_NOTES, 12),
        grand('roots', OCT, LH_C, { rhythms: RH.qhw, maxLeap: 3, mode: 'tempo', tempo: 66, fingering: 'first' }),
        grand('drone', G_RH_HIGH, LH_G_BROKEN, { key: 'G', rhythms: RH.qh, maxLeap: 2, fingering: 'none' }),
      ]),
    ], ['Bass clef', 'Grand staff', 'Bass + melody']),

    // -----------------------------------------------------------------------
    unit('m4u6', 'Chorales', 'Four-voice hymns: bass and tenor in the left hand, alto and soprano in the right.', [
      lesson('m4-6-1', 'Four Voices', 'learn', 'One voice per mallet', [
        tip('Four voices, four mallets', 'A chorale has four voices: soprano (the melody, mallet 4), alto (mallet 3), tenor (mallet 2) and bass (mallet 1). Each hand plays two voices — the left hand reads the bass staff and the right hand the treble staff.', { kind: 'keys', notes: ['G3', 'D4', 'G4', 'B4'], sticking: ['1', '2', '3', '4'] }),
        duet('Evening Hymn', 'C', [4, 4],
          '[E4 C5]/h@3,4 [F4 C5]@3,4 | [D4 B4]@3,4 [E4 C5]@3,4 | [E4 C5]@3,4 [F4 C5]@3,4 | [F4 B4]@3,4 [E4 C5]@3,4 |',
          '[C3 G3]/h@1,2 [F3 A3]@1,2 | [G3 B3]@1,2 [C3 G3]@1,2 | [A2 C3]@1,2 [F3 A3]@1,2 | [G3 B3]@1,2 [C3 G3]@1,2 |'),
        piece('mal-chorale-in-g'),
      ]),
      lesson('m4-6-2', 'Amazing Grace', 'song', 'A hymn in F major', [
        tip('Let chorales ring', 'On a marimba, chorales are usually rolled so that long chords keep sounding. Four-mallet rolls are an advanced skill to learn with your teacher; here, strike each chord once and let it ring — the app grades one stroke per note.'),
        piece('mal-amazing-grace'),
      ]),
      lesson('m4-6-3', 'Hymn Reading', 'practice', 'Sight-read hymn textures in C, G and F', [
        grand('roots', OCT, LH_C, { rhythms: RH.slow, maxLeap: 2, harmonic: true, dyads: { chance: 0.7, intervals: [3, 6] } }),
        grand('roots', G_RH, LH_G, { key: 'G', rhythms: RH.slow, maxLeap: 2, harmonic: true, dyads: { chance: 0.7, intervals: [3, 6] } }),
        grand('roots', F_RH, LH_F, { key: 'F', rhythms: RH.slow, maxLeap: 2, harmonic: true, dyads: { chance: 0.7, intervals: [3, 6] } }),
      ]),
      lesson('m4-6-c', 'Checkpoint: Chorales', 'checkpoint', 'Four voices in time', [
        duet('Evening Hymn', 'C', [4, 4],
          '[E4 C5]/h@3,4 [F4 C5]@3,4 | [D4 B4]@3,4 [E4 C5]@3,4 | [E4 C5]@3,4 [F4 C5]@3,4 | [F4 B4]@3,4 [E4 C5]@3,4 |',
          '[C3 G3]/h@1,2 [F3 A3]@1,2 | [G3 B3]@1,2 [C3 G3]@1,2 | [A2 C3]@1,2 [F3 A3]@1,2 | [G3 B3]@1,2 [C3 G3]@1,2 |', { mode: 'tempo', tempo: 60, fingering: 'first' }),
        piece('mal-chorale-in-g', { mode: 'tempo', fingering: 'first' }),
        grand('roots', G_RH, LH_G, { key: 'G', rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.6, intervals: [3, 6] }, fingering: 'none' }),
      ]),
    ], ['Four voices', 'Voice leading', 'Hymns']),

    // -----------------------------------------------------------------------
    unit('m4u7', 'Chord Progressions', 'I–IV–V–I in C, G and F: the progression behind thousands of songs.', [
      lesson('m4-7-1', 'I – IV – V – I in C', 'learn', 'Chord numbers and the dominant seventh', [
        tip('Chord numbers', 'Chords are numbered on the steps of the scale: in C major, I = C, IV = F and V = G. I–IV–V–I is the most common progression in music. Add F to the G chord and you get V7 (G7), which pulls even harder back home: watch the F step down to E and the B step up to C.', { kind: 'staff', clef: 'bass', notes: ['C3/q', 'F3/q', 'G3/q', 'C3/q'], time: [4, 4] }),
        duet('Progression in C', 'C', [4, 4],
          '[E4 C5]/w@3,4 | [F4 C5]/w@3,4 | [D4 B4]/w@3,4 | [E4 C5]/w@3,4 | [E4 C5]/h@3,4 [F4 C5]@3,4 | [F4 B4]@3,4 [E4 C5]@3,4 |',
          '[C3 G3]/w@1,2 | [F3 A3]/w@1,2 | [G3 B3]/w@1,2 | [C3 G3]/w@1,2 | [C3 G3]/h@1,2 [F3 A3]@1,2 | [G3 B3]@1,2 [C3 G3]@1,2 |'),
        grand('roots', OCT, LH_C, { rhythms: RH.qhw, maxLeap: 2, harmonic: true, dyads: { chance: 0.3, intervals: [3, 6] } }),
      ]),
      lesson('m4-7-2', 'In G and F', 'practice', 'The same progression in two more keys', [
        duet('Progression in G', 'G', [4, 4],
          '[G4 B4]/w@3,4 | [G4 C5]/w@3,4 | [F#4 A4]/w@3,4 | [D4 B4]/w@3,4 | [G4 B4]/h@3,4 [G4 C5]@3,4 | [F#4 C5]@3,4 [D4 B4]@3,4 |',
          '[G3 D4]/w@1,2 | [C3 E3]/w@1,2 | [D3 A3]/w@1,2 | [G3 B3]/w@1,2 | [G3 D4]/h@1,2 [C3 E3]@1,2 | [D3 A3]@1,2 [G3 B3]@1,2 |'),
        duet('Progression in F', 'F', [4, 4],
          '[F4 A4]/w@3,4 | [F4 Bb4]/w@3,4 | [E4 G4]/w@3,4 | [C4 F4]/w@3,4 | [F4 A4]/h@3,4 [F4 Bb4]@3,4 | [E4 Bb4]@3,4 [C4 A4]@3,4 |',
          '[F3 C4]/w@1,2 | [Bb2 D3]/w@1,2 | [C3 G3]/w@1,2 | [F3 A3]/w@1,2 | [F3 C4]/h@1,2 [Bb2 D3]@1,2 | [C3 G3]@1,2 [F3 A3]@1,2 |'),
      ]),
      lesson('m4-7-3', 'Reading Progressions', 'practice', 'Melodies over moving roots', [
        grand('roots', OCT, LH_C, { rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.35, intervals: [3, 6] } }),
        grand('roots', G_RH, LH_G, { key: 'G', rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.35, intervals: [3, 6] } }),
        grand('roots', F_RH, LH_F, { key: 'F', rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.35, intervals: [3, 6] }, fingering: 'first' }),
      ]),
      lesson('m4-7-c', 'Checkpoint: Progressions', 'checkpoint', 'Change chords on the beat', [
        duet('Progression in G', 'G', [4, 4],
          '[G4 B4]/w@3,4 | [G4 C5]/w@3,4 | [F#4 A4]/w@3,4 | [D4 B4]/w@3,4 | [G4 B4]/h@3,4 [G4 C5]@3,4 | [F#4 C5]@3,4 [D4 B4]@3,4 |',
          '[G3 D4]/w@1,2 | [C3 E3]/w@1,2 | [D3 A3]/w@1,2 | [G3 B3]/w@1,2 | [G3 D4]/h@1,2 [C3 E3]@1,2 | [D3 A3]@1,2 [G3 B3]@1,2 |', { mode: 'tempo', tempo: 66, fingering: 'none' }),
        grand('roots', F_RH, LH_F, { key: 'F', rhythms: RH.qhw, maxLeap: 3, harmonic: true, dyads: { chance: 0.4, intervals: [3, 6] }, mode: 'tempo', tempo: 63, fingering: 'first' }),
      ]),
    ], ['I IV V I', 'V7', 'C G F']),

    // -----------------------------------------------------------------------
    unit('m4u8', 'Accompaniment Patterns', 'Waltz bass, broken chords and rocking arpeggios under a melody.', [
      lesson('m4-8-1', 'Waltz Bass', 'learn', 'Oom-pah-pah in the left hand', [
        tip('Oom-pah-pah', 'In 3/4 the left hand plays the bass note on beat one, then the two upper notes of the chord together (mallets 1 and 2) on beats two and three. Lean into beat one; keep two and three light.', { kind: 'staff', clef: 'bass', notes: ['C3/q', '[E3 G3]/q', '[E3 G3]/q', 'B2/q', '[D3 F3]/q', '[D3 F3]/q'], time: [3, 4] }),
        inlinePiece('Waltz Bass', 'C', [3, 4], [{ clef: B, hand: 'L', voices: ['C3/q@1 [E3 G3]@1,2 [E3 G3]@1,2 | C3@1 [E3 G3]@1,2 [E3 G3]@1,2 | B2@1 [D3 F3]@1,2 [D3 F3]@1,2 | C3@1 [E3 G3]@1,2 [E3 G3]@1,2 |'] }], { prompt: 'Left hand alone first.' }),
        grand('waltz', OCT, LH_C, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('m4-8-2', 'Broken Chords', 'learn', 'Root, fifth, third, fifth', [
        tip('Broken chords in the left hand', 'Play the chord one note at a time — root, fifth, third, fifth — with single independent strokes. Mallet 2 stays on the fifth while mallet 1 moves from the root up to the third and back; the right hand plays the melody above.', { kind: 'staff', clef: 'bass', notes: ['C3/q', 'G3/q', 'E3/q', 'G3/q'], time: [4, 4] }),
        grand('broken', RH_HIGH, LH_C_BROKEN, { rhythms: RH.qhw, maxLeap: 2 }),
        grand('broken', G_RH_HIGH, LH_G_BROKEN, { key: 'G', rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('m4-8-3', 'Lullaby', 'song', 'Brahms’ cradle song with a rocking left hand', [
        tip('Rocking arpeggios', 'In Brahms’ Lullaby the left hand rocks through each chord — bass, fifth, third — while the right hand sings the tune with mallets 3 and 4. Keep the left hand soft and even, like a cradle rocking.'),
        piece('mal-brahms-lullaby'),
      ]),
      lesson('m4-8-c', 'Checkpoint: Accompaniment', 'checkpoint', 'Patterns that keep going under the tune', [
        grand('waltz', OCT, LH_C, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, mode: 'tempo', tempo: 80, fingering: 'first' }),
        grand('broken', RH_HIGH, LH_C_BROKEN, { rhythms: RH.qh, maxLeap: 3, mode: 'tempo', tempo: 63, fingering: 'none' }),
        piece('mal-brahms-lullaby', { mode: 'tempo', fingering: 'first' }),
      ]),
    ], ['Waltz bass', 'Broken chords', 'Arpeggios']),

    // -----------------------------------------------------------------------
    unit('m4u9', 'Concert Pieces', 'Melody, harmony and bass together in real repertoire.', [
      lesson('m4-9-1', 'Greensleeves', 'song', 'The Tudor ballad with chords', [
        tip('Shaping a phrase', 'Four-mallet music has layers: let the melody (usually mallet 4) sing above the harmony, and keep the bass a little softer on long notes. Breathe at the end of each phrase, like a singer.'),
        piece('mal-greensleeves-chords'),
      ]),
      lesson('m4-9-2', 'Four-Mallet Sight-Reading', 'challenge', 'Fresh music in every texture', [
        grand('waltz', AM_RH, LH_AM, { key: 'Am', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, mode: 'tempo', tempo: 76, fingering: 'first' }),
        grand('broken', G_RH_HIGH, LH_G_BROKEN, { key: 'G', rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 63, fingering: 'none' }),
        rd4(T, WIDE, { rhythms: RH.dotted, maxLeap: 3, harmonic: true, dyads: { chance: 0.4, intervals: [3, 6] }, mode: 'tempo', tempo: 69, fingering: 'none' }),
      ]),
      lesson('m4-9-3', 'Encore', 'song', 'Carol and hymn, now in tempo', [
        piece('mal-silent-night', { mode: 'tempo', fingering: 'first' }),
        piece('mal-amazing-grace', { mode: 'tempo', fingering: 'first' }),
      ]),
      lesson('m4-9-c', 'Final Exam: Four Mallets', 'checkpoint', 'Prove your four-mallet reading', [
        interval(T, WIDE, [3, 4, 5, 6, 8], 12, { harmonic: true }),
        grand('waltz', AM_RH, LH_AM, { key: 'Am', time: [3, 4], rhythms: RH.waltz, maxLeap: 3, mode: 'tempo', tempo: 80, fingering: 'none' }),
        piece('mal-greensleeves-chords', { mode: 'tempo', fingering: 'first' }),
      ]),
    ], ['Repertoire', 'Phrasing', 'Four-mallet reading']),
  ],
};
