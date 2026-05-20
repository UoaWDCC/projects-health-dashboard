import { db } from '@repo/db'

export async function getProjectWeeklyMvp(slug: string) {
  const latest = await db.memberWeeklyContribution.findFirst({
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  if (!latest) return null

  const contributions = await db.memberWeeklyContribution.findMany({
    where: {
      weekStart: latest.weekStart,
      projectMember: { project: { slug } },
    },
    select: {
      linesAdded: true,
      commits: true,
      projectMember: {
        select: {
          displayName: true,
          person: { select: { displayName: true, imageUrl: true } },
        },
      },
    },
  })

  if (contributions.length === 0) return null

  return contributions.reduce((mvp, c) => {
    const displayName = c.projectMember.displayName ?? c.projectMember.person.displayName
    const mvpName = mvp.projectMember.displayName ?? mvp.projectMember.person.displayName
    if (
      c.linesAdded > mvp.linesAdded ||
      (c.linesAdded === mvp.linesAdded && c.commits > mvp.commits) ||
      (c.linesAdded === mvp.linesAdded && c.commits === mvp.commits && displayName < mvpName)
    ) {
      return c
    }
    return mvp
  })
}

export interface ProjectWeeklyStats {
  dates: string[]
  commits: number[]
  prs: number[]
  linesChanged: number[]
  discordMessages: number[]
}

export async function getProjectWeeklyStats(projectId: string): Promise<ProjectWeeklyStats> {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))

  const rows = await db.weeklyStats.findMany({
    where: {
      projectId,
      weekStart: { gte: yearStart },
    },
    orderBy: { weekStart: 'asc' },
    select: {
      weekStart: true,
      commits: true,
      prsMerged: true,
      linesAdded: true,
      linesRemoved: true,
      discordMessages: true,
    },
  })

  return {
    dates: rows.map((r) => r.weekStart.toISOString().split('T')[0]),
    commits: rows.map((r) => r.commits),
    prs: rows.map((r) => r.prsMerged),
    linesChanged: rows.map((r) => r.linesAdded + r.linesRemoved),
    discordMessages: rows.map((r) => r.discordMessages),
  }
}
