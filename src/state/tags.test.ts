import { describe, expect, it } from 'vitest';
import { emptyData, makeExport, mergeData, newProfile, parseImport } from './logic';
import { cleanTags, hasAllTags, normalizeTag, parseTagInput, songTagsOf, tagCounts } from './tags';

describe('song tags', () => {
  it('cleans what you type', () => {
    expect(normalizeTag('  Christmas   carols ')).toBe('Christmas carols');
    expect(parseTagInput('christmas, recital,, Christmas ,warm-ups')).toEqual(['christmas', 'recital', 'warm-ups']);
    expect(cleanTags(['a'.repeat(60)])[0]).toHaveLength(40);
  });

  it('uses your tags for a song when you have set them, else its own', () => {
    const song = { id: 's1', tags: ['folk'] };
    expect(songTagsOf(song)).toEqual(['folk']);
    expect(songTagsOf(song, { s1: ['recital'] })).toEqual(['recital']);
    expect(songTagsOf({ id: 's2' }, { s1: ['x'] })).toEqual([]);
  });

  it('filters by every chosen tag, ignoring case', () => {
    expect(hasAllTags(['Christmas', 'easy'], ['christmas'])).toBe(true);
    expect(hasAllTags(['Christmas', 'easy'], ['christmas', 'recital'])).toBe(false);
    expect(hasAllTags([], [])).toBe(true);
  });

  it('counts tags, most used first', () => {
    const songs = [
      { id: 'a', tags: ['folk', 'Waltz'] },
      { id: 'b', tags: ['folk'] },
      { id: 'c', tags: ['waltz'] },
    ];
    expect(tagCounts(songs)).toEqual([
      { tag: 'folk', count: 2 },
      { tag: 'Waltz', count: 2 },
    ]);
    expect(tagCounts(songs, { c: ['recital'] })).toEqual([
      { tag: 'folk', count: 2 },
      { tag: 'recital', count: 1 },
      { tag: 'Waltz', count: 1 },
    ]);
  });

  it('keeps library song tags in backups and merges them', () => {
    const data = { ...emptyData(), songTags: { 'prh-ode-to-joy': ['recital'] } };
    const p = newProfile('A');
    data.profiles[p.id] = p;
    data.activeProfileId = p.id;
    const back = parseImport(JSON.stringify(makeExport(data, '1')));
    expect(back.songTags).toEqual({ 'prh-ode-to-joy': ['recital'] });
    const merged = mergeData({ ...data, songTags: { other: ['x'] } }, back);
    expect(merged.songTags).toEqual({ other: ['x'], 'prh-ode-to-joy': ['recital'] });
  });
});
