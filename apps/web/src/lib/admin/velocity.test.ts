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

  it('sets velocityScore to 0 for a project’s first non-zero scored week (no preceding weeks)', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'row-1', projectId: 'p1', weekStart: new Date('2026-05-04'), healthScore: 50 },
    ] as never)

    await recomputeAllVelocity()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { velocityScore: 0 },
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

  it('excludes a leading run of null and zero health weeks until the first non-zero week', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-06'), healthScore: null },
      { id: 'w2', projectId: 'p1', weekStart: new Date('2026-04-13'), healthScore: 0 },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-04-20'), healthScore: 0 },
      { id: 'w4', projectId: 'p1', weekStart: new Date('2026-04-27'), healthScore: 50 },
    ] as never)

    await recomputeAllVelocity()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { velocityScore: null },
    })
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w2' },
      data: { velocityScore: null },
    })
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w3' },
      data: { velocityScore: null },
    })
    // w4 is the first non-zero week: no preceding weeks count toward its baseline
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w4' },
      data: { velocityScore: 0 },
    })
  })

  it('builds up the rolling window gradually across the first four non-zero weeks', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-06'), healthScore: 50 },
      { id: 'w2', projectId: 'p1', weekStart: new Date('2026-04-13'), healthScore: 60 },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-04-20'), healthScore: 70 },
      { id: 'w4', projectId: 'p1', weekStart: new Date('2026-04-27'), healthScore: 80 },
      { id: 'w5', projectId: 'p1', weekStart: new Date('2026-05-04'), healthScore: 90 },
    ] as never)

    await recomputeAllVelocity()

    // w1: no preceding weeks
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { velocityScore: 0 },
    })
    // w2 baseline = avg(50) = 50; velocity = (60-50)/50*100 = 20
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w2' },
      data: { velocityScore: 20 },
    })
    // w3 baseline = avg(50, 60) = 55; velocity = (70-55)/55*100 ≈ 27.27
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w3' },
      data: { velocityScore: expect.closeTo(27.27, 1) },
    })
    // w4 baseline = avg(50, 60, 70) = 60; velocity = (80-60)/60*100 ≈ 33.33
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w4' },
      data: { velocityScore: expect.closeTo(33.33, 1) },
    })
    // w5 baseline = avg(50, 60, 70, 80) = 65 (full 4-week window); velocity = (90-65)/65*100 ≈ 38.46
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w5' },
      data: { velocityScore: expect.closeTo(38.46, 1) },
    })
  })

  it('treats a zero health week after the first non-zero week as a normal week in the rolling window', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-06'), healthScore: 0 },
      { id: 'w2', projectId: 'p1', weekStart: new Date('2026-04-13'), healthScore: 50 },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-04-20'), healthScore: 0 },
      { id: 'w4', projectId: 'p1', weekStart: new Date('2026-04-27'), healthScore: 60 },
    ] as never)

    await recomputeAllVelocity()

    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { velocityScore: null },
    })
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w2' },
      data: { velocityScore: 0 },
    })
    // w3 baseline = avg(50) = 50; velocity = (0-50)/50*100 = -100 — a real, included data point
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w3' },
      data: { velocityScore: -100 },
    })
    // w4 baseline = avg(50, 0) = 25; velocity = (60-25)/25*100 = 140
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { id: 'w4' },
      data: { velocityScore: 140 },
    })
  })

  it('sets velocity to null for every week of a project that never has a non-zero health score', async () => {
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { id: 'w1', projectId: 'p1', weekStart: new Date('2026-04-06'), healthScore: 0 },
      { id: 'w2', projectId: 'p1', weekStart: new Date('2026-04-13'), healthScore: 0 },
      { id: 'w3', projectId: 'p1', weekStart: new Date('2026-04-20'), healthScore: 0 },
    ] as never)

    await recomputeAllVelocity()

    for (const id of ['w1', 'w2', 'w3']) {
      expect(db.weeklyStats.update).toHaveBeenCalledWith({
        where: { id },
        data: { velocityScore: null },
      })
    }
  })
})
