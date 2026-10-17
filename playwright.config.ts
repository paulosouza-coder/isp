import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra banco de teste dedicado (recriado no globalSetup) e portas próprias,
 * para não interferir no ambiente de desenvolvimento.
 * Em ambientes sem download de navegador, aponte PW_CHROMIUM_PATH para um Chromium local.
 */
const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://isp:isp@localhost:5432/isp_sprint_test';
const API_PORT = 3334;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: `pnpm --filter @isp/api exec tsx src/server.ts`,
      url: `http://127.0.0.1:${API_PORT}/health/ready`,
      reuseExistingServer: false,
      env: { DATABASE_URL: TEST_DB, API_PORT: String(API_PORT), WEB_ORIGIN: `http://localhost:${WEB_PORT}`, LOG_LEVEL: 'warn', LOGIN_RATE_LIMIT_PER_MINUTE: '200' },
    },
    {
      command: `pnpm --filter @isp/web exec vite --host 127.0.0.1`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { VITE_API_TARGET: `http://127.0.0.1:${API_PORT}`, WEB_PORT: String(WEB_PORT) },
    },
  ],
});
