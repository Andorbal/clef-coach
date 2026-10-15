# src/engine: the lesson runtime

- `Activity.tsx` switches on `ActivityDef['type']` to a component in `activities/`:
  - `Meet`: introduce a note.
  - `Flashcards`: name, play, interval and key-signature cards.
  - `Reading`: `read`, `piece` and `scale`, all through PlayAlong.
  - `Simple`: rhythm and tips.
  - `Fret`: fretboard find, name, play, octave and shape.
  - `Chords`: chord-play and chord-quiz.

  Each activity gets `ActivityProps` (`ctx: LessonCtx`, `def`, `onDone(ActivityResult)`). A
  new activity type touches `curriculum/types.ts`, this switch, `labels.ts`, `checkActivity`
  in `curriculum/curriculum.test.ts`, and maybe `review.ts`.
- `context.ts`: `LessonCtx` (track, instrument, settings, device, SRS item stats, seeded
  rng…), `resolveVisibility` ('auto' defers to the lesson), `prefsOf`, `ctxTuning`.
- `input.ts`: `useNoteInput` (wraps `inputManager.subscribe`), `useComputerPiano`,
  `useHeldNotes`, `useLetterKeys`/`useNumberKeys`.
- `review.ts`: the SRS review and the endless gym. `progress.ts`: unlocks and test-outs.
  `fingeringView.ts`: hide or show fingering.
- `InstrumentPanel.tsx`: keyboard, fretboard or mallets under the music; taps become note
  input.

## PlayAlong.tsx: the heart of the app

It shows a score and judges what's played, in two modes:

- **wait:** the cursor waits for each step (`buildSteps`). Wrong notes become red ghost notes.
  `inputManager.setExpected` tells the mic which notes to verify.
- **tempo:** a `Metronome` counts in, then the playhead moves in time and every step is
  scored against `stepTimeMs(i)` with a tolerance and the device's latency. Notes the
  player doesn't play (`hands`, `filter`) are played by the app (`synth.playSequence`). An
  optional `band: Performer` starts on the same `t0`.

**Performance rule: nothing re-renders per frame.** When tempo mode (or Listen) starts,
PlayAlong sets one `playheadMotion = { startMs, msPerTick }`. `NotationView` turns it into
Web Animations of the music and the playhead, timed on `performance.now()`'s clock
(`notation/scroll.ts` builds the piecewise-linear path). A 50 ms timer (`tick`) marks missed
steps, updates `contextAt` marks only when they change, and finishes the run. This replaced a
`requestAnimationFrame` loop that re-rendered the notation 60 times a second; the switch cut
main-thread time during band play-along by about 65% (see `docs/performance.md`).

Beat-driven visuals (`BeatLight` and the playhead pulse) go through a tiny bus plus CSS
animations of opacity and transform, so a beat repaints nothing. The progress bar animates
`transform: scaleX`, not `width`.

For e2e, PlayAlong renders `data-expected` (the comma-separated MIDI notes of the current
step) and `data-phase` (`ready`, `loading`, `countin`, `playing`, `preview`, `done`).
`e2e/helpers.ts` `solveLesson` reads `data-expected` to play through any lesson.
