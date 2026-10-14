/**
 * Song tags: labels for finding songs again ("christmas", "recital", "to learn").
 *
 * A song's tags start as the ones its file (or the library) gives it. Tags you set on
 * an imported song are written into the song itself, so they travel with it when it's
 * exported; for library songs they're kept on the side, in `PersistedData.songTags`.
 * Pure functions, no storage.
 */
import type { SongDef } from '../music/parse';

export const MAX_TAG_LENGTH = 40;

/** A tag as stored: trimmed, single spaces, no commas, not too long. */
export function normalizeTag(t: string): string {
  return t.replace(/[,\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim();
}

/** Clean a list of tags: normalised, no empties, no duplicates (ignoring case; the first spelling wins). */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = normalizeTag(raw);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Split typed text ("christmas, recital") into tags. */
export function parseTagInput(text: string): string[] {
  return cleanTags(text.split(','));
}

/** The tags a song has now: yours if you've changed them, else its own. */
export function songTagsOf(song: Pick<SongDef, 'id' | 'tags'>, overrides?: Record<string, string[]>): string[] {
  return overrides?.[song.id] ?? song.tags ?? [];
}

/** Does a song carry every one of the chosen tags (ignoring case)? */
export function hasAllTags(tags: readonly string[], chosen: readonly string[]): boolean {
  if (!chosen.length) return true;
  const have = new Set(tags.map(t => t.toLowerCase()));
  return chosen.every(t => have.has(t.toLowerCase()));
}

/**
 * Every tag in use with how many songs carry it: most used first, then by name. Tags
 * that differ only in case count as one (shown as first seen).
 */
export function tagCounts(songs: readonly Pick<SongDef, 'id' | 'tags'>[], overrides?: Record<string, string[]>): { tag: string; count: number }[] {
  const by = new Map<string, { tag: string; count: number }>();
  for (const s of songs) {
    for (const t of new Set(songTagsOf(s, overrides).map(x => x.toLowerCase()))) {
      const e = by.get(t);
      if (e) e.count++;
      else by.set(t, { tag: songTagsOf(s, overrides).find(x => x.toLowerCase() === t)!, count: 1 });
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
