import { db, Role } from '@repo/db'
import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/auth'
import { rolesSchema } from '@/lib/schemas/admin'

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
    const profile = await db.profile.findUnique({ where: { email } })

    if (!profile) {
      return Response.json({ error: 'Email does not exist' }, { status: 404 })
    }

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
