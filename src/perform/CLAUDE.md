# src/perform: the band

What the band plays (pure, unit-tested) is kept apart from how it sounds (the performer and
its sinks, on top of `src/audio`).

```
SongDef + Score ─► buildBand (arranger.ts) ─► Arrangement { style, swing, tracks: PerfTrack[] }
                     ├ songBandTracks: the song's own `band` parts (music/band.ts, note language)
                     └ arrange: an automatic band from the chords (harmony.ts infers them if the song has none)

PerfTrack[] ─► Performer.load(tracks, mix) ─► channel strip per track ─► band bus (+ reverb send)
                └ SinkFactory (sinks.ts) picks each track's NoteSink: built-in, sound bank, or MIDI out
```

- `types.ts`: `PerfNote` (tick, ticks, sounding MIDI, velocity, offset s) and `PerfTrack`
  (`id` such as `song:0`, `auto:bass` or `part`, role, GM program, drums, notes). Ticks are
  song ticks (PPQ 48). Swing is applied when the notes are played, not stored.
- `arranger.ts`: styles are one-bar **step-string patterns** per meter. The legend is in the
  file header: drums `X x g .`, bass `R 5 3 7 8 a w - .`, comp `X x d u 0-4 - .`. Adding a
  style means adding a `STYLES` entry plus `BandStyle`/`BAND_STYLES` in `music/band.ts`.
  Output is deterministic for a seed. Odd meters get a generic groove from their beat
  groups. `sliceTracks` cuts a passage for practice runs. `partTrack` makes the player's
  own part for "Listen with the band".
- `harmony.ts`: chord symbols → `ChordSpan`s, or chords inferred by a small dynamic
  programme over half-bars.
- `builtin.ts`: GM program → built-in sound. Struck and plucked sounds use rendered voices,
  held ones use live oscillator patches, drums use the synthesised kits, and sound effects
  get `none`.
- `performer.ts` `Performer`:
  - **Scheduling:** a 25 ms timer schedules notes 0.35 s ahead on the audio clock (the
    metronome's pattern), and skips notes it fell behind on (a hidden tab) rather than
    bursting.
  - **Mixer:** `setMix` updates volume, pan, mute, solo and reverb live. `prepare()` renders
    or decodes every sound first.
  - **Count-in:** `start(t0, secPerTick, { countIn, beatOffset })`; with drums and no
    metronome, the drummer counts in on the sticks.
  - **Shared sounds:** one `SynthEngine` (160 voices) and one `DrumKitPlayer` serve all
    performers, so `dispose(false)` leaves another performer's sound alone.
- `sinks.ts`:
  - **Choosing a sound:** `choiceFor` picks the track's own choice, else the device's GM
    bank, else built-in.
  - **Sound-bank sink:** `SampleSink` falls back to the built-in sound for notes the bank
    can't play yet, or plays both when layered.
  - **MIDI out:** `MidiSink` sends to a MIDI output (drums on channel 10, CC7/CC10 from the
    mixer, timestamps through `ctxTimeToPerfNow`).
- `useBand.ts`: the Song Studio hook. It builds the arrangement, keeps per-song mixer and
  sound prefs in `device.bands`, warms the sounds 1.2 s after the page opens, and drives two
  performers (practice runs, and listening).
- `writeBand.ts`: writes an arranged band into the song as editable band parts.

Tests: `arranger.test.ts`, `harmony.test.ts`, `performer.test.ts`, `sinks.test.ts`,
`writeBand.test.ts` (Node, no audio). To measure the cost of a band playing:
`BENCH=1 npx playwright test audio-bench --project=ipad` (`BENCH_TRACKS=1` times each part
alone).
