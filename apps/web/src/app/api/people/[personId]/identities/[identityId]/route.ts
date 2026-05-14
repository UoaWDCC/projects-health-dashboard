import { db, Prisma } from '@repo/db'
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
    let resolvedUsername: string | undefined

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
          resolvedUsername = trimmed
        } catch {
          return Response.json(
            { error: `Failed to resolve GitHub user "${trimmed}". Please try again later.` },
            { status: 400 }
          )
        }
      } else if (identity.provider === 'DISCORD' && trimmed) {
        const guildId = process.env.DISCORD_GUILD_ID
        if (!guildId) {
          return Response.json(
            { error: 'DISCORD_GUILD_ID is not configured on the server.' },
            { status: 500 }
          )
        }
        try {
          const discordRes = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(trimmed)}&limit=10`,
            { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
          )
          if (!discordRes.ok) {
            return Response.json(
              {
                error: `Failed to search Discord guild members. Check the bot token and guild ID.`,
              },
              { status: 400 }
            )
          }
          const members = await discordRes.json()
          const match = members.find(
            (m: { user: { username: string; id: string } }) =>
              m.user.username.toLowerCase() === trimmed.toLowerCase()
          )
          if (!match) {
            return Response.json(
              {
                error: `Discord user "${trimmed}" not found in the server. They must be a member of the Discord server.`,
              },
              { status: 400 }
            )
          }
          resolvedExternalId = String(match.user.id)
          resolvedUsername = trimmed
        } catch {
          return Response.json(
            { error: `Failed to resolve Discord user "${trimmed}". Please try again later.` },
            { status: 400 }
          )
        }
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
