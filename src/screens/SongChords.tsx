import { Grid2x2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { prefsOf } from '../engine/context';
import type { InstrumentId } from '../music/instruments';
import { chordName } from '../music/chords';
import { useProfile } from '../state/store';
import { ChordCell } from '../instruments/ChordCell';
import { chordViews, tryChord } from '../music/chordViews';
import './chordchart.css';

/** The chords a song uses, drawn for the song's instrument, with a link to the full chord chart. */
export function SongChords({ symbols, instrument }: { symbols: string[]; instrument: InstrumentId }) {
  const profile = useProfile();
  const settings = profile?.settings;
  const prefs = useMemo(() => (settings ? prefsOf(settings) : {}), [settings]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const chords = useMemo(
    () =>
      symbols
        .map(s => ({ sym: s, chord: tryChord(s) }))
        .filter((c): c is { sym: string; chord: NonNullable<ReturnType<typeof tryChord>> } => !!c.chord)
        .map(c => ({ ...c, views: chordViews(c.chord, instrument, prefs) })),
    [symbols, instrument, prefs],
  );
  const q = new URLSearchParams({ chords: symbols.join(','), instruments: instrument });
  return (
    <section className="card studio-chords">
      <div className="studio-section-head">
        <h2 className="display">Chords in this song</h2>
        <Link className="btn btn-sm" to={`/chords?${q.toString()}`}>
          <Grid2x2 size={14} /> Chord chart
        </Link>
      </div>
      <div className="song-chord-row">
        {chords.map(c => (
          <div key={c.sym} className="song-chord">
            <strong className="display">{chordName(c.chord)}</strong>
            <ChordCell
              views={c.views}
              index={picks[c.sym] ?? 0}
              onIndex={i => setPicks(p => ({ ...p, [c.sym]: i }))}
              instrument={instrument}
              prefs={prefs}
              mode="fingers"
              size="sm"
              leftHanded={!!settings?.leftHanded}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
