// apps/web/src/actions/project-page.ts
'use server'

import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  validateGitHubLinkFormat,
  validateGitHubExists,
  validateSnowflakeExists,
} from '@/app/api/project/route'

async function responseErrorMessage(res: Response, fallback: string) {
  try {
    const body = await res.json()
    return body?.error ?? fallback
  } catch {
    return fallback
  }
}

export async function updateRepository(
  repositoryId: string,
  data: { owner: string; name: string }
) {
  if (!(await hasRole('ADMIN'))) {
    throw new Error('Unauthorized. Admin access required.')
  }

  const link = `https://github.com/${data.owner}/${data.name}`

  if (!validateGitHubLinkFormat(link)) {
    throw new Error(`Invalid GitHub link format: ${link}`)
  }

  const githubError = await validateGitHubExists(link)
  if (githubError) {
    throw new Error(await responseErrorMessage(githubError, `Failed to validate ${link}`))
  }

  const existingRepo = await db.gitHubRepository.findFirst({
    where: {
      owner: data.owner,
      name: data.name,
      isActive: true,
      id: { not: repositoryId },
    },
  })
  if (existingRepo) {
    throw new Error(
      `GitHub repository ${data.owner}/${data.name} is already linked to another project`
    )
  }

  const repo = await db.gitHubRepository.update({
    where: { id: repositoryId },
    data,
    include: { project: { select: { slug: true } } },
  })

  revalidatePath(`/${repo.project.slug}`)
}

export async function updateChannel(channelId: string, data: { externalId: string }) {
  if (!(await hasRole('ADMIN'))) {
    throw new Error('Unauthorized. Admin access required.')
  }

  const discordError = await validateSnowflakeExists(data.externalId)
  if (discordError) {
    throw new Error(
      await responseErrorMessage(
        discordError,
        `Failed to validate Discord channel ${data.externalId}`
      )
    )
  }

  const existingChannel = await db.discordChannel.findUnique({
    where: { externalId: data.externalId },
  })
  if (existingChannel && existingChannel.isActive && existingChannel.id !== channelId) {
    throw new Error(
      `Discord channel with snowflake ID ${data.externalId} is already linked to another project`
    )
  }

  const channel = await db.discordChannel.update({
    where: { id: channelId },
    data,
    include: { project: { select: { slug: true } } },
  })

  revalidatePath(`/${channel.project.slug}`)
}

export async function deleteProject(projectId: string) {
  if (!(await hasRole('ADMIN'))) {
    throw new Error('Unauthorized. Admin access required.')
  }

  await db.project.delete({ where: { id: projectId } })

  revalidatePath('/')
  redirect('/')
}
