import { useEffect, useState, useSyncExternalStore } from 'react';
import { type MidiOutputInfo, midiOutputs, onMidiOutputsChanged } from '../midiOut';
import { banksSnapshot, bankPresets, subscribeBanks } from './manager';
import { onSampleMemory, sampleMemory } from './sampler';
import type { BankRecord } from './store';
import type { SamplePreset } from './types';

/** The sound banks on this device (re-renders when one is added or removed). */
export function useSoundBanks(): BankRecord[] {
  return useSyncExternalStore(subscribeBanks, banksSnapshot, banksSnapshot);
}

/** Bytes of decoded samples in memory, live. */
export function useSampleMemory(): number {
  return useSyncExternalStore(onSampleMemory, sampleMemory, sampleMemory);
}

/** Every bank's presets (opened in the background), for sound pickers. */
export function useBankPresets(banks: BankRecord[]): Record<string, SamplePreset[]> {
  const [presets, setPresets] = useState<Record<string, SamplePreset[]>>({});
  const ids = banks.map(b => b.id).join(',');
  useEffect(() => {
    let live = true;
    for (const b of banks) {
      bankPresets(b.id)
        .then(list => live && setPresets(p => ({ ...p, [b.id]: list })))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return presets;
}

/** MIDI outputs the band could play through (empty until MIDI access is granted). */
export function useMidiOutputs(): MidiOutputInfo[] {
  return useSyncExternalStore(onMidiOutputsChanged, midiOutputs, midiOutputs);
}
