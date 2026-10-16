/**
 * The Synth Lab: the whole learning synth, every module showing, to play with freely.
 * Four engines, a preset library to take apart, and (once some lessons are done) the
 * choice to show only the controls you've met so far.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Eye, EyeOff, Library, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Segmented } from '../components/ui';
import { usePracticeFocus } from '../components/usePracticeFocus';
import { useProfile } from '../state/store';
import { type EngineKind, type Patch, makePatch } from '../synthlab/dsp/params';
import { initPatch, PRESETS, type Preset, presetPatch } from '../synthlab/presets';
import { Keys } from '../synthlab/ui/Keys';
import { SynthPanel } from '../synthlab/ui/SynthPanel';
import { optionLabel } from '../synthlab/ui/format';
import { useLab } from '../synthlab/ui/useLab';
import { learnedControls } from '../synthlab/course/progress';
import '../synthlab/ui/synthlab.css';
import './lesson.css';
import './synth.css';

const LAST_KEY = 'clefcoach.synthlab.patch';

function loadLast(): Patch {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw) return makePatch(JSON.parse(raw));
  } catch {
    /* storage blocked or damaged: start fresh */
  }
  return initPatch('subtractive');
}

export default function SynthLab() {
  const navigate = useNavigate();
  const profile = useProfile();
  usePracticeFocus();
  const lab = useLab(useMemo(loadLast, []));
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetName, setPresetName] = useState<string | null>(null);
  const learned = useMemo(() => learnedControls(profile?.synth), [profile?.synth]);
  const [onlyLearned, setOnlyLearned] = useState(false);
  const canFilter = learned.size > 0;
  const visible = onlyLearned && canFilter ? learned : null;

  // remember the patch for next time (a convenience on this device only)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify(lab.patch));
      } catch {
        /* storage full or blocked */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [lab.patch]);

  const setEngine = (e: EngineKind) => {
    if (e === lab.patch.engine) return;
    lab.setPatch(initPatch(e));
    setPresetName(null);
  };

  const load = (p: Preset) => {
    lab.setPatch(presetPatch(p));
    setPresetName(p.name);
    setPresetsOpen(false);
  };

  return (
    <div className="lesson-shell synth-shell">
      <header className="lesson-top synth-top">
        <button className="btn btn-icon btn-ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/synth'))} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="synth-top-title">
          <strong className="display">Synth Lab</strong>
          <span className="faint">{presetName ?? `${optionLabel(lab.patch.engine)} synth`}</span>
        </div>
        <div className="synth-top-engine">
          <Segmented<EngineKind>
            size="sm"
            value={lab.patch.engine}
            onChange={setEngine}
            options={(['subtractive', 'fm', 'additive', 'wavetable'] as const).map(e => ({ value: e, label: optionLabel(e) }))}
          />
        </div>
        <div className="synth-top-actions">
          <button className="btn btn-sm" onClick={() => setPresetsOpen(true)}>
            <Library size={16} /> Presets
          </button>
          {canFilter && (
            <button className={`btn btn-sm ${onlyLearned ? '' : 'btn-ghost'}`} onClick={() => setOnlyLearned(v => !v)} title="Show only the controls you've met in lessons">
              {onlyLearned ? <EyeOff size={16} /> : <Eye size={16} />} {onlyLearned ? 'Learned only' : 'Everything'}
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => (lab.setPatch(initPatch(lab.patch.engine)), setPresetName(null))} title="Start this engine from scratch">
            <RotateCcw size={16} /> Init
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/synth')} title="Synth School">
            <BookOpen size={16} />
          </button>
        </div>
      </header>
      <main className="synth-main">
        <div className="synth-scroll">
          <SynthPanel lab={lab} visible={visible} />
        </div>
        <div className="synth-dock">
          <Keys lab={lab} />
        </div>
      </main>
      <Modal open={presetsOpen} onClose={() => setPresetsOpen(false)} title="Presets" wide>
        <PresetBrowser onPick={load} current={presetName} />
      </Modal>
    </div>
  );
}

function PresetBrowser({ onPick, current }: { onPick: (p: Preset) => void; current: string | null }) {
  const cats = [...new Set(PRESETS.map(p => p.category))];
  const [cat, setCat] = useState(cats[0]);
  return (
    <div className="synth-presets">
      <div className="synth-preset-cats">
        {cats.map(c => (
          <button key={c} className={`chip-btn ${c === cat ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div key={cat} className="synth-preset-list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {PRESETS.filter(p => p.category === cat).map(p => (
            <button key={p.id} className={`synth-preset card ${current === p.name ? 'on' : ''}`} onClick={() => onPick(p)}>
              <span className="synth-preset-top">
                <strong>{p.name}</strong>
                <span className="pill">{optionLabel(p.patch.engine ?? 'subtractive')}</span>
              </span>
              <span className="dim">{p.recipe}</span>
            </button>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
