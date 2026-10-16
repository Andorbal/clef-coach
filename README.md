# Clef Coach

**Learn to read music and play songs on piano, guitar, ukulele, bass guitar and mallet percussion — with your real instrument.**

<p align="center">
  <img src="docs/media/tempo-mode.gif" width="880" alt="Playing Ode to Joy in time on Clef Coach's piano: a one-bar count-in of 1 2 3 4, a beat light flashing with the metronome, the music scrolling past the playhead and each note turning green as it is played on the beat.">
</p>
<p align="center"><sub>Playing in time: a count-in, a beat light to follow, and every note judged as you play it.</sub></p>

Clef Coach is an installable web app (PWA) that takes you from your very first note to advanced sight-reading and real songs. It listens to your instrument through **MIDI** or the **microphone**, shows real engraved notation, an accurate keyboard, fretboard or set of mallet bars, and teaches proper **fingering**, **sticking**, **hands-together** playing, **chords** and the **whole neck**. When you want to make sounds of your own, **Synth School** teaches synthesizers, from the first oscillator to FM and wavetables, on a synth built into the app.

There's no account and no server. Progress lives on your device, and you can export or import it at any time.

## Highlights

- **Five instruments, thirteen tracks you can run side by side**
  - **Piano:** Treble Clef (right hand), Bass Clef (left hand), Both Hands (grand staff).
  - **Guitar:** Treble Clef (standard notation), Bass Clef (bass lines and low voices), Fretboard Navigator (every note, octave shapes, CAGED, pentatonic boxes, 3-notes-per-string scales), Chords (open chords to barre and colour chords, strumming along with songs).
  - **Ukulele** (standard high-G, low-G or baritone tuning): Treble Clef (melodies, positions, campanella, chord-melody, the fretboard), Chords & Strumming.
  - **Bass guitar** (4 or 5 strings): Bass Clef (grooves, walking lines, Simandl fingering), Fretboard & Grooves.
  - **Mallets** (marimba, xylophone, glockenspiel or vibraphone): Two Mallets and Four Mallets, with sticking for every note. Xylophone and glockenspiel are written in their own octave and heard where they really sound.
- **Smooth progression.** Each track has 10–15 units of short lessons. Every unit ends with a checkpoint, and you can **test out** of any unit to skip ahead.
- **Endless content.** A harmony-aware generator writes fresh exercises with exactly the notes, rhythms, keys, leaps and accompaniment patterns each lesson calls for. You don't get "max level" and then refreshers forever: the **Sight-reading Gym** keeps going at your level.
- **Real feedback**
  - *Wait mode*: the music waits for the right note or chord.
  - *Tempo mode*: a count-in in the song's meter (1 2 3 4, or 1 2 3 in 3/4) and a metronome with a flashing beat light you can follow even when the click is drowned out, with every note scored for timing.
  - Wrong notes appear as red "ghost" notes on the staff, so you see what you actually played.
- **Fingering and sticking everywhere**
  - Standard scale fingerings, and five-finger positions that grow into thumb-under crossings.
  - Dynamic-programming engines handle everything else: piano fingers; left-hand fingers and circled string numbers for guitar, ukulele (in any tuning) and bass (one finger per fret, or Simandl low on the neck); mallet sticking for two mallets (L/R) or four (1–4), avoiding crossings and double stickings.
  - A small arrow beside a finger number says the hand moves to a new position for that note (→ up, ← down), so a shift never catches you out.
- **Hands together.** Accompaniment patterns progress through drone, roots, blocked chords, waltz, broken chords, Alberti bass, parallel and contrary motion, then independent counter-melodies. When you practise one hand of a piece, the app plays the other.
- **Smart Review** uses spaced repetition on the notes, frets and chords you find hardest.
- **Songs, and a place to learn them.** A library of public-domain classics and original pieces for every instrument, and a **Song Studio** for learning any song:
  - a guided **practice plan**, phrase by phrase: hands (or mallets) separately, then together, then in time at 60, 80 and 100% — and then chaining phrases together;
  - **phrase looping**, any custom range of bars, **slow-down** and a **speed builder**, **count-in** and **metronome**;
  - **split the music**: one hand on piano, chosen strings on guitar, ukulele or bass, one staff of a marimba part — the app plays the rest at the volume you choose;
  - **trouble spots** found from your mistakes, **lyrics** under each phrase, the song's **chords** drawn for your instrument;
  - a **goal date** (“Silent Night by Christmas Eve”) that paces how much to practise each day.
- **Perform with a band.** Play any song with drums, bass, chords and strings behind you — the parts written for the song, the other parts of a full score you imported, or an **automatic band** the app arranges from the chords (or works the chords out from the music) in the style you choose: pop, rock, ballad, waltz, swing, bossa nova, country, march, 6/8 or gentle. The drummer counts you in, fills at the end of each phrase and the last chord rings out.
  - A **mixer** for each part — volume, pan, mute, solo, reverb and sound — that you never have to touch.
  - **Built-in sounds always work**, offline, on every device: every General MIDI instrument has one, from synthesised drum kits to strings and brass. Or send the band to a **MIDI device** (a sound module, a synth, a DAW), each part on its own channel.
  - **Sound banks** for real recorded instruments: SoundFonts (`.sf2`, `.sf3`) and SFZ instruments (a folder or a `.zip`), for the band or for your own instrument, instead of the built-in sounds or layered with them. Download free ones in the app — GeneralUser GS, MuseScore General, a Steinway, a Yamaha grand, a recorded drum kit — or add your own. Samples load only when a song needs them, within a memory limit you set: modest on a phone, as much as you like on a 64 GB workstation, with a warning on devices that may struggle.
- **Import your own songs**: MusicXML (from MuseScore, Finale, Sibelius, Dorico, Flat, Noteflight or any sheet-music scanner), MIDI, **Guitar Pro** files, **text tab** pasted from a website, or Clef Coach song files. **Scan sheet music or tab with Claude** using your own Anthropic API key — photos, a PDF, or text tab whose rhythm Claude works out — or use the prompt with any AI assistant. Every file is checked bar by bar with errors that say exactly what to fix. See [docs/song-format.md](docs/song-format.md).
  - **Import a whole collection at once**: pick several files, a `.zip`, or (on a computer) a folder or files dropped on the page; untick the ones you don't want, tag them all in one go, and duplicates of songs you already have are spotted.
  - Imports keep clef changes, cross-staff notes on the right hand's staff, two voices with their stems the right way up, held notes inside chords, 64th notes, cadenza bars and repeats; MIDI files spread over several tracks become one grand staff, and chord symbols are worked out from a chord track.
- **Synth School: learn to speak synth.** Eleven units that take you from your first oscillator to designing your own sounds, on a real synthesizer built into the app with four engines: **subtractive** (two oscillators, sub, noise, ring mod, hard sync), **FM** (four operators, eight algorithms), **additive** (16 harmonics) and **wavetable**, with a 12/24 dB filter, three envelopes, an LFO, unison, glide and effects.
  - Each lesson brings in one or two knobs at a time, shows what they do with live pictures of the wave, the spectrum and the envelope, and gives you small things to try.
  - Ear training, and **quizzes judged by ear**: hear a target sound and rebuild it with the controls you have. It doesn't have to be exact. The judge listens for pitch, tone, shape and movement, and hints point at the knob that matters.
  - Every control has the name real synths use, and a field guide shows where to find it on the synths that come with FL Studio (3x Osc, Sytrus, Harmor, Flex…) and on Vital or Serum.
  - The **Synth Lab**: the whole synth to play freely from the on-screen keys, a computer keyboard or a MIDI keyboard, with 24 presets to take apart and your own saved patches.
- **Tags.** Label any song — “christmas”, “recital”, “warm-ups” — and filter the library by one or more tags.
- **Chord chart.** Any chord on every instrument — chord boxes for guitar, ukulele and bass, marked keys for piano, marked bars for mallets — with fingers, intervals or note names, and each voicing written out in standard notation in the clef that instrument reads. On a tablet or laptop, compare several chords side by side on several instruments at once (guitar over piano, say), or see every voicing of one chord. Tap to hear.
- **Studio**
  - Free Play: play anything and see it appear on the staff, with chord names.
  - Fretboard Explorer (guitar, ukulele, bass), a chromatic tuner, a scales-and-fingering reference and a sight-reading gym for every instrument.
  - Metronome: tap tempo, time signatures, subdivisions, accents and a speed trainer.
- **Progress.** XP, streaks with streak freezes, a daily goal, a practice calendar, per-note mastery heatmaps on a keyboard or fretboard, and low-key milestones.
- **Multiple players on one device**, plus **export/import** (download, share sheet, or paste) with merge or replace.

## A look around

<table>
<tr>
<td colspan="2" valign="top"><img src="docs/media/wait-mode.gif" alt="Wait mode. The music waits on every note. A wrong note appears in red on the staff, and the hint marks the right key and finger."><br><sub><b>Wait mode.</b> The music waits on every note. A wrong note appears in red on the staff, and the hint marks the right key and finger.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/media/home.jpg" alt="Home. Pick up where you left off, with a daily goal and every track you follow."><br><sub><b>Home.</b> Pick up where you left off, with a daily goal and every track you follow.</sub></td>
<td width="50%" valign="top"><img src="docs/media/track-map.jpg" alt="A learning path. Short lessons, a checkpoint per unit, and test-outs to skip ahead."><br><sub><b>A learning path.</b> Short lessons, a checkpoint per unit, and test-outs to skip ahead.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/media/guitar-lesson.jpg" alt="Guitar. Standard notation over a true-to-scale fretboard, with string numbers and fingering."><br><sub><b>Guitar.</b> Standard notation over a true-to-scale fretboard, with string numbers and fingering.</sub></td>
<td width="50%" valign="top"><img src="docs/media/fretboard.jpg" alt="Fretboard Explorer. Every A up to the 15th fret, octave shapes, CAGED and scale boxes."><br><sub><b>Fretboard Explorer.</b> Every A up to the 15th fret, octave shapes, CAGED and scale boxes.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/media/song-studio.jpg" alt="Song Studio. A practice plan phrase by phrase, from “wait for me” to full speed."><br><sub><b>Song Studio.</b> A practice plan phrase by phrase, from “wait for me” to full speed.</sub></td>
<td width="50%" valign="top"><img src="docs/media/songs.jpg" alt="Songs. A library for every instrument, plus anything you import or scan."><br><sub><b>Songs.</b> A library for every instrument, plus anything you import or scan.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/media/band-mixer.jpg" alt="Band and mix. The parts written for Ode to Joy — brushes, acoustic bass, nylon guitar and strings — each with mute, solo, volume, pan and reverb."><br><sub><b>Perform with a band.</b> The song’s own parts or an automatic band, in any style, with a mixer you never have to touch.</sub></td>
<td width="50%" valign="top"><img src="docs/media/sounds.jpg" alt="Instrument sounds. Free sound banks to download: GeneralUser GS, MuseScore General, Splendid Grand Piano, Virtuosity Drums and more, each with its licence."><br><sub><b>Instrument sounds.</b> Built-in sounds always work; add SoundFonts or SFZ instruments, or download free ones.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/media/chord-chart.jpg" alt="Chord chart. Any chord on every instrument, side by side."><br><sub><b>Chord chart.</b> Any chord on every instrument, side by side.</sub></td>
<td width="50%" valign="top"><img src="docs/media/progress.jpg" alt="Progress. XP, streaks, a practice calendar and note mastery."><br><sub><b>Progress.</b> XP, streaks, a practice calendar and note mastery.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/media/tempo-mode.jpg" alt="In time. Notes turn green when played on the beat; the dots at the top right flash with every beat."><br><sub><b>In time.</b> Notes turn green on the beat, and the dots at the top right flash with every click.</sub></td>
<td width="50%" valign="top"><img src="docs/media/metronome.jpg" alt="Metronome. Tap tempo, any meter, subdivisions, accents and a speed trainer."><br><sub><b>Metronome.</b> Tap tempo, any meter, subdivisions, accents and a speed trainer.</sub></td>
</tr>
</table>

<p align="center"><sub>And on a phone:</sub></p>
<table align="center">
<tr>
<td width="33%" valign="top"><img src="docs/media/phone-home.jpg" alt="Clef Coach home screen on a phone."></td>
<td width="33%" valign="top"><img src="docs/media/phone-song.jpg" alt="Learning Twinkle, Twinkle on a phone: notation above a piano keyboard."></td>
<td width="33%" valign="top"><img src="docs/media/phone-chords.jpg" alt="The chord chart on a phone: C major on the piano, with fingering."></td>
</tr>
</table>

## Using your instrument

| Input | Works on | Notes |
|---|---|---|
| **MIDI** | Chrome, Edge and Firefox on desktop; Chrome on Android | Most precise. USB or Bluetooth MIDI keyboards and digital pianos. |
| **Microphone** | Everywhere, including iPad and iPhone | Monophonic pitch tracking (YIN). Chords are checked by spectral matching against the notes the lesson expects. |
| **On-screen** | Everywhere | Tap the keyboard or fretboard, or use your computer keys (A W S E D F T G Y H U J K; Z/X change octave). |

> **iPad + digital piano:** Safari on iPad and iPhone does not support Web MIDI. Use **Microphone** mode with the piano's speakers, which works well. For MIDI on iPad, open Clef Coach in a Web-MIDI-capable browser such as *Web MIDI Browser* from the App Store.

**Tip:** on iPad or iPhone, use **Share → Add to Home Screen**. Clef Coach then runs full-screen, works offline, and your data is protected from Safari's automatic storage clean-up. Export a backup now and then anyway.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (music theory, generator, curriculum, songs, audio DSP, synth and sound judge, state)
npm run typecheck
npm run build      # production build in dist/ (static, PWA)
npm run e2e        # Playwright smoke tests on iPad mini + phone viewports
npm run clefsong -- help   # song file tools: validate, convert MusicXML/MIDI/Guitar Pro/tab, scan with Claude, AI prompt
npm run sounds             # fetch the sound banks the app hosts itself into public/sounds (the deploy does this)

# Slower, opt-in browser runs
SWEEP=1 npx playwright test sweep --project=ipad   # render every step of every lesson, fail on any error
SHOTS=shots npx playwright test screens            # screenshot every screen into ./shots
tools/readme-media.sh                              # re-record the README screenshots and GIFs (needs ffmpeg)
BENCH=1 npx playwright test audio-bench --project=ipad                    # what the band costs the audio engine
npm run build && BENCH=1 npx playwright test play-bench --project=ipad   # CPU and repaints while playing along
```

How to read the benchmarks, and what has been measured so far: [docs/performance.md](docs/performance.md). Notes for working on the code, with Claude or without, are in `CLAUDE.md` at the root and in the main source folders (`src/audio`, `src/perform`, `src/engine`, `src/songs`, `src/curriculum`, `src/synthlab`, `e2e`).

Microphone and MIDI need a secure context: `localhost` or HTTPS.

**Testing on an iPad or phone from your computer:** run `npm run dev:lan`, then open the `https://<your-computer-ip>:5173` address it prints on the tablet (same Wi-Fi). The certificate is self-signed, so Safari warns once: tap *Show Details → visit this website*. The microphone then works as it would on the real deployment. (Offline/PWA install needs the real HTTPS deployment below.)

### Deploying

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages** on every push to `main`. Turn it on once under *Settings → Pages → Source: GitHub Actions*. The build uses relative paths, so any static host works.

## Architecture

```
src/
  music/        pitch & keys, rhythm ticks, score model, text notation parser (repeats, key and
                meter changes), instruments & tunings, piano / fretted / mallet fingering engines,
                fretboard patterns, chord symbols and the chord book (voicings for every instrument)
  notation/     VexFlow 5 (Bravura) renderer: scrolling staff with fixed clef header,
                grand staff, fingering, note states, ghost notes, playhead
  instruments/  SVG piano keyboard (true key geometry), fretboard (real fret spacing, any tuning),
                mallet bars, chord diagrams
  audio/        Web Audio context, synthesised piano (additive), electric piano, guitar / ukulele /
                bass (Karplus–Strong), mallets (modal synthesis), drum kits, live synth voices for
                held sounds, metronome, UI sounds, MIDI input, microphone pitch detection, input
                manager; samples/: SoundFont 2/3 and SFZ readers, the sampler, sound-bank storage
                (IndexedDB) and the free-sounds catalogue
  perform/      the band: arranger (styles, voice-led chords, walking bass, fills), chords from the
                music, General MIDI → built-in sounds, the performer (look-ahead scheduling,
                per-part mixer) and the Song Studio hook
  curriculum/   lesson data model, builders, procedural generator, chord practice, the tracks
  content/      public-domain + original song library for every instrument
  songs/        the Clef Coach song format, MusicXML / MIDI / Guitar Pro / text tab importers, scanning with Claude
  engine/       lesson runtime: PlayAlong (wait/tempo judging), flashcards, rhythm,
                fretboard activities, review & gym generators, unlock logic
  synthlab/     Synth School: a four-engine synth in pure TypeScript (run in an AudioWorklet and
                offline), the judge that compares two sounds by ear, the synth panel and the course
  state/        zustand store, persistence, spaced repetition, achievements, export/import
  screens/      onboarding, home, learn, track map, lesson player, songs, song studio, import,
                chord chart, studio tools, metronome, progress, settings, Synth School and Synth Lab
tools/          `clefsong` command-line tool (runs the app's TypeScript through Vite)
docs/           song-format.md: the song file format and why
```

All music is either public domain (traditional melodies, or composers who died long ago with works published before 1931) or composed for Clef Coach.

## License

MIT. VexFlow is MIT; the Bravura font is SIL OFL 1.1; alphaTab (which reads Guitar Pro files, loaded only when one is imported) is MPL-2.0; the WebAssembly Ogg Vorbis decoder (for SoundFont 3 banks on browsers that can't decode them) is MIT.

The free sound banks the app offers aren't part of this repository: the deploy fetches GeneralUser GS (S. Christian Collins, [GeneralUser GS License v2.0](https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/LICENSE.txt)) next to the app (`npm run sounds`), as its author asks, and the others download from their own repositories: MuseScore General (MIT), Splendid Grand Piano (public domain), Salamander Grand Piano (CC BY 3.0, Alexander Holm) and Virtuosity Drums (CC0).
