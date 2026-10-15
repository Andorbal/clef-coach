# Clef Coach song files

Clef Coach can learn any song you give it. This page explains which file formats it reads,
why, and the Clef Coach song format in full — detailed enough to write songs by hand or to have
an AI model write them for you.

## Which format should I use?

| You have… | Use | Notes |
|---|---|---|
| A score in MuseScore, Finale, Sibelius, Dorico, Flat, Noteflight… | **MusicXML** (`.musicxml`, `.mxl`) | Export → MusicXML. Keeps spelling, fingering, string numbers, chord symbols, lyrics, repeats. |
| A paper or PDF score | **MusicXML from a scanner**, or **Scan with Claude** | Optical music recognition apps (Audiveris (free), MuseScore's PDF import, PlayScore, SmartScore, Soundslice) export MusicXML. Or let Claude read photos and write a Clef Coach song (in the app, or `npm run clefsong scan`). |
| Guitar / ukulele / bass **tab** from a tab editor | **Guitar Pro** (`.gp`, `.gpx`, `.gp5`, `.gp4`, `.gp3`) | Guitar Pro, TuxGuitar, MuseScore and Songsterr-style editors save it. Keeps the rhythm, strings, tuning, capo, repeats, chord names and lyrics. |
| Tab from a website (lines of dashes and fret numbers) | **Text tab** (`.txt`, or paste it), or **Scan with Claude** | Read straight away, but text tab seldom shows the rhythm: it is guessed from the spacing. Claude can work it out instead (paste the tab under *Scan sheet music*). See [Tab](#tab). |
| A photo or PDF of tab | **Scan with Claude** | |
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

### Tab

**Guitar Pro** files hold everything tab needs, so they import like MusicXML: each track becomes a
part you can choose, the track for your instrument opens first, and the other tracks — drums
included — play as the band.

**Text tab** — the kind posted on websites — is read like this:

```
Tuning: Drop D        ← a "Tuning:" line, a capo ("Capo 2"), tempo ("Tempo: 96") and time ("Time: 3/4")
Capo 2                  are all read; the first line can be the title ("Song by Artist")

   Am          C      ← chord names over the tab become the song's chord symbols
e|-----0-----|-----0-----|
B|---1---1---|---1---1---|
G|-2-------2-|-0-------0-|
D|-----------|-2---------|
A|-0---------|-3---------|
D|-----------|-----------|  x2   ← "x2" plays the system twice; |: :| repeats work too
```

- **Strings and tuning.** The number of lines and their names say the instrument: six or more
  strings are a guitar, `G D A E` a bass (or, when your instrument is guitar, its four low
  strings), `A E C G` a ukulele. Names like `D` on the low string, or a `Tuning:` line (`Drop D`,
  `half step down`, `DADGAD`, `Open G`, or the notes `D A D G B E`), set the tuning; a capo raises
  every note. Notes keep the pitch they sound. Clef Coach plays in standard tuning, so a note the
  standard-tuned string can't reach is played on another string.
- **Techniques.** `h`, `p`, slides and taps are separate notes; a bend (`7b9`) is the fret it starts
  on; muted notes (`x`) are left out; harmonics (`<12>`) are written at their fret.
- **Rhythm.** A rhythm line over or under the tab (`q  e e  h`, with `.` for dotted notes) gives the
  exact rhythm. Without one, the rhythm is **guessed** from how the notes are spaced in each bar
  (and the time signature from how the bars fill up), so check it — the preview lets you read it
  again in another time signature, or hand the tab to Claude, which works the rhythm out (and knows
  how well-known songs go).

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
| `composer`, `arranger`, `year`, `source`, `license`, `blurb` | no | Shown in the library. |
| `tags` | no | Labels to find the song by (`["christmas", "recital"]`); you can add and remove them in the app, and filter the library by them. |
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
| `band` | no | Accompaniment parts — drums, bass, chords, strings… — for playing with a band (see [Band parts](#band-parts)). |
| `style` | no | The feel of the automatic band when the song has no `band` (or not all of it): `pop`, `rock`, `ballad`, `waltz`, `swing`, `bossa`, `country`, `march`, `compound` (6/8 feel), `gentle` (no drums). Default: chosen from the meter and tempo. |

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
duration := w | h | q | e | s | t | x   then "." per dot, "3" for a triplet   (x = 64th)
```

- **Octaves**: middle C is `C4`; B3 is the note below it.
- **Accidentals** are written on every note exactly as it sounds — the key signature does not
  apply to the text. In G major every F is written `F#4`. `n` forces a natural sign (`Fn4`).
- **Durations** carry over: `C4/q D4 E4 F4 |` is four quarter notes. `q.` dotted quarter,
  `h..` double-dotted half, `e3 e3 e3` an eighth-note triplet.
- **Chords**: `[C4 E4 G4]/h`.
- **Ties**: `G4/h~ | G4/q` (the `~` goes on the first note). Inside a chord, a `~` after one
  pitch ties just that note, while the others are played again: `[C4~ E4 G4]/h [C4 F4 A4]` holds C4.
  A note tied this way lands on the next note of the voice with the same pitch, so an arpeggio
  can be held into a chord: `C4/e~ E4~ G4/q [C4 E4 G4]/h`.
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
| `[T:3/4]` | time-signature change from this bar on (up to 64 beats, for long cadenza bars) |
| `[C:bass]` | clef change on this staff from this point on (`treble`, `bass`, `treble8vb`, `bass8vb`); it can come anywhere in a bar, right before the note it applies to, and is usually written in the staff's first voice |

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

## Band parts

A song can bring its own band. In the Song Studio, **Perform with the band** plays them with you
(and *Play with the band* does in any in-time practice), through a mixer where each part has a
volume, pan, mute, solo, reverb and sound. Songs without band parts get an **automatic band**
written from their chord symbols — or, when there are none, from chords the app works out from
the music — in the style you pick.

```json
"band": [
  { "name": "Bass", "program": 33, "clef": "bass8vb",
    "voices": ["C2/q G2 C2 G2 | G1 D2 G1 D2 | C2 G2 C2 E2 | C2 G1 G1/h |"] },
  { "name": "Drums", "drums": true, "program": 41,
    "voices": ["kick/q [snare pedal-hat] kick [snare pedal-hat] | … | kick [snare pedal-hat] [kick crash]/h |"] },
  { "name": "Strings", "program": 49, "volume": 0.5, "pan": 0.25,
    "voices": ["[G3 C4 E4]/w | [G3 B3 D4] | [G3 C4 E4] | [G3 C4 E4]/h [G3 B3 D4] |"] }
]
```

| Field | Meaning |
|---|---|
| `name` | Shown in the mixer. |
| `program` | The sound, as a **General MIDI program number** 1–128 (1 piano, 5 electric piano, 25 nylon guitar, 26 steel guitar, 33 acoustic bass, 34 electric bass, 49 strings, 57 trumpet, 66 alto sax, 74 flute…). For a drum part: the kit — 1 standard, 9 room, 17 power, 25 electronic, 33 jazz, 41 brushes. |
| `drums` | `true` for a drum part. |
| `voices` (and `clef`) | The music, exactly like a staff of the song: same bars, pickup, key and time changes and repeat marks. Any number of voices. A part with several staves (a piano) uses `"staves": [{ "clef", "voices" }, …]` instead. |
| `role` | Optional: `drums`, `percussion`, `bass`, `chords`, `pad`, `melody` or `counter`. Worked out from the sound and the music when absent; it tells the automatic band what is already covered. |
| `volume`, `pan` | Optional starting mix: 0–1 and −1 (left) … 1 (right). |

Every bar of a band part is checked like the music, with errors that name the part and the bar.

### Drum names

Drum parts are General MIDI percussion keys. Write them by name — or as pitches if you prefer
(`C2` is the kick, `D2` the snare, `F#2` the closed hi-hat). Names work anywhere a pitch does,
in chords too: `[kick hat]/e hat [snare hat] hat`.

| Name | Key | Name | Key | Name | Key |
|---|---|---|---|---|---|
| `kick` | 36 | `hat` | 42 | `crash` | 49 |
| `kick2` | 35 | `pedal-hat` | 44 | `crash2` | 57 |
| `snare` | 38 | `open-hat` | 46 | `ride` | 51 |
| `snare2` | 40 | `tom-hi` | 50 | `ride-bell` | 53 |
| `rim` (side stick) | 37 | `tom-himid` | 48 | `splash` | 55 |
| `clap` | 39 | `tom-lomid` | 47 | `china` | 52 |
| `sticks` | 31 | `tom-lo` | 45 | `tambourine` | 54 |
| `cowbell` | 56 | `floor-hi` | 43 | `shaker` | 82 |
| `claves` | 75 | `floor-lo` | 41 | `triangle` | 81 |

The rest of the GM set has names too: `bongo-hi`, `bongo-lo`, `conga-mute`, `conga-hi`,
`conga-lo`, `timbale-hi`, `timbale-lo`, `agogo-hi`, `agogo-lo`, `cabasa`, `maracas`,
`whistle-short`, `whistle-long`, `guiro-short`, `guiro-long`, `block-hi`, `block-lo`,
`cuica-mute`, `cuica-open`, `triangle-mute`, `vibraslap`, `ride2`, `jingle-bell`, `bell-tree`,
`castanets`, `surdo-mute`, `surdo`. Shorthands: `bd`, `sd`, `hh`, `oh`, `ph`, `cr`, `rd`,
`tom1`…`tom6` (high to low).

### Where band parts come from

- **Imported files keep their ensemble**: the parts of a MusicXML score, the tracks of a MIDI or
  Guitar Pro file that you don't choose to play become the band — drum tracks and percussion
  parts included (MIDI channel 10, MusicXML unpitched notes, Guitar Pro drum tracks), with each
  part's General MIDI sound. A song keeps up to 16 band parts; bars where only the band plays,
  before your part starts or after it ends, are left out.
- **By hand**, in this format.
- **The automatic band**, when there are none.

### Sounds

Band parts always play with the app's built-in sounds: synthesised piano, electric piano, guitars,
basses, mallets and drum kits, and live synth voices for strings, organs, brass, reeds, flutes,
pads and choir — every General MIDI program has one. In *Settings → Instrument sounds* you can
add **sound banks** — SoundFont 2 (`.sf2`), SoundFont 3 (`.sf3`) and SFZ instruments (a folder or
a `.zip`) — or download free ones, and the band (or your own instrument) plays recorded samples
instead of, or layered over, the built-in sounds. Or play the band through a **MIDI device** — a
digital piano's sounds, a sound module, a synth or a DAW: each part goes out on a channel of its
own (drums on 10) with its General MIDI program, and the mixer's volume and pan as controllers
7 and 10.

## Tools

### In the app
**Songs → Import a song** reads MusicXML, MIDI, Guitar Pro, text tab and Clef Coach files, accepts
pasted tab or song files, and can scan photos, a PDF or text tab with Claude using your own
Anthropic API key. You get a preview with every
problem explained, can edit the source, listen, and save to *My songs*. Imported songs are
included in backups (Settings → Export).

Pick several files at once — or a `.zip` of them, or (on a computer) a folder, or drop files and
folders on the page — to import a whole collection: each file is read and checked, songs you
already have are left unticked, and you can give them all the same tags (the folder's name is
suggested) before saving.

### Command line (`npm run clefsong -- …`)

```bash
npm run clefsong -- validate my-song.json            # check one or more files
npm run clefsong -- convert score.mxl -o song.json   # MusicXML, MIDI, Guitar Pro or text tab → Clef Coach song
npm run clefsong -- convert tune.mid --instrument guitar
npm run clefsong -- convert band.gp5 --parts 2       # the third track of a Guitar Pro file (the others play as the band)
npm run clefsong -- convert band.gp5 --no-band       # just the part, no band
npm run clefsong -- convert riff.txt                 # text tab (rhythm guessed from the spacing)
npm run clefsong -- scan page1.jpg page2.jpg --instrument piano --title "Silent Night"
npm run clefsong -- scan lesson.pdf -o lesson.clefsong.json
npm run clefsong -- scan riff.txt --instrument bass  # text tab: Claude works out the rhythm
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
