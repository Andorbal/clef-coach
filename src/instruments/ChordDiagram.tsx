/**
 * ChordDiagram — the classic vertical chord box used in chord charts.
 *
 * Strings run top to bottom with the lowest-pitched course on the left (guitar
 * E A D G B E, ukulele G C E A, bass E A D G); frets run across. Dots carry a
 * finger number, the chord degree or the note name; roots are highlighted; a
 * barre is drawn as a bar across the strings it covers; "×" / "○" above the nut
 * mark muted and open strings. Up the neck, the starting fret is printed beside
 * the first row. Several dots on one string are allowed (bass arpeggio shapes).
 */
import { useSvgId } from './common';
import './ChordDiagram.css';

export interface DiagramDot {
  /** 1 = highest course */
  string: number;
  fret: number;
  label?: string;
  root?: boolean;
}

export interface ChordDiagramProps {
  /** number of strings */
  strings: number;
  dots: DiagramDot[];
  /** strings played open (fret 0) */
  open?: number[];
  /** strings not played */
  muted?: number[];
  barres?: { fret: number; fromString: number; toString: number; label?: string }[];
  /** first fret row shown (1 = at the nut) */
  baseFret?: number;
  /** frets shown (default 4, or enough for the shape) */
  frets?: number;
  /** names under the strings, string 1 first */
  stringNames?: string[];
  /** label on open strings (e.g. "R" or the note), string number → text */
  openLabels?: Record<number, string>;
  /** roots among the open strings */
  openRoots?: number[];
  /** mirror for left-handed players */
  leftHanded?: boolean;
  width?: number;
  title?: string;
  className?: string;
}

export function ChordDiagram({
  strings: n,
  dots,
  open = [],
  muted = [],
  barres = [],
  baseFret = 1,
  frets,
  stringNames,
  openLabels,
  openRoots = [],
  leftHanded = false,
  width = 150,
  title,
  className,
}: ChordDiagramProps) {
  const id = useSvgId('cd');
  const maxRel = Math.max(0, ...dots.map(d => d.fret - baseFret + 1), ...barres.map(b => b.fret - baseFret + 1));
  const rows = Math.max(frets ?? 4, maxRel);
  const padL = 30;
  const padR = 12;
  const gap = (width - padL - padR) / Math.max(1, n - 1);
  const rowH = Math.min(34, gap * 1.25);
  const top = 30;
  const height = top + rows * rowH + (stringNames ? 26 : 10);
  const r = Math.min(gap, rowH) * 0.36;
  // x for a string: lowest course on the left (string n → column 0)
  const col = (s: number) => (leftHanded ? s - 1 : n - s);
  const xOf = (s: number) => padL + col(s) * gap;
  const yOf = (fret: number) => top + (fret - baseFret + 0.5) * rowH;
  const nut = baseFret <= 1;
  return (
    <svg className={`chord-diagram ${className ?? ''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? 'Chord diagram'}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-dot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* frets */}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`f${i}`} x1={padL} x2={padL + (n - 1) * gap} y1={top + i * rowH} y2={top + i * rowH} className={i === 0 && nut ? 'cd-nut' : 'cd-fret'} />
      ))}
      {/* strings */}
      {Array.from({ length: n }, (_, i) => {
        const s = i + 1;
        return <line key={`s${s}`} x1={xOf(s)} x2={xOf(s)} y1={top} y2={top + rows * rowH} className="cd-string" style={{ strokeWidth: 1 + (n - col(s) - 1 === 0 ? 0 : 0) }} />;
      })}
      {!nut && (
        <text x={padL - Math.min(gap, rowH) * 0.36 - 4} y={top + rowH * 0.5} dy="0.35em" className="cd-basefret">
          {baseFret}
        </text>
      )}
      {/* open / muted markers */}
      {Array.from({ length: n }, (_, i) => {
        const s = i + 1;
        const x = xOf(s);
        if (muted.includes(s)) return <text key={`m${s}`} x={x} y={top - 11} dy="0.35em" className="cd-muted">×</text>;
        if (open.includes(s)) {
          const lab = openLabels?.[s];
          return (
            <g key={`o${s}`} className={`cd-open ${openRoots.includes(s) ? 'is-root' : ''}`}>
              <circle cx={x} cy={top - 11} r={Math.min(7, r * 0.75)} />
              {lab && (
                <text x={x} y={top - 11} dy="0.35em" className="cd-open-text">
                  {lab}
                </text>
              )}
            </g>
          );
        }
        return null;
      })}
      {/* barres */}
      {barres.map((b, i) => {
        const x1 = Math.min(xOf(b.fromString), xOf(b.toString));
        const x2 = Math.max(xOf(b.fromString), xOf(b.toString));
        const y = yOf(b.fret);
        return (
          <g key={`b${i}`} className="cd-barre">
            <rect x={x1 - r} y={y - r} width={x2 - x1 + 2 * r} height={2 * r} rx={r} />
            {b.label && (
              <text x={(x1 + x2) / 2} y={y} dy="0.35em" className="cd-dot-text">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
      {/* dots */}
      {dots.map((d, i) => {
        const x = xOf(d.string);
        const y = yOf(d.fret);
        const onBarre = barres.some(b => b.fret === d.fret && d.string >= Math.min(b.fromString, b.toString) && d.string <= Math.max(b.fromString, b.toString));
        if (onBarre && !d.root) return null;
        return (
          <g key={`d${i}`} className={`cd-dot ${d.root ? 'is-root' : ''}`}>
            {d.root ? <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={r * 0.38} /> : <circle cx={x} cy={y} r={r} />}
            <ellipse cx={x} cy={y - r * 0.45} rx={r * 0.62} ry={r * 0.38} fill={`url(#${id}-dot)`} />
            {d.label && (
              <text x={x} y={y} dy="0.36em" className="cd-dot-text" style={{ fontSize: Math.max(9, r * (d.label.length > 1 ? 0.92 : 1.12)) }}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
      {stringNames &&
        Array.from({ length: n }, (_, i) => (
          <text key={`n${i}`} x={xOf(i + 1)} y={top + rows * rowH + 16} className="cd-name">
            {stringNames[i]}
          </text>
        ))}
    </svg>
  );
}

export default ChordDiagram;
