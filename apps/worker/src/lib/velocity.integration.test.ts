import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { computeVelocityForWeek, computeVelocityForActiveProjects } from './velocity'
import { seedProjectWithRepo } from '../test-config/integration.helpers'

const WEEK_START = new Date('2026-05-25T00:00:00Z')
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function weeksBefore(weekStart: Date, n: number): Date {
  return new Date(weekStart.getTime() - n * WEEK_MS)
}

async function seedWeeklyStats(projectId: string, weekStart: Date, healthScore: number | null) {
  return db.weeklyStats.create({
    data: { projectId, weekStart, healthScore },
  })
}

describe('velocity (integration)', () => {
  beforeEach(async () => {
    await db.weeklyStats.deleteMany()
    await db.project.deleteMany()
  })

  describe('computeVelocityForWeek', () => {
    it('does nothing when no WeeklyStats row exists yet for that week', async () => {
      const { project } = await seedProjectWithRepo()

      await expect(computeVelocityForWeek(project.id, WEEK_START)).resolves.toBeUndefined()

      const stats = await db.weeklyStats.findFirst({ where: { projectId: project.id } })
      expect(stats).toBeNull()
    })

    it('leaves velocityScore null when the current week has no health score yet', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, null)

      await computeVelocityForWeek(project.id, WEEK_START)

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBeNull()
    })

    it("clears a stale velocityScore when the current week's health score becomes null", async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 40)
      const current = await seedWeeklyStats(project.id, WEEK_START, 50)
      await db.weeklyStats.update({
        where: { id: current.id },
        data: { velocityScore: 25 },
      })
      await db.weeklyStats.update({
        where: { id: current.id },
        data: { healthScore: null },
      })

      await computeVelocityForWeek(project.id, WEEK_START)

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBeNull()
    })

    it('sets velocityScore to 0 for the first non-zero week when there are no preceding weeks', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, 50)

      await computeVelocityForWeek(project.id, WEEK_START)

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBe(0)
    })

    it('computes % difference against the average of up to 4 preceding weeks', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 4), 40)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 3), 60)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 2), 50)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 50)
      await seedWeeklyStats(project.id, WEEK_START, 60)

      await computeVelocityForWeek(project.id, WEEK_START)

      // baseline = avg(40, 60, 50, 50) = 50; velocity = (60 - 50) / 50 * 100 = 20
      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBe(20)
    })

    it('only uses the 4 most recent preceding weeks, ignoring older ones', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 5), 1000) // outside window
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 4), 100)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 3), 100)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 2), 100)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 100)
      await seedWeeklyStats(project.id, WEEK_START, 150)

      await computeVelocityForWeek(project.id, WEEK_START)

      // baseline = avg(100, 100, 100, 100) = 100; velocity = (150 - 100) / 100 * 100 = 50
      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBe(50)
    })

    it('partially calculates velocity when fewer than 4 preceding weeks of data exist', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 40)
      await seedWeeklyStats(project.id, WEEK_START, 50)

      await computeVelocityForWeek(project.id, WEEK_START)

      // baseline = avg(40) = 40; velocity = (50 - 40) / 40 * 100 = 25
      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBe(25)
    })

    it('skips preceding weeks with a null health score', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 2), null)
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 40)
      await seedWeeklyStats(project.id, WEEK_START, 50)

      await computeVelocityForWeek(project.id, WEEK_START)

      // baseline = avg(40) = 40 (null week excluded); velocity = (50 - 40) / 40 * 100 = 25
      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBe(25)
    })

    it('is idempotent and only touches velocityScore, leaving other fields untouched', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 40)
      await seedWeeklyStats(project.id, WEEK_START, 50)

      await computeVelocityForWeek(project.id, WEEK_START)
      await computeVelocityForWeek(project.id, WEEK_START)

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBe(25)
      expect(stats!.healthScore).toBe(50)

      const allRows = await db.weeklyStats.findMany({ where: { projectId: project.id } })
      expect(allRows).toHaveLength(2)
    })

    it('excludes a leading run of null and zero health weeks until the first non-zero week', async () => {
      const { project } = await seedProjectWithRepo()
      const weeks = [
        weeksBefore(WEEK_START, 3),
        weeksBefore(WEEK_START, 2),
        weeksBefore(WEEK_START, 1),
        WEEK_START,
      ]
      await seedWeeklyStats(project.id, weeks[0], null)
      await seedWeeklyStats(project.id, weeks[1], 0)
      await seedWeeklyStats(project.id, weeks[2], 0)
      await seedWeeklyStats(project.id, weeks[3], 50)

      for (const week of weeks) {
        await computeVelocityForWeek(project.id, week)
      }

      const rows = await db.weeklyStats.findMany({
        where: { projectId: project.id },
        orderBy: { weekStart: 'asc' },
      })
      // The null week and both zero weeks are all leading — none of them count
      // toward history. week[3] is the first real week: 0, not null.
      expect(rows.map((r) => r.velocityScore)).toEqual([null, null, null, 0])
    })

    it('builds up the rolling window gradually across the first four non-zero weeks', async () => {
      const { project } = await seedProjectWithRepo()
      const weeks = [
        weeksBefore(WEEK_START, 4),
        weeksBefore(WEEK_START, 3),
        weeksBefore(WEEK_START, 2),
        weeksBefore(WEEK_START, 1),
        WEEK_START,
      ]
      const scores = [50, 60, 70, 80, 90]
      for (const [i, week] of weeks.entries()) {
        await seedWeeklyStats(project.id, week, scores[i])
      }
      for (const week of weeks) {
        await computeVelocityForWeek(project.id, week)
      }

      const rows = await db.weeklyStats.findMany({
        where: { projectId: project.id },
        orderBy: { weekStart: 'asc' },
      })
      const velocities = rows.map((r) => r.velocityScore)

      expect(velocities[0]).toBe(0) // first week: no preceding weeks
      expect(velocities[1]).toBe(20) // baseline = avg(50) = 50
      expect(velocities[2]).toBeCloseTo(27.27, 1) // baseline = avg(50, 60) = 55
      expect(velocities[3]).toBeCloseTo(33.33, 1) // baseline = avg(50, 60, 70) = 60
      expect(velocities[4]).toBeCloseTo(38.46, 1) // baseline = avg(50, 60, 70, 80) = 65
    })

    it('treats a zero health week after the first non-zero week as a normal week in the rolling window', async () => {
      const { project } = await seedProjectWithRepo()
      const weeks = [
        weeksBefore(WEEK_START, 3),
        weeksBefore(WEEK_START, 2),
        weeksBefore(WEEK_START, 1),
        WEEK_START,
      ]
      const scores = [0, 50, 0, 60]
      for (const [i, week] of weeks.entries()) {
        await seedWeeklyStats(project.id, week, scores[i])
      }
      for (const week of weeks) {
        await computeVelocityForWeek(project.id, week)
      }

      const rows = await db.weeklyStats.findMany({
        where: { projectId: project.id },
        orderBy: { weekStart: 'asc' },
      })
      // week[0]=0 is leading (excluded); week[1]=50 is the first real week;
      // week[2]=0 is a real, included data point once tracking has started;
      // week[3] baseline = avg(50, 0) = 25 -> (60-25)/25*100 = 140
      expect(rows.map((r) => r.velocityScore)).toEqual([null, 0, -100, 140])
    })

    it('recognises a project has started even when the last 4 weeks are all a real quiet stretch', async () => {
      const { project } = await seedProjectWithRepo()
      const priorWeeks = [7, 6, 5, 4, 3, 2, 1].map((n) => weeksBefore(WEEK_START, n))
      const priorScores = [50, 60, 70, 0, 0, 0, 0]
      for (const [i, week] of priorWeeks.entries()) {
        await seedWeeklyStats(project.id, week, priorScores[i])
      }
      await seedWeeklyStats(project.id, WEEK_START, 80)

      for (const week of [...priorWeeks, WEEK_START]) {
        await computeVelocityForWeek(project.id, week)
      }

      // The 4 most recent preceding weeks (the rolling window) are all real
      // zeros, but the project genuinely started 3 real weeks before that —
      // further back than the window alone can see. baseline = avg(0,0,0,0) = 0,
      // so this must be null (can't divide by zero), not 0 — 0 would wrongly
      // claim this is the project's very first non-zero week, which it isn't.
      const current = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(current!.velocityScore).toBeNull()
    })

    it('sets velocity to null for every week of a project that never has a non-zero health score', async () => {
      const { project } = await seedProjectWithRepo()
      const weeks = [weeksBefore(WEEK_START, 2), weeksBefore(WEEK_START, 1), WEEK_START]
      for (const week of weeks) {
        await seedWeeklyStats(project.id, week, 0)
      }
      for (const week of weeks) {
        await computeVelocityForWeek(project.id, week)
      }

      const rows = await db.weeklyStats.findMany({ where: { projectId: project.id } })
      for (const row of rows) {
        expect(row.velocityScore).toBeNull()
      }
    })
  })

  describe('computeVelocityForActiveProjects', () => {
    it('computes velocity for multiple active projects independently', async () => {
      const { project: projectA } = await seedProjectWithRepo()
      const { project: projectB } = await seedProjectWithRepo()

      await seedWeeklyStats(projectA.id, weeksBefore(WEEK_START, 1), 40)
      await seedWeeklyStats(projectA.id, WEEK_START, 60)
      await seedWeeklyStats(projectB.id, weeksBefore(WEEK_START, 1), 100)
      await seedWeeklyStats(projectB.id, WEEK_START, 80)

      await computeVelocityForActiveProjects([WEEK_START])

      const statsA = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: projectA.id, weekStart: WEEK_START } },
      })
      const statsB = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: projectB.id, weekStart: WEEK_START } },
      })

      expect(statsA!.velocityScore).toBe(50) // (60-40)/40*100
      expect(statsB!.velocityScore).toBe(-20) // (80-100)/100*100
    })

    it('does not compute velocity for inactive projects', async () => {
      const { project } = await seedProjectWithRepo()
      await db.project.update({ where: { id: project.id }, data: { isActive: false } })
      await seedWeeklyStats(project.id, weeksBefore(WEEK_START, 1), 40)
      await seedWeeklyStats(project.id, WEEK_START, 60)

      await computeVelocityForActiveProjects([WEEK_START])

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBeNull()
    })
  })
})
