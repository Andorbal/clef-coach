/**
 * The mixing console: a strip for each track (trim, high-pass, EQ, compressor, sends, pan,
 * mute and solo, fader and meter), the effect returns and the master (bus compressor,
 * limiter, fader, loudness). A lesson shows only the sections it's teaching.
 *
 * Tapping a strip's EQ or compressor opens it large above the strips, with its curve:
 * the EQ's response and the compressor's transfer curve with the gain reduction.
 *
 * Performance: a strip re-renders only when one of its own settings changes, and meters
 * move by transform from the meter reports, never through React state.
 */
import { Headphones, Pause, Play, VolumeX, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Knob, Switch } from '../../synthlab/ui/Knob';
import { compCurve, eqResponse } from '../dsp/blocks';
import type { MeterSnapshot } from '../dsp/mixer';
import { type Mix, CHANNEL_PARAMS, FX_PARAMS, MASTER_PARAMS, SILENT_DB, gainToDb, specOf } from '../dsp/params';
import type { Track } from '../dsp/stems';
import { faderDb, faderPos, formatValue, labelOf, meterPos } from './format';
import type { ConsoleApi } from './useConsole';
import './production.css';

export interface ConsoleProps {
  api: ConsoleApi;
  /** Settings shown (mix keys). */
  visible: ReadonlySet<string>;
  /** Settings this lesson introduces. */
  fresh?: ReadonlySet<string>;
  /** Where the target sits, once revealed. */
  ghost?: Mix | null;
  /** A hint points at this strip ('master', 'fx' or a channel). */
  highlight?: string | null;
  /** Extra things in the transport bar (the A/B switch). */
  transport?: ReactNode;
  /** Open the first strip's EQ or compressor straight away (lessons); otherwise only when tapped (the Mix Lab). */
  autoOpen?: boolean;
  /** Ear training: the meters and the loudness readout would give the answer away. */
  blind?: boolean;
}

const strip = (id: string, keys: ReadonlySet<string>, section: readonly string[]) => section.some(p => keys.has(`${id}:${p}`));

export function Console({ api, visible, fresh, ghost, highlight, transport, autoOpen = true, blind = false }: ConsoleProps) {
  const showFx = [...visible].some(k => k.startsWith('fx:'));
  const showMaster = [...visible].some(k => k.startsWith('master:'));
  const editable = (id: string) => strip(id, visible, ['hpOn', 'hpFreq', 'eqOn', 'lowGain', 'midGain', 'presGain', 'highGain', 'compOn', 'threshold', 'ratio', 'attack', 'release', 'makeup']);
  const [selected, setSelected] = useState<string | null>(null);
  const [closed, setClosed] = useState(!autoOpen);
  // open the first strip with an EQ or compressor to work on
  const firstEditable = api.channels.find(editable) ?? null;
  const sel = closed ? null : selected && editable(selected) ? selected : firstEditable;
  const select = (id: string) => {
    setSelected(id);
    setClosed(false);
  };
  // every track keeps its strip (its meter is part of the picture), controls or not
  const showStrips = api.tracks;
  const anyChannel = [...visible].some(k => !k.startsWith('master:') && !k.startsWith('fx:'));
  const stripsRef = useRef<HTMLDivElement>(null);
  // a lesson on the master or the effects: bring them into view (they sit at the end, as on a desk)
  useEffect(() => {
    const el = stripsRef.current;
    if (el && !anyChannel && (showFx || showMaster)) el.scrollLeft = el.scrollWidth;
  }, [anyChannel, showFx, showMaster]);
  const mix = api.mix;
  const isFresh = (k: string) => !!fresh?.has(k);
  return (
    <div className={`pr-console ${api.audition ? 'auditioning' : ''} ${blind ? 'blind' : ''}`}>
      <div className="pr-transport">
        <button className={`btn ${api.playing ? '' : 'btn-primary'} pr-play`} onClick={() => (api.playing ? api.stop() : api.play())} disabled={!api.ready} aria-label={api.playing ? 'Stop' : 'Play'}>
          {api.playing ? <Pause size={18} /> : <Play size={18} />} {api.ready ? (api.playing ? 'Stop' : 'Play') : 'Loading…'}
        </button>
        <Playhead api={api} />
        <Loudness api={api} />
        {transport}
      </div>
      {sel && (
        <div className="pr-detail">
          <ChannelEditor key={sel} id={sel} track={api.tracks.find(t => t.id === sel)!} mix={mix} set={api.set} visible={visible} isFresh={isFresh} ghost={ghost} api={api} onClose={autoOpen ? undefined : () => setClosed(true)} />
          {api.channels.filter(editable).length > 1 && (
            <div className="pr-detail-pick" role="tablist" aria-label="Channel">
              {api.tracks.filter(t => editable(t.id)).map(t => (
                <button key={t.id} role="tab" aria-selected={t.id === sel} className={`pr-pick ${t.id === sel ? 'on' : ''}`} style={{ ['--c' as string]: t.colour }} onClick={() => select(t.id)}>
                  {t.short ?? t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="pr-strips" ref={stripsRef}>
        {showStrips.map(t => (
          <Strip key={t.id} track={t} mix={mix} set={api.set} visible={visible} fresh={fresh} ghost={ghost} api={api} hint={highlight === t.id} selected={t.id === sel} onSelect={editable(t.id) ? () => select(t.id) : undefined} />
        ))}
        {showFx && <FxStrip mix={mix} set={api.set} visible={visible} fresh={fresh} ghost={ghost} hint={highlight === 'fx'} />}
        {showMaster && <MasterStrip mix={mix} set={api.set} visible={visible} fresh={fresh} ghost={ghost} api={api} hint={highlight === 'master'} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function Playhead({ api }: { api: ConsoleApi }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      api.onMeters(m => {
        if (bar.current) bar.current.style.transform = `scaleX(${m.position})`;
      }),
    [api.onMeters], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    if (!api.playing && bar.current) bar.current.style.transform = 'scaleX(0)';
  }, [api.playing]);
  return (
    <div className="pr-playhead" aria-hidden>
      <span ref={bar} />
    </div>
  );
}

function Loudness({ api }: { api: ConsoleApi }) {
  const val = useRef<HTMLSpanElement>(null);
  const clip = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      api.onMeters(m => {
        if (val.current) val.current.textContent = Number.isFinite(m.master.shortTerm) ? `${m.master.shortTerm.toFixed(1)}` : '—';
        if (clip.current && m.master.clipped) {
          clip.current.classList.add('on');
          const el = clip.current;
          setTimeout(() => el.classList.remove('on'), 1200);
        }
      }),
    [api.onMeters], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <div className="pr-loud" title="Loudness of the last 3 seconds (LUFS)">
      <span ref={val} className="tabular">—</span>
      <small>LUFS</small>
      <span ref={clip} className="pr-clip" title="The master clipped">
        Clip
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meters and faders
// ---------------------------------------------------------------------------

/** A level meter fed by the meter reports (peak, with a short hold). */
function Meter({ api, read, stereo = false }: { api: ConsoleApi; read: (m: MeterSnapshot) => [number, number]; stereo?: boolean }) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const holdA = useRef<HTMLSpanElement>(null);
  const hold = useRef({ v: 0, t: 0 });
  useEffect(
    () =>
      api.onMeters(m => {
        const [l, r] = read(m);
        const pl = meterPos(gainToDb(l));
        const pr = meterPos(gainToDb(r));
        if (a.current) a.current.style.transform = `scaleY(${pl})`;
        if (b.current) b.current.style.transform = `scaleY(${pr})`;
        const top = Math.max(pl, pr);
        const now = performance.now();
        if (top >= hold.current.v || now - hold.current.t > 1500) hold.current = { v: top, t: now };
        if (holdA.current) holdA.current.style.transform = `translateY(${(1 - hold.current.v) * 100}%)`;
        holdA.current?.classList.toggle('over', hold.current.v >= meterPos(0));
      }),
    [api.onMeters, read], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    if (api.sounding) return;
    for (const el of [a.current, b.current]) if (el) el.style.transform = 'scaleY(0)';
    if (holdA.current) holdA.current.style.transform = 'translateY(100%)';
    hold.current = { v: 0, t: 0 };
  }, [api.sounding]);
  return (
    <div className={`pr-meter ${stereo ? 'stereo' : ''}`} aria-hidden>
      <span className="pr-meter-bar">
        <span ref={a} />
      </span>
      {stereo && (
        <span className="pr-meter-bar">
          <span ref={b} />
        </span>
      )}
      <span className="pr-meter-zero" style={{ bottom: `${meterPos(0) * 100}%` }} />
      <span ref={holdA} className="pr-meter-hold" />
    </div>
  );
}

/** A vertical fader with a desk's law (0 dB about three quarters up). */
const Fader = memo(function Fader({ k, value, onChange, max, color, ghost, label }: { k: string; value: number; onChange: (v: number) => void; max: number; color: string; ghost?: number | null; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; p: number } | null>(null);
  const lastTap = useRef(0);
  // the value last sent: the console commits React state once a frame, and key repeats come faster
  const latest = useRef(value);
  const lastProp = useRef(value);
  if (value !== lastProp.current) {
    lastProp.current = value;
    latest.current = value;
  }
  const emit = (v: number) => {
    if (v === latest.current) return;
    latest.current = v;
    onChange(v);
  };
  const pos = faderPos(value, max);
  const set = (p: number) => {
    let db = faderDb(p, max);
    // snap to 0 dB when close, as a desk's fader has a notch there
    if (Math.abs(db) < 0.4) db = 0;
    emit(db <= SILENT_DB + 0.5 ? SILENT_DB : Math.round(db * 10) / 10);
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      emit(0);
      return;
    }
    lastTap.current = now;
    const rect = track.current!.getBoundingClientRect();
    const onCap = (e.target as HTMLElement).classList.contains('pr-fader-cap');
    // grab the cap where it is; a tap on the track jumps there
    const p = onCap ? pos : 1 - (e.clientY - rect.top) / rect.height;
    drag.current = { y: e.clientY, p };
    if (!onCap) set(p);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !track.current) return;
    const h = track.current.getBoundingClientRect().height;
    set(d.p + ((d.y - e.clientY) / h) * (e.shiftKey ? 0.2 : 1));
  };
  const end = () => {
    drag.current = null;
  };
  const onKey = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 3 : 0.5;
    const v = latest.current;
    const round = (x: number) => Math.round(x * 10) / 10;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') emit(Math.min(max, round((v <= SILENT_DB ? -40.5 : v) + step)));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') emit(v - step < -40 ? SILENT_DB : round(v - step));
    else if (e.key === 'Home') emit(SILENT_DB);
    else if (e.key === 'End') emit(max);
    else return;
    e.preventDefault();
  };
  return (
    <div
      className="pr-fader"
      style={{ ['--c' as string]: color }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={SILENT_DB}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={formatValue('x:fader', value)}
      data-key={k}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKey}
    >
      <div ref={track} className="pr-fader-track">
        <span className="pr-fader-notch" style={{ bottom: `${faderPos(0, max) * 100}%` }} />
        {ghost != null && <span className="pr-fader-ghost" style={{ bottom: `${faderPos(ghost, max) * 100}%` }} />}
        <span className="pr-fader-cap" style={{ bottom: `${pos * 100}%` }} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Strips
// ---------------------------------------------------------------------------

interface StripProps {
  mix: Mix;
  set: (k: string, v: number) => void;
  visible: ReadonlySet<string>;
  fresh?: ReadonlySet<string>;
  ghost?: Mix | null;
  hint?: boolean;
}

/** A knob for one setting, labelled and formatted. */
function Ctl({ k, mix, set, color, fresh, ghost, size = 40, label }: { k: string; mix: Mix; set: (k: string, v: number) => void; color: string; fresh?: ReadonlySet<string>; ghost?: Mix | null; size?: number; label?: string }) {
  const spec = specOf(k)!;
  const v = mix[k] ?? spec.def;
  if (spec.step === 1 && spec.max === 1 && spec.min === 0)
    return <Switch k={k} label={label ?? labelOf(k)} color={color} value={v > 0.5} onChange={on => set(k, on ? 1 : 0)} isNew={fresh?.has(k)} ghost={ghost && ghost[k] !== undefined ? ghost[k] > 0.5 : null} />;
  return <Knob k={k} spec={spec} value={v} onChange={x => set(k, x)} display={formatValue(k, v)} label={label ?? labelOf(k)} color={color} isNew={fresh?.has(k)} ghost={ghost?.[k] ?? null} size={size} />;
}

const sameStrip = (id: string) => (a: StripProps & { api: ConsoleApi; selected?: boolean; onSelect?: unknown }, b: typeof a) => {
  if (a.visible !== b.visible || a.fresh !== b.fresh || a.ghost !== b.ghost || a.hint !== b.hint || a.selected !== b.selected || a.api.sounding !== b.api.sounding || !!a.onSelect !== !!b.onSelect) return false;
  for (const p of Object.keys(CHANNEL_PARAMS)) if (a.mix[`${id}:${p}`] !== b.mix[`${id}:${p}`]) return false;
  // solo elsewhere changes whether this strip is heard
  return Object.keys(a.mix).filter(k => k.endsWith(':solo')).every(k => a.mix[k] === b.mix[k]);
};

const Strip = memo(
  function Strip({ track, mix, set, visible, fresh, ghost, api, hint, selected, onSelect }: StripProps & { track: Track; api: ConsoleApi; selected?: boolean; onSelect?: () => void }) {
    const id = track.id;
    const has = (p: string) => visible.has(`${id}:${p}`);
    const c = track.colour;
    const k = (p: string) => `${id}:${p}`;
    const anySolo = Object.keys(mix).some(x => x.endsWith(':solo') && mix[x] > 0.5);
    const silenced = mix[k('mute')] > 0.5 || (anySolo && !(mix[k('solo')] > 0.5));
    const read = useMemo(() => (m: MeterSnapshot): [number, number] => [m.channels[id]?.peak ?? 0, 0], [id]);
    // nothing to touch on this strip in this lesson: just its name and meter, narrow
    const bare = !Object.keys(CHANNEL_PARAMS).some(p => has(p));
    const readIn = useMemo(() => (m: MeterSnapshot): [number, number] => [m.channels[id]?.input ?? 0, 0], [id]);
    return (
      <div className={`pr-strip ${hint ? 'is-hint' : ''} ${selected ? 'selected' : ''} ${silenced ? 'silenced' : ''} ${bare ? 'bare' : ''}`} style={{ ['--c' as string]: c }} data-strip={id}>
        <button className="pr-strip-name" onClick={onSelect} disabled={!onSelect} title={track.name}>
          {track.short ?? track.name}
        </button>
        {has('gain') && (
          <div className="pr-sec pr-sec-trim">
            <Meter api={api} read={readIn} />
            <Ctl k={k('gain')} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={36} />
          </div>
        )}
        {(has('hpOn') || has('eqOn') || has('lowGain')) && (
          <button className="pr-sec pr-mini" onClick={onSelect} aria-label={`${track.name} EQ`}>
            <EqCurve mix={mix} id={id} w={64} h={26} color={c} />
            <small>EQ</small>
          </button>
        )}
        {has('threshold') && (
          <button className="pr-sec pr-mini" onClick={onSelect} aria-label={`${track.name} compressor`}>
            <GrMeter api={api} id={id} />
            <small>{mix[k('compOn')] > 0.5 ? 'Comp' : 'Comp off'}</small>
          </button>
        )}
        {(has('reverb') || has('delay')) && (
          <div className="pr-sec pr-sends">
            {has('reverb') && <Ctl k={k('reverb')} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={34} label="Reverb" />}
            {has('delay') && <Ctl k={k('delay')} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={34} label="Delay" />}
          </div>
        )}
        {has('pan') && (
          <div className="pr-sec">
            <Ctl k={k('pan')} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={38} />
          </div>
        )}
        {(has('mute') || has('solo')) && (
          <div className="pr-sec pr-ms">
            {has('mute') && (
              <button className={`pr-ms-btn mute ${mix[k('mute')] > 0.5 ? 'on' : ''} ${fresh?.has(k('mute')) ? 'is-new' : ''}`} aria-pressed={mix[k('mute')] > 0.5} onClick={() => set(k('mute'), mix[k('mute')] > 0.5 ? 0 : 1)} aria-label={`Mute ${track.name}`} data-key={k('mute')}>
                M
              </button>
            )}
            {has('solo') && (
              <button className={`pr-ms-btn solo ${mix[k('solo')] > 0.5 ? 'on' : ''} ${fresh?.has(k('solo')) ? 'is-new' : ''}`} aria-pressed={mix[k('solo')] > 0.5} onClick={() => set(k('solo'), mix[k('solo')] > 0.5 ? 0 : 1)} aria-label={`Solo ${track.name}`} data-key={k('solo')}>
                S
              </button>
            )}
          </div>
        )}
        <div className={`pr-sec pr-fader-sec ${fresh?.has(k('fader')) ? 'is-new' : ''}`}>
          {has('fader') ? <Fader k={k('fader')} value={mix[k('fader')]} onChange={v => set(k('fader'), v)} max={CHANNEL_PARAMS.fader.max} color={c} ghost={ghost?.[k('fader')] ?? null} label={`${track.name} fader`} /> : <div className="pr-fader placeholder" />}
          <Meter api={api} read={read} />
        </div>
        <span className="pr-strip-val tabular">{has('fader') ? formatValue(k('fader'), mix[k('fader')]) : ' '}</span>
        {silenced && <VolumeX className="pr-silenced" size={14} aria-label="Not heard" />}
      </div>
    );
  },
  (a, b) => sameStrip(a.track.id)(a, b),
);

function FxStrip({ mix, set, visible, fresh, ghost, hint }: StripProps) {
  const c = '#9fa8da';
  const keys = Object.keys(FX_PARAMS).map(p => `fx:${p}`).filter(k => visible.has(k));
  const rev = keys.filter(k => k.startsWith('fx:reverb'));
  const del = keys.filter(k => k.startsWith('fx:delay'));
  return (
    <div className={`pr-strip pr-fx ${hint ? 'is-hint' : ''}`} style={{ ['--c' as string]: c }} data-strip="fx">
      <span className="pr-strip-name">Effects</span>
      {rev.length > 0 && (
        <div className="pr-sec pr-fx-sec">
          <small className="pr-sec-title">Reverb</small>
          <div className="pr-fx-grid">
            {rev.map(k => (
              <Ctl key={k} k={k} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={34} />
            ))}
          </div>
        </div>
      )}
      {del.length > 0 && (
        <div className="pr-sec pr-fx-sec">
          <small className="pr-sec-title">Delay</small>
          <div className="pr-fx-grid">
            {del.map(k => (
              <Ctl key={k} k={k} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={34} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MasterStrip({ mix, set, visible, fresh, ghost, api, hint }: StripProps & { api: ConsoleApi }) {
  const c = '#f4c97a';
  const has = (p: string) => visible.has(`master:${p}`);
  const read = useMemo(() => (m: MeterSnapshot): [number, number] => [m.master.peakL, m.master.peakR], []);
  const comp = ['compOn', 'threshold', 'ratio', 'attack', 'release', 'makeup'].filter(has);
  const lim = ['limitOn', 'drive', 'ceiling'].filter(has);
  return (
    <div className={`pr-strip pr-master ${hint ? 'is-hint' : ''}`} style={{ ['--c' as string]: c }} data-strip="master">
      <span className="pr-strip-name">Master</span>
      {comp.length > 0 && (
        <div className="pr-sec pr-fx-sec">
          <small className="pr-sec-title">
            Bus compressor <MasterGr api={api} kind="comp" />
          </small>
          <div className="pr-fx-grid">
            {comp.map(p => (
              <Ctl key={p} k={`master:${p}`} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={34} />
            ))}
          </div>
        </div>
      )}
      {lim.length > 0 && (
        <div className="pr-sec pr-fx-sec">
          <small className="pr-sec-title">
            Limiter <MasterGr api={api} kind="limit" />
          </small>
          <div className="pr-fx-grid">
            {lim.map(p => (
              <Ctl key={p} k={`master:${p}`} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={34} />
            ))}
          </div>
        </div>
      )}
      {has('mono') && (
        <button className={`pr-mono ${mix['master:mono'] > 0.5 ? 'on' : ''}`} aria-pressed={mix['master:mono'] > 0.5} onClick={() => set('master:mono', mix['master:mono'] > 0.5 ? 0 : 1)} data-key="master:mono">
          <Headphones size={14} /> Mono
        </button>
      )}
      <div className="pr-sec pr-fader-sec">
        {has('fader') ? <Fader k="master:fader" value={mix['master:fader']} onChange={v => set('master:fader', v)} max={MASTER_PARAMS.fader.max} color={c} ghost={ghost?.['master:fader'] ?? null} label="Master fader" /> : <div className="pr-fader placeholder" />}
        <Meter api={api} read={read} stereo />
      </div>
      <span className="pr-strip-val tabular">{has('fader') ? formatValue('master:fader', mix['master:fader']) : ' '}</span>
    </div>
  );
}

/** Gain reduction of a channel's compressor (a bar that grows downwards). */
function GrMeter({ api, id }: { api: ConsoleApi; id: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      api.onMeters(m => {
        if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, (m.channels[id]?.reduction ?? 0) / 20)})`;
      }),
    [api.onMeters, id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <span className="pr-gr" aria-hidden>
      <span ref={bar} />
    </span>
  );
}

function MasterGr({ api, kind }: { api: ConsoleApi; kind: 'comp' | 'limit' }) {
  const val = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      api.onMeters(m => {
        const r = kind === 'comp' ? m.master.compReduction : m.master.limitReduction;
        if (val.current) val.current.textContent = r > 0.05 ? `−${r.toFixed(1)}` : '0';
      }),
    [api.onMeters, kind], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <span className="pr-gr-val tabular" title="Gain reduction (dB)">
      <span ref={val}>0</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// EQ and compressor, large
// ---------------------------------------------------------------------------

const eqOf = (mix: Mix, id: string) => {
  const g = (p: string) => mix[`${id}:${p}`] ?? 0;
  return {
    hpOn: g('hpOn') > 0.5,
    hpFreq: g('hpFreq'),
    eqOn: g('eqOn') > 0.5,
    lowFreq: g('lowFreq'),
    lowGain: g('lowGain'),
    midFreq: g('midFreq'),
    midGain: g('midGain'),
    midQ: g('midQ'),
    presFreq: g('presFreq'),
    presGain: g('presGain'),
    presQ: g('presQ'),
    highFreq: g('highFreq'),
    highGain: g('highGain'),
  };
};

const F_LO = 20;
const F_HI = 20000;
const xOf = (f: number, w: number) => (Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * w;

/** The EQ's response as a curve (±18 dB). */
export function EqCurve({ mix, id, w, h, color, ghost, grid = false }: { mix: Mix; id: string; w: number; h: number; color: string; ghost?: Mix | null; grid?: boolean }) {
  const path = (m: Mix) => {
    const s = eqOf(m, id);
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const f = F_LO * Math.pow(F_HI / F_LO, i / 80);
      const db = Math.max(-18, Math.min(18, eqResponse(s, f)));
      pts.push(`${i ? 'L' : 'M'}${xOf(f, w).toFixed(1)},${(h / 2 - (db / 18) * (h / 2 - 2)).toFixed(1)}`);
    }
    return pts.join('');
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pr-eq-curve" aria-hidden>
      {grid &&
        [100, 1000, 10000].map(f => (
          <g key={f}>
            <line x1={xOf(f, w)} x2={xOf(f, w)} y1={0} y2={h} className="pr-grid" />
            <text x={xOf(f, w) + 3} y={h - 4} className="pr-grid-label">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} className="pr-grid" />
      {ghost && <path d={path(ghost)} className="pr-curve-ghost" />}
      <path d={path(mix)} style={{ stroke: color }} className="pr-curve" />
    </svg>
  );
}

/** The compressor's transfer curve: input level across, output level up (−60..0 dB). */
function CompCurve({ mix, id, color, w, h }: { mix: Mix; id: string; color: string; w: number; h: number }) {
  const g = (p: string) => mix[`${id}:${p}`] ?? 0;
  const on = g('compOn') > 0.5;
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = -60 + i;
    const y = on ? compCurve(x, g('threshold'), g('ratio')) + g('makeup') : x;
    pts.push(`${i ? 'L' : 'M'}${((i / 60) * w).toFixed(1)},${(h - ((Math.max(-60, Math.min(6, y)) + 60) / 66) * h).toFixed(1)}`);
  }
  const tx = ((g('threshold') + 60) / 60) * w;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pr-comp-curve" aria-hidden>
      <line x1={0} y1={h} x2={w} y2={h - (60 / 66) * h} className="pr-grid" />
      {on && <line x1={tx} x2={tx} y1={0} y2={h} className="pr-threshold" />}
      <path d={pts.join('')} style={{ stroke: color }} className="pr-curve" />
    </svg>
  );
}

function ChannelEditor({ id, track, mix, set, visible, isFresh, ghost, api, onClose }: { id: string; track: Track; mix: Mix; set: (k: string, v: number) => void; visible: ReadonlySet<string>; isFresh: (k: string) => boolean; ghost?: Mix | null; api: ConsoleApi; onClose?: () => void }) {
  const c = track.colour;
  const has = (p: string) => visible.has(`${id}:${p}`);
  const fresh = useMemo(() => new Set([...visible].filter(isFresh)), [visible, isFresh]);
  const eqKeys = ['hpOn', 'hpFreq', 'eqOn', 'lowGain', 'lowFreq', 'midGain', 'midFreq', 'midQ', 'presGain', 'presFreq', 'presQ', 'highGain', 'highFreq'].filter(has);
  const compKeys = ['compOn', 'threshold', 'ratio', 'attack', 'release', 'makeup'].filter(has);
  return (
    <div className="pr-editor" style={{ ['--c' as string]: c }}>
      <div className="pr-editor-head">
        <span className="pr-editor-name">{track.name}</span>
        {onClose && (
          <button className="btn btn-icon btn-ghost btn-sm pr-editor-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="pr-editor-body">
        {eqKeys.length > 0 && (
          <div className="pr-editor-sec">
            <div className="pr-editor-pic">
              <EqCurve mix={mix} id={id} w={260} h={92} color={c} ghost={ghost} grid />
            </div>
            <div className="sl-ctls pr-ctls">
              {eqKeys.map(p => (
                <Ctl key={p} k={`${id}:${p}`} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={38} />
              ))}
            </div>
          </div>
        )}
        {compKeys.length > 0 && (
          <div className="pr-editor-sec">
            <div className="pr-editor-pic pr-editor-comp">
              <CompCurve mix={mix} id={id} color={c} w={92} h={92} />
              <div className="pr-gr-big">
                <small>Gain reduction</small>
                <GrMeter api={api} id={id} />
              </div>
            </div>
            <div className="sl-ctls pr-ctls">
              {compKeys.map(p => (
                <Ctl key={p} k={`${id}:${p}`} mix={mix} set={set} color={c} fresh={fresh} ghost={ghost} size={38} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
