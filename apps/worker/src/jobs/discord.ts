/**
 * A single Discord message fetched from the API.
 * Messages are kept in-memory and passed directly to the LLM job;
 * they are never persisted to the database.
 */
export interface DiscordMessage {
  channelId: string
  messageId: string
  authorId: string
  content: string
  createdAt: Date
}

/**
 * Discord ingestion job.
 * Fetches messages posted in the past week, writes aggregate counts to
 * DiscordWeeklyAggregate and DiscordIdentityWeeklyCount, and returns the
 * raw messages in-memory for the LLM job. Raw messages are never persisted.
 * TODO: Implement
 */
export async function runDiscordIngestion(): Promise<DiscordMessage[]> {
  throw new Error('Not implemented')
}
