const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface WeekOnWeekChange {
  direction: 'up' | 'down' | 'flat'
  percent: number // absolute change, rounded to the nearest whole number
}

/**
 * Percentage change between the latest week and the week directly before it.
 *
 * Returns null when there is nothing to compare against: fewer than two points,
 * the previous point isn't the immediately preceding week (that week has no
 * data), or last week's value was 0 while this week's isn't (no finite
 * percentage exists).
 */
export function getWeekOnWeekChange(
  dates: string[], // ISO date strings, ascending
  dataPoints: number[]
): WeekOnWeekChange | null {
  const count = Math.min(dates.length, dataPoints.length)
  if (count < 2) return null

  const gap = new Date(dates[count - 1]).getTime() - new Date(dates[count - 2]).getTime()
  if (gap !== WEEK_MS) return null

  const current = dataPoints[count - 1]
  const previous = dataPoints[count - 2]

  if (current === previous) return { direction: 'flat', percent: 0 }
  if (previous === 0) return null

  return {
    direction: current > previous ? 'up' : 'down',
    percent: Math.round((Math.abs(current - previous) / Math.abs(previous)) * 100),
  }
}
