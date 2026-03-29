# WDCC Projects Health Dashboard

Monorepo — Next.js web app + Node.js background worker, backed by Prisma/Supabase.

## Prerequisites

- Node.js 20+
- pnpm 10 — `npm install -g corepack@latest && corepack enable`
- Supabase project, GitHub App, Discord Bot, OpenAI API key

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Get `.env` and `.env.dev` from the shared Google Drive and place them at the repo root.
3. Generate the Prisma client:
   ```bash
   pnpm db:generate:dev
   ```
4. Start the app:
   ```bash
   pnpm dev
   ```

## Troubleshooting

**`pnpm install` fails with a Corepack keyid signature error**

Corepack bundles registry signing keys at build time. When npm rotates those keys, older Corepack versions fail signature verification. This can happen even after running `npm install -g corepack@latest` because Node.js ships its own bundled Corepack that takes precedence over the globally installed one.

**Option 1 — Update Node.js.** The bundled Corepack version tracks Node.js releases, so upgrading to the latest LTS brings a newer Corepack with updated keys. Download from [nodejs.org](https://nodejs.org).

**Option 2 — Bypass Corepack entirely.** Install pnpm directly so no signature verification occurs:

```bash
corepack disable
npm install -g pnpm@latest
pnpm install
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
