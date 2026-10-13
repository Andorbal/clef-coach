/**
 * VexFlow layout + rendering for Clef Coach scores.
 *
 * Scores are rendered as ONE long horizontal system (all measures on a line). The
 * React view scrolls it under a fixed "header" (clef + key + time signature) so the
 * learner always sees which clef they're reading, while upcoming notes stream in from
 * the right. Pitches in the Score are sounding pitches; guitar (treble8vb) staves are
 * written an octave higher, exactly like real guitar music.
 */
import {
  Accidental,
  Annotation,
  Beam,
  Dot,
  Formatter,
  FretHandFinger,
  Modifier,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  StringNumber,
  Tuplet,
  Voice,
  BarlineType,
  type RenderContext,
  type StemmableNote,
} from 'vexflow/bravura';
import { vexKeySpec } from '../music/keys';
import { type Pitch, diatonicIndex, transposeOctaves, vexKey } from '../music/pitch';
import { BASE_TICKS, PPQ, VEX_DURATION, measureTicks } from '../music/rhythm';
import type { Clef, NoteEl, Score } from '../music/score';

export const INK = '#1c1915';
const LINE_SPACING = 10; // VexFlow default (px between staff lines)
const HALF = LINE_SPACING / 2;

/** Top-line / bottom-line diatonic indexes of each clef (written pitch). */
const CLEF_LINES: Record<'treble' | 'bass', { top: number; bottom: number }> = {
  treble: { top: 38, bottom: 30 }, // F5 / E4
  bass: { top: 26, bottom: 18 }, // A3 / G2
};

let fontsReady: Promise<void> | null = null;
/** Resolve when the Bravura music font is loaded (VexFlow draws glyphs as text). */
export function notationFontsReady(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        await Promise.all([
          document.fonts.load('30px Bravura'),
          document.fonts.load('12px Academico'),
        ]);
      } catch {
        /* ignore */
      }
    })();
  }
  return fontsReady;
}

export function writtenPitch(p: Pitch, clef: Clef): Pitch {
  return clef === 'treble8vb' ? transposeOctaves(p, 1) : p;
}

function vexClef(clef: Clef): 'treble' | 'bass' {
  return clef === 'bass' ? 'bass' : 'treble';
}

export interface RenderOptions {
  /** Show finger numbers (piano) / left-hand fingers + string numbers (guitar). */
  fingering?: boolean;
  strings?: boolean;
  timeSignature?: boolean;
  barlines?: boolean;
  /** Pixels per quarter-note beat used for proportional spacing. */
  beatWidth?: number;
  /** Minimum gap before the first note after the header. */
  leadIn?: number;
  /** Extra right padding after the last measure (so the last note can scroll to the playhead). */
  tailPad?: number;
  /** Extra space below the lowest staff (e.g. for note-name labels). */
  extraBelow?: number;
  idPrefix: string;
}

export interface NotePosition {
  id: string;
  /** Centre x of the notehead(s) in render coordinates. */
  x: number;
  staff: number;
  ys: number[];
  measure: number;
  tick: number;
  el?: SVGElement;
}

export interface StaffGeometry {
  clef: Clef;
  /** y of the top staff line */
  top: number;
  /** y of the bottom staff line */
  bottom: number;
}

export interface RenderResult {
  width: number;
  height: number;
  headerWidth: number;
  staves: StaffGeometry[];
  notes: Map<string, NotePosition>;
  /** x of each measure's left edge */
  measureXs: number[];
  /** Map tick → x (for steps); use xForTick for interpolation */
  tickXs: [number, number][];
}

/** y coordinate for a (sounding) pitch on a given staff. */
export function yForPitch(geom: StaffGeometry, p: Pitch): number {
  const w = writtenPitch(p, geom.clef);
  const lines = CLEF_LINES[vexClef(geom.clef)];
  return geom.top + (lines.top - diatonicIndex(w)) * HALF;
}

/** Ledger line y positions needed for a pitch (empty if on the staff). */
export function ledgerLinesFor(geom: StaffGeometry, p: Pitch): number[] {
  const w = writtenPitch(p, geom.clef);
  const d = diatonicIndex(w);
  const lines = CLEF_LINES[vexClef(geom.clef)];
  const out: number[] = [];
  for (let l = lines.top + 2; l <= d; l += 2) out.push(geom.top + (lines.top - l) * HALF);
  for (let l = lines.bottom - 2; l >= d; l -= 2) out.push(geom.top + (lines.top - l) * HALF);
  return out;
}

function staffExtents(score: Score, si: number, opts: RenderOptions): { above: number; below: number } {
  const staff = score.staves[si];
  const lines = CLEF_LINES[vexClef(staff.clef)];
  let dMax = lines.top;
  let dMin = lines.bottom;
  let maxChord = 1;
  for (const v of staff.voices) for (const n of v.notes) {
    maxChord = Math.max(maxChord, n.pitches.length);
    for (const p of n.pitches) {
      const d = diatonicIndex(writtenPitch(p, staff.clef));
      dMax = Math.max(dMax, d);
      dMin = Math.min(dMin, d);
    }
  }
  // stems (3.5 spaces) can extend beyond the notes; give room for (stacked) fingering text
  const finger = opts.fingering ? (score.instrument === 'piano' ? 6 + 13 * maxChord : 30) : 0;
  const above = Math.max(26, (dMax - lines.top) * HALF + 30) + (staff.hand === 'L' ? 0 : finger);
  const below = Math.max(26, (lines.bottom - dMin) * HALF + 30) + (staff.hand === 'L' || score.instrument === 'guitar' ? finger : 0);
  return { above, below };
}

function restKey(clef: Clef): string {
  return vexClef(clef) === 'bass' ? 'd/3' : 'b/4';
}

interface BuiltNote {
  el: NoteEl;
  vf: StaveNote;
}

function buildStaveNote(el: NoteEl, clef: Clef, score: Score, opts: RenderOptions, stemDir: number | undefined, hand: 'R' | 'L' | undefined): StaveNote {
  const keys = el.rest ? [restKey(clef)] : el.pitches.map(p => vexKey(writtenPitch(p, clef)));
  const duration = VEX_DURATION[el.base] + (el.rest ? 'r' : '');
  const note = new StaveNote({
    keys,
    duration,
    dots: el.dots,
    clef: vexClef(clef),
    autoStem: stemDir === undefined,
    stemDirection: stemDir,
  });
  if (el.dots) Dot.buildAndAttach([note], { all: true });
  note.setAttribute('id', `${opts.idPrefix}${el.id}`);
  if (el.rest && el.base === 'w') note.setCenterAlignment(true); // whole-measure rests sit centred
  if (!el.rest && opts.fingering && el.fingers) {
    if (score.instrument === 'piano') {
      const order = el.pitches.map((_, i) => i);
      const below = hand === 'L';
      // closest-to-the-note first; stacking order keeps top note's finger on top
      const seq = below ? [...order].reverse() : order;
      for (const i of seq) {
        const f = el.fingers[i];
        if (f === undefined) continue;
        const a = new Annotation(String(f));
        a.setFont('Inter Variable, Inter, sans-serif', 11, 600);
        a.setVerticalJustification(below ? Annotation.VerticalJustify.BOTTOM : Annotation.VerticalJustify.TOP);
        note.addModifier(a, 0);
      }
    } else {
      el.pitches.forEach((_, i) => {
        const f = el.fingers?.[i];
        if (f === undefined || el.tiePrev) return;
        const fh = new FretHandFinger(String(f));
        fh.setPosition(Modifier.Position.LEFT);
        note.addModifier(fh, i);
      });
    }
  }
  if (!el.rest && opts.strings && el.strings && score.instrument === 'guitar' && !el.tiePrev) {
    if (el.pitches.length === 1 && el.strings[0]) {
      const sn = new StringNumber(String(el.strings[0]));
      sn.setPosition(Modifier.Position.BELOW);
      note.addModifier(sn, 0);
    }
  }
  return note;
}

/** Group consecutive triplet notes into VexFlow tuplets (3 in the time of 2). */
function makeTuplets(built: BuiltNote[]): Tuplet[] {
  const tuplets: Tuplet[] = [];
  let run: BuiltNote[] = [];
  let runTicks = 0;
  let minBase = Infinity;
  const flush = () => {
    if (run.length) {
      const bracketed = run.some(b => b.el.rest) || run.some(b => b.el.base === 'q' || b.el.base === 'h');
      tuplets.push(new Tuplet(run.map(b => b.vf), { numNotes: 3, notesOccupied: 2, bracketed }));
    }
    run = [];
    runTicks = 0;
    minBase = Infinity;
  };
  for (const b of built) {
    if (!b.el.triplet) {
      flush();
      continue;
    }
    run.push(b);
    runTicks += b.el.ticks;
    minBase = Math.min(minBase, BASE_TICKS[b.el.base]);
    if (runTicks >= 2 * minBase - 1e-6) flush();
  }
  flush();
  return tuplets;
}

export function renderScore(container: HTMLElement, score: Score, opts: RenderOptions): RenderResult {
  container.innerHTML = '';
  const nStaves = score.staves.length;
  const timeSig = opts.timeSignature !== false;
  const barlines = opts.barlines !== false;
  const beatWidth = opts.beatWidth ?? 64;
  const keySpec = vexKeySpec(score.key);
  const timeSpec = `${score.time[0]}/${score.time[1]}`;

  // ---- vertical layout ----
  const extents = score.staves.map((_, i) => staffExtents(score, i, opts));
  const staffTops: number[] = [];
  let y = extents[0].above;
  for (let i = 0; i < nStaves; i++) {
    if (i > 0) {
      const gap = Math.max(extents[i - 1].below + extents[i].above - 20, 64);
      y += 4 * LINE_SPACING + gap;
    }
    staffTops.push(y);
  }
  const height = staffTops[nStaves - 1] + 4 * LINE_SPACING + extents[nStaves - 1].below + (opts.extraBelow ?? 0);
  // VexFlow staves place the top line at y + spaceAbove*spacing; we use spaceAbove = 0 lines
  const staveOpts = { spaceAboveStaffLn: 0, spaceBelowStaffLn: 0 };

  // ---- header width (clef + key + time) ----
  const probe = new Stave(0, 0, 400, staveOpts);
  probe.addClef(vexClef(score.staves[0].clef), 'default', score.staves[0].clef === 'treble8vb' ? '8vb' : undefined);
  probe.addKeySignature(keySpec);
  if (timeSig) probe.addTimeSignature(timeSpec);
  const probes = [probe];
  for (let i = 1; i < nStaves; i++) {
    const p = new Stave(0, 0, 400, staveOpts);
    p.addClef(vexClef(score.staves[i].clef), 'default', score.staves[i].clef === 'treble8vb' ? '8vb' : undefined);
    p.addKeySignature(keySpec);
    if (timeSig) p.addTimeSignature(timeSpec);
    probes.push(p);
  }
  Stave.formatBegModifiers(probes);
  const braceRoom = nStaves > 1 ? 14 : 0;
  const headerWidth = Math.max(...probes.map(p => p.getNoteStartX())) + braceRoom + 6;
  const leadIn = opts.leadIn ?? 18;

  // ---- build notes per measure ----
  const mt = measureTicks(score.time);
  type MeasureBuild = { voices: Voice[][]; built: BuiltNote[][]; beams: Beam[]; tuplets: Tuplet[]; width: number; formatter: Formatter };
  const measures: MeasureBuild[] = [];
  const allBuilt = new Map<string, StaveNote>();

  for (let m = 0; m < score.measures; m++) {
    const voicesPerStaff: Voice[][] = [];
    const builtPerStaff: BuiltNote[][] = [];
    const beams: Beam[] = [];
    const tuplets: Tuplet[] = [];
    let measureLen = 0;
    score.staves.forEach(staff => {
      const staffVoices: Voice[] = [];
      const staffBuilt: BuiltNote[] = [];
      const multi = staff.voices.length > 1;
      staff.voices.forEach((voice, vi) => {
        const els = voice.notes.filter(n => n.measure === m);
        if (!els.length) return;
        const stem = multi ? (vi === 0 ? 1 : -1) : undefined;
        const built = els.map(el => ({ el, vf: buildStaveNote(el, staff.clef, score, opts, stem, staff.hand) }));
        if (multi) {
          // offset rests so voices don't collide
          built.forEach(b => {
            if (b.el.rest) b.vf.setKeyLine(0, b.vf.getKeyLine(0) + (vi === 0 ? 2 : -2));
          });
        }
        tuplets.push(...makeTuplets(built));
        const v = new Voice({ numBeats: score.time[0], beatValue: score.time[1] });
        v.setMode(Voice.Mode.SOFT);
        v.addTickables(built.map(b => b.vf));
        staffVoices.push(v);
        staffBuilt.push(...built);
        built.forEach(b => allBuilt.set(b.el.id, b.vf));
        const len = els.reduce((s, e) => s + e.ticks, 0);
        measureLen = Math.max(measureLen, len);
        const stemmable = built.map(b => b.vf as StemmableNote);
        beams.push(
          ...Beam.generateBeams(stemmable, {
            groups: Beam.getDefaultBeamGroups(timeSpec),
            maintainStemDirections: multi,
            beamRests: false,
          }),
        );
      });
      if (staffVoices.length) Accidental.applyAccidentals(staffVoices, keySpec);
      voicesPerStaff.push(staffVoices);
      builtPerStaff.push(staffBuilt);
    });
    const formatter = new Formatter();
    voicesPerStaff.forEach(vs => {
      if (vs.length) formatter.joinVoices(vs);
    });
    const all = voicesPerStaff.flat();
    const minW = all.length ? formatter.preCalculateMinTotalWidth(all) : 40;
    const beats = (measureLen || mt) / PPQ;
    const width = Math.max(minW * 1.35 + 28, beats * beatWidth + 24);
    measures.push({ voices: voicesPerStaff, built: builtPerStaff, beams, tuplets, width, formatter });
  }

  const contentStart = headerWidth + leadIn;
  const contentEnd = contentStart + measures.reduce((s, m) => s + m.width, 0);
  const totalWidth = contentEnd + (opts.tailPad ?? 0) + 2;

  // ---- render ----
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(totalWidth, height);
  const ctx = renderer.getContext() as RenderContext;
  ctx.setFillStyle(INK);
  ctx.setStrokeStyle(INK);
  const svg = container.querySelector('svg')!;
  svg.setAttribute('class', 'cc-score');

  // continuous staff lines from the header to the end of the content
  const lineStaves: Stave[] = [];
  staffTops.forEach((top, si) => {
    const s = new Stave(0, top, contentEnd - braceRoom, staveOpts);
    s.setBegBarType(BarlineType.NONE);
    s.setEndBarType(BarlineType.NONE);
    s.addClef(vexClef(score.staves[si].clef), 'default', score.staves[si].clef === 'treble8vb' ? '8vb' : undefined);
    s.addKeySignature(keySpec);
    if (timeSig) s.addTimeSignature(timeSpec);
    lineStaves.push(s);
  });
  Stave.formatBegModifiers(lineStaves);
  ctx.openGroup('header');
  lineStaves.forEach(s => {
    s.setX(braceRoom);
    s.setContext(ctx).draw();
  });
  if (nStaves > 1) {
    new StaveConnector(lineStaves[0], lineStaves[nStaves - 1]).setType('brace').setContext(ctx).draw();
    new StaveConnector(lineStaves[0], lineStaves[nStaves - 1]).setType('singleLeft').setContext(ctx).draw();
  }
  ctx.closeGroup();

  const notes = new Map<string, NotePosition>();
  const measureXs: number[] = [];
  const tickXs: [number, number][] = [];
  let x = contentStart;
  const ties: StaveTie[] = [];

  measures.forEach((mb, m) => {
    measureXs.push(x);
    const staves = staffTops.map(top => {
      const s = new Stave(x, top, mb.width, staveOpts);
      s.setBegBarType(BarlineType.NONE);
      s.setEndBarType(barlines ? (m === score.measures - 1 ? BarlineType.END : BarlineType.SINGLE) : BarlineType.NONE);
      // hide this stave's own lines: the continuous lines are already drawn
      s.setConfigForLines([0, 1, 2, 3, 4].map(() => ({ visible: false })));
      return s;
    });
    const noteStart = x + 10;
    staves.forEach(s => s.setNoteStartX(noteStart));
    staves.forEach(s => s.setContext(ctx));
    mb.voices.forEach((vs, si) => vs.forEach(v => v.setStave(staves[si])));
    const all = mb.voices.flat();
    if (all.length) mb.formatter.format(all, mb.width - 24);
    // draw
    staves.forEach(s => s.draw());
    if (barlines && nStaves > 1) {
      new StaveConnector(staves[0], staves[nStaves - 1])
        .setType(m === score.measures - 1 ? 'boldDoubleRight' : 'singleRight')
        .setContext(ctx)
        .draw();
    }
    mb.voices.forEach((vs, si) => vs.forEach(v => v.draw(ctx, staves[si])));
    mb.beams.forEach(b => b.setContext(ctx).draw());
    mb.tuplets.forEach(t => t.setContext(ctx).draw());
    // positions
    mb.built.forEach((bs, si) => {
      for (const b of bs) {
        const vf = b.vf;
        const x0 = vf.getNoteHeadBeginX();
        const x1 = vf.getNoteHeadEndX();
        const pos: NotePosition = {
          id: b.el.id,
          x: (x0 + x1) / 2,
          staff: si,
          ys: vf.getYs(),
          measure: m,
          tick: b.el.tick,
          el: vf.getSVGElement(),
        };
        notes.set(b.el.id, pos);
        tickXs.push([b.el.tick, pos.x]);
      }
    });
    x += mb.width;
  });

  // ties (may cross barlines)
  score.staves.forEach(staff => staff.voices.forEach(voice => {
    voice.notes.forEach((n, i) => {
      if (!n.tieNext || n.rest) return;
      const next = voice.notes[i + 1];
      if (!next) return;
      const a = allBuilt.get(n.id);
      const b = allBuilt.get(next.id);
      if (!a || !b) return;
      const idx = n.pitches.map((_, k) => k);
      ties.push(new StaveTie({ firstNote: a, lastNote: b, firstIndexes: idx, lastIndexes: idx }));
    });
  }));
  ties.forEach(t => t.setContext(ctx).draw());

  tickXs.sort((a, b) => a[0] - b[0]);
  // de-duplicate ticks (keep the leftmost x)
  const dedup: [number, number][] = [];
  for (const [t, xx] of tickXs) {
    const last = dedup[dedup.length - 1];
    if (last && last[0] === t) last[1] = Math.min(last[1], xx);
    else dedup.push([t, xx]);
  }

  return {
    width: totalWidth,
    height,
    headerWidth: headerWidth + 4,
    staves: staffTops.map((top, i) => ({ clef: score.staves[i].clef, top, bottom: top + 4 * LINE_SPACING })),
    notes,
    measureXs,
    tickXs: dedup,
  };
}

/** Interpolated x for an arbitrary tick (for a smoothly moving playhead). */
export function xForTick(r: RenderResult, tick: number, endTick: number): number {
  const t = r.tickXs;
  if (!t.length) return r.headerWidth;
  if (tick <= t[0][0]) return t[0][1];
  for (let i = 0; i < t.length - 1; i++) {
    if (tick >= t[i][0] && tick <= t[i + 1][0]) {
      const f = (tick - t[i][0]) / (t[i + 1][0] - t[i][0] || 1);
      return t[i][1] + f * (t[i + 1][1] - t[i][1]);
    }
  }
  const last = t[t.length - 1];
  const endX = r.measureXs.length ? r.width : last[1];
  const f = Math.min(1, (tick - last[0]) / Math.max(1, endTick - last[0]));
  return last[1] + f * (endX - last[1]) * 0.6;
}
