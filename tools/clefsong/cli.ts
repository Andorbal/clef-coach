/**
 * clefsong — validate, convert and scan songs for Clef Coach.
 *
 *   clefsong validate song.json [more.json…]
 *   clefsong convert  score.musicxml|score.mxl|tune.mid|song.gp5|tab.txt [-o song.json] [--instrument piano] [--parts P1,P2] [--no-band]
 *   clefsong scan     page1.jpg page2.jpg|music.pdf|tab.txt [-o song.json] [--instrument piano] [--title "…"] [--hints "…"] [--model claude-opus-5-5]
 *   clefsong prompt   [--instrument ukulele]      print the transcription prompt for any AI assistant
 *
 * `scan` uses your own Anthropic API key (ANTHROPIC_API_KEY, or an `ant auth login` profile).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { INSTRUMENT_IDS, type InstrumentId } from '../../src/music/instruments';
import { SongFormatError, parseSongDoc, songToJson } from '../../src/songs/format';
import { importBytes } from '../../src/songs/importers';
import { manualPrompt } from '../../src/songs/llmPrompt';
import { type ScanFile, TranscribeError, mediaTypeFor, transcribeSheetMusic } from '../../src/songs/transcribe';

const HELP = `clefsong — Clef Coach song tools

  validate <song.json…>            check song files and list any problems
  convert <file> [-o out.json]     MusicXML (.musicxml/.xml/.mxl), MIDI (.mid), Guitar Pro (.gp3–.gp5, .gpx, .gp)
                                   or text tab (.txt/.tab) → Clef Coach song
          [--instrument <id>]      piano | guitar | ukulele | bass | mallets
          [--parts <ids>]          MusicXML part ids / MIDI and Guitar Pro track numbers to learn (comma-separated)
          [--no-band]              leave the other parts out (by default they, and the drums, play as the band)
  scan <images/pdf/txt…>           transcribe photos or a PDF of sheet music / tab, or text tab, with Claude
          [-o out.json]
          [--instrument <id>] [--title <t>] [--hints <text>] [--model <id>]
          needs ANTHROPIC_API_KEY (or an \`ant auth login\` profile)
  prompt [--instrument <id>]       print the prompt to use with any AI assistant

Import the resulting .json in the app: Songs → Import a song → From a file.`;

interface Args {
  cmd: string;
  files: string[];
  out?: string;
  instrument?: InstrumentId;
  parts?: string[];
  /** false: leave the parts not imported out instead of keeping them as the band. */
  band?: boolean;
  title?: string;
  hints?: string;
  model?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { cmd: argv[0] ?? 'help', files: [] };
  for (let i = 1; i < argv.length; i++) {
    const v = argv[i];
    const next = () => argv[++i];
    if (v === '-o' || v === '--out') a.out = next();
    else if (v === '--instrument' || v === '-i') a.instrument = next() as InstrumentId;
    else if (v === '--parts') a.parts = next().split(',');
    else if (v === '--no-band') a.band = false;
    else if (v === '--title') a.title = next();
    else if (v === '--hints') a.hints = next();
    else if (v === '--model') a.model = next();
    else a.files.push(v);
  }
  if (a.instrument && !INSTRUMENT_IDS.includes(a.instrument)) throw new Error(`--instrument must be one of ${INSTRUMENT_IDS.join(', ')}`);
  return a;
}

function outName(input: string): string {
  return `${basename(input, extname(input))}.clefsong.json`;
}

function report(song: { title: string; instrument: string; staves: unknown[]; band?: { name: string }[] }, warnings: string[], measures?: number) {
  const band = song.band?.length ? `; band: ${song.band.map(p => p.name).join(', ')}` : '';
  console.log(`✓ ${song.title} — ${song.instrument}, ${song.staves.length} ${song.staves.length > 1 ? 'staves' : 'staff'}${measures ? `, ${measures} bars` : ''}${band}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

async function validate(a: Args): Promise<number> {
  if (!a.files.length) throw new Error('validate: give at least one song file');
  let bad = 0;
  for (const f of a.files) {
    try {
      const { song, score, warnings } = parseSongDoc(readFileSync(f, 'utf8'));
      report(song, warnings, score.measures);
    } catch (e) {
      bad++;
      console.log(`✗ ${f}`);
      for (const issue of e instanceof SongFormatError ? e.issues : [(e as Error).message]) console.log(`  - ${issue}`);
    }
  }
  return bad ? 1 : 0;
}

async function convert(a: Args): Promise<number> {
  const f = a.files[0];
  if (!f) throw new Error('convert: give a MusicXML, MIDI, Guitar Pro or text tab file');
  const res = await importBytes(f, new Uint8Array(readFileSync(f)), { instrument: a.instrument, parts: a.parts, band: a.band });
  if (res.parts && res.parts.length > 1) console.log(`  parts in the file: ${res.parts.map(p => `${p.id}${p.name ? ` (${p.name})` : ''}`).join(', ')}  — choose with --parts`);
  const out = a.out ?? outName(f);
  writeFileSync(out, songToJson(res.song));
  report(res.song, res.warnings);
  console.log(`  → ${out}`);
  return 0;
}

async function scan(a: Args): Promise<number> {
  if (!a.files.length) throw new Error('scan: give one or more images (jpg/png/webp), a PDF or a text tab (.txt)');
  const files: ScanFile[] = a.files.map(f => {
    const mediaType = mediaTypeFor(f);
    if (!mediaType) throw new Error(`${f}: use JPEG, PNG, WebP, GIF, PDF or a text tab (.txt, .tab)`);
    return { mediaType, data: mediaType === 'text/plain' ? readFileSync(f, 'utf8') : readFileSync(f).toString('base64'), name: basename(f) };
  });
  const client = new Anthropic();
  try {
    const res = await transcribeSheetMusic(client, files, {
      instrument: a.instrument,
      title: a.title,
      hints: a.hints,
      model: a.model,
      onProgress: m => console.log(`… ${m}`),
    });
    const out = a.out ?? outName(a.files[0]);
    writeFileSync(out, songToJson(res.song));
    report(res.song, res.warnings);
    console.log(`  ${res.attempts} round${res.attempts > 1 ? 's' : ''} · ${res.usage.input} input + ${res.usage.output} output tokens · ${res.model}`);
    console.log(`  → ${out}`);
    return 0;
  } catch (e) {
    if (e instanceof TranscribeError && e.raw) {
      const out = a.out ?? outName(a.files[0]).replace('.clefsong.json', '.draft.json');
      writeFileSync(out, e.raw);
      console.log(`✗ ${e.message}`);
      for (const i of e.issues ?? []) console.log(`  - ${i}`);
      console.log(`  draft saved to ${out} — fix it and run: clefsong validate ${out}`);
      return 1;
    }
    if (e instanceof Anthropic.AuthenticationError) throw new Error('No valid API key: set ANTHROPIC_API_KEY (or run `ant auth login`).');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited — wait a minute and try again.');
    throw e;
  }
}

export async function main(argv: string[]): Promise<number> {
  try {
    const a = parseArgs(argv);
    switch (a.cmd) {
      case 'validate':
        return await validate(a);
      case 'convert':
        return await convert(a);
      case 'scan':
        return await scan(a);
      case 'prompt':
        console.log(manualPrompt(a.instrument));
        return 0;
      default:
        console.log(HELP);
        return a.cmd === 'help' || a.cmd === '--help' || a.cmd === '-h' ? 0 : 1;
    }
  } catch (e) {
    console.error(`clefsong: ${(e as Error).message}`);
    return 1;
  }
}
