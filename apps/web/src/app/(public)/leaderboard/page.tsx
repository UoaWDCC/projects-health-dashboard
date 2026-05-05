import LeaderboardHeader from '@/components/headers/LeaderboardHeader'
import LeaderboardSections from '@/components/ui/LeaderboardSections'
import { fetchWeeklyLeaderboard } from '@/lib/project/leaderboard'
import { db, SyncJobStatus, SyncJobType } from '@repo/db'

export default async function Leaderboard() {
  const fetchLeaderboardLastUpdated = async (): Promise<Date> => {
    try {
      const syncJob = await db.syncJob.findFirst({
        where: {
          type: SyncJobType.GITHUB,
          status: SyncJobStatus.SUCCESS,
        },
        orderBy: {
          finishedAt: 'desc',
        },
        select: {
          finishedAt: true,
        },
      })

      return syncJob?.finishedAt || new Date()
    } catch {
      return new Date()
    }
  }

  const leaderboardLastUpdated = await fetchLeaderboardLastUpdated()
  const leaderboardData = await fetchWeeklyLeaderboard()

  return (
    <>
      <LeaderboardHeader lastUpdated={leaderboardLastUpdated} />
      <LeaderboardSections data={leaderboardData} />
    </>
  )
}
