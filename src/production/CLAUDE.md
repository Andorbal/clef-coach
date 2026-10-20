# src/production: Production School and the Mix Lab

A course in recording and mixing, the hands-on side (`/production`): levels, panning, gain
staging and recording faults, EQ, compression, reverb and delay, the mix bus, mastering and
loudness, then whole mixes. It's taught on a mixing console the app runs itself, with
multitrack sessions played by the app's own instruments. The Mix Lab (`/production/lab`)
is the whole console with any session. Screens: `screens/ProductionSchool.tsx`,
`ProductionLesson.tsx` and `MixLab.tsx`.

```
dsp/      pure TS (no DOM, no Web Audio): runs in the worklet, the worker and Vitest
  params.ts    the Mix: one flat map of numbers ("bass:fader": -6), with each setting's range
  blocks.ts    biquad, channel EQ, compressor, look-ahead limiter, FDN reverb, ping-pong delay, loudness meter
  mixer.ts     Mixer: stems → strips → sends/returns → bus compressor → limiter → master (meters everywhere)
  sessions.ts  the four sessions (pop, acoustic, rock, electronic): parts in the text notation, rough and reference mixes
  stems.ts     each part rendered as a mono loop; recording faults baked in (clip, hiss, rumble, boom, mud, harsh, dull, uneven, room)
  analyse.ts   a mix rendered and measured: per channel loudness, third-octave shape, dynamics; master loudness and peaks
  judge.ts     how close a mix is to a target (balance, pan, tone, dynamics, space, master) or to goals, with hints
audio/    core.ts (the live console), worklet.ts, host.ts (Studio: graph, transport, meters), studioCore.ts + stems.worker.ts (stems and judging off the main thread)
course/   types, build (builders, conditions, round generators), controls (sections → settings), index, units/*
ui/       Console (strips, faders, meters, EQ/comp editors), Coach (the step coaches), useConsole, Visuals, format
```

## How it runs

- Stems are rendered in a worker (`stems.worker.ts`), cached track by track (a 10 s loop at
  48 kHz is ~2 MB a track, 20 kept), then moved to the AudioWorklet. Main-thread fallbacks
  for both. The console goes to the band bus dry (no room reverb on a mix being judged), and
  playback calls `markAppSound`.
- Meters come back ~20 times a second while anything sounds and move by transform; React
  state never sees them. A fader drag commits React state once a frame. Once tails have
  died the mixer writes zeros and posts nothing.
- Solo and `master:mono` are monitoring: the judge ignores them (`withoutMonitoring`).
- Auditioning (`hearMix`) plays another mix (Target, A/B, "with reverb") on the same loop
  without touching the learner's settings.

## The judge

Mixes are compared as sound: both are rendered (at half the playback rate, in the worker)
and measured. Balance is relative (everything up together is no change, so trim and fader
are equivalent); tone is the third-octave shape weighted by where the energy is; dynamics
are the spread of 100 ms levels and the crest factor. Each measurement has a tolerance
(`TOL`): one tolerance off scores 0.75 (`PASS_MARK`), an aspect scores its worst channel and
the mix its worst aspect. Goals (`loudness`, `peak`, `headroom`, `input`, `relative`) score
the same way. `judge.test.ts` holds the behaviour in place; measure before changing it.

## Writing lessons

- Builders in `course/build.ts`: `lesson(id, title, kind, goal, { session, channels, start, controls, fresh }, steps)`,
  `explain(title, body, { visual, hear: [hear(label, mix)] })`, `explore(title, body, [task(text, C.…)])`,
  `listen(title, body, question, options, rounds)` with `round(mixes, answer)`, `abRounds`
  or `namedRounds`, and `mix(title, body, { target | goals + answer, aspects, channels, pass })`.
- Mixes are deltas: a step's on the lesson's `start`, on the session's `rough` mix. Settings
  are `channel:param` (`CHANNEL_PARAMS`), `master:param`, `fx:param` (see `dsp/params.ts`).
- `controls` lists console sections: `bass:fader`, `*:eq`, `master:limiter`, `fx:reverb`, or
  single settings like `lead:midGain` (`course/controls.ts`). Show only what's being taught;
  `fresh` marks new ones.
- `channels` picks tracks or adds takes with faults: `{ id: 'take2', from: 'guitar', name: 'Take 2', fault: { clip: 10 } }`.
  Every take of a part is the same performance, so A/B is fair; a clipped take is
  loudness-matched to a clean one.
- A quiz's target must change only shown controls, be clearly audible (one channel 3 dB
  or more, a pan of 0.4 or more, an EQ move of 6 dB or a high-pass well into a part's
  energy), and be reachable without exactness. Goals-only quizzes need an `answer`.
- Every unit ends with a `checkpoint` (80% to pass; it's the test-out). Other lessons pass at
  70%. Prose is Markdown-lite (`synthlab/ui/Prose.tsx`), British spelling, the names DAWs
  use. Explain, let them hear it (`hear`), let them try it (`explore`), then ear-train
  (`listen`) and quiz (`mix`).
- **Ids are persistence keys:** unit ids (`pr-…`), lesson ids (`pr5-2`…), session and
  channel ids. Never rename one.

## Tests

`dsp/stems.test.ts` (every session renders at its level), `dsp/judge.test.ts` (each aspect
behaves as an ear would) and `course/course.test.ts`: every lesson's ids, tracks, controls,
explore tasks (they read shown controls), listen rounds (five seeds; the answer is an option,
A and B differ) and every mix quiz through the judge (the start fails, the target passes
against itself, a near miss with every control a little off passes). The course test
listens to 5 s at 16 kHz; `PRODUCTION_FULL=1` listens as the app does. One unit:
`npx vitest run src/production/course -t "pr5-"`. In the browser:
`SWEEP=1 npx playwright test sweep -g "Production School" --project=ipad`.
