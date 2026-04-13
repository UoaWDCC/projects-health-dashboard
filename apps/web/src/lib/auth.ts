import { db } from '@repo/db'
import { createClient } from '@/lib/supabase/server'

// Returns the list of roles for the currently authenticated user.
// Returns an empty array if the user is not authenticated.

export async function getUserRoles(): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const userRoles = await db.userRole.findMany({
    where: { userId: user.id },
    select: { role: true },
  })

  return userRoles.map((ur) => ur.role)
}

export async function hasRole(role: string): Promise<boolean> {
  const roles = await getUserRoles()
  return roles.includes(role)
}
