# src/curriculum: tracks, units, lessons

- `types.ts`:
  - **Hierarchy:** `TrackDef` → `UnitDef` → `LessonDef { id, title, kind: learn | practice | song | checkpoint | challenge, goal, intro?: Insight[], steps: ActivityDef[] }`.
  - **Activities:** `ActivityDef` is a union on `type` (meet, name, play, read, piece,
    scale, interval, keysig, rhythm, fret-*, chord-play, chord-quiz, tip).
  - **Generated music:** `MelodyGen` describes it: pitch pool, weighted rhythm cells,
    leaps, accompaniment pattern, fingering position…
- `builders.ts`: compact constructors (`lesson`, `unit`, `tip`, `insight`, `meet`, `name`,
  `play`, `read`, `piece`, `inlinePiece`, `scale`, `interval`, `keysig`, `rhythm`,
  `pickChord`, `strum`, `strumAlong`, `chordQuiz`), the rhythm vocabularies `RH` and the
  pitch pools `P`. Pools are space-separated strings.
- `generate.ts`: the seeded generator (`makeRng`, `generateScore(MelodyGen)`, `scaleScore`,
  `flashScore`, `drawItems`). It writes harmony-aware melodies with accompaniment patterns.
  `chordScore.ts` builds the chord-practice scores.
- `tracks/*.ts`: one file per track (13), each exporting a `TrackDef`. `index.ts` has `TRACKS`,
  `getTrack`, `allLessons`, `findLesson`.

**Adding a lesson:** add a `lesson(...)` to a unit. Every unit **ends with a `checkpoint`**
and has more than one lesson. **Lesson ids are unique across all tracks** (`pt1-1`,
`m4-8-c`…) and are persistence keys, so never rename them. A `piece` must name a song that
exists for that instrument (`content/songs`).

**Adding a track** touches `TrackId`/`TRACK_IDS` (state/types.ts), `TRACKS` here,
`DEFAULT_TRACKS` (screens/Onboarding.tsx) if it's a default, `TRACK_IDS` in
`e2e/sweep.spec.ts`, and possibly `SONG_GROUPS`/`RANGES` (content/songs) and the
StudioTools presets. Track ids must start with an instrument id (`instrumentFromId` matches
by prefix).

**Tests:**

- `curriculum.test.ts` checks every activity of every track: pitches within the
  instrument's range, generated measures filling exactly (seeds 1–6), songs existing with
  the right instrument, chords voiceable in every ukulele tuning, scale fingerings.
- `generate.test.ts` and `chordScore.test.ts` cover the generator.
- For the browser: `SWEEP=1 npx playwright test sweep --project=ipad` renders every step of
  every lesson (via the dev-only `?step=N`).
