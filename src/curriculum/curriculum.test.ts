import { type InstrumentId, MALLET_VARIANTS, instrumentDef, isFretted, tuningFor } from '../music/instruments';
import { describe, expect, it } from 'vitest';
import { TRACKS } from './index';
import { generateScore, genRhythm, makeRng, scaleScore } from './generate';
import { parseKey } from '../music/keys';
import { midiOf, parsePitch } from '../music/pitch';
import { parseVoice, songToScore } from '../music/parse';
import { scaleFingering } from '../music/fingering';
import { measureTicks } from '../music/rhythm';
import { getSong } from '../content/songs';
import type { ActivityDef, Insight } from './types';
import { buildSteps } from '../music/score';
import { chordPlayScore, chordShape } from './chordScore';
import { chordViews, parseChordRef, tryChord } from '../music/chordViews';
import { chordPcs, parseChordSymbol } from '../music/chords';

function visualNotes(v: Insight['visual']) {
  if (!v) return;
  if (v.kind === 'chord') {
    v.chords.forEach(c => expect(tryChord(c), `chord ${c}`).toBeTruthy());
    return;
  }
  if ('notes' in v && v.kind !== 'keys') {
    const text = v.notes.join(' ');
    parseVoice(/\//.test(text) ? text : text.replace(/^(\[[^\]]*\]|\S+)/, '$1/w'), v.kind === 'staff' && v.time ? v.time : [4, 4], 0, 'visual', true);
  }
  if (v.kind === 'keys') v.notes.forEach(parsePitch);
}

/** Range a track's notes must stay in (written pitch for mallets: the marimba's range; low-G ukulele). */
function rangeOf(instrument: InstrumentId): [number, number] {
  if (instrument === 'piano') return [21, 108];
  if (instrument === 'mallets') return [MALLET_VARIANTS.marimba.low, MALLET_VARIANTS.marimba.high];
  if (instrument === 'guitar') return [40, 88];
  const t = tuningFor(instrument, { ukuleleTuning: 'low-g', bassStrings: 4 }).open;
  return [Math.min(...t), Math.max(...t) + instrumentDef(instrument).fretted!.maxFret];
}

function checkActivity(a: ActivityDef, instrument: InstrumentId, where: string) {
  const range = rangeOf(instrument);
  const inRange = (s: string) => {
    const m = midiOf(parsePitch(s));
    expect(m, `${where}: ${s} out of instrument range`).toBeGreaterThanOrEqual(range[0]);
    expect(m, `${where}: ${s} out of instrument range`).toBeLessThanOrEqual(range[1]);
  };
  switch (a.type) {
    case 'meet':
      a.notes.forEach(inRange);
      if (a.frets) expect(a.frets.length, `${where}: frets per note`).toBe(a.notes.length);
      break;
    case 'name':
    case 'play':
      a.pool.forEach(inRange);
      if (a.key) parseKey(a.key);
      expect(a.count).toBeGreaterThan(0);
      break;
    case 'interval':
      a.pool.forEach(inRange);
      break;
    case 'read': {
      a.gen.pool.forEach(inRange);
      a.gen.accomp?.pool.forEach(inRange);
      parseKey(a.gen.key);
      for (let seed = 1; seed <= 6; seed++) {
        const s = generateScore(a.gen, makeRng(seed), instrument);
        const mt = measureTicks(s.time);
        for (const st of s.staves) for (const v of st.voices) {
          const per: number[] = [];
          for (const nn of v.notes) per[nn.measure] = (per[nn.measure] ?? 0) + nn.ticks;
          per.forEach(t => expect(t, `${where}: measure length`).toBe(mt));
          if (instrument === 'guitar') {
            for (const nn of v.notes) {
              if (nn.rest) continue;
              nn.strings?.forEach(x => expect(x, `${where}: string`).toBeGreaterThanOrEqual(1));
            }
          }
        }
        expect(buildSteps(s).length, `${where}: generated steps`).toBeGreaterThan(0);
      }
      break;
    }
    case 'piece':
      if (a.song) {
        const song = getSong(a.song);
        expect(song, `${where}: missing song ${a.song}`).toBeTruthy();
        if (song) expect(song.instrument, `${where}: song instrument`).toBe(instrument);
      } else if (a.inline) {
        songToScore({ id: 'inline', title: '', composer: '', instrument, level: 1, key: a.inline.key, time: a.inline.time, tempo: 80, pickup: a.inline.pickup, staves: a.inline.staves });
      } else throw new Error(`${where}: piece needs song or inline`);
      break;
    case 'scale':
      if (instrument === 'piano') {
        if (a.hands !== 'L') expect(scaleFingering(a.tonic, a.kind, 'R', a.octaves), `${where}: RH fingering for ${a.tonic} ${a.kind}`).toBeTruthy();
        if (a.hands !== 'R') expect(scaleFingering(a.tonic, a.kind, 'L', a.octaves), `${where}: LH fingering for ${a.tonic} ${a.kind}`).toBeTruthy();
      }
      scaleScore({ ...a, instrument });
      break;
    case 'keysig':
      a.keys.forEach(k => parseKey(k));
      break;
    case 'rhythm':
      genRhythm(makeRng(1), a.time, a.measures, a.cells);
      break;
    case 'fret-find':
    case 'fret-name':
    case 'fret-play':
    case 'fret-octave': {
      expect(isFretted(instrument), `${where}: fret activity needs a fretted instrument`).toBe(true);
      const strings = tuningFor(instrument, { ukuleleTuning: 'low-g', bassStrings: 4 }).open.length;
      a.strings.forEach(s => expect(s >= 1 && s <= strings, `${where}: string ${s}`).toBe(true));
      expect(a.frets[0]).toBeGreaterThanOrEqual(0);
      expect(a.frets[1]).toBeLessThanOrEqual(19);
      expect(a.frets[0]).toBeLessThanOrEqual(a.frets[1]);
      break;
    }
    case 'fret-shape':
      expect(isFretted(instrument), `${where}: fret activity needs a fretted instrument`).toBe(true);
      // CAGED shapes are guitar chord shapes
      if (a.shape.kind === 'caged') expect(instrument, `${where}: CAGED shape`).toBe('guitar');
      break;
    case 'chord-play': {
      if (a.song) {
        const song = getSong(a.song);
        expect(song, `${where}: missing song ${a.song}`).toBeTruthy();
        expect(song?.chords, `${where}: song has no chords`).toBeTruthy();
      } else {
        expect(a.chords?.length, `${where}: chords`).toBeGreaterThan(0);
        a.chords!.forEach(c => expect(tryChord(c), `${where}: chord ${c}`).toBeTruthy());
      }
      a.shapes?.forEach(c => expect(tryChord(c), `${where}: shape ${c}`).toBeTruthy());
      // every tuning the player might have
      const tunings = instrument === 'ukulele' ? (['high-g', 'low-g', 'baritone'] as const) : (['high-g'] as const);
      for (const ukuleleTuning of tunings) {
        const built = chordPlayScore(a, instrument, { ukuleleTuning });
        expect(built, `${where}: builds (${ukuleleTuning})`).toBeTruthy();
        expect(buildSteps(built!.score).length, `${where}: steps`).toBeGreaterThan(0);
      }
      // the chosen shapes exist in standard tuning
      for (const ref of [...(a.chords ?? []), ...(a.shapes ?? [])]) {
        const { symbol, chart } = parseChordRef(ref);
        if (!chart) continue;
        const shape = chordShape(ref, instrument);
        expect(shape?.notes.length, `${where}: ${ref}`).toBeGreaterThan(0);
        const pcs = new Set(chordPcs(parseChordSymbol(symbol)));
        shape!.notes.forEach(nn => expect(pcs.has(nn.midi % 12), `${where}: ${ref} note ${nn.name} is a chord tone`).toBe(true));
      }
      break;
    }
    case 'chord-quiz':
      expect(a.count).toBeGreaterThan(0);
      a.chords.forEach(c => {
        const ch = tryChord(c);
        expect(ch, `${where}: chord ${c}`).toBeTruthy();
        expect(chordViews(ch!, instrument, {}).length, `${where}: ${c} has a voicing`).toBeGreaterThan(0);
      });
      break;
    case 'tip':
      visualNotes(a.insight.visual);
      break;
  }
}

describe('curriculum', () => {
  it('has unique lesson ids', () => {
    const seen = new Set<string>();
    for (const t of TRACKS) for (const u of t.units) for (const l of u.lessons) {
      expect(seen.has(l.id), `duplicate lesson id ${l.id}`).toBe(false);
      seen.add(l.id);
    }
  });

  for (const track of TRACKS) {
    describe(track.id, () => {
      it('is well-formed', () => {
        expect(track.units.length, `${track.id} has units`).toBeGreaterThan(0);
        for (const u of track.units) {
          expect(u.lessons.length).toBeGreaterThan(1);
          expect(u.lessons[u.lessons.length - 1].kind, `${u.id} ends with a checkpoint`).toBe('checkpoint');
          for (const l of u.lessons) {
            expect(l.steps.length, `${l.id} has steps`).toBeGreaterThan(0);
            l.intro?.forEach(i => visualNotes(i.visual));
          }
        }
      });
      it('has valid activities', () => {
        for (const u of track.units) for (const l of u.lessons) {
          l.steps.forEach((a, i) => checkActivity(a, track.instrument, `${l.id}#${i}(${a.type})`));
        }
      });
    });
  }
});
