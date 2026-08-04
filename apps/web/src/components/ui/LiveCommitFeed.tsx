'use client'

import LiveCommitRow from './LiveCommitRow'
import { useLiveCommits } from '@/hooks/useLiveCommits'

export default function LiveCommitFeed() {
  const { commits, projectSlugs, error } = useLiveCommits()

  return (
    <div className="flex rounded-3xl border-2 border-wdcc-grey/10 lg:border lg:border-white/50 w-full mx-auto flex-col bg-[#FAFBFC] lg:bg-white/70">
      <div className="flex flex-row items-center gap-2 lg:gap-5 pl-5 lg:pl-8 py-3 lg:py-4 ">
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
        <p className="font-mono font-light tracking-widest lg:tracking-normal lg:font-medium text-sm lg:text-xl text-wdcc-grey">
          LIVE COMMITS
        </p>
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
