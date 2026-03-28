# packages/db

Shared Prisma package — exports `db` (PrismaClient singleton) and all generated types.

## Usage

```typescript
import { db, Project } from '@repo/db'

const projects = await db.project.findMany({ where: { isActive: true } })
```

---

## Environment Setup

Both `.env` (prod) and `.env.dev` (dev) are required before running any database commands. Neither file is committed — both are gitignored. Use `.env.example` as the template for both.

### How to collect credentials from the Supabase dashboard

Do this once for each Supabase project (prod and dev).

**Project URL and API keys**

Project Settings → API Keys:

| Variable                        | Dashboard label                                      |
| ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL (shown at the top of the API Keys page)  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`)               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Secret key (`sb_secret_...`) — never expose publicly |

**Database connection strings**

NavBar → Connect → Connection String:

| Variable       | Method to select   | Port |
| -------------- | ------------------ | ---- |
| `DATABASE_URL` | Transaction pooler | 6543 |
| `DIRECT_URL`   | **Session pooler** | 5432 |

Replace `[YOUR-PASSWORD]` in both strings with your database password. If you don't have it, reset it on the same Database Settings page.

**Why Session pooler for `DIRECT_URL` and not Direct connection?**

The free tier's direct connection is IPv6-only. Most networks are IPv4, so the direct connection URL (`db.<ref>.supabase.co`) won't be reachable. The session pooler at port 5432 is IPv4-compatible and proxies through to Postgres — it behaves identically to a direct connection for Prisma migrations, which is all `DIRECT_URL` is used for.

**Why two separate URLs at all?**

`DATABASE_URL` uses transaction pooler mode (port 6543), which doesn't support the prepared statements and advisory locks Prisma needs for migrations. `DIRECT_URL` gives Prisma a connection that supports these, while the app still benefits from connection pooling at runtime.

### Apply existing migrations to the dev database

After `.env.dev` is set up, run:

```bash
pnpm db:deploy:dev
```

This applies all existing migration files to the new dev database without creating any new ones.

---

## Scripts Reference

All database scripts are run from the repo root with `pnpm`.

| Script             | Target | What it does                                                                                                        |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `db:migrate:dev`   | Dev    | **Authors** a new migration: diffs `schema.prisma`, creates the SQL file in `prisma/migrations/`, applies it to dev |
| `db:deploy:dev`    | Dev    | Applies pending migration files to dev — safe, no creation or reset                                                 |
| `db:deploy:prod`   | Prod   | Applies pending migration files to prod after confirmation prompt                                                   |
| `db:generate:dev`  | Dev    | Regenerates the Prisma client after a schema change                                                                 |
| `db:generate:prod` | Prod   | Same, targeting prod credentials                                                                                    |
| `db:studio:dev`    | Dev    | Opens Prisma Studio connected to dev                                                                                |
| `db:studio:prod`   | Prod   | Opens Prisma Studio connected to prod                                                                               |

### `migrate dev` vs `migrate deploy`

**`prisma migrate dev`** (used by `db:migrate:dev`)

- The **authoring** tool. Diffs your `schema.prisma` against the current database state and generates a new SQL migration file in `prisma/migrations/`.
- Applies the new migration to the database immediately.
- Can trigger a **database reset** if it detects drift between the migration history and the actual schema. This is safe on dev where data is throwaway, but would be catastrophic on prod.
- Must only ever target the dev database.

**`prisma migrate deploy`** (used by `db:deploy:dev` and `db:deploy:prod`)

- The **applying** tool. Runs any migration files that have not yet been applied to the target database, in order.
- Never creates new migration files, never resets, never prompts interactively.
- Errors instead of doing anything unexpected — safe for production.

---

## Dev → Prod Promotion Workflow

1. Edit `packages/db/prisma/schema.prisma`
2. Run `pnpm db:migrate:dev` — Prisma creates a new file in `packages/db/prisma/migrations/` and applies it to dev
3. Verify the change with `pnpm db:studio:dev`
4. Commit the new migration file to git
5. Run `pnpm db:deploy:prod` — type `yes` at the prompt — Prisma applies only the pending migration to prod

Prod never sees `migrate dev`. The migration file committed in step 4 is the source of truth that both databases share.

---
