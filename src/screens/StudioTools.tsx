import { Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../audio/context';
import { useInstrumentAudio } from '../audio/instrument';
import { micInput } from '../audio/input/mic';
import { synth } from '../audio/synth';
import { InstrumentSwitch, useMyInstruments } from '../components/InstrumentIcon';
import { Segmented } from '../components/ui';
import { getTrack, TRACKS } from '../curriculum';
import { generateScore, makeRng, scaleScore } from '../curriculum/generate';
import type { MelodyGen, TrackDef } from '../curriculum/types';
import { RH } from '../curriculum/builders';
import { type ActivityResult, type LessonCtx, prefsOf } from '../engine/context';
import { InstrumentPanel, pianoRangeFor } from '../engine/InstrumentPanel';
import { PlayAlong } from '../engine/PlayAlong';
import type { FretMark, KeyMark } from '../instruments';
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
import { type InstrumentId, type Tuning, familyOf, instrumentDef, tuningFor, voiceFor } from '../music/instruments';
import { type ScaleKind, keyAlterations, parseKey } from '../music/keys';
import { type Step, freqToMidi, midiOf, midiToFreq, pitchClass, spellMidi, stepLabel, pitchToString } from '../music/pitch';
import type { Clef } from '../music/score';
import { malletHand, malletLabel } from '../music/sticking';
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

const FRETTED: InstrumentId[] = ['guitar', 'ukulele', 'bass'];
/** Every instrument with strings to tune. */
const STRINGED: InstrumentId[] = ['guitar', 'ukulele', 'bass', 'violin', 'viola', 'cello', 'doublebass'];

/** A track to hang a tool's practice on (the first one for the instrument). */
function trackFor(instrument: InstrumentId, preferred?: string): TrackDef {
  return (preferred ? getTrack(preferred) : undefined) ?? TRACKS.find(t => t.instrument === instrument) ?? TRACKS[0];
}

/** Default choice for a picker: the first of my instruments that's allowed. */
function useDefaultInstrument(allowed?: InstrumentId[]): InstrumentId {
  const mine = useMyInstruments();
  return mine.find(i => !allowed || allowed.includes(i)) ?? (allowed ? allowed[0] : 'piano');
}

// ---------------------------------------------------------------------------
// Fretboard explorer
// ---------------------------------------------------------------------------

export function FretExplorer() {
  const profile = useProfile();
  const [instrument, setInstrument] = useState<InstrumentId>(useDefaultInstrument(FRETTED));
  const [mode, setMode] = useState<'notes' | 'find' | 'scale' | 'caged'>('find');
  const [root, setRoot] = useState(9);
  const [scale, setScale] = useState<'major' | 'minor' | 'pent-minor' | 'pent-major' | 'blues'>('pent-minor');
  const [shape, setShape] = useState<ShapeName>('E');
  const [quality, setQuality] = useState<'major' | 'minor'>('major');
  const prefs = profile ? prefsOf(profile.settings) : {};
  useInstrumentAudio(instrument, prefs);
  const tuning = tuningFor(instrument, prefs).open;
  const maxFret = Math.min(15, instrumentDef(instrument).fretted?.maxFret ?? 15);
  const caged = mode === 'caged' && instrument === 'guitar';
  const marks: FretMark[] = useMemo(() => {
    if (mode === 'notes') return [];
    if (mode === 'find') return allLocationsOfPitchClass(root, 0, maxFret, undefined, tuning).map(p => ({ ...p, color: 'gold', label: pcLabel(root), root: true }));
    if (caged) {
      const c = cagedChord(root, shape, quality, 0);
      return chordShapePositions(c).map(p => ({ ...p, color: pitchClass(midiAt(p.string, p.fret)) === root ? 'gold' : 'rh', root: pitchClass(midiAt(p.string, p.fret)) === root, label: pcLabel(pitchClass(midiAt(p.string, p.fret))) }));
    }
    const pcs = scale === 'major' ? MAJOR_SCALE : scale === 'minor' ? NATURAL_MINOR : scale === 'pent-minor' ? PENTATONIC_MINOR : scale === 'pent-major' ? PENTATONIC_MAJOR : [0, 3, 5, 6, 7, 10];
    const set = new Set(transposePcs(pcs, root));
    const out: FretMark[] = [];
    for (let s = 1; s <= tuning.length; s++)
      for (let f = 0; f <= maxFret; f++) {
        const pc = pitchClass(midiAt(s, f, tuning));
        if (set.has(pc)) out.push({ string: s, fret: f, color: pc === root ? 'gold' : 'lh', root: pc === root, label: pcLabel(pc) });
      }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, root, scale, shape, quality, caged, tuning.join(), maxFret]);
  if (!profile) return null;
  const ctx = { instrument, settings: profile.settings };
  const modes = [
    { value: 'find' as const, label: 'One note' },
    { value: 'notes' as const, label: 'All notes' },
    { value: 'scale' as const, label: 'Scales' },
    ...(instrument === 'guitar' ? [{ value: 'caged' as const, label: 'CAGED' }] : []),
  ];
  return (
    <ToolShell title="Fretboard Explorer" instrument={instrument} right={<InstrumentSwitch value={instrument} onChange={i => { setInstrument(i); if (i !== 'guitar' && mode === 'caged') setMode('find'); }} only={FRETTED} />}>
      <div className="activity explorer">
        <div className="explorer-controls">
          <Segmented size="sm" value={mode === 'caged' && instrument !== 'guitar' ? 'find' : mode} onChange={setMode} options={modes} />
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
          {caged && (
            <div className="row">
              <Segmented size="sm" value={shape} onChange={setShape} options={(['C', 'A', 'G', 'E', 'D'] as ShapeName[]).map(s => ({ value: s, label: `${s} shape` }))} />
              <Segmented size="sm" value={quality} onChange={setQuality} options={[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} />
            </div>
          )}
        </div>
        <p className="dim explorer-caption">
          {mode === 'find' && `Every ${pcLabel(root)} from the nut to the ${maxFret}th fret. Notice the octave shapes connecting them.`}
          {mode === 'notes' && 'Every note on the neck. Tap any fret to hear it.'}
          {mode === 'scale' && 'Roots are gold. Learn the scale one box at a time, then connect the boxes.'}
          {caged && 'The same chord, five shapes up the neck: C – A – G – E – D.'}
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

function tuningCaption(t: Tuning): string {
  return `${t.label}.`;
}

export function Tuner() {
  const profile = useProfile();
  const [instrument, setInstrument] = useState<InstrumentId>(useDefaultInstrument(STRINGED));
  const [reading, setReading] = useState<{ freq: number; midi: number; cents: number; clarity: number } | null>(null);
  const [active, setActive] = useState(micInput.active);
  const [err, setErr] = useState<string | null>(null);
  const smooth = useRef<number | null>(null);
  const prefs = profile ? prefsOf(profile.settings) : {};
  useInstrumentAudio(instrument, prefs);
  const tuning = tuningFor(instrument, prefs);
  // the tuner reads the mic directly (no note subscription): keep its analysis running
  useEffect(() => micInput.retain(), []);
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
  // strings from the lowest-numbered course on the left in pitch order, like a headstock read low → high
  const strings = tuning.open.map((m, i) => ({ m, n: i + 1 })).reverse();
  return (
    <ToolShell title="Tuner" right={<InstrumentSwitch value={instrument} onChange={setInstrument} only={STRINGED} />}>
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
          {strings.map(({ m, n }) => {
            const p = spellMidi(m);
            const near = nearest !== null && Math.abs(freqToMidi(midiToFreq(nearest)) - m) < 0.5;
            return (
              <button
                key={`${n}-${m}`}
                className={`tuner-string ${near ? 'on' : ''}`}
                onClick={async () => {
                  await unlockAudio();
                  synth.play(m, { voice: voiceFor(instrument, prefs), duration: 2.5 });
                }}
              >
                <span className="faint">{n}</span>
                <strong>{pitchToString(p)}</strong>
                <Volume2 size={14} />
              </button>
            );
          })}
        </div>
        <p className="faint tuner-note-small">Tap a string to hear its reference pitch. {tuningCaption(tuning)}</p>
      </div>
    </ToolShell>
  );
}

// ---------------------------------------------------------------------------
// Sight-reading gym
// ---------------------------------------------------------------------------

interface GymKind {
  id: string;
  instrument: InstrumentId;
  label: string;
  clef: Clef;
  /** both hands: melody + accompaniment on a grand staff */
  grand?: boolean;
  track: TrackId;
  /** `position`: the hand position to finger in (index-finger fret), when not the first */
  ranges: { label: string; pool: string; accomp?: string; position?: number }[];
}

const GYM_KINDS: GymKind[] = [
  {
    id: 'treble', instrument: 'piano', label: '𝄞 Right hand', clef: 'treble', track: 'piano-treble',
    ranges: [
      { label: 'C position', pool: 'C4 D4 E4 F4 G4' },
      { label: 'Middle C–C5', pool: 'C4 D4 E4 F4 G4 A4 B4 C5' },
      { label: 'Staff', pool: 'D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5' },
      { label: 'Ledger lines', pool: 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6' },
    ],
  },
  {
    id: 'bass', instrument: 'piano', label: '𝄢 Left hand', clef: 'bass', track: 'piano-bass',
    ranges: [
      { label: 'Middle C position', pool: 'F3 G3 A3 B3 C4' },
      { label: 'C3–C4', pool: 'C3 D3 E3 F3 G3 A3 B3 C4' },
      { label: 'Staff', pool: 'F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3' },
      { label: 'Ledger lines', pool: 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4' },
    ],
  },
  {
    id: 'grand', instrument: 'piano', label: 'Both hands', clef: 'treble', grand: true, track: 'piano-grand',
    ranges: [
      { label: 'Middle C positions', pool: 'C4 D4 E4 F4 G4', accomp: 'F3 G3 A3 B3 C4' },
      { label: 'One octave each', pool: 'C4 D4 E4 F4 G4 A4 B4 C5', accomp: 'C3 D3 E3 F3 G3 A3 B3 C4' },
      { label: 'Wide', pool: 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5', accomp: 'C3 D3 E3 F3 G3 A3 B3 C4' },
    ],
  },
  {
    id: 'guitar', instrument: 'guitar', label: '𝄞 Treble', clef: 'treble8vb', track: 'guitar-treble',
    ranges: [
      { label: 'Strings 1–3', pool: 'G3 A3 B3 C4 D4 E4 F4 G4' },
      { label: 'First position', pool: 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4' },
      { label: 'Up to 5th position', pool: 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5' },
    ],
  },
  {
    id: 'guitar-bass', instrument: 'guitar', label: '𝄢 Bass clef', clef: 'bass', track: 'guitar-bass',
    ranges: [
      { label: 'Low strings', pool: 'E2 F2 G2 A2 B2 C3 D3 E3 F3' },
      { label: 'E2–D4', pool: 'E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4' },
    ],
  },
  {
    id: 'ukulele', instrument: 'ukulele', label: '𝄞 Treble', clef: 'treble', track: 'ukulele-treble',
    ranges: [
      { label: 'C and E strings', pool: 'C4 D4 E4 F4 G4' },
      { label: 'First position', pool: 'C4 D4 E4 F4 G4 A4 B4 C5' },
      { label: 'Up the A string', pool: 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5' },
    ],
  },
  {
    id: 'bass-guitar', instrument: 'bass', label: '𝄢 Bass clef', clef: 'bass8vb', track: 'bass-lines',
    ranges: [
      { label: 'E and A strings', pool: 'E1 F1 G1 A1 B1 C2 D2' },
      { label: 'First position', pool: 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3' },
      { label: 'Up to 5th position', pool: 'A1 B1 C2 D2 E2 F2 G2 A2 B2 C3 D3 E3' },
    ],
  },
  {
    id: 'violin', instrument: 'violin', label: '𝄞 Treble', clef: 'treble', track: 'violin-treble',
    ranges: [
      { label: 'D and A strings', pool: 'D4 E4 F4 G4 A4 B4 C5 D5' },
      { label: 'First position', pool: 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5' },
      { label: 'Up to 3rd position', pool: 'G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6', position: 5 },
    ],
  },
  {
    id: 'viola', instrument: 'viola', label: 'Alto clef', clef: 'alto', track: 'viola-alto',
    ranges: [
      { label: 'G and D strings', pool: 'G3 A3 B3 C4 D4 E4 F4 G4' },
      { label: 'First position', pool: 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5' },
      { label: 'Up to 3rd position', pool: 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5', position: 5 },
    ],
  },
  {
    id: 'cello', instrument: 'cello', label: '𝄢 Bass clef', clef: 'bass', track: 'cello-bass',
    ranges: [
      { label: 'G and D strings', pool: 'G2 A2 B2 C3 D3 E3 F3 G3' },
      { label: 'First position', pool: 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4' },
      { label: 'Up to 4th position', pool: 'C2 D2 E2 F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4', position: 5 },
    ],
  },
  {
    id: 'doublebass', instrument: 'doublebass', label: '𝄢 Bass clef', clef: 'bass8vb', track: 'doublebass-lines',
    ranges: [
      { label: 'E and A strings', pool: 'E1 F1 G1 A1 B1 C2 D2' },
      { label: 'Half and first position', pool: 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2' },
      { label: 'Up to 4th position', pool: 'E1 F1 G1 A1 B1 C2 D2 E2 F2 G2 A2 B2 C3 D3', position: 5 },
    ],
  },
  {
    id: 'mallets', instrument: 'mallets', label: 'Two mallets', clef: 'treble', track: 'mallets-two',
    ranges: [
      { label: 'C4–G4', pool: 'C4 D4 E4 F4 G4' },
      { label: 'One octave', pool: 'C4 D4 E4 F4 G4 A4 B4 C5' },
      { label: 'Two octaves', pool: 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6' },
    ],
  },
  {
    id: 'mallets-grand', instrument: 'mallets', label: 'Four mallets', clef: 'treble', grand: true, track: 'mallets-four',
    ranges: [
      { label: 'Melody + roots', pool: 'C4 D4 E4 F4 G4 A4 B4 C5', accomp: 'C3 D3 E3 F3 G3 A3 B3 C4' },
      { label: 'Wide', pool: 'C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5', accomp: 'A2 B2 C3 D3 E3 F3 G3 A3 B3 C4' },
    ],
  },
];

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
  const startInstr = useDefaultInstrument();
  const [kindId, setKindId] = useState(() => GYM_KINDS.find(k => k.instrument === startInstr)?.id ?? 'treble');
  const [rangeIdx, setRangeIdx] = useState(1);
  const [rhythm, setRhythm] = useState(0);
  const [key, setKey] = useState('C');
  const [mode, setMode] = useState<'wait' | 'tempo'>('wait');
  const [tempo, setTempo] = useState(72);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState({ passages: 0, correct: 0, total: 0 });
  const started = useRef(Date.now());
  const kind = GYM_KINDS.find(k => k.id === kindId) ?? GYM_KINDS[0];
  const instrument = kind.instrument;
  const prefs = profile ? prefsOf(profile.settings) : {};
  useInstrumentAudio(instrument, prefs);
  const track = trackFor(instrument, kind.track);
  const trackId = track.id;
  const ranges = kind.ranges;
  const range = ranges[Math.min(rangeIdx, ranges.length - 1)];
  const score = useMemo(() => {
    if (!round) return null;
    const pool = poolInKey(range.pool, key);
    const gen: MelodyGen = {
      clef: kind.clef,
      key,
      time: [4, 4],
      measures: 4,
      pool,
      rhythms: RHYTHMS[rhythm].cells,
      maxLeap: rangeIdx >= 2 ? 4 : 2,
      leapiness: 0.3,
      harmonic: rhythm > 0,
      fivePosition: instrument === 'piano' && pool.length === 5,
      guitarPosition: range.position,
      accomp: kind.grand ? { pattern: rhythm === 0 ? 'drone' : rhythm === 1 ? 'roots' : rhythm === 2 ? 'broken' : 'alberti', pool: poolInKey(range.accomp ?? 'C3 D3 E3 F3 G3 A3 B3 C4', key), fivePosition: instrument === 'piano' && rangeIdx === 0 } : undefined,
      mallets: instrument === 'mallets' ? (kind.grand ? 4 : 2) : undefined,
    };
    const s = generateScore(gen, makeRng(Date.now()), instrument, '', prefs);
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
  const kindsHere = GYM_KINDS.filter(k => k.instrument === instrument);
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
              <span>Instrument</span>
              <InstrumentSwitch
                value={instrument}
                onChange={i => {
                  setKindId(GYM_KINDS.find(k => k.instrument === i)!.id);
                  setRangeIdx(1);
                }}
              />
            </div>
            {kindsHere.length > 1 && (
              <div className="set-row">
                <span>Clef</span>
                <Segmented size="sm" value={kind.id} onChange={v => { setKindId(v); setRangeIdx(1); }} options={kindsHere.map(k => ({ value: k.id, label: k.label }))} />
              </div>
            )}
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

/** Comfortable starting octave for a one-octave scale on each instrument. */
function scaleOctave(instrument: InstrumentId, tonic: string, hand: 'R' | 'L'): number {
  const high = ['A', 'B', 'Bb', 'Ab', 'G', 'G#', 'F#'].includes(tonic);
  switch (instrument) {
    case 'piano':
      return hand === 'R' ? 4 : 3;
    case 'guitar':
      return high ? 2 : 3;
    case 'bass':
      return high ? 1 : 2;
    default:
      return 4;
  }
}

export function Scales() {
  const profile = useProfile();
  const device = useDevice();
  const [instrument, setInstrument] = useState<InstrumentId>(useDefaultInstrument());
  const [tonic, setTonic] = useState('C');
  const [kind, setKind] = useState<ScaleKind>('major');
  const [hand, setHand] = useState<'R' | 'L'>('R');
  const [practise, setPractise] = useState(0);
  const prefs = profile ? prefsOf(profile.settings) : {};
  useInstrumentAudio(instrument, prefs);
  const family = familyOf(instrument);
  const tonicFor = (t: string) => (kind === 'major' ? t : ({ Db: 'C#', Ab: 'G#', Gb: 'F#' } as Record<string, string>)[t] ?? t);
  const t = tonicFor(tonic);
  const score = useMemo(() => {
    try {
      return scaleScore({ tonic: t, kind, octaves: 1, hands: family === 'keyboard' ? hand : 'R', instrument, octave: scaleOctave(instrument, t, hand), prefs });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, kind, hand, instrument, prefs.ukuleleTuning, prefs.bassStrings]);
  // the ascending half of the scale, with its fingering / strings / sticking
  const upNotes = useMemo(() => {
    if (!score) return [];
    const notes = score.staves[0].voices[0].notes.filter(n => !n.rest && !n.tiePrev);
    return notes.slice(0, 8);
  }, [score]);
  if (!profile) return null;
  const track = trackFor(instrument, instrument === 'piano' ? (hand === 'R' ? 'piano-treble' : 'piano-bass') : undefined);
  const ctx: LessonCtx = { track, instrument, settings: profile.settings, device, items: {}, rng: makeRng(), isCheckpoint: false, progress: 0.5 };
  const midis = upNotes.map(n => midiOf(n.pitches[0]));
  const marks: KeyMark[] = upNotes.map(n => {
    const f = n.fingers?.[0];
    if (family === 'mallet') return { midi: midiOf(n.pitches[0]), color: f && malletHand(f) === 'L' ? 'lh' : 'rh', label: f ? malletLabel(f, 2) : undefined };
    return { midi: midiOf(n.pitches[0]), color: hand === 'R' ? 'rh' : 'lh', finger: f };
  });
  const tuning = score?.tuning ?? tuningFor(instrument, prefs).open;
  const fretMarks: FretMark[] = upNotes
    .filter(n => n.strings?.[0])
    .map((n, i) => ({ string: n.strings![0]!, fret: midiOf(n.pitches[0]) - tuning[n.strings![0]! - 1], finger: n.fingers?.[0] || undefined, color: i === 0 || i === upNotes.length - 1 ? 'gold' : 'rh', root: i === 0 || i === upNotes.length - 1 }));
  const frets = fretMarks.map(m => m.fret);
  const fretRange: [number, number] = frets.length ? [Math.max(0, Math.min(...frets) - 1), Math.max(Math.min(...frets) + 5, Math.max(...frets) + 1)] : [0, 7];
  const tonicStep = t[0] as Step;
  const tonicAlter = t[1] === '#' ? 1 : t[1] === 'b' ? -1 : 0;
  const caption =
    family === 'keyboard'
      ? 'Standard fingering: the thumb tucks under (or the fingers cross over) at the marked places.'
      : family === 'mallet'
        ? 'Alternate your mallets, leading with the right. The left hand takes the lower note when the hands cross.'
        : `One octave in ${upNotes.some(n => (n.fingers?.[0] ?? 0) > 0) ? 'position' : 'open position'}: follow the fingers and string numbers.`;
  return (
    <ToolShell title="Scales & Fingering" instrument={instrument} right={<InstrumentSwitch value={instrument} onChange={i => { setInstrument(i); setPractise(0); }} />}>
      {practise > 0 && score ? (
        <>
          <PlayAlong key={practise} ctx={ctx} score={score} mode="wait" fingering="all" title={`${stepLabel(tonicStep, tonicAlter)} ${kind.replace('-', ' ')}`} onDone={() => setPractise(0)} />
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
              {family === 'keyboard' && <Segmented size="sm" value={hand} onChange={setHand} options={[{ value: 'R', label: 'Right hand' }, { value: 'L', label: 'Left hand' }]} />}
            </div>
          </div>
          {score ? (
            <div className="stage-paper paper">
              <NotationView score={score} fingering strings={family === 'fretted'} layout="center" beatWidth={40} />
            </div>
          ) : null}
          <p className="dim scales-caption">{caption}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={async () => { await unlockAudio(); synth.playSequence(midis.map((m, i) => ({ midi: [m], at: 0.1 + i * 0.32, duration: 0.3 })), voiceFor(instrument, prefs)); }}>
              <Volume2 size={16} /> Hear it
            </button>
            <button className="btn btn-primary" onClick={() => setPractise(x => x + 1)} disabled={!score}>
              <Play size={16} /> Practise it
            </button>
          </div>
          <InstrumentPanel ctx={ctx} range={pianoRangeFor(midis, 14)} marks={marks} fretMarks={fretMarks} fretRange={fretRange} />
        </div>
      )}
    </ToolShell>
  );
}
