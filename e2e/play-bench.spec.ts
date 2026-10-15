/**
 * What playing along costs the device (opt-in): CPU while the Song Studio performs a song
 * with the band, and which layers of the page repaint while it does.
 *
 *   npm run build && BENCH=1 npx playwright test play-bench --project=ipad
 *
 * It measures the production build (React's development build costs several times as much
 * per render), served by `vite preview` on BENCH_PORT (default 5189), started here unless
 * one is already running. Two runs: on-screen input, and the microphone (Chromium's fake
 * device: a beep, which the app hears as wrong notes). For each:
 *
 *   - renderer CPU (all its threads: main, compositor, raster, audio) and main-thread time
 *     (script, style, layout), idle on the song page and while performing;
 *   - paints per composited layer while performing. A layer repainting every frame is the
 *     thing to fix: in tempo mode the music should scroll by itself (a Web Animation in
 *     NotationView) with nothing repainted but the notes that change colour.
 *
 *   BENCH_TRACE=1   also print the busiest trace events per thread
 *
 * The GPU process is software-rendered here, so its numbers mean little for a tablet.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { type CDPSession, expect, type Page, test } from '@playwright/test';
import { onboard } from './helpers';

const PORT = Number(process.env.BENCH_PORT ?? 5189);
const localChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
test.use({
  baseURL: `http://127.0.0.1:${PORT}`,
  permissions: ['microphone'],
  launchOptions: { ...(existsSync(localChromium) ? { executablePath: localChromium } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

let server: ChildProcess | null = null;
test.beforeAll(async () => {
  if (!process.env.BENCH) return;
  const up = () => fetch(`http://127.0.0.1:${PORT}/`).then(r => r.ok, () => false);
  if (await up()) return;
  if (!existsSync('dist/index.html')) throw new Error('Build first: npm run build');
  // vite itself (not through npx), so kill() stops it
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise(r => setTimeout(r, 250));
});
test.afterAll(() => {
  server?.kill();
});

async function cpu(cdp: CDPSession): Promise<number> {
  const { processInfo } = (await cdp.send('SystemInfo.getProcessInfo' as never)) as { processInfo: { type: string; cpuTime: number }[] };
  return processInfo.filter(p => p.type === 'renderer').reduce((s, p) => s + p.cpuTime, 0);
}

async function metrics(pc: CDPSession): Promise<Record<string, number>> {
  const { metrics } = (await pc.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
  return Object.fromEntries(metrics.map(m => [m.name, m.value]));
}

/** Renderer CPU and main-thread time per second, over `secs`. */
async function measure(page: Page, label: string, secs: number): Promise<void> {
  const browserCdp = await page.context().browser()!.newBrowserCDPSession();
  const pc = await page.context().newCDPSession(page);
  await pc.send('Performance.enable');
  const c0 = await cpu(browserCdp);
  const m0 = await metrics(pc);
  await page.waitForTimeout(secs * 1000);
  const c1 = await cpu(browserCdp);
  const m1 = await metrics(pc);
  const per = (k: string) => Math.round(((m1[k] - m0[k]) * 1000) / secs);
  console.log(
    `${label}: renderer ${Math.round(((c1 - c0) * 1000) / secs)} ms/s; main thread ${per('TaskDuration')} ms/s (script ${per('ScriptDuration')}, style ${per('RecalcStyleDuration')}, layout ${per('LayoutDuration')})`,
  );
}

/** Paints per composited layer over `secs`, busiest first. */
async function layerPaints(page: Page, secs: number): Promise<string> {
  const pc = await page.context().newCDPSession(page);
  type Layer = { layerId: string; backendNodeId?: number; paintCount: number; width: number; height: number };
  let layers: Layer[] = [];
  pc.on('LayerTree.layerTreeDidChange' as never, ((e: { layers?: Layer[] }) => {
    if (e.layers) layers = e.layers;
  }) as never);
  await pc.send('DOM.getDocument', { depth: -1 });
  await pc.send('LayerTree.enable');
  await page.waitForTimeout(500);
  const before = new Map(layers.map(l => [l.layerId, l.paintCount]));
  await page.waitForTimeout(secs * 1000);
  const rows: [number, string][] = [];
  for (const l of layers) {
    const n = l.paintCount - (before.get(l.layerId) ?? 0);
    if (n <= 0) continue;
    let name = '?';
    if (l.backendNodeId) {
      try {
        const { node } = (await pc.send('DOM.describeNode', { backendNodeId: l.backendNodeId })) as { node: { nodeName: string; attributes?: string[] } };
        const a = node.attributes ?? [];
        const cls = a.includes('class') ? `.${a[a.indexOf('class') + 1].trim().split(/\s+/).join('.')}` : '';
        name = `${node.nodeName.toLowerCase()}${cls}`;
      } catch {
        /* gone since */
      }
    }
    rows.push([n, `${String(n).padStart(4)} paints  ${Math.round(l.width)}×${Math.round(l.height)}  ${name}`]);
  }
  return rows.sort((a, b) => b[0] - a[0]).map(r => r[1]).join('\n');
}

/** The busiest trace events per thread over `secs`. */
async function busiest(page: Page, secs: number): Promise<string> {
  const browser = page.context().browser()!;
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'blink'] });
  await page.waitForTimeout(secs * 1000);
  const { traceEvents } = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: { name: string; ph: string; dur?: number; tid: number; pid: number; args?: { name?: string } }[] };
  const threads = new Map<string, string>();
  for (const e of traceEvents) if (e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args?.name ?? '?');
  const total = new Map<string, number>();
  for (const e of traceEvents) {
    if (e.ph !== 'X' || !e.dur) continue;
    const k = `${threads.get(`${e.pid}:${e.tid}`) ?? e.tid} | ${e.name}`;
    total.set(k, (total.get(k) ?? 0) + e.dur);
  }
  return [...total]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k, us]) => `${(us / 1000 / secs).toFixed(1).padStart(7)} ms/s  ${k}`)
    .join('\n');
}

for (const input of ['touch', 'mic'] as const) {
  test(`what playing along with the band costs (${input})`, async ({ page }, info) => {
    test.skip(!process.env.BENCH || info.project.name !== 'ipad', 'opt-in: BENCH=1, ipad project');
    test.setTimeout(180_000);
    await onboard(page, 'Bench');
    if (input === 'mic') {
      await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('clefcoach.device.v1') ?? '{}');
        localStorage.setItem('clefcoach.device.v1', JSON.stringify({ ...d, inputMode: 'mic' }));
      });
    }
    await page.goto('/#/song/prh-ode-to-joy');
    await page.reload();
    const card = page.locator('.studio-perform');
    await expect(card).toBeVisible();
    // a gesture: unlocks audio (and opens the mic)
    await page.mouse.click(5, 5);
    await page.waitForTimeout(2500);
    await measure(page, `${input}, idle on the song page`, 5);

    await card.getByRole('button', { name: /Perform the whole song/ }).click();
    await page.getByRole('button', { name: /^Start/ }).click();
    await expect(page.locator('.activity.playalong')).toHaveAttribute('data-phase', 'playing', { timeout: 15_000 });
    await measure(page, `${input}, performing with the band`, 8);
    console.log(`${input}: paints per layer in 4 s of performing\n${await layerPaints(page, 4)}`);
    if (process.env.BENCH_TRACE) console.log(`${input}: busiest trace events\n${await busiest(page, 4)}`);
  });
}
