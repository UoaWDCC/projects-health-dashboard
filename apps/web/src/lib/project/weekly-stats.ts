import { db } from '@repo/db'

export interface ProjectWeeklyStats {
  dates: string[]
  commits: number[]
  prs: number[]
  linesChanged: number[]
  discordMessages: number[]
}

export async function getProjectWeeklyStats(projectId: string): Promise<ProjectWeeklyStats> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1)

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
