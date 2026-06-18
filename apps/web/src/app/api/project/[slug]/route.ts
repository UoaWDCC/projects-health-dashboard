import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { validateGitHubExists } from '../route'
import { validateGitHubLinkFormat } from '../route'
import { validateSnowflakeExists } from '../route'

// API route for editing project details
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { slug } = await params
    const formData = await request.formData()
    const project = await db.project.findFirst({
      where: { slug: slug },
    })
    const projectId = project?.id
    const projectName = String(formData.get('projectName') ?? '').trim()
    const projectSlug = projectName.toLowerCase().trim().replace(/\s+/g, '-')
    // Ensure slug is unique
    const clashingProjects = await db.project.findMany({
      where: { slug: projectSlug },
    })
    if (clashingProjects.length > 0) {
      return Response.json({ error: `Project slug ${projectSlug} already in use` }, { status: 409 })
    }
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
          slug: projectSlug,
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
