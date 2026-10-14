import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext, unlockAudio } from '../audio/context';
import { synth } from '../audio/synth';
import type { SequenceEvent, SequenceHandle, SynthVoice } from '../audio/synth';

/**
 * A "Listen" button's playback. One at a time: playing again replaces what was playing
 * (no stacked copies), `playing` stays true until the music has finished or stop() is
 * called (so the button can read "Stop" meanwhile), and leaving the screen stops it.
 */
export function useListen() {
  const handle = useRef<SequenceHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** bumped by every play/stop, so a play still waiting for audio to wake knows it was cancelled */
  const token = useRef(0);
  const [playing, setPlaying] = useState(false);

  const halt = useCallback(() => {
    token.current++;
    handle.current?.stop();
    handle.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const stop = useCallback(() => {
    halt();
    setPlaying(false);
  }, [halt]);

  const play = useCallback(
    async (events: SequenceEvent[], voice?: SynthVoice) => {
      halt();
      const mine = token.current;
      setPlaying(true);
      await unlockAudio();
      if (mine !== token.current) return;
      const h = synth.playSequence(events, voice);
      handle.current = h;
      // back to "Listen" once the last note has been released (plus a little ring)
      const ms = Math.max(0, (h.endTime - getAudioContext().currentTime) * 1000) + 250;
      timer.current = setTimeout(() => {
        if (handle.current !== h) return;
        handle.current = null;
        timer.current = null;
        setPlaying(false);
      }, ms);
    },
    [halt],
  );

  useEffect(() => halt, [halt]);

  return { playing, play, stop };
}
