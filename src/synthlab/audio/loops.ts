/**
 * Loops: short patterns the lab plays over and over so both hands are free for the knobs,
 * which is how sound designers actually work. Scheduled ahead on the audio clock (a 25 ms
 * timer looking 120 ms ahead, like the metronome), at the lab's tempo of 120 BPM.
 *
 * The page hears about each note as it sounds (onNote, from a timer set to its time) so
 * the keyboard can light the keys: a handful of state changes a second, not a frame loop.
 */
import { getAudioContext } from '../../audio/context';
import { BEAT_SECONDS } from '../dsp/params';
import type { LabSynth } from './host';

export type LoopId = 'pulse' | 'chord' | 'bass' | 'arp' | 'lead' | 'stabs';

interface LoopNote {
  /** Beat it starts on. */
  beat: number;
  /** Beats held. */
  len: number;
  /** Semitones from the root. */
  st: number;
}

export interface LoopDef {
  id: LoopId;
  label: string;
  /** Pattern length in beats. */
  beats: number;
  notes: LoopNote[];
  /** Where it sits: added to the keyboard's root. */
  octave: number;
}

const n = (beat: number, len: number, st: number): LoopNote => ({ beat, len, st });

export const LOOPS: readonly LoopDef[] = [
  { id: 'pulse', label: 'Single note', beats: 4, octave: 0, notes: [n(0, 1.5, 0), n(2, 1.5, 0)] },
  { id: 'chord', label: 'Chords', beats: 8, octave: 0, notes: [0, 4, 7, 11].map(st => n(0, 3.5, st)).concat([-3, 0, 4, 7].map(st => n(4, 3.5, st))) },
  {
    id: 'bass',
    label: 'Bassline',
    beats: 4,
    octave: -12,
    notes: [n(0, 0.4, 0), n(0.5, 0.4, 0), n(1, 0.4, 12), n(1.5, 0.4, 0), n(2, 0.4, 3), n(2.5, 0.4, 0), n(3, 0.4, 5), n(3.5, 0.4, 7)],
  },
  { id: 'arp', label: 'Arpeggio', beats: 4, octave: 0, notes: [0, 4, 7, 12, 16, 12, 7, 4].flatMap((st, i) => [n(i * 0.5, 0.35, st)]) },
  {
    id: 'lead',
    label: 'Legato line',
    beats: 8,
    octave: 12,
    // overlapping notes: in Legato mode these slide (glide)
    notes: [n(0, 1.1, 0), n(1, 0.6, 3), n(1.5, 1.1, 5), n(2.5, 1.6, 7), n(4, 1.1, 10), n(5, 1.1, 7), n(6, 1.6, 3)],
  },
  { id: 'stabs', label: 'Stabs', beats: 4, octave: 0, notes: [0, 0.75, 1.5, 2.5, 3.25].flatMap(b => [0, 3, 7].map(st => n(b, 0.2, st))) },
];

export function getLoop(id: LoopId): LoopDef {
  return LOOPS.find(l => l.id === id) ?? LOOPS[0];
}

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

export class LoopPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Bumped on every stop, so note lights from an old run are ignored. */
  private gen = 0;
  private start = 0;
  /** Next pattern repetition to schedule, and the index of its next note. */
  private rep = 0;
  private idx = 0;
  private loop: LoopDef = LOOPS[0];
  private root = 48;
  private readonly synth: LabSynth;
  onNote: (midi: number, on: boolean) => void = () => undefined;

  constructor(synth: LabSynth) {
    this.synth = synth;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  play(id: LoopId, root: number): void {
    this.stop();
    this.loop = getLoop(id);
    this.root = root;
    this.start = getAudioContext().currentTime + 0.08;
    this.rep = 0;
    this.idx = 0;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  /** Change pattern or root without a gap (from the next repetition). */
  update(id: LoopId, root: number): void {
    if (!this.playing) return;
    if (id !== this.loop.id) this.play(id, root);
    else this.root = root;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.gen++;
    this.synth.cancelScheduled();
  }

  private schedule(): void {
    const ctx = getAudioContext();
    const horizon = ctx.currentTime + LOOKAHEAD;
    const notes = [...this.loop.notes].sort((a, b) => a.beat - b.beat);
    const repLen = this.loop.beats * BEAT_SECONDS;
    for (;;) {
      if (this.idx >= notes.length) {
        this.idx = 0;
        this.rep++;
      }
      const x = notes[this.idx];
      const t = this.start + this.rep * repLen + x.beat * BEAT_SECONDS;
      if (t > horizon) break;
      const midi = this.root + this.loop.octave + x.st;
      const off = t + x.len * BEAT_SECONDS;
      if (t >= ctx.currentTime - 0.01) {
        this.synth.noteOn(midi, 0.8, t);
        this.synth.noteOff(midi, off);
        const delay = (t - ctx.currentTime) * 1000;
        const gen = this.gen;
        setTimeout(() => gen === this.gen && this.onNote(midi, true), delay);
        setTimeout(() => gen === this.gen && this.onNote(midi, false), delay + x.len * BEAT_SECONDS * 1000);
      }
      this.idx++;
    }
  }
}
