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

    it('sets velocityScore to null when there are no preceding weeks to compare against', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, 50)

      await computeVelocityForWeek(project.id, WEEK_START)

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.velocityScore).toBeNull()
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
