import { logger } from '../lib/logger'
import { db, SyncJobStatus, SyncJobType } from '@repo/db'

/**
 * 1st Jan 2015, the epoch used by Discord snowflakes.
 */
const DISCORD_EPOCH = 1420070400000n

/**
 * Maximum number of retries for API requests in case of rate limits or transient errors.
 */
const MAX_RETRIES = 3

/**
 * Discord bot token, expected to be set in environment variables.
 * Required for authentication with the Discord API.
 */
const TOKEN = process.env.DISCORD_BOT_TOKEN

/**
 * A single Discord message fetched from the API.
 * Messages are kept in-memory and passed directly to the LLM job;
 * they are never persisted to the database.
 */
interface APIMessage {
  id: string
  channel_id: string
  author: {
    id: string
    username: string
    discriminator: string
    bot?: boolean
  }
  content: string
  timestamp: string
}

/**
 * Project data structure for a single project
 * to be returned by the ingestion job.
 */
interface ProjectData {
  id: string
  messages: string[]
}

/**
 * Utility function to pause execution for a specified number of milliseconds.
 * @param {number} ms The amount of time to sleep in milliseconds.
 * @returns A promise that resolves after the specified time.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Utility function to convert a unix timestamp in milliseconds to a Discord snowflake ID.
 * @param {number} ms The unix timestamp in milliseconds to convert.
 * @returns The converted Discord snowflake ID as a string.
 */
function timestampToSnowflake(ms: number): string {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n)
}

/**
 * Utility function to get the start of the current week (Monday at 00:00:00 UTC) for a given date.
 * @param {Date} date The date to calculate the start of the week for.
 * @returns A new Date object representing the start of the week.
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1))
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Helper function to make authenticated requests to the Discord API
 * with built-in rate limit handling, retries and error handling.
 * @param {string} path The API path to make the request to, e.g. "/channels/{channel_id}/messages"
 * @returns Either void if an error is thrown or the JSON response in a promise.
 */
async function requestMessages(path: string): Promise<APIMessage[]> {
  const url = `https://discord.com/api/v10${path}`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bot ${TOKEN}`,
      },
    })

    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '1')
    const resetAfter = parseFloat(res.headers.get('X-RateLimit-Reset-After') ?? '0')

    if (res.status === 429) {
      const body = await res.json()
      const waitFor = (body.retry_after ?? resetAfter) * 1000
      logger.warn(`Rate limited on ${path}. Waiting ${waitFor}ms...`)
      await sleep(waitFor)
      continue
    }

    if (res.status === 401) throw new Error('401 Unauthorized: Invalid token provided')
    if (res.status === 403) throw new Error('403 Forbidden: No access to project channel')
    if (res.status === 404) throw new Error('404 Not Found: Project channel not found')

    if (!res.ok) {
      const backoff = Math.min(1000 * 2 ** attempt, 30_000)
      logger.warn(`HTTP ${res.status} on ${path}, retrying in ${backoff}ms`)
      await sleep(backoff)
      continue
    }

    if (remaining === 0) {
      await sleep(resetAfter * 1000 + 50) // 50ms buffer
    }

    return res.json()
  }

  throw new Error(`Max retries exceeded for ${path}`)
}

async function fetchWeeklyMessages(channelId: string): Promise<string[]> {
  const weekStart = startOfWeek(new Date())
  const weekEnd = new Date()
  const afterSnowflake = timestampToSnowflake(weekStart.getTime())
  const all: string[] = []
  let after = afterSnowflake

  while (true) {
    const batch = await requestMessages(`/channels/${channelId}/messages?after=${after}&limit=100`)

    if (batch.length === 0) break

    const valid = batch
      .filter(
        (m) =>
          !m.author.bot && new Date(m.timestamp) >= weekStart && new Date(m.timestamp) <= weekEnd
      )
      .map((m) => m.content)

    all.push(...valid)

    if (batch.length < 100) break
    after = batch[batch.length - 1].id
  }

  return all
}

/**
 * Discord ingestion job.
 * Fetches messages posted in the past week, writes aggregate counts to
 * DiscordWeeklyAggregate and DiscordIdentityWeeklyCount, and returns the
 * raw messages in-memory for the LLM job. Raw messages are never persisted.
 */
export async function runDiscordIngestion(): Promise<ProjectData[]> {
  logger.info('Running Discord ingestion job')

  if (!TOKEN) {
    throw new Error('Discord bot token not configured in environment variables')
  }

  const projects = await db.project.findMany({ select: { id: true, name: true, channels: true } })

  if (projects.length === 0) {
    logger.warn('No project channels found in database, skipping ingestion')
    return []
  }

  const data: ProjectData[] = []

  for (const project of projects) {
    if (project.channels.length === 0) {
      logger.warn(`No channels configured for project "${project.name}", skipping`)
      continue
    }

    const syncJob = await db.syncJob.create({
      data: {
        type: SyncJobType.DISCORD,
        projectId: project.id,
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    let itemsProcessed = 0
    const messages: string[] = []

    try {
      for (const channel of project.channels) {
        const fetchedMessages = await fetchWeeklyMessages(channel.externalId)

        if (fetchedMessages.length === 0) {
          logger.warn(`No messages found for channel ${channel.name} in project "${project.name}"`)
          continue
        }

        itemsProcessed += fetchedMessages.length
        messages.push(...fetchedMessages)
        logger.info(
          `Fetched ${fetchedMessages.length} messages from channel ${channel.name} in project "${project.name}"`
        )
      }

      data.push({
        id: project.id,
        messages,
      })

      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.SUCCESS,
          finishedAt: new Date(),
          itemsProcessed,
        },
      })
    } catch (err) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: (err as Error).message,
          itemsProcessed,
        },
      })

      throw err
    }
  }

  return data
}
