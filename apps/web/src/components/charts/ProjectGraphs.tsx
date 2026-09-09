'use client'

import { useEffect, useState } from 'react'
import LineGraph from '@/components/charts/LineGraph'
import type { ProjectWeeklyStats } from '@/lib/project/weekly-stats'

export default function ProjectGraphs({
  slug,
  isRowView = false,
}: {
  slug: string
  isRowView?: boolean
}) {
  const [stats, setStats] = useState<ProjectWeeklyStats | null>(null)

  useEffect(() => {
    fetch(`/api/project/${slug}/weekly-stats`)
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error('Failed to fetch weekly stats:', err))
  }, [slug])

  const dates = stats?.dates ?? []

  // Weeks with no computed health score (e.g. ingestion failed that week) are
  // dropped entirely rather than plotted as a gap or a fake zero.
  const healthScorePoints = stats
    ? stats.dates.reduce<{ date: string; value: number }[]>((acc, date, i) => {
        const score = stats.healthScore[i]
        if (score !== null) acc.push({ date, value: Math.round(score) })
        return acc
      }, [])
    : []

  return (
    <div
      className={`grid gap-6 mx-4 mt-6 w-full transition-all duration-500 ease-in-out ${isRowView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
    >
      <LineGraph title="Weekly Commits" dates={dates} dataPoints={stats?.commits ?? []} />
      <LineGraph title="Weekly PRs" dates={dates} dataPoints={stats?.prs ?? []} />
      <LineGraph
        title="Weekly Lines Changed"
        dates={dates}
        dataPoints={stats?.linesChanged ?? []}
      />
      <LineGraph
        title="Weekly Discord Messages"
        dates={dates}
        dataPoints={stats?.discordMessages ?? []}
      />
      <LineGraph
        title="Weekly Velocity"
        dates={dates}
        dataPoints={(stats?.velocity ?? []).map(Math.round)}
      />
      {stats?.healthScoreEnabled && (
        <LineGraph
          title="Weekly Health Score"
          dates={healthScorePoints.map((p) => p.date)}
          dataPoints={healthScorePoints.map((p) => p.value)}
        />
      )}
    </div>
  )
}
