/**
 * Stems: each part of a session rendered as its own mono track, the way a recording comes
 * to a mixing engineer. Pure TS (no DOM, no Web Audio) so it runs in a worker, in Vitest
 * and in the course test.
 *
 * Notes are rendered by the app's own instruments (drums.ts, guitar.ts, piano.ts,
 * bowed.ts, Synth School's SynthCore), each distinct note once per stem. The loop is
 * seamless: whatever rings past the end is folded back onto the start, as it would sound
 * the second time round. Every track is then "recorded" at its own peak level (−8 dBFS
 * unless the session says otherwise), so nothing is mixed yet when it arrives.
 *
 * Faults are recording problems a lesson can bake into a track for the learner to hear
 * and fix: a take recorded too hot, a mic too close, a rumbling room, an uneven player.
 */
import { type BowedVoice, bowedLoop, bowedRelease, renderBowedSamples } from '../../audio/synth/bowed';
import { renderDrumSamples } from '../../audio/synth/drums';
import { renderEPianoSamples } from '../../audio/synth/epiano';
import { renderGuitarSamples } from '../../audio/synth/guitar';
import { renderPianoSamples } from '../../audio/synth/piano';
import { applyBiquad, biquadCoeffs, mulberry32 } from '../../audio/dsp/util';
import { parseVoice } from '../../music/parse';
import { midiOf } from '../../music/pitch';
import { durationTicks, PPQ } from '../../music/rhythm';
import { makePatch } from '../../synthlab/dsp/params';
import { mono, renderPhrase } from '../../synthlab/dsp/render';
import { PRESETS } from '../../synthlab/presets';
import { type ChannelDef, type SessionDef, getSession, loopSeconds } from './sessions';

/** Recording problems, baked into a track. Levels in dB. */
export interface Fault {
  /** The whole take louder (+) or quieter (−) than it should be. */
  gain?: number;
  /** The peaks went this many dB past full scale and were flattened there (the take is then turned back down to its loudness: no louder than a clean one, only damaged). */
  clip?: number;
  /** A noise floor (an old preamp, a noisy amp), dBFS RMS. */
  hiss?: number;
  /** Low rumble (traffic, air conditioning, a knocked mic stand), dBFS RMS. */
  rumble?: number;
  /** A boost around 150 Hz: a mic too close (the proximity effect). */
  boom?: number;
  /** A boost around 380 Hz: a boxy little room. */
  mud?: number;
  /** A boost around 3.5 kHz: a harsh mic or a bright amp. */
  harsh?: number;
  /** Highs cut above 5 kHz: a dull mic, old strings, a blanket over the amp. */
  dull?: number;
  /** Notes vary in level by up to this many dB: an uneven performance. */
  uneven?: number;
  /** 0..1: recorded far from the mic in a reflective room. */
  room?: number;
}

/** A channel as a lesson uses it: one of the session's, maybe under another name or with a fault. */
export interface ChannelUse {
  id: string;
  /** The session channel it's a take of (default: `id`). */
  from?: string;
  name?: string;
  short?: string;
  fault?: Fault;
}

export interface Track extends ChannelDef {
  /** The session channel it's a take of. */
  of: string;
  fault?: Fault;
}

/** The tracks a lesson works with: the session's (all, or those listed), with names and faults applied. */
export function resolveTracks(session: SessionDef, uses?: readonly (string | ChannelUse)[]): Track[] {
  const list = uses ?? session.channels.map(c => c.id);
  return list.map(u => {
    const use: ChannelUse = typeof u === 'string' ? { id: u } : u;
    const def = session.channels.find(c => c.id === (use.from ?? use.id));
    if (!def) throw new Error(`Session "${session.id}" has no channel "${use.from ?? use.id}"`);
    return { ...def, id: use.id, of: def.id, name: use.name ?? def.name, short: use.short ?? (use.name ? undefined : def.short), fault: use.fault };
  });
}

interface NoteEvent {
  /** Seconds from the loop's start. */
  t: number;
  dur: number;
  midi: number;
  vel: number;
  /** Damp the note here (seconds from its start); undefined: let it ring. */
  stop?: number;
}

const GRID_VEL: Record<string, number> = { x: 1, o: 0.6, g: 0.3 };

/** The notes of a part, in seconds. */
export function partEvents(session: SessionDef, ch: ChannelDef & { of?: string }): NoteEvent[] {
  const beat = 60 / session.tempo;
  const loop = loopSeconds(session);
  const base = ch.vel ?? 0.8;
  const late = (ch.late ?? 0) / 1000;
  // seeded by the part, so every take of it (a clean one, a clipped one) is the same performance
  const rand = mulberry32((ch.seed ?? 1) * 7919 + (ch.of ?? ch.id).length * 131);
  // a player leans on the first beat of the bar, and no two notes are quite the same
  const human = (beatPos: number) => Math.max(0.05, Math.min(1, base * (beatPos % session.beats < 0.01 ? 1.06 : 1) * (0.96 + 0.08 * rand())));
  const out: NoteEvent[] = [];
  if (ch.source.kind === 'drum') {
    const cells = ch.part.replace(/[|\s]/g, '');
    const steps = session.bars * session.beats * 4;
    for (let i = 0; i < steps; i++) {
      const c = cells[i % cells.length];
      const v = GRID_VEL[c];
      if (v) out.push({ t: (i * beat) / 4 + late, dur: beat / 4, midi: ch.source.note, vel: human(i / 4) * v });
    }
    return out;
  }
  const { specs } = parseVoice(ch.part, [session.beats, 4], 0, ch.id);
  let tick = 0;
  const strum = (ch.strum ?? 0) / 1000;
  for (const s of specs) {
    const len = durationTicks(s.base, s.dots, s.triplet);
    const t = (tick / PPQ) * beat + late;
    const dur = (len / PPQ) * beat;
    s.pitches.forEach((p, i) => {
      const at = t + i * strum;
      out.push({ t: at, dur: dur - i * strum, midi: midiOf(p), vel: human(tick / PPQ) });
    });
    tick += len;
  }
  // a loop can't be longer than the session's
  return out.filter(e => e.t < loop);
}

/** The longest any note of a source rings after it's damped (s): the tail folded back onto the loop's start. */
const TAIL = 4;

/** Render one track of a session as a mono loop at `sr`. */
export function renderTrack(session: SessionDef, track: Track, sr: number): Float32Array {
  const n = Math.round(loopSeconds(session) * sr);
  const buf = new Float32Array(n + Math.round(TAIL * sr));
  const events = partEvents(session, track);
  const f = track.fault ?? {};
  const rand = mulberry32((track.seed ?? 1) * 104729 + 3);
  const unevenGain = () => (f.uneven ? Math.pow(10, ((rand() - 0.5) * f.uneven) / 20) : 1);
  const src = track.source;
  const cache = new Map<string, Float32Array>();
  const note = (midi: number, vel: number, render: () => Float32Array) => {
    const key = `${midi}:${Math.round(vel * 10)}`;
    let x = cache.get(key);
    if (!x) cache.set(key, (x = render()));
    return x;
  };
  /** Add a note's samples at t, damped `stop` seconds in with a short fade. */
  const place = (x: Float32Array, t: number, gain: number, stop?: number, fade = 0.12) => {
    const at = Math.max(0, Math.round(t * sr));
    const stopAt = stop === undefined ? x.length : Math.min(x.length, Math.round(stop * sr));
    const fadeN = Math.max(1, Math.round(fade * sr));
    const end = Math.min(x.length, stopAt + fadeN, buf.length - at);
    for (let i = 0; i < end; i++) {
      const g = i < stopAt ? gain : gain * (1 - (i - stopAt) / fadeN);
      buf[at + i] += x[i] * g;
    }
  };

  switch (src.kind) {
    case 'drum':
      for (const e of events) place(note(e.midi, e.vel, () => renderDrumSamples(e.midi, e.vel, sr, { kit: src.kit, seed: (track.seed ?? 1) * 31 + e.midi })), e.t, unevenGain());
      break;
    case 'pluck':
      for (const e of events) {
        // let a note ring a little past its written end, as fingers lift
        const x = note(e.midi, e.vel, () => renderGuitarSamples(e.midi, e.vel, sr, { variant: src.variant, seed: (track.seed ?? 1) * 977 + e.midi }));
        place(x, e.t, e.vel * unevenGain(), e.dur + 0.06, 0.08);
      }
      break;
    case 'piano':
    case 'epiano':
      for (const e of events) {
        const x = note(e.midi, e.vel, () => (src.kind === 'piano' ? renderPianoSamples(e.midi, e.vel, sr) : renderEPianoSamples(e.midi, e.vel, sr)));
        // the damper takes a moment to stop the string
        place(x, e.t, e.vel * unevenGain(), e.dur, 0.25);
      }
      break;
    case 'bowed':
      for (const e of events) placeBowed(buf, src.voice, e, sr, unevenGain(), note);
      break;
    case 'synth': {
      const preset = src.preset ? PRESETS.find(p => p.id === src.preset) : undefined;
      // dry stems: a mix adds its own space
      const patch = makePatch({ ...(preset?.patch ?? {}), reverbMix: 0, delayMix: 0, ...(src.patch ?? {}) });
      const r = renderPhrase(patch, { notes: events.map(e => ({ midi: e.midi, start: e.t, dur: e.dur * 0.95, vel: e.vel * unevenGain() })), length: buf.length / sr }, sr, buf.length / sr);
      buf.set(mono(r).subarray(0, buf.length));
      break;
    }
  }

  // fold the tail onto the start: the second time round, the last notes are still ringing
  const out = buf.slice(0, n);
  for (let i = n; i < buf.length; i++) out[i % n] += buf[i];

  if (src.kind === 'pluck' && src.drive) drive(out, src.drive, sr);
  record(out, track.level ?? -8, f, sr, (track.seed ?? 1) * 6151 + 11);
  return out;
}

/** A bowed note: its attack, then its loop repeated for as long as the bow moves, then the string rings down. */
function placeBowed(buf: Float32Array, voice: BowedVoice, e: NoteEvent, sr: number, gain: number, note: (midi: number, vel: number, r: () => Float32Array) => Float32Array) {
  const x = note(e.midi, e.vel, () => renderBowedSamples(voice, e.midi, e.vel, sr));
  const { start: ls, end: le } = bowedLoop(voice, sr);
  const loopLen = le - ls;
  const at = Math.round(e.t * sr);
  const held = Math.round(e.dur * sr);
  const tau = bowedRelease(voice) * sr;
  const total = held + Math.round(tau * 5);
  for (let i = 0; i < total && at + i < buf.length; i++) {
    const j = i < le ? i : ls + ((i - ls) % loopLen);
    const g = i < held ? gain : gain * Math.exp(-(i - held) / tau);
    buf[at + i] += x[j] * g * e.vel;
  }
}

/** An overdriven amp: soft clipping, then a speaker's top end rolling off. */
function drive(x: Float32Array, db: number, sr: number): void {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (!peak) return;
  const g = Math.pow(10, db / 20) / peak;
  const norm = 1 / Math.tanh(g * peak);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * g) * norm;
  applyBiquad(x, biquadCoeffs('lowpass', 5200, 0.8, 0, sr));
  applyBiquad(x, biquadCoeffs('peaking', 1800, 1, 2.5, sr));
}

/** The take as it lands on the recorder: the room and the mic, the noise, the level. */
function record(x: Float32Array, levelDb: number, f: Fault, sr: number, seed: number): void {
  const n = x.length;
  if (f.room) {
    // early reflections off nearby walls, then a short diffuse wash
    const dry = x.slice();
    const taps: [number, number][] = [[0.011, 0.5], [0.017, 0.42], [0.023, 0.36], [0.031, 0.3], [0.043, 0.24], [0.057, 0.18]];
    for (const [s, g] of taps) {
      const d = Math.round(s * sr);
      for (let i = 0; i < n; i++) x[(i + d) % n] += dry[i] * g * f.room;
    }
    applyBiquad(x, biquadCoeffs('lowpass', 7000 - 3000 * f.room, 0.7, 0, sr));
  }
  if (f.boom) applyBiquad(x, biquadCoeffs('peaking', 150, 1, f.boom, sr));
  if (f.mud) applyBiquad(x, biquadCoeffs('peaking', 380, 1.2, f.mud, sr));
  if (f.harsh) applyBiquad(x, biquadCoeffs('peaking', 3500, 1.5, f.harsh, sr));
  if (f.dull) applyBiquad(x, biquadCoeffs('highshelf', 5000, 0.7, -Math.abs(f.dull), sr));
  // the take's peak at its recorded level
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  const g = peak ? Math.pow(10, (levelDb + (f.gain ?? 0)) / 20) / peak : 1;
  for (let i = 0; i < n; i++) x[i] *= g;
  const rand = mulberry32(seed);
  if (f.rumble !== undefined) addNoise(x, f.rumble, sr, rand, 'rumble');
  if (f.hiss !== undefined) addNoise(x, f.hiss, sr, rand, 'hiss');
  if (f.clip) {
    // the peaks went `clip` dB past full scale and were flattened there; the take is then
    // brought back to its loudness, so it's no louder than a clean one, only damaged
    let sum = 0;
    for (let i = 0; i < n; i++) sum += x[i] * x[i];
    const up = Math.pow(10, f.clip / 20) / Math.max(1e-9, Math.pow(10, (levelDb + (f.gain ?? 0)) / 20));
    let sum2 = 0;
    for (let i = 0; i < n; i++) {
      const y = x[i] * up;
      x[i] = y > 1 ? 1 : y < -1 ? -1 : y;
      sum2 += x[i] * x[i];
    }
    const back = sum2 > 0 ? Math.sqrt(sum / sum2) : 1;
    for (let i = 0; i < n; i++) x[i] *= back;
  }
}

function addNoise(x: Float32Array, db: number, sr: number, rand: () => number, kind: 'rumble' | 'hiss'): void {
  const noise = new Float32Array(x.length);
  for (let i = 0; i < noise.length; i++) noise[i] = rand() * 2 - 1;
  if (kind === 'rumble') {
    applyBiquad(noise, biquadCoeffs('lowpass', 70, 0.9, 0, sr));
    applyBiquad(noise, biquadCoeffs('lowpass', 70, 0.9, 0, sr));
    applyBiquad(noise, biquadCoeffs('highpass', 18, 0.7, 0, sr));
  } else applyBiquad(noise, biquadCoeffs('highshelf', 3000, 0.7, 6, sr));
  let sum = 0;
  for (let i = 0; i < noise.length; i++) sum += noise[i] * noise[i];
  const rms = Math.sqrt(sum / noise.length) || 1;
  const g = Math.pow(10, db / 20) / rms;
  for (let i = 0; i < x.length; i++) x[i] += noise[i] * g;
}

export interface StemRequest {
  session: string;
  channels?: readonly (string | ChannelUse)[];
  sampleRate: number;
}

/** Every track a lesson needs, by channel id. */
export function renderStems(req: StemRequest): Record<string, Float32Array> {
  const session = getSession(req.session);
  const out: Record<string, Float32Array> = {};
  for (const t of resolveTracks(session, req.channels)) out[t.id] = renderTrack(session, t, req.sampleRate);
  return out;
}

/** A key that names a stem set (for caching). */
export function stemKey(req: StemRequest): string {
  return JSON.stringify([req.session, req.channels ?? null, req.sampleRate]);
}
