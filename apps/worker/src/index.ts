// TODO: Uncomment imports as jobs are implemented
// import { runLlmAnalysis } from './jobs/llm'
import { runGitHubIngestion } from './jobs/github'
import { runDiscordIngestion } from './jobs/discord'
import { logger } from './lib/logger'
import { getWeekStart } from './lib/date-utils'

// ─── Cron Schedules ───────────────────────────────────────────────────────────
// Single weekly cron at Monday 00:00 UTC. Jobs run in sequence:
//
//   1. GitHub + Discord run in parallel:
//      GitHub:   fetch commits and PRs for the past week; write CommitFact and PRFact
//      Discord:  fetch messages for the past week; write DiscordWeeklyAggregate and
//                DiscordIdentityWeeklyCount; return raw messages in-memory (not persisted)
//
//   2. LLM analysis runs after both collection jobs complete:
//      Reads CommitFact/PRFact from the database (GitHub) and receives Discord
//      messages as an in-memory argument. Calls the LLM, writes sentimentScore,
//      sentimentParagraph, and summaryText to WeeklySummary. Dependency enforced
//      in code, not by wall-clock timing.

async function main() {
  const weekStart = getWeekStart()
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  logger.info(
    `Starting weekly ingestion jobs (GitHub + Discord in parallel) - week of ${weekStart.toISOString()}`
  )
  const [, discordMessages] = await Promise.all([
    runGitHubIngestion(weekStart, weekEnd).catch((err: unknown) => {
      logger.error(`GitHub ingestion failed: ${err}`)
    }),
    runDiscordIngestion(weekStart, weekEnd).catch((err: unknown) => {
      logger.error(`Discord ingestion failed: ${err}`)
      return []
    }),
  ])

  // TODO: await runLlmAnalysis(discordMessages)
  void discordMessages // placeholder to avoid unused variable error until LLM analysis is implemented

  logger.info('Weekly ingestion complete')
}

main().catch((err: unknown) => {
  logger.error(`Fatal error in weekly job: ${err}`)
  process.exit(1)
})
