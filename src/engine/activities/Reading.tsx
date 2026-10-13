import { useMemo, useRef, useState } from 'react';
import { generateScore, scaleScore } from '../../curriculum/generate';
import type { ActivityDef } from '../../curriculum/types';
import { getSong } from '../../content/songs';
import { autoFinger } from '../../music/autofinger';
import { keyDisplayName } from '../../music/keys';
import { songToScore } from '../../music/parse';
import { type ActivityProps, type ActivityResult, prefsOf } from '../context';
import { PlayAlong } from '../PlayAlong';

type ReadDef = Extract<ActivityDef, { type: 'read' }>;
type PieceDef = Extract<ActivityDef, { type: 'piece' }>;
type ScaleDef = Extract<ActivityDef, { type: 'scale' }>;

function mergeResults(a: ActivityResult | null, b: ActivityResult): ActivityResult {
  if (!a) return b;
  return {
    total: a.total + b.total,
    correct: a.correct + b.correct,
    items: [...a.items, ...b.items],
    notes: a.notes + b.notes,
    responseMs: [...a.responseMs, ...b.responseMs],
  };
}

/** Generated sight-reading — a fresh passage every time. */
export function ReadActivity({ def, ctx, onDone }: ActivityProps<ReadDef>) {
  const reps = def.reps ?? 1;
  const [rep, setRep] = useState(0);
  const acc = useRef<ActivityResult | null>(null);
  const score = useMemo(() => {
    const s = generateScore(def.gen, ctx.rng, ctx.instrument, '', prefsOf(ctx.settings));
    s.tempo = def.tempo ?? 80;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, rep]);
  const twoHands = score.staves.length > 1;
  const title = def.title ?? (twoHands ? 'Hands together' : def.mode === 'tempo' ? 'Play in time' : 'Sight-read');
  return (
    <PlayAlong
      key={rep}
      ctx={ctx}
      score={score}
      mode={def.mode}
      tempo={def.tempo ?? (def.mode === 'tempo' ? 72 : 80)}
      fingering={def.fingering}
      noteNames={def.noteNames}
      title={title}
      prompt={def.prompt}
      badge={reps > 1 ? `${rep + 1} / ${reps}` : def.gen.key !== 'C' ? keyDisplayName({ fifths: score.key.fifths, mode: score.key.mode }) : undefined}
      onDone={r => {
        acc.current = mergeResults(acc.current, r);
        if (rep + 1 < reps) setRep(rep + 1);
        else onDone(acc.current);
      }}
    />
  );
}

export function PieceActivity({ def, ctx, onDone }: ActivityProps<PieceDef>) {
  const song = def.song ? getSong(def.song) : undefined;
  const score = useMemo(() => {
    if (song) return autoFinger(songToScore(song), prefsOf(ctx.settings));
    if (def.inline) {
      return autoFinger(
        songToScore({
          id: `inline-${(def.inline.title ?? 'piece').replace(/\W+/g, '-')}`,
          title: def.inline.title ?? '',
          composer: '',
          instrument: ctx.instrument,
          level: 1,
          key: def.inline.key,
          time: def.inline.time,
          tempo: def.tempo ?? 80,
          pickup: def.inline.pickup,
          staves: def.inline.staves,
        }),
        prefsOf(ctx.settings),
      );
    }
    return null;
  }, [song, def, ctx.instrument]);
  if (!score) {
    return (
      <div className="activity">
        <p className="dim">This piece isn't available.</p>
        <button className="btn" onClick={() => onDone({ total: 0, correct: 0, items: [], notes: 0, responseMs: [], ungraded: true })}>
          Skip
        </button>
      </div>
    );
  }
  const title = def.title ?? song?.title ?? score.title;
  const subtitle = song ? `${song.composer}${song.year && song.year !== 'Traditional' ? ` · ${song.year}` : ''}` : undefined;
  return (
    <PlayAlong
      ctx={ctx}
      score={score}
      mode={def.mode}
      tempo={def.tempo ?? (def.mode === 'tempo' ? score.tempo : Math.min(score.tempo, 90))}
      fingering={def.fingering}
      noteNames={def.noteNames}
      hands={def.hands}
      title={title}
      prompt={def.prompt ?? (subtitle ? `${subtitle}${song?.blurb ? ` — ${song.blurb}` : ''}` : undefined)}
      onDone={onDone}
    />
  );
}

export function ScaleActivity({ def, ctx, onDone }: ActivityProps<ScaleDef>) {
  const score = useMemo(
    () =>
      scaleScore({
        tonic: def.tonic,
        kind: def.kind,
        octaves: def.octaves,
        hands: def.hands,
        octave: def.octave,
        motion: def.motion,
        rhythm: def.rhythm,
        instrument: ctx.instrument,
        clef: def.clef,
        guitarPosition: def.guitarPosition,
        prefs: prefsOf(ctx.settings),
        mallets: def.mallets,
      }),
    [def, ctx.instrument],
  );
  const kindName = def.kind === 'major' ? 'major' : def.kind === 'natural-minor' ? 'natural minor' : def.kind === 'harmonic-minor' ? 'harmonic minor' : 'melodic minor';
  const tonic = def.tonic.replace('#', '♯').replace(/b$/, '♭');
  const handsLabel = def.hands === 'both' ? (def.motion === 'contrary' ? 'hands together, contrary motion' : 'hands together') : def.hands === 'R' ? 'right hand' : 'left hand';
  return (
    <PlayAlong
      ctx={ctx}
      score={score}
      mode={def.mode}
      tempo={def.tempo ?? 72}
      fingering={def.fingering}
      title={def.title ?? `${tonic} ${kindName} scale`}
      prompt={def.prompt ?? (ctx.instrument === 'piano' ? `${def.octaves > 1 ? `${def.octaves} octaves, ` : ''}${handsLabel}. Follow the fingering — it makes the crossings smooth.` : ctx.instrument === 'mallets' ? 'Follow the sticking: alternate hands and keep your mallets from crossing.' : 'Follow the fingers and string numbers.')}
      onDone={onDone}
    />
  );
}
