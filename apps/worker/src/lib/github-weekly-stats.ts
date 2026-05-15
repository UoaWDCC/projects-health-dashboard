// Computes weekly GitHub metrics for a single project and stores them in the database.

import { db } from '@repo/db'
import { logger } from '../lib/logger'

type ProjectInput = { id: string; repositories: { id: string }[] }

export async function computeWeeklyGitHubMetrics(
  project: ProjectInput,
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  logger.info(`Starting weekly metrics computation for week starting ${weekStart.toISOString()}`)

  const repoIds = project.repositories.map((repository) => repository.id)

  if (repoIds.length === 0) {
    return
  }

  const [commitFacts, mergedPrFacts, discordCounts] = await Promise.all([
    db.commitFact.findMany({
      where: {
        repoId: { in: repoIds },
        committedAt: { gte: weekStart, lte: weekEnd },
        branch: { notIn: ['main', 'master'], not: null },
      },
      select: {
        authorIdentityId: true,
        linesAdded: true,
        linesRemoved: true,
      },
    }),
    db.pRFact.findMany({
      where: {
        repoId: { in: repoIds },
        mergedAt: { gte: weekStart, lte: weekEnd },
      },
      select: {
        authorIdentityId: true,
      },
    }),
    db.discordIdentityWeeklyCount.findMany({
      where: { projectId: project.id, weekStart },
      select: { authorIdentityId: true, messageCount: true },
    }),
  ])

  const commits = commitFacts.length
  const prsMerged = mergedPrFacts.length
  let linesAdded = 0
  let linesRemoved = 0
  for (const commit of commitFacts) {
    linesAdded += commit.linesAdded
    linesRemoved += commit.linesRemoved
  }

  logger.info(
    `Project ${project.id}: fetched ${commits} commits and ${prsMerged} merged PRs; linesAdded=${linesAdded}, linesRemoved=${linesRemoved}`
  )

  const identityIds = new Set<string>()
  for (const commitFact of commitFacts) {
    if (commitFact.authorIdentityId) identityIds.add(commitFact.authorIdentityId)
  }
  for (const mergedPrFact of mergedPrFacts) {
    if (mergedPrFact.authorIdentityId) identityIds.add(mergedPrFact.authorIdentityId)
  }
  for (const discordCount of discordCounts) {
    identityIds.add(discordCount.authorIdentityId)
  }

  const personIdentities = identityIds.size
    ? await db.personIdentity.findMany({
        where: { id: { in: Array.from(identityIds) } },
        select: { id: true, personId: true },
      })
    : []

  const identityToPersonId = new Map(
    personIdentities.map((identity) => [identity.id, identity.personId])
  )
  const personIds = Array.from(new Set(personIdentities.map((identity) => identity.personId)))
  const projectMembers = personIds.length
    ? await db.projectMember.findMany({
        where: { projectId: project.id, personId: { in: personIds } },
        select: { id: true, personId: true },
      })
    : []

  const personToProjectMember = new Map(
    projectMembers.map((projectMember) => [projectMember.personId, projectMember.id])
  )

  const memberContrib = new Map<
    string,
    {
      projectMemberId: string
      personId: string
      commits: number
      prsMerged: number
      linesAdded: number
      linesRemoved: number
      discordMessages: number
    }
  >()

  for (const commitFact of commitFacts) {
    if (!commitFact.authorIdentityId) continue
    const personId = identityToPersonId.get(commitFact.authorIdentityId)
    if (!personId) continue
    const projectMemberId = personToProjectMember.get(personId)
    if (!projectMemberId) continue

    const current = memberContrib.get(projectMemberId) ?? {
      projectMemberId,
      personId,
      commits: 0,
      prsMerged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      discordMessages: 0,
    }

    current.commits += 1
    current.linesAdded += commitFact.linesAdded
    current.linesRemoved += commitFact.linesRemoved
    memberContrib.set(projectMemberId, current)
  }

  for (const mergedPrFact of mergedPrFacts) {
    if (!mergedPrFact.authorIdentityId) continue
    const personId = identityToPersonId.get(mergedPrFact.authorIdentityId)
    if (!personId) continue
    const projectMemberId = personToProjectMember.get(personId)
    if (!projectMemberId) continue

    const current = memberContrib.get(projectMemberId) ?? {
      projectMemberId,
      personId,
      commits: 0,
      prsMerged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      discordMessages: 0,
    }

    current.prsMerged += 1
    memberContrib.set(projectMemberId, current)
  }

  for (const discordCount of discordCounts) {
    const personId = identityToPersonId.get(discordCount.authorIdentityId)
    if (!personId) continue
    const projectMemberId = personToProjectMember.get(personId)
    if (!projectMemberId) continue

    const current = memberContrib.get(projectMemberId) ?? {
      projectMemberId,
      personId,
      commits: 0,
      prsMerged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      discordMessages: 0,
    }

    current.discordMessages += discordCount.messageCount
    memberContrib.set(projectMemberId, current)
  }

  let mvpMemberId: string | null = null
  let mvpLinesChanged = -1
  let mvpCommits = -1

  for (const contrib of memberContrib.values()) {
    const linesChanged = contrib.linesAdded + contrib.linesRemoved
    if (
      linesChanged > mvpLinesChanged ||
      (linesChanged === mvpLinesChanged && contrib.commits > mvpCommits) ||
      (linesChanged === mvpLinesChanged &&
        contrib.commits === mvpCommits &&
        (mvpMemberId === null || contrib.projectMemberId < mvpMemberId))
    ) {
      mvpMemberId = contrib.projectMemberId
      mvpLinesChanged = linesChanged
      mvpCommits = contrib.commits
    }
  }

  logger.info(
    `Project ${project.id}: adding weeklyStats and ${memberContrib.size} member contributions`
  )
  try {
    await db.$transaction(async (tx) => {
      await tx.weeklyStats.upsert({
        where: {
          projectId_weekStart: {
            projectId: project.id,
            weekStart,
          },
        },
        create: {
          projectId: project.id,
          weekStart,
          commits,
          prsMerged,
          linesAdded,
          linesRemoved,
          mvpMemberId,
          computedAt: new Date(),
        },
        update: {
          commits,
          prsMerged,
          linesAdded,
          linesRemoved,
          mvpMemberId,
          computedAt: new Date(),
        },
      })

      for (const contrib of memberContrib.values()) {
        await tx.memberWeeklyContribution.upsert({
          where: {
            projectMemberId_weekStart: {
              projectMemberId: contrib.projectMemberId,
              weekStart,
            },
          },
          create: {
            projectMemberId: contrib.projectMemberId,
            personId: contrib.personId,
            weekStart,
            commits: contrib.commits,
            prsMerged: contrib.prsMerged,
            linesAdded: contrib.linesAdded,
            linesRemoved: contrib.linesRemoved,
            discordMessages: contrib.discordMessages,
          },
          update: {
            commits: contrib.commits,
            prsMerged: contrib.prsMerged,
            linesAdded: contrib.linesAdded,
            linesRemoved: contrib.linesRemoved,
            discordMessages: contrib.discordMessages,
          },
        })
      }
    })
    logger.info(`Project ${project.id}: successfully added weekly stats and member contributions`)
  } catch (err) {
    logger.error(`Project ${project.id}: failed to added weekly metrics: ${err}`)
    throw err
  }
}
