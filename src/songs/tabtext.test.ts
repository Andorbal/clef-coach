import { describe, expect, it } from 'vitest';
import { parseSongDoc } from './format';
import { ImportError } from './importkit';
import { importTextTab, looksLikeTab } from './tabtext';

const tab = (...lines: string[]) => lines.join('\n');

/** Import and check the song loads, as the importers do. */
function read(text: string, opts: Parameters<typeof importTextTab>[1] = {}) {
  const res = importTextTab(text, opts);
  const parsed = parseSongDoc(res.song, { id: res.song.id });
  return { ...res, voice: res.song.staves[0].voices[0], score: parsed.score };
}

const SCALE = tab(
  'e|-0---2---3---0---|-5---3---2---0---|',
  'B|-----------------|-----------------|',
  'G|-----------------|-----------------|',
  'D|-----------------|-----------------|',
  'A|-----------------|-----------------|',
  'E|-----------------|-----------------|',
);

describe('text tab: strings, frets and pitches', () => {
  it('reads a guitar tab into notes with their strings', () => {
    const r = read(SCALE);
    expect(r.song.instrument).toBe('guitar');
    expect(r.song.staves[0].clef).toBe('treble8vb');
    expect(r.voice).toBe('E4/q%1 F#4%1 G4%1 E4%1 | A4%1 G4%1 F#4%1 E4%1 |');
    expect(r.song.time).toEqual([4, 4]);
    expect(r.warnings.some(w => /guessed from how the notes are spaced/.test(w))).toBe(true);
  });

  it('reads chords, two-digit frets and every string', () => {
    const r = read(
      tab(
        'e|-0-------|-12------|',
        'B|-1-------|-13------|',
        'G|-0-------|---------|',
        'D|-2-------|---------|',
        'A|-3-------|---------|',
        'E|---------|---------|',
      ),
    );
    expect(r.voice).toBe('[C3 E3 G3 C4 E4]/w%5,4,3,2,1 | [C5 E5]%2,1 |');
  });

  it('keeps hammer-ons and slides as notes, a bend as the fret it starts on, and leaves out muted notes', () => {
    const r = read(
      tab(
        'e|-----------------|',
        'B|-----------------|',
        'G|-5h7-7b9-x-------|',
        'D|-----------------|',
        'A|-----------------|',
        'E|-----------------|',
      ),
    );
    // 5h7: two notes; 7b9: one note (bent to the sound of fret 9); x: a rest
    expect(r.score.staves[0].voices[0].notes.filter(n => n.pitches.length).map(n => n.pitches.map(p => `${p.step}${p.octave}`).join())).toEqual(['C4', 'D4', 'D4']);
    expect(r.warnings).toContain('Bends are written as the fret you start on.');
    expect(r.warnings).toContain('1 dead (muted) note was left out.');
  });

  it('says when there is no tab in the text', () => {
    expect(() => importTextTab('Just a note about my guitar.\nAm C G F')).toThrow(ImportError);
    expect(looksLikeTab('Am C G F')).toBe(false);
    expect(looksLikeTab(SCALE)).toBe(true);
  });
});

describe('text tab: instruments and tunings', () => {
  it('knows a bass tab by its four strings', () => {
    const r = read(tab('G|-----------------|', 'D|-----------------|', 'A|-0---2---3---5---|', 'E|-----------------|'));
    expect(r.song.instrument).toBe('bass');
    expect(r.song.staves[0].clef).toBe('bass8vb');
    expect(r.voice).toBe('A1/q%3 B1%3 C2%3 D2%3 |');
  });

  it('knows a ukulele tab by its string names', () => {
    const r = read(tab('A|-0---------|', 'E|---0-------|', 'C|-----0-----|', 'G|-------0---|'));
    expect(r.song.instrument).toBe('ukulele');
    expect(r.voice).toBe('A4/q%1 E4%2 C4%3 G4%4 |');
  });

  it('reads a guitarist’s G D A E riff as the guitar’s low strings', () => {
    const riff = tab('G|-------|', 'D|-0-2-3-|', 'A|-0-2-3-|', 'E|-------|');
    expect(read(riff).song.instrument).toBe('bass');
    const r = read(riff, { instrument: 'guitar' });
    expect(r.song.instrument).toBe('guitar');
    expect(r.voice).toBe('[A2 D3]/q%5,4 [B2 E3]%5,4 [C3 F3]/h%5,4 |');
    expect(r.warnings).toContain('The tab shows only strings 3–6 of the guitar.');
  });

  it('reads drop D from the string names', () => {
    const r = read(tab('e|-----|', 'B|-----|', 'G|-----|', 'D|-----|', 'A|-----|', 'D|-0---|'));
    expect(r.voice).toBe('D2/w |');
    expect(r.warnings[0]).toMatch(/^The tab is tuned D A D G B E; Clef Coach uses standard tuning \(E A D G B E\), so the notes keep the pitch they sound, and 1 note that standard tuning can't reach on its written string is played on another\.$/);
  });

  it('follows a "Tuning:" line and a capo', () => {
    const lines = tab('e|-0------|', 'B|--------|', 'G|--------|', 'D|--------|', 'A|--------|', 'E|--------|');
    // E flat can't be played on the high E string in standard tuning: Clef Coach picks the string
    expect(read(`Tuning: half step down\n${lines}`).voice).toBe('Eb4/w |');
    const capo = read(`Capo 2nd fret\n${lines}`);
    expect(capo.voice).toBe('F#4/w%1 |');
    expect(capo.warnings).toContain('Capo 2: the notes are written at the pitch they sound, as played without a capo.');
  });

  it('turns a tab with the low string on top the right way up', () => {
    const r = read(tab('E|-------|', 'A|-------|', 'D|-------|', 'G|-------|', 'B|-------|', 'e|-0-----|'));
    expect(r.voice).toBe('E4/w%1 |');
    expect(r.warnings.some(w => /lowest string on top/.test(w))).toBe(true);
  });

  it('offers the other instrument when the text has tab for two', () => {
    const text = `${SCALE}\n\nG|-----|\nD|-----|\nA|-0---|\nE|-----|`;
    const r = read(text);
    expect(r.song.instrument).toBe('guitar');
    expect(r.parts.map(p => p.id)).toEqual(['6', '4']);
    expect(read(text, { parts: ['4'] }).song.instrument).toBe('bass');
    expect(read(text, { instrument: 'bass' }).song.instrument).toBe('bass');
  });
});

describe('text tab: rhythm', () => {
  it('reads eighths and halves from the spacing', () => {
    const r = read(
      tab(
        'e|-0-0-0-0-0-0-0-0-|-3-------3-------|',
        'B|-----------------|-----------------|',
        'G|-----------------|-----------------|',
        'D|-----------------|-----------------|',
        'A|-----------------|-----------------|',
        'E|-----------------|-----------------|',
      ),
    );
    expect(r.voice).toBe('E4/e%1 E4%1 E4%1 E4%1 E4%1 E4%1 E4%1 E4%1 | G4/h%1 G4%1 |');
  });

  it('hears three even beats a bar as 3/4, unless told otherwise', () => {
    const waltz = tab('e|-0---2---3---|-0---2---3---|', 'B|-------------|-------------|', 'G|-------------|-------------|', 'D|-------------|-------------|', 'A|-------------|-------------|', 'E|-------------|-------------|');
    const r = read(waltz);
    expect(r.song.time).toEqual([3, 4]);
    expect(r.voice).toBe('E4/q%1 F#4%1 G4%1 | E4%1 F#4%1 G4%1 |');
    expect(read(waltz, { time: [4, 4] }).song.time).toEqual([4, 4]);
  });

  it('allows for a bar whose last note’s dashes are cut short', () => {
    const r = read(
      tab(
        'Time: 6/8',
        'e|-----0-----|',
        'B|---1---1---|',
        'G|-2-------2-|',
        'D|-----------|',
        'A|-0---------|',
        'E|-----------|',
      ),
    );
    expect(r.voice).toBe('[A2 A3]/e%5,3 C4%2 E4%1 C4%2 A3/q%3 |');
  });

  it('takes the rhythm from a rhythm line when there is one', () => {
    const r = read(tab('   q   e e q   q', 'e|-0---2-3-5---7---|', 'B|-----------------|', 'G|-----------------|', 'D|-----------------|', 'A|-----------------|', 'E|-----------------|'));
    expect(r.voice).toBe('E4/q%1 F#4/e%1 G4%1 A4/q%1 B4%1 |');
    expect(r.warnings.some(w => /guessed/.test(w))).toBe(false);
  });

  it('splits a long system with no bar lines into bars', () => {
    const r = read(tab('e|-0---2---3---5---7---8---10--12--10--8---7---5---|', 'B|-------------------------------------------------|', 'G|-------------------------------------------------|', 'D|-------------------------------------------------|', 'A|-------------------------------------------------|', 'E|-------------------------------------------------|'));
    expect(r.score.measures).toBe(2);
    expect(r.voice.startsWith('E4/e%1 F#4%1 G4%1 A4%1 B4%1 C5%1 D5%1 E5%1 |')).toBe(true);
  });
});

describe('text tab: around the tab', () => {
  it('plays a system marked x2 twice, and |: :| repeats', () => {
    const twice = read(`${SCALE}  x2`);
    expect(twice.score.measures).toBe(4);
    const rep = read(tab('e|:-0---0---0---0---:|-3---3---3---3---|', 'B|:-----------------:|-----------------|', 'G|:-----------------:|-----------------|', 'D|:-----------------:|-----------------|', 'A|:-----------------:|-----------------|', 'E|:-----------------:|-----------------|'));
    expect(rep.voice).toBe('E4/q%1 E4%1 E4%1 E4%1 | E4%1 E4%1 E4%1 E4%1 | G4%1 G4%1 G4%1 G4%1 |');
  });

  it('reads the title, artist, tempo and the chord names over the tab', () => {
    const r = read(
      tab(
        'Greensleeves by Traditional',
        'Tempo: 96',
        '',
        '  Am                 G',
        'e|-0---------------|-3---------------|',
        'B|-----------------|-----------------|',
        'G|-----------------|-----------------|',
        'D|-----------------|-----------------|',
        'A|-----------------|-----------------|',
        'E|-----------------|-----------------|',
      ),
    );
    expect(r.song.title).toBe('Greensleeves');
    expect(r.song.composer).toBe('Traditional');
    expect(r.song.tempo).toBe(96);
    expect(r.song.chords).toBe('Am/w | G/w |');
  });

  it('falls back to the title it is given', () => {
    expect(read(SCALE, { title: 'My riff' }).song.title).toBe('My riff');
  });
});
