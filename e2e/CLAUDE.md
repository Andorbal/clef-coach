# e2e: Playwright

- **Config:** `playwright.config.ts`. Two projects, `ipad` (iPad Mini landscape) and `phone`
  (Pixel 7), both Chromium. Tests run serially against a dev server on **127.0.0.1:5188**,
  which Playwright starts itself or reuses if one is running. The preinstalled Chromium at
  `/opt/pw-browsers/…` is used when present; don't run `playwright install`.
- **Running:** `npx playwright test <file-or-pattern> --project=ipad` for one spec on one
  device. The whole suite takes several minutes. These files are **not typechecked** (no
  tsconfig includes `e2e/`); Playwright strips the types when it runs them.

## Driving the app

- `helpers.ts`:
  - `onboard(page, name)` clicks through `/#/welcome` and creates a profile.
  - `pressMidi(page, midi)` plays a note on the computer keyboard (MIDI 60–76: A W S E D F T
    G Y H U J K O L P ;).
  - `solveLesson(page)` plays any lesson correctly by reading `.activity[data-expected]`
    (meet, flashcards, playalong).
- **No real MIDI or mic.** Notes come from computer keys. `play-bench` uses Chromium's fake
  media device (`--use-fake-device-for-media-stream`), which beeps.
- **Peeking inside:** `page.evaluate(async () => (await import('/src/…ts')).fn())` imports
  app modules from the dev server. It's the same module instance the app uses, so you can
  tap `getBus('band')` with an AnalyserNode (`band.spec.ts`), or read the Synth Lab's own
  analyser through `getLabSynth().analyser` (`synth.spec.ts`). You can also patch prototypes
  in `addInitScript` (`listen.spec.ts` counts `AudioBufferSourceNode.start`).
- **State:** check it through `localStorage['clefcoach.data.v1']` / `['clefcoach.device.v1']`.
  Seed device settings by writing that key and reloading.
- **Sound banks:** `band.spec.ts` serves alphaTab's small `sonivox.sf3` in place of the
  GeneralUser GS download (`page.route('**/sounds/GeneralUser-GS.sf3', …)`).
- **Selectors:** prefer roles and text. PlayAlong exposes `data-phase` (`ready`, `countin`,
  `playing`…) and `data-expected`. Synth panels carry `data-module` (`osc1`, `filter`…) and
  the lesson coach `data-step`; scope control names to a module, since the keyboard has
  its own "Octave down". On a phone the lab's engine names are short (Analog, Table).
- **Loading screen:** `index.html` shows `#boot` until a screen is up (`boot.spec.ts`). It
  stops intercepting clicks as soon as it starts fading, so tests needn't wait for it.

## Opt-in runs (skipped unless the variable is set)

| Spec | Run | What |
|---|---|---|
| `sweep` | `SWEEP=1 npx playwright test sweep --project=ipad` | every step of every lesson renders (via dev-only `?step=N`); Synth School's quizzes also wait for their judge (`-g "Synth School"`) |
| `screens` | `SHOTS=dir npx playwright test screens` | a screenshot of every screen |
| `media` | `tools/readme-media.sh` | re-records the README screenshots and GIFs (needs ffmpeg) |
| `audio-bench` | `BENCH=1 npx playwright test audio-bench --project=ipad` | audio-thread cost of band scenarios in an OfflineAudioContext, with loudness fingerprints (`BENCH_TRACKS`, `BENCH_ONLY`, `BENCH_RUNS`, `BENCH_BANK`, `BENCH_OUT`) |
| `play-bench` | `npm run build && BENCH=1 npx playwright test play-bench --project=ipad` | renderer CPU, main-thread time and paints per layer while performing with the band (production build via `vite preview` on 5189; `BENCH_TRACE=1` for trace events) |

See `docs/performance.md` for how to read the two benchmarks.
