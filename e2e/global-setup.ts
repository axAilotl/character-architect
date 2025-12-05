/**
 * Global Setup for Playwright Tests
 *
 * Runs once before all tests to set up the test environment.
 * Note: Browser storage clearing is now done per-test in beforeEach hooks
 * to avoid timing issues with web server startup.
 */

import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🎭 Playwright Global Setup');
  console.log('  Test directory:', config.rootDir);
  console.log('  Projects:', config.projects.map(p => p.name).join(', '));
  console.log('  ✓ Global setup complete\n');
}

export default globalSetup;
