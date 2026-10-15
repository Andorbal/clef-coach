/**
 * A song's band in the Song Studio: its arrangement, the player's choices for it
 * (saved per song on this device), a performer for practice runs and "listen with the
 * band".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext, unlockAudio } from '../audio/context';
import { voiceOffset } from '../audio/synth/engine';
import type { BandStyle } from '../music/band';
import { type InstrumentId, type InstrumentPrefs, instrumentName, voiceFor } from '../music/instruments';
import type { SongDef } from '../music/parse';
import { PPQ } from '../music/rhythm';
import { type Score, measureStartTick, sliceScore } from '../music/score';
import { useApp } from '../state/store';
import type { SongBandPrefs } from '../state/types';
import { type BandSource, buildBand, defaultSource, partTrack, sliceTracks } from './arranger';
import { type BandMix, DEFAULT_MIX, Performer } from './performer';
import { sinkFactory } from './sinks';
import type { Arrangement, PerfTrack } from './types';

export interface Passage {
  /** 1-based measures, inclusive */
  from: number;
  to: number;
}

const EMPTY: SongBandPrefs = {};

export function useBand(song: SongDef | undefined, score: Score | null, opts: { player: InstrumentId; strumming: boolean; prefs: InstrumentPrefs }) {
  const songId = song?.id ?? '';
  const prefs = useApp(s => s.device.bands?.[songId] ?? EMPTY);
  const updateDevice = useApp(s => s.updateDevice);
  const setPrefs = useCallback(
    (patch: Partial<SongBandPrefs>) => {
      const all = useApp.getState().device.bands ?? {};
      updateDevice({ bands: { ...all, [songId]: { ...all[songId], ...patch } } });
    },
    [songId, updateDevice],
  );
  const source: BandSource = prefs.source && (prefs.source === 'auto' || song?.band?.length) ? prefs.source : song ? defaultSource(song) : 'auto';
  const style: BandStyle = prefs.style ?? song?.style ?? 'auto';
  const mix: BandMix = prefs.mix ?? DEFAULT_MIX;

  const arrangement = useMemo<Arrangement | null>(() => {
    if (!song || !score) return null;
    try {
      return buildBand(song, score, { source, style, player: opts.player, strumming: opts.strumming });
    } catch (e) {
      console.warn('The band could not be arranged', e);
      return null;
    }
  }, [song, score, source, style, opts.player, opts.strumming]);

  const sounds = prefs.sounds;
  const soundSettings = useApp(s => s.device.sounds);
  const factory = useMemo(() => sinkFactory(sounds ?? {}, soundSettings ?? {}), [sounds, soundSettings]);
  const performer = useMemo(() => new Performer(), []);
  const listener = useMemo(() => new Performer(), []);
  useEffect(() => {
    performer.setFactory(factory);
    listener.setFactory(factory);
  }, [factory, performer, listener]);
  useEffect(() => () => performer.dispose(), [performer]);
  useEffect(() => () => listener.dispose(), [listener]);
  // mixer changes are heard straight away
  useEffect(() => {
    performer.setMix(mix);
    listener.setMix(mix);
  }, [mix, performer, listener]);

  // get the band's sounds ready in the background, so the first Listen or Perform starts at once
  useEffect(() => {
    if (!arrangement?.tracks.length) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || listener.playing || performer.playing) return;
      try {
        const warm = new Performer(factory);
        warm.load(arrangement.tracks, mix, { swing: arrangement.swing });
        void warm.prepare().finally(() => warm.dispose(false));
      } catch {
        /* no audio: nothing to warm */
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // the mix doesn't change which sounds are needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement, factory]);

  /** The band's tracks for a passage, from its first tick. */
  const tracksFor = useCallback(
    (p: Passage): PerfTrack[] => {
      if (!arrangement || !score) return [];
      return sliceTracks(arrangement.tracks, measureStartTick(score, p.from - 1), measureStartTick(score, p.to));
    },
    [arrangement, score],
  );

  /** Ticks from a beat to the passage's first tick (the swing needs it). */
  const beatOffset = useCallback((p: Passage) => (score ? measureStartTick(score, p.from - 1) - (score.pickup ?? 0) : 0), [score]);

  /** Load the band for a practice run of a passage. */
  const forRun = useCallback(
    (p: Passage): Performer | undefined => {
      if (!arrangement?.tracks.length) return undefined;
      performer.load(tracksFor(p), mix, { swing: arrangement.swing });
      void performer.prepare();
      return performer;
    },
    [arrangement, performer, tracksFor, mix],
  );

  // ---- listen with the band (the app plays the part too)
  const [listening, setListening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useRef(0);
  const stopListening = useCallback(() => {
    token.current++;
    listener.stop();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setListening(false);
  }, [listener]);
  useEffect(() => stopListening, [stopListening]);

  const listen = useCallback(
    async (p: Passage, tempoPct: number) => {
      if (!song || !score || !arrangement) return;
      stopListening();
      const mine = token.current;
      setListening(true);
      await unlockAudio();
      if (mine !== token.current) return;
      const voice = voiceFor(song.instrument, opts.prefs);
      // the part is written pitch (mallets), the band plays sounding pitch
      const part = partTrack(sliceScore(score, p.from - 1, p.to - 1), 0, `Your part (${instrumentName(song.instrument, opts.prefs)})`);
      const offset = voiceOffset(voice);
      part.notes = part.notes.map(n => ({ ...n, midi: n.midi + offset }));
      part.sound = { kind: 'rendered', voice, offset };
      listener.load([...tracksFor(p), part], mix, { swing: arrangement.swing });
      await listener.prepare();
      if (mine !== token.current) return;
      const secPerTick = 60 / ((song.tempo * tempoPct) / 100) / PPQ;
      const t0 = getAudioContext().currentTime + 0.2;
      listener.start(t0, secPerTick, { beatOffset: beatOffset(p) });
      timer.current = setTimeout(() => {
        if (mine === token.current) setListening(false);
      }, Math.max(0, (listener.endTime - getAudioContext().currentTime) * 1000) + 400);
    },
    [song, score, arrangement, opts.prefs, listener, tracksFor, mix, beatOffset, stopListening],
  );

  return { arrangement, prefs, setPrefs, source, style, mix, forRun, beatOffset, listening, listen, stopListening };
}

export type BandControls = ReturnType<typeof useBand>;
