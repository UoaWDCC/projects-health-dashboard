'use client'

import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatStat } from '@/lib/project/leaderboard'
import {
  METRICS,
  TIME_RANGES,
  type MemberContributionBreakdown,
  type MetricComparison,
  type TimeRangeKey,
} from '@/lib/project/member-contribution'

const AVERAGE_COLOR = '#C7CCE0'

const tick = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: '#5A5E7A' }

function formatValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatPct(pct: number | null): string {
  if (pct === null) return 'n/a'
  const rounded = Math.round(pct * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

function pctColor(pct: number | null): string {
  if (pct === null) return 'text-wdcc-grey-light'
  if (pct > 0) return 'text-green-700'
  if (pct < 0) return 'text-red-600'
  return 'text-wdcc-grey'
}

function MetricPanel({
  label,
  color,
  comparison,
}: {
  label: string
  color: string
  comparison: MetricComparison
}) {
  const bars = [
    { label: 'Member', value: comparison.member, fill: color },
    { label: 'Project avg', value: comparison.projectAverage, fill: AVERAGE_COLOR },
    { label: 'All projects', value: comparison.globalAverage, fill: AVERAGE_COLOR },
  ]

  return (
    <div className="rounded-xl border border-[#ECEEF6] bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-sm text-wdcc-grey">{label}</h3>
        <span className="font-mono text-xl text-wdcc-oshan">{formatValue(comparison.member)}</span>
      </div>

      <div className="mt-3 h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#ECEEF6" />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} />
            <YAxis
              tick={tick}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={formatStat}
            />
            <Tooltip
              cursor={{ fill: '#F5F7FB' }}
              formatter={(value: number) => [formatValue(value), label]}
              contentStyle={{ fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {bars.map((bar) => (
                <Cell key={bar.label} fill={bar.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-[#ECEEF6] pt-3 font-mono text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-wdcc-grey-light">vs this project</dt>
          <dd className={pctColor(comparison.projectDiffPct)}>
            {formatPct(comparison.projectDiffPct)}
            <span className="ml-1 text-wdcc-grey-light">
              (avg {formatValue(comparison.projectAverage)})
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-wdcc-grey-light">vs all projects</dt>
          <dd className={pctColor(comparison.globalDiffPct)}>
            {formatPct(comparison.globalDiffPct)}
            <span className="ml-1 text-wdcc-grey-light">
              (avg {formatValue(comparison.globalAverage)})
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default function MemberContributionChart({
  ranges,
}: {
  ranges: MemberContributionBreakdown['ranges']
}) {
  // Every range is computed on the server at page load, so switching is instant.
  const [range, setRange] = useState<TimeRangeKey>('week')
  const breakdown = ranges[range]

  return (
    <div>
      <div role="group" aria-label="Time range" className="flex flex-wrap gap-2">
        {TIME_RANGES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            aria-pressed={range === key}
            className={`rounded-full border px-4 py-1.5 font-mono text-sm transition-colors ${
              range === key
                ? 'border-wdcc-blue bg-wdcc-blue text-white'
                : 'border-[#ECEEF6] bg-white text-wdcc-grey hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {METRICS.map(({ key, label, color }) => (
          <MetricPanel key={key} label={label} color={color} comparison={breakdown[key]} />
        ))}
      </div>
    </div>
  )
}
