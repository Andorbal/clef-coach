import type { TrackDef } from '../curriculum/types';

/** The track's emblem: a clef glyph (Bravura) in a lit, tinted medallion. */
export function TrackBadge({ track, size = 56 }: { track: TrackDef; size?: number }) {
  const glyph =
    track.clef === 'bass' ? '' : track.clef === 'grand' ? null : track.clef === 'fretboard' ? null : track.clef === 'treble8vb' ? '' : '';
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
        <span className="track-badge-glyph" style={{ fontSize: size * (track.clef === 'bass' ? 0.5 : 0.62), marginTop: track.clef === 'bass' ? -size * 0.12 : size * 0.02 }}>
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
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line key={i} x1="4" x2="36" y1={6 + i * 5.6} y2={6 + i * 5.6} stroke="currentColor" strokeOpacity={0.55} strokeWidth={0.6 + (i * 0.25)} />
          ))}
          {[12, 22, 32].map(x => (
            <line key={x} x1={x} x2={x} y1="5" y2="35" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
          ))}
          <circle cx="17" cy="17.2" r="3.4" fill="currentColor" />
          <circle cx="27" cy="28.4" r="3.4" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
