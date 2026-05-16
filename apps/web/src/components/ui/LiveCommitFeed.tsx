'use client'

import { useEffect, useState } from 'react'
import LiveCommitRow from './LiveCommitRow'
import { getLatestLiveCommits, getProjectSlugs } from '@/actions/live-commits'
import { createClient } from '@/lib/supabase/client'
import { LiveCommit } from '@repo/db'

export default function LiveCommitFeed() {
  const [commits, setCommits] = useState<LiveCommit[]>([])
  const [projectSlugs, setProjectSlugs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch initial commits and projects
    getProjectSlugs()
      .then(setProjectSlugs)
      .catch((err) => console.error('Failed to fetch project slugs:', err))

    getLatestLiveCommits()
      .then(setCommits)
      .catch((err) => {
        console.error('Failed to fetch live commits:', err)
        setError('Failed to load live commits. Please try again later.')
      })

    // Subscribe to real-time updates
    const supabase = createClient()
    const channel = supabase
      .channel('live-commits-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'LiveCommit' },
        async () => {
          try {
            // Refetch the latest 10 commits when a new one is inserted
            const latest = await getLatestLiveCommits()
            setCommits(latest)
            setError(null)
          } catch (err) {
            console.error('Failed to fetch latest live commits:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="rounded-3xl border-2 border-white w-4/5 mx-auto flex flex-col bg-white/70">
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
        <p className="font-mono font-medium text-lg text-wdcc-grey">LIVE COMMITS</p>
      </div>
      {error ? (
        <div className="flex items-center justify-center py-8 border-t-2 border-wdcc-oshan/10">
          <p className="font-sans font-medium text-wdcc-grey text-center">{error}</p>
        </div>
      ) : (
        commits.map((commit) => (
          <LiveCommitRow
            key={commit.id}
            commit={commit}
            projectSlug={
              commit.projectId ? projectSlugs[commit.projectId] || commit.repoName : commit.repoName
            }
          />
        ))
      )}
    </div>
  )
}
