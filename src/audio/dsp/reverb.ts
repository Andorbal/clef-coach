/**
 * Procedural room impulse response for the master ConvolverNode – PURE.
 *
 * A small, warm "studio room": a few discrete early reflections, then a dense
 * exponentially decaying noise tail whose high frequencies die faster (a
 * time-varying low-pass), decorrelated between L and R for width. No sample
 * files needed and it renders in ~2 ms.
 *
 * A ConvolverNode's cost grows with the response's length, and it runs whenever
 * anything plays, so the response can stop (`keep`) before the decay reaches
 * −60 dB: the last stretch is far below the dry sound, and only costs CPU.
 */
import { mulberry32 } from './util';

export interface ImpulseResponse {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
}

/**
 * `seconds` is the decay time (to −60 dB); `keep` how much of the response to return
 * (default: all of it), faded out over its last 50 ms.
 */
export function generateImpulseResponse(
  sampleRate: number,
  seconds = 1.6,
  seed = 1234,
  keep = seconds,
): ImpulseResponse {
  const full = Math.max(1, Math.round(seconds * sampleRate));
  const len = Math.max(1, Math.min(full, Math.round(keep * sampleRate)));
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const preDelay = Math.round(0.011 * sampleRate);
  // −60 dB after `seconds`
  const tau = seconds / Math.log(1000);
  const onset = Math.round(0.018 * sampleRate);

  [left, right].forEach((ch, c) => {
    const rand = mulberry32(seed + c * 7777);
    // Early reflections (first ~60 ms): sparse taps of decreasing level.
    for (let k = 0; k < 9; k++) {
      const t = preDelay + Math.round((0.004 + 0.055 * rand()) * sampleRate);
      if (t < len) ch[t] += (rand() < 0.5 ? -1 : 1) * (0.35 + 0.4 * rand()) * Math.exp(-(t / sampleRate) / 0.05);
    }
    // Diffuse tail with frequency-dependent decay.
    let lp = 0;
    for (let i = preDelay; i < len; i++) {
      const t = (i - preDelay) / sampleRate;
      const env = Math.exp(-t / tau) * Math.min(1, (i - preDelay) / onset);
      // cutoff glides from ~9 kHz down to ~1.2 kHz → darker tail
      const progress = (i - preDelay) / (full - preDelay);
      const fc = 9000 * Math.pow(1200 / 9000, Math.sqrt(progress));
      const a = Math.exp((-2 * Math.PI * fc) / sampleRate);
      const n = rand() * 2 - 1;
      lp = (1 - a) * n + a * lp;
      ch[i] += lp * env * 0.6;
    }
  });
  // Gentle fade at the very end to avoid a truncation click.
  const fade = Math.min(len, Math.round(0.05 * sampleRate));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    left[len - 1 - i] *= g;
    right[len - 1 - i] *= g;
  }
  return { left, right };
}
