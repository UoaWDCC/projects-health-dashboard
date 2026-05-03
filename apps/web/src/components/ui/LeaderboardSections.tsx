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
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="w-[4.9px] h-5 rounded-full bg-[#E333A3]" />
          Lines of Code Changed
        </h2>
        {data?.linesOfCode.map(({ entry, theme }) => (
          <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
        ))}
      </section>

      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="w-[4.9px] h-5 rounded-full bg-[#077CF1]" />
          Commits Made
        </h2>
        {data?.commits.map(({ entry, theme }) => (
          <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
        ))}
      </section>

      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="w-[4.9px] h-5 rounded-full bg-[#FFAC33]" />
          Pull Requests Merged
        </h2>
        {data?.merges.map(({ entry, theme }) => (
          <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
        ))}
      </section>
    </div>
  )
}
