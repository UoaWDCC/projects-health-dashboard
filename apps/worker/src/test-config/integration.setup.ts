import { inject } from 'vitest'

// Runs in each worker fork before test files are imported.
// Sets DATABASE_URL so the @repo/db singleton connects to the test container.
// Must NOT import @repo/db here — that would construct the PrismaClient before the env var is set.
const databaseUrl = inject('databaseUrl') as string

if (!databaseUrl) {
  throw new Error('databaseUrl not provided by globalSetup — check integration.global-setup.ts')
}

process.env.DATABASE_URL = databaseUrl
process.env.DIRECT_URL = databaseUrl
