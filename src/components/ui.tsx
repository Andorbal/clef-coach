import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId } from 'react';
import './ui.css';

export function ProgressRing({ value, size = 64, stroke = 6, color = 'var(--gold)', track = 'rgba(255,255,255,0.08)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = useId().replace(/:/g, '');
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`rg${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="1" />
            <stop offset="1" stopColor={color} stopOpacity="0.65" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#rg${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      {children && <div className="ring-center">{children}</div>}
    </div>
  );
}

export function Stars({ value, size = 18, animate = false }: { value: number; size?: number; animate?: boolean }) {
  return (
    <span className="stars" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map(i => (
        <motion.svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          initial={animate ? { scale: 0, rotate: -30 } : false}
          animate={animate ? { scale: 1, rotate: 0 } : undefined}
          transition={{ delay: animate ? 0.35 + i * 0.22 : 0, type: 'spring', stiffness: 380, damping: 14 }}
          className={i < value ? 'on' : ''}
        >
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
        </motion.svg>
      ))}
    </span>
  );
}

export function Avatar({ name, hue, size = 40 }: { name: string; hue: number; size?: number }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `radial-gradient(120% 120% at 30% 20%, hsl(${hue} 90% 72%), hsl(${(hue + 40) % 360} 70% 42%))`,
      }}
    >
      {initial}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={`modal card ${wide ? 'wide' : ''}`}
            role="dialog"
            aria-modal
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-head">
              {title && <h2 className="display modal-title">{title}</h2>}
              <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode }) {
  return (
    <label className="toggle-row">
      <span className="toggle-text">
        <span>{label}</span>
        {sub && <span className="faint toggle-sub">{sub}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' }) {
  return (
    <div className={`segmented ${size ?? ''}`} role="radiogroup">
      {options.map(o => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={`seg-${options.map(x => x.value).join('')}`} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe2a8" />
            <stop offset="1" stopColor="#e5a54b" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
        <text x="32" y="47" textAnchor="middle" fontFamily="Bravura" fontSize="44" fill="url(#logo-g)">
          {''}
        </text>
      </svg>
      <span className="logo-word display">
        Clef <em>Coach</em>
      </span>
    </span>
  );
}

/** Golden sparks burst (for celebrations). */
export function Sparks({ count = 26, active }: { count?: number; active: boolean }) {
  if (!active) return null;
  return (
    <div className="sparks" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 90 + Math.random() * 140;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 40, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1.1 + Math.random() * 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 + Math.random() * 0.2 }}
            style={{ background: i % 3 === 0 ? 'var(--good)' : i % 3 === 1 ? 'var(--gold)' : '#fff' }}
          />
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3 className="display">{title}</h3>
      {body && <p className="dim">{body}</p>}
      {action}
    </div>
  );
}
