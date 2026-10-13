import { describe, expect, it } from 'vitest';
import {
  CHORD_ROOTS,
  type FrettedVoicing,
  bassShapes,
  chartString,
  chordFingering,
  chordMidis,
  commonProgressions,
  frettedVoicings,
  malletVoicings,
  parseChart,
  pianoVoicings,
  validFourMallet,
} from './chordbook';
import { CHORD_QUALITIES, type ChordSymbol, chordName, parseChordSymbol, rootPc } from './chords';
import { MALLET_VARIANTS, TUNINGS } from './instruments';

const sym = parseChordSymbol;
const GUITAR = TUNINGS.guitar.open;
const UKE = TUNINGS.ukuleleHighG.open;

/** The easiest voicing as a chord chart, lowest string first ("x32010", "0003"). */
const first = (s: string, tuning: readonly number[]) => chartString(frettedVoicings(sym(s), tuning)[0].frets);
const firstVoicing = (s: string, tuning: readonly number[]) => frettedVoicings(sym(s), tuning)[0];

/** Pitch classes every voicing must contain (the quality's optional degrees may be omitted). */
const requiredPcs = (c: ChordSymbol) => c.quality.tones.filter(([, d]) => !c.quality.optional.includes(d)).map(([s]) => (rootPc(c.root) + s) % 12);

/** Fretting fingers in use, a barre counted once. */
const fingersUsed = (v: FrettedVoicing) => new Set(v.fingers.filter((f): f is number => f !== null && f > 0)).size;

const fretSpan = (v: FrettedVoicing) => {
  const f = v.frets.filter((x): x is number => x !== null && x > 0);
  return f.length ? Math.max(...f) - Math.min(...f) : 0;
};

/** Structural problems with a fretted voicing (empty when it is fine). */
function voicingProblems(v: FrettedVoicing, c: ChordSymbol, tuning: readonly number[]): string[] {
  const out: string[] = [];
  const sounding = v.frets.map((f, i) => (f === null ? null : tuning[i] + f)).filter((m): m is number => m !== null);
  if (v.midis.join() !== [...sounding].sort((a, b) => a - b).join()) out.push('midis do not match the frets');
  const pcs = new Set(v.midis.map(m => m % 12));
  for (const pc of requiredPcs(c)) if (!pcs.has(pc)) out.push(`missing pitch class ${pc}`);
  if (c.bass && !pcs.has(rootPc(c.bass))) out.push('slash bass missing');
  if (fretSpan(v) > 4) out.push(`spans ${fretSpan(v) + 1} frets`);
  if (fingersUsed(v) > 4) out.push(`${fingersUsed(v)} fingers`);
  v.frets.forEach((f, i) => {
    const finger = v.fingers[i];
    if (f === null ? finger !== null : f === 0 ? finger !== 0 : !(finger !== null && finger >= 1 && finger <= 4)) out.push(`bad finger on string ${i + 1}`);
    if ((v.degrees[i] === null) !== (f === null)) out.push(`bad degree on string ${i + 1}`);
  });
  // fingers never cross: a higher finger is never on a lower fret
  const fretted = v.frets.map((f, i) => ({ f: f ?? 0, finger: v.fingers[i] ?? 0 })).filter(x => x.f > 0);
  for (const a of fretted) for (const b of fretted) if (a.finger < b.finger && a.f > b.f) out.push('crossed fingers');
  for (const b of v.barres) {
    for (let s = b.toString; s <= b.fromString; s++) {
      const f = v.frets[s - 1];
      if (f === null || f < b.fret) out.push(`barre at ${b.fret} over string ${s} (${f ?? 'x'})`);
    }
  }
  if (!(v.ease >= 0 && v.ease <= 1)) out.push(`ease ${v.ease}`);
  return out;
}

describe('chord charts', () => {
  it('converts chart strings to string-1-first frets and back', () => {
    expect(parseChart('x32010')).toEqual([0, 1, 0, 2, 3, null]);
    expect(parseChart('0003')).toEqual([3, 0, 0, 0]);
    expect(parseChart('x-3-2-0-1-0')).toEqual([0, 1, 0, 2, 3, null]);
    expect(chartString([0, 1, 0, 2, 3, null])).toBe('x32010');
    expect(chartString(parseChart('8-10-10-9-8-8'))).toBe('8-10-10-9-8-8');
  });
});

describe('guitar voicings', () => {
  const shapes: [string, string[]][] = [
    ['C', ['x32010']],
    ['A', ['x02220']],
    ['G', ['320003', '320033']],
    ['E', ['022100']],
    ['D', ['xx0232']],
    ['Am', ['x02210']],
    ['Em', ['022000']],
    ['Dm', ['xx0231']],
    ['E7', ['020100']],
    ['A7', ['x02020']],
    ['D7', ['xx0212']],
    ['G7', ['320001']],
    ['C7', ['x32310']],
    ['B7', ['x21202']],
    ['Cmaj7', ['x32000']],
    ['Fmaj7', ['xx3210']],
    ['Am7', ['x02010']],
    ['Asus4', ['x02230']],
    ['Dsus2', ['xx0230']],
    ['F', ['133211', 'xx3211']],
    ['Bm', ['x24432']],
    ['Bb', ['x13331']],
  ];
  it.each(shapes)('%s: the standard chart shape comes first', (s, want) => {
    expect(want).toContain(first(s, GUITAR));
  });

  it('fingers open chords like the charts', () => {
    // C: 3rd finger on the A string, 2nd on the D string, 1st on the B string
    expect(firstVoicing('C', GUITAR).fingers).toEqual([0, 1, 0, 2, 3, null]);
    expect(chartString(firstVoicing('G', GUITAR).fingers)).toBe('210003');
    expect(chartString(firstVoicing('D', GUITAR).fingers)).toBe('xx0132');
    expect(chartString(firstVoicing('E', GUITAR).fingers)).toBe('023100');
    expect(chartString(firstVoicing('Am', GUITAR).fingers)).toBe('x02310');
    expect(chartString(firstVoicing('Em', GUITAR).fingers)).toBe('023000');
    expect(chartString(firstVoicing('C7', GUITAR).fingers)).toBe('x32410');
    expect(firstVoicing('C', GUITAR).barres).toEqual([]);
    expect(firstVoicing('A', GUITAR).barres).toEqual([]);
  });

  it('detects barres', () => {
    const f = firstVoicing('F', GUITAR);
    if (chartString(f.frets) === '133211') {
      expect(f.barres).toEqual([{ fret: 1, fromString: 6, toString: 1, finger: 1 }]);
      expect(chartString(f.fingers)).toBe('134211');
      expect(f.label).toBe('Barre (E shape)');
    } else {
      expect(f.barres).toEqual([{ fret: 1, fromString: 2, toString: 1, finger: 1 }]);
    }
    const bb = firstVoicing('Bb', GUITAR);
    expect(bb.barres).toEqual([{ fret: 1, fromString: 5, toString: 1, finger: 1 }]);
    expect(chartString(bb.fingers)).toBe('x12341');
    expect(bb.label).toBe('Barre (A shape)');
    const bm = firstVoicing('Bm', GUITAR);
    expect(bm.barres).toEqual([{ fret: 2, fromString: 5, toString: 1, finger: 1 }]);
    expect(bm.baseFret).toBe(1);
    // C9: ring-finger barre across the top three strings
    const c9 = firstVoicing('C9', GUITAR);
    expect(chartString(c9.frets)).toBe('x32333');
    expect(c9.barres).toEqual([{ fret: 3, fromString: 3, toString: 1, finger: 3 }]);
  });

  it('labels and positions voicings up the neck', () => {
    const c = frettedVoicings(sym('C'), GUITAR);
    expect(c[0].label).toBe('Open');
    expect(c[0].baseFret).toBe(1);
    const eShape = c.find(v => chartString(v.frets) === '8-10-10-9-8-8');
    expect(eShape?.label).toBe('Barre (E shape)');
    expect(eShape?.baseFret).toBe(8);
    // a diverse list: something above the 5th fret, no duplicates
    expect(c.some(v => v.baseFret >= 5)).toBe(true);
    expect(new Set(c.map(v => chartString(v.frets))).size).toBe(c.length);
    // easiest first
    for (let i = 1; i < c.length; i++) expect(c[i].ease).toBeLessThanOrEqual(c[i - 1].ease);
  });

  it('labels each string with its chord degree', () => {
    expect(firstVoicing('C', GUITAR).degrees).toEqual(['3', 'R', '5', '3', 'R', null]);
    // 320001 from string 1: F, B, G, D, B, G
    expect(firstVoicing('G7', GUITAR).degrees).toEqual(['♭7', '3', 'R', '5', '3', 'R']);
  });

  it('puts the slash bass lowest', () => {
    const ce = frettedVoicings(sym('C/E'), GUITAR);
    expect(chartString(ce[0].frets)).toBe('032010');
    for (const v of ce) {
      expect(v.midis[0] % 12).toBe(4);
      expect(v.bassIsRoot).toBe(false);
    }
    const lowestString = ce[0].frets.map((f, i) => (f === null ? -1 : i)).reduce((a, b) => Math.max(a, b));
    expect(ce[0].degrees[lowestString]).toBe('3');
    for (const v of frettedVoicings(sym('D/F#'), GUITAR)) expect(v.midis[0] % 12).toBe(6);
    expect(first('Am/G', GUITAR)).toBe('302210');
    // a bass note outside the chord
    const cd = frettedVoicings(sym('C/D'), GUITAR);
    expect(cd.length).toBeGreaterThan(0);
    for (const v of cd) expect(v.midis[0] % 12).toBe(2);
  });

  it('keeps the root in the bass unless inversions are allowed', () => {
    for (const v of frettedVoicings(sym('C'), GUITAR)) expect(v.bassIsRoot).toBe(true);
    const inv = frettedVoicings(sym('C'), GUITAR, { allowInversions: true, max: 30 });
    expect(inv[0].bassIsRoot).toBe(true);
    expect(inv.some(v => !v.bassIsRoot)).toBe(true);
  });

  it('honours max, maxFret and span', () => {
    expect(frettedVoicings(sym('G'), GUITAR, { max: 3 })).toHaveLength(3);
    for (const v of frettedVoicings(sym('G'), GUITAR, { maxFret: 5 })) expect(Math.max(...v.frets.map(f => f ?? 0))).toBeLessThanOrEqual(5);
    for (const v of frettedVoicings(sym('G'), GUITAR, { span: 3 })) expect(fretSpan(v)).toBeLessThanOrEqual(2);
  });
});

describe('ukulele voicings', () => {
  const shapes: [string, string[]][] = [
    ['C', ['0003']],
    ['Am', ['2000']],
    ['F', ['2010']],
    ['G', ['0232']],
    ['G7', ['0212']],
    ['C7', ['0001']],
    ['D', ['2220']],
    ['Dm', ['2210']],
    ['Em', ['0432']],
    ['A', ['2100']],
    ['A7', ['0100']],
    ['E7', ['1202']],
    ['Bb', ['3211']],
    ['Fmaj7', ['2413', '5500']],
    ['D7', ['2223', '2020']],
    ['Cmaj7', ['0002']],
    ['E', ['4442', '1402']],
  ];
  it.each(shapes)('%s: the standard chart shape comes first (high-G)', (s, want) => {
    expect(want).toContain(first(s, UKE));
  });

  it('uses the same shapes in low-G tuning', () => {
    for (const [s, want] of shapes) expect(want, s).toContain(first(s, TUNINGS.ukuleleLowG.open));
  });

  it('gives baritone ukulele the guitar’s top-four-string shapes', () => {
    const bari = TUNINGS.ukuleleBaritone.open;
    expect(first('G', bari)).toBe('0003');
    expect(first('C', bari)).toBe('2010');
    expect(first('D', bari)).toBe('0232');
    expect(first('Em', bari)).toBe('2000');
    expect(first('F', bari)).toBe('3211');
  });

  it('fingers and barres ukulele chords', () => {
    expect(chartString(firstVoicing('C', UKE).fingers)).toBe('0003'); // ring finger
    expect(chartString(firstVoicing('Am', UKE).fingers)).toBe('2000'); // middle finger
    expect(chartString(firstVoicing('G', UKE).fingers)).toBe('0132');
    expect(chartString(firstVoicing('Em', UKE).fingers)).toBe('0321');
    const bb = firstVoicing('Bb', UKE);
    expect(bb.barres).toEqual([{ fret: 1, fromString: 2, toString: 1, finger: 1 }]);
    expect(chartString(bb.fingers)).toBe('3211');
    const d7 = firstVoicing('D7', UKE);
    if (chartString(d7.frets) === '2223') expect(d7.barres).toEqual([{ fret: 2, fromString: 4, toString: 2, finger: 1 }]);
    // three notes on one fret: separate fingers, no barre needed
    expect(firstVoicing('D', UKE).barres).toEqual([]);
  });

  it('prefers the slash bass lowest but keeps re-entrant voicings practical', () => {
    const ce = firstVoicing('C/E', UKE);
    expect(ce.midis[0] % 12).toBe(4);
    // B can only be the lowest note of G/B high up the neck: the open G shape (which has a B) wins
    expect(first('G/B', UKE)).toBe('0232');
    for (const v of frettedVoicings(sym('G/B'), UKE)) expect(v.midis.some(m => m % 12 === 11)).toBe(true);
  });
});

describe('every chord on every fretted instrument', () => {
  const tunings: [string, readonly number[]][] = [
    ['guitar', GUITAR],
    ['ukulele high-G', UKE],
    ['ukulele low-G', TUNINGS.ukuleleLowG.open],
    ['baritone ukulele', TUNINGS.ukuleleBaritone.open],
  ];
  it.each(tunings)('%s: every quality × root has a playable voicing with all required tones', (name, tuning) => {
    const problems: string[] = [];
    for (const quality of CHORD_QUALITIES) {
      for (const root of CHORD_ROOTS) {
        const c: ChordSymbol = { root, quality };
        const vs = frettedVoicings(c, tuning);
        if (!vs.length) problems.push(`${chordName(c)}: no voicing`);
        for (const v of vs) {
          const p = voicingProblems(v, c, tuning);
          if (name === 'guitar') {
            if (!v.bassIsRoot) p.push('root not in the bass');
            if (v.midis.length < (quality.tones.length >= 4 ? 4 : 3)) p.push(`only ${v.midis.length} strings`);
          } else if (v.midis.length < 3) p.push(`only ${v.midis.length} strings`);
          for (const x of p) problems.push(`${chordName(c)} ${chartString(v.frets)}: ${x}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it.each([
    ['4-string bass', TUNINGS.bass4.open],
    ['5-string bass', TUNINGS.bass5.open],
  ])('%s: every quality × root has a 2–4 note shape with the root in the bass', (_name, tuning) => {
    const problems: string[] = [];
    for (const quality of CHORD_QUALITIES) {
      for (const root of CHORD_ROOTS) {
        const c: ChordSymbol = { root, quality };
        const vs = frettedVoicings(c, tuning);
        if (!vs.length) problems.push(`${chordName(c)}: no voicing`);
        for (const v of vs) {
          const label = `${chordName(c)} ${chartString(v.frets)}`;
          if (!v.bassIsRoot) problems.push(`${label}: root not in the bass`);
          if (v.midis.length < 2) problems.push(`${label}: one note`);
          if (fingersUsed(v) > 4) problems.push(`${label}: too many fingers`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('bass guitar', () => {
  const BASS = TUNINGS.bass4.open;

  it('offers small chord shapes with the root lowest', () => {
    const g = frettedVoicings(sym('G'), BASS);
    expect(g[0].bassIsRoot).toBe(true);
    expect(g[0].midis.length).toBeGreaterThanOrEqual(2);
    expect(g[0].midis.length).toBeLessThanOrEqual(4);
    expect(['02xx', '022x']).toContain(first('E5', BASS));
  });

  it('builds one-position arpeggio boxes', () => {
    const shapes = bassShapes(sym('G'), BASS);
    expect(shapes.map(s => s.name)).toEqual(['Root on E string', 'Root on A string', 'Root–5th–octave']);
    // G major from the E string: root under the 2nd finger, 3rd behind it on the A string
    expect(shapes[0].positions).toEqual([
      { string: 4, fret: 3, degree: 'R', finger: 2 },
      { string: 3, fret: 2, degree: '3', finger: 1 },
      { string: 3, fret: 5, degree: '5', finger: 4 },
      { string: 2, fret: 5, degree: 'R', finger: 4 },
    ]);
    expect(shapes[2].positions.map(p => p.degree)).toEqual(['R', '5', 'R']);
    expect(shapes[2].positions.map(p => `${p.string}:${p.fret}`)).toEqual(['4:3', '3:5', '2:5']);
    for (const s of shapes) {
      const midis = s.positions.map(p => BASS[p.string - 1] + p.fret);
      expect(midis).toEqual([...midis].sort((a, b) => a - b));
      const fretted = s.positions.filter(p => p.fret > 0).map(p => p.fret);
      expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
    }
  });

  it('includes sevenths and minor thirds, and roots on the B string of a 5-string', () => {
    const g7 = bassShapes(sym('G7'), BASS)[0];
    expect(g7.positions.map(p => p.degree)).toEqual(['R', '3', '5', '♭7', 'R']);
    const gm = bassShapes(sym('Gm'), BASS)[0];
    expect(gm.positions.map(p => p.degree)).toContain('♭3');
    expect(bassShapes(sym('G'), TUNINGS.bass5.open).map(s => s.name)).toContain('Root on B string');
    for (const quality of CHORD_QUALITIES) {
      for (const root of CHORD_ROOTS) expect(bassShapes({ root, quality }, BASS).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('piano voicings', () => {
  const names = (s: string) => pianoVoicings(sym(s)).map(v => v.name);
  const voicing = (s: string, name: string) => pianoVoicings(sym(s)).find(v => v.name === name)!;

  it('voices C in root position and both inversions around middle C', () => {
    expect(names('C')).toEqual(['Root position', '1st inversion', '2nd inversion', 'With bass note']);
    expect(voicing('C', 'Root position')).toEqual({ name: 'Root position', rh: [60, 64, 67], rhFingers: [1, 3, 5], lh: [48, 52, 55], lhFingers: [5, 3, 1] });
    expect(voicing('C', '1st inversion')).toMatchObject({ rh: [64, 67, 72], rhFingers: [1, 2, 5], lhFingers: [5, 3, 1] });
    expect(voicing('C', '2nd inversion')).toMatchObject({ rh: [55, 60, 64], rhFingers: [1, 3, 5], lhFingers: [5, 2, 1] });
    expect(voicing('C', 'With bass note')).toMatchObject({ rh: [60, 64, 67], lh: [48], lhFingers: [5] });
  });

  it('voices Am', () => {
    expect(voicing('Am', 'Root position')).toMatchObject({ rh: [57, 60, 64], rhFingers: [1, 3, 5], lhFingers: [5, 3, 1] });
    expect(voicing('Am', '1st inversion')).toMatchObject({ rh: [60, 64, 69], rhFingers: [1, 2, 5], lhFingers: [5, 3, 1] });
    expect(voicing('Am', '2nd inversion')).toMatchObject({ rh: [64, 69, 72], rhFingers: [1, 3, 5], lhFingers: [5, 2, 1] });
  });

  it('voices sevenths: G7 and Cmaj7 with all inversions', () => {
    expect(names('G7')).toEqual(['Root position', '1st inversion', '2nd inversion', '3rd inversion', 'With bass note']);
    expect(voicing('G7', 'Root position')).toMatchObject({ rh: [55, 59, 62, 65], rhFingers: [1, 2, 3, 5], lh: [43, 47, 50, 53], lhFingers: [5, 3, 2, 1] });
    expect(voicing('G7', '1st inversion')).toMatchObject({ rh: [59, 62, 65, 67], rhFingers: [1, 2, 4, 5] });
    expect(voicing('G7', '2nd inversion')).toMatchObject({ rh: [62, 65, 67, 71], rhFingers: [1, 2, 3, 5] });
    expect(voicing('G7', '3rd inversion')).toMatchObject({ rh: [65, 67, 71, 74], rhFingers: [1, 2, 4, 5], lhFingers: [5, 4, 2, 1] });
    expect(voicing('Cmaj7', 'Root position')).toMatchObject({ rh: [60, 64, 67, 71], rhFingers: [1, 2, 3, 5], lhFingers: [5, 3, 2, 1] });
    // the half step B–C goes to fingers 4–5 (RH) / 2–1 (LH)
    expect(voicing('Cmaj7', '1st inversion')).toMatchObject({ rh: [64, 67, 71, 72], rhFingers: [1, 2, 4, 5], lhFingers: [5, 4, 2, 1] });
    expect(voicing('Cmaj7', '3rd inversion')).toMatchObject({ rh: [59, 60, 64, 67], rhFingers: [1, 2, 4, 5] });
  });

  it('puts the slash bass under the chord first', () => {
    const v = pianoVoicings(sym('C/E'));
    expect(v[0]).toMatchObject({ rh: [60, 64, 67], lh: [40], lhFingers: [5] });
    expect(v[0].name).toContain('E');
  });

  it('keeps every hand to five notes within a ninth, for every chord', () => {
    const problems: string[] = [];
    for (const quality of CHORD_QUALITIES) {
      for (const root of CHORD_ROOTS) {
        const c: ChordSymbol = { root, quality };
        const vs = pianoVoicings(c);
        if (vs.filter(v => v.name === 'Root position').length !== 1) problems.push(`${chordName(c)}: no single root position`);
        if (!vs.some(v => v.name.includes('inversion'))) problems.push(`${chordName(c)}: no inversion`);
        for (const v of vs) {
          const label = `${chordName(c)} ${v.name}`;
          for (const [notes, fingers, hand] of [[v.rh, v.rhFingers, 'R'], [v.lh, v.lhFingers, 'L']] as const) {
            if (notes.length > 5 || fingers.length !== notes.length) problems.push(`${label} ${hand}: ${notes.length} notes, ${fingers.length} fingers`);
            if (notes[notes.length - 1] - notes[0] > 14) problems.push(`${label} ${hand}: spans ${notes[notes.length - 1] - notes[0]}`);
            for (let i = 1; i < notes.length; i++) {
              if (notes[i] <= notes[i - 1]) problems.push(`${label} ${hand}: not ascending`);
              if (hand === 'R' ? fingers[i] <= fingers[i - 1] : fingers[i] >= fingers[i - 1]) problems.push(`${label} ${hand}: fingers ${fingers}`);
            }
          }
          // the bass note is an octave or two below the right hand
          if (v.lh.length === 1 && (v.rh[0] - v.lh[0] < 12 || v.rh[0] - v.lh[0] > 24)) problems.push(`${label}: bass ${v.lh[0]}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('fingers chords in either hand', () => {
    expect(chordFingering([60, 64, 67], 'R')).toEqual([1, 3, 5]);
    expect(chordFingering([48, 52, 55], 'L')).toEqual([5, 3, 1]);
    expect(chordFingering([48, 55], 'L')).toEqual([5, 1]);
  });
});

describe('mallet voicings', () => {
  it('voices C for four mallets and two', () => {
    const v = malletVoicings(sym('C'));
    expect(v.find(x => x.name === 'Close, root position')).toEqual({ name: 'Close, root position', midis: [60, 64, 67, 72], mallets: [1, 2, 3, 4], count: 4 });
    expect(v.find(x => x.name === 'Open (spread)')?.midis).toEqual([60, 67, 72, 76]);
    expect(v.find(x => x.name.startsWith('Double stop'))).toMatchObject({ midis: [60, 64], mallets: [2, 3], count: 2 });
    const arp = v.find(x => x.name.startsWith('Arpeggio'))!;
    expect(arp.midis).toEqual([60, 64, 67, 72]);
    expect(arp.mallets).toEqual([3, 2, 3, 2]); // R L R L
    expect(arp.count).toBe(2);
  });

  it('uses all four tones of a seventh chord, and 3 + 7 double stops', () => {
    const v = malletVoicings(sym('G7'));
    for (const x of v.filter(y => y.count === 4)) expect(new Set(x.midis.map(m => m % 12))).toEqual(new Set([7, 11, 2, 5]));
    expect(v.find(x => x.name === 'Double stop (3 + ♭7)')?.midis).toEqual([71, 77]);
  });

  it('adds a grand voicing with the left hand in the bass when the range allows', () => {
    expect(malletVoicings(sym('C')).some(v => v.name.startsWith('Grand'))).toBe(false);
    const grand = malletVoicings(sym('C'), { low: 45, high: 96 }).find(v => v.name.startsWith('Grand'))!;
    expect(grand.midis).toEqual([48, 55, 64, 72]);
    expect(validFourMallet(grand.midis)).toBe(true);
  });

  it('applies the hand-interval rule', () => {
    expect(validFourMallet([60, 64, 67, 72])).toBe(true);
    expect(validFourMallet([48, 62, 64, 67])).toBe(false); // left hand wider than an octave
    expect(validFourMallet([60, 60, 64, 67])).toBe(false); // unison in one hand
    expect(validFourMallet([60, 67, 64, 72])).toBe(false); // crossed hands
  });

  const ranges: [string, number, number][] = [
    ['default C4–C6', 60, 84],
    ...Object.values(MALLET_VARIANTS).map(v => [v.name, v.low, v.high] as [string, number, number]),
  ];
  it.each(ranges)('%s: every chord has valid voicings inside the range', (_name, low, high) => {
    const problems: string[] = [];
    for (const quality of CHORD_QUALITIES) {
      for (const root of CHORD_ROOTS) {
        const c: ChordSymbol = { root, quality };
        const vs = malletVoicings(c, { low, high });
        const pcs = requiredPcs(c);
        if (!vs.some(v => v.count === 4)) problems.push(`${chordName(c)}: no four-mallet voicing`);
        if (!vs.some(v => v.count === 2)) problems.push(`${chordName(c)}: no two-mallet voicing`);
        for (const v of vs) {
          const label = `${chordName(c)} ${v.name} ${v.midis}`;
          if (v.mallets.length !== v.midis.length) problems.push(`${label}: mallets ${v.mallets}`);
          if (v.midis.some(m => m < low || m > high)) problems.push(`${label}: out of range`);
          if (v.count === 4) {
            if (!validFourMallet(v.midis)) problems.push(`${label}: breaks the hand-interval rule`);
            if (v.mallets.join() !== '1,2,3,4') problems.push(`${label}: mallets ${v.mallets}`);
            for (const pc of pcs) if (!v.midis.some(m => m % 12 === pc)) problems.push(`${label}: missing pitch class ${pc}`);
          } else {
            if (!v.mallets.every(m => m === 2 || m === 3)) problems.push(`${label}: mallets ${v.mallets}`);
            if (v.midis.length === 2 && v.midis[0] >= v.midis[1]) problems.push(`${label}: left hand not below right`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('playback, roots and progressions', () => {
  it('voices chords for playback', () => {
    expect(chordMidis(sym('C'))).toEqual([60, 64, 67]);
    expect(chordMidis(sym('G7'))).toEqual([55, 59, 62, 65]);
    expect(chordMidis(sym('C/E'))).toEqual([52, 60, 64, 67]);
    expect(chordMidis(sym('F#m'), 64)).toEqual([66, 69, 73]);
  });

  it('spells the twelve roots like a chord chart', () => {
    expect(CHORD_ROOTS.map(r => chordName({ root: r, quality: CHORD_QUALITIES[0] }))).toEqual(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']);
    expect(new Set(CHORD_ROOTS.map(rootPc)).size).toBe(12);
  });

  it('lists common progressions with valid chords', () => {
    for (const p of commonProgressions) {
      expect(p.chords.length, p.name).toBeGreaterThanOrEqual(3);
      for (const c of [...p.chords, ...(p.bars ?? [])]) expect(() => sym(c), `${p.name}: ${c}`).not.toThrow();
      for (const c of p.bars ?? []) expect(p.chords, p.name).toContain(c);
    }
    const find = (name: string, key: string) => commonProgressions.find(p => p.name.includes(name) && p.key === key)?.chords;
    for (const key of ['C', 'G', 'D']) expect(find('I–V–vi–IV', key)).toBeDefined();
    expect(find('I–V–vi–IV', 'C')).toEqual(['C', 'G', 'Am', 'F']);
    expect(find('I–vi–IV–V', 'C')).toEqual(['C', 'Am', 'F', 'G']);
    expect(find('ii–V–I', 'C')).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(find('ii–V–I', 'F')).toEqual(['Gm7', 'C7', 'Fmaj7']);
    expect(find('12-bar blues', 'A')).toHaveLength(4);
    expect(find('12-bar blues', 'E')).toHaveLength(4);
    expect(commonProgressions.find(p => p.name.includes('12-bar') && p.key === 'A')?.bars).toHaveLength(12);
    expect(find('Pachelbel', 'D')).toBeDefined();
    expect(find('i–VI–III–VII', 'Am')).toEqual(['Am', 'F', 'C', 'G']);
    expect(find('Three-chord', 'G')).toEqual(['G', 'C', 'D']);
    expect(find('Ukulele', 'C')).toEqual(['C', 'Am', 'F', 'G7']);
  });
});
