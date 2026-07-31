'use client'

import { useState } from 'react'
import Link from 'next/link'
import ProjectCard from '@/components/ui/ProjectCard'
import type { ProjectCardData } from '@/lib/project/projects'

type ViewMode = 'tiles' | 'rows'

interface ProjectCardGridProps {
  projects: (ProjectCardData | null)[]
  teamCount: number
}

export default function ProjectCardGrid({ projects }: ProjectCardGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tiles')

  return (
    <div className="w-full">
      {/* GRID HEADER */}
      <div className="w-full pl-[9px] flex flex-row items-end justify-between gap-2">
        <div className="flex flex-row items-end gap-1.5">
          <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.375rem,6vw,1.75rem)] whitespace-nowrap">
            Active Projects
          </h1>
        </div>

        {/* VIEW TOGGLE */}
        <div className="flex items-end gap-1 shrink-0">
          <div className="relative">
            <div
              className={`absolute -inset-1 rounded-xl transition-colors duration-300 ease-in-out ${
                viewMode === 'tiles' ? 'bg-[#EDF9F1]' : 'bg-transparent'
              }`}
            />
            <button
              type="button"
              onClick={() => setViewMode('tiles')}
              aria-label="Tile view"
              aria-pressed={viewMode === 'tiles'}
              className={`relative flex items-center justify-center rounded-lg p-1.5 transition-all duration-300 ease-in-out active:scale-90 ${
                viewMode === 'tiles' ? 'bg-[#14182B] text-[#EEF0F3]' : 'bg-[#EEF0F3] text-[#14182B]'
              }`}
            >
              {/* Tiles icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
          </div>

          <div className="relative">
            <div
              className={`absolute -inset-1 rounded-xl transition-colors duration-300 ease-in-out ${
                viewMode === 'rows' ? 'bg-[#EDF9F1]' : 'bg-transparent'
              }`}
            />
            <button
              type="button"
              onClick={() => setViewMode('rows')}
              aria-label="Row view"
              aria-pressed={viewMode === 'rows'}
              className={`relative flex items-center justify-center rounded-lg p-1.5 transition-all duration-300 ease-in-out active:scale-90 ${
                viewMode === 'rows' ? 'bg-[#14182B] text-[#EEF0F3]' : 'bg-[#EEF0F3] text-[#14182B]'
              }`}
            >
              {/* Rows icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* PROJECTS CONTAINER */}
      <div
        className={`mt-6 gap-4 w-full ${viewMode === 'tiles' ? 'grid grid-cols-2' : 'flex flex-col'}`}
      >
        {projects.map((project) => (
          <div key={project?.id ?? 'add-new-project'}>
            {project && (
              <Link href={`/project/${project.slug}`} className="block w-full">
                <ProjectCard project={project} viewMode={viewMode} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
