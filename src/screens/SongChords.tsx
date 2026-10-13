import { Grid2x2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { InstrumentId } from '../music/instruments';
import { chordName, parseChordSymbol } from '../music/chords';

/** The chords a song uses, with a link to see them all side by side in the chord chart. */
export function SongChords({ symbols, instrument }: { symbols: string[]; instrument: InstrumentId }) {
  const names = symbols.map(s => {
    try {
      return chordName(parseChordSymbol(s));
    } catch {
      return s;
    }
  });
  const q = new URLSearchParams({ chords: symbols.join(','), instruments: instrument });
  return (
    <section className="card studio-chords">
      <div className="studio-section-head">
        <h2 className="display">Chords in this song</h2>
        <Link className="btn btn-sm" to={`/chords?${q.toString()}`}>
          <Grid2x2 size={14} /> Chord chart
        </Link>
      </div>
      <div className="chip-row">
        {names.map(n => (
          <span key={n} className="chord-chip display">
            {n}
          </span>
        ))}
      </div>
    </section>
  );
}
