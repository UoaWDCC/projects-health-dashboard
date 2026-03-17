# apps/worker

Node.js background worker — ingests GitHub/Discord data and runs weekly rollup + LLM jobs.

Complete root setup first — see [root README](../../README.md).

## Dev

```bash
pnpm --filter worker dev
```

Uses `tsx watch` — restarts on file changes.

## Cron Jobs

Single weekly cron at **Sunday 00:00 UTC**. Jobs run in sequence:

| Step | Job | Description |
|------|-----|-------------|
| 1 (parallel) | GitHub ingestion | Fetch commits and PRs for the past week; write `CommitFact` and `PRFact` |
| 1 (parallel) | Discord ingestion | Fetch messages for the past week; write `DiscordWeeklyAggregate` and `DiscordIdentityWeeklyCount` |
| 2 (after both) | LLM analysis | Read GitHub + Discord data; call LLM; write `sentimentScore`, `sentimentParagraph`, and `summaryText` to `WeeklySummary` |
