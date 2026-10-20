# src/theory: Theory School

A course in music theory from nothing to chromatic harmony and form (`/theory`), taught on
a staff and a keyboard. The keyboard is for trying things, not for learning the piano:
lessons ask for notes, never technique. Screens: `screens/TheorySchool.tsx` (the map, through
`components/CourseMap.tsx`) and `screens/TheoryLesson.tsx`.

```
theory.ts        pure theory: intervals (spelled: a major 3rd above E is G♯), scales and modes,
                 keys, chords and inversions, chords in a key (Roman numerals), analysePlayed
links.ts         links to and from the instrument tracks (see below)
course/
  types.ts       Figure, Check, steps (explain, explore, quiz, build, drill), lessons, units
  build.ts       builders (lesson, unit, fig, explain, explore, task, quiz, build, drill, C.*)
                 and round generators (intervalRounds, chordRounds, numeralRounds…)
  checks.ts      checkPlayed / attemptMissed: does what's played answer a task?
  index.ts       COURSE (unit order, `requires`), PARTS (the map), THEORY (courseNav)
  units/*.ts     the content, one unit per file
ui/
  Workbench.tsx  useBench (notes from inputManager), TheoryPaper (figure or live notes,
                 named), TheoryKeys (the keyboard dock), hearFigure
  Coach.tsx      the step coaches
  figure.ts      figures → scores, labels and playback (pure)
  Links.tsx      PracticeLinks (in theory lessons), TheoryLinks (in instrument lessons)
```

## Writing lessons

- A lesson is `lesson(id, title, kind, goal, steps, { key, range, topics })`. `key` is the
  key the lesson thinks in: played notes are spelled and named in it. Every unit ends with
  a `checkpoint` (80% to pass, and it's the test-out); other lessons pass at 70%.
- **Figures** are notes in the text notation (`fig('C4 E4 G4')`, `'[C4 E4 G4]'` for a chord,
  `'C4/q D4/e E4/e | F4/h'` with `time` for rhythm). Options: `clef` (default chosen from the
  notes; `'grand'` splits at middle C), `key`, `time` (shows bars and the time signature),
  `labels` (`'names' | 'degrees' | 'steps' | 'intervals'` or one string per note/chord),
  `keys` (lit keys; default the notes), `play` ("Hear it": as written, together, apart then
  together), `staff: false` (keys and sound only, before the staff is taught).
- **Checks** (`C.note('E')`, `C.chordOf('C','E','G')`, `C.melody(...)`, `C.interval(7, {
  from, together, up })`, `C.chord('min', { root, inversion })`, `C.scale('D', 'major')`,
  `C.any(n)`): note names without an octave match any octave.
- **Quiz** rounds are written (`round(...)`, `rounds([...])`) or generated (`rng => QuizRound[]`):
  every run is different. `mode: 'hear'` hides the notes and plays them (ear training).
- **Build** rounds ("play it") carry `answer`, the notes of a right answer: shown after two
  misses, and the course test plays them to prove the round can be answered.
- **Drill** borrows a track activity (`name`, `play`, `interval`, `keysig`, `rhythm`) on the piano.
- Prose is Markdown-lite (`synthlab/ui/Prose.tsx`): paragraphs, `- ` lists, `**bold**`,
  `*italic*`. Short paragraphs; one idea per explain step; hear it, then play it, then quiz it.
- **Ids are persistence keys:** unit ids (`th-…`) and lesson ids (`th5-2`…) are saved in
  profiles. Never rename one.

## Links with the instrument tracks

Nobody keeps a table of lesson ids. `links.ts` works out each instrument lesson's topics from
its activities (a minor key, 6/8, dotted rhythms, an interval drill, chords…), and the first
lesson of each track that uses a topic is where that track introduces it. A theory lesson
lists the topics it teaches (`topics`); the first theory lesson listing a topic owns it.
Links show on the track map's lesson sheet and the lesson intro ("the theory behind it"),
and in theory lessons ("where you'll use it"), ticked when passed. The course test fails on
a topic no instrument lesson uses unless it's in `THEORY_ONLY`.

## Tests

`theory.test.ts` holds the theory itself (spellings, scales, chords, numerals).
`course/course.test.ts` checks every unit: ids, checkpoints, every figure builds, every
quiz round has its answer among the options (five seeds of every generator), every build
round is answered by its own answer (and not counted as a miss on the way), topics are real.
In the browser: `SWEEP=1 npx playwright test sweep -g "Theory School" --project=ipad`.
