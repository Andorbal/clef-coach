/**
 * The synth's front panel, built from the module list (ui/controls.ts) for the patch's
 * engine. A lesson passes the controls it has introduced so far (`visible`) and the ones
 * that are new; everything else stays out of sight, so a beginner meets a synth with two
 * knobs on it rather than a wall of eighty. The same panel, with everything showing, is
 * the Synth Lab.
 *
 * Sound flows left to right and top to bottom: sources, mixer, filter, amplifier, then the
 * modulators that move them, voice settings and effects. A strip along the top shows the
 * same path in miniature, lit while sound plays.
 */
import { ArrowRight, Info, Power, Volume2 } from 'lucide-react';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { Modal } from '../../components/ui';
import { ALGORITHMS, clampAlgo } from '../dsp/fm';
import { DIVISIONS, type EnumSpec, type NumSpec, PARAMS, type ParamKey, type Patch, TABLES, type Wave, type LfoShape } from '../dsp/params';
import { CONTROLS, type Family, FAMILY_COLOR, type ModuleDef, modulesFor } from './controls';
import { AlgoDiagram, Drawbars, EnvelopeDisplay, HarmonicBars, LfoDisplay, Scope, SpectrumDisplay, WaveDisplay } from './Displays';
import { formatValue, optionLabel } from './format';
import { Knob, OptionPicker, SelectControl, Stepper, Switch, WaveIcon } from './Knob';
import type { Lab } from './useLab';
import { additiveCycle, additiveLevels, fmCycle, oscCycle, sourceCycle } from './visuals';

const STEPPERS = new Set<ParamKey>(['osc1Octave', 'osc2Octave', 'osc1Semi', 'osc2Semi', 'unison', 'fmAlgo']);
const SELECTS = new Set<ParamKey>(['osc1Table', 'osc2Table', 'lfoDiv', 'delayDiv']);
const SHORT_OPTION: Record<string, string> = { lowpass: 'LP', highpass: 'HP', bandpass: 'BP', notch: 'Notch' };

export interface PanelProps {
  lab: Lab;
  /** Controls shown (null: every control of the engine). */
  visible?: ReadonlySet<ParamKey> | null;
  /** Controls a lesson has just introduced. */
  fresh?: ReadonlySet<ParamKey>;
  /** A target to show as ghost markers (a revealed quiz answer). */
  ghost?: Patch | null;
  /** The control a hint points at. */
  hint?: ParamKey | null;
  /** Hide the flow strip and scope (narrow spaces). */
  bare?: boolean;
}

export function SynthPanel({ lab, visible = null, fresh, ghost, hint = null, bare }: PanelProps) {
  const { patch } = lab;
  const [focus, setFocus] = useState<ParamKey | null>(null);
  const [info, setInfo] = useState<{ key?: ParamKey; module: ModuleDef } | null>(null);
  const modules = useMemo(() => modulesFor(patch.engine), [patch.engine]);
  const shown = useMemo(
    () => modules.map(m => ({ def: m, keys: m.keys.filter(k => !visible || visible.has(k)) })).filter(m => m.keys.length > 0),
    [modules, visible],
  );
  const set = lab.set;
  const onSet = useCallback((k: ParamKey, v: Patch[ParamKey]) => set(k, v as never), [set]);

  return (
    <div className="sl-panel">
      {!bare && <FlowStrip modules={shown.map(m => m.def)} active={lab.active} lab={lab} />}
      <div className="sl-grid">
        {shown.map(({ def, keys }) => (
          <Module
            key={def.id}
            def={def}
            keys={keys}
            patch={patch}
            onSet={onSet}
            fresh={fresh}
            ghost={ghost ?? null}
            hint={hint}
            focus={focus}
            setFocus={setFocus}
            active={lab.active}
            onInfo={(key?: ParamKey) => setInfo({ key, module: def })}
          />
        ))}
      </div>
      <ControlSheet info={info} onClose={() => setInfo(null)} />
    </div>
  );
}

const FLOW_ORDER: Family[] = ['source', 'mixer', 'filter', 'amp', 'fx'];
const FLOW_NAME: Record<Family, string> = { source: 'Source', mixer: 'Mixer', filter: 'Filter', amp: 'Amp', mod: 'Mod', voice: 'Voice', fx: 'Effects' };

function FlowStrip({ modules, active, lab }: { modules: ModuleDef[]; active: boolean; lab: Lab }) {
  const families = new Set(modules.map(m => m.family));
  // the source and amplifier are always in the path, shown or not
  families.add('source');
  families.add('amp');
  const path = FLOW_ORDER.filter(f => families.has(f));
  const mods = modules.filter(m => m.family === 'mod' || m.id === 'lfo');
  return (
    <div className={`sl-flow ${active ? 'active' : ''}`}>
      <div className="sl-flow-path" aria-label="Signal path">
        {path.map((f, i) => (
          <Fragment key={f}>
            {i > 0 && <ArrowRight size={14} className="sl-flow-arrow" />}
            <span className="sl-flow-chip" style={{ ['--c' as string]: FAMILY_COLOR[f] }}>
              {FLOW_NAME[f]}
            </span>
          </Fragment>
        ))}
        <ArrowRight size={14} className="sl-flow-arrow" />
        <span className="sl-flow-out">
          <Volume2 size={16} />
        </span>
        {mods.length > 0 && (
          <span className="sl-flow-mods">
            {mods.map(m => (
              <span key={m.id} className="sl-flow-mod" style={{ ['--c' as string]: m.color }} title={m.moves}>
                {m.title} → {m.moves}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="sl-flow-scope" style={{ ['--c' as string]: 'var(--gold)' }}>
        <Scope synth={lab.synth} active={active} />
      </div>
    </div>
  );
}

interface ModuleProps {
  def: ModuleDef;
  keys: ParamKey[];
  patch: Patch;
  onSet: (k: ParamKey, v: Patch[ParamKey]) => void;
  fresh?: ReadonlySet<ParamKey>;
  ghost: Patch | null;
  hint: ParamKey | null;
  focus: ParamKey | null;
  setFocus: (k: ParamKey | null) => void;
  active: boolean;
  onInfo: (key?: ParamKey) => void;
}

const Module = memo(function Module({ def, keys, patch, onSet, fresh, ghost, hint, focus, setFocus, active, onInfo }: ModuleProps) {
  const color = def.color;
  const off = def.id === 'filter' && !patch.filterOn;
  const showPower = def.id === 'filter' && keys.includes('filterOn');
  const controls = keys.filter(k => k !== 'filterOn' && !/^h\d+$/.test(k));
  const drawbarKeys = keys.filter(k => /^h\d+$/.test(k));
  const hasNew = keys.some(k => fresh?.has(k));
  const hinted = hint !== null && keys.includes(hint);
  const wide = controls.length > 5;
  return (
    <section className={`sl-mod ${off ? 'off' : ''} ${wide ? 'wide' : ''} ${hasNew ? 'has-new' : ''} ${hinted ? 'hinted' : ''}`} style={{ ['--c' as string]: color }} data-module={def.id}>
      <header className="sl-mod-head">
        <span className="sl-mod-dot" />
        <h3 className="sl-mod-title">{def.title}</h3>
        <span className="sl-mod-role">{def.moves ? `→ ${def.moves}` : def.role}</span>
        <button type="button" className="sl-mod-info" onClick={() => onInfo()} aria-label={`About the ${def.title.toLowerCase()}`}>
          <Info size={15} />
        </button>
        {showPower && (
          <button
            type="button"
            role="switch"
            aria-checked={patch.filterOn}
            aria-label="Filter on"
            className={`sl-power ${patch.filterOn ? 'on' : ''} ${ghost && ghost.filterOn !== patch.filterOn ? 'ghost' : ''}`}
            onClick={() => onSet('filterOn', !patch.filterOn)}
          >
            <Power size={14} />
          </button>
        )}
      </header>
      <ModuleDisplay def={def} keys={keys} patch={patch} focus={focus} active={active} />
      {drawbarKeys.length > 0 && <Drawbars keys={drawbarKeys} patch={patch} onSet={(k, v) => onSet(k, v)} color={color} ghost={ghost} fresh={fresh} />}
      {controls.length > 0 && (
        <div className="sl-ctls">
          {controls.map(k => (
            <Control key={k} k={k} patch={patch} onSet={onSet} color={color} isNew={!!fresh?.has(k)} isHint={hint === k} ghost={ghost} onInfo={() => onInfo(k)} onFocus={on => setFocus(on ? k : null)} />
          ))}
        </div>
      )}
    </section>
  );
});

/** The wave a module draws, if it draws one. */
function cycleFor(id: ModuleDef['id'], patch: Patch): Float32Array | null {
  switch (id) {
    case 'osc1':
    case 'wt1':
      return oscCycle(patch, 1);
    case 'osc2':
    case 'wt2':
      return oscCycle(patch, 2);
    case 'mixer':
      return sourceCycle(patch);
    case 'algo':
      return fmCycle(patch);
    case 'harmonics':
      return additiveCycle(patch);
    default:
      return null;
  }
}

function ModuleDisplay({ def, keys, patch, focus, active }: { def: ModuleDef; keys: ParamKey[]; patch: Patch; focus: ParamKey | null; active: boolean }) {
  const any = (...ks: ParamKey[]) => ks.some(k => keys.includes(k));
  const cycle = useMemo(() => cycleFor(def.id, patch), [def.id, patch]);
  switch (def.id) {
    case 'osc1':
    case 'wt1':
      return <WaveDisplay cycle={cycle!} label="Oscillator 1's wave" />;
    case 'osc2':
    case 'wt2':
      return <WaveDisplay cycle={cycle!} label="Oscillator 2's wave" />;
    case 'mixer':
      return <WaveDisplay cycle={cycle!} label="The mixed sound" />;
    case 'filter':
      return <SpectrumDisplay patch={patch} />;
    case 'fenv':
      return <EnvelopeDisplay a={patch.fAttack} d={patch.fDecay} s={patch.fSustain} r={patch.fRelease} focus={focus} />;
    case 'amp':
      return any('ampAttack', 'ampDecay', 'ampSustain', 'ampRelease') ? <EnvelopeDisplay a={patch.ampAttack} d={patch.ampDecay} s={patch.ampSustain} r={patch.ampRelease} focus={focus} /> : null;
    case 'lfo':
      return <LfoDisplay patch={patch} active={active} />;
    case 'modenv':
      return <EnvelopeDisplay a={patch.modAttack} d={patch.modDecay} s={0} r={patch.modDecay} focus={focus} ad />;
    case 'algo':
      return (
        <div className="sl-algo-pair">
          <AlgoDiagram algo={patch.fmAlgo} feedback={patch.fmFeedback} levels={[patch.op1Level, patch.op2Level, patch.op3Level, patch.op4Level]} />
          <WaveDisplay cycle={cycle!} label="The FM sound" />
        </div>
      );
    case 'op1':
    case 'op2':
    case 'op3':
    case 'op4': {
      const n = def.id.slice(2);
      const p = patch as unknown as Record<string, number>;
      return any(`op${n}Attack` as ParamKey, `op${n}Decay` as ParamKey) ? <EnvelopeDisplay a={p[`op${n}Attack`]} d={p[`op${n}Decay`]} s={p[`op${n}Sustain`]} r={p[`op${n}Release`]} focus={focus} small /> : null;
    }
    case 'harmonics':
      return <WaveDisplay cycle={cycle!} label="The sum of the harmonics" />;
    case 'hfilter':
      return <HarmonicBars levels={additiveLevels(patch)} open={patch.addOpen} />;
    default:
      return null;
  }
}

function waveOptions(lfo: boolean) {
  const shapes = lfo ? (['sine', 'triangle', 'saw', 'square', 'random'] as const) : (['sine', 'triangle', 'saw', 'square'] as const);
  return shapes.map(s => ({ value: s, label: optionLabel(s), icon: <WaveIcon shape={s as Wave | LfoShape} lfo={lfo} w={24} h={14} /> }));
}

const Control = memo(function Control({
  k,
  patch,
  onSet,
  color,
  isNew,
  isHint,
  ghost,
  onInfo,
  onFocus,
}: {
  k: ParamKey;
  patch: Patch;
  onSet: (k: ParamKey, v: Patch[ParamKey]) => void;
  color: string;
  isNew: boolean;
  isHint: boolean;
  ghost: Patch | null;
  onInfo: () => void;
  onFocus: (on: boolean) => void;
}) {
  const spec = PARAMS[k];
  const info = CONTROLS[k];
  const value = patch[k];
  const g = ghost && ghost[k] !== value ? ghost[k] : null;
  const common = { k, label: info.label, color, isNew, isHint, onInfo, onFocus };
  if (spec.kind === 'bool') return <Switch {...common} value={value as boolean} onChange={v => onSet(k, v)} ghost={g as boolean | null} />;
  if (spec.kind === 'enum') {
    const e = spec as EnumSpec;
    if (k === 'osc1Wave' || k === 'osc2Wave' || k === 'lfoShape') {
      return <OptionPicker {...common} value={value as string} options={waveOptions(k === 'lfoShape')} onChange={v => onSet(k, v as never)} ghost={g as string | null} iconsOnly />;
    }
    if (SELECTS.has(k)) {
      const opts = (k === 'osc1Table' || k === 'osc2Table' ? TABLES : DIVISIONS).map(v => ({ value: v as string, label: optionLabel(v) }));
      return <SelectControl {...common} value={value as string} options={opts} onChange={v => onSet(k, v as never)} ghost={g as string | null} />;
    }
    return (
      <OptionPicker
        {...common}
        value={value as string}
        options={e.options.map(o => ({ value: o, label: SHORT_OPTION[o] ?? optionLabel(o) }))}
        onChange={v => onSet(k, v as never)}
        ghost={g as string | null}
      />
    );
  }
  const ns = spec as NumSpec;
  if (STEPPERS.has(k)) {
    const display = k === 'fmAlgo' ? ALGORITHMS[clampAlgo(value as number)].name : formatValue(k, value);
    return <Stepper {...common} spec={ns} value={value as number} onChange={v => onSet(k, v)} display={display} ghost={g as number | null} />;
  }
  return <Knob {...common} spec={ns} value={value as number} onChange={v => onSet(k, v)} display={formatValue(k, value)} ghost={g as number | null} />;
});

/** What a control (or a whole module) does, in plain words, and what other synths call it. */
function ControlSheet({ info, onClose }: { info: { key?: ParamKey; module: ModuleDef } | null; onClose: () => void }) {
  const c = info?.key ? CONTROLS[info.key] : null;
  return (
    <Modal open={!!info} onClose={onClose} title={info ? (c ? c.label : info.module.title) : ''}>
      {info && (
        <div className="sl-sheet" style={{ ['--c' as string]: info.module.color }}>
          <div className="eyebrow">{c ? info.module.title : info.module.role}</div>
          <p className="sl-sheet-about">{c ? c.about : info.module.about}</p>
          {c?.tip && (
            <div className="sl-sheet-tip">
              <strong>Try this</strong>
              <span>{c.tip}</span>
            </div>
          )}
          {c?.aka && (
            <div className="sl-sheet-aka">
              <span className="faint">On other synths</span>
              <div>
                {c.aka.map(a => (
                  <span key={a} className="pill">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {c && <p className="faint sl-sheet-module">Part of the {info.module.title.toLowerCase()}: {info.module.role.toLowerCase()}.</p>}
        </div>
      )}
    </Modal>
  );
}
