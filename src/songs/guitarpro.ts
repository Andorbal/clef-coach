/**
 * Guitar Pro → Clef Coach song.
 *
 * Guitar Pro files (.gp3, .gp4, .gp5, .gpx, .gp) are how most tab is shared with its
 * rhythm. alphaTab (MPL-2.0, loaded only when such a file is imported) reads every
 * version; each track then becomes the same parts the MusicXML importer reads, so
 * repeats and endings, D.C. / D.S., voices, chord symbols, lyrics, strings and frets
 * all take one path from there (see buildSong in musicxml.ts).
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import type { KeySig } from '../music/keys';
import { PPQ, type TimeSig, measureTicks } from '../music/rhythm';
import { type ImportResult, ImportError, Warnings, plural, spellInKey } from './importkit';
import { type ClefInfo, type Header, type MusicXmlOptions, type XGroup, type XMeasure, type XNote, type XPart, buildSong, emptyMeasure } from './musicxml';

type AlphaTab = typeof AlphaTabModule;
type GpScore = AlphaTabModule.model.Score;
type GpTrack = AlphaTabModule.model.Track;

/** alphaTab counts 960 ticks to a quarter note; the app 48. */
const GP_TICKS = 960 / PPQ;

let loading: Promise<AlphaTab> | null = null;
/** alphaTab, loaded on first use (it's big, and only Guitar Pro files need it). */
function alphaTab(): Promise<AlphaTab> {
  loading ??= import('@coderline/alphatab').then(at => {
    at.Logger.logLevel = at.LogLevel.None;
    return at;
  });
  return loading;
}

/** Read a Guitar Pro file into a song. `partIds` are track numbers (as strings) from `parts`. */
export async function importGuitarPro(bytes: Uint8Array, opts: MusicXmlOptions = {}): Promise<ImportResult> {
  const at = await alphaTab();
  let score: GpScore;
  try {
    const settings = new at.Settings();
    settings.core.logLevel = at.LogLevel.None;
    score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  } catch (e) {
    throw new ImportError(`This Guitar Pro file can't be read: ${(e as Error).message || 'unknown format'}.`);
  }
  const w = new Warnings();
  const counts = { dead: 0, bends: 0, harmonics: 0, swing: false };
  const drums = score.tracks.filter(t => t.isPercussion);
  const parts = score.tracks.filter(t => !t.isPercussion).map(t => trackToPart(at, t, score, counts));
  if (!parts.length) throw new ImportError(drums.length ? 'This file only has drum tracks; Clef Coach needs pitched notes.' : 'This Guitar Pro file has no tracks.');
  if (drums.length) w.add(`${plural(drums.length, 'drum track')} ${drums.length > 1 ? 'were' : 'was'} left out.`);
  const header: Header = {
    title: score.title.trim(),
    composer: (score.music || score.artist).trim(),
    lyricist: score.words.trim() || undefined,
    rights: score.copyright.trim() || undefined,
  };
  const res = buildSong({ header, parts, source: `Imported from Guitar Pro${score.tab.trim() ? ` (tab by ${score.tab.trim()})` : ''}` }, { ...opts, keepPartInstrument: true, trimLeadingRests: true }, w);
  if (counts.dead) w.add(`${plural(counts.dead, 'dead (muted) note')} ${counts.dead > 1 ? 'were' : 'was'} left out.`);
  if (counts.bends) w.add('Bends are written as the fret you start on.');
  if (counts.harmonics) w.add('Harmonics are written at the fret where they are played.');
  if (counts.swing) w.add('Swing (triplet feel) is written straight.');
  // the song's own warnings come first, these after
  return { ...res, warnings: [...res.warnings, ...w.list.filter(x => !res.warnings.includes(x))] };
}

function trackToPart(at: AlphaTab, track: GpTrack, score: GpScore, counts: { dead: number; bends: number; harmonics: number; swing: boolean }): XPart {
  const { Direction, GraceType, Clef, Ottavia, HarmonicType, Fingers } = at.model;
  const first = track.staves[0];
  // open strings as the app numbers them (1 = highest), with the capo: notes sound tuning + capo + fret
  const tuning = first.tuning.length ? first.tuning.map(t => t + first.capo) : undefined;
  const part: XPart = {
    id: String(track.index),
    name: track.name.trim() || `Track ${track.index + 1}`,
    names: [track.name, track.shortName].map(s => s.trim()).filter(Boolean),
    program: track.playbackInfo.program + 1,
    braces: track.staves.length > 1 ? [1] : [],
    staves: track.staves.length,
    measures: [],
    firstClefs: new Map(),
    tabStaves: new Set(),
    tuning,
    metered: true,
    modeGiven: score.masterBars.some(mb => (mb.keySignatureType as number) === 1),
    counts: { grace: 0, unpitched: 0, microtones: 0, oddTuplets: 0 },
  };
  const clefNow = new Map<number, ClefInfo>();
  let prevEndings = 0;
  score.masterBars.forEach((mb, i) => {
    const time: TimeSig = [mb.timeSignatureNumerator, mb.timeSignatureDenominator];
    const key: KeySig = { fifths: Math.max(-7, Math.min(7, mb.keySignature as number)), mode: (mb.keySignatureType as number) === 1 ? 'minor' : 'major' };
    const m: XMeasure = emptyMeasure(String(i + 1), mb.isAnacrusis, time, key, null);
    m.clefStart = new Map(clefNow);
    // repeats, endings and jumps
    m.fwdRepeat = mb.isRepeatStart;
    m.bwdRepeat = mb.repeatCount > 0 ? Math.max(2, mb.repeatCount) : 0;
    if (mb.alternateEndings) {
      m.endingNums = [...Array(16).keys()].filter(k => mb.alternateEndings & (1 << k)).map(k => k + 1);
      if (mb.alternateEndings !== prevEndings) m.endingStart = m.endingNums;
    }
    prevEndings = mb.alternateEndings;
    const dirs = new Set([...(mb.directions ?? [])].map(d => d as number));
    const has = (...ds: number[]) => ds.some(d => dirs.has(d));
    m.fine = has(Direction.TargetFine);
    m.segno = has(Direction.TargetSegno, Direction.TargetSegnoSegno);
    m.codaTarget = has(Direction.TargetCoda, Direction.TargetDoubleCoda);
    m.dacapo = has(Direction.JumpDaCapo, Direction.JumpDaCapoAlCoda, Direction.JumpDaCapoAlDoubleCoda, Direction.JumpDaCapoAlFine);
    m.dalsegno = has(
      Direction.JumpDalSegno,
      Direction.JumpDalSegnoAlCoda,
      Direction.JumpDalSegnoAlDoubleCoda,
      Direction.JumpDalSegnoAlFine,
      Direction.JumpDalSegnoSegno,
      Direction.JumpDalSegnoSegnoAlCoda,
      Direction.JumpDalSegnoSegnoAlDoubleCoda,
      Direction.JumpDalSegnoSegnoAlFine,
    );
    m.tocoda = has(Direction.JumpDaCoda, Direction.JumpDaDoubleCoda);
    // tempo: the score's for the first bar, then any change
    const tempo = mb.tempoAutomations?.[0]?.value;
    if (i === 0) m.tempo = tempo ?? score.tempo;
    else if (tempo) m.tempo = tempo;
    if ((mb.tripletFeel as number) !== 0) counts.swing = true;

    track.staves.forEach((staff, si) => {
      const bar = staff.bars[i];
      if (!bar) return;
      const n = si + 1;
      const clef = clefInfo(bar.clef as number, bar.clefOttava as number, Clef, Ottavia);
      if (clef) {
        if (!part.firstClefs.has(n)) part.firstClefs.set(n, clef);
        const was = clefNow.get(n);
        if (!was || was.sign !== clef.sign || was.line !== clef.line || was.octave !== clef.octave) m.clefs.push({ staff: n, tick: 0, clef });
        clefNow.set(n, clef);
      }
      bar.voices.forEach((voice, vi) => {
        for (const beat of voice.beats) {
          if ((beat.graceType as number) !== (GraceType.None as number)) {
            part.counts.grace += beat.notes.length ? 1 : 0;
            continue;
          }
          const start = beat.displayStart / GP_TICKS;
          const end = start + beat.displayDuration / GP_TICKS;
          if (beat.tupletNumerator > 0 && beat.tupletNumerator * 2 !== beat.tupletDenominator * 3) part.counts.oddTuplets++;
          const notes: XNote[] = [];
          for (const note of beat.notes) {
            if (note.isDead) {
              counts.dead++;
              continue;
            }
            if (note.hasBend) counts.bends++;
            if ((note.harmonicType as number) !== (HarmonicType.None as number)) counts.harmonics++;
            const x: XNote = { written: spellInKey(note.realValueWithoutHarmonic, key), tieStart: note.isTieOrigin };
            if (tuning && note.string >= 1 && note.string <= tuning.length) {
              x.string = tuning.length - note.string + 1;
              x.fret = note.fret;
            }
            const f = note.leftHandFinger as number;
            if (f >= (Fingers.IndexFinger as number) && f <= (Fingers.LittleFinger as number)) x.finger = f;
            notes.push(x);
          }
          const g: XGroup = { staff: n, voice: String(si * 4 + vi + 1), start, end, notes, lyrics: new Map(), transpose: null, clef };
          beat.lyrics?.forEach((text, k) => {
            const t = text.trim().replace(/\s+/g, '‿');
            if (t) g.lyrics.set(k + 1, t);
          });
          m.groups.push(g);
          m.len = Math.max(m.len, end);
          if (si === 0 && beat.chord?.name.trim()) m.harmonies.push({ tick: start, root: null, kind: '', kindText: '', degrees: [], symbol: beat.chord.name.trim() });
        }
      });
    });
    // an anacrusis is as long as its music; any other bar keeps its time signature's length
    if (!mb.isAnacrusis) m.len = Math.max(m.len, measureTicks(time));
    m.len = Math.round(m.len * 1000) / 1000;
    part.measures.push(m);
  });
  return part;
}

function clefInfo(clef: number, ottava: number, Clef: AlphaTab['model']['Clef'], Ottavia: AlphaTab['model']['Ottavia']): ClefInfo | undefined {
  const octave = ottava === (Ottavia._8vb as number) ? -1 : ottava === (Ottavia._15mb as number) ? -2 : ottava === (Ottavia._8va as number) ? 1 : ottava === (Ottavia._15ma as number) ? 2 : 0;
  if (clef === (Clef.G2 as number)) return { sign: 'G', line: 2, octave };
  if (clef === (Clef.F4 as number)) return { sign: 'F', line: 4, octave };
  if (clef === (Clef.C3 as number)) return { sign: 'C', line: 3, octave };
  if (clef === (Clef.C4 as number)) return { sign: 'C', line: 4, octave };
  return undefined; // neutral (percussion)
}
