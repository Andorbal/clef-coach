import { describe, expect, it } from 'vitest';
import type { SongDef } from '../music/parse';
import { parseSongDoc, songToDoc } from './format';
import { estimateKey } from './importkit';
import { importMidi, parseMidi } from './midi';
import type { ImportResult } from './importkit';

// ---------------------------------------------------------------------------
// Tiny Standard MIDI File writer
// ---------------------------------------------------------------------------

interface Ev {
  t: number;
  data: number[];
  /** Order of events at the same tick: offs before ons. */
  order: number;
}

const vlq = (n: number): number[] => {
  const out = [n & 0x7f];
  for (let v = n >> 7; v > 0; v >>= 7) out.unshift((v & 0x7f) | 0x80);
  return out;
};
const text = (s: string) => [...new TextEncoder().encode(s)];
const meta = (t: number, type: number, data: number[]): Ev => ({ t, data: [0xff, type, ...vlq(data.length), ...data], order: 0 });

const M = {
  name: (s: string, t = 0) => meta(t, 0x03, text(s)),
  tempo: (bpm: number, t = 0) => {
    const us = Math.round(60_000_000 / bpm);
    return meta(t, 0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]);
  },
  time: (n: number, d: number, t = 0) => meta(t, 0x58, [n, Math.log2(d), 24, 8]),
  key: (sf: number, minor = false, t = 0) => meta(t, 0x59, [sf & 0xff, minor ? 1 : 0]),
  program: (p: number, ch = 0, t = 0): Ev => ({ t, data: [0xc0 | ch, p], order: 1 }),
  /** A note: on at t, off at t + dur (note-off message). */
  note: (t: number, dur: number, key: number, ch = 0, vel = 80): Ev[] => [
    { t, data: [0x90 | ch, key, vel], order: 2 },
    { t: t + dur, data: [0x80 | ch, key, 0], order: 1 },
  ],
  chord: (t: number, dur: number, keys: number[], ch = 0) => keys.flatMap(k => M.note(t, dur, k, ch)),
};

function track(events: (Ev | Ev[])[]): number[] {
  const evs = events.flat().map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || a.order - b.order || a.i - b.i);
  const out: number[] = [];
  let last = 0;
  for (const e of evs) {
    out.push(...vlq(e.t - last), ...e.data);
    last = e.t;
  }
  out.push(0, 0xff, 0x2f, 0);
  return out;
}

function smf(format: number, ppq: number, tracks: number[][]): Uint8Array {
  const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const bytes = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, format, 0, tracks.length, (ppq >> 8) & 0xff, ppq & 0xff];
  for (const t of tracks) bytes.push(0x4d, 0x54, 0x72, 0x6b, ...u32(t.length), ...t);
  return new Uint8Array(bytes);
}

/** Every import must load in the app without errors. */
function check(r: ImportResult): SongDef {
  const parsed = parseSongDoc(songToDoc(r.song));
  expect(parsed.song.staves.length).toBe(r.song.staves.length);
  return r.song;
}

const NO_MIDI_EXTRAS = /don't hold fingering/;

// ---------------------------------------------------------------------------

describe('MIDI import: format 0 melody', () => {
  // ppq 96; 3/4 in F major; pickup quarter, a half note across the bar line, a chord, triplets
  const Q = 96;
  const bytes = smf(0, Q, [
    track([
      M.name('Waltz for Testing'),
      M.tempo(100),
      M.time(3, 4),
      M.key(-1),
      M.note(2 * Q, Q, 60), // pickup C4
      M.note(3 * Q, 2 * Q, 65), // F4 half
      M.note(5 * Q, 2 * Q, 69), // A4 half, crosses the bar line
      M.chord(7 * Q, Q, [65, 69, 72]), // [F4 A4 C5]
      M.note(8 * Q, Q, 70), // Bb4
      M.note(9 * Q, Q / 3, 72), // triplet C5 D5 C5
      M.note(9 * Q + Q / 3, Q / 3, 74),
      M.note(9 * Q + (2 * Q) / 3, Q / 3, 72),
      M.note(10 * Q, Q, 70), // Bb4
      M.note(11 * Q, Q, 69), // A4
      M.note(12 * Q, 3 * Q, 65), // F4 dotted half
    ]),
  ]);

  it('rebuilds pickup, ties across bar lines, chords and triplets', () => {
    const r = importMidi(bytes);
    const song = check(r);
    expect(song.title).toBe('Waltz for Testing');
    expect(song.instrument).toBe('piano');
    expect(song.key).toBe('F');
    expect(song.time).toEqual([3, 4]);
    expect(song.tempo).toBe(100);
    expect(song.pickup).toBe('q');
    expect(song.staves).toHaveLength(1);
    expect(song.staves[0]).toMatchObject({ clef: 'treble', hand: 'R' });
    expect(song.staves[0].voices).toEqual(['C4/q | F4/h A4/q~ | A4 [F4 A4 C5] Bb4 | C5/e3 D5 C5 Bb4/q A4 | F4/h. |']);
    expect(r.parts).toEqual([{ id: '0', name: 'Waltz for Testing', staves: 1 }]);
    expect(r.warnings.filter(x => NO_MIDI_EXTRAS.test(x))).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('MIDI import: piano', () => {
  it('uses two tracks as right and left hand, with a second voice for a held note', () => {
    const Q = 480;
    const bytes = smf(1, Q, [
      track([M.name('Two Hands'), M.tempo(90), M.time(4, 4), M.key(1)]),
      track([M.name('Piano RH'), M.program(0), M.note(0, Q, 67), M.note(Q, Q, 69), M.note(2 * Q, 2 * Q, 71), M.note(4 * Q, 4 * Q, 74), M.note(8 * Q, 2 * Q, 78), M.note(10 * Q, 2 * Q, 79)]),
      track([
        M.name('Piano LH'),
        M.program(0, 1),
        M.note(0, 4 * Q, 43, 1), // G2 held under moving quarters
        M.note(0, Q, 47, 1),
        M.note(Q, Q, 48, 1),
        M.note(2 * Q, Q, 50, 1),
        M.note(3 * Q, Q, 52, 1),
        M.chord(4 * Q, 4 * Q, [43, 47, 50], 1),
        M.note(8 * Q, 2 * Q, 50, 1),
        M.note(10 * Q, 2 * Q, 43, 1),
      ]),
    ]);
    const r = importMidi(bytes);
    const song = check(r);
    expect(song.title).toBe('Two Hands');
    expect(song.key).toBe('G');
    expect(song.tempo).toBe(90);
    expect(song.pickup).toBeUndefined();
    expect(r.parts).toEqual([{ id: '0', name: 'Piano RH', staves: 1 }, { id: '1', name: 'Piano LH', staves: 1 }]);
    expect(song.staves.map(s => [s.clef, s.hand])).toEqual([['treble', 'R'], ['bass', 'L']]);
    expect(song.staves[0].voices).toEqual(['G4/q A4 B4/h | D5/w | F#5/h G5 |']);
    expect(song.staves[1].voices).toEqual(['B2/q C3 D3 E3 | [G2 B2 D3]/w | D3/h G2 |', 'G2/w | r | r |']);
    expect(r.warnings).toEqual([expect.stringMatching(NO_MIDI_EXTRAS)]);
  });

  it('splits a single track around middle C without making a melody jump staves', () => {
    const Q = 96;
    const bytes = smf(0, Q, [
      track([
        M.time(4, 4),
        M.key(0),
        M.note(0, Q, 64), M.note(Q, Q, 62), M.note(2 * Q, Q, 60), M.note(3 * Q, Q, 59), // E4 D4 C4 B3
        M.note(0, 4 * Q, 48), // C3
        M.chord(4 * Q, 4 * Q, [48, 55, 60]), // C3 G3 | C4
      ]),
    ]);
    const song = check(importMidi(bytes));
    expect(song.staves.map(s => [s.clef, s.hand])).toEqual([['treble', 'R'], ['bass', 'L']]);
    expect(song.staves[0].voices).toEqual(['E4/q D4 C4 B3 | C4/w |']);
    expect(song.staves[1].voices).toEqual(['C3/w | [C3 G3] |']);
  });

  it('reads a type 0 file with the hands on two channels', () => {
    const bytes = smf(0, 96, [track([M.time(2, 4), M.key(0), M.note(0, 192, 72, 0), M.note(0, 192, 48, 1)])]);
    const r = importMidi(bytes);
    const song = check(r);
    expect(r.parts.map(p => p.name)).toEqual(['Track 1 (channel 1)', 'Track 1 (channel 2)']);
    expect(song.staves.map(s => s.voices[0])).toEqual(['C5/h |', 'C3/h |']);
  });
});

describe('MIDI import: reading the file', () => {
  it('handles running status, velocity-0 note-offs and sysex', () => {
    const body = [
      0x00, 0xff, 0x03, 4, ...text('Test'),
      0x00, 0xf0, 0x05, 0x7e, 0x7f, 0x09, 0x01, 0xf7,
      0x00, 0x90, 0x3c, 0x50,
      0x60, 0x3c, 0x00, // running status: note-on velocity 0 = off
      0x00, 0x3e, 0x50,
      0x60, 0x3e, 0x00,
      0x00, 0x40, 0x50,
      0x60, 0x80, 0x40, 0x00, // a real note-off
      0x00, 0x90, 0x41, 0x50,
      0x60, 0x41, 0x00,
      0x00, 0xff, 0x2f, 0x00,
    ];
    const r = importMidi(smf(0, 96, [body]));
    const song = check(r);
    expect(song.title).toBe('Test');
    expect(song.tempo).toBe(120);
    expect(song.time).toEqual([4, 4]);
    expect(song.staves[0].voices).toEqual(['C4/q D4 E4 F4 |']);
    expect(r.warnings).toEqual(expect.arrayContaining(['The file has no time signature; 4/4 was assumed.', expect.stringMatching(/no key signature/)]));
  });

  it('exposes the parsed file', () => {
    const f = parseMidi(smf(1, 240, [track([M.tempo(75), M.time(6, 8), M.key(-3, true)]), track([M.note(0, 240, 60)])]));
    expect(f.format).toBe(1);
    expect(f.ppq).toBe(240);
    expect(f.tempos).toEqual([{ tick: 0, bpm: 75 }]);
    expect(f.timeSigs).toEqual([{ tick: 0, time: [6, 8] }]);
    expect(f.keySigs).toEqual([{ tick: 0, key: { fifths: -3, mode: 'minor' } }]);
    expect(f.tracks[1].notes).toEqual([{ midi: 60, velocity: 80, channel: 0, start: 0, end: 240 }]);
  });

  it('rejects files that are not MIDI or have no notes', () => {
    expect(() => importMidi(new TextEncoder().encode('hello'))).toThrow(/isn't a MIDI file/);
    expect(() => importMidi(smf(1, 96, [track([M.tempo(100)])]))).toThrow(/no notes/);
  });
});

describe('MIDI import: keys and spelling', () => {
  it('estimates a missing key and spells from it', () => {
    const Q = 96;
    const scale = [62, 64, 66, 67, 69, 71, 73, 74];
    const r = importMidi(smf(0, Q, [track([M.time(4, 4), ...scale.map((k, i) => M.note(i * Q, Q, k))])]));
    const song = check(r);
    expect(song.key).toBe('D');
    expect(song.staves[0].voices).toEqual(['D4/q E4 F#4 G4 | A4 B4 C#5 D5 |']);
    expect(r.warnings).toContain('The file has no key signature; the key was estimated as D major.');
  });

  it('recognises a minor key by its leading note', () => {
    const Q = 96;
    const r = importMidi(smf(0, Q, [track([M.time(4, 4), M.note(0, Q, 57), M.note(Q, Q, 60), M.note(2 * Q, Q, 64), M.note(3 * Q, Q, 68), M.note(4 * Q, 4 * Q, 69)])]));
    const song = check(r);
    expect(song.key).toBe('Am');
    expect(song.staves[0].voices).toEqual(['A3/q C4 E4 G#4 | A4/w |']);
    expect(estimateKey([60, 64, 67, 60, 64, 67, 65, 62].map((midi, i) => ({ midi, start: i, end: i + 1 })))).toEqual({ fifths: 0, mode: 'major' });
  });

  it('spells chromatic notes from the key signature', () => {
    // in F major: Bb is in the key, the raised 4th is B natural, and Eb / Ab / Db read as flats
    const Q = 96;
    const r = importMidi(smf(0, Q, [track([M.time(4, 4), M.key(-1), ...[70, 71, 63, 68].map((k, i) => M.note(i * Q, Q, k)), M.note(4 * Q, 4 * Q, 61)])]));
    expect(check(r).staves[0].voices).toEqual(['Bb4/q B4 Eb4 Ab4 | Db4/w |']);
  });
});

describe('MIDI import: time', () => {
  it('reads a short opening bar as a pickup and marks time signature changes', () => {
    const Q = 96;
    const bytes = smf(0, Q, [track([M.time(1, 4), M.time(4, 4, Q), M.time(3, 4, 5 * Q), M.key(0), M.note(0, Q, 67), M.note(Q, 4 * Q, 72), M.note(5 * Q, 3 * Q, 74), M.note(8 * Q, 3 * Q, 76)])]);
    const song = check(importMidi(bytes));
    expect(song.time).toEqual([4, 4]);
    expect(song.pickup).toBe('q');
    expect(song.staves[0].voices).toEqual(['G4/q | C5/w | [T:3/4] D5/h. | E5 |']);
  });

  it('quantises loose timing and closes small gaps', () => {
    const Q = 480;
    const bytes = smf(0, Q, [track([M.time(4, 4), M.key(0), M.note(10, 430, 60), M.note(475, 425, 62), M.note(965, 885, 64), M.note(1935, 1865, 67)])]);
    expect(check(importMidi(bytes)).staves[0].voices).toEqual(['C4/q D4 E4/h | G4/w |']);
  });

  it('quantises to eighths or sixteenths on request', () => {
    const Q = 96;
    // a dotted-eighth / sixteenth figure played a little straight
    const bytes = smf(0, Q, [track([M.time(2, 4), M.key(0), M.note(0, 60, 60), M.note(60, 36, 62), M.note(Q, Q, 64)])]);
    expect(check(importMidi(bytes, { quantize: 's' })).staves[0].voices).toEqual(['C4/e. D4/s E4/q |']);
    expect(check(importMidi(bytes, { quantize: 'e' })).staves[0].voices).toEqual(['C4/e D4 E4/q |']);
  });

  it('leaves out grace notes played just before the beat', () => {
    const Q = 480;
    // a 30-tick grace note just before beat 2, then a quarter on the beat
    const bytes = smf(0, Q, [track([M.time(2, 4), M.key(0), M.note(0, Q, 60), M.note(Q - 30, 30, 61), M.note(Q, Q, 62)])]);
    const r = importMidi(bytes);
    expect(check(r).staves[0].voices).toEqual(['C4/q D4 |']);
    expect(r.warnings).toContain('1 very short note (grace notes or ornaments) was left out.');
  });

  it('removes empty bars at the start', () => {
    const bytes = smf(0, 96, [track([M.time(4, 4), M.key(0), M.note(2 * 384, 384, 60)])]);
    const r = importMidi(bytes);
    expect(check(r).staves[0].voices).toEqual(['C4/w |']);
    expect(r.warnings).toContain('2 empty bars at the start were removed.');
  });
});

describe('MIDI import: tracks and instruments', () => {
  const Q = 96;
  const bytes = smf(1, Q, [
    track([M.name('Band'), M.tempo(110), M.time(4, 4), M.key(0)]),
    track([M.name('Melody'), M.program(73), M.note(0, 2 * Q, 72), M.note(2 * Q, 2 * Q, 74)]),
    track([M.name('Drums'), M.note(0, Q, 36, 9), M.note(Q, Q, 38, 9)]),
    track([M.name('Bass'), M.program(33, 2), M.note(0, 4 * Q, 40, 2)]),
  ]);

  it('lists the pitched tracks, imports the first and keeps the others and the drums as the band', () => {
    const r = importMidi(bytes);
    const song = check(r);
    expect(r.parts).toEqual([{ id: '0', name: 'Melody', staves: 1 }, { id: '1', name: 'Bass', staves: 1 }]);
    expect(song.instrument).toBe('piano');
    expect(song.staves[0].voices).toEqual(['C5/h D5 |']);
    expect(song.band).toEqual([
      { name: 'Bass', program: 34, staves: [{ clef: 'bass8vb', voices: ['E2/w |'] }] },
      // each hit lasts until the next one, at most a beat
      { name: 'Drums', program: 1, drums: true, staves: [{ clef: 'bass', voices: ['kick/q snare r/h |'] }] },
    ]);
    expect(r.warnings[0]).toBe('Imported "Melody"; the other 2 tracks ("Bass" and "Drums") play as the band.');
    expect(r.warnings.join(' ')).not.toMatch(/left out|choose others/);
  });

  it('leaves the other tracks and the drums out on request, exactly as before', () => {
    const r = importMidi(bytes, { band: false });
    expect(r.song.band).toBeUndefined();
    expect(r.song.staves).toEqual(importMidi(bytes).song.staves);
    expect(r.warnings).toEqual(expect.arrayContaining([
      '2 drum notes (MIDI channel 10) were left out.',
      'Imported "Melody"; the file has 2 tracks – choose others to import them instead.',
    ]));
    expect(importMidi(bytes, { tracks: [1], band: false }).song.band).toBeUndefined();
  });

  it('imports a chosen bass track on a bass 8vb staff', () => {
    const song = check(importMidi(bytes, { tracks: [1] }));
    expect(song.instrument).toBe('bass');
    expect(song.staves).toEqual([{ clef: 'bass8vb', voices: ['E2/w |'] }]);
  });

  it('writes guitar on one treble 8vb staff, with a held bass note as a second voice', () => {
    const g = smf(1, Q, [track([M.time(4, 4), M.key(1)]), track([M.program(24), M.note(0, 4 * Q, 40), ...[55, 59, 64, 59].map((k, i) => M.note(i * Q, Q, k))])]);
    const r = importMidi(g);
    const song = check(r);
    expect(song.instrument).toBe('guitar');
    expect(r.parts[0].name).toBe('Track 2 (Guitar)');
    expect(song.staves).toEqual([{ clef: 'treble8vb', voices: ['G3/q B3 E4 B3 |', 'E2/w |'] }]);
  });

  it('follows the requested instrument', () => {
    const song = check(importMidi(bytes, { tracks: [0], instrument: 'ukulele' }));
    expect(song.instrument).toBe('ukulele');
    expect(song.staves[0].clef).toBe('treble');
    expect(() => importMidi(bytes, { tracks: [7] })).toThrow(/None of the requested tracks/);
  });
});

describe('MIDI import: the band', () => {
  const Q = 96;
  const bar = 3 * Q;
  // 3/4 with a quarter-note pickup in the melody; the band comes in on the downbeat
  const bytes = smf(1, Q, [
    track([M.name('Waltz'), M.tempo(120), M.time(3, 4), M.key(0)]),
    track([M.name('Melody'), M.program(73), M.note(2 * Q, Q, 67), M.note(bar, 2 * Q, 72), M.note(bar + 2 * Q, Q, 74), M.note(2 * bar, bar, 76)]),
    track([
      M.name('Kit'),
      M.program(32, 9), // the jazz kit
      ...[0, 1, 2].flatMap(b => [M.note(bar + b * bar, 10, 36, 9), M.note(bar + b * bar + Q, 10, 38, 9), M.note(bar + b * bar + 2 * Q, 10, 38, 9)]),
      ...Array.from({ length: 12 }, (_, i) => M.note(bar + (i * Q) / 2, 10, 42, 9)),
    ]),
    track([M.name('Bass'), M.program(33, 2), M.note(bar, bar, 36, 2), M.note(2 * bar, bar, 43, 2)]),
    track([
      M.name('Piano comp'),
      M.program(0, 3),
      ...[1, 2].flatMap(b => [M.note(b * bar, bar, 36, 3), M.chord(b * bar + Q, 2 * Q, [60, 64, 67], 3), M.chord(b * bar + Q, 2 * Q, [72, 76], 3)]),
    ]),
  ]);

  it('keeps every other track with its sound, and the chosen part as it was', () => {
    const r = importMidi(bytes, { tracks: [0] });
    const song = check(r);
    expect(song.pickup).toBe('q');
    expect(song.staves).toEqual(importMidi(bytes, { tracks: [0], band: false }).song.staves);
    expect(song.band?.map(p => [p.name, p.program, !!p.drums])).toEqual([['Bass', 34, false], ['Piano comp', 1, false], ['Kit', 33, true]]);
    const [bass, comp, kit] = song.band!;
    expect(bass.staves).toEqual([{ clef: 'bass8vb', voices: ['r/q | C2/h. | G2 |'] }]);
    // a wide part playing chords gets two staves
    expect(comp.staves.map(s => s.clef)).toEqual(['treble', 'bass']);
    expect(comp.staves[0].voices).toEqual(['r/q | r [E4 G4 C5 E5]/h | r/q [E4 G4 C5 E5]/h |']);
    expect(comp.staves[1].voices).toEqual(['r/q | r C4/h | r/q C4/h |', 'r/q | C2/h. | C2 |']);
    expect(kit.staves[0].voices).toEqual(['r/q | [kick hat]/e hat [snare hat] hat [snare hat] hat | [kick hat] hat [snare hat] hat [snare hat] hat |']);
    expect(r.warnings[0]).toBe('Imported "Melody"; the other 3 tracks ("Bass", "Piano comp" and "Kit") play as the band.');
  });

  it('says which band notes fall outside the imported part', () => {
    // the bar of drums before the pickup has no place in the song
    const r = importMidi(bytes, { tracks: [1] });
    expect(check(r).instrument).toBe('bass');
    expect(r.song.band?.map(p => p.name)).toEqual(['Melody', 'Piano comp', 'Kit']);
    expect(r.warnings).toContain('Imported "Bass"; the other 3 tracks ("Melody", "Piano comp" and "Kit") play as the band.');
    const early = importMidi(smf(1, Q, [
      track([M.time(4, 4), M.key(0)]),
      track([M.name('Lead'), M.note(4 * Q, 4 * Q, 72)]),
      track([M.name('Drums'), M.note(0, 10, 49, 9), M.note(4 * Q, 10, 49, 9)]),
    ]));
    expect(check(early).band?.[0].staves[0].voices).toEqual(['crash/q r/h. |']);
    expect(early.warnings).toContain("1 band note before the imported part's first bar or after its last was left out.");
  });

  it('survives writing the song out and reading it back', () => {
    const { song } = importMidi(bytes, { tracks: [0] });
    const again = parseSongDoc(songToDoc(song));
    expect(again.warnings).toEqual([]);
    expect(again.song.band).toEqual(song.band);
  });

  it('keeps at most 16 band parts, leaving out the emptiest', () => {
    const others = Array.from({ length: 17 }, (_, i) => track([M.name(i === 5 ? 'Thin' : `Part ${i + 1}`), M.program(40 + (i % 8), i % 9), M.note(0, Q, 60 + i, i % 9), ...(i === 5 ? [] : [M.note(Q, Q, 60 + i, i % 9)])]));
    const r = importMidi(smf(1, Q, [track([M.time(2, 4), M.key(0)]), track([M.name('Lead'), M.program(73), M.note(0, 2 * Q, 72)]), ...others]), { tracks: [0] });
    check(r);
    expect(r.song.band).toHaveLength(16);
    expect(r.song.band?.map(p => p.name)).not.toContain('Thin');
    expect(r.warnings).toContain('1 track ("Thin") was left out: a song keeps at most 16 band parts.');
  });
});

describe('MIDI import: real files', () => {
  const Q = 96;
  const bar = 4 * Q;

  it('takes every keyboard track, each to the hand its name says', () => {
    const bytes = smf(1, Q, [
      track([M.time(4, 4), M.key(0), M.tempo(90)]),
      track([M.name('Right Voice 1'), ...[0, 1, 2, 3].map(i => M.note(i * Q, Q, [72, 74, 76, 77][i]))]),
      track([M.name('Right Voice 2'), M.note(0, bar, 64)]),
      track([M.name('Left Voice 1'), M.note(0, bar, 48)]),
    ]);
    const r = importMidi(bytes);
    const song = check(r);
    expect(song.staves.map(s => s.hand)).toEqual(['R', 'L']);
    expect(song.staves[0].voices).toEqual(['C5/q D5 E5 F5 |', 'E4/w |']);
    expect(song.staves[1].voices).toEqual(['C3/w |']);
    expect(r.warnings.join(' ')).not.toMatch(/choose others/);
  });

  it('takes a lead-in that starts off the beat as a pickup', () => {
    const E = Q / 2;
    const bytes = smf(0, Q, [track([M.time(4, 4), M.key(1), ...[0, 1, 2].map(i => M.note(5 * E + i * E, E, [67, 69, 71][i])), M.note(bar, bar, 72)])]);
    const song = check(importMidi(bytes));
    expect(song.pickup).toBe('q.');
    expect(song.staves[0].voices[0]).toBe('G4/e A4 B4 | C5/w |');
  });

  it('works out chord symbols from a chord track', () => {
    const bytes = smf(1, Q, [
      track([M.time(3, 4), M.key(1)]),
      track([M.name('Melody'), ...[0, 1, 2, 3, 4, 5].map(i => M.note(i * Q, Q, [67, 71, 74, 72, 69, 66][i]))]),
      track([M.name('Chords'), M.chord(0, 3 * Q, [43, 47, 50]), M.chord(3 * Q, 3 * Q, [38, 42, 45, 48])]),
    ]);
    const r = importMidi(bytes, { instrument: 'guitar' });
    const song = check(r);
    expect(song.chords).toBe('G/h. | D7/h. |');
    expect(r.warnings.join(' ')).toMatch(/Chord symbols were worked out/);
  });

  it('names chords by their bass, with inversions as slash chords', async () => {
    const { chordSymbolFor } = await import('./midi');
    expect(chordSymbolFor([48, 52, 55], { fifths: 0, mode: 'major' })).toBe('C');
    expect(chordSymbolFor([52, 55, 60], { fifths: 0, mode: 'major' })).toBe('C/E');
    expect(chordSymbolFor([57, 60, 64, 67], { fifths: 0, mode: 'major' })).toBe('Am7');
    expect(chordSymbolFor([50, 54, 60], { fifths: 1, mode: 'major' })).toBe('D7');
    expect(chordSymbolFor([59, 62, 65], { fifths: 0, mode: 'major' })).toBe('Bdim');
    expect(chordSymbolFor([60, 64], { fifths: 0, mode: 'major' })).toBeNull();
  });

  it('says when a file is a recording of someone playing rather than a sequenced score', () => {
    // onsets drifting freely against the beat
    const notes = Array.from({ length: 40 }, (_, i) => M.note(Math.round(i * Q * 0.537 + 7), Math.round(Q * 0.45), 60 + (i % 12)));
    const r = importMidi(smf(0, Q, [track([M.time(4, 4), M.key(0), ...notes])]));
    check(r);
    expect(r.warnings.join(' ')).toMatch(/recording of someone playing/);
    const steady = importMidi(smf(0, Q, [track([M.time(4, 4), M.key(0), ...Array.from({ length: 40 }, (_, i) => M.note(i * Q, Q, 60 + (i % 12)))])]));
    expect(steady.warnings.join(' ')).not.toMatch(/recording of someone playing/);
  });

  it('keeps the tempo most of the music is played at', () => {
    const bytes = smf(0, Q, [track([M.time(4, 4), M.key(0), M.tempo(60), M.tempo(100, Q), M.tempo(70, 15 * Q), ...Array.from({ length: 16 }, (_, i) => M.note(i * Q, Q, 60))])]);
    const r = importMidi(bytes);
    expect(check(r).tempo).toBe(100);
    expect(r.warnings.join(' ')).toMatch(/keeps one tempo \(100\)/);
  });

  it('accepts long cadenza bars', () => {
    const bytes = smf(0, Q, [track([M.time(4, 4), M.time(44, 32, bar), M.time(4, 4, bar + 44 * (Q / 8)), ...Array.from({ length: 14 }, (_, i) => M.note(i * Q, Q, 60 + i))])]);
    const r = importMidi(bytes);
    check(r);
    expect(r.warnings.join(' ')).not.toMatch(/isn't supported/);
  });
});
