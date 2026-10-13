/**
 * End-to-end (offline) tests of the microphone analysis chain on realistic
 * instrument sounds: the synthesised piano/guitar are rendered into a
 * "recording", which is then analysed frame by frame exactly like MicInput
 * does (FrameAnalyzer → NoteTracker with spectral confirmation; ChordTracker +
 * verifyChord in chord mode).
 */
import { describe, expect, it } from 'vitest';
import { ChordTracker } from './chord';
import { computeSpectrum, FrameAnalyzer, NoteTracker, rms, verifyChord } from './pitch';
import type { TrackerEvent } from './pitch';
import { renderPianoSamples } from '../synth/piano';
import { renderGuitarSamples } from '../synth/guitar';
import { mulberry32 } from '../dsp/util';

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
    events.push(...tracker.process(f, { confirmPitch: an.hasSupport }));
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
