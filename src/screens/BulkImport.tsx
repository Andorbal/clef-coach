/**
 * Import many songs at once: every file is read and checked, then you choose which to
 * keep, tag them all in one go and save them to "My songs".
 */
import { AlertTriangle, Check, ChevronDown, CircleSlash, Copy, Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstrumentIcon } from '../components/InstrumentIcon';
import { TagEditor, useTagSuggestions } from '../components/TagEditor';
import type { InstrumentId } from '../music/instruments';
import { keyDisplayName, parseKey } from '../music/keys';
import type { SongDef } from '../music/parse';
import { type BulkFile, baseName, findDuplicate, folderTag } from '../songs/bulk';
import { SongFormatError, newSongId, parseSongDoc } from '../songs/format';
import { type ImportOutcome, KIND_LABELS, importBytes } from '../songs/importers';
import { useApp } from '../state/store';
import { cleanTags } from '../state/tags';

interface Item {
  path: string;
  status: 'waiting' | 'ok' | 'error';
  outcome?: ImportOutcome;
  bars?: number;
  error?: string;
  /** an existing song with the same title, composer and instrument */
  duplicate?: SongDef;
  include: boolean;
}


export function BulkImport({ files, skipped, instrument, onCancel }: { files: BulkFile[]; skipped: string[]; instrument: InstrumentId; onCancel: () => void }) {
  const navigate = useNavigate();
  const saveSongs = useApp(s => s.saveSongs);
  const existing = useApp(s => s.data.songs);
  const tagSuggestions = useTagSuggestions(instrument);
  const [items, setItems] = useState<Item[]>(() => files.map(f => ({ path: f.path, status: 'waiting', include: false })));
  const [tags, setTags] = useState<string[]>(() => {
    const t = folderTag(files.map(f => f.path));
    return t ? cleanTags([t]) : [];
  });
  const [open, setOpen] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ count: number; failed: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  // read the files one by one, letting the page breathe between them
  useEffect(() => {
    cancelled.current = false;
    const mine = Object.values(existing ?? {});
    (async () => {
      for (let i = 0; i < files.length; i++) {
        if (cancelled.current) return;
        await new Promise(r => setTimeout(r, 0));
        const f = files[i];
        let next: Item;
        try {
          const outcome = await importBytes(f.path, f.bytes, { instrument: f.path.toLowerCase().endsWith('.json') ? undefined : instrument });
          const { score } = parseSongDoc(outcome.song, { id: outcome.song.id });
          const duplicate = findDuplicate(outcome.song, mine);
          next = { path: f.path, status: 'ok', outcome, bars: score.measures, duplicate, include: !duplicate };
        } catch (e) {
          next = { path: f.path, status: 'error', error: e instanceof SongFormatError ? e.issues.join(' ') : (e as Error).message, include: false };
        }
        if (cancelled.current) return;
        setItems(prev => prev.map((x, k) => (k === i ? next : x)));
      }
    })();
    return () => {
      cancelled.current = true;
    };
    // the existing songs are read once, when reading starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, instrument]);

  const done = items.filter(x => x.status !== 'waiting').length;
  const reading = done < items.length;
  const ready = items.filter(x => x.status === 'ok');
  const chosen = ready.filter(x => x.include);
  const failed = items.filter(x => x.status === 'error').length;
  const dupes = ready.filter(x => x.duplicate).length;
  const setInclude = (i: number, include: boolean) => setItems(prev => prev.map((x, k) => (k === i ? { ...x, include } : x)));
  const setAll = (include: boolean) => setItems(prev => prev.map(x => (x.status === 'ok' ? { ...x, include } : x)));

  const save = () => {
    if (!chosen.length) return;
    setSaving(true);
    const songs = chosen.map(x => {
      const s = x.outcome!.song;
      const id = s.id.startsWith('user-') && !existing?.[s.id] ? s.id : newSongId(s.title);
      const merged = cleanTags([...(s.tags ?? []), ...tags]);
      return { ...s, id, tags: merged.length ? merged : undefined };
    });
    // all at once; if the device's storage is full, as many as fit
    let count = 0;
    if (saveSongs(songs)) count = songs.length;
    else for (const s of songs) if (saveSongs([s])) count++;
    setSaved({ count, failed: songs.length - count });
    setSaving(false);
  };

  const sizeLabel = useMemo(() => {
    const kinds = new Map<string, number>();
    for (const x of ready) kinds.set(KIND_LABELS[x.outcome!.kind], (kinds.get(KIND_LABELS[x.outcome!.kind]) ?? 0) + 1);
    return [...kinds].map(([k, n]) => `${n} ${k}`).join(' · ');
  }, [ready]);

  if (saved) {
    return (
      <section className="card import-card bulk-done">
        <h2 className="display">
          <Check size={20} /> {saved.count ? `Saved ${saved.count} ${saved.count > 1 ? 'songs' : 'song'}` : 'Nothing was saved'}
        </h2>
        {saved.failed > 0 && (
          <p className="bulk-error">
            <AlertTriangle size={15} /> This device’s storage for Clef Coach is full, so {saved.failed} {saved.failed > 1 ? 'songs' : 'song'} couldn’t be saved. Remove songs you no longer need (or export a backup and start fresh), then import the rest.
          </p>
        )}
        <div className="import-actions">
          <button className="btn" onClick={onCancel}>
            Import more
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => navigate(tags.length ? `/songs?${new URLSearchParams(tags.map(t => ['tag', t])).toString()}` : '/songs')}>
            Show {tags.length ? 'them' : 'my songs'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card import-card bulk">
      <div className="import-preview-head">
        <h2 className="display">
          {reading ? (
            <>
              <Loader2 className="spin" size={18} /> Reading {done + 1} of {items.length}
            </>
          ) : (
            `${items.length} files`
          )}
        </h2>
        {!reading && <span className="faint">{sizeLabel}</span>}
      </div>
      {reading && (
        <div className="bulk-progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
          <span style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} />
        </div>
      )}
      <div className="import-tags">
        <span>
          Tags for every song
          <span className="faint toggle-sub">Added to each song you save, to find them again together on the Songs page.</span>
        </span>
        <TagEditor tags={tags} onChange={setTags} suggestions={tagSuggestions} maxSuggestions={6} placeholder="e.g. christmas, recital" />
      </div>

      {!reading && (failed > 0 || dupes > 0 || skipped.length > 0) && (
        <p className="faint bulk-note">
          {[
            failed ? `${failed} couldn’t be read` : '',
            dupes ? `${dupes} ${dupes > 1 ? 'are' : 'is'} already in My songs (left unticked)` : '',
            skipped.length ? `${skipped.length} other ${skipped.length > 1 ? 'files were' : 'file was'} left out (not song files)` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          .
        </p>
      )}

      <ul className="bulk-list">
        {items.map((x, i) => {
          const s = x.outcome?.song;
          let key = s?.key ?? '';
          try {
            if (s) key = keyDisplayName(parseKey(s.key));
          } catch {
            /* keep */
          }
          const warnings = x.outcome?.warnings ?? [];
          return (
            <li key={x.path} className={`bulk-row ${x.status}`}>
              <label className="bulk-check">
                <input type="checkbox" checked={x.include} disabled={x.status !== 'ok'} onChange={e => setInclude(i, e.target.checked)} aria-label={`Import ${s?.title ?? baseName(x.path)}`} />
              </label>
              <span className="bulk-icon">{s ? <InstrumentIcon instrument={s.instrument} size={16} /> : x.status === 'error' ? <CircleSlash size={16} /> : <Loader2 className="spin" size={16} />}</span>
              <span className="bulk-main">
                <strong>{s?.title ?? baseName(x.path)}</strong>
                <span className="faint">
                  {s ? `${s.composer ? `${s.composer} · ` : ''}${key} · ${s.time[0]}/${s.time[1]} · ${x.bars} bars · ${KIND_LABELS[x.outcome!.kind]}` : x.status === 'error' ? x.error : baseName(x.path)}
                </span>
                {x.duplicate && (
                  <span className="bulk-dupe">
                    <Copy size={12} /> Already in My songs — tick to import another copy
                  </span>
                )}
                {open === i && warnings.length > 0 && (
                  <ul className="import-warnings">
                    {warnings.map((w, k) => (
                      <li key={k}>{w}</li>
                    ))}
                  </ul>
                )}
              </span>
              {warnings.length > 0 && (
                <button className="btn btn-sm btn-ghost bulk-warn" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  {warnings.length} {warnings.length > 1 ? 'notes' : 'note'} <ChevronDown size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="import-actions">
        <button
          className="btn btn-ghost"
          onClick={() => {
            cancelled.current = true;
            onCancel();
          }}
        >
          Start over
        </button>
        {ready.length > 1 && (
          <button className="btn" onClick={() => setAll(chosen.length < ready.length)} disabled={reading}>
            {chosen.length < ready.length ? 'Select all' : 'Select none'}
          </button>
        )}
        <button className="btn btn-primary btn-lg" onClick={save} disabled={reading || saving || !chosen.length}>
          <Save size={18} /> Save {chosen.length || ''} {chosen.length === 1 ? 'song' : 'songs'}
        </button>
      </div>
    </section>
  );
}
