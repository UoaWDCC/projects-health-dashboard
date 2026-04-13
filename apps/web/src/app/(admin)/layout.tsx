import { redirect } from 'next/navigation'
import { hasRole } from '@/lib/auth'

// Protects all routes in the (admin) group
// Only users with the ADMIN role can access these pages

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await hasRole('ADMIN')

  if (!isAdmin) {
    redirect('/')
  }

  return <>{children}</>
}
