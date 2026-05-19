import ProjectCard from '@/components/ui/ProjectCard'
import LiveCommitFeed from '@/components/ui/LiveCommitFeed'
import RevealOnScroll from '@/components/ui/RevealOnScroll'
import { getProjectCardData } from '@/lib/project/projects'
import HomeHeader from '@/components/headers/HomeHeader'
import Link from 'next/link'
import { hasRole } from '@/lib/auth'

/**
 * Public dashboard — visible to anyone without authentication.
 * Shows selected metrics, leaderboards, MVP highlights, and the live commit feed.
 * Navigation buttons to exec and admin dashboards are conditionally rendered based on user role.
 *
 * TODO: Implement public dashboard UI
 */

export default async function PublicDashboardPage() {
  const projects = await getProjectCardData()
  const isAdmin = await hasRole('ADMIN')
  const projectGridItems = isAdmin ? [...projects, null] : projects
  const teamCount = projects.length

  return (
    <>
      <div className="absolute min-h-[150vh] inset-0 -z-10 bg-gradient-to-b from-[#B6D8FB] to-white" />
      <div>
        <HomeHeader activeProjectCount={projects.filter((project) => project.isActive).length} />
        <RevealOnScroll>
          <div className="flex flex-col max-w-[1296px] mx-auto items-center mt-20">
            {/* GRID HEADER */}
            <div className="w-full pl-[9px] flex flex-row items-baseline gap-6">
              <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[2.25rem]">
                Active Projects
              </h1>
              <span className=" text-wdcc-grey/50 text-xl font-medium whitespace-nowrap">
                {teamCount}&nbsp;&nbsp;team{teamCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* PROJECTS GRID */}
            <div className="grid grid-cols-3 w-full mt-8">
              {projectGridItems.map((project) => (
                <div className="mx-auto" key={project?.id ?? 'add-new-project'}>
                  {project ? (
                    <Link href={`/project/${project.slug}`}>
                      <ProjectCard project={project} />
                    </Link>
                  ) : (
                    <></>
                  )}
                </div>
              ))}
            </div>

            {/* LIVE COMMIT FEED */}
            <div className="my-10 w-full">
              <LiveCommitFeed />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </>
  )
}
