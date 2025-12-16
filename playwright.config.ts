import { defineConfig, devices } from '@playwright/test';
import { createApiTestPaths } from './testkit/temp-paths';

/**
 * Playwright Configuration for Character Architect E2E Tests
 *
 * Test Suites:
 * - card-export: Card generation and export to all formats with data integrity checks
 * - ui-elements: Iterate through all UI elements for errors and functionality
 * - parity: Ensure cloud-pwa and self-hosted feature parity
 */
const runWebServer = process.env.PW_SKIP_WEB_SERVER !== '1';
const reuseExistingServer = process.env.PW_REUSE_SERVER === '1';
const workers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1;
const apiTestPaths = runWebServer ? createApiTestPaths('card-architect-playwright-') : null;
const runExtended = process.env.CF_RUN_LARGE_TESTS === '1' || ['extended', 'large'].includes((process.env.CF_TEST_TIER || '').toLowerCase());
const hasProductionUrl = Boolean(process.env.PRODUCTION_URL);
const defaultProjectIgnores: RegExp[] = [/parity\.spec\.ts$/];
if (!runExtended) defaultProjectIgnores.push(/ui-elements\.spec\.ts$/);
defaultProjectIgnores.push(/cross-platform\.spec\.ts$/);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers,
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
      testIgnore: defaultProjectIgnores,
    },

    // Light mode tests (cloud/PWA without server)
    {
      name: 'light-mode',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.LIGHT_MODE_URL || 'http://localhost:4173',
      },
      testMatch: /.*\.(spec|test)\.ts$/,
      testIgnore: defaultProjectIgnores,
    },

    ...(runExtended
      ? [
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
        ]
      : []),
    ...(hasProductionUrl
      ? [
          {
            name: 'cross-platform',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /cross-platform\.spec\.ts$/,
          },
        ]
      : []),

    // Mobile Safari for responsive testing (disabled)
    // {
    //   name: 'mobile',
    //   use: { ...devices['iPhone 13'] },
    //   testMatch: /ui-elements\.spec\.ts$/,
    // },
  ],

  // Web server configuration
  webServer: runWebServer
    ? [
        // Full mode with API server (dev)
        {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer,
          timeout: 120000,
          env: apiTestPaths
            ? {
                DATABASE_PATH: apiTestPaths.databasePath,
                STORAGE_PATH: apiTestPaths.storagePath,
                RATE_LIMIT_ENABLED: 'false',
              }
            : undefined,
        },
        // Light mode preview (production build)
        {
          command: 'VITE_DEPLOYMENT_MODE=light npm run build:web && npm run --workspace=@card-architect/web preview -- --port 4173',
          url: 'http://localhost:4173',
          reuseExistingServer,
          timeout: 180000,
        },
      ]
    : undefined,
});
