/**
 * Instructions that teach a large language model to transcribe sheet music or
 * tablature into a Clef Coach song file. Used three ways:
 *  - the in-app "Scan with AI" import (your own Claude API key),
 *  - the `npm run clefsong scan` command-line tool,
 *  - copied by hand into any chat assistant together with photos of the music.
 */
import type { InstrumentId } from '../music/instruments';

export const SONG_FORMAT_GUIDE = `# Clef Coach song file (format "clef-coach-song", version 1)

A song is ONE JSON object:

{
  "format": "clef-coach-song",
  "version": 1,
  "title": "Silent Night",
  "composer": "Franz Xaver Gruber",          // "Traditional" if unknown
  "arranger": "…",                           // optional
  "year": "1818",                            // optional
  "source": "Scanned from a lesson book",    // optional, where it came from
  "instrument": "piano",                     // piano | guitar | ukulele | bass | mallets
  "level": 3,                                // 1 (first weeks) … 10 (advanced)
  "key": "Bb",                               // C, G, D, F, Bb, Eb, Am, F#m, …  (key signature + mode)
  "time": [6, 8],                            // time signature
  "tempo": "q.=52",                          // number = quarter notes per minute, or "q.=52", "h=60"
  "pickup": "e",                             // ONLY if the music starts with an incomplete bar (its length)
  "mallets": 2,                              // mallets only: 2 or 4
  "staves": [
    { "clef": "treble", "hand": "R", "voices": ["…notes…"] },
    { "clef": "bass",   "hand": "L", "voices": ["…notes…"] }
  ],
  "chords": "Bb/h. | Bb/h. | F7/h. | Bb/h. |",   // optional chord symbols over the music
  "sections": [ { "name": "Verse", "from": 1, "to": 8 } ],   // optional, 1-based bar numbers, inclusive
  "lyrics": ["Si- lent night, ho- ly night"]                  // optional, one string per verse
}

## Clefs and pitch
- piano: two staves, "treble" (hand "R") over "bass" (hand "L"); one staff for one-hand pieces.
- guitar: one staff, clef "treble8vb". Write SOUNDING pitch = one octave BELOW the printed note
  (a note printed on the bottom line E4 is written E3; open low string = E2).
- bass (bass guitar): clef "bass8vb", SOUNDING pitch = one octave below printed (open strings E1 A1 D2 G2).
- ukulele: clef "treble", pitch exactly as printed (open strings G4 C4 E4 A4, high-G tuning).
- mallets (marimba, xylophone, glockenspiel, vibraphone): clef "treble" (and "bass" for marimba
  left hand), pitch exactly as PRINTED (written pitch).

## Notes: one string per voice, tokens separated by spaces, "|" after every bar
  token := head [/duration] [@fingers] [%strings] [~]
  head  := pitch | r (rest) | [pitch pitch …] (chord, low to high)
  pitch := letter + accidental + octave: C4 (middle C), F#4, Bb3, Ebb5, Fx4 (double sharp), Cn5 (natural)
  duration := w h q e s t (whole, half, quarter, eighth, 16th, 32nd), "." per dot, "3" = triplet
              e.g. q.  e  h..  e3 (an eighth of a triplet)
  The duration carries over until it changes: "C4/q D4 E4 F4 |" is four quarters.
  ~        := tie to the next note (same pitch), e.g. "G4/h~ | G4/q …"
  @fingers := printed fingering: piano 1-5; guitar/ukulele/bass fretting finger 0-4 (0 = open);
              mallets sticking L or R (or 1-4 with four mallets). One per chord note, "-" to skip one.
  %strings := guitar/ukulele/bass string number per note (1 = highest string), e.g. "%3"
  Every bar MUST add up exactly to the time signature (6/8 = six eighths). The first bar may be
  short only if "pickup" says so; then the last bar is usually short by the same amount.
  Write ALL accidentals explicitly as they sound (F# in G major is written F#4 every time —
  the key signature does not apply to the text).
- Rests fill silence: "r/q", a whole-bar rest in 3/4 is "r/h.".
- Two independent rhythms on one staff (e.g. melody with stems up, bass with stems down) = two
  voice strings for that staff, each adding up bar by bar.

## Structure tokens (inside the voice strings)
  |:  start repeat     :|  end repeat     |1  first ending starts     :|2  second ending starts
  ||  double bar       [K:G]  key change at the start of a bar     [T:3/4]  time change at the start of a bar
  Every voice must use the same repeat signs at the same places. D.C./D.S. must be written out.

## Chords (optional "chords" line)
Same bars and durations as the notes: "C/h G7/h | Am/w |". Symbols like C, Cm, C7, Cmaj7, Cm7,
Cdim, Caug, Csus4, C6, C9, Cadd9, Cm7b5, C/E (slash bass). "r" = no chord.

## Tablature
For guitar/ukulele/bass TAB: turn each (string, fret) into the pitch it sounds with the standard
tuning (guitar E2 A2 D3 G3 B3 E4 low→high, string 1 = high E; ukulele G4 C4 E4 A4, string 1 = A;
bass E1 A1 D2 G2, string 1 = G), and keep the string as "%n". Take rhythm from the notation
staff or rhythm stems if present; otherwise use the simplest rhythm that fits the bars.

## Lyrics
One string per verse: syllables separated by spaces, a syllable that continues the word ends with "-"
("Si- lent"), "_" holds the previous syllable over an extra note.
`;

export const TRANSCRIBE_RULES = `You are an expert music engraver transcribing printed sheet music or tablature into the Clef Coach song file format described below.

Transcribe EXACTLY what is printed — every note, rest, tie, dot, accidental, triplet, repeat sign, ending, key and time signature, tempo mark, fingering, chord symbol and lyric. Do not simplify, arrange, or "correct" the music. If something is unreadable, make the most musically sensible choice that fits the bar and mention it in "source" (e.g. "bar 7 beat 3 unclear").

Work bar by bar and check that each bar adds up to the time signature before moving on. Keep all staves and voices aligned: every voice string must have the same number of bars and the same repeat signs.

Answer with the JSON object only — no explanations before or after (a \`\`\`json code block is fine).

${SONG_FORMAT_GUIDE}`;

/** The user-turn instruction that goes with the images. */
export function transcribeTask(opts: { instrument?: InstrumentId; title?: string; hints?: string; pages?: number } = {}): string {
  const parts = [
    `Transcribe ${opts.pages && opts.pages > 1 ? `these ${opts.pages} pages` : 'this music'} into one Clef Coach song file.`,
    opts.instrument ? `It is for ${opts.instrument === 'mallets' ? 'mallet percussion (marimba/xylophone)' : opts.instrument}: use "instrument": "${opts.instrument}".` : 'Work out which instrument it is for (piano grand staff, guitar, ukulele, bass guitar or mallets).',
    opts.title ? `The title is "${opts.title}".` : '',
    opts.hints ? `Notes from the player: ${opts.hints}` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

/** What to say when the file came back invalid. */
export function repairTask(issues: string[]): string {
  return `That file doesn't load yet. The validator reported:\n${issues.map(i => `- ${i}`).join('\n')}\n\nLook at the music again, fix these problems (check every bar adds up, and that voices line up), and answer with the complete corrected JSON object only.`;
}

/** Everything a person needs to paste into a chat assistant next to photos of their music. */
export function manualPrompt(instrument?: InstrumentId): string {
  return `${TRANSCRIBE_RULES}\n\n---\n${transcribeTask({ instrument })}`;
}
