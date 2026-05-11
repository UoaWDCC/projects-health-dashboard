import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      // Entry point wires up the cron schedule and is not unit-testable in isolation
      exclude: ['src/index.ts'],
    },
    setupFiles: ['./src/test-config/vitest.setup.ts'],
  },
  resolve: {
    // Mirror the @/* path alias from tsconfig.json so imports resolve correctly in tests
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
