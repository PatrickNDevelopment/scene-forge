import { defineConfig } from '@playwright/test';

// End-to-end tests run against the PRODUCTION build served under the Pages prefix (/scene-forge/).
// Locally the installed Microsoft Edge is used (no browser download); CI installs Chromium, Firefox and WebKit.
const WEB_PORT = 4176;

const EXTRA_BROWSERS = (process.env['PW_EXTRA_BROWSERS'] ?? '')
  .split(',')
  .map((b) => b.trim())
  .filter((b): b is 'firefox' | 'webkit' => b === 'firefox' || b === 'webkit');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}/scene-forge/`,
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    // Chromium is the gate everywhere (installed Edge locally, Chromium in CI). Firefox and WebKit run
    // when PW_EXTRA_BROWSERS lists them, as the CI workflow does.
    {
      name: 'chromium',
      use: { browserName: 'chromium', channel: process.env['CI'] ? undefined : 'msedge' },
    },
    ...EXTRA_BROWSERS.map((name) => ({ name, use: { browserName: name } })),
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: `http://localhost:${WEB_PORT}/scene-forge/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
