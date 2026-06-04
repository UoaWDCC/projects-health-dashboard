/**
 * One-time backfill script: populates historical Discord message counts for all active projects.
 *
 * The weekly cron job (jobs/discord.ts) only collects data for the previous week.
 * This script paginates backwards through each project's configured channels and writes
 * DiscordWeeklyAggregate + DiscordIdentityWeeklyCount rows for every historical week
 * that precedes the earliest row already recorded for that project.
 *
 * Run with:
 *   pnpm backfill:discord:dev                                         # full history up to now
 *   pnpm backfill:discord:dev -- --from 2026-05-16 --to 2026-06-01    # specific date range
 *   pnpm backfill:discord:prod
 *   pnpm backfill:discord:prod -- --from 2024-05-16 --to 2026-06-01
 */

import { db } from '@repo/db'
import { logger } from '../apps/worker/src/lib/logger'
import { main } from '../apps/worker/src/scripts/backfill-discord'

main()
  .catch((err: unknown) => {
    logger.error(`Fatal error in Discord backfill script: ${err}`)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
