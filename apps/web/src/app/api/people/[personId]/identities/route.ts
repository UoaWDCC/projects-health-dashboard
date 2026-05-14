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

    const { provider, username } = body

    if (!provider || !username) {
      return Response.json({ error: 'Provider and username are required' }, { status: 400 })
    }

    if (provider !== 'GITHUB' && provider !== 'DISCORD') {
      return Response.json({ error: 'Invalid provider' }, { status: 400 })
    }

    let resolvedExternalId: string = String(username).trim()

    if (provider === 'GITHUB') {
      try {
        const githubRes = await fetch(`https://api.github.com/users/${username}`, {
          headers: { 'User-Agent': 'projects-health-dashboard' },
        })
        if (!githubRes.ok) {
          return Response.json(
            {
              error: `GitHub user "${username}" not found. Please check the username and try again.`,
            },
            { status: 400 }
          )
        }
        const githubData = await githubRes.json()
        if (!githubData?.id) {
          return Response.json(
            { error: `Could not resolve GitHub numeric ID for user "${username}".` },
            { status: 400 }
          )
        }
        resolvedExternalId = String(githubData.id)
      } catch {
        return Response.json(
          { error: `Failed to resolve GitHub user "${username}". Please try again later.` },
          { status: 400 }
        )
      }
    }

    const newIdentity = await db.personIdentity.create({
      data: {
        personId,
        provider,
        externalId: resolvedExternalId,
        username: String(username).trim(),
      },
    })

    return Response.json(newIdentity, { status: 201 })
  } catch (error) {
    console.error('Error adding identity:', error)
    return Response.json({ error: 'Failed to add identity' }, { status: 500 })
  }
}
