import { db } from '@repo/db'
import { unstable_cacheLife, unstable_cacheTag } from 'next/cache'

export const AVATAR_COLORS = ['#077CF1', '#4CAF64', '#E333A3', '#F2A33C', '#9A63F0', '#48A6A6']

export interface ProjectMemberSummary {
  id: string
  name: string
  imageUrl: string | null
}

export async function getProjectMembers(slug: string): Promise<ProjectMemberSummary[]> {
  'use cache'
  unstable_cacheLife('minutes')
  unstable_cacheTag('projects')

  const members = await db.projectMember.findMany({
    where: { project: { slug }, isActive: true },
    select: {
      id: true,
      displayName: true,
      person: {
        select: {
          displayName: true,
          imageUrl: true,
        },
      },
    },
  })

  return members.map((member) => ({
    id: member.id,
    name: member.displayName ?? member.person.displayName,
    imageUrl: member.person.imageUrl,
  }))
}
