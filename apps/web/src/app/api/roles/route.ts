import { db, Role } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { rolesSchema } from '@/lib/schemas/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve a Profile whose id matches auth.users.id.
 * Creates the auth user (and thus Profile via handle_auth_user_sync) when the email is new.
 */
async function ensureProfileForEmail(email: string) {
  const existing = await db.profile.findUnique({ where: { email } })
  if (existing) return existing
  // create auth user
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })

  let authUserId = data.user?.id ?? null
  // exists in auth.users but not in profile
  if (!authUserId && error && /already|registered|exists/i.test(error.message)) {
    authUserId = await findAuthUserIdByEmail(admin, email)
  }

  // if not found, throw error
  if (!authUserId) {
    throw new Error(error?.message ?? `Failed to create or resolve auth user for ${email}`)
  }

  // Trigger usually inserts Profile; upsert covers races / missing trigger in local setups.
  return db.profile.upsert({
    where: { id: authUserId },
    update: { email },
    create: { id: authUserId, email },
  })
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string) {
  const normalised = email.toLowerCase()
  let page = 1

  // Admin listUsers has no email filter in this client version — page until we find a match.
  // Fine for a small WDCC auth directory; switch to a filtered admin query if this grows.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)

    const match = data.users.find((user) => user.email?.toLowerCase() === normalised)
    if (match) return match.id
    if (data.users.length < 200) return null
    page += 1
  }
}

// find all EXEC and ADMIN
export async function GET() {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const profiles = await db.profile.findMany({
      where: {
        roles: {
          some: {
            role: {
              in: [Role.ADMIN, Role.EXEC],
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        lastSignInAt: true,
        createdAt: true,
        roles: {
          where: { role: { in: [Role.ADMIN, Role.EXEC] } },
          select: { role: true, createdAt: true },
        },
      },
      orderBy: { email: 'asc' },
    })

    return Response.json({
      currentUserEmail: user?.email ?? null,
      users: profiles.map((p) => {
        // "Added" = when this person first got any admin/exec role, not when their profile appeared.
        // Falls back to the profile date for rows granted before UserRole.createdAt existed.
        const addedAt = p.roles.reduce(
          (earliest, r) => (r.createdAt < earliest ? r.createdAt : earliest),
          p.createdAt
        )

        return {
          id: p.id,
          email: p.email,
          displayName: p.displayName,
          roles: p.roles.map((r) => r.role),
          addedAt: addedAt.toISOString(),
          lastActiveAt: p.lastSignInAt?.toISOString() ?? null,
          isPending: p.lastSignInAt === null,
        }
      }),
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to search user roles' },
      { status: 500 }
    )
  }
}

// API route for adding new admin and/or execs
export async function POST(request: Request) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const parsed = rolesSchema.safeParse({
      email: String(body.email ?? '').trim(),
      adminRole: Boolean(body.adminRole),
      execRole: Boolean(body.execRole),
    })
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    const { email, adminRole: addAdmin, execRole: addExec } = parsed.data

    // Prefer auth.admin.createUser over a random Profile id so Profile.id always matches
    // auth.users.id. handle_auth_user_sync then upserts cleanly on first Google sign-in.
    const profile = await ensureProfileForEmail(email)

    const rolesToAdd: Role[] = []
    if (addAdmin) {
      rolesToAdd.push(Role.ADMIN)
    }
    if (addExec) {
      rolesToAdd.push(Role.EXEC)
    }

    await db.userRole.createMany({
      data: rolesToAdd.map((role) => ({
        userId: profile.id,
        role,
      })),
      skipDuplicates: true,
    })

    const userRoles = await db.userRole.findMany({
      where: { userId: profile.id },
      select: { role: true },
    })

    return Response.json(
      {
        email,
        roles: userRoles.map((userRole) => userRole.role),
      },
      { status: 200 }
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to add user roles' },
      { status: 500 }
    )
  }
}

// API route for removing admin and/or exec roles
export async function DELETE(request: Request) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const parsed = rolesSchema.safeParse({
      email: String(body.email ?? '').trim(),
      adminRole: Boolean(body.adminRole),
      execRole: Boolean(body.execRole),
    })
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    const { email, adminRole: removeAdmin, execRole: removeExec } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.email === email && removeAdmin) {
      return Response.json({ error: 'You cannot remove your own admin role' }, { status: 403 })
    }

    const profile = await db.profile.findUnique({ where: { email } })

    if (!profile) {
      return Response.json({ error: 'Email does not exist' }, { status: 404 })
    }

    const rolesToRemove: Role[] = []
    if (removeAdmin) {
      rolesToRemove.push(Role.ADMIN)
    }
    if (removeExec) {
      rolesToRemove.push(Role.EXEC)
    }

    const existingRoles = await db.userRole
      .findMany({
        where: { userId: profile.id },
        select: { role: true },
      })
      .then((rows) => rows.map((userRole) => userRole.role))

    if (!rolesToRemove.some((role) => existingRoles.includes(role))) {
      return Response.json({ error: 'User does not have the specified role(s)' }, { status: 409 })
    }

    await db.userRole.deleteMany({
      where: { userId: profile.id, role: { in: rolesToRemove } },
    })

    return Response.json(
      {
        email,
        roles: existingRoles.filter((role) => !rolesToRemove.includes(role)),
      },
      { status: 200 }
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to remove user roles' },
      { status: 500 }
    )
  }
}
