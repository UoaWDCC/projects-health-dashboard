import { db } from '@repo/db'

export async function GET() {
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
