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
 * Returns Monday 00:00 UTC of the most recently completed week.
 */
export function getCurrentSummaryWeekStart(now: Date = new Date()): Date {
  const weekStart = new Date(now)
  const day = weekStart.getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - day + (day === 0 ? -6 : 1))
  weekStart.setUTCHours(0, 0, 0, 0)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  return weekStart
}

/**
 * The LLM-written summary and sentiment score for a project's current week.
 * Returns null when no summary has been generated for that week.
 */
export async function getProjectWeeklySummary(slug: string): Promise<ProjectWeeklySummary | null> {
  const summary = await db.weeklySummary.findFirst({
    where: {
      project: { slug },
      weekStart: getCurrentSummaryWeekStart(),
    },
    select: { summaryText: true, sentimentScore: true },
  })

  if (!summary) return null

  return {
    summaryText: summary.summaryText,
    sentimentScore: summary.sentimentScore,
  }
}
