import WeeklyMvp from '@/components/ui/WeeklyMvp'
import ProjectCard from '@/components/ui/ProjectCard'
import { getProjectCardData } from '@/lib/project/projects'
import HomeHeader from '@/components/headers/HomeHeader'

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
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </>
  )
}
