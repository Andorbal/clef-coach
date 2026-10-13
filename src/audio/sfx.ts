/**
 * UI sound effects. The sounds themselves are designed in ./sounds.ts (pure
 * renderers); this module caches them as AudioBuffers and plays them through
 * the 'sfx' bus, honouring the global enable/volume settings.
 *
 * Effects are fire-and-forget and never queue up: if audio is locked (iOS
 * before the first gesture) they are simply skipped rather than played late.
 */
import { getAudioContext, getBus, isAudioSupported, markAppSound } from './context';
import { audibleDuration, renderSfx, SFX_NAMES, SFX_PITCHES } from './sounds';
import type { SfxName } from './sounds';

export type { SfxName } from './sounds';

let enabled = true;
let volume = 0.8;
let out: GainNode | null = null;
const cache = new Map<SfxName, AudioBuffer>();
/** How long each effect is actually audible (s) – the mic ignores related notes only that long. */
const audible = new Map<SfxName, number>();
/** A UI chime can be mis-heard as itself, an octave either way or its twelfth – not two octaves down. */
const SFX_INTERVALS = [-12, 0, 12, 19];
const lastPlayed = new Map<SfxName, number>();

/** Minimum spacing between two triggers of the same effect (debounce, seconds). */
const MIN_GAP: Record<SfxName, number> = {
  correct: 0.05,
  wrong: 0.08,
  complete: 0.3,
  levelUp: 0.5,
  tap: 0.03,
  streak: 0.15,
};

export function setSfxEnabled(on: boolean): void {
  enabled = !!on;
}

export function isSfxEnabled(): boolean {
  return enabled;
}

/** Effects volume 0..1 (applied on top of the master volume). */
export function setSfxVolume(v: number): void {
  volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  if (out) out.gain.setTargetAtTime(volume * volume, out.context.currentTime, 0.02);
}

export function getSfxVolume(): number {
  return volume;
}

function output(ctx: AudioContext): GainNode {
  if (!out) {
    out = ctx.createGain();
    out.gain.value = volume * volume;
    out.connect(getBus('sfx'));
  }
  return out;
}

function buffer(ctx: AudioContext, name: SfxName): AudioBuffer {
  let b = cache.get(name);
  if (!b || b.sampleRate !== ctx.sampleRate) {
    const s = renderSfx(name, ctx.sampleRate);
    b = ctx.createBuffer(2, s.left.length, ctx.sampleRate);
    b.getChannelData(0).set(s.left);
    b.getChannelData(1).set(s.right);
    cache.set(name, b);
    audible.set(name, audibleDuration([s.left, s.right], ctx.sampleRate));
  }
  return b;
}

function play(name: SfxName): void {
  if (!enabled || volume <= 0 || !isAudioSupported()) return;
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch {
    return;
  }
  if ((ctx.state as string) !== 'running') {
    // Don't queue UI sounds on a locked/suspended context – they'd play late.
    ctx.resume().catch(() => {});
    return;
  }
  const now = ctx.currentTime;
  const last = lastPlayed.get(name);
  if (last !== undefined && now - last < MIN_GAP[name]) return;
  lastPlayed.set(name, now);

  const buf = buffer(ctx, name);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(output(ctx));
  const t = now + 0.003;
  src.start(t);
  src.onended = () => src.disconnect();
  markAppSound(t + (audible.get(name) ?? buf.duration), {
    from: t,
    midis: SFX_PITCHES[name],
    kind: name === 'tap' ? 'click' : 'tonal',
    intervals: SFX_INTERVALS,
  });
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 200 });
    else setTimeout(resolve, 0);
  });
}

export const sfx = {
  /** Soft two-note marimba/bell ping. */
  correct: (): void => play('correct'),
  /** Low, muted, gentle double thud. */
  wrong: (): void => play('wrong'),
  /** Warm rising arpeggio chime – lesson complete. */
  complete: (): void => play('complete'),
  /** Richer flourish: pentatonic run into a blooming chord. */
  levelUp: (): void => play('levelUp'),
  /** Very soft tick for buttons. */
  tap: (): void => play('tap'),
  /** Sparkly cascade for streaks. */
  streak: (): void => play('streak'),
  /** Render all effects in idle time (call once after startup). */
  async preload(): Promise<void> {
    if (!isAudioSupported()) return;
    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return;
    }
    for (const name of SFX_NAMES) {
      if (cache.has(name)) continue;
      await idle();
      buffer(ctx, name);
    }
  },
};
