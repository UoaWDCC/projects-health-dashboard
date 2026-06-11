import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { computeWeeklyGitHubMetrics } from './github-weekly-stats'
import { randomUUID } from 'node:crypto'
import {
  seedProjectWithRepo,
  seedPersonWithIdentity,
  seedProjectMember,
  seedCommitFact,
  seedPRFact,
} from '../test-config/integration.helpers'

async function seedProjectWithoutRepo() {
  const token = randomUUID().replace(/-/g, '').slice(0, 8)
  return db.project.create({
    data: {
      name: `No-Repo Project ${token}`,
      slug: `no-repo-${token}`,
      description: 'Project with no repositories',
    },
  })
}

const WEEK_START = new Date('2026-05-04T00:00:00Z')
const WEEK_END = new Date('2026-05-10T23:59:59Z')

describe('computeWeeklyGitHubMetrics (integration)', () => {
  beforeEach(async () => {
    await db.memberWeeklyContribution.deleteMany()
    await db.weeklyStats.deleteMany()
    await db.discordIdentityWeeklyCount.deleteMany()
    await db.commitFact.deleteMany()
    await db.pRFact.deleteMany()
    await db.projectMember.deleteMany()
    await db.personIdentity.deleteMany()
    await db.person.deleteMany()
    await db.gitHubRepository.deleteMany()
    await db.project.deleteMany()
  })

  it('aggregates commit and PR counts correctly across multiple repositories in a single project', async () => {
    const { project, repo: repo1 } = await seedProjectWithRepo()
    const { repo: repo2 } = await seedProjectWithRepo()
    const { person, identity } = await seedPersonWithIdentity('multi-repo-dev')
    await seedProjectMember(project.id, person.id)

    await seedCommitFact(repo1.id, identity.id, { sha: 'r1c1', branch: 'main' })
    await seedCommitFact(repo1.id, identity.id, { sha: 'r1c2', branch: 'master' })
    await seedCommitFact(repo1.id, identity.id, { sha: 'r1c3', branch: null })
    await seedCommitFact(repo2.id, identity.id, { sha: 'r1c4' })
    await seedPRFact(repo1.id, identity.id, { number: 1 })

    await seedCommitFact(repo2.id, identity.id, { sha: 'r2c1', branch: 'main' })
    await seedCommitFact(repo2.id, identity.id, { sha: 'r2c2', branch: 'master' })
    await seedCommitFact(repo2.id, identity.id, { sha: 'r2c3', branch: null })
    await seedCommitFact(repo2.id, identity.id, { sha: 'r2c4' })
    await seedPRFact(repo2.id, identity.id, { number: 100 })
    await seedPRFact(repo2.id, identity.id, { number: 101 })

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo1.id }, { id: repo2.id }] },
      WEEK_START,
      WEEK_END
    )

    const stats = await db.weeklyStats.findUnique({
      where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
    })

    if (!stats) throw new Error('Expected weekly stats to exist')
    expect(stats.commits).toBe(2)
    expect(stats.prsMerged).toBe(3)
  })

  it('only counts commits and PRs within the week window', async () => {
    const { project, repo } = await seedProjectWithRepo()
    const { person, identity } = await seedPersonWithIdentity('dev-window')
    await seedProjectMember(project.id, person.id)

    await seedCommitFact(repo.id, identity.id, {
      sha: 'in-window',
      committedAt: new Date('2026-05-06T12:00:00Z'),
    })
    await seedCommitFact(repo.id, identity.id, {
      sha: 'before-window',
      committedAt: new Date('2026-05-03T23:59:59Z'),
    })
    await seedPRFact(repo.id, identity.id, {
      number: 10,
      mergedAt: new Date('2026-05-08T10:00:00Z'),
    })
    await seedPRFact(repo.id, identity.id, {
      number: 11,
      mergedAt: new Date('2026-05-11T00:00:00Z'),
    })

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo.id }] },
      WEEK_START,
      WEEK_END
    )

    const stats = await db.weeklyStats.findUnique({
      where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
    })

    expect(stats!.commits).toBe(1)
    expect(stats!.prsMerged).toBe(1)
  })

  it('sums lines added and removed across all commits', async () => {
    const { project, repo } = await seedProjectWithRepo()
    const { person, identity } = await seedPersonWithIdentity('lines-dev')
    await seedProjectMember(project.id, person.id)

    await seedCommitFact(repo.id, identity.id, { sha: 'l1', linesAdded: 50, linesRemoved: 10 })
    await seedCommitFact(repo.id, identity.id, { sha: 'l2', linesAdded: 30, linesRemoved: 20 })
    await seedCommitFact(repo.id, identity.id, { sha: 'l3', linesAdded: 100, linesRemoved: 5 })

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo.id }] },
      WEEK_START,
      WEEK_END
    )

    const stats = await db.weeklyStats.findUnique({
      where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
    })

    expect(stats!.linesAdded).toBe(180)
    expect(stats!.linesRemoved).toBe(35)
  })

  it('maps contributor commits and PRs to the correct project member', async () => {
    const { project, repo } = await seedProjectWithRepo()

    const { person: personA, identity: identityA } = await seedPersonWithIdentity('alice')
    const { person: personB, identity: identityB } = await seedPersonWithIdentity('bob')

    const memberA = await seedProjectMember(project.id, personA.id)
    const memberB = await seedProjectMember(project.id, personB.id)

    await seedCommitFact(repo.id, identityA.id, { sha: 'a1', linesAdded: 40, linesRemoved: 5 })
    await seedCommitFact(repo.id, identityA.id, { sha: 'a2', linesAdded: 40, linesRemoved: 5 })
    await seedPRFact(repo.id, identityA.id, { number: 100 })

    await seedCommitFact(repo.id, identityB.id, { sha: 'b1', linesAdded: 20, linesRemoved: 2 })

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo.id }] },
      WEEK_START,
      WEEK_END
    )

    const contribA = await db.memberWeeklyContribution.findUnique({
      where: {
        projectMemberId_weekStart: { projectMemberId: memberA.id, weekStart: WEEK_START },
      },
    })
    const contribB = await db.memberWeeklyContribution.findUnique({
      where: {
        projectMemberId_weekStart: { projectMemberId: memberB.id, weekStart: WEEK_START },
      },
    })

    expect(contribA).not.toBeNull()
    expect(contribA!.commits).toBe(2)
    expect(contribA!.prsMerged).toBe(1)
    expect(contribA!.linesAdded).toBe(80)
    expect(contribA!.linesRemoved).toBe(10)

    expect(contribB).not.toBeNull()
    expect(contribB!.commits).toBe(1)
    expect(contribB!.prsMerged).toBe(0)
    expect(contribB!.linesAdded).toBe(20)
    expect(contribB!.linesRemoved).toBe(2)
  })

  it('does not create a contribution row for an identity with no matching project member', async () => {
    const { project, repo } = await seedProjectWithRepo()

    const { identity: outsiderIdentity } = await seedPersonWithIdentity('outsider')

    await seedCommitFact(repo.id, outsiderIdentity.id, { sha: 'out1', linesAdded: 10 })
    await seedCommitFact(repo.id, null, { sha: 'out2', linesAdded: 10 })

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo.id }] },
      WEEK_START,
      WEEK_END
    )

    const stats = await db.weeklyStats.findUnique({
      where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
    })

    const contribs = await db.memberWeeklyContribution.findMany({
      where: { weekStart: WEEK_START },
    })

    expect(contribs).toHaveLength(0)

    if (!stats) throw new Error('Expected weekly stats to exist')
    expect(stats.linesAdded).toBe(20)
  })

  it('skips computation without error when project has no repositories', async () => {
    const project = await seedProjectWithoutRepo()

    await expect(
      computeWeeklyGitHubMetrics({ id: project.id, repositories: [] }, WEEK_START, WEEK_END)
    ).resolves.toBeUndefined()

    const stats = await db.weeklyStats.findFirst({
      where: { projectId: project.id },
    })
    expect(stats).toBeNull()
  })

  it('upserts WeeklyStats without error when called twice for the same week', async () => {
    const { project, repo } = await seedProjectWithRepo()
    const { person, identity } = await seedPersonWithIdentity('upsert-dev')
    await seedProjectMember(project.id, person.id)

    await seedCommitFact(repo.id, identity.id, { sha: 'u1', linesAdded: 10 })

    const input = { id: project.id, repositories: [{ id: repo.id }] }

    await computeWeeklyGitHubMetrics(input, WEEK_START, WEEK_END)
    await expect(computeWeeklyGitHubMetrics(input, WEEK_START, WEEK_END)).resolves.not.toThrow()

    const statsCount = await db.weeklyStats.count({
      where: { projectId: project.id, weekStart: WEEK_START },
    })
    expect(statsCount).toBe(1)
  })

  it('upserts MemberWeeklyContribution without error when called twice for the same week', async () => {
    const { project, repo } = await seedProjectWithRepo()
    const { person, identity } = await seedPersonWithIdentity('contrib-upsert-dev')
    const member = await seedProjectMember(project.id, person.id)

    await seedCommitFact(repo.id, identity.id, { sha: 'cu1', linesAdded: 5 })

    const input = { id: project.id, repositories: [{ id: repo.id }] }

    await computeWeeklyGitHubMetrics(input, WEEK_START, WEEK_END)
    await expect(computeWeeklyGitHubMetrics(input, WEEK_START, WEEK_END)).resolves.not.toThrow()

    const contribs = await db.memberWeeklyContribution.findMany({
      where: { projectMemberId: member.id, weekStart: WEEK_START },
    })
    expect(contribs).toHaveLength(1)
  })

  it('selects the correct member as MVP based on tie-breaker hierarchy', async () => {
    const { project, repo } = await seedProjectWithRepo()

    const { person: personMvp, identity: identityMvp } = await seedPersonWithIdentity('dev-mvp')
    const { person: personOther, identity: identityOther } =
      await seedPersonWithIdentity('dev-other')

    const memberMvp = await seedProjectMember(project.id, personMvp.id)
    await seedProjectMember(project.id, personOther.id)

    await seedCommitFact(repo.id, identityMvp.id, {
      sha: 'm1',
      linesAdded: 60,
      linesRemoved: 40,
    })
    await seedCommitFact(repo.id, identityMvp.id, {
      sha: 'm2',
      linesAdded: 0,
      linesRemoved: 0,
    })
    await seedCommitFact(repo.id, identityOther.id, {
      sha: 'm3',
      linesAdded: 60,
      linesRemoved: 40,
    })

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo.id }] },
      WEEK_START,
      WEEK_END
    )

    const stats = await db.weeklyStats.findUnique({
      where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
    })

    expect(stats!.mvpMemberId).toBe(memberMvp.id)
  })

  it('sets mvpMemberId to null when there are no contributors', async () => {
    const { project, repo } = await seedProjectWithRepo()

    await computeWeeklyGitHubMetrics(
      { id: project.id, repositories: [{ id: repo.id }] },
      WEEK_START,
      WEEK_END
    )

    const stats = await db.weeklyStats.findUnique({
      where: { projectId_weekStart: { projectId: project.id, weekStart: WEEK_START } },
    })

    expect(stats!.mvpMemberId).toBeNull()
  })
})
