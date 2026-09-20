import { defineConfig, devices } from '@playwright/test';

import { BASE_URL, DATABASE_URL, PORT } from './comptes';

export default defineConfig({
  testDir: '.',
  // Quatre workers équilibrent le débit et la mémoire sur le poste local.
  workers: Number(process.env.E2E_WORKERS ?? 4),
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
    { name: 'installation', testMatch: /auth\.setup\.ts/ },
    {
      name: 'poste',
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      dependencies: ['installation'],
    },
    {
      name: 'telephone',
      testMatch: /responsive\.spec\.ts/,
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
      // GLPI configure mais injoignable : le support doit accepter et suivre
      // les signalements sans lui.
      GLPI_URL: 'http://127.0.0.1:1',
      GLPI_APP_TOKEN: 'e2e',
      GLPI_USER_TOKEN: 'e2e',
    },
  },
});
