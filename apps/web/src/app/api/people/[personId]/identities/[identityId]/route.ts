import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'

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

    // Ensure the identity belongs to the person before modifying
    const identity = await db.personIdentity.findUnique({
      where: { id: identityId },
    })

    if (!identity || identity.personId !== personId) {
      return Response.json(
        { error: 'Identity not found or does not belong to this person' },
        { status: 404 }
      )
    }

    const { username } = body

    let resolvedExternalId: string | undefined
    if (username !== undefined) {
      const trimmed = username ? String(username).trim() : null
      if (identity.provider === 'GITHUB' && trimmed) {
        try {
          const githubRes = await fetch(`https://api.github.com/users/${trimmed}`, {
            headers: { 'User-Agent': 'projects-health-dashboard' },
          })
          if (!githubRes.ok) {
            return Response.json(
              {
                error: `GitHub user "${trimmed}" not found. Please check the username and try again.`,
              },
              { status: 400 }
            )
          }
          const githubData = await githubRes.json()
          if (!githubData?.id) {
            return Response.json(
              { error: `Could not resolve GitHub numeric ID for user "${trimmed}".` },
              { status: 400 }
            )
          }
          resolvedExternalId = String(githubData.id)
        } catch {
          return Response.json(
            { error: `Failed to resolve GitHub user "${trimmed}". Please try again later.` },
            { status: 400 }
          )
        }
      } else if (trimmed) {
        resolvedExternalId = trimmed
      }
    }

    const updatedIdentity = await db.personIdentity.update({
      where: { id: identityId },
      data: {
        ...(resolvedExternalId !== undefined && { externalId: resolvedExternalId }),
        ...(username !== undefined && { username: username ? String(username).trim() : null }),
      },
    })

    return Response.json(updatedIdentity, { status: 200 })
  } catch (error) {
    console.error('Error updating identity:', error)
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

    // Ensure the identity belongs to the person before deleting
    const identity = await db.personIdentity.findUnique({
      where: { id: identityId },
    })

    if (!identity || identity.personId !== personId) {
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
