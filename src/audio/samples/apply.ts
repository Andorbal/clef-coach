/**
 * Apply the device's sound settings: the memory budget for samples, and the sampled
 * sound (if any) each of the player's instruments uses instead of — or with — the
 * built-in one.
 */
import { MALLET_VARIANTS, type SynthVoiceId } from '../../music/instruments';
import { defaultSampleBudgetMB } from '../../platform';
import type { SoundChoice, SoundSettings } from '../../perform/sinks';
import { synth } from '../synth';
import { gmSampler, samplerFor } from './manager';
import { sampleBudget, setSampleBudget } from './sampler';

const VOICES: SynthVoiceId[] = ['piano', 'epiano', 'guitar', 'ukulele', 'bass', 'marimba', 'xylophone', 'glockenspiel', 'vibraphone'];

/** The GM program closest to each of the app's instruments (for "use the bank's own"). */
export const VOICE_PROGRAM: Record<SynthVoiceId, number> = {
  piano: 1,
  epiano: 5,
  guitar: 26,
  ukulele: 25,
  bass: 34,
  marimba: 13,
  xylophone: 14,
  glockenspiel: 10,
  vibraphone: 12,
};

let applied = '';

export function applySoundSettings(settings: SoundSettings | undefined): void {
  const s = settings ?? {};
  setSampleBudget(s.memoryMB === 0 ? Infinity : (s.memoryMB ?? defaultSampleBudgetMB()) * 1024 * 1024);
  const key = JSON.stringify(s.instruments ?? {});
  if (key === applied) return;
  applied = key;
  for (const voice of VOICES) {
    const choice: SoundChoice | undefined = s.instruments?.[voice];
    // (MIDI out is for the band; your own instrument stays in the app)
    if (!choice || choice.source === 'builtin' || choice.source === 'midi') {
      synth.setExternal(voice, null);
      continue;
    }
    const sampler = choice.source === 'gm' ? gmSampler(choice.bankId, VOICE_PROGRAM[voice], false) : samplerFor(choice.bankId, choice.bank, choice.program);
    void sampler.then(smp => {
      // the settings may have changed while the bank opened
      if (applied !== key) return;
      if (!smp) {
        synth.setExternal(voice, null);
        return;
      }
      synth.setExternal(
        voice,
        {
          noteOn: (midi, velocity, when, out) => smp.noteOn(midi, velocity, when, out),
          prepare: notes => smp.prepare(notes),
        },
        !!choice.layer,
      );
      // the middle of the instrument straight away, so the first notes play sampled — or,
      // with memory to spare, the whole keyboard at every velocity
      const offset = voice in MALLET_VARIANTS ? MALLET_VARIANTS[voice as keyof typeof MALLET_VARIANTS].offset : 0;
      const roomy = sampleBudget() >= 2048 * 1024 * 1024;
      const notes = roomy
        ? Array.from({ length: 88 }, (_, i) => [0.2, 0.5, 0.8, 1].map(velocity => ({ midi: 21 + i, velocity }))).flat()
        : Array.from({ length: 25 }, (_, i) => ({ midi: 48 + i + offset, velocity: 0.7 }));
      void smp.prepare(notes);
    });
  }
}
