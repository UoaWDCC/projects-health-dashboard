'use client'

import { useEffect, useState } from 'react'
import Marquee from 'react-fast-marquee'
import MarqueeLiveCommitRow from './LiveCommitRowMarquee'
import { getLatestLiveCommits, getProjectSlugs } from '@/actions/live-commits'
import { createClient } from '@/lib/supabase/client'
import { LiveCommit } from '@repo/db'

export default function LiveCommitFeedMarquee() {
  const [commits, setCommits] = useState<LiveCommit[]>([])
  const [projectSlugs, setProjectSlugs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProjectSlugs()
      .then(setProjectSlugs)
      .catch((err) => console.error('Failed to fetch project slugs:', err))

    getLatestLiveCommits()
      .then(setCommits)
      .catch((err) => {
        console.error('Failed to fetch live commits:', err)
        setError('Failed to load live commits.')
      })

    const supabase = createClient()
    const channel = supabase
      .channel('live-commits-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'LiveCommit' },
        async () => {
          try {
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
    <div className="h-10 w-full flex flex-row items-center bg-[#F4F7FB] overflow-hidden border-b border-slate-200">
      <div className="flex h-full shrink-0 items-center gap-2.5 px-4 z-10 bg-[#E1F6E8]">
        <span className="rounded-full bg-[#1AB385] shrink-0 z-10 p-[4.5px]" />
        <p className="font-mono font-light text-[1rem] text-[#177B4D] leading-none select-none">
          LIVE
        </p>
      </div>

      {/* Marquee Ticker */}
      <div className="flex-1 overflow-hidden flex items-center h-full">
        {error ? (
          <p className="font-mono text-xs text-rose-500 px-4">{error}</p>
        ) : (
          <Marquee pauseOnHover autoFill gradient={false}>
            {commits.map((commit) => (
              <MarqueeLiveCommitRow
                key={commit.id}
                commit={commit}
                projectSlug={
                  commit.projectId
                    ? projectSlugs[commit.projectId] || commit.repoName
                    : commit.repoName
                }
              />
            ))}
          </Marquee>
        )}
      </div>
    </div>
  )
}
