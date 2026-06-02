import { hasRole } from '@/lib/auth'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { revalidateTag } from 'next/cache'
import { uploadImage } from '@/lib/storage'

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
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLinks = new Set(
      (formData.getAll('githubLinks') || []).map(String).map((s) => s.trim())
    )
    const rawSnowflakeIds = (formData.getAll('discordSnowflakeIds') || [])
      .map(String)
      .map((s) => s.trim())
    const rawChannelNames = (formData.getAll('discordChannelNames') || [])
      .map(String)
      .map((s) => s.trim())

    if (rawSnowflakeIds.length !== rawChannelNames.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Pair snowflakes with their channel names, dedupe by snowflake (keeps first-occurrence name).
    const discordChannels = new Map<string, string>()
    for (let i = 0; i < rawSnowflakeIds.length; i++) {
      const id = rawSnowflakeIds[i]
      const name = rawChannelNames[i]
      if (!id || !name) continue
      if (!discordChannels.has(id)) discordChannels.set(id, name)
    }

    const projectDescription = String(formData.get('projectDescription') ?? '').trim()
    const projectStartDate = String(formData.get('projectStartDate') ?? '').trim()
    const imageFile = formData.get('image')

    if (!projectName || githubLinks.size === 0 || discordChannels.size === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const slug = projectName.toLowerCase().replace(/\s+/g, '-')

    const existingProject = await db.project.findUnique({ where: { slug } })
    if (existingProject) {
      return Response.json({ error: 'Project with this name already exists' }, { status: 409 })
    }

    // github validation
    for (const githubLink of githubLinks) {
      if (!validateGitHubLinkFormat(githubLink))
        return Response.json({ error: 'Invalid GitHub Repository Link' }, { status: 400 })

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

// API route for editing project details
export async function PATCH(request: Request) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const projectId = String(formData.get('projectId') ?? '').trim()
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLinks = new Set(
      (formData.getAll('githubLinks') || []).map(String).map((s) => s.trim())
    )
    const rawSnowflakeIds = (formData.getAll('discordSnowflakeIds') || [])
      .map(String)
      .map((s) => s.trim())
    const rawChannelNames = (formData.getAll('discordChannelNames') || [])
      .map(String)
      .map((s) => s.trim())

    if (rawSnowflakeIds.length !== rawChannelNames.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Pair snowflakes with their channel names, dedupe by snowflake (keeps first-occurrence name).
    const discordChannels = new Map<string, string>()
    for (let i = 0; i < rawSnowflakeIds.length; i++) {
      const id = rawSnowflakeIds[i]
      const name = rawChannelNames[i]
      if (!id || !name) continue
      if (!discordChannels.has(id)) discordChannels.set(id, name)
    }

    const projectDescription = String(formData.get('projectDescription') ?? '').trim()

    if (!projectId || !projectName || githubLinks.size === 0 || discordChannels.size === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    for (const githubLink of githubLinks) {
      if (!validateGitHubLinkFormat(githubLink))
        return Response.json({ error: 'Invalid GitHub Repository Link' }, { status: 400 })
      const githubError = await validateGitHubExists(githubLink)
      if (githubError) return githubError

      const owner = githubLink.split('/')[3]
      const name = githubLink.split('/')[4]

      const existingRepo = await db.gitHubRepository.findFirst({
        where: { owner, name, projectId: { not: projectId } },
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

    for (const discordSnowflakeId of discordChannels.keys()) {
      const discordError = await validateSnowflakeExists(discordSnowflakeId)
      if (discordError) return discordError
    }

    const existingProject = await db.project.findUnique({ where: { id: projectId } })
    if (!existingProject) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    for (const snowflakeId of discordChannels.keys()) {
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

      // Soft delete, reactivate, or create new repos
      const currentRepos = await tx.gitHubRepository.findMany({
        where: { projectId },
      })
      const newRepoPairs = Array.from(githubLinks).map((link) => ({
        owner: link.split('/')[3],
        name: link.split('/')[4],
      }))

      const reposToSoftDelete = currentRepos.filter(
        (cr) => !newRepoPairs.some((nr) => nr.owner === cr.owner && nr.name === cr.name)
      )
      if (reposToSoftDelete.length > 0) {
        await tx.gitHubRepository.updateMany({
          where: {
            id: { in: reposToSoftDelete.map((r) => r.id) },
          },
          data: { isActive: false },
        })
      }

      const reposToReactivate = currentRepos.filter((cr) =>
        newRepoPairs.some((nr) => nr.owner === cr.owner && nr.name === cr.name)
      )
      if (reposToReactivate.length > 0) {
        await tx.gitHubRepository.updateMany({
          where: {
            id: { in: reposToReactivate.map((r) => r.id) },
          },
          data: { isActive: true },
        })
      }

      const reposToCreate = newRepoPairs.filter(
        (nr) => !currentRepos.some((cr) => cr.owner === nr.owner && cr.name === nr.name)
      )
      for (const nr of reposToCreate) {
        await tx.gitHubRepository.create({
          data: {
            projectId,
            owner: nr.owner,
            name: nr.name,
            installationId: process.env.GITHUB_APP_INSTALLATION_ID ?? '0',
            isActive: true,
          },
        })
      }

      // Soft delete, reactivate, or create Discord channels
      const currentChannels = await tx.discordChannel.findMany({
        where: { projectId },
      })

      const channelsToSoftDelete = currentChannels.filter(
        (cc) => !discordChannels.has(cc.externalId)
      )
      if (channelsToSoftDelete.length > 0) {
        await tx.discordChannel.updateMany({
          where: {
            id: { in: channelsToSoftDelete.map((c) => c.id) },
          },
          data: { isActive: false },
        })
      }

      const channelsToReactivate = currentChannels.filter((cc) =>
        discordChannels.has(cc.externalId)
      )
      for (const cc of channelsToReactivate) {
        await tx.discordChannel.update({
          where: { id: cc.id },
          data: {
            isActive: true,
            name: discordChannels.get(cc.externalId) || cc.name,
          },
        })
      }

      const channelsToCreate = Array.from(discordChannels.entries()).filter(
        ([id]) => !currentChannels.some((cc) => cc.externalId === id)
      )
      if (channelsToCreate.length > 0) {
        await tx.discordChannel.createMany({
          data: channelsToCreate.map(([id, name]) => ({
            projectId,
            externalId: id,
            name,
            isActive: true,
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
