import Link from 'next/link'
import { Role } from '@repo/db'
import { getUserRoles } from '@/lib/auth'
import WeeklyMvp from '@/components/ui/weekly-mvp'
import { ProjectCard } from '@/components/ui/project-card'
import { getProjectData } from '@/lib/project/projects'
import { Header } from '@/components/ui/header'

/**
 * Public dashboard — visible to anyone without authentication.
 * Shows selected metrics, leaderboards, MVP highlights, and the live commit feed.
 * Navigation buttons to exec and admin dashboards are conditionally rendered based on user role.
 *
 * TODO: Implement public dashboard UI
 */

export default async function PublicDashboardPage() {
  const roles = await getUserRoles()
  const isExec = roles.includes(Role.EXEC)
  const isAdmin = roles.includes(Role.ADMIN)
  const projects = await getProjectData()

  return (
    <main>
      <h1>WDCC Projects Health Dashboard</h1>
      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        {(isExec || isAdmin) && (
          <Link className="underline" href="/exec-dashboard">
            Exec Dashboard
          </Link>
        )}
        {isAdmin && (
          <Link className="underline" href="/admin-dashboard">
            Admin Dashboard
          </Link>
        )}
      </nav>

      <Header activeProjectCount={projects.filter((project) => project.isActive).length} />

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
    </main>
  )
}
