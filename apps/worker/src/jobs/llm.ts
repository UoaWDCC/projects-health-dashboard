/**
 * Cross-source LLM analysis job.
 * Reads CommitFact/PRFact (GitHub) and DiscordWeeklyAggregate (Discord)
 * for the past week, calls the LLM, and writes:
 *   - Per-project: sentimentScore, sentimentParagraph, summaryText → WeeklySummary
 *   - Cross-project: summaryText, notableChanges, flaggedWeekProjects,
 *     flaggedAvg4wProjects → GlobalWeeklySummary
 * Must run after runGitHubIngestion() and runDiscordIngestion() complete.
 * TODO: Implement
 */
export async function runLlmAnalysis(): Promise<void> {
  throw new Error('Not implemented')
}
