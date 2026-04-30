import LeaderboardHeader from '@/components/headers/LeaderboardHeader'
import LeaderboardSections from '@/components/ui/leaderboard-sections'
import { db, SyncJobStatus, SyncJobType } from '@repo/db'

export default async function Leaderboard() {
  const getLeaderboardLastUpdated = async (): Promise<Date> => {
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

  const leaderboardLastUpdated = await getLeaderboardLastUpdated()

  return (
    <>
      <LeaderboardHeader lastUpdated={leaderboardLastUpdated} />

      <LeaderboardSections />
    </>
  )
}
