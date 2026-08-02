'use client'

import { useCallback, useRef } from 'react'
import Link from 'next/link'
import ProjectCard from '@/components/ui/ProjectCard'
import type { ProjectCardData } from '@/lib/project/projects'
import { useLitAmounts } from '@/hooks/useLitAmounts'

interface DesktopProjectGridProps {
  projects: (ProjectCardData | null)[]
}

const HOVER_RADIUS_PX = 500

export default function DesktopProjectGrid({ projects }: DesktopProjectGridProps) {
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const computeAmount = useCallback((rect: DOMRect) => {
    const cursor = cursorRef.current
    if (!cursor) return 0

    const dx = Math.max(rect.left - cursor.x, 0, cursor.x - rect.right)
    const dy = Math.max(rect.top - cursor.y, 0, cursor.y - rect.bottom)
    const distance = Math.hypot(dx, dy)

    return 1 - distance / HOVER_RADIUS_PX
  }, [])

  const { litAmounts, setCardRef, scheduleRecompute } = useLitAmounts<number>(computeAmount)

  return (
    <div
      className="grid grid-cols-3 mt-8 gap-4 w-full"
      onMouseMove={(event) => {
        cursorRef.current = { x: event.clientX, y: event.clientY }
        scheduleRecompute()
      }}
      onMouseLeave={() => {
        cursorRef.current = null
        scheduleRecompute()
      }}
    >
      {projects.map((project, index) =>
        project ? (
          <Link key={project.id} href={`/project/${project.slug}`} className="block w-full">
            <ProjectCard
              ref={setCardRef(index)}
              project={project}
              litAmount={litAmounts.get(index) ?? 0}
            />
          </Link>
        ) : (
          <div key="add-new-project" />
        )
      )}
    </div>
  )
}
