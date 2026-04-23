import { defineConfig } from 'vitest/config';
import { buildReporters } from './src/helpers.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: buildReporters({ fallback: 'verbose' }),
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
