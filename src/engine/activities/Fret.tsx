/**
 * Fretboard activities — learning the neck itself.
 *  fret-find   : find every location of a note
 *  fret-name   : a dot lights up → name it
 *  fret-play   : "play G on string 4"
 *  fret-octave : find the octave of a marked note
 *  fret-shape  : play through a CAGED chord / pentatonic box / 3-nps scale pattern
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { drawItems } from '../../curriculum/generate';
import type { ActivityDef } from '../../curriculum/types';
import type { FretMark, MarkColor } from '../../instruments';
import {
  MAJOR_SCALE,
  NATURAL_MINOR,
  PENTATONIC_MAJOR,
  PENTATONIC_MINOR,
  allLocationsOfPitchClass,
  cagedChord,
  chordShapePositions,
  midiAt,
  scaleBox,
  stepPitchClass,
  transposePcs,
  type FretPos,
  STANDARD_TUNING,
} from '../../music/guitar';
import { type Step, STEPS, isBlackKey, parsePitch, pitchClass, spellMidi, stepLabel } from '../../music/pitch';
import { type NoteSpec, type Score, buildVoice } from '../../music/score';
import { splitTicks } from '../../music/rhythm';
import { reviewPriority } from '../../state/srs';
import { type ActivityProps, ctxTuning } from '../context';
import { instrumentDef } from '../../music/instruments';
import type { Clef } from '../../music/score';
import { InstrumentPanel, type FretTap } from '../InstrumentPanel';
import { useLetterKeys, useNoteInput } from '../input';
import { ActivityHeader, PlayAlong } from '../PlayAlong';

const posKey = (p: FretPos) => `${p.string}:${p.fret}`;

function parsePc(name: string): number {
  const p = parsePitch(/\d$/.test(name) ? name : `${name}4`);
  return stepPitchClass(p.step, p.alter);
}

function pcName(pc: number, flats = false) {
  const p = spellMidi(60 + pc, flats ? -1 : 1);
  return stepLabel(p.step, p.alter);
}

// ---------------------------------------------------------------------------

type FindDef = Extract<ActivityDef, { type: 'fret-find' }>;

export function FretFind({ def, ctx, onDone }: ActivityProps<FindDef>) {
  const rounds = def.rounds ?? def.notes.length;
  const names = useMemo(() => Array.from({ length: rounds }, (_, i) => def.notes[i % def.notes.length]), [def.notes, rounds]);
  const [round, setRound] = useState(0);
  const pc = parsePc(names[round]);
  const tuning = ctxTuning(ctx);
  const targets = useMemo(() => allLocationsOfPitchClass(pc, def.frets[0], def.frets[1], def.strings, tuning), [pc, def.frets, def.strings, tuning.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [found, setFound] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ string: number; fret: number; color: MarkColor }[]>([]);
  const mistakes = useRef(0);
  const results = useRef<{ correct: boolean; key: string }[]>([]);
  const roundsOk = useRef(0);
  const tapMode = ctx.device.inputMode === 'touch';
  const flats = names[round].includes('b');

  // with a real guitar we go string by string (the mic can't tell strings apart)
  const remainingStrings = [...new Set(targets.filter(t => !found.has(posKey(t))).map(t => t.string))].sort((a, b) => b - a);
  const currentString = tapMode ? null : remainingStrings[0] ?? null;

  const finished = useRef(false);
  const completeRound = useCallback(
    (allFound: Set<string>) => {
      if (finished.current) return;
      if (targets.every(t => allFound.has(posKey(t)))) {
        if (round + 1 >= rounds) finished.current = true;
        if (ctx.settings.sfx) sfx.correct();
        const ok = mistakes.current === 0;
        if (ok) roundsOk.current++;
        targets.forEach(t => results.current.push({ key: `fret:${t.string}:${t.fret}`, correct: ok }));
        setTimeout(() => {
          if (round + 1 >= rounds) {
            onDone({ total: rounds, correct: roundsOk.current, items: results.current, notes: results.current.length, responseMs: [] });
          } else {
            mistakes.current = 0;
            setFound(new Set());
            setWrong([]);
            setRound(round + 1);
          }
        }, 900);
      }
    },
    [targets, round, rounds, onDone, ctx.settings.sfx],
  );

  const tryPos = useCallback(
    (p: FretPos) => {
      if (finished.current) return;
      const hit = targets.find(t => t.string === p.string && t.fret === p.fret);
      if (hit && !found.has(posKey(hit))) {
        const nf = new Set(found);
        nf.add(posKey(hit));
        setFound(nf);
        completeRound(nf);
      } else if (!hit) {
        mistakes.current++;
        if (ctx.settings.sfx) sfx.wrong();
        const w = { ...p, color: 'bad' as MarkColor };
        setWrong(ws => [...ws, w]);
        setTimeout(() => setWrong(ws => ws.filter(x => x !== w)), 700);
      }
    },
    [targets, found, completeRound, ctx.settings.sfx],
  );

  const onFretTap = useCallback((t: FretTap) => tryPos(t), [tryPos]);
  useNoteInput(e => {
    if (e.type !== 'on' || e.source === 'touch') return;
    const cand = targets.filter(t => !found.has(posKey(t)) && midiAt(t.string, t.fret, tuning) === e.midi && (currentString === null || t.string === currentString));
    if (cand.length) tryPos(cand[0]);
    else if (pitchClass(e.midi) !== pc) {
      mistakes.current++;
      if (ctx.settings.sfx) sfx.wrong();
    }
  });

  const marks: FretMark[] = targets.filter(t => found.has(posKey(t))).map(t => ({ ...t, color: 'good', label: pcName(pc, flats), root: true }));
  const prompt = tapMode
    ? `Tap every ${pcName(pc, flats)} between fret ${def.frets[0]} and ${def.frets[1]}${def.strings.length < tuning.length ? ` on strings ${def.strings.join(', ')}` : ''}.`
    : currentString
      ? `Play ${pcName(pc, flats)} on string ${currentString}.`
      : 'Nice!';
  return (
    <div className="activity fret-activity">
      <ActivityHeader title={def.title ?? `Find every ${pcName(pc, flats)}`} prompt={def.prompt ?? prompt} badge={`${found.size} / ${targets.length}`} progress={(round + found.size / Math.max(1, targets.length)) / rounds} />
      <div className="fret-target display">
        <span className="fret-target-note">{pcName(pc, flats)}</span>
        <span className="faint">round {round + 1} of {rounds}</span>
      </div>
      <InstrumentPanel ctx={ctx} fretMarks={marks} pressedFrets={wrong} fretRange={[Math.max(0, def.frets[0]), Math.max(def.frets[1], 5)]} onFretTap={onFretTap} emitNotes={false} fretNoteNames="marks" height={undefined} />
    </div>
  );
}

// ---------------------------------------------------------------------------

type QuizDef = Extract<ActivityDef, { type: 'fret-name' | 'fret-play' | 'fret-octave' }>;

export function FretQuiz({ def, ctx, onDone }: ActivityProps<QuizDef>) {
  const naturalsOnly = def.type !== 'fret-octave' && def.naturalsOnly !== false && (def.naturalsOnly ?? true);
  const tuning = ctxTuning(ctx);
  const cards = useMemo(() => {
    const pool: FretPos[] = [];
    for (const s of def.strings) for (let f = def.frets[0]; f <= def.frets[1]; f++) {
      if (s > tuning.length) continue;
      const m = midiAt(s, f, tuning);
      if (naturalsOnly && isBlackKey(m)) continue;
      pool.push({ string: s, fret: f });
    }
    return drawItems(ctx.rng, pool, def.count, p => 1 + reviewPriority(ctx.items[`fret:${p.string}:${p.fret}`]), (a, b) => a.string === b.string && a.fret === b.fret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);
  const [i, setI] = useState(0);
  const [tries, setTries] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; picked?: string } | null>(null);
  const [flashMarks, setFlashMarks] = useState<{ string: number; fret: number; color: MarkColor }[]>([]);
  const results = useRef<{ key: string; correct: boolean; ms: number }[]>([]);
  const start = useRef(performance.now());
  const locked = useRef(false);
  const card = cards[i];
  const midi = card ? midiAt(card.string, card.fret, tuning) : 0;
  const name = card ? spellMidi(midi, 1) : null;

  const next = useCallback(() => {
    if (i + 1 >= cards.length) {
      const r = results.current;
      onDone({ total: r.length, correct: r.filter(x => x.correct).length, items: r, notes: r.length, responseMs: r.filter(x => x.correct).map(x => x.ms) });
      return; // stay locked
    }
    locked.current = false;
    setFb(null);
    setTries(0);
    setFlashMarks([]);
    start.current = performance.now();
    setI(i + 1);
  }, [i, cards.length, onDone]);

  const resolve = useCallback(
    (ok: boolean, picked?: string) => {
      if (locked.current || !card) return;
      if (ok) {
        locked.current = true;
        results.current.push({ key: `fret:${card.string}:${card.fret}`, correct: tries === 0, ms: performance.now() - start.current });
        if (ctx.settings.sfx) sfx.correct();
        setFb({ ok: true, picked });
        setTimeout(next, tries === 0 ? 450 : 1000);
      } else {
        if (ctx.settings.sfx) sfx.wrong();
        setTries(t => t + 1);
        setFb({ ok: false, picked });
      }
    },
    [card, tries, next, ctx.settings.sfx],
  );

  const answerLetter = useCallback(
    (step: string, alter: number) => {
      if (!name) return;
      const enharmonic = spellMidi(midi, -1);
      const ok = (name.step === step && name.alter === alter) || (enharmonic.step === step && enharmonic.alter === alter);
      resolve(ok, `${step}${alter}`);
    },
    [name, midi, resolve],
  );

  useLetterKeys(def.type === 'fret-name', (l, a) => answerLetter(l, a));

  const isOctave = (s: number, f: number) => {
    const m = midiAt(s, f, tuning);
    return Math.abs(m - midi) === 12 && s !== card?.string;
  };

  const onFretTap = useCallback(
    (t: FretTap) => {
      if (!card) return;
      if (def.type === 'fret-play') {
        const ok = t.string === card.string && t.fret === card.fret;
        if (!ok) setFlashMarks([{ string: t.string, fret: t.fret, color: 'bad' }]);
        resolve(ok);
      } else if (def.type === 'fret-octave') {
        const ok = isOctave(t.string, t.fret);
        setFlashMarks([{ string: t.string, fret: t.fret, color: ok ? 'good' : 'bad' }]);
        resolve(ok);
      } else if (def.type === 'fret-name') {
        // tapping the same note elsewhere doesn't answer; ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, def.type, resolve],
  );

  useNoteInput(e => {
    if (e.type !== 'on' || e.source === 'touch' || !card) return;
    if (def.type === 'fret-play' || def.type === 'fret-name') resolve(e.midi === midi);
    else if (def.type === 'fret-octave') resolve(Math.abs(e.midi - midi) === 12);
  });

  const marks: FretMark[] = [];
  if (card && (def.type === 'fret-name' || def.type === 'fret-octave')) {
    marks.push({ string: card.string, fret: card.fret, color: def.type === 'fret-octave' ? 'gold' : fb?.ok ? 'good' : 'gold', pulse: !fb?.ok, root: def.type === 'fret-octave', label: fb?.ok || def.type === 'fret-octave' ? stepLabel(name!.step, name!.alter) : '?' });
  }
  if (card && def.type === 'fret-play' && (fb?.ok || tries >= 2)) marks.push({ string: card.string, fret: card.fret, color: fb?.ok ? 'good' : 'hint', label: stepLabel(name!.step, name!.alter) });
  if (card && def.type === 'fret-octave' && tries >= 2) {
    for (let s = 1; s <= tuning.length; s++) for (let f = def.frets[0]; f <= def.frets[1]; f++) if (isOctave(s, f)) marks.push({ string: s, fret: f, color: 'hint', ghost: true });
  }

  const title =
    def.title ??
    (def.type === 'fret-name' ? 'Name the note' : def.type === 'fret-play' ? `Play ${name ? stepLabel(name.step, name.alter) : ''} on string ${card?.string}` : 'Find the octave');
  const prompt =
    def.prompt ??
    (def.type === 'fret-name'
      ? 'Which note is lit on the fretboard?'
      : def.type === 'fret-play'
        ? `Frets ${def.frets[0]}–${def.frets[1]}. Tap it or play it.`
        : 'Use the octave shapes to find the same note an octave away on another string.');

  return (
    <div className="activity fret-activity">
      <ActivityHeader title={title} prompt={prompt} badge={`${Math.min(i + 1, cards.length)} / ${cards.length}`} progress={i / Math.max(1, cards.length)} />
      {def.type === 'fret-play' && name && (
        <div className="fret-target display">
          <span className="fret-target-note">{stepLabel(name.step, name.alter)}</span>
          <span className="faint">string {card.string}</span>
        </div>
      )}
      <InstrumentPanel
        ctx={ctx}
        fretMarks={marks}
        pressedFrets={flashMarks}
        fretRange={[Math.max(0, def.frets[0] > 0 ? def.frets[0] - 1 : 0), Math.max(def.frets[1], 5)]}
        onFretTap={onFretTap}
        emitNotes={false}
        fretNoteNames="marks"
      />
      {def.type === 'fret-name' && (
        <div className="answer-grid" role="group">
          {(naturalsOnly ? STEPS.map(s => ({ s, a: 0 })) : STEPS.flatMap(s => [{ s, a: 0 }, ...(s !== 'E' && s !== 'B' ? [{ s, a: 1 }] : [])])).map(({ s, a }) => {
            const id = `${s}${a}`;
            return (
              <button key={id} className={`answer-btn ${fb?.picked === id ? (fb.ok ? 'is-good' : 'is-bad') : ''}`} onClick={() => answerLetter(s as Step, a)}>
                <span className="answer-label">{stepLabel(s as Step, a)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type ShapeDef = Extract<ActivityDef, { type: 'fret-shape' }>;

export function shapePositions(def: ShapeDef, tuning: readonly number[] = STANDARD_TUNING): { positions: FretPos[]; roots: Set<string>; label: string } {
  const sh = def.shape;
  const rootPc = parsePc(sh.root);
  if (sh.kind === 'caged') {
    const c = cagedChord(rootPc, sh.shape, sh.quality ?? 'major', 0);
    const positions = chordShapePositions(c);
    const roots = new Set(positions.filter(p => pitchClass(midiAt(p.string, p.fret)) === rootPc).map(posKey));
    return { positions, roots, label: `${c.name} — ${sh.shape} shape` };
  }
  const quality = sh.quality ?? (sh.kind === 'pentatonic' ? 'minor' : 'major');
  const pcs = sh.kind === 'pentatonic' ? (quality === 'minor' ? PENTATONIC_MINOR : PENTATONIC_MAJOR) : quality === 'minor' ? NATURAL_MINOR : MAJOR_SCALE;
  const start = sh.kind === 'pentatonic' ? sh.box : sh.startDegree;
  const positions = scaleBox(transposePcs(pcs, rootPc), start, sh.kind === 'pentatonic' ? 2 : 3, 0, tuning);
  const roots = new Set(positions.filter(p => pitchClass(midiAt(p.string, p.fret, tuning)) === rootPc).map(posKey));
  const rootName = pcName(rootPc, sh.root.includes('b'));
  const label = sh.kind === 'pentatonic' ? `${rootName} ${quality} pentatonic — box ${sh.box + 1}` : `${rootName} ${quality} — pattern ${sh.startDegree + 1} (3 notes per string)`;
  return { positions, roots, label };
}

export function FretShape({ def, ctx, onDone }: ActivityProps<ShapeDef>) {
  const tuning = ctxTuning(ctx);
  const tuningKey = tuning.join();
  const { positions, roots, label } = useMemo(() => shapePositions(def, tuning), [def, tuningKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const score: Score = useMemo(() => {
    const at = (p: FretPos) => midiAt(p.string, p.fret, tuning);
    const sorted = [...positions].sort((a, b) => at(a) - at(b) || b.string - a.string);
    const seq = def.direction === 'updown' ? [...sorted, ...sorted.slice(0, -1).reverse()] : sorted;
    const fretted = positions.filter(p => p.fret > 0).map(p => p.fret);
    const handPos = fretted.length ? Math.min(...fretted) : 1;
    const specs: NoteSpec[] = seq.map(p => ({
      pitches: [spellMidi(at(p), 1)],
      base: 'e',
      strings: [p.string],
      fingers: [p.fret === 0 ? 0 : Math.min(4, Math.max(1, p.fret - handPos + 1))],
    }));
    if (def.shape.kind === 'caged') {
      specs.push({ pitches: sorted.map(p => spellMidi(at(p), 1)), base: 'h', strings: sorted.map(p => p.string), fingers: sorted.map(p => (p.fret === 0 ? 0 : Math.min(4, Math.max(1, p.fret - handPos + 1)))) });
    }
    // pad to whole bars of 4/4 with rests
    const ticks = specs.reduce((s, x) => s + (x.base === 'e' ? 24 : 96), 0);
    const rem = (192 - (ticks % 192)) % 192;
    for (const r of splitTicks(rem)) specs.push({ pitches: [], base: r.base, dots: r.dots });
    const id = `shape${Math.floor(Math.random() * 1e6)}`;
    const voice = buildVoice(specs, [4, 4], id);
    return {
      id,
      title: label,
      key: { fifths: 0, mode: 'major' },
      time: [4, 4],
      tempo: def.tempo ?? 72,
      measures: Math.max(...voice.notes.map(n => n.measure)) + 1,
      staves: [{ clef: instrumentDef(ctx.instrument).clefs[0] as Clef, voices: [voice] }],
      instrument: ctx.instrument,
      tuning: [...tuning],
    };
  }, [positions, def, label, ctx.instrument, tuningKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const contextMarks: FretMark[] = positions.map(p => ({ ...p, ghost: !roots.has(posKey(p)), root: roots.has(posKey(p)), color: roots.has(posKey(p)) ? 'gold' : 'hint' }));
  const frets = positions.map(p => p.fret);
  const lo = Math.max(0, Math.min(...frets) - 1);
  const hi = Math.max(lo + 5, Math.max(...frets) + 1);
  return (
    <PlayAlong
      ctx={ctx}
      score={score}
      mode={def.mode}
      tempo={def.tempo}
      fingering="all"
      title={def.title ?? label}
      prompt={def.prompt ?? 'Play the pattern from the lowest note up. Roots are highlighted.'}
      fretRange={[lo, Math.min(19, hi)]}
      contextMarks={contextMarks}
      onDone={onDone}
    />
  );
}
