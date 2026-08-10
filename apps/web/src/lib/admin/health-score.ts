// Recomputes WeeklyStats.healthScore for every project and every week whenever the
// global health formula changes, using the same variable mapping as the weekly worker job.

import { db } from '@repo/db'
import { math } from './formula'

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

function evaluateFormula(formula: string, scope: Record<string, number>): number | null {
  try {
    const result = math.compile(formula).evaluate(scope)
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export async function recomputeAllHealthScores(formula: string): Promise<void> {
  const allStats = await db.weeklyStats.findMany({
    select: {
      id: true,
      commits: true,
      prsMerged: true,
      linesAdded: true,
      linesRemoved: true,
      discordMessages: true,
    },
  })

  console.log(
    `Recomputing health scores for ${allStats.length} WeeklyStats row(s) using: ${formula}`
  )

  let succeeded = 0
  for (const stats of allStats) {
    const healthScore = evaluateFormula(formula, buildFormulaScope(stats))
    try {
      await db.weeklyStats.update({
        where: { id: stats.id },
        data: { healthScore, algorithmVersion: healthScore !== null ? formula : null },
      })
      succeeded++
    } catch (err) {
      console.error(`WeeklyStats ${stats.id}: failed to write recomputed health score: ${err}`)
    }
  }

  console.log(`Health score recompute finished: ${succeeded}/${allStats.length} row(s) written`)
}
