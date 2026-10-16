/**
 * The lab's controls. Knobs look and turn like a real synth's (drag up or right to raise,
 * double-tap to reset, arrow keys for fine steps) because the point is to feel at home on
 * one afterwards; but every control also says what it is and shows its value in plain
 * units, which real synths rarely do.
 *
 * A "ghost" marks where a quiz's target sits once the answer is revealed; "new" marks a
 * control a lesson has just introduced.
 */
import { memo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { type LfoShape, type NumSpec, type Wave, fromNorm, toNorm } from '../dsp/params';
import { lfoValue } from '../dsp/lfo';
import { waveShape } from '../dsp/waves';

interface Common {
  label: string;
  color: string;
  isNew?: boolean;
  /** A hint points here. */
  isHint?: boolean;
  onInfo?: () => void;
  onFocus?: (on: boolean) => void;
  /** Test hook: data-key on the control. */
  k: string;
}

const START = -135;
const SWEEP = 270;

function polar(c: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
}

function arc(c: number, r: number, from: number, to: number): string {
  if (Math.abs(to - from) < 0.01) return '';
  const [x0, y0] = polar(c, r, from);
  const [x1, y1] = polar(c, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} ${sweep} ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

function Label({ label, onInfo, isNew }: { label: string; onInfo?: () => void; isNew?: boolean }) {
  return (
    <>
      {onInfo ? (
        <button type="button" className="sl-ctl-label" onClick={onInfo} title={`What does ${label} do?`}>
          {label}
        </button>
      ) : (
        <span className="sl-ctl-label">{label}</span>
      )}
      {isNew && <span className="sl-new">New</span>}
    </>
  );
}

export const Knob = memo(function Knob({
  k,
  spec,
  value,
  onChange,
  display,
  label,
  color,
  ghost,
  isNew,
  isHint,
  onInfo,
  onFocus,
  size = 54,
}: Common & { spec: NumSpec; value: number; onChange: (v: number) => void; display: string; ghost?: number | null; size?: number }) {
  const norm = toNorm(spec, value);
  const drag = useRef<{ x: number; y: number; n: number } | null>(null);
  const lastTap = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [dragging, setDragging] = useState(false);

  const set = (v: number) => {
    if (v !== valueRef.current) onChange(v);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    if (now - lastTap.current < 320) {
      // double tap: back to the default
      lastTap.current = 0;
      set(spec.def);
      return;
    }
    lastTap.current = now;
    drag.current = { x: e.clientX, y: e.clientY, n: norm };
    setDragging(true);
    onFocus?.(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const fine = e.shiftKey ? 0.2 : 1;
    const delta = ((d.y - e.clientY + (e.clientX - d.x) * 0.6) / 230) * fine;
    set(fromNorm(spec, d.n + delta));
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    onFocus?.(false);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const stepN = spec.step ? Math.max(1 / 400, spec.step / (spec.max - spec.min)) : 1 / 100;
    let n = norm;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') n += e.shiftKey ? stepN * 10 : stepN;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') n -= e.shiftKey ? stepN * 10 : stepN;
    else if (e.key === 'PageUp') n += 0.1;
    else if (e.key === 'PageDown') n -= 0.1;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = 1;
    else return;
    e.preventDefault();
    // stepped controls must move at least one step
    let v = fromNorm(spec, n);
    if (v === value && spec.step) v = Math.min(spec.max, Math.max(spec.min, value + Math.sign(n - norm) * spec.step));
    set(v);
  };

  const S = size;
  const c = S / 2;
  const r = S * 0.42;
  const angle = START + SWEEP * norm;
  const zero = spec.bipolar ? START + SWEEP * toNorm(spec, 0) : START;
  const [px, py] = polar(c, r * 0.6, angle);
  const [qx, qy] = polar(c, r * 0.22, angle);
  const ghostAngle = ghost != null ? START + SWEEP * toNorm(spec, ghost) : null;
  return (
    <div className={`sl-ctl sl-knob ${dragging ? 'dragging' : ''} ${isNew ? 'is-new' : ''} ${isHint ? 'is-hint' : ''}`} style={{ ['--c' as string]: color }} data-key={k}>
      <div
        className="sl-knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        aria-valuetext={display}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={onKeyDown}
        onFocus={() => onFocus?.(true)}
        onBlur={() => onFocus?.(false)}
        onDoubleClick={() => set(spec.def)}
      >
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
          <path d={arc(c, r, START, START + SWEEP)} className="sl-knob-track" />
          <path d={spec.bipolar ? arc(c, r, Math.min(zero, angle), Math.max(zero, angle)) : arc(c, r, START, angle)} className="sl-knob-value" />
          {ghostAngle !== null && <circle cx={polar(c, r, ghostAngle)[0]} cy={polar(c, r, ghostAngle)[1]} r={3.2} className="sl-knob-ghost" />}
          <circle cx={c} cy={c} r={r * 0.72} className="sl-knob-body" />
          <line x1={qx} y1={qy} x2={px} y2={py} className="sl-knob-pointer" />
        </svg>
        {dragging && <span className="sl-knob-bubble">{display}</span>}
      </div>
      <span className="sl-ctl-value tabular">{display}</span>
      <Label label={label} onInfo={onInfo} isNew={isNew} />
    </div>
  );
});

/** Whole steps (octaves, semitones, unison voices): − value + is clearer than a knob for these. */
export const Stepper = memo(function Stepper({
  k,
  spec,
  value,
  onChange,
  display,
  label,
  color,
  ghost,
  isNew,
  isHint,
  onInfo,
}: Common & { spec: NumSpec; value: number; onChange: (v: number) => void; display: string; ghost?: number | null }) {
  const step = spec.step ?? 1;
  return (
    <div className={`sl-ctl sl-stepper ${isNew ? 'is-new' : ''} ${isHint ? 'is-hint' : ''}`} style={{ ['--c' as string]: color }} data-key={k}>
      <div className="sl-stepper-row">
        <button type="button" className="sl-step-btn" aria-label={`${label} down`} disabled={value <= spec.min} onClick={() => onChange(Math.max(spec.min, value - step))}>
          −
        </button>
        <span className={`sl-step-value tabular ${ghost != null && ghost !== value ? 'has-ghost' : ''}`} aria-live="polite">
          {display}
          {ghost != null && ghost !== value && <small className="sl-step-ghost">→ {ghost > 0 && spec.bipolar ? '+' : ''}{ghost}</small>}
        </span>
        <button type="button" className="sl-step-btn" aria-label={`${label} up`} disabled={value >= spec.max} onClick={() => onChange(Math.min(spec.max, value + step))}>
          +
        </button>
      </div>
      <Label label={label} onInfo={onInfo} isNew={isNew} />
    </div>
  );
});

/** Tiny pictures of the wave shapes, for the wave and LFO pickers (an LFO's saw falls, an oscillator's rises). */
export function WaveIcon({ shape, lfo = false, w = 30, h = 16 }: { shape: Wave | LfoShape; lfo?: boolean; w?: number; h?: number }) {
  const pts: string[] = [];
  const n = 48;
  const held = [0.5, -0.6, 0.9, -0.2];
  const gain: Record<string, number> = { square: 0.68, saw: 0.9 };
  for (let i = 0; i <= n; i++) {
    const ph = (i / n) * 2;
    let v: number;
    if (shape === 'random') v = held[Math.min(3, Math.floor(ph * 2))];
    else if (lfo) v = lfoValue(shape, ph);
    else v = waveShape(shape, ph) / (gain[shape] ?? 1);
    pts.push(`${((i / n) * (w - 2) + 1).toFixed(1)},${(h / 2 - v * (h / 2 - 2)).toFixed(1)}`);
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="sl-wave-icon">
      <polyline points={pts.join(' ')} />
    </svg>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** A row of choices (wave shapes, filter types, voice modes). */
export function OptionPicker<T extends string>({
  k,
  value,
  options,
  onChange,
  label,
  color,
  ghost,
  isNew,
  isHint,
  onInfo,
  iconsOnly,
}: Common & { value: T; options: Option<T>[]; onChange: (v: T) => void; ghost?: T | null; iconsOnly?: boolean }) {
  return (
    <div className={`sl-ctl sl-options ${isNew ? 'is-new' : ''} ${isHint ? 'is-hint' : ''} ${iconsOnly ? 'icons' : ''}`} style={{ ['--c' as string]: color }} data-key={k}>
      <div className="sl-options-row" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            aria-label={o.label}
            title={o.label}
            className={`sl-option ${o.value === value ? 'on' : ''} ${ghost === o.value && ghost !== value ? 'ghost' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.icon ?? o.label}
            {o.icon && !iconsOnly && <span className="sl-option-text">{o.label}</span>}
          </button>
        ))}
      </div>
      <Label label={label} onInfo={onInfo} isNew={isNew} />
    </div>
  );
}

/** A native select (long lists: wavetables, note lengths). */
export function SelectControl<T extends string>({
  k,
  value,
  options,
  onChange,
  label,
  color,
  ghost,
  isNew,
  isHint,
  onInfo,
}: Common & { value: T; options: Option<T>[]; onChange: (v: T) => void; ghost?: T | null }) {
  return (
    <div className={`sl-ctl sl-select ${isNew ? 'is-new' : ''} ${isHint ? 'is-hint' : ''}`} style={{ ['--c' as string]: color }} data-key={k}>
      <select className={`sl-select-input ${ghost != null && ghost !== value ? 'has-ghost' : ''}`} value={value} aria-label={label} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
            {ghost === o.value && ghost !== value ? '  ← target' : ''}
          </option>
        ))}
      </select>
      <Label label={label} onInfo={onInfo} isNew={isNew} />
    </div>
  );
}

export function Switch({ k, value, onChange, label, color, ghost, isNew, isHint, onInfo }: Common & { value: boolean; onChange: (v: boolean) => void; ghost?: boolean | null }) {
  return (
    <div className={`sl-ctl sl-switch ${isNew ? 'is-new' : ''} ${isHint ? 'is-hint' : ''}`} style={{ ['--c' as string]: color }} data-key={k}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`sl-switch-btn ${value ? 'on' : ''} ${ghost != null && ghost !== value ? 'ghost' : ''}`}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
      <span className="sl-ctl-value">{value ? 'On' : 'Off'}</span>
      <Label label={label} onInfo={onInfo} isNew={isNew} />
    </div>
  );
}
