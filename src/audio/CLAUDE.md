# src/audio: the audio engine

Everything that makes or hears sound. `index.ts` is the public API, though most code imports
modules directly. Nothing touches Web Audio at import time: the shared `AudioContext` is
created on first use (`getAudioContext()`).

## Signal flow (context.ts)

```
synth ─┐                       ┌──────────────── dry ────────────────┐
sfx   ─┤                       │                                     │
metro ─┼─ bus gains ───────────┤                                     ├─ compressor ─ master ─ out
band  ─┘      └─ per-bus send ─┴─ Convolver (1.6 s room, 1.1 s kept) ┘
                                    → high-pass 180 Hz → wet 0.12
```

- **Buses:** `getBus('synth' | 'sfx' | 'metronome' | 'band')`. The band bus has no send of its
  own: each band track sends to `getReverbInput()` at its own level (the mixer's reverb
  knob).
- **The reverb is the biggest fixed audio cost.** A ConvolverNode works whenever anything
  plays. Its impulse is procedural (`dsp/reverb.ts`), cut at 1.1 s where the tail is ~60 dB
  below the dry sound. Its cost has a large fixed part, so shortening it further gains little.
- **iOS:** `unlockAudio()` must run inside a user gesture. The first pointer/key after any
  suspension also retries. `setRecordingSession()` switches `navigator.audioSession` between
  playback and play-and-record (while the mic is open).
- **Clocks:** schedule on `ctx.currentTime`. Compare with input events (`performance.now()`)
  through `ctxTimeToPerfNow` / `perfNowToCtxTime`, which include output latency.
  `metronome.beatTime(i)` is the grid.

## Sound sources

| Module | What | Per note |
|---|---|---|
| `synth/engine.ts` `SynthEngine` | Rendered instruments: piano, epiano, guitar/ukulele/bass (Karplus–Strong), mallets. Pure renderers (`piano.ts`, `guitar.ts`, `mallets.ts`, `epiano.ts`) write one buffer per (voice, key, velocity bucket) into a **shared LRU cache** (budget set from the device in App.tsx). | BufferSource → Gain → StereoPanner |
| `synth/index.ts` `synth` | The app's own instrument (taps, demos, the other hand), a singleton SynthEngine. `setExternal(voice, ext, layer)` routes a voice through a sampler instead (or as well). | |
| `synth/live.ts` `playLive` | Held band sounds made from oscillators: organ, strings, pads, brass, reeds, flute, lead, choir. 2–3 oscillators → low-pass (+ formants for choir) → amp envelope, with delayed vibrato. **Vibrato and filter sweeps are k-rate** (`kRate()`). Oscillators stop 3 release-time-constants after the note (−78 dB). | 6–15 nodes |
| `synth/drumkit.ts` `DrumKitPlayer` | Synthesised GM kits (`drums.ts`, pure, ~1600 lines), rendered once per (kit, note, layer). Choke groups (closed hat cuts open hat). | BufferSource → Gain → Panner |
| `samples/` | SoundFont 2/3 and SFZ banks (see below). | BufferSource → [low-pass] → Gain (envelope) → [Panner] per region |
| `metronome.ts` | Lookahead scheduler (25 ms timer, 100 ms horizon). `onBeat` fires when the click is *heard*. | |
| `sfx.ts` / `sounds.ts` | UI sounds (pure renderers, cached). | |

**Every sound must call `markAppSound(until, { midis, kind })`.** The mic uses these marks to
avoid "hearing" the app's own notes (`appSoundBlocksNote`). Band notes pass `intervals: [0]`
(only their exact pitch is ignored).

## Sample banks (src/audio/samples)

- **Parsing is pure and never decodes audio:** `sf2.ts` (SF2 and SF3) and `sfz.ts` turn files
  into `SamplePreset`s made of `SampleRegion`s (`types.ts`, in player units: seconds, dB,
  cents, pan −1..1).
- `store.ts`: banks as Blobs in IndexedDB. `files.ts` reads slices (and zips, ZIP64 included).
- `manager.ts`: the list of banks (observable), `openBank` (parsed once per session),
  `samplerFor`/`gmSampler`, adding and downloading banks (`catalog.ts`).
  `useSoundBanks.ts` is the React hook.
- `sampler.ts` `Sampler`:
  - **Decoding:** samples are decoded on demand into a global LRU within the memory budget
    (`setSampleBudget`, from Settings or `defaultSampleBudgetMB()`). Keys are pinned while a
    `prepare()` runs.
  - **Playing:** `noteOn` returns `null` when a sample isn't decoded yet (it starts decoding
    it), and the caller falls back to the built-in sound. For notes of known length (the
    band), `play(..., duration)` schedules the whole envelope, release included, up front.
  - **Formats:** SF3/Ogg uses `decodeAudioData`, falling back to a WASM Vorbis decoder (a
    lazy chunk) for old Safari.
- `apply.ts`: applies Settings → Instrument sounds to the `synth` voices.
- Known quirk (not changed, it would rebalance mixes): regions with `pan === 0` skip the
  panner and go out mono. GainNodes sum with `channelCountMode: 'max'`, so on a band strip a
  centred mono hit is 3 dB louder whenever a panned voice is also connected. This affects
  sampled drum kits most.

## Input (src/audio/input)

- `manager.ts` `inputManager` is **the** subscription point for notes from MIDI, the mic, taps
  and the computer keyboard. It tracks held notes, forwards `setExpected` (the notes a lesson
  waits for) to the mic, and optionally echoes taps through `synth`.
- `mic.ts` `MicInput`: getUserMedia → high-pass → AnalyserNode(8192), polled by a timer. The
  full analysis (~55 fps: YIN `yin.ts`, spectrum `spectrum.ts`, `FrameAnalyzer`,
  `NoteTracker`, `ChordTracker`, `assist.ts`) **only runs while something listens for notes**
  (`retain()`, with a 1.5 s grace period). Otherwise a 12 Hz tick only measures the level. The
  stream stays open between screens, so there are no new permission prompts.
- `midi.ts` (Web MIDI input, sustain pedal), `keyboard.ts` (computer keys, A = C4).
- `dsp/fft.ts` is a radix-4 FFT; `dsp/util.ts` has seeded RNGs, interpolation and RMS.

## Tests

- **Pure parts** (renderers, DSP, parsers, envelope maths) are unit-tested in Node:
  `synth/*.test.ts`, `samples/*.test.ts`, `input/pitch.test.ts`, `misc.test.ts`.
- `input/pipeline.test.ts` renders synthesised piano and guitar into "recordings" and runs
  the exact mic analysis chain over them.
- `runtime.test.ts` runs the engine, metronome, sfx and input manager against a **fake
  AudioContext** that records what was scheduled. It checks wiring and timing, not sound. A
  new AudioNode method or param the engine uses must be added to the fake.
- **What it costs and how it sounds:** `BENCH=1 npx playwright test audio-bench --project=ipad`
  renders band scenarios into an OfflineAudioContext and reports CPU ms, node counts and a
  loudness fingerprint (see `docs/performance.md`). Run it before and after any audio change
  and compare the fingerprints: a pure optimisation should change them by about 0.0x dB.

## Rules of thumb

- Per-voice node count times voice lifetime is the audio-thread cost. Stop sources once they
  are inaudible: −60 to −80 dB is plenty in a mix.
- **a-rate modulation is expensive.** An oscillator whose detune or frequency is modulated
  per sample computes `exp2` and picks a wavetable per sample. A biquad with an automated
  frequency recomputes its coefficients per sample. Use `automationRate = 'k-rate'` for
  anything slow (it is ignored where unsupported).
- Things measured to make **no** difference (don't bother): removing per-note StereoPanners,
  bypassing the master compressor.
- Before starting a sequence, warm buffers with `synth.preload` / `Performer.prepare`. Both
  render in idle slices, so first notes don't hitch.
- A voice queued while the context is suspended is dropped if it is more than 400 ms stale
  when audio resumes, so a backlog never blasts out at once.
