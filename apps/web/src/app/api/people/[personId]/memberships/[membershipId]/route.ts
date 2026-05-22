import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { editMembershipSchema } from '@/lib/schemas/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ personId: string; membershipId: string }> }
) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId, membershipId } = await params
    const body = await request.json()

    // Check if membership belongs to the person
    const membership = await db.projectMember.findUnique({
      where: { id: membershipId },
    })

    if (!membership || membership.personId !== personId) {
      return Response.json(
        { error: 'Membership not found or does not belong to this person' },
        { status: 404 }
      )
    }

    const parsed = editMembershipSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    const { displayName, isActive } = parsed.data

    const updatedMembership = await db.projectMember.update({
      where: { id: membershipId },
      data: {
        ...(displayName !== undefined && { displayName: displayName || null }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return Response.json(updatedMembership, { status: 200 })
  } catch (error) {
    console.error('Error updating membership:', error)
    return Response.json({ error: 'Failed to update membership' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ personId: string; membershipId: string }> }
) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId, membershipId } = await params

    const membership = await db.projectMember.findUnique({
      where: { id: membershipId },
    })

    if (!membership || membership.personId !== personId) {
      return Response.json(
        { error: 'Membership not found or does not belong to this person' },
        { status: 404 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.projectMember.delete({
        where: { id: membershipId },
      })

      const remainingMemberships = await tx.projectMember.count({
        where: { personId },
      })

      if (remainingMemberships === 0) {
        await tx.person.delete({
          where: { id: personId },
        })
      }
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting membership:', error)
    return Response.json({ error: 'Failed to delete membership' }, { status: 500 })
  }
}
