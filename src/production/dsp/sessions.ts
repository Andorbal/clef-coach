/**
 * The sessions Production School mixes: short multitrack loops, each part played by one of
 * the app's own instruments (the drum kits, the plucked strings, the piano, the bowed
 * strings, Synth School's synth), written in the text notation the songs use.
 *
 * A session is a loop of a few bars so a learner can keep it going while they work, the way
 * an engineer loops a chorus. Every part comes out of the stem renderer as its own mono
 * track, "recorded" at a sensible level; lessons can add recording faults to a track (too
 * hot, boomy, uneven…) for the learner to hear and fix.
 *
 * `rough` is the session's starting point: faders roughly up, nothing else done, as a
 * session arrives from a recording. `reference` is a finished mix of it, made by ear: the
 * Mix Lab's "Reference" and the target of the project lessons.
 *
 * Session and channel ids are used by lessons (and saved mixes): don't rename them.
 */
import type { DrumKit } from '../../audio/synth/drums';
import type { BowedVoice } from '../../audio/synth/bowed';
import type { PluckedVariant } from '../../audio/synth/guitar';
import type { PatchDelta } from '../../synthlab/dsp/params';
import type { Mix } from './params';

export type Source =
  | { kind: 'drum'; note: number; kit?: DrumKit }
  | { kind: 'pluck'; variant: PluckedVariant; drive?: number }
  | { kind: 'piano' }
  | { kind: 'epiano' }
  | { kind: 'bowed'; voice: BowedVoice }
  /** Synth School's synth: a preset id, with changes. */
  | { kind: 'synth'; preset?: string; patch?: PatchDelta };

export type Role = 'drums' | 'bass' | 'harmony' | 'lead' | 'texture';

export interface ChannelDef {
  id: string;
  name: string;
  /** Strip label on a narrow console. */
  short?: string;
  role: Role;
  colour: string;
  source: Source;
  /**
   * Drums: a grid of sixteenth notes, `x` a hit, `o` a softer one, `g` a ghost note, `.`
   * nothing, `|` ignored; repeated to fill the loop. Pitched parts: one voice in the text
   * notation (chords in brackets), as long as the loop.
   */
  part: string;
  /** Loudness of the part (0..1, like a velocity). Default 0.8. */
  vel?: number;
  /** Chords are strummed: milliseconds between strings. */
  strum?: number;
  /** Played this many milliseconds late (a double-tracked part isn't quite in time with itself). */
  late?: number;
  /** A different take of the same part (a different random seed). */
  seed?: number;
  /** Peak level the track was recorded at, dBFS. Default −8. */
  level?: number;
}

export interface SessionDef {
  id: string;
  title: string;
  /** One line for the session picker. */
  blurb: string;
  tempo: number;
  /** Beats per bar (quarter notes). */
  beats: number;
  bars: number;
  channels: ChannelDef[];
  /** Faders roughly up, nothing else: where a session starts. */
  rough: Mix;
  /** A finished mix, made by ear. */
  reference: Mix;
}

const C = {
  kick: '#ff8a65',
  snare: '#ffb74d',
  hats: '#ffd54f',
  perc: '#ffe082',
  bass: '#64b5f6',
  keys: '#81c784',
  guitar: '#aed581',
  pad: '#ba68c8',
  lead: '#f06292',
  strings: '#4db6ac',
};

/** A chord (or note) played in a rhythm: `rhythm('[A2 E3 A3]', 'q e e re e q')`, `r…` a rest. */
function rhythm(chord: string, durs: string): string {
  return durs
    .split(' ')
    .map(d => (d.startsWith('r') ? `r/${d.slice(1)}` : `${chord}/${d}`))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Night Drive: pop, Am F C G
// ---------------------------------------------------------------------------

const NIGHT_DRIVE: SessionDef = {
  id: 'pop',
  title: 'Night Drive',
  blurb: 'Pop: drums, bass, piano, guitar, a pad and a lead where the singer would be.',
  tempo: 96,
  beats: 4,
  bars: 4,
  channels: [
    { id: 'kick', name: 'Kick', role: 'drums', colour: C.kick, source: { kind: 'drum', note: 36 }, part: 'x.....x.x.......', vel: 0.9 },
    { id: 'snare', name: 'Snare', role: 'drums', colour: C.snare, source: { kind: 'drum', note: 38 }, part: '....x.......x...|....x.......x..g', vel: 0.85 },
    { id: 'hats', name: 'Hi-hats', short: 'Hats', role: 'drums', colour: C.hats, source: { kind: 'drum', note: 42 }, part: 'x.o.x.o.x.o.x.o.', vel: 0.7, level: -12 },
    {
      id: 'bass',
      name: 'Bass',
      role: 'bass',
      colour: C.bass,
      source: { kind: 'pluck', variant: 'bass' },
      part: 'A1/q. A1/e r/e A1/e A2/e A1/e | F1/q. F1/e r/e F1/e F2/e F1/e | C2/q. C2/e r/e C2/e C3/e C2/e | G1/q. G1/e r/e G1/e G2/e B1/e |',
    },
    {
      id: 'keys',
      name: 'Piano',
      role: 'harmony',
      colour: C.keys,
      source: { kind: 'piano' },
      part: '[A3 C4 E4]/h [A3 C4 E4] | [A3 C4 F4]/h [A3 C4 F4] | [G3 C4 E4]/h [G3 C4 E4] | [G3 B3 D4]/h [G3 B3 D4] |',
      vel: 0.6,
    },
    {
      id: 'guitar',
      name: 'Guitar',
      short: 'Gtr',
      role: 'harmony',
      colour: C.guitar,
      source: { kind: 'pluck', variant: 'guitar' },
      part: 'A2/e E3 A3 C4 E4 C4 A3 E3 | F2/e C3 F3 A3 C4 A3 F3 C3 | C3/e G3 C4 E4 G4 E4 C4 G3 | G2/e D3 G3 B3 D4 B3 G3 D3 |',
      vel: 0.65,
    },
    {
      id: 'pad',
      name: 'Pad',
      role: 'texture',
      colour: C.pad,
      source: { kind: 'synth', preset: 'warm-pad', patch: { reverbMix: 0, chorusMix: 0.3, ampAttack: 0.5, ampRelease: 0.8 } },
      part: '[A3 C4 E4]/w | [F3 A3 C4]/w | [E3 G3 C4]/w | [D3 G3 B3]/w |',
      vel: 0.6,
      level: -12,
    },
    {
      id: 'lead',
      name: 'Lead',
      role: 'lead',
      colour: C.lead,
      source: { kind: 'synth', patch: { engine: 'wavetable', osc1Table: 'vowel', osc1Pos: 0.35, unison: 1, filterOn: true, filterCutoff: 3200, ampAttack: 0.04, ampRelease: 0.18, lfoPitch: 18, lfoRate: 5.2, lfoFade: 0.35, voiceMode: 'legato', glide: 0.04 } },
      part: 'r/q E4/e D4/e C4/q A3/q | C4/q. A3/e F3/h | r/e G3/e C4/e D4/e E4/q G4/q | D4/h. r/q |',
      vel: 0.75,
    },
  ],
  rough: {
    'kick:fader': -6, 'snare:fader': -6, 'hats:fader': -6, 'bass:fader': -6, 'keys:fader': -6, 'guitar:fader': -6, 'pad:fader': -6, 'lead:fader': -6,
  },
  reference: {
    'kick:fader': -7, 'kick:eqOn': 1, 'kick:lowGain': 3, 'kick:lowFreq': 70, 'kick:midGain': -4, 'kick:midFreq': 350, 'kick:presGain': 3, 'kick:presFreq': 3500,
    'snare:fader': -9, 'snare:hpOn': 1, 'snare:hpFreq': 100, 'snare:reverb': -14,
    'hats:fader': -16, 'hats:pan': 0.35, 'hats:hpOn': 1, 'hats:hpFreq': 300,
    'bass:fader': -8, 'bass:compOn': 1, 'bass:threshold': -20, 'bass:ratio': 4, 'bass:attack': 15, 'bass:release': 120, 'bass:makeup': 3,
    'keys:fader': -15, 'keys:pan': -0.4, 'keys:hpOn': 1, 'keys:hpFreq': 150, 'keys:midGain': -3, 'keys:midFreq': 300, 'keys:reverb': -12,
    'guitar:fader': -15, 'guitar:pan': 0.5, 'guitar:hpOn': 1, 'guitar:hpFreq': 160, 'guitar:reverb': -14,
    'pad:fader': -21, 'pad:hpOn': 1, 'pad:hpFreq': 250, 'pad:reverb': -10,
    'lead:fader': -7, 'lead:hpOn': 1, 'lead:hpFreq': 120, 'lead:presGain': 2.5, 'lead:compOn': 1, 'lead:threshold': -18, 'lead:ratio': 3, 'lead:makeup': 3, 'lead:reverb': -10, 'lead:delay': -16,
    'fx:reverbSize': 0.5, 'fx:reverbLevel': 0, 'fx:delayBeats': 0.75, 'fx:delayFeedback': 0.3, 'fx:delayLevel': -3,
    'master:compOn': 1, 'master:threshold': -10, 'master:ratio': 2, 'master:limitOn': 1, 'master:drive': 3, 'master:ceiling': -1,
  },
};

// ---------------------------------------------------------------------------
// Porch Light: acoustic, G Em C D
// ---------------------------------------------------------------------------

const G = '[G2 B2 D3 G3 B3 G4]';
const EM = '[E2 B2 E3 G3 B3 E4]';
const CC = '[C3 E3 G3 C4 E4]';
const D = '[D3 A3 D4 F#4]';
const STRUM = 'q e e re e q';

const PORCH_LIGHT: SessionDef = {
  id: 'acoustic',
  title: 'Porch Light',
  blurb: 'Acoustic: a strummed guitar, piano, double bass, cello, violin and a shaker.',
  tempo: 84,
  beats: 4,
  bars: 4,
  channels: [
    { id: 'shaker', name: 'Shaker', role: 'drums', colour: C.perc, source: { kind: 'drum', note: 70 }, part: 'o.x.o.x.o.x.o.x.', vel: 0.6, level: -14 },
    { id: 'bass', name: 'Upright bass', short: 'Bass', role: 'bass', colour: C.bass, source: { kind: 'pluck', variant: 'bass' }, part: 'G1/h D2/h | E1/h B1/h | C2/h G1/h | D2/h A1/h |', vel: 0.75 },
    { id: 'guitar', name: 'Acoustic guitar', short: 'Gtr', role: 'harmony', colour: C.guitar, source: { kind: 'pluck', variant: 'guitar' }, part: `${rhythm(G, STRUM)} | ${rhythm(EM, STRUM)} | ${rhythm(CC, STRUM)} | ${rhythm(D, STRUM)} |`, strum: 14, vel: 0.7 },
    { id: 'piano', name: 'Piano', role: 'harmony', colour: C.keys, source: { kind: 'piano' }, part: 'r/h [B4 D5 G5]/h | r/h [B4 E5 G5]/h | r/h [C5 E5 G5]/h | r/h [A4 D5 F#5]/h |', vel: 0.5, level: -10 },
    { id: 'cello', name: 'Cello', role: 'texture', colour: C.strings, source: { kind: 'bowed', voice: 'cello' }, part: 'B2/w | G2/w | E3/w | F#3/w |', vel: 0.6, level: -10 },
    { id: 'violin', name: 'Violin', role: 'lead', colour: C.lead, source: { kind: 'bowed', voice: 'violin' }, part: 'D5/q. B4/e G4/h | B4/q. A4/e G4/q E4/q | G4/q. E4/e C5/h | A4/h. r/q |', vel: 0.75 },
  ],
  rough: { 'shaker:fader': -6, 'bass:fader': -6, 'guitar:fader': -6, 'piano:fader': -6, 'cello:fader': -6, 'violin:fader': -6 },
  reference: {
    'shaker:fader': -18, 'shaker:pan': 0.45, 'shaker:hpOn': 1, 'shaker:hpFreq': 400,
    'bass:fader': -7, 'bass:compOn': 1, 'bass:threshold': -18, 'bass:ratio': 3, 'bass:makeup': 2,
    'guitar:fader': -10, 'guitar:pan': -0.3, 'guitar:hpOn': 1, 'guitar:hpFreq': 110, 'guitar:midGain': -3, 'guitar:midFreq': 250, 'guitar:reverb': -14,
    'piano:fader': -16, 'piano:pan': 0.35, 'piano:reverb': -10,
    'cello:fader': -15, 'cello:pan': 0.2, 'cello:reverb': -10,
    'violin:fader': -8, 'violin:hpOn': 1, 'violin:hpFreq': 200, 'violin:reverb': -8,
    'fx:reverbSize': 0.65, 'fx:reverbPredelay': 30, 'fx:reverbLevel': 0,
    'master:limitOn': 1, 'master:drive': 2, 'master:ceiling': -1,
  },
};

// ---------------------------------------------------------------------------
// Fuzz Garden: rock, E C G D power chords, the guitar double-tracked
// ---------------------------------------------------------------------------

const EIGHTS = 'e e e e e e e e';

const FUZZ_GARDEN: SessionDef = {
  id: 'rock',
  title: 'Fuzz Garden',
  blurb: 'Rock: a power kit, bass, two takes of a driven guitar and a lead.',
  tempo: 120,
  beats: 4,
  bars: 4,
  channels: [
    { id: 'kick', name: 'Kick', role: 'drums', colour: C.kick, source: { kind: 'drum', note: 36, kit: 'power' }, part: 'x.......x.x.....', vel: 0.95 },
    { id: 'snare', name: 'Snare', role: 'drums', colour: C.snare, source: { kind: 'drum', note: 38, kit: 'power' }, part: '....x.......x...', vel: 0.95 },
    { id: 'hats', name: 'Hi-hats', short: 'Hats', role: 'drums', colour: C.hats, source: { kind: 'drum', note: 42, kit: 'power' }, part: 'x.x.x.x.x.x.x.x.', vel: 0.75, level: -12 },
    { id: 'bass', name: 'Bass', role: 'bass', colour: C.bass, source: { kind: 'pluck', variant: 'bass' }, part: `${rhythm('E1', EIGHTS)} | ${rhythm('C2', EIGHTS)} | ${rhythm('G1', EIGHTS)} | ${rhythm('D2', EIGHTS)} |`, vel: 0.8 },
    { id: 'gtrL', name: 'Guitar 1', short: 'Gtr 1', role: 'harmony', colour: C.guitar, source: { kind: 'pluck', variant: 'guitar', drive: 14 }, part: `${rhythm('[E2 B2 E3]', EIGHTS)} | ${rhythm('[C3 G3 C4]', EIGHTS)} | ${rhythm('[G2 D3 G3]', EIGHTS)} | ${rhythm('[D3 A3 D4]', EIGHTS)} |`, strum: 6, vel: 0.85 },
    { id: 'gtrR', name: 'Guitar 2', short: 'Gtr 2', role: 'harmony', colour: '#c5e1a5', source: { kind: 'pluck', variant: 'guitar', drive: 14 }, part: `${rhythm('[E2 B2 E3]', EIGHTS)} | ${rhythm('[C3 G3 C4]', EIGHTS)} | ${rhythm('[G2 D3 G3]', EIGHTS)} | ${rhythm('[D3 A3 D4]', EIGHTS)} |`, strum: 7, vel: 0.82, late: 9, seed: 2 },
    { id: 'lead', name: 'Lead', role: 'lead', colour: C.lead, source: { kind: 'synth', preset: 'sync-lead', patch: { reverbMix: 0, delayMix: 0 } }, part: 'B4/q. A4/e G4/q E4/q | G4/q. E4/e C4/h | D4/q. E4/e G4/q B4/q | A4/h. r/q |', vel: 0.75 },
  ],
  rough: { 'kick:fader': -6, 'snare:fader': -6, 'hats:fader': -6, 'bass:fader': -6, 'gtrL:fader': -6, 'gtrR:fader': -6, 'lead:fader': -6 },
  reference: {
    'kick:fader': -6, 'kick:eqOn': 1, 'kick:lowGain': 2, 'kick:lowFreq': 60, 'kick:presGain': 4, 'kick:presFreq': 4000,
    'snare:fader': -8, 'snare:compOn': 1, 'snare:threshold': -18, 'snare:ratio': 4, 'snare:attack': 20, 'snare:makeup': 2, 'snare:reverb': -12,
    'hats:fader': -17, 'hats:pan': -0.3, 'hats:hpOn': 1, 'hats:hpFreq': 400,
    'bass:fader': -9, 'bass:compOn': 1, 'bass:threshold': -18, 'bass:ratio': 4, 'bass:makeup': 3, 'bass:hpOn': 1, 'bass:hpFreq': 35,
    'gtrL:fader': -14, 'gtrL:pan': -1, 'gtrL:hpOn': 1, 'gtrL:hpFreq': 110, 'gtrL:midGain': -2, 'gtrL:midFreq': 400,
    'gtrR:fader': -14, 'gtrR:pan': 1, 'gtrR:hpOn': 1, 'gtrR:hpFreq': 110, 'gtrR:midGain': -2, 'gtrR:midFreq': 400,
    'lead:fader': -10, 'lead:hpOn': 1, 'lead:hpFreq': 200, 'lead:delay': -10, 'lead:reverb': -14,
    'fx:reverbSize': 0.35, 'fx:delayBeats': 0.375, 'fx:delayFeedback': 0.3, 'fx:delayLevel': -4,
    'master:compOn': 1, 'master:threshold': -12, 'master:ratio': 2, 'master:attack': 30, 'master:limitOn': 1, 'master:drive': 4, 'master:ceiling': -1,
  },
};

// ---------------------------------------------------------------------------
// Neon Rain: electronic, Am F C G again, all synths and drum machine
// ---------------------------------------------------------------------------

const NEON_RAIN: SessionDef = {
  id: 'electronic',
  title: 'Neon Rain',
  blurb: 'Electronic: a drum machine, sub bass, a pluck arpeggio, a pad and a supersaw lead.',
  tempo: 110,
  beats: 4,
  bars: 4,
  channels: [
    { id: 'kick', name: 'Kick', role: 'drums', colour: C.kick, source: { kind: 'drum', note: 36, kit: 'electronic' }, part: 'x...x...x...x...', vel: 0.95 },
    { id: 'clap', name: 'Clap', role: 'drums', colour: C.snare, source: { kind: 'drum', note: 39, kit: 'electronic' }, part: '....x.......x...', vel: 0.85 },
    { id: 'hats', name: 'Hi-hats', short: 'Hats', role: 'drums', colour: C.hats, source: { kind: 'drum', note: 42, kit: 'electronic' }, part: '..x...x...x...xo', vel: 0.75, level: -12 },
    { id: 'sub', name: 'Sub bass', short: 'Sub', role: 'bass', colour: C.bass, source: { kind: 'synth', preset: 'sub-bass' }, part: 'A1/q. A1/e r/q A1/q | F1/q. F1/e r/q F1/q | C2/q. C2/e r/q C2/q | G1/q. G1/e r/q G1/q |', vel: 0.8 },
    { id: 'pluck', name: 'Pluck', role: 'harmony', colour: C.guitar, source: { kind: 'synth', preset: 'pluck', patch: { reverbMix: 0, delayMix: 0 } }, part: 'A3/s C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 A3 C4 E4 A4 | F3/s A3 C4 F4 F3 A3 C4 F4 F3 A3 C4 F4 F3 A3 C4 F4 | E3/s G3 C4 E4 E3 G3 C4 E4 E3 G3 C4 E4 E3 G3 C4 E4 | D3/s G3 B3 D4 D3 G3 B3 D4 D3 G3 B3 D4 D3 G3 B3 D4 |', vel: 0.6 },
    { id: 'pad', name: 'Pad', role: 'texture', colour: C.pad, source: { kind: 'synth', preset: 'warm-pad', patch: { reverbMix: 0, chorusMix: 0.3, ampAttack: 0.5, ampRelease: 0.8 } }, part: '[A3 C4 E4]/w | [F3 A3 C4]/w | [E3 G3 C4]/w | [D3 G3 B3]/w |', vel: 0.6, level: -12 },
    { id: 'lead', name: 'Lead', role: 'lead', colour: C.lead, source: { kind: 'synth', preset: 'supersaw', patch: { reverbMix: 0, delayMix: 0 } }, part: 'E5/q. D5/e C5/q A4/q | C5/q. A4/e F4/h | G4/q. A4/e C5/q E5/q | D5/h. r/q |', vel: 0.7 },
  ],
  rough: { 'kick:fader': -6, 'clap:fader': -6, 'hats:fader': -6, 'sub:fader': -6, 'pluck:fader': -6, 'pad:fader': -6, 'lead:fader': -6 },
  reference: {
    'kick:fader': -5,
    'clap:fader': -9, 'clap:reverb': -10,
    'hats:fader': -15, 'hats:pan': 0.25, 'hats:hpOn': 1, 'hats:hpFreq': 500, 'hats:delay': -18,
    'sub:fader': -8, 'sub:compOn': 1, 'sub:threshold': -16, 'sub:ratio': 3, 'sub:makeup': 2,
    'pluck:fader': -15, 'pluck:pan': -0.3, 'pluck:hpOn': 1, 'pluck:hpFreq': 200, 'pluck:delay': -10,
    'pad:fader': -20, 'pad:hpOn': 1, 'pad:hpFreq': 300, 'pad:reverb': -6,
    'lead:fader': -12, 'lead:hpOn': 1, 'lead:hpFreq': 250, 'lead:reverb': -10, 'lead:delay': -14,
    'fx:reverbSize': 0.75, 'fx:reverbPredelay': 40, 'fx:delayBeats': 0.75, 'fx:delayFeedback': 0.4, 'fx:delayLevel': -3,
    'master:compOn': 1, 'master:threshold': -12, 'master:ratio': 2, 'master:limitOn': 1, 'master:drive': 5, 'master:ceiling': -1,
  },
};

export const SESSIONS: readonly SessionDef[] = [NIGHT_DRIVE, PORCH_LIGHT, FUZZ_GARDEN, NEON_RAIN];

export function getSession(id: string): SessionDef {
  const s = SESSIONS.find(x => x.id === id);
  if (!s) throw new Error(`Unknown session "${id}"`);
  return s;
}

/** Seconds in one pass of the loop. */
export function loopSeconds(s: Pick<SessionDef, 'tempo' | 'beats' | 'bars'>): number {
  return (s.bars * s.beats * 60) / s.tempo;
}
