/**
 * The sound banks on this device: adding them (a SoundFont, an SFZ folder or .zip, a
 * download), opening them when a song needs them, finding instruments in them.
 */
import { BankFormatError, type ParsedBank, type SamplePreset } from './types';
import { type BankFiles, blobReader, separateFiles, zipFiles } from './files';
import { isSoundFont, parseSf2 } from './sf2';
import { parseSfzBank } from './sfz';
import { type OpenBank, Sampler, dropBankSamples, loadSample, sampleBudget, sampleMemory } from './sampler';
import { type BankRecord, bankBlob, bankFileBlob, deleteBank, listBanks, saveBank, soundStoreAvailable } from './store';

// ---------------------------------------------------------------------------
// The list of banks (observable for React)
// ---------------------------------------------------------------------------

let records: BankRecord[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach(cb => cb());

export function subscribeBanks(cb: () => void): () => void {
  subs.add(cb);
  if (!loaded) void refreshBanks();
  return () => subs.delete(cb);
}

export function banksSnapshot(): BankRecord[] {
  return records;
}

export async function refreshBanks(): Promise<BankRecord[]> {
  try {
    records = await listBanks();
  } catch (e) {
    console.warn('Sound banks could not be read', e);
    records = [];
  }
  loaded = true;
  emit();
  return records;
}

// ---------------------------------------------------------------------------
// Opening banks and finding instruments
// ---------------------------------------------------------------------------

const opened = new Map<string, Promise<OpenBank>>();
const samplers = new Map<string, Promise<Sampler | null>>();

async function filesOf(record: BankRecord): Promise<BankFiles> {
  if (record.storage === 'files') return separateFiles(record.files ?? [], p => bankFileBlob(record.id, p));
  const blob = await bankBlob(record.id);
  if (!blob) throw new BankFormatError(`The sound bank “${record.name}” is missing from this device's storage.`);
  return zipFiles(blob);
}

/** Open a stored bank (parsed once per session). */
export function openBank(id: string): Promise<OpenBank> {
  let p = opened.get(id);
  if (!p) {
    p = (async () => {
      const record = records.find(r => r.id === id) ?? (await refreshBanks()).find(r => r.id === id);
      if (!record) throw new BankFormatError('That sound bank is no longer on this device.');
      if (record.format === 'sfz') {
        const files = await filesOf(record);
        const parsed = await parseSfzBank(sfzPathsIn(files.paths), p => files.readText(p), { name: record.name });
        return { id, parsed, files };
      }
      const blob = await bankBlob(id);
      if (!blob) throw new BankFormatError(`The sound bank “${record.name}” is missing from this device's storage.`);
      const reader = blobReader(blob);
      return { id, parsed: await parseSf2(reader), reader };
    })();
    opened.set(id, p);
    p.catch(() => opened.delete(id));
  }
  return p;
}

const sfzPathsIn = (paths: readonly string[]) => paths.filter(p => /\.sfz$/i.test(p)).sort((a, b) => a.localeCompare(b));

/**
 * The preset for a General MIDI program (1–128) — or, for drums, the kit (bank 128) —
 * the way GM players look it up: the exact bank and program, then the program in any
 * bank, then (drums) the standard kit.
 */
export function findPreset(presets: readonly SamplePreset[], program: number, drums: boolean): SamplePreset | null {
  const p = Math.max(0, Math.min(127, program - 1));
  if (drums) {
    const kits = presets.filter(x => x.bank === 128);
    return kits.find(x => x.program === p) ?? kits.find(x => x.program === 0) ?? kits[0] ?? null;
  }
  const melodic = presets.filter(x => x.bank !== 128);
  return melodic.find(x => x.bank === 0 && x.program === p) ?? melodic.find(x => x.program === p) ?? null;
}

/** A sampler for one preset of a bank (null if the bank doesn't have it). */
export function samplerFor(bankId: string, bank: number, program: number): Promise<Sampler | null> {
  const key = `${bankId}:${bank}:${program}`;
  let s = samplers.get(key);
  if (!s) {
    s = openBank(bankId)
      .then(open => {
        const preset = open.parsed.presets.find(x => x.bank === bank && x.program === program);
        return preset ? new Sampler(open, preset) : null;
      })
      .catch(e => {
        console.warn('Sound bank could not be opened', e);
        samplers.delete(key);
        return null;
      });
    samplers.set(key, s);
  }
  return s;
}

/** A sampler for a GM program (or drum kit) from a bank used for General MIDI sounds. */
export async function gmSampler(bankId: string, program: number, drums: boolean): Promise<Sampler | null> {
  try {
    const open = await openBank(bankId);
    const preset = findPreset(open.parsed.presets, program, drums);
    return preset ? samplerFor(bankId, preset.bank, preset.program) : null;
  } catch {
    return null;
  }
}

/** Presets of a bank, for pickers. */
export async function bankPresets(id: string): Promise<SamplePreset[]> {
  return (await openBank(id)).parsed.presets;
}

/**
 * Decode every sample of a bank now (for machines with memory to spare: nothing is
 * decoded mid-song afterwards). Stops at the memory limit; resolves to whether it all fit.
 */
export async function loadWholeBank(id: string, onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<boolean> {
  const open = await openBank(id);
  const total = open.parsed.samples.length;
  let done = 0;
  let next = 0;
  let full = false;
  const worker = async () => {
    while (next < total && !full && !signal?.aborted) {
      const i = next++;
      await loadSample(open, i);
      done++;
      onProgress(done, total);
      if (sampleMemory() >= sampleBudget() * 0.98) full = true;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return !full && done === total;
}

// ---------------------------------------------------------------------------
// Adding banks
// ---------------------------------------------------------------------------

const AUDIO_EXT = /\.(wav|wave|flac|ogg|oga|mp3|aif|aiff)$/i;
const TEXT_EXT = /\.(sfz|txt|sfzh|inc)$/i;

export class AddBankError extends Error {}

function newId(): string {
  return `bank-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function summary(parsed: ParsedBank): Pick<BankRecord, 'presets' | 'gm' | 'drums' | 'decodedBytes'> {
  const melodic = new Set(parsed.presets.filter(p => p.bank !== 128).map(p => p.program));
  let bytes = 0;
  for (const s of parsed.samples) {
    if (s.source.kind === 'pcm16') bytes += s.source.frames * 4;
    else if (s.source.kind === 'encoded') bytes += s.source.byteLength * 11; // Ogg Vorbis ≈ 1:11 against 32-bit float
  }
  return { presets: parsed.presets.length, gm: melodic.size >= 100, drums: parsed.presets.some(p => p.bank === 128), decodedBytes: bytes || undefined };
}

const baseName = (name: string) => name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Sound bank';

/** Read a SoundFont from a Blob and store it. */
async function addSoundFont(blob: Blob, name: string, origin: BankRecord['origin'], title?: string): Promise<BankRecord> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (!isSoundFont(head)) throw new AddBankError(`“${name}” isn't a SoundFont (.sf2 / .sf3) file.`);
  const parsed = await parseSf2(blobReader(blob));
  const record: BankRecord = {
    id: newId(),
    name: title ?? (parsed.name && parsed.name !== 'SoundFont' ? parsed.name : baseName(name)),
    format: parsed.format,
    size: blob.size,
    addedAt: Date.now(),
    storage: 'file',
    origin,
    ...summary(parsed),
  };
  await saveBank(record, blob);
  return record;
}

async function addSfz(files: BankFiles, data: Blob | Map<string, Blob>, name: string, origin: BankRecord['origin'], size: number): Promise<BankRecord> {
  const sfz = sfzPathsIn(files.paths);
  if (!sfz.length) throw new AddBankError('There are no .sfz instruments in it.');
  const parsed = await parseSfzBank(sfz, p => files.readText(p), { name });
  const have = new Set(files.paths.map(p => p.toLowerCase()));
  const named = parsed.samples.flatMap(x => (x.source.kind === 'file' ? [x.source.path.toLowerCase()] : []));
  if (named.length && named.every(p => !have.has(p))) throw new AddBankError('None of the samples its .sfz files name are there. Add the whole folder (or a .zip of it), samples included.');
  const record: BankRecord = {
    id: newId(),
    name,
    format: 'sfz',
    size,
    addedAt: Date.now(),
    storage: data instanceof Map ? 'files' : 'zip',
    files: data instanceof Map ? [...data.keys()] : undefined,
    origin,
    presets: parsed.presets.length,
    gm: false,
    drums: parsed.presets.some(p => /drum|kit|perc/i.test(p.name)),
  };
  await saveBank(record, data);
  return record;
}

/** Strip the folder every path shares ("MyPiano/Samples/a.wav" → "Samples/a.wav" when all start "MyPiano/"). */
function stripCommonRoot(paths: string[]): (p: string) => string {
  const first = paths[0]?.split('/') ?? [];
  let n = 0;
  while (n < first.length - 1 && paths.every(p => p.split('/')[n] === first[n] && p.split('/').length > n + 1)) n++;
  return p => p.split('/').slice(n).join('/');
}

/**
 * Add banks from files the player picked or dropped: .sf2 / .sf3 files, .zip files (an
 * SFZ library, or a zipped SoundFont), or a whole folder (an SFZ library).
 */
export async function addBankFiles(list: File[], onProgress?: (msg: string) => void): Promise<BankRecord[]> {
  if (!soundStoreAvailable()) throw new AddBankError('This browser can’t store sound banks.');
  const added: BankRecord[] = [];
  const folder = list.filter(f => (f as File & { webkitRelativePath?: string }).webkitRelativePath);
  const loose = list.filter(f => !folder.includes(f));
  if (folder.length) {
    onProgress?.('Reading the folder…');
    const rel = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name).replace(/\\/g, '/');
    const keep = folder.filter(f => AUDIO_EXT.test(f.name) || TEXT_EXT.test(f.name));
    const sf = folder.filter(f => /\.sf[23]$/i.test(f.name));
    for (const f of sf) added.push(await addSoundFont(f, f.name, { kind: 'folder' }));
    if (keep.some(f => /\.sfz$/i.test(f.name))) {
      const strip = stripCommonRoot(keep.map(rel));
      const map = new Map(keep.map(f => [strip(rel(f)), f as Blob]));
      const files = separateFiles([...map.keys()], async p => map.get(p));
      const root = rel(keep[0]).split('/')[0];
      added.push(await addSfz(files, map, baseName(root), { kind: 'folder' }, keep.reduce((s, f) => s + f.size, 0)));
    } else if (!sf.length) throw new AddBankError('That folder has no .sfz instruments or SoundFonts in it.');
  }
  for (const f of loose) {
    onProgress?.(`Reading “${f.name}”…`);
    if (/\.sf[23]$/i.test(f.name)) added.push(await addSoundFont(f, f.name, { kind: 'file' }));
    else if (/\.zip$/i.test(f.name)) {
      const files = await zipFiles(f);
      const sfName = files.paths.find(p => /\.sf[23]$/i.test(p));
      if (!files.paths.some(p => /\.sfz$/i.test(p)) && sfName) {
        // a zipped SoundFont: store the SoundFont itself
        const bytes = await files.read(sfName);
        if (bytes) added.push(await addSoundFont(new Blob([bytes.slice().buffer]), sfName, { kind: 'file' }));
      } else added.push(await addSfz(files, f, baseName(f.name), { kind: 'file' }, f.size));
    } else if (/\.sfz$/i.test(f.name)) {
      throw new AddBankError(`“${f.name}” is only the instrument's text file: its samples are in the folder next to it. Choose the whole folder, or a .zip of it.`);
    } else throw new AddBankError(`“${f.name}” isn't a sound bank. Use SoundFonts (.sf2, .sf3) or SFZ instruments (a folder or a .zip).`);
  }
  await refreshBanks();
  return added;
}

/** Remove a bank and its samples. */
export async function removeBank(id: string): Promise<void> {
  await deleteBank(id);
  opened.delete(id);
  for (const k of [...samplers.keys()]) if (k.startsWith(`${id}:`)) samplers.delete(k);
  dropBankSamples(id);
  await refreshBanks();
}

// ---------------------------------------------------------------------------
// Downloading
// ---------------------------------------------------------------------------

export interface DownloadProgress {
  loaded: number;
  total: number;
  message: string;
}

async function fetchBlob(url: string, signal: AbortSignal | undefined, onBytes: (n: number, total: number) => void): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new AddBankError(`The download failed (${res.status} ${res.statusText || 'error'}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    const blob = await res.blob();
    onBytes(blob.size, total || blob.size);
    return blob;
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onBytes(got, total);
  }
  return new Blob(parts as BlobPart[]);
}

/** Download a single-file bank (the first URL that works) and store it. */
export async function downloadSoundFont(urls: string[], name: string, origin: BankRecord['origin'], onProgress: (p: DownloadProgress) => void, signal?: AbortSignal): Promise<BankRecord> {
  let last: unknown = null;
  for (const url of urls) {
    try {
      const blob = await fetchBlob(url, signal, (loaded, total) => onProgress({ loaded, total, message: `Downloading ${name}…` }));
      onProgress({ loaded: blob.size, total: blob.size, message: 'Reading it…' });
      const rec = await addSoundFont(blob, name, { ...origin, url }, name);
      await refreshBanks();
      return rec;
    } catch (e) {
      if (signal?.aborted) throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new AddBankError('The download failed.');
}

/**
 * Download an SFZ instrument file by file: its .sfz (and any files it includes), then
 * every sample it names, a few at a time.
 */
export async function downloadSfz(
  src: { base: string; files: string[]; inline?: Record<string, string> },
  name: string,
  origin: BankRecord['origin'],
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
  approxBytes = 0,
): Promise<BankRecord> {
  const { base, files: sfz, inline = {} } = src;
  const map = new Map<string, Blob>();
  // sample names can hold '#', '?' and spaces: encode each part of the path
  const url = (p: string) => base.replace(/\/?$/, '/') + p.split('/').map(encodeURIComponent).join('/');
  for (const [p, text] of Object.entries(inline)) map.set(p, new Blob([text], { type: 'text/plain' }));
  const readText = async (p: string): Promise<string | null> => {
    const hit = map.get(p);
    if (hit) return hit.text();
    const res = await fetch(url(p), { signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    map.set(p, blob);
    return blob.text();
  };
  onProgress({ loaded: 0, total: approxBytes, message: 'Reading the instrument…' });
  const parsed = await parseSfzBank(sfz, readText, { name });
  const paths = [...new Set(parsed.samples.flatMap(s => (s.source.kind === 'file' ? [s.source.path] : [])))];
  let loaded = 0;
  let next = 0;
  const total = approxBytes;
  // the first failure (or a cancel) stops the other downloads too
  const stop = new AbortController();
  const cancel = () => stop.abort();
  signal?.addEventListener('abort', cancel);
  if (signal?.aborted) cancel();
  const worker = async () => {
    while (next < paths.length) {
      const p = paths[next++];
      if (stop.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      let prev = 0;
      const blob = await fetchBlob(url(p), stop.signal, n => {
        loaded += n - prev;
        prev = n;
        onProgress({ loaded, total: Math.max(total, loaded), message: `Downloading ${name}: ${next} of ${paths.length} samples…` });
      });
      map.set(p, blob);
    }
  };
  try {
    await Promise.all(
      Array.from({ length: 6 }, () =>
        worker().catch(e => {
          cancel();
          throw e;
        }),
      ),
    );
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
  const size = [...map.values()].reduce((s, b) => s + b.size, 0);
  onProgress({ loaded: size, total: size, message: 'Saving it…' });
  const files = separateFiles([...map.keys()], async p => map.get(p));
  const rec = await addSfz(files, map, name, origin, size);
  await refreshBanks();
  return rec;
}
