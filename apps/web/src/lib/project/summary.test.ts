import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@repo/db', () => ({
  db: {
    weeklySummary: { findFirst: vi.fn() },
    globalWeeklySummary: { findFirst: vi.fn() },
  },
}))

import { db } from '@repo/db'
import { getGlobalWeeklySummary, getProjectWeeklySummary } from './summary'

describe('getProjectWeeklySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queries the project's latest summary instead of a computed week", async () => {
    vi.mocked(db.weeklySummary.findFirst).mockResolvedValue({
      summaryText: 'Shipped the login page',
      sentimentScore: 0.8,
    } as never)

    const result = await getProjectWeeklySummary('my-project')

    expect(result).toEqual({ summaryText: 'Shipped the login page', sentimentScore: 0.8 })
    expect(db.weeklySummary.findFirst).toHaveBeenCalledWith({
      where: { project: { slug: 'my-project' } },
      orderBy: { weekStart: 'desc' },
      select: { summaryText: true, sentimentScore: true },
    })
  })

  it('returns null when the project has no summary yet', async () => {
    vi.mocked(db.weeklySummary.findFirst).mockResolvedValue(null)

    expect(await getProjectWeeklySummary('my-project')).toBeNull()
  })
})

describe('getGlobalWeeklySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries the latest global summary instead of a computed week', async () => {
    const generatedAt = new Date('2026-10-05T01:00:00Z')
    vi.mocked(db.globalWeeklySummary.findFirst).mockResolvedValue({
      summaryText: 'All projects on track',
      generatedAt,
    } as never)

    const result = await getGlobalWeeklySummary()

    expect(result).toEqual({ summaryText: 'All projects on track', generatedAt })
    expect(db.globalWeeklySummary.findFirst).toHaveBeenCalledWith({
      orderBy: { weekStart: 'desc' },
      select: { summaryText: true, generatedAt: true },
    })
  })

  it('returns null when no global summary exists yet', async () => {
    vi.mocked(db.globalWeeklySummary.findFirst).mockResolvedValue(null)

    expect(await getGlobalWeeklySummary()).toBeNull()
  })
})
