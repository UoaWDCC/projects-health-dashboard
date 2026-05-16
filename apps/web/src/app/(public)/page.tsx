import WeeklyMvp from '@/components/ui/WeeklyMvp'
import ProjectCard from '@/components/ui/ProjectCard'
import LiveCommitFeed from '@/components/ui/LiveCommitFeed'
import { getProjectCardData } from '@/lib/project/projects'
import HomeHeader from '@/components/headers/HomeHeader'
import Link from 'next/link'
import LineGraph from '@/components/ui/LineGraph'

/**
 * Public dashboard — visible to anyone without authentication.
 * Shows selected metrics, leaderboards, MVP highlights, and the live commit feed.
 * Navigation buttons to exec and admin dashboards are conditionally rendered based on user role.
 *
 * TODO: Implement public dashboard UI
 */

export default async function PublicDashboardPage() {
  const projects = await getProjectCardData()

  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(to bottom, #077CF1 -2000px, #FFFFFF 100%)' }}
      />
      <div>
        <HomeHeader activeProjectCount={projects.filter((project) => project.isActive).length} />

        <div className="ml-10">
          <WeeklyMvp
            name="John Smith"
            avatarUrl="https://github.com/johnsmith.png"
            linesCommitted={2046}
          />
        </div>

        <div className="grid grid-cols-2 gap-6 ml-4 mt-6">
          {projects.map((project) => (
            <Link href={`/project/${project.slug}`} key={project.id}>
              <ProjectCard project={project} />
            </Link>
          ))}
        </div>

        <div className="my-10">
          <LiveCommitFeed />
          <div className="mx-4 mt-6 max-w-2xl">
            <LineGraph
              title="Weekly Commits"
              dates={[
                '2026-04-28',
                '2026-05-05',
                '2026-05-12',
                '2026-05-19',
                '2026-05-26',
                '2026-06-02',
                '2026-06-09',
              ]}
              dataPoints={[100, 160, 220, 195, 260, 330, 370]}
            />
          </div>
        </div>
      </div>
    </>
  )
}
