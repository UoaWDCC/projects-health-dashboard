// Recomputes WeeklyStats.velocityScore for every project and every week whenever the
// global health formula changes (and therefore every WeeklyStats.healthScore) — using
// the same rolling-average logic as the weekly worker job.

import { db } from '@repo/db'
import { buildVelocitySeries } from '@repo/velocity'

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
    // weeks is sorted ascending by weekStart, so buildVelocitySeries sees each
    // project's history in the order it actually happened.
    const velocities = buildVelocitySeries(weeks)

    for (const [i, week] of weeks.entries()) {
      try {
        await db.weeklyStats.update({
          where: { id: week.id },
          data: { velocityScore: velocities[i] },
        })
        succeeded++
      } catch (err) {
        console.error(`WeeklyStats ${week.id}: failed to write recomputed velocity: ${err}`)
      }
    }
  }

  console.log(`Velocity recompute finished: ${succeeded}/${allStats.length} row(s) written`)
}
