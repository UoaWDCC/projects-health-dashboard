'use client'

import { useState } from 'react'
import LeaderboardRow from '@/components/ui/LeaderboardRow'
import { WeeklyLeaderboard } from '@/lib/project/leaderboard'
import ClientSuspense from '../utils/ClientSuspense'

interface MobileLeaderboardSectionsProps {
  data: WeeklyLeaderboard | null
  loading: boolean
}

const LEADERBOARD_SECTIONS = [
  {
    id: 'linesOfCode',
    tabLabel: 'Lines',
    heading: 'Lines of Code Changed',
    accentClassName: 'bg-wdcc-kelvin',
    tabActiveClassName: 'text-wdcc-kelvin',
  },
  {
    id: 'commits',
    tabLabel: 'Commits',
    heading: 'Commits Made',
    accentClassName: 'bg-wdcc-blue',
    tabActiveClassName: 'text-wdcc-blue',
  },
  {
    id: 'merges',
    tabLabel: 'PRs',
    heading: 'Pull Requests Merged',
    accentClassName: 'bg-wdcc-amber',
    tabActiveClassName: 'text-wdcc-amber',
  },
] as const

type LeaderboardSectionId = (typeof LEADERBOARD_SECTIONS)[number]['id']

export default function MobileLeaderboardSections({
  data,
  loading,
}: MobileLeaderboardSectionsProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardSectionId>('linesOfCode')
  const activeSection = LEADERBOARD_SECTIONS.find((section) => section.id === activeTab)

  if (!activeSection) return null

  return (
    <>
      <div className="px-5 sm:px-10 mt-4 mb-4">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {LEADERBOARD_SECTIONS.map(({ id, tabLabel, tabActiveClassName }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 rounded-lg py-2 font-mono text-xs font-medium transition-colors duration-200 ${
                activeTab === id ? `bg-white ${tabActiveClassName} shadow-sm` : 'text-gray-500'
              }`}
            >
              {tabLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 sm:px-10 mb-20">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-3 text-base font-semibold">
            <span className={`h-5 w-1 rounded-full ${activeSection.accentClassName}`} />
            {activeSection.heading}
          </h2>
          <ClientSuspense loading={loading} fallback={<p>Loading...</p>}>
            {data?.[activeSection.id].map(({ entry, theme }) => (
              <LeaderboardRow key={entry.projectId} entry={entry} theme={theme} />
            ))}
          </ClientSuspense>
        </section>
      </div>
    </>
  )
}
