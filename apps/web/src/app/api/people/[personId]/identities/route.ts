import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> }
) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId } = await params
    const body = await request.json()

    const { provider, externalId, username } = body

    if (!provider || !externalId) {
      return Response.json({ error: 'Provider and externalId are required' }, { status: 400 })
    }

    if (provider !== 'GITHUB' && provider !== 'DISCORD') {
      return Response.json({ error: 'Invalid provider' }, { status: 400 })
    }

    const newIdentity = await db.personIdentity.create({
      data: {
        personId,
        provider, // e.g. 'DISCORD' or 'GITHUB'
        externalId: String(externalId).trim(),
        ...(username ? { username: String(username).trim() } : {}),
      },
    })

    return Response.json(newIdentity, { status: 201 })
  } catch (error) {
    console.error('Error adding identity:', error)
    return Response.json({ error: 'Failed to add identity' }, { status: 500 })
  }
}
