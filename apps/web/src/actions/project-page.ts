// NOTE: These functions are for the admin view for /project/[slug]

'use server'

import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateRepository(
  repositoryId: string,
  data: { owner: string; name: string }
) {
  if (!(await hasRole('ADMIN'))) {
    throw new Error('Unauthorized. Admin access required.')
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
