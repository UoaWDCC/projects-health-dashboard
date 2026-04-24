import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'

export async function GET() {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const people = await db.person.findMany({
      include: {
        identities: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    })
    return Response.json(people, { status: 200 })
  } catch (error) {
    console.error('Error fetching people:', error)
    return Response.json({ error: 'Failed to fetch people' }, { status: 500 })
  }
}
