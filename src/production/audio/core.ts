/**
 * The live console, as the audio thread runs it: the Mixer, the transport, and meter
 * reports about 20 times a second while anything sounds. Shared by the AudioWorklet
 * (worklet.ts) and the main-thread fallback (host.ts), so both behave the same.
 */
import { type MeterSnapshot, Mixer } from '../dsp/mixer';
import type { Mix } from '../dsp/params';

export type ConsoleMessage =
  | { t: 'init'; channels: string[]; tempo: number }
  | { t: 'stems'; stems: Record<string, Float32Array> }
  | { t: 'mix'; mix: Mix }
  | { t: 'set'; key: string; value: number }
  | { t: 'play'; from?: number }
  | { t: 'stop' }
  | { t: 'reset' };

export type ConsoleReply = { t: 'meters'; m: MeterSnapshot } | { t: 'state'; playing: boolean; sounding: boolean };

/** Blocks between meter reports (128 samples each: about 20 a second at 48 kHz). */
const METER_EVERY = 18;

/** The worklet and the main-thread fallback run the console the same way. */
export class ConsoleCore {
  mixer: Mixer;
  private blocks = 0;
  private wasPlaying = false;
  private wasSounding = false;
  private readonly sr: number;
  private readonly post: (m: ConsoleReply) => void;

  constructor(sr: number, post: (m: ConsoleReply) => void) {
    this.sr = sr;
    this.post = post;
    this.mixer = new Mixer(sr, []);
  }

  handle(m: ConsoleMessage): void {
    switch (m.t) {
      case 'init': {
        const mix = this.mixer.getMix();
        this.mixer = new Mixer(this.sr, m.channels);
        this.mixer.tempo = m.tempo;
        this.mixer.setMix(mix);
        break;
      }
      case 'stems':
        this.mixer.setStems(m.stems);
        break;
      case 'mix':
        this.mixer.setMix(m.mix);
        break;
      case 'set':
        this.mixer.set(m.key, m.value);
        break;
      case 'play':
        this.mixer.play(m.from);
        break;
      case 'stop':
        this.mixer.stop();
        break;
      case 'reset':
        this.mixer.stop();
        this.mixer.reset();
        break;
    }
    this.report(true);
  }

  render(l: Float32Array, r: Float32Array, n: number): void {
    this.mixer.render(l, r, n);
    this.report(false);
  }

  private report(now: boolean): void {
    const playing = this.mixer.isPlaying;
    const sounding = !this.mixer.silent;
    if (playing !== this.wasPlaying || sounding !== this.wasSounding) {
      this.wasPlaying = playing;
      this.wasSounding = sounding;
      this.post({ t: 'state', playing, sounding });
    }
    if (now) return;
    if (sounding && ++this.blocks >= METER_EVERY) {
      this.blocks = 0;
      this.post({ t: 'meters', m: this.mixer.meters() });
    }
  }
}
