/**
 * Authorised Users — manage who holds ADMIN and EXEC access.
 *
 * Access is gated twice: `middleware.ts` bounces signed-out visitors, and the
 * (admin) route group layout redirects anyone without the ADMIN role. This
 * server component only ever runs for an admin.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listAuthorisedUsers } from '@/lib/admin/authorised-users'
import AuthorisedUsersView from './AuthorisedUsersView'

export const metadata = {
  title: 'Authorised Users | WDCC Projects Health Dashboard',
}

export default async function AuthorisedUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const users = await listAuthorisedUsers()

  return <AuthorisedUsersView users={users} currentUserId={user.id} />
}
