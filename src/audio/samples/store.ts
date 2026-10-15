/**
 * Sound banks kept on the device, in IndexedDB.
 *
 * Bank files can be hundreds of megabytes, far beyond what localStorage holds, so each
 * is stored as a Blob: the browser keeps it on disk, and the player reads only the
 * slices it needs (the preset tables, then the samples a song plays). An SF2 / SF3 is
 * one Blob; an SFZ bank is its .zip, or its files one by one when it came from a
 * folder or a download.
 */
import type { BankFormat } from './types';

export interface BankRecord {
  id: string;
  name: string;
  format: BankFormat;
  /** Total bytes stored. */
  size: number;
  addedAt: number;
  /** How the bank is stored: one file (sf2/sf3), a .zip, or separate files (by path). */
  storage: 'file' | 'zip' | 'files';
  /** Paths of the files (storage 'files'). */
  files?: string[];
  /** Where it came from, for the sounds page. */
  origin: { kind: 'file' | 'folder' | 'download'; url?: string; license?: string; credit?: string; catalogId?: string };
  /** Presets found when it was added: count, and whether it covers General MIDI. */
  presets?: number;
  gm?: boolean;
  drums?: boolean;
  /** Decoded size estimate of all its samples (bytes, 32-bit float), when known. */
  decodedBytes?: number;
}

const DB_NAME = 'clefcoach-sounds';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function soundStoreAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function db(): Promise<IDBDatabase> {
  if (!soundStoreAvailable()) return Promise.reject(new Error('This browser has no storage for sound banks (IndexedDB).'));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('banks')) d.createObjectStore('banks', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Could not open the sound bank storage.'));
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Storage failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Storage was cancelled (is the disk full?).'));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const blobKey = (bankId: string, path = '') => `${bankId}|${path}`;

export async function listBanks(): Promise<BankRecord[]> {
  if (!soundStoreAvailable()) return [];
  const d = await db();
  const all = await request(d.transaction('banks').objectStore('banks').getAll() as IDBRequest<BankRecord[]>);
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function getBankRecord(id: string): Promise<BankRecord | undefined> {
  const d = await db();
  return request(d.transaction('banks').objectStore('banks').get(id) as IDBRequest<BankRecord | undefined>);
}

/** Store a bank: its record and its data (one Blob, or a Blob per file path). */
export async function saveBank(record: BankRecord, data: Blob | Map<string, Blob>): Promise<void> {
  const d = await db();
  const tx = d.transaction(['banks', 'blobs'], 'readwrite');
  const blobs = tx.objectStore('blobs');
  if (data instanceof Blob) blobs.put(data, blobKey(record.id));
  else for (const [path, blob] of data) blobs.put(blob, blobKey(record.id, path));
  tx.objectStore('banks').put(record);
  await done(tx);
  requestPersistence();
}

/** Update a bank's record (name, what it covers). */
export async function updateBankRecord(record: BankRecord): Promise<void> {
  const d = await db();
  const tx = d.transaction('banks', 'readwrite');
  tx.objectStore('banks').put(record);
  await done(tx);
}

/** A bank's single Blob (storage 'file' or 'zip'). */
export async function bankBlob(id: string): Promise<Blob | undefined> {
  const d = await db();
  return request(d.transaction('blobs').objectStore('blobs').get(blobKey(id)) as IDBRequest<Blob | undefined>);
}

/** One file of a bank stored file by file. */
export async function bankFileBlob(id: string, path: string): Promise<Blob | undefined> {
  const d = await db();
  return request(d.transaction('blobs').objectStore('blobs').get(blobKey(id, path)) as IDBRequest<Blob | undefined>);
}

export async function deleteBank(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['banks', 'blobs'], 'readwrite');
  tx.objectStore('banks').delete(id);
  // every blob of the bank: keys "<id>|…"
  tx.objectStore('blobs').delete(IDBKeyRange.bound(`${id}|`, `${id}|￿`));
  await done(tx);
}

let persistAsked = false;
/** Ask the browser not to clear stored sound banks when space runs low. */
export function requestPersistence(): void {
  if (persistAsked || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => undefined);
}

/** Storage used and available for this site (bytes), when the browser says. */
export async function storageEstimate(): Promise<{ usage?: number; quota?: number }> {
  try {
    return (await navigator.storage?.estimate?.()) ?? {};
  } catch {
    return {};
  }
}
