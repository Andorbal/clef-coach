import { useEffect, useRef, useState } from 'react';
import { inputManager } from '../audio/input/manager';
import { keyboardToMidi } from '../audio/input/manager';
import type { NoteInputEvent } from '../audio/input/types';

/** Subscribe to note input from every source (MIDI, mic, on-screen, computer keyboard). */
export function useNoteInput(handler: (e: NoteInputEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return inputManager.subscribe(e => ref.current(e));
  }, [enabled]);
}

/** Currently held notes (re-renders on change). */
export function useHeldNotes(): ReadonlySet<number> {
  const [held, setHeld] = useState<ReadonlySet<number>>(() => new Set(inputManager.getHeld()));
  useEffect(
    () =>
      inputManager.subscribe(() => {
        setHeld(new Set(inputManager.getHeld()));
      }),
    [],
  );
  return held;
}

/**
 * Computer keyboard → piano notes (DAW layout: A W S E D F T G Y H U J K).
 * Z / X shift octaves. Disabled while typing in inputs.
 */
export function useComputerPiano(enabled: boolean, baseOctave: number) {
  const octave = useRef(baseOctave);
  useEffect(() => {
    octave.current = baseOctave;
  }, [baseOctave]);
  useEffect(() => {
    if (!enabled) return;
    const down = new Map<string, number>();
    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      if (e.code === 'KeyZ') {
        octave.current = Math.max(1, octave.current - 1);
        return;
      }
      if (e.code === 'KeyX') {
        octave.current = Math.min(7, octave.current + 1);
        return;
      }
      const midi = keyboardToMidi(e.code, octave.current - 4);
      if (midi === null) return;
      e.preventDefault();
      down.set(e.code, midi);
      inputManager.emit({ type: 'on', midi, velocity: 0.75, time: performance.now(), source: 'keyboard' });
    };
    const onUp = (e: KeyboardEvent) => {
      const midi = down.get(e.code);
      if (midi === undefined) return;
      down.delete(e.code);
      inputManager.emit({ type: 'off', midi, velocity: 0, time: performance.now(), source: 'keyboard' });
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      for (const midi of down.values()) inputManager.emit({ type: 'off', midi, velocity: 0, time: performance.now(), source: 'keyboard' });
    };
  }, [enabled]);
}

/** Letter keys A–G (plus shift = sharp, alt/option = flat) for naming drills. */
export function useLetterKeys(enabled: boolean, onLetter: (letter: string, alter: number) => void) {
  const ref = useRef(onLetter);
  ref.current = onLetter;
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const m = /^Key([A-G])$/.exec(e.code);
      if (!m) return;
      e.preventDefault();
      ref.current(m[1], e.shiftKey ? 1 : e.altKey ? -1 : 0);
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [enabled]);
}

/** Number keys 1–9 for multiple-choice answers. */
export function useNumberKeys(enabled: boolean, onNumber: (n: number) => void) {
  const ref = useRef(onNumber);
  ref.current = onNumber;
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      const m = /^Digit([1-9])$/.exec(e.code);
      if (!m) return;
      ref.current(parseInt(m[1], 10));
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [enabled]);
}
