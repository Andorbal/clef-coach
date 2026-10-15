#!/usr/bin/env node
/**
 * Fetch the sound banks the app hosts itself into public/sounds/, so a build serves
 * them next to the app (Settings → Instrument sounds → Free sounds downloads them from
 * there).
 *
 * GeneralUser GS's author asks that his download links aren't used by apps directly —
 * "provide your own local copy instead" — so the deploy keeps one. Each file is pinned
 * to a commit and checked against its SHA-256; files already in place are kept.
 *
 *   npm run sounds
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'public', 'sounds');

const FILES = [
  {
    name: 'GeneralUser-GS.sf3',
    // GeneralUser GS 2.0.3 by S. Christian Collins, compressed to SF3 by SpessaSynth
    url: 'https://raw.githubusercontent.com/spessasus/SpessaSynth/5bef3d230d63e73946d4c77342eef953d6542fee/soundfonts/GeneralUserGS.sf3',
    sha256: 'e2ed326ff44d15f78f2fdc72403b6fa6b77ee7266d3aad0d2198bc95797bc66c',
  },
  {
    name: 'GeneralUser-GS.sf2',
    url: 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/684543d5e5efaef08d02be50dcda8d552478fa60/GeneralUser-GS.sf2',
    sha256: '9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe',
  },
  {
    name: 'GeneralUser-GS-LICENSE.txt',
    url: 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/684543d5e5efaef08d02be50dcda8d552478fa60/documentation/LICENSE.txt',
  },
];

const sha = buf => createHash('sha256').update(buf).digest('hex');

mkdirSync(out, { recursive: true });
let failed = 0;
for (const f of FILES) {
  const dest = path.join(out, f.name);
  if (existsSync(dest) && (!f.sha256 || sha(readFileSync(dest)) === f.sha256)) {
    console.log(`✓ ${f.name} (already here)`);
    continue;
  }
  try {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (f.sha256 && sha(buf) !== f.sha256) throw new Error('checksum mismatch');
    writeFileSync(dest, buf);
    console.log(`✓ ${f.name} (${(buf.length / 1048576).toFixed(1)} MB)`);
  } catch (e) {
    failed++;
    console.warn(`✗ ${f.name}: ${e.message}`);
  }
}
// a missing bank only means its download button won't work in this build
if (failed) console.warn(`${failed} file(s) could not be fetched; the app works without them.`);
