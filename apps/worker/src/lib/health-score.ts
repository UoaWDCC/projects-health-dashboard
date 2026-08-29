// Computes each project's weekly health score from the global formula stored in Config
// (scope="GLOBAL", key="healthFormula") and persists it to WeeklyStats.healthScore.

import { db } from '@repo/db'
import { logger } from './logger'
import { buildFormulaScope, evaluateFormula, getFormula } from './formula'

const HEALTH_FORMULA_KEY = 'healthFormula'

export async function computeHealthScoreForWeek(
  projectId: string,
  weekStart: Date,
  formula: string | null
): Promise<void> {
  if (!formula) return

  const stats = await db.weeklyStats.findUnique({
    where: { projectId_weekStart: { projectId, weekStart } },
    select: {
      commits: true,
      prsMerged: true,
      linesAdded: true,
      linesRemoved: true,
      discordMessages: true,
    },
  })
  if (!stats) return

  const healthScore = await evaluateFormula(formula, buildFormulaScope(stats))

  try {
    await db.weeklyStats.update({
      where: { projectId_weekStart: { projectId, weekStart } },
      data: {
        healthScore,
        algorithmVersion: healthScore !== null ? formula : null,
        computedAt: new Date(),
      },
    })
  } catch (err) {
    logger.error(
      `Project ${projectId}: failed to write health score for week ${weekStart.toISOString()}: ${err}`
    )
  }
}

export async function computeHealthScoresForActiveProjects(weekStarts: Date[]): Promise<void> {
  const formula = await getFormula(HEALTH_FORMULA_KEY)
  if (!formula) {
    logger.info('No health formula configured; skipping health score computation')
    return
  }

  const projects = await db.project.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  logger.info(
    `Computing health scores for ${projects.length} active project(s) across ${weekStarts.length} week(s) using: ${formula}`
  )

  for (const project of projects) {
    for (const weekStart of weekStarts) {
      await computeHealthScoreForWeek(project.id, weekStart, formula)
    }
  }

  logger.info('Health score computation complete')
}
