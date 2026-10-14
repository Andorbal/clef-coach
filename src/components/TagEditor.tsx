import { Plus, Tag, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { ALL_SONGS } from '../content/songs';
import type { InstrumentId } from '../music/instruments';
import { useApp } from '../state/store';
import { cleanTags, parseTagInput, tagCounts } from '../state/tags';
import './TagEditor.css';

/**
 * Tags to suggest: the ones you've made first, then those used on the library's songs
 * (for one instrument, if given).
 */
export function useTagSuggestions(instrument?: InstrumentId): string[] {
  const imported = useApp(s => s.data.songs);
  const overrides = useApp(s => s.data.songTags);
  return useMemo(() => {
    const mine = Object.values(imported ?? {});
    const yours = new Set([...mine.flatMap(s => s.tags ?? []), ...Object.values(overrides ?? {}).flat()].map(t => t.toLowerCase()));
    const library = new Set(tagCounts(ALL_SONGS.filter(s => !instrument || s.instrument === instrument)).map(t => t.tag.toLowerCase()));
    return tagCounts([...mine, ...ALL_SONGS], overrides)
      .filter(t => yours.has(t.tag.toLowerCase()) || library.has(t.tag.toLowerCase()))
      .sort((a, b) => Number(yours.has(b.tag.toLowerCase())) - Number(yours.has(a.tag.toLowerCase())))
      .map(t => t.tag);
  }, [imported, overrides, instrument]);
}

/**
 * Edit a list of tags: chips you can remove, a field to type new ones (Enter or a
 * comma adds; several at once with commas), and one-tap suggestions from the tags
 * already in use.
 */
export function TagEditor({
  tags,
  onChange,
  suggestions = [],
  maxSuggestions = 10,
  placeholder = 'Add a tag',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags used elsewhere, most useful first. */
  suggestions?: string[];
  maxSuggestions?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const listId = useId();
  const have = new Set(tags.map(t => t.toLowerCase()));
  const offer = suggestions.filter(s => !have.has(s.toLowerCase()));
  const add = (raw: string) => {
    const next = cleanTags([...tags, ...parseTagInput(raw)]);
    if (next.length !== tags.length) onChange(next);
    setText('');
  };
  return (
    <div className="tag-editor">
      <div className="tag-editor-row">
        {tags.map(t => (
          <span key={t} className="tag-chip">
            <Tag size={11} aria-hidden />
            {t}
            <button type="button" className="tag-x" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter(x => x !== t))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          list={listId}
          value={text}
          placeholder={tags.length ? 'Add another' : placeholder}
          aria-label="Add a tag"
          enterKeyHint="done"
          onChange={e => {
            // a comma ends a tag (typed or pasted)
            if (e.target.value.includes(',')) add(e.target.value);
            else setText(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
        />
        <datalist id={listId}>
          {offer.map(s => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {offer.length > 0 && (
        <div className="tag-suggestions">
          {offer.slice(0, maxSuggestions).map(s => (
            <button key={s} type="button" className="tag-suggest" onClick={() => add(s)}>
              <Plus size={11} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small read-only tag chips (song cards). */
export function TagList({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  return (
    <span className="tag-list">
      {shown.map(t => (
        <span key={t} className="tag-mini">
          {t}
        </span>
      ))}
      {tags.length > shown.length && <span className="tag-mini tag-more">+{tags.length - shown.length}</span>}
    </span>
  );
}
