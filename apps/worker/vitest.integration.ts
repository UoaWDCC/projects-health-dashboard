import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    passWithNoTests: true,
    globalSetup: ['./src/test-config/integration.global-setup.ts'],
    setupFiles: ['./src/test-config/integration.setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // forks give each worker a clean globalThis so the @repo/db singleton
    // always constructs after DATABASE_URL is set by integration.setup.ts
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
