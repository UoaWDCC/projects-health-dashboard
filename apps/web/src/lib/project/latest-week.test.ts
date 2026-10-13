import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@repo/db', () => ({
  db: {
    memberWeeklyContribution: { findFirst: vi.fn() },
  },
}))

import { db } from '@repo/db'
import { getLatestWeekStart } from './latest-week'

describe('getLatestWeekStart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the newest stored contribution week', async () => {
    const weekStart = new Date('2026-10-05T00:00:00Z')
    vi.mocked(db.memberWeeklyContribution.findFirst).mockResolvedValue({ weekStart } as never)

    expect(await getLatestWeekStart()).toEqual(weekStart)
    expect(db.memberWeeklyContribution.findFirst).toHaveBeenCalledWith({
      orderBy: { weekStart: 'desc' },
      select: { weekStart: true },
    })
  })

  it('returns null when no contributions have been collected yet', async () => {
    vi.mocked(db.memberWeeklyContribution.findFirst).mockResolvedValue(null)

    expect(await getLatestWeekStart()).toBeNull()
  })
})
