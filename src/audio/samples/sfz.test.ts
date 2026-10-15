import { describe, expect, it } from 'vitest';
import { parseSfz, parseSfzBank, resolveSfzPath, SFZ_DEFAULT_ENVELOPE, sfzKey } from './sfz';
import { BankFormatError } from './types';

/** A bank as a path → text map. */
const files = (map: Record<string, string>) => async (path: string) => map[path] ?? null;
const parse = (text: string, extra: Record<string, string> = {}, path = 'piano.sfz') => parseSfz(text, path, files(extra));
/** The single region of a one-region file. */
const one = async (text: string) => {
  const { regions } = await parse(text);
  expect(regions).toHaveLength(1);
  return regions[0];
};

describe('sfzKey', () => {
  it('reads note names with middle C at c4 = 60', () => {
    expect(sfzKey('c4')).toBe(60);
    expect(sfzKey('C4')).toBe(60);
    expect(sfzKey('c#4')).toBe(61);
    expect(sfzKey('db4')).toBe(61);
    expect(sfzKey('Bb3')).toBe(58);
    expect(sfzKey('b3')).toBe(59);
    expect(sfzKey('a0')).toBe(21);
    expect(sfzKey('c-1')).toBe(0);
    expect(sfzKey('g9')).toBe(127);
  });

  it('reads MIDI numbers', () => {
    expect(sfzKey('60')).toBe(60);
    expect(sfzKey(' 0 ')).toBe(0);
    expect(sfzKey('-1')).toBe(-1);
  });

  it('applies octave_offset and note_offset', () => {
    expect(sfzKey('c4', 1)).toBe(72);
    expect(sfzKey('60', -1, 2)).toBe(50);
  });

  it('rejects what is not a note', () => {
    expect(sfzKey('')).toBeNull();
    expect(sfzKey('h4')).toBeNull();
    expect(sfzKey('c')).toBeNull();
    expect(sfzKey('60.5')).toBeNull();
  });
});

describe('resolveSfzPath', () => {
  it('starts from the .sfz file folder and default_path', () => {
    expect(resolveSfzPath('Piano/piano.sfz', '', 'C4.wav')).toBe('Piano/C4.wav');
    expect(resolveSfzPath('Piano/piano.sfz', 'samples/', 'C4.wav')).toBe('Piano/samples/C4.wav');
    expect(resolveSfzPath('piano.sfz', '', 'C4.wav')).toBe('C4.wav');
  });

  it('turns backslashes into slashes and resolves . and ..', () => {
    expect(resolveSfzPath('Bank/Programs/piano.sfz', '..\\Samples\\', '.\\soft\\..\\loud\\C4 v1.wav')).toBe('Bank/Samples/loud/C4 v1.wav');
    expect(resolveSfzPath('a//b/./x.sfz', '', 'y.wav')).toBe('a/b/y.wav');
  });

  it('never climbs above the bank root', () => {
    expect(resolveSfzPath('piano.sfz', '', '../../C4.wav')).toBe('C4.wav');
  });

  it('reads absolute paths from the bank root', () => {
    expect(resolveSfzPath('Piano/piano.sfz', '', 'C:\\Samples\\C4.wav')).toBe('Samples/C4.wav');
    expect(resolveSfzPath('Piano/piano.sfz', '', '/Samples/C4.wav')).toBe('Samples/C4.wav');
  });
});

describe('parseSfz: structure', () => {
  it('gives a region the spec defaults', async () => {
    const r = await one('<region> sample=a.wav');
    expect(r).toEqual({
      samplePath: 'a.wav',
      loKey: 0,
      hiKey: 127,
      loVel: 0,
      hiVel: 127,
      rootKey: 60,
      tune: 0,
      keyTrack: 100,
      offset: 0,
      loop: 'none',
      // no loop_mode: the sample file's own loop decides, when the player reads it
      loopFromSample: true,
      volume: 0,
      pan: 0,
      velTrack: 1,
      amp: SFZ_DEFAULT_ENVELOPE,
      trigger: 'attack',
    });
    expect(SFZ_DEFAULT_ENVELOPE.release).toBe(0.03);
  });

  it('inherits opcodes global → master → group → region, the nearest winning', async () => {
    const { regions } = await parse(`
      <global> volume=-6 pan=-50 ampeg_release=2
      <master> volume=-3
      <group> pan=25 lokey=10
      <region> sample=a.wav
      <region> sample=b.wav volume=1 lokey=20
    `);
    expect(regions.map(r => [r.samplePath, r.volume, r.pan, r.loKey, r.amp.release])).toEqual([
      ['a.wav', -3, 0.25, 10, 2],
      ['b.wav', 1, 0.25, 20, 2],
    ]);
  });

  it('resets group opcodes at each <group> and <master>, and everything at <global>', async () => {
    const { regions } = await parse(`
      <global> tune=5
      <master> volume=-6
      <group> pan=100
      <region> sample=1.wav
      <group> hikey=50
      <region> sample=2.wav
      <master> transpose=1
      <region> sample=3.wav
      <global>
      <region> sample=4.wav
    `);
    expect(regions.map(r => [r.samplePath, r.tune, r.volume, r.pan, r.hiKey])).toEqual([
      ['1.wav', 5, -6, 1, 127],
      ['2.wav', 5, -6, 0, 50],
      ['3.wav', 105, 0, 0, 127],
      ['4.wav', 0, 0, 0, 127],
    ]);
  });

  it('applies opcodes in order, so key and lokey can override each other', async () => {
    const { regions } = await parse(`
      <group> key=60
      <region> sample=a.wav lokey=55
      <region> lokey=55 key=62 sample=b.wav
    `);
    expect(regions.map(r => [r.loKey, r.hiKey, r.rootKey])).toEqual([
      [55, 60, 60],
      [62, 62, 62],
    ]);
  });

  it('strips // and /* */ comments', async () => {
    const { regions } = await parse(`
      // <region> sample=commented.wav
      <region> sample=a.wav // lokey=99
      /* <region> sample=b.wav
         <region> sample=c.wav */ <region> sample=d.wav hikey=70 /* inline */ lokey=65
    `);
    expect(regions.map(r => [r.samplePath, r.loKey, r.hiKey])).toEqual([
      ['a.wav', 0, 127],
      ['d.wav', 65, 70],
    ]);
  });

  it('reads several headers and opcodes on one line, and opcodes over several lines', async () => {
    const { regions } = await parse('<group>lokey=40<region>sample=a.wav hikey=41<region>\nsample=b.wav\nhikey=42');
    expect(regions.map(r => [r.samplePath, r.loKey, r.hiKey])).toEqual([
      ['a.wav', 40, 41],
      ['b.wav', 40, 42],
    ]);
  });
});

describe('parseSfz: sample paths', () => {
  it('reads file names with spaces up to the next opcode, header or line end', async () => {
    const { regions } = await parse(
      [
        '<region> sample=Grand Piano C4 soft.wav lokey=60',
        '<region> sample=My Samples/D4 (loud).wav<region> sample=E4 v1.wav   ',
        '<region> sample=F4.wav\tkey=65',
      ].join('\n'),
      {},
      'Piano/grand.sfz',
    );
    expect(regions.map(r => r.samplePath)).toEqual(['Piano/Grand Piano C4 soft.wav', 'Piano/My Samples/D4 (loud).wav', 'Piano/E4 v1.wav', 'Piano/F4.wav']);
    expect(regions[0].loKey).toBe(60);
    expect(regions[3].rootKey).toBe(65);
  });

  it('applies backslashes, default_path and .. relative to the .sfz file', async () => {
    const { regions } = await parse(
      `
      <control> default_path=..\\Samples\\Soft Layer\\
      <region> sample=C4 vl1.wav
      <region> sample=..\\Loud\\C4.wav
      <control>
      <region> sample=bare.wav
    `,
      {},
      'Bank/Programs/piano.sfz',
    );
    // a new <control> starts a fresh default_path (as sfizz does)
    expect(regions.map(r => r.samplePath)).toEqual(['Bank/Samples/Soft Layer/C4 vl1.wav', 'Bank/Samples/Loud/C4.wav', 'Bank/Programs/bare.wav']);
  });
});

describe('parseSfz: #define and #include', () => {
  it('substitutes #define variables, longest name first', async () => {
    const { regions } = await parse(`
      #define $KEY 62
      #define $VOL -4.5
      #define $VELOCITY 90
      #define $VEL 1
      #define $DIR Soft Samples
      <region> sample=$DIR/a.wav key=$KEY volume=$VOL hivel=$VELOCITY lovel=$VEL2
    `);
    expect(regions[0]).toMatchObject({ samplePath: 'Soft Samples/a.wav', loKey: 62, rootKey: 62, volume: -4.5, loVel: 12, hiVel: 90 });
  });

  it('pastes #include files in place, defines carrying across', async () => {
    const { regions, warnings } = await parse(
      `
      #define $LO 30
      <group> volume=-2
      #include "inc/regions.sfzh"
      <region> sample=after.wav
    `,
      { 'Lib/inc/regions.sfzh': '<region> sample=inc.wav lokey=$LO\n#define $HI 40' },
      'Lib/main.sfz',
    );
    expect(regions.map(r => [r.samplePath, r.loKey, r.volume])).toEqual([
      ['Lib/inc.wav', 30, -2],
      ['Lib/after.wav', 0, -2],
    ]);
    expect(warnings).toEqual([]);
  });

  it('reads includes from the main file folder, then from the including file', async () => {
    const { regions } = await parse('#include "inc/a.sfzh"', {
      'inc/a.sfzh': '<region> sample=a.wav\n#include "b.sfzh"\n#include "inc/c.sfzh"',
      'inc/b.sfzh': '<region> sample=b.wav',
      'inc/c.sfzh': '<region> sample=c.wav',
    });
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav', 'b.wav', 'c.wav']);
  });

  it('warns about a missing include and carries on', async () => {
    const { regions, warnings } = await parse('#include "missing.sfz"\n<region> sample=a.wav');
    expect(regions).toHaveLength(1);
    expect(warnings).toEqual(['The included file "missing.sfz" wasn\'t found.']);
  });

  it('stops an include loop', async () => {
    const { regions, warnings } = await parse('#include "a.sfzh"\n<region> sample=main.wav', {
      'a.sfzh': '<region> sample=a.wav\n#include "b.sfzh"',
      'b.sfzh': '<region> sample=b.wav\n#include "a.sfzh"',
    });
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav', 'b.wav', 'main.wav']);
    expect(warnings).toEqual(['"a.sfzh" includes itself; the repeat was skipped.']);
  });
});

describe('parseSfz: keys and velocities', () => {
  it('reads note names and MIDI numbers', async () => {
    const { regions } = await parse(`
      <region> sample=a.wav lokey=c#3 hikey=Eb3 pitch_keycenter=d3 lovel=1 hivel=63
      <region> sample=b.wav key=a0
    `);
    expect(regions[0]).toMatchObject({ loKey: 49, hiKey: 51, rootKey: 50, loVel: 1, hiVel: 63 });
    expect(regions[1]).toMatchObject({ loKey: 21, hiKey: 21, rootKey: 21 });
  });

  it('shifts every key by octave_offset and note_offset', async () => {
    const { regions } = await parse(`
      <control> octave_offset=1 note_offset=-2
      <region> sample=a.wav lokey=c3 hikey=48 pitch_keycenter=c3
      <region> sample=b.wav key=c3
      <region> sample=c.wav
    `);
    expect(regions.map(r => [r.loKey, r.hiKey, r.rootKey])).toEqual([
      [58, 58, 58],
      [58, 58, 58],
      [0, 127, 70],
    ]);
  });

  it('warns that pitch_keycenter=sample is read as middle C', async () => {
    const { regions, warnings } = await parse('<region> sample=a.wav pitch_keycenter=sample');
    expect(regions[0].rootKey).toBe(60);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('pitch_keycenter=sample');
  });
});

describe('parseSfz: units', () => {
  it('combines tune (cents) and transpose (semitones)', async () => {
    expect((await one('<region> sample=a.wav tune=-12 transpose=2')).tune).toBe(188);
    expect((await one('<region> sample=a.wav pitch=7')).tune).toBe(7);
    expect((await one('<region> sample=a.wav pitch_keytrack=0')).keyTrack).toBe(0);
  });

  it('combines volume, the group/master/global volumes and amplitude into dB', async () => {
    const r = await one('<global> global_volume=-1 global_amplitude=50 <master> master_volume=-2 <group> group_volume=-3 <region> sample=a.wav volume=2 amplitude=50');
    expect(r.volume).toBeCloseTo(2 - 1 - 2 - 3 + 20 * Math.log10(0.25), 6);
    expect((await one('<region> sample=a.wav amplitude=100')).volume).toBe(0);
  });

  it('drops a region at amplitude 0', async () => {
    const { regions } = await parse('<region> sample=a.wav amplitude=0 <region> sample=b.wav');
    expect(regions.map(r => r.samplePath)).toEqual(['b.wav']);
  });

  it('scales pan and amp_veltrack from percent', async () => {
    const r = await one('<region> sample=a.wav pan=-40 amp_veltrack=25');
    expect(r.pan).toBe(-0.4);
    expect(r.velTrack).toBe(0.25);
    const wild = await one('<region> sample=a.wav pan=300 amp_veltrack=-100');
    expect(wild.pan).toBe(1);
    expect(wild.velTrack).toBe(0);
  });

  it('reads the amp envelope in seconds and sustain in percent', async () => {
    const r = await one('<region> sample=a.wav ampeg_delay=0.1 ampeg_attack=0.2 ampeg_hold=0.3 ampeg_decay=1.5 ampeg_sustain=40 ampeg_release=0.8');
    expect(r.amp).toEqual({ delay: 0.1, attack: 0.2, hold: 0.3, decay: 1.5, sustain: 0.4, release: 0.8 });
  });

  it('reads offset and makes the inclusive end exclusive', async () => {
    const r = await one('<region> sample=a.wav offset=100 end=44099');
    expect(r.offset).toBe(100);
    expect(r.end).toBe(44100);
  });

  it('drops silent regions (end=0, end=-1)', async () => {
    const { regions, warnings } = await parse('<region> sample=a.wav end=0 <region> sample=b.wav end=-1 <region> sample=c.wav');
    expect(regions.map(r => r.samplePath)).toEqual(['c.wav']);
    expect(warnings).toEqual([]);
  });

  it('turns a low-pass cutoff and resonance into a filter', async () => {
    expect((await one('<region> sample=a.wav cutoff=2000')).filter).toEqual({ cutoff: 2000, q: 0 });
    expect((await one('<region> sample=a.wav fil_type=lpf_2p cutoff=500 resonance=6')).filter).toEqual({ cutoff: 500, q: 6 });
    expect((await one('<region> sample=a.wav fil_type=lpf_1p cutoff=500 resonance=6')).filter).toEqual({ cutoff: 500, q: -3.01 });
    expect((await one('<region> sample=a.wav fil_type=lpf_4p cutoff=800')).filter?.cutoff).toBe(800);
    expect((await one('<region> sample=a.wav fil_type=lpf_2p')).filter).toBeUndefined();
    expect((await one('<region> sample=a.wav cutoff=22000')).filter).toBeUndefined();
  });

  it('leaves out other filter types, warning once', async () => {
    const { regions, warnings } = await parse('<region> sample=a.wav fil_type=hpf_2p cutoff=300 <region> sample=b.wav fil_type=bpf_2p cutoff=300');
    expect(regions.map(r => r.filter)).toEqual([undefined, undefined]);
    expect(warnings).toEqual(['Filters other than low-pass were left out.']);
  });
});

describe('parseSfz: loops', () => {
  it('maps loop modes, with their aliases', async () => {
    const { regions } = await parse(`
      <region> sample=a.wav loop_mode=no_loop
      <region> sample=b.wav loop_mode=one_shot
      <region> sample=c.wav loop_mode=loop_continuous
      <region> sample=d.wav loopmode=loop_sustain
    `);
    expect(regions.map(r => r.loop)).toEqual(['none', 'one-shot', 'continuous', 'sustain']);
  });

  it('reads loop points, making loop_end exclusive', async () => {
    const r = await one('<region> sample=a.wav loop_mode=loop_sustain loop_start=1000 loop_end=4999');
    expect(r).toMatchObject({ loop: 'sustain', loopStart: 1000, loopEnd: 5000 });
    const alias = await one('<region> sample=a.wav loopstart=10 loopend=19');
    expect(alias).toMatchObject({ loop: 'continuous', loopStart: 10, loopEnd: 20 });
  });

  it('does not loop without loop_mode or loop points', async () => {
    const r = await one('<region> sample=a.wav');
    expect(r.loop).toBe('none');
    expect(r.loopStart).toBeUndefined();
    expect(r.loopEnd).toBeUndefined();
  });
});

describe('parseSfz: triggers, choking and layering', () => {
  it('reads release triggers', async () => {
    const { regions } = await parse(`
      <region> sample=a.wav trigger=attack
      <region> sample=b.wav trigger=release
      <region> sample=c.wav trigger=release_key
      <region> sample=d.wav trigger=first
    `);
    expect(regions.map(r => r.trigger)).toEqual(['attack', 'release', 'release', 'attack']);
  });

  it('maps group / off_by to choke groups (group 0 is none)', async () => {
    const { regions } = await parse(`
      <group> group=1 off_by=2
      <region> sample=open-hat.wav key=46
      <group> group=2
      <region> sample=closed-hat.wav key=42
      <group> polyphony_group=0
      <region> sample=kick.wav key=36
    `);
    expect(regions.map(r => [r.chokeGroup, r.offBy])).toEqual([
      [1, 2],
      [2, undefined],
      [undefined, undefined],
    ]);
  });

  it('reads round robins and random layers', async () => {
    const { regions } = await parse(`
      <group> seq_length=3
      <region> sample=rr1.wav seq_position=1
      <region> sample=rr2.wav seq_position=2
      <region> sample=rr3.wav seq_position=3
      <group>
      <region> sample=x.wav lorand=0 hirand=0.5
      <region> sample=y.wav lorand=0.5
      <region> sample=z.wav seq_length=1
    `);
    expect(regions.map(r => [r.seqLength, r.seqPosition])).toEqual([
      [3, 1],
      [3, 2],
      [3, 3],
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(regions.slice(3).map(r => [r.loRand, r.hiRand])).toEqual([
      [0, 0.5],
      [0.5, 1],
      [undefined, undefined],
    ]);
  });

  it('leaves out legato transitions when there are normal attacks', async () => {
    const { regions, warnings } = await parse('<region> sample=a.wav trigger=first <region> sample=b.wav trigger=legato');
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav']);
    expect(warnings).toHaveLength(1);
    const only = await parse('<region> sample=b.wav trigger=legato');
    expect(only.regions.map(r => [r.samplePath, r.trigger])).toEqual([['b.wav', 'attack']]);
  });
});

describe('parseSfz: key switches', () => {
  const articulations = (head: string) => `
    ${head}
    <global> sw_lokey=24 sw_hikey=26
    <group> sw_last=24 <region> sample=sustain.wav
    <group> sw_last=c#1 <region> sample=staccato.wav
    <group> sw_last=26 <region> sample=pizz.wav
    <group> <region> sample=noise.wav
  `;

  it('plays the sw_default articulation', async () => {
    const { regions, warnings } = await parse(articulations('<control> sw_default=25'));
    expect(regions.map(r => r.samplePath)).toEqual(['staccato.wav', 'noise.wav']);
    expect(warnings).toEqual(['This instrument has several articulations chosen by key switches; only the one on C#1 is played.']);
  });

  it('takes sw_default from a region header too', async () => {
    const { regions } = await parse(articulations('').replace('<global>', '<global> sw_default=26'));
    expect(regions.map(r => r.samplePath)).toEqual(['pizz.wav', 'noise.wav']);
  });

  it('plays the lowest switch when there is no default', async () => {
    const { regions } = await parse(articulations(''));
    expect(regions.map(r => r.samplePath)).toEqual(['sustain.wav', 'noise.wav']);
  });

  it('honours switch ranges', async () => {
    const { regions } = await parse('<control> sw_default=30 <region> sample=a.wav sw_lolast=28 sw_hilast=31 <region> sample=b.wav sw_last=32');
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav']);
  });

  it('leaves out regions that need a key switch held down', async () => {
    const { regions, warnings } = await parse('<region> sample=a.wav <region> sample=b.wav sw_down=c1 <region> sample=c.wav sw_up=c1');
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav', 'c.wav']);
    expect(warnings).toHaveLength(1);
  });
});

describe('parseSfz: controllers', () => {
  it('drops regions triggered by a controller, warning once', async () => {
    const { regions, warnings } = await parse(`
      <region> sample=note.wav
      <region> sample=pedal-down.wav on_locc64=64 on_hicc64=127 lokey=-1 hikey=-1
      <region> sample=pedal-up.wav start_locc64=0 start_hicc64=63
    `);
    expect(regions.map(r => r.samplePath)).toEqual(['note.wav']);
    expect(warnings).toEqual(['Regions played by a MIDI controller rather than a key (such as pedal noises) were skipped.']);
  });

  it('keeps the layers that play with the controllers at rest', async () => {
    const { regions, warnings } = await parse(`
      <region> sample=pedal-up.wav locc64=0 hicc64=63
      <region> sample=pedal-down.wav locc64=64
      <region> sample=full-volume.wav locc7=90
      <region> sample=plain.wav
    `);
    expect(regions.map(r => r.samplePath)).toEqual(['pedal-up.wav', 'full-volume.wav', 'plain.wav']);
    expect(warnings).toHaveLength(1);
  });

  it('uses set_cc for the resting value', async () => {
    const { regions } = await parse('<control> set_cc1=100 <region> sample=soft.wav hicc1=63 <region> sample=loud.wav locc1=64');
    expect(regions.map(r => r.samplePath)).toEqual(['loud.wav']);
  });

  it('keeps everything rather than nothing when no region plays at rest', async () => {
    const { regions } = await parse('<region> sample=a.wav locc1=64 <region> sample=b.wav locc1=100');
    expect(regions).toHaveLength(2);
  });
});

describe('parseSfz: what is left out', () => {
  it('drops regions without a sample, warning once', async () => {
    const { regions, warnings } = await parse('<region> key=60 <region> sample= <region> sample=a.wav');
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav']);
    expect(warnings).toEqual(['Some regions had no sample and were skipped.']);
  });

  it('drops built-in generators', async () => {
    const { regions, warnings } = await parse('<region> sample=*sine <region> sample=*noise <region> sample=*silence <region> sample=a.wav');
    expect(regions.map(r => r.samplePath)).toEqual(['a.wav']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('*sine');
  });

  it('drops regions no key can play', async () => {
    const { regions } = await parse('<region> sample=a.wav hikey=-1 <region> sample=b.wav lokey=70 hikey=60 <region> sample=c.wav lovel=100 hivel=90');
    expect(regions).toEqual([]);
  });

  it('skips <curve>, <effect>, <midi> and unknown headers, warning once per kind', async () => {
    const { regions, warnings } = await parse(`
      <curve> curve_index=7 v000=0 v127=1
      <effect> type=fverb reverb_size=50
      <region> sample=a.wav
      <effect> type=chorus
      <midi> sample=not-a-region.wav
      <banana> lokey=1
      <region> sample=b.wav
    `);
    expect(regions.map(r => [r.samplePath, r.loKey])).toEqual([
      ['a.wav', 0],
      ['b.wav', 0],
    ]);
    expect(warnings).toHaveLength(4);
    expect(warnings.filter(w => w.includes('<effect>'))).toHaveLength(1);
    expect(warnings.some(w => w.includes('<midi>'))).toBe(true);
    expect(warnings.some(w => w.includes('<banana>'))).toBe(true);
  });

  it('warns once that modulation is left out', async () => {
    const { warnings } = await parse('<region> sample=a.wav pitchlfo_freq=5 pitchlfo_depth=20 amplfo_depth=1');
    expect(warnings).toHaveLength(1);
  });

  it('keeps a file with nothing playable, with a warning', async () => {
    const { name, regions, warnings } = await parse('<group> volume=0', {}, 'Strings/Solo_Violin-pizz.sfz');
    expect(name).toBe('Solo Violin pizz');
    expect(regions).toEqual([]);
    expect(warnings).toEqual(['No playable regions were found in this instrument.']);
  });
});

describe('parseSfzBank', () => {
  const bank = {
    'Kit/Drums.sfz': '<region> sample=samples/kick.wav key=36 <region> sample=samples\\snare.wav key=38 <region> sample=*noise',
    'Kit/Drums_Brushes.sfz': '<control> default_path=samples/ <region> sample=kick.wav key=36 <region> sample=brush.wav key=38',
  };

  it('makes one preset per file and shares samples by path', async () => {
    const parsed = await parseSfzBank(['Kit/Drums.sfz', 'Kit/Drums_Brushes.sfz'], files(bank), { name: 'Drum Kit' });
    expect(parsed.format).toBe('sfz');
    expect(parsed.name).toBe('Drum Kit');
    expect(parsed.info).toEqual({});
    expect(parsed.presets.map(p => [p.name, p.bank, p.program, p.regions.map(r => r.sample)])).toEqual([
      ['Drums', 0, 0, [0, 1]],
      ['Drums Brushes', 0, 1, [0, 2]],
    ]);
    expect(parsed.samples).toEqual([
      { name: 'kick', sampleRate: 0, frames: 0, source: { kind: 'file', path: 'Kit/samples/kick.wav' } },
      { name: 'snare', sampleRate: 0, frames: 0, source: { kind: 'file', path: 'Kit/samples/snare.wav' } },
      { name: 'brush', sampleRate: 0, frames: 0, source: { kind: 'file', path: 'Kit/samples/brush.wav' } },
    ]);
    expect(parsed.presets[0].regions[1]).toMatchObject({ sample: 1, loKey: 38, hiKey: 38 });
    expect('samplePath' in parsed.presets[0].regions[0]).toBe(false);
    // with several files, warnings say which one
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toMatch(/^Drums\.sfz: /);
  });

  it('skips a file it cannot read, numbering programs without a gap', async () => {
    const parsed = await parseSfzBank(['Kit/gone.sfz', 'Kit/Drums_Brushes.sfz'], files(bank), { name: 'Kit' });
    expect(parsed.presets.map(p => [p.name, p.program])).toEqual([['Drums Brushes', 0]]);
    expect(parsed.warnings).toEqual(['"gone.sfz" couldn\'t be read and was skipped.']);
  });

  it('keeps an empty instrument beside playable ones', async () => {
    const parsed = await parseSfzBank(['a.sfz', 'b.sfz'], files({ 'a.sfz': '<region> sample=*sine', 'b.sfz': '<region> sample=b.wav' }), { name: 'x' });
    expect(parsed.presets.map(p => p.regions.length)).toEqual([0, 1]);
    expect(parsed.warnings).toContain('a.sfz: No playable regions were found in this instrument.');
  });

  it('throws when nothing in the bank can be played', async () => {
    const read = files({ 'a.sfz': '<region> sample=*sine', 'b.sfz': '// empty' });
    await expect(parseSfzBank(['a.sfz', 'b.sfz'], read, { name: 'x' })).rejects.toThrow(BankFormatError);
    await expect(parseSfzBank(['a.sfz'], read, { name: 'x' })).rejects.toThrow('No playable instruments were found in this bank.');
    await expect(parseSfzBank([], read, { name: 'x' })).rejects.toThrow(BankFormatError);
  });
});

describe('parseSfz: controller modulation', () => {
  it('applies X_onccN with the controller where set_hdcc / set_cc leaves it (a piano’s release)', async () => {
    const { regions } = await parse(`
      <control> set_hdcc72=0.5 set_cc99=127
      <global> ampeg_release_oncc72=2 amp_veltrack=100 amp_veltrack_oncc99=-100
      <region> sample=a.wav
    `);
    expect(regions[0].amp.release).toBeCloseTo(0.03 + 1, 2);
    expect(regions[0].velTrack).toBe(0);
  });

  it('reads curves: a bipolar controller in the middle moves nothing', async () => {
    const { regions } = await parse(`
      <control> set_cc90=63.5
      <region> sample=a.wav tune_cc90=1200 tune_curvecc90=1
      <region> sample=b.wav tune_cc90=1200
    `);
    expect(regions[0].tune).toBeCloseTo(0, 5);
    expect(regions[1].tune).toBeCloseTo(600, 0);
  });

  it('takes controllers that no one sets to be at rest', async () => {
    const { regions } = await parse('<region> sample=a.wav volume_oncc7=-12 ampeg_attack_oncc1=3');
    // CC7 rests at 100, CC1 (mod wheel) at 0
    expect(regions[0].volume).toBeCloseTo(-12 * (100 / 127), 5);
    expect(regions[0].amp.attack).toBe(SFZ_DEFAULT_ENVELOPE.attack);
  });
});
