/**
 * Playing sampled instruments.
 *
 * Samples are decoded only when a song (or the player's instrument) needs them, and
 * kept in a shared LRU cache within a memory budget the player sets — a few hundred
 * megabytes on a phone, as much as they like on a workstation. SF2 PCM becomes an
 * AudioBuffer directly; SF3's Ogg Vorbis and SFZ's FLAC / Ogg / MP3 go through the
 * browser's decoder, with a WebAssembly Vorbis decoder for browsers whose decoder
 * can't (Safari before 18.4); WAV is read directly, keeping its loop points.
 *
 * A note picks the regions that match its key and velocity (and round-robin / random
 * layer), and each plays as
 *
 *   AudioBufferSourceNode (pitch, loop) → [low-pass] → gain (DAHDSR envelope) → pan → out
 */
import { getAudioContext } from '../context';
import { clamp } from '../dsp/util';
import { pcm16ToFloat } from './sf2';
import { type BankFiles } from './files';
import { DEFAULT_ENVELOPE, type ByteReader, type ParsedBank, type SampleInfo, type SamplePreset, type SampleRegion } from './types';
import { decodeWav, readWavInfo } from './wav';

/** An opened bank: its presets, and where to read its samples from. */
export interface OpenBank {
  id: string;
  parsed: ParsedBank;
  /** SF2 / SF3: the file. */
  reader?: ByteReader;
  /** SFZ: the files. */
  files?: BankFiles;
}

interface Decoded {
  buffer: AudioBuffer;
  /** Frames of the original sample per second (loop points and offsets count in these). */
  rate: number;
  /** A loop found in the file itself (WAV smpl), in original frames. */
  fileLoop?: { start: number; end: number };
  bytes: number;
}

// ---------------------------------------------------------------------------
// Decoded sample cache
// ---------------------------------------------------------------------------

let budget = 1024 * 1024 * 1024;
const cache = new Map<string, Decoded>();
const pending = new Map<string, Promise<Decoded | null>>();
/** Keys prepare() calls in progress need (counted: they overlap), never evicted to make room for each other. */
const pinned = new Map<string, number>();
const pin = (k: string) => pinned.set(k, (pinned.get(k) ?? 0) + 1);
const unpin = (k: string) => {
  const n = (pinned.get(k) ?? 1) - 1;
  if (n > 0) pinned.set(k, n);
  else pinned.delete(k);
};
/** Bumped when a bank is removed, so decodes still under way for it aren't kept. */
const epochs = new Map<string, number>();
let cachedBytes = 0;
const listeners = new Set<() => void>();

/** Memory decoded samples may use (bytes); Infinity for no limit. */
export function setSampleBudget(bytes: number): void {
  budget = bytes;
  evict();
}

export function sampleBudget(): number {
  return budget;
}

/** Bytes of decoded samples in memory. */
export function sampleMemory(): number {
  return cachedBytes;
}

/** Called when the memory used changes (for the sounds page). */
export function onSampleMemory(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const emit = () => listeners.forEach(cb => cb());

function evict(): void {
  for (const [key, d] of cache) {
    if (cachedBytes <= budget) break;
    if (pinned.has(key)) continue;
    cache.delete(key);
    cachedBytes -= d.bytes;
  }
  emit();
}

function touch(key: string): Decoded | undefined {
  const d = cache.get(key);
  if (d) {
    cache.delete(key);
    cache.set(key, d);
  }
  return d;
}

/** Forget a bank's samples (it was removed). */
export function dropBankSamples(bankId: string): void {
  epochs.set(bankId, (epochs.get(bankId) ?? 0) + 1);
  for (const [key, d] of cache) {
    if (key.startsWith(`${bankId}:`)) {
      cache.delete(key);
      cachedBytes -= d.bytes;
    }
  }
  emit();
}

let vorbis: Promise<{ decodeFile(b: Uint8Array): Promise<{ channelData: Float32Array[]; samplesDecoded: number; sampleRate: number }> }> | null = null;

/** The WebAssembly Ogg Vorbis decoder, loaded the first time the browser's own one fails. */
function wasmVorbis() {
  vorbis ??= import('@wasm-audio-decoders/ogg-vorbis').then(async m => {
    const d = new m.OggVorbisDecoder();
    await d.ready;
    // one stream at a time: the decoder keeps a stream's setup between calls, so
    // samples decoded side by side would share (and corrupt) each other's
    let queue: Promise<unknown> = Promise.resolve();
    return {
      decodeFile: (b: Uint8Array) => {
        const next = queue.then(() => d.decodeFile(b));
        queue = next.catch(() => undefined);
        return next;
      },
    };
  });
  return vorbis;
}

const isOgg = (b: Uint8Array) => b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53; // "OggS"

/**
 * The sample rate an encoded file was recorded at (FLAC's STREAMINFO, Ogg Vorbis's
 * identification header). decodeAudioData resamples to the context's rate, but SFZ
 * offsets and loop points count frames of the file itself.
 */
export function nativeSampleRate(b: Uint8Array): number | null {
  if (b.length >= 21 && b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) {
    // "fLaC", a metadata block header, then STREAMINFO: rate is 20 bits after 10 bytes
    if ((b[4] & 0x7f) !== 0) return null;
    const rate = (b[18] << 12) | (b[19] << 4) | (b[20] >> 4);
    return rate > 0 ? rate : null;
  }
  if (b.length > 27 && isOgg(b)) {
    const p = 27 + b[26];
    // packet type 1 "vorbis", version (4), channels (1), rate (4, little-endian)
    if (b[p] === 1 && String.fromCharCode(...b.subarray(p + 1, p + 7)) === 'vorbis') {
      const rate = (b[p + 12] | (b[p + 13] << 8) | (b[p + 14] << 16) | (b[p + 15] << 24)) >>> 0;
      return rate > 0 ? rate : null;
    }
  }
  return null;
}

function bufferFrom(channels: Float32Array[], frames: number, rate: number): AudioBuffer {
  const ctx = getAudioContext();
  let r = rate;
  let chans = channels;
  let n = frames;
  try {
    const b = ctx.createBuffer(chans.length, n, r);
    chans.forEach((c, i) => b.copyToChannel(c.subarray(0, n) as Float32Array<ArrayBuffer>, i));
    return b;
  } catch {
    // a rate the browser won't take: resample (linear) to the context's
    const ratio = ctx.sampleRate / r;
    n = Math.max(1, Math.round(frames * ratio));
    chans = chans.map(c => {
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i / ratio;
        const k = Math.floor(x);
        const f = x - k;
        out[i] = (c[k] ?? 0) * (1 - f) + (c[k + 1] ?? c[k] ?? 0) * f;
      }
      return out;
    });
    r = ctx.sampleRate;
    const b = ctx.createBuffer(chans.length, n, r);
    chans.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    return b;
  }
}

async function decodeEncoded(bytes: Uint8Array): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  try {
    // decodeAudioData takes (and detaches) its own copy
    return await ctx.decodeAudioData(bytes.slice().buffer);
  } catch (e) {
    if (!isOgg(bytes)) throw e;
    const out = await (await wasmVorbis()).decodeFile(bytes);
    if (!out.samplesDecoded) throw e;
    return bufferFrom(out.channelData, out.samplesDecoded, out.sampleRate);
  }
}

async function decodeSample(bank: OpenBank, info: SampleInfo): Promise<Decoded> {
  const src = info.source;
  if (src.kind === 'pcm16') {
    if (!bank.reader) throw new Error('The bank has no sample data.');
    const pcm = await bank.reader.read(src.byteOffset, src.frames * 2);
    const low = src.sm24Offset !== undefined ? await bank.reader.read(src.sm24Offset, src.frames) : undefined;
    const buffer = bufferFrom([pcm16ToFloat(pcm, low)], src.frames, info.sampleRate || 44100);
    return { buffer, rate: info.sampleRate || buffer.sampleRate, bytes: buffer.length * 4 };
  }
  if (src.kind === 'encoded') {
    if (!bank.reader) throw new Error('The bank has no sample data.');
    const buffer = await decodeEncoded(await bank.reader.read(src.byteOffset, src.byteLength));
    return { buffer, rate: info.sampleRate || buffer.sampleRate, bytes: buffer.length * buffer.numberOfChannels * 4 };
  }
  const bytes = await bank.files?.read(src.path);
  if (!bytes) throw new Error(`The sample "${src.path}" is missing from the bank.`);
  const wav = readWavInfo(bytes);
  if (wav) {
    const pcm = decodeWav(bytes);
    if (pcm) {
      const buffer = bufferFrom(pcm.channels, pcm.channels[0].length, pcm.sampleRate);
      const loop = wav.loops[0];
      return { buffer, rate: pcm.sampleRate, fileLoop: loop && loop.end > loop.start ? loop : undefined, bytes: buffer.length * buffer.numberOfChannels * 4 };
    }
  }
  const buffer = await decodeEncoded(bytes);
  return { buffer, rate: nativeSampleRate(bytes) ?? buffer.sampleRate, bytes: buffer.length * buffer.numberOfChannels * 4 };
}

/** A sample, decoded (from the cache, or now). Null if it can't be decoded. */
export function loadSample(bank: OpenBank, index: number): Promise<Decoded | null> {
  const key = `${bank.id}:${index}`;
  const hit = touch(key);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(key);
  if (!p) {
    const info = bank.parsed.samples[index];
    const epoch = epochs.get(bank.id) ?? 0;
    p = (info ? decodeSample(bank, info) : Promise.reject(new Error('no such sample')))
      .then(d => {
        if ((epochs.get(bank.id) ?? 0) !== epoch) return d; // the bank was removed meanwhile
        cache.set(key, d);
        cachedBytes += d.bytes;
        evict();
        return d;
      })
      .catch(e => {
        console.warn(`Sample ${info?.name ?? index} could not be decoded`, e);
        return null;
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

const sampleNow = (bank: OpenBank, index: number) => touch(`${bank.id}:${index}`);

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

/** Regions of a preset that a key and velocity (0..127) trigger (round robin and random layers aside). */
export function matchRegions(preset: SamplePreset, key: number, vel: number, trigger: 'attack' | 'release' = 'attack'): SampleRegion[] {
  return preset.regions.filter(r => key >= r.loKey && key <= r.hiKey && vel >= r.loVel && vel <= r.hiVel && r.trigger === trigger);
}

/** Velocity → gain: the SF2 default (a concave curve, ≈ 40 dB), scaled by how much the region tracks velocity. */
function velocityGain(vel: number, track: number): number {
  const v = clamp(vel, 0.01, 1);
  const curve = v * v;
  return 1 - track + track * curve;
}

/** An envelope's times for one note (key tracking applied). */
interface NoteEnvelope {
  delay: number;
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
}

/** The gain the envelope schedules `t` seconds after the note starts, with the key still down. */
export function envelopeLevel(env: NoteEnvelope, peak: number, t: number): number {
  if (t < env.delay) return 0;
  let x = t - env.delay;
  if (env.attack > 0.0015) {
    if (x < env.attack) return (peak * x) / env.attack;
    x -= env.attack;
  }
  if (x < env.hold || env.sustain >= 0.999 || env.decay <= 0) return peak;
  x -= env.hold;
  const sus = peak * env.sustain;
  return sus + (peak - sus) * Math.exp(-x / (env.decay / 5));
}

/**
 * Schedule an envelope on a gain from `start`, up to `until` (the key-up, when it is
 * known: nothing is scheduled past it, so a release never has to cancel anything).
 */
function scheduleEnvelope(g: AudioParam, env: NoteEnvelope, peak: number, start: number, until = Infinity): void {
  const level = (t: number) => envelopeLevel(env, peak, t - start);
  g.setValueAtTime(0, start);
  let t = start + env.delay;
  if (t >= until) return;
  if (env.delay > 0) g.setValueAtTime(0, t);
  if (env.attack > 0.0015) {
    // a key-up during the attack: the ramp stops where it would have been
    const end = Math.min(t + env.attack, until);
    g.linearRampToValueAtTime(level(end), end);
    if (end >= until) return;
  } else g.setValueAtTime(peak, t);
  t += env.attack + env.hold;
  if (t >= until) return;
  if (env.hold > 0) g.setValueAtTime(peak, t);
  if (env.sustain < 0.999 && env.decay > 0) g.setTargetAtTime(peak * env.sustain, t, env.decay / 5);
}

// ---------------------------------------------------------------------------
// The sampler: one preset of a bank
// ---------------------------------------------------------------------------

export interface SamplerNote {
  /** Key up at context time `at` (the envelope's release; release samples play). */
  release(at: number): void;
  /** Stop quickly (voice stealing, stop all). */
  stop(at?: number): void;
  readonly start: number;
}

interface Playing {
  src: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
  out: AudioNode;
  offBy?: number;
  stopped: boolean;
  env: NoteEnvelope;
  peak: number;
  /** When the key-up release begins (Infinity while held). */
  releaseAt: number;
}

/** Minimum release, so notes never click off (many banks say 1 ms). */
const MIN_RELEASE = 0.025;

export class Sampler {
  readonly bank: OpenBank;
  readonly preset: SamplePreset;
  private readonly playing = new Set<Playing>();
  private readonly seq = new Map<number, number>();
  private rand = 0x9e3779b9;

  constructor(bank: OpenBank, preset: SamplePreset) {
    this.bank = bank;
    this.preset = preset;
  }

  private random(): number {
    // xorshift: round-robin and random layers needn't be secure, just even
    let x = this.rand;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rand = x >>> 0;
    return this.rand / 4294967296;
  }

  /** The regions this note plays (with the round robin advanced). */
  private pick(key: number, vel127: number, trigger: 'attack' | 'release'): SampleRegion[] {
    const all = matchRegions(this.preset, key, vel127, trigger);
    if (!all.length) return all;
    const r = this.random();
    let counter: number | undefined;
    return all.filter(reg => {
      if (reg.loRand !== undefined && r < reg.loRand) return false;
      if (reg.hiRand !== undefined && r >= reg.hiRand) return false;
      if (reg.seqLength && reg.seqLength > 1) {
        if (counter === undefined) {
          counter = this.seq.get(key) ?? 0;
          this.seq.set(key, counter + 1);
        }
        return (counter % reg.seqLength) + 1 === (reg.seqPosition ?? 1);
      }
      return true;
    });
  }

  /** Decode what these notes need. Returns false when the memory budget can't hold it all. */
  async prepare(notes: readonly { midi: number; velocity: number }[]): Promise<boolean> {
    const need = new Set<number>();
    for (const n of notes) {
      const vel = Math.round(clamp(n.velocity, 0, 1) * 127);
      for (const trigger of ['attack', 'release'] as const) for (const r of matchRegions(this.preset, n.midi, vel, trigger)) need.add(r.sample);
    }
    const keys = [...need].map(i => `${this.bank.id}:${i}`);
    keys.forEach(pin);
    try {
      // a few at a time: decoding is the slow part, and the browser decodes in parallel
      const list = [...need];
      for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(s => loadSample(this.bank, s)));
    } finally {
      keys.forEach(unpin);
    }
    return keys.every(k => cache.has(k));
  }

  /** Can this note play right now (its samples are decoded)? */
  ready(midi: number, velocity: number): boolean {
    const vel = Math.round(clamp(velocity, 0, 1) * 127);
    const regions = matchRegions(this.preset, midi, vel);
    return regions.length > 0 && regions.every(r => cache.has(`${this.bank.id}:${r.sample}`));
  }

  /** Does the preset have anything at all for this key? */
  covers(midi: number): boolean {
    return this.preset.regions.some(r => r.trigger === 'attack' && midi >= r.loKey && midi <= r.hiKey);
  }

  /**
   * Key down at `when`. Missing samples are decoded for next time and the note is
   * skipped (null) — callers fall back to a built-in sound for it.
   */
  noteOn(midi: number, velocity: number, when: number, out: AudioNode, opts: { oneShot?: boolean; level?: number; duration?: number } = {}): SamplerNote | null {
    const vel127 = Math.round(clamp(velocity, 0, 1) * 127);
    const regions = this.pick(midi, vel127, 'attack');
    if (!regions.length) return null;
    const ready = regions.map(r => ({ r, d: sampleNow(this.bank, r.sample) }));
    if (ready.some(x => !x.d)) {
      for (const x of ready) if (!x.d) void loadSample(this.bank, x.r.sample);
      return null;
    }
    const ctx = getAudioContext();
    const start = Math.max(when, ctx.currentTime);
    // choke: this note silences the ones its group cuts off (closed hi-hat stops open)
    for (const { r } of ready) {
      if (r.chokeGroup === undefined) continue;
      for (const p of this.playing) if (p.out === out && p.offBy === r.chokeGroup && p.start < start) this.fade(p, start, 0.01);
    }
    const level = opts.level ?? 1;
    // a note of known length (the band) has its release scheduled with it
    const until = opts.duration !== undefined && !opts.oneShot ? start + Math.max(0.02, opts.duration) : Infinity;
    const voices = ready.map(({ r, d }) => this.voice(r, d!, midi, velocity, start, out, level, until));
    let releasedAt = until;
    let stopped = false;
    let tails: { p: Playing; r: SampleRegion }[] = [];
    const releaseSamples = (t: number) => {
      // release samples (a piano's key-off thump)
      for (const v of tails) this.fade(v.p, t, 0.01);
      tails = [];
      for (const r of this.pick(midi, vel127, 'release')) {
        const d = sampleNow(this.bank, r.sample);
        if (d) tails.push(this.voice(r, d, midi, velocity * 0.7, t, out, level));
      }
    };
    if (until !== Infinity) releaseSamples(until);
    return {
      start,
      release: (at: number) => {
        // a key-up only ever comes sooner (Stop during a scheduled note)
        const t = Math.max(at, start + 0.005);
        if (stopped || opts.oneShot || t >= releasedAt) return;
        releasedAt = t;
        for (const v of voices) this.releaseVoice(v.p, v.r, t);
        releaseSamples(t);
      },
      stop: (at = ctx.currentTime) => {
        stopped = true;
        for (const v of [...voices, ...tails]) this.fade(v.p, at, 0.015);
      },
    };
  }

  /** A note of known length (the band): its whole envelope, release included, is scheduled at once. */
  play(midi: number, velocity: number, when: number, duration: number, out: AudioNode, opts: { oneShot?: boolean; level?: number } = {}): boolean {
    return this.noteOn(midi, velocity, when, out, { ...opts, duration }) !== null;
  }

  private voice(r: SampleRegion, d: Decoded, midi: number, velocity: number, start: number, out: AudioNode, level: number, until = Infinity): { p: Playing; r: SampleRegion } {
    const ctx = getAudioContext();
    const src = ctx.createBufferSource();
    src.buffer = d.buffer;
    const cents = (midi - r.rootKey) * r.keyTrack + r.tune;
    src.playbackRate.value = Math.pow(2, cents / 1200);
    const secs = (frames: number) => frames / d.rate;
    const loopFromFile = r.loopFromSample && d.fileLoop;
    const loopMode = loopFromFile ? 'continuous' : r.loop;
    const ls = loopFromFile ? d.fileLoop!.start : r.loopStart ?? this.bank.parsed.samples[r.sample]?.loopStart;
    const le = loopFromFile ? d.fileLoop!.end : r.loopEnd ?? this.bank.parsed.samples[r.sample]?.loopEnd;
    if ((loopMode === 'continuous' || loopMode === 'sustain') && ls !== undefined && le !== undefined && le > ls + 1) {
      src.loop = true;
      src.loopStart = secs(ls);
      src.loopEnd = secs(le);
    }
    let head: AudioNode = src;
    if (r.filter && r.filter.cutoff < 19000) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = clamp(r.filter.cutoff, 20, ctx.sampleRate / 2 - 100);
      lp.Q.value = r.filter.q;
      head.connect(lp);
      head = lp;
    }
    const gain = ctx.createGain();
    head.connect(gain);
    let tail: AudioNode = gain;
    if (r.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp(r.pan, -1, 1);
      gain.connect(pan);
      tail = pan;
    }
    tail.connect(out);
    // envelope
    const base = r.amp ?? DEFAULT_ENVELOPE;
    const keyScale = (tcPerKey?: number) => (tcPerKey ? Math.pow(2, ((60 - midi) * tcPerKey) / 1200) : 1);
    const env: NoteEnvelope = { ...base, hold: base.hold * keyScale(base.holdKeyTrack), decay: base.decay * keyScale(base.decayKeyTrack) };
    const peak = Math.pow(10, r.volume / 20) * velocityGain(velocity, r.velTrack) * level;
    const release = r.loop === 'one-shot' ? Infinity : until;
    scheduleEnvelope(gain.gain, env, peak, start, release);
    const offset = secs(r.offset);
    // start()'s duration counts seconds of the buffer, whatever the playback rate
    const playFor = r.end !== undefined ? Math.max(0.005, secs(r.end - r.offset)) : undefined;
    src.start(start, Math.min(offset, d.buffer.duration - 0.001), src.loop ? undefined : playFor);
    const p: Playing = { src, gain, start, out, offBy: r.offBy, stopped: false, env, peak, releaseAt: Infinity };
    if (release !== Infinity) this.releaseVoice(p, r, release, true);
    src.onended = () => {
      this.playing.delete(p);
      try {
        tail.disconnect();
        head.disconnect();
        gain.disconnect();
      } catch {
        /* already gone */
      }
    };
    this.playing.add(p);
    return { p, r };
  }

  /**
   * The key-up: fade over the release time from wherever the envelope is. `scheduled`:
   * the envelope was laid out to stop at `at` already (nothing to cancel).
   */
  private releaseVoice(p: Playing, r: SampleRegion, at: number, scheduled = false): void {
    if (p.stopped || r.loop === 'one-shot' || at >= p.releaseAt) return;
    p.releaseAt = at;
    const rel = Math.max(MIN_RELEASE, p.env.release);
    const g = p.gain.gain;
    if (!scheduled) holdAt(g, at, envelopeLevel(p.env, p.peak, at - p.start));
    // −60 dB over the release time
    g.setTargetAtTime(0, at, rel / 6.9);
    try {
      p.src.stop(at + rel + 0.05);
    } catch {
      /* already stopped */
    }
  }

  /** Silence a voice quickly from `at` (a note not yet started never sounds). */
  private fade(p: Playing, at: number, tau: number): void {
    if (p.stopped) return;
    p.stopped = true;
    if (p.start >= at) {
      try {
        p.src.stop(at);
      } catch {
        /* already stopped */
      }
      return;
    }
    const g = p.gain.gain;
    const t = at - p.start;
    // the level the schedule has at `at`: the envelope, or its release once that began
    const held = envelopeLevel(p.env, p.peak, Math.min(t, p.releaseAt - p.start));
    const level = at > p.releaseAt ? held * Math.exp(-(at - p.releaseAt) / (Math.max(MIN_RELEASE, p.env.release) / 6.9)) : held;
    holdAt(g, at, level);
    g.setTargetAtTime(0, at, tau);
    try {
      p.src.stop(at + tau * 8);
    } catch {
      /* already stopped */
    }
  }

  /** Stop what this sampler is playing (into `out` only, when given: other users of the same instrument play on). */
  stopAll(out?: AudioNode): void {
    const now = getAudioContext().currentTime;
    for (const p of this.playing) if (!out || p.out === out) this.fade(p, now, 0.02);
  }
}

/** Freeze an AudioParam at `at` with the value it has there (cancelAndHoldAtTime, or its equivalent where missing). */
function holdAt(g: AudioParam, at: number, value: number): void {
  if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(at);
  else {
    g.cancelScheduledValues(at);
    g.setValueAtTime(value, at);
  }
}
