/**
 * SFZ reader. SFZ is the open text format most free sample libraries use: a bank is a
 * folder (or a .zip) of one or more .sfz files plus the audio they point at, and each
 * .sfz file becomes one preset here.
 *
 * An .sfz file is a list of headers (<control>, <global>, <master>, <group>, <region>…),
 * each followed by `opcode=value` pairs. A region inherits every opcode of the <global>,
 * <master> and <group> above it and overrides them with its own. See https://sfzformat.com;
 * where the spec is silent or players disagree we follow sfizz and ARIA / sforzando, the
 * players libraries are made with.
 *
 * Pure: no audio is read. Whatever can't be played as written (built-in oscillators,
 * controller-triggered regions, extra articulations, effects…) is left out or simplified
 * with a plain-English warning.
 */

import { BankFormatError, DEFAULT_ENVELOPE } from './types';
import type { Envelope, LoopMode, ParsedBank, SampleInfo, SamplePreset, SampleRegion } from './types';

/** A region as read from one .sfz file; its sample is still a bank-relative path. */
export type SfzRegion = Omit<SampleRegion, 'sample'> & { samplePath: string };

/** One parsed .sfz file. */
export interface SfzInstrument {
  /** Display name, from the file name. */
  name: string;
  regions: SfzRegion[];
  /** Things that were simplified or skipped, in plain English. */
  warnings: string[];
}

type ReadText = (path: string) => Promise<string | null>;

/**
 * The amp envelope every SFZ region starts from. The spec's default ampeg_release is
 * 0.001 s, which clicks when a sustained note is let go; ARIA / sforzando use 0.03 s and
 * libraries that don't set a release are tuned to that, so we do the same.
 */
export const SFZ_DEFAULT_ENVELOPE: Envelope = { ...DEFAULT_ENVELOPE, release: 0.03 };

// ---------------------------------------------------------------------------
// Note names and paths
// ---------------------------------------------------------------------------

const PITCH_CLASS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * A key opcode's value (a MIDI number or a note name) → MIDI key. SFZ puts middle C at
 * c4 = 60; sharps are '#', flats 'b', case doesn't matter ("c#4", "Db4", "60"). The
 * <control> header's octave_offset / note_offset shift the result. null if not a note.
 */
export function sfzKey(v: string, octaveOffset = 0, noteOffset = 0): number | null {
  const s = v.trim();
  let key: number;
  if (/^[+-]?\d+$/.test(s)) {
    key = Number(s);
  } else {
    const m = /^([a-g])([#b]?)(-?\d+)$/i.exec(s);
    if (!m) return null;
    const accidental = m[2] === '#' ? 1 : m[2] ? -1 : 0;
    key = PITCH_CLASS[m[1].toLowerCase()] + accidental + (Number(m[3]) + 1) * 12;
  }
  return key + octaveOffset * 12 + noteOffset;
}

/** MIDI key → "C#4" (for warnings). */
const noteName = (key: number) => `${NOTE_NAMES[((key % 12) + 12) % 12]}${Math.floor(key / 12) - 1}`;

/**
 * Where a sample lives in the bank: `sample` is relative to the .sfz file's folder plus
 * <control>'s default_path. Backslashes (Windows authors) become '/', and '.' / '..' are
 * resolved ('..' never climbs above the bank's root). An absolute path can't point outside
 * the bank, so it is read from the bank's root.
 */
export function resolveSfzPath(sfzPath: string, defaultPath: string, sample: string): string {
  const out: string[] = [];
  const walk = (path: string) => {
    let p = path.trim().replace(/\\/g, '/');
    if (/^[A-Za-z]:\//.test(p) || p.startsWith('/')) {
      out.length = 0;
      p = p.replace(/^[A-Za-z]:/, '');
    }
    for (const seg of p.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop();
      else out.push(seg);
    }
  };
  walk(sfzPath.replace(/\\/g, '/').replace(/[^/]*$/, ''));
  walk(defaultPath);
  walk(sample);
  return out.join('/');
}

const fileName = (path: string) => path.replace(/\\/g, '/').split('/').pop() ?? path;

/** "Upright_Piano-soft.sfz" → "Upright Piano soft". */
const presetName = (path: string) =>
  fileName(path)
    .replace(/\.sfzh?$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Instrument';

// ---------------------------------------------------------------------------
// Lexer: comments, #define, #include, headers and opcodes
// ---------------------------------------------------------------------------

type Token = { kind: 'header'; name: string } | { kind: 'opcode'; name: string; value: string };

interface Lexer {
  /** The main .sfz file: #include paths are relative to its folder (as the spec says). */
  root: string;
  defines: Map<string, string>;
  readText: ReadText;
  warn: (key: string, message: string) => void;
  /** Files being read, innermost last, to stop #include loops. */
  stack: string[];
  tokens: Token[];
}

/** Blank out comments, keeping line breaks so a block comment doesn't join two lines. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*/g, m => m.replace(/[^\r\n]/g, ' '));

/** Replace $NAME with its #define. The longest defined prefix wins, so $VEL2 is $VEL + "2" when only $VEL is defined. */
function expand(text: string, defines: Map<string, string>): string {
  if (!defines.size || !text.includes('$')) return text;
  return text.replace(/\$\w+/g, m => {
    for (let n = m.length; n > 1; n--) {
      const v = defines.get(m.slice(0, n));
      if (v !== undefined) return v + m.slice(n);
    }
    return m;
  });
}

const HEADER_AT = /<\s*([A-Za-z_]\w*)\s*>/y;
const OPCODE_AT = /([A-Za-z_][\w$]*)=/y;
/** A file name may contain spaces: it runs until the next `name=`, a header or the end of the line. */
const LONG_VALUE_END = /\s+[A-Za-z_][\w$]*=|<\s*[A-Za-z_]\w*\s*>/g;
const SHORT_VALUE_END = /[\s<]/g;
/** Opcodes whose values are free text (paths and labels). */
const isLongValue = (name: string) => name === 'sample' || name === 'default_path' || name === 'image' || name.includes('label');

/** Headers and opcodes on one stretch of text (comments and directives already handled). */
function lexText(s: string, out: Token[]): void {
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      i++;
      continue;
    }
    HEADER_AT.lastIndex = i;
    const h = HEADER_AT.exec(s);
    if (h) {
      out.push({ kind: 'header', name: h[1].toLowerCase() });
      i = HEADER_AT.lastIndex;
      continue;
    }
    OPCODE_AT.lastIndex = i;
    const o = OPCODE_AT.exec(s);
    if (o) {
      const start = OPCODE_AT.lastIndex;
      const endRe = isLongValue(o[1]) ? LONG_VALUE_END : SHORT_VALUE_END;
      endRe.lastIndex = start;
      const end = endRe.exec(s)?.index ?? s.length;
      out.push({ kind: 'opcode', name: o[1], value: s.slice(start, end).trim() });
      i = end;
      continue;
    }
    // stray text: skip the word
    i++;
    while (i < s.length && !/[\s<]/.test(s[i])) i++;
  }
}

async function lexFile(text: string, path: string, lx: Lexer): Promise<void> {
  for (const line of stripComments(text.replace(/^﻿/, '')).split(/\r\n|\r|\n/)) {
    let rest = line;
    for (;;) {
      const d = /#(define|include)\b/.exec(rest);
      if (!d) break;
      lexText(expand(rest.slice(0, d.index), lx.defines), lx.tokens);
      rest = rest.slice(d.index);
      if (d[1] === 'define') {
        // #define $NAME value: the value is the rest of the line
        const m = /^#define\s+(\$\w+)(?:\s+(.*?))?\s*$/.exec(rest);
        if (m) lx.defines.set(m[1], expand(m[2] ?? '', lx.defines));
        rest = '';
        break;
      }
      const m = /^#include\s*"([^"]*)"/.exec(rest);
      if (m) await include(expand(m[1], lx.defines), path, lx);
      rest = rest.slice(m ? m[0].length : '#include'.length);
    }
    lexText(expand(rest, lx.defines), lx.tokens);
  }
}

/**
 * An #include is pasted in where it stands. The spec reads its path from the main file's
 * folder; some libraries write it relative to the including file instead, so that is
 * tried second.
 */
async function include(target: string, from: string, lx: Lexer): Promise<void> {
  const candidates = [...new Set([resolveSfzPath(lx.root, '', target), resolveSfzPath(from, '', target)])];
  for (const path of candidates) {
    const text = await lx.readText(path);
    if (text === null) continue;
    if (lx.stack.includes(path) || lx.stack.length > 32) {
      lx.warn(`loop:${path}`, `"${fileName(path)}" includes itself; the repeat was skipped.`);
      return;
    }
    lx.stack.push(path);
    await lexFile(text, path, lx);
    lx.stack.pop();
    return;
  }
  lx.warn(`include:${target}`, `The included file "${target}" wasn't found.`);
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

type Opcode = [name: string, value: string];

interface Control {
  /** The .sfz file being read: sample paths start from its folder. */
  root: string;
  defaultPath: string;
  octaveOffset: number;
  noteOffset: number;
  /** set_ccN: controller values before anything is moved (0..127). */
  cc: Map<number, number>;
  /** sw_default: the key switch selected at load. */
  swDefault?: number;
}

/** A region plus what decides, once the whole file is read, whether it is kept. */
interface Draft {
  region: SfzRegion;
  /** sw_lolast..sw_hilast (sw_last): the key switch that selects this region's articulation. */
  sw?: [number, number];
  /** sw_down / sw_previous: plays only with a key switch held, or after a particular note. */
  needsSwitchHeld: boolean;
  /** loccN / hiccN conditions, 0..127. */
  cc: Map<number, [number, number]>;
  /** X_onccN modulation: applied once the file's controller defaults (set_ccN) are known. */
  mods: { target: string; cc: number; amount: number }[];
  /** X_curveccN: how the controller maps to the modulation (0 linear, 1 bipolar, 2 inverted, 3 inverted bipolar). */
  curves: Map<string, number>;
  legato: boolean;
}

const ALIASES: Record<string, string> = {
  loopmode: 'loop_mode',
  loopstart: 'loop_start',
  loopend: 'loop_end',
  pitch: 'tune',
  offby: 'off_by',
  polyphony_group: 'group',
  filtype: 'fil_type',
};

const LOOP_MODES: Record<string, LoopMode> = {
  no_loop: 'none',
  one_shot: 'one-shot',
  loop_continuous: 'continuous',
  loop_sustain: 'sustain',
};

/** Controllers that MIDI devices don't leave at 0: volume, pan and expression. */
const CC_AT_REST: Record<number, number> = { 7: 100, 10: 64, 11: 127 };

/** Opcodes a controller can move (`ampeg_release_oncc72=2`), and their curves (`tune_curvecc90=1`). */
const MOD_TARGETS = 'ampeg_(?:delay|attack|hold|decay|sustain|release)|amp_veltrack|volume|pan|tune|pitch';
const MOD_RE = new RegExp(`^(${MOD_TARGETS})_(?:on)?cc(\\d+)$`);
const CURVE_RE = new RegExp(`^(${MOD_TARGETS})_curvecc(\\d+)$`);

/**
 * Apply controller modulation with the controllers where the instrument sets them
 * (set_ccN / set_hdccN) or at rest. Pianos often give their release this way: a
 * release of `ampeg_release_oncc72=2` with `set_hdcc72=0.5` is one second.
 */
function applyMods(d: Draft, ccValue: (cc: number) => number): void {
  const r = d.region;
  for (const m of d.mods) {
    let v = Math.min(1, Math.max(0, ccValue(m.cc) / 127));
    const curve = d.curves.get(m.target) ?? 0;
    if (curve === 1) v = v * 2 - 1;
    else if (curve === 2) v = 1 - v;
    else if (curve === 3) v = 1 - 2 * v;
    const x = m.amount * v;
    switch (m.target) {
      case 'ampeg_sustain':
        r.amp.sustain = clamp(r.amp.sustain + x / 100, 0, 1);
        break;
      case 'amp_veltrack':
        r.velTrack = clamp(r.velTrack + x / 100, 0, 1);
        break;
      case 'volume':
        r.volume += x;
        break;
      case 'pan':
        r.pan = clamp(r.pan + x / 100, -1, 1);
        break;
      case 'tune':
      case 'pitch':
        r.tune += x;
        break;
      default: {
        const stage = m.target.slice(6) as 'delay' | 'attack' | 'hold' | 'decay' | 'release';
        r.amp[stage] = Math.max(0, r.amp[stage] + x);
      }
    }
  }
}

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};
const int = (v: string) => {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Build one region from its inherited and own opcodes, applied in order (later wins). null = not playable. */
function buildRegion(ops: Opcode[], ctl: Control, warn: (key: string, message: string) => void): Draft | null {
  const key = (v: string) => sfzKey(v, ctl.octaveOffset, ctl.noteOffset);
  const r: SfzRegion = {
    samplePath: '',
    loKey: 0,
    hiKey: 127,
    loVel: 0,
    hiVel: 127,
    rootKey: 60 + ctl.octaveOffset * 12 + ctl.noteOffset,
    tune: 0,
    keyTrack: 100,
    offset: 0,
    loop: 'none',
    volume: 0,
    pan: 0,
    velTrack: 1,
    amp: { ...SFZ_DEFAULT_ENVELOPE },
    trigger: 'attack',
  };
  const draft: Draft = { region: r, needsSwitchHeld: false, cc: new Map(), legato: false, mods: [], curves: new Map() };
  let sample: string | undefined;
  let defaultPath = ctl.defaultPath;
  let tune = 0;
  let transpose = 0;
  let volume = 0;
  /** group_volume, master_volume…: dB added to `volume`. */
  const extraDb: Record<string, number> = {};
  /** amplitude, group_amplitude…: percentages multiplied in. */
  const amplitude: Record<string, number> = {};
  let end: number | undefined;
  let loopMode: LoopMode | undefined;
  let loopStart: number | undefined;
  let loopEnd: number | undefined;
  let group: number | undefined;
  let offBy: number | undefined;
  let seqLength: number | undefined;
  let seqPosition: number | undefined;
  let loRand: number | undefined;
  let hiRand: number | undefined;
  let filType = 'lpf_2p';
  let cutoff: number | undefined;
  let resonance = 0;
  let swLo: number | undefined;
  let swHi: number | undefined;
  let ccTriggered = false;

  for (const [raw, value] of ops) {
    const name = ALIASES[raw] ?? raw;
    let n: number | null | undefined;
    switch (name) {
      case 'sample':
        sample = value.replace(/^"(.*)"$/, '$1');
        break;
      case 'default_path':
        defaultPath = value;
        break;
      case 'lokey':
        if ((n = key(value)) !== null) r.loKey = n;
        break;
      case 'hikey':
        if ((n = key(value)) !== null) r.hiKey = n;
        break;
      case 'key':
        if ((n = key(value)) !== null) r.loKey = r.hiKey = r.rootKey = n;
        break;
      case 'pitch_keycenter':
        if (value.trim().toLowerCase() === 'sample') {
          warn('keycenter', "Some regions take their root key from the sample file (pitch_keycenter=sample), which isn't supported; middle C was assumed.");
        } else if ((n = key(value)) !== null) {
          r.rootKey = n;
        }
        break;
      case 'lovel':
        if ((n = int(value)) !== undefined) r.loVel = n;
        break;
      case 'hivel':
        if ((n = int(value)) !== undefined) r.hiVel = n;
        break;
      case 'pitch_keytrack':
        if ((n = num(value)) !== undefined) r.keyTrack = n;
        break;
      case 'tune':
        if ((n = num(value)) !== undefined) tune = n;
        break;
      case 'transpose':
        if ((n = num(value)) !== undefined) transpose = n;
        break;
      case 'volume':
        if ((n = num(value)) !== undefined) volume = n;
        break;
      case 'group_volume':
      case 'master_volume':
      case 'global_volume':
        if ((n = num(value)) !== undefined) extraDb[name] = n;
        break;
      case 'amplitude':
      case 'group_amplitude':
      case 'master_amplitude':
      case 'global_amplitude':
        if ((n = num(value)) !== undefined) amplitude[name] = n;
        break;
      case 'pan':
        if ((n = num(value)) !== undefined) r.pan = clamp(n / 100, -1, 1);
        break;
      case 'amp_veltrack':
        if ((n = num(value)) !== undefined) r.velTrack = clamp(n / 100, 0, 1);
        break;
      case 'ampeg_delay':
      case 'ampeg_attack':
      case 'ampeg_hold':
      case 'ampeg_decay':
      case 'ampeg_release':
        if ((n = num(value)) !== undefined) r.amp[name.slice(6) as 'delay' | 'attack' | 'hold' | 'decay' | 'release'] = Math.max(0, n);
        break;
      case 'ampeg_sustain':
        if ((n = num(value)) !== undefined) r.amp.sustain = clamp(n / 100, 0, 1);
        break;
      case 'offset':
        if ((n = int(value)) !== undefined) r.offset = Math.max(0, n);
        break;
      case 'end':
        if ((n = int(value)) !== undefined) end = n;
        break;
      case 'loop_mode':
        loopMode = LOOP_MODES[value.toLowerCase()] ?? loopMode;
        break;
      case 'loop_start':
        if ((n = int(value)) !== undefined) loopStart = Math.max(0, n);
        break;
      case 'loop_end':
        if ((n = int(value)) !== undefined) loopEnd = n;
        break;
      case 'trigger': {
        const t = value.toLowerCase();
        r.trigger = t === 'release' || t === 'release_key' ? 'release' : 'attack';
        draft.legato = t === 'legato';
        break;
      }
      case 'group':
        if ((n = int(value)) !== undefined) group = n;
        break;
      case 'off_by':
        if ((n = int(value)) !== undefined) offBy = n;
        break;
      case 'seq_length':
        if ((n = int(value)) !== undefined) seqLength = n;
        break;
      case 'seq_position':
        if ((n = int(value)) !== undefined) seqPosition = n;
        break;
      case 'lorand':
        if ((n = num(value)) !== undefined) loRand = n;
        break;
      case 'hirand':
        if ((n = num(value)) !== undefined) hiRand = n;
        break;
      case 'fil_type':
        filType = value.toLowerCase();
        break;
      case 'cutoff':
        if ((n = num(value)) !== undefined) cutoff = n;
        break;
      case 'resonance':
        if ((n = num(value)) !== undefined) resonance = n;
        break;
      case 'sw_last':
        if ((n = key(value)) !== null) swLo = swHi = n;
        break;
      case 'sw_lolast':
        if ((n = key(value)) !== null) swLo = n;
        break;
      case 'sw_hilast':
        if ((n = key(value)) !== null) swHi = n;
        break;
      case 'sw_down':
      case 'sw_previous':
        if (key(value) !== null) draft.needsSwitchHeld = true;
        break;
      case 'sw_default':
        if ((n = key(value)) !== null && ctl.swDefault === undefined) ctl.swDefault = n;
        break;
      default: {
        const cc = /^(lo|hi)(hd)?cc(\d+)$/.exec(name);
        const mod = MOD_RE.exec(name);
        const curve = CURVE_RE.exec(name);
        if (mod && (n = num(value)) !== undefined) {
          const target = ALIASES[mod[1]] ?? mod[1];
          draft.mods = [...draft.mods.filter(m => !(m.target === target && m.cc === Number(mod[2]))), { target, cc: Number(mod[2]), amount: n }];
        } else if (curve && (n = int(value)) !== undefined) {
          draft.curves.set(ALIASES[curve[1]] ?? curve[1], n);
        } else if (cc && (n = num(value)) !== undefined) {
          const range = draft.cc.get(Number(cc[3])) ?? [0, 127];
          range[cc[1] === 'lo' ? 0 : 1] = cc[2] ? n * 127 : n;
          draft.cc.set(Number(cc[3]), range);
        } else if (/^(?:on|start)_(?:lo|hi)(?:hd)?cc\d+$/.test(name)) {
          ccTriggered = true;
        } else if (/^(?:amplfo|pitchlfo|fillfo|pitcheg|fileg|lfo\d+|eg\d+)_/.test(name)) {
          warn('modulation', "Vibrato, tremolo and other modulation (LFOs, pitch and filter envelopes) aren't supported and were left out.");
        }
        // everything else (lochan/hichan, polyphony, velocity curves, labels…) doesn't change how a note sounds here
      }
    }
  }

  if (ccTriggered) {
    warn('cc-trigger', 'Regions played by a MIDI controller rather than a key (such as pedal noises) were skipped.');
    return null;
  }
  if (!sample) {
    warn('no-sample', 'Some regions had no sample and were skipped.');
    return null;
  }
  if (sample.startsWith('*')) {
    warn('generator', `Regions using SFZ's built-in sounds (${sample} and the like) aren't supported and were skipped.`);
    return null;
  }
  // end=0 / end=-1 is how SFZ writes a silent region
  if (end !== undefined && end <= 0) return null;
  // hikey=-1 (or lokey above hikey) means no key plays it
  if (r.hiKey < 0 || r.loKey > 127 || r.loKey > r.hiKey || r.loVel > r.hiVel) return null;
  r.loKey = clamp(r.loKey, 0, 127);
  r.hiKey = clamp(r.hiKey, 0, 127);
  r.loVel = clamp(r.loVel, 0, 127);
  r.hiVel = clamp(r.hiVel, 0, 127);

  const gain = Object.values(amplitude).reduce((g, a) => g * a / 100, 1);
  if (gain <= 0) return null;
  r.samplePath = resolveSfzPath(ctl.root, defaultPath, sample);
  r.tune = tune + transpose * 100;
  r.volume = volume + Object.values(extraDb).reduce((a, b) => a + b, 0) + 20 * Math.log10(gain);

  // SFZ's end and loop_end name the last frame played (inclusive, as in the WAV smpl chunk); ours are exclusive
  if (end !== undefined) r.end = end + 1;
  if (loopStart !== undefined) r.loopStart = loopStart;
  if (loopEnd !== undefined) r.loopEnd = loopEnd + 1;
  // The spec says a region without loop_mode loops when its sample file has a loop. The
  // files aren't read here: such a region is marked, and the player loops it if the file has one.
  r.loop = loopMode ?? (loopStart !== undefined || loopEnd !== undefined ? 'continuous' : 'none');
  if (loopMode === undefined && r.loop === 'none') r.loopFromSample = true;

  // group 0 is SFZ's "no group"
  if (group) r.chokeGroup = group;
  if (offBy) r.offBy = offBy;
  if (seqLength !== undefined && seqLength > 1) {
    r.seqLength = seqLength;
    r.seqPosition = clamp(seqPosition ?? 1, 1, seqLength);
  }
  if (loRand !== undefined || hiRand !== undefined) {
    r.loRand = loRand ?? 0;
    r.hiRand = hiRand ?? 1;
  }

  if (cutoff !== undefined && cutoff > 0 && cutoff < 20000) {
    if (filType.startsWith('lpf_')) {
      // q is the resonance peak in dB (as Web Audio's low-pass Q and SF2's initialFilterQ). A
      // one-pole filter has no resonance: −3 dB at the cutoff, like Butterworth's 0.707.
      // 4- and 6-pole filters are approximated by a two-pole one.
      r.filter = { cutoff, q: filType === 'lpf_1p' ? -3.01 : resonance };
    } else {
      warn('filter', 'Filters other than low-pass were left out.');
    }
  }
  if (swLo !== undefined || swHi !== undefined) draft.sw = [swLo ?? swHi!, swHi ?? swLo!];
  return draft;
}

/** Keep the drafts that pass, unless none would: playing too much beats playing nothing. */
function prefer(drafts: Draft[], keep: (d: Draft) => boolean, onDrop: () => void): Draft[] {
  const kept = drafts.filter(keep);
  if (kept.length === drafts.length || !kept.length) return drafts;
  onDrop();
  return kept;
}

/**
 * Parse one .sfz file's text. `path` is its bank-relative path; `readText` fetches #include
 * files (and returns null for a missing one). Sample paths are resolved against the bank.
 */
export async function parseSfz(text: string, path: string, readText: ReadText): Promise<SfzInstrument> {
  const warnings: string[] = [];
  const warned = new Set<string>();
  const warn = (key: string, message: string) => {
    if (warned.has(key)) return;
    warned.add(key);
    warnings.push(message);
  };

  const lx: Lexer = { root: path, defines: new Map(), readText, warn, stack: [path], tokens: [] };
  await lexFile(text, path, lx);

  const ctl: Control = { root: path, defaultPath: '', octaveOffset: 0, noteOffset: 0, cc: new Map() };
  let level: 'control' | 'global' | 'master' | 'group' | 'region' | 'skip' | null = null;
  let global: Opcode[] = [];
  let master: Opcode[] = [];
  let group: Opcode[] = [];
  let region: Opcode[] | null = null;
  let drafts: Draft[] = [];
  const flush = () => {
    if (!region) return;
    const d = buildRegion([...global, ...master, ...group, ...region], ctl, warn);
    if (d) drafts.push(d);
    region = null;
  };

  for (const t of lx.tokens) {
    if (t.kind === 'header') {
      flush();
      switch (t.name) {
        case 'control':
          ctl.defaultPath = ''; // as sfizz: each <control> starts a fresh default_path
          level = 'control';
          break;
        case 'global':
          global = [];
          master = [];
          group = [];
          level = 'global';
          break;
        case 'master':
          master = [];
          group = [];
          level = 'master';
          break;
        case 'group':
          group = [];
          level = 'group';
          break;
        case 'region':
          region = [];
          level = 'region';
          break;
        case 'curve':
          warn('curve', 'Custom velocity curves (<curve>) aren\'t supported; the usual curve is used.');
          level = 'skip';
          break;
        case 'effect':
          warn('effect', 'Effects such as reverb and chorus (<effect>) were left out.');
          level = 'skip';
          break;
        default:
          warn(`header:${t.name}`, `The <${t.name}> section isn't supported and was skipped.`);
          level = 'skip';
      }
      continue;
    }
    const op: Opcode = [t.name, t.value];
    switch (level) {
      case 'control': {
        const v = t.value;
        let m: RegExpExecArray | null;
        if (t.name === 'default_path') ctl.defaultPath = v;
        else if (t.name === 'octave_offset') ctl.octaveOffset = int(v) ?? 0;
        else if (t.name === 'note_offset') ctl.noteOffset = int(v) ?? 0;
        else if (t.name === 'sw_default') ctl.swDefault = sfzKey(v, ctl.octaveOffset, ctl.noteOffset) ?? ctl.swDefault;
        else if ((m = /^set_(hd)?cc(\d+)$/.exec(t.name)) && num(v) !== undefined) ctl.cc.set(Number(m[2]), num(v)! * (m[1] ? 127 : 1));
        break;
      }
      case 'global':
        global.push(op);
        break;
      case 'master':
        master.push(op);
        break;
      case 'group':
        group.push(op);
        break;
      case 'region':
        region!.push(op);
        break;
      // opcodes before any header, or under one we skip, are ignored
    }
  }
  flush();

  // Controllers are taken to be at rest (pedals up, mod wheel down), so of two layers
  // chosen by the sustain pedal only the pedal-up one plays.
  const atRest = (cc: number) => ctl.cc.get(cc) ?? CC_AT_REST[cc] ?? 0;
  for (const d of drafts) applyMods(d, atRest);
  drafts = prefer(
    drafts,
    d => [...d.cc].every(([cc, [lo, hi]]) => lo <= atRest(cc) && atRest(cc) <= hi),
    () => warn('cc', 'Some regions depend on MIDI controllers such as the sustain pedal or mod wheel; only those that play with the controllers at rest were kept.'),
  );

  // Key switches choose one articulation at a time (sustain, staccato, pizzicato…); we
  // play the default one: sw_default, or else the lowest switch.
  const switches = drafts.filter(d => d.sw).map(d => d.sw!);
  if (switches.length) {
    const fits = (k: number) => switches.some(([lo, hi]) => lo <= k && k <= hi);
    const chosen = ctl.swDefault !== undefined && fits(ctl.swDefault) ? ctl.swDefault : Math.min(...switches.map(s => s[0]));
    drafts = prefer(
      drafts,
      d => !d.sw || (d.sw[0] <= chosen && chosen <= d.sw[1]),
      () => warn('keyswitch', `This instrument has several articulations chosen by key switches; only the one on ${noteName(chosen)} is played.`),
    );
  }
  drafts = prefer(
    drafts,
    d => !d.needsSwitchHeld,
    () => warn('sw-held', 'Regions that play only while a key switch is held, or after a particular note, were left out.'),
  );
  // trigger=legato regions are transitions played instead of the normal attack when notes overlap
  drafts = prefer(
    drafts,
    d => !d.legato,
    () => warn('legato', 'Legato transitions were left out; every note uses its normal attack.'),
  );

  const regions = drafts.map(d => d.region);
  if (!regions.length) warn('empty', 'No playable regions were found in this instrument.');
  return { name: presetName(path), regions, warnings };
}

/**
 * Read every .sfz file of a bank into presets: one per file, bank 0, programs 0, 1, 2… in
 * the order given. `readText` returns a text file's contents by bank-relative path
 * ('/'-separated), or null. Samples are shared between presets by path; their rate and
 * length are only known once the audio is decoded.
 */
export async function parseSfzBank(sfzPaths: string[], readText: ReadText, opts: { name: string }): Promise<ParsedBank> {
  const presets: SamplePreset[] = [];
  const samples: SampleInfo[] = [];
  const sampleIndex = new Map<string, number>();
  const warnings: string[] = [];
  const addWarning = (w: string) => {
    if (!warnings.includes(w)) warnings.push(w);
  };
  for (const path of sfzPaths) {
    const label = fileName(path);
    const text = await readText(path);
    if (text === null) {
      addWarning(`"${label}" couldn't be read and was skipped.`);
      continue;
    }
    const inst = await parseSfz(text, path, readText);
    for (const w of inst.warnings) addWarning(sfzPaths.length > 1 ? `${label}: ${w}` : w);
    const regions: SampleRegion[] = inst.regions.map(({ samplePath, ...rest }) => {
      let sample = sampleIndex.get(samplePath);
      if (sample === undefined) {
        sample = samples.length;
        sampleIndex.set(samplePath, sample);
        samples.push({ name: fileName(samplePath).replace(/\.[^.]*$/, ''), sampleRate: 0, frames: 0, source: { kind: 'file', path: samplePath } });
      }
      return { ...rest, sample };
    });
    // past 128 instruments, carry on in the next bank
    presets.push({ name: inst.name, bank: Math.floor(presets.length / 128), program: presets.length % 128, regions });
  }
  if (!presets.some(p => p.regions.length)) throw new BankFormatError('No playable instruments were found in this bank.');
  return { format: 'sfz', name: opts.name, info: {}, presets, samples, warnings };
}
