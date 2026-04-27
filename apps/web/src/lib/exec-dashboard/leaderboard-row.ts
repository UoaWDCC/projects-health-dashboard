import { db } from '@repo/db'

export const formatStat = (value: number | string): string => {
  if (typeof value === 'string') return value
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return value.toString()
}

// Colour theme applied to a leaderboard section. fillColor is the rank-1 highlight
// background; borderColor is the accent border shown only on the first-place row.
export interface LeaderboardRowTheme {
  fillColor: string
  borderColor?: string
}

// One theme per leaderboard category, matched to the Figma spec.
export const LEADERBOARD_THEMES = {
  pink: { fillColor: '#E9CFFC', borderColor: '#E333A3' },
  blue: { fillColor: '#CFE0FD', borderColor: '#077CF1' },
  orange: { fillColor: '#FDE6CF', borderColor: '#FFAC33' },
} satisfies Record<string, LeaderboardRowTheme>

// Shape returned by every leaderboard query — maps directly onto LeaderboardRowData.
export interface LeaderboardEntry {
  rank: number
  projectId: string
  projectName: string
  thumbnailUrl: string | undefined
  statValue: number
}

// Returns the most recent weekStart present in WeeklyStats.
// All three leaderboard queries are scoped to this week so rankings are consistent.
async function getLatestWeekStart(): Promise<Date | null> {
  const latest = await db.weeklyStats.findFirst({
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  return latest?.weekStart ?? null
}

// Returns the top `limit` projects ranked by commit count for the latest week.
export async function getTopProjectsByCommits(limit = 5): Promise<LeaderboardEntry[]> {
  const weekStart = await getLatestWeekStart()
  if (!weekStart) return []

  const rows = await db.weeklyStats.findMany({
    where: { weekStart },
    orderBy: { commits: 'desc' },
    take: limit,
    select: {
      commits: true,
      project: { select: { id: true, name: true, imageUrl: true } },
    },
  })

  const result = rows.map((row, i) => ({
    rank: i + 1,
    projectId: row.project.id,
    projectName: row.project.name,
    thumbnailUrl: row.project.imageUrl ?? undefined,
    statValue: row.commits,
  }))
  return result
}

// Returns the top `limit` projects ranked by number of PRs merged for the latest week.
export async function getTopProjectsByPRsMerged(limit = 5): Promise<LeaderboardEntry[]> {
  const weekStart = await getLatestWeekStart()
  if (!weekStart) return []

  const rows = await db.weeklyStats.findMany({
    where: { weekStart },
    orderBy: { prsMerged: 'desc' },
    take: limit,
    select: {
      prsMerged: true,
      project: { select: { id: true, name: true, imageUrl: true } },
    },
  })

  const result = rows.map((row, i) => ({
    rank: i + 1,
    projectId: row.project.id,
    projectName: row.project.name,
    thumbnailUrl: row.project.imageUrl ?? undefined,
    statValue: row.prsMerged,
  }))
  return result
}

// Returns the top `limit` projects ranked by total lines changed (added + removed).
// Raw SQL is required because Prisma's orderBy does not support computed columns.
export async function getTopProjectsByLinesChanged(limit = 5): Promise<LeaderboardEntry[]> {
  const weekStart = await getLatestWeekStart()
  if (!weekStart) return []

  const rows = await db.$queryRaw<
    { projectId: string; name: string; imageUrl: string | null; linesChanged: bigint }[]
  >`
    SELECT ws."projectId", p.name, p."imageUrl",
           (ws."linesAdded" + ws."linesRemoved") AS "linesChanged"
    FROM "WeeklyStats" ws
    JOIN "Project" p ON p.id = ws."projectId"
    WHERE ws."weekStart" = ${weekStart}
    ORDER BY "linesChanged" DESC
    LIMIT ${limit}
  `

  const result = rows.map((row, i) => ({
    rank: i + 1,
    projectId: row.projectId,
    projectName: row.name,
    thumbnailUrl: row.imageUrl ?? undefined,
    statValue: Number(row.linesChanged), // $queryRaw returns bigint for SUM/arithmetic
  }))
  return result
}
