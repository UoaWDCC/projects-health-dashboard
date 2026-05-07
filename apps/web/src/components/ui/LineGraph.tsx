'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

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

      {/* Chart area */}
      <div className="bg-white mx-0 px-2 pt-4 pb-2 overflow-x-auto">
        <div style={{ minWidth: `${Math.max(data.length * 60, 400)}px`, height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid vertical={false} stroke="#E0E0E0" />
              <XAxis
                dataKey="date"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 12, fill: '#5A5E7A' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 12, fill: '#5A5E7A' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Line
                type="linear"
                dataKey="value"
                stroke="#077CF1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#077CF1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
