import { describe, it, expect } from 'vitest'
import { buildVelocitySeries } from './index'

function series(healthScores: (number | null)[]) {
  return buildVelocitySeries(healthScores.map((healthScore) => ({ healthScore })))
}

describe('buildVelocitySeries', () => {
  it('returns 0 for a first non-zero week with no preceding weeks', () => {
    expect(series([50])).toEqual([0])
  })

  it('computes % difference against the rolling average of up to 4 preceding weeks', () => {
    // w5 baseline = avg(40,60,50,50) = 50; velocity = (60-50)/50*100 = 20
    expect(series([40, 60, 50, 50, 60])).toEqual([0, 50, 0, 0, 20])
  })

  it('builds up the rolling window gradually across the first four non-zero weeks', () => {
    const result = series([50, 60, 70, 80, 90])
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(20)
    expect(result[2]).toBeCloseTo(27.27, 1)
    expect(result[3]).toBeCloseTo(33.33, 1)
    expect(result[4]).toBeCloseTo(38.46, 1)
  })

  it('only uses the 4 most recent preceding weeks, ignoring older ones', () => {
    const result = series([1000, 100, 100, 100, 100, 150])
    expect(result[5]).toBe(50) // baseline = avg(100,100,100,100) = 100
  })

  it('propagates null for weeks with no health score, without breaking the window', () => {
    expect(series([40, null, 60])).toEqual([0, null, 50])
  })

  it('excludes a leading run of null and zero health weeks until the first non-zero week', () => {
    expect(series([null, 0, 0, 50])).toEqual([null, null, null, 0])
  })

  it('treats a zero health week after the first non-zero week as a normal week in the window', () => {
    // week[0]=0 is leading (excluded); week[1]=50 is the first real week;
    // week[2]=0 is a real, included data point once tracking has started.
    expect(series([0, 50, 0, 60])).toEqual([null, 0, -100, 140])
  })

  it('returns null (not 0) when a later baseline happens to average to zero, even after the project has started', () => {
    // The 4 most recent weeks are all real zeros, but the project genuinely
    // started 3 weeks before that — further back than the window alone can
    // see. baseline = avg(0,0,0,0) = 0, so this must be null (can't divide by
    // zero), not 0 — 0 would wrongly claim this is the project's first
    // non-zero week, which it isn't.
    expect(series([50, 60, 70, 0, 0, 0, 0, 80])).toEqual([
      0,
      20,
      expect.closeTo(27.27, 1),
      -100,
      -100,
      -100,
      -100,
      null,
    ])
  })

  it('returns null for every week of a project that never has a non-zero health score', () => {
    expect(series([0, 0, 0])).toEqual([null, null, null])
  })

  it('returns an empty array for no weeks', () => {
    expect(series([])).toEqual([])
  })
})
