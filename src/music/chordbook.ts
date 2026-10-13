/**
 * The chord book: any chord symbol, voiced for every instrument the app teaches.
 *
 *   frettedVoicings – chord diagrams for guitar, ukulele (high-G, low-G, baritone) and
 *                     bass guitar, searched over the whole neck and ranked by ease
 *   bassShapes      – one-position arpeggio boxes and the root–fifth–octave box for bass
 *   pianoVoicings   – root position and inversions with standard fingering, plus bass
 *   malletVoicings  – four-mallet voicings, two-mallet double stops and an arpeggio
 *   chordMidis      – a plain close-position voicing for playback
 *
 * Fretted arrays are string-1-first like the rest of the fretted model (index 0 = the
 * highest course). Chord charts print the other way round – lowest string first, as in
 * "x32010" or the ukulele's "0003" (G C E A) – so `parseChart` / `chartString` convert
 * between the two.
 *
 * Fretted search: for every window of `span` frets the engine chooses, string by string,
 * a mute, the open string (when it is a chord tone) or a chord tone fretted inside the
 * window. Candidates must contain every required tone (the quality's `optional` degrees
 * may be left out), sound enough strings and be fingerable with four fingers (a barre
 * counts as one). On guitar and bass the root – or the slash bass – must be the lowest
 * note; on ukulele, whose re-entrant tunings rarely allow that, it is only a preference
 * (a slash bass must still sound). Candidates are ranked by a cost model: fingers and
 * barres, stretch, position on the neck, muted strings (bass-side mutes are cheap,
 * interior mutes expensive), doubled thirds and sevenths, omitted fifths, unisons.
 * Shapes from the standard chord-chart library (open chords and their movable barre
 * forms – the CAGED E and A shapes above all) get a bonus, which is what "common shapes
 * first" means.
 */
import { type ChordQuality, type ChordRoot, type ChordSymbol, type ChordTone, chordDegreeLabels, parseChordSymbol, rootPc } from './chords';
import { stringsLowToHigh } from './guitar';
import { INSTRUMENTS } from './instruments';
import { spellMidi, stepLabel } from './pitch';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** The twelve roots, spelled the way chord charts usually name them. */
export const CHORD_ROOTS: ChordRoot[] = [
  { step: 'C', alter: 0 },
  { step: 'D', alter: -1 },
  { step: 'D', alter: 0 },
  { step: 'E', alter: -1 },
  { step: 'E', alter: 0 },
  { step: 'F', alter: 0 },
  { step: 'F', alter: 1 },
  { step: 'G', alter: 0 },
  { step: 'A', alter: -1 },
  { step: 'A', alter: 0 },
  { step: 'B', alter: -1 },
  { step: 'B', alter: 0 },
];

/** Interval names by semitone, for notes that are not chord tones (e.g. a slash bass). */
const INTERVAL_LABELS = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'];

const mod12 = (x: number) => ((x % 12) + 12) % 12;

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Degree label ("R", "♭3", "5", "♭7", "9" …) for a pitch class within a chord. */
function degreeLabelFor(chord: ChordSymbol, pc: number): string {
  const r = rootPc(chord.root);
  const labels = chordDegreeLabels(chord.quality);
  const i = chord.quality.tones.findIndex(([s]) => mod12(r + s) === pc);
  return i >= 0 ? labels[i] : INTERVAL_LABELS[mod12(pc - r)];
}

/**
 * Convert a chord chart ("x32010", "x-3-2-0-1-0", "10 12 12 11 10 10" – lowest string
 * first) into string-1-first frets (null = not played).
 */
export function parseChart(chart: string): (number | null)[] {
  const t = chart.trim();
  const tokens = /[\s,-]/.test(t) ? t.split(/[\s,-]+/).filter(Boolean) : [...t];
  return tokens.map(x => (x.toLowerCase() === 'x' ? null : Number(x))).reverse();
}

/** String-1-first frets → chord chart ("x32010"; frets of 10+ are dash-separated). */
export function chartString(frets: readonly (number | null)[]): string {
  const low = [...frets].reverse();
  const sep = low.some(f => f !== null && f >= 10) ? '-' : '';
  return low.map(f => (f === null ? 'x' : String(f))).join(sep);
}

// ---------------------------------------------------------------------------
// Fretted voicings
// ---------------------------------------------------------------------------

export type FrettedInstrument = 'guitar' | 'ukulele' | 'bass';

export interface FrettedBarre {
  fret: number;
  /** Bass-side string of the barre (the higher string number). */
  fromString: number;
  /** Treble-side string of the barre. */
  toString: number;
  finger: number;
}

export interface FrettedVoicing {
  /** fret per string, index 0 = string 1 (highest course); null = not played (x) */
  frets: (number | null)[];
  /** fretting finger per string (1-4), 0 = open, null = not played */
  fingers: (number | null)[];
  /** index-finger (or other) barres: fret, from string, to string (string numbers, inclusive) */
  barres: FrettedBarre[];
  /** lowest fret shown in a 4–5 fret diagram window (1 = at the nut) */
  baseFret: number;
  /** MIDI notes sounding, low → high */
  midis: number[];
  /** degree label per string ("R", "3", "♭7", …) or null */
  degrees: (string | null)[];
  bassIsRoot: boolean;
  /** 0..1 — how standard/easy (for sorting and "easiest" badges) */
  ease: number;
  /** e.g. "Open", "Barre (E shape)", "3rd position" */
  label: string;
}

export interface FrettedVoicingOptions {
  /** Highest fret searched (default: the instrument's last fret). */
  maxFret?: number;
  /** Frets covered by the hand (default 4; 5 on ukulele). */
  span?: number;
  /** How many voicings to return (default 8). */
  max?: number;
  /** Allow a chord tone other than the root in the bass (guitar and bass; ranked lower). */
  allowInversions?: boolean;
  /** Defaults from the tuning: 6+ strings → guitar, low 4/5 strings → bass, otherwise ukulele. */
  instrument?: FrettedInstrument;
}

/** Guess the instrument from a tuning. */
export function fretInstrumentFor(tuning: readonly number[]): FrettedInstrument {
  if (tuning.length >= 6) return 'guitar';
  return Math.max(...tuning) <= 50 ? 'bass' : 'ukulele';
}

// ---- standard shape library --------------------------------------------------

/** Standard open-position guitar chords as printed in chord charts (lowest string first). */
const GUITAR_SHAPES: [string, string][] = [
  ['C', 'x32010'], ['A', 'x02220'], ['G', '320003'], ['E', '022100'], ['D', 'xx0232'],
  ['Am', 'x02210'], ['Em', '022000'], ['Dm', 'xx0231'],
  ['C7', 'x32310'], ['A7', 'x02020'], ['G7', '320001'], ['E7', '020100'], ['D7', 'xx0212'], ['B7', 'x21202'],
  ['Cmaj7', 'x32000'], ['Amaj7', 'x02120'], ['Gmaj7', '320002'], ['Emaj7', '021100'], ['Dmaj7', 'xx0222'], ['Fmaj7', 'xx3210'],
  ['Am7', 'x02010'], ['Em7', '020000'], ['Dm7', 'xx0211'],
  ['Asus4', 'x02230'], ['Dsus4', 'xx0233'], ['Esus4', '022200'], ['Asus2', 'x02200'], ['Dsus2', 'xx0230'],
  ['A7sus4', 'x02030'], ['E7sus4', '020200'],
  ['C6', 'x32210'], ['A6', 'x02222'], ['D6', 'xx0202'], ['E6', '022120'], ['G6', '320000'],
  ['Am6', 'x02212'], ['Dm6', 'xx0201'], ['Em6', '022020'],
  ['Cadd9', 'x32030'], ['Am(maj7)', 'x02110'], ['Em(maj7)', '021000'],
  ['E9', '020102'], ['C9', 'x32333'], ['E7#9', 'x7678x'],
  ['E5', '022xxx'], ['A5', 'x022xx'], ['D5', 'xx023x'],
  ['Bm7b5', 'x2323x'], ['Bdim', 'x2343x'], ['Ddim7', 'xx0101'], ['Caug', 'x32110'],
];

/** Standard ukulele chords (G C E A, lowest-printed first) – the same for high-G and low-G. */
const UKULELE_SHAPES: [string, string][] = [
  ['C', '0003'], ['Am', '2000'], ['F', '2010'], ['G', '0232'], ['G7', '0212'], ['C7', '0001'],
  ['D', '2220'], ['Dm', '2210'], ['Em', '0432'], ['A', '2100'], ['A7', '0100'], ['E7', '1202'],
  ['Bb', '3211'], ['Fmaj7', '2413'], ['D7', '2223'], ['Cmaj7', '0002'], ['E', '1402'],
  ['Am7', '0000'], ['C6', '0000'], ['Dm7', '2213'], ['F6', '2213'], ['Gm', '0231'], ['Cm', '0333'],
  ['Fm', '1013'], ['Bm', '4222'], ['Em7', '0202'], ['G6', '0202'], ['Gmaj7', '0222'], ['Gm7', '0211'],
  ['F7', '2313'], ['B7', '2322'], ['Bb7', '1211'], ['Cm7', '3333'],
  ['Csus4', '0013'], ['Gsus4', '0233'], ['Csus2', '0233'], ['Dsus4', '0230'], ['Asus4', '2200'], ['Dsus2', '2200'],
  ['Cadd9', '0203'], ['Cdim7', '2323'], ['Caug', '1003'],
  ['Eb', '0331'], ['Ab', '5343'], ['Db', '1114'], ['F#', '3121'], ['B', '4322'], ['F#m', '2120'], ['C#m', '1104'], ['Bbm', '3111'],
];

interface ShapeDef {
  quality: string;
  root: number;
  /** string-1-first, -1 = muted */
  frets: number[];
  /** Name of the shape when it is moved up the neck ("E", "A", "C" …). */
  shape: string;
  /** Ranking bonus when the shape is moved up the neck as a barre / closed form. */
  moveBonus: number;
}

/** Ranking bonus for the chart chord itself (the open C, the ukulele's B♭ 3211 …). */
const CHART_BONUS = 2.5;

function defsFrom(list: [string, string][], moveBonus: (letter: string) => number, strings?: number): ShapeDef[] {
  const out: ShapeDef[] = [];
  for (const [sym, chart] of list) {
    const c = parseChordSymbol(sym);
    let frets = parseChart(chart).map(f => (f === null ? -1 : f));
    if (strings !== undefined) frets = frets.slice(0, strings);
    if (frets.filter(f => f >= 0).length < 3) continue;
    out.push({ quality: c.quality.id, root: rootPc(c.root), frets, shape: stepLabel(c.root.step, c.root.alter), moveBonus: moveBonus(c.root.step) });
  }
  return out;
}

let LIBRARIES: Record<'guitar' | 'ukulele' | 'baritone', ShapeDef[]> | null = null;

function shapeLibrary(tuning: readonly number[]): ShapeDef[] {
  LIBRARIES ??= {
    // the E and A shapes are the everyday barre chords; C, G and D shapes are rarer up the neck
    guitar: defsFrom(GUITAR_SHAPES, l => (l === 'E' || l === 'A' ? 1.6 : 0.6)),
    ukulele: defsFrom(UKULELE_SHAPES, () => 1),
    // baritone ukulele = the top four strings of a guitar
    baritone: defsFrom(GUITAR_SHAPES, () => 0.6, 4),
  };
  const pcs = tuning.map(mod12).join(',');
  if (tuning.length === 6 && pcs === '4,11,7,2,9,4') return LIBRARIES.guitar;
  if (tuning.length === 4 && pcs === '9,4,0,7') return LIBRARIES.ukulele;
  if (tuning.length === 4 && pcs === '4,11,7,2') return LIBRARIES.baritone;
  return [];
}

interface ShapeMatch {
  /** Exactly a chart chord (not moved). */
  exact: boolean;
  /** The chart chord with open strings. */
  open: boolean;
  /** Name of a library shape this is a moved copy of ("E" → "Barre (E shape)"). */
  shape?: string;
  bonus: number;
}

/** Every placement on the neck of the library shapes for this chord, keyed by frets. */
function shapeTargets(chord: ChordSymbol, tuning: readonly number[], maxFret: number): Map<string, ShapeMatch> {
  const map = new Map<string, ShapeMatch>();
  const root = rootPc(chord.root);
  for (const def of shapeLibrary(tuning)) {
    if (def.quality !== chord.quality.id) continue;
    const k0 = mod12(root - def.root);
    for (const k of [k0, k0 - 12, k0 + 12]) {
      if (def.frets.some(f => f >= 0 && (f + k < 0 || f + k > maxFret))) continue;
      const key = def.frets.map(f => (f < 0 ? -1 : f + k)).join(',');
      const m = map.get(key) ?? { exact: false, open: false, bonus: 0 };
      if (k === 0) {
        m.exact = true;
        m.open ||= def.frets.includes(0);
        m.bonus = Math.max(m.bonus, CHART_BONUS);
      } else {
        m.shape ??= def.shape;
        m.bonus = Math.max(m.bonus, def.moveBonus);
      }
      map.set(key, m);
    }
  }
  return map;
}

// ---- fingering ------------------------------------------------------------------

interface Fingering {
  fingers: (number | null)[];
  barres: FrettedBarre[];
  /** Fingers in use (a barre counts once). */
  units: number;
  /** Two fingers on one fret, far apart, with a higher-fretted string between them. */
  hops: number;
  /** Frets beyond one-finger-per-fret between neighbouring fingers. */
  stretch: number;
}

interface Unit {
  fret: number;
  /** string indices, bass side first */
  strings: number[];
  barre: boolean;
}

/**
 * Finger a chord shape (frets string-1-first, -1 = muted). Barres: the index finger
 * lies across the lowest fret when several strings share it and nothing lower or open
 * sits between them; another finger may barre a higher fret (A-shape ring barre, C9…).
 * Barres are used only when needed: never for three fretted notes or fewer, and for four
 * notes only when the index finger can take two or more of them at the lowest fret.
 */
function fingerFrets(frets: readonly number[]): Fingering | null {
  const n = frets.length;
  const fretted: number[] = [];
  for (let i = n - 1; i >= 0; i--) if (frets[i] > 0) fretted.push(i);
  const fingers: (number | null)[] = frets.map(f => (f < 0 ? null : f === 0 ? 0 : null));
  if (!fretted.length) return { fingers, barres: [], units: 0, hops: 0, stretch: 0 };
  let minF = Infinity;
  let maxF = 0;
  for (const i of fretted) {
    minF = Math.min(minF, frets[i]);
    maxF = Math.max(maxF, frets[i]);
  }
  // Open chords with one or two fretted notes keep one finger per fret from the nut
  // (ukulele C = ring finger, Am = middle finger, guitar Em = 2 + 3); otherwise the index
  // finger takes the lowest fret.
  const ref = frets.includes(0) && maxF <= 4 && fretted.length <= 2 ? 1 : minF;

  // runs of strings at fret g that one finger can cover (only strings fretted ≥ g between)
  const runsAt = (g: number): number[][] => {
    const runs: number[][] = [];
    let cur: number[] = [];
    for (const i of fretted) {
      if (frets[i] !== g) continue;
      if (cur.length) {
        const prev = cur[cur.length - 1];
        let ok = true;
        for (let j = prev - 1; j > i; j--) {
          if (frets[j] < g) {
            ok = false;
            break;
          }
        }
        if (!ok) {
          if (cur.length >= 2) runs.push(cur);
          cur = [];
        }
      }
      cur.push(i);
    }
    if (cur.length >= 2) runs.push(cur);
    return runs.sort((a, b) => b.length - a.length);
  };

  const F = fretted.length;
  const index = runsAt(minF);
  const others: number[][] = [];
  for (const g of [...new Set(fretted.map(i => frets[i]))].sort((a, b) => b - a)) if (g > minF) others.push(...runsAt(g));
  let configs: number[][][];
  if (F <= 3) configs = [[]];
  else if (F === 4) configs = index.length ? [[index[0]], []] : [[]];
  else {
    configs = [];
    if (index.length) configs.push([index[0]]);
    for (const o of others) configs.push([o]);
    if (index.length) for (const o of others) configs.push([index[0], o]);
  }

  for (const cfg of configs) {
    const covered = new Set<number>();
    const units: Unit[] = [];
    for (const run of cfg) {
      run.forEach(i => covered.add(i));
      units.push({ fret: frets[run[0]], strings: run, barre: true });
    }
    for (const i of fretted) if (!covered.has(i)) units.push({ fret: frets[i], strings: [i], barre: false });
    const U = units.length;
    if (U > 4) continue;
    units.sort((a, b) => a.fret - b.fret || b.strings[0] - a.strings[0]);
    // fingers in fret order, one finger per fret where there is room
    const fs: number[] = [];
    let prev = 0;
    units.forEach((u, k) => {
      const f = Math.min(Math.max(prev + 1, 1 + u.fret - ref), 4 - (U - 1 - k));
      fs.push(f);
      prev = f;
    });
    const out = [...fingers];
    const barres: FrettedBarre[] = [];
    let stretch = 0;
    units.forEach((u, k) => {
      for (const i of u.strings) out[i] = fs[k];
      if (u.barre) barres.push({ fret: u.fret, fromString: u.strings[0] + 1, toString: u.strings[u.strings.length - 1] + 1, finger: fs[k] });
      if (k > 0) stretch += Math.max(0, u.fret - units[k - 1].fret - (fs[k] - fs[k - 1]));
    });
    let hops = 0;
    const singles = units.filter(u => !u.barre);
    for (let a = 0; a < singles.length; a++) {
      const b = singles[a + 1];
      if (!b || b.fret !== singles[a].fret) continue;
      const hi = singles[a].strings[0];
      const lo = b.strings[0];
      if (hi - lo - 1 < 2) continue;
      for (let j = hi - 1; j > lo; j--) {
        if (frets[j] > singles[a].fret) {
          hops++;
          break;
        }
      }
    }
    return { fingers: out, barres, units: U, hops, stretch };
  }
  return null;
}

// ---- search -----------------------------------------------------------------------

interface ChordData {
  root: number;
  degrees: number[];
  labels: string[];
  /** tone index per pitch class, -1 = not a chord tone */
  toneOfPc: number[];
  allowed: boolean[];
  /** pitch class that must sound lowest (slash bass, else root) */
  bassPc: number;
  slash: boolean;
  required: number;
  quality: ChordQuality;
}

function chordData(chord: ChordSymbol, instrument: FrettedInstrument): ChordData {
  const q = chord.quality;
  const root = rootPc(chord.root);
  const toneOfPc: number[] = new Array(12).fill(-1);
  q.tones.forEach(([s], i) => {
    const pc = mod12(root + s);
    if (toneOfPc[pc] < 0) toneOfPc[pc] = i;
  });
  const allowed = toneOfPc.map(t => t >= 0);
  const bassPc = chord.bass ? rootPc(chord.bass) : root;
  allowed[bassPc] = true;
  const degrees = q.tones.map(([, d]) => d);
  let required = 0;
  if (instrument === 'bass') {
    // bass chords: the root plus the tone that names the chord (3rd, sus tone, 7th…)
    required = 1;
    const guide = [3, 4, 2, 7, 11, 13, 6, 5].map(d => degrees.indexOf(d)).find(i => i > 0 && !q.optional.includes(degrees[i]));
    const fifth = degrees.indexOf(5);
    const g = guide ?? (fifth > 0 ? fifth : 1);
    if (g > 0 && g < degrees.length) required |= 1 << g;
  } else {
    degrees.forEach((d, i) => {
      if (!q.optional.includes(d)) required |= 1 << i;
    });
  }
  return { root, degrees, labels: chordDegreeLabels(q), toneOfPc, allowed, bassPc, slash: !!chord.bass, required, quality: q };
}

interface SearchSpec {
  instrument: FrettedInstrument;
  maxFret: number;
  span: number;
  minSounding: number;
  maxMutes: number;
  maxInterior: number;
  maxTrailing: number;
  /** Interior mutes only on the string just above the bass note (guitar shell voicings: 3x34xx). */
  interiorAfterBassOnly: boolean;
  /** Root (or slash bass) must be the lowest note. */
  strictBass: boolean;
  /** Slash bass must be the lowest note. */
  strictSlash: boolean;
}

interface Candidate {
  frets: number[];
  fing: Fingering;
  cost: number;
  minF: number;
  maxF: number;
  midis: number[];
  lowest: number;
  match?: ShapeMatch;
}

/** Cost weights per instrument. */
const WEIGHTS = {
  guitar: { unit: 1, lead: 0.6, interior: 3, trail: 1.3, pos: 0.35, nonRoot: 2.5, barre: 1 },
  ukulele: { unit: 1, lead: 3.5, interior: 3.5, trail: 3.5, pos: 0.35, nonRoot: 0.4, barre: 0.6 },
  bass: { unit: 0.6, lead: 0.15, interior: 0.5, trail: 0.15, pos: 0.15, nonRoot: 2.5, barre: 1 },
} as const;

function searchFretted(cd: ChordData, tuning: readonly number[], spec: SearchSpec, targets: Map<string, ShapeMatch>): Candidate[] {
  const n = tuning.length;
  const order: number[] = [];
  for (let i = n - 1; i >= 0; i--) order.push(i);
  const monotone = tuning.every((m, i) => i === 0 || tuning[i - 1] > m);
  const prune = spec.strictBass && monotone;
  const w = WEIGHTS[spec.instrument];
  const power = cd.quality.tones.length === 2;
  const q = cd.quality;
  const out: Candidate[] = [];
  const frets: number[] = new Array(n).fill(-1);
  const seen = new Set<string>();

  const leaf = (b: number, sounding: number, trailing: number, interior: number, mutes: number, hasB: boolean, frettedCount: number) => {
    if (sounding < spec.minSounding || trailing > spec.maxTrailing) return;
    if (!hasB && !(frettedCount === 0 && b === 1)) return;
    let mask = 0;
    let lowest = Infinity;
    let lowestIdx = -1;
    let minF = Infinity;
    let maxF = 0;
    const counts: number[] = new Array(cd.degrees.length).fill(0);
    const midis: number[] = [];
    let hasOpen = false;
    let hasBassPc = false;
    for (let i = 0; i < n; i++) {
      const f = frets[i];
      if (f < 0) continue;
      const m = tuning[i] + f;
      midis.push(m);
      if (m % 12 === cd.bassPc) hasBassPc = true;
      const t = cd.toneOfPc[m % 12];
      if (t >= 0) {
        mask |= 1 << t;
        counts[t]++;
      }
      if (m < lowest || (m === lowest && i > lowestIdx)) {
        lowest = m;
        lowestIdx = i;
      }
      if (f > 0) {
        minF = Math.min(minF, f);
        maxF = Math.max(maxF, f);
      } else hasOpen = true;
    }
    if ((mask & cd.required) !== cd.required) return;
    const bassPc = lowest % 12;
    if (cd.slash && (!hasBassPc || (spec.strictSlash && bassPc !== cd.bassPc))) return;
    if (spec.strictBass && bassPc !== cd.bassPc) return;
    const key = frets.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    const fing = fingerFrets(frets);
    if (!fing) return;
    if (minF === Infinity) {
      minF = 0;
      maxF = 0;
    }

    // ---- cost ----
    let cost = fing.units * w.unit;
    for (const br of fing.barres) {
      const covered = br.fromString - br.toString + 1;
      cost += (covered >= 5 ? 2.2 : covered >= 3 ? 1.3 : 0.9) * w.barre;
    }
    if (fing.barres.length > 1) cost += 0.5;
    const spanF = maxF - minF;
    cost += 0.35 * spanF + (spanF >= 3 ? 0.8 * (spanF - 2) : 0) + (spanF >= 4 ? 1.5 : 0);
    cost += 0.3 * fing.stretch + 1.2 * fing.hops;
    if (minF > 1) cost += w.pos * (minF - 1);
    if (hasOpen && (minF >= 5 || maxF >= 7)) for (let i = 0; i < n; i++) if (frets[i] === 0) cost += 0.6;
    const leading = mutes - interior - trailing;
    const muteScale = power ? 0.15 : 1;
    // two bass-side mutes are normal (D = xx0232); a third starts to thin the chord out
    const leadCost = w.lead * Math.min(leading, 2) + (spec.instrument === 'guitar' ? 1 : w.lead) * Math.max(0, leading - 2);
    cost += muteScale * (leadCost + w.trail * trailing) + w.interior * interior;
    if (spec.instrument === 'bass') cost += 0.5 * Math.abs(sounding - 3);
    // three-string triads are real voicings, but a guitar chart leads with fuller shapes
    if (spec.instrument === 'guitar' && !power && sounding < 4) cost += 1;
    // doubling and omissions
    cd.degrees.forEach((d, t) => {
      const c = counts[t];
      if (c > 1 && d !== 1) {
        const perfect5 = d === 5 && cd.quality.tones[t][0] === 7;
        if (!perfect5) cost += (d === 3 ? 0.25 : 0.5) * (c - 1);
      }
      if (c === 0) {
        if (spec.instrument === 'bass') cost += d === 5 ? 0.2 : 0.6;
        else cost += q.family === 'extended' ? 0.25 : 0.5;
      }
    });
    // the 3rd clashes with an 11th a minor 9th above it, so 11th chords usually leave it out
    const third = cd.degrees.indexOf(3);
    if (third >= 0 && counts[third] > 0 && cd.degrees.includes(11) && q.optional.includes(3)) cost += 1;
    const sorted = [...midis].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) cost += 0.4;
    if (!cd.slash && bassPc !== cd.root) cost += w.nonRoot;
    // slash bass not lowest (only possible on ukulele, where re-entrant tunings make it hard)
    if (cd.slash && bassPc !== cd.bassPc) cost += 3.5;
    // standard chart shapes
    let match = targets.get(key);
    let bonus = match?.bonus ?? 0;
    if (cd.slash) {
      const stripped = [...frets];
      stripped[lowestIdx] = -1;
      const base = bassPc === cd.bassPc && !match ? targets.get(stripped.join(',')) : undefined;
      if (base) {
        // a library chord with the slash bass added below it (C/E = 032010)
        match = { ...base, exact: false, open: false };
        bonus = base.exact ? 1.5 : base.bonus * 0.6;
      } else if (match && bassPc !== cd.bassPc) {
        // the plain chord shape, without the slash bass underneath
        bonus *= 0.4;
      }
    }
    cost -= bonus;
    out.push({ frets: [...frets], fing, cost, minF, maxF, midis: sorted, lowest: bassPc, match });
  };

  for (let b = 1; b <= spec.maxFret; b++) {
    const hi = Math.min(b + spec.span - 1, spec.maxFret);
    const options: number[][] = tuning.map(open => {
      const o = [-1];
      if (cd.allowed[open % 12]) o.push(0);
      for (let f = b; f <= hi; f++) if (cd.allowed[(open + f) % 12]) o.push(f);
      return o;
    });
    if (b > 1 && !options.some(o => o.includes(b))) continue;
    const rec = (p: number, sounding: number, pending: number, interior: number, mutes: number, hasB: boolean, frettedCount: number) => {
      if (p === n) {
        leaf(b, sounding, pending, interior, mutes, hasB, frettedCount);
        return;
      }
      const i = order[p];
      const remaining = n - p;
      for (const f of options[i]) {
        if (f < 0) {
          if (mutes + 1 > spec.maxMutes || sounding + remaining - 1 < spec.minSounding) continue;
          if (sounding > 0 && pending + 1 > Math.max(spec.maxTrailing, spec.maxInterior - interior)) continue;
          frets[i] = -1;
          rec(p + 1, sounding, sounding > 0 ? pending + 1 : 0, interior, mutes + 1, hasB, frettedCount);
        } else {
          let inter = interior;
          if (sounding > 0 && pending > 0) {
            inter += pending;
            if (inter > spec.maxInterior || (spec.interiorAfterBassOnly && sounding !== 1)) continue;
          }
          if (sounding === 0 && prune && (tuning[i] + f) % 12 !== cd.bassPc) continue;
          frets[i] = f;
          rec(p + 1, sounding + 1, 0, inter, mutes, hasB || f === b, frettedCount + (f > 0 ? 1 : 0));
        }
      }
      frets[i] = -1;
    };
    rec(0, 0, 0, 0, 0, false, 0);
  }
  return out;
}

/** Pick a diverse set: the easiest first, then spread across the neck and away from near-duplicates. */
function pickDiverse(cands: Candidate[], max: number): Candidate[] {
  const pool = [...cands].sort((a, b) => a.cost - b.cost).slice(0, 240);
  const chosen: Candidate[] = [];
  while (chosen.length < max && pool.length) {
    let best = 0;
    let bestScore = Infinity;
    pool.forEach((c, i) => {
      let pen = 0;
      for (const v of chosen) {
        let diff = 0;
        for (let s = 0; s < c.frets.length; s++) if (c.frets[s] !== v.frets[s]) diff++;
        if (diff <= 1) pen += 2.5;
        if (Math.abs(c.minF - v.minF) <= 2) pen += 0.9;
      }
      const score = c.cost + pen;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    chosen.push(pool.splice(best, 1)[0]);
  }
  return chosen.sort((a, b) => a.cost - b.cost);
}

function labelFor(c: Candidate): string {
  const hasOpen = c.frets.some(f => f === 0);
  const barre = c.fing.barres.length > 0;
  if ((hasOpen && c.maxF <= 4) || c.frets.every(f => f <= 0) || c.match?.open) return 'Open';
  const moved = c.match?.shape;
  if (barre) return moved ? `Barre (${moved} shape)` : `Barre, ${ordinal(c.fing.barres[0].fret)} fret`;
  return moved ? `${ordinal(c.minF)} position (${moved} shape)` : `${ordinal(c.minF)} position`;
}

/**
 * Chord diagrams for a fretted instrument, easiest first. `tuning` is open-string MIDI
 * notes, string 1 first (see TUNINGS).
 */
export function frettedVoicings(chord: ChordSymbol, tuning: readonly number[], opts: FrettedVoicingOptions = {}): FrettedVoicing[] {
  const instrument = opts.instrument ?? fretInstrumentFor(tuning);
  const n = tuning.length;
  const maxFret = opts.maxFret ?? INSTRUMENTS[instrument].fretted?.maxFret ?? 15;
  const cd = chordData(chord, instrument);
  const tones = chord.quality.tones.length;
  const inversions = !!opts.allowInversions;
  const base: SearchSpec =
    instrument === 'guitar'
      ? // muted strings on the bass side; one shell-voicing mute just above the bass; 4 strings for 4-tone chords
        { instrument, maxFret, span: opts.span ?? 4, minSounding: Math.min(n, tones >= 4 ? 4 : 3), maxMutes: n, maxInterior: 1, maxTrailing: n, interiorAfterBassOnly: true, strictBass: !inversions, strictSlash: true }
      : instrument === 'ukulele'
        ? // re-entrant tunings rarely put the root (or a slash bass) lowest, so that is only a preference
          { instrument, maxFret, span: opts.span ?? 5, minSounding: Math.min(n, 3), maxMutes: 1, maxInterior: 1, maxTrailing: 1, interiorAfterBassOnly: false, strictBass: false, strictSlash: false }
        : { instrument, maxFret, span: opts.span ?? 4, minSounding: 2, maxMutes: n, maxInterior: 2, maxTrailing: n, interiorAfterBassOnly: false, strictBass: !inversions, strictSlash: true };
  base.maxMutes = Math.min(base.maxMutes, n - base.minSounding);
  const targets = shapeTargets(chord, tuning, maxFret);

  // relax step by step if a very unusual chord has no voicing under the normal rules
  const relaxed = (minSounding: number, extra: Partial<SearchSpec>): SearchSpec => ({
    ...base,
    span: base.span + 1,
    maxInterior: 2,
    interiorAfterBassOnly: false,
    minSounding: Math.min(base.minSounding, minSounding),
    maxMutes: n - Math.min(base.minSounding, minSounding),
    maxTrailing: n,
    ...extra,
  });
  const ladder: SearchSpec[] = [base, relaxed(base.minSounding, {}), relaxed(3, { strictBass: false }), relaxed(2, { strictBass: false, strictSlash: false })];
  let found: Candidate[] = [];
  for (const spec of ladder) {
    found = searchFretted(cd, tuning, spec, targets);
    if (found.length) break;
  }

  const span = Math.max(4, opts.span ?? (instrument === 'ukulele' ? 5 : 4));
  return pickDiverse(found, opts.max ?? 8).map(c => {
    const frets = c.frets.map(f => (f < 0 ? null : f));
    const degrees = frets.map((f, i) => (f === null ? null : degreeLabelFor(chord, mod12(tuning[i] + f))));
    return {
      frets,
      fingers: c.fing.fingers,
      barres: c.fing.barres,
      baseFret: c.maxF <= span ? 1 : c.minF,
      midis: c.midis,
      degrees,
      bassIsRoot: c.lowest === cd.root,
      ease: Math.round(1000 / (1 + Math.exp((c.cost - 4) / 1.6))) / 1000,
      label: labelFor(c),
    };
  });
}

// ---------------------------------------------------------------------------
// Bass guitar arpeggio shapes
// ---------------------------------------------------------------------------

export interface BassShapePosition {
  string: number;
  fret: number;
  degree: string;
  finger: number;
}

export interface BassShape {
  name: string;
  /** Notes low → high. */
  positions: BassShapePosition[];
}

/**
 * One-position arpeggio boxes for bass guitar: R 3 5 (7) and the octave with the root on
 * each low string (E and A on a 4-string, B E A on a 5-string), plus the root–fifth–octave
 * box. Fingers are one per fret from the hand position (0 = open string).
 */
export function bassShapes(chord: ChordSymbol, tuning: readonly number[], opts: { maxFret?: number } = {}): BassShape[] {
  const maxFret = opts.maxFret ?? 15;
  const n = tuning.length;
  const root = rootPc(chord.root);
  const labels = chordDegreeLabels(chord.quality);
  const lowToHigh = stringsLowToHigh(tuning);
  const rootStrings = lowToHigh.slice(0, Math.max(1, n - 2));
  const out: BassShape[] = [];

  type Tone = { semis: number; label: string; required: boolean };
  const arp: Tone[] = chord.quality.tones.map(([s, d], i) => ({ semis: s, label: labels[i], required: !chord.quality.optional.includes(d) }));
  if (!arp.some(t => t.semis === 12)) arp.push({ semis: 12, label: 'R', required: false });
  arp.sort((a, b) => a.semis - b.semis);

  const box = (rootString: number, tones: Tone[]): BassShapePosition[] | null => {
    const open = tuning[rootString - 1];
    let r = mod12(root - open);
    if (r + 4 > maxFret) r -= 12;
    if (r < 0) return null;
    const rootMidi = open + r;
    const above = lowToHigh.slice(lowToHigh.indexOf(rootString));
    let best: { pos: BassShapePosition[]; score: number } | null = null;
    for (const p of r === 0 ? [1] : [r - 1, r, r - 2, r + 1].filter(x => x >= 1 && x <= r)) {
      const pos: BassShapePosition[] = [];
      let ok = true;
      for (const t of tones) {
        const targets = t.semis > 12 ? [t.semis, t.semis - 12] : [t.semis];
        let placed: BassShapePosition | null = null;
        for (const s of targets) {
          for (const str of above) {
            const f = rootMidi + s - tuning[str - 1];
            const inWindow = f >= p && f <= p + 3;
            if (!inWindow && !(f === 0 && p <= 1)) continue;
            if (pos.some(x => x.string === str && x.fret === f)) continue;
            placed = { string: str, fret: f, degree: t.label, finger: f === 0 ? 0 : f - p + 1 };
            break;
          }
          if (placed) break;
        }
        if (placed) pos.push(placed);
        else if (t.required) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const score = pos.length;
      if (!best || score > best.score) best = { pos, score };
    }
    if (!best) return null;
    const midiOfPos = (x: BassShapePosition) => tuning[x.string - 1] + x.fret;
    return best.pos.sort((a, b) => midiOfPos(a) - midiOfPos(b));
  };

  const name = (s: number) => {
    const p = spellMidi(tuning[s - 1]);
    return stepLabel(p.step, p.alter);
  };
  for (const s of rootStrings) {
    const pos = box(s, arp);
    if (pos) out.push({ name: `Root on ${name(s)} string`, positions: pos });
  }
  const power = box(rootStrings[0], [
    { semis: 0, label: 'R', required: true },
    { semis: 7, label: '5', required: true },
    { semis: 12, label: 'R', required: true },
  ]);
  if (power) out.push({ name: 'Root–5th–octave', positions: power });
  return out;
}

// ---------------------------------------------------------------------------
// Piano voicings
// ---------------------------------------------------------------------------

export interface PianoVoicing {
  /** "Root position", "1st inversion", … */
  name: string;
  rh: number[];
  rhFingers: number[];
  lh: number[];
  lhFingers: number[];
}

/** Chord tones for one hand (≤ 5): the 11th chord loses its 3rd, others their 5th, then 9th. */
function handTones(q: ChordQuality): ChordTone[] {
  const tones = [...q.tones];
  const has = (d: number) => tones.some(t => t[1] === d);
  const drop = (d: number) => tones.splice(tones.findIndex(t => t[1] === d), 1);
  while (tones.length > 5) {
    if (has(11) && has(3) && q.optional.includes(3)) drop(3);
    else if (has(5) && q.optional.includes(5)) drop(5);
    else if (has(11)) drop(11);
    else if (has(9)) drop(9);
    else tones.pop();
  }
  return tones;
}

/** Hand span limit for a chord shape: a 9th (C13 → C E A B♭ D rather than C E B♭ D A). */
const HAND_SPAN = 14;

/** Sort a shape and fold its top notes down an octave until one hand can hold it. */
function compactHand(semis: number[]): number[] {
  const s = [...semis].sort((a, b) => a - b);
  for (let guard = 0; guard < 8 && s[s.length - 1] - s[0] > HAND_SPAN; guard++) {
    const top = s.pop()!;
    let lower = top - 12;
    while (lower - 12 > s[0]) lower -= 12;
    if (lower <= s[0] || s.includes(lower)) {
      s.push(top);
      break;
    }
    s.push(lower);
    s.sort((a, b) => a - b);
  }
  return s;
}

/** Parncutt "relaxed" spans (semitones) between right-hand finger pairs. */
const REL_SPAN: Record<string, [number, number]> = {
  '1-2': [1, 5], '1-3': [3, 7], '1-4': [5, 9], '1-5': [7, 10],
  '2-3': [1, 2], '2-4': [3, 4], '2-5': [5, 6], '3-4': [1, 2], '3-5': [3, 4], '4-5': [1, 2],
};

/** Right-hand chord fingering for ascending intervals (left hand uses the mirror image). */
function rhFingering(ivs: number[]): number[] {
  const n = ivs.length + 1;
  if (n === 1) return [1];
  if (n === 2) {
    const i = ivs[0];
    return [1, i <= 2 ? 2 : i <= 4 ? 3 : i <= 6 ? 4 : 5];
  }
  if (n === 3) return ivs[1] >= 5 ? [1, 2, 5] : [1, 3, 5];
  if (n === 4) {
    let best: number[] = [1, 2, 3, 5];
    let bestCost = Infinity;
    for (const fs of [[1, 2, 3, 5], [1, 2, 4, 5], [1, 3, 4, 5]]) {
      let c = fs.includes(4) ? 0.1 : 0;
      for (let k = 0; k < 3; k++) {
        const [lo, hi] = REL_SPAN[`${fs[k]}-${fs[k + 1]}`];
        c += Math.max(0, lo - ivs[k]) + Math.max(0, ivs[k] - hi);
      }
      if (c < bestCost) {
        bestCost = c;
        best = fs;
      }
    }
    return best;
  }
  return [1, 2, 3, 4, 5].slice(0, n);
}

const intervalsOf = (midis: number[]) => midis.slice(1).map((m, i) => m - midis[i]);

/** Fingers for a chord (ascending MIDI notes) in either hand, aligned low → high. */
export function chordFingering(midis: number[], hand: 'R' | 'L'): number[] {
  const ivs = intervalsOf(midis);
  if (hand === 'R') return rhFingering(ivs);
  // the left hand is the mirror image: finger the reversed intervals as a right hand, then read back
  return [...rhFingering([...ivs].reverse())].reverse();
}

/** Shift a shape (semitones above the root) to the octave whose centre is nearest `around`. */
function placeNear(rootPcValue: number, semis: number[], around: number): number[] {
  const mean = semis.reduce((a, b) => a + b, 0) / semis.length;
  const target = around - mean;
  let best = rootPcValue;
  let bestD = Infinity;
  for (let r = rootPcValue; r <= 127; r += 12) {
    const d = Math.abs(r - target);
    if (d < bestD - 1e-9) {
      bestD = d;
      best = r;
    }
  }
  return semis.map(s => best + s);
}

/** Name a voicing by the chord degree in its bass: 3rd (or sus tone) → 1st inversion, 5th → 2nd, 7th/6th → 3rd. */
function inversionName(bassDegree: number): string {
  if (bassDegree === 1) return 'Root position';
  if (bassDegree <= 4) return '1st inversion';
  if (bassDegree === 5) return '2nd inversion';
  if (bassDegree <= 7) return '3rd inversion';
  return `${ordinal(bassDegree)} in the bass`;
}

/** Rotate a shape (semitones above the root) so its `inv`-th note is in the bass, keeping the order of the rest. */
function rotateShape(semis: number[], inv: number): number[] {
  const bottom = semis[inv];
  return semis
    .map(s => {
      let x = s;
      while (x < bottom) x += 12;
      return x;
    })
    .sort((a, b) => a - b);
}

/**
 * Piano voicings: root position and each inversion in the right hand around middle C
 * (default centre E4 = 64), with the same shape an octave lower for the left hand, plus a
 * "with bass" voicing: the chord in the right hand over the root (or slash bass) an octave
 * or two below in the left hand, finger 5. Slash chords list the bass voicing first.
 */
export function pianoVoicings(chord: ChordSymbol, opts: { around?: number } = {}): PianoVoicing[] {
  const around = opts.around ?? 64;
  const r = rootPc(chord.root);
  const q = chord.quality;
  const tones = handTones(q);
  const out: PianoVoicing[] = [];
  const degreeOf = (s: number) => tones.find(t => mod12(t[0]) === mod12(s))?.[1] ?? 1;
  let shapes: number[][];
  if (tones.length === 2) {
    // power chord: root–fifth–octave and the same with the fifth in the bass
    shapes = [
      [0, 7, 12],
      [7, 12, 19],
    ];
  } else {
    const semis = compactHand(tones.map(t => t[0]));
    shapes = [];
    for (let inv = 0; inv < semis.length; inv++) {
      // extensions (9th, 11th, 13th) don't go in the bass
      if (degreeOf(semis[inv]) >= 9) continue;
      shapes.push(compactHand(rotateShape(semis, inv)));
    }
  }
  for (const semis of shapes) {
    const rh = placeNear(r, semis, around);
    const lh = rh.map(m => m - 12);
    out.push({ name: inversionName(degreeOf(semis[0])), rh, rhFingers: chordFingering(rh, 'R'), lh, lhFingers: chordFingering(lh, 'L') });
  }
  // the chord over its bass note
  const rh = out[0].rh;
  const bassPc = chord.bass ? rootPc(chord.bass) : r;
  const top = rh[0] - 12;
  const bass = top - mod12(top - bassPc);
  const withBass: PianoVoicing = { name: chord.bass ? `Over ${stepLabel(chord.bass.step, chord.bass.alter)} in the bass` : 'With bass note', rh, rhFingers: out[0].rhFingers, lh: [bass], lhFingers: [5] };
  if (chord.bass) out.unshift(withBass);
  else out.push(withBass);
  return out;
}

/** A close-position voicing for playback: root position from the root nearest `around`, slash bass below. */
export function chordMidis(chord: ChordSymbol, around = 60): number[] {
  const r = rootPc(chord.root);
  const rootMidi = around - 6 + mod12(r - (around - 6));
  const midis = handTones(chord.quality).map(([s]) => rootMidi + s);
  if (chord.bass) {
    const b = rootPc(chord.bass);
    const below = rootMidi - 1;
    midis.unshift(below - mod12(below - b));
  }
  return [...new Set(midis)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Mallet voicings
// ---------------------------------------------------------------------------

export interface MalletVoicing {
  name: string;
  midis: number[];
  /** mallet number per note, 1-4 (two-mallet: 2 = L, 3 = R) */
  mallets: number[];
  count: 2 | 4;
}

/** Four-mallet rule: each hand holds an interval from a 2nd up to an octave, hands not crossed. */
export function validFourMallet(midis: readonly number[]): boolean {
  if (midis.length !== 4) return false;
  const [a, b, c, d] = midis;
  const lh = b - a;
  const rh = d - c;
  return lh >= 1 && lh <= 12 && rh >= 1 && rh <= 12 && c > b;
}

/** Four chord tones (semitones above the root, close root position) for four mallets. */
function fourTones(q: ChordQuality): { semis: number; label: string; degree: number }[] {
  const labels = chordDegreeLabels(q);
  const all = q.tones.map(([s, d], i) => ({ semis: s, degree: d, label: labels[i] }));
  if (all.length === 2) return [all[0], all[1], { semis: 12, label: 'R', degree: 1 }, { semis: 19, label: labels[1], degree: all[1].degree }];
  if (all.length === 3) return [...all, { semis: 12, label: 'R', degree: 1 }];
  if (all.length === 4) return all;
  const req = all.filter(t => !q.optional.includes(t.degree));
  const fill = [...q.optional].reverse().map(d => all.find(t => t.degree === d)).filter((t): t is (typeof all)[number] => !!t);
  const picked = [...req];
  for (const t of fill) if (picked.length < 4 && !picked.includes(t)) picked.push(t);
  return picked.slice(0, 4).sort((a, b) => a.semis - b.semis);
}

/** Stack pitch classes upward: each note is the next instance of its pitch class above the previous one (+ `gap` semitones). */
function stack(rootMidi: number, semis: number[], gaps: number[] = []): number[] {
  const out: number[] = [];
  semis.forEach((s, i) => {
    if (!i) {
      out.push(rootMidi + s);
      return;
    }
    const prev = out[i - 1] + (gaps[i] ?? 0);
    const pc = mod12(rootMidi + s);
    out.push(prev + 1 + mod12(pc - (prev + 1)));
  });
  return out;
}

/** Transpose a voicing by octaves to fit [low, high] with its centre nearest `around`. */
function fitRange(midis: number[], low: number, high: number, around: number): number[] | null {
  let best: number[] | null = null;
  let bestD = Infinity;
  for (let k = -6; k <= 6; k++) {
    const m = midis.map(x => x + 12 * k);
    if (m[0] < low || m[m.length - 1] > high) continue;
    const d = Math.abs(m.reduce((a, b) => a + b, 0) / m.length - around);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/**
 * Mallet voicings in written pitch: four-mallet close voicings (root position and
 * inversions), an open "spread" voicing with the left hand on root and 5th (or 7th), a
 * grand voicing with the left hand in the bass when the range goes down to C3 (`low` ≤ 48),
 * then two-mallet double stops (L below R) and an R L R L arpeggio. Default range C4–C6.
 */
export function malletVoicings(chord: ChordSymbol, opts: { low?: number; high?: number; around?: number } = {}): MalletVoicing[] {
  const low = opts.low ?? 60;
  const high = opts.high ?? 84;
  const around = opts.around ?? Math.min(Math.max(67, low + 7), high - 7);
  const r = rootPc(chord.root);
  const q = chord.quality;
  const labels = chordDegreeLabels(q);
  const out: MalletVoicing[] = [];
  const add4 = (name: string, midis: number[] | null) => {
    if (!midis || !validFourMallet(midis)) return;
    if (out.some(v => v.count === 4 && v.midis.join() === midis.join())) return;
    out.push({ name, midis, mallets: [1, 2, 3, 4], count: 4 });
  };
  const rootNear = r + 12 * Math.floor((around - r) / 12);
  const four = fourTones(q);
  const triad = q.tones.length === 3;

  // close position: root position and inversions (triads double the root, or the 5th when inverted)
  const degreeOf = (s: number) => four.find(t => mod12(t.semis) === mod12(s))?.degree ?? 1;
  const closeShapes: number[][] = [];
  if (triad) {
    const t = q.tones.map(x => x[0]);
    closeShapes.push([t[0], t[1], t[2], 12], [t[1], t[2], 12, t[2] + 12], [t[2], 12, t[1] + 12, t[2] + 12]);
  } else if (q.tones.length === 2) {
    // power chord: R 5 R 5 and 5 R 5 R
    const f = q.tones[1][0];
    closeShapes.push([0, f, 12, f + 12], [f, 12, f + 12, 24]);
  } else {
    const close = four.map(t => t.semis);
    for (let inv = 0; inv < close.length; inv++) if (degreeOf(close[inv]) < 9) closeShapes.push(rotateShape(close, inv));
  }
  for (const semis of closeShapes) {
    add4(`Close, ${inversionName(degreeOf(semis[0])).toLowerCase()}`, fitRange(stack(rootNear, semis), low, high, around));
  }

  // open / spread: left hand root + 5th (or 7th), right hand the other two above it –
  // R 5 | R 3 for triads, R 5 | 7 3 for sevenths; failing that R 5 | 3 R (two octaves)
  const fifth = four.find(t => t.semis === 7 || t.semis === 6 || t.semis === 8) ?? four.find(t => t.label.includes('7')) ?? four[1];
  const rest = four.filter(t => t !== four[0] && t !== fifth);
  const restDown = [...rest].sort((a, b) => b.semis - a.semis).map(t => t.semis);
  const spread = [stack(rootNear, [0, fifth.semis, ...restDown]), stack(rootNear, [0, fifth.semis, ...rest.map(t => t.semis)])]
    .map(m => fitRange(m, low, high, around))
    .find(m => m && validFourMallet(m));
  add4('Open (spread)', spread ?? null);

  // grand: left hand in the bass clef (root + 5th or 7th), right hand above middle C
  if (low <= 48) {
    const bassRoot = low + mod12(r - low);
    const lh = [bassRoot, bassRoot + fifth.semis];
    const rh = stack(bassRoot, [0, ...rest.map(t => t.semis)], [0, 7]).slice(1);
    const midis = [...lh, ...rh];
    if (midis[3] <= high && bassRoot <= 57) add4('Grand (left hand in the bass)', midis);
  }

  // two mallets: double stops
  const third = q.tones.findIndex(([, d]) => d === 3 || d === 2 || d === 4);
  const seventh = q.tones.findIndex(([, d]) => d === 7 || d === 6);
  const pair = (name: string, a: number, b: number) => {
    const m = fitRange(stack(rootNear, [a, b]), low, high, around);
    if (m) out.push({ name, midis: m, mallets: [2, 3], count: 2 });
  };
  if (third > 0) pair(`Double stop (R + ${labels[third]})`, 0, q.tones[third][0]);
  else pair(`Double stop (R + ${labels[1]})`, 0, q.tones[1][0]);
  if (third > 0 && seventh > 0) pair(`Double stop (${labels[third]} + ${labels[seventh]})`, q.tones[third][0], q.tones[seventh][0]);

  // two mallets: arpeggio, alternating hands from the right
  const arpSemis = q.tones.map(t => t[0]).sort((a, b) => a - b);
  if (arpSemis[arpSemis.length - 1] < 12) arpSemis.push(12);
  const arp = fitRange(
    arpSemis.map(s => rootNear + s),
    low,
    high,
    around,
  );
  if (arp) out.push({ name: 'Arpeggio (R L R L)', midis: arp, mallets: arp.map((_, i) => (i % 2 ? 2 : 3)), count: 2 });
  return out;
}

// ---------------------------------------------------------------------------
// Progressions
// ---------------------------------------------------------------------------

export interface ChordProgression {
  name: string;
  key: string;
  /** The distinct chords to learn, in the order they first appear. */
  chords: string[];
  /** Optional bar-by-bar layout (one chord per bar). */
  bars?: string[];
}

export const commonProgressions: ChordProgression[] = [
  { name: 'I–V–vi–IV (pop)', key: 'C', chords: ['C', 'G', 'Am', 'F'] },
  { name: 'I–V–vi–IV (pop)', key: 'G', chords: ['G', 'D', 'Em', 'C'] },
  { name: 'I–V–vi–IV (pop)', key: 'D', chords: ['D', 'A', 'Bm', 'G'] },
  { name: 'I–vi–IV–V (50s)', key: 'C', chords: ['C', 'Am', 'F', 'G'] },
  { name: 'I–vi–IV–V (50s)', key: 'G', chords: ['G', 'Em', 'C', 'D'] },
  { name: 'ii–V–I (jazz)', key: 'C', chords: ['Dm7', 'G7', 'Cmaj7'] },
  { name: 'ii–V–I (jazz)', key: 'F', chords: ['Gm7', 'C7', 'Fmaj7'] },
  {
    name: '12-bar blues',
    key: 'A',
    chords: ['A', 'A7', 'D7', 'E7'],
    bars: ['A', 'A', 'A', 'A7', 'D7', 'D7', 'A', 'A', 'E7', 'D7', 'A', 'E7'],
  },
  {
    name: '12-bar blues',
    key: 'E',
    chords: ['E', 'E7', 'A7', 'B7'],
    bars: ['E', 'E', 'E', 'E7', 'A7', 'A7', 'E', 'E', 'B7', 'A7', 'E', 'B7'],
  },
  { name: 'Pachelbel’s Canon', key: 'D', chords: ['D', 'A', 'Bm', 'F#m', 'G'], bars: ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A'] },
  { name: 'i–VI–III–VII (minor pop)', key: 'Am', chords: ['Am', 'F', 'C', 'G'] },
  { name: 'Three-chord song (I–IV–V)', key: 'G', chords: ['G', 'C', 'D'] },
  { name: 'Ukulele favourite', key: 'C', chords: ['C', 'Am', 'F', 'G7'] },
];
