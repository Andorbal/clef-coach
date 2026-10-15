import { describe, expect, it } from 'vitest';
import { envelopeLevel, nativeSampleRate } from './sampler';

describe('envelopeLevel', () => {
  const env = { delay: 0.1, attack: 0.2, hold: 0.1, decay: 1, sustain: 0.5, release: 0.3 };

  it('follows delay, attack, hold and decay', () => {
    expect(envelopeLevel(env, 1, 0.05)).toBe(0);
    expect(envelopeLevel(env, 1, 0.2)).toBeCloseTo(0.5);
    expect(envelopeLevel(env, 1, 0.35)).toBe(1);
    // decays towards the sustain level
    const later = envelopeLevel(env, 1, 0.4 + 0.2);
    expect(later).toBeLessThan(1);
    expect(later).toBeGreaterThan(0.5);
    expect(envelopeLevel(env, 1, 10)).toBeCloseTo(0.5);
  });

  it('holds the peak without a decay', () => {
    expect(envelopeLevel({ ...env, sustain: 1 }, 0.8, 5)).toBe(0.8);
    expect(envelopeLevel({ ...env, decay: 0 }, 0.8, 5)).toBe(0.8);
  });

  it('jumps to the peak with no attack', () => {
    expect(envelopeLevel({ ...env, delay: 0, attack: 0 }, 1, 0)).toBe(1);
  });
});

describe('nativeSampleRate', () => {
  it('reads a FLAC STREAMINFO rate', () => {
    const b = new Uint8Array(42);
    b.set([0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34]);
    // 44100 = 0x0AC44, in the 20 bits from byte 18
    const rate = 44100;
    b[18] = (rate >> 12) & 0xff;
    b[19] = (rate >> 4) & 0xff;
    b[20] = ((rate & 0xf) << 4) | 0x2;
    expect(nativeSampleRate(b)).toBe(44100);
  });

  it('reads an Ogg Vorbis identification header rate', () => {
    const b = new Uint8Array(27 + 1 + 30);
    b.set([0x4f, 0x67, 0x67, 0x53]);
    b[26] = 1;
    b[27] = 30;
    const p = 28;
    b[p] = 1;
    b.set([...'vorbis'].map(c => c.charCodeAt(0)), p + 1);
    new DataView(b.buffer).setUint32(p + 12, 48000, true);
    expect(nativeSampleRate(b)).toBe(48000);
  });

  it('knows nothing of other files', () => {
    expect(nativeSampleRate(new Uint8Array(64))).toBeNull();
  });
});
