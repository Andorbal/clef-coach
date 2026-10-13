import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Dumbbell, Gauge, Grid3x3, Piano, Waves } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputChip, applyInputMode } from '../components/InputControl';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { Segmented } from '../components/ui';
import { flashScore } from '../curriculum/generate';
import { getTrack } from '../curriculum';
import { InstrumentPanel, pianoRangeFor } from '../engine/InstrumentPanel';
import { useComputerPiano, useHeldNotes, useNoteInput } from '../engine/input';
import { describeNotes } from '../music/chords';
import { type Pitch, pitchLabel, spellMidi } from '../music/pitch';
import type { Clef, Score } from '../music/score';
import { buildVoice } from '../music/score';
import { NotationView } from '../notation/NotationView';
import { useDevice, useProfile } from '../state/store';
import './studio.css';

const TOOLS = [
  { to: '/studio/free', title: 'Free Play', body: 'Play anything and watch it appear on the staff, with note and chord names.', icon: Waves, color: 'gold' },
  { to: '/studio/gym', title: 'Sight-reading Gym', body: 'Endless fresh music. Choose clef, range, key and rhythm.', icon: Dumbbell, color: 'teal' },
  { to: '/studio/scales', title: 'Scales & Fingering', body: 'Every major and minor scale with the standard fingering.', icon: Piano, color: 'violet' },
  { to: '/studio/fretboard', title: 'Fretboard Explorer', body: 'Every note, scale, pentatonic box and CAGED shape on the neck.', icon: Grid3x3, color: 'green' },
  { to: '/studio/tuner', title: 'Tuner', body: 'A precise chromatic tuner for your guitar.', icon: Gauge, color: 'coral' },
];

export default function Studio() {
  return (
    <div className="page studio">
      <MobileSettingsButton />
      <PageHeader eyebrow="Studio" title="Tools for the practice room" sub="Explore freely between lessons — everything here listens to your instrument too." />
      <div className="tool-grid">
        {TOOLS.map((t, i) => (
          <motion.div key={t.to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to={t.to} className={`tool-card card tool-${t.color}`}>
              <span className="tool-icon">
                <t.icon size={26} />
              </span>
              <strong className="display tool-title">{t.title}</strong>
              <span className="dim">{t.body}</span>
              <ArrowRight size={18} className="tool-arrow" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function ToolShell({ title, children, instrument, right }: { title: string; children: React.ReactNode; instrument?: 'piano' | 'guitar'; right?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="lesson-shell tool-shell">
      <header className="lesson-top">
        <button className="btn btn-icon btn-ghost" onClick={() => navigate('/studio')} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <strong className="display grow tool-shell-title">{title}</strong>
        {right}
        {instrument && <InputChip instrument={instrument} />}
      </header>
      <main className="lesson-main">
        <div className="lesson-step">{children}</div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Free play: what you play appears on the staff
// ---------------------------------------------------------------------------

interface PlayedEvent {
  midis: number[];
  t: number;
}

export function FreePlay() {
  const profile = useProfile();
  const device = useDevice();
  const [instrument, setInstrument] = useState<'piano' | 'guitar'>(profile?.trackOrder[0]?.startsWith('guitar') ? 'guitar' : 'piano');
  const [view, setView] = useState<'grand' | 'treble' | 'bass'>(instrument === 'guitar' ? 'treble' : 'grand');
  const [events, setEvents] = useState<PlayedEvent[]>([]);
  const held = useHeldNotes();
  const last = useRef(0);
  useEffect(() => {
    if (device.inputMode !== 'touch') applyInputMode(device.inputMode).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useComputerPiano(instrument === 'piano', 4);
  useNoteInput(e => {
    if (e.type !== 'on') return;
    setEvents(ev => {
      const now = e.time;
      // notes struck within 70 ms form a chord
      if (ev.length && now - last.current < 70) {
        const copy = [...ev];
        const top = copy[copy.length - 1];
        copy[copy.length - 1] = { ...top, midis: [...new Set([...top.midis, e.midi])].sort((a, b) => a - b) };
        return copy;
      }
      last.current = now;
      return [...ev.slice(-23), { midis: [e.midi], t: now }];
    });
  });

  const score: Score = useMemo(() => {
    const clef: Clef = instrument === 'guitar' ? 'treble8vb' : view === 'bass' ? 'bass' : 'treble';
    const spelled = (m: number): Pitch => spellMidi(m, 0);
    if (view !== 'grand' || instrument === 'guitar') {
      const s = flashScore(events.length ? events.map(e => e.midis.map(spelled)) : [[]], clef, 'C', instrument);
      return s;
    }
    const id = `free${events.length}`;
    const rh = events.map(e => ({ pitches: e.midis.filter(m => m >= 60).map(spelled), base: 'w' as const }));
    const lh = events.map(e => ({ pitches: e.midis.filter(m => m < 60).map(spelled), base: 'w' as const }));
    const n = Math.max(1, events.length);
    return {
      id,
      title: '',
      key: { fifths: 0, mode: 'major' },
      time: [4, 4],
      tempo: 60,
      measures: n,
      staves: [
        { clef: 'treble', hand: 'R', voices: [buildVoice(rh.length ? rh : [{ pitches: [], base: 'w' }], [4, 4], `${id}r`)] },
        { clef: 'bass', hand: 'L', voices: [buildVoice(lh.length ? lh : [{ pitches: [], base: 'w' }], [4, 4], `${id}l`)] },
      ],
      instrument: 'piano',
    };
  }, [events, view, instrument]);

  const lastIds = score.staves.map(st => st.voices[0].notes[st.voices[0].notes.length - 1]?.id);
  const heldArr = [...held].sort((a, b) => a - b);
  const desc = describeNotes(heldArr.length ? heldArr : events[events.length - 1]?.midis ?? []);
  const names = (heldArr.length ? heldArr : events[events.length - 1]?.midis ?? []).map(m => pitchLabel(spellMidi(m), profile?.settings.naming ?? 'letter', true));
  const ctx = { instrument, settings: profile!.settings };
  const track = getTrack(instrument === 'guitar' ? 'guitar-treble' : 'piano-grand')!;
  void track;

  return (
    <ToolShell
      title="Free Play"
      instrument={instrument}
      right={<Segmented size="sm" value={instrument} onChange={v => { setInstrument(v); setView(v === 'guitar' ? 'treble' : 'grand'); }} options={[{ value: 'piano', label: 'Piano' }, { value: 'guitar', label: 'Guitar' }]} />}
    >
      <div className="activity freeplay">
        <div className="freeplay-head">
          <div className="freeplay-names">
            <span className="display freeplay-big">{names.length ? names.join(' · ') : 'Play something'}</span>
            <span className="freeplay-chord">{desc ?? (names.length ? '' : 'Notes and chords you play appear on the staff.')}</span>
          </div>
          {instrument === 'piano' && (
            <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'grand', label: 'Grand staff' }, { value: 'treble', label: '𝄞' }, { value: 'bass', label: '𝄢' }]} />
          )}
          <button className="btn btn-sm" onClick={() => setEvents([])}>
            Clear
          </button>
        </div>
        <div className="stage-paper paper freeplay-paper">
          <NotationView score={score} timeSignature={false} barlines={false} beatWidth={18} focusId={lastIds[0]} showPlayhead={false} states={Object.fromEntries(lastIds.filter(Boolean).map(id => [id!, 'active' as const]))} />
        </div>
        <InstrumentPanel ctx={ctx} range={pianoRangeFor([36, 84])} fretRange={[0, 12]} />
      </div>
    </ToolShell>
  );
}
