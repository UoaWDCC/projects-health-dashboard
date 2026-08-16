// Computes each project's weekly velocity — the % difference between that week's
// WeeklyStats.healthScore and the rolling average of the up-to-4 preceding weeks'
// health scores — and persists it to WeeklyStats.velocityScore.

import { db } from '@repo/db'
import { logger } from './logger'

const ROLLING_WINDOW_WEEKS = 4

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export async function computeVelocityForWeek(projectId: string, weekStart: Date): Promise<void> {
  const current = await db.weeklyStats.findUnique({
    where: { projectId_weekStart: { projectId, weekStart } },
    select: { id: true, healthScore: true },
  })
  if (!current || current.healthScore === null) return

  const previousWeeks = await db.weeklyStats.findMany({
    where: {
      projectId,
      weekStart: { lt: weekStart },
      healthScore: { not: null },
    },
    orderBy: { weekStart: 'desc' },
    take: ROLLING_WINDOW_WEEKS,
    select: { healthScore: true },
  })

  // No prior weeks to compare against — there's nothing to measure velocity relative to.
  const baseline =
    previousWeeks.length > 0
      ? average(previousWeeks.map((week) => week.healthScore as number))
      : null

  const velocityScore =
    baseline === null || baseline === 0 ? null : ((current.healthScore - baseline) / baseline) * 100

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
