import DesktopProjectGrid from '@/components/ui/DesktopProjectGrid'
import ProjectCardGrid from '@/components/ui/ProjectCardGrid'
import LiveCommitFeed from '@/components/ui/LiveCommitFeed'
import RevealOnScroll from '@/components/ui/RevealOnScroll'
import { getProjectCardData } from '@/lib/project/projects'
import HomeHeader from '@/components/headers/HomeHeader'
import { getUserRoles } from '@/lib/auth'
import LiveCommitMarquee from '@/components/ui/LiveCommitFeedMarquee'
import { getLatestLiveCommits } from '@/actions/live-commits'
import NewProjectButton from '@/components/ui/NewProjectButton'
import { getGlobalWeeklySummary } from '@/lib/project/summary'
import GlobalWeeklySummary from '@/components/ui/GlobalWeeklySummary'

const DESKTOP_SIDE_PADDING = 'max(0px, calc(136px - 5vw))'
const DESKTOP_GRID_MAX_WIDTH = 'max-w-[1292px]'

export default async function PublicDashboardPage() {
  const roles = await getUserRoles()
  const isAdmin = roles.includes('ADMIN')
  const canViewGlobalSummary = isAdmin || roles.includes('EXEC')
  const [projects, latestCommits, globalSummary] = await Promise.all([
    getProjectCardData(),
    getLatestLiveCommits(),
    canViewGlobalSummary ? getGlobalWeeklySummary() : null,
  ])

  const projectGridItems = isAdmin ? [...projects, null] : projects
  const teamCount = projects.length
  const lastCommitAt = latestCommits[0]?.committedAt ?? null

  return (
    <div className="relative">
      <div className="absolute inset-x-0 -top-16 bottom-0 -z-10 lg:bg-gradient-to-b lg:from-[#B6D8FB] lg:to-white" />

      <div className="lg:hidden h-10 relative z-20">
        <LiveCommitMarquee />
      </div>
      <div className="flex flex-col lg:gap-y-20 -mt-16">
        {/* PAGE HEADER */}
        <div className="bg-[#D4E5FD] lg:bg-inherit">
          <HomeHeader
            activeProjectCount={projects.filter((project) => project.isActive).length}
            lastCommitAt={lastCommitAt}
          />
        </div>

        {/* GLOBAL WEEKLY SUMMARY (admins and execs only) — all breakpoints */}
        {canViewGlobalSummary && (
          <div
            className="w-full px-5 pt-10 lg:pt-0 lg:px-[var(--desktop-side-padding)]"
            style={{ '--desktop-side-padding': DESKTOP_SIDE_PADDING } as React.CSSProperties}
          >
            <div className={`w-full mx-auto ${DESKTOP_GRID_MAX_WIDTH}`}>
              <GlobalWeeklySummary summary={globalSummary} />
            </div>
          </div>
        )}

        {/* PAGE CONTENT MOBILE */}
        <div
          className={`lg:hidden flex flex-col items-center gap-y-5 px-5 mb-28 ${
            canViewGlobalSummary ? 'pt-5' : 'pt-10'
          }`}
        >
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
            <div className={`w-full mx-auto ${DESKTOP_GRID_MAX_WIDTH}`}>
              <div className="w-full flex flex-row items-baseline gap-6">
                <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[2.25rem]">
                  Active Projects
                </h1>
                <span className="text-wdcc-grey/50 text-xl font-medium whitespace-nowrap">
                  {teamCount}&nbsp;&nbsp;team{teamCount !== 1 ? 's' : ''}
                </span>
                {isAdmin && <NewProjectButton className="ml-auto" />}
              </div>

              <DesktopProjectGrid projects={projectGridItems} />
            </div>

            {/* LIVE COMMIT FEED */}
            <div className={`w-full mx-auto ${DESKTOP_GRID_MAX_WIDTH}`}>
              <LiveCommitFeed />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  )
}
