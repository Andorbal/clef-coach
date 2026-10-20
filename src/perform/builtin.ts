/**
 * Built-in sounds for every General MIDI program, so a band always plays — no sound
 * bank needed. Struck and plucked instruments use the app's rendered voices (piano,
 * electric piano, guitar, bass, mallets); held ones the live oscillator patches
 * (src/audio/synth/live.ts); drums the synthesised kits.
 */
import type { LivePatch } from '../audio/synth/live';
import type { SynthVoiceId } from '../music/instruments';
import { MALLET_VARIANTS } from '../music/instruments';
import { clampProgram } from '../music/gm';

export type DrumKitId = 'standard' | 'room' | 'power' | 'electronic' | 'jazz' | 'brush';

export type BuiltinSound =
  /** a rendered voice; band notes are sounding pitch, so transposing mallets get `midi − offset` */
  | { kind: 'rendered'; voice: SynthVoiceId; offset: number }
  | { kind: 'live'; patch: LivePatch }
  | { kind: 'drums'; kit: DrumKitId }
  /** nothing in the built-in set comes close (sound effects) */
  | { kind: 'none' };

const rendered = (voice: SynthVoiceId): BuiltinSound => ({ kind: 'rendered', voice, offset: voice in MALLET_VARIANTS ? MALLET_VARIANTS[voice as keyof typeof MALLET_VARIANTS].offset : 0 });
const live = (patch: LivePatch): BuiltinSound => ({ kind: 'live', patch });

/** The drum kit a GM drum program means (GS numbering). */
export function kitFor(program: number): DrumKitId {
  const p = clampProgram(program);
  if (p >= 41 && p < 49) return 'brush';
  if (p >= 33 && p < 41) return 'jazz';
  if (p >= 25 && p < 33) return 'electronic';
  if (p >= 17 && p < 25) return 'power';
  if (p >= 9 && p < 17) return 'room';
  return 'standard';
}

/** The built-in sound for a GM program (1–128), or a drum kit. */
export function builtinFor(program: number, drums: boolean): BuiltinSound {
  if (drums) return { kind: 'drums', kit: kitFor(program) };
  const p = clampProgram(program);
  if (p <= 4) return rendered('piano');
  if (p <= 6) return rendered('epiano');
  if (p <= 8) return rendered('guitar'); // harpsichord, clavinet: plucked and bright
  if (p === 9 || p === 10 || p === 11 || p === 15) return rendered('glockenspiel'); // celesta, glockenspiel, music box, tubular bells
  if (p === 12) return rendered('vibraphone');
  if (p === 13) return rendered('marimba');
  if (p === 14) return rendered('xylophone');
  if (p === 16) return rendered('guitar'); // dulcimer
  if (p === 20 || p === 21) return live('church-organ');
  if (p <= 19) return live('organ');
  if (p <= 24) return live('reed'); // accordion, harmonica
  if (p <= 32) return rendered('guitar');
  if (p <= 40) return rendered('bass');
  if (p <= 44) return live('solo-strings');
  if (p === 45) return live('strings');
  if (p === 46 || p === 47) return rendered('guitar'); // pizzicato, harp
  if (p === 48) return rendered('bass'); // timpani
  if (p <= 52) return live('strings');
  if (p <= 55) return live('choir');
  if (p <= 64) return live('brass');
  if (p <= 72) return live('reed');
  if (p <= 80) return live('flute');
  if (p <= 88) return live('lead');
  if (p <= 104) return live('pad');
  if (p <= 108) return rendered('guitar'); // sitar, banjo, shamisen, koto
  if (p === 109) return rendered('marimba'); // kalimba
  if (p === 110 || p === 112) return live('reed'); // bagpipe, shanai
  if (p === 111) return live('solo-strings'); // fiddle
  if (p === 113) return rendered('glockenspiel');
  if (p <= 119) return rendered('marimba'); // agogo, steel drums, woodblock, taiko, toms
  if (p === 120) return live('pad');
  return { kind: 'none' };
}

/** A short description of a built-in sound ("Synth strings", "Piano (built-in)") for the mixer. */
export function builtinLabel(sound: BuiltinSound): string {
  switch (sound.kind) {
    case 'drums':
      return `${sound.kit[0].toUpperCase()}${sound.kit.slice(1)} kit`;
    case 'live':
      return { organ: 'Organ', 'church-organ': 'Church organ', strings: 'Strings', 'solo-strings': 'Solo strings', pad: 'Pad', brass: 'Brass', reed: 'Reeds', flute: 'Flute', lead: 'Synth lead', choir: 'Choir' }[sound.patch];
    case 'rendered':
      return {
        piano: 'Piano',
        epiano: 'Electric piano',
        guitar: 'Guitar',
        ukulele: 'Nylon guitar',
        bass: 'Bass',
        marimba: 'Marimba',
        xylophone: 'Xylophone',
        glockenspiel: 'Bells',
        vibraphone: 'Vibraphone',
        violin: 'Violin',
        viola: 'Viola',
        cello: 'Cello',
        doublebass: 'Double bass',
      }[sound.voice];
    default:
      return 'No built-in sound';
  }
}
