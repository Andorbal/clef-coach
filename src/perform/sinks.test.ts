import { describe, expect, it, vi } from 'vitest';

const sent: [number[], number | undefined][] = [];
const fakeOut = { send: (data: number[], t?: number) => sent.push([[...data], t]), clear: vi.fn() };
vi.mock('../audio/midiOut', () => ({ enableMidiOut: async () => [{ id: 'synth', name: 'Synth' }], midiOutput: (id: string) => (id === 'synth' ? fakeOut : null) }));
vi.mock('../audio/context', () => ({ ctxTimeToPerfNow: (t: number) => t * 1000, markAppSound: () => undefined, getAudioContext: () => ({ currentTime: 0 }), getBus: () => null, getReverbInput: () => null }));

const { sinkFactory } = await import('./sinks');
import type { PerfTrack } from './types';

const track = (over: Partial<PerfTrack>): PerfTrack => ({ id: 'auto:bass', name: 'Bass', role: 'bass', program: 34, drums: false, source: 'auto', notes: [], volume: 0.8, pan: 0, ...over });

describe('playing the band through MIDI', () => {
  it('sends the program, then timed notes on the track’s channel, and the mix as controllers', async () => {
    sent.length = 0;
    const make = sinkFactory({}, { bandMidiOut: 'synth' });
    const bass = make(track({}));
    await bass.prepare([]);
    expect(sent.map(s => s[0])).toEqual([
      [0xb0, 0, 0],
      [0xb0, 32, 0],
      [0xc0, 33],
    ]);
    sent.length = 0;
    bass.play(40, 1, 2, 0.5, null as unknown as AudioNode);
    expect(sent).toEqual([
      [[0x90, 40, 127], 2000],
      [[0x80, 40, 0], 2500],
    ]);
    sent.length = 0;
    bass.mix?.({ volume: 0.5, pan: -1, mute: false, solo: false, reverb: 0 }, 1);
    bass.mix?.({ volume: 0.5, pan: -1, mute: false, solo: false, reverb: 0 }, 1); // unchanged: nothing sent
    expect(sent.map(s => s[0])).toEqual([
      [0xb0, 7, 64],
      [0xb0, 10, 1],
    ]);
    sent.length = 0;
    bass.stop();
    expect(fakeOut.clear).toHaveBeenCalled();
    expect(sent.map(s => s[0])).toEqual([
      [0xb0, 123, 0],
      [0xb0, 120, 0],
    ]);
  });

  it('puts drums on channel 10 and other parts on channels of their own', async () => {
    sent.length = 0;
    const make = sinkFactory({}, { bandMidiOut: 'synth' });
    const drums = make(track({ id: 'auto:drums', drums: true, program: 33 }));
    const keys = make(track({ id: 'auto:chords', program: 1 }));
    const bass = make(track({ id: 'auto:bass', program: 34 }));
    for (const s of [drums, keys, bass]) await s.prepare([]);
    const programs = sent.filter(s => (s[0][0] & 0xf0) === 0xc0).map(s => [s[0][0] & 0x0f, s[0][1]]);
    expect(programs).toEqual([
      [9, 32],
      [0, 0],
      [1, 33],
    ]);
  });
});
