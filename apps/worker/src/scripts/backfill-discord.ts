import { db, IdentityProvider, SyncJobStatus, SyncJobType } from '@repo/db'
import { logger } from '../lib/logger'
import { requestMessages, timestampToSnowflake } from '../jobs/discord'
import { getCollectionWindow } from '../lib/date-utils'
import { computeWeeklyGitHubMetrics } from '../lib/github-weekly-stats'

interface HistoricalMessage {
  authorId: string
  timestamp: Date
}

/**
 * Fetches all messages in a channel posted before the given snowflake,
 * paginating backwards through history. Filters out bot messages.
 */
export async function fetchHistoricalMessages(
  channelId: string,
  beforeSnowflake: string,
  fromMs: number
): Promise<HistoricalMessage[]> {
  const messages: HistoricalMessage[] = []
  let cursor = beforeSnowflake

  while (true) {
    const batch = await requestMessages(
      `/channels/${channelId}/messages?before=${cursor}&limit=100`
    )

    if (batch.length === 0) break

    const valid = batch
      .filter((m) => !m.author.bot && new Date(m.timestamp).getTime() >= fromMs)
      .map((m) => ({ authorId: m.author.id, timestamp: new Date(m.timestamp) }))

    messages.push(...valid)
    logger.info(`  ${messages.length} messages fetched so far`)

    // Discord returns messages newest-first under before=; the last entry is the oldest.
    const oldestInBatch = new Date(batch[batch.length - 1].timestamp).getTime()
    if (oldestInBatch < fromMs || batch.length < 100) break

    cursor = batch[batch.length - 1].id
  }

  return messages
}

export async function writeDiscordWeek(
  projectId: string,
  weekStart: Date,
  authorCounts: Map<string, number>
): Promise<number> {
  const authorIds = [...authorCounts.keys()]

  const knownIdentities = await db.personIdentity.findMany({
    where: { provider: IdentityProvider.DISCORD, externalId: { in: authorIds } },
    select: { id: true, externalId: true },
  })

  const discordIdToIdentityId = new Map(knownIdentities.map((i) => [i.externalId, i.id]))

  const identityCounts = new Map<string, number>()
  let unmappedMessageCount = 0
  let messageCount = 0

  for (const [authorId, count] of authorCounts) {
    messageCount += count
    const identityId = discordIdToIdentityId.get(authorId)
    if (identityId) {
      identityCounts.set(identityId, (identityCounts.get(identityId) ?? 0) + count)
    } else {
      unmappedMessageCount += count
    }
  }

  const uniqueAuthors = authorIds.length

  await db.$transaction([
    db.discordWeeklyAggregate.upsert({
      where: { projectId_weekStart: { projectId, weekStart } },
      create: { projectId, weekStart, messageCount, uniqueAuthors, unmappedMessageCount },
      update: { messageCount, uniqueAuthors, unmappedMessageCount, computedAt: new Date() },
    }),
    ...[...identityCounts].map(([authorIdentityId, count]) =>
      db.discordIdentityWeeklyCount.upsert({
        where: {
          projectId_weekStart_authorIdentityId: { projectId, weekStart, authorIdentityId },
        },
        create: { projectId, weekStart, authorIdentityId, messageCount: count },
        update: { messageCount: count, computedAt: new Date() },
      })
    ),
  ])

  return messageCount
}

export function bucketByWeek(
  messages: HistoricalMessage[]
): Map<string, { weekStart: Date; authorCounts: Map<string, number> }> {
  const buckets = new Map<string, { weekStart: Date; authorCounts: Map<string, number> }>()

  for (const msg of messages) {
    const [weekStart] = getCollectionWindow(msg.timestamp)
    const key = weekStart.toISOString()

    if (!buckets.has(key)) {
      buckets.set(key, { weekStart, authorCounts: new Map() })
    }

    const bucket = buckets.get(key)!
    bucket.authorCounts.set(msg.authorId, (bucket.authorCounts.get(msg.authorId) ?? 0) + 1)
  }

  return buckets
}

export function parseArgs(): { fromMs: number; toMs: number } {
  const args = process.argv.slice(2)
  let fromMs = 0
  let toMs = Date.now()

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      const parsed = new Date(args[++i]).getTime()
      if (isNaN(parsed)) throw new Error(`Invalid --from date: ${args[i]}`)
      const [weekStart] = getCollectionWindow(new Date(parsed))
      fromMs = weekStart.getTime()
    } else if (args[i] === '--to' && args[i + 1]) {
      const parsed = new Date(args[++i]).getTime()
      if (isNaN(parsed)) throw new Error(`Invalid --to date: ${args[i]}`)
      const [weekStart] = getCollectionWindow(new Date(parsed))
      toMs = weekStart.getTime() + 7 * 24 * 60 * 60 * 1000
    }
  }

  if (fromMs > 0 && fromMs >= toMs) {
    throw new Error(
      `--from (${new Date(fromMs).toISOString()}) must be before --to (${new Date(toMs).toISOString()})`
    )
  }

  return { fromMs, toMs }
}

export async function main() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not set in environment variables')
  }

  const { fromMs, toMs } = parseArgs()

  const projects = await db.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true, channels: true, repositories: { select: { id: true } } },
  })

  logger.info(
    `Starting Discord backfill for ${projects.length} active project(s) - ` +
      `${fromMs > 0 ? new Date(fromMs).toISOString() : 'beginning'} to ${new Date(toMs).toISOString()}`
  )

  for (const project of projects) {
    if (project.channels.length === 0) {
      logger.info(`Skipping project "${project.name}" - no channels configured`)
      continue
    }

    const beforeSnowflake = timestampToSnowflake(toMs)

    logger.info(
      `Project "${project.name}": collecting history across ${project.channels.length} channel(s)`
    )

    const syncJob = await db.syncJob.create({
      data: {
        type: SyncJobType.DISCORD,
        projectId: project.id,
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    let totalMessages = 0

    try {
      const allMessages: HistoricalMessage[] = []

      for (const channel of project.channels) {
        logger.info(`  Channel "${channel.name}" (${channel.externalId})`)
        const channelMessages = await fetchHistoricalMessages(
          channel.externalId,
          beforeSnowflake,
          fromMs
        )
        logger.info(`  → ${channelMessages.length} historical messages`)
        allMessages.push(...channelMessages)
      }

      const buckets = bucketByWeek(allMessages)
      const affectedWeeks: { weekStart: Date; messageCount: number }[] = []

      for (const { weekStart, authorCounts } of buckets.values()) {
        const messageCount = await writeDiscordWeek(project.id, weekStart, authorCounts)
        totalMessages += messageCount
        affectedWeeks.push({ weekStart, messageCount })
        logger.info(
          `  Week ${weekStart.toISOString()}: ${messageCount} messages, ${authorCounts.size} unique authors`
        )
      }

      for (const { weekStart } of affectedWeeks) {
        const [, weekEnd] = getCollectionWindow(weekStart)
        try {
          await computeWeeklyGitHubMetrics(
            { id: project.id, repositories: project.repositories },
            weekStart,
            weekEnd
          )
        } catch (err) {
          logger.error(
            `Failed to recompute GitHub metrics for project "${project.name}" week ${weekStart.toISOString()}: ${err}`
          )
        }
      }

      // Zero out discordMessages on GitHub-only historical weeks
      const touchedWeekStarts = new Set(
        affectedWeeks.map(({ weekStart }) => weekStart.toISOString())
      )
      const historicalWeeks = await db.weeklyStats.findMany({
        where: {
          projectId: project.id,
          weekStart: {
            ...(fromMs > 0 && { gte: new Date(fromMs) }),
            lt: new Date(toMs),
          },
        },
        select: { weekStart: true },
      })

      let zeroedWeeks = 0
      for (const { weekStart } of historicalWeeks) {
        if (touchedWeekStarts.has(weekStart.toISOString())) continue
        await db.weeklyStats.update({
          where: { projectId_weekStart: { projectId: project.id, weekStart } },
          data: { discordMessages: 0 },
        })
        zeroedWeeks++
      }
      if (zeroedWeeks > 0) {
        logger.info(`  Zeroed discordMessages on ${zeroedWeeks} GitHub-only historical week(s)`)
      }

      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.SUCCESS,
          finishedAt: new Date(),
          itemsProcessed: totalMessages,
        },
      })

      logger.info(
        `Project "${project.name}" backfill complete: ${totalMessages} messages across ${affectedWeeks.length} week(s)`
      )
    } catch (err) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: (err as Error).message,
          itemsProcessed: totalMessages,
        },
      })
      logger.error(`Backfill failed for project "${project.name}": ${err}`)
    }
  }

  logger.info('Discord historical backfill complete')
}
