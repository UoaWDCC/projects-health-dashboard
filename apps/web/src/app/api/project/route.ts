import { hasRole } from '@/lib/auth'
import { createProjectSchema } from '@/lib/schemas/admin'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { revalidateTag } from 'next/cache'
import { uploadImage } from '@/lib/storage'

function parseDate(input: string): Date | null {
  // expected input format - YYYY-MM
  const [year, month] = input.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) {
    return null
  }
  return new Date(Date.UTC(year, month - 1))
}

async function validateGitHubExists(link: string) {
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID
  if (!installationId) {
    console.error('GitHub App Installation ID is not configured')
    return Response.json(
      { error: 'GitHub configuration error, Installation ID not found' },
      { status: 500 }
    )
  }
  const octokit = await getInstallationOctokit(installationId)

  try {
    await octokit.request('GET /repos/{owner}/{repo}', {
      owner: link.split('/')[3],
      repo: link.split('/')[4],
    })

    return null
  } catch (err: unknown) {
    console.error('GitHub validation error:', err)
    const status = (err as { status?: number })?.status

    if (status === 404)
      return Response.json({ error: `GitHub repository ${link} not found` }, { status: 404 })
    if (status === 403)
      return Response.json(
        { error: `GitHub repository ${link} not accessible (private or rate limited)` },
        { status: 403 }
      )
    if (status === 401)
      return Response.json({ error: `Invalid GitHub token provided for ${link}` }, { status: 401 })
    return Response.json({ error: `Failed to validate GitHub repository ${link}` }, { status: 500 })
  }
}

async function validateSnowflakeExists(snowflakeId: string) {
  try {
    const TOKEN = process.env.DISCORD_BOT_TOKEN
    const res = await fetch(`https://discord.com/api/v10/channels/${snowflakeId}`, {
      headers: {
        Authorization: `Bot ${TOKEN}`,
      },
    })

    if (res.ok) return null

    if (res.status === 404)
      return Response.json(
        { error: `Discord channel with snowflakeId ${snowflakeId} not found` },
        { status: 404 }
      )
    if (res.status === 403)
      return Response.json(
        { error: `Bot cannot access Discord channel with snowflakeId ${snowflakeId} (forbidden)` },
        { status: 403 }
      )
    if (res.status === 401)
      return Response.json(
        { error: `Invalid Discord token provided for snowflakeId ${snowflakeId}` },
        { status: 401 }
      )
    return Response.json(
      { error: `Failed to validate Discord channel with snowflakeId ${snowflakeId}` },
      { status: 500 }
    )
  } catch (err: unknown) {
    console.error('Discord validation error:', err)
    return Response.json(
      { error: `Failed to validate Discord channel with snowflakeId ${snowflakeId}` },
      { status: 500 }
    )
  }
}

// API route for handling project creation
export async function POST(request: Request) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()

    const rawGithubLinks = (formData.getAll('githubLinks') || []).map(String).map((s) => s.trim())
    const rawSnowflakeIds = (formData.getAll('discordSnowflakeIds') || [])
      .map(String)
      .map((s) => s.trim())
    const rawChannelNames = (formData.getAll('discordChannelNames') || [])
      .map(String)
      .map((s) => s.trim())

    if (rawSnowflakeIds.length !== rawChannelNames.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsed = createProjectSchema.safeParse({
      projectName: String(formData.get('projectName') ?? '').trim(),
      projectDescription: String(formData.get('projectDescription') ?? '').trim(),
      projectStartDate: String(formData.get('projectStartDate') ?? '').trim(),
      githubLinks: [...new Set(rawGithubLinks)],
      discordSnowflakeIds: [...new Set(rawSnowflakeIds)],
    })

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    const { projectName, projectDescription, projectStartDate, githubLinks } = parsed.data

    // Pair snowflakes with their channel names, dedupe by snowflake (keeps first-occurrence name).
    const discordChannels = new Map<string, string>()
    for (let i = 0; i < rawSnowflakeIds.length; i++) {
      const id = rawSnowflakeIds[i]
      const name = rawChannelNames[i]
      if (!id || !name) continue
      if (!discordChannels.has(id)) discordChannels.set(id, name)
    }

    const slug = projectName.toLowerCase().replace(/\s+/g, '-')
    const imageFile = formData.get('image')

    const existingProject = await db.project.findUnique({ where: { slug } })
    if (existingProject) {
      return Response.json({ error: 'Project with this name already exists' }, { status: 409 })
    }

    // github validation
    for (const githubLink of githubLinks) {
      const githubError = await validateGitHubExists(githubLink)
      if (githubError) return githubError

      const existingRepo = await db.gitHubRepository.findFirst({
        where: { owner: githubLink.split('/')[3], name: githubLink.split('/')[4] },
      })
      if (existingRepo) {
        return Response.json(
          {
            error: `GitHub Repository ${githubLink} has already been linked to another project`,
          },
          { status: 409 }
        )
      }
    }

    // discord validation
    for (const snowflakeId of discordChannels.keys()) {
      const discordError = await validateSnowflakeExists(snowflakeId)
      if (discordError) return discordError

      const existingChannel = await db.discordChannel.findUnique({
        where: { externalId: snowflakeId },
      })
      if (existingChannel) {
        return Response.json(
          {
            error: `Discord Channel with Snowflake ID ${snowflakeId} has already been linked to another project`,
          },
          { status: 409 }
        )
      }
    }

    // Upload image before DB insert so a failed upload doesn't leave an orphaned project
    let imageUrl: string | null = null
    if (imageFile instanceof File && imageFile.size > 0) {
      imageUrl = await uploadImage('project-images', slug, imageFile)
    }

    const newProject = await db.$transaction(async (tx) => {
      return await tx.project.create({
        data: {
          name: projectName,
          slug,
          description: projectDescription || null,
          startedAt: parseDate(projectStartDate),
          imageUrl,
          repositories: {
            create: Array.from(githubLinks).map((githubLink) => ({
              owner: githubLink.split('/')[3],
              name: githubLink.split('/')[4],
              installationId: process.env.GITHUB_APP_INSTALLATION_ID ?? '0',
            })),
          },
          channels: {
            create: Array.from(discordChannels, ([externalId, name]) => ({
              externalId,
              name,
            })),
          },
        },
        include: {
          repositories: true,
          channels: true,
        },
      })
    })

    revalidateTag('projects')

    return Response.json(newProject, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}

// API route for fetching all active projects
export async function GET() {
  try {
    const projects = await db.project.findMany({
      where: { isActive: true },
      include: {
        repositories: true,
        channels: true,
      },
    })
    return Response.json(projects, { status: 200 })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}
