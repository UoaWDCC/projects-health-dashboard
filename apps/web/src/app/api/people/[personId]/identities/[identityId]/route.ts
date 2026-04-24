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

    const { externalId, username } = body

    const updatedIdentity = await db.personIdentity.update({
      where: { id: identityId },
      data: {
        ...(externalId !== undefined && { externalId: String(externalId).trim() }),
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
