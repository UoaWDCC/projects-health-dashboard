import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string; membershipId: string }> }
) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { slug, membershipId } = await params

    const membership = await db.projectMember.findFirst({
      where: {
        id: membershipId,
        project: { slug },
      },
    })

    if (!membership) {
      return Response.json({ error: 'Membership not found' }, { status: 404 })
    }

    return Response.json(membership, { status: 200 })
  } catch (error) {
    console.error('Error fetching membership:', error)
    return Response.json({ error: 'Failed to fetch membership' }, { status: 500 })
  }
}
