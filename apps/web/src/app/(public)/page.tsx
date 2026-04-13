import Link from 'next/link'
import { getUserRoles } from '@/lib/auth'

/**
 * Public dashboard — visible to anyone without authentication.
 * Shows selected metrics, leaderboards, MVP highlights, and the live commit feed.
 * Navigation buttons to exec and admin dashboards are conditionally rendered based on user role.
 *
 * TODO: Implement public dashboard UI
 */
export default async function PublicDashboardPage() {
  const roles = await getUserRoles()
  const isExec = roles.includes('EXEC')
  const isAdmin = roles.includes('ADMIN')

  return (
    <main>
      <h1>WDCC Projects Health Dashboard</h1>
      <p>Public view coming soon.</p>
      <nav>
        {(isExec || isAdmin) && (
          <Link href="/exec-dashboard">
            <button>Exec Dashboard</button>
          </Link>
        )}
        <br></br>
        {isAdmin && (
          <Link href="/dashboard">
            <button>Admin Dashboard</button>
          </Link>
        )}
      </nav>
    </main>
  )
}
