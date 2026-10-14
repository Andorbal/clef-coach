/**
 * One chord on one instrument: a chord box (guitar, ukulele, bass), marked piano keys
 * or marked mallet bars, with a voicing switcher. Tapping the picture plays it.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { unlockAudio } from '../audio/context';
import { synth } from '../audio/synth';
import { ChordDiagram } from './ChordDiagram';
import { MalletKeyboard } from './MalletKeyboard';
import { PianoKeyboard } from './PianoKeyboard';
import type { KeyMark } from './PianoKeyboard';
import { type InstrumentId, type InstrumentPrefs, malletVariant, voiceFor } from '../music/instruments';
import { malletLabel } from '../music/sticking';
import type { ChordView, FretNote, KeyNote, LabelMode } from '../music/chordViews';
import './ChordCell.css';

export type CellSize = 'sm' | 'md' | 'lg';

const DIAGRAM_W: Record<CellSize, number> = { sm: 118, md: 164, lg: 230 };
const KEYS_H: Record<CellSize, number> = { sm: 84, md: 112, lg: 150 };

/** Play a voicing: strum a fretted chord low to high, roll an arpeggio, or strike it. */
export async function playView(view: ChordView, instrument: InstrumentId, prefs: InstrumentPrefs): Promise<void> {
  await unlockAudio();
  const voice = voiceFor(instrument, prefs);
  if (view.arpeggio) {
    synth.playSequence(
      view.midis.map((m, i) => ({ midi: [m], at: i * 0.26, duration: 0.45 })),
      voice,
    );
  } else if (view.kind === 'fretted') {
    const gap = instrument === 'ukulele' ? 0.028 : 0.034;
    synth.playSequence(
      view.midis.map((m, i) => ({ midi: [m], at: i * gap, duration: 2.6 - i * gap })),
      voice,
    );
  } else {
    synth.playSequence([{ midi: view.midis, at: 0, duration: 2 }], voice);
  }
}

function fretLabel(n: FretNote, mode: LabelMode): string | undefined {
  if (mode === 'degrees') return n.degree;
  if (mode === 'notes') return n.name;
  return n.finger ? String(n.finger) : undefined;
}

function keyMark(n: KeyNote, mode: LabelMode, mallets?: 2 | 4): KeyMark {
  const color = n.hand === 'L' ? 'lh' : 'rh';
  if (mode === 'degrees') return { midi: n.midi, color, label: n.degree };
  if (mode === 'notes') return { midi: n.midi, color, label: n.name };
  if (n.mallet) return { midi: n.midi, color, label: malletLabel(n.mallet, mallets ?? 4) };
  return { midi: n.midi, color, finger: n.finger };
}

const BLACK = [1, 3, 6, 8, 10];

/** Lowest / highest note to show: a little room around the chord, at least an octave, white-key edges. */
function keyRange(midis: number[], minLo: number, maxHi: number): [number, number] {
  let lo = Math.min(...midis) - 2;
  let hi = Math.max(...midis) + 2;
  while (hi - lo < 12) {
    lo--;
    hi++;
  }
  while (BLACK.includes(((lo % 12) + 12) % 12)) lo--;
  while (BLACK.includes(((hi % 12) + 12) % 12)) hi++;
  return [Math.max(minLo, lo), Math.min(maxHi, hi)];
}

export function ChordPicture({
  view,
  instrument,
  prefs,
  mode,
  size = 'md',
  leftHanded,
  onPlay,
  interactive = true,
}: {
  view: ChordView;
  instrument: InstrumentId;
  prefs: InstrumentPrefs;
  mode: LabelMode;
  size?: CellSize;
  leftHanded?: boolean;
  onPlay?: () => void;
  /** false: just the picture (e.g. inside another button) */
  interactive?: boolean;
}) {
  const play = () => {
    void playView(view, instrument, prefs);
    onPlay?.();
  };
  const tap = interactive ? { onClick: play, role: 'button', tabIndex: 0, 'aria-label': `Play ${view.label}`, onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && play() } : {};
  if (view.kind === 'fretted') {
    const dots = view.notes.filter(n => n.fret > 0).map(n => ({ string: n.string, fret: n.fret, root: n.degree === 'R', label: fretLabel(n, mode) }));
    const open = view.notes.filter(n => n.fret === 0);
    const openLabels = mode === 'fingers' ? undefined : Object.fromEntries(open.map(n => [n.string, fretLabel(n, mode) ?? '']));
    return (
      <div className={`chord-pic chord-pic-fretted size-${size}`} {...tap}>
        <ChordDiagram
          strings={view.strings}
          dots={dots}
          open={open.map(n => n.string)}
          openLabels={openLabels}
          openRoots={open.filter(n => n.degree === 'R').map(n => n.string)}
          muted={view.muted}
          barres={view.barres.map(b => ({ fret: b.fret, fromString: b.fromString, toString: b.toString, label: mode === 'fingers' ? String(b.finger) : undefined }))}
          baseFret={view.baseFret}
          frets={instrument === 'ukulele' ? 5 : 4}
          stringNames={view.stringNames}
          leftHanded={leftHanded}
          width={Math.round(DIAGRAM_W[size] * (0.55 + 0.075 * view.strings))}
          title={view.label}
        />
      </div>
    );
  }
  const marks = view.notes.map(n => keyMark(n, mode, view.mallets));
  if (instrument === 'mallets') {
    const v = malletVariant(prefs);
    const [lo, hi] = keyRange(view.midis, v.low, v.high);
    return (
      <div className={`chord-pic chord-pic-keys size-${size}`} {...tap}>
        <MalletKeyboard low={lo} high={hi} metal={v.metal} marks={marks} interactive={false} minBarWidth={size === 'sm' ? 8 : 11} height={KEYS_H[size] + 14} />
      </div>
    );
  }
  const [lo, hi] = keyRange(view.midis, 21, 108);
  return (
    <div className={`chord-pic chord-pic-keys size-${size}`} {...tap}>
      <PianoKeyboard low={lo} high={hi} marks={marks} interactive={false} minWhiteKeyWidth={size === 'sm' ? 8 : 11} height={KEYS_H[size]} markMiddleC />
    </div>
  );
}

/** A voicing with ‹ › to step through the others. */
export function ChordCell({
  views,
  index,
  onIndex,
  instrument,
  prefs,
  mode,
  size = 'md',
  leftHanded,
  onPlay,
}: {
  views: ChordView[];
  index: number;
  onIndex: (i: number) => void;
  instrument: InstrumentId;
  prefs: InstrumentPrefs;
  mode: LabelMode;
  size?: CellSize;
  leftHanded?: boolean;
  onPlay?: () => void;
}) {
  if (!views.length) return <div className="chord-cell chord-cell-empty faint">No voicing on this instrument</div>;
  const i = Math.min(index, views.length - 1);
  const view = views[i];
  return (
    <div className={`chord-cell size-${size}`}>
      <ChordPicture view={view} instrument={instrument} prefs={prefs} mode={mode} size={size} leftHanded={leftHanded} onPlay={onPlay} />
      <div className="chord-cell-nav">
        <button className="btn btn-icon btn-ghost btn-xs" onClick={() => onIndex((i - 1 + views.length) % views.length)} disabled={views.length < 2} aria-label="Previous voicing">
          <ChevronLeft size={16} />
        </button>
        <span className="chord-cell-label" title={view.label}>
          <span className="chord-cell-name">{view.label}</span>
          <span className="faint tabular">
            {i + 1}/{views.length}
          </span>
        </span>
        <button className="btn btn-icon btn-ghost btn-xs" onClick={() => onIndex((i + 1) % views.length)} disabled={views.length < 2} aria-label="Next voicing">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
