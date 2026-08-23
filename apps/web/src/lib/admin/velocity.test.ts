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
import { recomputeAllVelocity } from './velocity'

describe('recomputeAllVelocity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets velocityScore to null for a project’s first scored week (no preceding weeks)', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'row-1', projectId: 'p1', weekStart: new Date('2026-05-04'), healthScore: 50 },
    ] as never)

    await recomputeAllVelocity()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { velocityScore: null },
    })
  })

  it('computes % difference against the rolling average of up to 4 preceding weeks, in weekStart order', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-06'), healthScore: 40 },
      { id: 'w2', projectId: 'p1', weekStart: new Date('2026-04-13'), healthScore: 60 },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-04-20'), healthScore: 50 },
      { id: 'w4', projectId: 'p1', weekStart: new Date('2026-04-27'), healthScore: 50 },
      { id: 'w5', projectId: 'p1', weekStart: new Date('2026-05-04'), healthScore: 60 },
    ] as never)

    await recomputeAllVelocity()

    // w5 baseline = avg(40, 60, 50, 50) = 50; velocity = (60-50)/50*100 = 20
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w5' },
      data: { velocityScore: 20 },
    })
  })

  it('keeps each project’s rolling window independent', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'a1', projectId: 'A', weekStart: new Date('2026-04-27'), healthScore: 40 },
      { id: 'a2', projectId: 'A', weekStart: new Date('2026-05-04'), healthScore: 60 },
      { id: 'b1', projectId: 'B', weekStart: new Date('2026-04-27'), healthScore: 100 },
      { id: 'b2', projectId: 'B', weekStart: new Date('2026-05-04'), healthScore: 80 },
    ] as never)

    await recomputeAllVelocity()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'a2' },
      data: { velocityScore: 50 }, // (60-40)/40*100
    })
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'b2' },
      data: { velocityScore: -20 }, // (80-100)/100*100
    })
  })

  it('sets velocityScore to null for weeks with no health score, without breaking the rolling window for later weeks', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-27'), healthScore: 40 },
      { id: 'w2', projectId: 'p1', weekStart: new Date('2026-05-04'), healthScore: null },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-05-11'), healthScore: 60 },
    ] as never)

    await recomputeAllVelocity()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w2' },
      data: { velocityScore: null },
    })
    // w3 baseline should still be avg(40) = 40, skipping the null week
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w3' },
      data: { velocityScore: 50 },
    })
  })

  it('continues processing remaining rows when writing one row fails', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-27'), healthScore: 40 },
      { id: 'fails-to-write', projectId: 'p1', weekStart: new Date('2026-05-04'), healthScore: 50 },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-05-11'), healthScore: 60 },
    ] as never)
    vi.mocked(db.weeklyStats.update).mockImplementation(((args: { where: { id: string } }) => {
      if (args.where.id === 'fails-to-write') return Promise.reject(new Error('db down'))
      return Promise.resolve({})
    }) as unknown as typeof db.weeklyStats.update)

    await expect(recomputeAllVelocity()).resolves.toBeUndefined()

    // w3 baseline should still include the failed row's healthScore (40, 50) = 45
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w3' },
      data: { velocityScore: expect.closeTo(33.33, 1) },
    })
  })
})
