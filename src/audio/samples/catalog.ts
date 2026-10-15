/**
 * Free sound banks the app can download for you. Every one is under a licence that
 * allows this — public domain, CC0, MIT, CC-BY or GeneralUser GS's own permissive
 * licence — and the attribution each asks for is shown with it.
 *
 * GeneralUser GS's author asks that his files aren't linked to directly, so the app's
 * own copy is used (the deploy fetches it next to the app: tools/fetch-sounds.mjs). The
 * others come straight from their GitHub repositories, pinned to a commit so they never
 * change underneath us.
 */

export interface CatalogEntry {
  id: string;
  name: string;
  format: 'sf2' | 'sf3' | 'sfz';
  /** Download size in bytes. */
  size: number;
  /** What it plays. */
  covers: string;
  blurb: string;
  credit: string;
  license: string;
  licenseUrl: string;
  /** Single-file banks: where to fetch it, tried in order (the app's own copy first). */
  urls?: string[];
  /** SFZ instruments, fetched file by file: the repository folder and the .sfz to read. */
  sfz?: { base: string; files: string[]; inline?: Record<string, string> };
  /** Covers the General MIDI set (so the whole band can use it). */
  gm?: boolean;
  /** A good first choice. */
  recommended?: boolean;
  /** Big enough to want a computer with plenty of memory. */
  big?: boolean;
}

const RAW = 'https://raw.githubusercontent.com';

/** Virtuosity Drums: the overhead microphones only, on a General MIDI key map (open, closed and pedal hi-hat on their own keys). */
const VIRTUOSITY_GM = `#include "keymaps/keymap_basic.sfz"
<control>
set_cc1=31
set_cc72=63.5
set_cc76=63.5
set_cc81=63.5
set_cc86=63.5
set_cc90=63.5
set_cc105=127
set_cc106=127
<global>
loop_mode=one_shot
amplitude_oncc105=100
width=0
width_oncc106=100
locc105=1
tune_cc90=1200
tune_curvecc90=1
note_polyphony=3
group=503
off_mode=normal
#include "mappings/oh_basic.sfz"
#include "mappings/mutecurves.sfz"
`;

export const SOUND_CATALOG: CatalogEntry[] = [
  {
    id: 'generaluser-gs-sf3',
    name: 'GeneralUser GS',
    format: 'sf3',
    size: 8_423_728,
    covers: 'Every General MIDI instrument and 13 drum kits',
    blurb: 'A complete, carefully balanced band and orchestra in under 9 MB. The best place to start.',
    credit: 'S. Christian Collins (compressed to SF3 by SpessaSynth)',
    license: 'GeneralUser GS License v2.0 — free to use, including in software',
    licenseUrl: 'https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/LICENSE.txt',
    urls: ['sounds/GeneralUser-GS.sf3'],
    gm: true,
    recommended: true,
  },
  {
    id: 'generaluser-gs-sf2',
    name: 'GeneralUser GS (uncompressed)',
    format: 'sf2',
    size: 32_319_396,
    covers: 'Every General MIDI instrument and 13 drum kits',
    blurb: 'The same bank as the original 16-bit SoundFont: a bigger download, no decoding when it loads.',
    credit: 'S. Christian Collins',
    license: 'GeneralUser GS License v2.0 — free to use, including in software',
    licenseUrl: 'https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/LICENSE.txt',
    urls: ['sounds/GeneralUser-GS.sf2'],
    gm: true,
  },
  {
    id: 'musescore-general',
    name: 'MuseScore General',
    format: 'sf3',
    size: 51_278_610,
    covers: 'Every General MIDI instrument and drum kits',
    blurb: 'The bank MuseScore plays scores with: warm, orchestral and well-rounded.',
    credit: 'S. Christian Collins, from FluidR3 by Frank Wen (MuseScore)',
    license: 'MIT',
    licenseUrl: `${RAW}/musescore/MuseScore/3654226c2e99289916916953a98e585a3d3b315a/share/sound/MS%20Basic_License.md`,
    urls: [`${RAW}/musescore/MuseScore/3654226c2e99289916916953a98e585a3d3b315a/share/sound/MS%20Basic.sf3`],
    gm: true,
  },
  {
    id: 'splendid-grand-piano',
    name: 'Splendid Grand Piano',
    format: 'sfz',
    size: 76_800_000,
    covers: 'A Steinway grand piano, four velocity layers',
    blurb: 'A real concert grand for your own playing, or the band’s piano.',
    credit: 'Akai (released to the public domain); SFZ by sfzinstruments',
    license: 'Public domain',
    licenseUrl: 'https://github.com/sfzinstruments/SplendidGrandPiano#readme',
    sfz: { base: `${RAW}/sfzinstruments/SplendidGrandPiano/1c595d827b7fd7f0be3134aaed0f90b3662a09cf/`, files: ['Splendid Grand Piano.sfz'] },
  },
  {
    id: 'virtuosity-drums',
    name: 'Virtuosity Drums',
    format: 'sfz',
    size: 142_800_000,
    covers: 'A jazz club drum kit on the General MIDI drum keys',
    blurb: 'A real kit recorded live in Boston, played with sticks: kick, snare, toms, hi-hat and cymbals.',
    credit: 'Austin McMahon at Virtuosity Musical Instruments; SFZ by sfzinstruments',
    license: 'CC0 (public domain)',
    licenseUrl: `${RAW}/sfzinstruments/virtuosity_drums/9f04cf9a734527edfbb0a4eee1f674e45bbf71bc/LICENSE`,
    sfz: {
      base: `${RAW}/sfzinstruments/virtuosity_drums/9f04cf9a734527edfbb0a4eee1f674e45bbf71bc/`,
      files: ['Programs/Virtuosity Drums (GM).sfz'],
      inline: { 'Programs/Virtuosity Drums (GM).sfz': VIRTUOSITY_GM },
    },
  },
  {
    id: 'salamander-grand-piano',
    name: 'Salamander Grand Piano',
    format: 'sfz',
    size: 746_600_000,
    covers: 'A Yamaha C5 grand, 16 velocity layers with string resonance and hammer noise',
    blurb: 'A very detailed grand piano at 48 kHz / 24-bit. It wants a computer with plenty of memory: roughly 2 GB once every sample is loaded.',
    credit: 'Alexander Holm; SFZ by kinwie (sfzinstruments)',
    license: 'CC BY 3.0',
    licenseUrl: `${RAW}/sfzinstruments/SalamanderGrandPiano/3382bf9496bba2486f5ab0de55a264d1dfc38404/LICENSE`,
    sfz: { base: `${RAW}/sfzinstruments/SalamanderGrandPiano/3382bf9496bba2486f5ab0de55a264d1dfc38404/`, files: ['Salamander Grand Piano V3.sfz'] },
    big: true,
  },
];
