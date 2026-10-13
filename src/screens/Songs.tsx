import { motion } from 'framer-motion';
import { CalendarDays, FileUp, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { InstrumentIcon, useMyInstruments } from '../components/InstrumentIcon';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { ALL_SONGS, SONG_GROUPS, getSong, songGroup, songGroupDef } from '../content/songs';
import { getTrack } from '../curriculum';
import { INSTRUMENT_IDS, type InstrumentId, instrumentDef } from '../music/instruments';
import { keyDisplayName, parseKey } from '../music/keys';
import { type SongDef, songToScore } from '../music/parse';
import { goalPace, nextPlanStep, planProgress } from '../state/songs';
import { useApp, useProfile } from '../state/store';
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

function SongCard({ song, i, extra }: { song: SongDef; i: number; extra?: React.ReactNode }) {
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
  const userSongs = useMemo(() => Object.values(imported ?? {}), [imported]);
  const allSongs = useMemo(() => [...userSongs, ...ALL_SONGS], [userSongs]);
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
  const matches = (s: SongDef) => (filter === 'all' || s.instrument === filter) && (!q || s.title.toLowerCase().includes(q) || s.composer.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q)));
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

      {userSongs.some(matches) && (
        <section className="song-group">
          <h2 className="display song-group-title">My songs</h2>
          <div className="song-grid">
            {userSongs
              .filter(matches)
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((s, i) => (
                <SongCard key={s.id} song={s} i={i} />
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
                <SongCard key={s.id} song={s} i={i} />
              ))}
            </div>
          </section>
        );
      })}
      {!allSongs.some(matches) && <p className="dim">No songs match. Try another instrument — or import your own.</p>}
    </div>
  );
}
