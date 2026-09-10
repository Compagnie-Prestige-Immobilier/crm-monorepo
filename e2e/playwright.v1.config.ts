import { defineConfig, devices } from '@playwright/test';

/** La suite Playwright de la v1, rejouée contre le panneau v1 servi par le binaire Go. */
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './v1',
  workers: Number(process.env.E2E_WORKERS ?? 1),
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['line']],
  globalSetup: './v1/global-setup.ts',
  outputDir: 'test-results/v1',
  use: {
    baseURL: WEB_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.77' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: /(\.anon|responsive-mobile)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'v1/.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      testMatch: /responsive-mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'], storageState: 'v1/.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-anonyme',
      testMatch: /\.anon\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
