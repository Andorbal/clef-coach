/**
 * useConsole: a screen's handle on the live console. The learner's mix as React state,
 * controls that change the sound at once, the transport, and auditioning: hearing another
 * mix (the quiz's target, a "before and after", A and B) on the same loop without
 * touching the learner's settings.
 *
 * A fader drag can fire 120 events a second; the console hears every one, but React state
 * is committed at most once a frame. Meters never go through React: components subscribe
 * (`onMeters`) and move their bars directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import type { MeterSnapshot } from '../dsp/mixer';
import { type Mix, gainToDb, makeMix } from '../dsp/params';
import { getSession } from '../dsp/sessions';
import { type ChannelUse, type Track, resolveTracks } from '../dsp/stems';
import { type Studio, getStudio, retainStudio } from '../audio/host';
import type { MeterState } from '../course/build';

export interface ConsoleApi {
  studio: Studio;
  session: string;
  /** The lesson's tracks as it names them (for the judge). */
  uses: (string | ChannelUse)[] | undefined;
  tracks: Track[];
  channels: string[];
  tempo: number;
  /** The learner's mix. */
  mix: Mix;
  /** The mix as it is right now (`mix` catches up on the next frame). */
  getMix: () => Mix;
  set: (key: string, value: number) => void;
  /** Replace the learner's mix (a step's starting point). */
  reset: (mix: Mix) => void;
  /** What's heard: null for the learner's mix, or a name ("Target", "A"). */
  audition: string | null;
  /** Hear another mix on the loop (null: back to the learner's). */
  hearMix: (name: string | null, mix?: Mix) => void;
  playing: boolean;
  /** Something is still sounding (playing, or a tail ringing out). */
  sounding: boolean;
  play: (from?: number) => Promise<void>;
  stop: () => void;
  /** Tracks rendered and on the console. */
  ready: boolean;
  error: string | null;
  onMeters: (cb: (m: MeterSnapshot) => void) => () => void;
  /** The meters lately, as explore tasks read them. */
  meterState: () => MeterState | null;
}

/** Peaks and loudness over the last second or so, from the meter reports. */
function trackMeters(): { add: (m: MeterSnapshot) => void; get: () => MeterState | null; clear: () => void } {
  let recent: MeterSnapshot[] = [];
  return {
    add: m => {
      recent.push(m);
      if (recent.length > 20) recent.shift();
    },
    clear: () => {
      recent = [];
    },
    get: () => {
      if (!recent.length) return null;
      const last = recent[recent.length - 1];
      const input: Record<string, number> = {};
      const reduction: Record<string, number> = {};
      for (const id of Object.keys(last.channels)) {
        input[id] = gainToDb(Math.max(...recent.map(m => m.channels[id]?.input ?? 0)));
        reduction[id] = Math.max(...recent.map(m => m.channels[id]?.reduction ?? 0));
      }
      return {
        masterPeak: gainToDb(Math.max(...recent.map(m => Math.max(m.master.peakL, m.master.peakR)))),
        loudness: last.master.shortTerm,
        clipped: recent.some(m => m.master.clipped),
        input,
        reduction,
      };
    },
  };
}

export function useConsole(o: { session: string; channels?: (string | ChannelUse)[]; start: Mix }): ConsoleApi {
  const studio = getStudio();
  const session = getSession(o.session);
  const tracks = useMemo(() => resolveTracks(session, o.channels), [session, o.channels]);
  const channels = useMemo(() => tracks.map(t => t.id), [tracks]);
  const [mix, setMixState] = useState<Mix>(() => makeMix(channels, session.rough, o.start));
  const mixRef = useRef(mix);
  const raf = useRef<number | null>(null);
  const [audition, setAudition] = useState<string | null>(null);
  const auditionRef = useRef<string | null>(null);
  const [state, setState] = useState({ playing: false, sounding: false });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meters] = useState(trackMeters);

  useEffect(() => {
    const release = retainStudio();
    const offState = studio.onState(setState);
    const offMeters = studio.onMeters(meters.add);
    return () => {
      offState();
      offMeters();
      release();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [studio, meters]);

  // the session's tracks onto the console
  const loadKey = JSON.stringify([o.session, o.channels ?? null]);
  useEffect(() => {
    let live = true;
    setReady(false);
    setError(null);
    studio.pause();
    studio.setMix(mixRef.current);
    studio
      .load({ session: o.session, channels: o.channels }, channels, session.tempo)
      .then(() => live && setReady(true))
      .catch(e => {
        console.error(e);
        if (live) setError('The tracks didn’t load. Try again?');
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const commit = useCallback(() => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      setMixState(mixRef.current);
    });
  }, []);

  const set = useCallback(
    (key: string, value: number) => {
      if (mixRef.current[key] === value) return;
      mixRef.current = { ...mixRef.current, [key]: value };
      // while another mix is being auditioned, the learner's change waits to be heard
      if (auditionRef.current === null) studio.set(key, value);
      commit();
    },
    [studio, commit],
  );

  const reset = useCallback(
    (m: Mix) => {
      mixRef.current = makeMix(channels, m);
      setMixState(mixRef.current);
      auditionRef.current = null;
      setAudition(null);
      studio.setMix(mixRef.current);
    },
    [studio, channels],
  );

  const hearMix = useCallback(
    (name: string | null, m?: Mix) => {
      auditionRef.current = name;
      setAudition(name);
      studio.setMix(name === null || !m ? mixRef.current : makeMix(channels, m));
    },
    [studio, channels],
  );

  const play = useCallback(
    async (from?: number) => {
      await unlockAudio().catch(() => undefined);
      await studio.start();
      meters.clear();
      studio.play(from);
    },
    [studio, meters],
  );

  const stop = useCallback(() => studio.pause(), [studio]);
  const onMeters = useCallback((cb: (m: MeterSnapshot) => void) => studio.onMeters(cb), [studio]);
  const getMix = useCallback(() => mixRef.current, []);

  return useMemo(
    () => ({
      studio,
      session: o.session,
      uses: o.channels,
      tracks,
      channels,
      tempo: session.tempo,
      mix,
      getMix,
      set,
      reset,
      audition,
      hearMix,
      playing: state.playing,
      sounding: state.sounding,
      play,
      stop,
      ready,
      error,
      onMeters,
      meterState: meters.get,
    }),
    [studio, o.session, o.channels, tracks, channels, session.tempo, mix, getMix, set, reset, audition, hearMix, state, play, stop, ready, error, onMeters, meters],
  );
}
