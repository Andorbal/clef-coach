#!/usr/bin/env node
/**
 * clefsong — Clef Coach song tools for the command line.
 *
 *   npm run clefsong -- help
 *
 * Runs the TypeScript in tools/clefsong/cli.ts (and the app's own song modules)
 * through Vite's module runner, so there is nothing extra to build or install.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const { module } = await runnerImport(path.join(here, 'clefsong', 'cli.ts'), {
  configFile: false,
  root: path.resolve(here, '..'),
  logLevel: 'error',
});
process.exitCode = await module.main(process.argv.slice(2));
