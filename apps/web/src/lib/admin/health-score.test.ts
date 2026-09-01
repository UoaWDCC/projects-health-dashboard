import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@repo/db', () => ({
  db: {
    weeklyStats: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '@repo/db'
import { recomputeAllHealthScores } from './health-score'

const baseStats = {
  commits: 0,
  prsMerged: 0,
  linesAdded: 0,
  linesRemoved: 0,
  discordMessages: 0,
}

describe('recomputeAllHealthScores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps formula variable names to the right fields and writes healthScore + algorithmVersion', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      {
        id: 'row-1',
        ...baseStats,
        commits: 10,
        prsMerged: 3,
        linesAdded: 100,
        linesRemoved: 40,
        discordMessages: 20,
      },
    ] as never)

    await recomputeAllHealthScores('commits + prs * 2 + lines_changed / 10 + discord_messages')

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: {
        healthScore: 50,
        algorithmVersion: 'commits + prs * 2 + lines_changed / 10 + discord_messages',
        computedAt: expect.any(Date),
      },
    })
  })

  it('writes null healthScore/algorithmVersion for a row that evaluates to a non-finite result, and keeps processing other rows', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'zero-commits', ...baseStats, commits: 0 },
      { id: 'has-commits', ...baseStats, commits: 4 },
    ] as never)

    await recomputeAllHealthScores('1 / commits')

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'zero-commits' },
      data: { healthScore: null, algorithmVersion: null, computedAt: expect.any(Date) },
    })
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'has-commits' },
      data: { healthScore: 0.25, algorithmVersion: '1 / commits', computedAt: expect.any(Date) },
    })
  })

  it('writes null for every row without throwing when the formula fails to compile', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'row-1', ...baseStats, commits: 5 },
    ] as never)

    await expect(recomputeAllHealthScores('commits +* 2')).resolves.toBeUndefined()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { healthScore: null, algorithmVersion: null, computedAt: expect.any(Date) },
    })
  })

  it('continues processing remaining rows when writing one row fails', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'fails-to-write', ...baseStats, commits: 1 },
      { id: 'writes-fine', ...baseStats, commits: 2 },
    ] as never)
    vi.mocked(db.weeklyStats.update).mockImplementation(((args: { where: { id: string } }) => {
      if (args.where.id === 'fails-to-write') return Promise.reject(new Error('db down'))
      return Promise.resolve({})
    }) as unknown as typeof db.weeklyStats.update)

    await expect(recomputeAllHealthScores('commits')).resolves.toBeUndefined()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'writes-fine' },
      data: { healthScore: 2, algorithmVersion: 'commits', computedAt: expect.any(Date) },
    })
  })
})
