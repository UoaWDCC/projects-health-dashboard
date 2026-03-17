/**
 * Discord ingestion job.
 * Fetches messages for the past week, writes DiscordWeeklyAggregate
 * and DiscordIdentityWeeklyCount rows. Does not call the LLM.
 * TODO: Implement
 */
export async function runDiscordIngestion(): Promise<void> {
  throw new Error('Not implemented')
}
