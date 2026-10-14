/**
 * Import a song: from a file (MusicXML from any notation app or sheet-music
 * scanner, MIDI, Guitar Pro, text tab or a Clef Coach song file), from pasted text
 * (tab or a song file), or by having Claude read photos / PDFs of sheet music or
 * tablature, or tab written as text, using your own API key.
 * Everything lands in a preview where you can check the music, fix the details
 * and save it to "My songs".
 */
import { AlertTriangle, Camera, ClipboardCopy, ClipboardPaste, Ear, FileMusic, FolderOpen, KeyRound, Loader2, Save, Sparkles, Square } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstrumentSwitch, useMyInstruments } from '../components/InstrumentIcon';
import { PageHeader } from '../components/Shell';
import { TagEditor, useTagSuggestions } from '../components/TagEditor';
import { Segmented, Toggle } from '../components/ui';
import { prefsOf } from '../engine/context';
import { autoFinger } from '../music/autofinger';
import { type InstrumentId, voiceFor } from '../music/instruments';
import type { SongDef } from '../music/parse';
import { PPQ } from '../music/rhythm';
import { buildSteps, sliceScore } from '../music/score';
import { NotationView } from '../notation/NotationView';
import { type BulkFile, expandArchives, isSongArchive } from '../songs/bulk';
import { SongFormatError, newSongId, parseSongDoc, songToJson } from '../songs/format';
import { IMPORT_ACCEPT, type ImportOutcome, KIND_LABELS, importBytes, importTabText } from '../songs/importers';
import { manualPrompt } from '../songs/llmPrompt';
import type { ScanFile } from '../songs/transcribe';
import { useApp, useProfile } from '../state/store';
import { useListen } from '../components/useListen';
import './songimport.css';
import { isIOS } from '../platform';
import { BulkImport } from './BulkImport';

const KEY_STORAGE = 'clefcoach.anthropicKey';

type Source = 'file' | 'scan' | 'paste';

/** Where the song in the preview came from, to read it again with other choices. */
type Origin = { kind: 'file'; name: string; bytes: Uint8Array } | { kind: 'paste'; text: string };

/** What the player chose while checking an import: which parts, which time signature (text tab). */
interface Reread {
  parts?: string[];
  time?: [number, number];
}

const TAB_TIMES = ['4/4', '3/4', '2/4', '6/8', '12/8'];

const isTextFile = (f: File) => f.type === 'text/plain' || /\.(txt|tab)$/i.test(f.name);

/** A song file pasted as text (JSON, perhaps in a code block), rather than tab. */
const isSongText = (text: string) => /^\s*(```[a-z]*\s*)?\{/i.test(text);

function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

/** Shrink a phone photo so it uploads fast and stays within the API's image limits. */
async function imageToScanFile(file: File): Promise<ScanFile> {
  const bitmap = await createImageBitmap(file);
  const max = 2200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.88);
  return { mediaType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), name: file.name };
}

/** The files dropped on the page, walking into dropped folders (their paths kept). */
async function filesFromDrop(dt: DataTransfer): Promise<{ path: string; file: File }[]> {
  // entries must be taken before the first await: the drop's data goes away after the event
  const entries = [...dt.items].filter(i => i.kind === 'file').map(i => i.webkitGetAsEntry?.() ?? null);
  if (!entries.some(e => e?.isDirectory)) return [...dt.files].map(file => ({ path: file.name, file }));
  const out: { path: string; file: File }[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const e of entries) if (e) await walk(e, '');
  return out;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function SongImport() {
  const profile = useProfile();
  const navigate = useNavigate();
  const saveSong = useApp(s => s.saveSong);
  const mine = useMyInstruments();
  const [source, setSource] = useState<Source>('file');
  const [instrument, setInstrument] = useState<InstrumentId>(mine[0]);
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [reread, setReread] = useState<Reread>({});
  const [error, setError] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  // scan
  const [apiKey, setApiKey] = useState(readKey);
  const [remember, setRemember] = useState(() => !!readKey());
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [scanText, setScanText] = useState('');
  const [hints, setHints] = useState('');
  const [scanTitle, setScanTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [bulk, setBulk] = useState<{ files: BulkFile[]; skipped: string[] } | null>(null);
  const [dropping, setDropping] = useState(false);
  const listening = useListen();
  const scanRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const prefs = profile ? prefsOf(profile.settings) : {};
  const tagSuggestions = useTagSuggestions(result?.song.instrument);

  const preview = useMemo(() => {
    if (!result) return null;
    try {
      const { score } = parseSongDoc(result.song, { id: result.song.id });
      autoFinger(score, prefs);
      return { score, first: sliceScore(score, 0, Math.min(score.measures, 8) - 1) };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const show = (r: ImportOutcome) => {
    setResult(r);
    setError(null);
    setEditing(false);
  };

  const fail = (e: unknown) => {
    setResult(null);
    setError(e instanceof SongFormatError ? e.issues : [(e as Error).message || String(e)]);
  };

  /** Read a file or pasted tab, with the choices made so far. */
  const load = async (from: Origin, choices: Reread = {}) => {
    setOrigin(from);
    setReread(choices);
    setBusy(from.kind === 'file' ? 'Reading the file…' : 'Reading the tab…');
    try {
      if (from.kind === 'file') show(await importBytes(from.name, from.bytes, { instrument: from.name.toLowerCase().endsWith('.json') ? undefined : instrument, ...choices }));
      else show(await importTabText(from.text, { instrument, ...choices }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const importFile = (name: string, bytes: Uint8Array) => load({ kind: 'file', name, bytes });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    await importFile(f.name, new Uint8Array(await f.arrayBuffer()));
  };

  /** Several files, a folder or a .zip of songs: import them all; a single song file goes to the preview. */
  const onFiles = async (picked: { path: string; file: File }[]) => {
    if (!picked.length) return;
    setError(null);
    setResult(null);
    setBusy('Opening the files…');
    try {
      const read: BulkFile[] = [];
      for (const p of picked) read.push({ path: p.path, bytes: new Uint8Array(await p.file.arrayBuffer()) });
      if (read.length === 1 && !isSongArchive(read[0].path, read[0].bytes)) {
        setBusy(null);
        await importFile(read[0].path, read[0].bytes);
        return;
      }
      const { files, skipped } = await expandArchives(read);
      if (!files.length) {
        setError([`No song files there (MusicXML, MIDI, Guitar Pro, tab or Clef Coach songs)${skipped.length ? `: ${skipped.length} other ${skipped.length > 1 ? 'files were' : 'file was'} left out` : ''}.`]);
        return;
      }
      setBulk({ files, skipped });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const pathOf = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

  const onPaste = () => {
    if (!isSongText(pasteText)) {
      void load({ kind: 'paste', text: pasteText });
      return;
    }
    try {
      const { song, warnings } = parseSongDoc(pasteText);
      setOrigin(null);
      show({ song, warnings, kind: 'clefsong' });
    } catch (e) {
      fail(e);
    }
  };

  /** Hand the tab in the preview to Claude, for its rhythm. */
  const readWithClaude = () => {
    if (!origin || !result) return;
    setInstrument(result.song.instrument);
    setScanText(origin.kind === 'paste' ? origin.text : new TextDecoder().decode(origin.bytes));
    setScanFiles([]);
    setResult(null);
    setSource('scan');
  };

  const runScan = async () => {
    if (!apiKey.trim() || !(scanFiles.length || scanText.trim())) return;
    try {
      if (remember) localStorage.setItem(KEY_STORAGE, apiKey.trim());
      else localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* private mode */
    }
    setError(null);
    setResult(null);
    setBusy('Preparing the pages…');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const files: ScanFile[] = [];
      for (const f of scanFiles) {
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) files.push({ mediaType: 'application/pdf', data: await fileToBase64(f), name: f.name });
        else if (isTextFile(f)) files.push({ mediaType: 'text/plain', data: await f.text(), name: f.name });
        else files.push(await imageToScanFile(f));
      }
      if (scanText.trim()) files.push({ mediaType: 'text/plain', data: scanText, name: 'Tab' });
      const [{ default: Anthropic }, { transcribeSheetMusic }] = await Promise.all([import('@anthropic-ai/sdk'), import('../songs/transcribe')]);
      // the key goes straight from this device to Anthropic – there is no Clef Coach server
      const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
      const r = await transcribeSheetMusic(client, files, { instrument, title: scanTitle.trim() || undefined, hints: hints.trim() || undefined, onProgress: setBusy, signal: ctrl.signal });
      setOrigin(null);
      show({ song: { ...r.song, source: r.song.source ?? 'Transcribed from a scan with Claude' }, warnings: r.warnings, kind: 'clefsong' });
    } catch (e) {
      const err = e as Error & { status?: number; raw?: string; issues?: string[] };
      if (err.name === 'AbortError' || ctrl.signal.aborted) setError(['Stopped.']);
      else if (err.status === 401) setError(['That API key was not accepted. Check it at console.anthropic.com.']);
      else if (err.status === 429) setError(['Too many requests right now — wait a minute and try again.']);
      else if (err.raw) {
        // a transcription that still doesn't validate: let the player fix it by hand
        setError(err.issues ?? [err.message]);
        setPasteText(err.raw);
        setSource('paste');
      } else setError([err.message || 'Something went wrong.']);
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  };

  const updateSong = (patch: Partial<SongDef>) => {
    if (!result) return;
    try {
      const next = parseSongDoc({ ...result.song, ...patch }, { id: result.song.id });
      setResult({ ...result, song: next.song, warnings: next.warnings });
    } catch {
      setResult({ ...result, song: { ...result.song, ...patch } });
    }
  };

  const toggleListen = () => {
    if (listening.playing) {
      listening.stop();
      return;
    }
    if (!preview || !result) return;
    const secPerTick = 60 / result.song.tempo / PPQ;
    const events = buildSteps(preview.first).map(st => ({ midi: st.notes.map(n => n.midi), at: 0.15 + st.tick * secPerTick, duration: Math.max(0.12, st.notes[0].ticks * secPerTick * 0.95) }));
    void listening.play(events, voiceFor(result.song.instrument, prefs));
  };

  const save = () => {
    if (!result) return;
    const id = result.song.id.startsWith('user-') ? result.song.id : newSongId(result.song.title);
    saveSong({ ...result.song, id });
    navigate(`/song/${id}`, { replace: true });
  };

  return (
    <div className="page song-import">
      <PageHeader eyebrow="Songs" title="Import a song" sub="Bring in your own music — a file from a notation app, a MIDI file, guitar or bass tab, or a photo of the sheet music your teacher gave you." />

      {bulk && <BulkImport files={bulk.files} skipped={bulk.skipped} instrument={instrument} onCancel={() => setBulk(null)} />}

      {!result && !bulk && (
        <>
          <div className="import-sources">
            {(
              [
                ['file', FileMusic, 'From a file', 'MusicXML, MIDI, Guitar Pro, tab or a Clef Coach song'],
                ['scan', Camera, 'Scan sheet music', 'Photos, a PDF or text tab, read by Claude'],
                ['paste', ClipboardPaste, 'Paste', 'Tab from a website, or a Clef Coach song'],
              ] as const
            ).map(([id, Icon, title, sub]) => (
              <button key={id} className={`import-source card ${source === id ? 'on' : ''}`} onClick={() => setSource(id)}>
                <Icon size={24} />
                <strong>{title}</strong>
                <span className="faint">{sub}</span>
              </button>
            ))}
          </div>

          <div className="set-row import-instr">
            <span>
              Instrument
              <span className="faint toggle-sub">Used for MIDI files, tab and scans (MusicXML, Guitar Pro and song files say which instrument they are for).</span>
            </span>
            <InstrumentSwitch value={instrument} onChange={setInstrument} />
          </div>

          {source === 'file' && (
            <section
              className={`card import-card import-drop ${dropping ? 'dropping' : ''}`}
              onDragOver={e => {
                if (![...e.dataTransfer.types].includes('Files')) return;
                e.preventDefault();
                setDropping(true);
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
              }}
              onDrop={e => {
                e.preventDefault();
                setDropping(false);
                void filesFromDrop(e.dataTransfer).then(onFiles);
              }}
            >
              <h2 className="display">Choose files</h2>
              <p className="dim">
                <strong>MusicXML</strong> (.musicxml, .xml, .mxl) is the open standard every notation app exports — MuseScore, Finale, Sibelius, Dorico, Flat, Noteflight — and so do sheet-music scanners like Audiveris, PlayScore and SmartScore. It keeps the fingering, chord symbols, lyrics and repeats. <strong>MIDI</strong> works too, but it only knows which keys were pressed, so spelling and rhythm are worked out for you.
              </p>
              <p className="dim">
                For guitar, bass and ukulele, <strong>Guitar Pro</strong> files (.gp, .gpx, .gp5, .gp4, .gp3) bring the tab with its rhythm, strings and tuning. <strong>Text tab</strong> (.txt) works too, but it seldom shows the rhythm, so that is guessed from the spacing — or let Claude read it under <em>Scan sheet music</em>.
              </p>
              <p className="dim">
                Pick several files at once — or a <strong>.zip</strong> of them — to import a whole collection{isIOS() ? '' : ', or choose a folder, or drop files and folders here'}.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={isIOS() ? undefined : `${IMPORT_ACCEPT},.zip,application/zip`}
                multiple
                hidden
                onChange={e => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = ''; // the same file can be picked again (after fixing it, say)
                  if (list.length === 1 && !/\.zip$/i.test(list[0].name)) void onFile(list[0]);
                  else void onFiles(list.map(file => ({ path: pathOf(file), file })));
                }}
              />
              <input
                ref={el => {
                  folderRef.current = el;
                  el?.setAttribute('webkitdirectory', '');
                }}
                type="file"
                multiple
                hidden
                onChange={e => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  void onFiles(list.map(file => ({ path: pathOf(file), file })));
                }}
              />
              <div className="row import-file-buttons">
                <button className="btn btn-primary btn-lg" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                  <FileMusic size={18} /> Choose files
                </button>
                {!isIOS() && (
                  <button className="btn btn-lg" onClick={() => folderRef.current?.click()} disabled={!!busy}>
                    <FolderOpen size={18} /> Choose a folder
                  </button>
                )}
              </div>
            </section>
          )}

          {source === 'scan' && (
            <section className="card import-card">
              <h2 className="display">
                <Sparkles size={18} /> Scan with Claude
              </h2>
              <p className="dim">
                Take photos of each page (flat, well lit, the whole page in view), pick a PDF, or give it tab written as text. Claude reads the notation or tab and writes it out as a Clef Coach song — for text tab it works out the rhythm too — and the app checks every bar and asks Claude to fix anything that doesn't add up. Uses your own Anthropic API key.
              </p>
              <label className="set-row">
                <span>
                  <KeyRound size={14} /> Anthropic API key
                  <span className="faint toggle-sub">Sent only from this device to Anthropic. Create one at console.anthropic.com.</span>
                </span>
                <input className="set-input" type="password" placeholder="sk-ant-…" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" />
              </label>
              <Toggle checked={remember} onChange={setRemember} label="Remember the key on this device" sub="Stored in this browser only; never included in backups." />
              <label className="set-row">
                <span>Title (optional)</span>
                <input className="set-input" value={scanTitle} onChange={e => setScanTitle(e.target.value)} placeholder="e.g. Silent Night" />
              </label>
              <label className="set-row">
                <span>Anything to know? (optional)</span>
                <input className="set-input" value={hints} onChange={e => setHints(e.target.value)} placeholder="e.g. only the top two staves; repeat is written out" />
              </label>
              <input
                ref={scanRef}
                type="file"
                accept="image/*,application/pdf,.txt,.tab,text/plain"
                multiple
                hidden
                onChange={e => {
                  setScanFiles([...scanFiles, ...Array.from(e.target.files ?? [])]);
                  e.target.value = '';
                }}
              />
              <div className="scan-files">
                {scanFiles.map((f, i) => (
                  <span key={`${f.name}${i}`} className="pill">
                    {i + 1}. {f.name}
                    <button className="scan-x" aria-label={`Remove ${f.name}`} onClick={() => setScanFiles(scanFiles.filter((_, k) => k !== i))}>
                      ×
                    </button>
                  </span>
                ))}
                <button className="btn btn-sm" onClick={() => scanRef.current?.click()}>
                  <Camera size={14} /> Add {scanFiles.length ? 'more pages' : 'photos, PDF or text tab'}
                </button>
              </div>
              <details className="scan-tab" open={!!scanText}>
                <summary>Tab written as text? Paste it here</summary>
                <textarea className="import-text" wrap="off" value={scanText} onChange={e => setScanText(e.target.value)} placeholder={'e|-----0-----|\nB|---1---1---|\nG|-2-------2-|\n…'} spellCheck={false} aria-label="Tab as text" />
              </details>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                {busy && abortRef.current && (
                  <button className="btn" onClick={() => abortRef.current?.abort()}>
                    Stop
                  </button>
                )}
                <button className="btn btn-primary btn-lg" onClick={runScan} disabled={!apiKey.trim() || !(scanFiles.length || scanText.trim()) || !!busy}>
                  <Sparkles size={18} /> Transcribe
                </button>
              </div>
              <details className="manual-prompt">
                <summary>No API key? Use any AI assistant instead</summary>
                <p className="dim">
                  Copy this prompt into ChatGPT, Claude.ai, Gemini or similar, attach the photos (or paste the tab after it), then paste the answer into <em>Paste</em>.
                </p>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(manualPrompt(instrument));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      /* clipboard blocked */
                    }
                  }}
                >
                  <ClipboardCopy size={14} /> {copied ? 'Copied!' : 'Copy the prompt'}
                </button>
              </details>
            </section>
          )}

          {source === 'paste' && (
            <section className="card import-card">
              <h2 className="display">Paste tab or a song</h2>
              <p className="dim">
                Paste <strong>tab</strong> copied from a website — the lines of dashes and fret numbers, string names and all, with the title, tuning and capo if it gives them — or a <strong>Clef Coach song file</strong> (JSON), for example the answer from an AI assistant (a ```json code block is fine).
              </p>
              <textarea
                className="import-text tab-text"
                wrap="off"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'e|-------0-------|-------0-------|\nB|-----1---1-----|-----3---3-----|\nG|---2-------2---|---2-------2---|\nD|-2-------------|---------------|\nA|---------------|-0-------------|\nE|---------------|---------------|\n\n…or { "format": "clef-coach-song", … }'}
                spellCheck={false}
              />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={onPaste} disabled={!pasteText.trim()}>
                  Check & preview
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {busy && (
        <div className="import-busy card">
          <Loader2 className="spin" size={20} /> {busy}
        </div>
      )}

      {error && (
        <div className="import-errors card">
          <strong>
            <AlertTriangle size={16} /> {error.length > 1 ? `${error.length} problems` : 'Problem'}
          </strong>
          <ul>
            {error.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <section className="import-preview">
          <div className="card import-card">
            <div className="import-preview-head">
              <h2 className="display">Check it over</h2>
              <span className="pill">{KIND_LABELS[result.kind]}</span>
            </div>
            <div className="import-fields">
              <label className="set-row">
                <span>Title</span>
                <input className="set-input" value={result.song.title} onChange={e => updateSong({ title: e.target.value })} />
              </label>
              <label className="set-row">
                <span>Composer</span>
                <input className="set-input" value={result.song.composer} onChange={e => updateSong({ composer: e.target.value })} />
              </label>
              <div className="set-row">
                <span>Level</span>
                <Segmented size="sm" value={String(Math.min(9, Math.max(1, Math.round(result.song.level / 2) * 2 - 1)))} onChange={v => updateSong({ level: Number(v) })} options={[{ value: '1', label: 'Beginner' }, { value: '3', label: 'Elementary' }, { value: '5', label: 'Intermediate' }, { value: '7', label: 'Advanced' }, { value: '9', label: 'Expert' }]} />
              </div>
              <label className="slider-row">
                <span>
                  Tempo <strong className="tabular">♩ = {Math.round(result.song.tempo)}</strong>
                </span>
                <input type="range" min={30} max={220} step={1} value={Math.round(result.song.tempo)} onChange={e => updateSong({ tempo: Number(e.target.value) })} />
              </label>
              <div className="import-tags">
                <span>
                  Tags
                  <span className="faint toggle-sub">Optional — to find it again on the Songs page.</span>
                </span>
                <TagEditor tags={result.song.tags ?? []} onChange={t => updateSong({ tags: t.length ? t : undefined })} suggestions={tagSuggestions} maxSuggestions={6} />
              </div>
              {result.kind === 'tab' && origin && (
                <div className="set-row">
                  <span>
                    Time signature
                    <span className="faint toggle-sub">Tab seldom says; the rhythm is read again in the one you choose.</span>
                  </span>
                  <Segmented
                    size="sm"
                    value={result.song.time.join('/')}
                    onChange={v => void load(origin, { ...reread, time: v.split('/').map(Number) as [number, number] })}
                    options={[...new Set([...TAB_TIMES, result.song.time.join('/')])].map(t => ({ value: t, label: t }))}
                  />
                </div>
              )}
              {result.parts && result.parts.length > 1 && origin && (
                <div className="set-row">
                  <span>
                    Parts in the file
                    <span className="faint toggle-sub">Tap to choose which to learn.</span>
                  </span>
                  <div className="chip-row">
                    {result.parts.map(p => (
                      <button key={p.id} className="chip-btn" onClick={() => void load(origin, { ...reread, parts: [p.id] })}>
                        {p.name || p.id}
                        {p.staves > 1 ? ` (${p.staves} staves)` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {result.warnings.length > 0 && (
              <ul className="import-warnings">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {result.kind === 'tab' && origin && (
              <div className="import-claude">
                <span className="faint">Rhythm not right? Claude can read the tab and work out the rhythm (with your Anthropic API key).</span>
                <button className="btn btn-sm" onClick={readWithClaude}>
                  <Sparkles size={14} /> Read it with Claude
                </button>
              </div>
            )}
            {preview && (
              <>
                <div className="paper import-paper">
                  <NotationView score={preview.first} fingering showPlayhead={false} beatWidth={44} naming={profile?.settings.naming} />
                </div>
                <p className="faint">
                  {preview.score.measures} bars{preview.score.measures > 8 ? ' (showing the first 8)' : ''} · {result.song.staves.length} {result.song.staves.length > 1 ? 'staves' : 'staff'}
                  {result.song.chords ? ' · chords' : ''}
                  {result.song.lyrics?.length ? ' · lyrics' : ''}
                </p>
              </>
            )}
            {editing && (
              <>
                <textarea className="import-text" value={editText} onChange={e => setEditText(e.target.value)} spellCheck={false} />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      try {
                        const p = parseSongDoc(editText, { id: result.song.id });
                        show({ ...result, song: p.song, warnings: p.warnings });
                      } catch (e) {
                        setError(e instanceof SongFormatError ? e.issues : [(e as Error).message]);
                      }
                    }}
                  >
                    Apply changes
                  </button>
                </div>
              </>
            )}
            <div className="import-actions">
              <button className="btn btn-ghost" onClick={() => setResult(null)}>
                Start over
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEditText(songToJson(result.song));
                  setEditing(!editing);
                }}
              >
                {editing ? 'Hide source' : 'Edit source'}
              </button>
              <button className="btn" onClick={toggleListen} disabled={!preview}>
                {listening.playing ? <Square size={15} /> : <Ear size={16} />} {listening.playing ? 'Stop' : 'Listen'}
              </button>
              <button className="btn btn-primary btn-lg" onClick={save} disabled={!preview || !result.song.title.trim()}>
                <Save size={18} /> Save to my songs
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
