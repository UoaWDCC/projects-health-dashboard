/**
 * Admin dashboard — only should be accessible to administrators.
 * Currently should allow administrators to create projects and view their current projects.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Project } from '@/lib/project/types'
import Link from 'next/link'
import Image from 'next/image'
import ClientSuspense from '@/components/utils/ClientSuspense'
import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'
import FormulaInput from '@/components/dashboard/FormulaInput'

const fetchProjects = async (): Promise<Project[]> => {
  try {
    const response = await fetch('/api/project')
    if (!response.ok) {
      throw new Error('Failed to fetch projects')
    }
    const projects = await response.json()
    return projects as Project[]
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export default function AdminDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const data = await fetchProjects()
      setProjects(data)
    }

    load().then(() => setLoading(false))
  }, [])

  return (
    <>
      <div
        className="w-full bg-wdcc-blue/10 flex flex-row justify-between items-end pt-16 pb-0 px-5 sm:px-10 lg:px-20"
        style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex flex-col justify-center items-start gap-y-3 py-8 w-full sm:w-2/3">
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            Admin View
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            View and manage all currently active WDCC projects. Click into any project card to
            update its details, review its activity, and configure its settings.
          </p>
        </div>

        <Image
          src="/webster.png"
          alt="Webster"
          width={200}
          height={200}
          className="drop-shadow-2xl translate-y-1/3 hidden sm:block shrink-0"
        />
      </div>

      <div className="mt-44 px-5 sm:px-10 lg:px-20 flex items-center justify-between mb-6">
        <p className="font-mono text-sm text-wdcc-grey-light">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => router.push('/projects/new')}
          className="flex items-center gap-2 bg-wdcc-oshan text-white font-mono text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-wdcc-oshan/80 transition-colors duration-150"
        >
          <span className="text-base leading-none">+</span>
          New project
        </button>
      </div>

      <ul className="px-5 sm:px-10 lg:px-20 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-20">
        <ClientSuspense loading={loading} fallback={<p>Loading projects...</p>}>
          {projects.map((project) => (
            <li key={project.id} className="h-full">
              <Link href={`/projects/${project.slug}`} className="block h-full">
                {/* Single element gradient border using background-clip trick */}
                <div
                  className="h-full flex flex-col font-sans transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                  style={{
                    borderRadius: '24px',
                    border: '3px solid transparent',
                    background: BORDER_DEFAULT,
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease, background 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = BORDER_HOVER
                    e.currentTarget.style.boxShadow =
                      '0 12px 32px rgba(227,51,163,0.15), 0 4px 12px rgba(7,124,241,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = BORDER_DEFAULT
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div className="flex flex-col flex-1 px-7 pt-7 pb-6 gap-4 min-w-0">
                    {/* Project image */}
                    <div className="w-[52px] h-[52px] rounded-[14px] bg-[#d9d9d9] overflow-hidden shrink-0">
                      {project.imageUrl && (
                        <Image
                          src={project.imageUrl}
                          alt={project.name}
                          width={52}
                          height={52}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Name + slug */}
                    <div className="min-w-0">
                      <h3 className="text-[16px] sm:text-[18px] font-extrabold leading-tight text-wdcc-oshan truncate">
                        {project.name}
                      </h3>
                      <p className="text-[11px] font-mono text-wdcc-grey-light mt-1 truncate">
                        /{project.slug}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-[13px] leading-snug text-wdcc-grey-light line-clamp-2 font-mono">
                      {project.description}
                    </p>

                    {/* Dates — inline chips, no dividers */}
                    <div className="flex gap-2 flex-wrap mt-auto">
                      <div className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-wdcc-grey-light">
                          Started
                        </span>
                        <span className="text-[12px] font-mono font-medium text-wdcc-grey">
                          {project.startedAt
                            ? new Date(project.startedAt).toLocaleDateString('en-NZ', {
                                dateStyle: 'medium',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-wdcc-grey-light">
                          Created
                        </span>
                        <span className="text-[12px] font-mono font-medium text-wdcc-grey">
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString('en-NZ', {
                                dateStyle: 'medium',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Repos + Channels */}
                    <div className="flex gap-2 flex-wrap">
                      {project.repositories.map((repo) => (
                        <div
                          key={repo.id}
                          className="flex items-center gap-1.5 bg-wdcc-blue/10 rounded-lg px-2.5 py-1.5 min-w-0"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="shrink-0"
                          >
                            <circle cx="4" cy="3" r="2" stroke="#077CF1" strokeWidth="1.5" />
                            <circle cx="12" cy="3" r="2" stroke="#077CF1" strokeWidth="1.5" />
                            <circle cx="4" cy="13" r="2" stroke="#077CF1" strokeWidth="1.5" />
                            <path
                              d="M4 5v6M4 5c0 2 8 2 8 0"
                              stroke="#077CF1"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="text-[11px] font-mono text-wdcc-blue font-medium leading-none truncate">
                            {repo.owner}/{repo.name}
                          </span>
                        </div>
                      ))}
                      {project.channels?.map((ch) => (
                        <div
                          key={ch.id}
                          className="flex items-center gap-1.5 bg-wdcc-kelvin/10 rounded-lg px-2.5 py-1.5 min-w-0"
                        >
                          <span
                            className="text-[11px] font-mono leading-none shrink-0"
                            style={{ color: '#E333A3' }}
                          >
                            #
                          </span>
                          <span
                            className="text-[11px] font-mono font-medium leading-none truncate"
                            style={{ color: '#E333A3' }}
                          >
                            {ch.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ClientSuspense>
      </ul>

      <FormulaInput />
    </>
  )
}
