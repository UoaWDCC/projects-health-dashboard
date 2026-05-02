'use client'

import { useEffect, useState } from 'react'
import LeaderboardRow from '@/components/ui/LeaderboardRow'
import { fetchWeeklyLeaderboard, WeeklyLeaderboard } from '@/lib/project/leaderboard-row'

export default function LeaderboardSections() {
  const [data, setData] = useState<WeeklyLeaderboard | null>(null)

  useEffect(() => {
    fetchWeeklyLeaderboard().then(setData)
  }, [])

  return (
    <div className="flex justify-center gap-[21px] mt-6">
      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="text-lg font-semibold">Commits This Week</h2>
        {data?.commits.map(({ entry, theme }) => (
          <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
        ))}
      </section>

      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="text-lg font-semibold">Pull Requests This Week</h2>
        {data?.merges.map(({ entry, theme }) => (
          <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
        ))}
      </section>

      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="text-lg font-semibold">Lines Changed This Week</h2>
        {data?.linesOfCode.map(({ entry, theme }) => (
          <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
        ))}
      </section>
    </div>
  )
}
