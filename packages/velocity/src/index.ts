const ROLLING_WINDOW_WEEKS = 4

export interface VelocityWeek {
  healthScore: number | null
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeVelocity(healthScore: number, precedingScores: number[]): number | null {
  if (precedingScores.length === 0) return 0
  const baseline = average(precedingScores)
  return baseline === 0 ? null : ((healthScore - baseline) / baseline) * 100
}

// Computes velocity — the % difference between a week's healthScore and the
// rolling average of its up-to-4 preceding weeks — for every week of a
// project's history in one pass. `weeks` must be ordered ascending by
// weekStart; the result is parallel to `weeks`.
//
// A project's leading run of null/zero health scores (before it has any real
// score) must never count toward any later week's baseline — otherwise the
// first real week's velocity would be computed against a baseline of 0, and
// leading weeks themselves would compute a meaningless 0-vs-0 comparison.
// `hasStarted` flips permanently the first time a non-null, non-zero score is
// seen; only weeks from that point on enter the rolling window.
export function buildVelocitySeries(weeks: VelocityWeek[]): (number | null)[] {
  const scoredHistory: number[] = []
  let hasStarted = false

  return weeks.map(({ healthScore }) => {
    if (healthScore === null) return null

    if (!hasStarted) {
      if (healthScore === 0) return null
      hasStarted = true
    }

    const precedingScores = scoredHistory.slice(-ROLLING_WINDOW_WEEKS)
    const velocityScore = computeVelocity(healthScore, precedingScores)
    scoredHistory.push(healthScore)
    return velocityScore
  })
}
