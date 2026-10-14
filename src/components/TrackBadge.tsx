import type { TrackDef } from '../curriculum/types';

/** The track's emblem: a clef glyph (Bravura) in a lit, tinted medallion. */
export function TrackBadge({ track, size = 56 }: { track: TrackDef; size?: number }) {
  const bass = track.clef === 'bass' || track.clef === 'bass8vb';
  const glyph =
    bass ? (track.clef === 'bass8vb' ? '' : '') : track.clef === 'grand' || track.clef === 'fretboard' || track.clef === 'chords' ? null : track.clef === 'treble8vb' ? '' : '';
  const strings = track.instrument === 'ukulele' || track.instrument === 'bass' ? 4 : 6;
  return (
    <span
      className="track-badge"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        ['--accent' as string]: track.accent,
      }}
      aria-hidden
    >
      {glyph && (
        <span className="track-badge-glyph" style={{ fontSize: size * (bass ? 0.5 : 0.62), marginTop: bass ? -size * 0.12 : size * 0.02 }}>
          {glyph}
        </span>
      )}
      {track.clef === 'grand' && (
        <span className="track-badge-glyph grand" style={{ fontSize: size * 0.34 }}>
          <span>{''}</span>
          <span style={{ marginTop: -size * 0.08 }}>{''}</span>
        </span>
      )}
      {track.clef === 'fretboard' && (
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 40 40">
          {Array.from({ length: strings }, (_, i) => (
            <line key={i} x1="4" x2="36" y1={6 + (i * 28) / (strings - 1)} y2={6 + (i * 28) / (strings - 1)} stroke="currentColor" strokeOpacity={0.55} strokeWidth={0.6 + i * (1.25 / (strings - 1)) * (track.instrument === 'bass' ? 1.6 : 1)} />
          ))}
          {[12, 22, 32].map(x => (
            <line key={x} x1={x} x2={x} y1="5" y2="35" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
          ))}
          <circle cx="17" cy="17.2" r="3.4" fill="currentColor" />
          <circle cx="27" cy="28.4" r="3.4" fill="currentColor" />
        </svg>
      )}
      {track.clef === 'chords' && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 40 40">
          {Array.from({ length: strings }, (_, i) => (
            <line key={i} x1={8 + (i * 24) / (strings - 1)} x2={8 + (i * 24) / (strings - 1)} y1="6" y2="35" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1} />
          ))}
          {[6, 13.5, 21, 28.5, 35].map((y, i) => (
            <line key={y} x1="8" x2="32" y1={y} y2={y} stroke="currentColor" strokeOpacity={i === 0 ? 0.9 : 0.35} strokeWidth={i === 0 ? 2.4 : 1} />
          ))}
          <circle cx={8 + 24 / (strings - 1)} cy="17.2" r="3.2" fill="currentColor" />
          <circle cx={8 + (2 * 24) / (strings - 1)} cy="24.8" r="3.2" fill="currentColor" />
          <circle cx={32} cy="9.8" r="3.2" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
