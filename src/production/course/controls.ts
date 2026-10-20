/**
 * The console's sections, and which settings a lesson's controls show. A lesson lists
 * sections (`bass:fader`, `*:eq`, `master:limiter`) or single settings (`lead:midGain`);
 * the console shows a strip's section when any of its settings is visible, and within it
 * only the visible ones.
 */
import { CHANNEL_PARAMS, FX_PARAMS, MASTER_PARAMS } from '../dsp/params';
import type { ControlId } from './types';

export type ChannelSection = 'trim' | 'hp' | 'eq' | 'comp' | 'fader' | 'pan' | 'mute' | 'solo' | 'reverb' | 'delay';
export type MasterSection = 'comp' | 'limiter' | 'fader' | 'mono';
export type FxSection = 'reverb' | 'delay';

export const CHANNEL_SECTIONS: Record<ChannelSection, readonly (keyof typeof CHANNEL_PARAMS)[]> = {
  trim: ['gain'],
  hp: ['hpOn', 'hpFreq'],
  eq: ['eqOn', 'lowFreq', 'lowGain', 'midFreq', 'midGain', 'midQ', 'presFreq', 'presGain', 'presQ', 'highFreq', 'highGain'],
  comp: ['compOn', 'threshold', 'ratio', 'attack', 'release', 'makeup'],
  fader: ['fader'],
  pan: ['pan'],
  mute: ['mute'],
  solo: ['solo'],
  reverb: ['reverb'],
  delay: ['delay'],
};

export const MASTER_SECTIONS: Record<MasterSection, readonly (keyof typeof MASTER_PARAMS)[]> = {
  comp: ['compOn', 'threshold', 'ratio', 'attack', 'release', 'makeup'],
  limiter: ['limitOn', 'drive', 'ceiling'],
  fader: ['fader'],
  mono: ['mono'],
};

export const FX_SECTIONS: Record<FxSection, readonly (keyof typeof FX_PARAMS)[]> = {
  reverb: ['reverbSize', 'reverbPredelay', 'reverbTone', 'reverbLevel'],
  delay: ['delayBeats', 'delayFeedback', 'delayTone', 'delayLevel'],
};

/** The settings (mix keys) a list of controls shows, for these channels. */
export function expandControls(ids: readonly ControlId[], channels: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const [scope, what] = id.split(':');
    if (scope === 'master') {
      const sec = MASTER_SECTIONS[what as MasterSection];
      if (sec) sec.forEach(p => out.add(`master:${p}`));
      else if (what in MASTER_PARAMS) out.add(id);
      else throw new Error(`Unknown control "${id}"`);
      continue;
    }
    if (scope === 'fx') {
      const sec = FX_SECTIONS[what as FxSection];
      if (sec) sec.forEach(p => out.add(`fx:${p}`));
      else if (what in FX_PARAMS) out.add(id);
      else throw new Error(`Unknown control "${id}"`);
      continue;
    }
    const chans = scope === '*' ? channels : [scope];
    const sec = CHANNEL_SECTIONS[what as ChannelSection];
    if (!sec && !(what in CHANNEL_PARAMS)) throw new Error(`Unknown control "${id}"`);
    for (const ch of chans) {
      if (!channels.includes(ch)) throw new Error(`Control "${id}" names a channel the lesson doesn't have`);
      if (sec) sec.forEach(p => out.add(`${ch}:${p}`));
      else out.add(`${ch}:${what}`);
    }
  }
  return out;
}

/** The section a setting belongs to. */
export function sectionOf(key: string): string {
  const [scope, p] = key.split(':');
  const table: Record<string, readonly string[]> = scope === 'master' ? MASTER_SECTIONS : scope === 'fx' ? FX_SECTIONS : CHANNEL_SECTIONS;
  return Object.entries(table).find(([, ps]) => ps.includes(p))?.[0] ?? p;
}
