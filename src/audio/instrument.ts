/**
 * Point the audio system at the instrument being played: the synth voice used for
 * on-screen taps and demos, the microphone's note range, and (for xylophone and
 * glockenspiel) the octave shift between what the microphone hears and the
 * written notes.
 */
import { useEffect } from 'react';
import { type InstrumentId, type InstrumentPrefs, inputOffsetFor, micRangeFor, voiceFor } from '../music/instruments';
import { inputManager } from './input/manager';
import { micInput } from './input/mic';
import { synth } from './synth';

export function applyInstrument(id: InstrumentId, prefs: InstrumentPrefs = {}): void {
  synth.setVoice(voiceFor(id, prefs));
  const [lo, hi] = micRangeFor(id, prefs);
  micInput.setNoteRange(lo, hi);
  inputManager.setTranspose(-inputOffsetFor(id, prefs));
}

/** Apply an instrument for as long as a screen is mounted (and whenever it changes). */
export function useInstrumentAudio(id: InstrumentId | null | undefined, prefs: InstrumentPrefs = {}): void {
  const { malletVariant, ukuleleTuning, bassStrings } = prefs;
  useEffect(() => {
    if (!id) return;
    applyInstrument(id, { malletVariant, ukuleleTuning, bassStrings });
  }, [id, malletVariant, ukuleleTuning, bassStrings]);
}
