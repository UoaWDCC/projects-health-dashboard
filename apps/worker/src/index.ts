// TODO: Uncomment imports as jobs are implemented
// import { runLlmAnalysis } from './jobs/llm'
import { runGitHubIngestion } from './jobs/github'
import { runDiscordIngestion } from './jobs/discord'
import { computeHealthScoresForActiveProjects } from './lib/health-score'
import { computeVelocityForActiveProjects } from './lib/velocity'
import { logger } from './lib/logger'
import { getCollectionWindow } from './lib/date-utils'

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

// Sentinels returned by the ingestion catch handlers.
export const GITHUB_INGESTION_FAILED = 'github-ingestion-failed' as const
export const DISCORD_INGESTION_FAILED = 'discord-ingestion-failed' as const

export async function main() {
  const [weekStart, weekEnd] = getCollectionWindow()

  logger.info(
    `Starting weekly ingestion jobs (GitHub + Discord in parallel) - week of ${weekStart.toISOString()}`
  )

  const [githubResult, discordResult] = await Promise.all([
    runGitHubIngestion(weekStart, weekEnd).catch((err: unknown) => {
      logger.error(`GitHub ingestion failed: ${err}`)
      return GITHUB_INGESTION_FAILED
    }),
    runDiscordIngestion(weekStart, weekEnd).catch((err: unknown) => {
      logger.error(`Discord ingestion failed: ${err}`)
      return DISCORD_INGESTION_FAILED
    }),
  ])

  const discordMessages = discordResult === DISCORD_INGESTION_FAILED ? [] : discordResult

  // TODO: await runLlmAnalysis(discordMessages)
  void discordMessages // placeholder to avoid unused variable error until LLM analysis is implemented

  // Only score once both collection jobs have succeeded, so scores are never computed
  // against stats that this week's ingestion failed to write.
  if (githubResult === GITHUB_INGESTION_FAILED || discordResult === DISCORD_INGESTION_FAILED) {
    logger.error('Skipping health score computation: one or more ingestion jobs failed')
  } else {
    const [prevWeekStart] = getCollectionWindow(
      new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
    )
    await computeHealthScoresForActiveProjects([prevWeekStart, weekStart]).catch((err: unknown) => {
      logger.error(`Health score computation failed: ${err}`)
    })

    // Velocity compares each week's health score against preceding weeks', so it
    // must run after health scores are written above.
    await computeVelocityForActiveProjects([prevWeekStart, weekStart]).catch((err: unknown) => {
      logger.error(`Velocity computation failed: ${err}`)
    })
  }

  if (githubResult === GITHUB_INGESTION_FAILED) {
    logger.error('Weekly ingestion completed with errors: GitHub ingestion failed')
  }
  if (discordResult === DISCORD_INGESTION_FAILED) {
    logger.error('Weekly ingestion completed with errors: Discord ingestion failed')
  }
  if (githubResult !== GITHUB_INGESTION_FAILED && discordResult !== DISCORD_INGESTION_FAILED) {
    logger.info('Weekly ingestion complete')
  }
}

// Only bootstrap the job when run directly (e.g. `tsx src/index.ts`), not when imported by a test.
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err: unknown) => {
    logger.error(`Fatal error in weekly job: ${err}`)
    process.exit(1)
  })
}
