/**
 * Choose a sound: built-in, a sound bank's General MIDI instrument for the part, or
 * any instrument in any bank — optionally layered over the built-in sound.
 */
import { findPreset } from '../audio/samples/manager';
import type { MidiOutputInfo } from '../audio/midiOut';
import type { BankRecord } from '../audio/samples/store';
import type { SamplePreset } from '../audio/samples/types';
import type { SoundChoice } from '../perform/sinks';
import './SoundPicker.css';

const enc = (c: SoundChoice | undefined): string => {
  if (!c || c.source === 'builtin') return 'builtin';
  if (c.source === 'midi') return `midi|${c.outputId}`;
  if (c.source === 'gm') return `gm|${c.bankId}`;
  return `bank|${c.bankId}|${c.bank}|${c.program}`;
};

function dec(v: string, layer: boolean): SoundChoice {
  const [kind, id, bank, program] = v.split('|');
  if (kind === 'midi') return { source: 'midi', outputId: id };
  if (kind === 'gm') return { source: 'gm', bankId: id, layer };
  if (kind === 'bank') return { source: 'bank', bankId: id, bank: Number(bank), program: Number(program), layer };
  return { source: 'builtin' };
}

const presetLabel = (p: SamplePreset) => (p.bank === 128 ? `${p.name} (drum kit)` : p.name);

export function SoundPicker({
  value,
  onChange,
  banks,
  presets,
  program,
  drums = false,
  builtinLabel,
  defaultLabel,
  label,
  midiOutputs = [],
}: {
  value: SoundChoice | undefined;
  onChange: (c: SoundChoice | undefined) => void;
  banks: BankRecord[];
  presets: Record<string, SamplePreset[]>;
  /** GM program the part sounds with (to offer each bank's own). */
  program?: number;
  drums?: boolean;
  builtinLabel: string;
  /** When given, an extra first option meaning "whatever the device default is". */
  defaultLabel?: string;
  label: string;
  /** MIDI outputs the part can play through. */
  midiOutputs?: MidiOutputInfo[];
}) {
  const layer = value && (value.source === 'bank' || value.source === 'gm') ? !!value.layer : false;
  const current = value === undefined && defaultLabel ? 'default' : enc(value);
  return (
    <span className="sound-picker">
      <select
        className="set-select mix-sound"
        aria-label={label}
        value={current}
        onChange={e => onChange(e.target.value === 'default' ? undefined : dec(e.target.value, layer))}
      >
        {defaultLabel && <option value="default">{defaultLabel}</option>}
        <option value="builtin">Built-in: {builtinLabel}</option>
        {midiOutputs.length > 0 && (
          <optgroup label="MIDI out">
            {midiOutputs.map(o => (
              <option key={o.id} value={`midi|${o.id}`}>
                MIDI: {o.name}
              </option>
            ))}
          </optgroup>
        )}
        {banks.map(b => {
          const list = presets[b.id];
          if (!list) return <option key={b.id} disabled>{b.name} (opening…)</option>;
          const own = program !== undefined && b.format !== 'sfz' ? findPreset(list, program, drums) : null;
          return (
            <optgroup key={b.id} label={b.name}>
              {own && <option value={`gm|${b.id}`}>{`${b.name}: ${presetLabel(own)}`}</option>}
              {list
                .filter(p => p !== own)
                .map(p => (
                  <option key={`${p.bank}-${p.program}-${p.name}`} value={`bank|${b.id}|${p.bank}|${p.program}`}>
                    {`${b.name}: ${presetLabel(p)}`}
                  </option>
                ))}
            </optgroup>
          );
        })}
      </select>
      {value && (value.source === 'bank' || value.source === 'gm') && (
        <label className="sound-layer" title="Play the built-in sound as well">
          <input type="checkbox" checked={layer} onChange={e => onChange({ ...value, layer: e.target.checked })} /> + built-in
        </label>
      )}
    </span>
  );
}
