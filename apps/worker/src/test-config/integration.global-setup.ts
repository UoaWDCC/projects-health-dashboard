import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

// apps/worker/src/test-config/ → packages/db/
const DB_PACKAGE_DIR = resolve(__dirname, '../../../../packages/db')

let container: StartedPostgreSqlContainer

export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  container = await new PostgreSqlContainer('postgres:17.6')
    .withDatabase('testdb')
    .withUsername('postgres')
    .withPassword('postgres')
    .start()

  const dbUrl = container.getConnectionUri()

  // Scaffold the auth schema so migration guards that check for its existence pass,
  // installing the on_auth_user_created trigger and making it testable.
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT,
      raw_user_meta_data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `)
  await client.end()

  // Apply all migrations (including triggers and functions) to the fresh container.
  // DIRECT_URL = DATABASE_URL — no connection pooler for a direct TCP container.
  execSync('pnpm prisma migrate deploy', {
    cwd: DB_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
    stdio: 'inherit',
  })

  provide('databaseUrl', dbUrl)
}

export async function teardown() {
  await container?.stop()
}
