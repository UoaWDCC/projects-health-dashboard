// Recomputes WeeklyStats.velocityScore for every project and every week whenever the
// global health formula changes (and therefore every WeeklyStats.healthScore) — using
// the same rolling-average logic as the weekly worker job.

import { db } from '@repo/db'

const ROLLING_WINDOW_WEEKS = 4

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeVelocity(healthScore: number, precedingScores: number[]): number | null {
  if (precedingScores.length === 0) return null
  const baseline = average(precedingScores)
  return baseline === 0 ? null : ((healthScore - baseline) / baseline) * 100
}

export async function recomputeAllVelocity(): Promise<void> {
  const allStats = await db.weeklyStats.findMany({
    select: { id: true, projectId: true, weekStart: true, healthScore: true },
    orderBy: { weekStart: 'asc' },
  })

  const byProject = new Map<string, typeof allStats>()
  for (const stats of allStats) {
    const group = byProject.get(stats.projectId)
    if (group) {
      group.push(stats)
    } else {
      byProject.set(stats.projectId, [stats])
    }
  }

  console.log(
    `Recomputing velocity for ${allStats.length} WeeklyStats row(s) across ${byProject.size} project(s)`
  )

  let succeeded = 0
  for (const weeks of byProject.values()) {
    // weeks is sorted ascending by weekStart, so prior scored weeks are always
    // already at the front of the sliding window by the time we reach `week`.
    const scoredHistory: number[] = []

    for (const week of weeks) {
      const precedingScores = scoredHistory.slice(-ROLLING_WINDOW_WEEKS)
      const velocityScore =
        week.healthScore === null ? null : computeVelocity(week.healthScore, precedingScores)

      try {
        await db.weeklyStats.update({
          where: { id: week.id },
          data: { velocityScore },
        })
        succeeded++
      } catch (err) {
        console.error(`WeeklyStats ${week.id}: failed to write recomputed velocity: ${err}`)
      }

      if (week.healthScore !== null) {
        scoredHistory.push(week.healthScore)
      }
    }
  }

  console.log(`Velocity recompute finished: ${succeeded}/${allStats.length} row(s) written`)
}
