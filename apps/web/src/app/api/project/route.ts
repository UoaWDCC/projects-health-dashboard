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
    return null
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
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLinks = (formData.getAll('githubLinks') || []).map(String).map((s) => s.trim())
    const discordSnowflakeIds = (formData.getAll('discordSnowflakeIds') || [])
      .map(String)
      .map((s) => s.trim())
    const projectDescription = String(formData.get('projectDescription') ?? '').trim()
    const projectStartDate = String(formData.get('projectStartDate') ?? '').trim()

    if (!projectName || githubLinks.length === 0 || discordSnowflakeIds.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For now we only support linking one GitHub repo per project, so we take the first link provided
    const githubLink = githubLinks[0]

    if (!validateGitHubLinkFormat(githubLink))
      return Response.json({ error: 'Invalid GitHub Repository Link' }, { status: 400 })

    const githubError = await validateGitHubExists(githubLink)
    if (githubError) return githubError

    for (const discordSnowflakeId of discordSnowflakeIds) {
      const discordError = await validateSnowflakeExists(discordSnowflakeId)
      if (discordError) return discordError
    }

    const [existingProject, existingRepo] = await Promise.all([
      db.project.findUnique({ where: { slug: projectName.toLowerCase().replace(/\s+/g, '-') } }),
      db.gitHubRepository.findFirst({
        where: { owner: githubLink.split('/')[3], name: githubLink.split('/')[4] },
      }),
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
    }

    for (const snowflakeId of discordSnowflakeIds) {
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
            create: discordSnowflakeIds.map((discordSnowflakeId) => ({
              externalId: discordSnowflakeId,
              // placeholder value
              name: projectName + ' Discord Channel',
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

// API route for editing project details
export async function PATCH(request: Request) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const projectId = String(formData.get('projectId') ?? '').trim()
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLinks = (formData.getAll('githubLinks') || []).map(String).map((s) => s.trim())
    const discordSnowflakeIds = (formData.getAll('discordSnowflakeIds') || [])
      .map(String)
      .map((s) => s.trim())
    const projectDescription = String(formData.get('projectDescription') ?? '').trim()

    if (
      !projectId ||
      !projectName ||
      githubLinks.length === 0 ||
      discordSnowflakeIds.length === 0
    ) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For now we only support linking one GitHub repo per project, so we take the first link provided
    const githubLink = githubLinks[0]

    if (!validateGitHubLinkFormat(githubLink))
      return Response.json({ error: 'Invalid GitHub Repository Link' }, { status: 400 })

    const githubError = await validateGitHubExists(githubLink)
    if (githubError) return githubError

    for (const discordSnowflakeId of discordSnowflakeIds) {
      const discordError = await validateSnowflakeExists(discordSnowflakeId)
      if (discordError) return discordError
    }

    const existingProject = await db.project.findUnique({ where: { id: projectId } })
    if (!existingProject) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    const newRepoOwner = githubLink.split('/')[3]
    const newRepoName = githubLink.split('/')[4]

    const existingRepo = await db.gitHubRepository.findFirst({
      where: { owner: newRepoOwner, name: newRepoName, projectId: { not: projectId } },
    })

    if (existingRepo) {
      return Response.json(
        {
          error:
            'GitHub Repository with this owner and name has already been linked to another project',
        },
        { status: 409 }
      )
    }

    for (const snowflakeId of discordSnowflakeIds) {
      const existingChannel = await db.discordChannel.findUnique({
        where: { externalId: snowflakeId },
      })
      if (existingChannel && existingChannel.projectId !== projectId) {
        return Response.json(
          {
            error: `Discord Channel with Snowflake ID ${snowflakeId} has already been linked to another project`,
          },
          { status: 409 }
        )
      }
    }

    const updatedProject = await db.$transaction(async (tx) => {
      // Update basic project details
      await tx.project.update({
        where: { id: projectId },
        data: {
          name: projectName,
          description: projectDescription || null,
        },
      })

      // Replace GitHub repositories
      await tx.gitHubRepository.deleteMany({ where: { projectId } })
      await tx.gitHubRepository.create({
        data: {
          projectId,
          owner: newRepoOwner,
          name: newRepoName,
          installationId: process.env.GITHUB_APP_INSTALLATION_ID ?? '0',
        },
      })

      // Replace Discord channels
      await tx.discordChannel.deleteMany({ where: { projectId } })
      if (discordSnowflakeIds.length > 0) {
        await tx.discordChannel.createMany({
          data: discordSnowflakeIds.map((id) => ({
            projectId,
            externalId: id,
            name: projectName + ' Discord Channel',
          })),
        })
      }

      return await tx.project.findUnique({
        where: { id: projectId },
        include: {
          repositories: true,
          channels: true,
        },
      })
    })

    revalidateTag('projects')

    return Response.json(updatedProject, { status: 200 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to update project' },
      { status: 500 }
    )
  }
}
