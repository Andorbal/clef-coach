import { describe, expect, it } from 'vitest';
import { decodeWav, readWavInfo } from './wav';

// ---------------------------------------------------------------------------
// Tiny WAV writer
// ---------------------------------------------------------------------------

const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));
const f32 = (v: number) => [...new Uint8Array(new Float32Array([v]).buffer)];
const f64 = (v: number) => [...new Uint8Array(new Float64Array([v]).buffer)];

/** A chunk, padded to an even length unless `pad` is false (a careless writer). */
const chunk = (id: string, body: number[], pad = true) => [...ascii(id), ...le32(body.length), ...body, ...(pad && body.length & 1 ? [0] : [])];
const riff = (...chunks: number[][]) => {
  const body = [...ascii('WAVE'), ...chunks.flat()];
  return new Uint8Array([...ascii('RIFF'), ...le32(body.length), ...body]);
};
const fmt = (format: number, channels: number, rate: number, bits: number) => {
  const blockAlign = (channels * bits) / 8;
  return chunk('fmt ', [...le16(format), ...le16(channels), ...le32(rate), ...le32(rate * blockAlign), ...le16(blockAlign), ...le16(bits)]);
};
/** WAVE_FORMAT_EXTENSIBLE with the KSDATAFORMAT_SUBTYPE GUID for `sub` (1 = PCM, 3 = float). */
const extensible = (sub: number, channels: number, rate: number, containerBits: number, validBits: number) => {
  const blockAlign = (channels * containerBits) / 8;
  const guid = [...le16(sub), 0, 0, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
  return chunk('fmt ', [
    ...le16(0xfffe), ...le16(channels), ...le32(rate), ...le32(rate * blockAlign), ...le16(blockAlign), ...le16(containerBits),
    ...le16(22), ...le16(validBits), ...le32(channels === 2 ? 3 : 4), ...guid,
  ]);
};
const data = (bytes: number[]) => chunk('data', bytes);
const smpl = (unityNote: number, fraction: number, loops: [number, number][]) =>
  chunk('smpl', [
    ...le32(0), ...le32(0), ...le32(22676), ...le32(unityNote), ...le32(fraction), ...le32(0), ...le32(0), ...le32(loops.length), ...le32(0),
    ...loops.flatMap(([start, end], i) => [...le32(i), ...le32(0), ...le32(start), ...le32(end), ...le32(0), ...le32(0)]),
  ]);

const channelsOf = (bytes: Uint8Array) => decodeWav(bytes)!.channels.map(c => [...c]);

describe('readWavInfo', () => {
  it('reads a 16-bit stereo header', () => {
    const wav = riff(fmt(1, 2, 44100, 16), data([...le16(0), ...le16(1), ...le16(2), ...le16(3)]));
    expect(readWavInfo(wav)).toEqual({ format: 1, channels: 2, sampleRate: 44100, bitsPerSample: 16, frames: 2, dataOffset: 44, loops: [] });
  });

  it('reads loops and the root key from a smpl chunk after the data', () => {
    const wav = riff(fmt(1, 1, 48000, 16), data(new Array(200).fill(0)), smpl(57, 0x80000000, [[10, 89], [20, 49]]));
    const info = readWavInfo(wav)!;
    expect(info.frames).toBe(100);
    expect(info.unityNote).toBe(57);
    expect(info.pitchFraction).toBe(50);
    // dwEnd is inclusive; ours is exclusive
    expect(info.loops).toEqual([{ start: 10, end: 90 }, { start: 20, end: 50 }]);
  });

  it('works on a prefix that reaches the data chunk header', () => {
    const wav = riff(fmt(1, 1, 22050, 16), data(new Array(2000).fill(0)), smpl(60, 0, [[0, 999]]));
    const prefix = wav.subarray(0, 52);
    expect(readWavInfo(prefix)).toEqual({ format: 1, channels: 1, sampleRate: 22050, bitsPerSample: 16, frames: 1000, dataOffset: 44, loops: [] });
    expect(readWavInfo(wav.subarray(0, 40))).toBeNull(); // the data chunk header isn't there yet
  });

  it('skips odd-sized chunks and their pad byte', () => {
    const wav = riff(chunk('LIST', [1, 2, 3, 4, 5]), fmt(1, 1, 44100, 16), chunk('junk', [9]), data([...le16(1000)]), chunk('note', [1, 2, 3]), smpl(64, 0, [[0, 0]]));
    const info = readWavInfo(wav)!;
    expect(info.dataOffset).toBe(12 + 14 + 24 + 10 + 8);
    expect(info.frames).toBe(1);
    expect(info.unityNote).toBe(64);
    expect(info.loops).toEqual([{ start: 0, end: 1 }]);
  });

  it('copes with a writer that forgot the pad byte', () => {
    const wav = riff(chunk('LIST', [1, 2, 3], false), fmt(1, 1, 44100, 16), data([...le16(7)]));
    expect(readWavInfo(wav)?.dataOffset).toBe(12 + 11 + 24 + 8);
    expect(channelsOf(wav)).toEqual([[7 / 32768]]);
  });

  it('resolves WAVE_FORMAT_EXTENSIBLE to its sub-format', () => {
    const info = readWavInfo(riff(extensible(3, 2, 96000, 32, 32), data(new Array(16).fill(0))))!;
    expect(info).toMatchObject({ format: 3, channels: 2, sampleRate: 96000, bitsPerSample: 32, frames: 2 });
  });

  it('reads a streamed data chunk with no size to the end of the bytes', () => {
    const wav = riff(fmt(1, 1, 8000, 16), [...ascii('data'), ...le32(0xffffffff), ...le16(5), ...le16(6), ...le16(7)]);
    expect(readWavInfo(wav)?.frames).toBe(3);
    expect(channelsOf(wav)[0]).toHaveLength(3);
  });

  it('returns null for what is not a WAV', () => {
    expect(readWavInfo(new Uint8Array(0))).toBeNull();
    expect(readWavInfo(new Uint8Array(ascii('OggS and some more bytes')))).toBeNull();
    expect(readWavInfo(new Uint8Array([...ascii('RIFF'), ...le32(4), ...ascii('AVI ')]))).toBeNull();
    expect(readWavInfo(riff(data([0, 0])))).toBeNull(); // no fmt chunk
    expect(readWavInfo(riff(fmt(1, 1, 44100, 16)))).toBeNull(); // no data chunk
  });
});

describe('decodeWav', () => {
  it('decodes 16-bit stereo, interleaved', () => {
    const wav = riff(fmt(1, 2, 44100, 16), data([...le16(0), ...le16(16384), ...le16(0x8000), ...le16(0x7fff)]));
    const out = decodeWav(wav)!;
    expect(out.sampleRate).toBe(44100);
    expect(out.channels.map(c => [...c])).toEqual([
      [0, -1],
      [0.5, 32767 / 32768],
    ]);
    expect(out.channels[0]).toBeInstanceOf(Float32Array);
  });

  it('decodes unsigned 8-bit', () => {
    expect(channelsOf(riff(fmt(1, 1, 8000, 8), data([128, 255, 0, 192])))).toEqual([[0, 127 / 128, -1, 0.5]]);
  });

  it('decodes 24-bit with sign extension', () => {
    const wav = riff(fmt(1, 1, 48000, 24), data([...le24(0x400000), ...le24(0x800000), ...le24(0xffffff), ...le24(0)]));
    expect(channelsOf(wav)).toEqual([[0.5, -1, -1 / 0x800000, 0]]);
  });

  it('decodes 32-bit integers', () => {
    expect(channelsOf(riff(fmt(1, 1, 48000, 32), data([...le32(0x40000000), ...le32(0xc0000000)])))).toEqual([[0.5, -0.5]]);
  });

  it('decodes 32- and 64-bit float', () => {
    expect(channelsOf(riff(fmt(3, 1, 44100, 32), data([...f32(0.25), ...f32(-0.75)])))).toEqual([[0.25, -0.75]]);
    expect(channelsOf(riff(fmt(3, 2, 44100, 64), data([...f64(0.125), ...f64(-1)])))).toEqual([[0.125], [-1]]);
  });

  it('decodes extensible 24-bit audio in 32-bit containers', () => {
    // valid bits sit at the top of each container
    const wav = riff(extensible(1, 2, 48000, 32, 24), data([...le32(0x40000000), ...le32(0xc0000000), ...le32(0x20000000), ...le32(0)]));
    expect(readWavInfo(wav)?.format).toBe(1);
    expect(channelsOf(wav)).toEqual([
      [0.5, 0.25],
      [-0.5, 0],
    ]);
  });

  it('decodes extensible float', () => {
    expect(channelsOf(riff(extensible(3, 1, 44100, 32, 32), data([...f32(0.5)])))).toEqual([[0.5]]);
  });

  it('decodes a truncated file as far as it goes', () => {
    const wav = riff(fmt(1, 1, 44100, 16), data([...le16(100), ...le16(200), ...le16(300)]));
    const cut = wav.subarray(0, wav.length - 1); // half of the last sample is missing
    expect(readWavInfo(cut)?.frames).toBe(3);
    expect(channelsOf(cut)).toEqual([[100 / 32768, 200 / 32768]]);
  });

  it('reads from a view into a larger buffer', () => {
    const wav = riff(fmt(1, 1, 44100, 16), data([...le16(16384)]));
    const big = new Uint8Array(wav.length + 7);
    big.set(wav, 7);
    expect(channelsOf(big.subarray(7))).toEqual([[0.5]]);
  });

  it('returns null for unsupported formats', () => {
    expect(decodeWav(riff(fmt(2, 1, 44100, 4), data([0, 0])))).toBeNull(); // ADPCM
    expect(decodeWav(riff(fmt(3, 1, 44100, 16), data([0, 0])))).toBeNull(); // 16-bit float
    expect(decodeWav(new Uint8Array(ascii('not a wav file')))).toBeNull();
  });
});
