import { defineConfig } from 'vitest/config';

const scope = process.env.VITEST_SCOPE;
const include =
  scope === 'unit'
    ? ['tests/unit/**/*.test.ts']
    : scope === 'net'
    ? ['tests/integration/**/*.test.ts', 'tests/e2e/**/*.test.ts']
    : ['tests/unit/**/*.test.ts', 'tests/e2e/**/*.test.ts'];

export default defineConfig({
  test: {
    environment: 'node',
    include,
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
