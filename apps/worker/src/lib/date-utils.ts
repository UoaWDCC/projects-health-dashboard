/**
 * Returns:
 * * `weekStart` - the Monday 00:00:00 UTC of the relevant week
 * * `weekEnd` - the Sunday 23:59:59 UTC of the relevant week
 *
 * Without a `date` argument: returns the previous week relative to the current date.
 * With a `date` argument: returns the week containing that date.
 * @returns Tuple of [weekStart, weekEnd] dates
 */
export function getCollectionWindow(date?: Date): [Date, Date] {
  const weekStart = new Date(date ?? new Date())

  const day = weekStart.getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - day + (day === 0 ? -6 : 1))
  weekStart.setUTCHours(0, 0, 0, 0)

  if (!date) {
    weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  }

  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000) // Sunday 23:59:59 UTC

  return [weekStart, weekEnd]
}
