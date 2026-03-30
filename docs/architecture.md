# Architecture

## Monorepo structure

The repo uses pnpm workspaces with three packages:

```
projects-health-dashboard/
├── apps/
│   ├── web/       # Next.js 15 frontend
│   └── worker/    # Node.js background cron worker
└── packages/
    └── db/        # Shared Prisma client (@repo/db)
```

`packages/db` is the shared data layer. Both `apps/web` and `apps/worker` import from it as `@repo/db`. The Prisma schema, migrations, and generated client all live here.

## System components

```mermaid
graph TD
    subgraph External
        GH[GitHub API]
        DC[Discord API]
        OAI[OpenAI API]
        WEBHOOK[GitHub Webhook]
    end

    subgraph apps/worker
        CRON[Weekly Cron<br/>Sun 00:00 UTC]
        GH_JOB[GitHub Job]
        DC_JOB[Discord Job]
        LLM_JOB[LLM Job]
    end

    subgraph apps/web
        NEXTJS[Next.js App]
        AUTH[Supabase Auth<br/>middleware.ts]
    end

    subgraph packages/db
        PRISMA[Prisma Client<br/>@repo/db]
    end

    subgraph Supabase
        DB[(PostgreSQL)]
        SUPAAUTH[Auth service]
    end

    CRON --> GH_JOB
    CRON --> DC_JOB
    GH_JOB --> GH
    DC_JOB --> DC
    GH_JOB --> PRISMA
    DC_JOB --> PRISMA
    GH_JOB -->|completes| LLM_JOB
    DC_JOB -->|completes| LLM_JOB
    LLM_JOB --> OAI
    LLM_JOB --> PRISMA

    WEBHOOK --> NEXTJS
    NEXTJS --> PRISMA
    NEXTJS --> AUTH
    AUTH --> SUPAAUTH

    PRISMA --> DB
```

## Weekly data pipeline

The worker fires one cron job every Sunday at 00:00 UTC. The three jobs always run in this order:

```mermaid
sequenceDiagram
    participant Cron
    participant GitHub Job
    participant Discord Job
    participant LLM Job
    participant DB

    Cron->>GitHub Job: start
    Cron->>Discord Job: start (parallel)

    GitHub Job->>DB: write CommitFact, PRFact
    Discord Job->>DB: write DiscordWeeklyAggregate, DiscordIdentityWeeklyCount

    GitHub Job-->>LLM Job: done signal
    Discord Job-->>LLM Job: done signal

    Note over LLM Job: waits for both to finish
    LLM Job->>DB: read CommitFact, PRFact, DiscordWeeklyAggregate
    LLM Job->>DB: write WeeklySummary, GlobalWeeklySummary
```

The LLM job's dependency on both collection jobs is enforced in code via `Promise.all`, not wall-clock timing.

## Live commit feed (separate from the cron)

`LiveCommit` is a ring-buffer of the 10 most recent commits. It is fed by a GitHub webhook hitting the Next.js app — not the weekly cron. This keeps the live activity carousel on the dashboard up to date without waiting for Sunday.

```mermaid
sequenceDiagram
    participant GitHub
    participant Next.js webhook handler
    participant DB

    GitHub->>Next.js webhook handler: push event
    Next.js webhook handler->>DB: insert LiveCommit
    DB->>DB: delete oldest row if count > 10
```

## Identity resolution

Contributors have accounts on both GitHub and Discord. The schema links them through a `Person` record:

```mermaid
erDiagram
    Person ||--o{ PersonIdentity : has
    Person ||--o{ ProjectMember : "is member of"
    PersonIdentity ||--o{ CommitFact : "authored"
    PersonIdentity ||--o{ PRFact : "authored / merged"
    PersonIdentity ||--o{ DiscordIdentityWeeklyCount : "counted in"

    PersonIdentity {
        string provider "GITHUB or DISCORD"
        string externalId "GitHub user id or Discord snowflake"
        string username "display handle"
    }
```

When the ingestion jobs encounter a GitHub or Discord user they cannot map to a known `Person`, they write an `UnmatchedIdentity` row. An admin reviews these in the UI and links them to the correct person.

## How the web app reads data

The web app never reads raw ingested facts directly — it reads the derived tables that the worker produces:

| What the dashboard shows          | Source table               |
| --------------------------------- | -------------------------- |
| Weekly health/velocity scores     | `WeeklyStats`              |
| Per-member contribution breakdown | `MemberWeeklyContribution` |
| Project narrative summary         | `WeeklySummary`            |
| Cross-project executive overview  | `GlobalWeeklySummary`      |
| Live commit feed                  | `LiveCommit`               |

## Technology choices

| Layer      | Technology                  | Why                                                                         |
| ---------- | --------------------------- | --------------------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router)     | SSR + React Server Components for fast initial load                         |
| Styling    | Tailwind CSS + shadcn/ui    | Utility-first with accessible component primitives                          |
| Charts     | shadcn/ui charts (Recharts) | Themed chart wrappers aligned with shadcn design tokens; backed by Recharts |
| Auth       | Supabase (Google OAuth)     | Managed auth with row-level security available                              |
| ORM        | Prisma                      | Type-safe queries, migration tooling                                        |
| Database   | PostgreSQL via Supabase     | Reliable hosted Postgres with connection pooling                            |
| Worker     | Node.js + node-cron         | Lightweight, same language as the rest of the stack                         |
| Deployment | Fly.io                      | Simple container deployments, Sydney region                                 |
