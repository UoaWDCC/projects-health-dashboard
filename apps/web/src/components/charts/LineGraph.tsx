'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface LineGraphProps {
  title: string
  dates: string[] // ISO date strings e.g. '2026-05-03'
  dataPoints: number[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

const TOOLTIP_BOX_HEIGHT = 26
const TOOLTIP_FOREIGN_OBJECT_WIDTH = 80

function ActivePointTooltip({ cx, cy, value }: { cx?: number; cy?: number; value?: number }) {
  if (cx === undefined || cy === undefined) return null

  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="#077CF1" />
      <foreignObject
        x={cx - TOOLTIP_FOREIGN_OBJECT_WIDTH / 2}
        y={cy - TOOLTIP_BOX_HEIGHT - 16}
        width={TOOLTIP_FOREIGN_OBJECT_WIDTH}
        height={TOOLTIP_BOX_HEIGHT + 8}
      >
        <div className="flex flex-col items-center">
          <div className="rounded-md bg-[#077CF1] px-2 py-1 font-mono text-sm font-bold text-white">
            {value}
          </div>
          <div className="-mt-1 h-2 w-2 rotate-45 bg-[#077CF1]" />
        </div>
      </foreignObject>
    </g>
  )
}

export default function LineGraph({ title, dates, dataPoints }: LineGraphProps) {
  const data = dates.map((date, i) => ({
    date: formatDate(date),
    value: dataPoints[i] ?? 0,
  }))

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-[#E8E8E8]">
      {/* Title bar */}
      <div className="px-5 py-4">
        <h3 className="font-mono text-xl font-bold text-wdcc-oshan">{title}</h3>
      </div>

      {/* Chart area — fixed height, data points spread evenly across full width */}
      <div className="bg-white px-2 pt-4 pb-2" style={{ height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 44, right: 24, bottom: 8, left: 8 }}>
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
            <Tooltip content={() => null} cursor={false} isAnimationActive={false} />
            <Line
              type="linear"
              dataKey="value"
              stroke="#077CF1"
              strokeWidth={2}
              dot={false}
              activeDot={<ActivePointTooltip />}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
