/**
 * End-to-end (offline) tests of the microphone analysis chain on realistic
 * instrument sounds: the synthesised piano/guitar are rendered into a
 * "recording", which is then analysed frame by frame exactly like MicInput
 * does (FrameAnalyzer → NoteTracker with spectral confirmation; ChordTracker +
 * verifyChord in chord mode).
 */
import { describe, expect, it } from 'vitest';
import { ChordTracker } from './chord';
import { AssistRouter, buildAssistFrame, computeSpectrum, FrameAnalyzer, NoteTracker, rms, verifyChord } from './pitch';
import type { TrackerEvent } from './pitch';
import { renderPianoSamples } from '../synth/piano';
import { renderGuitarSamples } from '../synth/guitar';
import { mulberry32 } from '../dsp/util';
import { positionsFor } from '../../music/guitar';

const SR = 48000;
const HOP = Math.round(0.018 * SR); // ≈55 frames/s like the mic poller

interface NoteSpec {
  midi: number | number[];
  at: number; // seconds
  dur: number; // key held (s); damper afterwards
  vel?: number;
}

/** Mix rendered notes with a damper-like release and a little room noise. */
function perform(notes: NoteSpec[], total: number, instrument: 'piano' | 'guitar' = 'piano', noise = 0.0005): Float32Array {
  const out = new Float32Array(Math.round(total * SR));
  for (const n of notes) {
    for (const m of Array.isArray(n.midi) ? n.midi : [n.midi]) {
      const s = instrument === 'piano' ? renderPianoSamples(m, n.vel ?? 0.7, SR) : renderGuitarSamples(m, n.vel ?? 0.7, SR);
      const start = Math.round(n.at * SR);
      const rel = Math.round(n.dur * SR);
      for (let i = 0; i < s.length && start + i < out.length; i++) {
        const env = i < rel ? 1 : Math.exp(-(i - rel) / (0.04 * SR));
        if (env < 1e-4) break;
        out[start + i] += s[i] * env * 0.5;
      }
    }
  }
  const r = mulberry32(99);
  for (let i = 0; i < out.length; i++) out[i] += (r() + r() + r() + r() - 2) * noise * 1.73;
  return out;
}

function calibrate(sig: Float32Array, tracker: NoteTracker): void {
  // noise floor from the first 0.3 s (silence), like the mic's calibration
  const cal: number[] = [];
  for (let end = 1024; end < 0.3 * SR; end += HOP) cal.push(rms(sig, end - 1024, end));
  cal.sort((a, b) => a - b);
  tracker.setNoiseFloor(cal[Math.floor(cal.length / 2)] * 1.1);
}

/** Mono path, as in MicInput.tick (without app-sound handling). */
function analyse(sig: Float32Array, tracker = new NoteTracker({ pitchLatencyMs: 32 })): TrackerEvent[] {
  calibrate(sig, tracker);
  const an = new FrameAnalyzer();
  const events: TrackerEvent[] = [];
  for (let end = 4096; end <= sig.length; end += HOP) {
    const time = ((end - 512) / SR) * 1000;
    const f = an.analyze(sig.subarray(end - 4096, end), SR, time, tracker.noiseFloor * 1.5, tracker.activeNote !== null);
    events.push(...tracker.process(f, { confirmPitch: an.hasSupport, vetoPitch: an.isPhantom }));
  }
  events.push(...tracker.reset((sig.length / SR) * 1000));
  return events;
}

/** Chord path, as in MicInput.tick when ≥2 notes are expected. */
function analyseChords(sig: Float32Array, expected: number[]): TrackerEvent[] {
  const tracker = new NoteTracker({ pitchLatencyMs: 32 });
  calibrate(sig, tracker);
  const an = new FrameAnalyzer();
  const chord = new ChordTracker();
  chord.setExpected(expected, tracker.onsetSerial, 0);
  const events: TrackerEvent[] = [];
  for (let end = 4096; end <= sig.length; end += HOP) {
    const time = ((end - 512) / SR) * 1000;
    const f = an.analyze(sig.subarray(end - 4096, end), SR, time, tracker.noiseFloor * 1.5, true);
    tracker.process(f, { confirmPitch: an.hasSupport });
    events.push(
      ...chord.process({
        time,
        level: f.rms,
        gate: tracker.gateLevel,
        onsetSerial: tracker.onsetSerial,
        onsetTime: tracker.lastOnsetTime,
        pitchMidi: f.pitch && f.pitch.clarity >= tracker.minClarity ? Math.round(69 + 12 * Math.log2(f.pitch.freq / 440)) : null,
        allowExtra: an.hasSupport,
        verify: () => verifyChord(an.spectrum(), SR, an.fftSize, expected, { windowLength: 4096 }).present,
      }),
    );
  }
  events.push(...chord.reset((sig.length / SR) * 1000));
  return events;
}

const ons = (ev: TrackerEvent[]) => ev.filter((e) => e.type === 'on');

describe('mic pipeline on synthesised piano', () => {
  it('transcribes a melody with repeated notes (E E F G G F E D)', () => {
    const melody = [64, 64, 65, 67, 67, 65, 64, 62];
    const notes = melody.map((m, i) => ({ midi: m, at: 0.4 + i * 0.45, dur: 0.38 }));
    const ev = analyse(perform(notes, 0.4 + melody.length * 0.45 + 0.6));
    const on = ons(ev);
    expect(on.map((e) => e.midi)).toEqual(melody);
    // timing: each note-on within ~40 ms of the real attack
    on.forEach((e, i) => expect(Math.abs(e.time - (400 + i * 450)), `note ${i} at ${e.time}`).toBeLessThan(40));
    // every on has a matching off
    expect(ev.filter((e) => e.type === 'off').length).toBe(melody.length);
  });

  it('detects a re-strike of a still-ringing note (no damper in between)', () => {
    const notes = [
      { midi: 60, at: 0.4, dur: 1.2 },
      { midi: 60, at: 1.0, dur: 0.6, vel: 0.8 },
    ];
    const on = ons(analyse(perform(notes, 2.4)));
    expect(on.map((e) => e.midi)).toEqual([60, 60]);
    expect(Math.abs(on[1].time - 1000)).toBeLessThan(45);
  });

  it('covers the bass and treble clef ranges', () => {
    const melody = [43, 47, 50, 53, 57, 60, 64, 67, 71, 74, 77, 81, 84];
    const notes = melody.map((m, i) => ({ midi: m, at: 0.4 + i * 0.4, dur: 0.33 }));
    const on = ons(analyse(perform(notes, 0.4 + melody.length * 0.4 + 0.5)));
    expect(on.map((e) => e.midi)).toEqual(melody);
  });

  it('verifies piano chords from the spectrum ~150 ms after the attack', () => {
    const check = (played: number[], expected: number[]) => {
      const sig = perform([{ midi: played, at: 0.1, dur: 1 }], 0.5);
      const end = Math.round(0.25 * SR) + 4096;
      const spec = computeSpectrum(sig.subarray(end - 4096, end), { fftSize: 8192 });
      return verifyChord(spec, SR, 8192, expected, { windowLength: 4096 });
    };
    expect(check([60, 64, 67], [60, 64, 67]).present).toEqual([true, true, true]);
    expect(check([57, 60, 64], [57, 60, 64]).present).toEqual([true, true, true]);
    expect(check([55, 59, 62, 65], [55, 59, 62, 65]).present.every(Boolean)).toBe(true);
    const wrong = check([60, 65, 69], [60, 64, 67]);
    expect(wrong.present.every(Boolean)).toBe(false);
    expect(wrong.present[1]).toBe(false);
    // low voicing needs the long window (MicInput uses 8192 samples for chords below C3)
    const sig = perform([{ midi: [43, 50, 59], at: 0.05, dur: 1 }], 0.5);
    const end = Math.round(0.25 * SR) + 8192;
    const spec = computeSpectrum(sig.subarray(end - 8192, end), { fftSize: 16384 });
    expect(verifyChord(spec, SR, 16384, [43, 50, 59], { windowLength: 8192 }).present).toEqual([true, true, true]);
    expect(verifyChord(spec, SR, 16384, [44, 50, 59], { windowLength: 8192 }).present[0]).toBe(false);
  });
});

describe('mic pipeline: chord mode', () => {
  it('emits the expected chord together at the onset, and reports a wrong chord differently', () => {
    const CEG = [60, 64, 67];
    const sig = perform(
      [
        { midi: CEG, at: 0.4, dur: 0.8 },
        { midi: [60, 65, 69], at: 1.6, dur: 0.8 }, // wrong chord (F major 2nd inversion)
        { midi: CEG, at: 2.8, dur: 0.8 },
      ],
      4.2,
    );
    const ev = analyseChords(sig, CEG);
    const groups = new Map<number, number[]>();
    for (const e of ev.filter((x) => x.type === 'on')) {
      const k = Math.round(e.time / 100);
      groups.set(k, [...(groups.get(k) ?? []), e.midi]);
    }
    const attempts = [...groups.entries()].sort((a, b) => a[0] - b[0]);
    expect(attempts.length).toBe(3);
    expect(attempts[0][1].sort()).toEqual(CEG);
    expect(attempts[2][1].sort()).toEqual(CEG);
    const wrong = attempts[1][1];
    expect(wrong.length).toBeGreaterThan(0);
    expect(wrong.includes(64) && wrong.includes(67)).toBe(false);
    // onsets are timestamped at the attack
    expect(Math.abs(attempts[0][0] * 100 - 400)).toBeLessThanOrEqual(100);
    const firstOn = ev.find((e) => e.type === 'on')!;
    expect(Math.abs(firstOn.time - 400)).toBeLessThan(40);
    // every reported note is released again
    expect(ev.filter((e) => e.type === 'off').length).toBe(ev.filter((e) => e.type === 'on').length);
  });
});

describe('mic pipeline: randomised melodies', () => {
  it('transcribes random melodies (incl. repeats, leaps, two tempi, room noise) exactly', () => {
    const rnd = mulberry32(2024);
    let exact = 0;
    let total = 0;
    let worst = 0;
    for (const inst of ['piano', 'guitar'] as const) {
      for (const spacing of [0.42, 0.28]) {
        for (const noise of [0.0003, 0.002]) {
          const lo = inst === 'piano' ? 43 : 40;
          const hi = inst === 'piano' ? 86 : 79;
          const mel: number[] = [];
          for (let i = 0; i < 10; i++) {
            const prev = mel[i - 1];
            mel.push(prev !== undefined && rnd() < 0.3 ? prev : lo + Math.floor(rnd() * (hi - lo)));
          }
          const notes = mel.map((m, i) => ({ midi: m, at: 0.4 + i * spacing, dur: spacing * 0.8, vel: 0.4 + 0.5 * rnd() }));
          const on = ons(analyse(perform(notes, 0.4 + mel.length * spacing + 0.6, inst, noise)));
          total++;
          if (on.length === mel.length && on.every((e, i) => e.midi === mel[i])) {
            exact++;
            on.forEach((e, i) => (worst = Math.max(worst, Math.abs(e.time - (400 + i * spacing * 1000)))));
          }
        }
      }
    }
    expect(exact).toBe(total);
    expect(worst).toBeLessThan(45);
  }, 30000);
});

describe('mic pipeline on synthesised guitar', () => {
  it('transcribes an open-position melody including repeated notes', () => {
    const melody = [40, 45, 50, 55, 59, 64, 64, 67, 69, 69, 72];
    const notes = melody.map((m, i) => ({ midi: m, at: 0.4 + i * 0.42, dur: 0.36 }));
    const on = ons(analyse(perform(notes, 0.4 + melody.length * 0.42 + 0.6, 'guitar')));
    expect(on.map((e) => e.midi)).toEqual(melody);
  });
});

// ---------------------------------------------------------------------------
// Wait mode: one expected note at a time (MicInput.tick's single-note path:
// NoteTracker + ExpectedNoteAssist via AssistRouter)
// ---------------------------------------------------------------------------

interface Pluck {
  midi: number;
  at: number;
  gain: number;
  /** The string is stopped/re-plucked here (another note on the same string). */
  cutAt?: number;
}

/** Guitar notes that keep ringing until the same string is played again. */
function strings(plucks: Pluck[], total: number): Float32Array {
  const out = new Float32Array(Math.round(total * SR));
  plucks.forEach((n, i) => {
    const s = renderGuitarSamples(n.midi, 0.6, SR, { seed: 31 + i * 13 });
    const start = Math.round(n.at * SR);
    const cut = n.cutAt !== undefined ? Math.round(n.cutAt * SR) : out.length;
    const fade = Math.round(0.004 * SR);
    for (let k = 0; k < s.length && start + k < out.length; k++) {
      const pos = start + k;
      const env = pos >= cut ? Math.max(0, 1 - (pos - cut) / fade) : 1;
      if (env <= 0) break;
      out[pos] += s[k] * n.gain * env * 0.5;
    }
  });
  const r = mulberry32(5);
  for (let i = 0; i < out.length; i++) out[i] += (r() + r() + r() + r() - 2) * 0.0005 * 1.73;
  return out;
}

/** A melody on the guitar: each note on its first-position string, ringing until that string is reused. */
function guitarMelody(mel: number[], spacing: number, gains: number[]): Float32Array {
  const str = mel.map((m) => positionsFor(m, 7).sort((a, b) => a.fret - b.fret)[0]?.string ?? 1);
  return strings(
    mel.map((m, i) => {
      let j = i + 1;
      while (j < mel.length && str[j] !== str[i]) j++;
      return { midi: m, at: 0.4 + i * spacing, gain: gains[i], cutAt: j < mel.length ? 0.4 + j * spacing : undefined };
    }),
    0.4 + mel.length * spacing + 1.5,
  );
}

/** Play along in wait mode: the awaited note advances each time it is reported. */
function waitMode(sig: Float32Array, song: number[]): { completed: number; wrong: number; ons: TrackerEvent[] } {
  const tracker = new NoteTracker({ pitchLatencyMs: 32 });
  calibrate(sig, tracker);
  const an = new FrameAnalyzer();
  const router = new AssistRouter();
  let idx = 0;
  let wrong = 0;
  const ons: TrackerEvent[] = [];
  router.setExpected(song[0], tracker.onsetSerial, 0);
  for (let end = 8192; end <= sig.length; end += HOP) {
    const time = ((end - 512) / SR) * 1000;
    const buf = sig.subarray(end - 8192, end);
    const f = an.analyze(buf, SR, time, tracker.noiseFloor * 1.5, tracker.activeNote !== null);
    const evs = tracker.process(f, { confirmPitch: an.hasSupport, vetoPitch: an.isPhantom });
    const out = router.route(
      evs,
      buildAssistFrame({
        expected: idx < song.length ? song[idx] : null,
        time,
        level: f.rms,
        gate: tracker.gateLevel,
        onsetSerial: tracker.onsetSerial,
        onsetTime: tracker.lastOnsetTime,
        sampleRate: SR,
        analyzer: an,
        longBuf: buf,
      }),
    );
    for (const e of out) {
      if (e.type !== 'on') continue;
      ons.push(e);
      if (idx < song.length && e.midi === song[idx]) {
        idx++;
        router.setExpected(idx < song.length ? song[idx] : null, tracker.onsetSerial, time);
      } else if (idx < song.length) wrong++;
    }
  }
  return { completed: idx, wrong, ons };
}

describe('mic pipeline: wait mode with ringing strings', () => {
  it('hears a soft open E while the fretted D on the next string still rings (Mary, Ode to Joy)', () => {
    for (const eGain of [1, 0.7, 0.5, 0.35]) {
      for (const gap of [0.6, 0.35]) {
        // C4 → D4 on the 2nd string (D keeps ringing), then the open 1st-string E
        const sig = strings(
          [
            { midi: 60, at: 0.4, gain: 1, cutAt: 1.0 },
            { midi: 62, at: 1.0, gain: 1 },
            { midi: 64, at: 1.0 + gap, gain: eGain },
          ],
          1.0 + gap + 1.5,
        );
        const r = waitMode(sig, [60, 62, 64]);
        expect(r.completed, `E gain ${eGain}, ${gap}s after D: ${r.ons.map((e) => e.midi).join(',')}`).toBe(3);
        expect(r.wrong, `no phantom D♯ (E gain ${eGain}, gap ${gap})`).toBe(0);
        const e = r.ons.find((x) => x.midi === 64)!;
        expect(Math.abs(e.time - (1000 + gap * 1000))).toBeLessThan(60);
      }
    }
  }, 60000);

  it('plays first-position songs start to finish (Mary Had a Little Lamb, Ode to Joy)', () => {
    const mary = [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67];
    const ode = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
    for (const song of [mary, ode]) {
      for (const spacing of [0.75, 0.5]) {
        const rnd = mulberry32(song.length + Math.round(spacing * 100));
        const r = waitMode(guitarMelody(song, spacing, song.map(() => 0.5 + 0.5 * rnd())), song);
        expect(r.completed, `${song.join(' ')} @${spacing}: ${r.ons.map((e) => e.midi).join(' ')}`).toBe(song.length);
        expect(r.wrong).toBe(0);
      }
    }
  }, 60000);

  it('random melodies on ringing strings complete with no stray notes', () => {
    const rnd = mulberry32(77);
    let done = 0;
    let total = 0;
    let wrong = 0;
    for (let trial = 0; trial < 10; trial++) {
      const mel: number[] = [];
      for (let i = 0; i < 12; i++) {
        const prev = mel[i - 1];
        mel.push(prev !== undefined && rnd() < 0.25 ? prev : 52 + Math.floor(rnd() * 20));
      }
      const spacing = 0.45 + rnd() * 0.4;
      const r = waitMode(guitarMelody(mel, spacing, mel.map(() => 0.55 + 0.45 * rnd())), mel);
      done += r.completed;
      total += mel.length;
      wrong += r.wrong;
    }
    expect(done).toBe(total);
    expect(wrong).toBeLessThanOrEqual(1);
  }, 120000);

  it('low strings: E2 F2 G2 under a ringing open A string', () => {
    const song = [45, 40, 41, 43, 40];
    const sig = strings(
      [
        { midi: 45, at: 0.4, gain: 1 },
        { midi: 40, at: 1.1, gain: 0.8, cutAt: 1.8 },
        { midi: 41, at: 1.8, gain: 0.8, cutAt: 2.5 },
        { midi: 43, at: 2.5, gain: 0.8, cutAt: 3.2 },
        { midi: 40, at: 3.2, gain: 0.8 },
      ],
      4.6,
    );
    const r = waitMode(sig, song);
    expect(r.completed, r.ons.map((e) => e.midi).join(' ')).toBe(song.length);
    expect(r.wrong).toBe(0);
  }, 60000);

  it('piano: legato and with the sustain pedal down', () => {
    const rnd = mulberry32(31);
    for (const pedal of [false, true]) {
      let done = 0;
      let total = 0;
      let wrong = 0;
      for (let trial = 0; trial < 6; trial++) {
        const mel: number[] = [];
        for (let i = 0; i < 12; i++) mel.push(55 + Math.floor(rnd() * 24));
        const spacing = 0.4 + rnd() * 0.3;
        const ev = mel.map((m, i) => ({ midi: m, at: 0.4 + i * spacing, dur: pedal ? 3 : spacing + 0.08, vel: 0.5 + 0.4 * rnd() }));
        const r = waitMode(perform(ev, 0.4 + mel.length * spacing + 1.2), mel);
        done += r.completed;
        total += mel.length;
        wrong += r.wrong;
      }
      expect(done, pedal ? 'pedal' : 'legato').toBe(total);
      expect(wrong).toBeLessThanOrEqual(pedal ? 4 : 0);
    }
  }, 120000);
});

describe('mic pipeline: wait mode never accepts a wrong note', () => {
  const single = (wrongMidi: number, expected: number, ringing?: number) => {
    const plucks: Pluck[] = [];
    if (ringing !== undefined) plucks.push({ midi: ringing, at: 0.4, gain: 1 });
    plucks.push({ midi: wrongMidi, at: ringing !== undefined ? 1.2 : 0.4, gain: 0.9 });
    const song = ringing !== undefined ? [ringing, expected] : [expected];
    const r = waitMode(strings(plucks, 2.8), song);
    return r.completed < song.length;
  };

  it('rejects notes whose harmonics contain the expected one, and neighbours', () => {
    expect(single(45, 64), 'A2 for E4 (E4 = A2’s 3rd harmonic)').toBe(true);
    expect(single(52, 64), 'E3 for E4 (octave below)').toBe(true);
    expect(single(76, 64), 'E5 for E4 (octave above)').toBe(true);
    expect(single(65, 64), 'F4 for E4').toBe(true);
    expect(single(63, 64), 'D♯4 for E4').toBe(true);
    expect(single(62, 64, 64), 'D4 plucked while E4 still rings, E4 expected again').toBe(true);
    expect(single(74, 62, 57), 'D5 for D4 over a ringing A3').toBe(true);
  }, 60000);

  it('a ringing note is not reported again without a new attack', () => {
    const r = waitMode(strings([{ midi: 64, at: 0.4, gain: 1 }], 3.5), [64, 64]);
    expect(r.completed).toBe(1);
  });

  it('random wrong notes (±1, ±2 semitones, octaves, fifths) over ringing strings', () => {
    const rnd = mulberry32(4242);
    let falseAccepts = 0;
    for (let trial = 0; trial < 30; trial++) {
      const mel: number[] = [];
      for (let i = 0; i < 8; i++) mel.push(52 + Math.floor(rnd() * 20));
      const k = 2 + Math.floor(rnd() * 5);
      const deltas = [-2, -1, 1, 2, 12, -12, 7, -7];
      const played = mel.slice(0, k + 1);
      played[k] = mel[k] + deltas[Math.floor(rnd() * deltas.length)];
      if (played[k] === mel[k - 1]) continue;
      const spacing = 0.5 + rnd() * 0.3;
      const r = waitMode(guitarMelody(played, spacing, played.map(() => 0.55 + 0.45 * rnd())), mel);
      if (r.completed > k) falseAccepts++;
    }
    expect(falseAccepts).toBe(0);
  }, 120000);
});
