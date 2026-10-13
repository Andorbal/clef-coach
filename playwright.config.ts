import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use the preinstalled Chromium when available (cloud dev containers), otherwise Playwright's own.
const localChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5188',
    launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {},
  },
  projects: [
    { name: 'ipad', use: { ...devices['iPad Mini landscape'], browserName: 'chromium' } },
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npx vite --port 5188 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
