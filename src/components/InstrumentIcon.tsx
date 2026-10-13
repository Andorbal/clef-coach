import { Guitar, Piano } from 'lucide-react';
import type { InstrumentId } from '../music/instruments';
import { INSTRUMENT_IDS, instrumentDef } from '../music/instruments';
import { useProfile } from '../state/store';
import { instrumentFromId } from '../music/instruments';
import { Segmented } from './ui';

interface IconProps {
  size?: number;
  className?: string;
}

const svgProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/** Ukulele: small figure-eight body, short neck, four pegs. */
export function UkuleleIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M9.6 10.2a3.1 3.1 0 0 0-4.3 4.2 3.6 3.6 0 0 0 4.3 4.3 3.1 3.1 0 0 0 4.2-4.3 3.6 3.6 0 0 0-4.2-4.2z" />
      <path d="M12.4 11.6 19 5" />
      <path d="M18 3.5 20.5 6" />
      <circle cx="9.6" cy="14.4" r="1" />
    </svg>
  );
}

/** Bass guitar: offset body and a long neck. */
export function BassIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M7.5 12.5c-2.5-.3-4.4 1.4-4 3.6.4 2.3 2.7 4.5 5 4.9 2.2.4 3.9-1.5 3.6-4l-.6-1.5" />
      <path d="M9.2 14.8 21 3" />
      <path d="M8.5 17.5l-1.5-1.5" />
      <path d="M19.5 2.5l2 2" />
    </svg>
  );
}

/** Mallet percussion: two mallets over a bar. */
export function MalletsIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="3" y="17" width="18" height="4" rx="1" />
      <path d="M6 13.5 10.5 3.5" />
      <circle cx="5.3" cy="14.6" r="1.8" />
      <path d="M18 13.5 13.5 3.5" />
      <circle cx="18.7" cy="14.6" r="1.8" />
    </svg>
  );
}

export function InstrumentIcon({ instrument, size = 24, className }: IconProps & { instrument: InstrumentId }) {
  switch (instrument) {
    case 'piano':
      return <Piano size={size} className={className} />;
    case 'guitar':
      return <Guitar size={size} className={className} />;
    case 'ukulele':
      return <UkuleleIcon size={size} className={className} />;
    case 'bass':
      return <BassIcon size={size} className={className} />;
    default:
      return <MalletsIcon size={size} className={className} />;
  }
}

/** The instruments this profile plays (from its tracks, in order), falling back to piano. */
export function useMyInstruments(): InstrumentId[] {
  const profile = useProfile();
  const out: InstrumentId[] = [];
  for (const t of profile?.trackOrder ?? []) {
    const i = instrumentFromId(t);
    if (i && !out.includes(i)) out.push(i);
  }
  return out.length ? out : ['piano'];
}

/** Segmented instrument switcher. `only` limits the choices (e.g. fretted instruments). */
export function InstrumentSwitch({
  value,
  onChange,
  only,
  size = 'sm',
  short = true,
}: {
  value: InstrumentId;
  onChange: (i: InstrumentId) => void;
  only?: InstrumentId[];
  size?: 'sm' | 'md';
  short?: boolean;
}) {
  const ids = only ?? INSTRUMENT_IDS;
  return (
    <Segmented
      size={size === 'sm' ? 'sm' : undefined}
      value={value}
      onChange={onChange}
      options={ids.map(i => ({ value: i, label: short ? instrumentDef(i).short : instrumentDef(i).name }))}
    />
  );
}
