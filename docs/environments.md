# Environments

## Overview

There are two fully isolated environments — dev and prod — each with their own Supabase project (database + auth). The GitHub App, OpenAI API, and Discord bot token are shared across both.

```mermaid
flowchart TB
    subgraph DEV["DEV (local)"]
        direction TB
        WEB_DEV["Next.js<br/>localhost:3000"]
        WORKER_DEV["Worker<br/>localhost"]
        SUPA_DEV["Supabase Dev Project<br/>(Google OAuth + dev DB)"]
        WEB_DEV -->|"auth session / reads"| SUPA_DEV
        WORKER_DEV -->|"writes ingested facts"| SUPA_DEV
    end

    subgraph PROD["PROD (Fly.io)"]
        direction TB
        WEB_PROD["Next.js<br/>Fly.io — wphd-prod"]
        WORKER_PROD["Worker<br/>Fly.io"]
        SUPA_PROD["Supabase Prod Project<br/>(Google OAuth + prod DB)"]
        WEB_PROD -->|"auth session / reads"| SUPA_PROD
        WORKER_PROD -->|"writes ingested facts"| SUPA_PROD
    end

    subgraph DISCORD["Discord Bot (shared token)"]
        DISCORD_TEST["Test Server<br/>(dev channels)"]
        DISCORD_PROD_SRV["Prod Server<br/>(prod channels)"]
    end

    GH["GitHub App<br/>(shared)"]
    OPENAI["OpenAI API<br/>(shared)"]

    WORKER_DEV -->|"reads test channels"| DISCORD_TEST
    WORKER_PROD -->|"reads prod channels"| DISCORD_PROD_SRV

    WORKER_DEV -->|"reads commits / PRs"| GH
    WORKER_PROD -->|"reads commits / PRs"| GH

    GH -->|"LiveCommit webhook"| WEB_DEV
    GH -->|"LiveCommit webhook"| WEB_PROD

    WORKER_DEV -->|"LLM summaries"| OPENAI
    WORKER_PROD -->|"LLM summaries"| OPENAI
```

## Dev environment

| Component       | Where it runs                       |
| --------------- | ----------------------------------- |
| Next.js web app | `localhost:3000`                    |
| Worker          | Local process (no HTTP port)        |
| Database        | Supabase dev project                |
| Auth            | Supabase dev project (Google OAuth) |

Environment variables are loaded from `.env.dev` at the repo root. This file is gitignored and can be found in the Google Drive.

The dev Discord bot reads from a **test Discord server** — separate channels that mirror the structure of the production server but contain only test data. This prevents the worker from polluting production channels during development.

## Prod environment

| Component       | Where it runs                                   |
| --------------- | ----------------------------------------------- |
| Next.js web app | Fly.io — app `wphd-prod`, region `syd` (Sydney) |
| Worker          | Fly.io — same app, separate process             |
| Database        | Supabase prod project                           |
| Auth            | Supabase prod project (Google OAuth)            |

Environment variables are stored as Fly.io secrets (not committed to git). They are set once via `flyctl secrets set` and injected at runtime.

Prod deployments are triggered automatically when a commit is pushed to `main`. See [ci-cd.md](./ci-cd.md).

## Shared services

| Service     | Scope                           | Note                                                                    |
| ----------- | ------------------------------- | ----------------------------------------------------------------------- |
| GitHub App  | Shared across dev + prod        | Same App ID and private key; different webhook targets                  |
| OpenAI API  | Shared across dev + prod        | Usage from both environments hits the same API key and billing          |
| Discord bot | Shared token, different servers | Dev bot reads test server channels; prod bot reads prod server channels |

## Environment files

| File           | Purpose                                                        | Committed?      |
| -------------- | -------------------------------------------------------------- | --------------- |
| `.env.example` | Template — all required variable names with empty values       | Yes             |
| `.env.dev`     | Dev credentials                                                | No (gitignored) |
| `.env`         | Prod credentials for local use (e.g. running `db:deploy:prod`) | No (gitignored) |

All database scripts are wrapped with `dotenv-cli` to load the correct env file automatically. For example, `db:migrate:dev` loads `.env.dev` and `db:deploy:prod` loads `.env` (and prompts for confirmation before running).

## Google OAuth redirect URLs

Each Supabase project has its own list of allowed OAuth redirect URLs. If Google OAuth doesn't work after cloning, your local URL (`http://localhost:3000`) probably isn't whitelisted in the dev Supabase project. An admin needs to add it under Authentication → URL Configuration.
