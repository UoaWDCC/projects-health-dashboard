import LeaderboardRow from '@/components/ui/LeaderboardRow'
import { WeeklyLeaderboard } from '@/lib/project/leaderboard'
import { Suspense } from 'react'

interface LeaderboardSectionsProps {
  data: WeeklyLeaderboard
}

export default function LeaderboardSections({ data }: LeaderboardSectionsProps) {
  return (
    <div className="flex justify-between px-5 sm:px-10 lg:px-20 gap-[21px] my-20 w-full">
      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="w-[4.9px] h-5 rounded-full bg-wdcc-kelvin" />
          Lines of Code Changed
        </h2>
        <Suspense fallback={<p>Loading...</p>}>
          {data?.linesOfCode.map(({ entry, theme }) => (
            <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
          ))}
        </Suspense>
      </section>

      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="w-[4.9px] h-5 rounded-full bg-wdcc-blue" />
          Commits Made
        </h2>
        <Suspense fallback={<p>Loading...</p>}>
          {data?.commits.map(({ entry, theme }) => (
            <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
          ))}
        </Suspense>
      </section>

      <section className="flex flex-col gap-3 w-[415px]">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="w-[4.9px] h-5 rounded-full bg-wdcc-amber" />
          Pull Requests Merged
        </h2>
        <Suspense fallback={<p>Loading...</p>}>
          {data?.merges.map(({ entry, theme }) => (
            <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
          ))}
        </Suspense>
      </section>
    </div>
  )
}
