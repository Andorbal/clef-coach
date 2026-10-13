import { Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../audio/context';
import { inputManager } from '../audio/input/manager';
import { micInput } from '../audio/input/mic';
import { synth } from '../audio/synth';
import { Segmented } from '../components/ui';
import { getTrack } from '../curriculum';
import { generateScore, makeRng, scaleScore } from '../curriculum/generate';
import type { MelodyGen } from '../curriculum/types';
import { RH } from '../curriculum/builders';
import type { ActivityResult, LessonCtx } from '../engine/context';
import { InstrumentPanel, pianoRangeFor } from '../engine/InstrumentPanel';
import { PlayAlong } from '../engine/PlayAlong';
import type { FretMark } from '../instruments';
import { scaleFingering } from '../music/fingering';
import {
  MAJOR_SCALE,
  NATURAL_MINOR,
  PENTATONIC_MAJOR,
  PENTATONIC_MINOR,
  allLocationsOfPitchClass,
  cagedChord,
  chordShapePositions,
  midiAt,
  type ShapeName,
  transposePcs,
} from '../music/guitar';
import { type ScaleKind, keyAlterations, parseKey, scalePitches } from '../music/keys';
import { STEPS, type Step, freqToMidi, midiOf, midiToFreq, pitchClass, spellMidi, stepLabel, pitchToString } from '../music/pitch';
import { NotationView } from '../notation/NotationView';
import { useApp, useDevice, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import { ToolShell } from './Studio';
import { applyInputMode } from '../components/InputControl';

const PCS = Array.from({ length: 12 }, (_, i) => i);
const pcLabel = (pc: number, flats = [1, 3, 6, 8, 10].includes(pc) && pc !== 6) => {
  const p = spellMidi(60 + pc, flats ? -1 : 1);
  return stepLabel(p.step, p.alter);
};

// ---------------------------------------------------------------------------
// Fretboard explorer
// ---------------------------------------------------------------------------

export function FretExplorer() {
  const profile = useProfile();
  const [mode, setMode] = useState<'notes' | 'find' | 'scale' | 'caged'>('find');
  const [root, setRoot] = useState(9);
  const [scale, setScale] = useState<'major' | 'minor' | 'pent-minor' | 'pent-major' | 'blues'>('pent-minor');
  const [shape, setShape] = useState<ShapeName>('E');
  const [quality, setQuality] = useState<'major' | 'minor'>('major');
  const maxFret = 15;
  const marks: FretMark[] = useMemo(() => {
    if (mode === 'notes') return [];
    if (mode === 'find') return allLocationsOfPitchClass(root, 0, maxFret).map(p => ({ ...p, color: 'gold', label: pcLabel(root), root: true }));
    if (mode === 'caged') {
      const c = cagedChord(root, shape, quality, 0);
      return chordShapePositions(c).map(p => ({ ...p, color: pitchClass(midiAt(p.string, p.fret)) === root ? 'gold' : 'rh', root: pitchClass(midiAt(p.string, p.fret)) === root, label: pcLabel(pitchClass(midiAt(p.string, p.fret))) }));
    }
    const pcs = scale === 'major' ? MAJOR_SCALE : scale === 'minor' ? NATURAL_MINOR : scale === 'pent-minor' ? PENTATONIC_MINOR : scale === 'pent-major' ? PENTATONIC_MAJOR : [0, 3, 5, 6, 7, 10];
    const set = new Set(transposePcs(pcs, root));
    const out: FretMark[] = [];
    for (let s = 1; s <= 6; s++)
      for (let f = 0; f <= maxFret; f++) {
        const pc = pitchClass(midiAt(s, f));
        if (set.has(pc)) out.push({ string: s, fret: f, color: pc === root ? 'gold' : 'lh', root: pc === root, label: pcLabel(pc) });
      }
    return out;
  }, [mode, root, scale, shape, quality]);
  if (!profile) return null;
  const ctx = { instrument: 'guitar' as const, settings: profile.settings };
  return (
    <ToolShell title="Fretboard Explorer" instrument="guitar">
      <div className="activity explorer">
        <div className="explorer-controls">
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'find', label: 'One note' }, { value: 'notes', label: 'All notes' }, { value: 'scale', label: 'Scales' }, { value: 'caged', label: 'CAGED' }]} />
          {mode !== 'notes' && (
            <div className="root-picker">
              {PCS.map(pc => (
                <button key={pc} className={`root-btn ${pc === root ? 'on' : ''}`} onClick={() => setRoot(pc)}>
                  {pcLabel(pc)}
                </button>
              ))}
            </div>
          )}
          {mode === 'scale' && (
            <Segmented size="sm" value={scale} onChange={setScale} options={[{ value: 'pent-minor', label: 'Minor pent.' }, { value: 'pent-major', label: 'Major pent.' }, { value: 'blues', label: 'Blues' }, { value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} />
          )}
          {mode === 'caged' && (
            <div className="row">
              <Segmented size="sm" value={shape} onChange={setShape} options={(['C', 'A', 'G', 'E', 'D'] as ShapeName[]).map(s => ({ value: s, label: `${s} shape` }))} />
              <Segmented size="sm" value={quality} onChange={setQuality} options={[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} />
            </div>
          )}
        </div>
        <p className="dim explorer-caption">
          {mode === 'find' && `Every ${pcLabel(root)} from the nut to the 15th fret. Notice the octave shapes connecting them.`}
          {mode === 'notes' && 'Every note on the neck. Tap any fret to hear it.'}
          {mode === 'scale' && 'Roots are gold. Learn the scale one box at a time, then connect the boxes.'}
          {mode === 'caged' && 'The same chord, five shapes up the neck: C – A – G – E – D.'}
        </p>
        <div className="explorer-board">
          <InstrumentPanel ctx={ctx} fretMarks={marks} fretRange={[0, maxFret]} fretNoteNames={mode === 'notes' ? 'all' : 'marks'} />
        </div>
      </div>
    </ToolShell>
  );
}

// ---------------------------------------------------------------------------
// Tuner
// ---------------------------------------------------------------------------

const GUITAR_STRINGS = [40, 45, 50, 55, 59, 64];

export function Tuner() {
  const [reading, setReading] = useState<{ freq: number; midi: number; cents: number; clarity: number } | null>(null);
  const [active, setActive] = useState(micInput.active);
  const [err, setErr] = useState<string | null>(null);
  const smooth = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const r = micInput.getTunerReading();
      if (r && r.clarity > 0.8) {
        smooth.current = smooth.current === null ? r.cents : smooth.current * 0.6 + r.cents * 0.4;
        setReading({ ...r, cents: smooth.current });
      } else {
        smooth.current = null;
        setReading(null);
      }
    }, 50);
    return () => clearInterval(t);
  }, [active]);
  const start = async () => {
    const r = await applyInputMode('mic');
    if (r.ok) setActive(true);
    else setErr(r.error ?? 'Microphone unavailable.');
  };
  const nearest = reading ? Math.round(reading.midi) : null;
  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const inTune = reading && Math.abs(reading.cents) < 5;
  const note = nearest !== null ? spellMidi(nearest, 1) : null;
  return (
    <ToolShell title="Tuner">
      <div className="activity tuner">
        <div className={`tuner-dial card ${inTune ? 'in-tune' : ''}`}>
          <svg viewBox="-160 -150 320 170" className="tuner-svg">
            {Array.from({ length: 21 }, (_, i) => {
              const c = -50 + i * 5;
              const a = (c / 50) * 60 * (Math.PI / 180);
              const r1 = 120;
              const r2 = i % 5 === 0 ? 100 : 110;
              return <line key={i} x1={Math.sin(a) * r1} y1={-Math.cos(a) * r1} x2={Math.sin(a) * r2} y2={-Math.cos(a) * r2} className={`tick ${c === 0 ? 'zero' : ''}`} />;
            })}
            <g style={{ transform: `rotate(${(cents / 50) * 60}deg)`, transition: 'transform 0.12s linear' }}>
              <line x1={0} y1={8} x2={0} y2={-118} className="needle" />
            </g>
            <circle r={8} className="hub" />
          </svg>
          <div className="tuner-note display">
            {note ? (
              <>
                {stepLabel(note.step, note.alter)}
                <sub>{note.octave}</sub>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="tuner-cents tabular">{reading ? `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(0)} cents · ${reading.freq.toFixed(1)} Hz` : active ? 'Play a single string…' : 'Microphone is off'}</div>
          {!active && (
            <button className="btn btn-primary btn-lg" onClick={start}>
              Start tuner
            </button>
          )}
          {err && <p className="input-error">{err}</p>}
        </div>
        <div className="tuner-strings">
          {GUITAR_STRINGS.map((m, i) => {
            const p = spellMidi(m);
            const near = nearest !== null && Math.abs(freqToMidi(midiToFreq(nearest)) - m) < 0.5;
            return (
              <button
                key={m}
                className={`tuner-string ${near ? 'on' : ''}`}
                onClick={async () => {
                  await unlockAudio();
                  synth.play(m, { voice: 'guitar', duration: 2.5 });
                }}
              >
                <span className="faint">{6 - i}</span>
                <strong>{pitchToString(p)}</strong>
                <Volume2 size={14} />
              </button>
            );
          })}
        </div>
        <p className="faint tuner-note-small">Tap a string to hear its reference pitch. Standard tuning: E A D G B E.</p>
      </div>
    </ToolShell>
  );
}

// ---------------------------------------------------------------------------
// Sight-reading gym
// ---------------------------------------------------------------------------

type GymClef = 'treble' | 'bass' | 'grand' | 'guitar' | 'guitar-bass';

const RANGES: Record<GymClef, { label: string; pool: string }[]> = {
  treble: [
    { label: 'C position', pool: 'C4 D4 E4 F4 G4' },
    { label: 'Middle C–C5', pool: 'C4 D4 E4 F4 G4 A4 B4 C5' },
    { label: 'Staff', pool: 'D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5' },
    { label: 'Ledger lines', pool: 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6' },
  ],
  bass: [
    { label: 'Middle C position', pool: 'F3 G3 A3 B3 C4' },
    { label: 'C3–C4', pool: 'C3 D3 E3 F3 G3 A3 B3 C4' },
    { label: 'Staff', pool: 'F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3' },
    { label: 'Ledger lines', pool: 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4' },
  ],
  grand: [
    { label: 'Middle C positions', pool: 'C4 D4 E4 F4 G4' },
    { label: 'One octave each', pool: 'C4 D4 E4 F4 G4 A4 B4 C5' },
    { label: 'Wide', pool: 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5' },
  ],
  guitar: [
    { label: 'Strings 1–3', pool: 'G3 A3 B3 C4 D4 E4 F4 G4' },
    { label: 'First position', pool: 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4' },
    { label: 'Up to 5th position', pool: 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5' },
  ],
  'guitar-bass': [
    { label: 'Low strings', pool: 'E2 F2 G2 A2 B2 C3 D3 E3 F3' },
    { label: 'E2–D4', pool: 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4' },
  ],
};

const RHYTHMS: { label: string; cells: MelodyGen['rhythms'] }[] = [
  { label: 'Simple', cells: RH.qhw },
  { label: 'Eighths', cells: RH.eighthsRests },
  { label: 'Dotted', cells: RH.dottedRests },
  { label: 'Advanced', cells: RH.advanced },
];

const GYM_KEYS = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'Am', 'Em', 'Dm'];

function poolInKey(pool: string, key: string): string[] {
  const alt = keyAlterations(parseKey(key).fifths);
  return pool.split(' ').map(s => {
    const step = s[0] as Step;
    const oct = s.slice(-1);
    const a = alt[step];
    return `${step}${a === 1 ? '#' : a === -1 ? 'b' : ''}${oct}`;
  });
}

export function Gym() {
  const profile = useProfile();
  const device = useDevice();
  const record = useApp(s => s.recordOutcome);
  const [clef, setClef] = useState<GymClef>(profile?.trackOrder.some(t => t.startsWith('piano')) || !profile?.trackOrder.length ? 'treble' : 'guitar');
  const [rangeIdx, setRangeIdx] = useState(1);
  const [rhythm, setRhythm] = useState(0);
  const [key, setKey] = useState('C');
  const [mode, setMode] = useState<'wait' | 'tempo'>('wait');
  const [tempo, setTempo] = useState(72);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState({ passages: 0, correct: 0, total: 0 });
  const started = useRef(Date.now());
  const instrument = clef === 'guitar' || clef === 'guitar-bass' ? 'guitar' : 'piano';
  const trackId: TrackId = clef === 'treble' ? 'piano-treble' : clef === 'bass' ? 'piano-bass' : clef === 'grand' ? 'piano-grand' : clef === 'guitar' ? 'guitar-treble' : 'guitar-bass';
  const track = getTrack(trackId)!;
  const ranges = RANGES[clef];
  const range = ranges[Math.min(rangeIdx, ranges.length - 1)];
  const score = useMemo(() => {
    if (!round) return null;
    const pool = poolInKey(range.pool, key);
    const gen: MelodyGen = {
      clef: clef === 'bass' || clef === 'guitar-bass' ? 'bass' : clef === 'guitar' ? 'treble8vb' : 'treble',
      key,
      time: [4, 4],
      measures: 4,
      pool,
      rhythms: RHYTHMS[rhythm].cells,
      maxLeap: rangeIdx >= 2 ? 4 : 2,
      leapiness: 0.3,
      harmonic: rhythm > 0,
      fivePosition: pool.length === 5,
      guitarPosition: 1,
      accomp: clef === 'grand' ? { pattern: rhythm === 0 ? 'drone' : rhythm === 1 ? 'roots' : rhythm === 2 ? 'broken' : 'alberti', pool: poolInKey(rangeIdx === 0 ? 'F3 G3 A3 B3 C4' : 'C3 D3 E3 F3 G3 A3 B3 C4', key), fivePosition: rangeIdx === 0 } : undefined,
    };
    const s = generateScore(gen, makeRng(Date.now()), instrument);
    s.tempo = tempo;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  if (!profile) return null;
  const ctx: LessonCtx = { track, instrument, settings: profile.settings, device, items: profile.tracks[trackId]?.items ?? {}, rng: makeRng(), isCheckpoint: false, progress: 0.6 };
  const onDone = (r: ActivityResult) => {
    const acc = r.total ? r.correct / r.total : 1;
    record({ trackId, lessonId: 'gym', lessonKind: 'challenge', accuracy: acc, stars: 0, passed: true, ms: Date.now() - started.current, notes: r.notes, xp: Math.round(4 + acc * 6), items: r.items, practiceOnly: true });
    setStats(s => ({ passages: s.passages + 1, correct: s.correct + r.correct, total: s.total + r.total }));
    started.current = Date.now();
    setTimeout(() => setRound(x => x + 1), 400);
  };
  return (
    <ToolShell
      title="Sight-reading Gym"
      instrument={instrument}
      right={
        round > 0 ? (
          <span className="pill tabular">
            {stats.passages} done · {stats.total ? Math.round((stats.correct / stats.total) * 100) : 100}%
          </span>
        ) : undefined
      }
    >
      {round === 0 || !score ? (
        <div className="gym-setup">
          <div className="song-setup-card card">
            <h1 className="display">Sight-reading Gym</h1>
            <p className="dim">Fresh, never-repeating music at the level you choose. Read ahead, keep going, don’t stop for mistakes.</p>
            <div className="set-row">
              <span>Clef</span>
              <Segmented size="sm" value={clef} onChange={v => { setClef(v); setRangeIdx(1); }} options={[{ value: 'treble', label: '𝄞 Piano' }, { value: 'bass', label: '𝄢 Piano' }, { value: 'grand', label: 'Both hands' }, { value: 'guitar', label: 'Guitar' }, { value: 'guitar-bass', label: '𝄢 Guitar' }]} />
            </div>
            <div className="set-row">
              <span>Range</span>
              <Segmented size="sm" value={String(Math.min(rangeIdx, ranges.length - 1))} onChange={v => setRangeIdx(Number(v))} options={ranges.map((r, i) => ({ value: String(i), label: r.label }))} />
            </div>
            <div className="set-row">
              <span>Rhythm</span>
              <Segmented size="sm" value={String(rhythm)} onChange={v => setRhythm(Number(v))} options={RHYTHMS.map((r, i) => ({ value: String(i), label: r.label }))} />
            </div>
            <div className="set-row">
              <span>Key</span>
              <select className="set-select" value={key} onChange={e => setKey(e.target.value)}>
                {GYM_KEYS.map(k => (
                  <option key={k} value={k}>
                    {k.replace('b', '♭').replace(/m$/, ' minor')}
                    {!k.endsWith('m') ? ' major' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="set-row">
              <span>Mode</span>
              <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'wait', label: 'Wait for me' }, { value: 'tempo', label: 'In time' }]} />
            </div>
            {mode === 'tempo' && (
              <label className="slider-row">
                <span>
                  Tempo <strong className="tabular">{tempo} bpm</strong>
                </span>
                <input type="range" min={40} max={160} step={2} value={tempo} onChange={e => setTempo(Number(e.target.value))} />
              </label>
            )}
            <button className="btn btn-primary btn-lg" onClick={() => setRound(1)}>
              <Play size={18} /> Start
            </button>
          </div>
        </div>
      ) : (
        <>
          <PlayAlong key={round} ctx={ctx} score={score} mode={mode} tempo={tempo} fingering="none" title={`Passage ${round}`} onDone={onDone} />
          <button className="btn btn-sm gym-stop" onClick={() => setRound(0)}>
            <Square size={14} /> Stop
          </button>
        </>
      )}
    </ToolShell>
  );
}

// ---------------------------------------------------------------------------
// Scales & fingering reference
// ---------------------------------------------------------------------------

const SCALE_TONICS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

export function Scales() {
  const profile = useProfile();
  const device = useDevice();
  const [tonic, setTonic] = useState('C');
  const [kind, setKind] = useState<ScaleKind>('major');
  const [hand, setHand] = useState<'R' | 'L'>('R');
  const [practise, setPractise] = useState(0);
  const tonicFor = (t: string) => (kind === 'major' ? t : ({ Db: 'C#', Ab: 'G#', Gb: 'F#' } as Record<string, string>)[t] ?? t);
  const t = tonicFor(tonic);
  const fingers = scaleFingering(t, kind, hand, 1);
  const score = useMemo(() => {
    try {
      return scaleScore({ tonic: t, kind, octaves: 1, hands: hand, instrument: 'piano' });
    } catch {
      return null;
    }
  }, [t, kind, hand]);
  const pitches = useMemo(() => {
    const m = /^([A-G])(#|b)?$/.exec(t)!;
    return scalePitches({ step: m[1] as Step, alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0 }, hand === 'R' ? 4 : 3, kind, 1);
  }, [t, kind, hand]);
  if (!profile) return null;
  const ctx: LessonCtx = { track: getTrack(hand === 'R' ? 'piano-treble' : 'piano-bass')!, instrument: 'piano', settings: profile.settings, device, items: {}, rng: makeRng(), isCheckpoint: false, progress: 0.5 };
  const marks = pitches.map((p, i) => ({ midi: midiOf(p), color: (hand === 'R' ? 'rh' : 'lh') as 'rh' | 'lh', finger: fingers?.[i] }));
  return (
    <ToolShell title="Scales & Fingering" instrument="piano">
      {practise > 0 && score ? (
        <>
          <PlayAlong key={practise} ctx={ctx} score={score} mode="wait" fingering="all" title={`${stepLabel(t[0] as Step, t[1] === '#' ? 1 : t[1] === 'b' ? -1 : 0)} ${kind.replace('-', ' ')}`} onDone={() => setPractise(0)} />
        </>
      ) : (
        <div className="activity scales">
          <div className="explorer-controls">
            <div className="root-picker">
              {SCALE_TONICS.map(x => (
                <button key={x} className={`root-btn ${x === tonic ? 'on' : ''}`} onClick={() => setTonic(x)}>
                  {x.replace('#', '♯').replace(/b$/, '♭')}
                </button>
              ))}
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'major', label: 'Major' }, { value: 'natural-minor', label: 'Natural minor' }, { value: 'harmonic-minor', label: 'Harmonic minor' }, { value: 'melodic-minor', label: 'Melodic minor' }]} />
              <Segmented size="sm" value={hand} onChange={setHand} options={[{ value: 'R', label: 'Right hand' }, { value: 'L', label: 'Left hand' }]} />
            </div>
          </div>
          {score ? (
            <div className="stage-paper paper">
              <NotationView score={score} fingering layout="center" beatWidth={40} />
            </div>
          ) : null}
          {!fingers && <p className="dim">No standard fingering for this one yet — the app will suggest one as you play.</p>}
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={async () => { await unlockAudio(); synth.playSequence(pitches.map((p, i) => ({ midi: [midiOf(p)], at: 0.1 + i * 0.32, duration: 0.3 })), 'piano'); }}>
              <Volume2 size={16} /> Hear it
            </button>
            <button className="btn btn-primary" onClick={() => setPractise(x => x + 1)} disabled={!score}>
              <Play size={16} /> Practise it
            </button>
          </div>
          <InstrumentPanel ctx={ctx} range={pianoRangeFor(pitches.map(midiOf), 14)} marks={marks} />
        </div>
      )}
    </ToolShell>
  );
}

// silence unused helper warnings in some builds
void inputManager;
void STEPS;
void pitchToString;
