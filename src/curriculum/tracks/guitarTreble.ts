import { RH, inlinePiece, insight, interval, keysig, lesson, meet, name, piece, play, read, rhythm, scale, tip, unit } from '../builders';
import type { ActivityDef, FingeringMode, TrackDef } from '../types';
import type { TimeSig } from '../../music/rhythm';

/**
 * Guitar · Treble clef (standard guitar notation, written an octave above sounding pitch).
 * All pitches below are SOUNDING pitches: open high E = E4, low E = E2.
 */
const G = 'treble8vb' as const;

/** A fretboard location for `meet`: string (1 = high E), fret, left-hand finger (0 = open). */
const at = (string: number, fret: number, finger: number) => ({ string, fret, finger });

// ---- First-position pitch pools (sounding) ----
const S1 = 'E4 F4 G4';
const S2 = 'B3 C4 D4';
const S12 = 'B3 C4 D4 E4 F4 G4';
const S123 = 'G3 A3 B3 C4 D4 E4 F4 G4';
const S1234 = 'D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4';
const S5UP = 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4';
const LOW = 'E2 F2 G2 A2 B2 C3 D3 E3';
const POS1 = 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4';
const POS1_G = 'E2 F#2 G2 A2 B2 C3 D3 E3 F#3 G3 A3 B3 C4 D4 E4 F#4 G4';
const POS1_D = 'D3 E3 F#3 G3 A3 B3 C#4 D4 E4 F#4 G4';
const POS1_EM = 'E2 F#2 G2 A2 B2 C3 D3 E3 F#3 G3 A3 B3';
const POS1_AM = 'A2 B2 C3 D3 E3 F3 G#3 A3 B3 C4 D4 E4';
const POS1_F = 'F2 G2 A2 Bb2 C3 D3 E3 F3 G3 A3 Bb3 C4 D4 E4 F4';
const CHROMATIC = 'E3 F3 F#3 G3 G#3 A3 Bb3 B3 C4 C#4 D4 Eb4 E4 F4 F#4 G4';
// ---- Higher positions ----
// B3 is left out of generated 5th-position reading: it sits on a stretch (3rd string, 4th fret).
const POS5 = 'A2 B2 C3 D3 E3 F3 G3 A3 C4 D4 E4 F4 G4 A4 B4 C5';
const POS5_HI = 'G3 A3 C4 D4 E4 F4 G4 A4 B4 C5';
const POS7 = 'B2 C3 D3 E3 F#3 G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5';
// G4 is left out of 9th-position D major: its second location (2nd string, 8th fret) pulls the hand down a fret.
const POS9 = 'D3 E3 F#3 G3 A3 B3 C#4 D4 E4 F#4 A4 B4 C#5 D5 E5';
const POS9_A = 'E3 F#3 G#3 A3 B3 C#4 D4 E4 F#4 G#4 A4 B4 C#5 D5 E5';
const POS12 = 'E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5';
const TOP = 'G4 A4 B4 C5 D5 E5 F5 G5 A5';
const TOP12 = 'G4 A4 B4 C5 D5 E5 F5 G5';
const FULL = 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5';

// ---- Inline notation helpers ----
function gpiece(title: string, key: string, time: TimeSig, voices: string[], o: { mode?: 'wait' | 'tempo'; tempo?: number; fingering?: FingeringMode; prompt?: string } = {}): ActivityDef {
  return inlinePiece(title, key, time, [{ clef: G, voices }], o);
}

/** Insert a duration into a token: "A2@0%5" → "A2/e@0%5". */
const withDur = (tok: string, d: string) => tok.replace(/^(\[[^\]]*\]|[A-G][#b]?\d)/, `$1/${d}`);

/** One bar of a right-hand arpeggio. `chord` = tokens with fingering (p, i, m, a order); `pattern` indexes into it. */
const arp = (chord: string[], pattern: number[], d: string) => pattern.map((i, k) => (k === 0 ? withDur(chord[i], d) : chord[i])).join(' ');
const bars = (...b: string[]) => b.join(' | ') + ' |';

// Open chords as p-i-m-a tokens (bass on p, then strings 3-2-1), with the chord's real fingering.
const AM = ['A2@0%5', 'A3@3%3', 'C4@1%2', 'E4@0%1'];
const DM = ['D3@0%4', 'A3@2%3', 'D4@3%2', 'F4@1%1'];
const EMAJ = ['E2@0%6', 'G#3@1%3', 'B3@0%2', 'E4@0%1'];
const CMAJ = ['C3@3%5', 'G3@0%3', 'C4@1%2', 'E4@0%1'];
const FMAJ7 = ['F3@3%4', 'A3@2%3', 'C4@1%2', 'E4@0%1'];
const G7 = ['G2@3%6', 'G3@0%3', 'B3@0%2', 'F4@1%1'];
const DMAJ = ['D3@0%4', 'A3@1%3', 'D4@3%2', 'F#4@2%1'];
const PIMA = [0, 1, 2, 3, 2, 1, 2, 3]; // p i m a m i m a (4/4 eighths)
const PIMA68 = [0, 1, 2, 3, 2, 1]; // p i m a m i (6/8)
const PIM3 = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1]; // triplets in 4/4
const AM_CHORD = '[A2 E3 A3 C4 E4]@0,2,3,1,0%5,4,3,2,1';
const C_CHORD = '[C3 E3 G3 C4 E4]@3,2,0,1,0%5,4,3,2,1';

/** The opening of Ode to Joy, mapped onto any fingering of E F G D C. */
const ODE = 'E E F G | G F E D | C C D E | E/q. D/e D/h | E/q E F G | G F E D | C C D E | D/q. C/e C/h';
function ode(map: Record<string, string>): string {
  return ODE.split(/\s+/)
    .map(t => (t === '|' ? '|' : t.length > 1 ? withDur(map[t[0]], t.slice(2)) : map[t]))
    .join(' ') + ' |';
}

// ---- Fixed tunes and études ----
const MARY = 'E4/q D4 C4 D4 | E4 E4 E4/h | D4/q D4 D4/h | E4/q G4 G4/h | E4/q D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4/w |';
const LIGHTLY_ROW = 'G4/q E4 E4/h | F4/q D4 D4/h | C4/q D4 E4 F4 | G4 G4 G4/h | G4/q E4 E4/h | F4/q D4 D4/h | C4/q E4 G4 G4 | C4/w |';
const TWO_STRING_WALTZ = 'C4/q E4 G4 | F4/h D4/q | E4/q G4 E4 | D4/h. | C4/q D4 E4 | F4/h G4/q | E4/q D4 B3 | C4/h. |';
const AU_CLAIR = 'C4/q C4 C4 D4 | E4/h D4 | C4/q E4 D4 D4 | C4/w | C4/q C4 C4 D4 | E4/h D4 | C4/q E4 D4 D4 | C4/w | D4/q D4 D4 D4 | A3/h A3 | D4/q C4 B3 A3 | G3/w | C4/q C4 C4 D4 | E4/h D4 | C4/q E4 D4 D4 | C4/w |';
const TWINKLE = 'G3/q G3 D4 D4 | E4 E4 D4/h | C4/q C4 B3 B3 | A3 A3 G3/h | D4/q D4 C4 C4 | B3 B3 A3/h | D4/q D4 C4 C4 | B3 B3 A3/h | G3/q G3 D4 D4 | E4 E4 D4/h | C4/q C4 B3 B3 | A3 A3 G3/h |';
const LITTLE_MINUET = 'D3/q F3 A3 | G3/h F3/q | E3/q G3 B3 | A3/h. | D4/q C4 B3 | A3 G3 F3 | E3/q F3 E3 | D3/h. |';
const WALKING_DOWN = 'C4/q B3 A3 G3 | F3 E3 D3 C3 | D3 E3 F3 G3 | A3/h G3/h | C4/q B3 A3 G3 | F3 E3 D3 C3 | B2 D3 G3 B2 | C3/w |';
const SIX_STRINGS = 'C3/q E3 G3 | C4/h G3/q | F3/q A3 C4 | F4/h C4/q | G2/q B2 D3 | G3/h B3/q | C4/q D4 E4 | G4/h. | F4/q E4 D4 | C4 B3 A3 | G3 F3 E3 | D3/h G2/q | C3/q E3 G3 | C4/h. |';
const ALLEGRETTO = 'C4/e D4 E4 F4 G4/q G4 | A3/e B3 C4 D4 E4/q E4 | F4/e E4 D4 C4 B3/q G3 | C4/e E4 D4 B3 C4/h | E4/e F4 G4 E4 F4/q D4 | D4/e E4 F4 D4 E4/q C4 | G3/e A3 B3 C4 D4/q B3 | C4/w |';
const TIES = 'G3/q C4 E4 G4~ | G4/q E4 C4 E4 | D4/h F4/h~ | F4/q D4 B3 G3 | C4/q E4 G4 E4~ | E4/q C4 D4 B3 | C4/w |';
const CHROMATIC_WALK = 'G3/e@0%3 G#3@1%3 A3@2%3 A#3@3%3 B3@0%2 C4@1%2 C#4@2%2 D4@3%2 | D#4/e@4%2 E4@0%1 F4@1%1 F#4@2%1 G4/h@3%1 | F#4/e@2%1 F4@1%1 E4@0%1 Eb4@4%2 D4@3%2 Db4@2%2 C4@1%2 B3@0%2 | Bb3/e@3%3 A3@2%3 Ab3@1%3 A3@2%3 G3/h@0%3 |';
const PETZOLD = 'D4/q G3/e A3 B3 C4 | D4/q G3 G3 | E4/q C4/e D4 E4 F#4 | G4/q G3 G3 | C4/q D4/e C4 B3 A3 | B3/q C4/e B3 A3 G3 | F#3/q G3/e A3 B3 G3 | A3/h. | D4/q G3/e A3 B3 C4 | D4/q G3 G3 | E4/q C4/e D4 E4 F#4 | G4/q G3 G3 | C4/q D4/e C4 B3 A3 | B3/q C4/e B3 A3 G3 | A3/q B3/e A3 G3 F#3 | G3/h. |';

// Two-voice studies: every note carries its string and finger, so the bass (stems down, thumb)
// and the melody (stems up, fingers) never collide.
const OPEN_BASS_MELODY = 'E4@0%1 C4@1%2 A3@2%3 | G#3@1%3 B3@0%2 E4@0%1 | A3@2%3 C4@1%2 E4@0%1 | F4@1%1 D4@3%2 A3@2%3 | E4@0%1 C4@1%2 A3@2%3 | D4@3%2 F4@1%1 D4@3%2 | B3@0%2 G#3@1%3 B3@0%2 | A3/h.@2%3 |';
const OPEN_BASS_BASS = 'A2/h.@0%5 | E2/h.@0%6 | A2/h.@0%5 | D3/h.@0%4 | A2/h.@0%5 | D3/h.@0%4 | E2/h.@0%6 | A2/h.@0%5 |';
const EM_STUDY_MELODY = 'G4@3%1 F#4@2%1 E4@0%1 | C4@1%2 E4@0%1 A3@2%3 | A3@3%3 B3@0%2 F#4@4%1 | G4@3%1 E4@0%1 B3@0%2 | E4@0%1 G3@0%3 C4@1%2 | E4@0%1 C4@1%2 A3@2%3 | B3@0%2 A3@3%3 F#4@4%1 | E4/h.@0%1 |';
const EM_STUDY_BASS = 'E2/h.@0%6 | A2/h.@0%5 | B2/h.@2%5 | E2/h.@0%6 | C3/h.@3%5 | A2/h.@0%5 | B2/h.@2%5 | E2/h.@0%6 |';
const ANDANTINO_MELODY = 'G3@0%3 B3@0%2 E4@0%1 B3@0%2 | A3@2%3 C4@1%2 E4@0%1 C4@1%2 | F#4@2%1 D4@3%2 A3@1%3 D4@3%2 | G3@0%3 B3@0%2 D4@3%2 G4@4%1 | E4@0%1 C4@1%2 G3@0%3 C4@1%2 | E4@0%1 C4@1%2 A3@2%3 C4@1%2 | F#4@4%1 B3@0%2 A3@3%3 B3@0%2 | [G3 B3 E4]/w@0,0,0%3,2,1 |';
const ANDANTINO_BASS = 'E2/w@0%6 | A2/w@0%5 | D3/w@0%4 | G2/w@2%6 | C3/w@3%5 | A2/w@0%5 | B2/w@2%5 | E2/w@0%6 |';
const THUMB_MELODY_TOP = 'E4/h.@0%1 | E4/h.@0%1 | B3/h.@0%2 | E4/h.@0%1 | E4/h.@0%1 | E4/h.@0%1 | B3/h.@0%2 | [C4 E4]/h.@1,0%2,1 |';
const THUMB_MELODY_BASS = 'A2@0%5 C3@3%5 E3@2%4 | F3@3%4 E3@2%4 D3@0%4 | E2@0%6 G#2@4%6 B2@2%5 | A2@0%5 B2@2%5 C3@3%5 | D3@0%4 F3@3%4 A3@2%3 | C3@3%5 B2@2%5 A2@0%5 | E2@0%6 E3@2%4 G#3@1%3 | A2/h.@0%5 |';

// Positions & shifting
const SHIFT_1_5 = 'C4@1%2 D4@3%2 E4@0%1 F4@1%1 | G4@3%1 E4@0%1 A4@1%1 B4@3%1 | C5/h@4%1 B4/q@3%1 A4@1%1 | G4@4%2 F4@2%2 E4@1%2 D4@3%3 | C4@1%3 E4@1%2 G4@4%2 E4@1%2 | B3@0%2 C4@1%2 D4@3%2 B3@0%2 | A3@2%3 B3@0%2 D4@3%2 B3@0%2 | C4/w@1%2 |';
const GUIDE_SHIFT = 'G3@0%3 A3@2%3 B3@0%2 C4@1%2 | D4@3%2 E4@0%1 F#4@2%1 G4@3%1 | B4@3%1 A4@1%1 B4@3%1 C5@4%1 | A4@1%1 G4@4%2 F#4@3%2 E4@1%2 | D4@3%3 E4@1%2 F#4@3%2 G4@4%2 | B4@3%1 A4@1%1 G4@4%2 F#4@3%2 | E4@0%1 D4@3%2 C4@1%2 A3@2%3 | G3/w@0%3 |';
const FIFTH_POS_ETUDE = 'C4@1%3 E4@1%2 G4@4%2 C5@4%1 | B4@3%1 G4@4%2 D4@3%3 G4@4%2 | A4@1%1 F4@2%2 C4@1%3 F4@2%2 | E4/h@1%2 G4/h@4%2 | F4/q@2%2 A4@1%1 C5@4%1 A4@1%1 | E4@1%2 G4@4%2 C5@4%1 G4@4%2 | D4@3%3 F4@2%2 B4@3%1 G4@4%2 | C5/w@4%1 |';
const FIFTH_POS_BASS = 'A2@1%6 C3@4%6 E3@3%5 A3@3%4 | G3@1%4 E3@3%5 C3@4%6 E3@3%5 | F3@4%5 A3@3%4 C4@1%3 A3@3%4 | E3/h@3%5 B2/h@3%6 | A2/q@1%6 B2@3%6 C3@4%6 D3@1%5 | E3@3%5 F3@4%5 G3@1%4 A3@3%4 | E3@3%5 G#3@2%4 E3@3%5 B2@3%6 | A2/w@1%6 |';
const HIGH_A = 'C5@2%2 D5@4%2 E5@1%1 F5@2%1 | G5/h@4%1 E5/h@1%1 | F5/q@2%1 G5@4%1 A5@4%1 G5@2%1 | F5@2%1 E5@1%1 D5@4%2 B4@1%2 | C5/w@2%2 |';
const SEVENTH_POS_ETUDE = 'G3@4%5 B3@3%4 D4@1%3 G4@2%2 | B4@1%1 A4@4%2 G4@2%2 F#4@1%2 | E4@3%3 G4@2%2 C5@2%1 E4@3%3 | D4/h@1%3 D5/h@4%1 | C5/q@2%1 B4@1%1 A4@4%2 G4@2%2 | F#4@1%2 A4@4%2 D5@4%1 C5@2%1 | B4@1%1 A4@4%2 F#4@1%2 A4@4%2 | G4/w@2%2 |';

export const guitarTreble: TrackDef = {
  id: 'guitar-treble',
  instrument: 'guitar',
  title: 'Treble Clef',
  subtitle: 'Guitar · Standard notation',
  description: 'Read real guitar music from the open strings to the 12th position — with left-hand fingering, right-hand technique, keys, chords, arpeggios, two-voice textures and classical repertoire.',
  clef: 'treble8vb',
  accent: '#3fdc9a',
  glyph: '𝄞',
  heatmap: [{ clef: 'treble8vb', low: 'E2', high: 'A5' }],
  units: [
    // ------------------------------------------------------------------ 1
    unit('gt1', 'The First String', 'Read the guitar staff and play E, F and G on the thinnest string.', [
      lesson('gt1-1', 'Open E and F', 'learn', 'Read the guitar staff and play your first two notes', [
        meet(G, 'E4', { frets: [at(1, 0, 0)], tips: ['Strings are numbered 1 (thinnest) to 6 (thickest). The open 1st string is E, written in the top space of the staff. Pluck it without pressing any fret.'] }),
        meet(G, 'F4', { frets: [at(1, 1, 1)], tips: ['F sits on the top line. Press the 1st string with finger 1 (index), just behind the 1st fret wire.'] }),
        name(G, 'E4 F4', 8),
        play(G, 'E4 F4', 8, { hints: true }),
      ], [
        insight('Guitar music is written up an octave', 'Guitar uses the treble clef with a small 8 underneath: everything sounds one octave lower than it is written. That keeps guitar music on the staff instead of down in ledger lines. Just read the notes — Clef Coach listens for the real sound.', { kind: 'staff', clef: 'treble8vb', notes: ['E4', 'F4', 'G4'], labels: true }),
        insight('Left-hand fingers', 'Index = 1, middle = 2, ring = 3, pinky = 4, and 0 means an open string. Press with the fingertip right behind the fret wire — not on top of it, not in the middle of the fret. It takes less pressure than you think.', { kind: 'frets', positions: [{ string: 1, fret: 1, finger: 1 }, { string: 1, fret: 2, finger: 2 }, { string: 1, fret: 3, finger: 3 }, { string: 1, fret: 4, finger: 4 }], maxFret: 5 }),
      ]),
      lesson('gt1-2', 'G on the Third Fret', 'learn', 'Add G, just above the staff', [
        meet(G, 'G4', { frets: [at(1, 3, 3)], tips: ['G hangs just above the staff. Finger 3 presses behind the 3rd fret — one finger per fret, so finger 3 lives at fret 3.'] }),
        name(G, S1, 10),
        play(G, S1, 10, { hints: true }),
        read(G, S1, { rhythms: RH.quarters, maxLeap: 1, measures: 2, noteNames: true, title: 'Your first melody' }),
      ], [
        insight('Right hand: alternate i and m', 'Pluck with the tips of your index (i) and middle (m) fingers, taking turns: i–m–i–m. Never use the same finger twice in a row. Let your thumb rest on the 6th string for balance.'),
      ]),
      lesson('gt1-3', 'First-String Melodies', 'practice', 'Steps and skips between E, F and G', [
        tip('Steps and skips', 'E (space) to F (line) is a step — the next note. E to G skips over F: space to space. On the guitar the step E–F is one fret; F–G is two frets.', { kind: 'staff+frets', clef: 'treble8vb', notes: ['E4', 'F4', 'G4'], positions: [{ string: 1, fret: 0 }, { string: 1, fret: 1, finger: 1 }, { string: 1, fret: 3, finger: 3 }] }),
        read(G, S1, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
        read(G, S1, { rhythms: RH.qh, maxLeap: 2, leapiness: 0.5 }),
        name(G, S1, 12, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gt1-c', 'Checkpoint: The First String', 'checkpoint', 'Show you know E, F and G', [
        name(G, S1, 12),
        play(G, S1, 9),
        read(G, S1, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['E F G', 'Finger numbers', 'i–m alternation']),

    // ------------------------------------------------------------------ 2
    unit('gt2', 'The Second String', 'B, C and D — and your first real tunes.', [
      lesson('gt2-1', 'Open B and C', 'learn', 'The middle of the staff', [
        meet(G, 'B3', { frets: [at(2, 0, 0)], tips: ['The open 2nd string is B — the middle line of the staff.'] }),
        meet(G, 'C4', { frets: [at(2, 1, 1)], tips: ['C is in the third space: finger 1 at the 1st fret of the 2nd string.'] }),
        name(G, 'B3 C4', 8),
        play(G, 'B3 C4', 8, { hints: true }),
      ], [
        insight('Same fingers, new string', 'The 2nd string is tuned to B. Its first-position notes B, C and D use the same fingers as E, F and G: open, 1 and 3.', { kind: 'staff+frets', clef: 'treble8vb', notes: ['B3', 'C4', 'D4'], positions: [{ string: 2, fret: 0 }, { string: 2, fret: 1, finger: 1 }, { string: 2, fret: 3, finger: 3 }] }),
      ]),
      lesson('gt2-2', 'D on the Third Fret', 'learn', 'Complete the second string', [
        meet(G, 'D4', { frets: [at(2, 3, 3)], tips: ['D sits on the 4th line: finger 3, 3rd fret, 2nd string.'] }),
        name(G, S2, 10),
        play(G, S2, 10, { hints: true }),
        read(G, S2, { rhythms: RH.quarters, maxLeap: 1, noteNames: true }),
      ]),
      lesson('gt2-3', 'Crossing Strings', 'practice', 'Melodies on strings 1 and 2', [
        tip('Crossing strings', 'D (2nd string, 3rd fret) to E (open 1st string) is just one step up. Keep finger 3 down until the E sounds so the two notes connect smoothly.', { kind: 'staff+frets', clef: 'treble8vb', notes: ['C4', 'D4', 'E4', 'F4'], positions: [{ string: 2, fret: 1, finger: 1 }, { string: 2, fret: 3, finger: 3 }, { string: 1, fret: 0 }, { string: 1, fret: 1, finger: 1 }] }),
        read(G, S12, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
        read(G, S12, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
        name(G, S12, 14, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gt2-4', 'First Songs', 'song', 'Two melodies on the top strings', [
        piece('gt-ode-to-joy'),
        gpiece('Mary Had a Little Lamb', 'C', [4, 4], [MARY]),
      ]),
      lesson('gt2-c', 'Checkpoint: Two Strings', 'checkpoint', 'Read B to G fluently', [
        name(G, S12, 14),
        play(G, S12, 10),
        read(G, S12, { rhythms: RH.qh, maxLeap: 2, fingering: 'first' }),
      ]),
    ], ['B C D', 'String crossing', 'First songs']),

    // ------------------------------------------------------------------ 3
    unit('gt3', 'Rhythm & Rests', 'Count quarters, halves, wholes — and stop the strings for silence.', [
      lesson('gt3-1', 'Counting Time', 'learn', 'Quarter, half and whole notes in 4/4', [
        tip('Note values', 'In 4/4 there are four beats per bar. A quarter note lasts 1 beat, a half note 2, a whole note 4. Count “1 2 3 4” out loud or tap your foot.', { kind: 'staff', clef: 'treble8vb', notes: ['E4/q', 'F4/q', 'G4/h', 'C4/w'], time: [4, 4] }),
        rhythm([4, 4], RH.qhw, { tempo: 72 }),
        read(G, S12, { rhythms: RH.qhw, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gt3-2', 'Three-Four Time', 'learn', 'Waltz time and the dotted half note', [
        tip('3/4 time', 'Three beats per bar: ONE two three. A dotted half note lasts all three beats — the dot adds half the note’s value.', { kind: 'staff', clef: 'treble8vb', notes: ['C4/q', 'E4/q', 'G4/q', 'E4/h.'], time: [3, 4] }),
        rhythm([3, 4], RH.waltz, { tempo: 80 }),
        read(G, S12, { time: [3, 4], rhythms: RH.waltz, maxLeap: 2 }),
        gpiece('Two-String Waltz', 'C', [3, 4], [TWO_STRING_WALTZ]),
      ]),
      lesson('gt3-3', 'Rests: Silence the Strings', 'learn', 'Quarter and half rests on a ringing instrument', [
        tip('Stopping the sound', 'A rest is counted silence — but guitar strings keep ringing. To stop a fretted note, relax the finger so it still touches the string. To stop an open string, touch it lightly with the right-hand finger that will play next.', { kind: 'staff', clef: 'treble8vb', notes: ['E4/q', 'r/q', 'G4/q', 'r/q', 'D4/h', 'r/h'], time: [4, 4] }),
        rhythm([4, 4], RH.rests, { tempo: 72 }),
        read(G, S12, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gt3-4', 'Folk Tunes', 'song', 'Jingle Bells and Lightly Row', [
        piece('gt-jingle-bells'),
        gpiece('Lightly Row', 'C', [4, 4], [LIGHTLY_ROW]),
      ]),
      lesson('gt3-c', 'Checkpoint: Rhythm', 'checkpoint', 'Keep a steady pulse while reading', [
        rhythm([4, 4], RH.rests, { tempo: 76, reps: 1 }),
        read(G, S12, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(G, S12, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, mode: 'tempo', tempo: 80, fingering: 'none' }),
      ]),
    ], ['4/4 & 3/4', 'Rests', 'Damping']),

    // ------------------------------------------------------------------ 4
    unit('gt4', 'The Third String', 'G and A — three strings, eight notes.', [
      lesson('gt4-1', 'Open G and A', 'learn', 'The lower half of the staff', [
        meet(G, 'G3', { frets: [at(3, 0, 0)], tips: ['The open 3rd string is G — the second line, the one the treble clef curls around.'] }),
        meet(G, 'A3', { frets: [at(3, 2, 2)], tips: ['A is in the second space: finger 2, 2nd fret, 3rd string.'] }),
        name(G, 'G3 A3 B3 C4', 10),
        play(G, 'G3 A3 B3 C4', 10, { hints: true }),
      ], [
        insight('One finger per fret', 'In first position each finger owns a fret: finger 1 → fret 1, finger 2 → fret 2, finger 3 → fret 3, finger 4 → fret 4. Keep the hand there and the fingering takes care of itself.', { kind: 'frets', positions: [{ string: 3, fret: 0, label: 'G' }, { string: 3, fret: 2, finger: 2, label: 'A' }, { string: 2, fret: 0, label: 'B' }, { string: 2, fret: 1, finger: 1, label: 'C' }, { string: 2, fret: 3, finger: 3, label: 'D' }, { string: 1, fret: 0, label: 'E' }, { string: 1, fret: 1, finger: 1, label: 'F' }, { string: 1, fret: 3, finger: 3, label: 'G' }], maxFret: 5 }),
      ]),
      lesson('gt4-2', 'Three Strings', 'practice', 'Read G up to G', [
        read(G, S123, { rhythms: RH.qh, maxLeap: 1, noteNames: true }),
        read(G, S123, { rhythms: RH.qh, maxLeap: 2 }),
        name(G, S123, 14, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gt4-3', 'Rest Strokes', 'practice', 'A full, singing melody tone', [
        tip('Rest stroke and free stroke', 'For melodies, use rest strokes: pluck through the string and let the finger come to rest on the next string. Free strokes clear the string — you will use them for chords and arpeggios.'),
        read(G, S123, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
        read(G, S123, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 69, fingering: 'first' }),
      ]),
      lesson('gt4-4', 'Songs on Three Strings', 'song', 'Au Clair de la Lune and Twinkle', [
        gpiece('Au Clair de la Lune', 'C', [4, 4], [AU_CLAIR]),
        gpiece('Twinkle, Twinkle, Little Star', 'C', [4, 4], [TWINKLE]),
      ]),
      lesson('gt4-c', 'Checkpoint: Three Strings', 'checkpoint', 'G3 to G4 on sight', [
        name(G, S123, 15),
        play(G, S123, 10),
        read(G, S123, { rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['G A', 'One finger per fret', 'Rest strokes']),

    // ------------------------------------------------------------------ 5
    unit('gt5', 'The Fourth String', 'D, E and F — and the thumb joins in.', [
      lesson('gt5-1', 'Open D and E', 'learn', 'Below the staff and the bottom line', [
        meet(G, 'D3', { frets: [at(4, 0, 0)], tips: ['The open 4th string is D, hanging just below the staff.'] }),
        meet(G, 'E3', { frets: [at(4, 2, 2)], tips: ['E is the bottom line: finger 2, 2nd fret, 4th string.'] }),
        name(G, 'D3 E3 G3 A3', 10),
        play(G, 'D3 E3 G3', 9, { hints: true }),
      ], [
        insight('The thumb plays the bass', 'Use your right thumb (p) for the 4th, 5th and 6th strings. Push down-and-through with the side of the thumb, keeping it a little ahead of the fingers. Fingers i and m keep the top strings.'),
      ]),
      lesson('gt5-2', 'F on the Third Fret', 'learn', 'The first space', [
        meet(G, 'F3', { frets: [at(4, 3, 3)], tips: ['F is in the first space: finger 3, 3rd fret, 4th string — the same finger and fret as G on the 1st string.'] }),
        name(G, 'D3 E3 F3 G3 A3', 12),
        play(G, 'D3 E3 F3 G3 A3', 10, { hints: true }),
        read(G, 'D3 E3 F3 G3 A3', { rhythms: RH.quarters, maxLeap: 1, noteNames: true }),
      ]),
      lesson('gt5-3', 'Four Strings', 'practice', 'Two octaves of reading', [
        read(G, S1234, { rhythms: RH.qh, maxLeap: 2 }),
        read(G, S1234, { rhythms: RH.rests, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
        name(G, S1234, 16, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gt5-4', 'Little Minuet', 'song', 'A 3/4 tune in the low register', [
        gpiece('Little Minuet', 'C', [3, 4], [LITTLE_MINUET]),
        read(G, S1234, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('gt5-c', 'Checkpoint: Four Strings', 'checkpoint', 'D3 to G4', [
        name(G, S1234, 16),
        play(G, S1234, 12),
        read(G, S1234, { rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['D E F', 'Thumb (p)', 'Two octaves']),

    // ------------------------------------------------------------------ 6
    unit('gt6', 'The Fifth String', 'A, B and C on ledger lines below the staff.', [
      lesson('gt6-1', 'C and B Below the Staff', 'learn', 'Your first ledger line', [
        meet(G, 'C3', { frets: [at(5, 3, 3)], tips: ['C sits on one ledger line below the staff: finger 3, 3rd fret, 5th string. Play it with the thumb.'] }),
        meet(G, 'B2', { frets: [at(5, 2, 2)], tips: ['B hangs just under that ledger line: finger 2, 2nd fret, 5th string.'] }),
        name(G, 'B2 C3 D3 E3', 10),
        play(G, 'B2 C3 D3 E3', 10, { hints: true }),
      ], [
        insight('Ledger lines', 'Notes below the staff get short extra lines called ledger lines. Guitarists read them all the time — the bass strings live there.', { kind: 'staff', clef: 'treble8vb', notes: ['E3', 'D3', 'C3', 'B2', 'A2'], labels: true }),
      ]),
      lesson('gt6-2', 'Open A', 'learn', 'Two ledger lines', [
        meet(G, 'A2', { frets: [at(5, 0, 0)], tips: ['A sits on the second ledger line below — the open 5th string.'] }),
        name(G, 'A2 B2 C3 D3 E3 F3', 12),
        play(G, 'A2 B2 C3 D3 E3 F3', 10, { hints: true }),
        read(G, 'A2 B2 C3 D3 E3 F3 G3', { rhythms: RH.quarters, maxLeap: 1, noteNames: true }),
      ]),
      lesson('gt6-3', 'Five Strings', 'practice', 'From A2 up to G4', [
        read(G, 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4', { rhythms: RH.qh, maxLeap: 2 }),
        read(G, S5UP, { rhythms: RH.qh, maxLeap: 3, leapiness: 0.4, fingering: 'first' }),
        name(G, S5UP, 16, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gt6-4', 'Walking Down', 'song', 'A melody that walks into the bass', [
        gpiece('Walking Down', 'C', [4, 4], [WALKING_DOWN]),
        read(G, S5UP, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('gt6-c', 'Checkpoint: Five Strings', 'checkpoint', 'Read A2 to G4', [
        name(G, S5UP, 16),
        play(G, S5UP, 12),
        read(G, S5UP, { rhythms: RH.rests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['A B C', 'Ledger lines below']),

    // ------------------------------------------------------------------ 7
    unit('gt7', 'First Position Complete', 'The 6th string and every natural note from E2 to G4.', [
      lesson('gt7-1', 'Low E, F and G', 'learn', 'Three ledger lines down', [
        meet(G, 'E2 F2 G2', {
          frets: [at(6, 0, 0), at(6, 1, 1), at(6, 3, 3)],
          tips: [
            'The open 6th string is E, hanging below three ledger lines — the lowest note on the guitar.',
            'F sits on the third ledger line: finger 1, 1st fret, 6th string.',
            'G hangs below the second ledger line: finger 3, 3rd fret, 6th string.',
          ],
        }),
        name(G, 'E2 F2 G2 A2 B2 C3', 12),
        play(G, 'E2 F2 G2 A2 B2 C3', 10, { hints: true }),
      ], [
        insight('Ledger-line landmarks', 'Don’t count lines every time — learn three landmarks. One ledger line = C (5th string, 3rd fret). Two = A (open 5th string). Three = F (6th string, 1st fret). Everything else is a step away.', { kind: 'staff', clef: 'treble8vb', notes: ['C3', 'A2', 'F2'], labels: true }),
      ]),
      lesson('gt7-2', 'The Bass Strings', 'practice', 'Read fluently below the staff', [
        read(G, LOW, { rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        read(G, LOW, { rhythms: RH.rests, maxLeap: 2, fingering: 'first' }),
        name(G, 'E2 F2 G2 A2 B2 C3 D3', 14, { sequence: true, title: 'Note rush' }),
      ]),
      lesson('gt7-3', 'The First-Position Map', 'learn', 'All 17 natural notes', [
        tip('First position', 'Every natural note from low E to high G lies within the first three frets. The finger always matches the fret.', {
          kind: 'frets',
          positions: [
            { string: 6, fret: 0, label: 'E' }, { string: 6, fret: 1, finger: 1, label: 'F' }, { string: 6, fret: 3, finger: 3, label: 'G' },
            { string: 5, fret: 0, label: 'A' }, { string: 5, fret: 2, finger: 2, label: 'B' }, { string: 5, fret: 3, finger: 3, label: 'C' },
            { string: 4, fret: 0, label: 'D' }, { string: 4, fret: 2, finger: 2, label: 'E' }, { string: 4, fret: 3, finger: 3, label: 'F' },
            { string: 3, fret: 0, label: 'G' }, { string: 3, fret: 2, finger: 2, label: 'A' },
            { string: 2, fret: 0, label: 'B' }, { string: 2, fret: 1, finger: 1, label: 'C' }, { string: 2, fret: 3, finger: 3, label: 'D' },
            { string: 1, fret: 0, label: 'E' }, { string: 1, fret: 1, finger: 1, label: 'F' }, { string: 1, fret: 3, finger: 3, label: 'G' },
          ],
          maxFret: 5,
        }),
        name(G, POS1, 20, { sequence: true, title: 'Note rush' }),
        play(G, POS1, 14),
      ]),
      lesson('gt7-4', 'Across Six Strings', 'practice', 'Melodies over the whole range', [
        read(G, POS1, { rhythms: RH.qh, maxLeap: 2 }),
        read(G, POS1, { rhythms: RH.qhw, maxLeap: 4, leapiness: 0.4, fingering: 'first' }),
        read(G, POS1, { time: [3, 4], rhythms: RH.waltz, maxLeap: 3, fingering: 'none' }),
      ]),
      lesson('gt7-5', 'Six-String Étude', 'song', 'A waltz from the bass to the top', [
        gpiece('Six-String Étude', 'C', [3, 4], [SIX_STRINGS]),
        piece('gt-aura-lee'),
      ]),
      lesson('gt7-c', 'Checkpoint: First Position', 'checkpoint', 'Every natural note, E2 to G4', [
        name(G, POS1, 20, { sequence: true }),
        play(G, POS1, 12),
        read(G, POS1, { rhythms: RH.qhw, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['E F G low', 'Ledger landmarks', 'Whole first position']),

    // ------------------------------------------------------------------ 8
    unit('gt8', 'Eighth Notes, Pickups & Ties', 'Two notes per beat, with strict alternation.', [
      lesson('gt8-1', 'Two per Beat', 'learn', 'Eighth notes and beams', [
        tip('Eighth notes', 'An eighth note is half a beat; pairs are joined by a beam. Count “1 & 2 &”. Alternate i–m strictly — it keeps fast notes even.', { kind: 'staff', clef: 'treble8vb', notes: ['E4/e', 'F4/e', 'G4/q', 'G4/e', 'F4/e', 'E4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.eighths, { tempo: 66 }),
        read(G, S12, { rhythms: RH.eighths, maxLeap: 1 }),
        read(G, S123, { rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gt8-2', 'Eighths Across the Strings', 'practice', 'Eighths with string crossings', [
        read(G, S1234, { rhythms: RH.eighths, maxLeap: 2 }),
        read(G, POS1, { rhythms: RH.eighthsRests, maxLeap: 2, mode: 'tempo', tempo: 66, fingering: 'first' }),
        gpiece('Allegretto', 'C', [4, 4], [ALLEGRETTO]),
      ]),
      lesson('gt8-3', 'Pickups & Ties', 'learn', 'Notes that lead in and notes that hold over', [
        tip('Pickups and ties', 'A pickup is a short first bar that leads into beat one. A tie joins two notes of the same pitch: play once, hold for both — let it ring across the bar line.', { kind: 'staff', clef: 'treble8vb', notes: ['G3/q', 'C4/h.'], time: [4, 4] }),
        gpiece('Ties Across the Bar', 'C', [4, 4], [TIES]),
        piece('gt-when-the-saints'),
      ]),
      lesson('gt8-4', 'Eighth-Note Songs', 'song', 'Tunes that move', [
        piece('gt-oh-susanna'),
        read(G, POS1, { rhythms: RH.eighths, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('gt8-c', 'Checkpoint: Eighths', 'checkpoint', 'Eighth-note melodies in time', [
        rhythm([4, 4], RH.eighthsRests, { tempo: 72, reps: 1 }),
        read(G, S1234, { rhythms: RH.eighths, maxLeap: 2, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(G, POS1, { rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Eighth notes', 'Pickups', 'Ties']),

    // ------------------------------------------------------------------ 9
    unit('gt9', 'Sharps, Flats & Keys', 'F♯, C♯, G♯, B♭, E♭ — and the keys of G, D, E minor, A minor and F.', [
      lesson('gt9-1', 'F Sharp & the Key of G', 'learn', 'One fret higher', [
        meet(G, 'F#4 F#3 F#2', {
          frets: [at(1, 2, 2), at(4, 4, 4), at(6, 2, 2)],
          tips: ['F♯ on the 1st string: 2nd fret, finger 2.', 'F♯ on the 4th string: 4th fret, finger 4 — reach with the pinky, keep finger 1 near fret 1.', 'Low F♯: 6th string, 2nd fret, finger 2.'],
        }),
        keysig(G, 'C G', 6),
        read(G, POS1_G, { key: 'G', rhythms: RH.qh, maxLeap: 2 }),
      ], [
        insight('Sharps on the guitar', 'A sharp (♯) raises a note one fret. F is the 1st fret of the 1st string, so F♯ is the 2nd fret. A flat (♭) lowers a note one fret.', { kind: 'frets', positions: [{ string: 1, fret: 1, finger: 1, label: 'F' }, { string: 1, fret: 2, finger: 2, label: 'F♯' }, { string: 1, fret: 3, finger: 3, label: 'G' }], maxFret: 5 }),
        insight('The key of G', 'G major has one sharp in the key signature, on the top line: every F — in every octave — becomes F♯.', { kind: 'staff', clef: 'treble8vb', notes: ['F#3', 'F#4'], key: 'G' }),
      ]),
      lesson('gt9-2', 'C Sharp & the Key of D', 'learn', 'Two sharps', [
        meet(G, 'C#4 C#3', { frets: [at(2, 2, 2), at(5, 4, 4)], tips: ['C♯ on the 2nd string: 2nd fret, finger 2.', 'Low C♯: 5th string, 4th fret, finger 4.'] }),
        keysig(G, 'C G D', 8),
        read(G, POS1_D, { key: 'D', rhythms: RH.qh, maxLeap: 2 }),
        read(G, POS1_D, { key: 'D', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gt9-3', 'E Minor & A Minor', 'learn', 'Relative minors and the raised 7th', [
        meet(G, 'G#3 D#4', { frets: [at(3, 1, 1), at(2, 4, 4)], tips: ['G♯ on the 3rd string: 1st fret, finger 1 — the leading note in A minor.', 'D♯ on the 2nd string: 4th fret, finger 4 — the leading note in E minor.'] }),
        keysig(G, 'C G Am Em', 8),
        read(G, POS1_EM, { key: 'Em', rhythms: RH.qh, maxLeap: 2 }),
        read(G, POS1_AM, { key: 'Am', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ], [
        insight('Relative minor', 'E minor shares G major’s key signature; A minor shares C major’s. Minor tunes often raise the 7th note to lead home: D♯ in E minor, G♯ in A minor — written as accidentals.'),
      ]),
      lesson('gt9-4', 'Flats & the Key of F', 'learn', 'B♭, E♭ and accidentals', [
        meet(G, 'Bb3 Bb2 Eb4', { frets: [at(3, 3, 3), at(5, 1, 1), at(2, 4, 4)], tips: ['B♭ on the 3rd string: 3rd fret, finger 3.', 'Low B♭: 5th string, 1st fret, finger 1.', 'E♭ on the 2nd string: 4th fret, finger 4 (the same fret as D♯ — two names, one sound).'] }),
        keysig(G, 'C G D F', 8),
        read(G, POS1_F, { key: 'F', rhythms: RH.qh, maxLeap: 2 }),
        tip('Accidentals last a bar', 'A sharp, flat or natural written beside a note lasts until the bar line. In first position the chromatic notes follow the rule “finger = fret”.'),
        name(G, CHROMATIC, 16, { answers: 'accidentals' }),
        gpiece('Chromatic Walk', 'C', [4, 4], [CHROMATIC_WALK]),
      ]),
      lesson('gt9-5', 'Minuet in G', 'song', 'Petzold’s famous minuet, in first position', [
        gpiece('Minuet in G — C. Petzold', 'G', [3, 4], [PETZOLD]),
        piece('gt-greensleeves'),
      ]),
      lesson('gt9-c', 'Checkpoint: Keys', 'checkpoint', 'Read with key signatures and accidentals', [
        keysig(G, 'C G D F Am Em', 8),
        play(G, CHROMATIC, 12),
        read(G, POS1_G, { key: 'G', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(G, POS1_AM, { key: 'Am', rhythms: RH.eighths, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['♯ and ♭', 'G D F major', 'E & A minor']),

    // ------------------------------------------------------------------ 10
    unit('gt10', 'Scales in First Position', 'C, G, D, F major and A, E minor — one and two octaves.', [
      lesson('gt10-1', 'C Major Scale', 'learn', 'One octave from the 5th string', [
        scale('C', 'major', 'R', { octave: 3, clef: G }),
        scale('C', 'major', 'R', { octave: 3, clef: G, mode: 'tempo', tempo: 72 }),
        read(G, 'C3 D3 E3 F3 G3 A3 B3 C4', { rhythms: RH.eighths, maxLeap: 1 }),
      ], [
        insight('Scales build the hand', 'A scale is every note of a key in order. Keep one finger per fret, let the fingers hover close to the strings, alternate i–m, and keep a finger down while a higher finger plays on the same string.', { kind: 'frets', positions: [{ string: 5, fret: 3, finger: 3, root: true }, { string: 4, fret: 0 }, { string: 4, fret: 2, finger: 2 }, { string: 4, fret: 3, finger: 3 }, { string: 3, fret: 0 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 0 }, { string: 2, fret: 1, finger: 1, root: true }], maxFret: 5 }),
      ]),
      lesson('gt10-2', 'G Major — Two Octaves', 'learn', 'From the 6th string to the 1st', [
        tip('Two octaves', 'Two full octaves of G fit in first position: from the 6th string, 3rd fret, to the 1st string, 3rd fret. F♯ is finger 2 on strings 6 and 1, finger 4 on string 4.'),
        scale('G', 'major', 'R', { octaves: 2, octave: 2, clef: G }),
        scale('G', 'major', 'R', { octaves: 2, octave: 2, clef: G, mode: 'tempo', tempo: 72, rhythm: 'e' }),
        read(G, POS1_G, { key: 'G', rhythms: RH.eighths, maxLeap: 2 }),
      ]),
      lesson('gt10-3', 'E and A Minor Scales', 'learn', 'Natural and harmonic minor', [
        tip('Natural and harmonic', 'The natural minor uses the key signature as it is. The harmonic minor raises the 7th by one fret — D♯ in E minor, G♯ in A minor — for a stronger pull home.'),
        scale('E', 'natural-minor', 'R', { octaves: 2, octave: 2, clef: G }),
        scale('A', 'harmonic-minor', 'R', { octave: 2, clef: G }),
        scale('E', 'harmonic-minor', 'R', { octaves: 2, octave: 2, clef: G, mode: 'tempo', tempo: 66 }),
      ]),
      lesson('gt10-4', 'D and F Major', 'learn', 'Two more keys in first position', [
        scale('D', 'major', 'R', { octave: 3, clef: G }),
        scale('F', 'major', 'R', { octave: 2, clef: G, title: 'F major — from the 6th string, 1st fret' }),
        scale('A', 'natural-minor', 'R', { octave: 2, clef: G, mode: 'tempo', tempo: 69 }),
        read(G, POS1_D, { key: 'D', rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gt10-5', 'Scale Melodies', 'practice', 'Stepwise lines in C, G and E minor', [
        read(G, POS1, { rhythms: RH.eighths, maxLeap: 1, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(G, POS1_G, { key: 'G', rhythms: RH.eighths, maxLeap: 2, mode: 'tempo', tempo: 69, fingering: 'first' }),
        read(G, POS1_EM, { key: 'Em', rhythms: RH.eighths, maxLeap: 2, fingering: 'none' }),
      ]),
      lesson('gt10-c', 'Checkpoint: Scales', 'checkpoint', 'Clean scales in time', [
        scale('G', 'major', 'R', { octaves: 2, octave: 2, clef: G, mode: 'tempo', tempo: 84, rhythm: 'e', fingering: 'first' }),
        scale('E', 'harmonic-minor', 'R', { octaves: 2, octave: 2, clef: G, mode: 'tempo', tempo: 76, fingering: 'none' }),
        read(G, POS1_D, { key: 'D', rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
      ]),
    ], ['C G D F major', 'E A minor', 'Two octaves']),

    // ------------------------------------------------------------------ 11
    unit('gt11', 'Chords & Arpeggios', 'Two notes at once, bass with melody, and p–i–m–a arpeggios.', [
      lesson('gt11-1', 'Two Notes at Once', 'learn', 'Read and play dyads', [
        interval(G, S123, [3, 6], 10, { harmonic: true }),
        read(G, S123, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.4, intervals: [3, 6] } }),
      ], [
        insight('Reading stacked notes', 'Stacked notes sound together. Read the bottom note, then the gap: line–line or space–space is a 3rd; a 6th spans much wider. Pluck the lower note with i and the upper with m, at exactly the same moment.', { kind: 'staff+frets', clef: 'treble8vb', notes: ['[C4 E4]/w'], positions: [{ string: 2, fret: 1, finger: 1 }, { string: 1, fret: 0 }] }),
      ]),
      lesson('gt11-2', 'Bass and Melody', 'learn', 'Two voices on one staff', [
        gpiece('Open-String Bass Study', 'Am', [3, 4], [OPEN_BASS_MELODY, OPEN_BASS_BASS], { prompt: 'Thumb on the bass (stems down), fingers on the melody (stems up). Let each bass note ring for the whole bar.' }),
        read(G, POS1, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.35, intervals: [8, 10] } }),
      ], [
        insight('Two parts, one staff', 'Guitar music often writes two parts on one staff: the melody with stems up, played by i, m and a, and the bass with stems down, played by the thumb (p). Hold the bass for its full value while the melody moves on top.'),
      ]),
      lesson('gt11-3', 'p–i–m–a Arpeggios', 'learn', 'Broken chords with every finger', [
        gpiece('Arpeggio Study in A Minor', 'Am', [4, 4], [bars(arp(AM, PIMA, 'e'), arp(DM, PIMA, 'e'), arp(EMAJ, PIMA, 'e'), arp(AM, PIMA, 'e'), arp(DM, PIMA, 'e'), arp(AM, PIMA, 'e'), arp(EMAJ, PIMA, 'e'), withDur(AM_CHORD, 'w'))]),
        gpiece('Arpeggio Study in C', 'C', [4, 4], [bars(arp(CMAJ, PIMA, 'e'), arp(AM, PIMA, 'e'), arp(FMAJ7, PIMA, 'e'), arp(G7, PIMA, 'e'), arp(CMAJ, PIMA, 'e'), arp(FMAJ7, PIMA, 'e'), arp(G7, PIMA, 'e'), withDur(C_CHORD, 'w'))]),
      ], [
        insight('Each finger owns a string', 'For broken chords, plant the right hand: p plays the bass, i the 3rd string, m the 2nd, a the 1st. Hold the whole chord shape in the left hand and let everything ring.', { kind: 'frets', positions: [{ string: 5, fret: 0, label: 'p' }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 2, finger: 3, label: 'i' }, { string: 2, fret: 1, finger: 1, label: 'm' }, { string: 1, fret: 0, label: 'a' }], maxFret: 4 }),
      ]),
      lesson('gt11-4', 'Chords on the Staff', 'learn', 'Read a chord as one shape', [
        tip('Chord reading', 'Don’t spell every note of a chord. Find the bottom note, see the stack, and let your hand recognise the shape: C, A minor, D minor, G7 and E are the core open chords of classical guitar.'),
        gpiece('Chord Changes', 'C', [4, 4], [
          '[C3 E3 G3 C4 E4]/h@3,2,0,1,0%5,4,3,2,1 [C3 E3 G3 C4 E4]@3,2,0,1,0%5,4,3,2,1 | [A2 E3 A3 C4 E4]/h@0,2,3,1,0%5,4,3,2,1 [A2 E3 A3 C4 E4]@0,2,3,1,0%5,4,3,2,1 | [D3 A3 D4 F4]/h@0,2,3,1%4,3,2,1 [D3 A3 D4 F4]@0,2,3,1%4,3,2,1 | [G2 B2 D3 G3 B3 F4]/h@3,2,0,0,0,1%6,5,4,3,2,1 [G2 B2 D3 G3 B3 F4]@3,2,0,0,0,1%6,5,4,3,2,1 | [A2 E3 A3 C4 E4]/h@0,2,3,1,0%5,4,3,2,1 [E2 B2 E3 G#3 B3 E4]/h@0,2,3,1,0,0%6,5,4,3,2,1 | [A2 E3 A3 C4 E4]/w@0,2,3,1,0%5,4,3,2,1 |',
        ]),
        read(G, S1234, { rhythms: RH.qh, maxLeap: 2, dyads: { chance: 0.45, intervals: [3, 6] }, fingering: 'first' }),
      ]),
      lesson('gt11-5', 'Two-Voice Studies', 'song', 'Melody over a sustained bass', [
        gpiece('Study in E Minor', 'Em', [3, 4], [EM_STUDY_MELODY, EM_STUDY_BASS]),
        gpiece('Andantino', 'Em', [4, 4], [ANDANTINO_MELODY, ANDANTINO_BASS], { prompt: 'Whole-note bass with the thumb, arpeggio melody with i, m and a. Keep the bass ringing all bar.' }),
      ]),
      lesson('gt11-c', 'Checkpoint: Chords & Arpeggios', 'checkpoint', 'Two notes, two voices, broken chords', [
        interval(G, POS1, [3, 6, 8, 10], 12, { harmonic: true }),
        read(G, POS1, { rhythms: RH.qh, maxLeap: 3, dyads: { chance: 0.45, intervals: [3, 6, 8] }, fingering: 'first' }),
        gpiece('Arpeggio Study in A Minor', 'Am', [4, 4], [bars(arp(AM, PIMA, 'e'), arp(DM, PIMA, 'e'), arp(EMAJ, PIMA, 'e'), arp(AM, PIMA, 'e'), arp(DM, PIMA, 'e'), arp(AM, PIMA, 'e'), arp(EMAJ, PIMA, 'e'), withDur(AM_CHORD, 'w'))], { mode: 'tempo', tempo: 66, fingering: 'first' }),
      ]),
    ], ['Dyads', 'Bass + melody', 'p–i–m–a']),

    // ------------------------------------------------------------------ 12
    unit('gt12', 'Dotted Rhythms, 6/8 & Triplets', 'Lilting rhythms and rolling arpeggios.', [
      lesson('gt12-1', 'Dotted Quarter', 'learn', 'Long–short: dotted quarter + eighth', [
        tip('The dot', 'A dotted quarter lasts 1½ beats and is usually followed by an eighth: count “1 – & 2”. You know it from the end of Ode to Joy.', { kind: 'staff', clef: 'treble8vb', notes: ['E4/q.', 'D4/e', 'D4/h'], time: [4, 4] }),
        rhythm([4, 4], RH.dotted, { tempo: 66 }),
        read(G, POS1, { rhythms: RH.dotted, maxLeap: 2, mode: 'tempo', tempo: 63 }),
        read(G, POS1_G, { key: 'G', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('gt12-2', 'Six-Eight Time', 'learn', 'Two big beats of three', [
        tip('Compound time', '6/8 has six eighth notes per bar in two groups of three: “ONE two three FOUR five six”. It sways — perfect for p–i–m–a–m–i arpeggios.', { kind: 'staff', clef: 'treble8vb', notes: ['C4/q', 'A3/e', 'G3/q.'], time: [6, 8] }),
        rhythm([6, 8], RH.compound, { tempo: 60 }),
        read(G, S1234, { time: [6, 8], rhythms: RH.compound, maxLeap: 2 }),
        gpiece('Arpeggios in 6/8', 'Am', [6, 8], [bars(
          arp(AM, PIMA68, 'e'), arp(CMAJ, PIMA68, 'e'), arp(DMAJ, PIMA68, 'e'), arp(FMAJ7, PIMA68, 'e'),
          arp(AM, PIMA68, 'e'), arp(CMAJ, PIMA68, 'e'), arp(EMAJ, PIMA68, 'e'), arp(EMAJ, PIMA68, 'e'),
          arp(AM, PIMA68, 'e'), arp(CMAJ, PIMA68, 'e'), arp(DMAJ, PIMA68, 'e'), arp(FMAJ7, PIMA68, 'e'),
          arp(AM, PIMA68, 'e'), arp(EMAJ, PIMA68, 'e'), arp(AM, PIMA68, 'e'), withDur(AM_CHORD, 'h.'),
        )]),
      ]),
      lesson('gt12-3', 'Triplets', 'learn', 'Three in the space of two', [
        tip('Triplets', 'A “3” over three eighths squeezes them into one beat: “tri-po-let, tri-po-let”. Keep the beat steady and let the triplet roll.', { kind: 'staff', clef: 'treble8vb', notes: ['C4/e3', 'D4/e3', 'E4/e3', 'G4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.triplets, { tempo: 63 }),
        read(G, S123, { rhythms: RH.triplets, maxLeap: 2 }),
        gpiece('Triplet Arpeggios', 'C', [4, 4], [bars(arp(CMAJ, PIM3, 'e3'), arp(AM, PIM3, 'e3'), arp(DM, PIM3, 'e3'), arp(G7, PIM3, 'e3'), arp(CMAJ, PIM3, 'e3'), arp(FMAJ7, PIM3, 'e3'), arp(G7, PIM3, 'e3'), withDur(C_CHORD, 'w'))]),
      ]),
      lesson('gt12-4', 'Lilting Songs', 'song', 'Waltzes and ballads in 3/4 and 6/8', [
        gpiece('Arpeggio Waltz', 'C', [3, 4], [bars(arp(CMAJ, PIMA68, 'e'), arp(G7, PIMA68, 'e'), arp(CMAJ, PIMA68, 'e'), arp(FMAJ7, PIMA68, 'e'), arp(CMAJ, PIMA68, 'e'), arp(DM, PIMA68, 'e'), arp(G7, PIMA68, 'e'), withDur(C_CHORD, 'h.'))]),
        piece('gt-house-of-the-rising-sun'),
        piece('gt-scarborough-fair'),
      ]),
      lesson('gt12-c', 'Checkpoint: Rhythm', 'checkpoint', 'Dotted, compound and triplet rhythms', [
        rhythm([6, 8], RH.compound, { tempo: 66, reps: 1 }),
        read(G, POS1, { rhythms: RH.dottedRests, maxLeap: 3, mode: 'tempo', tempo: 72, fingering: 'first' }),
        read(G, S1234, { time: [6, 8], rhythms: RH.compound, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['Dotted quarter', '6/8', 'Triplets']),

    // ------------------------------------------------------------------ 13
    unit('gt13', 'Fifth Position', 'Same notes, new places — and how to shift.', [
      lesson('gt13-1', 'Same Note, New Place', 'learn', 'Strings 1 and 2 in fifth position', [
        meet(G, 'E4 F4 G4 A4 B4 C5', {
          frets: [at(2, 5, 1), at(2, 6, 2), at(2, 8, 4), at(1, 5, 1), at(1, 7, 3), at(1, 8, 4)],
          tips: [
            'E on the 2nd string, 5th fret — the same pitch as the open 1st string.',
            'F: 2nd string, 6th fret, finger 2.',
            'G: 2nd string, 8th fret, finger 4.',
            'A sits on the first ledger line above the staff: 1st string, 5th fret, finger 1.',
            'B: 1st string, 7th fret, finger 3.',
            'C sits on the second ledger line above: 1st string, 8th fret, finger 4.',
          ],
        }),
        play(G, 'E4 F4 G4 A4 B4 C5', 10, { hints: true }),
        read(G, 'E4 F4 G4 A4 B4 C5', { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ], [
        insight('Unisons', 'Most notes live in more than one place. The 5th fret of each string sounds the same as the next open string — except on the 3rd string, where the 4th fret matches the open B.', { kind: 'frets', positions: [{ string: 6, fret: 5, label: 'A' }, { string: 5, fret: 0, label: 'A' }, { string: 5, fret: 5, label: 'D' }, { string: 4, fret: 0, label: 'D' }, { string: 4, fret: 5, label: 'G' }, { string: 3, fret: 0, label: 'G' }, { string: 3, fret: 4, label: 'B' }, { string: 2, fret: 0, label: 'B' }, { string: 2, fret: 5, label: 'E' }, { string: 1, fret: 0, label: 'E' }], maxFret: 7 }),
        insight('What is a position?', 'A position is named after the fret under finger 1. In 5th position finger 1 sits at fret 5 and finger 4 at fret 8 — one finger per fret, exactly like first position.', { kind: 'frets', positions: [{ string: 1, fret: 5, finger: 1 }, { string: 1, fret: 6, finger: 2 }, { string: 1, fret: 7, finger: 3 }, { string: 1, fret: 8, finger: 4 }], minFret: 3, maxFret: 10 }),
      ]),
      lesson('gt13-2', 'The Lower Strings in Fifth Position', 'learn', 'Strings 3 to 6', [
        meet(G, 'C4 D4 G3 A3', { frets: [at(3, 5, 1), at(3, 7, 3), at(4, 5, 1), at(4, 7, 3)], tips: ['C on the 3rd string, 5th fret, finger 1.', 'D on the 3rd string, 7th fret, finger 3.', 'G on the 4th string, 5th fret, finger 1 — same pitch as the open 3rd string.', 'A on the 4th string, 7th fret, finger 3.'] }),
        meet(G, 'A2 C3 D3 F3', { frets: [at(6, 5, 1), at(6, 8, 4), at(5, 5, 1), at(5, 8, 4)], tips: ['A on the 6th string, 5th fret — same as the open 5th string.', 'C on the 6th string, 8th fret, finger 4.', 'D on the 5th string, 5th fret, finger 1.', 'F on the 5th string, 8th fret, finger 4.'] }),
        fretPlay([3, 4, 5, 6], [4, 8], 10),
        read(G, 'A2 B2 C3 D3 E3 F3 G3 A3', { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
      ]),
      lesson('gt13-3', 'Reading in Fifth Position', 'practice', 'A2 to C5 with the hand at the 5th fret', [
        read(G, POS5_HI, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 2 }),
        read(G, POS5, { guitarPosition: 5, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
        read(G, POS5, { guitarPosition: 5, key: 'Am', rhythms: RH.dotted, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('gt13-4', 'Shifting', 'learn', 'Move between first and fifth position', [
        gpiece('Shifting Study: 1st to 5th', 'C', [4, 4], [SHIFT_1_5], { prompt: 'Shift while the open E or B rings. Watch the finger numbers.' }),
        gpiece('Guide-Finger Shifts', 'G', [4, 4], [GUIDE_SHIFT], { prompt: 'From G (finger 3, 3rd fret) slide the same finger up to B at the 7th fret, keeping light contact with the string — now you are in 5th position. Come home on the open E.' }),
      ], [
        insight('How to shift', 'Shift on an open string when you can: the hand moves while the string rings. Otherwise use a guide finger — keep it touching the string and slide lightly to the new fret. Release pressure, move, then press.'),
      ]),
      lesson('gt13-5', 'Fifth-Position Études', 'song', 'Two études that live at the 5th fret', [
        gpiece('Étude in Fifth Position', 'C', [4, 4], [FIFTH_POS_ETUDE]),
        gpiece('Bass Study in Fifth Position', 'Am', [4, 4], [FIFTH_POS_BASS]),
      ]),
      lesson('gt13-c', 'Checkpoint: Fifth Position', 'checkpoint', 'Read and shift with confidence', [
        read(G, POS5, { guitarPosition: 5, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(G, POS5, { guitarPosition: 5, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
        gpiece('Shifting Study: 1st to 5th', 'C', [4, 4], [SHIFT_1_5], { mode: 'tempo', tempo: 72, fingering: 'first' }),
      ]),
    ], ['5th position', 'Unisons', 'Shifting']),

    // ------------------------------------------------------------------ 14
    unit('gt14', 'High Positions', 'Seventh, ninth and twelfth position — up to high A.', [
      lesson('gt14-1', 'Ledger Lines Above', 'learn', 'Reading above the staff', [
        meet(G, 'B4 C5 D5', { frets: [at(1, 7, 1), at(1, 8, 2), at(1, 10, 4)], tips: ['B just above the first ledger line: 1st string, 7th fret, finger 1 (7th position).', 'C on the second ledger line: 8th fret, finger 2.', 'D above the second ledger line: 10th fret, finger 4.'] }),
        name(G, 'G4 A4 B4 C5 D5 E5', 12),
        play(G, 'A4 B4 C5 D5', 8, { hints: true }),
      ], [
        insight('Above the staff', 'High notes climb onto ledger lines above the staff: A on the first (1st string, 5th fret), C on the second (8th fret), E on the third (12th fret). Use them as landmarks like you did below the staff.', { kind: 'staff', clef: 'treble8vb', notes: ['A4', 'C5', 'E5'], labels: true }),
      ]),
      lesson('gt14-2', 'Seventh Position', 'learn', 'G major under the hand', [
        meet(G, 'B2 E3 A3 D4 F#4 B4', { frets: [at(6, 7, 1), at(5, 7, 1), at(4, 7, 1), at(3, 7, 1), at(2, 7, 1), at(1, 7, 1)], tips: ['Finger 1 at the 7th fret on every string: B, E, A, D, F♯, B. These are your anchors in 7th position.'] }),
        read(G, POS7, { key: 'G', guitarPosition: 7, rhythms: RH.qh, maxLeap: 2, noteNames: true }),
        read(G, POS7, { key: 'G', guitarPosition: 7, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
        gpiece('Étude in Seventh Position', 'G', [4, 4], [SEVENTH_POS_ETUDE]),
      ]),
      lesson('gt14-3', 'Ninth Position', 'learn', 'D and A major high on the neck', [
        meet(G, 'C#5 D5 E5', { frets: [at(1, 9, 1), at(1, 10, 2), at(1, 12, 4)], tips: ['C♯ on the 1st string, 9th fret, finger 1.', 'D: 10th fret, finger 2.', 'E sits on the third ledger line above: 12th fret, finger 4.'] }),
        read(G, POS9, { key: 'D', guitarPosition: 9, rhythms: RH.qh, maxLeap: 2 }),
        read(G, POS9_A, { key: 'A', guitarPosition: 9, rhythms: RH.eighths, maxLeap: 3, fingering: 'first' }),
      ]),
      lesson('gt14-4', 'Twelfth Position', 'learn', 'First position, one octave up', [
        meet(G, 'E5 F5 G5', { frets: [at(1, 12, 1), at(1, 13, 2), at(1, 15, 4)], tips: ['E on the 12th fret — the open 1st string, an octave higher.', 'F: 13th fret, finger 2.', 'G sits on the fourth ledger line above: 15th fret, finger 4.'] }),
        read(G, POS12, { guitarPosition: 12, rhythms: RH.qh, maxLeap: 2 }),
        gpiece('Ode to Joy, Up the Neck', 'C', [4, 4], [ode({ E: 'E5@1%1', F: 'F5@2%1', G: 'G5@4%1', D: 'D5@4%2', C: 'C5@2%2' })]),
      ], [
        insight('The octave fret', 'At the 12th fret every string starts over, an octave higher. The notes — and the fingering — of first position repeat exactly, twelve frets up.', { kind: 'frets', positions: [{ string: 1, fret: 12, finger: 1, label: 'E' }, { string: 1, fret: 13, finger: 2, label: 'F' }, { string: 1, fret: 15, finger: 4, label: 'G' }, { string: 2, fret: 12, finger: 1, label: 'B' }, { string: 2, fret: 13, finger: 2, label: 'C' }, { string: 2, fret: 15, finger: 4, label: 'D' }], minFret: 10, maxFret: 17 }),
      ]),
      lesson('gt14-5', 'Up to High A', 'practice', 'The top of the classical range', [
        meet(G, 'A5', { frets: [at(1, 17, 4)], tips: ['A, just above the fourth ledger line, is the top of most classical guitar music: 1st string, 17th fret. Shift so finger 4 lands on it (14th position).'] }),
        name(G, TOP, 16, { sequence: true, title: 'Note rush' }),
        read(G, TOP12, { guitarPosition: 12, rhythms: RH.eighths, maxLeap: 2, fingering: 'first' }),
        gpiece('Reaching High A', 'C', [4, 4], [HIGH_A], { prompt: 'From G (finger 4) slide finger 4 up two frets to A — a guide-finger shift into 14th position — then come back down.' }),
      ]),
      lesson('gt14-c', 'Checkpoint: High Positions', 'checkpoint', 'Fluent from 7th to 12th position', [
        name(G, 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5', 18),
        read(G, POS7, { key: 'G', guitarPosition: 7, rhythms: RH.eighthsRests, maxLeap: 3, fingering: 'first' }),
        read(G, POS12, { guitarPosition: 12, rhythms: RH.dotted, maxLeap: 3, fingering: 'none' }),
      ]),
    ], ['7th · 9th · 12th', 'Ledger lines above', 'Up to A5']),

    // ------------------------------------------------------------------ 15
    unit('gt15', 'Advanced Reading & Repertoire', 'Sixteenths, syncopation, multi-voice music and concert pieces.', [
      lesson('gt15-1', 'Sixteenth Notes', 'learn', 'Four notes per beat', [
        tip('Sixteenths', 'Four per beat: “1 e & a”. Keep strict i–m (or m–a) alternation with small movements from the knuckle, and a relaxed thumb.', { kind: 'staff', clef: 'treble8vb', notes: ['G4/s', 'F4/s', 'E4/s', 'D4/s', 'C4/q'], time: [2, 4] }),
        rhythm([4, 4], RH.sixteenths, { tempo: 60 }),
        read(G, S1234, { rhythms: RH.sixteenths, maxLeap: 2 }),
        read(G, POS5, { guitarPosition: 5, rhythms: RH.sixteenths, maxLeap: 2, fingering: 'first' }),
      ]),
      lesson('gt15-2', 'Syncopation', 'learn', 'Accents between the beats', [
        tip('Off the beat', 'Syncopation puts a long note between beats: “1 & – & ”. Keep counting steadily and let the note ride across the beat.', { kind: 'staff', clef: 'treble8vb', notes: ['C4/e', 'D4/q', 'C4/e'], time: [2, 4] }),
        rhythm([4, 4], RH.syncopation, { tempo: 66 }),
        read(G, POS1, { rhythms: RH.syncopation, maxLeap: 3, harmonic: true }),
        read(G, POS7, { key: 'G', guitarPosition: 7, rhythms: RH.syncopation, maxLeap: 3, harmonic: true, fingering: 'first' }),
      ]),
      lesson('gt15-3', 'Multi-Voice Reading', 'practice', 'Pedal notes, bass melodies and dyads up the neck', [
        gpiece('Thumb Melody', 'Am', [3, 4], [THUMB_MELODY_TOP, THUMB_MELODY_BASS], { prompt: 'This time the melody is in the bass (stems down, thumb) under a ringing open-string pedal.' }),
        read(G, POS5, { guitarPosition: 5, rhythms: RH.qh, maxLeap: 3, dyads: { chance: 0.5, intervals: [3, 6, 8, 10] }, fingering: 'first' }),
        read(G, POS7, { key: 'G', guitarPosition: 7, rhythms: RH.qh, maxLeap: 3, dyads: { chance: 0.4, intervals: [6, 10] }, fingering: 'first', title: 'Sixths and tenths in 7th position' }),
      ]),
      lesson('gt15-4', 'Concert Repertoire I', 'song', 'Romance and a Baroque dance', [
        piece('gt-romanza'),
        piece('gt-bourree-in-e-minor'),
      ]),
      lesson('gt15-5', 'Concert Repertoire II', 'song', 'Romantic pieces in the Spanish tradition', [
        piece('gt-lagrima'),
        piece('gt-malaguena'),
      ]),
      lesson('gt15-6', 'Speed Reading', 'challenge', 'Sight-read at tempo, anywhere on the neck', [
        name(G, FULL, 30, { sequence: true, title: 'Lightning round' }),
        read(G, POS1, { rhythms: RH.advanced, maxLeap: 4, harmonic: true, mode: 'tempo', tempo: 72, fingering: 'none' }),
        read(G, POS9, { key: 'D', guitarPosition: 9, rhythms: RH.advanced, maxLeap: 3, harmonic: true, mode: 'tempo', tempo: 66, fingering: 'none' }),
      ]),
      lesson('gt15-c', 'Final Exam: Guitar Treble Clef', 'checkpoint', 'Prove your mastery', [
        name(G, FULL, 30, { sequence: true }),
        keysig(G, 'C G D A F Am Em', 10),
        read(G, POS1, { rhythms: RH.advanced, maxLeap: 4, harmonic: true, dyads: { chance: 0.25, intervals: [3, 6, 10] }, mode: 'tempo', tempo: 69, fingering: 'none', measures: 6 }),
        read(G, POS7, { key: 'G', guitarPosition: 7, rhythms: RH.compoundAdv, time: [6, 8], maxLeap: 4, harmonic: true, fingering: 'none' }),
      ]),
    ], ['16ths', 'Syncopation', 'Multi-voice', 'Repertoire']),
  ],
};

/** "Play this note on string n" — connects notation reading with fretboard knowledge. */
function fretPlay(strings: number[], frets: [number, number], count: number): ActivityDef {
  return { type: 'fret-play', strings, frets, count, naturalsOnly: true, title: 'Fifth-position notes', prompt: 'Find the named note on the given string — stay between frets 4 and 8.' };
}
