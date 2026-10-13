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
 * The LLM-written summary and sentiment score for a project in the given week.
 * Returns null when no summary was generated for that week (e.g. the LLM job failed),
 * rather than falling back to an older week that could be mistaken for the current one.
 */
export async function getProjectWeeklySummary(
  slug: string,
  weekStart: Date
): Promise<ProjectWeeklySummary | null> {
  const summary = await db.weeklySummary.findFirst({
    where: { project: { slug }, weekStart },
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
 * The cross-project LLM summary for the given week.
 * Returns null when none was generated for that week, rather than showing an older one.
 */
export async function getGlobalWeeklySummary(
  weekStart: Date
): Promise<GlobalWeeklySummaryData | null> {
  const summary = await db.globalWeeklySummary.findUnique({
    where: { weekStart },
    select: { summaryText: true, generatedAt: true },
  })

  return summary ?? null
}
