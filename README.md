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

| Script             | Description                                   |
| ------------------ | --------------------------------------------- |
| `pnpm dev`         | Start web + worker in parallel                |
| `pnpm build`       | Build all apps                                |
| `pnpm db:migrate`  | Run database migrations                       |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:studio`   | Open Prisma Studio at localhost:5555          |
