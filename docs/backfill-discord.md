# Discord Backfill

## Purpose

The weekly cron (`jobs/discord.ts`) only collects the previous week's messages. This means a project that was set up after the cron was already running, or a channel that was added later, will have no historical data. The backfill script (`scripts/backfill-discord.ts`) fills those gaps by paginating backwards through Discord channel history and writing aggregate rows for every historical week.

## What it collects

For each active project with at least one configured `DiscordChannel`, the script:

1. **Paginates backwards** through each channel's message history using Discord snowflake IDs as cursors (no re-fetching of data already covered by the weekly cron)
2. **Filters out bot messages**
3. **Buckets messages by week** — each message is assigned to the Monday 00:00 UTC boundary of the week it was sent (`bucketByWeek`)
4. **Writes aggregate rows** for each week:
   - `DiscordWeeklyAggregate` — project-level totals: `messageCount`, `uniqueAuthors`, `unmappedMessageCount`
   - `DiscordIdentityWeeklyCount` — per-identity breakdown for authors who have been mapped to a `PersonIdentity`; unmapped authors are counted in `unmappedMessageCount` on the aggregate row but not stored individually
5. **Recomputes `WeeklyStats`** for every affected week via `computeWeeklyGitHubMetrics` so that composite health scores stay consistent with the newly added Discord data
6. **Zeroes out `discordMessages`** on any `WeeklyStats` rows within the date range that had GitHub data but no Discord activity, ensuring the field is always explicitly set rather than left null

All writes use upsert semantics — the script is safe to re-run.

## How to run

```bash
# Full history for all active projects
pnpm backfill:discord:dev
pnpm backfill:discord:prod

# Specific date range
pnpm backfill:discord:dev -- --from YYYY-MM-DD --to YYYY-MM-DD
pnpm backfill:discord:prod -- --from YYYY-MM-DD --to YYYY-MM-DD
```

`--from` and `--to` are both optional. When provided, each is snapped to the Monday boundary of the containing week so full weeks are always included. `--from` defaults to the beginning of time (full history); `--to` defaults to now.

**Example:**

```bash
pnpm backfill:discord:dev -- --from 2025-01-01 --to 2026-01-01
```

## Required environment variables

| Variable            | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `DATABASE_URL`      | Runtime database queries (transaction pooler, port 6543) |
| `DISCORD_BOT_TOKEN` | Discord API access for fetching message history          |

The `dev` scripts load from `.env.dev`; the `prod` scripts load from `.env`. Set these variables in the appropriate file before running.

## When to use

- **Initial project setup** — backfill Discord history before the weekly cron started running
- **Adding a new channel** — after adding a new `DiscordChannel` to an existing project
- **Cron outage recovery** — if the worker was down for one or more weeks and Discord data was missed

## Progress and audit trail

Each project run creates a `SyncJob` row (`type: DISCORD`) that is updated to `SUCCESS` or `FAILED` on completion. Check the `SyncJob` table if a project fails partway through — it records the error message and how many messages were processed before the failure.

Log output is written via `logger.info/error` and includes per-channel fetch progress, per-week message counts, and a final summary.
