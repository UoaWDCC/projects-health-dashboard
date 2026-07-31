import ProjectCard from '@/components/ui/ProjectCard'
import ProjectCardGrid from '@/components/ui/ProjectCardGrid'
import LiveCommitFeed from '@/components/ui/LiveCommitFeed'
import RevealOnScroll from '@/components/ui/RevealOnScroll'
import { getProjectCardData } from '@/lib/project/projects'
import HomeHeader from '@/components/headers/HomeHeader'
import Link from 'next/link'
import { hasRole } from '@/lib/auth'
import LiveCommitMarquee from '@/components/ui/LiveCommitFeedMarquee'
import { getLatestLiveCommits } from '@/actions/live-commits'

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
  const latestCommits = await getLatestLiveCommits()
  const lastCommitAt = latestCommits[0]?.committedAt ?? null

  return (
    <>
      <div className="absolute inset-0 -z-10 lg:bg-gradient-to-b lg:from-[#B6D8FB] lg:to-white" />
      {/* LIVE COMMIT BANNER SCROLL */}
      <div className="lg:hidden h-10">
        <div className="lg:hidden absolute inset-0 bg-[#git op] h-10 w-full" />
        <LiveCommitMarquee />
      </div>
      <div className="flex flex-col lg:gap-y-40">
        {/* PAGE HEADER */}
        <div className="bg-[#D4E5FD] lg:bg-inherit">
          <HomeHeader
            activeProjectCount={projects.filter((project) => project.isActive).length}
            lastCommitAt={lastCommitAt}
          />
        </div>

        {/* PAGE CONTENT MOBILE */}
        <div className="lg:hidden flex flex-col items-center gap-y-5 px-5 pt-10 mb-16">
          <ProjectCardGrid projects={projectGridItems} teamCount={teamCount} />
          <LiveCommitFeed />
        </div>
        {/* PAGE CONTENT DESKTOP */}
        <RevealOnScroll className="hidden lg:flex flex-col items-center gap-y-32 px-20 mb-16">
          {/* ACTIVE PROJECTS */}
          <div className="w-full">
            <div className="w-full pl-[9px] flex flex-row items-baseline gap-6">
              <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[2.25rem]">
                Active Projects
              </h1>
              <span className="text-wdcc-grey/50 text-xl font-medium whitespace-nowrap">
                {teamCount}&nbsp;&nbsp;team{teamCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* PROJECTS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-3 mt-8 gap-4 w-full">
              {projectGridItems.map((project) => (
                <div key={project?.id ?? 'add-new-project'}>
                  {project ? (
                    <Link href={`/project/${project.slug}`} className="block w-full">
                      <ProjectCard project={project} />
                    </Link>
                  ) : (
                    <></>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* LIVE COMMIT FEED */}
          <LiveCommitFeed />
        </RevealOnScroll>
      </div>
    </>
  )
}
