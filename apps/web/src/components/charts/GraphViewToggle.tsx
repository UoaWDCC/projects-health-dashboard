'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid, Rows } from 'lucide-react'
import ProjectGraphs from './ProjectGraphs'

const SESSION_KEY = 'graph-view'

export default function GraphViewToggle({ slug }: { slug: string }) {
  const [isRowView, setIsRowView] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) setIsRowView(stored === 'row')
  }, [])

  const toggle = () => {
    setIsRowView((prev) => {
      const next = !prev
      localStorage.setItem(SESSION_KEY, next ? 'row' : 'grid')
      return next
    })
  }

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div className="w-full flex flex-row items-center justify-between">
        <h2 className="text-4xl font-extrabold">Progress indicators</h2>
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-wdcc-grey"
        >
          {isRowView ? (
            <>
              <LayoutGrid className="w-4 h-4" />
              Grid view
            </>
          ) : (
            <>
              <Rows className="w-4 h-4" />
              Row view
            </>
          )}
        </button>
      </div>

      <ProjectGraphs slug={slug} isRowView={isRowView} />
    </div>
  )
}
