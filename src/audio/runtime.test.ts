/**
 * Runtime tests for the Web Audio–dependent modules (synth engine, metronome,
 * sfx, input manager, app-sound bookkeeping) against a minimal fake
 * AudioContext that records what gets scheduled. Node has no Web Audio, so
 * this checks the wiring and timing logic rather than the sound.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake Web Audio
// ---------------------------------------------------------------------------

type Call = [string, ...number[]];

class FakeParam {
  value: number;
  calls: Call[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number) {
    this.calls.push(['target', v, t, tc]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['ramp', v, t]);
    return this;
  }
  cancelScheduledValues(t: number) {
    this.calls.push(['cancel', t]);
    return this;
  }
}

class FakeNode {
  ctx: FakeContext;
  outputs: FakeNode[] = [];
  constructor(ctx: FakeContext) {
    this.ctx = ctx;
  }
  connect(n: FakeNode) {
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
  }
  get context() {
    return this.ctx;
  }
}

class FakeBuffer {
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  private data: Float32Array[];
  constructor(ch: number, len: number, sr: number) {
    this.length = len;
    this.sampleRate = sr;
    this.numberOfChannels = ch;
    this.data = Array.from({ length: ch }, () => new Float32Array(len));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(i: number) {
    return this.data[i];
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  startAt: number | null = null;
  stopAt: number | null = null;
  onended: (() => void) | null = null;
  start(t = 0) {
    this.startAt = t;
    this.ctx.sources.push(this);
  }
  stop(t = 0) {
    this.stopAt = t;
  }
}

class FakeContext {
  static last: FakeContext;
  currentTime = 0;
  sampleRate = 48000;
  state = 'running';
  baseLatency = 0.005;
  destination: FakeNode;
  sources: FakeSource[] = [];
  gains: (FakeNode & { gain: FakeParam })[] = [];
  private listeners: (() => void)[] = [];
  constructor() {
    this.destination = new FakeNode(this);
    FakeContext.last = this;
  }
  addEventListener(_t: string, cb: () => void) {
    this.listeners.push(cb);
  }
  setState(s: string) {
    this.state = s;
    this.listeners.forEach((cb) => cb());
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    const n = Object.assign(new FakeNode(this), { gain: new FakeParam(1) });
    this.gains.push(n);
    return n;
  }
  createBufferSource() {
    return new FakeSource(this);
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(this), { pan: new FakeParam(0) });
  }
  createConvolver() {
    return Object.assign(new FakeNode(this), { buffer: null as unknown, normalize: true });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(this), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1) });
  }
  createDynamicsCompressor() {
    const p = () => new FakeParam(0);
    return Object.assign(new FakeNode(this), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() });
  }
}

const g = globalThis as unknown as { window?: unknown };
let hadWindow = false;
beforeAll(() => {
  hadWindow = 'window' in g;
  g.window = { AudioContext: FakeContext };
});
afterAll(() => {
  if (!hadWindow) delete g.window;
});

/** Imports AFTER the fake is installed (modules create the context lazily anyway). */
async function audio() {
  return import('./index');
}

function ctx(): FakeContext {
  return FakeContext.last;
}

const srcFor = (from: number) => ctx().sources.slice(from);

// ---------------------------------------------------------------------------

describe('runtime with a fake AudioContext', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('creates the master chain lazily and maps volume', async () => {
    const a = await audio();
    const c = a.getAudioContext() as unknown as FakeContext;
    expect(c).toBe(ctx());
    a.setMasterVolume(0.5);
    expect(a.getMasterVolume()).toBe(0.5);
    a.setMasterVolume(7);
    expect(a.getMasterVolume()).toBe(1);
  });

  it('synth: noteOn/noteOff schedule a voice, release it and mark app sound', async () => {
    const a = await audio();
    const c = ctx();
    c.currentTime = 10;
    const n0 = c.sources.length;
    a.synth.noteOn(60, { velocity: 0.8 });
    const [src] = srcFor(n0);
    expect(src.startAt).toBe(10);
    expect(src.buffer!.length).toBeGreaterThan(48000);
    expect(a.appSoundActive()).toBe(true);
    expect(a.appSoundBlocksNote(60)).toBe(true);
    expect(a.appSoundBlocksNote(72)).toBe(true); // octave
    expect(a.appSoundBlocksNote(62)).toBe(false);
    c.currentTime = 10.5;
    a.synth.noteOff(60);
    expect(src.stopAt).toBeGreaterThan(10.5);
    expect(src.stopAt).toBeLessThan(10.9);
    // the self-sound mark now ends shortly after the release
    c.currentTime = 11.2;
    expect(a.appSoundBlocksNote(60)).toBe(false);
  });

  it('synth: play() with duration, chords, voice override and guitar strum', async () => {
    const a = await audio();
    const c = ctx();
    c.currentTime = 20;
    const n0 = c.sources.length;
    a.synth.play([64, 60, 67], { duration: 0.5, voice: 'guitar' });
    const s = srcFor(n0);
    expect(s.length).toBe(3);
    expect(s.map((x) => x.startAt)).toEqual([20, 20.014, 20.028].map((t) => expect.closeTo(t, 6)));
    for (const x of s) expect(x.stopAt).toBeGreaterThan(x.startAt! + 0.5);
    expect(a.synth.getVoice()).toBe('piano'); // override didn't change the default
  });

  it('synth: playSequence treats `at` as seconds from now and can be stopped', async () => {
    vi.useFakeTimers();
    const a = await audio();
    const c = ctx();
    c.currentTime = 30;
    const n0 = c.sources.length;
    const h = a.synth.playSequence([
      { midi: [60], at: 0, duration: 0.2 },
      { midi: [62], at: 0.25, duration: 0.2 },
      { midi: [64, 67], at: 1.0, duration: 0.5 },
    ]);
    expect(h.endTime).toBeCloseTo(31.5);
    expect(srcFor(n0).map((x) => x.startAt)).toEqual([30, 30.25]); // lookahead 0.3 s
    c.currentTime = 30.8;
    vi.advanceTimersByTime(50);
    expect(srcFor(n0).map((x) => x.startAt)).toEqual([30, 30.25, 31, 31]);
    h.stop();
    for (const x of srcFor(n0)) expect(x.stopAt).not.toBeNull();
    vi.useRealTimers();
  });

  it('synth: queued notes from a suspended context are dropped when it resumes late', async () => {
    const a = await audio();
    const c = ctx();
    c.state = 'suspended';
    const n0 = c.sources.length;
    a.synth.play(65);
    const [src] = srcFor(n0);
    const realNow = performance.now.bind(performance);
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => realNow() + 2000);
    c.setState('running');
    spy.mockRestore();
    expect(src.stopAt).not.toBeNull();
    expect(src.stopAt!).toBeLessThan(c.currentTime + 0.2);
  });

  it('metronome: count-in, accents, onBeat info, muted after count-in, setBpm keeps grid', async () => {
    vi.useFakeTimers();
    const a = await audio();
    const c = ctx();
    c.currentTime = 100;
    const n0 = c.sources.length;
    const beats: { beat: number; bar: number; time: number; isCountIn: boolean }[] = [];
    const m = new a.Metronome();
    m.start({ bpm: 120, beatsPerBar: 4, countIn: 1, muted: true, onBeat: (b) => beats.push(b) });
    expect(m.running).toBe(true);
    expect(m.startTime).toBeCloseTo(100.12 + 4 * 0.5);
    expect(m.beatTime(0)).toBeCloseTo(m.startTime);
    expect(m.beatTime(-4)).toBeCloseTo(100.12);
    // advance audio + timers through 3 s
    for (let i = 0; i < 120; i++) {
      c.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
    const clicks = srcFor(n0);
    // muted: only the 4 count-in beats click
    expect(clicks.length).toBe(4);
    expect(clicks.map((s) => s.startAt)).toEqual([100.12, 100.62, 101.12, 101.62].map((t) => expect.closeTo(t, 6)));
    expect(clicks[0].buffer).not.toBe(clicks[1].buffer); // accented downbeat buffer
    // callbacks for count-in and the following bars
    expect(beats.slice(0, 5)).toEqual([
      { beat: 0, bar: -1, isCountIn: true, time: expect.closeTo(100.12, 6) },
      { beat: 1, bar: -1, isCountIn: true, time: expect.closeTo(100.62, 6) },
      { beat: 2, bar: -1, isCountIn: true, time: expect.closeTo(101.12, 6) },
      { beat: 3, bar: -1, isCountIn: true, time: expect.closeTo(101.62, 6) },
      { beat: 0, bar: 0, isCountIn: false, time: expect.closeTo(102.12, 6) },
    ]);
    // tempo change: grid continues from the next unscheduled beat
    const next = beats.length;
    m.setMuted(false);
    m.setBpm(60);
    for (let i = 0; i < 160; i++) {
      c.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
    const times = beats.slice(next).map((b) => b.time);
    for (let i = 2; i < times.length; i++) expect(times[i] - times[i - 1]).toBeCloseTo(1, 6);
    expect(srcFor(n0).length).toBeGreaterThan(4); // unmuted clicks resumed
    m.stop();
    expect(m.running).toBe(false);
    vi.useRealTimers();
  });

  it('sfx: plays when running, honours enable/volume, skips while suspended', async () => {
    const a = await audio();
    const c = ctx();
    c.currentTime = 200;
    const n0 = c.sources.length;
    a.sfx.correct();
    expect(srcFor(n0).length).toBe(1);
    expect(srcFor(n0)[0].buffer!.numberOfChannels).toBe(2);
    expect(a.appSoundBlocksNote(88)).toBe(true);
    a.sfx.correct(); // debounced (same instant)
    expect(srcFor(n0).length).toBe(1);
    a.setSfxEnabled(false);
    c.currentTime = 201;
    a.sfx.wrong();
    expect(srcFor(n0).length).toBe(1);
    a.setSfxEnabled(true);
    c.state = 'suspended';
    a.sfx.tap();
    expect(srcFor(n0).length).toBe(1);
    c.state = 'running';
    for (const name of ['wrong', 'complete', 'levelUp', 'tap', 'streak'] as const) a.sfx[name]();
    expect(srcFor(n0).length).toBe(6);
    a.setSfxVolume(0.3);
    expect(a.getSfxVolume()).toBe(0.3);
  });

  it('inputManager: fan-out, held notes, echo through the synth per source', async () => {
    const a = await audio();
    const c = ctx();
    c.currentTime = 300;
    const got: string[] = [];
    const off = a.inputManager.subscribe((e) => got.push(`${e.source}:${e.type}${e.midi}`));
    let statusChanges = 0;
    const offS = a.inputManager.onStatus(() => statusChanges++);
    const n0 = c.sources.length;
    a.inputManager.emit({ type: 'on', midi: 60, velocity: 0.8, time: performance.now(), source: 'touch' });
    a.inputManager.emit({ type: 'on', midi: 64, velocity: 0.8, time: performance.now(), source: 'midi' });
    expect([...a.inputManager.getHeld()].sort()).toEqual([60, 64]);
    expect(srcFor(n0).length).toBe(1); // touch echoes, MIDI doesn't by default
    expect(a.inputManager.status.lastSource).toBe('midi');
    expect(statusChanges).toBeGreaterThan(0);
    a.inputManager.setEchoForSource('midi', true);
    a.inputManager.emit({ type: 'on', midi: 67, velocity: 0.5, time: performance.now(), source: 'midi' });
    expect(srcFor(n0).length).toBe(2);
    a.inputManager.emit({ type: 'off', midi: 60, velocity: 0, time: performance.now(), source: 'touch' });
    a.inputManager.emit({ type: 'off', midi: 64, velocity: 0, time: performance.now(), source: 'midi' });
    a.inputManager.emit({ type: 'off', midi: 67, velocity: 0, time: performance.now(), source: 'midi' });
    expect(a.inputManager.getHeld().size).toBe(0);
    expect(srcFor(n0)[0].stopAt).not.toBeNull();
    expect(got).toEqual(['touch:on60', 'midi:on64', 'midi:on67', 'touch:off60', 'midi:off64', 'midi:off67']);
    // invalid notes are ignored
    a.inputManager.emit({ type: 'on', midi: 200, velocity: 1, time: 0, source: 'keyboard' });
    expect(got.length).toBe(6);
    off();
    offS();
    a.inputManager.setEchoForSource('midi', false);
  });

  it('inputManager reports MIDI as unsupported without Web MIDI', async () => {
    const a = await audio();
    expect(a.inputManager.status.midiSupported).toBe(false);
    const r = await a.inputManager.enableMidi();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/MIDI/);
  });

  it('clock mapping round-trips', async () => {
    const a = await audio();
    ctx().currentTime = 50;
    const p = a.ctxTimeToPerfNow(51.25);
    expect(a.perfNowToCtxTime(p)).toBeCloseTo(51.25, 3); // performance.now() moves between calls
  });
});
