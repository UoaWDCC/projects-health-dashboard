'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

export interface TeamSeriesMeta {
  slug: string
  name: string
  color: string
}

interface MultiLineGraphProps {
  title: string
  rows: Record<string, string | number | null>[] // merged rows keyed by team slug, plus `date`
  teams: TeamSeriesMeta[]
}

function ComparisonTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: string; name: string; value: number | null; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const entries = payload.filter((p) => p.value !== null && p.value !== undefined)
  if (entries.length === 0) return null

  return (
    <div className="min-w-[150px] rounded-md border border-[#E0E0E0] bg-white px-3 py-2 font-mono text-xs shadow-md">
      <div className="mb-1.5 font-bold text-[#5A5E7A]">{label}</div>
      <div className="flex flex-col gap-1">
        {entries.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[#2B2E48]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </span>
            <span className="font-bold text-[#2B2E48]">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegendSwatches({ payload }: { payload?: { value: string; color: string }[] }) {
  if (!payload?.length) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-3 pt-1 font-mono text-xs text-[#5A5E7A]">
      {payload.map((entry) => (
        <span key={entry.value} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  )
}

export default function MultiLineGraph({ title, rows, teams }: MultiLineGraphProps) {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-[#E8E8E8]">
      {/* Title bar */}
      <div className="px-5 py-4">
        <h3 className="font-mono text-xl font-bold text-wdcc-oshan">{title}</h3>
      </div>

      {/* Chart area */}
      <div className="bg-white px-2 pb-2 pt-4" style={{ height: '320px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke="#E0E0E0" />
            <XAxis
              dataKey="date"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 12, fill: '#5A5E7A' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 12, fill: '#5A5E7A' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={<ComparisonTooltip />}
              cursor={{ stroke: '#B9BCCB', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Legend content={<LegendSwatches />} verticalAlign="bottom" />
            {teams.map((team) => (
              <Line
                key={team.slug}
                type="linear"
                dataKey={team.slug}
                name={team.name}
                stroke={team.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
