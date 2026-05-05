'use client'

import { useEffect, useState } from 'react'
import LiveCommitRow from './live-commit-row'
import { getLatestLiveCommits } from '@/actions/live-commits'
import { createClient } from '@/lib/supabase/client'
import { LiveCommit } from '@repo/db'

export default function LiveCommitSection() {
  const [commits, setCommits] = useState<LiveCommit[]>([])

  useEffect(() => {
    // Fetch initial commits
    getLatestLiveCommits().then(setCommits)

    // Subscribe to real-time updates
    const supabase = createClient()
    const channel = supabase
      .channel('live-commits-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'LiveCommit' },
        async () => {
          // Refetch the latest 10 commits when a new one is inserted
          const latest = await getLatestLiveCommits()
          setCommits(latest)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="rounded-3xl border-2 border-white bg-[#FFFFFF80] w-4/5 mx-auto flex flex-col">
      <div className="flex flex-row items-center gap-5 px-8 py-5">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3"
        >
          <rect width="12" height="12" rx="5.90908" fill="#16A34A" />
        </svg>
        <p className="font-mono font-medium text-[18px] text-wdcc-grey">LIVE COMMITS</p>
      </div>
      {commits.map((commit) => (
        <LiveCommitRow key={commit.id} commit={commit} projectSlug={commit.repoName} />
      ))}
    </div>
  )
}
