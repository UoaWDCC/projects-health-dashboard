import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@repo/db', () => ({
  db: {
    weeklySummary: { findFirst: vi.fn() },
    globalWeeklySummary: { findUnique: vi.fn() },
  },
}))

import { db } from '@repo/db'
import { getGlobalWeeklySummary, getProjectWeeklySummary } from './summary'

const weekStart = new Date('2026-10-05T00:00:00Z')

describe('getProjectWeeklySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queries the project's summary for the given week only", async () => {
    vi.mocked(db.weeklySummary.findFirst).mockResolvedValue({
      summaryText: 'Shipped the login page',
      sentimentScore: 0.8,
    } as never)

    const result = await getProjectWeeklySummary('my-project', weekStart)

    expect(result).toEqual({ summaryText: 'Shipped the login page', sentimentScore: 0.8 })
    expect(db.weeklySummary.findFirst).toHaveBeenCalledWith({
      where: { project: { slug: 'my-project' }, weekStart },
      select: { summaryText: true, sentimentScore: true },
    })
  })

  it('returns null instead of an older summary when that week has none', async () => {
    vi.mocked(db.weeklySummary.findFirst).mockResolvedValue(null)

    expect(await getProjectWeeklySummary('my-project', weekStart)).toBeNull()
  })
})

describe('getGlobalWeeklySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries the global summary for the given week only', async () => {
    const generatedAt = new Date('2026-10-12T01:00:00Z')
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue({
      summaryText: 'All projects on track',
      generatedAt,
    } as never)

    const result = await getGlobalWeeklySummary(weekStart)

    expect(result).toEqual({ summaryText: 'All projects on track', generatedAt })
    expect(db.globalWeeklySummary.findUnique).toHaveBeenCalledWith({
      where: { weekStart },
      select: { summaryText: true, generatedAt: true },
    })
  })

  it('returns null instead of an older summary when that week has none', async () => {
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue(null)

    expect(await getGlobalWeeklySummary(weekStart)).toBeNull()
  })
})
