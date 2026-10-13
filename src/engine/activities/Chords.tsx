/**
 * Chord activities.
 *  chord-play : pick each string, strum chord changes, or strum along with a song —
 *               scored like any other piece (the mic checks every note of a strummed chord)
 *  chord-quiz : name the chord from its diagram, or pick the diagram for a name
 */
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { type ChordSegment, chordPlayScore } from '../../curriculum/chordScore';
import type { FretMark, KeyMark } from '../../instruments';
import type { ActivityDef } from '../../curriculum/types';
import { ChordPicture, playView } from '../../instruments/ChordCell';
import { CHORD_ROOTS } from '../../music/chordbook';
import { type ChordSymbol, chordName, chordQuality, chordSymbolText, parseChordSymbol, rootPc } from '../../music/chords';
import { type ChordView, chordViews, parseChordRef } from '../../music/chordViews';
import { type InstrumentId, type InstrumentPrefs, instrumentDef, isFretted, tuningFor } from '../../music/instruments';
import type { ItemResult } from '../../state/srs';
import { type ActivityProps, prefsOf } from '../context';
import { ActivityHeader, PlayAlong } from '../PlayAlong';

type PlayDef = Extract<ActivityDef, { type: 'chord-play' }>;
type QuizDef = Extract<ActivityDef, { type: 'chord-quiz' }>;

const nameOf = (sym: string) => {
  try {
    return chordName(parseChordSymbol(parseChordRef(sym).symbol));
  } catch {
    return sym;
  }
};

export function ChordPlayActivity({ def, ctx, onDone }: ActivityProps<PlayDef>) {
  const prefs = prefsOf(ctx.settings);
  const built = useMemo(() => chordPlayScore(def, ctx.instrument, prefs), [def, ctx.instrument, ctx.settings.ukuleleTuning, ctx.settings.bassStrings, ctx.settings.malletVariant]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!built) {
    return (
      <div className="activity">
        <p className="dim">These chords aren't available on this instrument.</p>
        <button className="btn" onClick={() => onDone({ total: 0, correct: 0, items: [], notes: 0, responseMs: [], ungraded: true })}>
          Skip
        </button>
      </div>
    );
  }
  const names = (def.chords ?? []).map(nameOf).join(' – ');
  const fretted = isFretted(ctx.instrument);
  const title = def.title ?? (built.song ? `Strum along: ${built.song.title}` : def.pattern === 'pick' ? `${names}, note by note` : `Changes: ${names}`);
  const prompt =
    def.prompt ??
    (built.song
      ? `Play the chords while the app plays the tune.${def.mode === 'tempo' ? ' Keep going through the changes — landing on the beat matters more than a perfect shape.' : ''}`
      : def.pattern === 'pick'
        ? fretted
          ? 'Hold the shape, then pick each string on its own, low to high, so every note rings clearly. Then strum it.'
          : 'Play the notes one at a time, then all together.'
        : def.mode === 'tempo'
          ? `${fretted ? 'Strum' : 'Play'} on the beat and change shape in time — keep going even if a change isn't perfect yet.`
          : `${fretted ? 'Strum' : 'Play'} each chord. Take your time over the changes; the app waits for you.`);
  const staff = built.chordStaff;
  const contextAt = chordContextAt(built.segments, ctx.instrument, prefs);
  return (
    <PlayAlong
      ctx={ctx}
      score={built.score}
      mode={def.mode}
      tempo={def.tempo ?? (def.mode === 'tempo' ? built.score.tempo : 70)}
      fingering={def.pattern === 'pick' ? 'all' : 'none'}
      filter={staff > 0 ? n => n.staff === staff : undefined}
      accompVolume={0.8}
      contextAt={contextAt}
      alwaysHint={def.pattern === 'pick' || ctx.progress < 0.5}
      title={title}
      prompt={prompt}
      onDone={onDone}
    />
  );
}

/**
 * Marks for the whole shape of the chord sounding at a tick (the next note pulses on top
 * of it). `offset` maps a sliced score's ticks back to the full score's.
 */
export function chordContextAt(segments: ChordSegment[], instrument: InstrumentId, prefs: InstrumentPrefs, offset = 0) {
  const tuning = tuningFor(instrument, prefs).open;
  const fretted = isFretted(instrument);
  return (t: number): { frets?: FretMark[]; keys?: KeyMark[] } => {
    const tick = t + offset;
    const seg = segments.find(sg => tick >= sg.tick && tick < sg.tick + sg.ticks) ?? segments.find(sg => sg.tick >= tick);
    if (!seg) return {};
    if (fretted) return { frets: seg.shape.notes.filter(n => n.string).map(n => ({ string: n.string!, fret: n.midi - tuning[n.string! - 1], finger: n.finger || undefined, color: 'hint' as const, root: n.root })) };
    return {
      keys: seg.shape.notes.map(n => ({
        midi: n.midi,
        color: 'hint' as const,
        finger: instrument === 'mallets' ? undefined : n.finger,
        label: instrument === 'mallets' && n.finger ? String(n.finger) : undefined,
      })),
    };
  };
}

// ---------------------------------------------------------------------------
// Chord quiz
// ---------------------------------------------------------------------------

/** Wrong answers that look plausible: the other chords in the lesson, then near neighbours. */
function distractors(target: string, pool: string[], n: number, rnd: () => number): string[] {
  const t = parseChordSymbol(parseChordRef(target).symbol);
  const sym = (r: string) => parseChordRef(r).symbol;
  const out = pool.filter(s => sym(s) !== sym(target));
  const near = (c: ChordSymbol): string[] => {
    const q = (id: string) => chordQuality(id)!;
    const same = (qid: string) => chordSymbolText({ ...c, quality: q(qid), bass: undefined });
    const moved = (semis: number) => chordSymbolText({ ...c, root: CHORD_ROOTS.find(r => rootPc(r) === (rootPc(c.root) + semis + 12) % 12)!, bass: undefined });
    const alt = c.quality.id === 'maj' ? ['min', '7'] : c.quality.id === 'min' ? ['maj', 'm7'] : c.quality.id === '7' ? ['maj', 'maj7'] : ['maj', 'min'];
    return [...alt.map(same), moved(5), moved(7), moved(2)];
  };
  const extra = near(t).filter(s => s !== sym(target) && !out.some(o => sym(o) === s));
  const shuffle = <T,>(a: T[]) => a.map(x => [rnd(), x] as const).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  return [...shuffle(out), ...extra].slice(0, n);
}

export function ChordQuiz({ def, ctx, onDone }: ActivityProps<QuizDef>) {
  const prefs = prefsOf(ctx.settings);
  const rnd = ctx.rng;
  const rounds = useMemo(() => {
    const list: string[] = [];
    let last = '';
    while (list.length < def.count) {
      const shuffled = [...def.chords].sort(() => rnd() - 0.5);
      for (const s of shuffled) {
        if (list.length >= def.count) break;
        if (s === last && def.chords.length > 1) continue;
        list.push(s);
        last = s;
      }
    }
    return list.map(target => {
      const options = [target, ...distractors(target, def.chords, def.reverse ? 2 : 3, rnd)].sort(() => rnd() - 0.5);
      return { target, options };
    });
  }, [def.chords, def.count, def.reverse, rnd]);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ picked: string; ok: boolean } | null>(null);
  const [tries, setTries] = useState(0);
  const results = useRef<ItemResult[]>([]);
  const correct = useRef(0);
  const shownAt = useRef(performance.now());
  const done = useRef(false);
  const round = rounds[Math.min(idx, rounds.length - 1)];

  const viewOf = useMemo(() => {
    const cache = new Map<string, ChordView | undefined>();
    return (sym: string) => {
      if (!cache.has(sym)) {
        const ref = parseChordRef(sym);
        cache.set(sym, chordViews(parseChordSymbol(ref.symbol), ctx.instrument, prefs, { chart: ref.chart, fingers: ref.fingers })[0]);
      }
      return cache.get(sym);
    };
  }, [ctx.instrument, prefs.ukuleleTuning, prefs.bassStrings, prefs.malletVariant]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    shownAt.current = performance.now();
  }, [idx]);

  const hear = (sym: string) => {
    const v = viewOf(sym);
    if (v) void playView(v, ctx.instrument, prefs);
  };

  const pick = (sym: string) => {
    if (done.current || feedback?.ok) return;
    const ok = sym === round.target;
    setFeedback({ picked: sym, ok });
    if (ok) {
      if (ctx.settings.sfx) sfx.correct();
      hear(sym);
      const first = tries === 0;
      if (first) correct.current++;
      results.current.push({ key: `chord:${ctx.instrument}:${round.target}`, correct: first, ms: first ? performance.now() - shownAt.current : undefined });
      setTimeout(() => {
        if (idx + 1 >= rounds.length) {
          done.current = true;
          onDone({ total: rounds.length, correct: correct.current, items: results.current, notes: 0, responseMs: results.current.filter(r => r.ms).map(r => r.ms!) });
        } else {
          setIdx(idx + 1);
          setTries(0);
          setFeedback(null);
        }
      }, 1100);
    } else {
      if (ctx.settings.sfx) sfx.wrong();
      setTries(t => t + 1);
    }
  };

  const reveal = tries >= 2;
  const inst = instrumentDef(ctx.instrument).short.toLowerCase();
  const title = def.title ?? (def.reverse ? 'Find the shape' : 'Name that chord');
  const prompt = def.prompt ?? (def.reverse ? `Which ${isFretted(ctx.instrument) ? 'diagram' : 'picture'} is ${nameOf(round.target)} on the ${inst}?` : `Which chord is this? Tap the picture to hear it.`);
  const target = viewOf(round.target);

  return (
    <div className="activity chord-quiz" data-expected={nameOf(round.target)} data-reverse={def.reverse ? '1' : undefined}>
      <ActivityHeader title={title} prompt={prompt} badge={`${Math.min(idx + 1, rounds.length)} / ${rounds.length}`} progress={idx / rounds.length} />
      {def.reverse ? (
        <>
          <div className="cq-name display">{nameOf(round.target)}</div>
          <div className="cq-shapes" role="group" aria-label="Shapes">
            {round.options.map(sym => {
              const v = viewOf(sym);
              const state = feedback?.picked === sym ? (feedback.ok ? 'is-good' : 'is-bad') : reveal && sym === round.target ? 'is-reveal' : '';
              return (
                <button key={sym} className={`cq-shape ${state}`} onClick={() => pick(sym)} aria-label={`Shape ${round.options.indexOf(sym) + 1}`} data-chord={nameOf(sym)}>
                  {v && <ChordPicture view={v} instrument={ctx.instrument} prefs={prefs} mode="fingers" size="md" interactive={false} leftHanded={ctx.settings.leftHanded} />}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <motion.div className={`cq-stage ${feedback && !feedback.ok ? 'shake' : ''}`} key={feedback && !feedback.ok ? `bad${tries}` : `s${idx}`}>
            {target && <ChordPicture view={target} instrument={ctx.instrument} prefs={prefs} mode="fingers" size="lg" leftHanded={ctx.settings.leftHanded} />}
            <button className="btn btn-icon btn-ghost cq-listen" aria-label="Hear it" onClick={() => hear(round.target)}>
              <Volume2 size={18} />
            </button>
          </motion.div>
          <div className="answer-grid cq-answers" role="group" aria-label="Answers">
            {round.options.map(sym => {
              const state = feedback?.picked === sym ? (feedback.ok ? 'is-good' : 'is-bad') : reveal && sym === round.target ? 'is-reveal' : '';
              return (
                <button key={sym} className={`answer-btn ${state}`} onClick={() => pick(sym)}>
                  <span className="answer-label">{nameOf(sym)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
