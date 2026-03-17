# packages/db

Shared Prisma package — exports `db` (PrismaClient singleton) and all generated types.

## Setup

Set both database URLs in the root `.env`:

```
DATABASE_URL=   # pooler URL (port 6543) — used at runtime
DIRECT_URL=     # direct URL (port 5432) — used by migrations
```

Then from the repo root:

```bash
pnpm db:migrate    # create tables
pnpm db:generate   # generate client
```

## Usage

```typescript
import { db, Project } from '@repo/db'

const projects = await db.project.findMany({ where: { isActive: true } })
```
