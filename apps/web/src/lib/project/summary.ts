import { db } from '@repo/db'

export type SentimentBand = 'on-track' | 'watch' | 'off-track'

/**
 * Which of the three bands a sentiment score falls into.
 * On track: 0.7 and above.
 * Watch: 0.5 up to (but not including) 0.7.
 * Off track: below 0.5.
 */
export function sentimentBand(score: number): SentimentBand {
  if (score >= 0.7) return 'on-track'
  if (score >= 0.5) return 'watch'
  return 'off-track'
}

export interface ProjectWeeklySummary {
  summaryText: string
  sentimentScore: number | null
}

/**
 * The LLM-written summary and sentiment score from the latest week that has a summary
 * for this project. Like the Weekly MVP section, this uses whatever week the worker
 * last stored rather than computing the week here, so it still shows the most recent
 * summary when the worker is late or fails.
 * Returns null when no summary has been generated for the project yet.
 */
export async function getProjectWeeklySummary(slug: string): Promise<ProjectWeeklySummary | null> {
  const summary = await db.weeklySummary.findFirst({
    where: { project: { slug } },
    orderBy: { weekStart: 'desc' },
    select: { summaryText: true, sentimentScore: true },
  })

  if (!summary) return null

  return {
    summaryText: summary.summaryText,
    sentimentScore: summary.sentimentScore,
  }
}

export interface GlobalWeeklySummaryData {
  summaryText: string
  generatedAt: Date
}

/**
 * The cross-project LLM summary from the latest week that has one.
 * Returns null when no global summary has been generated yet.
 */
export async function getGlobalWeeklySummary(): Promise<GlobalWeeklySummaryData | null> {
  const summary = await db.globalWeeklySummary.findFirst({
    orderBy: { weekStart: 'desc' },
    select: { summaryText: true, generatedAt: true },
  })

  return summary ?? null
}
