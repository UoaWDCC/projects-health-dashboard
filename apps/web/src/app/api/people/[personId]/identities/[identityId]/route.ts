import { db, Prisma } from '@repo/db'
import { hasRole } from '@/lib/auth'
import {
  resolveGithubIdentity,
  resolveDiscordIdentity,
  IdentityResolutionError,
} from '@/lib/identity/resolve'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ personId: string; identityId: string }> }
) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId, identityId } = await params
    const body = await request.json()

    const identity = await db.personIdentity.findUnique({
      where: { id: identityId },
    })

    if (identity?.personId !== personId) {
      return Response.json(
        { error: 'Identity not found or does not belong to this person' },
        { status: 404 }
      )
    }

    const { username } = body

    let resolvedExternalId: string | undefined
    let resolvedUsername: string | undefined

    if (username !== undefined) {
      const trimmed = username ? String(username).trim() : null
      if (identity.provider === 'GITHUB' && trimmed) {
        const resolved = await resolveGithubIdentity(trimmed)
        resolvedExternalId = resolved.externalId
        resolvedUsername = resolved.username
      } else if (identity.provider === 'DISCORD' && trimmed) {
        const resolved = await resolveDiscordIdentity(trimmed)
        resolvedExternalId = resolved.externalId
        resolvedUsername = resolved.username
      } else {
        resolvedUsername = trimmed ?? undefined
      }
    }

    const updatedIdentity = await db.personIdentity.update({
      where: { id: identityId },
      data: {
        ...(resolvedExternalId !== undefined && { externalId: resolvedExternalId }),
        ...(resolvedUsername !== undefined && { username: resolvedUsername }),
      },
    })

    return Response.json(updatedIdentity, { status: 200 })
  } catch (error) {
    console.error('Error updating identity:', error)
    if (error instanceof IdentityResolutionError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json(
        { error: 'This account is already linked to another person.' },
        { status: 409 }
      )
    }
    return Response.json({ error: 'Failed to update identity' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ personId: string; identityId: string }> }
) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId, identityId } = await params

    const identity = await db.personIdentity.findUnique({
      where: { id: identityId },
    })

    if (identity?.personId !== personId) {
      return Response.json(
        { error: 'Identity not found or does not belong to this person' },
        { status: 404 }
      )
    }

    await db.personIdentity.delete({
      where: { id: identityId },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting identity:', error)
    return Response.json({ error: 'Failed to delete identity' }, { status: 500 })
  }
}
