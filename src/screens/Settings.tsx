import { Download, FileUp, Plus, Share2, Trash2, Upload, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setMasterVolume } from '../audio/context';
import { micInput } from '../audio/input/mic';
import { setSfxEnabled, setSfxVolume, sfx } from '../audio/sfx';
import { InputPicker } from '../components/InputControl';
import { PageHeader } from '../components/Shell';
import { Avatar, Modal, Segmented, Toggle } from '../components/ui';
import { ImportError, parseImport } from '../state/logic';
import { APP_VERSION, useApp, useDevice, useProfile } from '../state/store';
import type { PersistedData, Visibility } from '../state/types';
import './settings.css';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Settings() {
  const profile = useProfile();
  const device = useDevice();
  const data = useApp(s => s.data);
  const update = useApp(s => s.updateSettings);
  const updateDevice = useApp(s => s.updateDevice);
  const rename = useApp(s => s.renameProfile);
  const switchProfile = useApp(s => s.switchProfile);
  const deleteProfile = useApp(s => s.deleteProfile);
  const exportJson = useApp(s => s.exportJson);
  const importData = useApp(s => s.importData);
  const resetAll = useApp(s => s.resetAll);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PersistedData | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  if (!profile) return null;
  const s = profile.settings;
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const fileName = `clef-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const doExport = () => {
    download(fileName, exportJson());
    flash('Backup downloaded.');
  };
  const canShare = typeof navigator !== 'undefined' && 'canShare' in navigator;
  const doShare = async () => {
    const text = exportJson();
    try {
      const file = new File([text], fileName, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Clef Coach backup' });
        return;
      }
      await navigator.clipboard.writeText(text);
      flash('Backup copied to the clipboard.');
    } catch {
      /* cancelled */
    }
  };
  const readImport = (text: string) => {
    try {
      setPending(parseImport(text));
      setImportErr(null);
    } catch (e) {
      setImportErr(e instanceof ImportError ? e.message : 'That file could not be read.');
    }
  };

  const vis = (v: Visibility, set: (v: Visibility) => void) => (
    <Segmented size="sm" value={v} onChange={set} options={[{ value: 'auto', label: 'Auto' }, { value: 'always', label: 'Always' }, { value: 'never', label: 'Never' }]} />
  );

  const profiles = Object.values(data.profiles);
  const instrument = profile.trackOrder.some(t => t.startsWith('guitar')) && !profile.trackOrder.some(t => t.startsWith('piano')) ? 'guitar' : 'piano';

  return (
    <div className="page settings">
      <PageHeader eyebrow="Settings" title="Make it yours" />

      <section className="set-section card">
        <h2 className="set-title">Player</h2>
        <div className="profile-edit">
          <Avatar name={profile.name} hue={profile.hue} size={56} />
          <input className="set-input" value={profile.name} maxLength={24} onChange={e => rename(profile.id, e.target.value)} aria-label="Name" />
        </div>
        <div className="hue-row">
          {[32, 200, 265, 150, 340, 12, 50, 180].map(h => (
            <button key={h} className={`ob-hue ${h === profile.hue ? 'on' : ''}`} style={{ background: `radial-gradient(circle at 30% 25%, hsl(${h} 90% 72%), hsl(${(h + 40) % 360} 70% 42%))` }} onClick={() => rename(profile.id, profile.name, h)} aria-label="Colour" />
          ))}
        </div>
        {profiles.length > 1 && (
          <div className="profile-list">
            <span className="faint">Profiles on this device</span>
            {profiles.map(p => (
              <div key={p.id} className={`profile-item ${p.id === profile.id ? 'on' : ''}`}>
                <Avatar name={p.name} hue={p.hue} size={30} />
                <span className="grow">{p.name}</span>
                {p.id === profile.id ? (
                  <span className="pill">Active</span>
                ) : (
                  <>
                    <button className="btn btn-sm" onClick={() => switchProfile(p.id)}>
                      Switch
                    </button>
                    <button className="btn btn-sm btn-ghost" aria-label={`Delete ${p.name}`} onClick={() => setConfirmDelete(p.id)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-sm add-profile" onClick={() => navigate('/welcome')}>
          <Plus size={14} /> <UserRound size={14} /> Add another player
        </button>
      </section>

      <section className="set-section card">
        <h2 className="set-title">Your instrument</h2>
        <InputPicker instrument={instrument} />
        {device.inputMode === 'mic' && (
          <label className="slider-row">
            <span>
              Microphone sensitivity
              <span className="faint toggle-sub">Raise it for quiet instruments; lower it in noisy rooms.</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={device.micSensitivity}
              onChange={e => {
                const v = Number(e.target.value);
                updateDevice({ micSensitivity: v });
                micInput.setSensitivity(v);
              }}
            />
          </label>
        )}
        <label className="slider-row">
          <span>
            Timing offset <strong className="tabular">{device.latencyMs} ms</strong>
            <span className="faint toggle-sub">If tempo exercises say you’re always late, increase this.</span>
          </span>
          <input type="range" min={0} max={250} step={5} value={device.latencyMs} onChange={e => updateDevice({ latencyMs: Number(e.target.value) })} />
        </label>
      </section>

      <section className="set-section card">
        <h2 className="set-title">Sound</h2>
        <label className="slider-row">
          <span>App instrument volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={device.volume}
            onChange={e => {
              const v = Number(e.target.value);
              updateDevice({ volume: v });
              setMasterVolume(v);
            }}
          />
        </label>
        <Toggle
          checked={s.sfx}
          onChange={v => {
            update({ sfx: v });
            setSfxEnabled(v);
            if (v) sfx.correct();
          }}
          label="Feedback sounds"
          sub="Soft chimes for right and wrong answers."
        />
        {s.sfx && (
          <label className="slider-row">
            <span>Feedback volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={device.sfxVolume}
              onChange={e => {
                const v = Number(e.target.value);
                updateDevice({ sfxVolume: v });
                setSfxVolume(v);
              }}
            />
          </label>
        )}
        <Toggle checked={s.metronome} onChange={v => update({ metronome: v })} label="Metronome clicks" sub="Audible click during tempo exercises (the count-in always plays)." />
      </section>

      <section className="set-section card">
        <h2 className="set-title">Reading aids</h2>
        <div className="set-row">
          <span>Note names</span>
          <Segmented size="sm" value={s.naming} onChange={v => update({ naming: v })} options={[{ value: 'letter', label: 'C D E' }, { value: 'solfege', label: 'Do Re Mi' }, { value: 'german', label: 'German (H)' }]} />
        </div>
        <div className="set-row">
          <span>
            Note-name labels on the staff
            <span className="faint toggle-sub">Auto: shown in early lessons, then faded out.</span>
          </span>
          {vis(s.noteNames, v => update({ noteNames: v }))}
        </div>
        <div className="set-row">
          <span>
            Fingering numbers
            <span className="faint toggle-sub">Auto: every note at first, then only where your hand moves.</span>
          </span>
          {vis(s.fingering, v => update({ fingering: v }))}
        </div>
        <div className="set-row">
          <span>Keyboard labels</span>
          <Segmented size="sm" value={s.keyLabels} onChange={v => update({ keyLabels: v })} options={[{ value: 'none', label: 'None' }, { value: 'c-only', label: 'C only' }, { value: 'white', label: 'All white' }]} />
        </div>
        <Toggle checked={s.leftHanded} onChange={v => update({ leftHanded: v })} label="Left-handed guitar" sub="Mirror the fretboard." />
      </section>

      <section className="set-section card">
        <h2 className="set-title">Daily goal</h2>
        <Segmented
          value={String(s.dailyGoalXp) as '20' | '50' | '100' | '150'}
          onChange={v => update({ dailyGoalXp: Number(v) })}
          options={[
            { value: '20', label: 'Casual' },
            { value: '50', label: 'Regular' },
            { value: '100', label: 'Serious' },
            { value: '150', label: 'Intense' },
          ]}
        />
        <p className="faint">{s.dailyGoalXp} XP a day — roughly {Math.max(1, Math.round(s.dailyGoalXp / 22))} lesson{s.dailyGoalXp > 22 ? 's' : ''}.</p>
      </section>

      <section className="set-section card">
        <h2 className="set-title">Your data</h2>
        <p className="dim">
          Everything is stored only on this device — no account, no cloud. To move or copy your progress, export a backup here and import it on the other device.
        </p>
        <div className="data-actions">
          <button className="btn" onClick={doExport}>
            <Download size={16} /> Export backup
          </button>
          {canShare && (
            <button className="btn" onClick={doShare}>
              <Share2 size={16} /> Share…
            </button>
          )}
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import file
          </button>
          <button className="btn btn-ghost" onClick={() => setPasteOpen(true)}>
            <FileUp size={16} /> Paste backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/plain"
            hidden
            onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) readImport(await f.text());
            }}
          />
        </div>
        {importErr && <p className="input-error">{importErr}</p>}
        <div className="divider" />
        <button className="btn btn-danger btn-sm" onClick={() => setConfirmReset(true)}>
          <Trash2 size={14} /> Erase all data on this device
        </button>
        <p className="faint">
          Tip: on iPad and iPhone, use Share → Add to Home Screen. Clef Coach then runs full-screen, works offline, and Safari keeps your data safe from automatic clean-up.
        </p>
      </section>

      <section className="set-section card about">
        <h2 className="set-title">About</h2>
        <p className="dim">
          Clef Coach {APP_VERSION}. Music engraving by VexFlow with the Bravura font (SIL Open Font License). All songs are public-domain or original compositions. Sounds are synthesised on your device.
        </p>
      </section>

      <Modal open={!!pending} onClose={() => setPending(null)} title="Import backup">
        {pending && (
          <>
            <p className="dim">
              This backup contains {Object.keys(pending.profiles).length} player{Object.keys(pending.profiles).length > 1 ? 's' : ''}:{' '}
              <strong>{Object.values(pending.profiles).map(p => p.name).join(', ')}</strong>.
            </p>
            <p className="dim">
              <strong>Merge</strong> combines it with what’s here (keeping the best result of each lesson). <strong>Replace</strong> erases this device’s data first.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  importData(pending, 'replace');
                  setPending(null);
                  flash('Backup restored.');
                }}
              >
                Replace
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  importData(pending, 'merge');
                  setPending(null);
                  flash('Backup merged.');
                }}
              >
                Merge
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Paste a backup">
        <textarea className="paste-area" value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder='{"app":"clef-coach", …}' />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setPasteOpen(false);
              readImport(pasteText);
            }}
          >
            Continue
          </button>
        </div>
      </Modal>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Erase everything?">
        <p className="dim">All players, progress and settings on this device will be deleted. Export a backup first if you might want it back.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              resetAll();
              setConfirmReset(false);
              navigate('/welcome', { replace: true });
            }}
          >
            Erase
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this player?">
        <p className="dim">Their progress on this device will be removed.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmDelete(null)}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirmDelete) deleteProfile(confirmDelete);
              setConfirmDelete(null);
            }}
          >
            Delete
          </button>
        </div>
      </Modal>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
