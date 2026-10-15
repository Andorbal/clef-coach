import { describe, expect, it } from 'vitest';
import { SongFormatError } from './format';
import { importBytes, sniffKind } from './importers';

const enc = (s: string) => new TextEncoder().encode(s);

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
  </measure></part>
</score-partwise>`;

describe('importing a file whatever its name (iPad pickers offer every file)', () => {
  it('tells song files apart by their first bytes', () => {
    expect(sniffKind(enc(XML))).toBe('musicxml');
    expect(sniffKind(enc(`﻿\n  ${XML}`))).toBe('musicxml'); // BOM + blank lines
    expect(sniffKind(new Uint8Array([0xff, 0xfe, 0x3c, 0x00]))).toBe('musicxml'); // UTF-16
    expect(sniffKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe('musicxml'); // zip (.mxl)
    expect(sniffKind(enc('MThd'))).toBe('midi');
    expect(sniffKind(enc(' {"format": "clef-coach-song"}'))).toBe('clefsong');
    expect(sniffKind(enc('%PDF-1.7'))).toBeNull();
    expect(sniffKind(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull(); // JPEG
  });

  it('imports MusicXML with an unexpected file name', async () => {
    const r = await importBytes('Downloaded score', enc(XML));
    expect(r.kind).toBe('musicxml');
    expect(r.song.staves[0].voices[0]).toContain('C4');
  });

  it('keeps the other parts as the band, checked like any song, unless asked not to', async () => {
    const duo = XML.replace('</part-list>', '<score-part id="P2"><part-name>Strings</part-name></score-part></part-list>').replace(
      '</score-partwise>',
      `<part id="P2"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
        <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note><note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      </measure></part></score-partwise>`,
    );
    const r = await importBytes('duo.musicxml', enc(duo), { parts: ['P1'] });
    expect(r.song.band).toEqual([{ name: 'Strings', program: 49, staves: [{ clef: 'treble', voices: ['[E4 G4]/w |'] }] }]);
    expect(r.warnings).toEqual(['Imported "Piano"; the other part ("Strings") plays as the band.']);
    const alone = await importBytes('duo.musicxml', enc(duo), { parts: ['P1'], band: false });
    expect(alone.song.band).toBeUndefined();
    expect(alone.warnings).toEqual([]);
  });

  it('explains what it can read when given something else', async () => {
    const err = await importBytes('Scan.pdf', enc('%PDF-1.7 ...')).catch(e => e);
    expect(err).toBeInstanceOf(SongFormatError);
    expect((err as SongFormatError).issues[0]).toMatch(/isn’t a song file.*MusicXML.*Scan sheet music/);
  });
});
