import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Card Architect E2E Tests
 *
 * Test Suites:
 * - card-export: Card generation and export to all formats with data integrity checks
 * - ui-elements: Iterate through all UI elements for errors and functionality
 * - parity: Ensure cloud-pwa and self-hosted feature parity
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Wait for network idle before considering page loaded
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },

  // Global setup/teardown
  globalSetup: './e2e/global-setup.ts',

  // Test timeout
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  projects: [
    // Full mode tests (self-hosted with server)
    {
      name: 'full-mode',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.FULL_MODE_URL || 'http://localhost:5173',
      },
      testMatch: /.*\.(spec|test)\.ts$/,
      testIgnore: /parity\.spec\.ts$/,
    },

    // Light mode tests (cloud/PWA without server)
    {
      name: 'light-mode',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.LIGHT_MODE_URL || 'http://localhost:4173',
      },
      testMatch: /.*\.(spec|test)\.ts$/,
      testIgnore: /parity\.spec\.ts$/,
    },

    // Parity test - runs against both modes
    {
      name: 'parity',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /parity\.spec\.ts$/,
    },

    // Firefox for cross-browser testing
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /ui-elements\.spec\.ts$/,
    },

    // Mobile Safari for responsive testing
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /ui-elements\.spec\.ts$/,
    },
  ],

  // Web server configuration
  webServer: [
    // Full mode with API server (dev)
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    // Light mode preview (production build)
    {
      command: 'VITE_DEPLOYMENT_MODE=light npm run build:web && npm run --workspace=@card-architect/web preview -- --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
    },
  ],
});
