import { motion } from 'framer-motion';
import { CalendarDays, FileUp, Search, Tag, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { InstrumentIcon, useMyInstruments } from '../components/InstrumentIcon';
import { TagList } from '../components/TagEditor';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { ALL_SONGS, SONG_GROUPS, getSong, songGroup, songGroupDef } from '../content/songs';
import { getTrack } from '../curriculum';
import { INSTRUMENT_IDS, type InstrumentId, instrumentDef } from '../music/instruments';
import { keyDisplayName, parseKey } from '../music/keys';
import { type SongDef, songToScore } from '../music/parse';
import { goalPace, nextPlanStep, planProgress } from '../state/songs';
import { useApp, useProfile } from '../state/store';
import { hasAllTags, songTagsOf, tagCounts } from '../state/tags';
import './songs.css';

export function levelName(l: number) {
  if (l <= 2) return 'Beginner';
  if (l <= 4) return 'Elementary';
  if (l <= 6) return 'Intermediate';
  if (l <= 8) return 'Advanced';
  return 'Expert';
}

function accentFor(song: SongDef): string {
  const g = getSong(song.id) ? songGroupDef(songGroup(song)) : null;
  return (g && getTrack(g.track)?.accent) ?? 'var(--gold)';
}

interface LearningItem {
  song: SongDef;
  prog: { done: number; total: number };
  next: ReturnType<typeof nextPlanStep>;
  pace: ReturnType<typeof goalPace>;
}

function SongCard({ song, i, extra, tags }: { song: SongDef; i: number; extra?: React.ReactNode; tags: string[] }) {
  let keyLabel = song.key;
  try {
    keyLabel = keyDisplayName(parseKey(song.key));
  } catch {
    /* keep raw */
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
      <Link to={`/song/${song.id}`} className="song-card card" style={{ ['--accent' as string]: accentFor(song) }}>
        <div className="song-level">
          <span className="song-level-num">{song.level}</span>
          <span className="faint">{levelName(song.level)}</span>
          <span className="song-instr faint">
            <InstrumentIcon instrument={song.instrument} size={15} />
          </span>
        </div>
        <strong className="song-title display">{song.title}</strong>
        <span className="faint song-composer">
          {song.composer}
          {song.year && song.year !== song.composer ? ` · ${song.year}` : ''}
        </span>
        {song.blurb && <span className="dim song-blurb">{song.blurb}</span>}
        <TagList tags={tags} />
        {extra}
        <span className="song-meta faint">
          {keyLabel} · {song.time[0]}/{song.time[1]}
          {song.chords ? ' · chords' : ''}
        </span>
      </Link>
    </motion.div>
  );
}

export default function Songs() {
  const profile = useProfile();
  const imported = useApp(s => s.data.songs);
  const mine = useMyInstruments();
  const [filter, setFilter] = useState<InstrumentId | 'all'>(mine.length === 1 ? mine[0] : 'all');
  const [query, setQuery] = useState('');
  // chosen tags live in the address, so they're still there when you come back from a song
  const [params, setParams] = useSearchParams();
  const tagFilter = params.getAll('tag');
  const setTagFilter = (tags: string[]) => setParams(tags.length ? { tag: tags } : {}, { replace: true });
  const [allTags, setAllTags] = useState(false);
  const tagOverrides = useApp(s => s.data.songTags);
  const userSongs = useMemo(() => Object.values(imported ?? {}), [imported]);
  const allSongs = useMemo(() => [...userSongs, ...ALL_SONGS], [userSongs]);
  const tagsOf = (s: SongDef) => songTagsOf(s, tagOverrides);
  const byId = useMemo(() => new Map(allSongs.map(s => [s.id, s])), [allSongs]);

  const learning = useMemo(() => {
    const entries = Object.entries(profile?.songs ?? {}).filter(([id, sp]) => !sp.archived && byId.has(id));
    return entries
      .sort((a, b) => b[1].lastAt - a[1].lastAt)
      .map(([id, sp]) => {
        const song = byId.get(id)!;
        try {
          const score = songToScore(song);
          const item: LearningItem = { song, prog: planProgress(song, score, sp), next: nextPlanStep(song, score, sp), pace: goalPace(song, score, sp) };
          return item;
        } catch {
          return null;
        }
      })
      .filter((x): x is LearningItem => !!x);
  }, [profile?.songs, byId]);

  const q = query.trim().toLowerCase();
  const matches = (s: SongDef) =>
    (filter === 'all' || s.instrument === filter) &&
    (!q || s.title.toLowerCase().includes(q) || s.composer.toLowerCase().includes(q) || tagsOf(s).some(t => t.toLowerCase().includes(q))) &&
    hasAllTags(tagsOf(s), tagFilter);

  // tags to filter by: the ones you gave first, then the most used
  const tagChoices = useMemo(() => {
    const pool = allSongs.filter(s => filter === 'all' || s.instrument === filter);
    const yours = new Set([...userSongs.flatMap(s => s.tags ?? []), ...Object.values(tagOverrides ?? {}).flat()].map(t => t.toLowerCase()));
    return tagCounts(pool, tagOverrides).sort((a, b) => Number(yours.has(b.tag.toLowerCase())) - Number(yours.has(a.tag.toLowerCase())));
  }, [allSongs, userSongs, filter, tagOverrides]);
  const chosenLower = tagFilter.map(t => t.toLowerCase());
  const isChosen = (t: string) => chosenLower.includes(t.toLowerCase());
  const TAGS_SHOWN = 12;
  const shownTags = allTags ? tagChoices : tagChoices.filter((t, i) => i < TAGS_SHOWN || isChosen(t.tag));
  const toggleTag = (t: string) => setTagFilter(isChosen(t) ? tagFilter.filter(x => x.toLowerCase() !== t.toLowerCase()) : [...tagFilter, t]);
  const instruments = INSTRUMENT_IDS.filter(i => allSongs.some(s => s.instrument === i));
  const groups = SONG_GROUPS.filter(g => filter === 'all' || g.instrument === filter);

  return (
    <div className="page songs">
      <MobileSettingsButton />
      <PageHeader
        eyebrow="Songs"
        title="Learn a song"
        sub="Pick a song — from the library or your own — and learn it phrase by phrase: hands separately, slowed down, looped, then up to speed."
        right={
          <Link to="/songs/import" className="btn btn-primary">
            <FileUp size={16} /> Import a song
          </Link>
        }
      />

      {learning.length > 0 && (
        <section className="song-group">
          <h2 className="display song-group-title">Learning now</h2>
          <div className="song-grid">
            {learning.map(({ song, prog, next, pace }, i) => (
              <SongCard
                key={song.id}
                song={song}
                tags={tagsOf(song)}
                i={i}
                extra={
                  <span className="learning-extra">
                    <span className="learning-bar">
                      <span style={{ width: `${Math.round((prog.done / Math.max(1, prog.total)) * 100)}%` }} />
                    </span>
                    <span className="faint learning-next">{next ? `Next: ${next.title}` : 'Learned!'}</span>
                    {pace && pace.status !== 'done' && (
                      <span className={`faint learning-goal ${pace.status}`}>
                        <CalendarDays size={12} /> {pace.daysLeft >= 0 ? `${pace.daysLeft} days to go` : 'Goal date passed'}
                      </span>
                    )}
                  </span>
                }
              />
            ))}
          </div>
        </section>
      )}

      <div className="songs-filter">
        <div className="chip-row">
          <button className={`chip-btn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            All instruments
          </button>
          {instruments.map(i => (
            <button key={i} className={`chip-btn ${filter === i ? 'on' : ''}`} onClick={() => setFilter(i)}>
              <InstrumentIcon instrument={i} size={15} /> {instrumentDef(i).short}
            </button>
          ))}
        </div>
        <label className="songs-search">
          <Search size={15} />
          <input placeholder="Search songs" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search songs" />
        </label>
      </div>
      {tagChoices.length > 0 && (
        <div className="songs-tags" role="group" aria-label="Filter by tag">
          <span className="songs-tags-label faint">
            <Tag size={14} /> Tags
          </span>
          {shownTags.map(({ tag, count }) => (
            <button key={tag} className={`chip-btn chip-sm ${isChosen(tag) ? 'on' : ''}`} aria-pressed={isChosen(tag)} onClick={() => toggleTag(tag)}>
              {tag} <span className="faint tabular">{count}</span>
            </button>
          ))}
          {tagChoices.length > shownTags.length || allTags ? (
            <button className="chip-btn chip-sm chip-more" onClick={() => setAllTags(!allTags)}>
              {allTags ? 'Fewer tags' : `+${tagChoices.length - shownTags.length} more`}
            </button>
          ) : null}
          {tagFilter.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setTagFilter([])}>
              <X size={14} /> Clear tags
            </button>
          )}
        </div>
      )}

      {userSongs.some(matches) && (
        <section className="song-group">
          <h2 className="display song-group-title">My songs</h2>
          <div className="song-grid">
            {userSongs
              .filter(matches)
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((s, i) => (
                <SongCard key={s.id} song={s} tags={tagsOf(s)} i={i} />
              ))}
          </div>
        </section>
      )}

      {groups.map(g => {
        const songs = ALL_SONGS.filter(s => songGroup(s) === g.id && matches(s)).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
        if (!songs.length) return null;
        return (
          <section key={g.id} className="song-group">
            <h2 className="display song-group-title">
              {filter === 'all' ? `${instrumentDef(g.instrument).short} · ` : ''}
              {g.label}
            </h2>
            <div className="song-grid">
              {songs.map((s, i) => (
                <SongCard key={s.id} song={s} tags={tagsOf(s)} i={i} />
              ))}
            </div>
          </section>
        );
      })}
      {!allSongs.some(matches) && <p className="dim">{tagFilter.length ? 'No songs have all of those tags here.' : 'No songs match. Try another instrument — or import your own.'}</p>}
    </div>
  );
}
