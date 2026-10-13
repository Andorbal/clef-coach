#!/usr/bin/env node
/**
 * clefsong — Clef Coach song tools for the command line.
 *
 *   npm run clefsong -- help
 *
 * Runs the TypeScript in tools/clefsong/cli.ts (and the app's own song modules)
 * through a Vite module runner, so there is nothing extra to build or install. The
 * runner stays open while the command runs: the importers load lazily.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, createServerModuleRunner } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = await createServer({
  configFile: false,
  root: path.resolve(here, '..'),
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
try {
  const cli = await runner.import(path.join(here, 'clefsong', 'cli.ts'));
  process.exitCode = await cli.main(process.argv.slice(2));
} finally {
  await runner.close();
  await server.close();
}
