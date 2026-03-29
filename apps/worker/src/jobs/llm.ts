/**
 * Cross-source LLM analysis job.
 * Reads CommitFact/PRFact from the database (written by runGitHubIngestion)
 * and receives Discord messages in-memory (never persisted). Calls the LLM
 * and writes:
 *   - Per-project: sentimentScore, sentimentParagraph, summaryText → WeeklySummary
 *   - Cross-project: summaryText, notableChanges, flaggedWeekProjects,
 *     flaggedAvg4wProjects → GlobalWeeklySummary
 * Must run after runGitHubIngestion() completes.
 *
 * TODO: Implement
 *   - Add param: discordMessages: DiscordMessage[] (import from './discord')
 *   - Read CommitFact and PRFact from the database for the past week
 *   - Use discordMessages (passed in-memory from runDiscordIngestion) as additional context
 *   - Call the LLM and write results to WeeklySummary and GlobalWeeklySummary
 */
export async function runLlmAnalysis(): Promise<void> {
  throw new Error('Not implemented')
}
