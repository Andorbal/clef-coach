# Clef Coach

**Learn to read the treble and bass clefs on piano and guitar, with your real instrument.**

Clef Coach is an installable web app (PWA) that takes you from your very first note to advanced sight-reading. It listens to your piano or guitar through **MIDI** or the **microphone**, shows real engraved notation, an accurate keyboard and fretboard, and teaches proper **fingering**, **hands-together** playing and the **whole guitar neck**.

There's no account and no server. Progress lives on your device, and you can export or import it at any time.

## Highlights

- **Six tracks you can run side by side**
  - **Piano:** Treble Clef (right hand), Bass Clef (left hand), Both Hands (grand staff).
  - **Guitar:** Treble Clef (standard notation), Bass Clef (bass lines and low voices), Fretboard Navigator (every note, octave shapes, CAGED, pentatonic boxes, 3-notes-per-string scales).
- **Smooth progression.** Each track has 10–15 units of short lessons. Every unit ends with a checkpoint, and you can **test out** of any unit to skip ahead.
- **Endless content.** A harmony-aware generator writes fresh exercises with exactly the notes, rhythms, keys, leaps and accompaniment patterns each lesson calls for. You don't get "max level" and then refreshers forever: the **Sight-reading Gym** keeps going at your level.
- **Real feedback**
  - *Wait mode*: the music waits for the right note or chord.
  - *Tempo mode*: a count-in and metronome, with every note scored for timing.
  - Wrong notes appear as red "ghost" notes on the staff, so you see what you actually played.
- **Fingering everywhere**
  - Standard scale fingerings, and five-finger positions that grow into thumb-under crossings.
  - A dynamic-programming fingering engine handles everything else.
  - Guitar gets left-hand fingers and circled string numbers.
- **Hands together.** Accompaniment patterns progress through drone, roots, blocked chords, waltz, broken chords, Alberti bass, parallel and contrary motion, then independent counter-melodies. When you practise one hand of a piece, the app plays the other.
- **Smart Review** uses spaced repetition on the notes (and frets) you find hardest.
- **Songs.** Public-domain classics plus original compositions, arranged by level for each hand and instrument.
- **Studio**
  - Free Play: play anything and see it appear on the grand staff, with chord names.
  - Fretboard Explorer, a chromatic tuner, and a scales-and-fingering reference.
- **Progress.** XP, streaks with streak freezes, a daily goal, a practice calendar, per-note mastery heatmaps on a keyboard or fretboard, and low-key milestones.
- **Multiple players on one device**, plus **export/import** (download, share sheet, or paste) with merge or replace.

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
npm test           # unit tests (music theory, generator, curriculum, songs, audio DSP, state)
npm run typecheck
npm run build      # production build in dist/ (static, PWA)
npm run e2e        # Playwright smoke tests on iPad mini + phone viewports

# Slower, opt-in browser runs
SWEEP=1 npx playwright test sweep --project=ipad   # render every step of every lesson, fail on any error
SHOTS=shots npx playwright test screens            # screenshot every screen into ./shots
```

Microphone and MIDI need a secure context: `localhost` or HTTPS.

**Testing on an iPad or phone from your computer:** run `npm run dev:lan`, then open the `https://<your-computer-ip>:5173` address it prints on the tablet (same Wi-Fi). The certificate is self-signed, so Safari warns once: tap *Show Details → visit this website*. The microphone then works as it would on the real deployment. (Offline/PWA install needs the real HTTPS deployment below.)

### Deploying

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages** on every push to `main`. Turn it on once under *Settings → Pages → Source: GitHub Actions*. The build uses relative paths, so any static host works.

## Architecture

```
src/
  music/        pitch & keys, rhythm ticks, score model, text notation parser,
                piano + guitar fingering engines, guitar fretboard patterns, chord naming
  notation/     VexFlow 5 (Bravura) renderer: scrolling staff with fixed clef header,
                grand staff, fingering, note states, ghost notes, playhead
  instruments/  SVG piano keyboard (true key geometry) and fretboard (real fret spacing)
  audio/        Web Audio context, synthesised piano (additive) & guitar (Karplus–Strong),
                metronome, UI sounds, MIDI input, microphone pitch detection, input manager
  curriculum/   lesson data model, builders, procedural generator, the six tracks
  content/      public-domain + original song library
  engine/       lesson runtime: PlayAlong (wait/tempo judging), flashcards, rhythm,
                fretboard activities, review & gym generators, unlock logic
  state/        zustand store, persistence, spaced repetition, achievements, export/import
  screens/      onboarding, home, learn, track map, lesson player, songs, studio, progress, settings
```

All music is either public domain (traditional melodies, or composers who died long ago with works published before 1931) or composed for Clef Coach.

## License

MIT. VexFlow is MIT; the Bravura font is SIL OFL 1.1.
