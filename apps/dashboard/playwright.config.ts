import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Uses dedicated ports to avoid collisions with dev servers:
 * - Vite E2E: 5174 (dev uses 5173)
 * - Gateway E2E: 3333 (dev uses 3000)
 *
 * Run with: pnpm test:e2e
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Serial execution to avoid shared state issues with Gateway backend */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker to avoid test interference with shared backend */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5174',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run local servers before starting the tests */
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: { VITE_PORT: '5174', VITE_API_PORT: '3333' },
    },
    {
      command: 'pnpm test:e2e:server',
      url: 'http://localhost:3333/health/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      cwd: '../..',
      env: { GATEWAY_PORT: '3333', CORS_ORIGIN: 'http://localhost:5174' },
    },
  ],
});
