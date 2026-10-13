/**
 * Piano song library: public-domain melodies (arranged) and Clef Coach originals.
 * Pitches are sounding pitches; fingering not written here is filled in by the
 * fingering engine when a song is loaded.
 */
import type { SongDef } from '../../music/parse';

type Time = [number, number];
const TRAD = 'Traditional';
const ORIGINAL = 'Clef Coach Original';

/** Shift every pitch in a voice by whole octaves and drop fingering (re-fingered for the other hand). */
function oct(voice: string, octaves: number): string {
  return voice
    .replace(/@[\d,-]+/g, '')
    .replace(/([A-G](?:##|bb|#|b|n)?)(-?\d)/g, (_, p: string, o: string) => `${p}${Number(o) + octaves}`);
}

/** Remove written fingering (let the fingering engine choose). */
const nf = (voice: string) => voice.replace(/@[\d,-]+/g, '');

function rh(id: string, title: string, composer: string, year: string | undefined, level: number, key: string, time: Time, tempo: number, voice: string, blurb: string, pickup?: string): SongDef {
  return { id, title, composer, year, instrument: 'piano', level, key, time, tempo, pickup, blurb, staves: [{ clef: 'treble', hand: 'R', voices: [voice] }] };
}

function lh(id: string, title: string, composer: string, year: string | undefined, level: number, key: string, time: Time, tempo: number, voice: string, blurb: string, pickup?: string): SongDef {
  return { id, title, composer, year, instrument: 'piano', level, key, time, tempo, pickup, blurb, staves: [{ clef: 'bass', hand: 'L', voices: [voice] }] };
}

function both(id: string, title: string, composer: string, year: string | undefined, level: number, key: string, time: Time, tempo: number, right: string, left: string, blurb: string, pickup?: string): SongDef {
  return {
    id, title, composer, year, instrument: 'piano', level, key, time, tempo, pickup, blurb,
    staves: [
      { clef: 'treble', hand: 'R', voices: [right] },
      { clef: 'bass', hand: 'L', voices: [left] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Melodies (right-hand versions, used to derive the others)
// ---------------------------------------------------------------------------

const HOT_CROSS = 'E4/q@3 D4@2 C4/h@1 | E4/q@3 D4@2 C4/h@1 | C4/q@1 C4@1 D4@2 D4@2 | E4/q@3 D4@2 C4/h@1 |';
const MARY = 'E4/q@3 D4@2 C4@1 D4@2 | E4@3 E4@3 E4/h@3 | D4/q@2 D4@2 D4/h@2 | E4/q@3 G4@5 G4/h@5 | E4/q@3 D4@2 C4@1 D4@2 | E4@3 E4@3 E4@3 E4@3 | D4@2 D4@2 E4@3 D4@2 | C4/w@1 |';
const ODE = 'E4/q@3 E4@3 F4@4 G4@5 | G4@5 F4@4 E4@3 D4@2 | C4@1 C4@1 D4@2 E4@3 | E4@3 D4@2 D4/h@2 | E4/q@3 E4@3 F4@4 G4@5 | G4@5 F4@4 E4@3 D4@2 | C4@1 C4@1 D4@2 E4@3 | D4@2 C4@1 C4/h@1 |';
const ODE_DOTTED = 'E4/q@3 E4@3 F4@4 G4@5 | G4@5 F4@4 E4@3 D4@2 | C4@1 C4@1 D4@2 E4@3 | E4/q.@3 D4/e@2 D4/h@2 | E4/q@3 E4@3 F4@4 G4@5 | G4@5 F4@4 E4@3 D4@2 | C4@1 C4@1 D4@2 E4@3 | D4/q.@2 C4/e@1 C4/h@1 |';
const LIGHTLY = 'G4/q@5 E4@3 E4/h@3 | F4/q@4 D4@2 D4/h@2 | C4/q@1 D4@2 E4@3 F4@4 | G4@5 G4@5 G4/h@5 | G4/q@5 E4@3 E4/h@3 | F4/q@4 D4@2 D4/h@2 | C4/q@1 E4@3 G4@5 G4@5 | E4/w@3 | D4/q@2 D4@2 D4@2 D4@2 | D4@2 E4@3 F4/h@4 | E4/q@3 E4@3 E4@3 E4@3 | E4@3 F4@4 G4/h@5 | G4/q@5 E4@3 E4/h@3 | F4/q@4 D4@2 D4/h@2 | C4/q@1 E4@3 G4@5 G4@5 | C4/w@1 |';
const AU_CLAIR = 'C4/q@1 C4@1 C4@1 D4@2 | E4/h@3 D4@2 | C4/q@1 E4@3 D4@2 D4@2 | C4/w@1 | C4/q@1 C4@1 C4@1 D4@2 | E4/h@3 D4@2 | C4/q@1 E4@3 D4@2 D4@2 | C4/w@1 |';
const TWINKLE = 'C4/q@1 C4@1 G4@4 G4@4 | A4@5 A4@5 G4/h@4 | F4/q@3 F4@3 E4@2 E4@2 | D4@1 D4@1 C4/h@1 | G4/q@4 G4@4 F4@3 F4@3 | E4@2 E4@2 D4/h@1 | G4/q@4 G4@4 F4@3 F4@3 | E4@2 E4@2 D4/h@1 | C4/q@1 C4@1 G4@4 G4@4 | A4@5 A4@5 G4/h@4 | F4/q@3 F4@3 E4@2 E4@2 | D4@1 D4@1 C4/h@1 |';
const JINGLE = 'E4/q@3 E4@3 E4/h@3 | E4/q@3 E4@3 E4/h@3 | E4/q@3 G4@5 C4@1 D4@2 | E4/w@3 | F4/q@4 F4@4 F4@4 F4@4 | F4@4 E4@3 E4@3 E4@3 | E4@3 D4@2 D4@2 E4@3 | D4/h@2 G4@5 | E4/q@3 E4@3 E4/h@3 | E4/q@3 E4@3 E4/h@3 | E4/q@3 G4@5 C4@1 D4@2 | E4/w@3 | F4/q@4 F4@4 F4@4 F4@4 | F4@4 E4@3 E4@3 E4@3 | G4@5 G4@5 F4@4 D4@2 | C4/w@1 |';
const LONDON = 'G4/q@4 A4@5 G4@4 F4@3 | E4@2 F4@3 G4/h@4 | D4/q@1 E4@2 F4/h@3 | E4/q@2 F4@3 G4/h@4 | G4/q@4 A4@5 G4@4 F4@3 | E4@2 F4@3 G4/h@4 | D4/h@1 G4@4 | E4/q@2 C4/h.@1 |';
const YANKEE_G = nf('G4/q@1 G4@1 A4@2 B4@3 | G4@1 B4@3 A4@2 D4@1 | G4@4 G4@4 A4@5 B4@5 | G4/h@3 F#4@2 | G4/q@3 G4@3 A4@4 B4@5 | C5@5 B4@4 A4@3 G4@2 | F#4@1 D4@1 E4@2 F#4@3 | G4/h@4 G4@4 |');
const FRERE = 'C4/q@1 D4@2 E4@3 C4@1 | C4@1 D4@2 E4@3 C4@1 | E4@3 F4@4 G4/h@5 | E4/q@3 F4@4 G4/h@5 | G4/e@4 A4@5 G4@4 F4@3 E4/q@2 C4@1 | G4/e@4 A4@5 G4@4 F4@3 E4/q@2 C4@1 | C4/q@2 G3@1 C4/h@2 | C4/q@2 G3@1 C4/h@2 |';
const SUSANNA = 'C4/e@1 D4@2 | E4/q@3 G4@4 G4/q.@4 A4/e@5 | G4/q@4 E4@3 C4/q.@1 D4/e@2 | E4/q@3 E4@3 D4@2 C4@1 | D4/h.@2 C4/e@1 D4@2 | E4/q@3 G4@4 G4/q.@4 A4/e@5 | G4/q@4 E4@3 C4/q.@1 D4/e@2 | E4/q@3 E4@3 D4@2 D4@2 | C4/h.@1 |';
const SAINTS = 'r/q C4@1 E4@3 F4@4 | G4/w@5 | r/q C4@1 E4@3 F4@4 | G4/w@5 | r/q C4@1 E4@3 F4@4 | G4/h@5 E4@3 | C4/h@1 E4@3 | D4/w@2 | r/q E4@3 E4@3 D4@2 | C4/h.@1 C4/q@1 | E4/h@3 G4/q@5 G4@5 | F4/h@4 E4/q@3 F4@4 | G4/h@5 E4@3 | C4/h@1 D4@2 | C4/w@1 |';
const AURA_LEE = 'D4/q@1 G4@3 F#4@2 G4@3 | A4@4 E4@1 A4/h@4 | G4/q@3 F#4@2 E4@1 F#4@2 | G4/w@3 | D4/q@1 G4@3 F#4@2 G4@3 | A4@4 E4@1 A4/h@4 | G4/q@3 F#4@2 E4@1 F#4@2 | G4/w@3 | B4/q@3 B4@3 B4/h@3 | B4/q@3 B4@3 B4/h@3 | B4/q@3 A4@2 G4@1 A4@2 | B4/w@3 | B4/q@3 B4@3 C5@4 B4@3 | A4@2 E4@1 A4/h@4 | G4/q@3 F#4@2 B4@5 A4@4 | G4/w@3 |';
const MINUET_G = 'D5/q@5 G4/e@1 A4@2 B4@3 C5@4 | D5/q@5 G4@1 G4@1 | E5/q@5 C5/e@1 D5@2 E5@3 F#5@4 | G5/q@5 G4@1 G4@1 | C5/q@4 D5/e@5 C5@4 B4@3 A4@2 | B4/q@3 C5/e@4 B4@3 A4@2 G4@1 | F#4/q@2 G4/e@1 A4@2 B4@3 G4@1 | A4/h.@2 | D5/q@5 G4/e@1 A4@2 B4@3 C5@4 | D5/q@5 G4@1 G4@1 | E5/q@5 C5/e@1 D5@2 E5@3 F#5@4 | G5/q@5 G4@1 G4@1 | C5/q@4 D5/e@5 C5@4 B4@3 A4@2 | B4/q@3 C5/e@4 B4@3 A4@2 G4@1 | A4/q@2 B4/e@3 A4@2 G4@1 F#4@2 | G4/h.@1 |';
const GREENSLEEVES = nf('A4/q@1 | C5/h@2 D5/q@3 | E5/q.@4 F5/e@5 E5/q@4 | D5/h@3 B4/q@1 | G4/q.@1 A4/e@2 B4/q@3 | C5/h@4 A4/q@2 | A4/q.@2 G#4/e@1 A4/q@2 | B4/h@3 G#4/q@1 | E4/h@1 A4/q@1 | C5/h@2 D5/q@3 | E5/q.@4 F5/e@5 E5/q@4 | D5/h@3 B4/q@1 | G4/q.@1 A4/e@2 B4/q@3 | C5/q.@4 B4/e@3 A4/q@2 | G#4/q.@1 F#4/e@1 G#4/q@2 | A4/h@3 |');
const GOIN_HOME = 'F#4/q@2 A4@4 A4/h@4 | F#4/q@2 E4@1 D4/h@1 | E4/q@2 F#4@3 A4@5 F#4@3 | E4/w@2 | F#4/q@2 A4@4 A4/h@4 | F#4/q@2 E4@1 D4/h@1 | E4/q@2 F#4@3 E4@2 D4@1 | D4/w@1 |';
const MOUNTAIN_KING = 'A4/e@1 B4@2 C5@3 D5@4 E5@5 C5@3 E5/q@5 | D#5/e@4 B4@2 D#5/q@4 D5/e@4 Bb4@2 D5/q@4 | A4/e@1 B4@2 C5@3 D5@4 E5@5 C5@3 E5@5 A5@5 | G5/e@4 E5@2 C5@1 E5@2 G5/h@4 | A4/e@1 B4@2 C5@3 D5@4 E5@5 C5@3 E5/q@5 | D#5/e@4 B4@2 D#5/q@4 D5/e@4 Bb4@2 D5/q@4 | A4/e@1 B4@2 C5@3 D5@4 E5@5 C5@3 E5@5 A5@5 | G5/h@4 r/h |';
const FUR_ELISE_RH = 'E5/s@5 D#5@4 | E5@5 D#5@4 E5@5 B4@2 D5@4 C5@3 | A4/e@1 r/s C4@1 E4@2 A4@3 | B4/e@4 r/s E4@2 G#4@3 B4@4 | C5/e@5 r/s E4@2 E5@5 D#5@4 | E5@5 D#5@4 E5@5 B4@2 D5@4 C5@3 | A4/e@1 r/s C4@1 E4@2 A4@3 | B4/e@4 r/s E4@2 C5@4 B4@3 | A4/q@2 |';
const CANON_RH = 'F#5/h E5 | D5/h C#5 | B4/h A4 | B4/h C#5 | D5/h C#5 | B4/h A4 | G4/h F#4 | G4/h E4 | F#4/w |';
const KLEINE = nf('G4/q@1 r/e D4/e@1 G4/q@3 r/e D4/e@1 | G4/e@3 D4@1 G4@3 B4@4 D5/q@5 r/q | C5/q@4 r/e A4/e@2 C5/q@4 r/e A4/e@2 | C5/e@4 A4@2 F#4@1 A4@2 D4/q@1 r/q | G4/w@3 |');

// ---------------------------------------------------------------------------
// Right hand alone (treble clef)
// ---------------------------------------------------------------------------

export const PIANO_RH: SongDef[] = [
  rh('prh-hot-cross-buns', 'Hot Cross Buns', TRAD, TRAD, 1, 'C', [4, 4], 84, HOT_CROSS, 'Three notes, three fingers — an old English street cry.'),
  rh('prh-mary-had-a-little-lamb', 'Mary Had a Little Lamb', 'Lowell Mason (arr.)', '1830', 1, 'C', [4, 4], 88, MARY, 'Steps and repeated notes in C position, with one jump up to G.'),
  rh('prh-ode-to-joy', 'Ode to Joy', 'Ludwig van Beethoven', '1824', 1, 'C', [4, 4], 84, ODE, 'From the Ninth Symphony, in C position with a simplified rhythm.'),
  rh('prh-ode-to-joy-original', 'Ode to Joy (original rhythm)', 'Ludwig van Beethoven', '1824', 4, 'C', [4, 4], 92, ODE_DOTTED, 'Beethoven’s real rhythm: the dotted quarter and eighth that end each phrase.'),
  rh('prh-lightly-row', 'Lightly Row', TRAD, 'German folk song', 1, 'C', [4, 4], 92, LIGHTLY, 'A German children’s song (“Hänschen klein”) that walks through all five fingers.'),
  rh('prh-au-clair-de-la-lune', 'Au Clair de la Lune', TRAD, '18th century', 1, 'C', [4, 4], 84, AU_CLAIR, 'A French lullaby by moonlight — just C, D and E.'),
  rh('prh-twinkle-twinkle', 'Twinkle, Twinkle, Little Star', TRAD, '1761 melody', 2, 'C', [4, 4], 88, TWINKLE, 'The tune Mozart wrote variations on. Your hand shifts up one key for G and A.'),
  rh('prh-jingle-bells', 'Jingle Bells (chorus)', 'James Lord Pierpont', '1857', 2, 'C', [4, 4], 100, JINGLE, 'Repeated notes keep the beat — count steadily through the long Es.'),
  rh('prh-london-bridge', 'London Bridge', TRAD, TRAD, 2, 'C', [4, 4], 92, LONDON, 'Your hand moves between C and D positions — watch the fingering.'),
  rh('prh-frere-jacques', 'Frère Jacques', TRAD, '18th century', 3, 'C', [4, 4], 92, FRERE, 'The famous round. Eighth notes appear in the “ding, dang, dong” bars.'),
  rh('prh-oh-susanna', 'Oh! Susanna', 'Stephen Foster', '1848', 3, 'C', [4, 4], 100, SUSANNA, 'Starts with a two-eighth-note pickup. G and A use fingers 4 and 5.', 'q'),
  rh('prh-when-the-saints', 'When the Saints Go Marching In', TRAD, 'Spiritual', 3, 'C', [4, 4], 104, SAINTS, 'Feel the rests at the start of each phrase — they’re part of the swing.'),
  rh('prh-aura-lee', 'Aura Lee', 'George R. Poulton', '1861', 4, 'G', [4, 4], 80, AURA_LEE, 'A Civil-War ballad in G major — every F is sharp. (Elvis later sang it as “Love Me Tender”.)'),
  rh('prh-yankee-doodle', 'Yankee Doodle', TRAD, 'c. 1775', 4, 'G', [4, 4], 112, YANKEE_G, 'In G major with a hand shift in the middle — look ahead for it.'),
  rh(
    'prh-meadow-in-f',
    'Meadow in F',
    ORIGINAL,
    undefined,
    4,
    'F',
    [3, 4],
    96,
    'F4/q@1 A4@3 C5@5 | Bb4/h@4 A4/q@3 | G4/q@2 Bb4@4 G4@2 | A4/h.@3 | C5/q@5 Bb4@4 A4@3 | G4/q@2 A4@3 F4@1 | G4/q@2 E4@1 G4@3 | F4/h.@2 | A4/q@3 Bb4@4 C5@5 | D5/h@5 C5/q@4 | Bb4/q@3 A4@2 G4@1 | A4/h.@2 | Bb4/q@3 G4@1 E4@1 | F4/q@1 A4@3 C5@5 | Bb4/q@4 G4@2 E4@1 | F4/h.@1 |',
    'A gentle waltz in F major: every B is B♭, played by finger 4.',
  ),
  rh('prh-minuet-in-g', 'Minuet in G', 'Christian Petzold (attr. J. S. Bach)', 'c. 1725', 4, 'G', [3, 4], 104, MINUET_G, 'From the Notebook for Anna Magdalena Bach. Watch the thumb on every G.'),
  rh('prh-greensleeves', 'Greensleeves', TRAD, '16th century', 4, 'Am', [3, 4], 88, GREENSLEEVES, 'A Tudor ballad in A minor with a lilting dotted rhythm and a G♯ at each cadence.', 'q'),
  rh(
    'prh-country-dance',
    'Country Dance',
    ORIGINAL,
    undefined,
    4,
    'G',
    [2, 4],
    100,
    nf('G4/e@1 B4@3 D5@5 B4@3 | C5/q.@4 A4/e@2 | B4/e@3 G4@1 A4@2 F#4@1 | G4/q@2 D4@1 | G4/e@1 B4@3 D5@5 B4@3 | C5/e@4 E5@5 D5@4 C5@3 | B4/e@2 A4@1 B4@2 C5@3 | D5/q@4 r/q | E5/e@5 D5@4 C5@3 B4@2 | C5/q.@3 A4/e@1 | D5/e@4 C5@3 B4@2 A4@1 | B4/q.@2 G4/e@1 | C5/e@4 B4@3 A4@2 G4@1 | F#4/e@1 A4@3 D5@5 C5@4 | B4/e@3 A4@2 B4@3 F#4@1 | G4/q@2 r/q |'),
    'A quick folk dance with crossings — keep the eighth notes light and even.',
  ),
  rh(
    'prh-dorian-air',
    'Dorian Air',
    ORIGINAL,
    undefined,
    4,
    'Dm',
    [3, 4],
    84,
    nf('D4/h@1 D4/q@1 | A4/h@5 A4/q@5 | F4/q.@3 G4/e@4 F4/q@3 | E4/h.@2 | D4/h@1 F4/q@3 | G4/q@4 A4@5 B4@5 | A4/q.@4 G4/e@3 F4/q@2 | G4/h.@3 | A4/h@1 C5/q@3 | D5/h@4 C5/q@3 | A4/q@1 B4@2 G4@1 | A4/h.@2 | F4/q@1 E4@1 D4@1 | E4/q@2 F4@3 G4@4 | E4/h@2 C4/q@1 | D4/h.@1 |'),
    'An original song in the Dorian mode: D minor with a bright B natural.',
  ),
  rh('prh-eine-kleine-nachtmusik', 'Eine kleine Nachtmusik (opening)', 'Wolfgang Amadeus Mozart', '1787', 5, 'G', [4, 4], 120, KLEINE, 'Mozart’s famous fanfare: arpeggios that climb up a G chord, then a D chord.'),
  rh('prh-largo-new-world', 'Goin’ Home (Largo)', 'Antonín Dvořák', '1893', 5, 'D', [4, 4], 60, GOIN_HOME, 'The slow cor anglais theme from the “New World” Symphony, in D major.'),
  rh('prh-fur-elise', 'Für Elise (theme)', 'Ludwig van Beethoven', '1810', 5, 'Am', [3, 8], 66, FUR_ELISE_RH, 'The right-hand part of the famous opening. Sixteenths — keep the D♯–E alternation relaxed.', 'e'),
  rh('prh-canon-in-d', 'Canon in D (melody)', 'Johann Pachelbel', 'c. 1690', 5, 'D', [4, 4], 66, CANON_RH, 'The first two violin lines of Pachelbel’s Canon: two slow descending scales.'),
  rh('prh-mountain-king', 'In the Hall of the Mountain King', 'Edvard Grieg', '1875', 6, 'Am', [4, 4], 100, MOUNTAIN_KING, 'From Peer Gynt: a sneaky staccato theme that creeps upward (transposed to A minor).'),
  rh(
    'prh-perpetual-motion',
    'Perpetual Motion',
    ORIGINAL,
    undefined,
    6,
    'C',
    [4, 4],
    84,
    nf('C5/s@1 D5@2 E5@3 C5@1 D5@2 E5@3 F5@4 D5@2 E5@3 F5@4 G5@5 E5@3 F5@4 D5@2 E5@3 C5@1 | D5/s@2 B4@1 C5@2 A4@1 B4@2 G4@1 A4@2 F4@1 G4@2 E4@1 F4@2 D4@1 E4@2 C4@1 D4@2 B3@1 | C4/s@1 E4@2 G4@3 C5@5 G4@3 E4@2 C4@1 E4@2 F4@1 A4@2 C5@3 F5@5 C5@3 A4@2 F4@1 A4@2 | G4/s@1 B4@2 D5@3 G5@5 F5@4 D5@2 B4@1 D5@2 C5/q@1 r/q |'),
    'A sixteenth-note study: scales, crossings and broken chords in one breath.',
  ),
  rh(
    'prh-ragtime-strut',
    'Ragtime Strut',
    ORIGINAL,
    undefined,
    7,
    'C',
    [2, 4],
    88,
    nf('E5/s@3 C5/e@1 E5/s@3 C5/e@1 E5/s@3 G5/s@5 | G5/q@5 r/s E5@3 F5@4 F#5@5 | G5/s@5 E5/e@3 C5/s@1 D5/e@2 E5/s@3 C5/s@1 | D5/q@2 r/s D5@2 D#5@3 E5@4 | C5/s@1 A4/e@1 C5/s@2 E5/e@4 D5/s@3 C5/s@2 | B4/s@1 D5/e@3 G5/s@5 F5/e@4 D5/s@2 B4/s@1 | C5/e@1 E5@3 G5/s@5 E5@3 C5@1 G4@1 | C5/q@2 r/q |'),
    'Syncopation in the style of 1900s ragtime: accents land between the beats.',
  ),
  rh(
    'prh-toccata-in-a-minor',
    'Toccatina in A minor',
    ORIGINAL,
    undefined,
    7,
    'Am',
    [2, 4],
    92,
    nf('A4/s@1 E5@4 C5@2 E5@4 A4@1 E5@4 C5@2 E5@4 | B4/s@1 E5@4 D5@3 E5@4 B4@1 E5@4 D5@3 E5@4 | C5/s@1 A5@5 E5@3 A5@5 B4@1 G#5@5 E5@3 G#5@5 | A5/s@5 E5@3 C5@2 A4@1 E5/e@3 r/e | F5/s@4 D5@2 A4@1 D5@2 F5@4 D5@2 A4@1 D5@2 | E5/s@5 C5@3 A4@1 C5@3 E5@5 C5@3 A4@1 C5@3 | D5/s@3 B4@2 G#4@1 B4@2 E5@4 D5@3 C5@2 B4@1 | A4/q@1 r/q |'),
    'Bright broken-chord figures in A minor — a showpiece for a nimble right hand.',
  ),
];

// ---------------------------------------------------------------------------
// Left hand alone (bass clef)
// ---------------------------------------------------------------------------

export const PIANO_LH: SongDef[] = [
  lh('plh-hot-cross-buns', 'Hot Cross Buns (left hand)', TRAD, TRAD, 1, 'Am', [4, 4], 84, 'C4/q@1 B3@2 A3/h@3 | C4/q@1 B3@2 A3/h@3 | A3/q@3 A3@3 B3@2 B3@2 | C4/q@1 B3@2 A3/h@3 |', 'Middle C, B and A — thumb, 2 and 3 walking down the top of the bass staff.'),
  lh('plh-mary-had-a-little-lamb', 'Mary Had a Little Lamb (left hand)', 'Lowell Mason (arr.)', '1830', 1, 'F', [4, 4], 88, 'A3/q@3 G3@4 F3@5 G3@4 | A3@3 A3@3 A3/h@3 | G3/q@4 G3@4 G3/h@4 | A3/q@3 C4@1 C4/h@1 | A3/q@3 G3@4 F3@5 G3@4 | A3@3 A3@3 A3@3 A3@3 | G3@4 G3@4 A3@3 G3@4 | F3/w@5 |', 'In Middle C position: F, the clef’s own line, is home.'),
  lh('plh-lantern-walk', 'Lantern Walk', ORIGINAL, undefined, 1, 'C', [4, 4], 84, 'F3/q@5 G3@4 A3@3 B3@2 | C4/h@1 A3@3 | B3/q@2 A3@3 G3@4 B3@2 | A3/w@3 | C4/q@1 B3@2 A3@3 G3@4 | A3/h@3 C4@1 | B3/q@2 A3@3 G3@4 G3@4 | F3/w@5 |', 'All five fingers of the Middle C position, F to C — with a dreamy B natural.'),
  lh('plh-au-clair-de-la-lune', 'Au Clair de la Lune (left hand)', TRAD, '18th century', 1, 'F', [4, 4], 84, 'F3/q@5 F3@5 F3@5 G3@4 | A3/h@3 G3@4 | F3/q@5 A3@3 G3@4 G3@4 | F3/w@5 | F3/q@5 F3@5 F3@5 G3@4 | A3/h@3 G3@4 | F3/q@5 A3@3 G3@4 G3@4 | F3/w@5 |', 'The French moon song, low and calm: F, G and A.'),
  lh('plh-quiet-waltz', 'Quiet Waltz', ORIGINAL, undefined, 2, 'C', [3, 4], 96, 'F3/q@5 A3@3 C4@1 | B3/h@2 A3/q@3 | G3/q@4 r/q G3@4 | A3/h.@3 | C4/q@1 B3@2 A3@3 | G3/q@4 F3@5 G3@4 | A3/q@3 r/q G3@4 | F3/h.@5 |', 'Count ONE-two-three — the rests are part of the dance.'),
  lh('plh-ode-to-joy', 'Ode to Joy (left hand)', 'Ludwig van Beethoven', '1824', 2, 'C', [4, 4], 84, oct(ODE, -1), 'Beethoven’s melody an octave lower, in bass C position (finger 5 on C).'),
  lh('plh-london-bridge', 'London Bridge (left hand)', TRAD, TRAD, 2, 'G', [4, 4], 92, 'D3/q@1 E3@1 D3@1 C3@2 | B2@3 C3@2 D3/h@1 | A2/q@4 B2@3 C3/h@2 | B2/q@3 C3@2 D3/h@1 | D3/q@1 E3@1 D3@1 C3@2 | B2@3 C3@2 D3/h@1 | A2/h@4 D3@1 | B2/q@3 G2/h.@5 |', 'In G position — the low G on the bottom line is home.'),
  lh('plh-jingle-bells', 'Jingle Bells (left hand)', 'James Lord Pierpont', '1857', 3, 'C', [4, 4], 100, oct(JINGLE, -1), 'The chorus in the bass — bass C position all the way.'),
  lh('plh-yankee-doodle', 'Yankee Doodle (left hand)', TRAD, 'c. 1775', 3, 'C', [4, 4], 112, 'C3/q C3 D3 E3 | C3 E3 D3 G2 | C3 C3 D3 E3 | C3/h B2 | C3/q C3 D3 E3 | F3 E3 D3 C3 | B2 G2 A2 B2 | C3/h C3 |', 'From the bottom line to the fourth line — the whole middle of the bass staff.'),
  lh('plh-when-the-saints', 'When the Saints (left hand)', TRAD, 'Spiritual', 3, 'C', [4, 4], 104, oct(SAINTS, -1), 'The marching tune an octave down. Count the rest before each “Oh when the”.'),
  lh('plh-oh-susanna', 'Oh! Susanna (left hand)', 'Stephen Foster', '1848', 3, 'C', [4, 4], 100, oct(SUSANNA, -1), 'Eighth-note pickups in the bass clef.', 'q'),
  lh('plh-aura-lee', 'Aura Lee (left hand)', 'George R. Poulton', '1861', 4, 'G', [4, 4], 80, oct(AURA_LEE, -1), 'In G major: F♯ sits on the fourth line of the bass staff.'),
  lh('plh-frere-jacques', 'Frère Jacques (left hand, in F)', TRAD, '18th century', 4, 'F', [4, 4], 92, 'F3/q G3 A3 F3 | F3 G3 A3 F3 | A3 Bb3 C4/h | A3/q Bb3 C4/h | C4/e D4 C4 Bb3 A3/q F3 | C4/e D4 C4 Bb3 A3/q F3 | F3/q C3 F3/h | F3/q C3 F3/h |', 'The round in F major — B♭ in the third bar.'),
  lh('plh-climbing-song', 'Climbing Song', ORIGINAL, undefined, 4, 'G', [4, 4], 88, 'G2/q@5 A2@4 B2@3 C3@2 | D3@1 E3@3 F#3@2 G3@1 | F#3/q@2 E3@3 D3@1 C3@2 | B2/h@3 G2@5 | B2/q@3 C3@2 D3@1 E3@3 | F#3@2 G3@1 A3@2 B3@1 | A3/q@2 G3@1 F#3@2 E3@3 | D3/h@1 G2@5 |', 'Scale steps with finger crossings — 3 over the thumb going up, thumb under coming down.'),
  lh('plh-minuet-in-g', 'Minuet in G (left hand)', 'Christian Petzold (attr. J. S. Bach)', 'c. 1725', 5, 'G', [3, 4], 100, oct(MINUET_G, -2), 'The famous minuet tune, two octaves down — a real workout for the left hand.'),
  lh('plh-greensleeves', 'Greensleeves (left hand)', TRAD, '16th century', 5, 'Am', [3, 4], 88, oct(GREENSLEEVES, -2), 'The Tudor ballad low in the bass, from low E to the top of the staff.', 'q'),
  lh('plh-dorian-air', 'Dorian Air (left hand)', ORIGINAL, undefined, 5, 'Dm', [3, 4], 84, 'D3/h D3/q | A3/h A3/q | F3/q. G3/e F3/q | E3/h. | D3/h F3/q | G3/q A3 B3 | A3/q. G3/e F3/q | G3/h. | A3/h C4/q | D4/h C4/q | A3/q B3 G3 | A3/h. | F3/q E3 D3 | E3/q F3 G3 | E3/h C3/q | D3/h. |', 'A modal song in the bass: D minor with a B natural.'),
  lh('plh-hall-of-the-mountain-king', 'In the Hall of the Mountain King (left hand)', 'Edvard Grieg', '1875', 6, 'Am', [4, 4], 96, oct(MOUNTAIN_KING, -2), 'Grieg’s creeping theme in the low register — ledger lines below the staff.'),
  lh('plh-boatmans-song', 'Boatman’s Song', ORIGINAL, undefined, 6, 'Em', [4, 4], 72, 'E2/q B2 E2 G2 | F#2/h B1/h | E2/q G2 B2 E3 | D3/h B2/h | C3/q B2 A2 G2 | F#2/q E2 D2 F#2 | E2/q B1 E2 G2 | E2/w |', 'A heavy, rowing rhythm deep in the bass — ledger lines below the staff.'),
  lh('plh-canon-in-d', 'Canon in D (bass line)', 'Johann Pachelbel', 'c. 1690', 6, 'D', [4, 4], 72, 'D3/h A2 | B2/h F#2 | G2/h D2 | G2/h A2 | D3/h A2 | B2/h F#2 | G2/h D2 | G2/h A2 | D3/q F#3 A2 C#3 | B2 D3 F#2 A2 | G2 B2 D2 F#2 | G2 B2 A2 C#3 | D3/q F#3 A2 C#3 | B2 D3 F#2 A2 | G2 B2 D2 F#2 | G2 A2 D2/h |', 'The most famous bass line ever written — first in half notes, then filled in.'),
  lh('plh-largo-new-world', 'Goin’ Home (left hand)', 'Antonín Dvořák', '1893', 6, 'D', [4, 4], 60, oct(GOIN_HOME, -1), 'Dvořák’s Largo theme, sung by the left hand.'),
  lh('plh-cello-song', 'Cello Song', ORIGINAL, undefined, 7, 'G', [4, 4], 66, 'G2/q. B2/e D3/q G3/q | F#3/h. E3/q | D3/q. C3/e B2/q A2/q | B2/h. D3/q | G3/q. A3/e B3/q G3/q | E3/h C4/h | B3/q. A3/e G3/q F#3/q | G3/w |', 'A singing, cello-like melody across two octaves of the bass staff.'),
  lh('plh-cello-suite-prelude', 'Cello Suite No. 1 — Prelude (opening)', 'Johann Sebastian Bach', 'c. 1720', 7, 'G', [4, 4], 72, 'G2/s D3 B3 A3 B3 D3 B3 D3 G2 D3 B3 A3 B3 D3 B3 D3 | G2/s E3 C4 B3 C4 E3 C4 E3 G2 E3 C4 B3 C4 E3 C4 E3 | G2/s F#3 C4 B3 C4 F#3 C4 F#3 G2 F#3 C4 B3 C4 F#3 C4 F#3 | G2/s G3 B3 A3 B3 G3 B3 F#3 G2/h |', 'Bach’s famous broken chords over an open G — written for cello, perfect for the left hand.'),
  lh('plh-thunder-etude', 'Thunder Étude', ORIGINAL, undefined, 8, 'Cm', [4, 4], 80, 'C2/e C3 G2 Eb3 C2 C3 G2 Eb3 | Ab1/e Ab2 Eb2 C3 Ab1 Ab2 Eb2 C3 | F1/e F2 C2 Ab2 G1 G2 D2 B2 | C2/e C3 G2 Eb3 C2/h |', 'Octave leaps and rumbling broken chords far below the staff.'),
];

// ---------------------------------------------------------------------------
// Both hands (grand staff)
// ---------------------------------------------------------------------------

export const PIANO_BOTH: SongDef[] = [
  both('p2-hot-cross-buns', 'Hot Cross Buns (hands together)', TRAD, TRAD, 2, 'C', [4, 4], 80, HOT_CROSS, 'C3/w@5 | C3/w@5 | G3/w@1 | C3/w@5 |', 'The left hand holds a low note while the right hand plays the tune.'),
  both('p2-mary-had-a-little-lamb', 'Mary Had a Little Lamb (hands together)', 'Lowell Mason (arr.)', '1830', 2, 'C', [4, 4], 84, MARY, 'C3/w@5 | C3/w@5 | G3/w@1 | C3/w@5 | C3/w@5 | C3/w@5 | G3/w@1 | C3/w@5 |', 'Both hands in C position: the left hand changes note only on beat one.'),
  both('p2-ode-to-joy', 'Ode to Joy (hands together)', 'Ludwig van Beethoven', '1824', 3, 'C', [4, 4], 80, ODE, 'C3/h@5 E3@3 | G3/h@1 D3@4 | C3/h@5 E3@3 | G3/h@1 G3@1 | C3/h@5 E3@3 | G3/h@1 D3@4 | C3/h@5 E3@3 | G3/h@1 C3@5 |', 'Half notes in the left hand under Beethoven’s tune.'),
  both('p2-twinkle-twinkle', 'Twinkle, Twinkle (hands together)', TRAD, '1761 melody', 3, 'C', [4, 4], 84, TWINKLE, 'C3/w@5 | F3/h@2 C3@5 | F3/h@2 C3@5 | G3/h@1 C3@5 | C3/h@5 F3@2 | C3/h@5 G3@1 | C3/h@5 F3@2 | C3/h@5 G3@1 | C3/w@5 | F3/h@2 C3@5 | F3/h@2 C3@5 | G3/h@1 C3@5 |', 'The left hand plays the chord roots: C, F and G.'),
  both('p2-lightly-row', 'Lightly Row (hands together)', TRAD, 'German folk song', 3, 'C', [4, 4], 88, LIGHTLY, 'C3/w@5 | G3/w@1 | C3/w@5 | E3/h@3 C3@5 | C3/w@5 | G3/w@1 | C3/h@5 E3@3 | C3/w@5 | G3/w@1 | G3/w@1 | C3/w@5 | C3/w@5 | C3/w@5 | G3/w@1 | C3/h@5 E3@3 | C3/w@5 |', 'Long left-hand notes; count all four beats.'),
  both('p2-london-bridge', 'London Bridge (hands together)', TRAD, TRAD, 3, 'C', [4, 4], 88, LONDON, 'C3/w@5 | C3/w@5 | G3/w@1 | C3/w@5 | C3/w@5 | C3/w@5 | G3/w@1 | C3/w@5 |', 'Left hand: C and G only. Right hand: a small shift up for A.'),
  both('p2-jingle-bells', 'Jingle Bells (hands together)', 'James Lord Pierpont', '1857', 3, 'C', [4, 4], 96, JINGLE, 'C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 | F3/w@2 | C3/w@5 | G3/w@1 | G3/w@1 | C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 | F3/w@2 | C3/w@5 | G3/w@1 | C3/w@5 |', 'The left hand changes harmony under the repeated Fs and Ds.'),
  both('p2-when-the-saints', 'When the Saints (hands together)', TRAD, 'Spiritual', 4, 'C', [4, 4], 100, SAINTS, 'C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 | C3/w@5 | G3/w@1 | G3/w@1 | C3/w@5 | C3/w@5 | F3/w@2 | C3/w@5 | G3/w@1 | C3/w@5 |', 'Keep the left hand steady while the right hand marches.'),
  both('p2-oh-susanna', 'Oh! Susanna (hands together)', 'Stephen Foster', '1848', 4, 'C', [4, 4], 96, SUSANNA, 'r/q | C3/h@5 G3@1 | C3/h@5 G3@1 | C3/h@5 E3@3 | G3/w@1 | C3/h@5 G3@1 | C3/h@5 G3@1 | G3/h@1 G3@1 | C3/h.@5 |', 'Roots and fifths in the left hand under a syncopated tune.', 'q'),
  both('p2-yankee-doodle', 'Yankee Doodle (hands together)', TRAD, 'c. 1775', 4, 'G', [4, 4], 104, YANKEE_G, 'G2/h@5 D3@1 | G2/h@5 D3@1 | G2/h@5 D3@1 | G2/h@5 D3@1 | G2/h@5 D3@1 | C3/h@2 G2@5 | D3/w@1 | G2/w@5 |', 'G major with both hands: the left hand rocks between G and D.'),
  both('p2-aura-lee', 'Aura Lee (hands together)', 'George R. Poulton', '1861', 4, 'G', [4, 4], 76, AURA_LEE, 'G2/w | A2/w | D3/w | G2/w | G2/w | A2/w | D3/w | G2/w | G2/w | B2/w | E2/w | G2/w | C3/w | C3/w | D3/w | G2/w |', 'Whole-note roots in the bass under the 1861 ballad.'),
  both('p2-frere-jacques', 'Frère Jacques (round for two hands)', TRAD, '18th century', 5, 'C', [4, 4], 88, FRERE + ' r/w | r/w |', 'r/w | r/w | ' + oct(FRERE, -1), 'A real canon: the left hand plays the same tune, two bars behind.'),
  both('p2-minuet-in-g', 'Minuet in G', 'Christian Petzold (attr. J. S. Bach)', 'c. 1725', 5, 'G', [3, 4], 96, MINUET_G, 'G3/h. | B3/h. | C4/h. | B3/h. | A3/h. | G3/h. | D3/h. | D3/h. | G3/h. | B3/h. | C4/h. | B3/h. | A3/h. | G3/h. | D3/h. | G2/h. |', 'The famous minuet with a simple bass (arranged): one long left-hand note per bar.'),
  both('p2-greensleeves', 'Greensleeves', TRAD, '16th century', 5, 'Am', [3, 4], 84, GREENSLEEVES, 'r/q | A2/h. | C3/h. | G2/h. | G2/h. | A2/h. | A2/h. | E2/h. | A2/h. | A2/h. | C3/h. | G2/h. | E2/h. | A2/h. | E2/h. | A2/h |', 'The ballad over long bass notes in A minor (arranged).', 'q'),
  both('p2-goin-home', 'Goin’ Home (Largo)', 'Antonín Dvořák', '1893', 5, 'D', [4, 4], 58, GOIN_HOME, '[D3 A3]/w | [D3 A3]/w | [D3 A3]/w | [A2 E3]/w | [D3 A3]/w | [D3 A3]/w | [A2 E3]/w | [D3 A3]/w |', 'Dvořák’s hymn-like theme over open fifths in the left hand.'),
  both(
    'p2-cradle-song',
    'Cradle Song',
    ORIGINAL,
    undefined,
    5,
    'F',
    [3, 4],
    92,
    nf('A4/h@3 G4/q@2 | F4/h@1 C5/q@5 | Bb4/h@4 A4/q@3 | G4/h.@2 | A4/h@3 Bb4/q@4 | C5/h@5 A4/q@3 | G4/q@2 F4@1 E4@1 | F4/h.@2 |'),
    'F2/q@5 [A2 C3]@3,1 [A2 C3]@3,1 | F2/q@5 [A2 C3]@3,1 [A2 C3]@3,1 | F2/q@5 [Bb2 D3]@2,1 [Bb2 D3]@2,1 | C2/q@5 [Bb2 E3]@2,1 [Bb2 E3]@2,1 | F2/q@5 [A2 C3]@3,1 [A2 C3]@3,1 | F2/q@5 [A2 C3]@3,1 [A2 C3]@3,1 | C2/q@5 [Bb2 E3]@2,1 [Bb2 E3]@2,1 | F2/q@5 [A2 C3]@3,1 r/q |',
    'An original lullaby with a rocking waltz bass: low note, then two chords.',
  ),
  both(
    'p2-festive-march',
    'Festive March',
    ORIGINAL,
    undefined,
    5,
    'D',
    [4, 4],
    100,
    'D5/q@5 A4@2 F#4@1 A4@2 | D5/h@5 A4@2 | B4/q@3 C#5@4 D5@5 B4@3 | A4/w@2 | G4/q@1 B4@3 A4@2 G4@1 | F#4@2 A4@4 D5@5 F#4@1 | E4/q@1 F#4@2 G4@3 E4@1 | D4/w@1 |',
    '[D3 F#3 A3]/h@5,3,1 [D3 F#3 A3]@5,3,1 | [D3 F#3 A3]/h@5,3,1 [D3 F#3 A3]@5,3,1 | [D3 G3 B3]/h@5,2,1 [D3 G3 B3]@5,2,1 | [C#3 E3 A3]/w@5,3,1 | [D3 G3 B3]/h@5,2,1 [D3 G3 B3]@5,2,1 | [D3 F#3 A3]/h@5,3,1 [D3 F#3 A3]@5,3,1 | [C#3 E3 A3]/h@5,3,1 [C#3 G3 A3]@5,2,1 | [D3 F#3 A3]/w@5,3,1 |',
    'Blocked chords in the left hand — I, IV and V in D major — under a bright tune.',
  ),
  both('p2-canon-in-d', 'Canon in D', 'Johann Pachelbel', 'c. 1690', 6, 'D', [4, 4], 66, CANON_RH, 'D3/h A2 | B2/h F#2 | G2/h D2 | G2/h A2 | D3/h A2 | B2/h F#2 | G2/h D2 | G2/h A2 | D3/w |', 'The famous ground bass with the violin melodies on top (arranged).'),
  both(
    'p2-sonatina-classica',
    'Sonatina Classica',
    ORIGINAL,
    undefined,
    6,
    'C',
    [4, 4],
    96,
    'C5/h@1 E5/q@3 G5@5 | F5/q@4 E5@3 D5@2 C5@1 | B4/h@1 D5/q@3 F5@5 | E5/q@4 D5@3 C5@2 B4@1 | A4/q@1 C5@3 F5@5 E5@4 | D5/q@3 F5@5 B4@1 D5@3 | C5/q@2 E5@4 G4@1 B4@3 | C5/w@4 |',
    'C3/e@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | C3/e@5 A3@1 F3@2 A3@1 C3@5 A3@1 F3@2 A3@1 | B2/e@5 G3@1 D3@3 G3@1 B2@5 G3@1 D3@3 G3@1 | C3/e@5 G3@1 E3@3 G3@1 C3@5 G3@1 E3@3 G3@1 | F2/e@5 C3@2 A2@4 C3@2 F2@5 C3@2 A2@4 C3@2 | G2/e@5 D3@2 B2@3 D3@2 G2@5 D3@2 B2@3 D3@2 | C3/e@5 G3@1 E3@3 G3@1 G2@5 D3@2 B2@3 D3@2 | C3/w@5 |',
    'An original sonatina in the classical style: a singing melody over Alberti bass.',
  ),
  both(
    'p2-musette',
    'Musette',
    ORIGINAL,
    undefined,
    6,
    'D',
    [2, 4],
    96,
    'A5/e@5 F#5@3 D5@1 F#5@3 | A5/q@5 F#5@3 | G5/e@4 E5@2 C#5@1 E5@2 | G5/q@4 E5@2 | F#5/e@3 A5@5 G5@4 F#5@3 | E5/e@2 G5@4 F#5@3 E5@2 | D5/e@1 F#5@3 E5@2 C#5@1 | D5/q@1 r/q |',
    '[D2 A2]/q@5,1 [D2 A2]@5,1 | [D2 A2]/q@5,1 [D2 A2]@5,1 | [A1 E2]/q@5,1 [A1 E2]@5,1 | [A1 E2]/q@5,1 [A1 E2]@5,1 | [D2 A2]/q@5,1 [D2 A2]@5,1 | [A1 E2]/q@5,1 [A1 E2]@5,1 | [A1 E2]/q@5,1 [A1 E2]@5,1 | [D2 A2]/q@5,1 r/q |',
    'A bagpipe dance: the left hand drones open fifths while the right hand skips.',
  ),
  both(
    'p2-minuet-in-a-minor',
    'Minuet in A minor',
    ORIGINAL,
    undefined,
    6,
    'Am',
    [3, 4],
    100,
    nf('E5/q@5 A4/e@1 B4@2 C5@3 D5@4 | E5/q@5 A4@1 A4@1 | F5/q@5 D5/e@3 E5@4 F5@5 D5@3 | E5/h.@4 | C5/q@3 D5/e@4 C5@3 B4@2 A4@1 | B4/q@2 C5/e@3 B4@2 A4@1 G#4@1 | A4/q@1 B4@2 G#4@1 | A4/h.@1 |'),
    nf('A2/h.@5 | C3/h.@3 | D3/h.@2 | E3/q@1 E2@5 G#2@4 | A2/h.@5 | E2/h.@5 | F2/q@4 D2@5 E2@5 | A2/h.@1 |'),
    'An original two-part minuet in the style of Bach’s Notebook pieces.',
  ),
  both('p2-fur-elise', 'Für Elise (A section)', 'Ludwig van Beethoven', '1810', 7, 'Am', [3, 8], 60, FUR_ELISE_RH, 'r/e | r/q. | A2/s@5 E3@2 A3@1 r/e. | E2/s@5 E3@2 G#3@1 r/e. | A2/s@5 E3@2 A3@1 r/e. | r/q. | A2/s@5 E3@2 A3@1 r/e. | E2/s@5 E3@2 G#3@1 r/e. | A2/s@5 E3@2 A3@1 r/s |', 'The famous opening, hands passing the music back and forth.', 'e'),
  both(
    'p2-prelude-in-c',
    'Prelude in C (opening)',
    'Johann Sebastian Bach',
    '1722',
    7,
    'C',
    [4, 4],
    60,
    'r/e G4/s@1 C5@3 E5@5 G4@1 C5@3 E5@5 r/e G4/s@1 C5@3 E5@5 G4@1 C5@3 E5@5 | r/e A4/s@1 D5@3 F5@5 A4@1 D5@3 F5@5 r/e A4/s@1 D5@3 F5@5 A4@1 D5@3 F5@5 | r/e G4/s@1 D5@3 F5@5 G4@1 D5@3 F5@5 r/e G4/s@1 D5@3 F5@5 G4@1 D5@3 F5@5 | r/e G4/s@1 C5@3 E5@5 G4@1 C5@3 E5@5 r/e G4/s@1 C5@3 E5@5 G4@1 C5@3 E5@5 | r/e A4/s@1 E5@3 A5@5 A4@1 E5@3 A5@5 r/e A4/s@1 E5@3 A5@5 A4@1 E5@3 A5@5 | r/e F#4/s@1 A4@2 D5@5 F#4@1 A4@2 D5@5 r/e F#4/s@1 A4@2 D5@5 F#4@1 A4@2 D5@5 | r/e G4/s@1 D5@3 G5@5 G4@1 D5@3 G5@5 r/e G4/s@1 D5@3 G5@5 G4@1 D5@3 G5@5 | r/e E4/s@1 G4@2 C5@5 E4@1 G4@2 C5@5 r/e E4/s@1 G4@2 C5@5 E4@1 G4@2 C5@5 | [E4 G4 C5]/w@1,2,5 |',
    '[C4 E4]/h@2,1 [C4 E4]@2,1 | [C4 D4]/h@2,1 [C4 D4]@2,1 | [B3 D4]/h@2,1 [B3 D4]@2,1 | [C4 E4]/h@2,1 [C4 E4]@2,1 | [C4 E4]/h@2,1 [C4 E4]@2,1 | [C4 D4]/h@2,1 [C4 D4]@2,1 | [B3 D4]/h@2,1 [B3 D4]@2,1 | [B3 C4]/h@2,1 [B3 C4]@2,1 | [C3 G3]/w@5,1 |',
    'The opening of the Well-Tempered Clavier (simplified: the left hand plays its two notes together).',
  ),
  both(
    'p2-gymnopedie-1',
    'Gymnopédie No. 1 (opening)',
    'Erik Satie',
    '1888',
    7,
    'D',
    [3, 4],
    66,
    'r/h. | r/h. | r/h. | r/h. | r/q F#5/q@3 A5/q@5 | G5/q@4 F#5@3 C#5@1 | B4/q@1 C#5@2 D5@3 | A4/h.@1 | F#4/h.@1~ | F#4/h.@1 |',
    'G2/q@5 [B3 D4 F#4]/h@3,2,1 | D2/q@5 [A3 C#4 F#4]/h@3,2,1 | G2/q@5 [B3 D4 F#4]/h@3,2,1 | D2/q@5 [A3 C#4 F#4]/h@3,2,1 | G2/q@5 [B3 D4 F#4]/h@3,2,1 | D2/q@5 [A3 C#4 F#4]/h@3,2,1 | G2/q@5 [B3 D4 F#4]/h@3,2,1 | D2/q@5 [A3 C#4 F#4]/h@3,2,1 | G2/q@5 [B3 D4 F#4]/h@3,2,1 | D2/q@5 [A3 C#4 F#4]/h@3,2,1 |',
    'Satie’s slow dance: a low bass note leaps up to a soft chord, beat after beat.',
  ),
  both(
    'p2-ragtime',
    'Ragtime Promenade',
    ORIGINAL,
    undefined,
    8,
    'C',
    [2, 4],
    84,
    nf('E5/s@3 C5/e@1 E5/s@3 C5/e@1 E5/s@3 G5/s@5 | G5/q@5 r/s E5@3 F5@4 F#5@5 | G5/s@5 E5/e@3 C5/s@1 D5/e@2 E5/s@3 C5/s@1 | D5/q@2 r/s D5@2 D#5@3 E5@4 | C5/s@1 A4/e@1 C5/s@2 E5/e@4 D5/s@3 C5/s@2 | B4/s@1 D5/e@3 G5/s@5 F5/e@4 D5/s@2 B4/s@1 | C5/e@1 E5@3 G5/s@5 E5@3 C5@1 G4@1 | C5/q@2 r/q |'),
    nf('C2/e@5 [E3 G3 C4]@3,2,1 G1@5 [E3 G3 C4]@3,2,1 | C2/e@5 [E3 G3 C4]@3,2,1 G1@5 [E3 G3 C4]@3,2,1 | C2/e@5 [E3 G3 C4]@3,2,1 G1@5 [E3 G3 C4]@3,2,1 | G1/e@5 [D3 F3 B3]@3,2,1 D2@5 [D3 F3 B3]@3,2,1 | A1/e@5 [E3 A3 C4]@3,2,1 E2@5 [E3 A3 C4]@3,2,1 | G1/e@5 [D3 F3 B3]@3,2,1 D2@5 [D3 F3 B3]@3,2,1 | C2/e@5 [E3 G3 C4]@3,2,1 G1@5 [D3 F3 B3]@3,2,1 | C2/q@5 r/q |'),
    'Stride piano: the left hand leaps between low bass notes and chords while the right hand syncopates.',
  ),
];
