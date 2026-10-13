import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ReadOpts } from '../builders';
import type { ScaleKind } from '../../music/keys';
import type { TimeSig } from '../../music/rhythm';
import type { ActivityDef, RhythmCell, TrackDef } from '../types';

/**
 * Two mallets: reading the treble clef on marimba, xylophone, glockenspiel or
 * vibraphone. Everything stays within written G3–C6 so it fits every instrument,
 * glockenspiel included. Mallet "fingers" are the sticking engine's numbers:
 * 2 = left mallet, 3 = right mallet (shown as L / R).
 */

const T = 'treble' as const;
const R = 3;
const L = 2;

/** Sight-reading with two mallets (the sticking engine fills in L / R). */
function rd(pool: string, o: ReadOpts = {}): ActivityDef {
  const a = read(T, pool, o);
  return a.type === 'read' ? { ...a, gen: { ...a.gen, mallets: 2 } } : a;
}

/** A scale with alternating sticking, starting in the octave of Middle C. */
function sc(tonic: string, kind: ScaleKind, o: Parameters<typeof scale>[3] = {}): ActivityDef {
  const a = scale(tonic, kind, 'both', { octave: 4, ...o });
  return a.type === 'scale' ? { ...a, mallets: 2 } : a;
}

/** A fixed exercise on the treble staff. */
const etude = (title: string, key: string, time: TimeSig, voice: string, o?: Parameters<typeof inlinePiece>[4]): ActivityDef =>
  inlinePiece(title, key, time, [{ clef: T, voices: [voice] }], o);

// Pitch pools (written pitch)
const C3N = 'C4 D4 E4';
const C5N = 'C4 D4 E4 F4 G4';
const OCT = 'C4 D4 E4 F4 G4 A4 B4 C5';
const UPPER = 'G4 A4 B4 C5 D5 E5 F5 G5';
const WIDE = 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5';
const HIGH = 'C5 D5 E5 F5 G5 A5 B5 C6';
const LOW = 'G3 A3 B3 C4 D4 E4 F4 G4';
const FULL = 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6';
const CHROM = 'C4 C#4 D4 Eb4 E4 F4 F#4 G4 Ab4 A4 Bb4 B4 C5';
const G_LOW = 'D4 E4 F#4 G4 A4 B4 C5 D5';
const G_HIGH = 'G4 A4 B4 C5 D5 E5 F#5 G5';
const F_POOL = 'F4 G4 A4 Bb4 C5 D5 E5 F5';
const D_POOL = 'D4 E4 F#4 G4 A4 B4 C#5 D5';
const BB_POOL = 'Bb3 C4 D4 Eb4 F4 G4 A4 Bb4';
const AM_POOL = 'E4 F4 G#4 A4 B4 C5 D5 E5';
const EM_POOL = 'E4 F#4 G4 A4 B4 C5 D#5 E5';
const DM_POOL = 'D4 E4 F4 G4 A4 Bb4 C#5 D5';

// Rhythms
const WALTZ8: Record<RhythmCell, number> = { q: 3, 'e e': 2, h: 1, 'h.': 0.5 };

export const malletsTwo: TrackDef = {
  id: 'mallets-two',
  instrument: 'mallets',
  title: 'Two Mallets',
  subtitle: 'Mallets · Reading & sticking',
  description:
    'Read the treble clef on marimba, xylophone, glockenspiel or vibraphone — find your way around the bars, alternate your mallets, and grow from your first three notes to scales, keys, rolls and real repertoire.',
  clef: 'treble',
  accent: '#e6c07b',
  glyph: '𝄞',
  heatmap: [{ clef: 'treble', low: 'G3', high: 'C6' }],
  units: [
    // -----------------------------------------------------------------------
    unit('m2u1', 'The Mallet Keyboard', 'Find your way around the bars, hold the mallets and strike your first notes.', [
      lesson('m2-1-1', 'Meet the Bars', 'learn', 'Find C on your instrument', [
        tip('Read what you see', 'Mallet players read the same treble clef as pianists and flute players. A xylophone sounds an octave higher than written and a glockenspiel two octaves higher — but you always read and play the note exactly as it is written. Clef Coach does the rest: just choose your instrument in Settings.'),
        meet(T, 'C4', { fingers: [R], tips: ['This C sits on its own short ledger line just below the treble staff. Find a C bar (just left of two raised bars) near the middle of your instrument and strike it with your right mallet.'] }),
        tip('Every C looks the same', 'There is a C to the left of every group of two raised bars. The one on the ledger line below the staff is called Middle C; the next one up is the C in the third space of the staff.', { kind: 'keys', notes: ['C4', 'C5'], low: 'A3', high: 'E5', sticking: ['R', 'R'] }),
        play(T, 'C4', 4, { hints: true, title: 'Find Middle C' }),
      ], [
        insight('A keyboard made of bars', 'Marimba, xylophone, glockenspiel and vibraphone are laid out like a piano. The front row holds the natural notes C D E F G A B. The back row — the raised bars — holds the sharps and flats, in groups of two and three.', { kind: 'keys', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], low: 'C4', high: 'C5' }),
        insight('Find C', 'Look at the raised bars: every C sits in the front row just to the left of a group of TWO raised bars. That pattern is your map — you will find every other note from it.', { kind: 'keys', notes: ['C4'], low: 'A3', high: 'G4' }),
      ]),
      lesson('m2-1-2', 'Holding the Mallets', 'learn', 'Grip, stance and a ringing stroke', [
        tip('The grip', 'Hold each mallet between your thumb and the first joint of your index finger, about a third of the way up from the end. Wrap your other fingers loosely around the handle — no squeezing. Palms face the floor, and the two mallets make a slight V in front of you.'),
        tip('Stance', 'Stand facing the middle of the notes you are about to play, feet about shoulder-width apart, so you can sway left and right. The bars should be around waist height, with your elbows relaxed and loosely at your sides.'),
        tip('Strike the center', 'Aim for the middle of each bar — that is where the tone is fullest. Avoid the spot where the cord runs through the bar: it sounds dull. Let the mallet bounce straight back up, as if the bar were hot. Never press into it.', { kind: 'keys', notes: ['C4'], low: 'A3', high: 'F4', sticking: ['R'] }),
        meet(T, 'C4', { fingers: [L], reps: 4, tips: ['Now the left mallet. Lift it to the same height as your right one so both sound exactly alike.'] }),
        rhythm([4, 4], RH.quarters, { tempo: 60, measures: 2 }),
      ]),
      lesson('m2-1-3', 'D and E', 'learn', 'Two more notes, taking turns with your mallets', [
        meet(T, 'D4', { fingers: [L], tips: ['D hangs just below the bottom line of the staff. On the bars it sits right in the middle of the group of two raised bars, just right of C.'] }),
        meet(T, 'E4', { fingers: [R], tips: ['E sits on the bottom line of the staff — the bar just right of D.'] }),
        name(T, C3N, 8),
        play(T, C3N, 8, { hints: true }),
      ], [
        insight('Right, left, right', 'Most of the time your hands take turns, like walking: right, left, right, left. Start with the right mallet. The letters above the notes show the sticking: R = right, L = left.', { kind: 'keys', notes: ['C4', 'D4', 'E4'], low: 'A3', high: 'G4', sticking: ['R', 'L', 'R'] }),
      ]),
      lesson('m2-1-4', 'Your First Melody', 'practice', 'Read C, D and E with alternating mallets', [
        rd(C3N, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true, title: 'Your first melody' }),
        rd(C3N, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
        piece('mal-hot-cross-buns'),
      ]),
      lesson('m2-1-c', 'Checkpoint: The Mallet Keyboard', 'checkpoint', 'Name and play C, D and E', [
        name(T, C3N, 10),
        play(T, C3N, 8),
        rd(C3N, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['Bars & rows', 'Grip & stroke', 'C D E']),

    // -----------------------------------------------------------------------
    unit('m2u2', 'Treble Clef: C to C', 'Every note from Middle C up to the C an octave higher, with alternating mallets.', [
      lesson('m2-2-1', 'F and G', 'learn', 'F in the first space, G on the second line', [
        meet(T, 'F4 G4', { fingers: [L, R], tips: ['F lives in the first space of the staff. On the bars it is just left of the group of THREE raised bars.', 'G sits on the second line — the line the treble clef curls around.'] }),
        name(T, C5N, 10),
        play(T, C5N, 10, { hints: true }),
      ], [
        insight('Lines and spaces', 'E and G sit ON lines; D and F sit IN spaces. Seeing line-or-space at a glance is the secret of fast reading.', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F4', 'G4'], labels: true }),
      ]),
      lesson('m2-2-2', 'Alternate!', 'learn', 'Hand-to-hand sticking, leading with the right', [
        tip('Alternate sticking', 'Alternating hands keeps every note even: one mallet lifts while the other strikes. Lead with the right hand at the start of a phrase and after long notes. When the line steps down, your mallets cross a tiny bit — that is perfectly normal.', { kind: 'staff+keys', clef: 'treble', notes: ['C4', 'D4', 'E4', 'F4', 'G4'], sticking: ['R', 'L', 'R', 'L', 'R'] }),
        rd(C5N, { rhythms: RH.quarters, maxLeap: 1, noteNames: true }),
        rd(C5N, { rhythms: RH.qh, maxLeap: 1 }),
        piece('mal-mary-had-a-little-lamb'),
      ]),
      lesson('m2-2-3', 'A, B and High C', 'learn', 'Complete the octave', [
        meet(T, 'A4 B4 C5', { fingers: [R, L, R], tips: ['A is in the second space.', 'B sits on the middle line of the staff — a great landmark.', 'This C is in the third space, one octave above Middle C. Same spot on the bars: just left of two raised bars.'] }),
        name(T, OCT, 12),
        play(T, OCT, 10, { hints: true }),
      ]),
      lesson('m2-2-4', 'Steps and Skips', 'practice', 'See the distance from one note to the next', [
        tip('Steps and skips', 'Line to the next space is a step — the next bar. Line to line (or space to space) is a skip — you jump over one bar. Good readers see the distance instead of naming every note.', { kind: 'staff', clef: 'treble', notes: ['C4', 'D4', 'E4', 'C4', 'E4', 'G4'], labels: true }),
        interval(T, OCT, [2, 3], 10),
        rd(OCT, { rhythms: RH.qh, maxLeap: 2 }),
        piece('mal-ode-to-joy'),
      ]),
      lesson('m2-2-c', 'Checkpoint: C to C', 'checkpoint', 'Read the whole octave with alternating sticking', [
        name(T, OCT, 14, { sequence: true }),
        rd(OCT, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
        rd(C5N, { rhythms: RH.qh, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['F G A B C', 'Alternate sticking', 'Steps & skips']),

    // -----------------------------------------------------------------------
    unit('m2u3', 'Steady Rhythm', 'Quarter, half and whole notes and rests — counted while the mallets keep moving.', [
      lesson('m2-3-1', 'Counting Time', 'learn', 'Quarter, half and whole notes in 4/4', [
        tip('Note values', 'In 4/4 time there are four beats in every bar. A quarter note gets 1 beat, a half note 2 and a whole note 4. Count “1 2 3 4” steadily — out loud at first.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'D4/q', 'E4/h', 'G4/w'], time: [4, 4] }),
        tip('Long notes on short bars', 'A wooden bar rings only for a moment, so a half or whole note fades long before its beats are over. Strike it once and keep counting through the silence — later you will learn to roll long notes.'),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        rd(C5N, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('m2-3-2', 'Silence Counts', 'learn', 'Quarter and half rests', [
        tip('Rests', 'A rest is a beat of silence that still gets counted. Use it to lift your mallets and look ahead. After a rest, start again with your right hand.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'r/q', 'E4/q', 'r/q', 'G4/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        rd(C5N, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('m2-3-3', 'Twinkle', 'song', 'Pairs of notes, right then left', [
        piece('mal-twinkle-twinkle'),
        rd(OCT, { rhythms: RH.qhw, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('m2-3-c', 'Checkpoint: Steady Rhythm', 'checkpoint', 'Keep steady time while reading', [
        rhythm([4, 4], RH.rests, { tempo: 76, reps: 1 }),
        rd(OCT, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 72, fingering: 'first' }),
        rd(OCT, { rhythms: RH.qhw, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['4/4', 'Rests', 'Steady pulse']),

    // -----------------------------------------------------------------------
    unit('m2u4', 'Leaps & Double Sticking', 'Up to the top of the staff, and how to jump without crossing your arms.', [
      lesson('m2-4-1', 'The Top of the Staff', 'learn', 'D, E, F and G above treble C', [
        meet(T, 'D5 E5 F5 G5', { fingers: [L, R, L, R], tips: ['D sits on the fourth line.', 'E is in the top space.', 'F is the top line of the staff.', 'G hangs just above the staff — an octave above the G on the second line.'] }),
        name(T, UPPER, 12),
        rd(UPPER, { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m2-4-2', 'Don’t Cross Your Arms', 'learn', 'Double sticking for leaps', [
        tip('Left mallet low, right mallet high', 'Small crossings on steps are fine, but when the music leaps, plain alternating can send one arm right over the other. Then use the same mallet twice in a row — a double sticking — so the left mallet stays on the lower note and the right mallet on the higher one.', { kind: 'staff+keys', clef: 'treble', notes: ['G4', 'C4', 'D4', 'G4'], sticking: ['R', 'L', 'L', 'R'] }),
        etude('Leap Frog', 'C', [4, 4], 'G4/q@R C4@L D4@L G4@R | A4@R C4@L E4@L A4@R | F4@R C4@L D4@L F4@R | E4/w@L | C5/q@R E4@L F4@L C5@R | B4@R D4@L G4@L B4@R | C5@R E4@L G4@R E4@L | C5/w@R |', { prompt: 'Follow the sticking: the left mallet plays twice whenever the line jumps back up.' }),
        rd(OCT, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.6 }),
      ]),
      lesson('m2-4-3', 'Seeing Intervals', 'practice', 'Thirds, fourths and fifths at a glance', [
        tip('Measure the jump', 'A 3rd skips one bar, a 4th skips two, a 5th skips three. On the staff, a 3rd is line-to-line, a 5th is line-to-line-to-line. Knowing the distance lets your mallet travel before you have named the note.', { kind: 'staff', clef: 'treble', notes: ['C4', 'E4', 'C4', 'F4', 'C4', 'G4'] }),
        interval(T, WIDE, [3, 4, 5], 10),
        rd(WIDE, { rhythms: RH.qhw, maxLeap: 4, leapiness: 0.6, fingering: 'first' }),
      ]),
      lesson('m2-4-4', 'Songs with Leaps', 'song', 'Jingle Bells and When the Saints', [
        piece('mal-jingle-bells'),
        piece('mal-when-the-saints'),
      ]),
      lesson('m2-4-c', 'Checkpoint: Leaps', 'checkpoint', 'Leap cleanly without crossing', [
        interval(T, WIDE, [2, 3, 4, 5, 6], 10),
        rd(WIDE, { rhythms: RH.qh, maxLeap: 4, leapiness: 0.5, fingering: 'first' }),
        rd(OCT, { rhythms: RH.rests, maxLeap: 4, leapiness: 0.5, mode: 'tempo', tempo: 69, fingering: 'first' }),
      ]),
    ], ['D E F G', 'Double sticking', 'Intervals']),

    // -----------------------------------------------------------------------
    unit('m2u5', 'Eighth Notes', 'Two notes to a beat: hand-to-hand eighths, pickups and ties.', [
      lesson('m2-5-1', 'Two per Beat', 'learn', 'Eighth notes and the “&”', [
        tip('Eighth notes', 'An eighth note is half a beat; pairs are joined by a beam. Count “1 & 2 & 3 & 4 &”. Eighths are where alternating pays off: right hand on the numbers, left hand on the “&”s, like a drummer.', { kind: 'staff+keys', clef: 'treble', notes: ['C4/e', 'D4/e', 'E4/e', 'F4/e', 'G4/q'], sticking: ['R', 'L', 'R', 'L', 'R'] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        rd(C5N, { rhythms: RH.eighths, maxLeap: 1 }),
      ]),
      lesson('m2-5-2', 'Eighths Everywhere', 'practice', 'Eighth notes across the octave', [
        rd(OCT, { rhythms: RH.eighths, maxLeap: 2 }),
        rd(OCT, { rhythms: RH.eighthsRests, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
        piece('mal-frere-jacques'),
      ]),
      lesson('m2-5-3', 'Pickups and Ties', 'learn', 'Music that starts before beat one', [
        tip('Pickups and ties', 'A pickup is a short first bar that leads into beat one: count the missing beats silently, then come in. A tie joins two notes of the same pitch — strike once and hold for both. Read the sticking over a pickup: it sets your hands up for the first full bar.', { kind: 'staff', clef: 'treble', notes: ['C4/e', 'D4/e', 'E4/q', 'G4/h'], time: [2, 4] }),
        piece('mal-oh-susanna'),
        rd(WIDE, { rhythms: RH.eighthsRests, maxLeap: 3 }),
      ]),
      lesson('m2-5-c', 'Checkpoint: Eighths', 'checkpoint', 'Read eighth-note melodies in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        rd(OCT, { rhythms: RH.eighths, maxLeap: 3, mode: 'tempo', tempo: 69, fingering: 'first' }),
        rd(WIDE, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Eighth notes', 'Pickups', 'Ties']),

    // -----------------------------------------------------------------------
    unit('m2u6', 'Scales: C, G and F', 'One octave up and down with smooth alternate sticking — and your first key signatures.', [
      lesson('m2-6-1', 'The C Major Scale', 'learn', 'Eight notes up, eight notes down', [
        tip('Scales with two mallets', 'Play scales hand to hand — R L R L — all the way up and back down. Keep both mallets at the same height and the strokes evenly spaced, so the scale sounds like a string of pearls.', { kind: 'keys', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], sticking: ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'] }),
        sc('C', 'major'),
        sc('C', 'major', { mode: 'tempo', tempo: 72 }),
      ]),
      lesson('m2-6-2', 'G Major and F♯', 'learn', 'Your first raised bar', [
        tip('F sharp', 'A sharp (♯) raises a note to the very next bar on the right. F♯ is the raised bar just right of F. Strike raised bars in the middle — or near their front edge when you have to move fast.', { kind: 'keys', notes: ['F4', 'F#4', 'G4'], low: 'C4', high: 'C5' }),
        meet(T, 'F#4', { fingers: [L], tips: ['In G major every F is F♯. The single sharp on the top line of the key signature reminds you — in every octave.'] }),
        keysig(T, 'C G', 6),
        sc('G', 'major'),
        rd(G_LOW, { key: 'G', rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('m2-6-3', 'F Major and B♭', 'learn', 'One flat: B♭', [
        tip('B flat', 'A flat (♭) lowers a note to the next bar on the left. B♭ is the raised bar just left of B. In F major the key signature has one flat, on the middle line: every B is B♭.', { kind: 'keys', notes: ['A4', 'Bb4', 'B4'], low: 'F4', high: 'C5' }),
        meet(T, 'Bb4', { fingers: [R], tips: ['B♭ sits on the middle line with a flat in front of it (or in the key signature).'] }),
        keysig(T, 'C G F', 8),
        sc('F', 'major'),
        rd(F_POOL, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m2-6-4', 'Songs in G and F', 'song', 'Aura Lee and a walk in F', [
        piece('mal-aura-lee'),
        etude('Walking in F', 'F', [4, 4], 'F4/q G4 A4 Bb4 | C5/h A4 | Bb4/q A4 G4 F4 | G4/w | A4/q Bb4 C5 D5 | C5/h A4 | G4/q A4 G4 E4 | F4/w |'),
      ]),
      lesson('m2-6-c', 'Checkpoint: Scales', 'checkpoint', 'Scales and key signatures in time', [
        keysig(T, 'C G F', 6),
        sc('G', 'major', { mode: 'tempo', tempo: 80, fingering: 'first' }),
        rd(F_POOL, { key: 'F', rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['C G F major', 'Key signatures', 'F♯ & B♭']),

    // -----------------------------------------------------------------------
    unit('m2u7', 'Accidentals & New Keys', 'Sharps and flats in the middle of the music, and the keys of D and B♭ major.', [
      lesson('m2-7-1', 'The Raised Bars', 'learn', 'Every sharp and flat', [
        tip('Two names, one bar', 'Every raised bar has two names: the bar between C and D is both C♯ and D♭. A sharp or flat written in front of a note (an accidental) lasts until the bar line; a natural sign (♮) cancels it.', { kind: 'keys', notes: ['C#4', 'D#4', 'F#4', 'G#4', 'A#4'], low: 'C4', high: 'C5' }),
        name(T, CHROM, 14, { answers: 'accidentals' }),
        play(T, CHROM, 12, { hints: true }),
      ]),
      lesson('m2-7-2', 'D Major', 'learn', 'Two sharps: F♯ and C♯', [
        tip('D major', 'D major has two sharps, F♯ and C♯. C♯ is the raised bar just right of C. Sharps always appear in the same order: F, C, G, D…', { kind: 'staff', clef: 'treble', notes: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'], key: 'D' }),
        keysig(T, 'C G D F', 8),
        sc('D', 'major'),
        rd(D_POOL, { key: 'D', rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('m2-7-3', 'B♭ Major', 'learn', 'Two flats: B♭ and E♭', [
        tip('B♭ major', 'B♭ major has two flats, B♭ and E♭ — the raised bars just left of B and of E. Its scale starts on the B♭ just below Middle C.', { kind: 'staff', clef: 'treble', notes: ['Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4'], key: 'Bb' }),
        keysig(T, 'F Bb D', 6),
        sc('Bb', 'major', { octave: 3 }),
        rd(BB_POOL, { key: 'Bb', rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m2-7-4', 'Sneaky Steps', 'practice', 'Accidentals that come and go', [
        etude('Sneaky Steps', 'C', [4, 4], 'C4/q C#4 D4/h | D4/q D#4 E4/h | F4/q F#4 G4/h | G4/q G#4 A4/h | A4/q Bb4 B4 C5 | C5/q B4 Bb4 A4 | Ab4/q G4 F#4 F4 | E4/q Eb4 D4 Db4 | C4/w |', { prompt: 'Each accidental lasts to the bar line. Watch for the natural signs coming back down.' }),
        rd('C4 D4 E4 F4 F#4 G4 A4 Bb4 B4 C5', { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m2-7-c', 'Checkpoint: Keys & Accidentals', 'checkpoint', 'Read in D and B♭ major', [
        keysig(T, 'C G D F Bb', 8),
        rd(D_POOL, { key: 'D', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        rd(BB_POOL, { key: 'Bb', rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
        name(T, CHROM, 10, { answers: 'accidentals' }),
      ]),
    ], ['Accidentals', 'D major', 'B♭ major']),

    // -----------------------------------------------------------------------
    unit('m2u8', 'Arpeggios & Thirds', 'Broken chords and skips: reading in chord shapes.', [
      lesson('m2-8-1', 'Broken Chords', 'learn', 'Arpeggios up and down', [
        tip('Arpeggios', 'An arpeggio plays a chord one note at a time: C–E–G–C. On the staff the notes stack line–line–line (or space–space–space). Going up, start with the left mallet on the lowest note and alternate — L R L R — letting the small crossings happen.', { kind: 'staff+keys', clef: 'treble', notes: ['C4', 'E4', 'G4', 'C5'], sticking: ['L', 'R', 'L', 'R'] }),
        etude('Arpeggio Study', 'C', [4, 4], 'C4/q E4 G4 C5 | G4 E4 C4/h | F4/q A4 C5 F5 | C5 A4 F4/h | G4/q B4 D5 G5 | D5 B4 G4/h | C4/q E4 G4 C5 | C5/w |'),
        rd(OCT, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.6, harmonic: true }),
      ]),
      lesson('m2-8-2', 'Thirds', 'practice', 'Skipping up and down the scale', [
        tip('Scales in thirds', 'C–E, D–F, E–G… thirds are a classic mallet warm-up. Going up, play the lower note with the left mallet and the upper note with the right: L R L R. Coming down, the upper note comes first: R L R L.', { kind: 'staff+keys', clef: 'treble', notes: ['C4', 'E4', 'D4', 'F4', 'E4', 'G4', 'F4', 'A4'], sticking: ['L', 'R', 'L', 'R', 'L', 'R', 'L', 'R'] }),
        etude('Thirds Warm-up', 'C', [4, 4], 'C4/e@L E4@R D4@L F4@R E4@L G4@R F4@L A4@R | G4@L B4@R A4@L C5@R B4@L D5@R C5/q@R | C5/e@R A4@L B4@R G4@L A4@R F4@L G4@R E4@L | F4@R D4@L E4@R C4@L D4/q@R C4@L |'),
        rd(WIDE, { rhythms: RH.eighths, maxLeap: 2, harmonic: true, fingering: 'first' }),
      ]),
      lesson('m2-8-3', 'Fanfare', 'song', 'An arpeggio fanfare', [
        etude('Fanfare', 'C', [4, 4], 'C4/e E4 G4 C5 E5/q C5 | G4/e C5 E5 G5 E5/h | F4/e A4 C5 F5 C5/q A4 | G4/e B4 D5 G5 D5/h | C5/e G4 E4 G4 C5/q E5 | D5/e B4 G4 B4 D5/q F5 | E5/q C5 D5 B4 | C5/w |', { prompt: 'Bright and proud — let the top notes ring.' }),
        rd(G_HIGH, { key: 'G', rhythms: RH.eighths, maxLeap: 4, leapiness: 0.6, harmonic: true }),
      ]),
      lesson('m2-8-c', 'Checkpoint: Arpeggios', 'checkpoint', 'Read in chord shapes', [
        interval(T, WIDE, [3, 5, 6, 8], 10),
        rd(WIDE, { rhythms: RH.eighths, maxLeap: 4, leapiness: 0.6, harmonic: true, fingering: 'first' }),
        rd(G_HIGH, { key: 'G', rhythms: RH.qh, maxLeap: 4, harmonic: true, fingering: 'none' }),
      ]),
    ], ['Arpeggios', 'Thirds', 'Chord shapes']),

    // -----------------------------------------------------------------------
    unit('m2u9', 'Rolls & Dance Time', 'Make long notes sing with a roll, then feel 3/4 and 6/8.', [
      lesson('m2-9-1', 'The Roll', 'learn', 'Single-stroke rolls on long notes', [
        tip('Why roll?', 'Wooden bars ring only briefly, so mallet players make long notes sing with a roll: fast, even, alternating strokes on the same bar — R L R L — for the whole length of the note. A good roll sounds like one long note, not a gallop.', { kind: 'staff', clef: 'treble', notes: ['C5/h', 'C5/s', 'C5/s', 'C5/s', 'C5/s', 'C5/s', 'C5/s', 'C5/s', 'C5/s'], time: [4, 4] }),
        tip('How to practise it', 'Start with measured strokes — two per beat, then four — keeping both mallets low and relaxed, then speed up until the strokes blur into one sound. In music, a roll is marked with three slashes through the note’s stem. On metal bars (glockenspiel, vibraphone) long notes ring by themselves, so you roll much less.'),
        tip('Rolls in Clef Coach', 'The app listens for one stroke per note and can’t grade a roll yet — extra strokes would count as wrong notes. In lessons, strike each long note once and let it ring. Then practise rolling the long notes of songs like Aura Lee on your own.'),
        rhythm([4, 4], { 's s s s': 2, 'e e': 1, h: 1 }, { tempo: 56, reps: 1 }),
      ]),
      lesson('m2-9-2', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats — the dot adds half the note’s value again. It is a perfect note to roll.', { kind: 'staff', clef: 'treble', notes: ['C4/q', 'E4/q', 'G4/q', 'E4/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        rd(OCT, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
      ]),
      lesson('m2-9-3', 'Six-Eight Time', 'learn', 'Two big swings of three', [
        tip('6/8 time', '6/8 has six eighth notes per bar, grouped in two sets of three: “ONE two three FOUR five six”. Feel two big beats — it rocks like a boat.', { kind: 'staff', clef: 'treble', notes: ['C5/q', 'A4/e', 'G4/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        rd(OCT, { time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
        piece('mal-row-your-boat'),
      ]),
      lesson('m2-9-4', 'Minuet in G', 'song', 'A Baroque dance in 3/4', [
        piece('mal-minuet-in-g'),
        rd(G_HIGH, { key: 'G', time: [3, 4], rhythms: WALTZ8, maxLeap: 3 }),
      ]),
      lesson('m2-9-c', 'Checkpoint: Dance Time', 'checkpoint', 'Read in 3/4 and 6/8', [
        rhythm([3, 4], RH.waltz, { tempo: 88, reps: 1 }),
        rd(OCT, { time: [3, 4], rhythms: WALTZ8, maxLeap: 3, mode: 'tempo', tempo: 84, fingering: 'first' }),
        rd(OCT, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Single-stroke roll', '3/4', '6/8']),

    // -----------------------------------------------------------------------
    unit('m2u10', 'Ledger Lines', 'Up to high C and down to low G — the whole range of a glockenspiel.', [
      lesson('m2-10-1', 'Above the Staff', 'learn', 'A, B and C on ledger lines', [
        tip('Ledger lines', 'Ledger lines extend the staff. Count them like extra staff lines: A sits on the first ledger line above the staff, C on the second.', { kind: 'staff', clef: 'treble', notes: ['G5', 'A5', 'B5', 'C6'], labels: true }),
        meet(T, 'A5 B5 C6', { fingers: [R, L, R] }),
        name(T, 'F5 G5 A5 B5 C6', 12),
      ]),
      lesson('m2-10-2', 'High Melodies', 'practice', 'Reading in the upper register', [
        rd(HIGH, { rhythms: RH.eighths, maxLeap: 2 }),
        piece('mal-can-can'),
      ]),
      lesson('m2-10-3', 'Below Middle C', 'learn', 'B, A and G under the staff', [
        tip('Under the staff', 'Below Middle C the ledger lines continue downward: B hangs just under Middle C’s line, A sits on the second ledger line, G hangs below it.', { kind: 'staff', clef: 'treble', notes: ['C4', 'B3', 'A3', 'G3'], labels: true }),
        meet(T, 'B3 A3 G3', { fingers: [L, R, L] }),
        rd(LOW, { rhythms: RH.qh, maxLeap: 2 }),
      ]),
      lesson('m2-10-4', 'The Full Range', 'practice', 'From low G to high C', [
        name(T, FULL, 20, { sequence: true, title: 'Note rush' }),
        play(T, FULL, 14),
        sc('C', 'major', { octaves: 2, rhythm: 'e' }),
      ]),
      lesson('m2-10-c', 'Checkpoint: Ledger Lines', 'checkpoint', 'Fluent across the whole range', [
        name(T, FULL, 20, { sequence: true }),
        rd(HIGH, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        rd(LOW, { rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Ledger lines', 'G3–C6', 'Two-octave scale']),

    // -----------------------------------------------------------------------
    unit('m2u11', 'Minor Keys', 'A, E and D minor: darker colours and the raised leading note.', [
      lesson('m2-11-1', 'A Minor', 'learn', 'The relative minor of C', [
        tip('Relative minor', 'A minor shares C major’s key signature — no sharps or flats — but centres on A, which makes it sound darker. In the harmonic minor, G is raised to G♯: a raised bar that pulls strongly back up to A.', { kind: 'staff', clef: 'treble', notes: ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5'], labels: true }),
        sc('A', 'natural-minor'),
        sc('A', 'harmonic-minor'),
        rd(AM_POOL, { key: 'Am', rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('m2-11-2', 'E Minor & D Minor', 'practice', 'Two more minor keys and the dotted quarter', [
        tip('The dotted quarter', 'A dotted quarter lasts 1½ beats, so it is usually followed by an eighth: “1 – & 2”. Keep alternating: the eighth often falls to the other hand.', { kind: 'staff', clef: 'treble', notes: ['E4/q.', 'F#4/e', 'G4/h'], time: [4, 4] }),
        keysig(T, 'C G F Am Em Dm', 8),
        sc('E', 'harmonic-minor'),
        sc('D', 'harmonic-minor'),
        rd(DM_POOL, { key: 'Dm', rhythms: RH.dotted, maxLeap: 3 }),
      ]),
      lesson('m2-11-3', 'Minor Melodies', 'song', 'Greensleeves and the Mountain King', [
        piece('mal-greensleeves'),
        piece('mal-mountain-king'),
      ]),
      lesson('m2-11-c', 'Checkpoint: Minor Keys', 'checkpoint', 'Dotted rhythms in minor keys', [
        keysig(T, 'Am Em Dm G F D Bb', 8),
        rd(EM_POOL, { key: 'Em', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
        rd(AM_POOL, { key: 'Am', rhythms: RH.eighthsRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'none' }),
      ]),
    ], ['A E D minor', 'Harmonic minor', 'Dotted quarter']),

    // -----------------------------------------------------------------------
    unit('m2u12', 'Double Stops & Finale', 'Two notes at once — left mallet below, right mallet above — and a sight-reading finale.', [
      lesson('m2-12-1', 'Two Notes at Once', 'learn', 'Double stops in thirds', [
        tip('Double stops', 'Strike two bars at exactly the same moment: the left mallet always takes the lower note and the right mallet the upper one. Lift both mallets to the same height so the notes sound together — one sound, not a “flam”.', { kind: 'staff+keys', clef: 'treble', notes: ['[C4 E4]'], sticking: ['L', 'R'] }),
        interval(T, OCT, [3, 5, 6, 8], 10, { harmonic: true }),
        rd(OCT, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.4, intervals: [3] } }),
      ]),
      lesson('m2-12-2', 'Thirds and Sixths', 'practice', 'Chiming double stops', [
        etude('Chiming Thirds', 'C', [4, 4], '[C4 E4]/q [D4 F4] [E4 G4] [F4 A4] | [G4 B4]/h [E4 G4] | [F4 A4]/q [E4 G4] [D4 F4] [E4 G4] | [C4 E4]/w | [E4 C5]/q [F4 D5] [G4 E5] [E4 C5] | [F4 D5]/h [D4 B4] | [E4 C5]/q [D4 B4] [B3 G4] [D4 B4] | [E4 C5]/w |', { prompt: 'Thirds first, then sixths: left mallet on the lower note every time.' }),
        rd(WIDE, { rhythms: RH.qh, maxLeap: 2, harmonic: true, dyads: { chance: 0.5, intervals: [3, 6] }, fingering: 'first' }),
      ]),
      lesson('m2-12-3', 'Sight-Reading Challenge', 'challenge', 'Fresh music, first time, in tempo', [
        name(T, FULL, 24, { sequence: true, title: 'Lightning round' }),
        rd(WIDE, { rhythms: RH.dottedRests, maxLeap: 4, leapiness: 0.5, harmonic: true, mode: 'tempo', tempo: 80, fingering: 'none' }),
        rd(D_POOL, { key: 'D', rhythms: RH.eighths, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 76, fingering: 'none' }),
        rd(HIGH, { rhythms: RH.eighthsRests, maxLeap: 3, mode: 'tempo', tempo: 76, fingering: 'none' }),
      ]),
      lesson('m2-12-4', 'Showpieces', 'song', 'Ragtime and the circus', [
        tip('Syncopation and sixteenths', 'Syncopation puts a note between the beats: in The Entertainer the C lands on the “&” and rings across the next beat. Keep counting “1 & 2 &” and let the note ride. Sixteenth notes go four to a beat — keep them strictly alternating.', { kind: 'staff', clef: 'treble', notes: ['E4/e', 'C5/q', 'E4/e', 'C5/h'], time: [4, 4] }),
        piece('mal-entertainer'),
        piece('mal-big-top-galop'),
      ]),
      lesson('m2-12-c', 'Final Exam: Two Mallets', 'checkpoint', 'Prove your two-mallet reading', [
        keysig(T, 'C G D F Bb Am Em Dm', 8),
        rd(FULL, { rhythms: RH.dottedRests, maxLeap: 5, leapiness: 0.5, harmonic: true, mode: 'tempo', tempo: 76, fingering: 'none', measures: 6 }),
        rd(WIDE, { rhythms: RH.qh, maxLeap: 3, harmonic: true, dyads: { chance: 0.4, intervals: [3, 6] }, fingering: 'none' }),
      ]),
    ], ['Double stops', 'Sight-reading', 'Repertoire']),
  ],
};
