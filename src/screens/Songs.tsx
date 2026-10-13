import { motion } from 'framer-motion';
import { ArrowLeft, Music, Play } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { InputChip } from '../components/InputControl';
import { MobileSettingsButton, PageHeader } from '../components/Shell';
import { Segmented } from '../components/ui';
import { ALL_SONGS, getSong, songGroup, type SongGroup } from '../content/songs';
import { makeRng } from '../curriculum/generate';
import { getTrack } from '../curriculum';
import type { ActivityResult, LessonCtx } from '../engine/context';
import { PlayAlong } from '../engine/PlayAlong';
import { autoFinger } from '../music/autofinger';
import { keyDisplayName, parseKey } from '../music/keys';
import { songToScore } from '../music/parse';
import { useApp, useDevice, useProfile } from '../state/store';
import type { TrackId } from '../state/types';
import './songs.css';

const GROUPS: { id: SongGroup; label: string; track: TrackId }[] = [
  { id: 'piano-rh', label: 'Right hand', track: 'piano-treble' },
  { id: 'piano-lh', label: 'Left hand', track: 'piano-bass' },
  { id: 'piano-both', label: 'Both hands', track: 'piano-grand' },
  { id: 'guitar-treble', label: 'Guitar', track: 'guitar-treble' },
  { id: 'guitar-bass', label: 'Guitar bass clef', track: 'guitar-bass' },
];

function levelName(l: number) {
  if (l <= 2) return 'Beginner';
  if (l <= 4) return 'Elementary';
  if (l <= 6) return 'Intermediate';
  if (l <= 8) return 'Advanced';
  return 'Expert';
}

export default function Songs() {
  const profile = useProfile();
  const [instr, setInstr] = useState<'piano' | 'guitar'>(profile?.trackOrder.some(t => t.startsWith('guitar')) && !profile?.trackOrder.some(t => t.startsWith('piano')) ? 'guitar' : 'piano');
  const groups = GROUPS.filter(g => (instr === 'piano' ? g.id.startsWith('piano') : g.id.startsWith('guitar')));
  return (
    <div className="page songs">
      <MobileSettingsButton />
      <PageHeader
        eyebrow="Library"
        title="Songs"
        sub="Public-domain classics and originals written for Clef Coach, arranged by level. Play any of them, any time."
        right={<Segmented value={instr} onChange={setInstr} options={[{ value: 'piano', label: 'Piano' }, { value: 'guitar', label: 'Guitar' }]} />}
      />
      {groups.map(g => {
        const songs = ALL_SONGS.filter(s => songGroup(s) === g.id).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
        if (!songs.length) return null;
        const track = getTrack(g.track);
        return (
          <section key={g.id} className="song-group">
            <h2 className="display song-group-title">{g.label}</h2>
            <div className="song-grid">
              {songs.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                  <Link to={`/song/${s.id}`} className="song-card card" style={{ ['--accent' as string]: track?.accent ?? 'var(--gold)' }}>
                    <div className="song-level">
                      <span className="song-level-num">{s.level}</span>
                      <span className="faint">{levelName(s.level)}</span>
                    </div>
                    <strong className="song-title display">{s.title}</strong>
                    <span className="faint song-composer">
                      {s.composer}
                      {s.year ? ` · ${s.year}` : ''}
                    </span>
                    {s.blurb && <span className="dim song-blurb">{s.blurb}</span>}
                    <span className="song-meta faint">
                      {keyDisplayName(parseKey(s.key))} · {s.time[0]}/{s.time[1]}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SongPlayer() {
  const { songId = '' } = useParams();
  const song = getSong(songId);
  const profile = useProfile();
  const device = useDevice();
  const navigate = useNavigate();
  const record = useApp(s => s.recordOutcome);
  const group = song ? songGroup(song) : 'piano-rh';
  const trackId = GROUPS.find(g => g.id === group)?.track ?? 'piano-treble';
  const track = getTrack(trackId)!;
  const twoHands = song ? song.staves.length > 1 && song.instrument === 'piano' : false;
  const [hands, setHands] = useState<'R' | 'L' | 'both'>('both');
  const [mode, setMode] = useState<'wait' | 'tempo'>('wait');
  const [tempo, setTempo] = useState(song?.tempo ?? 80);
  const [fingering, setFingering] = useState<'all' | 'first' | 'none'>('all');
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const started = useRef(Date.now());
  const score = useMemo(() => (song ? autoFinger(songToScore(song)) : null), [song]);
  const ctx: LessonCtx | null = useMemo(
    () =>
      profile && track
        ? { track, instrument: track.instrument, settings: profile.settings, device, items: profile.tracks[trackId]?.items ?? {}, rng: makeRng(), isCheckpoint: false, progress: 0.5 }
        : null,
    [profile, track, device, trackId],
  );
  if (!song || !score || !ctx) {
    return (
      <div className="page">
        <p>Song not found.</p>
        <Link className="btn" to="/songs">
          Back
        </Link>
      </div>
    );
  }
  const playing = run > 0 && !result;
  return (
    <div className="lesson-shell song-shell" style={{ ['--track-accent' as string]: track.accent }}>
      <header className="lesson-top">
        <button className="btn btn-icon btn-ghost" onClick={() => (playing ? setRun(0) : navigate(-1))} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="grow song-head">
          <strong className="display">{song.title}</strong>
          <span className="faint">
            {song.composer}
            {song.year ? ` · ${song.year}` : ''}
          </span>
        </div>
        <InputChip instrument={song.instrument} />
      </header>
      <main className="lesson-main">
        {playing ? (
          <div className="lesson-step">
            <PlayAlong
              key={run}
              ctx={ctx}
              score={score}
              mode={mode}
              tempo={tempo}
              hands={twoHands ? hands : undefined}
              fingering={fingering}
              title={song.title}
              prompt={song.blurb}
              onDone={r => {
                setResult(r);
                const acc = r.total ? r.correct / r.total : 1;
                record({ trackId, lessonId: `song:${song.id}`, lessonKind: 'song', accuracy: acc, stars: 0, passed: acc >= 0.7, ms: Date.now() - started.current, notes: r.notes, xp: Math.round(6 + acc * 10), items: r.items, practiceOnly: true });
              }}
            />
          </div>
        ) : (
          <div className="song-setup">
            <div className="song-setup-card card">
              <Music className="gold-text" size={28} />
              <h1 className="display">{song.title}</h1>
              {song.blurb && <p className="dim">{song.blurb}</p>}
              {result && (
                <div className="song-result">
                  <strong className="display">{Math.round((result.correct / Math.max(1, result.total)) * 100)}%</strong>
                  <span className="faint">
                    {result.correct}/{result.total} clean · +{Math.round(6 + (result.correct / Math.max(1, result.total)) * 10)} XP
                  </span>
                </div>
              )}
              {twoHands && (
                <div className="set-row">
                  <span>Hands</span>
                  <Segmented value={hands} onChange={setHands} options={[{ value: 'R', label: 'Right' }, { value: 'L', label: 'Left' }, { value: 'both', label: 'Both' }]} />
                </div>
              )}
              <div className="set-row">
                <span>Mode</span>
                <Segmented value={mode} onChange={setMode} options={[{ value: 'wait', label: 'Wait for me' }, { value: 'tempo', label: 'In time' }]} />
              </div>
              {mode === 'tempo' && (
                <label className="slider-row">
                  <span>
                    Tempo <strong className="tabular">{tempo} bpm</strong>
                  </span>
                  <input type="range" min={30} max={Math.max(160, song.tempo)} step={2} value={tempo} onChange={e => setTempo(Number(e.target.value))} />
                </label>
              )}
              <div className="set-row">
                <span>Fingering</span>
                <Segmented value={fingering} onChange={setFingering} options={[{ value: 'all', label: 'All' }, { value: 'first', label: 'Key moments' }, { value: 'none', label: 'Off' }]} />
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  started.current = Date.now();
                  setResult(null);
                  setRun(r => r + 1);
                }}
              >
                <Play size={18} /> {result ? 'Play again' : 'Play'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
