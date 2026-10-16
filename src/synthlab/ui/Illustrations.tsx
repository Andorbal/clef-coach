/**
 * Pictures for the explanations: the signal path, the four waves, harmonics, the ADSR,
 * filter types, an LFO, FM, additive and wavetable synthesis. Static SVG drawn from the
 * same maths the synth uses.
 */
import { envelopeLevel } from '../dsp/env';
import { filterResponse } from '../dsp/filter';
import type { FilterType, Wave } from '../dsp/params';
import { getTable } from '../dsp/tables';
import { waveHarmonics, waveShape } from '../dsp/waves';
import type { VisualId } from '../course/types';
import { FAMILY_COLOR } from './controls';

const GOLD = FAMILY_COLOR.source;
const TEAL = FAMILY_COLOR.filter;
const CORAL = FAMILY_COLOR.amp;
const VIOLET = FAMILY_COLOR.mod;
const GREEN = '#3fdc9a';

function path(fn: (t: number) => number, x: number, y: number, w: number, h: number, n = 120): string {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d += `${i ? 'L' : 'M'}${(x + t * w).toFixed(1)},${(y + h / 2 - fn(t) * (h / 2)).toFixed(1)}`;
  }
  return d;
}

function Box({ x, y, w, h, color, label, sub }: { x: number; y: number; w: number; h: number; color: string; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={`${color}22`} stroke={color} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 2 : h / 2 + 4)} textAnchor="middle" className="sl-ill-label" fill={color}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" className="sl-ill-sub">
          {sub}
        </text>
      )}
    </g>
  );
}

const Arrow = ({ x1, y1, x2, y2, color = 'rgba(255,255,255,0.5)', dashed }: { x1: number; y1: number; x2: number; y2: number; color?: string; dashed?: boolean }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.6} strokeDasharray={dashed ? '4 3' : undefined} markerEnd="url(#sl-arrow)" />
);

function SignalFlow() {
  return (
    <svg viewBox="0 0 340 150">
      <Box x={6} y={20} w={70} h={44} color={GOLD} label="Oscillator" sub="the raw sound" />
      <Box x={96} y={20} w={66} h={44} color={TEAL} label="Filter" sub="the tone" />
      <Box x={182} y={20} w={66} h={44} color={CORAL} label="Amp" sub="the volume" />
      <Box x={268} y={20} w={66} h={44} color="#ff7eb6" label="Effects" sub="the space" />
      <Arrow x1={76} y1={42} x2={94} y2={42} />
      <Arrow x1={162} y1={42} x2={180} y2={42} />
      <Arrow x1={248} y1={42} x2={266} y2={42} />
      <Box x={96} y={100} w={66} h={36} color={VIOLET} label="Envelopes" />
      <Box x={182} y={100} w={66} h={36} color={GREEN} label="LFO" />
      <Arrow x1={129} y1={100} x2={129} y2={66} color={VIOLET} dashed />
      <Arrow x1={150} y1={100} x2={200} y2={66} color={VIOLET} dashed />
      <Arrow x1={215} y1={100} x2={145} y2={66} color={GREEN} dashed />
      <text x={262} y={112} className="sl-ill-sub">
        → sound
      </text>
      <text x={262} y={126} className="sl-ill-sub">
        ⇢ movement
      </text>
    </svg>
  );
}

function Waveforms() {
  const waves: Wave[] = ['sine', 'triangle', 'saw', 'square'];
  return (
    <svg viewBox="0 0 340 96">
      {waves.map((w, i) => (
        <g key={w}>
          <rect x={4 + i * 84} y={6} width={78} height={58} rx={8} fill="#07090f" stroke="rgba(255,255,255,0.08)" />
          <path d={path(t => waveShape(w, t * 2) / (w === 'square' ? 0.68 : w === 'saw' ? 0.9 : 1) * 0.8, 10 + i * 84, 12, 66, 46)} fill="none" stroke={GOLD} strokeWidth={2} />
          <text x={43 + i * 84} y={84} textAnchor="middle" className="sl-ill-label" fill={GOLD}>
            {w[0].toUpperCase() + w.slice(1)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Harmonics() {
  const rows: [Wave, string][] = [
    ['sine', 'Sine: one'],
    ['saw', 'Saw: every one'],
    ['square', 'Square: odd ones'],
  ];
  return (
    <svg viewBox="0 0 340 120">
      {rows.map(([w, label], r) => {
        const h = waveHarmonics(w, 12);
        const top = Math.max(...h.slice(1));
        return (
          <g key={w}>
            <text x={4} y={24 + r * 38} className="sl-ill-sub">
              {label}
            </text>
            {h.slice(1).map((v, i) => (
              <rect key={i} x={120 + i * 18} y={30 + r * 38 - (v / top) * 26} width={10} height={(v / top) * 26} rx={2} fill={GOLD} opacity={v > 0 ? 0.9 : 0} />
            ))}
          </g>
        );
      })}
      <text x={120} y={116} className="sl-ill-sub">
        1   2   3   4   5   6   7   8   9  10 11 12 → harmonic
      </text>
    </svg>
  );
}

function Adsr() {
  const a = 0.25;
  const d = 0.35;
  const s = 0.55;
  const r = 0.5;
  const hold = 1.2;
  const total = hold + r * 1.3;
  const W = 300;
  const H = 90;
  const fn = (t: number) => envelopeLevel(a, d, s, r, hold, t * total);
  let dd = '';
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    dd += `${i ? 'L' : 'M'}${(20 + t * W).toFixed(1)},${(10 + H - fn(t) * H).toFixed(1)}`;
  }
  const x = (t: number) => 20 + (t / total) * W;
  return (
    <svg viewBox="0 0 340 130">
      <path d={`${dd}L${20 + W},${10 + H}L20,${10 + H}Z`} fill={`${CORAL}22`} />
      <path d={dd} fill="none" stroke={CORAL} strokeWidth={2.4} />
      {[a, a + d * 1.6, hold].map((t, i) => (
        <line key={i} x1={x(t)} y1={6} x2={x(t)} y2={10 + H} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
      ))}
      <text x={x(a / 2)} y={124} textAnchor="middle" className="sl-ill-label" fill={CORAL}>
        A
      </text>
      <text x={x(a + d * 0.8)} y={124} textAnchor="middle" className="sl-ill-label" fill={CORAL}>
        D
      </text>
      <text x={x((a + d * 1.6 + hold) / 2)} y={124} textAnchor="middle" className="sl-ill-label" fill={CORAL}>
        S (a level)
      </text>
      <text x={x(hold + r * 0.6)} y={124} textAnchor="middle" className="sl-ill-label" fill={CORAL}>
        R
      </text>
      <text x={x(0) + 2} y={10} className="sl-ill-sub">
        key down
      </text>
      <text x={x(hold) + 4} y={10} className="sl-ill-sub">
        key up
      </text>
    </svg>
  );
}

function FilterTypes() {
  const types: [FilterType, string][] = [
    ['lowpass', 'Low-pass'],
    ['highpass', 'High-pass'],
    ['bandpass', 'Band-pass'],
    ['notch', 'Notch'],
  ];
  return (
    <svg viewBox="0 0 340 96">
      {types.map(([t, label], i) => {
        const fn = (u: number) => {
          const f = 40 * Math.pow(400, u);
          const db = 20 * Math.log10(Math.max(1e-4, filterResponse(t, '12', 800, 0.35, f)));
          return Math.max(-1, Math.min(1, (db + 18) / 24));
        };
        return (
          <g key={t}>
            <rect x={4 + i * 84} y={6} width={78} height={58} rx={8} fill="#07090f" stroke="rgba(255,255,255,0.08)" />
            <path d={path(fn, 8 + i * 84, 12, 70, 46)} fill="none" stroke={TEAL} strokeWidth={2} />
            <text x={43 + i * 84} y={84} textAnchor="middle" className="sl-ill-label" fill={TEAL}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Lfo() {
  return (
    <svg viewBox="0 0 340 110">
      <rect x={4} y={10} width={200} height={70} rx={10} fill="#07090f" stroke="rgba(255,255,255,0.08)" />
      <path d={path(t => Math.sin(t * Math.PI * 4) * 0.8, 10, 14, 188, 62)} fill="none" stroke={GREEN} strokeWidth={2.2} />
      <text x={104} y={100} textAnchor="middle" className="sl-ill-sub">
        LFO: a slow wave, 0.1 to 20 times a second
      </text>
      <Arrow x1={208} y1={45} x2={248} y2={45} color={GREEN} dashed />
      <circle cx={290} cy={45} r={26} fill="#232842" stroke="rgba(255,255,255,0.15)" />
      <path d="M 272 63 A 26 26 0 1 1 308 63" fill="none" stroke={TEAL} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <line x1={290} y1={45} x2={302} y2={27} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <text x={290} y={100} textAnchor="middle" className="sl-ill-label" fill={TEAL}>
        moves a knob
      </text>
    </svg>
  );
}

function Fm() {
  return (
    <svg viewBox="0 0 340 120">
      <Box x={10} y={8} w={84} h={40} color={VIOLET} label="Modulator" sub="op 2" />
      <Box x={10} y={70} w={84} h={40} color={GOLD} label="Carrier" sub="op 1 (heard)" />
      <Arrow x1={52} y1={48} x2={52} y2={68} color={VIOLET} />
      <Arrow x1={96} y1={90} x2={130} y2={90} />
      <rect x={136} y={8} width={196} height={102} rx={10} fill="#07090f" stroke="rgba(255,255,255,0.08)" />
      {[0.15, 0.5, 1, 0.5, 0.25, 0.15, 0.08].map((v, i) => (
        <rect key={i} x={150 + i * 26} y={98 - v * 80} width={10} height={v * 80} rx={2} fill={GOLD} opacity={i === 2 ? 1 : 0.75} />
      ))}
      <text x={234} y={24} textAnchor="middle" className="sl-ill-sub">
        new partials around the note
      </text>
    </svg>
  );
}

function Additive() {
  const parts = [1, 0.5, 0.33, 0.25];
  return (
    <svg viewBox="0 0 340 120">
      {parts.map((a, i) => (
        <path key={i} d={path(t => a * Math.sin(2 * Math.PI * (i + 1) * t * 2) * 0.9, 6, 6 + i * 26, 120, 24)} fill="none" stroke={GOLD} strokeWidth={1.6} opacity={0.85} />
      ))}
      <text x={136} y={62} className="sl-ill-label" fill={GOLD}>
        + + + =
      </text>
      <path
        d={path(t => {
          let s = 0;
          for (let h = 1; h <= 12; h++) s += Math.sin(2 * Math.PI * h * t * 2) / h;
          return s * 0.55;
        }, 190, 20, 144, 80)}
        fill="none"
        stroke={GOLD}
        strokeWidth={2.2}
      />
      <text x={262} y={116} textAnchor="middle" className="sl-ill-sub">
        sines add up to a saw
      </text>
    </svg>
  );
}

function Wavetable() {
  const t = getTable('basic');
  const frames = [0, 3, 6, 9, 12, 15];
  return (
    <svg viewBox="0 0 340 130">
      {frames.map((f, i) => {
        const data = t.data[0][f];
        const ox = 20 + i * 26;
        const oy = 18 + i * 10;
        let d = '';
        for (let k = 0; k <= 64; k++) {
          const v = data[Math.floor((k / 64) * (data.length - 2))];
          d += `${k ? 'L' : 'M'}${(ox + (k / 64) * 150).toFixed(1)},${(oy + 26 - v * 22).toFixed(1)}`;
        }
        return <path key={f} d={d} fill="none" stroke={GOLD} strokeWidth={i === 3 ? 2.6 : 1.4} opacity={i === 3 ? 1 : 0.45} />;
      })}
      <text x={300} y={50} textAnchor="middle" className="sl-ill-label" fill={GOLD}>
        position
      </text>
      <Arrow x1={276} y1={60} x2={318} y2={96} color={GOLD} />
      <text x={20} y={126} className="sl-ill-sub">
        sine → triangle → saw → square, one table
      </text>
    </svg>
  );
}

export function Illustration({ id }: { id: VisualId }) {
  const body = (() => {
    switch (id) {
      case 'signal-flow':
        return <SignalFlow />;
      case 'waveforms':
        return <Waveforms />;
      case 'harmonics':
        return <Harmonics />;
      case 'adsr':
        return <Adsr />;
      case 'filter-types':
        return <FilterTypes />;
      case 'lfo':
        return <Lfo />;
      case 'fm':
        return <Fm />;
      case 'additive':
        return <Additive />;
      case 'wavetable':
        return <Wavetable />;
      default:
        return null;
    }
  })();
  if (!body) return null;
  return (
    <figure className="sl-ill">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <marker id="sl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.6)" />
          </marker>
        </defs>
      </svg>
      {body}
    </figure>
  );
}
