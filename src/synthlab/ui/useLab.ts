/**
 * useLab: a screen's handle on the live synth: the patch as React state, knobs that change
 * the sound at once, notes from the on-screen keys, the computer keyboard and MIDI, the
 * hold latch, and the loop player.
 *
 * A knob drag can fire 120 events a second; the synth hears every one, but React state is
 * committed at most once a frame.
 *
 * The microphone plays no part here (it would hear the synth), and the app's own piano
 * echo of MIDI notes is switched off while a lab screen is open: the lab is the instrument.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { keyboardToMidi } from '../../audio/input/keyboard';
import { inputManager } from '../../audio/input/manager';
import { onMidiNote } from '../../audio/input/midi';
import type { Patch } from '../dsp/params';
import { type LabSynth, getLabSynth, retainLabSynth } from '../audio/host';
import { type LoopId, LoopPlayer } from '../audio/loops';

export interface NoteEvent {
  midi: number;
  on: boolean;
  /** Played by the loop rather than by hand. */
  loop: boolean;
}

export interface Lab {
  patch: Patch;
  set: <K extends keyof Patch>(key: K, value: Patch[K]) => void;
  setPatch: (p: Patch) => void;
  /** Keys sounding (held by hand, latched, or played by the loop). */
  held: ReadonlySet<number>;
  /** Anything audible right now. */
  active: boolean;
  noteOn: (midi: number, velocity?: number) => void;
  noteOff: (midi: number) => void;
  hold: boolean;
  setHold: (on: boolean) => void;
  loop: LoopId | null;
  playLoop: (id: LoopId | null) => void;
  /** Keyboard root (C of the lower octave shown). */
  root: number;
  setRoot: (m: number) => void;
  synth: LabSynth;
  /** Subscribe to notes (lessons watch for "now play a note"). */
  onNote: (cb: (e: NoteEvent) => void) => () => void;
  /** Stop everything (loop, held notes, clips). */
  silence: () => void;
}

export function useLab(initial: Patch, opts: { keyboard?: boolean } = {}): Lab {
  const synth = getLabSynth();
  const [patch, setPatchState] = useState<Patch>(initial);
  const patchRef = useRef(patch);
  const raf = useRef<number | null>(null);
  const [handHeld, setHandHeld] = useState<ReadonlySet<number>>(new Set());
  const [loopHeld, setLoopHeld] = useState<ReadonlySet<number>>(new Set());
  const [active, setActive] = useState(false);
  const [hold, setHoldState] = useState(false);
  const holdRef = useRef(false);
  const latched = useRef(new Set<number>());
  const down = useRef(new Set<number>());
  const [loop, setLoop] = useState<LoopId | null>(null);
  const [root, setRoot] = useState(48);
  const rootRef = useRef(root);
  rootRef.current = root;
  const listeners = useRef(new Set<(e: NoteEvent) => void>());
  const [player] = useState(() => new LoopPlayer(synth));

  const emit = (e: NoteEvent) => {
    for (const cb of listeners.current) cb(e);
  };

  // set up and tear down the synth with the screen
  useEffect(() => {
    const release = retainLabSynth();
    synth.setPatch(patchRef.current);
    synth.start().catch(err => console.warn('Synth Lab could not start', err));
    const offActive = synth.onActive(setActive);
    const echo = inputManager.getEchoForSource('midi');
    inputManager.setEchoForSource('midi', false);
    return () => {
      player.stop();
      offActive();
      inputManager.setEchoForSource('midi', echo);
      release();
    };
  }, [synth, player]);

  const commit = useCallback((p: Patch) => {
    patchRef.current = p;
    if (raf.current === null) {
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setPatchState(patchRef.current);
      });
    }
  }, []);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const set = useCallback(<K extends keyof Patch>(key: K, value: Patch[K]) => {
    if (patchRef.current[key] === value) return;
    synth.set(key, value);
    commit({ ...patchRef.current, [key]: value });
  }, [synth, commit]);

  const setPatch = useCallback((p: Patch) => {
    synth.setPatch(p);
    patchRef.current = p;
    setPatchState(p);
  }, [synth]);

  const noteOn = useCallback((midi: number, velocity = 0.8) => {
    unlockAudio().catch(() => undefined);
    synth.start().catch(() => undefined);
    if (holdRef.current && latched.current.has(midi)) {
      // pressing a latched key again lets it go
      latched.current.delete(midi);
      synth.noteOff(midi);
      setHandHeld(new Set([...down.current, ...latched.current]));
      emit({ midi, on: false, loop: false });
      return;
    }
    down.current.add(midi);
    if (holdRef.current) latched.current.add(midi);
    synth.noteOn(midi, velocity);
    setHandHeld(new Set([...down.current, ...latched.current]));
    emit({ midi, on: true, loop: false });
  }, [synth]);

  const noteOff = useCallback((midi: number) => {
    if (!down.current.delete(midi)) return;
    if (!holdRef.current) {
      synth.noteOff(midi);
      emit({ midi, on: false, loop: false });
    }
    setHandHeld(new Set([...down.current, ...latched.current]));
  }, [synth]);

  const setHold = useCallback((on: boolean) => {
    holdRef.current = on;
    setHoldState(on);
    if (!on) {
      for (const m of latched.current) if (!down.current.has(m)) {
        synth.noteOff(m);
        emit({ midi: m, on: false, loop: false });
      }
      latched.current.clear();
      setHandHeld(new Set(down.current));
    }
  }, [synth]);

  useEffect(() => {
    player.onNote = (midi, on) => {
      setLoopHeld(prev => {
        const next = new Set(prev);
        if (on) next.add(midi);
        else next.delete(midi);
        return next;
      });
      emit({ midi, on, loop: true });
    };
  }, [player]);

  const playLoop = useCallback((id: LoopId | null) => {
    if (id === null) {
      player.stop();
      setLoopHeld(new Set());
      setLoop(null);
      return;
    }
    unlockAudio().catch(() => undefined);
    synth.start().then(() => {
      player.play(id, rootRef.current);
      setLoop(id);
    }).catch(() => undefined);
  }, [player, synth]);

  useEffect(() => {
    if (loop) player.update(loop, root);
  }, [root, loop, player]);

  // MIDI keyboards
  useEffect(() => onMidiNote(e => (e.type === 'on' ? noteOn(e.midi, Math.max(0.2, e.velocity)) : noteOff(e.midi))), [noteOn, noteOff]);

  // the computer keyboard (A = the keyboard's root, Z/X shift octaves)
  const keyboard = opts.keyboard !== false;
  useEffect(() => {
    if (!keyboard) return;
    const codes = new Map<string, number>();
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      if (e.code === 'KeyZ' || e.code === 'KeyX') {
        setRoot(r => Math.min(84, Math.max(24, r + (e.code === 'KeyZ' ? -12 : 12))));
        return;
      }
      const midi = keyboardToMidi(e.code, (rootRef.current - 60) / 12);
      if (midi === null) return;
      e.preventDefault();
      codes.set(e.code, midi);
      noteOn(midi, 0.8);
    };
    const onUp = (e: KeyboardEvent) => {
      const midi = codes.get(e.code);
      if (midi === undefined) return;
      codes.delete(e.code);
      noteOff(midi);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      for (const m of codes.values()) noteOff(m);
    };
  }, [keyboard, noteOn, noteOff]);

  const onNote = useCallback((cb: (e: NoteEvent) => void) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const silence = useCallback(() => {
    player.stop();
    setLoop(null);
    setLoopHeld(new Set());
    holdRef.current = false;
    setHoldState(false);
    latched.current.clear();
    down.current.clear();
    setHandHeld(new Set());
    synth.allOff();
    synth.stopClip();
  }, [player, synth]);

  const held = useMemo(() => new Set([...handHeld, ...loopHeld]), [handHeld, loopHeld]);

  return { patch, set, setPatch, held, active, noteOn, noteOff, hold, setHold, loop, playLoop, root, setRoot, synth, onNote, silence };
}
