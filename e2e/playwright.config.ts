import { defineConfig, devices } from '@playwright/test';

import { BASE_URL, DATABASE_URL, PORT } from './comptes';

/** La suite v1 a sa propre configuration, `playwright.v1.config.ts`. */
const SUITE_V1 = /\/v1\//;

export default defineConfig({
  testDir: '.',
  // Un travailleur par cœur, un fichier par travailleur : au-delà des cœurs,
  // les navigateurs se disputent la machine et les délais tombent.
  workers: '100%',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  outputDir: `test-results/${PORT}`,
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'installation', testMatch: /auth\.setup\.ts/, testIgnore: SUITE_V1 },
    {
      name: 'poste',
      testIgnore: [/responsive\.spec\.ts/, SUITE_V1],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      dependencies: ['installation'],
    },
    {
      name: 'telephone',
      testMatch: /responsive\.spec\.ts/,
      testIgnore: SUITE_V1,
      use: { ...devices['Pixel 5'] },
      dependencies: ['installation'],
    },
  ],
  webServer: {
    command: '../cpi-go',
    url: `${BASE_URL}/health/ready`,
    reuseExistingServer: true,
    timeout: 60_000,
    // Le limiteur compte alors par `X-Forwarded-For`, comme derrière Cloudflare
    // en production : chaque parcours dispose de son propre budget de 10/min.
    env: {
      DATABASE_URL,
      ...(process.env.DATABASE_URL_DEMO === undefined
        ? {}
        : { DATABASE_URL_DEMO: process.env.DATABASE_URL_DEMO }),
      PORT,
      LOG_FORMAT: 'text',
      API_TRUST_PROXY_HEADERS: 'true',
    },
  },
});
