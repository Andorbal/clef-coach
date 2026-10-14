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
  ClefNote,
  Dot,
  Formatter,
  FretHandFinger,
  Modifier,
  NoteSubGroup,
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
import { type Pitch, diatonicIndex, midiOf, transposeOctaves, vexKey } from '../music/pitch';
import { BASE_TICKS, PPQ, VEX_DURATION, measureTicks } from '../music/rhythm';
import { familyOf } from '../music/instruments';
import { type Clef, type ClefChange, type NoteEl, type Score, clefAt, clefBase, clefOctave, keyAt, measureStartTick, tieTarget, tiesOn, timeAt } from '../music/score';
import { malletLabel } from '../music/sticking';

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
  const o = clefOctave(clef);
  return o ? transposeOctaves(p, o) : p;
}

function vexClef(clef: Clef): 'treble' | 'bass' {
  return clefBase(clef);
}

/** VexFlow clef annotation ("8vb" under the clef for octave-transposing instruments). */
function clefAnnotation(clef: Clef): string | undefined {
  return clefOctave(clef) === 1 ? '8vb' : undefined;
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
  /** Opening clef (see clefChanges). */
  clef: Clef;
  clefChanges?: ClefChange[];
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
  /**
   * The clef / key / time headers the music needs as it scrolls: header i applies from
   * x on (render coordinates). Their SVG groups carry data-header="i"; only the first is shown.
   */
  headers: { x: number; tick: number }[];
}

/** y coordinate for a (sounding) pitch on a given staff, at a tick (for the clef in force). */
export function yForPitch(geom: StaffGeometry, p: Pitch, tick = 0): number {
  const clef = clefAt(geom, tick);
  const w = writtenPitch(p, clef);
  const lines = CLEF_LINES[vexClef(clef)];
  return geom.top + (lines.top - diatonicIndex(w)) * HALF;
}

/** Ledger line y positions needed for a pitch (empty if on the staff). */
export function ledgerLinesFor(geom: StaffGeometry, p: Pitch, tick = 0): number[] {
  const clef = clefAt(geom, tick);
  const w = writtenPitch(p, clef);
  const d = diatonicIndex(w);
  const lines = CLEF_LINES[vexClef(clef)];
  const out: number[] = [];
  for (let l = lines.top + 2; l <= d; l += 2) out.push(geom.top + (lines.top - l) * HALF);
  for (let l = lines.bottom - 2; l >= d; l -= 2) out.push(geom.top + (lines.top - l) * HALF);
  return out;
}

function staffExtents(score: Score, si: number, opts: RenderOptions): { above: number; below: number } {
  const staff = score.staves[si];
  // how far notes reach above the top line and below the bottom line, in half spaces
  let up = 0;
  let down = 0;
  let maxChord = 1;
  for (const v of staff.voices) for (const n of v.notes) {
    maxChord = Math.max(maxChord, n.pitches.length);
    const clef = clefAt(staff, n.tick);
    const lines = CLEF_LINES[vexClef(clef)];
    for (const p of n.pitches) {
      const d = diatonicIndex(writtenPitch(p, clef));
      up = Math.max(up, d - lines.top);
      down = Math.max(down, lines.bottom - d);
    }
  }
  // stems (3.5 spaces) can extend beyond the notes; give room for (stacked) fingering text
  const family = familyOf(score.instrument);
  const finger = opts.fingering ? (family === 'fretted' ? 30 : 6 + 13 * maxChord) : 0;
  // piano: right-hand fingers above, left-hand below; mallets: sticking always above; fretted: string numbers below
  const twoVoices = family === 'keyboard' && staff.voices.length > 1;
  const fingerAbove = family === 'mallet' || (family === 'keyboard' && (staff.hand !== 'L' || twoVoices));
  const fingerBelow = family === 'fretted' || (family === 'keyboard' && (staff.hand === 'L' || twoVoices));
  // fingering sits beyond stems and beams that point its way
  const stems = opts.fingering && family === 'keyboard' ? 26 : 0;
  const above = Math.max(26, up * HALF + 30) + (fingerAbove ? finger + stems : 0);
  const below = Math.max(26, down * HALF + 30) + (fingerBelow ? finger + stems : 0);
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
  const family = familyOf(score.instrument);
  if (!el.rest && opts.fingering && el.fingers && family === 'mallet') {
    // sticking above the notes, top mallet on top
    for (let i = 0; i < el.pitches.length; i++) {
      const f = el.fingers[i];
      if (f === undefined || el.tiePrev) continue;
      const a = new Annotation(malletLabel(f, score.mallets ?? 2));
      a.setFont('Inter Variable, Inter, sans-serif', 11, 700);
      a.setVerticalJustification(Annotation.VerticalJustify.TOP);
      note.addModifier(a, 0);
    }
  } else if (!el.rest && opts.fingering && el.fingers) {
    if (family === 'keyboard') {
      const order = el.pitches.map((_, i) => i);
      // left hand below, right hand above; with two voices on a staff, on each voice's stem side
      const below = stemDir === undefined ? hand === 'L' : stemDir < 0;
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
  if (!el.rest && opts.strings && el.strings && family === 'fretted' && !el.tiePrev) {
    if (el.pitches.length === 1 && el.strings[0]) {
      const sn = new StringNumber(String(el.strings[0]));
      sn.setPosition(Modifier.Position.BELOW);
      note.addModifier(sn, 0);
    }
  }
  return note;
}

/**
 * Stem directions for the voices of one staff in one measure: 1 up, -1 down, undefined
 * for automatic stems (a voice playing on its own), null to leave a voice out (it only
 * rests here while another voice plays, so its rests are just padding). The upper voice
 * stems up: normally the first, unless the second sits wholly above it in this measure.
 */
export function voiceStems(voices: NoteEl[][]): (1 | -1 | undefined | null)[] {
  const playing = voices.flatMap((els, vi) => (els.some(n => !n.rest) ? [vi] : []));
  if (playing.length <= 1) {
    const shown = playing.length ? playing[0] : voices.findIndex(els => els.length > 0);
    return voices.map((_, vi) => (vi === shown ? undefined : null));
  }
  let up = playing[0];
  if (playing.length === 2) {
    const [a, b] = playing.map(vi => voices[vi].flatMap(n => n.pitches.map(midiOf)));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    if (Math.min(...b) >= Math.max(...a) && mean(b) > mean(a)) up = playing[1];
  }
  return voices.map((_, vi) => (!playing.includes(vi) ? null : vi === up ? 1 : -1));
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

  // ---- headers (clef + key + time): the opening one, and one after every clef, key or time change ----
  const starts = Array.from({ length: score.measures + 1 }, (_, m) => measureStartTick(score, m));
  const measureOfTick = (t: number) => {
    let m = 0;
    while (m + 1 < score.measures && starts[m + 1] <= t) m++;
    return m;
  };
  const changeTicks = [
    0,
    ...(score.changes ?? []).filter(c => c.measure > 0 && c.measure < score.measures).map(c => starts[c.measure]),
    ...score.staves.flatMap(st => (st.clefChanges ?? []).map(c => c.tick)),
  ];
  type HeaderState = { tick: number; clefs: Clef[]; key: string; time: string };
  const headerStates: HeaderState[] = [];
  for (const tick of [...new Set(changeTicks)].sort((a, b) => a - b)) {
    const m = measureOfTick(tick);
    const t = timeAt(score, m);
    const st: HeaderState = { tick, clefs: score.staves.map(s => clefAt(s, tick)), key: vexKeySpec(keyAt(score, m)), time: `${t[0]}/${t[1]}` };
    const prev = headerStates[headerStates.length - 1];
    if (!prev || prev.key !== st.key || prev.time !== st.time || prev.clefs.some((c, i) => c !== st.clefs[i])) headerStates.push(st);
  }
  const headerStaves = (h: HeaderState, width: number) => {
    const ss = h.clefs.map((clef, si) => {
      const s = new Stave(0, staffTops[si], width, staveOpts);
      s.setBegBarType(BarlineType.NONE);
      s.setEndBarType(BarlineType.NONE);
      s.addClef(vexClef(clef), 'default', clefAnnotation(clef));
      s.addKeySignature(h.key);
      if (timeSig) s.addTimeSignature(h.time);
      return s;
    });
    Stave.formatBegModifiers(ss);
    return ss;
  };
  const braceRoom = nStaves > 1 ? 14 : 0;
  const headerWidth = Math.max(...headerStates.flatMap(h => headerStaves(h, 400).map(p => p.getNoteStartX()))) + braceRoom + 6;
  const leadIn = opts.leadIn ?? 18;

  // ---- key / time changes: width of the signatures drawn at the start of a measure ----
  const changeAt = new Map<number, { key?: string; prevKey?: string; time?: string; width: number }>();
  for (const c of score.changes ?? []) {
    if (c.measure <= 0 || c.measure >= score.measures) continue;
    const key = c.key ? vexKeySpec(c.key) : undefined;
    const prevKey = c.key ? vexKeySpec(keyAt(score, c.measure - 1)) : undefined;
    const time = c.time ? `${c.time[0]}/${c.time[1]}` : undefined;
    const probeC = new Stave(0, 0, 400, { spaceAboveStaffLn: 0, spaceBelowStaffLn: 0 });
    probeC.setBegBarType(BarlineType.NONE);
    if (key) probeC.addKeySignature(key, prevKey);
    if (time && timeSig) probeC.addTimeSignature(time);
    Stave.formatBegModifiers([probeC]);
    changeAt.set(c.measure, { key, prevKey, time: timeSig ? time : undefined, width: probeC.getNoteStartX() + 4 });
  }

  // ---- build notes per measure ----
  type MeasureBuild = { voices: Voice[][]; built: BuiltNote[][]; beams: Beam[]; tuplets: Tuplet[]; width: number; formatter: Formatter; lead: number };
  const measures: MeasureBuild[] = [];
  const allBuilt = new Map<string, StaveNote>();
  const clefNext = score.staves.map(() => 0);
  const clefMarks: { tick: number; vf: StaveNote }[] = [];

  for (let m = 0; m < score.measures; m++) {
    const mTime = timeAt(score, m);
    const mt = measureTicks(mTime);
    const mTimeSpec = `${mTime[0]}/${mTime[1]}`;
    const mKeySpec = vexKeySpec(keyAt(score, m));
    const voicesPerStaff: Voice[][] = [];
    const builtPerStaff: BuiltNote[][] = [];
    const beams: Beam[] = [];
    const tuplets: Tuplet[] = [];
    let measureLen = 0;
    score.staves.forEach((staff, si) => {
      const staffVoices: Voice[] = [];
      const staffBuilt: BuiltNote[] = [];
      const inMeasure = staff.voices.map(v => v.notes.filter(n => n.measure === m));
      const stems = voiceStems(inMeasure);
      inMeasure.forEach((els, vi) => {
        if (!els.length || stems[vi] === null) return;
        const stem = stems[vi] ?? undefined;
        const multi = stem !== undefined;
        const built = els.map(el => ({ el, vf: buildStaveNote(el, clefAt(staff, el.tick), score, opts, stem, staff.hand) }));
        if (multi) {
          // offset rests so voices don't collide
          built.forEach(b => {
            if (b.el.rest) b.vf.setKeyLine(0, b.vf.getKeyLine(0) + (stem === 1 ? 2 : -2));
          });
        }
        tuplets.push(...makeTuplets(built));
        const v = new Voice({ numBeats: mTime[0], beatValue: mTime[1] });
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
            groups: Beam.getDefaultBeamGroups(mTimeSpec),
            maintainStemDirections: multi,
            beamRests: false,
          }),
        );
      });
      if (staffVoices.length) Accidental.applyAccidentals(staffVoices, mKeySpec);
      // a clef change is drawn just before the first note at or after it
      const changes = staff.clefChanges ?? [];
      while (clefNext[si] < changes.length && changes[clefNext[si]].tick < starts[m + 1]) {
        const c = changes[clefNext[si]];
        const at = staffBuilt.filter(b => b.el.tick >= c.tick).sort((a, b) => a.el.tick - b.el.tick)[0];
        if (!at) break;
        at.vf.addModifier(new NoteSubGroup([new ClefNote(vexClef(c.clef), 'small', clefAnnotation(c.clef))]), 0);
        clefMarks.push({ tick: c.tick, vf: at.vf });
        clefNext[si]++;
      }
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
    const lead = changeAt.get(m)?.width ?? 0;
    const width = Math.max(minW * 1.35 + 28, beats * beatWidth + 24) + lead;
    measures.push({ voices: voicesPerStaff, built: builtPerStaff, beams, tuplets, width, formatter, lead });
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
  ctx.openGroup('lines');
  staffTops.forEach(top => {
    const s = new Stave(braceRoom, top, contentEnd - braceRoom, staveOpts);
    s.setBegBarType(BarlineType.NONE);
    s.setEndBarType(BarlineType.NONE);
    s.setContext(ctx).draw();
  });
  ctx.closeGroup();
  // the headers, each with its own short lines (the scrolling view shows one at a time)
  headerStates.forEach((h, i) => {
    const g = ctx.openGroup('header') as unknown as SVGGElement | undefined;
    const ss = headerStaves(h, headerWidth - braceRoom);
    ss.forEach(s => {
      s.setX(braceRoom);
      s.setContext(ctx).draw();
    });
    if (nStaves > 1) {
      new StaveConnector(ss[0], ss[nStaves - 1]).setType('brace').setContext(ctx).draw();
      new StaveConnector(ss[0], ss[nStaves - 1]).setType('singleLeft').setContext(ctx).draw();
    }
    ctx.closeGroup();
    g?.setAttribute?.('data-header', String(i));
    if (i > 0) g?.setAttribute?.('display', 'none');
  });

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
      const ch = changeAt.get(m);
      if (ch?.key) s.addKeySignature(ch.key, ch.prevKey);
      if (ch?.time) s.addTimeSignature(ch.time);
      return s;
    });
    const noteStart = x + 10 + mb.lead;
    staves.forEach(s => s.setNoteStartX(noteStart));
    staves.forEach(s => s.setContext(ctx));
    mb.voices.forEach((vs, si) =>
      vs.forEach(v => {
        v.setStave(staves[si]);
        v.getTickables().forEach(t => t.setStave(staves[si]));
      }),
    );
    const all = mb.voices.flat();
    if (all.length) mb.formatter.format(all, mb.width - 24 - mb.lead);
    // give beamed stems their final length before the notes are drawn, so fingering clears the beams
    mb.beams.forEach(b => b.postFormat());
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
      if ((!n.tieNext && !n.ties) || n.rest) return;
      const a = allBuilt.get(n.id);
      if (!a) return;
      // each tied note to the same pitch where it lands (the next chord, or later for a held arpeggio)
      const byTarget = new Map<number, { first: number[]; last: number[] }>();
      n.pitches.forEach((_, k) => {
        const to = tiesOn(n, k) ? tieTarget(voice.notes, i, k) : null;
        if (!to) return;
        const e = byTarget.get(to[0]) ?? { first: [], last: [] };
        e.first.push(k);
        e.last.push(to[1]);
        byTarget.set(to[0], e);
      });
      for (const [j, e] of byTarget) {
        const b = allBuilt.get(voice.notes[j].id);
        if (b) ties.push(new StaveTie({ firstNote: a, lastNote: b, firstIndexes: e.first, lastIndexes: e.last }));
      }
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

  // where each header takes over: the measure of a key / time change, or just before a new clef
  const headers = headerStates.map((h, i) => {
    if (i === 0) return { x: 0, tick: 0 };
    const xs = clefMarks.filter(c => c.tick === h.tick).map(c => c.vf.getNoteHeadBeginX() - 26);
    const m = measureOfTick(h.tick);
    if (starts[m] === h.tick && (score.changes ?? []).some(c => c.measure === m)) xs.push(measureXs[m]);
    return { x: xs.length ? Math.min(...xs) : (measureXs[m] ?? 0), tick: h.tick };
  });

  return {
    width: totalWidth,
    height,
    headerWidth: headerWidth + 4,
    staves: staffTops.map((top, i) => ({ clef: score.staves[i].clef, clefChanges: score.staves[i].clefChanges, top, bottom: top + 4 * LINE_SPACING })),
    notes,
    measureXs,
    tickXs: dedup,
    headers,
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
