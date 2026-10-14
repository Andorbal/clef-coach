# Clef Coach song files

Clef Coach can learn any song you give it. This page explains which file formats it reads,
why, and the Clef Coach song format in full — detailed enough to write songs by hand or to have
an AI model write them for you.

## Which format should I use?

| You have… | Use | Notes |
|---|---|---|
| A score in MuseScore, Finale, Sibelius, Dorico, Flat, Noteflight… | **MusicXML** (`.musicxml`, `.mxl`) | Export → MusicXML. Keeps spelling, fingering, string numbers, chord symbols, lyrics, repeats. |
| A paper or PDF score | **MusicXML from a scanner**, or **Scan with Claude** | Optical music recognition apps (Audiveris (free), MuseScore's PDF import, PlayScore, SmartScore, Soundslice) export MusicXML. Or let Claude read photos and write a Clef Coach song (in the app, or `npm run clefsong scan`). |
| Guitar / ukulele / bass **tab** | **Scan with Claude**, or MusicXML from a tab editor | Tab editors (TuxGuitar, MuseScore, Guitar Pro) can export MusicXML. |
| A MIDI file | **MIDI** (`.mid`) | Imported, but see the limits below. |
| Nothing — you want to type it | **Clef Coach song** (`.json`) | The format below. |

### Why not just MIDI?

MIDI records a *performance* — which key went down when — not the *notation*. It cannot say:

- how a note is **spelled** (F♯ or G♭ — the key signature helps, but accidentals inside the key are guessed),
- **rhythm as written**: a played note is never exactly a quarter note, so rhythms must be quantized,
  and ties, rests versus short notes, dots and tuplets are reconstructed rather than read,
- **fingering**, **string numbers**, **mallet sticking**, **clefs**, which **hand** plays a note,
- **chord symbols**, **repeats and endings** (a MIDI file is already played out), phrase marks.

So Clef Coach imports MIDI (and does a careful job: quantizing to the beat, spelling with the key,
splitting hands, finding pickups), but it can't be the main format.

### Why MusicXML — and why a format of our own as well?

**MusicXML** is the open, royalty-free standard for sheet music (maintained by the W3C Music
Notation Community Group). Every notation program and sheet-music scanner reads and writes it, and
it can represent everything on the page. Clef Coach imports it directly.

But MusicXML is verbose (a single note is ten or more lines of XML), which makes it hard to read,
to fix by hand, or for an AI model to write reliably. So Clef Coach also has its own compact
format: **one small JSON file whose music is written in a short text notation** — one line of text
per voice. It's what the app stores, what it exports, and what the AI scanner produces. Every file
is checked bar by bar when it's loaded, with errors that point at the exact bar.

## The Clef Coach song format (version 1)

A song is one JSON object. File extension: `.json` (we suggest `name.clefsong.json`).

```json
{
  "format": "clef-coach-song",
  "version": 1,
  "title": "Silent Night",
  "composer": "Franz Xaver Gruber",
  "year": "1818",
  "arranger": "",
  "source": "Lesson book, page 12",
  "license": "Public domain",
  "instrument": "piano",
  "level": 3,
  "key": "Bb",
  "time": [6, 8],
  "tempo": "q.=52",
  "staves": [
    { "clef": "treble", "hand": "R", "voices": ["F4/q. G4/e F4/q | D4/h. | F4/q. G4/e F4/q | D4/h. |"] },
    { "clef": "bass", "hand": "L", "voices": ["[Bb2 F3]/h. | [Bb2 F3] | [Bb2 D3 F3] | [Bb2 D3 F3] |"] }
  ],
  "chords": "Bb/h. | Bb | Bb | Bb |",
  "sections": [{ "name": "Silent night, holy night", "from": 1, "to": 4 }],
  "lyrics": ["Si- lent night, ho- ly night"]
}
```

### Fields

| Field | Required | Meaning |
|---|---|---|
| `format`, `version` | recommended | `"clef-coach-song"`, `1` |
| `title` | yes | |
| `composer`, `arranger`, `year`, `source`, `license`, `blurb`, `tags` | no | Shown in the library. |
| `instrument` | yes | `piano`, `guitar`, `ukulele`, `bass` (bass guitar) or `mallets` (marimba, xylophone, glockenspiel, vibraphone) |
| `level` | no | 1 (first weeks) … 10 (advanced). Default 3. |
| `key` | yes | Key signature as a key name: `C`, `G`, `F`, `Bb`, `Eb`, `F#`, `Am`, `F#m`, `Dm` … |
| `time` | yes | `[3, 4]` or `"3/4"` |
| `tempo` | no | Quarter notes per minute (`92`), or another beat unit: `"q.=52"`, `"h=60"`. Default 80. |
| `pickup` | no | Length of an incomplete first bar (anacrusis): `"q"`, `"e"`, `"q."` … |
| `mallets` | no | Mallets only: `2` or `4` mallets. |
| `staves` | yes | List of staves, top to bottom. Each has `clef`, optional `hand` (`"R"`/`"L"`), optional `name`, and `voices`: one or two strings of notes. |
| `chords` | no | Chord symbols in time (see below). Shown with diagrams for every instrument. |
| `sections` | no | Practice phrases: `{ "name", "from", "to" }`, 1-based bar numbers, inclusive. If absent, the app makes 4-bar phrases. |
| `lyrics` | no | One string per verse (see below). |

### Clefs and pitch

| Instrument | Staves | Clef | Pitch you write |
|---|---|---|---|
| piano | treble (`hand: "R"`) + bass (`hand: "L"`), or one | `treble`, `bass` | as printed |
| guitar | one | `treble8vb` | **sounding** pitch: one octave below the printed note (open strings E2 A2 D3 G3 B3 E4) |
| bass guitar | one | `bass8vb` | **sounding** pitch: one octave below printed (open strings E1 A1 D2 G2) |
| ukulele | one | `treble` | as printed (open strings G4 C4 E4 A4, high-G) |
| mallets | one, or treble + bass for a marimba grand staff | `treble`, `bass` | as printed (written pitch). The app knows a xylophone sounds an octave higher and a glockenspiel two. |

### The note language

Each voice is a string of tokens separated by spaces, with `|` after every bar:

```
token    := head [ "/" duration ] [ "@" fingers ] [ "%" strings ] [ "~" ]
head     := pitch | "r" | "[" pitch pitch … "]"          rest, note or chord
pitch    := letter accidental? octave                      C4  F#4  Bb3  Ebb5  Fx4  Cn5
duration := w | h | q | e | s | t   then "." per dot, "3" for a triplet
```

- **Octaves**: middle C is `C4`; B3 is the note below it.
- **Accidentals** are written on every note exactly as it sounds — the key signature does not
  apply to the text. In G major every F is written `F#4`. `n` forces a natural sign (`Fn4`).
- **Durations** carry over: `C4/q D4 E4 F4 |` is four quarter notes. `q.` dotted quarter,
  `h..` double-dotted half, `e3 e3 e3` an eighth-note triplet.
- **Chords**: `[C4 E4 G4]/h`.
- **Ties**: `G4/h~ | G4/q` (the `~` goes on the first note).
- **Rests**: `r/q`, a whole-bar rest in 3/4 is `r/h.`.
- **Fingering** (`@`): piano fingers `1`–`5`; fretting fingers `0`–`4` for guitar/ukulele/bass
  (`0` = open string); mallet sticking `L`/`R` or `1`–`4` (four mallets, numbered left to right).
  One per chord note, `-` to leave one out: `[C4 E4 G4]/q@1,3,5`. Optional — the app adds
  fingering and sticking that's missing.
- **Strings** (`%`): string number per note for fretted instruments, 1 = highest string: `G3/q%3`.
- **Every bar must add up** to the time signature. Only the first bar may be short, when
  `pickup` says so (and then the last bar is usually short by the same amount).
- **Two voices on one staff** (e.g. melody with stems up and an inner line with stems down): give
  the staff two voice strings; each must add up bar by bar.

Structure marks inside a voice:

| Mark | Meaning |
|---|---|
| `\|\|` | double bar |
| `\|:` and `:\|` | repeat (`:\|:` for both) |
| `\|1` … `:\|2` | first and second endings |
| `[K:G]` | key change from this bar on |
| `[T:3/4]` | time-signature change from this bar on |

Repeats are written out when the song loads, so practice follows the performance. All voices — and
the `chords` line — must use the same repeat marks. Each repeat is taken once; a `:|` with no `|:`
goes back to the bar after the previous repeat (or to the beginning). D.C. and D.S. must be written
out by hand.

### Chord symbols

The `chords` line uses the same bars and durations as the notes:

```
"chords": "C/h G7/h | Am/q F/q G/h | C/w |"
```

Symbols: `C Cm C7 Cmaj7 Cm7 C6 Cm6 Cdim Cdim7 Cm7b5 Caug C7#5 Csus2 Csus4 C7sus4 C5 Cadd9 Cm(add9)
C6/9 C9 Cmaj9 Cm9 C7b9 C7#9 C11 Cm11 C13`, any root (`F#`, `Bb` …), and slash chords (`C/E`).
`r` means no chord; a chord without a duration takes an equal share of its bar.

Guitar and ukulele players can strum a song's chords in the Song Studio (*Play: Chords*) while the
app plays the tune, with each chord's shape shown on the fretboard.

### Lyrics

One string per verse. Syllables are separated by spaces; a syllable that continues its word ends
with `-`; `_` holds the previous syllable over an extra note:

```
"lyrics": ["Si- lent night, ho- ly night, all is calm, all is bright"]
```

## Tools

### In the app
**Songs → Import a song** reads MusicXML, MIDI and Clef Coach files, accepts pasted text, and can
scan photos or a PDF with Claude using your own Anthropic API key. You get a preview with every
problem explained, can edit the source, listen, and save to *My songs*. Imported songs are
included in backups (Settings → Export).

### Command line (`npm run clefsong -- …`)

```bash
npm run clefsong -- validate my-song.json            # check one or more files
npm run clefsong -- convert score.mxl -o song.json   # MusicXML or MIDI → Clef Coach song
npm run clefsong -- convert tune.mid --instrument guitar
npm run clefsong -- scan page1.jpg page2.jpg --instrument piano --title "Silent Night"
npm run clefsong -- scan lesson.pdf -o lesson.clefsong.json
npm run clefsong -- prompt --instrument ukulele      # the prompt for any AI assistant
```

`scan` uses your own key from `ANTHROPIC_API_KEY` (or an `ant auth login` profile). It sends the
pages to Claude (`claude-opus-5-5` by default; `--model` to change), checks the answer, and sends
any problems back for a fix (up to two rounds). If it still doesn't validate, the draft is saved
so you can fix the reported bars by hand and run `validate`.

### Using any AI assistant by hand

`npm run clefsong -- prompt` (or *Scan sheet music → No API key?* in the app) gives you a prompt
that teaches the format. Paste it into ChatGPT, Claude.ai, Gemini or similar, attach photos of the
music, then paste the answer into *Import a song → Paste*. The app checks every bar and tells you
exactly what to fix.
