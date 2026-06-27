'use client'

import { useEffect, useState } from 'react'
import DesktopLeaderboardSections from '@/components/ui/DesktopLeaderboardSections'
import MobileLeaderboardSections from '@/components/ui/MobileLeaderboardSections'
import { fetchWeeklyLeaderboard, WeeklyLeaderboard } from '@/lib/project/leaderboard'

export default function LeaderboardSections() {
  const [data, setData] = useState<WeeklyLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWeeklyLeaderboard()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="lg:hidden">
        <MobileLeaderboardSections data={data} loading={loading} />
      </div>
      <div className="hidden lg:block">
        <DesktopLeaderboardSections data={data} loading={loading} />
      </div>
    </>
  )
}
