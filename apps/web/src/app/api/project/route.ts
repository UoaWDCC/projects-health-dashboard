import { hasRole } from '@/lib/auth'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { revalidateTag } from 'next/cache'

/**
 * TODO: Add authentication and authorization to ensure only admins can access these routes
 * Add error validation for checking if the project name is unique and if the Discord link is valid.
 */

function validateGitHubLinkFormat(link: string) {
  // expected GitHub Link - https://github.com/owner/reponame
  const regex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/
  return regex.test(link)
}

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
  } catch (err: unknown) {
    console.error('GitHub validation error:', err)
    const status = (err as { status?: number })?.status
    if (status === 404)
      return Response.json({ error: 'GitHub repository not found' }, { status: 404 })
    if (status === 403)
      return Response.json(
        { error: 'GitHub repository not accessible (private or rate limited)' },
        { status: 403 }
      )
    if (status === 401)
      return Response.json({ error: 'Invalid GitHub token provided' }, { status: 401 })

    return Response.json({ error: 'Failed to validate GitHub repository' }, { status: 500 })
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
      return Response.json({ error: 'Discord channel not found' }, { status: 404 })
    if (res.status === 403)
      return Response.json(
        { error: 'Bot cannot access the Discord channel (forbidden)' },
        { status: 403 }
      )
    if (res.status === 401)
      return Response.json({ error: 'Invalid Discord token provided' }, { status: 401 })
  } catch (err: unknown) {
    console.error('Discord validation error:', err)
    return Response.json({ error: 'Failed to validate Discord channel' }, { status: 500 })
  }
}

// API route for handling project creation
export async function POST(request: Request) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLink = String(formData.get('githubLink') ?? '').trim()
    const discordSnowflakeId = String(formData.get('discordSnowflakeId') ?? '').trim()
    const projectDescription = String(formData.get('projectDescription') ?? '').trim()
    const projectStartDate = String(formData.get('projectStartDate') ?? '').trim()

    if (!projectName || !githubLink || !discordSnowflakeId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!validateGitHubLinkFormat(githubLink))
      return Response.json({ error: 'Invalid GitHub Repository Link' }, { status: 400 })

    const githubError = await validateGitHubExists(githubLink)

    if (githubError) return githubError

    const discordError = await validateSnowflakeExists(discordSnowflakeId)

    if (discordError) return discordError

    const [existingProject, existingRepo, existingChannel] = await Promise.all([
      db.project.findUnique({ where: { slug: projectName.toLowerCase().replace(/\s+/g, '-') } }),
      db.gitHubRepository.findFirst({
        where: { owner: githubLink.split('/')[3], name: githubLink.split('/')[4] },
      }),
      db.discordChannel.findUnique({ where: { externalId: discordSnowflakeId } }),
    ])

    if (existingProject) {
      return Response.json({ error: 'Project with this name already exists' }, { status: 409 })
    } else if (existingRepo) {
      return Response.json(
        {
          error:
            'GitHub Repository with this owner and name has already been linked to another project',
        },
        { status: 409 }
      )
    } else if (existingChannel) {
      return Response.json(
        {
          error:
            'Discord Channel with this Snowflake ID has already been linked to another project',
        },
        { status: 409 }
      )
    }

    const newProject = await db.$transaction(async (tx) => {
      return await tx.project.create({
        data: {
          name: projectName,
          slug: projectName.toLowerCase().replace(/\s+/g, '-'),
          description: projectDescription || null,
          startedAt: parseDate(projectStartDate),
          repositories: {
            create: {
              owner: githubLink.split('/')[3],
              name: githubLink.split('/')[4],
              installationId: process.env.GITHUB_APP_INSTALLATION_ID ?? '0',
            },
          },
          channels: {
            create: {
              externalId: discordSnowflakeId,
              // placeholder value
              name: projectName + ' Discord Channel',
            },
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
