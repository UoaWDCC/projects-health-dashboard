'use client'

import { useEffect, useMemo, useState } from 'react'
import MultiLineGraph, { type TeamSeriesMeta } from '@/components/charts/MultiLineGraph'
import { METRICS, type MetricKey, type TeamWeeklyStats } from '@/lib/project/weekly-stats'

const TEAM_COLORS = [
  '#077CF1',
  '#F45B69',
  '#2EC4B6',
  '#FF9F1C',
  '#8338EC',
  '#06A77D',
  '#E63946',
  '#5A5E7A',
  '#FFBF69',
  '#3A86FF',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

function buildRowsForMetric(teams: TeamWeeklyStats[], metric: MetricKey) {
  const allDates = Array.from(new Set(teams.flatMap((t) => t.dates))).sort()

  return allDates.map((iso) => {
    const row: Record<string, string | number | null> = { date: formatDate(iso) }
    for (const team of teams) {
      const idx = team.dates.indexOf(iso)
      const value = idx === -1 ? null : (team[metric]?.[idx] ?? null)
      row[team.slug] = value
    }
    return row
  })
}

export default function ExecProjectGraphs() {
  const [teams, setTeams] = useState<TeamWeeklyStats[] | null>(null)
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/project/weekly-stats')
      .then((res) => res.json())
      .then((data: TeamWeeklyStats[]) => {
        setTeams(data)
        setActiveSlugs(new Set(data.map((t) => t.slug)))
      })
      .catch((err) => console.error('Failed to fetch exec weekly stats:', err))
  }, [])

  const teamMeta: TeamSeriesMeta[] = useMemo(
    () =>
      (teams ?? []).map((t, i) => ({
        slug: t.slug,
        name: t.name,
        color: TEAM_COLORS[i % TEAM_COLORS.length],
      })),
    [teams]
  )

  const activeTeams = teams?.filter((t) => activeSlugs.has(t.slug)) ?? []
  const activeMeta = teamMeta.filter((t) => activeSlugs.has(t.slug))

  function toggleTeam(slug: string) {
    setActiveSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        // keep at least one team active
        if (next.size > 1) next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  if (teams === null) {
    return <div className="mx-4 mt-6 font-mono text-[#5A5E7A]">Loading team comparison…</div>
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-6">
      {/* Toggle bar */}
      <div className="flex flex-wrap gap-2">
        {teamMeta.map((team) => {
          const isActive = activeSlugs.has(team.slug)
          return (
            <button
              key={team.slug}
              type="button"
              onClick={() => toggleTeam(team.slug)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                isActive
                  ? 'border-transparent bg-[#E8E8E8] text-[#2B2E48]'
                  : 'border-[#E0E0E0] bg-white text-[#B9BCCB]'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: isActive ? team.color : '#D9D9D9' }}
              />
              {team.name}
            </button>
          )
        })}
      </div>

      {/* One graph per metric */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {METRICS.map(({ key, title }) => (
          <MultiLineGraph
            key={key}
            title={title}
            rows={buildRowsForMetric(activeTeams, key)}
            teams={activeMeta}
          />
        ))}
      </div>
    </div>
  )
}
