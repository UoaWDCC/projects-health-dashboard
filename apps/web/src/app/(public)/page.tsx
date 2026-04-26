import Link from 'next/link'
import { Role } from '@repo/db'
import { getUserRoles } from '@/lib/auth'
import LiveCommitRow from '@/components/ui/live-commit-row'

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

  return (
    <main>
      <h1>WDCC Projects Health Dashboard</h1>
      <p>Public view coming soon.</p>
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
      <div className="">
        <LiveCommitRow
          message="feat: add OAuth2 token refresh logic"
          author="Jamie K"
          projectName="Project Name Which is long af holy jesus christ"
          timestamp="2m ago"
        />
        <LiveCommitRow
          message="fix: resolve race condition in queue handler plus another bunch of really long bs for no apparent reason"
          author="Ovuvuevuevue Enyetuenwuevue Ugbemugbem Osas"
          projectName="Project Name"
          timestamp="5m ago"
        />
        <LiveCommitRow
          message="chore: update dependencies to latest stable"
          author="Alex M"
          projectName="Project Name"
          timestamp="11m ago"
        />
        <LiveCommitRow
          message="feat: implement responsive sidebar toggle"
          author="Riley C"
          projectName="Project Name"
          timestamp="18m ago"
        />
        <LiveCommitRow
          message="fix: correct lat/lng bounds on map renderer"
          author="Jordan L"
          projectName="Project Name"
          timestamp="24m ago"
        />
      </div>
    </main>
  )
}
