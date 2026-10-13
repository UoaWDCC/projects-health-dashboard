import { db } from '@repo/db'

/**
 * Monday 00:00 UTC of the latest week the worker has stored contribution data for,
 * or null when nothing has been collected yet.
 * Pages pass this one week to every weekly query (MVP, summaries) so they always
 * describe the same week, even when part of the worker run fails.
 */
export async function getLatestWeekStart(): Promise<Date | null> {
  const latest = await db.memberWeeklyContribution.findFirst({
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  return latest?.weekStart ?? null
}
