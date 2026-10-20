# Clef Coach — notes for working in this repo

A React 19 + Vite + TypeScript PWA that teaches reading music on piano, guitar, ukulele, bass,
mallets and the bowed strings (violin, viola, cello, double bass). It listens to a real instrument (Web MIDI or the microphone), draws notation with
VexFlow, synthesises every sound itself (plus optional SoundFont/SFZ banks), and can play a
band along with the player. Synth School (`/synth`) teaches synthesizers on a synth the app
runs itself, judging quizzes by ear. Theory School (`/theory`) teaches music theory on a staff
and a keyboard. Production School (`/production`) teaches recording and mixing on a console the
app runs itself, with multitrack sessions played by its own instruments, judging mixes by ear. No server: state lives in localStorage and IndexedDB. The main
target is an **iPad in Safari** (as a home-screen PWA). Treat CPU, GPU and battery use
there as features.

More detailed notes sit next to the code (each loads when you work in that folder):
`src/audio/CLAUDE.md`, `src/perform/CLAUDE.md`, `src/engine/CLAUDE.md`,
`src/songs/CLAUDE.md`, `src/curriculum/CLAUDE.md`, `src/synthlab/CLAUDE.md`, `src/theory/CLAUDE.md`,
`src/production/CLAUDE.md`, `e2e/CLAUDE.md`. Performance
measurements and history are in `docs/performance.md`. The song file format is in
`docs/song-format.md`.

## Commands

| What | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | http://localhost:5173. `npm run dev:lan` serves HTTPS on the LAN for a real iPad (the mic needs a secure context). |
| Unit tests | `npm test` | Vitest, Node environment, `src/**/*.test.ts`. About 1060 tests in ~16 s. One file: `npx vitest run src/notation/scroll.test.ts`. |
| Typecheck | `npm run typecheck` | `tsc -b` over `src` (app), `vite.config.ts` (node) and `tools/**` (tools). **`e2e/` and `playwright.config.ts` are not typechecked.** |
| Build | `npm run build` | `tsc -b && vite build` → `dist/`. About 2 s for the Vite part. |
| E2E | `npm run e2e` | Playwright with the `ipad` (iPad Mini landscape) and `phone` (Pixel 7) projects, both Chromium. It starts its own dev server on **5188**. About 3.5 min for the whole suite; to run one spec: `npx playwright test band --project=ipad`. |
| Song tool | `npm run clefsong -- help` | validate, convert, scan with Claude, AI prompt (`tools/clefsong`). |
| Sound banks | `npm run sounds` | Downloads GeneralUser GS into `public/sounds/` (gitignored, needs network). The audio benchmark uses it. |

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests and build on Node 22. It does not
run e2e. Pushing to `main` deploys to GitHub Pages (`deploy.yml`).

Opt-in Playwright runs (skipped unless their env var is set):

- `SWEEP=1 npx playwright test sweep --project=ipad`: renders every step of every lesson (`-g "Synth School"` for the synth course alone, about a minute; `-g "Theory School"` about two; `-g "Production School"`).
- `SHOTS=dir npx playwright test screens`: screenshots of every screen.
- `MEDIA=dir …` via `tools/readme-media.sh`: the README media.
- `BENCH=1 npx playwright test audio-bench --project=ipad`: audio render cost (see `docs/performance.md`).
- `npm run build && BENCH=1 npx playwright test play-bench --project=ipad`: CPU and repaints while playing along.

Cloud containers: Chromium is preinstalled. `playwright.config.ts` uses
`/opt/pw-browsers/chromium-1194/...` when it exists. Never run `playwright install`.
`.claude/settings.json` registers a SessionStart hook (`.claude/hooks/session-start.sh`)
that runs `npm install` in cloud sessions, so the commands above work from the start. It
also pre-allows those test and build commands.

## Map

```
src/
  main.tsx, App.tsx   entry; HashRouter; lazy screens; the boot screen hand-off (Screen/BootDone)
  music/              pitch, rhythm (PPQ = 48), Score model, text notation parser (+ SongDef),
                      instruments & tunings, fingering engines, chords & chord book, GM, band parts
  notation/           VexFlow renderer (one long horizontal system), NotationView, scroll path
  instruments/        SVG piano keyboard, fretboard, mallet bars, chord diagrams
  audio/              Web Audio: context & master chain, synth voices, sampler & sound banks,
                      metronome, sfx, mic/MIDI/touch input → see src/audio/CLAUDE.md
  perform/            the band: arranger, harmony inference, performer, sinks → src/perform/CLAUDE.md
  engine/             lesson runtime: PlayAlong (wait/tempo), activities → src/engine/CLAUDE.md
  curriculum/         17 tracks of units/lessons, builders, generator → src/curriculum/CLAUDE.md
  synthlab/           Synth School: the synth (pure-TS DSP in an AudioWorklet), the sound judge,
                      the panel UI and the course → src/synthlab/CLAUDE.md
  theory/             Theory School: pure theory (intervals, scales, chords, numerals), the
                      course, links to the instrument tracks → src/theory/CLAUDE.md
  production/         Production School: the mixing console (pure-TS DSP in an AudioWorklet),
                      sessions and stems (in a worker), the mix judge, the console UI and the
                      course → src/production/CLAUDE.md
  content/songs/      the built-in song library (TS), one file per instrument
  songs/              song file format, importers (MusicXML, MIDI, Guitar Pro, tab), Claude scan
  state/              zustand store, persistence, SRS, achievements, export/import, courseNav
                      (progress through a unit-and-lesson course)
  screens/, components/  React screens (one CSS file each) and shared UI
tools/                clefsong CLI, fetch-sounds, README media script
e2e/                  Playwright specs → e2e/CLAUDE.md
docs/                 song-format.md, performance.md, README media
```

The biggest files are `songs/musicxml.ts` (~1750 lines), `audio/synth/drums.ts`,
`music/chordbook.ts`, `screens/SongStudio.tsx` and `engine/PlayAlong.tsx`. Read them in
parts.

## Conventions

- **Style:** 2-space indent, single quotes, semicolons, long lines (up to ~200 characters) are
  fine, `x => …` without parentheses. There is no linter or formatter config; match the
  surrounding code.
- **Imports:** no file extensions (`'../music/pitch'`). Type-only imports are written inline
  (`import { type Score, buildSteps } from …`) because of `verbatimModuleSyntax`. With
  `erasableSyntaxOnly` there are no enums and no parameter properties: declare fields and
  assign them in the constructor.
- **Comments:** a prose header block on most modules that explains the design and the why, and
  `/** */` on exports. They are written in plain, player-facing English with **British
  spelling** (practise, colour, normalise, behaviour). Comments say why, not what. When a
  change follows a measurement, the comment says so ("re-rendering every frame kept tablets
  warm"), so nobody undoes it.
- **Pure logic lives in `.ts` modules with tests** (music, songs, state, audio DSP and
  renderers, perform). React stays in `.tsx`. Audio renderers (`synth/piano.ts`, `drums.ts`…)
  are pure functions so they can be unit-tested.
- **CSS:** plain CSS, no modules. Each screen or component imports its own file
  (`songstudio.css`, `PianoKeyboard.css`) with a class prefix. Tokens are in
  `styles/tokens.css` and utilities (`.btn`, `.card`, `.pill`, `.row`…) in
  `styles/global.css`. Icons come from `lucide-react`, animation from `framer-motion`. The
  app is dark-only.
- **UI copy:** short, warm, plain. Buttons and labels use sentence case.
- **Commits:** sentence-case, user-facing subjects, often with an area prefix ("MIDI import:
  …", "Song Studio: …"). The body is a short explanation, with bullets for several changes,
  and measurements when it's a performance change.

## State and persistence (src/state)

- One zustand store (`useApp`), saved by hand. `clefcoach.data.v1` holds the profiles, songs
  and tags and is exported/imported. `clefcoach.device.v1` holds `DeviceSettings` and is
  never exported. Sound banks live in IndexedDB.
- **There are no migrations.** Device settings are merged over `DEFAULT_DEVICE`, but profile
  settings are not merged with `DEFAULT_SETTINGS` on load. So a new profile setting must be
  optional and read with `?? default`. A new top-level `PersistedData` field also needs
  `makeExport`, `parseImport` and `mergeData` in `state/logic.ts`.
- **Ids are persistence keys:** lesson ids, song ids, track ids and SRS item keys
  (`note:treble:C4`, `chord:…`), and the unit and lesson ids of Synth, Theory and Production
  School (`sy-osc`, `sy1-1`, `th5-2`, `pr-eq`, `pr5-2`).
  Renaming one orphans users' progress.

## Keep in sync by hand

- **Song format:** `src/songs/format.ts` ↔ `docs/song-format.md` ↔ `SONG_FORMAT_GUIDE` in
  `src/songs/llmPrompt.ts` ↔ the grammar comment at the top of `src/music/parse.ts`.
- **Track ids:** `TrackId`/`TRACK_IDS` (state/types.ts), `TRACKS` (curriculum/index.ts),
  `DEFAULT_TRACKS` (Onboarding.tsx), `TRACK_IDS` in `e2e/sweep.spec.ts`, and possibly
  `SONG_GROUPS`/`RANGES` (content/songs) and the StudioTools presets.
- **Instrument ids:** `INSTRUMENTS`/`INSTRUMENT_IDS`, `DEFAULT_TRACKS`, `InstrumentIcon`,
  Learn's `GROUP_SUBS`, `SONG_GROUPS` and the songs test's `RANGES`. `instrumentFromId`
  matches by prefix, so track and group ids must start with an instrument id.
- **New activity type:** `curriculum/types.ts`, `engine/Activity.tsx`, `engine/labels.ts`,
  `checkActivity` in `curriculum/curriculum.test.ts`, and maybe `engine/review.ts`.

## Performance rules (the iPad is the budget)

The full story and the numbers are in `docs/performance.md`. In short:

- **A tempo-mode frame paints nothing.** The score and playhead scroll as a Web Animation
  (`NotationView` `motion` prop) on the audio's clock, and PlayAlong judges misses on a 50 ms
  timer. Don't add per-frame React state or `requestAnimationFrame` loops to play-along screens.
- **Animate only `transform` and `opacity`** on anything that moves while music plays. Width,
  background-colour and box-shadow animations repaint (and under `backdrop-filter`, re-blur)
  every frame.
- **Audio graph:** slow modulation (vibrato, filter sweeps) goes on k-rate params. Stop voices
  once they're inaudible, and share buffers through the caches. Everything that sounds calls
  `markAppSound` so the mic doesn't hear the app. See `src/audio/CLAUDE.md`.
- **Measure, don't guess:** `audio-bench` (audio-thread cost per scenario, with a loudness
  fingerprint to prove the sound didn't change) and `play-bench` (renderer CPU,
  main-thread time and paints per layer, on the production build).

## Gotchas

- The `/dev/*` preview routes ship in production. `?step=N` on a lesson URL is dev-only
  (`import.meta.env.DEV`); the sweep uses it.
- `index.html` holds the loading screen (`#boot`, inline CSS) shown before any JS runs. React
  removes it from `Screen` in `App.tsx`, which sits beside each route's screen inside its
  Suspense boundary. Full-screen routes get it through `RequireProfile` and the Shell's
  routes through the wrapper inside the Shell. A new top-level route without either must
  wrap its element in `<Screen>`, or the loading screen stays up (`e2e/boot.spec.ts`).
- iOS: audio must be unlocked from a gesture (`unlockAudio`). Safari has no Web MIDI.
  `navigator.audioSession` is set to `play-and-record` while the mic is open.
- The PWA precache skips files over 6 MB (`vite.config.ts`). The Guitar Pro reader
  (alphaTab) and the Ogg Vorbis WASM decoder are lazy chunks.
