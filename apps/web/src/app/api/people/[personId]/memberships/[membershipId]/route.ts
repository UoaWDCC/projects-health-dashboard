import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'

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

    const { displayName, isActive } = body

    const updatedMembership = await db.projectMember.update({
      where: { id: membershipId },
      data: {
        ...(displayName !== undefined && {
          displayName: displayName ? String(displayName).trim() : null,
        }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    })

    return Response.json(updatedMembership, { status: 200 })
  } catch (error) {
    console.error('Error updating membership:', error)
    return Response.json({ error: 'Failed to update membership' }, { status: 500 })
  }
}
