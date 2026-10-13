import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { unlockAudio } from '../audio/context';
import { InputPicker } from '../components/InputControl';
import { InstrumentIcon } from '../components/InstrumentIcon';
import { INSTRUMENT_IDS, type InstrumentId, MALLET_VARIANTS, type MalletVariant, instrumentDef } from '../music/instruments';
import { TrackBadge } from '../components/TrackBadge';
import { Logo } from '../components/ui';
import { TRACKS } from '../curriculum';
import { PianoKeyboard } from '../instruments';
import { scoreFromText } from '../music/parse';
import { autoFinger } from '../music/autofinger';
import { buildSteps } from '../music/score';
import { NotationView, type NoteState } from '../notation/NotationView';
import { useApp } from '../state/store';
import type { TrackId } from '../state/types';
import './onboarding.css';

/** A self-playing demo: the score scrolls and the keyboard lights up in sync. */
function HeroDemo() {
  const score = useMemo(
    () =>
      autoFinger(
        scoreFromText({
          id: 'hero',
          instrument: 'piano',
          key: 'C',
          time: [3, 4],
          staves: [
            { clef: 'treble', hand: 'R', voices: ['E5/q D5 C5 | B4/h G4/q | A4/q B4 C5 | D5/h. | E5/q F5 E5 | D5/q C5 B4 | C5/h. |'] },
            { clef: 'bass', hand: 'L', voices: ['C3/q [E3 G3] [E3 G3] | G2/q [D3 F3] [D3 F3] | F2/q [C3 A3] [C3 A3] | G2/q [D3 B3] [D3 B3] | C3/q [E3 G3] [E3 G3] | G2/q [D3 F3] [D3 F3] | C3/h. |'] },
          ],
        }),
      ),
    [],
  );
  const steps = useMemo(() => buildSteps(score), [score]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % steps.length), 620);
    return () => clearInterval(t);
  }, [steps.length]);
  const states = useMemo(() => {
    const s: Record<string, NoteState> = {};
    steps.forEach((st, k) => st.elIds.forEach(id => (s[id] = k < i ? 'good' : k === i ? 'active' : (undefined as never))));
    return s;
  }, [steps, i]);
  const pressed = useMemo(() => new Set(steps[i]?.notes.map(n => n.midi) ?? []), [steps, i]);
  const handOf = useMemo(() => new Map(steps[i]?.notes.map(n => [n.midi, n.hand === 'L' ? 'lh' : 'rh'] as const) ?? []), [steps, i]);
  return (
    <div className="hero-demo">
      <div className="paper hero-paper">
        <NotationView score={score} states={states} focusId={steps[i]?.elIds[0]} fingering />
      </div>
      <div className="hero-keys">
        <PianoKeyboard low={36} high={84} pressed={pressed} pressedColor={m => handOf.get(m)} interactive={false} showLabels="none" markMiddleC />
      </div>
    </div>
  );
}

/** Tracks picked for you when you choose an instrument (the ones that exist). */
const DEFAULT_TRACKS: Record<InstrumentId, TrackId[]> = {
  piano: ['piano-treble', 'piano-bass'],
  guitar: ['guitar-treble', 'guitar-fretboard'],
  ukulele: ['ukulele-treble', 'ukulele-chords'],
  bass: ['bass-lines'],
  mallets: ['mallets-two'],
};

function defaultPicks(instrs: Set<InstrumentId>): Set<TrackId> {
  const ids = new Set(TRACKS.map(t => t.id));
  const out = new Set<TrackId>();
  // with several instruments, start with the first track of each
  for (const i of instrs) for (const t of DEFAULT_TRACKS[i].filter(x => ids.has(x)).slice(0, instrs.size > 1 ? 1 : 2)) out.add(t);
  return out;
}

const HUES = [32, 200, 265, 150, 340, 12, 50, 180];

export default function Onboarding() {
  const navigate = useNavigate();
  const createProfile = useApp(s => s.createProfile);
  const addTrack = useApp(s => s.addTrack);
  const setActive = useApp(s => s.setActiveTrack);
  const hasProfiles = useApp(s => Object.keys(s.data.profiles).length > 0);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [hue, setHue] = useState(HUES[0]);
  const [instrs, setInstrs] = useState<Set<InstrumentId>>(new Set(['piano']));
  const [mallet, setMallet] = useState<MalletVariant>('marimba');
  const [picked, setPicked] = useState<Set<TrackId>>(() => defaultPicks(new Set(['piano'])));
  const [level, setLevel] = useState<'new' | 'some' | 'good'>('new');
  const updateSettings = useApp(s => s.updateSettings);

  useEffect(() => {
    setPicked(defaultPicks(instrs));
  }, [instrs]);

  const toggleInstr = (i: InstrumentId) => {
    const n = new Set(instrs);
    if (n.has(i) && n.size > 1) n.delete(i);
    else n.add(i);
    // keep the order of the list
    setInstrs(new Set(INSTRUMENT_IDS.filter(x => n.has(x))));
  };

  const finish = () => {
    createProfile(name || 'Player', hue);
    if (instrs.has('mallets')) updateSettings({ malletVariant: mallet });
    const order = TRACKS.map(t => t.id).filter(id => picked.has(id));
    order.forEach(id => addTrack(id));
    if (order[0]) setActive(order[0]);
    navigate(order[0] ? `/track/${order[0]}` : '/', { replace: true });
  };

  const total = 6;
  const next = () => setStep(s => Math.min(total - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const visibleTracks = TRACKS.filter(t => instrs.has(t.instrument));
  const firstInstr = [...instrs][0] ?? 'piano';

  return (
    <div className="onboarding">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className={`ob-step ob-step-${step}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 0 && (
            <div className="ob-welcome">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring' }}>
                <Logo size={64} />
              </motion.div>
              <h1 className="display ob-headline">
                Read music.
                <br />
                <span className="gold-text">Play it for real.</span>
              </h1>
              <p className="dim ob-lede">
                Clef Coach teaches you to read music on piano, guitar, ukulele, bass and mallet percussion — listening to your real instrument through MIDI or the microphone, from your very first note to the songs you want to play.
              </p>
              <HeroDemo />
              <div className="ob-actions">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={async () => {
                    await unlockAudio();
                    next();
                  }}
                >
                  Get started <ArrowRight size={18} />
                </button>
                {hasProfiles && (
                  <button className="btn btn-lg btn-ghost" onClick={() => navigate('/')}>
                    Cancel
                  </button>
                )}
              </div>
              <p className="faint ob-fine">No account needed. Your progress stays on this device — export it any time from Settings.</p>
            </div>
          )}

          {step === 1 && (
            <div className="ob-card card">
              <span className="eyebrow">Step 1 of 5</span>
              <h2 className="display ob-title">What should we call you?</h2>
              <input className="ob-input" autoFocus placeholder="Your name" value={name} maxLength={24} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && next()} />
              <div className="ob-hues">
                {HUES.map(h => (
                  <button key={h} className={`ob-hue ${h === hue ? 'on' : ''}`} style={{ background: `radial-gradient(circle at 30% 25%, hsl(${h} 90% 72%), hsl(${(h + 40) % 360} 70% 42%))` }} onClick={() => setHue(h)} aria-label={`Colour ${h}`} />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="ob-card card">
              <span className="eyebrow">Step 2 of 5</span>
              <h2 className="display ob-title">What do you play?</h2>
              <p className="dim">Pick one or more — you can add others later.</p>
              <div className="ob-choices instruments">
                {INSTRUMENT_IDS.map(v => {
                  const def = instrumentDef(v);
                  const on = instrs.has(v);
                  return (
                    <button key={v} className={`ob-choice ${on ? 'on' : ''}`} onClick={() => toggleInstr(v)} aria-pressed={on}>
                      <span className="ob-choice-icon">
                        <InstrumentIcon instrument={v} size={30} />
                      </span>
                      <strong>{def.name}</strong>
                      <span className="dim">{def.blurb}</span>
                      {on && <Check className="ob-check" size={18} />}
                    </button>
                  );
                })}
              </div>
              {instrs.has('mallets') && (
                <div className="ob-variant">
                  <span className="faint">Which mallet instrument?</span>
                  <div className="ob-variant-row">
                    {Object.values(MALLET_VARIANTS).map(v => (
                      <button key={v.id} className={`chip-btn ${mallet === v.id ? 'on' : ''}`} onClick={() => setMallet(v.id)}>
                        {v.name}
                      </button>
                    ))}
                  </div>
                  <span className="faint ob-variant-blurb">{MALLET_VARIANTS[mallet].blurb}</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="ob-card card wide">
              <span className="eyebrow">Step 3 of 5</span>
              <h2 className="display ob-title">Pick your tracks</h2>
              <p className="dim">You can run several at once and add more later.</p>
              <div className="ob-tracks">
                {visibleTracks.map(t => {
                  const on = picked.has(t.id);
                  return (
                    <button
                      key={t.id}
                      className={`ob-track ${on ? 'on' : ''}`}
                      style={{ ['--accent' as string]: t.accent }}
                      onClick={() => {
                        const n = new Set(picked);
                        if (on) n.delete(t.id);
                        else n.add(t.id);
                        setPicked(n);
                      }}
                    >
                      <TrackBadge track={t} size={44} />
                      <span className="ob-track-text">
                        <strong>{t.title}</strong>
                        <span className="faint">{t.subtitle}</span>
                      </span>
                      <span className={`ob-tick ${on ? 'on' : ''}`}>{on && <Check size={14} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="ob-card card">
              <span className="eyebrow">Step 4 of 5</span>
              <h2 className="display ob-title">How well do you read music?</h2>
              <div className="ob-choices">
                {(
                  [
                    ['new', 'Brand new', 'Start from the very first note.'],
                    ['some', 'A little', 'I know some notes — I’ll skim the start or test out.'],
                    ['good', 'Pretty well', 'I’ll test out of early units to find my level.'],
                  ] as const
                ).map(([v, title, sub]) => (
                  <button key={v} className={`ob-choice row-choice ${level === v ? 'on' : ''}`} onClick={() => setLevel(v)}>
                    <strong>{title}</strong>
                    <span className="dim">{sub}</span>
                    {level === v && <Check className="ob-check" size={18} />}
                  </button>
                ))}
              </div>
              {level !== 'new' && <p className="faint">Tip: on each track’s path, tap “Test out” on any unit. Pass its checkpoint and everything up to it unlocks.</p>}
            </div>
          )}

          {step === 5 && (
            <div className="ob-card card">
              <span className="eyebrow">Step 5 of 5</span>
              <h2 className="display ob-title">How will you play?</h2>
              <p className="dim">Clef Coach listens to your instrument. You can change this any time.</p>
              <InputPicker instrument={firstInstr} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step > 0 && (
        <div className="ob-nav">
          <button className="btn btn-ghost" onClick={back}>
            <ArrowLeft size={18} /> Back
          </button>
          <div className="ob-dots">
            {Array.from({ length: total - 1 }, (_, k) => (
              <span key={k} className={k + 1 === step ? 'on' : k + 1 < step ? 'done' : ''} />
            ))}
          </div>
          {step < total - 1 ? (
            <button className="btn btn-primary" onClick={next} disabled={step === 3 && picked.size === 0}>
              Next <ArrowRight size={18} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish}>
              Let’s play <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
