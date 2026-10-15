/**
 * Audio render benchmark (opt-in): how much work the band costs the audio engine.
 *
 *   BENCH=1 npx playwright test audio-bench --project=ipad
 *
 * Each scenario plays a song's band — built-in sounds or a sound bank, with the player's
 * own part — through the real Performer, into an OfflineAudioContext that stands in for
 * the app's AudioContext. The performer is pumped every 100 ms of audio (as its timer
 * does live) and the render is measured as CPU time of the page's process (the convolver
 * runs part of its work on other threads, so wall time undercounts it), less the time
 * spent pumping. Chromium on a server isn't Safari on an iPad, but both engines do the
 * same work per node, so what halves one roughly halves the other.
 *
 *   BENCH_TRACKS=1   also time each part of the band alone (and none: the master chain)
 *   BENCH_ONLY=re    only the scenarios whose name matches
 *   BENCH_RUNS=n     runs per scenario (median; default 3)
 *   BENCH_BANK=path  a .sf2 / .sf3 (default public/sounds/GeneralUser-GS.sf3 from
 *                    `npm run sounds`, else the small SoundFont alphaTab ships)
 *   BENCH_OUT=path   where to write the results (default test-results/audio-bench.json)
 *
 * The results include a loudness fingerprint per scenario (RMS per 50 ms, per channel):
 * compare two runs' to check an optimisation didn't change the sound.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type CDPSession, expect, test, type Page } from '@playwright/test';

interface Scenario {
  name: string;
  song: string;
  source: 'song' | 'auto';
  style?: string;
  /** play the band (and the part) through the sound bank */
  bank: boolean;
  /** layer the bank over the built-in sounds */
  layer?: boolean;
  /** play only this role ('drums', 'bass', 'chords', 'pad', 'part'; 'none' for no notes at all) */
  only?: string;
}

const SCENARIOS: Scenario[] = [
  { name: 'song band, built-in', song: 'prh-ode-to-joy', source: 'song', bank: false },
  { name: 'ballad band, built-in', song: 'prh-ode-to-joy', source: 'auto', style: 'ballad', bank: false },
  { name: 'song band, sound bank', song: 'prh-ode-to-joy', source: 'song', bank: true },
  { name: 'ballad band, sound bank', song: 'prh-ode-to-joy', source: 'auto', style: 'ballad', bank: true },
  { name: 'song band, bank layered', song: 'prh-ode-to-joy', source: 'song', bank: true, layer: true },
];

const ROLES = ['drums', 'bass', 'chords', 'pad', 'part', 'none'];
const ALL = process.env.BENCH_TRACKS ? SCENARIOS.flatMap(sc => (sc.layer ? [sc] : [sc, ...ROLES.map(only => ({ ...sc, name: `${sc.name}: ${only}`, only }))])) : SCENARIOS;
const PICK = process.env.BENCH_ONLY ? new RegExp(process.env.BENCH_ONLY) : null;
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const OUT = process.env.BENCH_OUT ?? 'test-results/audio-bench.json';

function bankFile(): string {
  const candidates = [process.env.BENCH_BANK, 'public/sounds/GeneralUser-GS.sf3', 'node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf3'];
  const found = candidates.find(p => p && existsSync(p));
  if (!found) throw new Error('No sound bank for the benchmark');
  return found;
}

/** A blank page on the dev server: the app's modules import into it, the app itself never starts. */
async function blankPage(page: Page): Promise<void> {
  await page.route('**/__bench', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>bench</title><body></body>' }));
  await page.goto('/__bench');
}

/** CPU seconds used so far by the browser's renderer processes. */
async function rendererCpu(cdp: CDPSession): Promise<number> {
  const { processInfo } = (await cdp.send('SystemInfo.getProcessInfo' as never)) as { processInfo: { type: string; cpuTime: number }[] };
  return processInfo.filter(p => p.type === 'renderer').reduce((s, p) => s + p.cpuTime, 0);
}

interface Rendered {
  seconds: number;
  js: number;
  nodes: Record<string, number>;
  rms: number[][];
}

/** Get a scenario ready to render: the band loaded, its sounds prepared, the pumping scheduled. */
function setUp(page: Page, sc: Scenario, bankId: string | null): Promise<void> {
  return page.evaluate(
    async ({ sc, bankId }) => {
      const SR = 48000;
      const { getSong } = await import('/src/content/songs/index.ts');
      const { songToScore } = await import('/src/music/parse.ts');
      const { buildBand, partTrack } = await import('/src/perform/arranger.ts');
      const { PPQ } = await import('/src/music/rhythm.ts');
      const song = getSong(sc.song)!;
      const score = songToScore(song);
      const arr = buildBand(song, score, { source: sc.source, style: sc.style as never, player: song.instrument, strumming: false });
      // the player's own part, as "listen with the band" plays it
      const part = partTrack(score, 1, 'Your part');
      part.sound = { kind: 'rendered', voice: 'piano', offset: 0 };
      // the song twice through: long enough to measure
      const songTicks = Math.max(...[...arr.tracks, part].flatMap(t => t.notes.map(n => n.tick + n.ticks)));
      const all = [...arr.tracks, part].map(t => ({ ...t, notes: [...t.notes, ...t.notes.map(n => ({ ...n, tick: n.tick + songTicks }))] }));
      const tracks = all.filter(t => !sc.only || t.role === sc.only);
      const secPerTick = 60 / song.tempo / PPQ;
      const seconds = Math.ceil(2 * songTicks * secPerTick + 3);

      // the app's AudioContext becomes an offline one; resume() is the benchmark's to call
      let offline: OfflineAudioContext | null = null;
      let resume = () => Promise.resolve();
      (window as unknown as { AudioContext: unknown }).AudioContext = function () {
        const ctx = new OfflineAudioContext(2, SR * seconds, SR);
        resume = ctx.resume.bind(ctx);
        ctx.resume = () => Promise.resolve();
        offline = ctx;
        return ctx;
      };
      const nodes: Record<string, number> = {};
      const proto = BaseAudioContext.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
      for (const name of ['createBufferSource', 'createGain', 'createStereoPanner', 'createBiquadFilter', 'createOscillator', 'createConstantSource', 'createWaveShaper']) {
        const orig = proto[name];
        if (!orig) continue;
        proto[name] = function (this: unknown, ...a: unknown[]) {
          nodes[name.slice(6)] = (nodes[name.slice(6)] ?? 0) + 1;
          return orig.apply(this, a);
        };
      }

      const { Performer } = await import('/src/perform/performer.ts');
      const { sinkFactory } = await import('/src/perform/sinks.ts');
      const choice = bankId ? { source: 'gm' as const, bankId, layer: !!sc.layer } : null;
      const settings = bankId ? { gmBank: bankId, gmLayer: !!sc.layer, instruments: { piano: choice! } } : {};
      const p = new Performer(sinkFactory({}, settings));
      p.load(tracks, { master: 0.8, reverb: 0.5, tracks: {} }, { swing: arr.swing });
      await p.prepare();
      for (const k of Object.keys(nodes)) delete nodes[k];

      const internals = p as unknown as { pump(): void; stopTimer(): void };
      p.start(0.05, secPerTick);
      internals.stopTimer();
      const ctx = offline!;
      let js = 0;
      for (let f = 4800; f < SR * seconds - 128; f += 4800) {
        ctx.suspend((Math.round(f / 128) * 128) / SR).then(() => {
          const a = performance.now();
          internals.pump();
          js += performance.now() - a;
          void resume();
        });
      }
      (window as unknown as { __render: () => Promise<Rendered> }).__render = async () => {
        const buf = await ctx.startRendering();
        const win = Math.round(SR * 0.05);
        const rms = [0, 1].map(c => {
          const d = buf.getChannelData(c);
          const out: number[] = [];
          for (let i = 0; i + win <= d.length; i += win) {
            let s = 0;
            for (let j = i; j < i + win; j++) s += d[j] * d[j];
            out.push(Math.round(Math.sqrt(s / win) * 1e5) / 1e5);
          }
          return out;
        });
        return { seconds, js, nodes, rms };
      };
    },
    { sc, bankId },
  );
}

test('audio render benchmark', async ({ page }, info) => {
  test.skip(!process.env.BENCH || info.project.name !== 'ipad', 'opt-in: BENCH=1, ipad project');
  test.setTimeout(1_200_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await blankPage(page);
  const cdp = await page.context().browser()!.newBrowserCDPSession();

  const file = bankFile();
  const bytes = readFileSync(file);
  await page.route('**/__bench-bank', route => route.fulfill({ body: bytes, contentType: 'application/octet-stream' }));
  const bankId = await page.evaluate(async name => {
    const { addBankFiles } = await import('/src/audio/samples/manager.ts');
    const blob = await (await fetch('/__bench-bank')).blob();
    const [rec] = await addBankFiles([new File([blob], name)]);
    return rec.id;
  }, path.basename(file));

  const rows: { scenario: string; seconds: number; cpuMs: number; jsMs: number; xRealtime: number; nodes: Record<string, number> }[] = [];
  const fingerprints: Record<string, number[][]> = {};
  for (const sc of ALL.filter(s => !PICK || PICK.test(s.name))) {
    const runs: (Rendered & { cpu: number })[] = [];
    for (let i = 0; i < RUNS; i++) {
      await page.goto('/__bench');
      await setUp(page, sc, sc.bank ? bankId : null);
      const before = await rendererCpu(cdp);
      const r = await page.evaluate(() => (window as unknown as { __render: () => Promise<Rendered> }).__render());
      const cpu = (await rendererCpu(cdp)) - before;
      runs.push({ ...r, cpu: cpu * 1000 - r.js });
    }
    runs.sort((a, b) => a.cpu - b.cpu);
    const mid = runs[Math.floor(runs.length / 2)];
    const cpuMs = Math.round(mid.cpu);
    rows.push({ scenario: sc.name, seconds: mid.seconds, cpuMs, jsMs: Math.round(mid.js), xRealtime: Math.round((mid.seconds * 1000) / Math.max(1, cpuMs)), nodes: mid.nodes });
    fingerprints[sc.name] = mid.rms;
    if (!sc.only) expect(Math.max(...mid.rms[0]), `${sc.name} makes sound`).toBeGreaterThan(0.001);
  }

  console.log(`\nAudio render benchmark (bank: ${path.basename(file)}, median of ${RUNS})`);
  console.table(rows.map(r => ({ scenario: r.scenario, 'audio s': r.seconds, 'cpu ms': r.cpuMs, 'js ms': r.jsMs, 'x realtime': r.xRealtime, nodes: Object.entries(r.nodes).map(([k, v]) => `${k} ${v}`).join(', ') })));
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ bank: path.basename(file), rows, fingerprints }, null, 1));
  expect(errors).toEqual([]);
});
