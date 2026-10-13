import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Fretboard, PianoKeyboard } from '../instruments';
import type { FretMark, KeyMark, KeyLabelMode, MarkColor } from '../instruments';
import {
  allLocationsOfPitchClass,
  cagedChord,
  chordShapePositions,
  MAJOR_SCALE,
  midiAt,
  PENTATONIC_MINOR,
  scaleBox,
  transposePcs,
} from '../music/guitar';
import { pitchClass, pitchLabel, spellMidi } from '../music/pitch';
import type { NoteNaming } from '../music/pitch';

const PREVIEW_CSS = `
.ip-head { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:22px; }
.ip-head h1 { font-size: clamp(30px, 5vw, 44px); line-height:1.05; }
.ip-stack { display:flex; flex-direction:column; gap:18px; }
.ip-card { padding: 18px 18px 20px; }
.ip-card-h { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:6px 14px; margin-bottom:14px; }
.ip-card-h h2 { font-size:17px; }
.ip-card-h p { font-size:13px; color:var(--text-dim); max-width:60ch; }
.ip-seg { display:inline-flex; padding:3px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border); gap:2px; }
.ip-seg button { min-height:30px; padding:0 12px; border-radius:999px; font-size:12.5px; font-weight:600; color:var(--text-dim); transition: background .2s, color .2s; }
.ip-seg button[aria-pressed="true"] { background: linear-gradient(180deg,#ffe0a3,var(--gold) 45%,var(--gold-2)); color:#241605; }
.ip-sub { margin-top:16px; }
.ip-log { display:flex; flex-wrap:wrap; gap:6px; min-height:28px; margin-top:14px; align-items:center; }
.ip-log .pill { font-variant-numeric: tabular-nums; }
.ip-legend { display:flex; flex-wrap:wrap; gap:8px 14px; font-size:12px; color:var(--text-dim); margin-top:12px; }
.ip-legend i { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; vertical-align:-1px; }
.ip-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
@media (max-width: 600px) { .ip-card { padding: 14px 12px 16px; } }
`;

function Card({ title, note, right, children }: { title: string; note?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card ip-card">
      <div className="ip-card-h">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="ip-seg" role="group">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

// ---- piano fixtures ---------------------------------------------------------
const TWO_OCTAVE_MARKS: KeyMark[] = [
  { midi: 48, color: 'lh', finger: 5 },
  { midi: 50, color: 'lh', finger: 4 },
  { midi: 52, color: 'lh', finger: 3 },
  { midi: 53, color: 'lh', finger: 2 },
  { midi: 55, color: 'lh', finger: 1 },
  { midi: 60, color: 'rh', finger: 1 },
  { midi: 62, color: 'rh', finger: 2 },
  { midi: 65, color: 'rh', finger: 4 },
  { midi: 67, color: 'rh', finger: 5 },
  { midi: 70, color: 'gold', pulse: true, label: '?' },
  { midi: 54, color: 'hint', finger: 2 },
];
const TWO_OCTAVE_PRESSED = new Set([64, 52, 61]);
const twoOctaveColor = (m: number): MarkColor => (m === 61 ? 'bad' : 'good');

const FIVE_FINGER_MARKS: KeyMark[] = [60, 62, 64, 65, 67].map((midi, i) => ({ midi, color: 'rh', finger: i + 1 }));

// ---- fretboard fixtures ---------------------------------------------------------
const ALL_AS: FretMark[] = allLocationsOfPitchClass(9, 0, 12).map(p => ({ ...p, color: 'gold' }));

const C_CHORD = cagedChord(0, 'C');
const C_FINGERS: Record<string, number> = { '5:3': 3, '4:2': 2, '2:1': 1 };
const C_CHORD_MARKS: FretMark[] = chordShapePositions(C_CHORD).map(p => ({
  ...p,
  color: 'rh',
  finger: C_FINGERS[`${p.string}:${p.fret}`],
  root: pitchClass(midiAt(p.string, p.fret)) === 0,
}));
const C_CHORD_PRESSED = [
  { string: 2, fret: 1, color: 'good' as MarkColor },
  { string: 4, fret: 2, color: 'good' as MarkColor },
  { string: 3, fret: 1, color: 'bad' as MarkColor },
];

const AM_PENTA = transposePcs(PENTATONIC_MINOR, 9);
const BOX1 = scaleBox(AM_PENTA, 0, 2);
const BOX1_KEYS = new Set(BOX1.map(p => `${p.string}:${p.fret}`));
const PENTA_MARKS: FretMark[] = [];
for (let s = 1; s <= 6; s++) {
  for (let f = 0; f <= 12; f++) {
    const pc = pitchClass(midiAt(s, f));
    if (!AM_PENTA.includes(pc)) continue;
    const inBox = BOX1_KEYS.has(`${s}:${f}`);
    PENTA_MARKS.push({
      string: s,
      fret: f,
      color: 'lh',
      root: pc === 9,
      ghost: !inBox,
      finger: inBox ? f - 4 : undefined,
    });
  }
}

const C_MAJOR_PCS = new Set(MAJOR_SCALE);
const POSITION5_MARKS: FretMark[] = [];
for (let s = 1; s <= 6; s++) {
  for (let f = 5; f <= 8; f++) {
    const pc = pitchClass(midiAt(s, f));
    if (!C_MAJOR_PCS.has(pc)) continue;
    POSITION5_MARKS.push({ string: s, fret: f, color: pc === 0 ? 'gold' : 'rh', finger: f - 4, root: pc === 0 });
  }
}

const LEFTY_MARKS: FretMark[] = BOX1.map(p => ({
  ...p,
  color: 'lh',
  finger: p.fret - 4,
  root: pitchClass(midiAt(p.string, p.fret)) === 9,
}));

// ---------------------------------------------------------------------------

export default function InstrumentsPreview() {
  const [naming, setNaming] = useState<NoteNaming>('letter');
  const [focus, setFocus] = useState(60);
  const [labelsMode, setLabelsMode] = useState<KeyLabelMode>('white');
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set());
  const [log, setLog] = useState<{ id: number; text: string; good: boolean }[]>([]);
  const [fretLog, setFretLog] = useState<{ id: number; text: string }[]>([]);
  const [preferFlats, setPreferFlats] = useState(false);
  const [lefty, setLefty] = useState(true);

  const onKeyDown = useCallback(
    (midi: number, velocity: number) => {
      setHeld(prev => new Set(prev).add(midi));
      const name = pitchLabel(spellMidi(midi), naming, true);
      setLog(prev => [{ id: performance.now(), text: `${name} · v${velocity.toFixed(2)}`, good: C_MAJOR.has(pitchClass(midi)) }, ...prev].slice(0, 8));
    },
    [naming],
  );
  const onKeyUp = useCallback((midi: number) => {
    setHeld(prev => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, []);
  const interactiveColor = useCallback((m: number): MarkColor => (C_MAJOR.has(pitchClass(m)) ? 'good' : 'bad'), []);

  const onFretTap = useCallback(
    (pos: { string: number; fret: number }, midi: number) => {
      const p = spellMidi(midi, preferFlats ? -1 : 1);
      setFretLog(prev => [{ id: performance.now(), text: `S${pos.string} F${pos.fret} → ${pitchLabel(p, naming, true)}` }, ...prev].slice(0, 6));
    },
    [naming, preferFlats],
  );

  const legend = useMemo(
    () => (
      <div className="ip-legend">
        <span><i style={{ background: 'var(--rh)' }} />Right hand</span>
        <span><i style={{ background: 'var(--lh)' }} />Left hand</span>
        <span><i style={{ background: 'var(--gold)' }} />Target (pulsing)</span>
        <span><i style={{ background: 'var(--good)' }} />Pressed · correct</span>
        <span><i style={{ background: 'var(--bad)' }} />Pressed · wrong</span>
        <span><i style={{ background: 'var(--violet)' }} />Hint</span>
      </div>
    ),
    [],
  );

  return (
    <div className="page">
      <style>{PREVIEW_CSS}</style>
      <header className="ip-head">
        <div>
          <div className="eyebrow">Dev preview</div>
          <h1 className="display">
            Instruments <span className="gold-text">studio</span>
          </h1>
        </div>
        <Seg<NoteNaming>
          value={naming}
          onChange={setNaming}
          options={[
            ['letter', 'C D E'],
            ['solfege', 'Do Re Mi'],
            ['german', 'German'],
          ]}
        />
      </header>

      <div className="ip-stack">
        <Card
          title="Full 88-key piano"
          note="A0–C8 with real key proportions. Middle C is marked; drag the wooden key slip to pan when it overflows."
          right={
            <div className="ip-row">
              {[
                [21, 'A0'],
                [60, 'C4'],
                [108, 'C8'],
              ].map(([m, l]) => (
                <button key={l} type="button" className="btn btn-sm" onClick={() => setFocus(m as number)}>
                  Focus {l}
                </button>
              ))}
            </div>
          }
        >
          <PianoKeyboard low={21} high={108} showLabels="c-only" naming={naming} markMiddleC minWhiteKeyWidth={16} focus={focus} />
        </Card>

        <Card title="Two octaves · C3–C5" note="Finger numbers for both hands, a pulsing target, and pressed keys with good / bad feedback.">
          <PianoKeyboard
            low={48}
            high={72}
            marks={TWO_OCTAVE_MARKS}
            pressed={TWO_OCTAVE_PRESSED}
            pressedColor={twoOctaveColor}
            showLabels="c-only"
            naming={naming}
            markMiddleC
          />
          {legend}
          <div className="ip-sub">
            <PianoKeyboard
              low={48}
              high={72}
              marks={FIVE_FINGER_MARKS}
              showLabels="white"
              naming={naming}
              dimOutside={[60, 67]}
              interactive={false}
            />
          </div>
        </Card>

        <Card
          title="Interactive"
          note="Multi-touch and glissando. Velocity comes from how far down the key you strike. Green = in C major."
          right={
            <Seg<KeyLabelMode>
              value={labelsMode}
              onChange={setLabelsMode}
              options={[
                ['none', 'None'],
                ['c-only', 'C only'],
                ['white', 'White'],
                ['all', 'All'],
              ]}
            />
          }
        >
          <PianoKeyboard
            low={48}
            high={84}
            pressed={held}
            pressedColor={interactiveColor}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            showLabels={labelsMode}
            naming={naming}
          />
          <div className="ip-log" aria-live="polite">
            {log.length === 0 && <span className="faint" style={{ fontSize: 13 }}>Play something…</span>}
            {log.map(e => (
              <span key={e.id} className="pill" style={{ color: e.good ? 'var(--good)' : 'var(--bad)' }}>
                {e.text}
              </span>
            ))}
          </div>
        </Card>

        <Card title="All the A's · frets 0–12" note="Every A on the neck, with note names inside the marks.">
          <Fretboard marks={ALL_AS} showNoteNames="marks" naming={naming} />
        </Card>

        <Card title="C major · CAGED “C” shape" note="Finger numbers, root notes as rounded squares, open strings as rings. Pressed: two correct, one wrong.">
          <Fretboard marks={C_CHORD_MARKS} pressed={C_CHORD_PRESSED} naming={naming} />
        </Card>

        <Card title="A minor pentatonic · box 1" note="The box with fingers and roots; the rest of the scale as ghost marks for context.">
          <Fretboard marks={PENTA_MARKS} naming={naming} />
        </Card>

        <Card
          title="Explorer"
          note="Every note name on the neck. Tap anywhere (multi-touch works)."
          right={
            <Seg<'sharps' | 'flats'>
              value={preferFlats ? 'flats' : 'sharps'}
              onChange={v => setPreferFlats(v === 'flats')}
              options={[
                ['sharps', '♯'],
                ['flats', '♭'],
              ]}
            />
          }
        >
          <Fretboard showNoteNames="all" naming={naming} preferFlats={preferFlats} onTap={onFretTap} />
          <div className="ip-log">
            {fretLog.length === 0 && <span className="faint" style={{ fontSize: 13 }}>Tap a fret…</span>}
            {fretLog.map(e => (
              <span key={e.id} className="pill">
                {e.text}
              </span>
            ))}
          </div>
        </Card>

        <Card title="5th position · frets 5–9" note="C major in position V, with the hand window shaded.">
          <Fretboard minFret={5} maxFret={9} highlightFrets={[5, 8]} marks={POSITION5_MARKS} naming={naming} />
        </Card>

        <Card
          title="Left-handed"
          note="Mirrored neck (nut on the right); text stays readable."
          right={
            <Seg<'L' | 'R'>
              value={lefty ? 'L' : 'R'}
              onChange={v => setLefty(v === 'L')}
              options={[
                ['L', 'Left'],
                ['R', 'Right'],
              ]}
            />
          }
        >
          <Fretboard marks={LEFTY_MARKS} showNoteNames="marks" naming={naming} leftHanded={lefty} highlightFrets={[5, 8]} />
        </Card>
      </div>
    </div>
  );
}
