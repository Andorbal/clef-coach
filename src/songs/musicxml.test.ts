import { describe, expect, it } from 'vitest';
import type { SongDef } from '../music/parse';
import { parseSongDoc, songToDoc } from './format';
import { type ImportResult, importMusicXml, importMxl } from './musicxml';

// ---------------------------------------------------------------------------
// Tiny MusicXML writer for the fixtures
// ---------------------------------------------------------------------------

interface N {
  /** "C#5", "Bb3", "r" (rest) */
  p: string;
  d: number;
  type?: string;
  dots?: number;
  tie?: 'start' | 'stop' | 'both';
  chord?: boolean;
  voice?: number;
  staff?: number;
  finger?: number;
  string?: number;
  fret?: number;
  triplet?: boolean;
  tuplet?: [number, number];
  grace?: boolean;
  lyric?: [number, 'single' | 'begin' | 'middle' | 'end', string][];
  measureRest?: boolean;
}

function note(n: N): string {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n.p);
  const pitch = m
    ? `<pitch><step>${m[1]}</step>${m[2] ? `<alter>${m[2] === '#' ? 1 : -1}</alter>` : ''}<octave>${m[3]}</octave></pitch>`
    : `<rest${n.measureRest ? ' measure="yes"' : ''}/>`;
  const ties = n.tie === 'both' ? ['stop', 'start'] : n.tie ? [n.tie] : [];
  const tech = [n.finger !== undefined ? `<fingering>${n.finger}</fingering>` : '', n.string !== undefined ? `<string>${n.string}</string>` : '', n.fret !== undefined ? `<fret>${n.fret}</fret>` : ''].join('');
  const tm = n.tuplet ?? (n.triplet ? [3, 2] : null);
  const notations = [...ties.map(t => `<tied type="${t}"/>`), tech ? `<technical>${tech}</technical>` : ''].join('');
  return [
    '<note>',
    n.grace ? '<grace/>' : '',
    n.chord ? '<chord/>' : '',
    pitch,
    n.grace ? '' : `<duration>${n.d}</duration>`,
    ...ties.map(t => `<tie type="${t}"/>`),
    `<voice>${n.voice ?? 1}</voice>`,
    n.type ? `<type>${n.type}</type>` : '',
    '<dot/>'.repeat(n.dots ?? 0),
    tm ? `<time-modification><actual-notes>${tm[0]}</actual-notes><normal-notes>${tm[1]}</normal-notes></time-modification>` : '',
    n.staff ? `<staff>${n.staff}</staff>` : '',
    notations ? `<notations>${notations}</notations>` : '',
    ...(n.lyric ?? []).map(([num, syl, text]) => `<lyric number="${num}"><syllabic>${syl}</syllabic><text>${text}</text></lyric>`),
    '</note>',
  ].join('');
}

const notes = (...ns: N[]) => ns.map(note).join('');

function attributes(a: { divisions?: number; fifths?: number; mode?: string; time?: [number, number]; staves?: number; clefs?: string[]; transpose?: string }): string {
  return [
    '<attributes>',
    a.divisions ? `<divisions>${a.divisions}</divisions>` : '',
    a.fifths !== undefined ? `<key><fifths>${a.fifths}</fifths>${a.mode ? `<mode>${a.mode}</mode>` : ''}</key>` : '',
    a.time ? `<time><beats>${a.time[0]}</beats><beat-type>${a.time[1]}</beat-type></time>` : '',
    a.staves ? `<staves>${a.staves}</staves>` : '',
    ...(a.clefs ?? []),
    a.transpose ?? '',
    '</attributes>',
  ].join('');
}

const clef = (sign: string, line: number, number?: number, octave?: number) =>
  `<clef${number ? ` number="${number}"` : ''}><sign>${sign}</sign><line>${line}</line>${octave ? `<clef-octave-change>${octave}</clef-octave-change>` : ''}</clef>`;

function score(opts: { title?: string; composer?: string; parts: { id: string; name: string; program?: number; measures: string[] }[]; header?: string }): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  ${opts.title ? `<work><work-title>${opts.title}</work-title></work>` : ''}
  <identification>${opts.composer ? `<creator type="composer">${opts.composer}</creator>` : ''}<encoding><software>Test Writer 1.0</software></encoding></identification>
  ${opts.header ?? ''}
  <part-list>${opts.parts.map(p => `<score-part id="${p.id}"><part-name>${p.name}</part-name>${p.program ? `<midi-instrument id="${p.id}-I1"><midi-program>${p.program}</midi-program></midi-instrument>` : ''}</score-part>`).join('')}</part-list>
  ${opts.parts.map(p => `<part id="${p.id}">${p.measures.map((m, i) => (m.startsWith('<measure') ? m : `<measure number="${i + 1}">${m}</measure>`)).join('')}</part>`).join('\n')}
</score-partwise>`;
}

/** Every import must load in the app without errors. */
function check(r: ImportResult): SongDef {
  const parsed = parseSongDoc(songToDoc(r.song));
  expect(parsed.song.staves.length).toBe(r.song.staves.length);
  return r.song;
}

// ---------------------------------------------------------------------------

describe('MusicXML import: melody', () => {
  // divisions 12: quarter 12, eighth 6, 16th 3, triplet eighth 4
  const xml = score({
    title: 'Little Tune',
    composer: 'A. Composer',
    parts: [{
      id: 'P1',
      name: 'Piano',
      measures: [
        `<measure number="0" implicit="yes">${attributes({ divisions: 12, fifths: 1, mode: 'major', time: [4, 4], clefs: [clef('G', 2)] })}<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>96</per-minute></metronome></direction-type><sound tempo="96"/></direction>${notes({ p: 'D4', d: 12, type: 'quarter', finger: 1 })}</measure>`,
        notes({ p: 'G4', d: 18, type: 'quarter', dots: 1, finger: 3 }, { p: 'A4', d: 6, type: 'eighth' }, { p: 'B4', d: 24, type: 'half', tie: 'start' }),
        notes({ p: 'B4', d: 12, type: 'quarter', tie: 'stop' }, { p: 'C5', d: 4, type: 'eighth', triplet: true }, { p: 'B4', d: 4, type: 'eighth', triplet: true }, { p: 'A#4', d: 4, type: 'eighth', triplet: true }, { p: 'G4', d: 24, type: 'half' }),
        notes({ p: 'F4', d: 9, type: 'eighth', dots: 1 }, { p: 'G4', d: 3, type: '16th' }, { p: 'Eb4', d: 12, type: 'quarter' }, { p: 'D4', d: 24, type: 'half', finger: 1 }),
        notes({ p: 'G4', d: 36, type: 'half', dots: 1 }),
      ],
    }],
  });

  it('reads pickup, ties, triplets, dots, accidentals and fingering', () => {
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.title).toBe('Little Tune');
    expect(song.composer).toBe('A. Composer');
    expect(song.instrument).toBe('piano');
    expect(song.key).toBe('G');
    expect(song.time).toEqual([4, 4]);
    expect(song.pickup).toBe('q');
    expect(song.tempo).toBe(96);
    expect(song.staves).toHaveLength(1);
    expect(song.staves[0].clef).toBe('treble');
    expect(song.staves[0].hand).toBe('R');
    expect(song.staves[0].voices).toEqual(['D4/q@1 | G4/q.@3 A4/e B4/h~ | B4/q C5/e3 B4 A#4 G4/h | F4/e. G4/s Eb4/q D4/h@1 | G4/h. |']);
    expect(r.parts).toEqual([{ id: 'P1', name: 'Piano', staves: 1 }]);
    expect(r.warnings).toEqual([]);
  });
});

const barline = (loc: 'left' | 'right', inner: string) => `<barline location="${loc}">${inner}</barline>`;
const repeat = (dir: 'forward' | 'backward') => `<repeat direction="${dir}"/>`;
const ending = (num: string, type: 'start' | 'stop' | 'discontinue') => `<ending number="${num}" type="${type}"/>`;
const words = (w: string, sound = '') => `<direction><direction-type><words>${w}</words></direction-type>${sound}</direction>`;
const whole = (p: string, extra: Partial<N> = {}) => notes({ p, d: 4, type: 'whole', ...extra });
const simple = (measures: string[], first = attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] })) =>
  score({ title: 'T', parts: [{ id: 'P1', name: 'Melody', measures: measures.map((m, i) => (i === 0 && !m.startsWith('<measure') ? first + m : m)) }] });

describe('MusicXML import: piano grand staff', () => {
  // divisions 2: quarter 2, half 4, whole 8
  const xml = score({
    title: 'Grand',
    parts: [{
      id: 'P1',
      name: 'Piano',
      program: 1,
      measures: [
        attributes({ divisions: 2, fifths: 0, time: [4, 4], staves: 2, clefs: [clef('G', 2, 1), clef('F', 4, 2)] }) +
          notes({ p: 'E5', d: 4, type: 'half', staff: 1 }, { p: 'D5', d: 4, type: 'half', staff: 1 }) +
          '<backup><duration>8</duration></backup>' +
          notes({ p: 'G4', d: 2, type: 'quarter', voice: 2, staff: 1 }, { p: 'G4', d: 2, type: 'quarter', voice: 2, staff: 1 }, { p: 'F4', d: 4, type: 'half', voice: 2, staff: 1 }) +
          '<backup><duration>8</duration></backup>' +
          notes({ p: 'C3', d: 8, type: 'whole', voice: 5, staff: 2, finger: 5 }, { p: 'E3', d: 8, type: 'whole', voice: 5, staff: 2, chord: true, finger: 3 }, { p: 'G3', d: 8, type: 'whole', voice: 5, staff: 2, chord: true, finger: 1 }),
        notes({ p: 'C5', d: 8, type: 'whole', staff: 1, finger: 5 }) +
          '<backup><duration>8</duration></backup>' +
          notes({ p: 'E4', d: 8, type: 'whole', voice: 2, staff: 1 }, { p: 'G4', d: 8, type: 'whole', voice: 2, staff: 1, chord: true }) +
          '<backup><duration>8</duration></backup>' +
          notes({ p: 'C3', d: 4, type: 'half', voice: 5, staff: 2 }, { p: 'G2', d: 4, type: 'half', voice: 5, staff: 2 }),
      ],
    }],
  });

  it('maps staves to hands and keeps two voices', () => {
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.instrument).toBe('piano');
    expect(song.staves.map(s => [s.clef, s.hand])).toEqual([['treble', 'R'], ['bass', 'L']]);
    expect(song.staves[0].voices).toEqual(['E5/h D5 | C5/w@5 |', 'G4/q G4 F4/h | [E4 G4]/w |']);
    expect(song.staves[1].voices).toEqual(['[C3 E3 G3]/w@5,3,1 | C3/h G2 |']);
    expect(r.parts).toEqual([{ id: 'P1', name: 'Piano', staves: 2 }]);
    expect(r.warnings).toEqual([]);
  });

  it('merges a third voice into chords that start with it and reports it', () => {
    const three = score({
      parts: [{
        id: 'P1',
        name: 'Piano',
        measures: [
          attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) +
            notes({ p: 'E5', d: 2, type: 'half' }, { p: 'D5', d: 2, type: 'half' }) +
            '<backup><duration>4</duration></backup>' +
            notes({ p: 'G4', d: 1, type: 'quarter', voice: 2 }, { p: 'A4', d: 1, type: 'quarter', voice: 2 }, { p: 'F4', d: 2, type: 'half', voice: 2 }) +
            '<backup><duration>4</duration></backup>' +
            notes({ p: 'C4', d: 2, type: 'half', voice: 3 }, { p: 'B3', d: 1, type: 'quarter', voice: 3 }, { p: 'r', d: 1, voice: 3 }),
        ],
      }],
    });
    const r = importMusicXml(three);
    const song = check(r);
    expect(song.title).toBe('Untitled');
    // C4 lines up with voice 1's E5 and joins it; B3 starts with F4 (nearer than D5) and joins
    // that chord, taking its length
    expect(song.staves[0].voices).toEqual(['[C4 E5]/h D5 |', 'G4/q A4 [B3 F4]/h |']);
    expect(r.warnings.join(' ')).toMatch(/more than two voices.*2 notes merged into chords\)/);
  });

  it('moves a third voice into a kept voice that is silent meanwhile, and drops only what fits nowhere', () => {
    const three = score({
      parts: [{
        id: 'P1',
        name: 'Piano',
        measures: [
          attributes({ divisions: 2, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) +
            notes({ p: 'E5', d: 4, type: 'half' }, { p: 'D5', d: 4, type: 'half' }) +
            '<backup><duration>8</duration></backup>' +
            notes({ p: 'r', d: 4, voice: 2 }, { p: 'F4', d: 2, type: 'quarter', voice: 2 }, { p: 'G4', d: 2, type: 'quarter', voice: 2 }) +
            '<backup><duration>8</duration></backup>' +
            notes({ p: 'C4', d: 2, type: 'quarter', voice: 3 }, { p: 'r', d: 3, voice: 3 }, { p: 'A3', d: 1, type: 'eighth', voice: 3 }, { p: 'r', d: 2, voice: 3 }),
        ],
      }],
    });
    const r = importMusicXml(three);
    const song = check(r);
    // C4 goes into voice 2's opening rest; A3 starts with nothing and overlaps both voices
    expect(song.staves[0].voices).toEqual(['E5/h D5 |', 'C4/q r F4 G4 |']);
    expect(r.warnings.join(' ')).toMatch(/more than two voices.*\(1 note dropped\)/);
  });

  it('writes a second voice that only doubles the first as chords', () => {
    const octaves = score({
      parts: [{
        id: 'P1',
        name: 'Piano',
        measures: [
          attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) +
            notes({ p: 'D5', d: 1, type: 'quarter' }, { p: 'E5', d: 1, type: 'quarter' }, { p: 'C5', d: 2, type: 'half' }) +
            '<backup><duration>4</duration></backup>' +
            notes({ p: 'D4', d: 1, type: 'quarter', voice: 2 }, { p: 'E4', d: 1, type: 'quarter', voice: 2 }, { p: 'C4', d: 2, type: 'half', voice: 2 }),
          whole('G4'),
        ],
      }],
    });
    const r = importMusicXml(octaves);
    expect(check(r).staves[0].voices).toEqual(['[D4 D5]/q [E4 E5] [C4 C5]/h | G4/w |']);
    expect(r.warnings).toEqual([]);
  });
});

describe('MusicXML import: guitar and bass', () => {
  const guitarMeasures = (clefXml: string, transpose = '', octave = 0) => {
    const o = (p: string) => p.replace(/\d$/, d => String(Number(d) + octave));
    return [
      attributes({ divisions: 1, fifths: 0, time: [3, 4], clefs: [clefXml], transpose }) +
        notes({ p: o('E4'), d: 1, type: 'quarter', string: 1, fret: 0, finger: 0 }, { p: o('B3'), d: 1, type: 'quarter', string: 2, fret: 0 }, { p: o('G3'), d: 1, type: 'quarter', string: 3, fret: 0 }),
      notes({ p: o('C4'), d: 2, type: 'half', string: 2, fret: 1, finger: 1 }, { p: o('E4'), d: 2, type: 'half', chord: true, string: 1, fret: 0 }, { p: o('D4'), d: 1, type: 'quarter', string: 2, fret: 3, finger: 3 }),
      notes({ p: o('A3'), d: 3, type: 'half', dots: 1, fret: 2, finger: 2 }),
    ];
  };
  const expected = 'E4/q@0%1 B3%2 G3%3 | [C4 E4]/h@1,-%2,1 D4/q@3%2 | A3/h.@2%3 |';

  it('reads a treble-8vb guitar part with string and fret marks at sounding pitch', () => {
    const xml = score({ title: 'Study', parts: [{ id: 'P1', name: 'Classical Guitar', program: 25, measures: guitarMeasures(clef('G', 2, undefined, -1)) }] });
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.instrument).toBe('guitar');
    expect(song.staves[0].clef).toBe('treble8vb');
    expect(song.staves[0].voices).toEqual([expected]);
    expect(r.warnings).toEqual([]);
  });

  it('uses string + fret to settle the octave of a part written in plain treble clef', () => {
    // written an octave up (as guitarists read), no <transpose>: fret marks say it sounds an octave lower
    const xml = score({ parts: [{ id: 'P1', name: 'Guitar', measures: guitarMeasures(clef('G', 2), '', 1) }] });
    const song = check(importMusicXml(xml));
    expect(song.staves[0].voices).toEqual([expected]);
  });

  it('applies <transpose> octave-change, and the page octave when nothing else says', () => {
    const tr = '<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>';
    const plain = (m: string[]) => score({ parts: [{ id: 'P1', name: 'Electric Guitar', measures: m }] });
    const withTranspose = check(importMusicXml(plain([attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)], transpose: tr }) + whole('E5')])));
    expect(withTranspose.staves[0].voices).toEqual(['E4/w |']);
    const bare = check(importMusicXml(plain([attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) + notes({ p: 'E5', d: 2, type: 'half' }, { p: 'G4', d: 2, type: 'half' })])));
    expect(bare.staves[0].voices).toEqual(['E4/h G3 |']);
  });

  it('writes a bass guitar part in bass 8vb at sounding pitch', () => {
    const tr = '<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>';
    const xml = score({ parts: [{ id: 'P1', name: 'Electric Bass', program: 34, measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('F', 4)], transpose: tr }) + notes({ p: 'E2', d: 2, type: 'half', string: 4 }, { p: 'A2', d: 2, type: 'half', string: 3 })] }] });
    const song = check(importMusicXml(xml));
    expect(song.instrument).toBe('bass');
    expect(song.staves[0].clef).toBe('bass8vb');
    expect(song.staves[0].voices).toEqual(['E1/h%4 A1%3 |']);
  });

  it('drops a tablature staff but keeps its string numbers', () => {
    const m = attributes({ divisions: 1, fifths: 0, time: [4, 4], staves: 2, clefs: [clef('G', 2, 1, -1), clef('TAB', 5, 2)] }) +
      notes({ p: 'G3', d: 4, type: 'whole', staff: 1 }) + '<backup><duration>4</duration></backup>' + notes({ p: 'G3', d: 4, type: 'whole', staff: 2, voice: 5, string: 3, fret: 0 });
    const r = importMusicXml(score({ parts: [{ id: 'P1', name: 'Guitar', measures: [m] }] }));
    const song = check(r);
    expect(r.parts[0].staves).toBe(1);
    expect(song.staves).toHaveLength(1);
    expect(song.staves[0].voices).toEqual(['G3/w%3 |']);
  });
});

describe('MusicXML import: structure', () => {
  it('writes out repeats with first and second endings', () => {
    const xml = simple([
      barline('left', repeat('forward')) + whole('C4'),
      whole('D4'),
      barline('left', ending('1', 'start')) + whole('E4') + barline('right', ending('1', 'stop') + repeat('backward')),
      barline('left', ending('2', 'start')) + whole('F4') + barline('right', ending('2', 'discontinue')),
      whole('G4'),
    ]);
    const song = check(importMusicXml(xml));
    expect(song.staves[0].voices).toEqual(['C4/w | D4 | E4 | C4 | D4 | F4 | G4 |']);
  });

  it('follows D.C. al Fine', () => {
    const xml = simple([whole('C4'), words('Fine', '<sound fine="yes"/>') + whole('D4'), whole('E4'), words('D.C. al Fine', '<sound dacapo="yes"/>') + whole('F4')]);
    expect(check(importMusicXml(xml)).staves[0].voices).toEqual(['C4/w | D4 | E4 | F4 | C4 | D4 |']);
  });

  it('follows D.S. al Coda written only as words and signs', () => {
    const xml = simple([
      whole('C4'),
      '<direction><direction-type><segno/></direction-type></direction>' + whole('D4'),
      words('To Coda') + '<direction><direction-type><coda/></direction-type></direction>' + whole('E4'),
      words('D.S. al Coda') + whole('F4'),
      '<direction><direction-type><coda/></direction-type></direction>' + whole('G4'),
    ]);
    expect(check(importMusicXml(xml)).staves[0].voices).toEqual(['C4/w | D4 | E4 | F4 | D4 | E4 | G4 |']);
  });

  it('joins the halves of a bar split by a repeat after a pickup', () => {
    const xml = simple([
      `<measure number="0" implicit="yes">${attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] })}${barline('left', repeat('forward'))}${notes({ p: 'G4', d: 1, type: 'quarter' })}</measure>`,
      notes({ p: 'C5', d: 4, type: 'whole' }),
      notes({ p: 'B4', d: 3, type: 'half', dots: 1 }) + barline('right', repeat('backward')),
      `<measure number="X3" implicit="yes">${notes({ p: 'D5', d: 1, type: 'quarter' })}</measure>`,
      notes({ p: 'C5', d: 4, type: 'whole' }),
    ]);
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.pickup).toBe('q');
    expect(song.staves[0].voices).toEqual(['G4/q | C5/w | B4/h. G4/q | C5/w | B4/h. D5/q | C5/w |']);
    expect(r.warnings).toEqual([]);
  });

  it('marks key and time signature changes', () => {
    const xml = simple([
      whole('G4'),
      attributes({ time: [3, 4] }) + notes({ p: 'A4', d: 3, type: 'half', dots: 1 }),
      attributes({ fifths: -1 }) + notes({ p: 'Bb4', d: 3, type: 'half', dots: 1 }),
      attributes({ fifths: 0, time: [4, 4] }) + whole('C5'),
    ], attributes({ divisions: 1, fifths: 1, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.key).toBe('G');
    expect(song.staves[0].voices).toEqual(['G4/w | [T:3/4] A4/h. | [K:F] Bb4 | [K:C] [T:4/4] C5/w |']);
    const { score: sc } = parseSongDoc(songToDoc(song));
    expect(sc.changes?.map(c => c.measure)).toEqual([1, 2, 3]);
  });

  it('reads score-timewise files', () => {
    const xml = `<?xml version="1.0"?><score-timewise version="4.0"><movement-title>Timewise</movement-title>
      <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
      <measure number="1"><part id="P1">${attributes({ divisions: 1, fifths: 0, time: [2, 4], clefs: [clef('G', 2)] })}${notes({ p: 'C4', d: 1, type: 'quarter' }, { p: 'D4', d: 1, type: 'quarter' })}</part></measure>
      <measure number="2"><part id="P1">${notes({ p: 'E4', d: 2, type: 'half' })}</part></measure>
    </score-timewise>`;
    const song = check(importMusicXml(xml));
    expect(song.title).toBe('Timewise');
    expect(song.time).toEqual([2, 4]);
    expect(song.staves[0].voices).toEqual(['C4/q D4 | E4/h |']);
  });

  it('pads short measures, gives long ones a time signature of their own and says so', () => {
    const xml = simple([
      whole('C4'),
      notes({ p: 'D4', d: 3, type: 'half', dots: 1 }),
      notes({ p: 'E4', d: 4, type: 'whole' }, { p: 'F4', d: 1, type: 'quarter' }),
      notes({ p: 'F4', d: 1, type: 'quarter', grace: true }, { p: 'G4', d: 4, type: 'whole' }),
    ]);
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.pickup).toBeUndefined();
    expect(song.staves[0].voices).toEqual(['C4/w | D4/h. r/q | [T:5/4] E4/w F4/q | [T:4/4] G4/w |']);
    expect(r.warnings).toEqual([
      'Measure 3 is longer than the time signature (a cadenza?); it was given a time signature of its own.',
      'Measure 2 was incomplete and filled with rests.',
      '1 grace note was left out.',
    ]);
  });

  it('treats a short first measure as a pickup and lets the last bar complete it', () => {
    const xml = simple([notes({ p: 'C4', d: 3, type: 'half', dots: 1 }), whole('D4'), notes({ p: 'E4', d: 1, type: 'quarter' })]);
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.pickup).toBe('h.');
    expect(song.staves[0].voices).toEqual(['C4/h. | D4/w | E4/q |']);
    expect(r.warnings).toEqual([]);
  });

  it('rounds tuplets other than triplets', () => {
    // a quintuplet of 16ths (5 in the time of 4) in a quarter: divisions 20 → each 4
    const quint = ['C5', 'D5', 'E5', 'F5', 'G5'].map(p => ({ p, d: 4, type: '16th', tuplet: [5, 4] as [number, number] }));
    const xml = simple([notes(...quint, { p: 'A5', d: 60, type: 'half', dots: 1 })], attributes({ divisions: 20, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml);
    const song = check(r);
    expect(r.warnings.join(' ')).toMatch(/5 notes in tuplets other than triplets were rounded/);
    // whatever survives still fills exactly one beat
    const first = parseSongDoc(songToDoc(song)).score.staves[0].voices[0].notes.filter(n => n.tick < 48);
    expect(first.reduce((s, n) => s + n.ticks, 0)).toBe(48);
  });
});

describe('MusicXML import: chords, lyrics, transposition', () => {
  const harmony = (root: string, kind: string, extra = '') => {
    const alter = root[1] === 'b' ? -1 : root[1] === '#' ? 1 : 0;
    return `<harmony><root><root-step>${root[0]}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ''}</root><kind>${kind}</kind>${extra}</harmony>`;
  };

  it('writes chord symbols timed within the bar', () => {
    const xml = simple([
      harmony('C', 'major') + notes({ p: 'C5', d: 4, type: 'half' }) + harmony('G', 'dominant') + notes({ p: 'B4', d: 4, type: 'half' }),
      harmony('F', 'major-seventh') + harmony('D', 'half-diminished', '<offset>4</offset>') + notes({ p: 'A4', d: 8, type: 'whole' }),
      notes({ p: 'G4', d: 8, type: 'whole' }),
      harmony('C', 'major', '<bass><bass-step>E</bass-step></bass>') + notes({ p: 'E4', d: 2, type: 'quarter' }) +
        harmony('Bb', 'augmented') + notes({ p: 'D4', d: 2, type: 'quarter' }) +
        harmony('E', 'suspended-fourth') + notes({ p: 'C4', d: 2, type: 'quarter' }) +
        '<harmony><root><root-step>C</root-step></root><kind>none</kind></harmony>' + notes({ p: 'C4', d: 2, type: 'quarter' }),
    ], attributes({ divisions: 2, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.chords).toBe('C/h G7/h | Fmaj7/h Dm7b5/h | Dm7b5/w | C/E/q Bbaug/q Esus4/q r/q |');
    expect(parseSongDoc(songToDoc(song)).warnings).toEqual([]);
  });

  it('reads lyric verses with hyphenated syllables', () => {
    const xml = simple([
      notes(
        { p: 'G4', d: 1, type: 'quarter', lyric: [[1, 'begin', 'Si'], [2, 'begin', 'Ho']] },
        { p: 'A4', d: 1, type: 'quarter', lyric: [[1, 'end', 'lent'], [2, 'end', 'ly']] },
        { p: 'G4', d: 1, type: 'quarter', lyric: [[1, 'single', 'night,'], [2, 'single', 'night,']] },
      ),
      notes({ p: 'E4', d: 2, type: 'half', tie: 'start', lyric: [[1, 'single', 'calm']] }, { p: 'E4', d: 1, type: 'quarter', tie: 'stop' }),
      notes({ p: 'G4', d: 2, type: 'half', lyric: [[1, 'single', 'all'], [2, 'single', 'is']] }, { p: 'r', d: 1 }),
    ], attributes({ divisions: 1, fifths: 0, time: [3, 4], clefs: [clef('G', 2)] }));
    const song = check(importMusicXml(xml));
    expect(song.staves[0].voices).toEqual(['G4/q A4 G4 | E4/h~ E4/q | G4/h r/q |']);
    expect(song.lyrics).toEqual(['Si- lent night, calm all', 'Ho- ly night, _ is']);
  });

  it('sings later verses on the repeat as one line', () => {
    const xml = simple([
      barline('left', repeat('forward')) + whole('G4', { lyric: [[1, 'single', 'one'], [2, 'single', 'two']] }) + barline('right', repeat('backward')),
      whole('A4', { lyric: [[1, 'single', 'end']] }),
    ]);
    expect(check(importMusicXml(xml)).lyrics).toEqual(['one two end']);
  });

  it('turns a transposing part into sounding pitch (keyboard) or keeps written pitch (mallets)', () => {
    const clarinet = '<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>';
    const xml = simple([whole('E4')], attributes({ divisions: 1, fifths: 2, time: [4, 4], clefs: [clef('G', 2)], transpose: clarinet }));
    const piano = check(importMusicXml(xml, { instrument: 'piano' }));
    expect(piano.key).toBe('C');
    expect(piano.staves[0].voices).toEqual(['D4/w |']);
    const xylo = '<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>1</octave-change></transpose>';
    const mallets = check(importMusicXml(score({ parts: [{ id: 'P1', name: 'Xylophone', measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)], transpose: xylo }) + whole('C5')] }] })));
    expect(mallets.instrument).toBe('mallets');
    expect(mallets.staves[0].voices).toEqual(['C5/w |']);
  });
});

describe('MusicXML import: parts', () => {
  const two = (names: [string, string], clefs: [string, string] = [clef('G', 2), clef('F', 4)]) => score({
    title: 'Duo',
    parts: [
      { id: 'P1', name: names[0], measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clefs[0]] }) + whole('E5')] },
      { id: 'P2', name: names[1], measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clefs[1]] }) + whole('C3')] },
    ],
  });

  it('takes a right-hand / left-hand pair of parts as one piano', () => {
    const r = importMusicXml(two(['Piano RH', 'Piano LH']));
    const song = check(r);
    expect(song.instrument).toBe('piano');
    expect(song.staves.map(s => [s.clef, s.hand, s.voices[0]])).toEqual([['treble', 'R', 'E5/w |'], ['bass', 'L', 'C3/w |']]);
    expect(r.warnings).toEqual([]);
  });

  it('imports the first part by default and lets the caller choose', () => {
    const xml = two(['Flute', 'Cello']);
    const first = importMusicXml(xml);
    expect(check(first).staves.map(s => s.voices[0])).toEqual(['E5/w |']);
    expect(first.parts.map(p => p.id)).toEqual(['P1', 'P2']);
    expect(first.warnings.join(' ')).toMatch(/Imported "Flute"; the file has 2 parts/);
    const second = check(importMusicXml(xml, { partIds: ['P2'] }));
    expect(second.staves).toEqual([{ clef: 'bass', hand: 'L', voices: ['C3/w |'] }]);
    const both = check(importMusicXml(xml, { partIds: ['P1', 'P2'], instrument: 'mallets' }));
    expect(both.staves.map(s => s.name)).toEqual(['Flute', 'Cello']);
    expect(() => importMusicXml(xml, { partIds: ['nope'] })).toThrow(/None of the requested parts/);
  });

  it('rejects files that are not MusicXML', () => {
    expect(() => importMusicXml('<html><body/></html>')).toThrow(/doesn't look like MusicXML/);
    expect(() => importMusicXml('just text')).toThrow(/isn't valid XML/);
  });

  it('reads credits, rights, arranger and lyricist', () => {
    const xml = score({
      parts: [{ id: 'P1', name: 'Piano', measures: [attributes({ divisions: 1, fifths: -3, mode: 'minor', time: [4, 4], clefs: [clef('G', 2)] }) + whole('C5')] }],
      header: '<credit page="1"><credit-type>title</credit-type><credit-words>Credit &amp; Title</credit-words></credit>',
    }).replace('<encoding>', '<creator type="arranger">Arr. Person</creator><creator type="lyricist">Word Smith</creator><rights>© 2026 Somebody</rights><encoding>');
    const song = check(importMusicXml(xml));
    expect(song.title).toBe('Credit & Title');
    expect(song.key).toBe('Cm');
    expect(song.arranger).toBe('Arr. Person');
    expect(song.license).toBe('© 2026 Somebody');
    expect(song.blurb).toBe('Words by Word Smith.');
    expect(song.source).toBe('Imported from MusicXML (Test Writer 1.0)');
  });
});

// ---------------------------------------------------------------------------
// .mxl
// ---------------------------------------------------------------------------

function crc32(b: Uint8Array): number {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** A ZIP archive with the given entries (method 0 = stored, 8 = deflate with `data` already deflated). */
function zip(entries: { name: string; data: Uint8Array; raw: Uint8Array; method: 0 | 8 }[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const e of entries) {
    const name = [...new TextEncoder().encode(e.name)];
    const offset = out.length;
    const common = [...u16(0), ...u16(e.method), ...u16(0), ...u16(0), ...u32(crc32(e.raw)), ...u32(e.data.length), ...u32(e.raw.length), ...u16(name.length), ...u16(0)];
    out.push(...u32(0x04034b50), ...u16(20), ...common, ...name, ...e.data);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
  }
  const cdOffset = out.length;
  out.push(...central, ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(central.length), ...u32(cdOffset), ...u16(0));
  return new Uint8Array(out);
}

describe('MusicXML import: real-score details', () => {
  const grand = (measures: string[], fifths = 0, extra: { mode?: string } = {}) =>
    score({
      title: 'G',
      parts: [{ id: 'P1', name: 'Piano', measures: measures.map((m, i) => (i === 0 ? attributes({ divisions: 2, fifths, mode: extra.mode, time: [4, 4], staves: 2, clefs: [clef('G', 2, 1), clef('F', 4, 2)] }) + m : m)) }],
    });
  const back = (d = 8) => `<backup><duration>${d}</duration></backup>`;

  it('puts cross-staff notes back on their own hand\'s staff', () => {
    // the right hand's last two notes are drawn on the bass staff
    const xml = grand([
      notes({ p: 'E4', d: 2, type: 'quarter', staff: 1 }, { p: 'C4', d: 2, type: 'quarter', staff: 1 }, { p: 'A3', d: 2, type: 'quarter', staff: 2 }, { p: 'F3', d: 2, type: 'quarter', staff: 2 }) +
        back() +
        notes({ p: 'C2', d: 8, type: 'whole', voice: 5, staff: 2 }),
    ]);
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.staves.map(s => s.voices)).toEqual([['E4/q C4 A3 F3 |'], ['C2/w |']]);
    expect(r.warnings.join(' ')).toMatch(/2 cross-staff notes are written on their own hand's staff/);
  });

  it('leaves a voice number shared by both staves alone (some programs number each staff from 1)', () => {
    const xml = grand([notes({ p: 'E5', d: 8, type: 'whole', staff: 1 }) + back() + notes({ p: 'C3', d: 8, type: 'whole', staff: 2 })]);
    const r = importMusicXml(xml);
    expect(check(r).staves.map(s => s.voices)).toEqual([['E5/w |'], ['C3/w |']]);
    expect(r.warnings.join(' ')).not.toMatch(/cross-staff/);
  });

  it('puts the upper voice first, by its stems', () => {
    // voice 5 (written first) is the low bass, voice 6 an arpeggio above it with stems up
    const stem = (dir: string) => (n: string) => n.replace('</voice>', `</voice><stem>${dir}</stem>`);
    const xml = grand([
      notes({ p: 'C5', d: 8, type: 'whole', staff: 1 }) +
        back() +
        notes({ p: 'C2', d: 4, type: 'half', voice: 5, staff: 2 }, { p: 'G2', d: 4, type: 'half', voice: 5, staff: 2 }).split('</note>').map(stem('down')).join('</note>') +
        back() +
        notes({ p: 'G2', d: 2, type: 'quarter', voice: 6, staff: 2 }, { p: 'C3', d: 2, type: 'quarter', voice: 6, staff: 2 }, { p: 'E3', d: 2, type: 'quarter', voice: 6, staff: 2 }, { p: 'G3', d: 2, type: 'quarter', voice: 6, staff: 2 })
          .split('</note>')
          .map(stem('up'))
          .join('</note>'),
    ]);
    expect(check(importMusicXml(xml)).staves[1].voices).toEqual(['G2/q C3 E3 G3 |', 'C2/h G2 |']);
  });

  it('writes clef changes where they happen, repeats included', () => {
    const toTreble = `<attributes><clef number="2"><sign>G</sign><line>2</line></clef></attributes>`;
    const toBass = `<attributes><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
    const xml = grand([
      notes({ p: 'C5', d: 8, type: 'whole', staff: 1 }) + back() + notes({ p: 'C3', d: 4, type: 'half', voice: 5, staff: 2 }) + toTreble + notes({ p: 'C4', d: 4, type: 'half', voice: 5, staff: 2 }),
      notes({ p: 'D5', d: 8, type: 'whole', staff: 1 }) + back() + notes({ p: 'E4', d: 8, type: 'whole', voice: 5, staff: 2 }) + toBass,
      notes({ p: 'E5', d: 8, type: 'whole', staff: 1 }) + back() + notes({ p: 'G2', d: 8, type: 'whole', voice: 5, staff: 2 }),
    ]);
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.staves[1].clef).toBe('bass');
    expect(song.staves[1].voices).toEqual(['C3/h [C:treble] C4 | E4/w | [C:bass] G2 |']);
    expect(r.warnings.join(' ')).not.toMatch(/clef/);
    const { score: sc } = parseSongDoc(songToDoc(song));
    expect(sc.staves[1].clefChanges).toEqual([{ tick: 96, clef: 'treble' }, { tick: 384, clef: 'bass' }]);
  });

  it('keeps 64th notes', () => {
    // 16 divisions: a 16th is 4, a 32nd 2, a 64th 1
    const xml = simple(
      [notes({ p: 'C5', d: 48, type: 'half', dots: 1 }, { p: 'D5', d: 4, type: '16th' }, { p: 'E5', d: 1, type: '64th' }, { p: 'F5', d: 1, type: '64th' }, { p: 'G5', d: 2, type: '32nd' }, { p: 'A5', d: 8, type: 'eighth' })],
      attributes({ divisions: 16, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }),
    );
    const r = importMusicXml(xml);
    expect(check(r).staves[0].voices).toEqual(['C5/h. D5/s E5/x F5 G5/t A5/e |']);
    expect(r.warnings).toEqual([]);
  });

  it('spreads a run too fast for any written value instead of dropping notes', () => {
    // twelve notes in the time of one 16th (48 divisions: a quarter is 48)
    const run = Array.from({ length: 12 }, (_, i) => ({ p: ['C5', 'D5', 'E5', 'F5'][i % 4], d: 1, type: '256th' }));
    const xml = simple([notes({ p: 'C4', d: 144, type: 'half', dots: 1 }, ...run, { p: 'E6', d: 36, type: 'eighth', dots: 1 })], attributes({ divisions: 48, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml);
    const song = check(r);
    const { score: sc } = parseSongDoc(songToDoc(song));
    const played = sc.staves[0].voices[0].notes.filter(n => !n.rest && !n.tiePrev);
    expect(played.length).toBe(14);
    // the run is packed in 64ths before E6, which keeps its place
    expect(played.slice(1, 13).every(n => n.base === 'x')).toBe(true);
    expect(played[13].tick).toBe(156);
    expect(r.warnings.join(' ')).toMatch(/spaced out evenly so that every note is kept/);
  });

  it('keeps a held note of a chord tied while the others move', () => {
    const xml = simple([
      notes({ p: 'C4', d: 2, type: 'half', tie: 'start' }, { p: 'E4', d: 2, type: 'half', chord: true }, { p: 'C4', d: 2, type: 'half', tie: 'stop' }, { p: 'F4', d: 2, type: 'half', chord: true }),
    ]);
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.staves[0].voices).toEqual(['[C4~ E4]/h [C4 F4] |']);
    expect(r.warnings).toEqual([]);
  });

  it('keeps an arpeggio held into a chord', () => {
    const xml = simple([
      notes(
        { p: 'C4', d: 1, type: 'eighth', tie: 'start' },
        { p: 'E4', d: 1, type: 'eighth', tie: 'start' },
        { p: 'G4', d: 2, type: 'quarter' },
        { p: 'C4', d: 4, type: 'half', tie: 'stop' },
        { p: 'E4', d: 4, type: 'half', chord: true, tie: 'stop' },
        { p: 'G4', d: 4, type: 'half', chord: true },
      ),
    ], attributes({ divisions: 2, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.staves[0].voices).toEqual(['C4/e~ E4~ G4/q [C4 E4 G4]/h |']);
    expect(r.warnings).toEqual([]);
  });

  it('gives a bar of music with no time signature its own length', () => {
    const xml = score({
      title: 'Free',
      parts: [{ id: 'P1', name: 'Piano', measures: [`<attributes><divisions>1</divisions><key><fifths>0</fifths></key><clefs/></attributes>` + notes({ p: 'C4', d: 4, type: 'whole' }, { p: 'D4', d: 2, type: 'half' }), notes({ p: 'E4', d: 3, type: 'half', dots: 1 })] }],
    });
    const r = importMusicXml(xml);
    const song = check(r);
    expect(song.time).toEqual([6, 4]);
    expect(song.staves[0].voices).toEqual(['C4/w D4/h | [T:3/4] E4/h. |']);
    expect(r.warnings.join(' ')).toMatch(/no time signature/);
  });

  it('lets a tiny overflow from rounded tuplets pass quietly', () => {
    // 5 in the time of 4 sixteenths, each rounded up by the file to 10 of 48 divisions
    const five = Array.from({ length: 5 }, () => ({ p: 'C5', d: 10, type: '16th', tuplet: [5, 4] as [number, number] }));
    const xml = simple([notes({ p: 'C4', d: 144, type: 'half', dots: 1 }, ...five)], attributes({ divisions: 48, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml);
    check(r);
    expect(r.warnings.join(' ')).not.toMatch(/more beats|time signature of its own/);
  });

  it('calls a key minor when the music says so', () => {
    // A minor: the leading tone G#, ending on A in the bass
    const am = grand([
      notes({ p: 'A4', d: 2, type: 'quarter' }, { p: 'B4', d: 2, type: 'quarter' }, { p: 'G#4', d: 2, type: 'quarter' }, { p: 'A4', d: 2, type: 'quarter' }) + back() + notes({ p: 'A2', d: 4, type: 'half', voice: 5, staff: 2 }, { p: 'E2', d: 4, type: 'half', voice: 5, staff: 2 }),
      notes({ p: 'C5', d: 4, type: 'half' }, { p: 'A4', d: 4, type: 'half' }) + back() + notes({ p: 'A2', d: 8, type: 'whole', voice: 5, staff: 2 }),
    ]);
    expect(check(importMusicXml(am)).key).toBe('Am');
    const c = grand([
      notes({ p: 'C5', d: 2, type: 'quarter' }, { p: 'E5', d: 2, type: 'quarter' }, { p: 'G5', d: 2, type: 'quarter' }, { p: 'E5', d: 2, type: 'quarter' }) + back() + notes({ p: 'C3', d: 4, type: 'half', voice: 5, staff: 2 }, { p: 'G2', d: 4, type: 'half', voice: 5, staff: 2 }),
      notes({ p: 'C5', d: 8, type: 'whole' }) + back() + notes({ p: 'C3', d: 8, type: 'whole', voice: 5, staff: 2 }),
    ]);
    expect(check(importMusicXml(c)).key).toBe('C');
    // an explicit minor is trusted; an explicit major is not (some programs write it for every key)
    expect(check(importMusicXml(grand([notes({ p: 'C5', d: 8, type: 'whole' }) + back() + notes({ p: 'C3', d: 8, type: 'whole', voice: 5, staff: 2 })], 0, { mode: 'minor' }))).key).toBe('Am');
    expect(check(importMusicXml(grand([am.split('<measure number="1">')[1].split('</measure>')[0].replace(/<attributes>.*?<\/attributes>/, '')], 0, { mode: 'major' }))).key).toBe('Am');
  });

  it('picks the part with the most music, and an unnamed braced pair as a piano', () => {
    const xml = score({
      title: 'Parts',
      parts: [
        { id: 'P1', name: 'Ornaments', measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) + whole('C6'), whole('r')] },
        { id: 'P2', name: 'Piano', measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) + notes({ p: 'C5', d: 2, type: 'half' }, { p: 'D5', d: 2, type: 'half' }), notes({ p: 'E5', d: 2, type: 'half' }, { p: 'F5', d: 2, type: 'half' })] },
      ],
    });
    const r = importMusicXml(xml);
    expect(check(r).staves[0].voices).toEqual(['C5/h D5 | E5 F5 |']);
    expect(r.warnings.join(' ')).toMatch(/Imported "Piano"/);
    const pair = score({
      title: 'Pair',
      parts: [
        { id: 'P1', name: '', measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }) + whole('E5')] },
        { id: 'P2', name: '', measures: [attributes({ divisions: 1, fifths: 0, time: [4, 4], clefs: [clef('F', 4)] }) + whole('C3')] },
      ],
    }).replace('<part-list>', '<part-list><part-group type="start" number="1"><group-symbol>brace</group-symbol></part-group>').replace('</part-list>', '<part-group type="stop" number="1"/></part-list>');
    expect(check(importMusicXml(pair)).staves.map(s => s.hand)).toEqual(['R', 'L']);
  });

  it('gives a cadenza bar longer than its time signature a time signature of its own', () => {
    const run = Array.from({ length: 12 }, (_, i) => ({ p: ['C5', 'D5', 'E5', 'F5'][i % 4], d: 1, type: 'eighth' }));
    const xml = simple([whole('C4'), notes(...run.map(n => ({ ...n, d: 0.5 }))), whole('G4')].map((m, i) => (i === 1 ? notes(...run.map(n => ({ ...n, d: 2 }))) : m)), attributes({ divisions: 4, fifths: 0, time: [4, 4], clefs: [clef('G', 2)] }));
    const r = importMusicXml(xml.replace(/<duration>4<\/duration>/g, '<duration>16</duration>'));
    const song = check(r);
    expect(song.staves[0].voices[0]).toMatch(/^C4\/w \| \[T:6\/4\] .* \| \[T:4\/4\] G4\/w \|$/);
    expect(r.warnings.join(' ')).toMatch(/Measure 2 is longer than the time signature/);
  });
});

describe('MusicXML import: compressed .mxl', () => {
  const xml = simple([notes({ p: 'C4', d: 2, type: 'half' }, { p: 'E4', d: 2, type: 'half' })]);
  const container = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="scores/song.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
  const enc = (s: string) => new TextEncoder().encode(s);

  it('reads the root file named in META-INF/container.xml (stored entries)', async () => {
    const bytes = zip([
      { name: 'mimetype', data: enc('application/vnd.recordare.musicxml'), raw: enc('application/vnd.recordare.musicxml'), method: 0 },
      { name: 'META-INF/container.xml', data: enc(container), raw: enc(container), method: 0 },
      { name: 'scores/song.musicxml', data: enc(xml), raw: enc(xml), method: 0 },
    ]);
    const r = await importMxl(bytes);
    expect(check(r).staves[0].voices).toEqual(['C4/h E4 |']);
  });

  it('inflates deflated entries', async () => {
    expect(typeof CompressionStream).toBe('function');
    const deflate = async (b: Uint8Array) => new Uint8Array(await new Response(new Blob([new Uint8Array(b)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const bytes = zip([
      { name: 'META-INF/container.xml', data: await deflate(enc(container)), raw: enc(container), method: 8 },
      { name: 'scores/song.musicxml', data: await deflate(enc(xml)), raw: enc(xml), method: 8 },
    ]);
    const r = await importMxl(bytes);
    expect(check(r).staves[0].voices).toEqual(['C4/h E4 |']);
  });

  it('reports a damaged archive as an import error', async () => {
    const bytes = zip([{ name: 'scores/song.musicxml', data: enc(xml), raw: enc(xml), method: 0 }]);
    await expect(importMxl(bytes.slice(0, bytes.length - 10))).rejects.toThrow(/can't be opened: This is not a ZIP archive/);
  });

  it('accepts uncompressed bytes too (UTF-16 with a byte-order mark)', async () => {
    const u16 = new Uint8Array(2 + xml.length * 2);
    u16[0] = 0xff;
    u16[1] = 0xfe;
    for (let i = 0; i < xml.length; i++) u16[2 + 2 * i] = xml.charCodeAt(i);
    const r = await importMxl(u16);
    expect(check(r).staves[0].voices).toEqual(['C4/h E4 |']);
  });
});
