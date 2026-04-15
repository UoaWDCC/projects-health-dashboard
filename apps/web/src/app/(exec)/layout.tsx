import { redirect } from 'next/navigation'
import { getUserRoles } from '@/lib/auth'
import { Role } from '@repo/db'

// Protects all routes in the (exec) group
// Users with EXEC or ADMIN role can access these pages

export default async function ExecLayout({ children }: { children: React.ReactNode }) {
  const roles = await getUserRoles()
  const hasAccess = roles.includes(Role.EXEC) || roles.includes(Role.ADMIN)

  if (!hasAccess) {
    redirect('/')
  }

  return <>{children}</>
}
