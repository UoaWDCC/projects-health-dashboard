// Computes each project's weekly velocity — the % difference between that week's
// WeeklyStats.healthScore and the rolling average of the up-to-4 preceding weeks'
// health scores — and persists it to WeeklyStats.velocityScore.

import { db } from '@repo/db'
import { buildVelocitySeries } from '@repo/velocity'
import { logger } from './logger'

export async function computeVelocityForWeek(projectId: string, weekStart: Date): Promise<void> {
  const current = await db.weeklyStats.findUnique({
    where: { projectId_weekStart: { projectId, weekStart } },
    select: { id: true, healthScore: true },
  })
  if (!current) return

  // If the health score was cleared (e.g. by a recompute), velocity must be cleared
  // too — otherwise a stale value would linger for a week with no score to derive it from.
  let velocityScore: number | null = null

  if (current.healthScore !== null) {
    // Fetch the project's full history up to and including this week. This is
    // deliberately unbounded rather than limited to the rolling window,
    // because buildVelocitySeries needs to see any leading run of zeros
    // (project hasn't started yet) to correctly exclude it from the baseline,
    // no matter how far back it goes.
    const history = await db.weeklyStats.findMany({
      where: { projectId, weekStart: { lte: weekStart } },
      orderBy: { weekStart: 'asc' },
      select: { healthScore: true },
    })

    const series = buildVelocitySeries(history)
    velocityScore = series.at(-1) ?? null
  }

  try {
    await db.weeklyStats.update({
      where: { id: current.id },
      data: { velocityScore },
    })
  } catch (err) {
    logger.error(
      `Project ${projectId}: failed to write velocity for week ${weekStart.toISOString()}: ${err}`
    )
  }
}

export async function computeVelocityForActiveProjects(weekStarts: Date[]): Promise<void> {
  const projects = await db.project.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  logger.info(
    `Computing velocity for ${projects.length} active project(s) across ${weekStarts.length} week(s)`
  )

  for (const project of projects) {
    for (const weekStart of weekStarts) {
      await computeVelocityForWeek(project.id, weekStart)
    }
  }

  logger.info('Velocity computation complete')
}
