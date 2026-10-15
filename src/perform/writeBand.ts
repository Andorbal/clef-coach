/**
 * Write a band — the arranger's, usually — into the song as band parts, in the note
 * language, so it can be kept, shared and edited by hand like any part.
 *
 * Arranged notes sit on the song's own grid already (patterns are sixteenths or
 * triplet eighths), so writing them is laying them out bar by bar: notes struck
 * together become chords, each lasting until the next onset (a broken chord's ringing
 * notes are written as played, not as held), split at bar lines with ties.
 */
import { type BandPartDef, type BandRole, bandClef } from '../music/band';
import { pitchesToDrumWords } from '../music/gm';
import { PPQ } from '../music/rhythm';
import { type Score, keyAt, measureLengths, timeAt } from '../music/score';
import { type TimedNote, buildVoice, drumVoice, makeLayout, measureAt, spellInKey, writeVoice } from '../songs/importkit';
import type { PerfTrack } from './types';

/** Written note ends fall on thirty-second notes. */
const GRID = PPQ / 8;

export function tracksToBandParts(tracks: PerfTrack[], score: Score): BandPartDef[] {
  const lens = measureLengths(score.time, score.measures, score.pickup, score.changes);
  const layout = makeLayout(lens.map((len, m) => ({ len, time: timeAt(score, m), key: keyAt(score, m) })));
  const parts: BandPartDef[] = [];
  for (const t of tracks) {
    if (t.source === 'part' || !t.notes.length) continue;
    let timed: TimedNote[];
    if (t.drums) timed = drumVoice(t.notes.map(n => ({ start: n.tick, key: n.midi })), layout);
    else {
      const byStart = new Map<number, number[]>();
      const ends = new Map<number, number>();
      for (const n of t.notes) {
        (byStart.get(n.tick) ?? byStart.set(n.tick, []).get(n.tick)!).push(n.midi);
        ends.set(n.tick, Math.max(ends.get(n.tick) ?? 0, n.tick + n.ticks));
      }
      const starts = [...byStart.keys()].sort((a, b) => a - b);
      timed = starts.map((s, i) => {
        const key = layout.keys[measureAt(layout, s)];
        const midis = [...new Set(byStart.get(s)!)].sort((a, b) => a - b);
        // played notes stop a hair early; written ones end on the grid (legato into a near next note)
        const next = starts[i + 1] ?? Infinity;
        let end = Math.min(ends.get(s)!, next);
        end = next - end < PPQ / 4 ? next : Math.round(end / GRID) * GRID;
        if (end <= s) end = Math.min(next, s + GRID);
        return { start: s, end, pitches: midis.map(m => spellInKey(m, key)) };
      });
    }
    const text = writeVoice(buildVoice(timed, layout).specs, layout);
    const lowest = Math.min(...t.notes.map(n => n.midi));
    const part: BandPartDef = {
      name: t.name,
      program: t.program,
      staves: [{ clef: bandClef(t.program, t.drums, lowest), voices: [t.drums ? pitchesToDrumWords(text) : text] }],
      volume: Math.round(t.volume * 100) / 100,
      pan: Math.round(t.pan * 100) / 100,
    };
    if (t.drums) part.drums = true;
    if (t.role !== 'part') part.role = t.role as BandRole;
    parts.push(part);
  }
  return parts;
}
