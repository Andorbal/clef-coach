/**
 * WAV reading for sample banks: the header (format, length, where the PCM starts), the
 * loop points and root key samplers write into the 'smpl' chunk, and a PCM decoder.
 *
 * Decoding here rather than with decodeAudioData keeps the recorded sample rate, so loop
 * points in frames stay exact, and works without an AudioContext (in a worker, in tests).
 * RF64 (WAVs over 4 GB) and compressed WAV formats (ADPCM, µ-law…) are not supported.
 */

export interface WavInfo {
  /** 1 = integer PCM, 3 = IEEE float; WAVE_FORMAT_EXTENSIBLE is resolved to its sub-format. */
  format: number;
  channels: number;
  sampleRate: number;
  /** Bits per sample as stored (a 24-in-32 extensible file says 32). */
  bitsPerSample: number;
  /** Length in frames, from the data chunk's size. */
  frames: number;
  /** Byte offset of the first frame. */
  dataOffset: number;
  /**
   * Loops from the smpl chunk, in frames. The WAV spec's loop end (dwEnd) is the last frame
   * played, inclusive; `end` here is exclusive (dwEnd + 1), like every other end in the player.
   */
  loops: { start: number; end: number }[];
  /** MIDI unity note from the smpl chunk */
  unityNote?: number;
  /** Cents above `unityNote` the sample sounds (the smpl chunk's dwMIDIPitchFraction). */
  pitchFraction?: number;
}

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_IEEE_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const fourCC = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
/** Printable ASCII, as every chunk id is. */
const looksLikeChunkId = (b: Uint8Array, at: number) => at + 4 <= b.length && [0, 1, 2, 3].every(i => b[at + i] >= 0x20 && b[at + i] <= 0x7e);

function scanWav(bytes: Uint8Array): (WavInfo & { blockAlign: number }) | null {
  if (bytes.length < 12 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WAVE') return null;
  let fmt: { format: number; channels: number; sampleRate: number; blockAlign: number; bits: number } | null = null;
  let dataOffset = -1;
  let dataSize = 0;
  const loops: WavInfo['loops'] = [];
  let unityNote: number | undefined;
  let pitchFraction: number | undefined;

  for (let p = 12; p + 8 <= bytes.length; ) {
    const id = fourCC(bytes, p);
    const size = u32(bytes, p + 4);
    const body = p + 8;
    if (id === 'fmt ' && size >= 16 && body + 16 <= bytes.length) {
      let format = u16(bytes, body);
      // WAVE_FORMAT_EXTENSIBLE: the real format code is the first two bytes of the sub-format GUID
      if (format === WAVE_FORMAT_EXTENSIBLE && size >= 40 && body + 26 <= bytes.length) format = u16(bytes, body + 24);
      fmt = { format, channels: u16(bytes, body + 2), sampleRate: u32(bytes, body + 4), blockAlign: u16(bytes, body + 12), bits: u16(bytes, body + 14) };
    } else if (id === 'data' && dataOffset < 0) {
      dataOffset = body;
      // 0xFFFFFFFF: a writer that streamed the file and never came back to fill in the size
      dataSize = size === 0xffffffff ? bytes.length - body : size;
    } else if (id === 'smpl' && size >= 36 && body + 36 <= bytes.length) {
      unityNote = u32(bytes, body + 12);
      // a fraction of a semitone, 0x80000000 = 50 cents
      pitchFraction = (u32(bytes, body + 16) / 2 ** 32) * 100;
      const count = u32(bytes, body + 28);
      for (let i = 0; i < count; i++) {
        const at = body + 36 + i * 24;
        if (at + 24 > body + size || at + 24 > bytes.length) break;
        loops.push({ start: u32(bytes, at + 8), end: u32(bytes, at + 12) + 1 });
      }
    }
    // chunks are padded to an even length; some writers forget the pad byte, so trust the
    // unpadded position when only it starts something that looks like a chunk
    let next = body + size + (size & 1);
    if (size & 1 && !looksLikeChunkId(bytes, next) && looksLikeChunkId(bytes, next - 1)) next--;
    p = next;
  }
  if (!fmt || dataOffset < 0 || fmt.channels < 1) return null;
  const blockAlign = fmt.blockAlign || fmt.channels * Math.ceil(fmt.bits / 8);
  return {
    format: fmt.format,
    channels: fmt.channels,
    sampleRate: fmt.sampleRate,
    bitsPerSample: fmt.bits,
    frames: blockAlign ? Math.floor(dataSize / blockAlign) : 0,
    dataOffset,
    loops,
    ...(unityNote !== undefined && { unityNote, pitchFraction }),
    blockAlign,
  };
}

/**
 * Read a WAV (RIFF/WAVE) header: the fmt, data and smpl chunks. A prefix of the file is
 * enough as long as it reaches the data chunk's header; a smpl chunk written after the
 * audio is only seen when the whole file is passed. null if this isn't a WAV.
 */
export function readWavInfo(bytes: Uint8Array): WavInfo | null {
  const info = scanWav(bytes);
  if (!info) return null;
  const { blockAlign: _, ...rest } = info;
  return rest;
}

/**
 * Decode a PCM WAV (8/16/24/32-bit integer, 32/64-bit float, plain or WAVE_FORMAT_EXTENSIBLE)
 * to one Float32Array per channel at the recorded rate. null if the format isn't supported.
 * A truncated file decodes as far as it goes.
 */
export function decodeWav(bytes: Uint8Array): { sampleRate: number; channels: Float32Array<ArrayBuffer>[] } | null {
  const w = scanWav(bytes);
  if (!w || !w.blockAlign) return null;
  // bytes per sample from the block size, so 24-bit samples in 32-bit containers read right
  const width = Math.floor(w.blockAlign / w.channels);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let read: (at: number) => number;
  if (w.format === WAVE_FORMAT_PCM) {
    if (width === 1) read = at => (bytes[at] - 128) / 128; // 8-bit WAV is unsigned
    else if (width === 2) read = at => view.getInt16(at, true) / 0x8000;
    else if (width === 3) read = at => (((bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) << 8) >> 8) / 0x800000;
    else if (width === 4) read = at => view.getInt32(at, true) / 0x80000000;
    else return null;
  } else if (w.format === WAVE_FORMAT_IEEE_FLOAT) {
    if (width === 4) read = at => view.getFloat32(at, true);
    else if (width === 8) read = at => view.getFloat64(at, true);
    else return null;
  } else {
    return null;
  }
  const frames = Math.max(0, Math.min(w.frames, Math.floor((bytes.length - w.dataOffset) / w.blockAlign)));
  const channels = Array.from({ length: w.channels }, () => new Float32Array(frames));
  for (let f = 0, at = w.dataOffset; f < frames; f++, at += w.blockAlign) {
    for (let c = 0; c < w.channels; c++) channels[c][f] = read(at + c * width);
  }
  return { sampleRate: w.sampleRate, channels };
}
