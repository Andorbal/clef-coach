import { Keyboard, Mic, MicOff, Piano, Usb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { inputManager } from '../audio/input/manager';
import { micInput } from '../audio/input/mic';
import { unlockAudio } from '../audio/context';
import { useApp, useDevice } from '../state/store';
import { pitchToString, spellMidi } from '../music/pitch';
import { type InstrumentId, familyOf, instrumentDef } from '../music/instruments';
import type { InputMode } from '../state/types';
import { Modal } from './ui';
import './InputControl.css';

export function useInputStatus() {
  const [, setN] = useState(0);
  useEffect(() => inputManager.onStatus(() => setN(n => n + 1)), []);
  return inputManager.status;
}

/** Apply the saved input mode (enables MIDI / mic). Call from a user gesture when possible. */
export async function applyInputMode(mode: InputMode): Promise<{ ok: boolean; error?: string }> {
  await unlockAudio();
  if (mode === 'mic') {
    return inputManager.enableMic();
  }
  inputManager.disableMic();
  if (mode === 'midi') return inputManager.enableMidi();
  return { ok: true };
}

export function InputChip({ instrument }: { instrument: InstrumentId }) {
  const device = useDevice();
  const status = useInputStatus();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!status.micActive) return;
    const t = setInterval(() => setLevel(micInput.getLevel()), 80);
    return () => clearInterval(t);
  }, [status.micActive]);
  const mode = device.inputMode;
  const label = mode === 'mic' ? (status.micActive ? 'Listening' : 'Mic off') : mode === 'midi' ? (status.midiDevices.length ? status.midiDevices[0].name : 'MIDI') : 'On-screen';
  const Icon = mode === 'mic' ? (status.micActive ? Mic : MicOff) : mode === 'midi' ? Usb : familyOf(instrument) === 'keyboard' ? Piano : Keyboard;
  return (
    <>
      <button className={`input-chip ${mode}`} onClick={() => setOpen(true)} aria-label="Input settings">
        <Icon size={16} />
        <span className="input-chip-label">{label}</span>
        {mode === 'mic' && status.micActive && (
          <span className="mic-meter" aria-hidden>
            <span style={{ transform: `scaleX(${Math.min(1, level * 1.6)})` }} />
          </span>
        )}
      </button>
      <InputModal open={open} onClose={() => setOpen(false)} instrument={instrument} />
    </>
  );
}

function micBody(instrument: InstrumentId): string {
  switch (instrument) {
    case 'piano':
      return 'Play a real or digital piano near your device. Works great on iPad.';
    case 'mallets':
      return 'Play your marimba, xylophone, glockenspiel or vibraphone near the device. Set which one in Settings so the octave is right.';
    case 'bass':
      return 'Play your bass near the device — unplugged works, or through an amp. Low notes need a quiet room.';
    default:
      return `Play your ${instrumentDef(instrument).short.toLowerCase()} near the device — acoustic or amplified.`;
  }
}

export function InputPicker({ instrument, onPicked }: { instrument: InstrumentId; onPicked?: () => void }) {
  const device = useDevice();
  const update = useApp(s => s.updateDevice);
  const status = useInputStatus();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (m: InputMode) => {
    setBusy(true);
    setErr(null);
    const r = await applyInputMode(m);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? 'Could not enable that input.');
      if (m !== 'touch') return;
    }
    update({ inputMode: m });
    onPicked?.();
  };
  const midiSupported = status.midiSupported;
  const options: { mode: InputMode; title: string; body: string; icon: typeof Mic; disabled?: boolean }[] = [
    {
      mode: 'mic',
      title: 'Microphone',
      body: micBody(instrument),
      icon: Mic,
    },
    {
      mode: 'midi',
      title: 'MIDI',
      body: midiSupported
        ? 'Connect a digital piano or MIDI keyboard by USB or Bluetooth. Most precise.'
        : 'This browser has no Web MIDI (Safari on iPad/iPhone doesn’t support it). Use the microphone, or open Clef Coach in a MIDI-capable browser such as Chrome on a computer, or “Web MIDI Browser” on iPad.',
      icon: Usb,
      disabled: !midiSupported,
    },
    {
      mode: 'touch',
      title: 'On-screen',
      body: familyOf(instrument) === 'fretted' ? 'Tap the fretboard.' : familyOf(instrument) === 'mallet' ? 'Tap the bars (or use your computer keys: A W S E D F…).' : 'Tap the keyboard (or use your computer keys: A W S E D F…).',
      icon: familyOf(instrument) === 'keyboard' ? Piano : Keyboard,
    },
  ];
  return (
    <div className="input-picker">
      {options.map(o => (
        <button key={o.mode} className={`input-option ${device.inputMode === o.mode ? 'on' : ''}`} disabled={o.disabled || busy} onClick={() => pick(o.mode)}>
          <span className="input-option-icon">
            <o.icon size={22} />
          </span>
          <span className="input-option-text">
            <strong>{o.title}</strong>
            <span className="dim">{o.body}</span>
          </span>
        </button>
      ))}
      {err && <p className="input-error">{err}</p>}
      <LiveReadout />
      {device.inputMode === 'midi' && status.midiDevices.length > 0 && (
        <p className="faint">Connected: {status.midiDevices.map(d => d.name).join(', ')}</p>
      )}
      {device.inputMode === 'midi' && status.midiEnabled && status.midiDevices.length === 0 && <p className="faint">Waiting for a MIDI device… plug it in and press a key.</p>}
    </div>
  );
}

export function InputModal({ open, onClose, instrument }: { open: boolean; onClose: () => void; instrument: InstrumentId }) {
  return (
    <Modal open={open} onClose={onClose} title="How will you play?">
      <InputPicker instrument={instrument} onPicked={onClose} />
    </Modal>
  );
}

/** Shows the last note heard from any input, so players can check their setup. */
function LiveReadout() {
  const [last, setLast] = useState<{ name: string; source: string } | null>(null);
  const [level, setLevel] = useState(0);
  const status = useInputStatus();
  useEffect(
    () =>
      inputManager.subscribe(e => {
        if (e.type === 'on') setLast({ name: pitchToString(spellMidi(e.midi)), source: e.source });
      }),
    [],
  );
  useEffect(() => {
    if (!status.micActive) return;
    const t = setInterval(() => setLevel(micInput.getLevel()), 80);
    return () => clearInterval(t);
  }, [status.micActive]);
  return (
    <div className="live-readout">
      <span className="faint">Test it:</span>
      <strong className="display">{last ? last.name : 'play a note…'}</strong>
      {last && <span className="pill">{last.source === 'mic' ? 'microphone' : last.source === 'midi' ? 'MIDI' : last.source === 'keyboard' ? 'computer keys' : 'on-screen'}</span>}
      {status.micActive && (
        <span className="mic-meter wide" aria-hidden>
          <span style={{ transform: `scaleX(${Math.min(1, level * 1.6)})` }} />
        </span>
      )}
    </div>
  );
}
