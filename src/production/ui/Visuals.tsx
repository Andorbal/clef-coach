/**
 * Pictures for explain steps: the signal flow of a channel, the decibel ladder, the stereo
 * field, the spectrum and who lives where, EQ shapes, a compressor's curve, a reverb's
 * parts, gain staging and loudness targets. Static SVG, drawn once.
 */
import type { ReactNode } from 'react';
import type { VisualId } from '../course/types';

const W = 320;

function Frame({ children, h = 150, label }: { children: ReactNode; h?: number; label: string }) {
  return (
    <svg className="pr-visual" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const box = (x: number, y: number, w: number, label: string, c = '#9fa8da') => (
  <g key={label + x + y}>
    <rect x={x} y={y} width={w} height={26} rx={7} fill={`${c}22`} stroke={c} />
    <text x={x + w / 2} y={y + 17} textAnchor="middle" className="pr-vis-t">
      {label}
    </text>
  </g>
);

const arrow = (x1: number, y1: number, x2: number, y2: number) => <line key={`${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} className="pr-vis-arrow" markerEnd="url(#pr-arrow)" />;

const Defs = () => (
  <defs>
    <marker id="pr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#a4aac4" />
    </marker>
  </defs>
);

function SignalFlow() {
  const xs = [4, 56, 108, 160, 212, 264];
  const names = ['Trim', 'EQ', 'Comp', 'Fader', 'Pan', 'Bus'];
  return (
    <Frame label="A channel's signal flow: trim, EQ, compressor, fader, pan, to the mix bus; sends to the reverb and delay" h={130}>
      <Defs />
      {names.map((n, i) => box(xs[i], 20, 48, n, i === 5 ? '#f4c97a' : '#81c784'))}
      {xs.slice(0, -1).map((x, i) => arrow(x + 48, 33, xs[i + 1] - 2, 33))}
      {box(150, 90, 70, 'Reverb', '#ba68c8')}
      {box(230, 90, 70, 'Delay', '#ba68c8')}
      {arrow(184, 46, 184, 88)}
      {arrow(196, 46, 262, 88)}
      {arrow(220, 98, 286, 48)}
      <text x={6} y={110} className="pr-vis-s">
        Sends tap the signal after the fader
      </text>
    </Frame>
  );
}

function Decibels() {
  const rows: [string, string][] = [
    ['+10 dB', 'about twice as loud'],
    ['+6 dB', 'clearly louder'],
    ['+3 dB', 'a little louder'],
    ['+1 dB', 'only just noticeable'],
    ['0 dB', 'no change'],
    ['−6 dB', 'clearly quieter'],
  ];
  return (
    <Frame label="How big decibel changes sound" h={160}>
      {rows.map(([a, b], i) => (
        <g key={a}>
          <rect x={10} y={8 + i * 25} width={Math.max(8, 150 - i * 22)} height={18} rx={5} fill="#64b5f633" stroke="#64b5f6" />
          <text x={16} y={21 + i * 25} className="pr-vis-t" textAnchor="start">
            {a}
          </text>
          <text x={170} y={21 + i * 25} className="pr-vis-s">
            {b}
          </text>
        </g>
      ))}
    </Frame>
  );
}

function Stereo() {
  const items: [string, number, string][] = [
    ['Kick', 0, '#ff8a65'],
    ['Bass', 0, '#64b5f6'],
    ['Lead', 0, '#f06292'],
    ['Guitar', 0.6, '#aed581'],
    ['Piano', -0.45, '#81c784'],
    ['Hats', 0.3, '#ffd54f'],
  ];
  const cx = W / 2;
  return (
    <Frame label="The stereo field: the low end and the lead in the middle, other parts to the sides" h={150}>
      <path d={`M20,130 A${cx - 20},${cx - 20} 0 0 1 ${W - 20},130`} className="pr-vis-arc" />
      <text x={14} y={146} className="pr-vis-s">
        Left
      </text>
      <text x={cx} y={146} textAnchor="middle" className="pr-vis-s">
        Centre
      </text>
      <text x={W - 14} y={146} textAnchor="end" className="pr-vis-s">
        Right
      </text>
      {items.map(([n, p, c], i) => {
        const a = (p * Math.PI) / 2;
        const r = 50 + (i % 3) * 26;
        const x = cx + Math.sin(a) * r;
        const y = 130 - Math.cos(a) * r;
        return (
          <g key={n}>
            <circle cx={x} cy={y} r={6} fill={c} />
            <text x={x + 9} y={y + 4} className="pr-vis-s">
              {n}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

const fx = (f: number) => 10 + (Math.log10(f / 20) / 3) * (W - 20);

function Spectrum() {
  const regions: [string, number, number, string][] = [
    ['Sub', 20, 60, '#5c6bc0'],
    ['Bass', 60, 250, '#64b5f6'],
    ['Low mids', 250, 800, '#81c784'],
    ['Mids', 800, 2500, '#ffd54f'],
    ['Presence', 2500, 6000, '#ffb74d'],
    ['Air', 6000, 20000, '#f06292'],
  ];
  const parts: [string, number, number][] = [
    ['Kick', 40, 5000],
    ['Bass', 40, 2000],
    ['Guitar', 80, 6000],
    ['Voice / lead', 100, 10000],
    ['Hi-hats', 3000, 18000],
  ];
  return (
    <Frame label="The spectrum from 20 Hz to 20 kHz, its regions, and where instruments live" h={170}>
      {regions.map(([n, a, b, c]) => (
        <g key={n}>
          <rect x={fx(a)} y={10} width={fx(b) - fx(a)} height={22} fill={`${c}33`} stroke={c} />
          <text x={(fx(a) + fx(b)) / 2} y={25} textAnchor="middle" className="pr-vis-s">
            {n}
          </text>
        </g>
      ))}
      {[100, 1000, 10000].map(f => (
        <text key={f} x={fx(f)} y={46} textAnchor="middle" className="pr-vis-s">
          {f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}
        </text>
      ))}
      {parts.map(([n, a, b], i) => (
        <g key={n}>
          <rect x={fx(a)} y={58 + i * 21} width={fx(b) - fx(a)} height={14} rx={7} fill="#ffffff14" stroke="#ffffff40" />
          <text x={fx(a) + 6} y={69 + i * 21} className="pr-vis-s">
            {n}
          </text>
        </g>
      ))}
    </Frame>
  );
}

function EqCurves() {
  const shapes: [string, string][] = [
    ['High-pass', 'M4,52 C24,52 26,16 40,14 L76,14'],
    ['Low shelf', 'M4,6 L18,6 C30,6 34,26 48,26 L76,26'],
    ['Bell', 'M4,30 L24,30 C32,30 34,6 40,6 C46,6 48,30 56,30 L76,30'],
    ['High shelf', 'M4,30 L30,30 C42,30 46,8 58,8 L76,8'],
  ];
  return (
    <Frame label="EQ shapes: high-pass, low shelf, bell and high shelf" h={90}>
      {shapes.map(([n, d], i) => (
        <g key={n} transform={`translate(${i * 80},10)`}>
          <rect x={0} y={0} width={78} height={58} rx={8} fill="#ffffff08" stroke="#ffffff20" />
          <path d={d} className="pr-vis-curve" />
          <text x={39} y={74} textAnchor="middle" className="pr-vis-s">
            {n}
          </text>
        </g>
      ))}
    </Frame>
  );
}

function Compressor() {
  const s = 120;
  const t = 0.55;
  return (
    <Frame label="A compressor's curve: above the threshold, the output rises more slowly, by the ratio" h={150}>
      <g transform="translate(20,10)">
        <rect x={0} y={0} width={s} height={s} fill="#ffffff06" stroke="#ffffff20" />
        <line x1={0} y1={s} x2={s} y2={0} className="pr-vis-dash" />
        <path d={`M0,${s} L${s * t},${s * (1 - t)} L${s},${s * (1 - t) - s * (1 - t) * 0.35}`} className="pr-vis-curve" />
        <line x1={s * t} y1={0} x2={s * t} y2={s} className="pr-vis-thr" />
        <text x={s * t + 4} y={12} className="pr-vis-s">
          threshold
        </text>
        <text x={s / 2} y={s + 14} textAnchor="middle" className="pr-vis-s">
          level in
        </text>
      </g>
      <text x={160} y={34} className="pr-vis-s">
        Below the threshold: untouched.
      </text>
      <text x={160} y={56} className="pr-vis-s">
        Above it, 4:1 means 4 dB louder
      </text>
      <text x={160} y={72} className="pr-vis-s">
        in comes out 1 dB louder.
      </text>
      <text x={160} y={96} className="pr-vis-s">
        Makeup gain turns the whole
      </text>
      <text x={160} y={112} className="pr-vis-s">
        thing back up.
      </text>
    </Frame>
  );
}

function Reverb() {
  return (
    <Frame label="A reverb over time: the dry sound, the pre-delay, early reflections, then the tail" h={130}>
      <Defs />
      <line x1={10} y1={100} x2={W - 10} y2={100} className="pr-vis-axis" markerEnd="url(#pr-arrow)" />
      <rect x={16} y={20} width={8} height={80} fill="#f06292" />
      <text x={20} y={14} textAnchor="middle" className="pr-vis-s">
        dry
      </text>
      <text x={48} y={116} textAnchor="middle" className="pr-vis-s">
        pre-delay
      </text>
      {[60, 72, 80, 95, 104].map((x, i) => (
        <rect key={x} x={x} y={100 - (52 - i * 7)} width={4} height={52 - i * 7} fill="#ba68c8" />
      ))}
      <text x={84} y={36} textAnchor="middle" className="pr-vis-s">
        early reflections
      </text>
      <path d={`M112,64 C160,74 220,92 ${W - 16},99 L${W - 16},100 L112,100 Z`} fill="#ba68c855" />
      <text x={210} y={70} className="pr-vis-s">
        the tail (size = how long)
      </text>
    </Frame>
  );
}

function GainStaging() {
  const zones: [string, number, number, string][] = [
    ['Noise and hiss', -60, -30, '#64b5f6'],
    ['Room to spare', -30, -18, '#81c784'],
    ['Sweet spot', -18, -6, '#3fdc9a'],
    ['Hot', -6, 0, '#ffb74d'],
  ];
  const y = (db: number) => 10 + ((0 - db) / 60) * 120;
  return (
    <Frame label="Gain staging: peaks between −18 and −6 dBFS going in, never over 0" h={140}>
      {zones.map(([n, a, b, c]) => (
        <g key={n}>
          <rect x={20} y={y(b)} width={26} height={y(a) - y(b)} fill={c} opacity={0.7} />
          <text x={56} y={(y(a) + y(b)) / 2 + 4} className="pr-vis-s">
            {n} ({a} to {b} dBFS)
          </text>
        </g>
      ))}
      <rect x={20} y={2} width={26} height={8} fill="#ff5f78" />
      <text x={56} y={9} className="pr-vis-s">
        Over 0 dBFS: clipped, for good
      </text>
    </Frame>
  );
}

function Loudness() {
  const marks: [number, string][] = [
    [-23, 'Broadcast TV and radio (EBU R128)'],
    [-16, 'Podcasts, Apple Music'],
    [-14, 'Spotify, YouTube, Tidal'],
    [-9, 'A loud modern master'],
  ];
  const x = (l: number) => 20 + ((l + 30) / 26) * (W - 40);
  return (
    <Frame label="Loudness targets in LUFS" h={120}>
      <line x1={20} y1={30} x2={W - 20} y2={30} className="pr-vis-axis" />
      {[-30, -20, -10].map(l => (
        <text key={l} x={x(l)} y={20} textAnchor="middle" className="pr-vis-s">
          {l}
        </text>
      ))}
      {marks.map(([l, n], i) => (
        <g key={n}>
          <circle cx={x(l)} cy={30} r={5} fill="#f4c97a" />
          <line x1={x(l)} y1={35} x2={x(l)} y2={46 + i * 18} className="pr-vis-dash" />
          <text x={x(l) + (l > -12 ? -6 : 6)} y={50 + i * 18} textAnchor={l > -12 ? 'end' : 'start'} className="pr-vis-s">
            {l} LUFS: {n}
          </text>
        </g>
      ))}
    </Frame>
  );
}

export function Visual({ id }: { id: VisualId }) {
  switch (id) {
    case 'signal-flow':
      return <SignalFlow />;
    case 'decibels':
      return <Decibels />;
    case 'stereo':
      return <Stereo />;
    case 'spectrum':
      return <Spectrum />;
    case 'eq-curves':
      return <EqCurves />;
    case 'compressor':
      return <Compressor />;
    case 'reverb':
      return <Reverb />;
    case 'gain-staging':
      return <GainStaging />;
    case 'loudness':
      return <Loudness />;
  }
}
