import { logger } from '../lib/logger'
import { db, IdentityProvider, SyncJobStatus, SyncJobType } from '@repo/db'

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
 * A simplified message structure containing only the content and author ID.
 */
interface FetchedMessage {
  content: string
  authorId: string
}

/**
 * Project data structure for a single project
 * to be returned by the ingestion job.
 */
interface ProjectData {
  projectId: string
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
export function timestampToSnowflake(ms: number): string {
  return String((BigInt(ms) - DISCORD_EPOCH) << 22n)
}

/**
 * Helper function to make authenticated requests to the Discord API
 * with built-in rate limit handling, retries and error handling.
 * @param {string} path The API path to make the request to, e.g. "/channels/{channel_id}/messages"
 * @returns Either void if an error is thrown or the JSON response in a promise.
 */
export async function requestMessages(path: string): Promise<APIMessage[]> {
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

/**
 * Fetches all messages posted in a given Discord channel within the past week.
 * Handles pagination, rate limits, and filters out bot messages.
 * @param {string} channelId The ID of the Discord channel to fetch messages from.
 * @param {Date} weekStart The start of the week to fetch messages from.
 * @param {Date} weekEnd The end of the week to fetch messages until.
 * @returns An array of message contents posted in the past week.
 */
async function fetchWeeklyMessages(
  channelId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<FetchedMessage[]> {
  const afterSnowflake = timestampToSnowflake(weekStart.getTime())
  const fetchedMessages: FetchedMessage[] = []
  let after = afterSnowflake

  while (true) {
    const batch = await requestMessages(`/channels/${channelId}/messages?after=${after}&limit=100`)

    if (batch.length === 0) break

    const valid = batch
      .filter(
        (m) =>
          !m.author.bot && new Date(m.timestamp) >= weekStart && new Date(m.timestamp) <= weekEnd
      )
      .map((m) => ({ content: m.content, authorId: m.author.id }))

    fetchedMessages.push(...valid)

    if (batch.length < 100) break
    after = batch[batch.length - 1].id
  }

  return fetchedMessages
}

/**
 * Discord ingestion job.
 * Fetches messages posted in the past week, writes aggregate counts to
 * DiscordWeeklyAggregate and DiscordIdentityWeeklyCount, and returns the
 * raw messages in-memory for the LLM job. Raw messages are never persisted.
 */
export async function runDiscordIngestion(weekStart: Date, weekEnd: Date): Promise<ProjectData[]> {
  logger.info('Running Discord ingestion job')

  if (!TOKEN) {
    throw new Error('Discord bot token not configured in environment variables')
  }

  const projects = await db.project.findMany({
    select: { id: true, name: true, channels: true },
    where: { isActive: true },
  })

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
    const fetchedMessages: FetchedMessage[] = []

    try {
      for (const channel of project.channels) {
        const channelMessages = await fetchWeeklyMessages(channel.externalId, weekStart, weekEnd)

        if (channelMessages.length === 0) {
          logger.warn(`No messages found for channel ${channel.name} in project "${project.name}"`)
          continue
        }

        itemsProcessed += channelMessages.length
        fetchedMessages.push(...channelMessages)
        logger.info(
          `Fetched ${channelMessages.length} messages from channel ${channel.name} in project "${project.name}"`
        )
      }

      const authorIds = [...new Set(fetchedMessages.map((m) => m.authorId))]

      const knownIdentities = await db.personIdentity.findMany({
        where: {
          provider: IdentityProvider.DISCORD,
          externalId: { in: authorIds },
        },
        select: { id: true, externalId: true },
      })

      const discordIdToIdentityId = new Map(knownIdentities.map((i) => [i.externalId, i.id]))

      const identityCounts = new Map<string, number>()
      let unmappedMessageCount = 0

      for (const msg of fetchedMessages) {
        const identityId = discordIdToIdentityId.get(msg.authorId)
        if (identityId) {
          identityCounts.set(identityId, (identityCounts.get(identityId) ?? 0) + 1)
        } else {
          unmappedMessageCount++
        }
      }

      const uniqueAuthors = authorIds.length
      const messageCount = fetchedMessages.length

      await db.$transaction([
        db.discordWeeklyAggregate.upsert({
          where: { projectId_weekStart: { projectId: project.id, weekStart } },
          create: {
            projectId: project.id,
            weekStart,
            messageCount,
            uniqueAuthors,
            unmappedMessageCount,
          },
          update: { messageCount, uniqueAuthors, unmappedMessageCount, computedAt: new Date() },
        }),
        db.weeklyStats.upsert({
          where: { projectId_weekStart: { projectId: project.id, weekStart } },
          create: { projectId: project.id, weekStart, discordMessages: messageCount },
          update: { discordMessages: messageCount },
        }),
        ...[...identityCounts].map(([authorIdentityId, count]) =>
          db.discordIdentityWeeklyCount.upsert({
            where: {
              projectId_weekStart_authorIdentityId: {
                projectId: project.id,
                weekStart,
                authorIdentityId,
              },
            },
            create: { projectId: project.id, weekStart, authorIdentityId, messageCount: count },
            update: { messageCount: count, computedAt: new Date() },
          })
        ),
      ])

      data.push({
        projectId: project.id,
        messages: fetchedMessages.map((m) => m.content),
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
      logger.error(`Discord ingestion failed for project "${project.name}": ${err}`)
    }
  }

  return data
}
