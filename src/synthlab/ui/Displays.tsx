/**
 * The pictures on each module: the wave an oscillator makes, the filter carving into the
 * harmonics, the shape of an envelope, the LFO's swing, the FM wiring, and the output
 * scope.
 *
 * Seeing a knob's effect is half of understanding it, so every module draws itself. The
 * drawings are SVG computed from the patch (ui/visuals.ts) and change only when a knob
 * does. The two moving things (the LFO's sweep line and the scope) run only while sound is
 * playing: the sweep is a CSS transform animation, the scope a canvas redrawn once a frame,
 * and both stop when the sound does.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ALGORITHMS, clampAlgo } from '../dsp/fm';
import { type ParamKey, type Patch, divisionSeconds } from '../dsp/params';
import type { LabSynth } from '../audio/host';
import { DRAW_ROOT_HZ, envelopePoints, filterDb, halfHarmonics, lfoPoints, pathOf, sourceCycle, wavePath } from './visuals';

export const WaveDisplay = memo(function WaveDisplay({ cycle, label }: { cycle: Float32Array; label?: string }) {
  const W = 200;
  const H = 64;
  const d = wavePath(cycle, W, H, 6);
  return (
    <div className="sl-screen" aria-label={label} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="sl-gridline" />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} className="sl-gridline faint" />
        <path d={d} className="sl-trace-glow" />
        <path d={d} className="sl-trace" />
      </svg>
    </div>
  );
});

const F_LO = 40;
const F_HI = 16000;
const fx = (f: number, W: number) => (Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * W;
const DB_TOP = 18;
const DB_BOTTOM = -48;
const dy = (db: number, H: number) => ((DB_TOP - Math.max(DB_BOTTOM, Math.min(DB_TOP, db))) / (DB_TOP - DB_BOTTOM)) * H;

/**
 * The filter at work: the raw sound's harmonics (faint), what's left after the filter
 * (bright), and the filter's curve on top, all against frequency. Turning the cutoff
 * visibly shaves harmonics off.
 */
export const SpectrumDisplay = memo(function SpectrumDisplay({ patch }: { patch: Patch }) {
  const W = 240;
  const H = 84;
  const bars = useMemo(() => halfHarmonics(sourceCycle(patch), 96), [patch]);
  const curve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const f = F_LO * Math.pow(F_HI / F_LO, i / 90);
      pts.push([fx(f, W), dy(filterDb(patch, f), H)]);
    }
    return pathOf(pts);
  }, [patch]);
  const cutoffX = fx(Math.min(F_HI, Math.max(F_LO, patch.filterCutoff)), W);
  const zero = dy(0, H);
  return (
    <div className="sl-screen" role="img" aria-label="Harmonics and the filter's curve">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={0} y1={zero} x2={W} y2={zero} className="sl-gridline" />
        {[100, 1000, 10000].map(f => (
          <line key={f} x1={fx(f, W)} y1={0} x2={fx(f, W)} y2={H} className="sl-gridline faint" />
        ))}
        {Array.from(bars).map((m, k) => {
          if (k === 0 || m < 0.002) return null;
          const f = (DRAW_ROOT_HZ * k) / 2;
          if (f < F_LO || f > F_HI) return null;
          const db = 20 * Math.log10(m);
          const x = fx(f, W);
          const post = db + filterDb(patch, f);
          return (
            <g key={k}>
              <line x1={x} y1={H} x2={x} y2={dy(db, H)} className="sl-bar-pre" />
              <line x1={x} y1={H} x2={x} y2={dy(post, H)} className="sl-bar" />
            </g>
          );
        })}
        {patch.filterOn && (
          <>
            <line x1={cutoffX} y1={0} x2={cutoffX} y2={H} className="sl-cutoff" />
            <path d={curve} className="sl-trace-glow" />
            <path d={curve} className="sl-trace" />
          </>
        )}
      </svg>
      <div className="sl-axis">
        <span>100 Hz</span>
        <span>1 kHz</span>
        <span>10 kHz</span>
      </div>
    </div>
  );
});

/** The harmonics alone, as bars (the additive engine's harmonic filter). */
export const HarmonicBars = memo(function HarmonicBars({ levels, open }: { levels: number[]; open?: number }) {
  const W = 200;
  const H = 56;
  const n = levels.length;
  const bw = W / n;
  return (
    <div className="sl-screen" role="img" aria-label="Harmonic levels">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {levels.map((v, i) => (
          <rect key={i} x={i * bw + bw * 0.2} y={H - v * (H - 4)} width={bw * 0.6} height={v * (H - 4)} className="sl-hbar" rx={1} />
        ))}
        {open !== undefined && <line x1={Math.min(W, open * bw)} y1={0} x2={Math.min(W, open * bw)} y2={H} className="sl-cutoff" />}
      </svg>
    </div>
  );
});

const SEGMENTS: Record<string, number> = {};
for (const k of ['ampAttack', 'fAttack', 'modAttack', 'op1Attack', 'op2Attack', 'op3Attack', 'op4Attack']) SEGMENTS[k] = 0;
for (const k of ['ampDecay', 'fDecay', 'modDecay', 'op1Decay', 'op2Decay', 'op3Decay', 'op4Decay']) SEGMENTS[k] = 1;
for (const k of ['ampSustain', 'fSustain', 'op1Sustain', 'op2Sustain', 'op3Sustain', 'op4Sustain']) SEGMENTS[k] = 2;
for (const k of ['ampRelease', 'fRelease', 'op1Release', 'op2Release', 'op3Release', 'op4Release']) SEGMENTS[k] = 3;

/** An envelope's shape, the stage being adjusted lit up. `ad`: attack–decay only. */
export const EnvelopeDisplay = memo(function EnvelopeDisplay({ a, d, s, r, focus, ad, small }: { a: number; d: number; s: number; r: number; focus?: ParamKey | null; ad?: boolean; small?: boolean }) {
  const W = 220;
  const H = small ? 44 : 64;
  const pad = 5;
  const { pts, marks } = useMemo(() => envelopePoints(a, ad ? d : d, ad ? 0 : s, ad ? d : r), [a, d, s, r, ad]);
  const scaled = pts.map(([x, y]) => [x * W, H - pad - y * (H - 2 * pad)] as [number, number]);
  const line = pathOf(scaled);
  const fill = `${line}L${W},${H}L0,${H}Z`;
  const seg = focus != null && focus in SEGMENTS ? SEGMENTS[focus] : -1;
  const bounds = [0, ...marks];
  const names = ad ? ['A', 'D', '', ''] : ['A', 'D', 'S', 'R'];
  return (
    <div className={`sl-screen sl-env ${small ? 'small' : ''}`} role="img" aria-label="Envelope shape">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {seg >= 0 && <rect x={bounds[seg] * W} y={0} width={(bounds[seg + 1] - bounds[seg]) * W} height={H} className="sl-env-focus" />}
        {marks.slice(0, 3).map((m, i) => (
          <line key={i} x1={m * W} y1={0} x2={m * W} y2={H} className="sl-gridline faint" />
        ))}
        <path d={fill} className="sl-env-fill" />
        <path d={line} className="sl-trace-glow" />
        <path d={line} className="sl-trace" />
      </svg>
      {!small && (
        <div className="sl-env-names">
          {names.map((n, i) => (
            <span key={i} style={{ left: `${((bounds[i] + bounds[i + 1]) / 2) * 100}%` }} className={seg === i ? 'on' : ''}>
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

/** The LFO's shape; while sound plays, a line sweeps across at the LFO's speed. */
export const LfoDisplay = memo(function LfoDisplay({ patch, active }: { patch: Patch; active: boolean }) {
  const W = 200;
  const H = 56;
  const d = useMemo(() => pathOf(lfoPoints(patch).map(([x, y]) => [x * W, H / 2 - y * (H / 2 - 6)] as [number, number])), [patch.lfoShape]);
  const rate = patch.lfoSync ? 1 / divisionSeconds(patch.lfoDiv) : patch.lfoRate;
  // two cycles are drawn, so the line crosses them in two periods
  const dur = Math.min(40, 2 / Math.max(0.05, rate));
  return (
    <div className="sl-screen sl-lfo" role="img" aria-label="LFO shape">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="sl-gridline" />
        <path d={d} className="sl-trace-glow" />
        <path d={d} className="sl-trace" />
      </svg>
      {active && <div className="sl-sweep" style={{ animationDuration: `${dur}s` }} />}
      <span className="sl-screen-tag tabular">{patch.lfoSync ? patch.lfoDiv : `${rate.toFixed(rate < 1 ? 2 : 1)} Hz`}</span>
    </div>
  );
});

/** Where each operator sits in an algorithm's drawing: [column, row up from the carriers]. */
const ALGO_LAYOUT: Record<number, Record<number, [number, number]>> = {
  0: { 1: [1, 0], 2: [1, 1] },
  1: { 1: [1, 0], 2: [1, 1], 3: [1, 2] },
  2: { 1: [1, 0], 2: [1, 1], 3: [1, 2], 4: [1, 3] },
  3: { 1: [0.5, 0], 2: [0.5, 1], 3: [1.5, 0], 4: [1.5, 1] },
  4: { 1: [1, 0], 2: [0.5, 1], 3: [1.5, 1] },
  5: { 1: [0.2, 0], 2: [1, 0], 3: [1.8, 0], 4: [1, 1] },
  6: { 1: [0.2, 0], 2: [0.2, 1], 3: [1, 0], 4: [1.8, 0] },
  7: { 1: [-0.1, 0], 2: [0.63, 0], 3: [1.37, 0], 4: [2.1, 0] },
};

/** The FM wiring: modulators above, carriers on the line to the output. */
export const AlgoDiagram = memo(function AlgoDiagram({ algo, feedback, levels, small }: { algo: number; feedback: number; levels: number[]; small?: boolean }) {
  const a = ALGORITHMS[clampAlgo(algo)];
  const lay = ALGO_LAYOUT[clampAlgo(algo)];
  const W = 160;
  const H = small ? 70 : 96;
  const bw = 24;
  const bh = 16;
  const rows = Math.max(...Object.values(lay).map(p => p[1])) + 1;
  const rowH = (H - 22) / Math.max(rows, 2);
  const pos = (op: number) => {
    const [c, r] = lay[op];
    return { x: 22 + c * 52, y: H - 18 - r * rowH - bh };
  };
  return (
    <div className="sl-screen sl-algo" role="img" aria-label={`Algorithm ${a.name}`}>
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={10} y1={H - 6} x2={W - 10} y2={H - 6} className="sl-algo-bus" />
        {a.carriers.map(c => {
          const p = pos(c);
          return <line key={`o${c}`} x1={p.x + bw / 2} y1={p.y + bh} x2={p.x + bw / 2} y2={H - 6} className="sl-algo-out" />;
        })}
        {a.links.map(([from, to]) => {
          const p = pos(from);
          const q = pos(to);
          return <line key={`${from}-${to}`} x1={p.x + bw / 2} y1={p.y + bh} x2={q.x + bw / 2} y2={q.y} className="sl-algo-link" style={{ opacity: 0.35 + 0.65 * Math.min(1, levels[from - 1] * 1.5) }} />;
        })}
        {feedback > 0 && (() => {
          const p = pos(a.feedback);
          return <path d={`M${p.x + bw},${p.y + bh * 0.7} q10,0 10,-${bh * 0.6} q0,-${bh * 0.5} -10,-${bh * 0.5}`} className="sl-algo-fb" style={{ opacity: 0.4 + 0.6 * feedback }} />;
        })()}
        {a.used.map(op => {
          const p = pos(op);
          const carrier = a.carriers.includes(op);
          return (
            <g key={op}>
              <rect x={p.x} y={p.y} width={bw} height={bh} rx={4} className={carrier ? 'sl-op carrier' : 'sl-op'} style={{ opacity: 0.45 + 0.55 * Math.min(1, levels[op - 1] * 1.4) }} />
              <text x={p.x + bw / 2} y={p.y + bh / 2 + 4} textAnchor="middle" className="sl-op-num">
                {op}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

/**
 * Drawbars: sixteen harmonic levels. Drag across them to draw a spectrum; every bar under
 * the finger is set to the finger's height.
 */
export const Drawbars = memo(function Drawbars({
  keys,
  patch,
  onSet,
  color,
  ghost,
  fresh,
}: {
  keys: ParamKey[];
  patch: Patch;
  onSet: (k: ParamKey, v: number) => void;
  color: string;
  ghost?: Patch | null;
  fresh?: ReadonlySet<ParamKey>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const setAt = (e: ReactPointerEvent) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const i = Math.min(keys.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * keys.length)));
    const v = Math.round(Math.min(1, Math.max(0, 1 - (e.clientY - r.top - 4) / (r.height - 22))) * 100) / 100;
    const from = last.current ?? i;
    for (let j = Math.min(from, i); j <= Math.max(from, i); j++) onSet(keys[j], v);
    last.current = i;
  };
  return (
    <div
      ref={box}
      className="sl-drawbars"
      style={{ ['--c' as string]: color }}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = null;
        setAt(e);
      }}
      onPointerMove={e => {
        if (e.buttons || e.pointerType === 'touch') {
          if (last.current !== null) setAt(e);
        }
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
      role="group"
      aria-label="Harmonic levels"
    >
      {keys.map(k => {
        const v = patch[k] as number;
        const g = ghost ? (ghost[k] as number) : null;
        return (
          <div key={k} className={`sl-drawbar ${fresh?.has(k) ? 'is-new' : ''}`} data-key={k}>
            <div className="sl-drawbar-track">
              <div className="sl-drawbar-fill" style={{ transform: `scaleY(${v})` }} />
              {g !== null && g !== v && <div className="sl-drawbar-ghost" style={{ bottom: `${g * 100}%` }} />}
            </div>
            <input
              type="range"
              className="sr-only"
              min={0}
              max={1}
              step={0.01}
              value={v}
              aria-label={`Harmonic ${k.slice(1)}`}
              onChange={e => onSet(k, Number(e.target.value))}
            />
            <span className="sl-drawbar-num">{k.slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
});

/** The output, as an oscilloscope (drawn only while something sounds). */
export function Scope({ synth, active }: { synth: LabSynth; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth || 200;
    const H = c.clientHeight || 56;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    g.scale(dpr, dpr);
    const color = getComputedStyle(c).getPropertyValue('--c').trim() || '#f4c97a';
    const flat = () => {
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.moveTo(0, H / 2);
      g.lineTo(W, H / 2);
      g.stroke();
    };
    flat();
    if (!active) return;
    const an = synth.analyser;
    if (!an) return;
    const buf = new Float32Array(an.fftSize);
    let raf = 0;
    const draw = () => {
      an.getFloatTimeDomainData(buf);
      // trigger on a rising zero crossing so the picture stands still
      let start = 0;
      for (let i = 1; i < buf.length / 2; i++) {
        if (buf[i - 1] < 0 && buf[i] >= 0) {
          start = i;
          break;
        }
      }
      const span = Math.min(buf.length - start, 900);
      let peak = 0.05;
      for (let i = start; i < start + span; i++) peak = Math.max(peak, Math.abs(buf[i]));
      g.clearRect(0, 0, W, H);
      g.lineWidth = 1.6;
      g.strokeStyle = color;
      g.beginPath();
      for (let i = 0; i < span; i++) {
        const x = (i / (span - 1)) * W;
        const y = H / 2 - (buf[start + i] / peak) * (H / 2 - 4);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      flat();
    };
  }, [active, synth]);
  return <canvas ref={canvas} className="sl-scope" aria-hidden />;
}
