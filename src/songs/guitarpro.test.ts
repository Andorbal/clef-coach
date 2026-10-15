import * as alphaTab from '@coderline/alphatab';
import { describe, expect, it } from 'vitest';
import { isSongArchive } from './bulk';
import { parseSongDoc, songToDoc } from './format';
import { gpDrumKey } from './guitarpro';
import { importBytes, sniffKind } from './importers';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;

/** A Guitar Pro 7 file (.gp) written by alphaTab from AlphaTex (string 1 = the highest string). */
function gp(tex: string): Uint8Array {
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex);
  return new alphaTab.exporter.Gp7Exporter().export(score, new alphaTab.Settings());
}

const RIFF = gp(String.raw`\title "Riff" \artist "Someone" \tempo 132 .
\track "Lead" \staff {tabs} \ts 4 4
0.1.4 2.1 3.1 5.1 | (0.1 1.2).2 r.2`);

const voiceOf = (song: { staves: { voices: string[] }[] }) => song.staves[0].voices[0];

describe('Guitar Pro import', () => {
  it('reads the title, artist, tempo, notes and strings', async () => {
    const r = await importBytes('riff.gp', RIFF);
    expect(r.kind).toBe('guitarpro');
    expect(r.song).toMatchObject({ title: 'Riff', composer: 'Someone', instrument: 'guitar', tempo: 132, time: [4, 4] });
    expect(r.song.staves[0].clef).toBe('treble8vb');
    expect(voiceOf(r.song)).toBe('E4/q%1 F#4%1 G4%1 A4%1 | [C4 E4]/h%2,1 r |');
  });

  it('knows a Guitar Pro file by its content, whatever its name', async () => {
    expect(sniffKind(RIFF)).toBe('guitarpro');
    expect(isSongArchive('riff.zip', RIFF)).toBe(false);
    expect((await importBytes('download', RIFF)).kind).toBe('guitarpro');
  });

  it('plays out repeats and sounds a capo', async () => {
    const r = await importBytes(
      'capo.gp',
      gp(String.raw`. \track "Lead" \staff {tabs} \capo 2
\ro 0.1.1 | \rc 2 2.1.1`),
    );
    expect(voiceOf(r.song)).toBe('F#4/w%1 | Ab4%1 | F#4%1 | Ab4%1 |');
  });

  it('keeps the pitch of a retuned guitar and says so', async () => {
    const r = await importBytes('dropd.gp', gp(String.raw`. \track "Lead" \staff {tabs} \tuning e4 b3 g3 d3 a2 d2
0.6.2 2.6.2`));
    expect(voiceOf(r.song)).toBe('D2/h E2%6 |');
    expect(r.warnings.some(w => w.startsWith('The guitar part is tuned D A D G B E; Clef Coach uses standard tuning'))).toBe(true);
  });

  it('writes each track for its own instrument, and opens the player’s', async () => {
    const band = gp(String.raw`. \track "Lead" \staff {tabs}
0.1.1 | 2.1.1
\track "Bass" \staff {tabs} \tuning g2 d2 a1 e1 \instrument 33
0.3.1 | 0.4.1`);
    const piano = await importBytes('band.gp', band, { instrument: 'piano' });
    expect(piano.song.instrument).toBe('guitar');
    expect(piano.parts?.map(p => p.name)).toEqual(['Lead', 'Bass']);
    const bass = await importBytes('band.gp', band, { instrument: 'bass' });
    expect(bass.song.instrument).toBe('bass');
    expect(bass.song.staves[0].clef).toBe('bass8vb');
    expect(voiceOf(bass.song)).toBe('A1/w%3 | E1%4 |');
    expect((await importBytes('band.gp', band, { parts: ['1'] })).song.instrument).toBe('bass');
  });

  it('starts where the part starts playing', async () => {
    const r = await importBytes('intro.gp', gp(String.raw`. \track "Lead" \staff {tabs}
r.1 | r.1 | 0.1.1`));
    expect(voiceOf(r.song)).toBe('E4/w%1 |');
    expect(r.warnings).toContain('2 empty bars at the start were left out.');
  });

  it('plays drum tracks in the band, and leaves them out on request', async () => {
    const drums = String.raw`\track "Drums" \instrument percussion \staff {score} \articulation defaults "Kick (hit)".4 "Kick (hit)" "Kick (hit)" "Kick (hit)"`;
    await expect(importBytes('drums.gp', gp(`. ${drums}`))).rejects.toThrow(/only has drum tracks/);
    const bytes = gp(String.raw`. \track "Lead" \staff {tabs} 0.1.1 ${drums}`);
    const r = await importBytes('band.gp', bytes);
    expect(r.song.band).toEqual([{ name: 'Drums', program: 1, drums: true, staves: [{ clef: 'bass', voices: ['kick2/q kick2 kick2 kick2 |'] }] }]);
    expect(r.parts?.map(p => p.name)).toEqual(['Lead']);
    expect(r.warnings).toContain('Imported "Lead"; the other track ("Drums") plays as the band.');
    const alone = await importBytes('band.gp', bytes, { band: false });
    expect(alone.song.band).toBeUndefined();
    expect(alone.song.staves).toEqual(r.song.staves);
    expect(alone.warnings).toContain('1 drum track was left out.');
  });

  it('writes a drum track with drum names, and the other tracks with their sounds', async () => {
    const r = await importBytes(
      'groove.gp',
      gp(String.raw`. \track "Lead" \staff {tabs} 0.1.2 2.1 | 3.1.1
\track "Bass" \staff {tabs} \tuning g2 d2 a1 e1 \instrument 33
0.3.1 | 0.4.1
\track "Kit" \instrument percussion \staff {score} \articulation defaults
("Kick (hit)" "Hi-Hat (closed)").8 "Hi-Hat (closed)" ("Snare (hit)" "Hi-Hat (closed)") "Hi-Hat (closed)" ("Kick (hit)" "Hi-Hat (closed)") "Hi-Hat (closed)" ("Snare (hit)" "Hi-Hat (closed)") "Hi-Hat (open)" | "Crash high (hit)".1`),
    );
    expect(r.song.staves[0].voices[0]).toBe('E4/h%1 F#4%1 | G4/w%1 |');
    const [bass, kit] = r.song.band!;
    expect(bass).toEqual({ name: 'Bass', program: 34, staves: [{ clef: 'bass8vb', voices: ['A1/w | E1 |'] }] });
    expect(kit.drums).toBe(true);
    expect(kit.staves[0].voices).toEqual(['[kick2 hat]/e hat [snare hat] hat [kick2 hat] hat [snare hat] open-hat | crash/q r/h. |']);
    const again = parseSongDoc(songToDoc(r.song));
    expect(again.song.band).toEqual(r.song.band);
  });

  it('finds the drum a percussion note plays', () => {
    // the track's own articulations (Guitar Pro 6 and later) say which key each sounds
    expect(gpDrumKey(1, [{ outputMidiNumber: 36 }, { outputMidiNumber: 42 }])).toBe(42);
    // past them: Guitar Pro 7 articulation ids, which are the GM key up to 87 (and the fret in GP3–5)
    expect(gpDrumKey(38, [])).toBe(38);
    expect(gpDrumKey(91, [])).toBe(38); // snare rim shot
    expect(gpDrumKey(92, [])).toBe(46); // half-open hi-hat
    expect(gpDrumKey(-1, [])).toBeNull();
    expect(gpDrumKey(200, [])).toBeNull();
  });
});
