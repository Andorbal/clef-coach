/**
 * Which sound each band track plays through. Built-in sounds always work; a track can
 * also use an instrument from a sound bank the player has added (see src/audio/samples),
 * instead of the built-in sound or layered over it. A note the bank can't play (no
 * region for it, or a sample that failed to decode) falls back to the built-in sound.
 */
import { ctxTimeToPerfNow, markAppSound } from '../audio/context';
import { enableMidiOut, midiOutput } from '../audio/midiOut';
import { gmSampler, samplerFor } from '../audio/samples/manager';
import type { Sampler } from '../audio/samples/sampler';
import type { SynthVoiceId } from '../music/instruments';
import { builtinFor } from './builtin';
import { type NoteSink, type SinkFactory, type TrackMix, builtinSink } from './performer';
import type { PerfNote, PerfTrack } from './types';

/** A track's sound. */
export type SoundChoice =
  | { source: 'builtin' }
  /** one preset of a bank */
  | { source: 'bank'; bankId: string; bank: number; program: number; layer?: boolean }
  /** the bank's General MIDI instrument for the track's program (or its drum kit) */
  | { source: 'gm'; bankId: string; layer?: boolean }
  /** a MIDI device (a sound module, a synth, a DAW), on a channel of its own */
  | { source: 'midi'; outputId: string };

/** Device-wide sound choices (Settings → Instrument sounds). */
export interface SoundSettings {
  /** A bank whose General MIDI instruments the band uses by default. */
  gmBank?: string | null;
  /** Layer that bank over the built-in sounds rather than replacing them. */
  gmLayer?: boolean;
  /** The sound of the player's own instrument (taps, listening, the other hand…), per voice. */
  instruments?: Partial<Record<SynthVoiceId, SoundChoice>>;
  /** Megabytes of decoded samples to keep in memory; 0 = no limit. Default: from the device. */
  memoryMB?: number;
  /** Play the band through this MIDI output instead of the app's sounds. */
  bandMidiOut?: string | null;
}

class SampleSink implements NoteSink {
  private sampler: Sampler | null = null;
  private readonly pending: Promise<Sampler | null>;
  private readonly fallback: NoteSink;
  private readonly layer: boolean;
  private readonly drums: boolean;
  /** Where it played (a sampler is shared — with the player's own instrument too — so stop only these). */
  private readonly outs = new Set<AudioNode>();

  constructor(sampler: Promise<Sampler | null>, fallback: NoteSink, layer: boolean, drums: boolean) {
    this.pending = sampler;
    this.fallback = fallback;
    this.layer = layer;
    this.drums = drums;
  }

  async prepare(notes: readonly PerfNote[]): Promise<void> {
    this.sampler = await this.pending;
    const s = this.sampler;
    if (s) await s.prepare(notes.filter(n => s.covers(n.midi)));
    if (!s || this.layer || notes.some(n => !s.covers(n.midi))) await this.fallback.prepare(notes);
  }

  play(midi: number, velocity: number, when: number, duration: number, out: AudioNode): void {
    const ok = this.sampler?.play(midi, velocity, when, duration, out, { oneShot: this.drums }) ?? false;
    if (ok) this.outs.add(out);
    if (ok && !this.drums) markAppSound(when + duration + 0.3, { from: when, midis: [midi], kind: 'tonal', intervals: [0] });
    if (!ok || this.layer) this.fallback.play(midi, velocity, when, duration, out);
  }

  stop(): void {
    for (const out of this.outs) this.sampler?.stopAll(out);
    this.outs.clear();
    this.fallback.stop();
  }
}

/**
 * Plays a track through a MIDI output: General MIDI program change, volume (CC7) and pan
 * (CC10) from the mixer, notes timestamped on the performance clock so they line up with
 * what the app plays. Drums go to channel 10, as General MIDI expects.
 */
class MidiSink implements NoteSink {
  private out: MIDIOutput | null = null;
  private readonly outputId: string;
  private readonly channel: number;
  private readonly track: PerfTrack;
  private last = '';

  constructor(outputId: string, channel: number, track: PerfTrack) {
    this.outputId = outputId;
    this.channel = channel;
    this.track = track;
  }

  async prepare(): Promise<void> {
    await enableMidiOut();
    this.out = midiOutput(this.outputId);
    if (!this.out) return;
    const ch = this.channel;
    // bank 0 (bank 120 is the GM2 drum bank; channel 10 is drums anyway), then the program or kit
    this.out.send([0xb0 | ch, 0, this.track.drums ? 120 : 0]);
    this.out.send([0xb0 | ch, 32, 0]);
    this.out.send([0xc0 | ch, Math.max(0, Math.min(127, this.track.program - 1))]);
  }

  play(midi: number, velocity: number, when: number, duration: number): void {
    const out = this.out;
    if (!out) return;
    const ch = this.channel;
    const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    const note = Math.max(0, Math.min(127, Math.round(midi)));
    out.send([0x90 | ch, note, v], ctxTimeToPerfNow(when));
    out.send([0x80 | ch, note, 0], ctxTimeToPerfNow(when + duration));
  }

  mix(m: TrackMix, master: number): void {
    const out = this.out;
    if (!out) return;
    const vol = Math.round(127 * Math.min(1, m.volume * master));
    const pan = Math.round(64 + Math.max(-1, Math.min(1, m.pan)) * 63);
    const key = `${vol}:${pan}`;
    if (key === this.last) return;
    this.last = key;
    out.send([0xb0 | this.channel, 7, vol]);
    out.send([0xb0 | this.channel, 10, pan]);
  }

  stop(): void {
    const out = this.out;
    if (!out) return;
    // drop what's queued (Chrome), then all notes off
    (out as MIDIOutput & { clear?: () => void }).clear?.();
    out.send([0xb0 | this.channel, 123, 0]);
    out.send([0xb0 | this.channel, 120, 0]);
  }
}

/** MIDI channels for band tracks: drums on 10, the others in turn on the rest. */
function channelFor(track: PerfTrack, used: Map<string, number>): number {
  if (track.drums) return 9;
  let ch = used.get(track.id);
  if (ch === undefined) {
    const melodic = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
    ch = melodic[used.size % melodic.length];
    used.set(track.id, ch);
  }
  return ch;
}

/** The sound a track gets: its own choice, else the device's GM bank, else built-in. */
export function choiceFor(track: PerfTrack, choices: Record<string, SoundChoice>, settings: SoundSettings): SoundChoice {
  const own = choices[track.id];
  if (own) return own;
  if (track.source === 'part') {
    const voice = track.sound?.kind === 'rendered' ? track.sound.voice : null;
    return (voice && settings.instruments?.[voice]) || { source: 'builtin' };
  }
  if (settings.bandMidiOut) return { source: 'midi', outputId: settings.bandMidiOut };
  if (settings.gmBank) return { source: 'gm', bankId: settings.gmBank, layer: settings.gmLayer };
  return { source: 'builtin' };
}

/** The sink factory for a band whose tracks use these sounds (by track id). */
export function sinkFactory(choices: Record<string, SoundChoice>, settings: SoundSettings = {}): SinkFactory {
  const channels = new Map<string, number>();
  return (track: PerfTrack): NoteSink => {
    const builtin = builtinSink(track.sound ?? builtinFor(track.program, track.drums));
    const choice = choiceFor(track, choices, settings);
    if (choice.source === 'builtin') return builtin;
    if (choice.source === 'midi') return new MidiSink(choice.outputId, channelFor(track, channels), track);
    const sampler = choice.source === 'gm' ? gmSampler(choice.bankId, track.program, track.drums) : samplerFor(choice.bankId, choice.bank, choice.program);
    return new SampleSink(sampler, builtin, !!choice.layer, track.drums);
  };
}
