import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    tempDir: '.tmp/vitest',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
      reportsDirectory: '.tmp/coverage'
    },
  },
});

