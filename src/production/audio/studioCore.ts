/**
 * The heavy lifting behind Production School, kept off the main thread: rendering stems
 * and judging mixes. It runs in a worker (stems.worker.ts) where there is one, and on the
 * main thread otherwise; pure TS either way.
 *
 * - Tracks are cached one by one, so lessons that share a session's clean tracks (most of
 *   them) render only what's new: a take with a fault, a session not heard yet. The cache
 *   is kept small (a track of a 10 s loop at 48 kHz is about 2 MB).
 * - The judge works at half the playback rate (24 kHz for a 48 kHz context): it measures
 *   loudness, third-octave bands up to 12 kHz and dynamics, none of which needs more, and
 *   a check takes half as long.
 */
import { applyBiquad, biquadCoeffs } from '../../audio/dsp/util';
import { Judge, type JudgeResult, type JudgeSpec } from '../dsp/judge';
import type { Mix } from '../dsp/params';
import { getSession } from '../dsp/sessions';
import { type StemRequest, type Track, renderTrack, resolveTracks } from '../dsp/stems';

const MAX_TRACKS = 20;
const MAX_JUDGES = 3;

export interface JudgeRequest {
  key: string;
  req: StemRequest;
  start: Mix;
  target?: Mix;
  spec?: JudgeSpec;
}

/** Halve the rate: low-pass well below the new Nyquist, then keep every other sample. */
function decimate(x: Float32Array, sr: number): Float32Array {
  const y = x.slice();
  const c = biquadCoeffs('lowpass', sr * 0.21, Math.SQRT1_2, 0, sr);
  applyBiquad(y, c);
  applyBiquad(y, c);
  const out = new Float32Array(Math.floor(y.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = y[i * 2];
  return out;
}

export const judgeRate = (sr: number) => (sr >= 44100 ? sr / 2 : sr);

export class StudioCore {
  private readonly tracks = new Map<string, Float32Array>();
  private readonly judges = new Map<string, Judge>();

  private track(session: string, t: Track, sr: number): Float32Array {
    const key = JSON.stringify([session, t.of, t.fault ?? null, sr]);
    let x = this.tracks.get(key);
    if (x) {
      // most recently used last
      this.tracks.delete(key);
      this.tracks.set(key, x);
      return x;
    }
    x = renderTrack(getSession(session), t, sr);
    this.tracks.set(key, x);
    while (this.tracks.size > MAX_TRACKS) this.tracks.delete(this.tracks.keys().next().value!);
    return x;
  }

  /** Every track a lesson needs, at the playback rate. */
  stems(req: StemRequest): Record<string, Float32Array> {
    const session = getSession(req.session);
    const out: Record<string, Float32Array> = {};
    for (const t of resolveTracks(session, req.channels)) out[t.id] = this.track(req.session, t, req.sampleRate);
    return out;
  }

  /** Set up a quiz's judge (renders and measures the target once). */
  prepare(j: JudgeRequest): void {
    if (this.judges.has(j.key)) return;
    const session = getSession(j.req.session);
    const live = this.stems(j.req);
    const sr = judgeRate(j.req.sampleRate);
    const stems: Record<string, Float32Array> = {};
    for (const [id, x] of Object.entries(live)) stems[id] = sr === j.req.sampleRate ? x : decimate(x, j.req.sampleRate);
    const channels = resolveTracks(session, j.req.channels).map(t => t.id);
    const names = Object.fromEntries(resolveTracks(session, j.req.channels).map(t => [t.id, t.name]));
    this.judges.set(j.key, new Judge({ stems, channels, sampleRate: sr, tempo: session.tempo, start: j.start, target: j.target, spec: { names, ...j.spec } }));
    while (this.judges.size > MAX_JUDGES) this.judges.delete(this.judges.keys().next().value!);
  }

  score(key: string, mix: Mix): JudgeResult {
    const j = this.judges.get(key);
    if (!j) throw new Error(`No judge "${key}"`);
    return j.score(mix);
  }
}
