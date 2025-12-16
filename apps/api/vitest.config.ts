import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    isolate: true,
    setupFiles: ['src/test/vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Disable rate limiting during tests
    env: {
      RATE_LIMIT_ENABLED: 'false',
    },
  },
});
