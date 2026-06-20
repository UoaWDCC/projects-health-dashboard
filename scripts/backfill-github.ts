/**
 * One-time backfill script: populates historical GitHub PR and commit data for all active projects.
 *
 * The weekly cron job (jobs/github.ts) only collects data within the previous week's window.
 * This script fetches all PRs and branch commits from the given start date, then groups them
 * into weekly buckets. After raw facts are loaded, WeeklyStats and MemberWeeklyContribution
 * are recomputed for every distinct week that the data spans.
 *
 * Run with:
 *   pnpm backfill:github:dev
 *   pnpm backfill:github:prod
 *   pnpm backfill:github:dev -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 *   pnpm backfill:github:prod -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 */

import { db } from '@repo/db'
import { logger } from '../apps/worker/src/lib/logger'
import { main } from '../apps/worker/src/scripts/backfill-github'

main()
  .catch((err: unknown) => {
    logger.error(`Fatal error in GitHub backfill script: ${err}`)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
