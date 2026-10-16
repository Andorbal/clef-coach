# synthlab: Synth School and the Synth Lab

A course that teaches synthesizers from nothing to sound design (`/synth`), and the
synth it teaches on (`/synth/lab`). The screens are `screens/SynthSchool.tsx`,
`SynthLesson.tsx` and `SynthLab.tsx`; everything else lives here.

```
dsp/      the synth and the judge, pure TS (no DOM, no Web Audio): runs in the worklet,
          in offline renders and in Vitest
  params.ts   the Patch (one flat object) and PARAMS: range, curve, default, detents, unit
  waves/tables/filter/env/lfo/fm/fx.ts   the building blocks; voice.ts, core.ts put them together
  render.ts   phrases (note, chord, riff, arp…) rendered offline: quiz targets and the A/B clips
  match.ts    analyse() + compare(): how close two sounds are, as an ear would say
  matcher.ts  Matcher: renders a quiz target once, scores patches, finds hints
audio/    host.ts (LabSynth: AudioWorklet, ScriptProcessor fallback), worklet.ts, loops.ts
ui/       the panel (SynthPanel, Knob, Displays), Keys, useLab, the lesson coach, controls.ts
course/   the course: types, builders, units/*, progress (unlocking, next lesson), guide.ts
presets.ts  the preset library and each engine's init patch
```

## One engine everywhere

`SynthCore` (dsp/core.ts) is the whole synth: four engines (subtractive with two
PolyBLEP oscillators, sub, noise, ring mod and sync; 4-operator FM with 8 algorithms;
16-harmonic additive; procedural wavetables), a 12/24 dB state-variable filter, three
envelopes, an LFO, unison, glide, mono/legato and an effects chain (drive, chorus,
ping-pong delay, FDN reverb, soft limiter). Modulation runs at a control rate of 16 samples.

The live synth runs it in an AudioWorklet (`import workletUrl from './worklet?worker&url'`
bundles the worklet as one file). Quiz targets, "Yours" clips and the judge render the same
code offline, so what a quiz compares is exactly what the player hears. Keep `dsp/` free of
anything the worklet scope lacks (DOM, `window`, Web Audio nodes).

- **Cost:** 8 voices of a 7-voice unison supersaw on both oscillators ≈ 13% of one core
  (Node, the engine test); FM ≈ 4%, additive ≈ 11%. Once no voice or effect tail is
  sounding, `render()` just writes zeros, and the node is torn down once no screen holds
  it (`retainLabSynth()`), so the rest of the app pays nothing.
- The synth goes to `getBus('band')` dry: the room reverb would blur what's being taught.
  Notes and clips call `markAppSound` like every other sound.
- MIDI keyboards play the lab through `onMidiNote`; the app's MIDI echo is turned off while
  the lab is open so the device doesn't sound twice.
- The panel only re-renders a module when one of its own values changes (`sameModule`,
  with `DISPLAY_DEPS` for displays that draw other modules' values). Knob drags are
  coalesced to one patch update per frame (`useLab`). The scope draws only while sound is
  playing.

## The judge (dsp/match.ts) is calibrated: measure before changing it

Two sounds are compared as sound, not as settings: pitch (median offset and wander, skipped
for chords and unsteady targets), tone (third-octave spectrum in a loudness domain, long-term
and frame by frame), shape (loudness contour relative to the peak, attack time, level) and
movement (LFO depth, rate and regularity; only judged when the target or the answer uses
the LFO or chorus). The overall score is a weighted geometric mean; the pass mark is 0.75
(`PASS_MARK`), with a lower `pass` on quizzes where the ear is more forgiving than the
numbers (FM, pulse width, effects).

The tests hold it in place:

- `match.test.ts` has a list of pairs that **must** pass (sound alike to an ear) and pairs
  that **must** fail. A change to the judge must keep both lists green.
- `course.test.ts` checks **every quiz**: the target is reachable with the lesson's visible
  controls, the starting patch doesn't already pass, and a near miss (each control a little
  off, respecting detents and end-stops) does pass.

If a new quiz fails the near-miss test, first ask whether the target is actually fair (a
difference an ear can't hear, two controls that cancel), then give the quiz its own `pass`.

Hints come from experiment (`Matcher.hints`): each visible control is set to the target's
value and the one that helps most is suggested, so an inaudible knob is never pointed at.

## Writing lessons

- Builders in `course/build.ts`: `lesson(id, title, goal, kind, { start, controls, fresh }, steps)`,
  `explain`, `explore` with `task(text, check, play?)`, `listen` with `round(answer, patch)`,
  `match(title, body, target, { pass, phrase, controls })`. Patches are deltas on the
  lesson's `start`, which is a delta on the engine's init patch.
- A lesson shows only its `controls`; `fresh` marks the new ones. Introduce one or two
  controls at a time and let the learner hear each one before the quiz asks for it.
- Every unit ends with a `checkpoint` (80% to pass; it's also the test-out). Units unlock by
  `requires` (default: the unit before). `PARTS` in `course/index.ts` groups units on the map.
- Prose is Markdown-lite (`ui/Prose.tsx`): paragraphs, `- ` lists, `**bold**`. Name the
  control as real synths do (the common names in `ui/controls.ts` `aka`, and `course/guide.ts`).
  Don't tie the course to one DAW or vendor: Clef Coach isn't affiliated with any, so the
  field guide describes kinds of synth, not products. Famous instruments as history (the
  DX7, the TB-303) are fine.
- **Ids are persistence keys:** unit ids (`sy-…`), lesson ids (`sy1-1`…) and `SavedPatch`
  ids are saved in profiles. Never rename one. New params must keep old saved patches
  working (`makePatch` fills missing keys from the init patch).
- New param: `params.ts` (`PARAMS`, `INIT_PATCH`), the DSP, a `CONTROLS` entry (the
  completeness test fails without one) and a module in `MODULES`.
- `SWEEP=1 npx playwright test sweep -g "Synth School" --project=ipad` renders every step of
  every lesson and waits for each quiz's judge (about a minute).

## Progress

`profile.synth` (optional, `SynthProgress`): per-lesson results and saved patches. It shares
XP, streaks and the daily goal with the rest of the app (`applySynthOutcome` →
`applyCommon` in `state/logic.ts`), is exported and merged like the rest of a profile, and
has its own achievements (`synth-*`). The lab's last patch is a device-only convenience in
`localStorage['clefcoach.synthlab.patch']`.
