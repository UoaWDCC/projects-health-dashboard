import { db, Role } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { changeAuthorisedRoleSchema } from '@/lib/schemas/authorised-users'
import {
  ROLE_LABELS,
  revokeAuthorisedRoles,
  setAuthorisedRole,
  toAuthorisedRoles,
} from '@/lib/admin/authorised-users'

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * The signed-in user's id, for the checks that stop an admin editing their own
 * access. `hasRole` has already confirmed there is one by the time this runs.
 */
async function getActorId(): Promise<string | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id
}

/**
 * Loads a profile and its authorised roles, 404ing if it is not currently on
 * the authorised users list. Shared by PATCH and DELETE.
 */
async function findAuthorisedProfile(userId: string) {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { id: true, email: true, roles: { select: { role: true } } },
  })

  if (!profile) return null

  const roles = toAuthorisedRoles(profile.roles.map((userRole) => userRole.role))
  if (roles.length === 0) return null

  return { id: profile.id, email: profile.email, roles }
}

/** Changes an authorised user's role to exactly the role given. */
export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { userId } = await params
    const body = await request.json()

    const parsed = changeAuthorisedRoleSchema.safeParse({ role: body?.role })
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { role } = parsed.data

    // Demoting yourself out of ADMIN would lock you out of this page mid-session.
    if (userId === (await getActorId()) && role !== 'ADMIN') {
      return Response.json({ error: 'You cannot change your own role.' }, { status: 403 })
    }

    const profile = await findAuthorisedProfile(userId)
    if (!profile) {
      return Response.json({ error: 'Authorised user not found.' }, { status: 404 })
    }

    // Idempotent: re-applying the role a user already holds is a no-op success.
    if (profile.roles.length === 1 && profile.roles[0] === role) {
      return Response.json({ id: profile.id, email: profile.email, role }, { status: 200 })
    }

    await setAuthorisedRole(profile.id, role)

    return Response.json({ id: profile.id, email: profile.email, role }, { status: 200 })
  } catch (error) {
    console.error('Error changing authorised user role:', error)
    return Response.json({ error: 'Failed to change role' }, { status: 500 })
  }
}

/** Revokes all authorised roles, removing the user from the list. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { userId } = await params

    if (userId === (await getActorId())) {
      return Response.json({ error: 'You cannot remove your own access.' }, { status: 403 })
    }

    const profile = await findAuthorisedProfile(userId)
    if (!profile) {
      return Response.json({ error: 'Authorised user not found.' }, { status: 404 })
    }

    await revokeAuthorisedRoles(profile.id)

    return Response.json(
      {
        id: profile.id,
        email: profile.email,
        removed: profile.roles.map((role) => ROLE_LABELS[role]),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error removing authorised user:', error)
    return Response.json({ error: 'Failed to remove authorised user' }, { status: 500 })
  }
}
