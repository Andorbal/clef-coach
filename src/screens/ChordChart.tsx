/**
 * Chord chart — any chord on every instrument the app teaches.
 *
 * Pick a root and a quality (or type a symbol), collect a few chords, and choose the
 * instruments to show. On a large screen the chart lays the chords side by side, one row
 * per instrument (say guitar over piano), or shows every voicing of one chord. On a phone
 * it shows one chord on one instrument at a time. Tap any picture to hear it. "Notation"
 * writes every picture's notes on the staff, in the clef that instrument reads.
 */
import { ArrowDown, ArrowUp, Music, Play, Plus, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InstrumentIcon, useMyInstruments } from '../components/InstrumentIcon';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { Segmented } from '../components/ui';
import { prefsOf } from '../engine/context';
import { CHORD_QUALITIES, type ChordQuality, type ChordSymbol, chordDegreeLabels, chordName, chordSymbolText, rootLabel, rootPc, spellChordTone } from '../music/chords';
import { CHORD_ROOTS, commonProgressions } from '../music/chordbook';
import { INSTRUMENT_IDS, type InstrumentId, instrumentDef, instrumentName } from '../music/instruments';
import { useProfile } from '../state/store';
import { ChordCell, ChordPicture, playView } from '../instruments/ChordCell';
import { type LabelMode, type PianoHand, chordToneLine, chordViews, tryChord } from '../music/chordViews';
import './chordchart.css';

const FAMILIES: { id: ChordQuality['family']; label: string }[] = [
  { id: 'triad', label: 'Triads' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'seventh', label: 'Sevenths' },
  { id: 'sixth', label: 'Sixths' },
  { id: 'extended', label: 'Added & extended' },
  { id: 'other', label: 'Power' },
];

const MAX_CHORDS = 8;
const WIDE = '(min-width: 1000px)';

function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const fn = () => setOn(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return on;
}

const qualityLabel = (q: ChordQuality) => (q.suffix === '' ? 'maj' : q.suffix.replace(/b(?=\d)/g, '♭').replace(/#(?=\d)/g, '♯'));

/** Move a chord by semitones, spelling the new root the way chord charts do. */
function transposeChord(c: ChordSymbol, semis: number): ChordSymbol {
  const move = (pc: number) => CHORD_ROOTS.find(r => rootPc(r) === (((pc + semis) % 12) + 12) % 12)!;
  return { ...c, root: move(rootPc(c.root)), bass: c.bass ? move(rootPc(c.bass)) : undefined };
}

export default function ChordChart() {
  const profile = useProfile();
  const settings = profile?.settings;
  const prefs = useMemo(() => (settings ? prefsOf(settings) : {}), [settings]);
  const mine = useMyInstruments();
  const wide = useMedia(WIDE);
  const [params, setParams] = useSearchParams();

  const [chords, setChords] = useState<string[]>(() => {
    const list = (params.get('chords') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s && tryChord(s));
    return list.length ? [...new Set(list)].slice(0, MAX_CHORDS) : ['C', 'G', 'Am', 'F'];
  });
  const [focus, setFocus] = useState(0);
  const [instruments, setInstruments] = useState<InstrumentId[]>(() => {
    const list = (params.get('instruments') ?? '').split(',').filter((s): s is InstrumentId => (INSTRUMENT_IDS as string[]).includes(s));
    return list.length ? list : mine;
  });
  /** write each voicing on the staff too */
  const [notation, setNotation] = useState(() => params.get('notation') === '1');
  const [mode, setMode] = useState<LabelMode>('fingers');
  const [hand, setHand] = useState<PianoHand>('R');
  const [layout, setLayout] = useState<'compare' | 'voicings'>('compare');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const playTimer = useRef<number[]>([]);

  const focusIdx = Math.min(focus, chords.length - 1);
  const current = tryChord(chords[focusIdx])!;
  // phones show one instrument at a time
  const shown = wide ? instruments : instruments.slice(0, 1);
  const view: 'compare' | 'voicings' = wide && chords.length > 1 ? layout : 'voicings';

  useEffect(() => {
    setParams({ chords: chords.join(','), instruments: instruments.join(','), ...(notation ? { notation: '1' } : {}) }, { replace: true });
  }, [chords, instruments, notation, setParams]);

  useEffect(() => () => playTimer.current.forEach(t => clearTimeout(t)), []);

  const viewsFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof chordViews>>();
    return (sym: string, inst: InstrumentId) => {
      const key = `${inst}|${sym}|${hand}`;
      let v = cache.get(key);
      if (!v) {
        const c = tryChord(sym);
        v = c ? chordViews(c, inst, prefs, { hand }) : [];
        cache.set(key, v);
      }
      return v;
    };
  }, [prefs, hand]);

  const pickKey = (sym: string, inst: InstrumentId) => `${inst}|${sym}`;
  const pickOf = (sym: string, inst: InstrumentId) => picks[pickKey(sym, inst)] ?? 0;
  const setPick = (sym: string, inst: InstrumentId, i: number) => setPicks(p => ({ ...p, [pickKey(sym, inst)]: i }));

  // --- editing the chord set -------------------------------------------------
  const replaceCurrent = (c: ChordSymbol) => {
    const sym = chordSymbolText(c);
    setChords(list => {
      const next = [...list];
      next[focusIdx] = sym;
      // keep each chord once
      return next.filter((s, i) => i === focusIdx || s !== sym);
    });
    setFocus(f => Math.min(f, chords.length - 1));
  };
  const addChord = (sym: string) => {
    if (chords.includes(sym)) {
      setFocus(chords.indexOf(sym));
      return;
    }
    if (chords.length >= MAX_CHORDS) return;
    setChords(list => [...list, sym]);
    setFocus(chords.length);
  };
  /** A new chord for "Add": a neighbour of the last chord that isn't in the set yet. */
  const nextChord = () => {
    const last = tryChord(chords[chords.length - 1]) ?? current;
    for (const semis of [5, 7, 9, 2, 4, 10, 3, 8, 1, 6, 11]) {
      const sym = chordSymbolText(transposeChord(last, semis));
      if (!chords.includes(sym)) return sym;
    }
    return chordSymbolText(last);
  };
  const removeChord = (i: number) => {
    if (chords.length < 2) return;
    setChords(list => list.filter((_, j) => j !== i));
    setFocus(f => (f > i ? f - 1 : Math.min(f, chords.length - 2)));
  };
  const moveChord = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= chords.length) return;
    setChords(list => {
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setFocus(j);
  };
  const transposeAll = (semis: number) => {
    setChords(list => [...new Set(list.map(s => chordSymbolText(transposeChord(tryChord(s)!, semis))))]);
  };
  const submitTyped = () => {
    const c = tryChord(typed);
    if (!c) {
      setTypedError(true);
      return;
    }
    addChord(chordSymbolText(c));
    setTyped('');
    setTypedError(false);
  };
  const toggleInstrument = (i: InstrumentId) => {
    if (!wide) {
      setInstruments(list => [i, ...list.filter(x => x !== i)]);
      return;
    }
    setInstruments(list => (list.includes(i) ? (list.length > 1 ? list.filter(x => x !== i) : list) : INSTRUMENT_IDS.filter(x => x === i || list.includes(x))));
  };

  // --- playing the whole set in turn -----------------------------------------
  const stopPlaying = () => {
    playTimer.current.forEach(t => clearTimeout(t));
    playTimer.current = [];
    setPlaying(null);
  };
  const playAll = () => {
    stopPlaying();
    const inst = shown[0];
    chords.forEach((sym, i) => {
      playTimer.current.push(
        window.setTimeout(() => {
          setPlaying(i);
          const v = viewsFor(sym, inst)[pickOf(sym, inst)] ?? viewsFor(sym, inst)[0];
          if (v) void playView(v, inst, prefs);
        }, i * 1600),
      );
    });
    playTimer.current.push(window.setTimeout(() => setPlaying(null), chords.length * 1600));
  };

  const pianoShown = shown.includes('piano');
  const left = !!settings?.leftHanded;

  return (
    <div className="page chords-page">
      <MobileSettingsButton />
      <PageHeader
        eyebrow="Chords"
        title="Chord chart"
        sub="Any chord on every instrument. Tap a picture to hear it."
        right={
          <div className="cc-instruments" role="group" aria-label="Instruments">
            {INSTRUMENT_IDS.map(i => (
              <button key={i} className={`chip-btn ${shown.includes(i) ? 'on' : ''}`} onClick={() => toggleInstrument(i)} aria-pressed={shown.includes(i)}>
                <InstrumentIcon instrument={i} size={16} /> {instrumentDef(i).short}
              </button>
            ))}
            <button className={`chip-btn cc-notation-chip ${notation ? 'on' : ''}`} onClick={() => setNotation(n => !n)} aria-pressed={notation} title="Write each chord on the staff too">
              <Music size={16} /> Notation
            </button>
          </div>
        }
      />

      <section className="card cc-builder">
        <div className="cc-tray">
          {chords.map((sym, i) => {
            const c = tryChord(sym)!;
            return (
              <div key={sym} className={`cc-tray-chip ${i === focusIdx ? 'on' : ''} ${playing === i ? 'playing' : ''}`}>
                <button className="cc-tray-name display" onClick={() => setFocus(i)} aria-label={`Edit ${chordName(c)}`}>
                  {chordName(c)}
                </button>
                {chords.length > 1 && (
                  <button className="cc-tray-x" onClick={() => removeChord(i)} aria-label={`Remove ${chordName(c)}`}>
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {chords.length < MAX_CHORDS && (
            <button className="chip-btn cc-add" onClick={() => addChord(nextChord())} aria-label="Add a chord">
              <Plus size={15} /> Add chord
            </button>
          )}
          <span className="grow" />
          <form
            className="cc-type"
            onSubmit={e => {
              e.preventDefault();
              submitTyped();
            }}
          >
            <input
              className={`set-input ${typedError ? 'is-bad' : ''}`}
              value={typed}
              onChange={e => {
                setTyped(e.target.value);
                setTypedError(false);
              }}
              placeholder="Type a chord: F#m7, G/B…"
              aria-label="Type a chord symbol"
            />
            <button className="btn btn-sm" type="submit" disabled={!typed.trim()}>
              Add
            </button>
          </form>
        </div>

        <div className="cc-picker">
          <div className="cc-row">
            <span className="cc-row-label faint">Root</span>
            <div className="cc-roots">
              {CHORD_ROOTS.map(r => (
                <button key={rootLabel(r)} className={`cc-key ${rootPc(r) === rootPc(current.root) ? 'on' : ''}`} onClick={() => replaceCurrent({ ...current, root: r })}>
                  {rootLabel(r)}
                </button>
              ))}
            </div>
          </div>
          {FAMILIES.map(f => (
            <div key={f.id} className="cc-row">
              <span className="cc-row-label faint">{f.label}</span>
              <div className="cc-qualities">
                {CHORD_QUALITIES.filter(q => q.family === f.id).map(q => (
                  <button key={q.id} className={`cc-key ${q.id === current.quality.id ? 'on' : ''}`} onClick={() => replaceCurrent({ ...current, quality: q })} title={q.name}>
                    {qualityLabel(q)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="cc-row cc-row-tools">
            <label className="cc-bass">
              <span className="faint">Bass note</span>
              <select
                className="set-select"
                value={current.bass ? String(rootPc(current.bass)) : ''}
                onChange={e => {
                  const pc = e.target.value;
                  replaceCurrent({ ...current, bass: pc === '' ? undefined : CHORD_ROOTS.find(r => String(rootPc(r)) === pc) });
                }}
              >
                <option value="">Root (no slash)</option>
                {CHORD_ROOTS.map(r => (
                  <option key={rootLabel(r)} value={String(rootPc(r))}>
                    /{rootLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <div className="cc-transpose">
              <span className="faint">Transpose all</span>
              <button className="btn btn-sm" onClick={() => transposeAll(-1)} aria-label="Down a semitone">
                <ArrowDown size={14} /> ½
              </button>
              <button className="btn btn-sm" onClick={() => transposeAll(1)} aria-label="Up a semitone">
                <ArrowUp size={14} /> ½
              </button>
            </div>
            <label className="cc-prog">
              <span className="faint">Progression</span>
              <select
                className="set-select"
                value=""
                onChange={e => {
                  const p = commonProgressions[Number(e.target.value)];
                  if (!p) return;
                  setChords(p.chords.slice(0, MAX_CHORDS));
                  setFocus(0);
                }}
              >
                <option value="">Load a progression…</option>
                {commonProgressions.map((p, i) => (
                  <option key={i} value={i}>
                    {p.name} in {p.key}: {p.chords.join(' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="cc-options">
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'fingers', label: 'Fingers' },
            { value: 'degrees', label: 'Intervals' },
            { value: 'notes', label: 'Notes' },
          ]}
        />
        {pianoShown && (
          <Segmented
            size="sm"
            value={hand}
            onChange={setHand}
            options={[
              { value: 'R', label: 'Right hand' },
              { value: 'L', label: 'Left hand' },
            ]}
          />
        )}
        {wide && chords.length > 1 && (
          <Segmented
            size="sm"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'compare', label: 'Side by side' },
              { value: 'voicings', label: `Every ${chordName(current)} voicing` },
            ]}
          />
        )}
        <span className="grow" />
        {chords.length > 1 && (
          <button className="btn btn-sm" onClick={() => (playing === null ? playAll() : stopPlaying())}>
            {playing === null ? <Play size={14} /> : <Square size={14} />} {playing === null ? `Play all on ${instrumentDef(shown[0]).short.toLowerCase()}` : 'Stop'}
          </button>
        )}
      </div>

      {view === 'compare' ? (
        <section className="cc-grid card" style={{ gridTemplateColumns: `minmax(92px, 120px) repeat(${chords.length}, minmax(0, 1fr))` }}>
          <div className="cc-grid-corner" />
          {chords.map((sym, i) => {
            const c = tryChord(sym)!;
            return (
              <button key={sym} className={`cc-col-head ${i === focusIdx ? 'on' : ''} ${playing === i ? 'playing' : ''}`} onClick={() => setFocus(i)}>
                <strong className="display">{chordName(c)}</strong>
                <span className="faint">{chordToneLine(c)}</span>
                <span className="cc-move">
                  {i > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Move left"
                      onClick={e => {
                        e.stopPropagation();
                        moveChord(i, -1);
                      }}
                    >
                      ‹
                    </span>
                  )}
                  {i < chords.length - 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Move right"
                      onClick={e => {
                        e.stopPropagation();
                        moveChord(i, 1);
                      }}
                    >
                      ›
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {shown.map(inst => (
            <RowCells key={inst} inst={inst} name={instrumentName(inst, prefs)}>
              {chords.map((sym, i) => (
                <div key={sym} className={`cc-grid-cell ${playing === i ? 'playing' : ''}`}>
                  <ChordCell
                    views={viewsFor(sym, inst)}
                    index={pickOf(sym, inst)}
                    onIndex={n => setPick(sym, inst, n)}
                    instrument={inst}
                    prefs={prefs}
                    mode={mode}
                    size={chords.length > 6 ? 'sm' : 'md'}
                    leftHanded={left}
                    onPlay={() => setFocus(i)}
                    notation={notation}
                  />
                </div>
              ))}
            </RowCells>
          ))}
        </section>
      ) : (
        <section className="cc-voicings">
          <header className="cc-focus-head">
            <h2 className="display">{chordName(current)}</h2>
            <span className="dim">
              {current.root.step}
              {current.root.alter ? (current.root.alter > 0 ? '♯' : '♭') : ''} {current.quality.name}
              {current.bass ? ` over ${rootLabel(current.bass)}` : ''}
            </span>
            <span className="cc-tones">
              {current.quality.tones.map((t, i) => (
                <span key={i} className="cc-tone">
                  <strong className="display">{rootLabel(spellChordTone(current.root, t))}</strong>
                  <span className="faint">{chordDegreeLabels(current.quality)[i]}</span>
                </span>
              ))}
            </span>
          </header>
          {shown.map(inst => {
            const views = viewsFor(chords[focusIdx], inst);
            const sel = Math.min(pickOf(chords[focusIdx], inst), Math.max(0, views.length - 1));
            return (
              <div key={inst} className="card cc-inst">
                <div className="cc-inst-head">
                  <InstrumentIcon instrument={inst} size={20} />
                  <strong className="display">{instrumentName(inst, prefs)}</strong>
                  <span className="faint">{views.length} voicing{views.length === 1 ? '' : 's'}</span>
                </div>
                <div className={`cc-inst-body ${views[0]?.kind === 'keys' ? 'keys' : ''}`}>
                  <ChordCell views={views} index={sel} onIndex={n => setPick(chords[focusIdx], inst, n)} instrument={inst} prefs={prefs} mode={mode} size="lg" leftHanded={left} notation={notation} />
                  {wide && views.length > 1 && (
                    <div className={`cc-thumbs ${views[0]?.kind === 'keys' ? 'keys' : ''}`}>
                      {views.map((v, i) => (
                        <div key={i} className={`cc-thumb ${i === sel ? 'on' : ''}`} onClick={() => setPick(chords[focusIdx], inst, i)}>
                          <ChordPicture view={v} instrument={inst} prefs={prefs} mode={mode} size="sm" leftHanded={left} interactive={false} />
                          <span className="faint">{v.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
      {!wide && <p className="faint cc-wide-hint">On a tablet in landscape or a laptop, the chart shows several chords and instruments side by side.</p>}
    </div>
  );
}

function RowCells({ inst, name, children }: { inst: InstrumentId; name: string; children: React.ReactNode }) {
  return (
    <>
      <div className="cc-row-head">
        <InstrumentIcon instrument={inst} size={22} />
        <span>{name}</span>
      </div>
      {children}
    </>
  );
}
