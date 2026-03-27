# WDCC Projects Health Dashboard

Monorepo — Next.js web app + Node.js background worker, backed by Prisma/Supabase.

## Prerequisites

- Node.js 20+
- pnpm 10 — `npm install -g corepack@latest && corepack enable`
- Supabase project, GitHub App, Discord Bot, OpenAI API key

## Setup

```bash
pnpm install
cp .env.example .env   # fill in all values
pnpm db:migrate        # run migrations
pnpm db:generate       # generate Prisma client
pnpm dev               # start web + worker in parallel
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=          # pooler URL (port 6543)
DIRECT_URL=            # direct URL (port 5432)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
DISCORD_BOT_TOKEN=
OPENAI_API_KEY=
```

## Scripts

| Script              | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start web + worker in parallel                |
| `pnpm build`        | Build all apps                                |
| `pnpm lint`         | Lint all packages                             |
| `pnpm typecheck`    | Type-check all packages                       |
| `pnpm format`       | Auto-format all files with Prettier           |
| `pnpm format:check` | Check formatting without writing              |
| `pnpm db:migrate`   | Run database migrations                       |
| `pnpm db:generate`  | Regenerate Prisma client after schema changes |
| `pnpm db:studio`    | Open Prisma Studio at localhost:5555          |

## Code Quality

**Formatting** is handled by [Prettier](https://prettier.io). Config is in `.prettierrc` at the repo root and applies to all packages.

**Linting** uses [ESLint](https://eslint.org) — the web app uses `eslint-config-next`, and the worker and db packages use `typescript-eslint`.

**Git hooks** — a pre-commit hook (via [Husky](https://typicode.github.io/husky) + [lint-staged](https://github.com/lint-staged/lint-staged)) auto-formats staged files with Prettier before every commit. Hooks are installed automatically when you run `pnpm install`.

**CI** — every push and pull request to `main` runs format check, lint, typecheck, and build via GitHub Actions (`.github/workflows/ci.yml`).
