import { db, Role } from '@repo/db'
import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/auth'
import { rolesSchema } from '@/lib/schemas/admin'
import { randomUUID } from 'node:crypto'

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
        roles: { select: { role: true, createdAt: true } },
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

    // Create a placeholder Profile when the email is not in the database yet, so admins can grant
    // roles to people who have never signed in. The roles attach on their first login.
    // upsert (not findUnique + create) keeps this safe when two admins add the same email at once.
    const profile = await db.profile.upsert({
      where: { email },
      update: {},
      create: { id: randomUUID(), email },
    })

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
