/**
 * The lab's keyboard and transport: two octaves of keys (they scroll on a phone), Hold to
 * latch notes, a loop to play a pattern hands-free while you turn knobs, and octave shift.
 * The computer keyboard (A W S E D…, Z/X for octaves) and MIDI keyboards play too (useLab).
 */
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, Square } from 'lucide-react';
import { PianoKeyboard } from '../../instruments/PianoKeyboard';
import { LOOPS, type LoopId } from '../audio/loops';
import type { Lab } from './useLab';
import { spellMidi, pitchLabel } from '../../music/pitch';

export function Keys({ lab, compact, loops = true }: { lab: Lab; compact?: boolean; loops?: boolean }) {
  const octaveName = pitchLabel(spellMidi(lab.root), 'letter', true);
  return (
    <div className={`sl-keys ${compact ? 'compact' : ''}`}>
      <div className="sl-transport">
        <div className="sl-octave" role="group" aria-label="Keyboard octave">
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => lab.setRoot(Math.max(24, lab.root - 12))} aria-label="Octave down" disabled={lab.root <= 24}>
            <ChevronLeft size={18} />
          </button>
          <span className="sl-octave-name tabular">{octaveName}</span>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => lab.setRoot(Math.min(84, lab.root + 12))} aria-label="Octave up" disabled={lab.root >= 84}>
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" className={`chip-btn ${lab.hold ? 'on' : ''}`} aria-pressed={lab.hold} onClick={() => lab.setHold(!lab.hold)} title="Keep notes sounding after you let go">
          <Repeat size={15} /> Hold
        </button>
        {loops && (
          <div className="sl-loop">
            <button
              type="button"
              className={`chip-btn ${lab.loop ? 'on' : ''}`}
              onClick={() => lab.playLoop(lab.loop ? null : (lastLoop ?? 'pulse'))}
              aria-pressed={!!lab.loop}
              title="Play a pattern over and over so your hands are free for the knobs"
            >
              {lab.loop ? <Pause size={15} /> : <Play size={15} />} Loop
            </button>
            <select
              className="set-select sl-loop-select"
              aria-label="Loop pattern"
              value={lab.loop ?? lastLoop ?? 'pulse'}
              onChange={e => {
                lastLoop = e.target.value as LoopId;
                lab.playLoop(lastLoop);
              }}
            >
              {LOOPS.map(l => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="button" className="btn btn-icon btn-ghost btn-sm sl-stop" onClick={lab.silence} aria-label="Stop all sound" title="Stop all sound">
          <Square size={15} />
        </button>
      </div>
      <PianoKeyboard
        low={lab.root}
        high={lab.root + (compact ? 17 : 24)}
        pressed={lab.held}
        onKeyDown={(m, v) => lab.noteOn(m, Math.max(0.5, v))}
        onKeyUp={m => lab.noteOff(m)}
        height={compact ? 110 : 132}
        showLabels="c-only"
        focus={lab.root + 12}
        ariaLabel="Synth keyboard"
        className="sl-piano"
      />
    </div>
  );
}

/** The loop chosen last (kept for the session, so Loop restarts the same pattern). */
let lastLoop: LoopId | null = null;
