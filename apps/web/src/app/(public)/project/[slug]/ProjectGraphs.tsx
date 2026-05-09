'use client'

import { useEffect, useState } from 'react'
import LineGraph from '@/components/ui/LineGraph'
import type { ProjectWeeklyStats } from '@/lib/project/weekly-stats'

export default function ProjectGraphs({ slug }: { slug: string }) {
  const [stats, setStats] = useState<ProjectWeeklyStats | null>(null)

  useEffect(() => {
    fetch(`/api/project/${slug}/weekly-stats`)
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error('Failed to fetch weekly stats:', err))
  }, [slug])

  const dates = stats?.dates ?? []

  return (
    <div className="grid grid-cols-2 gap-6 mx-4 mt-6">
      <LineGraph title="Weekly Commits" dates={dates} dataPoints={stats?.commits ?? []} />
      <LineGraph title="Weekly PR's" dates={dates} dataPoints={stats?.prs ?? []} />
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
    </div>
  )
}
