import { getAppOctokit } from '@repo/github'

export type ResolvedIdentity = {
  externalId: string
  username: string
}

export class IdentityResolutionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'IdentityResolutionError'
  }
}

export async function resolveGithubIdentity(username: string): Promise<ResolvedIdentity> {
  const octokit = await getAppOctokit()

  try {
    const { data } = await octokit.request('GET /users/{username}', { username })
    if (!data?.id) {
      throw new IdentityResolutionError(
        `Could not resolve GitHub numeric ID for user "${username}".`,
        400
      )
    }
    return { externalId: String(data.id), username: (data as { login: string }).login }
  } catch (err) {
    if (err instanceof IdentityResolutionError) throw err
    const status = (err as { status?: number })?.status
    if (status === 404) {
      throw new IdentityResolutionError(
        `GitHub user "${username}" not found. Please check the username and try again.`,
        400
      )
    }
    throw new IdentityResolutionError(
      `Failed to resolve GitHub user "${username}". Please try again later.`,
      400
    )
  }
}

export async function resolveDiscordIdentity(username: string): Promise<ResolvedIdentity> {
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) {
    throw new IdentityResolutionError('DISCORD_GUILD_ID is not configured on the server.', 500)
  }

  let members: { user: { username: string; id: string } }[]
  try {
    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(username)}&limit=10`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    )
    if (!discordRes.ok) {
      throw new IdentityResolutionError(
        'Failed to search Discord guild members. Check the bot token and guild ID.',
        400
      )
    }
    members = await discordRes.json()
  } catch (err) {
    if (err instanceof IdentityResolutionError) throw err
    throw new IdentityResolutionError(
      `Failed to resolve Discord user "${username}". Please try again later.`,
      400
    )
  }

  const match = members.find((m) => m.user.username.toLowerCase() === username.toLowerCase())
  if (!match) {
    throw new IdentityResolutionError(
      `Discord user "${username}" not found in the server. They must be a member of the Discord server.`,
      400
    )
  }

  return { externalId: String(match.user.id), username: match.user.username }
}
