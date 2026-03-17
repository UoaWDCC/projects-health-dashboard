import cron from 'node-cron'
// TODO: Uncomment imports as jobs are implemented
// import { runGitHubIngestion } from './jobs/github'
// import { runDiscordIngestion } from './jobs/discord'
// import { runLlmAnalysis } from './jobs/llm'
import { logger } from './lib/logger'

// ─── Cron Schedules ───────────────────────────────────────────────────────────
// Single weekly cron at Sunday 00:00 UTC. Jobs run in sequence:
//
//   1. GitHub + Discord run in parallel:
//      GitHub:   fetch commits and PRs for the past week; write CommitFact and PRFact
//      Discord:  fetch messages for the past week; write DiscordWeeklyAggregate
//                and DiscordIdentityWeeklyCount
//
//   2. LLM analysis runs after both collection jobs complete:
//      Reads CommitFact/PRFact (GitHub) and DiscordWeeklyAggregate (Discord),
//      calls the LLM, writes sentimentScore, sentimentParagraph, and summaryText
//      to WeeklySummary. Dependency enforced in code, not by wall-clock timing.

cron.schedule('0 0 * * 0', async () => {
  logger.info('Starting weekly ingestion jobs (GitHub + Discord in parallel)')
  // TODO: Implement — run both collection jobs concurrently, then LLM
  // await Promise.all([runGitHubIngestion(), runDiscordIngestion()])
  // logger.info('Data collection complete — starting LLM analysis')
  // await runLlmAnalysis()
})

logger.info('Worker started — 1 weekly cron job registered')
