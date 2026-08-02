import DesktopProjectGrid from '@/components/ui/DesktopProjectGrid'
import ProjectCardGrid from '@/components/ui/ProjectCardGrid'
import LiveCommitFeed from '@/components/ui/LiveCommitFeed'
import RevealOnScroll from '@/components/ui/RevealOnScroll'
import { getProjectCardData } from '@/lib/project/projects'
import HomeHeader from '@/components/headers/HomeHeader'
import { hasRole } from '@/lib/auth'
import LiveCommitMarquee from '@/components/ui/LiveCommitFeedMarquee'
import { getLatestLiveCommits } from '@/actions/live-commits'

/**
 * Public dashboard — visible to anyone without authentication.
 * Shows selected metrics, leaderboards, MVP highlights, and the live commit feed.
 * Navigation buttons to exec and admin dashboards are conditionally rendered based on user role.
 */

const DESKTOP_SIDE_PADDING = 'max(0px, calc(136px - 5vw))'

const CARD_GROUP_INSET = 'max(0px, calc(((100% - 32px) / 3 - 420px) / 2))'

export default async function PublicDashboardPage() {
  const projects = await getProjectCardData()
  const isAdmin = await hasRole('ADMIN')
  const projectGridItems = isAdmin ? [...projects, null] : projects
  const teamCount = projects.length
  const latestCommits = await getLatestLiveCommits()
  const lastCommitAt = latestCommits[0]?.committedAt ?? null

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 lg:bg-gradient-to-b lg:from-[#B6D8FB] lg:to-white" />
      {/* LIVE COMMIT BANNER SCROLL */}
      <div className="lg:hidden h-10">
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
        <div className="lg:hidden flex flex-col items-center gap-y-5 px-5 pt-10 mb-28">
          <ProjectCardGrid projects={projectGridItems} teamCount={teamCount} />
          <LiveCommitFeed />
        </div>
        {/* PAGE CONTENT DESKTOP */}
        <RevealOnScroll className="hidden lg:block mb-16">
          <div
            className="flex flex-col items-center gap-y-32 w-full"
            style={{ paddingLeft: DESKTOP_SIDE_PADDING, paddingRight: DESKTOP_SIDE_PADDING }}
          >
            {/* ACTIVE PROJECTS */}
            <div className="w-full">
              <div
                className="w-full flex flex-row items-baseline gap-6"
                style={{ paddingLeft: CARD_GROUP_INSET }}
              >
                <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[2.25rem]">
                  Active Projects
                </h1>
                <span className="text-wdcc-grey/50 text-xl font-medium whitespace-nowrap">
                  {teamCount}&nbsp;&nbsp;team{teamCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* PROJECTS GRID */}
              <DesktopProjectGrid projects={projectGridItems} />
            </div>
            {/* LIVE COMMIT FEED */}
            <div
              className="w-full"
              style={{ paddingLeft: CARD_GROUP_INSET, paddingRight: CARD_GROUP_INSET }}
            >
              <LiveCommitFeed />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  )
}
