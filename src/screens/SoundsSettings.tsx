/**
 * Settings → Instrument sounds: sound banks (SoundFonts and SFZ instruments) for the
 * band and for your own instrument, free banks to download, and how much memory
 * samples may use. Built-in sounds always work; everything here is optional.
 */
import { ArrowLeft, Cpu, Download, FolderOpen, Info, Library, Music, Plug, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SOUND_CATALOG, type CatalogEntry } from '../audio/samples/catalog';
import { AddBankError, type DownloadProgress, addBankFiles, downloadSfz, downloadSoundFont, loadWholeBank, removeBank } from '../audio/samples/manager';
import { type BankRecord, soundStoreAvailable, storageEstimate } from '../audio/samples/store';
import { useBankPresets, useMidiOutputs, useSampleMemory, useSoundBanks } from '../audio/samples/useSoundBanks';
import { enableMidiOut, midiOutEnabled, midiOutSupported } from '../audio/midiOut';
import { VOICE_PROGRAM } from '../audio/samples/apply';
import { useMyInstruments } from '../components/InstrumentIcon';
import { SoundPicker } from '../components/SoundPicker';
import { Modal, Toggle } from '../components/ui';
import { instrumentName, voiceFor } from '../music/instruments';
import { builtinFor, builtinLabel } from '../perform/builtin';
import type { SoundSettings } from '../perform/sinks';
import { prefsOf } from '../engine/context';
import { defaultSampleBudgetMB, deviceCapability, isIOS } from '../platform';
import { useApp, useDevice, useProfile } from '../state/store';
import './settings.css';
import './sounds.css';

const MB = 1024 * 1024;
const fmtBytes = (b: number) => (b >= 1024 * MB ? `${(b / (1024 * MB)).toFixed(1)} GB` : b >= MB ? `${Math.round(b / MB)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const BUDGETS = [192, 384, 512, 1024, 2048, 4096, 8192, 16384, 32768, 0];
const budgetLabel = (mb: number) => (mb === 0 ? 'No limit' : mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`);

const FORMAT_LABEL: Record<BankRecord['format'], string> = { sf2: 'SoundFont 2', sf3: 'SoundFont 3', sfz: 'SFZ' };

export default function SoundsSettings() {
  const device = useDevice();
  const updateDevice = useApp(s => s.updateDevice);
  const profile = useProfile();
  const instruments = useMyInstruments();
  const banks = useSoundBanks();
  const presets = useBankPresets(banks);
  const inMemory = useSampleMemory();
  const outputs = useMidiOutputs();
  const cap = useMemo(() => deviceCapability(), []);
  const sounds: SoundSettings = device.sounds ?? {};
  const setSounds = (patch: Partial<SoundSettings>) => updateDevice({ sounds: { ...useApp.getState().device.sounds, ...patch } });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, { p: DownloadProgress; abort: AbortController }>>({});
  const [confirmBig, setConfirmBig] = useState<CatalogEntry | null>(null);
  const [removing, setRemoving] = useState<BankRecord | null>(null);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number }>({});
  const [loading, setLoading] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    void storageEstimate().then(setStorage);
  }, [banks]);

  const gmBanks = banks.filter(b => b.format !== 'sfz' && b.gm);
  const budgetMB = sounds.memoryMB ?? defaultSampleBudgetMB(cap);

  const add = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    setBusy('Adding…');
    try {
      const added = await addBankFiles(files, msg => setBusy(msg));
      // the first General MIDI bank becomes the band's sounds, if none is chosen yet
      const gm = added.find(b => b.gm);
      if (gm && !useApp.getState().device.sounds?.gmBank) setSounds({ gmBank: gm.id });
    } catch (e) {
      setError(e instanceof AddBankError || e instanceof Error ? e.message : 'That couldn’t be added.');
    } finally {
      setBusy(null);
    }
  };

  const download = async (entry: CatalogEntry) => {
    setError(null);
    const abort = new AbortController();
    const set = (p: DownloadProgress) => setDownloads(d => ({ ...d, [entry.id]: { p, abort } }));
    set({ loaded: 0, total: entry.size, message: 'Starting…' });
    try {
      const origin = { kind: 'download' as const, license: entry.license, credit: entry.credit, catalogId: entry.id };
      const rec = entry.sfz
        ? await downloadSfz(entry.sfz, entry.name, origin, set, abort.signal, entry.size)
        : await downloadSoundFont(entry.urls ?? [], entry.name, origin, set, abort.signal);
      if (rec.gm && !useApp.getState().device.sounds?.gmBank) setSounds({ gmBank: rec.id });
    } catch (e) {
      if (!abort.signal.aborted) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          /404/.test(msg) && entry.urls?.every(u => !/^https?:/.test(u))
            ? `${entry.name} isn’t hosted by this copy of Clef Coach. (Developers: run “npm run sounds”.)`
            : `${entry.name} couldn’t be downloaded: ${msg}`,
        );
      }
    } finally {
      setDownloads(d => {
        const n = { ...d };
        delete n[entry.id];
        return n;
      });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void add([...e.dataTransfer.files]);
  };

  if (!soundStoreAvailable()) {
    return (
      <div className="page settings">
        <Back />
        <p className="dim">This browser can’t store sound banks, so the app uses its built-in sounds.</p>
      </div>
    );
  }

  return (
    <div className="page settings sounds-page" onDragOver={e => (e.preventDefault(), setDrag(true))} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
      <Back />
      <header className="sounds-head">
        <h1 className="display">Instrument sounds</h1>
        <p className="dim">
          Everything plays with Clef Coach’s built-in sounds, on any device. Add sound banks — SoundFonts (.sf2, .sf3) or SFZ instruments — and the band, or your own instrument, plays
          recorded samples instead.
        </p>
      </header>

      <DeviceNotice cap={cap} />

      {/* ---------- the band and your instrument ---------- */}
      <section className="set-section card">
        <h2 className="set-title">What plays what</h2>
        <div className="set-row">
          <span>
            The band
            <span className="faint toggle-sub">A General MIDI bank gives every band part its own instrument. You can still change any part in a song’s mixer.</span>
          </span>
          <select
            className="set-select"
            value={sounds.bandMidiOut ? `midi|${sounds.bandMidiOut}` : sounds.gmBank ?? ''}
            onChange={e => {
              const v = e.target.value;
              if (v.startsWith('midi|')) setSounds({ bandMidiOut: v.slice(5) });
              else setSounds({ bandMidiOut: null, gmBank: v || null });
            }}
            aria-label="Sounds for the band"
          >
            <option value="">Built-in sounds</option>
            {gmBanks.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            {outputs.map(o => (
              <option key={o.id} value={`midi|${o.id}`}>
                MIDI out: {o.name}
              </option>
            ))}
            {sounds.bandMidiOut && !outputs.some(o => o.id === sounds.bandMidiOut) && <option value={`midi|${sounds.bandMidiOut}`}>MIDI out (not connected)</option>}
          </select>
        </div>
        {midiOutSupported() && !midiOutEnabled() && (
          <div className="set-row">
            <span>
              A MIDI synth or sound module
              <span className="faint toggle-sub">Play the band through a MIDI device — a digital piano’s sounds, a sound module, a synth or a DAW — each part on its own channel, drums on 10.</span>
            </span>
            <button className="btn btn-sm" onClick={() => void enableMidiOut()}>
              <Plug size={14} /> Find MIDI devices
            </button>
          </div>
        )}
        {sounds.bandMidiOut && <p className="faint">The band plays through MIDI: each part sends its General MIDI program, with the mixer’s volume and pan as controllers 7 and 10.</p>}
        {sounds.gmBank && !sounds.bandMidiOut && <Toggle checked={!!sounds.gmLayer} onChange={v => setSounds({ gmLayer: v })} label="Layer with the built-in sounds" sub="Both play together: fuller, and twice the work for the device." />}
        {instruments.map(id => {
          const voice = voiceFor(id, profile ? prefsOf(profile.settings) : {});
          return (
            <div className="set-row" key={id}>
              <span>
                Your {instrumentName(id, profile ? prefsOf(profile.settings) : {}).toLowerCase()}
                <span className="faint toggle-sub">Taps, listening, the other hand and demos.</span>
              </span>
              <SoundPicker
                label={`Sound of your ${instrumentName(id)}`}
                value={sounds.instruments?.[voice]}
                onChange={c => setSounds({ instruments: { ...sounds.instruments, [voice]: c } })}
                banks={banks}
                presets={presets}
                program={VOICE_PROGRAM[voice]}
                builtinLabel={builtinLabel(builtinFor(VOICE_PROGRAM[voice], false))}
              />
            </div>
          );
        })}
      </section>

      {/* ---------- banks on this device ---------- */}
      <section className={`set-section card ${drag ? 'dropping' : ''}`}>
        <h2 className="set-title">
          <Library size={18} /> Your sound banks
        </h2>
        {banks.length === 0 && <p className="dim">None yet. Download a free one below, or add your own.</p>}
        <ul className="bank-list">
          {banks.map(b => (
            <li key={b.id} className="bank-item">
              <div className="grow">
                <strong>{b.name}</strong>
                <div className="faint bank-meta">
                  <span className="bank-badge">{FORMAT_LABEL[b.format]}</span>
                  {b.gm && <span className="bank-badge">General MIDI</span>}
                  {b.drums && <span className="bank-badge">Drums</span>}
                  <span>{fmtBytes(b.size)} stored</span>
                  {b.decodedBytes ? <span>about {fmtBytes(b.decodedBytes)} if all loaded</span> : null}
                  {b.presets ? <span>{b.presets} instrument{b.presets === 1 ? '' : 's'}</span> : null}
                </div>
                {(b.origin.credit || b.origin.license) && (
                  <div className="faint bank-credit">
                    {b.origin.credit}
                    {b.origin.license ? ` · ${b.origin.license}` : ''}
                  </div>
                )}
              </div>
              <div className="bank-actions">
                {loading[b.id] ? (
                  <span className="faint">{loading[b.id]}</span>
                ) : (
                  <button
                    className="btn btn-sm btn-ghost"
                    title="Decode every sample now, so nothing loads while you play (uses memory up to the limit below)"
                    onClick={() => {
                      const set = (msg: string) => setLoading(l => ({ ...l, [b.id]: msg }));
                      set('Loading…');
                      void loadWholeBank(b.id, (d, t) => set(`Loading ${Math.round((d / t) * 100)}%`))
                        .then(all => set(all ? 'All in memory' : 'Memory limit reached'))
                        .catch(() => set('Couldn’t load it'));
                    }}
                  >
                    <Cpu size={14} /> Load into memory
                  </button>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(b)} aria-label={`Remove ${b.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="row bank-add">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <Upload size={15} /> Add files
          </button>
          {!isIOS() && (
            <button className="btn" onClick={() => folderRef.current?.click()} disabled={!!busy}>
              <FolderOpen size={15} /> Add a folder
            </button>
          )}
          <span className="faint">.sf2 and .sf3 SoundFonts, or an SFZ instrument as a folder or a .zip. You can drop them here too.</span>
          <input ref={fileRef} type="file" hidden multiple accept={isIOS() ? undefined : '.sf2,.sf3,.zip,.sfz'} onChange={e => void add([...(e.target.files ?? [])]).finally(() => (e.target.value = ''))} />
          <input
            ref={folderRef}
            type="file"
            hidden
            multiple
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            onChange={e => void add([...(e.target.files ?? [])]).finally(() => (e.target.value = ''))}
          />
        </div>
        {busy && <p className="dim">{busy}</p>}
        {error && (
          <p className="bank-error">
            <TriangleAlert size={15} /> {error}
          </p>
        )}
        {storage.quota ? (
          <p className="faint">
            Stored on this device: {fmtBytes(storage.usage ?? 0)} of the {fmtBytes(storage.quota)} the browser allows this app.
          </p>
        ) : null}
      </section>

      {/* ---------- free downloads ---------- */}
      <section className="set-section card">
        <h2 className="set-title">
          <Download size={18} /> Free sounds
        </h2>
        <p className="dim">Each of these is free to use — public domain, CC0, MIT, CC-BY or its own permissive licence — and downloads straight into the app.</p>
        <ul className="catalog">
          {SOUND_CATALOG.map(entry => {
            const have = banks.some(b => b.origin.catalogId === entry.id);
            const dl = downloads[entry.id];
            const pct = dl ? Math.min(100, Math.round((dl.p.loaded / Math.max(1, dl.p.total)) * 100)) : 0;
            return (
              <li key={entry.id} className="catalog-item">
                <div className="grow">
                  <strong>
                    {entry.name} {entry.recommended && <span className="bank-badge good">Start here</span>}
                    {entry.big && <span className="bank-badge warn">Big</span>}
                  </strong>
                  <div className="faint bank-meta">
                    <span className="bank-badge">{FORMAT_LABEL[entry.format]}</span>
                    <span>{fmtBytes(entry.size)}</span>
                    <span>{entry.covers}</span>
                  </div>
                  <p className="dim catalog-blurb">{entry.blurb}</p>
                  <div className="faint bank-credit">
                    {entry.credit} ·{' '}
                    <a href={entry.licenseUrl} target="_blank" rel="noreferrer">
                      {entry.license}
                    </a>
                  </div>
                  {dl && (
                    <div className="dl-progress" aria-live="polite">
                      <div className="dl-bar">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                      <span className="faint">
                        {dl.p.message} {dl.p.total ? `${fmtBytes(dl.p.loaded)} of ${fmtBytes(dl.p.total)}` : ''}
                      </span>
                    </div>
                  )}
                </div>
                {dl ? (
                  <button className="btn btn-sm" onClick={() => dl.abort.abort()}>
                    <X size={14} /> Cancel
                  </button>
                ) : have ? (
                  <span className="bank-badge good">On this device</span>
                ) : (
                  <button className="btn btn-sm" onClick={() => (entry.big && (cap.low || !cap.known) ? setConfirmBig(entry) : void download(entry))}>
                    <Download size={14} /> Download
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- memory ---------- */}
      <section className="set-section card">
        <h2 className="set-title">
          <Cpu size={18} /> Memory
        </h2>
        <div className="set-row">
          <span>
            Memory for samples
            <span className="faint toggle-sub">
              Samples are loaded only when a song needs them, and the least recently used are let go past this limit. {sounds.memoryMB === undefined && `(${budgetLabel(budgetMB)} suits this device.)`}
            </span>
          </span>
          <select className="set-select" value={String(budgetMB)} onChange={e => setSounds({ memoryMB: Number(e.target.value) })} aria-label="Memory for samples">
            {BUDGETS.map(mb => (
              <option key={mb} value={mb}>
                {budgetLabel(mb)}
              </option>
            ))}
          </select>
        </div>
        <p className="faint">
          <Music size={13} /> In use now: {fmtBytes(inMemory)}
          {budgetMB ? ` of ${budgetLabel(budgetMB)}` : ''}.
        </p>
      </section>

      <Modal open={!!confirmBig} onClose={() => setConfirmBig(null)} title={`Download ${confirmBig?.name ?? ''}?`}>
        <p className="dim">
          It’s {confirmBig ? fmtBytes(confirmBig.size) : ''} to download, and needs a lot of memory and processing power to play.{' '}
          {cap.low ? 'This device may struggle with it: playing could stutter, or the browser could reload the page.' : 'If playing stutters, choose a smaller bank or lower the memory limit.'}
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmBig(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const e = confirmBig!;
              setConfirmBig(null);
              void download(e);
            }}
          >
            Download anyway
          </button>
        </div>
      </Modal>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove this sound bank?">
        <p className="dim">“{removing?.name}” will be deleted from this device. Parts that used it go back to the built-in sounds.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setRemoving(null)}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              const b = removing!;
              setRemoving(null);
              const s = useApp.getState().device.sounds ?? {};
              const instruments = Object.fromEntries(Object.entries(s.instruments ?? {}).filter(([, c]) => !(c && 'bankId' in c && c.bankId === b.id)));
              setSounds({ gmBank: s.gmBank === b.id ? null : s.gmBank, instruments });
              void removeBank(b.id);
            }}
          >
            Remove
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Back() {
  return (
    <Link to="/settings" className="btn btn-sm btn-ghost sounds-back">
      <ArrowLeft size={16} /> Settings
    </Link>
  );
}

/** How much this device can take: a warning when it's small, a note when the browser won't say. */
function DeviceNotice({ cap }: { cap: ReturnType<typeof deviceCapability> }) {
  const facts = [cap.memoryGB !== undefined ? `${cap.memoryGB >= 8 ? 'at least 8' : cap.memoryGB} GB of memory` : null, cap.cores ? `${cap.cores} processor cores` : null].filter(Boolean).join(' and ');
  if (cap.low) {
    return (
      <div className="sound-notice warn" role="note">
        <TriangleAlert size={18} />
        <p>
          <strong>This device may struggle with big sound banks.</strong> {facts ? `It reports ${facts}. ` : ''}Large SoundFonts and SFZ instruments can make playing stutter or the browser reload
          the page. The built-in sounds always work, and small banks such as GeneralUser GS are usually fine.
        </p>
      </div>
    );
  }
  if (!cap.known) {
    return (
      <div className="sound-notice" role="note">
        <Info size={18} />
        <p>
          Sampled instruments can use a lot of memory and processing power — a detailed grand piano can take a gigabyte or more. This browser doesn’t say how much this device has; if playing
          stutters, use a smaller bank or lower the memory limit below.
        </p>
      </div>
    );
  }
  return (
    <div className="sound-notice" role="note">
      <Info size={18} />
      <p>
        This device reports {facts}. Sampled instruments use memory and processing power; set the limit below as high as you like — a big machine can hold the largest banks.
      </p>
    </div>
  );
}
