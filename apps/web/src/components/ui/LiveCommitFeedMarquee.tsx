'use client'

import Marquee from 'react-fast-marquee'
import MarqueeLiveCommitRow from './LiveCommitRowMarquee'
import { useLiveCommits } from '@/hooks/useLiveCommits'

export default function LiveCommitFeedMarquee() {
  const { commits, projectSlugs, error } = useLiveCommits()

  return (
    <div className="h-10 w-full flex flex-row items-center bg-[#F4F7FB] overflow-hidden border-b border-slate-200">
      <div className="flex h-full shrink-0 items-center gap-2.5 px-4 z-10 bg-[#E1F6E8]">
        <span className="rounded-full bg-[#1AB385] shrink-0 z-10 p-[4.5px]" />
        <p className="font-mono font-light text-[1rem] text-[#177B4D] leading-none select-none">
          LIVE
        </p>
      </div>
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
