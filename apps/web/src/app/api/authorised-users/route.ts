import { db, Role } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { addAuthorisedUserSchema } from '@/lib/schemas/authorised-users'
import { ROLE_LABELS, setAuthorisedRole, toAuthorisedRoles } from '@/lib/admin/authorised-users'

/**
 * Grants ADMIN or EXEC to an existing account, by email.
 *
 * Profile rows are created by the `handle_auth_user_sync` trigger on the first
 * Google sign-in, so an email that has never signed in has no row to grant
 * against — that case returns 404 with an actionable message rather than
 * silently creating a dangling record.
 */
export async function POST(request: Request) {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const parsed = addAuthorisedUserSchema.safeParse({
      email: String(body?.email ?? '').trim(),
      role: body?.role,
    })
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { email, role } = parsed.data

    // Google may return a differently-cased address than the admin types in.
    const profile = await db.profile.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, roles: { select: { role: true } } },
    })

    if (!profile) {
      return Response.json(
        {
          error: `No account found for ${email}. They need to sign in with Google once before they can be given a role.`,
        },
        { status: 404 }
      )
    }

    const existing = toAuthorisedRoles(profile.roles.map((userRole) => userRole.role))
    if (existing.includes(role)) {
      return Response.json(
        { error: `${profile.email} is already an ${ROLE_LABELS[role]}.` },
        { status: 409 }
      )
    }

    await setAuthorisedRole(profile.id, role)

    return Response.json({ id: profile.id, email: profile.email, role }, { status: 200 })
  } catch (error) {
    console.error('Error adding authorised user:', error)
    return Response.json({ error: 'Failed to add authorised user' }, { status: 500 })
  }
}
