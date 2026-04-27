import LeaderboardRow from '@/components/ui/leaderboard-row'
import {
  LEADERBOARD_THEMES,
  getTopProjectsByCommits,
  getTopProjectsByPRsMerged,
  getTopProjectsByLinesChanged,
} from '@/lib/exec-dashboard/leaderboard-row'

export default async function ExecDashboardPage() {
  const [commits, prs, lines] = await Promise.all([
    getTopProjectsByCommits(),
    getTopProjectsByPRsMerged(),
    getTopProjectsByLinesChanged(),
  ])

  return (
    <main className="p-8 flex flex-col gap-10">
      <h1 className="text-2xl font-bold">WDCC Projects Health Dashboard — Exec View</h1>

      <div className="flex justify-center gap-[21px]">
        <section className="flex flex-col gap-3 w-[415px]">
          <h2 className="text-lg font-semibold">Commits This Week</h2>
          {commits.map((entry) => (
            <LeaderboardRow key={entry.rank} entry={entry} theme={LEADERBOARD_THEMES.pink} />
          ))}
        </section>

        <section className="flex flex-col gap-3 w-[415px]">
          <h2 className="text-lg font-semibold">Pull Requests This Week</h2>
          {prs.map((entry) => (
            <LeaderboardRow key={entry.rank} entry={entry} theme={LEADERBOARD_THEMES.blue} />
          ))}
        </section>

        <section className="flex flex-col gap-3 w-[415px]">
          <h2 className="text-lg font-semibold">Lines Changed This Week</h2>
          {lines.map((entry) => (
            <LeaderboardRow key={entry.rank} entry={entry} theme={LEADERBOARD_THEMES.orange} />
          ))}
        </section>
      </div>
    </main>
  )
}
