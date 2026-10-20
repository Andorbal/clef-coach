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

/** The violin family's body: two bouts and a waist, upright, with the bridge across it. */
const BOWED_BODY = 'M12 7.6c-3 0-4 1.6-3.5 3.4.3 1.1 1.3 1.7 1.3 2.5s-2.3 1.4-2.3 3.9 2 3.6 4.5 3.6 4.5-1.2 4.5-3.6-2.3-3.1-2.3-3.9 1-1.4 1.3-2.5c.5-1.8-.5-3.4-3.5-3.4z';

/** Violin: the body, neck and scroll, with the bow across it. */
export function ViolinIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d={BOWED_BODY} />
      <path d="M12 7.6V3.2" />
      <circle cx="12" cy="2.4" r="0.9" />
      <path d="M10.6 16.3h2.8" />
      <path d="M3.5 20.5 20.5 5.5" strokeWidth={1.4} />
    </svg>
  );
}

/** Viola: the violin's shape a size up, no bow. */
export function ViolaIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <g transform="translate(12 13) scale(1.08) translate(-12 -13)">
        <path d={BOWED_BODY} />
        <path d="M12 7.6V3.4" />
        <circle cx="12" cy="2.6" r="0.9" />
        <path d="M10.6 16.3h2.8" />
        <path d="M10.3 14.6v2.6M13.7 14.6v2.6" strokeWidth={1.2} />
      </g>
    </svg>
  );
}

/** Cello: a bigger body standing on its endpin. */
export function CelloIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <g transform="translate(12 12.5) scale(1.05 0.95) translate(-12 -12.5)">
        <path d={BOWED_BODY} />
      </g>
      <path d="M12 7.8V2.8" />
      <circle cx="12" cy="2" r="0.8" />
      <path d="M10.6 16h2.8" />
      <path d="M12 21v2" />
    </svg>
  );
}

/** Double bass: sloping shoulders, a long neck and the endpin. */
export function DoubleBassIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M12 8.2c-1.6 0-2.4.9-2.7 2-.3 1.2-1.4 1.6-1.4 3 0 .9.9 1.3.9 1.9s-1.6 1.2-1.6 3.1c0 1.9 2.1 2.8 4.8 2.8s4.8-.9 4.8-2.8-1.6-2.5-1.6-3.1.9-1 .9-1.9c0-1.4-1.1-1.8-1.4-3-.3-1.1-1.1-2-2.7-2z" />
      <path d="M12 8.2V2.6" />
      <path d="M12 21v2" />
      <path d="M10.7 17h2.6" />
    </svg>
  );
}

export function InstrumentIcon({ instrument, size = 24, className }: IconProps & { instrument: InstrumentId }) {
  switch (instrument) {
    case 'violin':
      return <ViolinIcon size={size} className={className} />;
    case 'viola':
      return <ViolaIcon size={size} className={className} />;
    case 'cello':
      return <CelloIcon size={size} className={className} />;
    case 'doublebass':
      return <DoubleBassIcon size={size} className={className} />;
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
  // more instruments than a row of buttons holds on a phone: a menu
  if (ids.length > 5)
    return (
      <select className="set-select instrument-select" value={value} onChange={e => onChange(e.target.value as InstrumentId)} aria-label="Instrument">
        {ids.map(i => (
          <option key={i} value={i}>
            {short ? instrumentDef(i).short : instrumentDef(i).name}
          </option>
        ))}
      </select>
    );
  return (
    <Segmented
      size={size === 'sm' ? 'sm' : undefined}
      value={value}
      onChange={onChange}
      options={ids.map(i => ({ value: i, label: short ? instrumentDef(i).short : instrumentDef(i).name }))}
    />
  );
}
