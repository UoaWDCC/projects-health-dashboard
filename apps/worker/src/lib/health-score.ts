// Computes each project's weekly health score from the global formula stored in Config
// (scope="GLOBAL", key="healthFormula") and persists it to WeeklyStats.healthScore.

import { db } from '@repo/db'
import { logger } from './logger'

// Dynamic import avoids a static `require('mathjs')` under this project's CJS/node16
// module resolution — mathjs is ESM-only. Mirrors the same workaround already used
// for octokit in packages/github/src/index.ts.
type MathInstance = ReturnType<
  typeof import('mathjs', { with: { 'resolution-mode': 'import' } }).create
>

let mathInstance: MathInstance | null = null

async function getMath(): Promise<MathInstance> {
  if (!mathInstance) {
    const { create, all } = await import('mathjs')
    mathInstance = create(all)
  }
  return mathInstance
}

const GLOBAL_SCOPE = 'GLOBAL'
const HEALTH_FORMULA_KEY = 'healthFormula'

type WeeklyStatsCounts = {
  commits: number
  prsMerged: number
  linesAdded: number
  linesRemoved: number
  discordMessages: number
}

function buildFormulaScope(stats: WeeklyStatsCounts): Record<string, number> {
  return {
    commits: stats.commits,
    prs: stats.prsMerged,
    lines_changed: stats.linesAdded + stats.linesRemoved,
    discord_messages: stats.discordMessages,
  }
}

async function evaluateFormula(
  formula: string,
  scope: Record<string, number>
): Promise<number | null> {
  try {
    const math = await getMath()
    const result = math.compile(formula).evaluate(scope)
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export async function getHealthFormula(): Promise<string | null> {
  const config = await db.config.findUnique({
    where: { scope_key: { scope: GLOBAL_SCOPE, key: HEALTH_FORMULA_KEY } },
  })
  return typeof config?.value === 'string' ? config.value : null
}

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
      data: { healthScore, algorithmVersion: healthScore !== null ? formula : null },
    })
  } catch (err) {
    logger.error(
      `Project ${projectId}: failed to write health score for week ${weekStart.toISOString()}: ${err}`
    )
  }
}

export async function computeHealthScoresForActiveProjects(weekStarts: Date[]): Promise<void> {
  const formula = await getHealthFormula()
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
