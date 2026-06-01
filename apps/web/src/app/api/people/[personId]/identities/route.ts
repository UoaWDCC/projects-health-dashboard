import { db, Prisma } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { addIdentitySchema } from '@/lib/schemas/admin'

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

    const parsed = addIdentitySchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    const { provider, username } = parsed.data

    const trimmed = String(username).trim()
    let resolvedExternalId: string = trimmed
    const resolvedUsername: string = trimmed

    if (provider === 'GITHUB') {
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
    } else if (provider === 'DISCORD') {
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
            { error: `Failed to search Discord guild members. Check the bot token and guild ID.` },
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
      } catch {
        return Response.json(
          { error: `Failed to resolve Discord user "${trimmed}". Please try again later.` },
          { status: 400 }
        )
      }
    }

    const newIdentity = await db.personIdentity.create({
      data: {
        personId,
        provider,
        externalId: resolvedExternalId,
        username: resolvedUsername,
      },
    })

    return Response.json(newIdentity, { status: 201 })
  } catch (error) {
    console.error('Error adding identity:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json(
        { error: 'This account is already linked to another person.' },
        { status: 409 }
      )
    }
    return Response.json({ error: 'Failed to add identity' }, { status: 500 })
  }
}
