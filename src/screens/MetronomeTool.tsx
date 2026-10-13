/**
 * Metronome — a practice metronome with tap tempo, time signatures, subdivisions,
 * an accented downbeat, a visual pulse and a speed trainer that nudges the tempo
 * up every few bars.
 */
import { Minus, Play, Plus, Square, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../audio/context';
import { Metronome } from '../audio/metronome';
import { Segmented, Toggle } from '../components/ui';
import { ToolShell } from './Studio';
import './metronome.css';

const METERS = [
  { id: '2/4', beats: 2, sub: 1, label: '2/4' },
  { id: '3/4', beats: 3, sub: 1, label: '3/4' },
  { id: '4/4', beats: 4, sub: 1, label: '4/4' },
  { id: '5/4', beats: 5, sub: 1, label: '5/4' },
  { id: '6/8', beats: 2, sub: 3, label: '6/8' },
  { id: '9/8', beats: 3, sub: 3, label: '9/8' },
  { id: '12/8', beats: 4, sub: 3, label: '12/8' },
] as const;

const SUBS = [
  { value: '1', label: 'Beats' },
  { value: '2', label: '♪♪ Eighths' },
  { value: '3', label: 'Triplets' },
  { value: '4', label: '16ths' },
] as const;

export function tempoName(bpm: number): string {
  if (bpm < 50) return 'Largo';
  if (bpm < 66) return 'Adagio';
  if (bpm < 78) return 'Andante';
  if (bpm < 110) return 'Moderato';
  if (bpm < 140) return 'Allegro';
  if (bpm < 180) return 'Vivace';
  return 'Presto';
}

const clampBpm = (b: number) => Math.max(30, Math.min(260, Math.round(b)));

export default function MetronomeTool() {
  const [bpm, setBpm] = useState(80);
  const [meter, setMeter] = useState<(typeof METERS)[number]['id']>('4/4');
  const [sub, setSub] = useState<'1' | '2' | '3' | '4'>('1');
  const [accent, setAccent] = useState(true);
  const [volume, setVolume] = useState(80);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<{ beat: number; n: number } | null>(null);
  const [trainer, setTrainer] = useState(false);
  const [trainStep, setTrainStep] = useState(4);
  const [trainBars, setTrainBars] = useState(4);
  const [trainTarget, setTrainTarget] = useState(120);
  const metro = useRef<Metronome | null>(null);
  const taps = useRef<number[]>([]);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const cfg = METERS.find(m => m.id === meter)!;
  const compound = cfg.sub === 3;
  const effSub = compound ? 3 : Number(sub);
  const trainerRef = useRef({ trainer, trainStep, trainBars, trainTarget });
  trainerRef.current = { trainer, trainStep, trainBars, trainTarget };

  const stop = useCallback(() => {
    metro.current?.stop();
    metro.current = null;
    setRunning(false);
    setBeat(null);
  }, []);

  const start = async () => {
    await unlockAudio();
    const m = new Metronome();
    metro.current = m;
    // compound meters click the dotted-quarter beat; the slider shows that beat
    m.start({
      bpm,
      beatsPerBar: cfg.beats,
      subdivision: effSub,
      accent,
      volume: volume / 100,
      onBeat: info => {
        setBeat(b => ({ beat: info.beat, n: (b?.n ?? 0) + 1 }));
        const t = trainerRef.current;
        if (t.trainer && info.beat === 0 && info.bar > 0 && info.bar % t.trainBars === 0 && bpmRef.current < t.trainTarget) {
          const next = Math.min(t.trainTarget, bpmRef.current + t.trainStep);
          setBpm(next);
          metro.current?.setBpm(next);
        }
      },
    });
    setRunning(true);
  };

  // live changes while running
  useEffect(() => {
    metro.current?.setBpm(bpm);
  }, [bpm]);
  useEffect(() => {
    metro.current?.setSubdivision(effSub);
  }, [effSub]);
  useEffect(() => {
    metro.current?.setAccent(accent);
  }, [accent]);
  useEffect(() => {
    metro.current?.setVolume(volume / 100);
  }, [volume]);
  useEffect(() => {
    metro.current?.setBeatsPerBar(cfg.beats);
  }, [cfg.beats]);
  useEffect(() => () => metro.current?.stop(), []);

  // space bar starts / stops
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (metro.current) stop();
        else start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tap = () => {
    const now = performance.now();
    const list = taps.current.filter(t => now - t < 2500);
    list.push(now);
    taps.current = list.slice(-6);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(clampBpm(60000 / avg));
    }
  };

  return (
    <ToolShell title="Metronome">
      <div className="activity metronome-tool">
        <div className="metro-main card">
          <div className="metro-beats" aria-hidden>
            {Array.from({ length: cfg.beats }, (_, i) => (
              <span key={`${i}-${beat?.beat === i ? beat.n : ''}`} className={`metro-dot ${i === 0 && accent ? 'accent' : ''} ${running && beat?.beat === i ? 'on' : ''}`} />
            ))}
          </div>
          <div className="metro-bpm">
            <button className="btn btn-icon" onClick={() => setBpm(b => clampBpm(b - 1))} aria-label="Slower">
              <Minus size={20} />
            </button>
            <div className="metro-readout">
              <strong className="display tabular">{bpm}</strong>
              <span className="faint">
                {compound ? '♩. ' : '♩ '}per minute · {tempoName(compound ? bpm * 1.5 : bpm)}
              </span>
            </div>
            <button className="btn btn-icon" onClick={() => setBpm(b => clampBpm(b + 1))} aria-label="Faster">
              <Plus size={20} />
            </button>
          </div>
          <input className="metro-slider" type="range" min={30} max={260} value={bpm} onChange={e => setBpm(Number(e.target.value))} aria-label="Tempo" />
          <div className="metro-actions">
            <button className="btn btn-lg" onClick={tap}>
              Tap tempo
            </button>
            <button className={`btn btn-lg ${running ? '' : 'btn-primary'}`} onClick={() => (running ? stop() : start())}>
              {running ? <Square size={18} /> : <Play size={18} />} {running ? 'Stop' : 'Start'}
            </button>
          </div>
          <span className="faint metro-hint">Space bar starts and stops.</span>
        </div>

        <div className="metro-options card">
          <div className="set-row">
            <span>Time signature</span>
            <Segmented size="sm" value={meter} onChange={setMeter} options={METERS.map(m => ({ value: m.id, label: m.label }))} />
          </div>
          {!compound && (
            <div className="set-row">
              <span>Subdivide</span>
              <Segmented size="sm" value={sub} onChange={setSub} options={[...SUBS]} />
            </div>
          )}
          <Toggle checked={accent} onChange={setAccent} label="Accent beat 1" />
          <label className="slider-row">
            <span>
              Volume <strong className="tabular">{volume}%</strong>
            </span>
            <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} />
          </label>
          <Toggle checked={trainer} onChange={setTrainer} label={<span className="row" style={{ gap: 6 }}><TrendingUp size={15} /> Speed trainer</span>} sub="Start slow and let the metronome speed you up." />
          {trainer && (
            <div className="metro-trainer">
              <label>
                +<input type="number" className="set-input num" min={1} max={20} value={trainStep} onChange={e => setTrainStep(Math.max(1, Number(e.target.value) || 1))} /> bpm
              </label>
              <label>
                every <input type="number" className="set-input num" min={1} max={32} value={trainBars} onChange={e => setTrainBars(Math.max(1, Number(e.target.value) || 1))} /> bars
              </label>
              <label>
                up to <input type="number" className="set-input num" min={31} max={260} value={trainTarget} onChange={e => setTrainTarget(clampBpm(Number(e.target.value) || 120))} /> bpm
              </label>
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
