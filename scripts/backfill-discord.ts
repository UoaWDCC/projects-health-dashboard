/**
 * One-time backfill script: populates historical Discord message counts for all active projects.
 *
 * The weekly cron job (jobs/discord.ts) only collects data for the previous week.
 * This script paginates backwards through each project's configured channels and writes
 * DiscordWeeklyAggregate + DiscordIdentityWeeklyCount rows for every historical week
 * that precedes the earliest row already recorded for that project.
 *
 * Run with:
 *   pnpm backfill:discord:dev
 *   pnpm backfill:discord:prod
 */

import { db, IdentityProvider, SyncJobStatus, SyncJobType } from '@repo/db'
import { logger } from '../apps/worker/src/lib/logger'
import { requestMessages, timestampToSnowflake } from '../apps/worker/src/jobs/discord'
import { getCollectionWindow } from '../apps/worker/src/lib/date-utils'
import { computeWeeklyGitHubMetrics } from '../apps/worker/src/lib/github-weekly-stats'

interface HistoricalMessage {
  authorId: string
  timestamp: Date
}

/**
 * Fetches all messages in a channel posted before the given snowflake,
 * paginating backwards through history. Filters out bot messages.
 */
async function fetchHistoricalMessages(
  channelId: string,
  beforeSnowflake: string
): Promise<HistoricalMessage[]> {
  const messages: HistoricalMessage[] = []
  let cursor = beforeSnowflake

  while (true) {
    const batch = await requestMessages(
      `/channels/${channelId}/messages?before=${cursor}&limit=100`
    )

    if (batch.length === 0) break

    const valid = batch
      .filter((m) => !m.author.bot)
      .map((m) => ({ authorId: m.author.id, timestamp: new Date(m.timestamp) }))

    messages.push(...valid)
    logger.info(`  ${messages.length} messages fetched so far`)

    if (batch.length < 100) break

    // Discord returns messages newest-first under before=; the last entry is the oldest.
    cursor = batch[batch.length - 1].id
  }

  return messages
}

async function writeDiscordWeek(
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

function bucketByWeek(
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

async function main() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not set in environment variables')
  }

  const projects = await db.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true, channels: true, repositories: { select: { id: true } } },
  })

  logger.info(`Starting Discord historical backfill for ${projects.length} active project(s)`)

  for (const project of projects) {
    if (project.channels.length === 0) {
      logger.info(`Skipping project "${project.name}" - no channels configured`)
      continue
    }

    const earliest = await db.discordWeeklyAggregate.findFirst({
      where: { projectId: project.id },
      orderBy: { weekStart: 'asc' },
      select: { weekStart: true },
    })

    // Start from the earliest existing week (or now if no rows exist).
    const cutoffMs = earliest ? earliest.weekStart.getTime() : Date.now()
    const beforeSnowflake = timestampToSnowflake(cutoffMs)

    logger.info(
      `Project "${project.name}": collecting history before ${new Date(cutoffMs).toISOString()} across ${project.channels.length} channel(s)`
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
        const channelMessages = await fetchHistoricalMessages(channel.externalId, beforeSnowflake)
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
        where: { projectId: project.id, weekStart: { lt: new Date(cutoffMs) } },
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

main()
  .catch((err: unknown) => {
    logger.error(`Fatal error in Discord backfill script: ${err}`)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
