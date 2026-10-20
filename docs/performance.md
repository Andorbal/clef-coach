# Performance

Clef Coach runs for long stretches on tablets, often an iPad on a music stand. That means
playing along with a band through the microphone, sometimes with a sound bank loaded. Heat
and battery are part of the experience, so this page keeps track of where the CPU goes, how
to measure it, and what has been done.

## Where the cost goes

Measured in Chromium on the production build, playing *Ode to Joy* with its band
(`play-bench`). The rendering CPU counts every renderer thread: main, compositor, raster
and audio.

| Performing with the band | Renderer CPU | Main thread |
|---|---|---|
| On-screen input, before this round | 361 ms/s | 134 ms/s |
| On-screen input, now | **219 ms/s** | **47 ms/s** |
| Microphone, before | 455 ms/s | 158 ms/s |
| Microphone, now | **350 ms/s** | **94 ms/s** |
| Microphone on, idle on the song page, before | 94 ms/s | 34 ms/s |
| Microphone on, idle on the song page, now | **48 ms/s** | **17 ms/s** |

The band's audio rendering is only part of this: about 45 ms/s on the same machine
(`audio-bench`). **During play-along the UI cost more than the sound.** Before this round
the notation re-rendered on every frame to scroll. A width transition in the header, the
note-colour fades and the beat pulses repainted a full-screen layer about 25 times a second.
On an iPad, WebKit paints those tiles on the CPU, at Retina resolution.

Audio rendering (`audio-bench`, CPU ms to render 49 s of music, median of 5):

| Band | Before | Now |
|---|---|---|
| Song's own parts, built-in sounds | 3298 | **2186** (−34%) |
| Automatic ballad, built-in sounds | 3148 | **2156** (−32%) |
| Song's own parts, GeneralUser GS | 2338 | 2189 (−6%) |
| Automatic ballad, GeneralUser GS | 2266 | 2187 (−3%) |
| Bank layered over built-in sounds | 4500 | **3345** (−26%) |

The loudness fingerprints of before and after agree to within 0.01 dB overall, and within
±0.04 dB for 90% of 50 ms windows. The sound didn't change.

## The tools

**`e2e/audio-bench.spec.ts`**: `BENCH=1 npx playwright test audio-bench --project=ipad`

- **How it works:** it swaps the app's AudioContext for an OfflineAudioContext, loads a band
  into the real `Performer`, pumps it every 100 ms of audio (as its live timer does), and
  measures the renderer's CPU time for the render minus the pumping.
- **Reading it:** it reports CPU ms, "× realtime", and the nodes created by type.
  `BENCH_TRACKS=1` also times each part alone, plus `none` (the master chain with nothing
  playing). Chromium on a server isn't Safari on an iPad, but both do the same work per
  node, so relative changes carry over.
- **Fingerprints:** results go to `test-results/audio-bench.json` (`BENCH_OUT`), including
  an RMS-per-50 ms loudness fingerprint for each scenario. Diff the fingerprints of two runs
  to prove an optimisation is inaudible.
- **Sound bank:** it uses `public/sounds/GeneralUser-GS.sf3` (run `npm run sounds` first),
  else the small SoundFont that ships with alphaTab.
- **Noise:** expect about ±5% between runs on a shared machine. Use `BENCH_RUNS=5` for
  decisions.

**`e2e/play-bench.spec.ts`**: `npm run build && BENCH=1 npx playwright test play-bench --project=ipad`

- **What it runs:** the production build, started with `vite preview` on 5189. It onboards,
  opens Ode to Joy and performs it with the band, once with on-screen input and once with
  Chromium's fake microphone (a beep, so the app hears wrong notes).
- **What it reports:** renderer CPU and main-thread time (script, style, layout), idle and
  while performing. It also lists **paints per composited layer** over 4 s. That list is the
  quickest way to find what repaints: a layer painting ~60 or ~25 times in 4 s is the bug.
  `BENCH_TRACE=1` adds the busiest trace events per thread.
- **Caveat:** the GPU process is software-rendered here, so ignore its numbers.

For one-off digging, Chrome's trace category
`disabled-by-default-devtools.timeline.invalidationTracking` names the element and reason
behind every style, layout and paint invalidation. That's how the width transition and the
SVG fill fades were found.

## What has been done

**Round 1: listening and practising** (commit "Cut the CPU and GPU cost of listening and
practising")

- **FFT:** radix-4 FFT, and YIN's inverse transform uses the Hermitian half-size trick. The mic
  pipeline costs ~45% less per frame.
- **Mic on demand:** analysis runs only while something listens for notes. Otherwise a
  12 Hz level tick runs.
- **Repaints:** the input meter re-renders only on visible level changes. The playhead got
  its own transform layer, and note-name labels are memoised.
- **Background:** the background glows are gradients, not `filter: blur`, and their drift
  pauses on practice screens.

**Round 2: playing along with the band**

- **Scroll as a Web Animation:** in tempo mode (and Listen), `NotationView` gets a `motion`
  clock (`{ startMs, msPerTick }`). It animates the music and the playhead with keyframes
  from `notation/scroll.ts`: the playhead's path is linear between the notes, so a few
  hundred keyframes describe it exactly. On iPad, Core Animation runs it. PlayAlong judges
  misses on a 50 ms timer instead of a per-frame loop. Main thread −60%.
- **Compositor-only animations:**
  - The progress bar is a `scaleX`, not a width transition.
  - Note colours change at once while the music scrolls; fades remain in wait mode.
  - The playhead's beat pulse and the beat light flash animate only opacity and transform.
- **Mic meter:** it has its own layer and no transition. Easing each 80 ms step had kept the
  screen redrawing at 60 fps for as long as the mic was on.
- **Live voices** (strings, pads, organ, brass, choir): vibrato and filter sweeps are k-rate,
  and oscillators stop at −78 dB instead of −130 dB. The strings/pad track costs about half
  as much.
- **Reverb:** the convolver keeps 1.1 s of its 1.6 s room (the rest is ~60 dB under the dry
  sound). That's ~15% off the reverb, which has a large fixed cost whatever its length.

**iOS room** (commit "Hand-shift arrows, a Home button after lessons, a steadier room on iPad")

- On iPhone and iPad the room is 0.25 s, short enough for the convolver to do all its work
  on the audio thread (live, the part after 12288 frames runs on a helper thread, which can
  fall behind on a busy iPad and crackle). That was the reason, not CPU, but it costs less
  too: `audio-bench`, song band with built-in sounds, median of 5: 3972 → 3549 CPU ms
  (−11%, same machine; the master chain alone: no change). Loudness fingerprint: −0.03 dB
  overall, 90% of windows within 0.1 dB.
- The `ipad` Playwright project identifies as an iPad, so `audio-bench` measures this
  room from now on. Numbers from before this change aren't comparable for the reverb.

**Production School's console** (pure TS in an AudioWorklet, `src/production`)

- Measured in Node at 48 kHz on Night Drive's eight tracks (a 10 s loop): a rough mix (faders
  only) 1.5% of a core at first, the session's finished reference mix (EQ, five
  compressors, reverb, delay, bus compressor, limiter) 3.1%.
- An effect nothing is sent to is skipped once its tail has died: a reverb with no sends
  had been a third of a rough mix's cost. Rough mix 1.5% → 0.6%.
- Compressors work out their gain every 8 samples from the peak in between and ramp it,
  instead of a log and a power per sample; the limiter takes its meter reading once a
  block. Reference mix 3.1% → about 2%.
- Stems are rendered in a worker and cached track by track, so a lesson on a session
  already heard starts at once; the judge renders and measures at half the playback rate
  in the same worker (about 0.4 s a check in Node).

## Rules of thumb

- A tempo-mode frame should paint nothing. Move things with transforms or Web Animations,
  and never with per-frame React state.
- Animate `transform` and `opacity` only. Anything else repaints, and under a
  `backdrop-filter` it re-blurs too.
- Audio: count nodes × lifetime. Use k-rate for slow modulation, and stop sources once
  they're inaudible.
- Measure before and after. Check the fingerprint for audio changes and the paints per
  layer for UI changes.

## Ideas not taken (yet)

- **Suspend the AudioContext when idle** (no mic, nothing playing). It would save the audio
  thread's idle wake-ups on MIDI and on-screen-input setups, but costs latency on the first
  note after a pause. The mic keeps the context running anyway.
- **A mono reverb impulse** (one convolution instead of two, width from a short delay). It
  would take about 40% off the reverb, but it changes the sound.
- **Live patches rendered to looping buffers** (like the sampled instruments). It would make
  a string note one buffer source, but it's a rewrite with a risk of loop seams.
- **Centred sampler regions:** they bypass the panner and go out mono, which makes some
  drum hits on a sampled kit 3 dB louder while a panned voice is sounding (see
  `src/audio/CLAUDE.md`). A fix (stereo strip inputs and equal-power mono voices) rebalances
  sampled kits, so it needs listening first.
- Measured and found not worth it: dropping per-note StereoPanners, bypassing the master
  compressor.
