# GitHub Backfill

## Purpose

The weekly cron (`jobs/github.ts`) only collects commits and PRs from the previous week's window. This means a project added after the cron started, or a newly added repository, will have no historical data. The backfill script (`scripts/backfill-github.ts`) fills those gaps by fetching all historical PRs and branch commits within a date range, then recomputing weekly statistics for every affected week.

## What it collects

For each active project with at least one configured `GitHubRepository`, the script runs a two-pass process per repository:

### Pass 1 — Pull requests and their commits

- Fetches **all PRs** for the repository (open, merged, and closed) using GitHub's list-pulls endpoint, which avoids the 1000-result cap of the search API
- Filters in memory to PRs relevant to the date range
- For each relevant PR, fetches the full PR detail and **upserts a `PRFact` row** for any PR merged within `[fromDate, toDate)`
- Fetches all commits associated with each PR via the PR commits API — this covers commits on branches that have since been deleted, since GitHub preserves commits after branch deletion
- **Upserts a `CommitFact` row** for each commit whose author date falls within `[fromDate, toDate)`

### Pass 2 — Branch commits

- Fetches the list of all non-main/master branches
- For each branch, fetches all commits since `fromDate` and **upserts `CommitFact` rows** for commits within `[fromDate, toDate)`
- This catches commits that were never part of a merged PR (e.g. work-in-progress branches)

### After both passes

Once raw facts are written for all repos in a project, the script:

- Collects all distinct `weekStart` values touched by the newly written commits and PRs
- **Recomputes `WeeklyStats` and `MemberWeeklyContribution`** for each affected week via `computeWeeklyGitHubMetrics`

All writes use upsert semantics — the script is safe to re-run.

## How to run

```bash
# --from is required; --to defaults to now
pnpm backfill:github:dev -- --from YYYY-MM-DD
pnpm backfill:github:prod -- --from YYYY-MM-DD

# With an explicit end date
pnpm backfill:github:dev -- --from YYYY-MM-DD --to YYYY-MM-DD
pnpm backfill:github:prod -- --from YYYY-MM-DD --to YYYY-MM-DD
```

Both `--from` and `--to` are snapped to Monday 00:00 UTC boundaries of their containing week, so full weeks are always included. `--from` is **required**.

**Example:**

```bash
pnpm backfill:github:dev -- --from 2025-01-01 --to 2026-01-01
```

## Required environment variables

| Variable                 | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `DATABASE_URL`           | Runtime database queries (transaction pooler, port 6543) |
| `GITHUB_APP_ID`          | GitHub App authentication                                |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App authentication                                |

The `dev` scripts load from `.env.dev`; the `prod` scripts load from `.env`. Set these variables in the appropriate file before running.

The script uses the same GitHub App auth as the weekly cron (`lib/github-auth.ts`). Each `GitHubRepository` record must have a valid `installationId` set before running the backfill.

## When to use

- **Initial project setup** — backfill GitHub history before the weekly cron started running
- **Adding a new repository** — after adding a new `GitHubRepository` to an existing project
- **Cron outage recovery** — if the worker was down for one or more weeks and GitHub data was missed

## Progress and audit trail

Each project run creates a `SyncJob` row (`type: GITHUB`) that is updated to `SUCCESS` or `FAILED` on completion. If a project fails, the `SyncJob` row records the error message and item count processed so far.

The final log line reports a grand total across all projects:

```
GitHub historical backfill complete — N project(s) succeeded, M failed | X PRs, Y commits, Z weeks recomputed
```

If any projects failed, the log also prompts you to check the `SyncJob` table for `FAILED` entries and re-run for those projects.
