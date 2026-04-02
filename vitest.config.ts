import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporter: 'verbose',
    watch: false,
    pool: 'threads',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 2000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'test/', '**/*.test.ts', 'scripts/'],
    },
  },
});
