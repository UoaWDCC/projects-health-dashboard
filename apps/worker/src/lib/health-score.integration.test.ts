import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { computeHealthScoreForWeek, computeHealthScoresForActiveProjects } from './health-score'
import { seedProjectWithRepo } from '../test-config/integration.helpers'

const WEEK_START = new Date('2026-05-04T00:00:00Z')

const GLOBAL_SCOPE = 'GLOBAL'
const HEALTH_FORMULA_KEY = 'healthFormula'

async function seedHealthFormula(formula: string) {
  return db.config.upsert({
    where: { scope_key: { scope: GLOBAL_SCOPE, key: HEALTH_FORMULA_KEY } },
    update: { value: formula },
    create: { scope: GLOBAL_SCOPE, projectId: null, key: HEALTH_FORMULA_KEY, value: formula },
  })
}

async function seedWeeklyStats(
  projectId: string,
  weekStart: Date,
  counts: {
    commits?: number
    prsMerged?: number
    linesAdded?: number
    linesRemoved?: number
    discordMessages?: number
  } = {}
) {
  return db.weeklyStats.create({
    data: {
      projectId,
      weekStart,
      commits: counts.commits ?? 0,
      prsMerged: counts.prsMerged ?? 0,
      linesAdded: counts.linesAdded ?? 0,
      linesRemoved: counts.linesRemoved ?? 0,
      discordMessages: counts.discordMessages ?? 0,
    },
  })
}

describe('health-score (integration)', () => {
  beforeEach(async () => {
    await db.weeklyStats.deleteMany()
    await db.config.deleteMany()
    await db.project.deleteMany()
  })

  describe('computeHealthScoreForWeek', () => {
    it('does nothing when no formula is configured', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, { commits: 5 })

      await computeHealthScoreForWeek(project.id, WEEK_START, null)

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.healthScore).toBeNull()
    })

    it('does nothing when no WeeklyStats row exists yet for that week', async () => {
      const { project } = await seedProjectWithRepo()

      await expect(
        computeHealthScoreForWeek(project.id, WEEK_START, 'commits * 2')
      ).resolves.toBeUndefined()

      const stats = await db.weeklyStats.findFirst({ where: { projectId: project.id } })
      expect(stats).toBeNull()
    })

    it('evaluates the formula against real weekly data and maps formula variable names correctly', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, {
        commits: 10,
        prsMerged: 3,
        linesAdded: 100,
        linesRemoved: 40,
        discordMessages: 20,
      })

      // prs -> prsMerged, lines_changed -> linesAdded + linesRemoved, discord_messages -> discordMessages
      await computeHealthScoreForWeek(
        project.id,
        WEEK_START,
        'commits + prs * 2 + lines_changed / 10 + discord_messages'
      )

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      // 10 + 3*2 + (100+40)/10 + 20 = 10 + 6 + 14 + 20 = 50
      expect(stats!.healthScore).toBe(50)
      expect(stats!.algorithmVersion).toBe(
        'commits + prs * 2 + lines_changed / 10 + discord_messages'
      )
    })

    it('sets healthScore to null without throwing when the formula fails to compile', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, { commits: 5 })

      await expect(
        computeHealthScoreForWeek(project.id, WEEK_START, 'commits +* 2')
      ).resolves.toBeUndefined()

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.healthScore).toBeNull()
      expect(stats!.algorithmVersion).toBeNull()
    })

    it('sets healthScore to null without throwing when the formula evaluates to a non-finite result', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, { commits: 0 })

      await expect(
        computeHealthScoreForWeek(project.id, WEEK_START, '1 / commits')
      ).resolves.toBeUndefined()

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.healthScore).toBeNull()
    })

    it('is idempotent and only touches healthScore/algorithmVersion, leaving raw counts untouched', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, { commits: 4, prsMerged: 1 })

      await computeHealthScoreForWeek(project.id, WEEK_START, 'commits + prs')
      await computeHealthScoreForWeek(project.id, WEEK_START, 'commits + prs')

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.healthScore).toBe(5)
      expect(stats!.commits).toBe(4)
      expect(stats!.prsMerged).toBe(1)
    })
  })

  describe('computeHealthScoresForActiveProjects', () => {
    it('skips all projects when no formula is configured', async () => {
      const { project } = await seedProjectWithRepo()
      await seedWeeklyStats(project.id, WEEK_START, { commits: 5 })

      await computeHealthScoresForActiveProjects([WEEK_START])

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.healthScore).toBeNull()
    })

    it('scores multiple active projects independently across multiple weeks', async () => {
      await seedHealthFormula('commits')
      const { project: projectA } = await seedProjectWithRepo()
      const { project: projectB } = await seedProjectWithRepo()

      const prevWeek = new Date('2026-04-27T00:00:00Z')
      await seedWeeklyStats(projectA.id, prevWeek, { commits: 3 })
      await seedWeeklyStats(projectA.id, WEEK_START, { commits: 7 })
      await seedWeeklyStats(projectB.id, WEEK_START, { commits: 2 })

      await computeHealthScoresForActiveProjects([prevWeek, WEEK_START])

      const statsAPrev = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: projectA.id, weekStart: prevWeek } },
      })
      const statsACurrent = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: projectA.id, weekStart: WEEK_START } },
      })
      const statsB = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: projectB.id, weekStart: WEEK_START } },
      })

      expect(statsAPrev!.healthScore).toBe(3)
      expect(statsACurrent!.healthScore).toBe(7)
      expect(statsB!.healthScore).toBe(2)
    })

    it('does not score inactive projects', async () => {
      await seedHealthFormula('commits')
      const { project } = await seedProjectWithRepo()
      await db.project.update({ where: { id: project.id }, data: { isActive: false } })
      await seedWeeklyStats(project.id, WEEK_START, { commits: 9 })

      await computeHealthScoresForActiveProjects([WEEK_START])

      const stats = await db.weeklyStats.findUnique({
        where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
      })
      expect(stats!.healthScore).toBeNull()
    })
  })
})
