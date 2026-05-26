import { db } from '@repo/db'
import { NextResponse } from 'next/server'

interface LeaderboardEntry {
  rank: number
  projectId: string
  projectName: string
  thumbnailUrl: string | undefined
  statValue: number
}

export async function GET() {
  try {
    const latest = await db.weeklyStats.findFirst({
      orderBy: { weekStart: 'desc' },
      select: { weekStart: true },
    })

    if (!latest) {
      return NextResponse.json({ 'lines-of-code': [], merges: [], commits: [] })
    }

    const weeklyStats = await db.weeklyStats.findMany({
      select: {
        projectId: true,
        linesAdded: true,
        linesRemoved: true,
        prsMerged: true,
        commits: true,
      },
      where: { weekStart: latest.weekStart },
    })

    const linesOfCodeMap: Record<string, number> = {}
    weeklyStats.forEach((entry) => {
      linesOfCodeMap[entry.projectId] =
        (linesOfCodeMap[entry.projectId] || 0) + entry.linesAdded + entry.linesRemoved
    })

    const linesOfCode = Object.entries(linesOfCodeMap)
      .map(([projectId, value]) => ({ projectId, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const mergesMap: Record<string, number> = {}
    weeklyStats.forEach((entry) => {
      mergesMap[entry.projectId] = (mergesMap[entry.projectId] || 0) + entry.prsMerged
    })

    const merges = Object.entries(mergesMap)
      .map(([projectId, value]) => ({ projectId, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const commitsMap: Record<string, number> = {}
    weeklyStats.forEach((entry) => {
      commitsMap[entry.projectId] = (commitsMap[entry.projectId] || 0) + entry.commits
    })

    const commits = Object.entries(commitsMap)
      .map(([projectId, value]) => ({ projectId, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const allProjectIds = new Set([
      ...linesOfCode.map((e) => e.projectId),
      ...merges.map((e) => e.projectId),
      ...commits.map((e) => e.projectId),
    ])

    const projects = await db.project.findMany({
      where: {
        id: {
          in: Array.from(allProjectIds),
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
    })

    const projectMap = new Map(projects.map((p) => [p.id, p]))

    const mapToLeaderboard = (
      entries: { projectId: string; value: number }[]
    ): LeaderboardEntry[] =>
      entries.map((entry, index) => {
        const project = projectMap.get(entry.projectId)
        return {
          rank: index + 1,
          projectId: entry.projectId,
          projectName: project?.name || 'Unknown Project',
          thumbnailUrl: project?.imageUrl || undefined,
          statValue: entry.value,
        }
      })

    return NextResponse.json({
      'lines-of-code': mapToLeaderboard(linesOfCode),
      merges: mapToLeaderboard(merges),
      commits: mapToLeaderboard(commits),
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 })
  }
}
